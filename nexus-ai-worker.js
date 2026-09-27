/**
 * NEXUSEDIT-STUDIO-X
 * NEXUS AI MEGA-MIND - Cloudflare Worker
 * Version 1.0.0
 *
 * API Gateway sécurisé :
 * GitHub Pages -> Worker -> AI Provider
 *
 * IMPORTANT :
 * GEMINI_API_KEY doit être configurée comme SECRET
 * dans Cloudflare Workers.
 */

const VERSION = "1.0.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --------------------------------------------------
    // CORS
    // --------------------------------------------------

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // --------------------------------------------------
    // HEALTH CHECK
    // --------------------------------------------------

    if (
      request.method === "GET" &&
      url.searchParams.get("health") === "1"
    ) {
      return json({
        ok: true,
        service: "nexus-ai-gateway",
        runtime: "cloudflare-workers",
        version: VERSION,
        timestamp: Date.now()
      });
    }

    // --------------------------------------------------
    // API
    // --------------------------------------------------

    if (request.method !== "POST") {
      return json(
        {
          success: false,
          error: "Méthode non autorisée."
        },
        405
      );
    }

    const started = Date.now();

    try {
      const body = await request.json();

      const {
        provider = "gemini",
        model = null,
        prompt = "",
        system = "",
        task = null,
        agent = null,
        context = {},
        responseFormat = "text",
        temperature = 0.7,
        maxTokens = 6000,
        webSearch = false,
        history = []
      } = body || {};

      if (!String(prompt).trim()) {
        return json(
          {
            success: false,
            error: "Prompt manquant."
          },
          400
        );
      }

      const shared = {
        model,
        prompt: String(prompt),
        system: String(system || ""),
        responseFormat,
        temperature,
        maxTokens,
        webSearch,
        history
      };

      let result;

      switch (String(provider).toLowerCase()) {
        case "gemini":
          result = await callGemini(shared, env);
          break;

        case "openai":
          result = await callOpenAI(shared, env);
          break;

        case "claude":
          result = await callClaude(shared, env);
          break;

        case "deepseek":
          result = await callDeepSeek(shared, env);
          break;

        default:
          return json(
            {
              success: false,
              error: `Provider inconnu : ${provider}`
            },
            400
          );
      }

      return json({
        success: true,
        provider,
        model: result.model || model || null,
        text: result.text || "",
        data: result.data || null,
        usage: result.usage || null,
        grounding: result.grounding || null,

        task,
        agent,
        context,

        requestId:
          `nexus_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`,

        latencyMs: Date.now() - started
      });

    } catch (error) {
      console.error("[Nexus AI Worker]", error);

      return json(
        {
          success: false,
          error:
            error?.message ||
            "Erreur interne Nexus AI Worker."
        },
        Number(error?.status) || 500
      );
    }
  }
};


// ======================================================
// JSON RESPONSE
// ======================================================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}


// ======================================================
// ENVIRONMENT
// ======================================================

function requireEnv(env, name) {
  const value = env?.[name];

  if (!value) {
    const error = new Error(
      `${name} non configurée dans Cloudflare.`
    );

    error.status = 500;

    throw error;
  }

  return value;
}


// ======================================================
// RESPONSE PARSER
// ======================================================

async function parseResponse(response, label) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.error ||
      `${label} HTTP ${response.status}`;

    const error = new Error(String(message));

    error.status = response.status;

    throw error;
  }

  return data;
}


// ======================================================
// GEMINI
// ======================================================

async function callGemini(
  {
    model,
    prompt,
    system,
    responseFormat,
    temperature,
    maxTokens,
    webSearch,
    history
  },
  env
) {
  const apiKey = requireEnv(env, "GEMINI_API_KEY");

  const selectedModel =
    model || "gemini-3.8-flash";

  const contents = [];

  for (
    const item of Array.isArray(history)
      ? history.slice(-10)
      : []
  ) {
    if (!item?.text) continue;

    contents.push({
      role:
        item.role === "ai"
          ? "model"
          : "user",

      parts: [
        {
          text: String(item.text)
        }
      ]
    });
  }

  contents.push({
    role: "user",

    parts: [
      {
        text: prompt
      }
    ]
  });

  const generationConfig = {
    maxOutputTokens: Math.min(
      Number(maxTokens) || 6000,
      65536
    ),
    temperature:
      Number(temperature) || 0.7
  };

  if (responseFormat === "json") {
    generationConfig.responseMimeType =
      "application/json";
  }

  const body = {
    contents,
    generationConfig
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

  if (webSearch) {
    body.tools = [
      {
        google_search: {}
      }
    ];
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      selectedModel
    )}:generateContent`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },

      body: JSON.stringify(body)
    }
  );

  const data = await parseResponse(
    response,
    "Gemini"
  );

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || "";

  return {
    model:
      data?.modelVersion ||
      selectedModel,

    text,

    data,

    usage:
      data?.usageMetadata || null,

    grounding:
      data?.candidates?.[0]
        ?.groundingMetadata || null
  };
}


// ======================================================
// OPENAI
// ======================================================

async function callOpenAI(
  {
    model,
    prompt,
    system,
    responseFormat,
    maxTokens
  },
  env
) {
  const apiKey =
    requireEnv(env, "OPENAI_API_KEY");

  const selectedModel =
    model || "gpt-5";

  const input = [];

  if (system) {
    input.push({
      role: "developer",
      content: system
    });
  }

  input.push({
    role: "user",
    content: prompt
  });

  const body = {
    model: selectedModel,
    input,
    max_output_tokens:
      Number(maxTokens) || 6000
  };

  if (responseFormat === "json") {
    body.text = {
      format: {
        type: "json_object"
      }
    };
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization:
          `Bearer ${apiKey}`
      },

      body: JSON.stringify(body)
    }
  );

  const data = await parseResponse(
    response,
    "OpenAI"
  );

  return {
    model:
      data?.model ||
      selectedModel,

    text:
      data?.output_text || "",

    data,

    usage:
      data?.usage || null
  };
}


// ======================================================
// CLAUDE
// ======================================================

async function callClaude(
  {
    model,
    prompt,
    system,
    maxTokens
  },
  env
) {
  const apiKey =
    requireEnv(env, "ANTHROPIC_API_KEY");

  const selectedModel =
    model || "claude-sonnet-4-5";

  const body = {
    model: selectedModel,

    max_tokens:
      Number(maxTokens) || 6000,

    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  };

  if (system) {
    body.system = system;
  }

  const response = await fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        "x-api-key": apiKey,

        "anthropic-version":
          "2023-06-01"
      },

      body: JSON.stringify(body)
    }
  );

  const data = await parseResponse(
    response,
    "Claude"
  );

  const text =
    data?.content
      ?.filter(
        (item) => item.type === "text"
      )
      ?.map(
        (item) => item.text
      )
      ?.join("") || "";

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


// ======================================================
// DEEPSEEK
// ======================================================

async function callDeepSeek(
  {
    model,
    prompt,
    system,
    responseFormat,
    maxTokens
  },
  env
) {
  const apiKey =
    requireEnv(env, "DEEPSEEK_API_KEY");

  const selectedModel =
    model || "deepseek-flash";

  const messages = [];

  if (system) {
    messages.push({
      role: "system",
      content: system
    });
  }

  messages.push({
    role: "user",
    content: prompt
  });

  const body = {
    model: selectedModel,

    messages,

    max_tokens:
      Number(maxTokens) || 6000
  };

  if (responseFormat === "json") {
    body.response_format = {
      type: "json_object"
    };
  }

  const response = await fetch(
    "https://api.deepseek.com/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization:
          `Bearer ${apiKey}`
      },

      body: JSON.stringify(body)
    }
  );

  const data = await parseResponse(
    response,
    "DeepSeek"
  );

  return {
    model:
      data?.model ||
      selectedModel,

    text:
      data?.choices?.[0]
        ?.message?.content || "",

    data,

    usage:
      data?.usage || null
  };
}
