// Store our data
let taxSteps = null;
let detailedSteps = null;
let quill = null;

// Predefined scenarios
const scenarios = {
  freeze_trust: `Je suis [NOM] et je suis actionnaire de 100 actions "A" (toutes les actions) de [NOM_SOCIETE]. La JVM des actions est de [MONTANT]$.

Peux-tu écrire une note avec les étapes suivantes :
1) Constitution d'une fiducie familiale : [NOM] ([DATE])
2) Échange d'actions 100 A de [NOM_SOCIETE] contre [NOMBRE] actions E (privilégiées), d'une valeur de [MONTANT]$. ([DATE])
3) Souscription de la fiducie aux 100 actions B (participantes) pour 10$, [NOM] souscrit aux 100 actions C (votantes) pour 10$ ([DATE])
4) Dividendes sur les actions B pour [MONTANT]$ le [DATE]`,

  management_company: `Je souhaite créer une société de gestion pour [NOM_PROFESSIONNEL].

Détails requis :
- Professionnel : [NOM]
- Société professionnelle existante : [NOM_SOCIETE]
- Revenus annuels approximatifs : [MONTANT]$
- Besoins personnels annuels : [MONTANT]$`,

  share_sale: `Je souhaite vendre les actions de ma société.

Détails de la transaction :
- Vendeur : [NOM]
- Société : [NOM_SOCIETE]
- Prix de vente proposé : [MONTANT]$
- PBR approximatif : [MONTANT]$
- Date prévue de la transaction : [DATE]`,

  estate_planning: `Je souhaite planifier ma succession.

Situation actuelle :
- Client : [NOM]
- Âge : [AGE]
- Actifs principaux :
  * Résidence : [MONTANT]$
  * Placements : [MONTANT]$
  * Société privée : [MONTANT]$
- Bénéficiaires souhaités : [BENEFICIAIRES]`,

  tax_reorganization: `Je souhaite réorganiser la structure corporative.

Structure actuelle :
- Société opérante : [NOM_SOCIETE]
- Actionnaire(s) : [NOM] ([POURCENTAGE]%)
- Valeur approximative : [MONTANT]$
- Objectif de la réorganisation : [OBJECTIF]`
};

// Handle scenario selection
document.getElementById('scenarioSelect').addEventListener('change', function(e) {
  const selectedScenario = e.target.value;
  const promptArea = document.getElementById('userPrompt');
  
  if (selectedScenario && scenarios[selectedScenario]) {
    promptArea.value = scenarios[selectedScenario];
  } else {
    promptArea.value = '';
  }
});

// Initialize Quill editor
document.addEventListener('DOMContentLoaded', function() {
  quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'header': 1 }, { 'header': 2 }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'font': [] }],
        [{ 'align': [] }],
        ['clean']
      ]
    },
    placeholder: 'Le plan fiscal détaillé apparaîtra ici...',
  });
  
  // Load tax steps after Quill is initialized
  loadTaxSteps();
});

// Load tax planning steps when page loads
async function loadTaxSteps() {
  console.log('Loading tax planning data...');
  try {
    // Load both JSON files in parallel
    const [summaryResponse, noteResponse] = await Promise.all([
      fetch('summary.json'),
      fetch('note.json')
    ]);
    
    console.log('Summary.json response status:', summaryResponse.status);
    console.log('Note.json response status:', noteResponse.status);
    
    if (!summaryResponse.ok || !noteResponse.ok) {
      throw new Error('Failed to load tax planning data');
    }
    
    const [summaryData, noteData] = await Promise.all([
      summaryResponse.json(),
      noteResponse.json()
    ]);
    
    console.log('Loaded summary steps:', summaryData.etapes?.length || 0, 'steps');
    console.log('Loaded detailed steps:', noteData.etapes?.length || 0, 'steps');
    
    taxSteps = summaryData.etapes;
    detailedSteps = noteData.etapes;
  } catch (error) {
    console.error('Error loading tax steps:', error);
    showError('Échec du chargement des données de planification fiscale. Veuillez rafraîchir la page.');
  }
}

// Handle form submission
document.getElementById('taxPlanningForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  console.log('Form submitted');
  
  const userPrompt = document.getElementById('userPrompt').value.trim();
  console.log('User prompt:', userPrompt);
  
  if (!userPrompt) {
    console.warn('Empty prompt submitted');
    showError('Veuillez décrire vos besoins en planification fiscale');
    return;
  }

  if (!taxSteps || !detailedSteps) {
    console.error('Tax planning data not loaded');
    showError('Données de planification fiscale non chargées. Veuillez rafraîchir la page.');
    return;
  }

  // Show loading state
  setLoading(true);
  hideError();
  hideResults();

  try {
    console.log('Starting API calls...');
    
    // First API call - Get relevant steps
    console.log('Making first API call to select steps...');
    const payload = {
      prompt: `Analyze the following steps and select the most relevant ones for this request:
${userPrompt}

IMPORTANT: Return ONLY a numeric ID array, for example: [1, 16, 19, 20]
Do not return explanatory text, only the JSON ID array.`,
      steps: taxSteps.map(step => ({
        ID: step.ID,
        titre: step.titre,
        description: step.description
      }))
    };
    console.log('First API payload:', payload);

    const stepsResponse = await fetch('https://llm1-ik32xiclqq-uc.a.run.app', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('First API response status:', stepsResponse.status);
    
    // Get the response text first to help with debugging
    const responseText = await stepsResponse.text();
    console.log('Raw API response:', responseText);

    if (!stepsResponse.ok) {
      console.error('First API call failed:', stepsResponse.status, responseText);
      throw new Error(`Échec de l'analyse de votre demande: ${responseText}`);
    }
    
    let stepsResult;
    try {
      stepsResult = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse API response:', e);
      throw new Error('Format de réponse invalide du serveur');
    }

    console.log('First API response data:', stepsResult);
    
    if (!stepsResult.success || !Array.isArray(stepsResult.data)) {
      console.error('Invalid first API response structure:', stepsResult);
      throw new Error('Réponse invalide de la sélection des étapes');
    }

    const selectedStepIds = stepsResult.data;
    console.log('Selected step IDs:', selectedStepIds);
    
    if (selectedStepIds.length === 0) {
      throw new Error('Aucune étape pertinente trouvée pour votre demande');
    }

    // Get detailed steps from note.json
    const selectedDetailedSteps = detailedSteps.filter(step => selectedStepIds.includes(step.ID));
    console.log('Selected detailed steps:', selectedDetailedSteps);

    if (selectedDetailedSteps.length === 0) {
      throw new Error('Impossible de trouver des étapes correspondantes dans notre base de données');
    }

    // Second API call - Generate detailed note
    console.log('Making second API call to generate note...');
    const notePayload = {
      selectedIds: selectedStepIds,
      steps: selectedDetailedSteps.map(step => ({
        ID: step.ID,
        titre: step.Titre,
        texte: step.texte,
        tableau: step.tableau,
        notes: step.notes
      })),
      userPrompt: userPrompt,
      template: `# Plan de planification fiscale

                  ## Étapes sélectionnées

                  [Les étapes seront détaillées ici en utilisant le texte complet de chaque étape]
                  
                  Pour chaque étape sélectionnée, tu dois :
                  1. Garder la structure exacte du texte fourni
                  2. Remplacer tous les [placeholders] par les informations fournies dans le userPrompt
                  3. Ne pas ajouter d'informations qui ne sont pas dans le texte original
                  4. Formater les montants avec le format suivant : X DOLLARS (xx $)
                  5. Conserver tous les détails techniques et juridiques
                  6. Inclure tous les tableaux fournis en les adaptant avec les informations du userPrompt
                  7. Ne pas inclure les notes, ce sont uniquement des notes pour l'assistant
      `
    };
    console.log('Second API payload:', notePayload);

    const noteResponse = await fetch('https://llm2-ik32xiclqq-uc.a.run.app', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(notePayload)
    });

    console.log('Second API response status:', noteResponse.status);
    
    // Get the response text first
    const noteResponseText = await noteResponse.text();
    console.log('Raw note API response:', noteResponseText);

    if (!noteResponse.ok) {
      console.error('Second API call failed:', noteResponse.status, noteResponseText);
      throw new Error('Échec de la génération du plan détaillé');
    }
    
    let noteResult;
    try {
      noteResult = JSON.parse(noteResponseText);
    } catch (e) {
      console.error('Failed to parse note API response:', e);
      throw new Error('Format de réponse invalide du serveur de génération de notes');
    }

    console.log('Second API response data:', noteResult);
    
    if (!noteResult.success || !noteResult.data) {
      console.error('Invalid second API response structure:', noteResult);
      throw new Error('Réponse invalide de la génération de notes');
    }

    // Display results
    console.log('Displaying results');
    displayResults(selectedDetailedSteps, noteResult.data);
    console.log('Results displayed successfully');
  } catch (error) {
    console.error('Process error:', error);
    showError(error.message || 'Une erreur inattendue est survenue. Veuillez réessayer.');
  } finally {
    console.log('Process completed');
    setLoading(false);
  }
});

// Display results
function displayResults(steps, note) {
  console.log('Displaying results');
  
  // Display selected steps with numbers and improved styling
  const stepsContainer = document.getElementById('selectedSteps');
  stepsContainer.innerHTML = steps.map((step, index) => `
    <div class="list-group-item d-flex align-items-start">
      <div class="me-3">
        <span class="badge bg-primary rounded-pill fs-6">${index + 1}</span>
      </div>
      <div>
        <h5 class="mb-1">${step.Titre || step.titre}</h5>
        ${step.description ? `<p class="mb-1 text-muted">${step.description}</p>` : ''}
      </div>
    </div>
  `).join('');
  
  // Display detailed note using Quill
  quill.root.innerHTML = formatNote(note);
  
  // Show results section
  document.getElementById('results').classList.remove('d-none');
  setLoading(false);
}

// Format note text with markdown-like syntax
function formatNote(text) {
  console.log('Formatting note text...');
  
  // First, handle any JSON table objects
  if (typeof text === 'object' && text.tableau) {
    const { header, rows } = text.tableau;
    return `
      <div class="table-responsive">
        <table class="table table-bordered table-striped">
          <thead class="thead-light">
            <tr>
              ${header.map(h => `<th scope="col">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // For text content, process step by step
  let formatted = text;
  
  // 1. Pre-process to protect certain content
  formatted = formatted
    // Protect markdown tables
    .replace(/(\|[^\n]+\|[^\n]*\n)+/g, match => {
      return `<table-placeholder>${encodeURIComponent(match)}</table-placeholder>`;
    });

  // 2. Handle bullet points and lists
  formatted = formatted
    // Convert bullet points to proper HTML lists
    .replace(/(?:^|\n)[ ]*[•-][ ]+([^\n]+)/g, '\n<li>$1</li>')
    .replace(/(<li>[^<]+<\/li>[\n]*)+/g, '<ul class="list-unstyled mb-3">$&</ul>');

  // 3. Handle headers and sections with numbering
  let sectionCount = 0;
  formatted = formatted
    .replace(/^# (.*$)/gm, (match, title) => {
      sectionCount = 0;
      return `<h1 class="mb-4">${title}</h1>`;
    })
    .replace(/^## (.*$)/gm, (match, title) => {
      sectionCount++;
      return `<h2 class="mb-3">${sectionCount}. ${title}</h2>`;
    })
    .replace(/^### (.*$)/gm, (match, title) => {
      return `<h3 class="mb-3">${title}</h3>`;
    });

  // 4. Handle text formatting
  formatted = formatted
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 5. Restore and format tables
  formatted = formatted
    .replace(/<table-placeholder>(.*?)<\/table-placeholder>/g, (match, content) => {
      const tableContent = decodeURIComponent(content);
      const rows = tableContent.trim().split('\n');
      const headers = rows[0].split('|').filter(cell => cell.trim());
      const data = rows.slice(2).map(row => row.split('|').filter(cell => cell.trim()));
      
      return `
        <div class="table-responsive">
          <table class="table table-bordered table-striped">
            <thead class="thead-light">
              <tr>
                ${headers.map(header => `<th scope="col">${header.trim()}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${row.map(cell => `<td>${cell.trim()}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    });

  // 6. Handle paragraphs and spacing
  formatted = formatted
    // Split text into paragraphs
    .split(/\n{2,}/)
    .map(paragraph => {
      // Skip if paragraph is already HTML
      if (paragraph.trim().startsWith('<')) return paragraph;
      
      // Handle single line breaks within paragraphs
      const formattedParagraph = paragraph
        .replace(/\n/g, '<br>')
        .trim();
      
      return formattedParagraph ? `<p class="mb-3">${formattedParagraph}</p>` : '';
    })
    .join('\n');

  // 7. Clean up
  formatted = formatted
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<p>\s*<br>\s*<\/p>/g, '<br>')
    .replace(/\n{2,}/g, '\n')
    .trim();

  console.log('Note formatting complete');
  return formatted;
}

// UI Helper functions
function setLoading(isLoading) {
  console.log('Setting loading state:', isLoading);
  document.getElementById('loadingIndicator').classList.toggle('d-none', !isLoading);
}

function hideResults() {
  console.log('Hiding results section');
  document.getElementById('results').classList.add('d-none');
}

function showError(message) {
  console.error('Showing error:', message);
  const alert = document.getElementById('errorAlert');
  document.getElementById('errorMessage').textContent = message;
  alert.classList.remove('d-none');
}

function hideError() {
  console.log('Hiding error alert');
  document.getElementById('errorAlert').classList.add('d-none');
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('Page loaded, initializing application...');
  loadTaxSteps();
}); 