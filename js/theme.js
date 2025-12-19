(function() {
    const THEME_KEY = 'insinergia-theme';

    function applyTheme(theme) {
        const body = document.body;
        body.classList.remove('theme-light', 'theme-dark');
        body.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    }

    function loadInitialTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        const prefersDark = window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'light');
        applyTheme(theme);
        return theme;
    }

    function toggleTheme() {
        const current = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
        updateToggleLabel(next);
    }

    function updateToggleLabel(theme) {
        // icona: luna per light mode (invito a passare a scuro), sole per dark
        const iconEl = document.getElementById('themeToggleIcon');
        if (iconEl) {
            iconEl.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }
    // expose
    window.InsinergiaTheme = { toggleTheme, loadInitialTheme, updateToggleLabel };
})();
