import * as storage from "./storage.js";
import { generateId, escapeHTML, debounce } from "./main.js";

// announce helper (uses live region added in index.html)
const a11yLive = document.getElementById("a11y-live");

function announce(message) {
    try {
        if (!a11yLive) return;
        a11yLive.textContent = "";
        setTimeout(() => (a11yLive.textContent = message), 50);
    } catch (e) {
        console.warn("announce failed", e);
    }
}

const form = document.getElementById("author-form");
const heading = document.getElementById("author-heading");
const capsuleIdInput = document.getElementById("capsule-id");
const flashcardsContainer = document.getElementById("flashcards-container");
const quizContainer = document.getElementById("quiz-container");

function addFlashcardRow(front = "", back = "") {
    const div = document.createElement("div");
    div.className = "dynamic-row";
    div.innerHTML = `
        <input type="text" class="form-control" placeholder="Front" value="${escapeHTML(
        front
    )}">
        <input type="text" class="form-control" placeholder="Back" value="${escapeHTML(
        back
    )}" aria-label="Back of flashcard">
        <button type="button" class="btn btn-sm btn-outline-danger btn-remove"><i class="bi bi-x-lg"></i></button>`;
    div.querySelector(".btn-remove").onclick = () => div.remove();
    flashcardsContainer.appendChild(div);
}

function addQuizQuestionRow(
    question = "",
    options = ["", "", "", ""],
    answerIndex = 0,
    explanation = ""
) {
    const uniqueName = `correct_answer_${quizContainer.children.length
        }_${Date.now()}`;
    const div = document.createElement("div");
    div.className = "dynamic-quiz-block border p-3 mb-3 rounded";
    div.innerHTML = `
        <div class="d-flex justify-content-between mb-2">
            <label class="form-label mb-0 fw-bold">Question:</label>
            <button type="button" class="btn-close btn-remove-quiz" aria-label="Remove question"></button>
        </div>
        <input type="text" class="form-control mb-2" placeholder="Question text" value="${escapeHTML(
        question
    )}">
        <div class="input-group mb-1">
            <div class="input-group-text"><input class="form-check-input mt-0" type="radio" name="${uniqueName}" ${answerIndex === 0 ? "checked" : ""
        } aria-label="Option A"></div>
            <input type="text" class="form-control" placeholder="Option A" value="${escapeHTML(
            options[0] || ""
        )}">
        </div>
        <div class="input-group mb-1">
            <div class="input-group-text"><input class="form-check-input mt-0" type="radio" name="${uniqueName}" ${answerIndex === 1 ? "checked" : ""
        } aria-label="Option B"></div>
            <input type="text" class="form-control" placeholder="Option B" value="${escapeHTML(
            options[1] || ""
        )}">
        </div>
        <div class="input-group mb-1">
            <div class="input-group-text"><input class="form-check-input mt-0" type="radio" name="${uniqueName}" ${answerIndex === 2 ? "checked" : ""
        } aria-label="Option C"></div>
            <input type="text" class="form-control" placeholder="Option C" value="${escapeHTML(
            options[2] || ""
        )}">
        </div>
        <div class="input-group mb-1">
            <div class="input-group-text"><input class="form-check-input mt-0" type="radio" name="${uniqueName}" ${answerIndex === 3 ? "checked" : ""
        } aria-label="Option D"></div>
            <input type="text" class="form-control" placeholder="Option D" value="${escapeHTML(
            options[3] || ""
        )}">
        </div>
        <div class="mb-2">
            <label class="form-label mb-1">Explanation (optional)</label>
            <input type="text" class="form-control" placeholder="Short explanation shown after answering" value="${escapeHTML(
            explanation
        )}">
        </div>`;
    div.querySelector(".btn-remove-quiz").onclick = () => div.remove();
    quizContainer.appendChild(div);
}

function renderAuthor(capsule = null) {
    form.reset();
    // clear previous validation UI
    form.classList.remove("was-validated");
    capsuleIdInput.value = capsule ? capsule.id : "";
    heading.textContent = capsule ? "Edit Capsule" : "Create New Capsule";
    if (capsule) {
        document.getElementById("meta-title").value = capsule.meta.title || "";
        document.getElementById("meta-subject").value = capsule.meta.subject || "";
        document.getElementById("meta-level").value = capsule.meta.level || "";
        document.getElementById("meta-description").value = capsule.meta.description || "";

        if (Array.isArray(capsule.notes)) {
            document.getElementById("notes-content").value = capsule.notes.join("\n");
        } else {
            document.getElementById("notes-content").value = capsule.notes || "";
        }
    }
    flashcardsContainer.innerHTML = "";
    if (capsule?.flashcards)
        capsule.flashcards.forEach((c) => addFlashcardRow(c.front, c.back));
    quizContainer.innerHTML = "";
    if (capsule?.quiz)
        capsule.quiz.forEach((q) =>
            addQuizQuestionRow(
                q.question,
                q.options,
                q.answerIndex,
                q.explanation || ""
            )
        );
}

export function initAuthor(navigate, capsuleId) {
    renderAuthor(capsuleId ? storage.loadCap(capsuleId) : null);

    form.onsubmit = (e) => {
        e.preventDefault();
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
            const invalidControls = Array.from(form.querySelectorAll(':invalid'));
            invalidControls.forEach(ic => ic.classList.add('is-invalid'));
            // focus the first invalid control and announce
            const firstInvalid = invalidControls[0];
            if (firstInvalid) {
                firstInvalid.focus();
                const label = form.querySelector(`label[for="${firstInvalid.id}"]`);
                const rawName = label ? label.textContent.replace(/\s*\*/g, "").trim() : (firstInvalid.id || firstInvalid.placeholder || firstInvalid.getAttribute('aria-label') || firstInvalid.type || 'This field');
                const msg = `${rawName} is required.`;

                announce(msg);
                try { showLocalAlert(escapeHTML(msg), 'danger', 4000); } catch (e) { }
            }
            return;
        }
        // compute a canonical  id
        const rawId = (capsuleIdInput.value || generateId()).toString();
        const canonicalId = rawId.startsWith("cap_") ? rawId : `cap_${rawId}`;
        const now = new Date().toISOString();
        const notesRaw = document.getElementById("notes-content").value;
        const notesArray = notesRaw === "" ? [] : notesRaw.split(/\r?\n/);
        const flashcardsArr = Array.from(
            flashcardsContainer.querySelectorAll(".dynamic-row")
        )
            .map((r) => ({
                front: r.children[0].value.trim(),
                back: r.children[1].value.trim(),
            }))
            .filter((c) => c.front && c.back);
        const quizArr = Array.from(
            quizContainer.querySelectorAll(".dynamic-quiz-block")
        )
            .map((b) => ({
                question: b.querySelector('input[type="text"]').value.trim(),
                options: Array.from(
                    b.querySelectorAll('.input-group input[type="text"]')
                ).map((i) => i.value.trim()),
                answerIndex: Array.from(
                    b.querySelectorAll('input[type="radio"]')
                ).findIndex((r) => r.checked),
                explanation: (
                    Array.from(b.querySelectorAll('input[type="text"]')).slice(-1)[0] || {
                        value: "",
                    }
                ).value.trim(),
            }))
            .filter(
                (q) => q.question && q.options.every((o) => o) && q.answerIndex !== -1
            );

        const capsule = {
            schema: "pocket-classroom/v1",
            id: canonicalId,
            meta: {
                title: document.getElementById("meta-title").value.trim(),
                subject: document.getElementById("meta-subject").value.trim(),
                level: document.getElementById("meta-level").value.trim(),
                description: document.getElementById("meta-description").value.trim(),
                createdAt: capsuleIdInput.value ? storage.loadCap(canonicalId)?.meta?.createdAt || now : now,
                updatedAt: now,
            },
            notes: notesArray,
            flashcards: flashcardsArr,
            quiz: quizArr,
            resources: [],
        };
        // Additional validation: ensure meta.title non-empty and at least one content block
        if (!capsule.meta.title) {
            form.classList.add("was-validated");
            announce("Title is required.");
            try { showLocalAlert(escapeHTML('Title is required.'), 'danger', 4000); } catch (e) { }
            document.getElementById("meta-title").focus();
            return;
        }
        if (
            (!Array.isArray(capsule.notes) || capsule.notes.length === 0) &&
            capsule.flashcards.length === 0 &&
            capsule.quiz.length === 0
        ) {
            announce("Capsule must have notes, flashcards, or a quiz.");
            try { showLocalAlert(escapeHTML('Capsule must have notes, flashcards, or a quiz.'), 'warning', 4000); } catch (e) { }
            return;
        }
        storage.saveCap(capsule);
        // save index entries using top-level id
        let index = storage.loadIndex().filter((item) => item.id !== capsule.id);
        index.push({
            id: capsule.id,
            title: capsule.meta.title,
            subject: capsule.meta.subject,
            level: capsule.meta.level,
            updatedAt: capsule.meta.updatedAt,
        });
        storage.saveIndex(index);

        try { showLocalAlert(`Saved "${escapeHTML(capsule.meta.title)}"`, "success", 3000); announce("Capsule saved."); } catch (e) { announce("Capsule saved."); }
        navigate("library");
    };
    document.getElementById("btn-add-flashcard").onclick = () =>
        addFlashcardRow();
    document.getElementById("btn-add-quiz-question").onclick = () =>
        addQuizQuestionRow();
    document.getElementById("btn-cancel-author").onclick = () =>
        navigate("library");

    // Autosave (debounced) while editing
    const saveDraft = debounce(() => {
        try {
            const draftId = capsuleIdInput.value || "draft";
            const draft = {
                meta: {
                    id: draftId,
                    title: document.getElementById("meta-title").value.trim(),
                    subject: document.getElementById("meta-subject").value.trim(),
                    level: document.getElementById("meta-level").value.trim(),
                    description: document.getElementById("meta-description").value.trim(),
                    updatedAt: new Date().toISOString(),
                },
                notes: document.getElementById("notes-content").value,
                flashcards: Array.from(
                    flashcardsContainer.querySelectorAll(".dynamic-row")
                )
                    .map((r) => ({
                        front: r.children[0].value,
                        back: r.children[1].value,
                    }))
                    .filter((c) => c.front || c.back),
                quiz: Array.from(
                    quizContainer.querySelectorAll(".dynamic-quiz-block")
                ).map((b) => ({
                    question: b.querySelector('input[type="text"]').value,
                    options: Array.from(
                        b.querySelectorAll('.input-group input[type="text"]')
                    ).map((i) => i.value),
                    answerIndex: Array.from(
                        b.querySelectorAll('input[type="radio"]')
                    ).findIndex((r) => r.checked),
                    explanation: (
                        Array.from(b.querySelectorAll('input[type="text"]')).slice(-1)[0] || { value: "" }
                    ).value,
                })),
            };
            localStorage.setItem(`pc_draft_${draftId}`, JSON.stringify(draft));
            try { showLocalAlert('Draft auto-saved', 'info', 2000); announce('Draft auto-saved'); } catch (e) { announce('Draft auto-saved'); }
        } catch (e) {
        }
    }, 1000);

    // wire inputs to autosave
    form
        .querySelectorAll("input, textarea, select")
        .forEach((el) => {
            el.addEventListener("input", (ev) => {
                // clear invalid marker when user types

                ev.target.classList.remove('is-invalid');

                // if there are no invalid controls left, remove was-validated
                if (!form.querySelector(':invalid')) form.classList.remove('was-validated');
                saveDraft();
            });
        });
}


function showLocalAlert(message, type = 'info', timeout = 4000) {
    try {
        const container = document.getElementById('app-alerts');
        if (!container) return;
        const wrapper = document.createElement('div');
        wrapper.style.pointerEvents = 'auto';
        wrapper.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">${message}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
        // prepend so validation messages appear at top
        container.prepend(wrapper);
        setTimeout(() => { try { wrapper.remove(); } catch (e) { } }, timeout);
    } catch (e) { /* ignore */ }
}