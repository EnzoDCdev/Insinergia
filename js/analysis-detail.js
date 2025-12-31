/**
 * ANALYSIS DETAIL - Pagina dettagli analisi
 */

// 🔧 UTILITIES LOCALI - OBBLIGATORIE
function log(message, data) {
    console.log('[ANALYSIS]', message, data || '');
}

function error(message, data) {
    console.error('[ANALYSIS] ERROR:', message, data || '');
}

function updateUserDisplay(user) {
    try {
        const userElement = document.querySelector('.user-info, .user-display, [data-user]');
        if (userElement && user) {
            userElement.innerHTML = `
                <img src="${user.avatar || '/img/default-avatar.png'}" alt="${user.nome}" class="avatar">
                <span>${user.nome} ${user.cognome} (${user.username})</span>
            `;
        }
    } catch (e) {
        log('User display skip:', e.message);
    }
}

let currentPatient = null;
let currentAnalysis = null;
let analysisValues = [];
let patientId = null;
let analysisId = null;

document.addEventListener('DOMContentLoaded', async () => {
    log('Analysis detail loading...');
    
    // 🔒 AUTH CRITICO - PRIMA DI TUTTO
    if (!requireAuth()) return;

    const user = getUser();
    if (user) {
        updateUserDisplay(user);
    }

    // Leggi parametri URL
    const params = new URLSearchParams(window.location.search);
    patientId = params.get('patientId');
    analysisId = params.get('analysisId');

    if (!patientId || !analysisId) {
        showError('Parametri mancanti');
        setTimeout(() => window.location.href = '/patient-view.html', 2000);
        return;
    }

    log('Loading analysis:', analysisId, 'for patient:', patientId);
    await loadAnalysisData();
    setupEventListeners();
});

async function loadAnalysisData() {
    try {
        log('🔍 Loading analysis data...');

        // ✅ USA FUNZIONI GLOBALI api.js
        const patient = await getPatient(patientId);
        currentPatient = patient;

        // FIX: endpoint corretto
        const analysis = await getAnalysis(analysisId);
        currentAnalysis = analysis;

        // Valori opzionali - gestisci 404
        let values = [];
        try {
            values = await getAnalysisValues(analysisId);
            analysisValues = Array.isArray(values.data) ? values.data : values || [];
        } catch (err) {
            if (err.message.includes('404')) {
                log('No analysis values yet');
            } else {
                throw err;
            }
        }

        log('📊 Analysis loaded:', {
            patient: patient.nome + ' ' + patient.cognome,
            analysis: analysis.tipo,
            valuesCount: analysisValues.length
        });

        renderAnalysisHeader();
        renderAnalysisValues();
        renderAnomalySummary();

        showSuccess('Analisi caricata');
    } catch (err) {
        error('Load error:', err);
        showError('Errore caricamento: ' + err.message);
    }
}

function renderAnalysisHeader() {
    if (!currentPatient || !currentAnalysis) return;

    const header = document.getElementById('analysisHeader');
    if (!header) return;

    header.innerHTML = `
        <div>
            <h2>${currentPatient.cognome} ${currentPatient.nome}</h2>
            <div class="analysis-info">
                <div class="info-item">
                    <span class="info-label">Tipo Analisi</span>
                    <span class="info-value">${currentAnalysis.tipo || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Data</span>
                    <span class="info-value">${formatDate(currentAnalysis.created_at)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Sesso</span>
                    <span class="info-value">${currentPatient.sesso === 'M' ? '♂ Maschio' : '♀ Femmina'}</span>
                </div>
            </div>
        </div>
    `;
}

function renderAnalysisValues() {
    const container = document.getElementById('analysisValues');
    if (!container) return;

    if (analysisValues.length === 0) {
        container.innerHTML = '<p class="info-value">Nessun valore trovato</p>';
        return;
    }

    const html = `
        <table class="analysis-table">
            <thead>
                <tr>
                    <th>Esame</th>
                    <th>Valore</th>
                    <th>Unità</th>
                    <th>Intervallo Riferimento</th>
                    <th>Stato</th>
                </tr>
            </thead>
            <tbody>
                ${analysisValues.map(val => {
                    const isAbnormal = val.is_abnormal;
                    const statusClass = isAbnormal ? 'abnormal' : 'normal';
                    const statusText = isAbnormal ? '⚠️ ANOMALO' : '✅ Normale';
                    
                    let rangeText = '-';
                    if (val.reference_min !== null && val.reference_max !== null) {
                        rangeText = `${val.reference_min} - ${val.reference_max}`;
                    }

                    return `
                        <tr class="analysis-row ${statusClass}">
                            <td class="test-name">${val.test_name}</td>
                            <td class="test-value"><strong>${val.value}</strong></td>
                            <td>${val.unit || '-'}</td>
                            <td class="test-range">${rangeText}</td>
                            <td class="test-status">
                                <span class="status-badge ${statusClass}">${statusText}</span>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

function renderAnomalySummary() {
    const abnormals = analysisValues.filter(v => v.is_abnormal);
    const summary = document.getElementById('anomalySummary');
    const content = document.getElementById('anomalySummaryContent');

    if (abnormals.length === 0) {
        if (summary) summary.style.display = 'none';
        return;
    }

    if (summary) summary.style.display = 'block';

    let html = '<div class="anomaly-list">';

    const highValues = abnormals.filter(v => v.flag === 'H');
    const lowValues = abnormals.filter(v => v.flag === 'L');

    if (highValues.length > 0) {
        html += `
            <div class="anomaly-group">
                <h4>🔴 Valori Alti</h4>
                <ul>
                    ${highValues.map(v => `
                        <li>
                            <strong>${v.test_name}</strong>: ${v.value} ${v.unit}
                            <span class="range-info">(Range: ${v.reference_min} - ${v.reference_max})</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    if (lowValues.length > 0) {
        html += `
            <div class="anomaly-group">
                <h4>🔵 Valori Bassi</h4>
                <ul>
                    ${lowValues.map(v => `
                        <li>
                            <strong>${v.test_name}</strong>: ${v.value} ${v.unit}
                            <span class="range-info">(Range: ${v.reference_min} - ${v.reference_max})</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    html += '</div>';
    content.innerHTML = html;
}

function setupEventListeners() {
    const backBtn = document.querySelector('[data-action="back"]');
    if (backBtn) {
        backBtn.addEventListener('click', () => window.history.back());
    }

    const logoutBtn = document.querySelector('[data-action="logout"]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

function formatDate(value) {
    if (!value) return '-';
    try {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('it-IT');
    } catch {
        return '-';
    }
}

function showNotification(msg, type) {
    console.log(`[${type?.toUpperCase() || 'info'}] ${msg}`);
}

function showSuccess(msg) {
    console.log('[SUCCESS]', msg);
}

function showError(msg) {
    console.error('[ERROR]', msg);
}