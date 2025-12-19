/**
 * THEME - Dark mode toggle
 */

const THEME_KEY = 'insinergia_theme';
const THEME_CLASS = 'theme-dark';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INIT THEME
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function initTheme() {
    const saved = getFromStorage(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved !== null ? saved : prefersDark;

    if (isDark) {
        enableDarkMode();
    } else {
        disableDarkMode();
    }

    log('Theme initialized:', isDark ? 'dark' : 'light');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOGGLE THEME
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function toggleTheme() {
    if (document.body.classList.contains(THEME_CLASS)) {
        disableDarkMode();
    } else {
        enableDarkMode();
    }
}

function enableDarkMode() {
    document.body.classList.add(THEME_CLASS);
    setToStorage(THEME_KEY, true);
    updateThemeButton();
    log('Dark mode enabled');
}

function disableDarkMode() {
    document.body.classList.remove(THEME_CLASS);
    setToStorage(THEME_KEY, false);
    updateThemeButton();
    log('Light mode enabled');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUTTON STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function updateThemeButton() {
    const btn = document.querySelector('.theme-toggle-btn');
    if (!btn) return;

    const isDark = document.body.classList.contains(THEME_CLASS);
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.title = isDark ? 'Modalità chiara' : 'Modalità scura';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVENT LISTENER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    const btn = document.querySelector('.theme-toggle-btn');
    if (btn) {
        btn.addEventListener('click', toggleTheme);
    }
});