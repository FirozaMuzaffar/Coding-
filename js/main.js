import * as storage from './storage.js';
import { initLibrary } from './library.js';
import { initAuthor } from './author.js';
import { initLearn } from './learn.js';

const THEME_KEY = 'pc_theme';
const navLinks = {
    library: document.getElementById('nav-library'),
    author: document.getElementById('nav-author'),
    learn: document.getElementById('nav-learn'),
};
const a11yLive = document.getElementById('a11y-live');
const appAlerts = document.getElementById('app-alerts');
let currentViewCleanup = () => {};

// --- Exportable Utilities ---
export function generateId() { return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`; }
export function escapeHTML(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
// Query helpers
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// small alias for escape when importing elsewhere
export const $escape = escapeHTML;
export function debounce(func, delay) {
    let timeout;
    return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); };
}

// show a dismissible Bootstrap alert in the top-right corner. type: 'success'|'danger'|'info'|... timeout ms
export function showAlert(message, type = 'info', timeout = 4000) {
    try {
        if (!appAlerts) return;
        const wrapper = document.createElement('div');
        wrapper.style.pointerEvents = 'auto';
        wrapper.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">${escapeHTML(message)}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
        appAlerts.appendChild(wrapper);
        setTimeout(() => { try { wrapper.remove(); } catch (e) {} }, timeout);
    } catch (e) { console.warn('showAlert failed', e); }
}

// human-friendly relative time -small utility
export function timeAgo(iso) {
    if (!iso) return 'Unknown';
    const then = new Date(iso).getTime();
    if (isNaN(then)) return 'Unknown';
    const diff = Date.now() - then;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
}

// --- Theme Management ---
function applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    const icon = document.querySelector('#btn-theme-toggle i');
    icon.className = theme === 'dark' ? 'bi bi-moon-stars-fill' : 'bi bi-sun-fill';
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.setAttribute('aria-pressed', theme === 'dark');
    announce(`Theme changed to ${theme}`);
}
function toggleTheme() {
    const newTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, newTheme);
    applyTheme(newTheme);
}

// --- Navigation & Routing ---
function updateNav(activeView) {
    Object.entries(navLinks).forEach(([key, link]) => {
        link.classList.remove('active');
        link.setAttribute('aria-current', 'false');
        if (key === activeView) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        }
    });
    navLinks.learn.classList.toggle('disabled', activeView !== 'learn');
    announce(`${activeView} view`);
}
function navigate(view, capsuleId = null) {
    currentViewCleanup(); currentViewCleanup = () => {};
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    updateNav(view);

    switch (view) {
        case 'library': initLibrary(navigate, handleExport, handleDelete); break;
        case 'author': initAuthor(navigate, capsuleId); break;
        case 'learn': currentViewCleanup = initLearn(navigate, capsuleId); break;
    }
}

// --- Global Action Handlers ---
function handleDelete(id) {
    const capsuleMeta = storage.loadIndex().find(c => c.id === id);
    if (confirm(`Are you sure you want to delete "${capsuleMeta.title}"?`)) {
        storage.deleteCap(id);
        let index = storage.loadIndex().filter(item => item.id !== id);
        storage.saveIndex(index);
        showAlert(`Deleted "${capsuleMeta.title}"`, 'info');
        announce(`Deleted ${capsuleMeta.title}`);
        navigate('library');
    }
}
function handleExport(id) {
    const capsule = storage.loadCap(id);
    if (!capsule) return;
    const jsonString = JSON.stringify(capsule, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${capsule.meta.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert(`Exported "${capsule.meta.title}"`, 'success');
    announce(`Exported ${capsule.meta.title}`);
}
function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedCapsule = JSON.parse(event.target.result);
            if (importedCapsule.schema !== 'pocket-classroom/v1' || !(importedCapsule.meta?.title || importedCapsule.title)) throw new Error("Invalid file format.");
            const newId = `cap_${generateId()}`;
            importedCapsule.id = newId;
            importedCapsule.meta = importedCapsule.meta || {};
            importedCapsule.meta.title = importedCapsule.meta.title || importedCapsule.title || 'Untitled';
            importedCapsule.meta.updatedAt = new Date().toISOString();
            storage.saveCap(importedCapsule);
            const index = storage.loadIndex();
            index.push({ id: importedCapsule.id, title: importedCapsule.meta.title, subject: importedCapsule.meta.subject, level: importedCapsule.meta.level, updatedAt: importedCapsule.meta.updatedAt });
            storage.saveIndex(index);
            showAlert(`Imported "${importedCapsule.meta.title}"`, 'success');
            announce(`Successfully imported ${importedCapsule.meta.title}`);
            navigate('library');
    } catch (err) { try { showAlert(`Import failed: ${err.message}`, 'danger'); announce(`Import failed: ${err.message}`); } catch(e) { alert(`Import failed: ${err.message}`); } } finally { e.target.value = null; }
    };
    reader.readAsText(file);
}

export function announce(message) {
    try {
        if (!a11yLive) return;
        a11yLive.textContent = '';
        // slight delay to ensure screen readers detect change
        setTimeout(() => a11yLive.textContent = message, 50);
    } catch (e) {
        // ignore announcement failures
        console.warn('Announce failed', e);
    }
}

// --- App Initialization ---
function init() {
    const navTo = (e, view) => { e.preventDefault(); navigate(view); };
    document.getElementById('nav-brand').addEventListener('click', e => navTo(e, 'library'));
    // make nav items keyboard-activatable and update aria-current when navigated
    Object.entries(navLinks).forEach(([key, el]) => {
        el.addEventListener('click', e => navTo(e, key));
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navTo(e, key); }
        });
    });
    document.getElementById('import-capsule-input').addEventListener('change', handleImport);
    document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);
    applyTheme(localStorage.getItem(THEME_KEY) || 'light');
    navigate('library');
}
init();