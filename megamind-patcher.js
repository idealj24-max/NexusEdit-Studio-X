// --- BLOC 1 : Patcher ---
class MegaMindPatcher {
    constructor(previewFrameId) {
        this.previewFrame = document.getElementById(previewFrameId);
    }

    applyPatch(patchData) {
        try {
            if (patchData.action === 'css') {
                this.injectCSS(patchData.code);
            } else if (patchData.action === 'dom') {
                this.updateDOM(patchData.selector, patchData.html);
            } else if (patchData.action === 'js_eval') {
                this.evalJS(patchData.code);
            }
            this.log('Patch appliqué avec succès.');
        } catch (e) {
            this.error('Échec du patch:', e);
        }
    }

    injectCSS(cssString) {
        const doc = this.previewFrame.contentDocument;
        let style = doc.getElementById('megamind-dynamic-style');
        if (!style) {
            style = doc.createElement('style');
            style.id = 'megamind-dynamic-style';
            doc.head.appendChild(style);
        }
        style.textContent += `\n${cssString}`;
    }

    updateDOM(selector, htmlContent) {
        const doc = this.previewFrame.contentDocument;
        const el = doc.querySelector(selector);
        if (el) {
            el.innerHTML = htmlContent;
        }
    }

    evalJS(codeString) {
        const win = this.previewFrame.contentWindow;
        win.eval(codeString);
    }

    log(msg) { console.info(`[MegaMind-Patcher] ${msg}`); }
    error(msg, err) { console.error(`[MegaMind-Patcher] ${msg}`, err); }
}

// --- BLOC 2 : Parser ---
class MegaMindResponseParser {
    constructor(patcherInstance) {
        this.patcher = patcherInstance;
    }

    parseAndApply(rawResponse) {
        const parsedData = this.extractJSON(rawResponse);
        if (!parsedData) {
            this.patcher.error('Aucun JSON valide trouvé dans la réponse de Mega-Mind.', rawResponse);
            return { success: false, explanation: rawResponse };
        }

        const actions = Array.isArray(parsedData) ? parsedData : [parsedData];
        
        const results = actions.map(actionObj => {
            const normalizedAction = this.normalizeAction(actionObj);
            this.patcher.applyPatch(normalizedAction);
            return { action: normalizedAction, status: 'processed' };
        });

        return {
            success: true,
            explanation: parsedData.explanation || parsedData.comment || 'Patch appliqué.',
            results
        };
    }

    extractJSON(text) {
        if (typeof text === 'object' && text !== null) return text;

        try {
            return JSON.parse(text);
        } catch (e) {
            // Ignorer JSON direct
        }

        const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
        const match = text.match(codeBlockRegex);
        if (match) {
            try {
                return JSON.parse(match.trim());
            } catch (e) {
                this.error('Bloc de code extrait invalide', e);
            }
        }

        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            try {
                return JSON.parse(text.substring(firstBrace, lastBrace + 1));
            } catch (e) {
                this.error('Extraction d’accolades invalide', e);
            }
        }

        return null;
    }

    normalizeAction(item) {
        return {
            action: item.action || item.type || 'css',
            selector: item.selector || item.target || 'body',
            code: item.code || item.script || item.css || item.html || '',
            html: item.html || item.content || ''
        };
    }

    error(msg, err) {
        console.error(`[MegaMind-Parser] ${msg}`, err);
    }
}

// --- BLOC 3 : IndexedDB ---
const DB_NAME = 'MegaMindDeltaDB';
const STORE_NAME = 'patches';

function openDeltaDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveDeltaToIndexedDB(patches) {
    const db = await openDeltaDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    patches.forEach(p => store.add({ timestamp: Date.now(), ...p }));
}

async function replayAllDeltas(patcherInstance) {
    const db = await openDeltaDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
        const records = request.result;
        records.forEach(rec => {
            patcherInstance.applyPatch(rec.action);
        });
        console.info(`[MegaMind-Persistent] ${records.length} delta(s) rejoué(s).`);
    };
}
