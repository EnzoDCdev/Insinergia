function debug(msg) {
    const debugEl = document.getElementById('debug');
    if (debugEl) {
        debugEl.innerHTML += `<div>${new Date().toLocaleTimeString()} - ${msg}</div>`;
        debugEl.scrollTop = debugEl.scrollHeight;
    }
    console.log(msg);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position:fixed;top:20px;right:20px;padding:1rem 1.5rem;
        border-radius:12px;color:white;font-weight:500;z-index:10000;
        background:${type === 'success' ? '#10b981' : '#ef4444'};
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

window.addEventListener('load', async () => {
    // 🔐 Auth
    const auth = InsinergiaAuth.ensureAuthenticated();
    if (!auth) return;
    const token = auth.token;
    const user = auth.user;

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // 🌗 Tema
    const currentTheme = InsinergiaTheme.loadInitialTheme();
    InsinergiaTheme.updateToggleLabel(currentTheme);
    document.getElementById('themeToggleBtn').onclick = () => {
        InsinergiaTheme.toggleTheme();
    };

    // 👤 User UI
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
        userInfoEl.textContent = user.nome || user.username;
        userInfoEl.onclick = () => window.location.href = 'profile.html';
    }
    const avatarEl = document.getElementById('userAvatarSmall');
    if (avatarEl) {
        if (user.avatar) {
            avatarEl.src = `http://localhost:3000/${user.avatar}`;
            avatarEl.style.display = 'inline-block';
        } else {
            avatarEl.style.display = 'none';
        }
    }

    // 🔐 Logout
    document.getElementById('logout').onclick = () => {
        localStorage.clear();
        window.location.href = 'index.html';
    };

    // ➕ Nuovo paziente
    document.getElementById('newPatient').onclick = () => {
        window.location.href = 'patient-new.html';
    };

    // Admin panel
    if (user.ruolo === 'admin') {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) adminPanel.style.display = 'block';
        const newDoctorBtn = document.getElementById('newDoctorBtn');
        if (newDoctorBtn) {
            newDoctorBtn.onclick = () => window.location.href = 'admin-register.html';
        }
    }

    async function loadData() {
        try {
            debug('Carico stats...');
            const statsRes = await fetch('http://localhost:3000/api/stats', { headers });
            const stats = await statsRes.json();
            debug('Stats ' + JSON.stringify(stats));

            document.getElementById('total').textContent = stats.total || 0;
            document.getElementById('attivi').textContent = stats.attivi || 0;
            document.getElementById('sospesi').textContent = stats.sospesi || 0;

            debug('Carico pazienti...');
            const patientsRes = await fetch('http://localhost:3000/api/patients', { headers });
            const patientsData = await patientsRes.json();
            debug('Patients response completa ' + JSON.stringify(patientsData));

            safeRenderPatients(patientsData);
            debug('Dashboard caricata completamente');
        } catch (e) {
            debug('ERRORE loadData: ' + e.message);
            showToast('Errore ' + e.message, 'error');
            const tbody = document.getElementById('patientsList');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="5">Errore caricamento</td></tr>';
            }
        }
    }

    function safeRenderPatients(patientsData) {
        debug('Patients data ricevuta ' + JSON.stringify(patientsData));
        const patients = Array.isArray(patientsData)
            ? patientsData
            : Array.isArray(patientsData.patients)
                ? patientsData.patients
                : [];

        debug('Patients array ' + patients.length + ' elementi');

        const tbody = document.getElementById('patientsList');
        if (!tbody) return;

        if (patients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Nessun paziente trovato</td></tr>';
            return;
        }

        tbody.innerHTML = patients.map(p => `
            <tr>
                <td>${p.codice_univoco || 'ND'}</td>
                <td>${p.nome} ${p.cognome}</td>
                <td>${p.stato || 'ND'}</td>
                <td>${p.created_at ? new Date(p.created_at).toLocaleDateString() : 'ND'}</td>
                <td>
                    <button class="btn-primary btn-small"
                        onclick="window.location.href='patient-view.html?id=${p.id}'">
                        Dettaglio
                    </button>
                </td>
            </tr>
        `).join('');
    }

    debug('Dashboard inizializzata');
    loadData();
});