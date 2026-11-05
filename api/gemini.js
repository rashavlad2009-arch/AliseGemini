import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Функция для повтора запроса при временной ошибке серверов Google
async function generateWithRetry(params, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error) {
      // Если это ошибка 503 (перегрузка) и попытки еще остались — ждем и повторяем
      if (error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('overloaded')) {
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error;
    }
  }
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

    // Вызываем генерацию с автоповтором
    const response = await generateWithRetry({
      model: 'gemini-3.8-flash',
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
    const errMessage = error?.message || "Неизвестная ошибка сервера";
    
    if (errMessage.includes('503') || errMessage.includes('overloaded')) {
      return res.status(503).json({ error: "Сервера Google перегружены. Попробуйте отправить сообщение еще раз через пару секунд." });
    }

    return res.status(500).json({ error: errMessage });
  }
}
