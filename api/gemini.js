let cachedGroqModel = null;

async function getWorkingGroqModel(apiKey) {
  if (cachedGroqModel) return cachedGroqModel;

  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { "Authorization": `Bearer ${apiKey}` }
  });
  const data = await res.json();

  if (!res.ok || !Array.isArray(data.data)) {
    throw new Error(data?.error?.message || "Не удалось получить список моделей Groq");
  }

  // Отбираем только текстовые чат-модели (исключаем аудио whisper, tts и guard-модели)
  const chatModels = data.data
    .map(m => m.id)
    .filter(id =>
      !id.includes("whisper") &&
      !id.includes("guard") &&
      !id.includes("tts") &&
      !id.includes("playai") &&
      !id.includes("embed")
    );

  // Приоритет: сначала мощные Llama / Qwen / DeepSeek / Gemma, иначе любая доступная
  const preferred = chatModels.find(id =>
    id.includes("llama-3") ||
    id.includes("llama-4") ||
    id.includes("qwen") ||
    id.includes("deepseek") ||
    id.includes("gemma")
  );

  cachedGroqModel = preferred || chatModels[0];
  return cachedGroqModel;
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

  const rawKey =
    process.env.GROQ_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.API_KEY ||
    "";

  const apiKey = rawKey.trim().replace(/^["']|["']$/g, "");

  if (!apiKey) {
    return res.status(500).json({ error: "Не найден API-ключ в переменных окружения Vercel" });
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

    const model = await getWorkingGroqModel(apiKey);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Ты — умный, точный и полезный ИИ-ассистент. Всегда отвечай на русском языке."
          },
          { role: "user", content: prompt.trim() }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      cachedGroqModel = null; // сбрасываем кэш, если модель вдруг отключили
      const errorMsg = data?.error?.message || `Ошибка Groq API (код ${response.status})`;
      return res.status(500).json({ error: errorMsg });
    }

    // Убираем блок размышлений <think>...</think>, если выбралась reasoning-модель
    const rawAnswer = data.choices?.[0]?.message?.content || "";
    const answer = rawAnswer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim() || "Пустой ответ от нейросети";

    return res.status(200).json({
      reply: answer,
      text: answer,
      response: answer,
      answer: answer,
      message: answer,
      modelUsed: model,
      candidates: [{ content: { parts: [{ text: answer }] } }]
    });
  } catch (error) {
    return res.status(500).json({
      error: "Ошибка сервера: " + (error.message || "Неизвестный сбой")
    });
  }
}
