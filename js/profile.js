// avatar predefiniti (metti i tuoi file reali)
const presetAvatars = [
    'public/avatars/default1.png',
    'public/avatars/default2.png',
    'public/avatars/default3.png',
    'public/avatars/default4.png'
];

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
    // 🔐 Auth
    const auth = InsinergiaAuth.ensureAuthenticated();
    if (!auth) return; // redirect già fatto dal guard
    const token = auth.token;
    const storedUser = auth.user;

    const headersJson = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // 🌗 Tema
    const currentTheme = InsinergiaTheme.loadInitialTheme();
    InsinergiaTheme.updateToggleLabel(currentTheme);
    document.getElementById('themeToggleBtn').onclick = () => {
        InsinergiaTheme.toggleTheme();
    };

    // Navigazione
    document.getElementById('backBtn').onclick = () => {
        window.location.href = 'dashboard.html';
    };

    // Galleria avatar predefiniti
    function renderPresetAvatars(currentAvatarPath) {
        const container = document.getElementById('avatarPresets');
        container.innerHTML = '';
        presetAvatars.forEach(path => {
            const img = document.createElement('img');
            img.src = `http://localhost:3000/${path}`;
            if (currentAvatarPath === path) img.classList.add('selected');
            img.addEventListener('click', () => selectPresetAvatar(path, img));
            container.appendChild(img);
        });
    }

    async function selectPresetAvatar(path, imgElement) {
        try {
            const res = await fetch('http://localhost:3000/api/me/avatar', {
                method: 'PUT',
                headers: headersJson,
                body: JSON.stringify({ avatar: path })
            });
            const data = await res.json();
            debug('Preset avatar update: ' + JSON.stringify(data));
            if (!res.ok) throw new Error(data.error || 'Errore aggiornamento avatar');

            document.getElementById('avatarImg').src = `http://localhost:3000/${path}`;
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            u.avatar = path;
            localStorage.setItem('user', JSON.stringify(u));

            document.querySelectorAll('#avatarPresets img').forEach(i => i.classList.remove('selected'));
            imgElement.classList.add('selected');

            showToast('Avatar aggiornato', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    // Load profilo
    (async () => {
        try {
            const res = await fetch('http://localhost:3000/api/me', { headers: headersJson });
            const data = await res.json();
            debug('Profilo: ' + JSON.stringify(data));

            document.getElementById('username').value = data.username || '';
            document.getElementById('ruolo').value = data.ruolo || '';
            document.getElementById('nome').value = data.nome || '';
            document.getElementById('email').value = data.email || '';

            document.getElementById('displayName').textContent = data.nome || data.username;
            document.getElementById('displayRole').textContent = (data.ruolo || '').toUpperCase();

            if (data.avatar) {
                document.getElementById('avatarImg').src = `http://localhost:3000/${data.avatar}`;
                renderPresetAvatars(data.avatar);
            } else {
                renderPresetAvatars(null);
            }
        } catch (e) {
            debug('Errore caricamento profilo: ' + e.message);
            showToast('Errore nel caricamento profilo', 'error');
        }
    })();

    // Salva profilo base
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            nome: document.getElementById('nome').value,
            email: document.getElementById('email').value
        };
        try {
            const res = await fetch('http://localhost:3000/api/me', {
                method: 'PUT',
                headers: headersJson,
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            debug('Update profilo: ' + JSON.stringify(data));
            if (!res.ok) throw new Error(data.error || 'Errore aggiornamento');

            const u = JSON.parse(localStorage.getItem('user') || '{}');
            u.nome = payload.nome;
            u.email = payload.email;
            localStorage.setItem('user', JSON.stringify(u));

            showToast('Profilo aggiornato', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        }
    });

    // Cambio password
    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            currentPassword: document.getElementById('currentPassword').value,
            newPassword: document.getElementById('newPassword').value
        };
        try {
            const res = await fetch('http://localhost:3000/api/me/password', {
                method: 'PUT',
                headers: headersJson,
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            debug('Update password: ' + JSON.stringify(data));
            if (!res.ok) throw new Error(data.error || 'Errore aggiornamento password');

            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            showToast('Password aggiornata', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        }
    });

    // Upload avatar file
    document.getElementById('avatarUploadBtn').addEventListener('click', async () => {
        const fileInput = document.getElementById('avatarFile');
        if (!fileInput.files[0]) {
            return showToast('Seleziona una foto', 'error');
        }
        const formData = new FormData();
        formData.append('avatar', fileInput.files[0]);

        try {
            const res = await fetch('http://localhost:3000/api/me/avatar', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            debug('Avatar upload: ' + JSON.stringify(data));
            if (!res.ok) throw new Error(data.error || 'Errore upload avatar');

            document.getElementById('avatarImg').src = `http://localhost:3000/${data.avatar}`;
            showToast('Foto aggiornata', 'success');

            const u = JSON.parse(localStorage.getItem('user') || '{}');
            u.avatar = data.avatar;
            localStorage.setItem('user', JSON.stringify(u));

            document.querySelectorAll('#avatarPresets img').forEach(i => i.classList.remove('selected'));
        } catch (e) {
            showToast(e.message, 'error');
        }
    });
});