/**
 * API - Fetch calls centralizzate
 */

const API_BASE = '/api';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FETCH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function apiFetch(endpoint, options = {}) {
  try {
    const url = `${API_BASE}${endpoint}`;
    const token = getToken();

    console.log('🔍 apiFetch', endpoint, 'TOKEN:', token ? token.substring(0, 20) + '...' : 'NONE');

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`.trim();
      console.log('🔍 SENDING AUTH:', headers['Authorization'].substring(0, 30) + '...');
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      console.warn('Token expired or invalid, logging out');
      logout();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `API error: ${response.status}`);
    }

    return response.json();
  } catch (err) {
    error('API error:', err);
    throw err;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATIENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function getPatients(filters = {}) {
    const params = new URLSearchParams(filters);
    return apiFetch(`/patients?${params}`);
}

async function getPatient(id) {
    return apiFetch(`/patients/${id}`);
}

async function getDocuments(patientId) {
    return apiFetch(`/patients/${patientId}/documents`);
}

async function getAnalyses(patientId) {
    return apiFetch(`/patients/${patientId}/analyses`);
}

async function getLogs(patientId) {
    return apiFetch(`/patients/${patientId}/logs`);
}

window.getPatient = getPatient;
window.getDocuments = getDocuments;
window.getAnalyses = getAnalyses;
window.getLogs = getLogs;
window.getPatients = getPatients;

async function createPatient(data) {
    return apiFetch('/patients', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function updatePatient(id, data) {
    return apiFetch(`/patients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function deletePatient(id) {
    return apiFetch(`/patients/${id}`, {
        method: 'DELETE'
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOCUMENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function getDocuments(patientId, filters = {}) {
    const params = new URLSearchParams(filters);
    return apiFetch(`/patients/${patientId}/documents?${params}`);
}

async function getDocument(patientId, docId) {
    return apiFetch(`/patients/${patientId}/documents/${docId}`);
}

async function uploadDocument(patientId, formData) {
    const token = getToken();
    const headers = {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`.trim();
    }

    log(`[API] POST /patients/${patientId}/documents/upload`);

    const response = await fetch(`${API_BASE}/patients/${patientId}/documents/upload`, {
        method: 'POST',
        headers,
        body: formData // Non aggiungere Content-Type per FormData
    });

    if (response.status === 401) {
        logout();
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Upload failed: ${response.status}`);
    }

    return response.json();
}

async function deleteDocument(patientId, docId) {
    return apiFetch(`/patients/${patientId}/documents/${docId}`, {
        method: 'DELETE'
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANALYSIS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function getAnalyses(patientId) {
    return apiFetch(`/patients/${patientId}/analyses`);
}

// 🔧 FUNZIONI MANCANTI
async function getAnalysis(id) {
    return apiFetch(`/analyses/${id}`);
}

async function getAnalysisValues(analysisId) {
    return apiFetch(`/analyses/${analysisId}/values`);
}

window.getAnalysis = getAnalysis;
window.getAnalysisValues = getAnalysisValues;

async function createAnalysis(patientId, data) {
    return apiFetch(`/patients/${patientId}/analyses`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function updateAnalysis(patientId, analysisId, data) {
    return apiFetch(`/patients/${patientId}/analyses/${analysisId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function deleteAnalysis(patientId, analysisId) {
    return apiFetch(`/patients/${patientId}/analyses/${analysisId}`, {
        method: 'DELETE'
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DASHBOARD STATS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function getDashboardStats() {
    return apiFetch('/dashboard/stats');
}