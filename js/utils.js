/**
 * UTILS - Funzioni comuni e helpers
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGGING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DEBUG = true;

function log(...args) {
    if (DEBUG) console.log('[LOG]', ...args);
}

function error(...args) {
    console.error('[ERROR]', ...args);
}

function warn(...args) {
    console.warn('[WARN]', ...args);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FORMAT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT');
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('it-IT');
}

function formatTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('it-IT');
}

function formatCurrency(value) {
    if (!value && value !== 0) return '-';
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
    }).format(value);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function isValidPhone(phone) {
    const re = /^[\d\s\+\-\(\)]{10,}$/;
    return re.test(phone);
}

function isEmpty(value) {
    return value === null || value === undefined || value === '';
}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOM UTILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function showElement(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

function hideElement(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function toggleClass(id, className) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle(className);
}

function setClass(id, className, condition) {
    const el = document.getElementById(id);
    if (!el) return;
    if (condition) {
        el.classList.add(className);
    } else {
        el.classList.remove(className);
    }
}

function clearElement(id) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function showNotification(message, type = 'info', duration = 3000) {
    log(`[${type.toUpperCase()}] ${message}`);
    
    const el = document.getElementById('notification');
    if (!el) return;

    el.textContent = message;
    el.className = `notification notification--${type}`;
    showElement('notification');

    setTimeout(() => {
        hideElement('notification');
    }, duration);
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showWarning(message) {
    showNotification(message, 'warning');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEBOUNCE / THROTTLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUERY PARAMS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getQueryParam(param) {
    const params = new URLSearchParams(window.location.search);
    return params.get(param);
}

function getAllQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(params);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ARRAY UTILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function groupBy(array, key) {
    return array.reduce((acc, item) => {
        const group = item[key];
        if (!acc[group]) acc[group] = [];
        acc[group].push(item);
        return acc;
    }, {});
}

function sortBy(array, key, order = 'asc') {
    return [...array].sort((a, b) => {
        if (a[key] < b[key]) return order === 'asc' ? -1 : 1;
        if (a[key] > b[key]) return order === 'asc' ? 1 : -1;
        return 0;
    });
}

function filterBy(array, key, value) {
    return array.filter(item => item[key] === value);
}

function findById(array, id) {
    return array.find(item => item.id === id);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}
