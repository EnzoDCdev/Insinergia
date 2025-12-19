/**
 * PATIENT VIEW - Logica dettaglio paziente
 */

let currentPatient = null;
let currentPatientId = null;
let documents = [];
let analyses = [];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INIT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
document.addEventListener('DOMContentLoaded', async () => {
    log('Patient view loading...');

    if (!requireAuth()) return;

    const user = getUser();
    if (user) {
        updateUserDisplay(user);
    }

    currentPatientId = getQueryParam('id');
    if (!currentPatientId) {
        showError('ID paziente non trovato');
        setTimeout(() => window.location.href = '/dashboard.html', 2000);
        return;
    }

    await loadPatientData();
    setupEventListeners();

    log('Patient view ready');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOAD DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function loadPatientData() {
    try {
        showNotification('Caricamento paziente...', 'info');

        // Carica paziente (REQUIRED)
        const patientRes = await getPatient(currentPatientId);
        currentPatient = patientRes.data || patientRes;

        log('Paziente caricato');

        // Renderizza header
        renderPatientHeader();

        // Carica documenti (OPTIONAL - 404 is ok)
        try {
            const docsRes = await getDocuments(currentPatientId);
            documents = docsRes.data || docsRes || [];
            log('Documenti caricati:', documents.length);
        } catch (err) {
            warn('Documenti non disponibili:', err.message);
            documents = [];
        }

        // Carica analisi (OPTIONAL - 404 is ok)
        try {
            const analysesRes = await getAnalyses(currentPatientId);
            analyses = analysesRes.data || analysesRes || [];
            log('Analisi caricate:', analyses.length);
        } catch (err) {
            warn('Analisi non disponibili:', err.message);
            analyses = [];
        }

        // Renderizza contenuti
        renderDocuments();
        renderAnalyses();

        showSuccess('Paziente caricato');
    } catch (err) {
        error('Load error:', err);
        showError('Errore nel caricamento del paziente');
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RENDER HEADER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderPatientHeader() {
    if (!currentPatient) return;

    const headerDiv = document.getElementById('patientHeader');
    if (!headerDiv) return;

    const age = currentPatient.data_nascita ? 
        Math.floor((new Date() - new Date(currentPatient.data_nascita)) / (365.25 * 24 * 60 * 60 * 1000)) : 
        '-';

    headerDiv.innerHTML = `
        <h2>${currentPatient.cognome} ${currentPatient.nome}</h2>
        <div class="patient-info-row">
            <div class="info-item">
                <span class="info-label">Data di Nascita</span>
                <span class="info-value">${formatDate(currentPatient.data_nascita)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Età</span>
                <span class="info-value">${age} anni</span>
            </div>
            <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">${currentPatient.email || '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Telefono</span>
                <span class="info-value">${currentPatient.telefono || '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Codice Univoco</span>
                <span class="info-value">${currentPatient.codice_univoco || '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Aggiunto il</span>
                <span class="info-value">${formatDate(currentPatient.created_at)}</span>
            </div>
        </div>
    `;

    document.title = `${currentPatient.cognome} ${currentPatient.nome} - Insinergia`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RENDER DOCUMENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderDocuments() {
    const docsList = document.getElementById('documentsList');
    if (!docsList) return;

    if (documents.length === 0) {
        docsList.innerHTML = '<div class="empty-message">Nessun documento caricato</div>';
        return;
    }

    docsList.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Tipo</th>
                    <th>Data</th>
                    <th>Azione</th>
                </tr>
            </thead>
            <tbody>
                ${documents.map(doc => `
                    <tr>
                        <td>${doc.tipo || 'Documento'}</td>
                        <td>${formatDate(doc.created_at)}</td>
                        <td>
                            <a href="${doc.file_path}" target="_blank" class="btn btn-primary btn-sm">
                                Scarica
                            </a>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RENDER ANALYSES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderAnalyses() {
    const analysisList = document.getElementById('analysisList');
    if (!analysisList) return;

    if (analyses.length === 0) {
        analysisList.innerHTML = '<div class="empty-message">Nessuna analisi registrata</div>';
        return;
    }

    analysisList.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Tipo</th>
                    <th>Valore</th>
                    <th>Unità</th>
                    <th>Stato</th>
                </tr>
            </thead>
            <tbody>
                ${analyses.map(analysis => {
                    const statusClass = analysis.abnormal ? 'status-abnormal' : 'status-normal';
                    const statusText = analysis.abnormal ? '⚠️ Anomala' : '✓ Normale';
                    return `
                        <tr>
                            <td>${analysis.tipo || '-'}</td>
                            <td>${analysis.valore || '-'}</td>
                            <td>${analysis.unita_misura || '-'}</td>
                            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UPLOAD DOCUMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleUpload() {
    const fileInput = document.getElementById('fileUpload');
    const file = fileInput.files[0];

    if (!file) {
        showWarning('Seleziona un file');
        return;
    }

    try {
        showNotification('Caricamento documento...', 'info');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('tipo', 'Documento');

        await uploadDocument(currentPatientId, formData);

        fileInput.value = '';
        await loadPatientData();
        showSuccess('Documento caricato');
    } catch (err) {
        error('Upload error:', err);
        showError('Errore nel caricamento');
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UPDATE USER DISPLAY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function updateUserDisplay(user) {
    const userName = document.querySelector('.user-name');
    if (userName) {
        userName.textContent = user.nome || user.email || 'User';
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETUP LISTENERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function setupEventListeners() {
    // Back button
    const backBtn = document.querySelector('[data-action="back"]');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '/dashboard.html';
        });
    }

    // Upload button
    const uploadBtn = document.getElementById('btnUpload');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', handleUpload);
    }

    // File input enter
    const fileInput = document.getElementById('fileUpload');
    if (fileInput) {
        fileInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleUpload();
            }
        });
    }

    // Logout
    const logoutBtn = document.querySelector('[data-action="logout"]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // Theme toggle
    const themeBtn = document.querySelector('.theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
}