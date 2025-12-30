/**
 * PATIENT VIEW - Logica dettaglio paziente con edit e log
 * VERSIONE COMPLETA - Con tutte le funzioni e helpers
 * Upload documenti e analisi completamente separati
 */

let currentPatient = null;
let currentPatientId = null;
let documents = [];
let analyses = [];
let logs = [];
let editMode = false;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COSTANTI DOCUMENTI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DOC_FORM_ID = 'documentUploadForm';
const DOC_DROP_ZONE_ID = 'fileDropZone';
const DOC_FILE_INPUT_ID = 'fileInput';
const DOC_TYPE_SELECT_ID = 'docType';
const DOC_DESCRIZIONE_GROUP_ID = 'descrizioneGroup';
const DOC_UPLOAD_PROGRESS_ID = 'uploadProgress';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COSTANTI ANALISI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ANALYSIS_FORM_ID = 'analysisUploadForm';
const ANALYSIS_DROP_ZONE_ID = 'analysisDropZone';
const ANALYSIS_FILE_INPUT_ID = 'analysisFileInput';
const ANALYSIS_TYPE_SELECT_ID = 'analysisType';
const ANALYSIS_UPLOAD_PROGRESS_ID = 'analysisUploadProgress';

const PATIENT_FIELDS = [
    { key: 'codice_univoco', label: 'Codice Univoco', readonly: true },
    { key: 'cognome', label: 'Cognome' },
    { key: 'nome', label: 'Nome' },
    { key: 'data_nascita', label: 'Data di Nascita', type: 'date' },
    { key: 'sesso', label: 'Sesso', type: 'select', options: [{ value: '', label: '---' }, { value: 'M', label: 'Maschio' }, { value: 'F', label: 'Femmina' }] },
    { key: 'luogo_nascita', label: 'Luogo di Nascita' },
    { key: 'codice_fiscale', label: 'Codice Fiscale' },
    { key: 'indirizzo', label: 'Indirizzo' },
    { key: 'provincia_residenza', label: 'Provincia Residenza' },
    { key: 'comune_residenza', label: 'Comune Residenza' },
    { key: 'telefono', label: 'Telefono' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'note', label: 'Note', type: 'textarea' }
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function log(msg) {
    console.log('[PATIENT]', msg);
}

function error(msg, err) {
    console.error('[PATIENT]', msg, err);
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function formatDate(value) {
    if (!value) return '-';
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('it-IT');
    } catch {
        return '-';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : text;
    return div.innerHTML;
}

function getToken() {
    return localStorage.getItem('token');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API CALLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    
    const url = endpoint.startsWith('http') ? endpoint : `http://localhost:3000/api${endpoint}`;
    const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    
    if (!res.ok) {
        if (res.status === 404) {
            console.warn(`404: ${endpoint}`);
            return { data: [] };
        }
        throw new Error(`API Error: ${res.status}`);
    }
    
    return res.json();
}

async function getPatient(id) {
    return apiFetch(`/patients/${id}`);
}

async function getDocuments(patientId) {
    try {
        return apiFetch(`/patients/${patientId}/documents`);
    } catch (err) {
        console.warn('Documenti non disponibili');
        return { data: [] };
    }
}

async function getAnalyses(patientId) {
    try {
        return apiFetch(`/patients/${patientId}/analyses`);
    } catch (err) {
        console.warn('Analisi non disponibili');
        return { data: [] };
    }
}

async function getLogs(patientId) {
    try {
        return apiFetch(`/patients/${patientId}/logs`);
    } catch (err) {
        console.warn('Log non disponibili');
        return { data: [] };
    }
}

async function updatePatient(id, data) {
    return apiFetch(`/patients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function createLogEntry(fieldKey, oldValue, newValue) {
    try {
        const response = await fetch(`http://localhost:3000/api/patients/${currentPatientId}/logs`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                field: fieldKey,
                old_value: oldValue,
                new_value: newValue
            })
        });
        
        if (!response.ok) throw new Error('Log creation failed');
        log(`✅ Log creato: ${fieldKey} ${oldValue} → ${newValue}`);
    } catch (err) {
        error('Log creation error:', err);
    }
}

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
    setupDocumentUpload();
    setupAnalysisUpload();

    log('Patient view ready');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOAD DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadPatientData() {
    try {
        showNotification('Caricamento paziente...', 'info');

        // Carica paziente
        const patientRes = await getPatient(currentPatientId);
        currentPatient = patientRes.data || patientRes;

        log('Paziente caricato');

        renderPatientHeader();
        renderPatientData();

        // Carica documenti
        try {
            const docsRes = await getDocuments(currentPatientId);
            documents = docsRes.data || docsRes || [];
        } catch (err) {
            documents = [];
        }
        renderDocuments();

        // Carica analisi
        try {
            const analysesRes = await getAnalyses(currentPatientId);
            analyses = analysesRes.data || analysesRes || [];
        } catch (err) {
            analyses = [];
        }
        renderAnalyses();

        // Carica log
        try {
            const logsRes = await getLogs(currentPatientId);
            logs = logsRes.data || logsRes || [];
        } catch (err) {
            logs = [];
        }
        renderLogs();

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
                <span class="info-label">Aggiunto il</span>
                <span class="info-value">${formatDate(currentPatient.created_at)}</span>
            </div>
        </div>
    `;

    document.title = `${currentPatient.cognome} ${currentPatient.nome} - Insinergia`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RENDER PATIENT DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function renderPatientData() {
    const viewMode = document.getElementById('viewMode');
    const editModeDiv = document.getElementById('editMode');

    if (!viewMode || !editModeDiv) return;

    // VIEW MODE
    viewMode.innerHTML = PATIENT_FIELDS.map(field => `
        <div class="data-item">
            <span class="data-label">${field.label}</span>
            <span class="data-value">${currentPatient[field.key] || '-'}</span>
        </div>
    `).join('');

    // EDIT MODE
    editModeDiv.innerHTML = `
        <form id="patientForm">
            ${PATIENT_FIELDS.map(field => renderFormField(field)).join('')}
            <div class="form-actions">
                <button type="button" class="btn-primary btn-sm" id="btnSave">💾 Salva</button>
                <button type="button" class="btn-secondary btn-sm" id="btnCancel">❌ Annulla</button>
            </div>
        </form>
    `;

    // Popola form con dati attuali
    PATIENT_FIELDS.forEach(field => {
        const input = document.querySelector(`[name="${field.key}"]`);
        if (input) {
            input.value = currentPatient[field.key] || '';
        }
    });
}

function renderFormField(field) {
    if (field.readonly) {
        return `
            <div class="form-group">
                <label>${field.label}</label>
                <input type="text" value="${currentPatient[field.key]}" readonly>
            </div>
        `;
    }

    if (field.type === 'textarea') {
        return `
            <div class="form-group">
                <label>${field.label}</label>
                <textarea name="${field.key}"></textarea>
            </div>
        `;
    }

    if (field.type === 'select') {
        return `
            <div class="form-group">
                <label>${field.label}</label>
                <select name="${field.key}">
                    ${field.options.map(opt => `
                        <option value="${opt.value}">${opt.label}</option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    return `
        <div class="form-group">
            <label>${field.label}</label>
            <input type="${field.type || 'text'}" name="${field.key}" value="${currentPatient[field.key] || ''}">
        </div>
    `;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EDIT MODE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function toggleEditMode() {
    editMode = !editMode;
    document.getElementById('viewMode').style.display = editMode ? 'none' : 'grid';
    document.getElementById('editMode').style.display = editMode ? 'block' : 'none';
    document.getElementById('btnEditMode').textContent = editMode ? '✖️ Chiudi' : '✏️ Modifica';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SAVE PATIENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function savePatient() {
    const formData = {};
    const changes = [];
    
    PATIENT_FIELDS.forEach(field => {
        if (!field.readonly) {
            const input = document.querySelector(`[name="${field.key}"]`);
            if (input) {
                const newValue = input.value || null;
                const oldValue = currentPatient[field.key];
                
                formData[field.key] = newValue;
                
                if (oldValue !== newValue) {
                    changes.push({
                        field: field.key,
                        old: oldValue,
                        new: newValue
                    });
                }
            }
        }
    });

    try {
        showNotification('Salvataggio...', 'info');
        await updatePatient(currentPatientId, formData);
        
        for (const change of changes) {
            await createLogEntry(change.field, change.old, change.new);
        }
        
        Object.assign(currentPatient, formData);
        
        editMode = false;
        renderPatientData();
        document.getElementById('viewMode').style.display = 'grid';
        document.getElementById('editMode').style.display = 'none';
        document.getElementById('btnEditMode').textContent = '✏️ Modifica';
        
        await loadPatientData();
        
        showSuccess(`Paziente aggiornato (${changes.length} modifiche registrate)`);
    } catch (err) {
        error('Save error:', err);
        showError('Errore nel salvataggio');
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📄 DOCUMENTI UPLOAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function setupDocumentUpload() {
    const docForm = document.getElementById(DOC_FORM_ID);
    const docDropZone = document.getElementById(DOC_DROP_ZONE_ID);
    const docFileInput = document.getElementById(DOC_FILE_INPUT_ID);
    const docTypeSelect = document.getElementById(DOC_TYPE_SELECT_ID);
    const docDescrizioneGroup = document.getElementById(DOC_DESCRIZIONE_GROUP_ID);

    if (!docForm || !docDropZone || !docFileInput) {
        console.warn('⚠️ Document upload form not found');
        return;
    }

    // Mostra/nascondi descrizione se "Altro"
    if (docTypeSelect) {
        docTypeSelect.addEventListener('change', (e) => {
            if (docDescrizioneGroup) {
                docDescrizioneGroup.style.display = e.target.value === 'Altro' ? 'block' : 'none';
            }
        });
    }

    // Click sul drop zone per aprire file picker
    docDropZone.addEventListener('click', () => {
        docFileInput.click();
    });

    // Mostra nome file quando selezionato
    docFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const fileName = e.target.files[0].name;
            updateDocDropZoneText(docDropZone, fileName);
        }
    });

    // Drag & drop
    docDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        docDropZone.classList.add('dragover');
    });

    docDropZone.addEventListener('dragleave', () => {
        docDropZone.classList.remove('dragover');
    });

    docDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        docDropZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            docFileInput.files = files;
            const fileName = files[0].name;
            updateDocDropZoneText(docDropZone, fileName);
            console.log('📁 File selezionato via drag:', fileName);
        }
    });

    // Submit form
    docForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const file = docFileInput.files[0];
        const tipo = docTypeSelect.value;
        const descrizione = document.getElementById('descrizione')?.value || '';

        if (!file) {
            alert('❌ Seleziona un file');
            return;
        }

        if (!tipo) {
            alert('❌ Seleziona un tipo di documento');
            return;
        }

        if (tipo === 'Altro' && !descrizione) {
            alert('❌ Inserisci una descrizione');
            return;
        }

        await uploadDocumentFile(file, tipo, descrizione);
    });
}

function updateDocDropZoneText(dropZone, fileName) {
    const uploadText = dropZone.querySelector('.upload-text');
    if (uploadText) {
        uploadText.innerHTML = `
            <p style="color: var(--color-success); font-weight: 600;">
                ✅ ${fileName}
            </p>
            <p style="font-size: 0.85em; margin-top: 5px;">
                Pronto per il caricamento
            </p>
        `;
    }
}

async function uploadDocumentFile(file, tipo, descrizione) {
    try {
        console.log('📤 Upload Documento:', file.name, 'Tipo:', tipo);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('tipo', tipo);
        if (descrizione) {
            formData.append('descrizione', descrizione);
        }

        const token = getToken();
        const uploadProgress = document.getElementById(DOC_UPLOAD_PROGRESS_ID);
        const progressBar = uploadProgress?.querySelector('.progress-bar');
        const progressText = uploadProgress?.querySelector('.progress-text');

        if (uploadProgress) {
            uploadProgress.style.display = 'block';
        }

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                console.log('📊 Progresso:', percentComplete.toFixed(0) + '%');
                
                if (progressBar) {
                    progressBar.style.width = percentComplete + '%';
                }
                if (progressText) {
                    progressText.textContent = `Caricamento in corso... ${percentComplete.toFixed(0)}%`;
                }
            }
        });

        xhr.addEventListener('load', async () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                console.log('✅ Upload documento completato:', data);

                // Reset form
                document.getElementById(DOC_FORM_ID).reset();
                document.getElementById(DOC_FILE_INPUT_ID).value = '';
                
                // Ripristina testo drop zone
                const dropZone = document.getElementById(DOC_DROP_ZONE_ID);
                const uploadText = dropZone.querySelector('.upload-text');
                if (uploadText) {
                    uploadText.innerHTML = `
                        Trascina i file qui o
                        <span class="upload-link">clicca per selezionare</span>
                    `;
                }

                // Nascondi barra progresso
                if (uploadProgress) {
                    setTimeout(() => {
                        uploadProgress.style.display = 'none';
                        if (progressBar) progressBar.style.width = '0%';
                    }, 1000);
                }

                // Ricarica documenti
                await loadPatientData();

                alert('✅ Documento caricato con successo');
            } else {
                const error = JSON.parse(xhr.responseText);
                throw new Error(error.error || 'Upload failed');
            }
        });

        xhr.addEventListener('error', () => {
            throw new Error('Errore di connessione');
        });

        xhr.open('POST', `/api/patients/${currentPatientId}/documents`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);

    } catch (err) {
        console.error('❌ Upload documento error:', err);
        if (uploadProgress) {
            uploadProgress.style.display = 'none';
        }
        alert(`❌ Errore: ${err.message}`);
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧬 ANALISI UPLOAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function setupAnalysisUpload() {
    const analysisForm = document.getElementById(ANALYSIS_FORM_ID);
    const analysisDropZone = document.getElementById(ANALYSIS_DROP_ZONE_ID);
    const analysisFileInput = document.getElementById(ANALYSIS_FILE_INPUT_ID);
    const analysisType = document.getElementById(ANALYSIS_TYPE_SELECT_ID);

    if (!analysisForm || !analysisDropZone || !analysisFileInput) {
        console.warn('⚠️ Analysis upload form not found');
        return;
    }

    // Click per aprire file picker
    analysisDropZone.addEventListener('click', () => {
        analysisFileInput.click();
    });

    // Mostra nome file quando selezionato
    analysisFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const fileName = e.target.files[0].name;
            updateAnalysisDropZoneText(analysisDropZone, fileName);
        }
    });

    // Drag & drop
    analysisDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        analysisDropZone.classList.add('dragover');
    });

    analysisDropZone.addEventListener('dragleave', () => {
        analysisDropZone.classList.remove('dragover');
    });

    analysisDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        analysisDropZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            analysisFileInput.files = files;
            const fileName = files[0].name;
            updateAnalysisDropZoneText(analysisDropZone, fileName);
            console.log('📊 CSV selezionato:', fileName);
        }
    });

    // Submit form
    analysisForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const file = analysisFileInput.files[0];
        const tipo = analysisType.value;

        if (!file) {
            alert('❌ Seleziona un file CSV');
            return;
        }

        if (!tipo) {
            alert('❌ Seleziona un tipo di analisi');
            return;
        }

        if (!file.name.endsWith('.csv')) {
            alert('❌ Il file deve essere in formato CSV');
            return;
        }

        await uploadAnalysisFile(file, tipo);
    });
}

function updateAnalysisDropZoneText(dropZone, fileName) {
    const uploadText = dropZone.querySelector('.upload-text');
    if (uploadText) {
        uploadText.innerHTML = `
            <p style="color: var(--color-success); font-weight: 600;">
                ✅ ${fileName}
            </p>
            <p style="font-size: 0.85em; margin-top: 5px;">
                Pronto per il caricamento
            </p>
        `;
    }
}

async function uploadAnalysisFile(file, tipo) {
    try {
        console.log('📤 Upload Analisi:', file.name, 'Tipo:', tipo);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('tipo', tipo);

        const token = getToken();
        const uploadProgress = document.getElementById(ANALYSIS_UPLOAD_PROGRESS_ID);
        const progressBar = uploadProgress?.querySelector('.progress-bar');
        const progressText = uploadProgress?.querySelector('.progress-text');

        // Mostra barra di progresso
        if (uploadProgress) {
            uploadProgress.style.display = 'block';
        }

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                if (progressBar) {
                    progressBar.style.width = percentComplete + '%';
                }
                if (progressText) {
                    progressText.textContent = `Caricamento in corso... ${percentComplete.toFixed(0)}%`;
                }
            }
        });

        xhr.addEventListener('load', async () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                console.log('✅ Upload analisi completato:', data);

                // Reset form
                document.getElementById(ANALYSIS_FORM_ID).reset();
                document.getElementById(ANALYSIS_FILE_INPUT_ID).value = '';
                
                // Ripristina testo drop zone
                const dropZone = document.getElementById(ANALYSIS_DROP_ZONE_ID);
                const uploadText = dropZone.querySelector('.upload-text');
                if (uploadText) {
                    uploadText.innerHTML = `
                        Trascina il CSV qui o
                        <span class="upload-link">clicca per selezionare</span>
                    `;
                }

                // Nascondi barra progresso
                if (uploadProgress) {
                    setTimeout(() => {
                        uploadProgress.style.display = 'none';
                        if (progressBar) progressBar.style.width = '0%';
                    }, 1000);
                }

                // Ricarica analisi
                await loadPatientData();

                alert('✅ Analisi caricata con successo');
            } else {
                const error = JSON.parse(xhr.responseText);
                throw new Error(error.error || 'Upload failed');
            }
        });

        xhr.addEventListener('error', () => {
            throw new Error('Errore di connessione');
        });

        xhr.open('POST', `/api/patients/${currentPatientId}/analyses`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);

    } catch (err) {
        console.error('❌ Upload analisi error:', err);
        const uploadProgress = document.getElementById(ANALYSIS_UPLOAD_PROGRESS_ID);
        if (uploadProgress) {
            uploadProgress.style.display = 'none';
        }
        alert(`❌ Errore: ${err.message}`);
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RENDER DOCUMENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function viewDocument(id) {
    try {
        const token = getToken();
        const response = await fetch(`/api/documents/${id}/view`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error('❌ Response status:', response.status);
            throw new Error('Errore download');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        
        setTimeout(() => window.URL.revokeObjectURL(url), 5000);
    } catch (err) {
        console.error('❌ Errore visualizzazione:', err);
        alert('Errore nell\'apertura del documento');
    }
}

async function downloadDocument(id) {
    try {
        const token = getToken();
        const response = await fetch(`/api/documents/${id}/download`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Errore download');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `documento-${id}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error('❌ Errore download:', err);
        alert('Errore nel download del documento');
    }
}

async function deleteDocument(id) {
    if (!confirm('Sei sicuro di voler eliminare questo documento?')) {
        return;
    }

    try {
        const token = getToken();
        const response = await fetch(`/api/documents/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Errore eliminazione');
        }

        console.log('✅ Documento eliminato');
        await loadPatientData();
        alert('✅ Documento eliminato con successo');
    } catch (err) {
        console.error('❌ Errore:', err);
        alert(`❌ Errore: ${err.message}`);
    }
}

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
                    <th>Azioni</th>
                </tr>
            </thead>
            <tbody>
                ${documents.map(doc => `
                    <tr>
                        <td>${doc.tipo || 'Documento'}</td>
                        <td>${formatDate(doc.created_at)}</td>
                        <td>
                            <button type="button" class="btn btn-primary btn-sm" onclick="viewDocument(${doc.id})">
                                👁️ Visualizza
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="downloadDocument(${doc.id})">
                                ⬇️ Scarica
                            </button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="deleteDocument(${doc.id})">
                                🗑️ Elimina
                            </button>
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

async function viewAnalysisDetails(analysisId) {
    window.location.href = `/analysis-detail.html?patientId=${currentPatientId}&analysisId=${analysisId}`;
}

async function deleteAnalysis(analysisId) {
    if (!confirm('Sei sicuro di voler eliminare questa analisi?')) {
        return;
    }

    try {
        const token = getToken();
        const response = await fetch(`/api/patients/${currentPatientId}/analyses/${analysisId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Errore eliminazione');
        }

        console.log('✅ Analisi eliminata');
        await loadPatientData();
        alert('✅ Analisi eliminata con successo');
    } catch (err) {
        console.error('❌ Errore:', err);
        alert(`❌ Errore: ${err.message}`);
    }
}

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
                    <th>Data</th>
                    <th>Azioni</th>
                </tr>
            </thead>
            <tbody>
                ${analyses.map(analysis => `
                    <tr>
                        <td>${analysis.tipo || 'Analisi'}</td>
                        <td>${formatDate(analysis.created_at)}</td>
                        <td>
                            <button type="button" class="btn btn-primary btn-sm" onclick="viewAnalysisDetails(${analysis.id})">
                                👁️ Visualizza
                            </button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="deleteAnalysis(${analysis.id})">
                                🗑️ Elimina
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RENDER LOGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function renderLogs() {
    const logList = document.getElementById('logList');
    if (!logList) return;

    if (logs.length === 0) {
        logList.innerHTML = '<div class="empty-message">Nessuna modifica registrata</div>';
        return;
    }

    logList.innerHTML = logs.map(logEntry => `
        <div class="log-entry">
            <div class="log-entry-header">
                <span class="log-entry-user">👤 ${logEntry.user_nome || logEntry.username}</span>
                <span class="log-entry-time">${formatDate(logEntry.created_at)}</span>
            </div>
            <div class="log-entry-field">📝 ${logEntry.field}</div>
            <div class="log-entry-change">
                <div><strong>Valore Precedente:</strong><br><span class="log-old-value">${logEntry.old_value || '(vuoto)'}</span></div>
                <div><strong>Nuovo Valore:</strong><br><span class="log-new-value">${logEntry.new_value || '(vuoto)'}</span></div>
            </div>
        </div>
    `).join('');
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
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            console.log('🔄 Switching to tab:', tabName);

            // Nascondi tutti i tab
            document.querySelectorAll('.tab-content').forEach((tab) => {
                tab.classList.remove('active');
            });

            // Deseleziona tutti i pulsanti
            document.querySelectorAll('.tab-btn').forEach((b) => {
                b.classList.remove('active');
            });

            // Seleziona il tab corretto in base al data-tab
            let tabId;
            if (tabName === 'dati') tabId = 'datiTab';
            else if (tabName === 'documenti') tabId = 'documenti-tab';
            else if (tabName === 'analisi') tabId = 'analisiTab';
            else if (tabName === 'log') tabId = 'logTab';

            if (tabId) {
                const tabEl = document.getElementById(tabId);
                if (tabEl) {
                    tabEl.classList.add('active');
                    console.log('✅ Tab attivato:', tabId);
                }
            }

            // Attiva il bottone
            btn.classList.add('active');
        });
    });

    // Back button
    const backBtn = document.querySelector('[data-action="back"]');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '/dashboard.html';
        });
    }

    // Logout button
    const logoutBtn = document.querySelector('[data-action="logout"]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof logout === 'function') {
                logout();
            }
        });
    }

    // Edit button
    const editBtn = document.getElementById('btnEditMode');
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
    }

    // Save and Cancel buttons
    document.addEventListener('click', (e) => {
        if (e.target.id === 'btnSave') {
            savePatient();
        } else if (e.target.id === 'btnCancel') {
            toggleEditMode();
        }
    });
}