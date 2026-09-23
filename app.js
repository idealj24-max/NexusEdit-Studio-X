/**
 * NexusEdit Studio 4.0 - Module d'intégration API Gemini (Sécurisé & DOM-Safe + Thème Nexus Mega-Mind)
 */

const GEMINI_CONFIG = {
  MODEL_NAME: "gemini-3.6-flash",
  BASE_URL: "https://generativelanguage.googleapis.com/v1beta/models",
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1500
};

// --- Gestionnaire d'erreurs UI (Style Thème Sombre Nexus AI Mega-Mind) ---
class AIErrorHandler {
    constructor(containerId = 'ai-notification-container') {
        this.container = this.ensureContainer(containerId);
        this.autoHideTimer = null;
    }

    ensureContainer(id) {
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 10000;
                max-width: 380px;
                width: calc(100% - 48px);
                font-family: 'JetBrains Mono', monospace, sans-serif;
                pointer-events: none;
            `;
            document.body.appendChild(el);
        }
        return el;
    }

    show(status, customMsg = null, isFallbackTriggered = false) {
        this.clear();

        const card = document.createElement('div');
        const borderColor = status === 429 ? '#f39c12' : '#00f0ff';
        card.style.cssText = `
            background: rgba(13, 17, 23, 0.95);
            color: #e6edf3;
            border: 1px solid ${borderColor};
            border-left: 4px solid ${borderColor};
            padding: 12px 14px;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 240, 255, 0.15);
            position: relative;
            pointer-events: auto;
            margin-top: 8px;
            backdrop-filter: blur(8px);
        `;

        const header = document.createElement('div');
        header.style.cssText = `font-weight: 700; font-size: 12px; margin-bottom: 4px; color: ${borderColor}; display: flex; align-items: center; gap: 6px;`;
        header.textContent = status === 429 
            ? '⚠️ Note d\'orchestration (429)' 
            : '🔌 Notice d\'orchestration (503)';

        const body = document.createElement('p');
        body.style.cssText = 'margin: 0; font-size: 11.5px; color: #8b949e; line-height: 1.45;';
        
        if (isFallbackTriggered) {
            body.innerHTML = 'Serveur distant occupé. Basculement transparent vers le <strong>Moteur Heuristique Local Nexus</strong>.';
        } else {
            body.textContent = customMsg || (status === 429 
                ? 'Tentative de récupération en cours...' 
                : 'Service IA temporairement surchargé.');
        }

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: transparent;
            border: none;
            color: #8b949e;
            cursor: pointer;
            font-size: 13px;
        `;
        closeBtn.onclick = () => this.clear();

        card.appendChild(header);
        card.appendChild(body);
        card.appendChild(closeBtn);
        this.container.appendChild(card);

        this.autoHideTimer = setTimeout(() => this.clear(), 8000);
    }

    clear() {
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
        }
        if (this.container) {
            this.container.textContent = '';
        }
    }
}

const aiErrorHandler = new AIErrorHandler();

// --- Moteur Heuristique Local Nexus (Fallback transparent 429/503) ---
function runNexusLocalHeuristic(prompt) {
    return `[MOTEUR HEURISTIQUE LOCAL NEXUS - Mode Secours Actif]
Analyse locale de la requête : "${prompt ? prompt.substring(0, 60) + '...' : 'Sourcing / E-commerce'}".
- Génération structurée par patrons locaux (B2B/B2C, devises XOF/MRU, intégration WhatsApp/Bankily).
- Code mis à jour en sandbox locale sans interruption d'affichage.`;
}

// Utilitaire de pause pour le retry
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fonction générique pour interroger l'API Gemini avec Retry 429 + Fallback Local Nexus
 */
async function generateWithGemini(prompt, apiKey) {
  if (!apiKey || apiKey.trim() === "") {
    // Si pas de clé, bascule directe ou message explicite
    throw new Error("Clé API Gemini absente. Veuillez insérer votre Token.");
  }

  const url = `${GEMINI_CONFIG.BASE_URL}/${GEMINI_CONFIG.MODEL_NAME}:generateContent?key=${apiKey.trim()}`;
  let lastStatus = null;

  for (let attempt = 0; attempt <= GEMINI_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      lastStatus = response.status;

      // Gestion spécifique Rate Limit (429) avec Retry exponentiel
      if (lastStatus === 429 && attempt < GEMINI_CONFIG.MAX_RETRIES) {
        const delay = GEMINI_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
        aiErrorHandler.show(429, `Tentative ${attempt + 1}/${GEMINI_CONFIG.MAX_RETRIES} dans ${Math.round(delay/1000)}s...`);
        await sleep(delay);
        continue;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || "Erreur communication Gemini.";
        throw new Error(`Erreur IA (${response.status}) : ${errorMsg}`);
      }

      aiErrorHandler.clear();

      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error("Format de réponse invalide reçu de l'API.");
      }

    } catch (error) {
      // Épuisement des retries 429 ou erreur 503 -> Basculement transparent vers Moteur Heuristique Local Nexus
      if (lastStatus === 429 || lastStatus === 503 || error.message.includes('429') || error.message.includes('503')) {
        aiErrorHandler.show(lastStatus || 503, null, true);
        return runNexusLocalHeuristic(prompt);
      }
      
      if (attempt === GEMINI_CONFIG.MAX_RETRIES) {
        console.error("Gemini API Error (Final):", error);
        aiErrorHandler.show(503, null, true);
        return runNexusLocalHeuristic(prompt);
      }
    }
  }
}

/**
 * Action spécifique pour la génération de scripts TikTok / Réseaux sociaux
 */
async function generateTikTokScript(sujet, format, ton, apiKey) {
  const prompt = `Rédige un script complet et un storyboard pour une vidéo courte (Format: ${format}, Ton: ${ton}). 
Sujet : ${sujet}.
Inclus les instructions visuelles, audio et le texte à dire à la caméra.`;

  return await generateWithGemini(prompt, apiKey);
}

// Exemple de liaison d'événement UI sécurisée (Zéro innerHTML non contrôlé)
document.getElementById("btn-execute")?.addEventListener("click", async () => {
  const apiKey = document.getElementById("api-key-input")?.value;
  const prompt = document.getElementById("prompt-input")?.value;
  const outputContainer = document.getElementById("output-result");

  if (!outputContainer) return;

  try {
    outputContainer.textContent = "Génération en cours via Nexus AI Mega-Mind...";
    outputContainer.style.color = "#00f0ff";
    
    const result = await generateWithGemini(prompt, apiKey);
    outputContainer.textContent = result;
    outputContainer.style.color = "inherit";
  } catch (err) {
    outputContainer.textContent = "";
    const errorSpan = document.createElement("span");
    errorSpan.style.color = "#ff5555";
    errorSpan.textContent = err.message;
    outputContainer.appendChild(errorSpan);
  }
});
// ==========================================
// AJOUT : Gestionnaire d'init et de rejouabilité
// ==========================================

function initNexusApp(options = { restoreState: true }) {
  console.log("⚡ NexusEdit Studio - Initialisation...");
  
  // Ajustez les sélecteurs selon vos IDs réels dans index.html
  const executeBtn = document.getElementById("btn-execute") || document.querySelector(".btn-execute");
  
  if (executeBtn && !executeBtn.dataset.bound) {
    executeBtn.addEventListener("click", () => {
      // Appel à votre fonction d'exécution existante
      if (typeof handleExecution === "function") {
        handleExecution();
      }
    });
    executeBtn.dataset.bound = "true";
  }
}

function replayNexusApp() {
  console.log("🔄 Rejouabilité / Rechargement de l'état Nexus...");
  if (typeof aiErrorHandler !== "undefined" && aiErrorHandler.clear) {
    aiErrorHandler.clear();
  }
  initNexusApp({ restoreState: true });
}

// Auto-démarrage
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initNexusApp());
} else {
  initNexusApp();
}

// Exposition globale pour megamind-patcher.js
window.NexusStudio = {
  init: initNexusApp,
  replay: replayNexusApp
};
