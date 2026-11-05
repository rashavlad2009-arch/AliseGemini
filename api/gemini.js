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

    // Используем проверенную временем модель
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `Ошибка Google API, код: ${response.status}`);
    }

    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "Пустой ответ";

    return res.status(200).json({
      reply: answer,
      text: answer,
      response: answer,
      answer: answer,
      message: answer
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Внутренняя ошибка сервера"
    });
  }
}
