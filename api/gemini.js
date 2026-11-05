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
    process.env.XAI_API_KEY ||
    process.env.GROK_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    "";

  // Убираем случайные пробелы и кавычки при копировании ключа
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

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "grok-2-latest",
        messages: [
          { role: "system", content: "Ты — умный и полезный ИИ-ассистент. Отвечай на русском языке." },
          { role: "user", content: prompt.trim() }
        ],
        stream: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || data?.error || `Ошибка xAI API, код: ${response.status}`;
      return res.status(500).json({ error: errorMsg });
    }

    const answer = data.choices?.[0]?.message?.content || "Пустой ответ от Grok";

    return res.status(200).json({
      reply: answer,
      text: answer,
      response: answer,
      answer: answer,
      message: answer
    });
  } catch (error) {
    return res.status(500).json({
      error: "Ошибка сервера: " + (error.message || "Неизвестный сбой")
    });
  }
}
