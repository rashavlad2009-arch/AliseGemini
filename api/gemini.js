import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  // Настройка CORS
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
      body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    } catch (e) {
      body = {};
    }

    const prompt = body.prompt || body.message || body.text || body.query || "";
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Пустой текстовый запрос" });
    }

    // Запрос через официальную библиотеку с актуальной моделью
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const answer = response.text || "Нейросеть вернула пустой ответ.";

    return res.status(200).json({
      reply: answer,
      text: answer,
      response: answer,
      answer: answer,
      message: answer
    });

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: error.message || "Неизвестная ошибка сервера" });
  }
}
