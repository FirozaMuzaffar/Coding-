import * as storage from './storage.js';
import { escapeHTML, timeAgo } from './main.js';

const grid = document.getElementById('capsule-grid');
const emptyState = document.getElementById('library-empty-state');

function createCapsuleCardHTML(meta, progress) {
    const score = (typeof progress.bestScore === 'number' && progress.bestScore > -1) ? progress.bestScore : null;
    const knownCards = Array.isArray(progress.knownFlashcards) ? progress.knownFlashcards.length : 0;
    const updatedHuman = timeAgo(meta.updatedAt);
    return `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card h-100">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h5 class="card-title mb-1">${escapeHTML(meta.title)}</h5>
                            <div class="mb-2">
                            <small class="text-muted ">${escapeHTML(meta.subject) || 'No Subject'}</small>
                            <span class="badge bg-secondary me-1">${escapeHTML(meta.level) || 'No Level'}</span>
                            </div>
                        </div>
                        <small class="text-muted">${escapeHTML(updatedHuman)}</small>
                    </div>
                    <div class="mt-3">
                        <div class="row gx-2">
                            <div class="col-12 mb-2">
                                <div class="small text-muted">Best Quiz Score</div>
                                <div class="progress position-relative" style="height:18px">
                                    <div class="progress-bar bg-success" role="progressbar" style="width: ${score !== null ? score : 0}%" aria-valuenow="${score !== null ? score : 0}" aria-valuemin="0" aria-valuemax="100"></div>
                                    <span class="position-absolute top-50 start-50 translate-middle middle fw-bold" style="color: black;">
                                        ${score !== null ? score + '%' : 'N/A'}
                                    </span>
                                </div>
                            </div>
                            <div class="col-12">
                                <div class="small text-muted">Known Cards</div>
                                <div><strong>${knownCards}</strong>${meta.flashcardCount ? ' / ' + meta.flashcardCount : ''}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-footer bg-transparent border-top-0 d-flex justify-content-between">
                    <button class="btn btn-sm btn-primary btn-learn" data-id="${meta.id}" aria-label="Learn ${escapeHTML(meta.title)}">Learn</button>
                    <div>
                        <button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${meta.id}" title="Edit" aria-label="Edit ${escapeHTML(meta.title)}"><i class="bi bi-pencil" aria-hidden="true"></i></button>
                        <button class="btn btn-sm btn-outline-secondary btn-export" data-id="${meta.id}" title="Export" aria-label="Export ${escapeHTML(meta.title)}"><i class="bi bi-box-arrow-down" aria-hidden="true"></i></button>
                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${meta.id}" title="Delete" aria-label="Delete ${escapeHTML(meta.title)}"><i class="bi bi-trash" aria-hidden="true"></i></button>
                    </div>
                </div>
            </div>
        </div>`;
};

function renderLibrary() {
    const index = storage.loadIndex();
    grid.innerHTML = '';

    if (index.length === 0) {
        emptyState.classList.remove('d-none');
        grid.classList.add('d-none');
    } else {
        emptyState.classList.add('d-none');
        grid.classList.remove('d-none');
        index.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        index.forEach(meta => {
            const progress = storage.loadProg(meta.id);
            // try to load capsule to know total flashcard count for progress calculation
            const capsule = storage.loadCap(meta.id);
            const enhancedMeta = { ...meta, flashcardCount: capsule?.flashcards?.length || 0 };
            grid.innerHTML += createCapsuleCardHTML(enhancedMeta, progress);
        });
    }
}

/**
 * Initializes the Library view, renders capsules, and sets up event listeners.
 * @param {Function} navigate - The main navigation function from main.js.
 * @param {Function} handleExport - The export handler from main.js.
 * @param {Function} handleDelete - The delete handler from main.js.
 */
export function initLibrary(navigate, handleExport, handleDelete) {
    renderLibrary();

    // top-level new capsule buttons
    const newBtn = document.getElementById('btn-new-capsule');
    const newBtnEmpty = document.getElementById('btn-new-capsule-empty');
    if (newBtn) newBtn.addEventListener('click', () => navigate('author'));
    if (newBtnEmpty) newBtnEmpty.addEventListener('click', () => navigate('author'));

    grid.onclick = (e) => { // Using onclick for simplicity in reassignment
        const target = e.target.closest('button');
        if (!target) return;
        const id = target.dataset.id;
        if (target.classList.contains('btn-learn')) navigate('learn', id);
        if (target.classList.contains('btn-edit')) navigate('author', id);
        if (target.classList.contains('btn-delete')) handleDelete(id);
        if (target.classList.contains('btn-export')) handleExport(id);
    };
}