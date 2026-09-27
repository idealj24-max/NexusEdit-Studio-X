/**
 * NexusEdit Studio X - AI compatibility bridge v11.
 * All provider calls go through NexusAIGateway.
 */
(function () {
  'use strict';

  const ENGINE_CONFIG = {
    gemini: { label: 'Google Gemini 3.8 Flash', model: 'gemini-3.8-flash' },
    openai: { label: 'OpenAI GPT-5', model: 'gpt-5' },
    claude: { label: 'Anthropic Claude', model: 'claude-sonnet-4-5' },
    deepseek: { label: 'DeepSeek Flash', model: 'deepseek-flash' }
  };

  function getGateway() {
    if (!window.NexusAIGatewayInstance) throw new Error('Nexus AI Gateway non chargé.');
    return window.NexusAIGatewayInstance;
  }

  async function generateWithEngine(engineKey, prompt) {
    const engine = ENGINE_CONFIG[engineKey] || ENGINE_CONFIG.gemini;
    const result = await getGateway().generate({
      provider: engineKey,
      model: engine.model,
      prompt,
      responseFormat: 'text',
      maxTokens: 6000,
      webSearch: Boolean(document.getElementById('web-search-toggle')?.checked)
    });
    return result.text;
  }

  function initNexusApp() {
    console.info('⚡ NexusEdit Studio X - AI sécurisé initialisé.');
    const gateway = window.NexusAIGatewayInstance;
    const input = document.getElementById('ai-api-key');
    if (input) {
      input.type = 'url';
      input.id = 'nexus-gateway-url';
      input.placeholder = 'URL Gateway (ex: https://ton-projet.vercel.app/api/nexus-ai)';
      input.value = window.NEXUS_CONFIG?.gatewayUrl || '';
      input.previousElementSibling && (input.previousElementSibling.textContent = 'URL du Gateway Nexus AI :');
      input.addEventListener('change', () => {
        const url = input.value.trim();
        if (url) gateway.setEndpoint(url);
      });
    }
  }

  window.NexusStudio = {
    init: initNexusApp,
    replay: initNexusApp,
    generate: generateWithEngine,
    engines: ENGINE_CONFIG
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNexusApp);
  else initNexusApp();
})();
