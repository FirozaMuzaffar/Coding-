//  LocalStorage Key Constants 
const IDX_KEY = "pc_capsules_index";
const CAP_KEY = (id) => `pc_capsule_${id}`;
const PROG_KEY = (id) => `pc_progress_${id}`;

//  Index Functions 
export function loadIndex() {
    try {
        const index = localStorage.getItem(IDX_KEY);
        return index ? JSON.parse(index) : [];
    } catch (e) {
        console.error("Failed to load capsule index:", e);
        return [];
    }
}
export function saveIndex(indexData) {
    try {
        localStorage.setItem(IDX_KEY, JSON.stringify(indexData));
    } catch (e) {
        console.error("Failed to save capsule index:", e);
    }
}

//  Capsule Functions 
export function loadCap(id) {
    try {
        const capsule = localStorage.getItem(CAP_KEY(id));
        return capsule ? JSON.parse(capsule) : null;
    } catch (e) {
        console.error(`Failed to load capsule ${id}:`, e);
        return null;
    }
}
export function saveCap(capsuleData) {
    if (!capsuleData) {
        console.error("Invalid capsule data provided to saveCap.");
        return;
    }
    try {
        const id = capsuleData.id;
        if (!id) {
            console.error("Cannot save capsule without id");
            return;
        }
        // ensure meta exists but do not duplicate id inside meta to avoid redundancy
        capsuleData.meta = capsuleData.meta || {};
        // persist
        localStorage.setItem(CAP_KEY(id), JSON.stringify(capsuleData));
    } catch (e) {
        console.error(`Failed to save capsule:`, e);
    }
}
export function deleteCap(id) {
    localStorage.removeItem(CAP_KEY(id));
    localStorage.removeItem(PROG_KEY(id));
}

//  Progress Functions 
export function loadProg(id) {
    const defaults = { bestScore: -1, knownFlashcards: [] };
    try {
        const progress = localStorage.getItem(PROG_KEY(id));
        return progress ? {...defaults, ...JSON.parse(progress) } : defaults;
    } catch (e) {
        console.error(`Failed to load progress for ${id}:`, e);
        return defaults;
    }
}
export function saveProg(id, progressData) {
    try {
        localStorage.setItem(PROG_KEY(id), JSON.stringify(progressData));
    } catch (e) {
        console.error(`Failed to save progress for ${id}:`, e);
    }
}