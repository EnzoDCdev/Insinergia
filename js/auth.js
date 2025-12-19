/**
 * AUTH - Gestione login/logout/token
 */

const AUTH_KEY = 'insinergia_auth';
const TOKEN_KEY = 'insinergia_token';
const USER_KEY = 'insinergia_user';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET USER & TOKEN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getToken() {
    return getFromStorage(TOKEN_KEY);
}

function getUser() {
    return getFromStorage(USER_KEY);
}

function isAuthenticated() {
    return !!getToken() && !!getUser();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGIN - Accetta username O email
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function login(emailOrUsername, password) {
    try {
        log('Login attempt:', emailOrUsername);

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                emailOrUsername, 
                password 
            })
        });

        log('Login response status:', response.status);

        const data = await response.json();
        log('Login response data:', data);

        if (!response.ok) {
            throw new Error(data.message || `Login failed: ${response.status}`);
        }

        if (!data.token || !data.user) {
            throw new Error('Invalid response: missing token or user');
        }
        
        setToStorage(TOKEN_KEY, data.token);
        setToStorage(USER_KEY, data.user);

        log('Login success, token stored:', data.token);
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
        window.location.href = '/index.html';
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