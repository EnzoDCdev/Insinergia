const app = {
    token: null,
    user: null,

    async init() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        
        if (this.token && this.user) {
            document.getElementById('userName')?.textContent = this.user.nome || this.user.username;
            // Redirect based on role
            if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
                window.location.href = 'dashboard.html';
            }
        } else if (window.location.pathname.includes('dashboard.html')) {
            window.location.href = 'index.html';
        }
        
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    },

    async login(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            this.token = data.token;
            this.user = data.user;
            
            localStorage.setItem('token', this.token);
            localStorage.setItem('user', JSON.stringify(this.user));
            
            showToast('Login effettuato!', 'success');
            window.location.href = 'dashboard.html';
        } catch (error) {
            showToast(error.message, 'error');
        }
    },

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    },

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }
};

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

// CSS per toast
const toastStyle = `
    .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
    }
    .toast.show { transform: translateX(0); }
    .toast-success { background: #10b981; }
    .toast-error { background: #ef4444; }
    .toast-info { background: #3b82f6; }
`;
if (!document.querySelector('style[data-toast]')) {
    const style = document.createElement('style');
    style.textContent = toastStyle;
    style.setAttribute('data-toast', '');
    document.head.appendChild(style);
}

// Inizializza app
document.addEventListener('DOMContentLoaded', () => app.init());