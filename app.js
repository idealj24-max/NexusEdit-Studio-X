/**
 * NexusEdit Studio 4.0 - Module d'intégration API Gemini (Sécurisé & DOM-Safe)
 */

const GEMINI_CONFIG = {
  MODEL_NAME: "gemini-3.6-flash",
  BASE_URL: "https://generativelanguage.googleapis.com/v1beta/models",
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1500
};

// --- Gestionnaire d'erreurs UI (Isolation DOM totale) ---
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
                max-width: 340px;
                width: calc(100% - 48px);
                font-family: inherit;
                pointer-events: none;
            `;
            document.body.appendChild(el);
        }
        return el;
    }

    show(status, customMsg = null) {
        this.clear();

        const card = document.createElement('div');
        card.style.cssText = `
            background: #1e1e1e;
            color: #f8f9fa;
            border-left: 4px solid ${status === 429 ? '#f39c12' : '#e74c3c'};
            padding: 14px 16px;
            border-radius: 6px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            position: relative;
            pointer-events: auto;
            margin-top: 8px;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'font-weight: 600; font-size: 13px; margin-bottom: 4px;';
        header.textContent = status === 429 ? '⚠️ Rate Limit (429) - Retry auto...' : '🔌 Service Surchargé (503)';

        const body = document.createElement('p');
        body.style.cssText = 'margin: 0; font-size: 12px; color: #adb5bd; line-height: 1.4;';
        body.textContent = customMsg || (status === 429 
            ? 'Tentative de récupération en cours...' 
            : 'Le service IA est temporairement indisponible.');

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: transparent;
            border: none;
            color: #6c757d;
            cursor: pointer;
            font-size: 14px;
        `;
        closeBtn.onclick = () => this.clear();

        card.appendChild(header);
        card.appendChild(body);
        card.appendChild(closeBtn);
        this.container.appendChild(card);

        this.autoHideTimer = setTimeout(() => this.clear(), 7000);
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

// Utilitaire de pause pour le retry
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fonction générique pour interroger l'API Gemini avec Retry 429 exponentiel
 */
async function generateWithGemini(prompt, apiKey) {
  if (!apiKey || apiKey.trim() === "") {
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
        const errorMsg = data.error?.message || "Erreur lors de la communication avec Gemini.";
        throw new Error(`Erreur IA (${response.status}) : ${errorMsg}`);
      }

      aiErrorHandler.clear();

      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error("Format de réponse invalide reçu de l'API.");
      }

    } catch (error) {
      // Si c'est une erreur HTTP gérée et qu'on a épuisé les retries 429 / ou 503
      if (lastStatus === 503 || (lastStatus === 429 && attempt === GEMINI_CONFIG.MAX_RETRIES)) {
        aiErrorHandler.show(lastStatus);
      }
      if (attempt === GEMINI_CONFIG.MAX_RETRIES || !error.message.includes('429')) {
        console.error("Gemini API Error:", error);
        throw error;
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
    outputContainer.textContent = "Génération en cours...";
    outputContainer.style.color = "inherit";
    
    const result = await generateWithGemini(prompt, apiKey);
    outputContainer.textContent = result;
  } catch (err) {
    outputContainer.textContent = "";
    const errorSpan = document.createElement("span");
    errorSpan.style.color = "#ff5555";
    errorSpan.textContent = err.message;
    outputContainer.appendChild(errorSpan);
  }
});
