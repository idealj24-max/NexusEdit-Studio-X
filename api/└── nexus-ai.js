/**
 * NEXUSEDIT-STUDIO-X
 * NEXUS AI GATEWAY - SERVER
 *
 * Backend sécurisé.
 *
 * Les clés API doivent être fournies
 * par les variables d'environnement.
 */

export default async function handler(req, res) {

  // --------------------------------------------------
  // CORS
  // --------------------------------------------------

  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Méthode non autorisée.'
    });
  }

  try {

    const {
      provider = 'gemini',
      model,
      prompt = '',
      system = '',
      task = null,
      agent = null,
      context = {},
      responseFormat = 'text',
      temperature = 0.7,
      maxTokens = 4000
    } = req.body || {};

    if (!prompt) {
      return res.status(400).json({
        error: 'Prompt manquant.'
      });
    }

    let result;

    switch (provider) {

      case 'gemini':

        result = await callGemini({
          model,
          prompt,
          system,
          responseFormat,
          temperature,
          maxTokens
        });

        break;

      case 'openai':

        result = await callOpenAI({
          model,
          prompt,
          system,
          responseFormat,
          temperature,
          maxTokens
        });

        break;

      case 'claude':

        result = await callClaude({
          model,
          prompt,
          system,
          maxTokens
        });

        break;

      case 'deepseek':

        result = await callDeepSeek({
          model,
          prompt,
          system,
          responseFormat,
          temperature,
          maxTokens
        });

        break;

      default:

        return res.status(400).json({
          error: `Provider inconnu : ${provider}`
        });
    }

    return res.status(200).json({

      success: true,

      provider,

      model:
        result.model || model || null,

      text:
        result.text || '',

      data:
        result.data || null,

      usage:
        result.usage || null,

      task,

      agent,

      context

    });

  } catch (error) {

    console.error(
      '[Nexus AI Gateway]',
      error
    );

    return res.status(500).json({

      success: false,

      error:
        error?.message ||
        'Erreur interne Nexus AI Gateway.'

    });
  }
}


// ==================================================
// GEMINI
// ==================================================

async function callGemini({
  model,
  prompt,
  system,
  responseFormat,
  temperature,
  maxTokens
}) {

  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY non configurée.'
    );
  }

  const selectedModel =
    model || 'gemini-3.8-flash';

  const body = {

    contents: [
      {
        role: 'user',
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],

    generationConfig: {

      temperature,

      maxOutputTokens:
        maxTokens

    }

  };

  if (system) {

    body.systemInstruction = {
      parts: [
        {
          text: system
        }
      ]
    };

  }

  if (responseFormat === 'json') {

    body.generationConfig.responseMimeType =
      'application/json';

  }

  const response = await fetch(

    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,

    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json'
      },

      body: JSON.stringify(body)

    }

  );

  const data =
    await response.json();

  if (!response.ok) {

    throw new Error(
      data?.error?.message ||
      `Gemini HTTP ${response.status}`
    );

  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('') || '';

  return {

    model:
      data?.modelVersion ||
      selectedModel,

    text,

    data,

    usage:
      data?.usageMetadata || null

  };
}


// ==================================================
// OPENAI
// ==================================================

async function callOpenAI({
  model,
  prompt,
  system,
  responseFormat,
  temperature,
  maxTokens
}) {

  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY non configurée.'
    );
  }

  const selectedModel =
    model || 'gpt-5';

  const input = [];

  if (system) {

    input.push({
      role: 'developer',
      content: system
    });

  }

  input.push({
    role: 'user',
    content: prompt
  });

  const body = {

    model: selectedModel,

    input,

    temperature,

    max_output_tokens:
      maxTokens

  };

  if (responseFormat === 'json') {

    body.text = {
      format: {
        type: 'json_object'
      }
    };

  }

  const response = await fetch(

    'https://api.openai.com/v1/responses',

    {
      method: 'POST',

      headers: {

        'Content-Type':
          'application/json',

        'Authorization':
          `Bearer ${apiKey}`

      },

      body: JSON.stringify(body)

    }

  );

  const data =
    await response.json();

  if (!response.ok) {

    throw new Error(
      data?.error?.message ||
      `OpenAI HTTP ${response.status}`
    );

  }

  return {

    model:
      data?.model ||
      selectedModel,

    text:
      data?.output_text ||
      '',

    data,

    usage:
      data?.usage || null

  };
}


// ==================================================
// CLAUDE
// ==================================================

async function callClaude({
  model,
  prompt,
  system,
  maxTokens
}) {

  const apiKey =
    process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {

    throw new Error(
      'ANTHROPIC_API_KEY non configurée.'
    );

  }

  const selectedModel =
    model ||
    'claude-sonnet-4-5';

  const body = {

    model:
      selectedModel,

    max_tokens:
      maxTokens,

    system:
      system || undefined,

    messages: [

      {
        role: 'user',
        content: prompt
      }

    ]

  };

  const response = await fetch(

    'https://api.anthropic.com/v1/messages',

    {
      method: 'POST',

      headers: {

        'Content-Type':
          'application/json',

        'x-api-key':
          apiKey,

        'anthropic-version':
          '2023-06-01'

      },

      body:
        JSON.stringify(body)

    }

  );

  const data =
    await response.json();

  if (!response.ok) {

    throw new Error(
      data?.error?.message ||
      `Claude HTTP ${response.status}`
    );

  }

  const text =
    data?.content
      ?.filter(item =>
        item.type === 'text'
      )
      ?.map(item =>
        item.text
      )
      ?.join('') || '';

  return {

    model:
      data?.model ||
      selectedModel,

    text,

    data,

    usage:
      data?.usage || null

  };
}


// ==================================================
// DEEPSEEK
// ==================================================

async function callDeepSeek({
  model,
  prompt,
  system,
  responseFormat,
  temperature,
  maxTokens
}) {

  const apiKey =
    process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {

    throw new Error(
      'DEEPSEEK_API_KEY non configurée.'
    );

  }

  const selectedModel =
    model ||
    'deepseek-flash';

  const messages = [];

  if (system) {

    messages.push({
      role: 'system',
      content: system
    });

  }

  messages.push({
    role: 'user',
    content: prompt
  });

  const body = {

    model:
      selectedModel,

    messages,

    temperature,

    max_tokens:
      maxTokens

  };

  if (responseFormat === 'json') {

    body.response_format = {
      type: 'json_object'
    };

  }

  const response = await fetch(

    'https://api.deepseek.com/chat/completions',

    {
      method: 'POST',

      headers: {

        'Content-Type':
          'application/json',

        'Authorization':
          `Bearer ${apiKey}`

      },

      body:
        JSON.stringify(body)

    }

  );

  const data =
    await response.json();

  if (!response.ok) {

    throw new Error(
      data?.error?.message ||
      `DeepSeek HTTP ${response.status}`
    );

  }

  return {

    model:
      data?.model ||
      selectedModel,

    text:
      data?.choices?.[0]?.message?.content ||
      '',

    data,

    usage:
      data?.usage || null

  };
}
