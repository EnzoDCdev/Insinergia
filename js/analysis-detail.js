/**
 * ANALYSIS DETAIL - Pagina dettagli analisi
 */

let currentPatient = null;
let currentAnalysis = null;
let analysisValues = [];
let patientId = null;
let analysisId = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (typeof requireAuth === 'function' && !requireAuth()) return;

    const user = typeof getUser === 'function' ? getUser() : null;
    if (user && typeof updateUserDisplay === 'function') {
      updateUserDisplay(user);
    }

    // Leggi parametri URL
    const params = new URLSearchParams(window.location.search);
    patientId = params.get('patientId');
    analysisId = params.get('analysisId');

    if (!patientId || !analysisId) {
      showErrorSafe('Parametri mancanti');
      setTimeout(() => (window.location.href = '/patient-view.html'), 2000);
      return;
    }

    await loadAnalysisData();
    setupEventListeners();
  } catch (err) {
    console.error('Init error:', err);
    showErrorSafe('Errore nell\'inizializzazione');
  }
});

async function loadAnalysisData() {
  try {
    showNotificationSafe('Caricamento analisi...', 'info');

    // Carica paziente
    const patientRes = await apiGet(`/api/patients/${patientId}`);
    currentPatient = patientRes.data || patientRes;

    // Carica analisi
    const analysisRes = await apiGet(`/api/patients/${patientId}/analyses/${analysisId}`);
    currentAnalysis = analysisRes.data || analysisRes;

    // Carica valori analisi
    const valuesRes = await apiGet(`/api/analyses/${analysisId}/values`);
    analysisValues = Array.isArray(valuesRes.data) ? valuesRes.data : valuesRes || [];

    console.log('📊 Valori caricati:', analysisValues.length);

    renderAnalysisHeader();
    renderAnalysisValues();
    renderAnomalySummary();

    showSuccessSafe('Analisi caricata');
  } catch (err) {
    console.error('Load error:', err);
    showErrorSafe('Errore nel caricamento dell\'analisi');
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
              <td class="test-value">
                <strong>${val.value}</strong>
              </td>
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
  // Back button
  const backBtn = document.querySelector('[data-action="back"]');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.history.back();
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

function showNotificationSafe(msg, type) {
  if (typeof showNotification === 'function') {
    showNotification(msg, type);
  } else {
    console.log(`[${type}] ${msg}`);
  }
}

function showSuccessSafe(msg) {
  if (typeof showSuccess === 'function') {
    showSuccess(msg);
  } else {
    console.log('[success]', msg);
  }
}

function showErrorSafe(msg) {
  if (typeof showError === 'function') {
    showError(msg);
  } else {
    console.error('[error]', msg);
  }
}

async function apiGet(url) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }

  return res.json();
}
