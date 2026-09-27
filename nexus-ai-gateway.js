/**
 * NEXUSEDIT-STUDIO-X
 * NEXUS AI GATEWAY v1.1
 * Frontend facade. No provider secret is stored here.
 */
(function () {
  'use strict';

  const VERSION = '1.1.0';
  const config = window.NEXUS_CONFIG || {};
  const DEFAULT_CONFIG = {
    endpoint: config.gatewayUrl || '/api/nexus-ai',
    timeout: Number(config.requestTimeout) || 180000,
    defaultProvider: config.defaultProvider || 'gemini',
    defaultModel: config.defaultModel || 'gemini-3.8-flash'
  };

  class NexusAIGateway {
    constructor(options = {}) {
      this.version = VERSION;
      this.config = { ...DEFAULT_CONFIG, ...options };
      this.providers = new Map();
      this.registerProvider('gemini', { name: 'Google Gemini', enabled: true, model: 'gemini-3.8-flash' });
      this.registerProvider('openai', { name: 'OpenAI', enabled: true, model: 'gpt-5' });
      this.registerProvider('claude', { name: 'Anthropic Claude', enabled: true, model: 'claude-sonnet-4-5' });
      this.registerProvider('deepseek', { name: 'DeepSeek', enabled: true, model: 'deepseek-flash' });
      console.info(`🌐 Nexus AI Gateway ${VERSION} initialisée.`);
    }

    setEndpoint(endpoint) {
      if (!endpoint || typeof endpoint !== 'string') throw new Error('URL Gateway invalide.');
      this.config.endpoint = endpoint.trim().replace(/\/$/, '');
      return this.config.endpoint;
    }

    registerProvider(id, provider = {}) {
      this.providers.set(id, { id, ...provider });
      return this.providers.get(id);
    }

    getProvider(id) {
      const provider = this.providers.get(id);
      if (!provider) throw new Error(`Fournisseur IA inconnu : ${id}`);
      if (provider.enabled === false) throw new Error(`Fournisseur IA désactivé : ${id}`);
      return provider;
    }

    async generate(options = {}) {
      const {
        prompt = '', provider = this.config.defaultProvider,
        model = null, system = '', task = null, agent = null,
        context = {}, responseFormat = 'text', temperature = 0.7,
        maxTokens = 4000, webSearch = false, history = []
      } = options;

      if (!prompt.trim()) throw new Error('NexusAIGateway.generate() nécessite un prompt.');
      const p = this.getProvider(provider);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            model: model || p.model || null,
            prompt,
            system,
            task,
            agent,
            context,
            responseFormat,
            temperature,
            maxTokens,
            webSearch: Boolean(webSearch),
            history: Array.isArray(history) ? history.slice(-12) : []
          }),
          signal: controller.signal
        });

        let data = null;
        try { data = await response.json(); } catch (_) {}
        if (!response.ok) throw new Error(data?.error || `Gateway HTTP ${response.status}`);

        return {
          success: true,
          provider: data.provider || provider,
          model: data.model || model || p.model || null,
          text: data.text || '',
          data: data.data ?? null,
          usage: data.usage ?? null,
          grounding: data.grounding ?? null,
          requestId: data.requestId ?? null,
          task: data.task ?? task,
          agent: data.agent ?? agent
        };
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error('Nexus AI Gateway : délai dépassé.');
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    async healthCheck() {
      const response = await fetch(`${this.config.endpoint}?health=1`, { method: 'GET' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Gateway indisponible : HTTP ${response.status}`);
      return data;
    }

    listProviders() {
      return Array.from(this.providers.values()).map(({ id, name, enabled, model }) => ({ id, name, enabled, model }));
    }
  }

  window.NexusAIGateway = NexusAIGateway;
  window.NexusAIGatewayInstance = new NexusAIGateway();
  console.info(`🚀 Nexus AI Gateway ${VERSION} disponible.`);
})();
