export default async function handler(req, res) {
  // Настройка CORS для веб-интерфейса
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    let body = {};
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    } catch (e) {
      body = {};
    }

    const prompt = body.prompt || body.message || body.text || body.query || "";
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Пустой текстовый запрос" });
    }

    // Берем ключ из любой заданной переменной окружения в Vercel
    const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Не найден API-ключ в переменных окружения Vercel" });
    }

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: "grok-2-latest", // можно также использовать "grok-3-mini-fast" или "grok-beta"
        messages: [
          {
            role: "system",
            content: "Ты умный и полезный ИИ-ассистент. Отвечай понятно, структурированно и на русском языке."
          },
          {
            role: "user",
            content: prompt.trim()
          }
        ],
        temperature: 0.7,
        stream: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || data?.error || `Ошибка Grok API: статус ${response.status}`;
      return res.status(response.status).json({ error: errMsg });
    }

    const answer = data?.choices?.[0]?.message?.content || "Нейросеть вернула пустой ответ.";

    // Отдаем ответ во всех полях, которые может ожидать фронтенд
    return res.status(200).json({
      reply: answer,
      text: answer,
      response: answer,
      answer: answer,
      message: answer
    });

  } catch (error) {
    console.error("Grok API Error:", error);
    return res.status(500).json({
      error: "Сбой соединения с сервером Grok: " + (error?.message || "Неизвестная ошибка")
    });
  }
}
