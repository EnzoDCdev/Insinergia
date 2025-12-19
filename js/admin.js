// DEBUG + TOAST
function debug(msg) {
    const box = document.getElementById('debug');
    if (box) {
        box.innerHTML += `<div>${new Date().toLocaleTimeString()} - ${msg}</div>`;
        box.scrollTop = box.scrollHeight;
    }
    console.log(msg);
}

function showToast(message, type='info') {
    const t = document.createElement('div');
    t.textContent = message;
    t.style.cssText = `
        position:fixed;top:20px;right:20px;padding:.7rem 1.3rem;
        border-radius:999px;color:#fff;font-size:.85rem;z-index:9999;
        background:${type==='success'?'#16a34a':'#dc2626'};
    `;
    document.body.appendChild(t);
    setTimeout(()=>t.remove(),2500);
}

window.addEventListener('load', () => {
    // 🔐 controllo login + ruolo
    const auth = InsinergiaAuth.ensureAuthenticated();
    if (!auth) return;
    const token = auth.token;
    const user = auth.user;

    if (user.ruolo !== 'admin') {
        debug('❌ Utente non admin, redirect dashboard');
        window.location.href = 'dashboard.html';
        return;
    }

    const headersJson = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // Tema
    const currentTheme = InsinergiaTheme.loadInitialTheme();
    InsinergiaTheme.updateToggleLabel(currentTheme);
    document.getElementById('themeToggleBtn').onclick = () => {
        InsinergiaTheme.toggleTheme();
    };

    // Pulsanti base
    document.getElementById('backBtn').onclick = () => {
        window.location.href = 'dashboard.html';
    };

    // Submit form
    document.getElementById('doctorForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim(),
            nome: document.getElementById('nome').value.trim(),
            password: document.getElementById('password').value
        };

        if (!payload.username || !payload.email || !payload.nome || !payload.password) {
            return showToast('Compila tutti i campi obbligatori', 'error');
        }

        try {
            debug('🔄 Creazione medico...');
            const res = await fetch('http://localhost:3000/api/admin/users', {
                method: 'POST',
                headers: headersJson,
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            debug('Risposta: ' + JSON.stringify(data));

            if (!res.ok) throw new Error(data.error || 'Errore creazione medico');

            showToast('Medico creato', 'success');
            document.getElementById('doctorForm').reset();
            setTimeout(() => window.location.href = 'dashboard.html', 1200);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
});