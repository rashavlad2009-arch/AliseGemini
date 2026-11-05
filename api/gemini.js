let cachedModel = null;

const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash"
];

async function callGeminiModel(modelName, prompt, apiKey) {
  const cleanModel = modelName.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await response.json();
  return { status: response.status, ok: response.ok, data, model: cleanModel };
}

async function askGemini(prompt, apiKey) {
  const queue = cachedModel
    ? [cachedModel, ...FALLBACK_MODELS.filter(m => m !== cachedModel)]
    : [...FALLBACK_MODELS];

  const tried = new Set();

  while (queue.length > 0) {
    const model = queue.shift().replace(/^models\//, "");
    if (tried.has(model)) continue;
    tried.add(model);

    const { status, ok, data } = await callGeminiModel(model, prompt, apiKey);

    if (ok) {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        cachedModel = model;
        return text;
      }
    }

    // Если Google в тексте ошибки 404 прямо указывает, какую новую модель использовать, ставим её первой в очередь
    const errMsg = data?.error?.message || "";
    const suggestedMatch = errMsg.match(/models\/([a-zA-Z0-9._-]+)/);
    if (suggestedMatch && suggestedMatch[1] && !tried.has(suggestedMatch[1])) {
      queue.unshift(suggestedMatch[1]);
      continue;
    }

    if (status === 404 || status === 503 || status === 429 || status === 400) {
      continue;
    }

    throw new Error(errMsg || `Ошибка API (код ${status})`);
  }

  // Если ни одна модель из списка не подошла, запрашиваем список доступных моделей у самого ключа
  const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const listData = await listRes.json();

  if (listRes.ok && Array.isArray(listData.models)) {
    const dynamicModels = listData.models
      .filter(m =>
        m.supportedGenerationMethods?.includes("generateContent") &&
        m.name.includes("gemini") &&
        !m.name.includes("embedding") &&
        !m.name.includes("imagen") &&
        !m.name.includes("tts")
      )
      .map(m => m.name.replace(/^models\//, ""))
      .filter(m => !tried.has(m))
      .sort((a, b) => (b.includes("flash") ? 1 : 0) - (a.includes("flash") ? 1 : 0));

    for (const model of dynamicModels) {
      const { ok, data } = await callGeminiModel(model, prompt, apiKey);
      if (ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          cachedModel = model;
          return text;
        }
      }
    }
  }

  throw new Error("Все модели Gemini сейчас недоступны или перегружены. Попробуйте через минуту.");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Не задан GEMINI_API_KEY в настройках Vercel" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const prompt =
      body.prompt ||
      body.message ||
      body.text ||
      body.query ||
      body.contents?.[0]?.parts?.[0]?.text ||
      "";

    if (!prompt.trim()) {
      return res.status(400).json({ error: "Пустой запрос" });
    }

    const answer = await askGemini(prompt, apiKey);

    return res.status(200).json({
      reply: answer,
      text: answer,
      response: answer,
      answer: answer,
      message: answer,
      candidates: [{ content: { parts: [{ text: answer }] } }]
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Внутренняя ошибка сервера"
    });
  }
}
