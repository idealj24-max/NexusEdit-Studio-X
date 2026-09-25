/**
 * NEXUSEDIT-STUDIO-X
 * NEXUS AI GATEWAY v1.0
 *
 * Couche unique entre Nexus Agents et les fournisseurs IA.
 *
 * IMPORTANT :
 * Aucune clé API n'est stockée ici.
 *
 * Le navigateur communique avec :
 *
 * Nexus Agent
 *      ↓
 * Nexus AI Gateway
 *      ↓
 * /api/nexus-ai
 *      ↓
 * Backend sécurisé
 *      ↓
 * Gemini / OpenAI / Claude / DeepSeek
 */

(function () {
  'use strict';

  const VERSION = '1.0.0';

  const DEFAULT_CONFIG = {
    endpoint: '/api/nexus-ai',
    timeout: 120000,
    defaultProvider: 'gemini'
  };

  class NexusAIGateway {

    constructor(options = {}) {
      this.version = VERSION;

      this.config = {
        ...DEFAULT_CONFIG,
        ...options
      };

      this.providers = new Map();

      this.registerProvider('gemini', {
        name: 'Google Gemini',
        enabled: true
      });

      this.registerProvider('openai', {
        name: 'OpenAI',
        enabled: true
      });

      this.registerProvider('claude', {
        name: 'Anthropic Claude',
        enabled: true
      });

      this.registerProvider('deepseek', {
        name: 'DeepSeek',
        enabled: true
      });

      console.info(
        `🌐 Nexus AI Gateway ${VERSION} initialisée.`
      );
    }

    registerProvider(id, config = {}) {

      this.providers.set(id, {
        id,
        ...config
      });

      return this.providers.get(id);
    }

    getProvider(id) {

      const provider =
        this.providers.get(id);

      if (!provider) {
        throw new Error(
          `Fournisseur IA inconnu : ${id}`
        );
      }

      if (provider.enabled === false) {
        throw new Error(
          `Fournisseur IA désactivé : ${id}`
        );
      }

      return provider;
    }

    async generate(options = {}) {

      const {
        prompt = '',
        provider = this.config.defaultProvider,
        model = null,
        system = '',
        task = null,
        agent = null,
        context = {},
        responseFormat = 'text',
        temperature = 0.7,
        maxTokens = 4000
      } = options;

      if (!prompt) {
        throw new Error(
          'NexusAIGateway.generate() nécessite un prompt.'
        );
      }

      this.getProvider(provider);

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () => controller.abort(),
          this.config.timeout
        );

      try {

        const response = await fetch(
          this.config.endpoint,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json'
            },

            body: JSON.stringify({

              provider,

              model,

              prompt,

              system,

              task,

              agent,

              context,

              responseFormat,

              temperature,

              maxTokens

            }),

            signal: controller.signal
          }
        );

        const data =
          await response.json();

        if (!response.ok) {

          throw new Error(
            data?.error ||
            `Gateway HTTP ${response.status}`
          );
        }

        return {

          success: true,

          provider:
            data.provider || provider,

          model:
            data.model || model,

          text:
            data.text || '',

          data:
            data.data ?? null,

          usage:
            data.usage ?? null,

          requestId:
            data.requestId ?? null

        };

      } catch (error) {

        if (error?.name === 'AbortError') {

          throw new Error(
            'Nexus AI Gateway : délai dépassé.'
          );
        }

        throw error;

      } finally {

        clearTimeout(timeout);
      }
    }

    async healthCheck() {

      const response =
        await fetch(
          `${this.config.endpoint}/health`,
          {
            method: 'GET'
          }
        );

      if (!response.ok) {
        throw new Error(
          `Gateway indisponible : HTTP ${response.status}`
        );
      }

      return response.json();
    }

    listProviders() {

      return Array.from(
        this.providers.values()
      ).map(provider => ({
        id: provider.id,
        name: provider.name,
        enabled: provider.enabled
      }));
    }
  }

  window.NexusAIGateway =
    NexusAIGateway;

  window.NexusAIGatewayInstance =
    new NexusAIGateway();

  console.info(
    `🚀 Nexus AI Gateway ${VERSION} disponible.`
  );

})();
