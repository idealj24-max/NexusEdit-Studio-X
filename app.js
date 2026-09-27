/**
 * NEXUSEDIT-STUDIO-X
 * APP CORE v11.0
 *
 * Module d'intégration de l'interface avec :
 * - Nexus Core
 * - Nexus AI Gateway
 * - Nexus Agent Runtime
 * - Mega-Mind
 *
 * IMPORTANT :
 * Les clés API des fournisseurs ne sont plus utilisées
 * directement dans le navigateur.
 *
 * Architecture :
 *
 * Interface
 *    ↓
 * NexusStudio.generate()
 *    ↓
 * NexusAIGateway
 *    ↓
 * /api/nexus-ai
 *    ↓
 * Backend sécurisé
 *    ↓
 * Gemini / OpenAI / Claude / DeepSeek
 */

(function () {
  'use strict';

  const VERSION = '11.0.0';

  // =========================================================
  // CONFIGURATION DES MOTEURS
  // =========================================================

  const ENGINE_CONFIG = Object.freeze({

    gemini: {
      id: 'gemini',
      label: 'Google Gemini',
      model: 'gemini-3.8-flash',
      provider: 'gemini'
    },

    openai: {
      id: 'openai',
      label: 'OpenAI',
      model: 'gpt-5',
      provider: 'openai'
    },

    claude: {
      id: 'claude',
      label: 'Anthropic Claude',
      model: 'claude-sonnet-4-5',
      provider: 'claude'
    },

    deepseek: {
      id: 'deepseek',
      label: 'DeepSeek',
      model: 'deepseek-flash',
      provider: 'deepseek'
    }

  });

  // =========================================================
  // CONFIGURATION RETRY
  // =========================================================

  const RETRY_CONFIG = Object.freeze({
    MAX_RETRIES: 3,
    BASE_DELAY_MS: 1500
  });

  // =========================================================
  // GESTIONNAIRE D'ERREURS UI
  // =========================================================

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

        if (document.body) {
          document.body.appendChild(el);
        }
      }

      return el;
    }

    show(
      status,
      customMsg = null,
      isFallbackTriggered = false
    ) {

      this.clear();

      if (!this.container) return;

      const card = document.createElement('div');

      const borderColor =
        Number(status) === 429
          ? '#f39c12'
          : '#00f0ff';

      card.style.cssText = `
        background: rgba(13, 17, 23, 0.95);
        color: #e6edf3;
        border: 1px solid ${borderColor};
        border-left: 4px solid ${borderColor};
        padding: 12px 14px;
        border-radius: 8px;
        box-shadow:
          0 10px 30px rgba(0, 0, 0, 0.8),
          0 0 15px rgba(0, 240, 255, 0.15);
        position: relative;
        pointer-events: auto;
        margin-top: 8px;
        backdrop-filter: blur(8px);
      `;

      const header = document.createElement('div');

      header.style.cssText = `
        font-weight: 700;
        font-size: 12px;
        margin-bottom: 4px;
        color: ${borderColor};
        display: flex;
        align-items: center;
        gap: 6px;
      `;

      header.textContent =
        Number(status) === 429
          ? "⚠️ Note d'orchestration (429)"
          : "🔌 Notice d'orchestration";

      const body = document.createElement('p');

      body.style.cssText = `
        margin: 0;
        font-size: 11.5px;
        color: #8b949e;
        line-height: 1.45;
      `;

      if (isFallbackTriggered) {

        body.innerHTML =
          'Le service distant n’a pas répondu. ' +
          'Le Moteur Heuristique Local Nexus a été activé.';

      } else {

        body.textContent =
          customMsg ||
          (
            Number(status) === 429
              ? 'Tentative de récupération en cours...'
              : 'Service IA temporairement indisponible.'
          );
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

      this.autoHideTimer =
        setTimeout(() => this.clear(), 8000);
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

  const aiErrorHandler =
    new AIErrorHandler();

  // =========================================================
  // FALLBACK LOCAL
  // =========================================================

  function runNexusLocalHeuristic(prompt) {

    const safePrompt =
      String(prompt || '').trim();

    return `
[MOTEUR HEURISTIQUE LOCAL NEXUS - MODE SECOURS]

La requête n'a pas pu être traitée par le
Nexus AI Gateway.

Requête :
"${safePrompt.substring(0, 300)}"

Causes possibles :
- backend Nexus indisponible ;
- clé fournisseur absente côté serveur ;
- problème réseau ;
- quota fournisseur ;
- erreur temporaire.

IMPORTANT :
Cette réponse est un secours local.
Ce n'est PAS une génération IA distante.
`;
  }

  // =========================================================
  // UTILITAIRES
  // =========================================================

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function getGateway() {

    if (
      window.NexusAIGatewayInstance &&
      typeof window.NexusAIGatewayInstance.generate === 'function'
    ) {

      return window.NexusAIGatewayInstance;
    }

    throw new Error(
      'Nexus AI Gateway non disponible. ' +
      'Vérifiez que nexus-ai-gateway.js est chargé.'
    );
  }

  function normalizeEngine(engineKey) {

    const key =
      String(engineKey || 'gemini')
        .toLowerCase()
        .trim();

    if (ENGINE_CONFIG[key]) {
      return ENGINE_CONFIG[key];
    }

    return ENGINE_CONFIG.gemini;
  }

  // =========================================================
  // GÉNÉRATION VIA NEXUS AI GATEWAY
  // =========================================================

  async function generateWithEngine(
    engineKey,
    prompt,
    legacyApiKey = null,
    options = {}
  ) {

    const text =
      String(prompt || '').trim();

    if (!text) {

      throw new Error(
        'La requête Nexus est vide.'
      );
    }

    const engine =
      normalizeEngine(engineKey);

    let lastError = null;

    for (
      let attempt = 0;
      attempt <= RETRY_CONFIG.MAX_RETRIES;
      attempt++
    ) {

      try {

        const gateway =
          getGateway();

        /*
         * IMPORTANT :
         *
         * legacyApiKey est volontairement ignorée.
         *
         * Elle est conservée dans la signature
         * uniquement pour ne pas casser les anciennes
         * fonctions de l'interface.
         *
         * Les vraies clés sont maintenant côté backend.
         */

        const result =
          await gateway.generate({

            provider:
              engine.provider,

            model:
              options.model ||
              engine.model,

            prompt:
              text,

            system:
              options.system ||
              '',

            task:
              options.task ||
              null,

            agent:
              options.agent ||
              null,

            context:
              options.context ||
              {},

            responseFormat:
              options.responseFormat ||
              'text',

            temperature:
              typeof options.temperature === 'number'
                ? options.temperature
                : 0.7,

            maxTokens:
              options.maxTokens ||
              4000

          });

        aiErrorHandler.clear();

        return (
          result?.text ??
          result?.data ??
          ''
        );

      } catch (error) {

        lastError = error;

        const status =
          Number(error?.status || 0);

        console.error(
          `[NexusStudio] ${engine.label} erreur :`,
          error
        );

        /*
         * Retry uniquement pour les erreurs
         * temporaires / surcharge.
         */

        const retryable =
          status === 408 ||
          status === 425 ||
          status === 429 ||
          status >= 500;

        if (
          retryable &&
          attempt < RETRY_CONFIG.MAX_RETRIES
        ) {

          const delay =
            RETRY_CONFIG.BASE_DELAY_MS *
            Math.pow(2, attempt) +
            Math.random() * 500;

          aiErrorHandler.show(
            status || 503,
            `Tentative ${attempt + 1}/` +
            `${RETRY_CONFIG.MAX_RETRIES} ` +
            `dans ${Math.round(delay / 1000)}s...`
          );

          await sleep(delay);

          continue;
        }

        break;
      }
    }

    /*
     * Si le Gateway est indisponible,
     * on ne prétend PAS avoir généré du contenu IA.
     */

    aiErrorHandler.show(
      lastError?.status || 503,
      lastError?.message ||
      'Nexus AI Gateway indisponible.',
      true
    );

    return runNexusLocalHeuristic(text);
  }

  // =========================================================
  // GÉNÉRATION DIRECTE VIA LE GATEWAY
  // API MODERNE
  // =========================================================

  async function generateWithNexus(options = {}) {

    const {

      prompt = '',

      provider = 'gemini',

      model = null,

      system = '',

      task = null,

      agent = null,

      context = {},

      responseFormat = 'text',

      temperature = 0.7,

      maxTokens = 4000

    } = options;

    return generateWithEngine(
      provider,
      prompt,
      null,
      {
        model,
        system,
        task,
        agent,
        context,
        responseFormat,
        temperature,
        maxTokens
      }
    );
  }

  // =========================================================
  // EXÉCUTION MEGA-MIND
  // =========================================================

  async function runMegaMind(
    prompt,
    context = {}
  ) {

    const text =
      String(prompt || '').trim();

    if (!text) {

      throw new Error(
        'La demande Mega-Mind est vide.'
      );
    }

    /*
     * Le Runtime est prioritaire.
     *
     * C'est ici que l'application commence
     * à utiliser réellement :
     *
     * NexusCore
     *      ↓
     * Agent Runtime
     *      ↓
     * Agents spécialisés
     *      ↓
     * Nexus Gateway
     */

    if (
      window.NexusAgentRuntimeInstance &&
      typeof window.NexusAgentRuntimeInstance.run ===
        'function'
    ) {

      return window.NexusAgentRuntimeInstance.run(
        text,
        context
      );
    }

    /*
     * Secours : génération simple via Gateway.
     */

    return generateWithNexus({

      prompt: text,

      provider:
        context.provider ||
        'gemini',

      context,

      task: {
        type: 'mega_mind_request'
      },

      agent: 'planner'
    });
  }

  // =========================================================
  // INITIALISATION
  // =========================================================

  function initNexusApp(
    options = {}
  ) {

    console.log(
      `⚡ NexusEdit Studio ${VERSION} - ` +
      `Initialisation du système IA...`
    );

    /*
     * Nous ne stockons plus les clés API
     * dans localStorage.
     *
     * Le backend Nexus possède désormais
     * les secrets fournisseurs.
     */

    const apiKeyInput =
      document.getElementById('ai-api-key');

    if (apiKeyInput) {

      /*
       * Ancien champ conservé pour compatibilité
       * avec l'interface existante.
       *
       * On évite simplement de persister
       * sa valeur dans localStorage.
       */

      if (!apiKeyInput.dataset.nexusBound) {

        apiKeyInput.addEventListener(
          'input',
          () => {

            console.info(
              '🔐 Le champ API local est conservé ' +
              'pour compatibilité UI. ' +
              'Les secrets utilisés par Nexus sont ' +
              'désormais côté serveur.'
            );

          }
        );

        apiKeyInput.dataset.nexusBound =
          'true';
      }
    }

    /*
     * Vérification des modules.
     */

    if (
      !window.NexusAIGatewayInstance
    ) {

      console.warn(
        '⚠️ Nexus AI Gateway non chargé.'
      );

    } else {

      console.log(
        '🌐 Nexus AI Gateway détecté.'
      );
    }

    if (
      !window.NexusAgentRuntimeInstance
    ) {

      console.warn(
        '⚠️ Nexus Agent Runtime non chargé.'
      );

    } else {

      console.log(
        '🤖 Nexus Agent Runtime détecté.'
      );
    }

    if (
      !window.NexusCoreInstance
    ) {

      console.warn(
        '⚠️ Nexus Core non chargé.'
      );

    } else {

      console.log(
        '🧠 Nexus Core détecté.'
      );
    }

    console.log(
      '✅ NexusEdit Studio IA initialisé.'
    );

    return true;
  }

  // =========================================================
  // RECHARGEMENT / REPLAY
  // =========================================================

  function replayNexusApp() {

    console.log(
      '🔄 Rechargement de l’état Nexus...'
    );

    aiErrorHandler.clear();

    return initNexusApp({
      restoreState: false
    });
  }

  // =========================================================
  // INFORMATIONS SYSTÈME
  // =========================================================

  function getSystemStatus() {

    return {

      version: VERSION,

      gateway:
        !!window.NexusAIGatewayInstance,

      runtime:
        !!window.NexusAgentRuntimeInstance,

      core:
        !!window.NexusCoreInstance,

      engines:
        Object.keys(ENGINE_CONFIG)

    };
  }

  // =========================================================
  // INITIALISATION DOM
  // =========================================================

  if (
    document.readyState === 'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      () => initNexusApp()
    );

  } else {

    initNexusApp();

  }

  // =========================================================
  // EXPOSITION GLOBALE
  // =========================================================

  window.NexusStudio = {

    version: VERSION,

    init:
      initNexusApp,

    replay:
      replayNexusApp,

    generate:
      generateWithEngine,

    generateNexus:
      generateWithNexus,

    runMegaMind:
      runMegaMind,

    status:
      getSystemStatus,

    engines:
      ENGINE_CONFIG,

    localFallback:
      runNexusLocalHeuristic

  };

  console.info(
    `🚀 NexusStudio ${VERSION} chargé.`
  );

})();
