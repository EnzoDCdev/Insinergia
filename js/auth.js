/**
 * AUTH - Gestione login/logout/token
 */

const AUTH_KEY = 'insinergia_auth';
const TOKEN_KEY = 'insinergia_token';
const USER_KEY = 'insinergia_user';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET USER & TOKEN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STORAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const STORAGE = localStorage;

function getFromStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.error('Storage read error:', key, e);
        return null;
    }
}

function setToStorage(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.error('Storage write error:', key, e);
        return false;
    }
}

function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.error('Storage remove error:', key, e);
    }
}

function getToken() {
    const token = getFromStorage(TOKEN_KEY);
    console.log('🔍 getToken DEBUG:', {
        raw: token ? token.substring(0, 20) + '...' : 'NULL',
        hasToken: !!token,
        trimmed: token ? token.trim().substring(0, 20) + '...' : 'NULL',
        length: token ? token.length : 0,
        trimmedLength: token ? token.trim().length : 0
    });
    return token && token.trim() ? token.trim() : null;
}

function getUser() {
    try {
        const userStr = getFromStorage(USER_KEY);
        if (!userStr || userStr === 'null' || userStr === '[object Object]') {
            return null;
        }
        return JSON.parse(userStr);
    } catch (e) {
        console.error('❌ getUser JSON.parse error:', userStr, e);
        removeFromStorage(USER_KEY); // Pulisci dato corrotto
        return null;
    }
}

function isAuthenticated() {
    const token = getToken();
    const user = getUser();
    return !!token && !!user;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGIN - Accetta username O email
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function login(emailOrUsername, password) {
    try {
        // 🔄 Pulisci SEMPRE prima
        removeFromStorage(TOKEN_KEY);
        removeFromStorage(USER_KEY);

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailOrUsername, password })
        });

        const data = await response.json();

        if (!response.ok || !data.token || !data.user) {
            throw new Error(data.message || 'Login failed');
        }

        // 💾 SALVA
        const tokenSaved = setToStorage(TOKEN_KEY, data.token);
        const userSaved = setToStorage(USER_KEY, JSON.stringify(data.user));

        console.log('💾 Login saved:', { tokenSaved, userSaved });
        console.log('🔍 Verify:', { token: getToken() ? 'OK' : 'FAIL', user: getUser() ? 'OK' : 'FAIL' });

        return data.user;
    } catch (err) {
        error('Login error:', err);
        throw err;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGOUT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function logout() {
    log('Logout');
    removeFromStorage(TOKEN_KEY);
    removeFromStorage(USER_KEY);
    removeFromStorage(AUTH_KEY);
    window.location.href = '/index.html';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHECK AUTH & REDIRECT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function requireAuth() {
    if (!isAuthenticated()) {
        log('Not authenticated, redirecting to login');
        //window.location.href = '/index.html';
        return false;
    }
    return true;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REGISTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function register(userData) {
    try {
        log('Register attempt:', userData.email);

        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Registration failed');
        }

        const data = await response.json();
        log('Registration success');
        return data;
    } catch (err) {
        error('Registration error:', err);
        throw err;
    }
}