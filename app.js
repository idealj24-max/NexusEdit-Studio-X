/**
 * NexusEdit Studio 10.0 - Module d'orchestration multi-moteur IA
 * (Corrigé : nom de modèle Gemini valide, vrai routage multi-moteur, persistance clé API
 *  sur le champ réellement utilisé par l'interface: #ai-api-key)
 */

const ENGINE_CONFIG = {
  gemini: {
    label: "Google Gemini 3.6 Flash",
    model: "gemini-3.6-flash"
  },
  openai: {
    label: "GPT-4o (OpenAI)",
    model: "gpt-4o"
  },
  claude: {
    label: "Claude (Anthropic)",
    model: "claude-sonnet-4-5"
  },
  deepseek: {
    label: "DeepSeek R1",
    model: "deepseek-reasoner"
  }
};

const RETRY_CONFIG = {
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
            body.innerHTML = 'Serveur distant occupé ou en erreur. Basculement transparent vers le <strong>Moteur Heuristique Local Nexus</strong>.';
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
Analyse locale de la requête : "${prompt ? prompt.substring(0, 60) + '...' : 'Requête vide'}".
- Aucune réponse distante n'a pu être obtenue (quota, réseau ou erreur serveur).
- Ceci est un texte générique, pas une génération IA réelle.`;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Appel Gemini (Google AI Studio)
 */
async function callGemini(prompt, apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.error?.message || `Erreur Gemini (${response.status})`);
    err.status = response.status;
    throw err;
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Format de réponse Gemini invalide.");
  return text;
}

/**
 * Appel OpenAI (GPT-4o)
 */
async function callOpenAI(prompt, apiKey, model) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.error?.message || `Erreur OpenAI (${response.status})`);
    err.status = response.status;
    throw err;
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Format de réponse OpenAI invalide.");
  return text;
}

/**
 * Appel Claude (Anthropic).
 * NOTE : l'API Anthropic n'autorise les appels directs depuis un navigateur qu'avec
 * l'en-tête "anthropic-dangerous-direct-browser-access". Selon la configuration CORS
 * de votre compte, cet appel peut être bloqué — dans ce cas le fallback heuristique prendra le relais.
 */
async function callClaude(prompt, apiKey, model) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.error?.message || `Erreur Claude (${response.status})`);
    err.status = response.status;
    throw err;
  }
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("Format de réponse Claude invalide.");
  return text;
}

/**
 * Appel DeepSeek (compatible format OpenAI)
 */
async function callDeepSeek(prompt, apiKey, model) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.error?.message || `Erreur DeepSeek (${response.status})`);
    err.status = response.status;
    throw err;
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Format de réponse DeepSeek invalide.");
  return text;
}

const ENGINE_CALLERS = {
  gemini: callGemini,
  openai: callOpenAI,
  claude: callClaude,
  deepseek: callDeepSeek
};

/**
 * Point d'entrée unique : route vers le bon moteur, gère le retry 429 et le fallback local.
 */
async function generateWithEngine(engineKey, prompt, apiKey) {
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Clé API absente. Veuillez insérer votre token dans le panneau IA Mega-Mind.");
  }
  const engine = ENGINE_CONFIG[engineKey] || ENGINE_CONFIG.gemini;
  const caller = ENGINE_CALLERS[engineKey] || ENGINE_CALLERS.gemini;
  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const result = await caller(prompt, apiKey.trim(), engine.model);
      aiErrorHandler.clear();
      return result;
    } catch (error) {
      lastError = error;
      const status = error.status;
      if (status === 429 && attempt < RETRY_CONFIG.MAX_RETRIES) {
        const delay = RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
        aiErrorHandler.show(429, `Tentative ${attempt + 1}/${RETRY_CONFIG.MAX_RETRIES} dans ${Math.round(delay / 1000)}s...`);
        await sleep(delay);
        continue;
      }
      // Erreur non récupérable ou dernier essai épuisé -> fallback local transparent
      console.error(`Erreur ${engine.label}:`, error);
      aiErrorHandler.show(status || 503, null, true);
      return runNexusLocalHeuristic(prompt);
    }
  }
  return runNexusLocalHeuristic(prompt);
}

// ==========================================
// INITIALISATION & PERSISTANCE CLÉ API
// ==========================================

// FIX : on cible désormais le vrai champ utilisé par l'UI (#ai-api-key), plus l'ancien #api-key-input inexistant
function initNexusApp(options = { restoreState: true }) {
  console.log("⚡ NexusEdit Studio - Initialisation du module IA...");

  const apiKeyInput = document.getElementById("ai-api-key");
  if (!apiKeyInput) return;

  if (options.restoreState) {
    const savedApiKey = localStorage.getItem("nexus_ai_api_key");
    if (savedApiKey && !apiKeyInput.value) {
      apiKeyInput.value = savedApiKey;
      console.log("🔑 Clé API restaurée depuis le stockage local.");
    }
  }

  if (!apiKeyInput.dataset.savedBound) {
    apiKeyInput.addEventListener("input", () => {
      localStorage.setItem("nexus_ai_api_key", apiKeyInput.value);
    });
    apiKeyInput.dataset.savedBound = "true";
  }
}

function replayNexusApp() {
  console.log("🔄 Rejouabilité / Rechargement de l'état Nexus...");
  if (typeof aiErrorHandler !== "undefined" && aiErrorHandler.clear) {
    aiErrorHandler.clear();
  }
  initNexusApp({ restoreState: true });
}

// Auto-démarrage sécurisé (attend que le DOM de index.html soit prêt)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initNexusApp());
} else {
  initNexusApp();
}

// Exposition globale pour index.html et megamind-patcher.js
window.NexusStudio = {
  init: initNexusApp,
  replay: replayNexusApp,
  generate: generateWithEngine,
  engines: ENGINE_CONFIG
};
