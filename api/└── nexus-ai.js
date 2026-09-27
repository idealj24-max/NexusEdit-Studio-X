/**
 * NEXUSEDIT-STUDIO-X - Nexus AI Gateway Server v1.1
 * Vercel-compatible serverless function.
 * Secrets are read only from environment variables.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET' && String(req.query?.health || '') === '1') {
    return res.status(200).json({ ok: true, service: 'nexus-ai-gateway', version: '1.1.0', timestamp: Date.now() });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });

  const started = Date.now();
  try {
    const body = req.body || {};
    const {
      provider = 'gemini', model, prompt = '', system = '', task = null,
      agent = null, context = {}, responseFormat = 'text', temperature = 0.7,
      maxTokens = 6000, webSearch = false, history = []
    } = body;

    if (!String(prompt).trim()) return res.status(400).json({ error: 'Prompt manquant.' });

    const shared = { model, prompt: String(prompt), system: String(system || ''), responseFormat, temperature, maxTokens, webSearch, history };
    let result;
    if (provider === 'gemini') result = await callGemini(shared);
    else if (provider === 'openai') result = await callOpenAI(shared);
    else if (provider === 'claude') result = await callClaude(shared);
    else if (provider === 'deepseek') result = await callDeepSeek(shared);
    else return res.status(400).json({ error: `Provider inconnu : ${provider}` });

    return res.status(200).json({
      success: true,
      provider,
      model: result.model || model || null,
      text: result.text || '',
      data: result.data || null,
      usage: result.usage || null,
      grounding: result.grounding || null,
      task,
      agent,
      context,
      requestId: `nexus_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      latencyMs: Date.now() - started
    });
  } catch (error) {
    console.error('[Nexus AI Gateway]', error);
    const status = Number(error?.status) || 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      error: error?.message || 'Erreur interne Nexus AI Gateway.'
    });
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} non configurée.`);
  return value;
}

async function parseResponse(response, label) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.error || `${label} HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function callGemini({ model, prompt, system, responseFormat, maxTokens, webSearch, history }) {
  const apiKey = requireEnv('GEMINI_API_KEY');
  const selectedModel = model || 'gemini-3.8-flash';
  const contents = [];

  for (const item of Array.isArray(history) ? history.slice(-10) : []) {
    if (!item?.text) continue;
    contents.push({ role: item.role === 'ai' ? 'model' : 'user', parts: [{ text: String(item.text) }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  const body = {
    contents,
    generationConfig: { maxOutputTokens: Math.min(Number(maxTokens) || 6000, 65536) }
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (responseFormat === 'json') body.generationConfig.responseMimeType = 'application/json';
  if (webSearch) body.tools = [{ google_search: {} }];

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body)
  });
  const data = await parseResponse(response, 'Gemini');
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  return { model: data?.modelVersion || selectedModel, text, data, usage: data?.usageMetadata || null, grounding: data?.candidates?.[0]?.groundingMetadata || null };
}

async function callOpenAI({ model, prompt, system, responseFormat, maxTokens }) {
  const apiKey = requireEnv('OPENAI_API_KEY');
  const selectedModel = model || 'gpt-5';
  const input = [];
  if (system) input.push({ role: 'developer', content: system });
  input.push({ role: 'user', content: prompt });
  const body = { model: selectedModel, input, max_output_tokens: Number(maxTokens) || 6000 };
  if (responseFormat === 'json') body.text = { format: { type: 'json_object' } };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body)
  });
  const data = await parseResponse(response, 'OpenAI');
  return { model: data?.model || selectedModel, text: data?.output_text || '', data, usage: data?.usage || null };
}

async function callClaude({ model, prompt, system, maxTokens }) {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const selectedModel = model || 'claude-sonnet-4-5';
  const body = { model: selectedModel, max_tokens: Number(maxTokens) || 6000, messages: [{ role: 'user', content: prompt }] };
  if (system) body.system = system;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  const data = await parseResponse(response, 'Claude');
  const text = data?.content?.filter(x => x.type === 'text').map(x => x.text).join('') || '';
  return { model: data?.model || selectedModel, text, data, usage: data?.usage || null };
}

async function callDeepSeek({ model, prompt, system, responseFormat, maxTokens }) {
  const apiKey = requireEnv('DEEPSEEK_API_KEY');
  const selectedModel = model || 'deepseek-flash';
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  const body = { model: selectedModel, messages, max_tokens: Number(maxTokens) || 6000 };
  if (responseFormat === 'json') body.response_format = { type: 'json_object' };
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body)
  });
  const data = await parseResponse(response, 'DeepSeek');
  return { model: data?.model || selectedModel, text: data?.choices?.[0]?.message?.content || '', data, usage: data?.usage || null };
}
