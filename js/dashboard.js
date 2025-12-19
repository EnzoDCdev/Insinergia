/**
 * DASHBOARD - Logica dashboard con search, filtri e paginazione
 */

let allPatients = [];
let filteredPatients = [];
let currentPage = 1;
let itemsPerPage = 10;
let currentSort = { field: 'created_at', order: 'desc' };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INIT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
document.addEventListener('DOMContentLoaded', async () => {
    log('Dashboard loading...');

    if (!requireAuth()) return;

    const user = getUser();
    if (user) {
        updateUserDisplay(user);
    }

    await loadDashboardData();
    setupEventListeners();

    log('Dashboard ready');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOAD DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function loadDashboardData() {
    try {
        showNotification('Caricamento pazienti...', 'info');

        // Carica TUTTI i pazienti (senza limit)
        const response = await getPatients({ limit: 999999 });
        allPatients = response.data || response || [];

        log('Pazienti caricati:', allPatients.length);

        // Ordina per data creazione (decrescente)
        allPatients = sortBy(allPatients, 'created_at', 'desc');

        // Filtra e renderizza
        filteredPatients = [...allPatients];
        currentPage = 1;
        renderPatients();

        // Carica stats
        const stats = await getDashboardStats();
        updateStats(stats);

        showSuccess(`${allPatients.length} pazienti caricati`);
    } catch (err) {
        error('Load error:', err);
        showError('Errore nel caricamento dei dati');
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
// UPDATE STATS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function updateStats(stats) {
    if (!stats) return;

    const statsGrid = document.getElementById('statsGrid');
    if (!statsGrid) return;

    statsGrid.innerHTML = `
        <div class="stat-card">
            <h3>${allPatients.length}</h3>
            <p>Pazienti Totali</p>
        </div>
        <div class="stat-card">
            <h3>${stats.todayAppointments || 0}</h3>
            <p>Appuntamenti Oggi</p>
        </div>
        <div class="stat-card">
            <h3>${stats.pendingAnalyses || 0}</h3>
            <p>Analisi in Sospeso</p>
        </div>
        <div class="stat-card">
            <h3>${stats.abnormalResults || 0}</h3>
            <p>Risultati Anomali</p>
        </div>
    `;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RENDER PATIENTS TABLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderPatients() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    // Calcola paginazione
    const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedPatients = filteredPatients.slice(startIdx, endIdx);

    if (paginatedPatients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">Nessun paziente trovato</td></tr>';
        updatePaginationInfo(0, 0);
        return;
    }

    tbody.innerHTML = paginatedPatients.map(patient => {
        const age = patient.data_nascita ? 
            Math.floor((new Date() - new Date(patient.data_nascita)) / (365.25 * 24 * 60 * 60 * 1000)) : 
            '-';

        return `
            <tr data-id="${patient.id}" style="cursor: pointer;">
                <td><strong>${patient.cognome}</strong></td>
                <td>${patient.nome}</td>
                <td>${formatDate(patient.data_nascita)}</td>
                <td>${patient.email || '-'}</td>
                <td>${patient.telefono || '-'}</td>
                <td>${formatDate(patient.created_at)}</td>
                <td>
                    <a href="patient-view.html?id=${patient.id}" class="btn btn-primary btn-sm" onclick="event.stopPropagation();">
                        Dettagli
                    </a>
                </td>
            </tr>
        `;
    }).join('');

    // Row click listener
    tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', () => {
            const patientId = row.dataset.id;
            window.location.href = `patient-view.html?id=${patientId}`;
        });
    });

    // Update pagination UI
    updatePaginationUI(totalPages);
    updatePaginationInfo(filteredPatients.length, totalPages);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAGINATION INFO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function updatePaginationInfo(total, totalPages) {
    const recordsInfo = document.getElementById('recordsInfo');
    if (!recordsInfo) return;

    if (total === 0) {
        recordsInfo.textContent = 'Nessun record';
    } else {
        const startRecord = (currentPage - 1) * itemsPerPage + 1;
        const endRecord = Math.min(currentPage * itemsPerPage, total);
        recordsInfo.textContent = `Record ${startRecord}-${endRecord} di ${total}`;
    }
}

function updatePaginationUI(totalPages) {
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Pagina ${currentPage} di ${totalPages}`;
    }

    // Abilita/disabilita pulsanti
    const btnFirstPage = document.getElementById('btnFirstPage');
    const btnPrevPage = document.getElementById('btnPrevPage');
    const btnNextPage = document.getElementById('btnNextPage');
    const btnLastPage = document.getElementById('btnLastPage');

    if (btnFirstPage) btnFirstPage.disabled = currentPage === 1;
    if (btnPrevPage) btnPrevPage.disabled = currentPage === 1;
    if (btnNextPage) btnNextPage.disabled = currentPage === totalPages;
    if (btnLastPage) btnLastPage.disabled = currentPage === totalPages;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILTRAGGIO AVANZATO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function applyFilters() {
    const cognome = document.getElementById('filterCognome').value.toLowerCase();
    const nome = document.getElementById('filterNome').value.toLowerCase();
    const email = document.getElementById('filterEmail').value.toLowerCase();
    const telefono = document.getElementById('filterTelefono').value.toLowerCase();
    const codice = document.getElementById('filterCodice').value.toLowerCase();

    filteredPatients = allPatients.filter(patient => {
        return (
            (!cognome || (patient.cognome && patient.cognome.toLowerCase().includes(cognome))) &&
            (!nome || (patient.nome && patient.nome.toLowerCase().includes(nome))) &&
            (!email || (patient.email && patient.email.toLowerCase().includes(email))) &&
            (!telefono || (patient.telefono && patient.telefono.includes(telefono))) &&
            (!codice || (patient.codice_univoco && patient.codice_univoco.toLowerCase().includes(codice)))
        );
    });

    currentPage = 1;
    renderPatients();
    showSuccess(`${filteredPatients.length} paziente/i trovati`);
}

function resetFilters() {
    document.getElementById('filterCognome').value = '';
    document.getElementById('filterNome').value = '';
    document.getElementById('filterEmail').value = '';
    document.getElementById('filterTelefono').value = '';
    document.getElementById('filterCodice').value = '';

    filteredPatients = [...allPatients];
    currentPage = 1;
    renderPatients();
    showSuccess('Filtri azzurati');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SORTING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function handleSort(field) {
    if (currentSort.field === field) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.order = 'asc';
    }

    filteredPatients = sortBy(filteredPatients, field, currentSort.order);
    currentPage = 1;
    renderPatients();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAGINAZIONE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function goToPage(page) {
    const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderPatients();
    }
}

function goFirstPage() {
    goToPage(1);
}

function goPrevPage() {
    goToPage(currentPage - 1);
}

function goNextPage() {
    goToPage(currentPage + 1);
}

function goLastPage() {
    const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
    goToPage(totalPages);
}

function changeItemsPerPage(newLimit) {
    itemsPerPage = parseInt(newLimit);
    currentPage = 1;
    renderPatients();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETUP LISTENERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function setupEventListeners() {
    // Filtri - CON VERIFICA
    const btnApplyFilter = document.getElementById('btnApplyFilter');
    if (btnApplyFilter) {
        btnApplyFilter.addEventListener('click', applyFilters);
    }

    const btnReset = document.getElementById('btnReset');
    if (btnReset) {
        btnReset.addEventListener('click', resetFilters);
    }

    // Paginazione - CON VERIFICA
    const btnFirstPage = document.getElementById('btnFirstPage');
    if (btnFirstPage) {
        btnFirstPage.addEventListener('click', goFirstPage);
    }

    const btnPrevPage = document.getElementById('btnPrevPage');
    if (btnPrevPage) {
        btnPrevPage.addEventListener('click', goPrevPage);
    }

    const btnNextPage = document.getElementById('btnNextPage');
    if (btnNextPage) {
        btnNextPage.addEventListener('click', goNextPage);
    }

    const btnLastPage = document.getElementById('btnLastPage');
    if (btnLastPage) {
        btnLastPage.addEventListener('click', goLastPage);
    }

    // Limit selector - CON VERIFICA
    const limitSelector = document.getElementById('limitSelector');
    if (limitSelector) {
        limitSelector.addEventListener('change', (e) => {
            changeItemsPerPage(e.target.value);
        });
    }

    // Sort headers
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.field;
            handleSort(field);
        });
    });

    // Logout - CON VERIFICA
    const logoutBtn = document.querySelector('[data-action="logout"]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // Theme toggle - CON VERIFICA
    const themeBtn = document.querySelector('.theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // Enter su input per applicare filtri
    ['filterCognome', 'filterNome', 'filterEmail', 'filterTelefono', 'filterCodice'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
        }
    });
}