/**
 * NexusEdit Studio X - configuration publique du frontend.
 * AUCUNE clé secrète ici.
 */
window.NEXUS_CONFIG = Object.assign({
  gatewayUrl: '', // ex: https://ton-projet.vercel.app/api/nexus-ai
  requestTimeout: 180000,
  defaultProvider: 'gemini',
  defaultModel: 'gemini-3.8-flash'
}, window.NEXUS_CONFIG || {});
