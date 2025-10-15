import * as storage from './storage.js';
import { escapeHTML, debounce } from './main.js';

let state = {};
let capsule = null;

// announce helper (aria-live)
const a11yLive = document.getElementById('a11y-live');
function announce(message) {
    try { if (!a11yLive) return; a11yLive.textContent = ''; setTimeout(() => a11yLive.textContent = message, 50); } catch (e) { console.warn('announce failed', e); }
}

const TABS = ['tab-notes', 'tab-flashcards', 'tab-quiz'];

function isTextInputFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

function cycleTabs(dir) {
    const tabs = TABS.map(id => document.getElementById(id)).filter(Boolean);
    if (!tabs.length) return;
    let currentIndex = tabs.findIndex(t => t.classList.contains('active'));
    if (currentIndex === -1) currentIndex = 0;
    const next = tabs[(currentIndex + dir + tabs.length) % tabs.length];
    if (next) new bootstrap.Tab(next).show();
}

const handleKeyPress = (e) => {
    // don't intercept when user is typing in a form control
    if (isTextInputFocused()) return;

    // Space: flip flashcard only when flashcards tab is active
    if (e.key === ' ') {
        const flashTab = document.getElementById('tab-flashcards');
        if (flashTab && flashTab.classList.contains('active')) { e.preventDefault(); flipFlashcard(); }
        return;
    }
    // [ and ] cycle Notes <-> Flashcards <-> Quiz
    if (e.key === '[') { e.preventDefault(); cycleTabs(-1); return; }
    if (e.key === ']') { e.preventDefault(); cycleTabs(1); return; }
};

function initNotes() {
    const notesExist = capsule.notes && (Array.isArray(capsule.notes) ? capsule.notes.length > 0 : String(capsule.notes).trim().length > 0);
    document.getElementById('tab-notes').style.display = notesExist ? 'block' : 'none';
    const renderArea = document.getElementById('notes-render-area');
    const notesText = Array.isArray(capsule.notes) ? capsule.notes.join('\n') : (capsule.notes || '');
    renderArea.innerHTML = escapeHTML(notesText).replace(/\n/g, '<br>');
    document.getElementById('notes-search-input').oninput = debounce((e) => {
        const term = e.target.value.toLowerCase();
        if (!term) return renderArea.innerHTML = escapeHTML(notesText).replace(/\n/g, '<br>');
        renderArea.innerHTML = escapeHTML(notesText).replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`).replace(/\n/g, '<br>');
    }, 250);
}
function updateFlashcardView() {
    const card = capsule.flashcards[state.flashcardIndex];
    document.querySelector('.flashcard-front').textContent = card.front;
    document.querySelector('.flashcard-back').textContent = card.back;
    document.getElementById('flashcard').classList.remove('is-flipped');
    document.getElementById('flashcard-counter').textContent = `${state.flashcardIndex + 1} / ${capsule.flashcards.length}`;
    document.getElementById('flashcard-progress').textContent = `Known: ${state.knownFlashcards.size} of ${capsule.flashcards.length}`;
}
function flipFlashcard() { document.getElementById('flashcard').classList.toggle('is-flipped'); }
function moveFlashcard(dir) {
    const len = capsule.flashcards.length;
    state.flashcardIndex = (state.flashcardIndex + dir + len) % len;
    updateFlashcardView();
}
function markFlashcardAsKnown() {
    state.knownFlashcards.add(state.flashcardIndex);
    const capId = capsule.id || capsule.meta?.id;
    const progress = storage.loadProg(capId);
    progress.knownFlashcards = Array.from(state.knownFlashcards);
    storage.saveProg(capId, progress);
    updateFlashcardView();
    moveFlashcard(1);
    announce('Marked card as known.');
    try { import('./main.js').then(m => { if (m.showAlert) m.showAlert('Marked card as known', 'success'); if (m.announce) m.announce('Marked card as known'); }); } catch(e) {}
}
function markFlashcardAsUnknown() {
    // remove current index from known set
    if (state.knownFlashcards.has(state.flashcardIndex)) {
        state.knownFlashcards.delete(state.flashcardIndex);
        const capId = capsule.id || capsule.meta?.id;
        const progress = storage.loadProg(capId);
        progress.knownFlashcards = Array.from(state.knownFlashcards);
        storage.saveProg(capId, progress);
        updateFlashcardView();
        announce('Marked card as unknown.');
        try { import('./main.js').then(m => { if (m.showAlert) m.showAlert('Marked card as unknown', 'info'); if (m.announce) m.announce('Marked card as unknown'); }); } catch(e) {}
    }
}
function initFlashcards() {
    const hasCards = capsule.flashcards && capsule.flashcards.length > 0;
    document.getElementById('tab-flashcards').style.display = hasCards ? 'block' : 'none';
    document.getElementById('flashcard-ui-wrapper').classList.toggle('d-none', !hasCards);
    document.getElementById('flashcards-empty-state').classList.toggle('d-none', hasCards);
    if (hasCards) {
        const capId = capsule.id || capsule.meta?.id;
        const progress = storage.loadProg(capId);
        state.knownFlashcards = new Set(progress.knownFlashcards);
        state.flashcardIndex = 0;
        updateFlashcardView();
    }
}
function renderQuizQuestion() {
    const q = capsule.quiz[state.quizQuestionIndex];
    // support both old and new schema field names
    const questionText = q.question || q.q || '';
    const choices = q.options || q.choices || [];
    const answerIndex = (q.answerIndex !== undefined) ? q.answerIndex : q['answer Index'];
    document.getElementById('quiz-question-text').textContent = questionText;
    document.getElementById('quiz-progress').textContent = `${state.quizQuestionIndex + 1} / ${capsule.quiz.length}`;
    const optsContainer = document.getElementById('quiz-options-container');
    optsContainer.innerHTML = choices.map((opt, i) => `<a href="#" class="list-group-item list-group-item-action" data-index="${i}">${escapeHTML(opt)}</a>`).join('');
    document.getElementById('quiz-feedback').classList.add('d-none');
    document.getElementById('quiz-next-btn').classList.add('d-none');
}
function handleQuizAnswer(selectedIndex) {
    const q = capsule.quiz[state.quizQuestionIndex];
    const answerIndex = (q.answerIndex !== undefined) ? q.answerIndex : q['answer Index'];
    const isCorrect = selectedIndex === answerIndex;
    const feedbackEl = document.getElementById('quiz-feedback');
    feedbackEl.className = `alert ${isCorrect ? 'alert-success' : 'alert-danger'}`;
    const choices = q.options || q.choices || [];
    feedbackEl.textContent = isCorrect ? 'Correct!' : `Incorrect. The answer was: ${choices[answerIndex]}`;
    // show explanation if present
    const explainText = q.explanation || q.explain || '';
    if (explainText) {
        feedbackEl.innerHTML += `<div class="mt-2"><small>${escapeHTML(explainText)}</small></div>`;
    }
    if (isCorrect) state.quizCorrectAnswers++;
    document.querySelectorAll('#quiz-options-container .list-group-item').forEach(item => {
        item.classList.add('disabled');
        if (parseInt(item.dataset.index) === answerIndex) item.classList.add('list-group-item-success');
    });
    document.getElementById('quiz-next-btn').textContent = state.quizQuestionIndex === capsule.quiz.length - 1 ? 'Finish' : 'Next';
    document.getElementById('quiz-next-btn').classList.remove('d-none');
}
function finishQuiz() {
    document.getElementById('quiz-ui-wrapper').classList.add('d-none');
    document.getElementById('quiz-results-wrapper').classList.remove('d-none');
    const score = Math.round((state.quizCorrectAnswers / capsule.quiz.length) * 100);
    const capId = capsule.id || capsule.meta?.id;
    const progress = storage.loadProg(capId);
    const bestScore = Math.max(score, progress.bestScore);
    document.getElementById('quiz-final-score').textContent = `${score}%`;
    document.getElementById('quiz-best-score').textContent = `${bestScore}%`;
    progress.bestScore = bestScore;
    storage.saveProg(capId, progress);
    // announce and show alert for quiz completion
    const msg = `Quiz finished: ${score}%`;
    announce(msg);
    try { import('./main.js').then(m => { if (m.showAlert) m.showAlert(msg, 'success'); if (m.announce) m.announce(msg); }); } catch(e) {}
}
function initQuiz() {
    const hasQuiz = capsule.quiz && capsule.quiz.length > 0;
    document.getElementById('tab-quiz').style.display = hasQuiz ? 'block' : 'none';
    document.getElementById('quiz-ui-wrapper').classList.toggle('d-none', !hasQuiz);
    document.getElementById('quiz-results-wrapper').classList.add('d-none');
    document.getElementById('quiz-empty-state').classList.toggle('d-none', hasQuiz);
    if (hasQuiz) {
        state.quizQuestionIndex = 0;
        state.quizCorrectAnswers = 0;
        renderQuizQuestion();
    }
}

export function initLearn(navigate, capsuleId) {
    capsule = storage.loadCap(capsuleId);
    if (!capsule) { alert('Error: Could not load capsule.'); navigate('library'); return () => {}; }

    document.getElementById('learn-capsule-title').textContent = capsule.meta.title;
    initNotes(); initFlashcards(); initQuiz();
    
    const firstTab = document.querySelector('#learn-tabs .nav-link[style*="display: block"]');
    if (firstTab) new bootstrap.Tab(firstTab).show();

    document.getElementById('btn-back-to-library').onclick = () => navigate('library');
    document.getElementById('flashcard-flip').onclick = flipFlashcard;
    document.getElementById('flashcard').onclick = flipFlashcard;
    document.getElementById('flashcard-next').onclick = () => moveFlashcard(1);
    document.getElementById('flashcard-prev').onclick = () => moveFlashcard(-1);
    document.getElementById('flashcard-mark-known').onclick = markFlashcardAsKnown;
    // Unknown button 
    const unknownBtn = document.getElementById('flashcard-mark-unknown');
    if (unknownBtn) unknownBtn.onclick = () => markFlashcardAsUnknown();
    document.getElementById('quiz-options-container').onclick = (e) => {
        const target = e.target.closest('.list-group-item');
        if (target && !target.classList.contains('disabled')) { e.preventDefault(); handleQuizAnswer(parseInt(target.dataset.index)); }
    };
    document.getElementById('quiz-next-btn').onclick = () => { (state.quizQuestionIndex < capsule.quiz.length - 1) ? (state.quizQuestionIndex++, renderQuizQuestion()) : finishQuiz() };
    document.getElementById('quiz-restart-btn').onclick = initQuiz;
    document.addEventListener('keydown', handleKeyPress);
    
    return () => document.removeEventListener('keydown', handleKeyPress);
}