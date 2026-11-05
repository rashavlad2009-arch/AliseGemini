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
    // Получаем ключ API
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY; 
    if (!apiKey) {
      return res.status(500).json({ error: "Не найден API-ключ в переменных окружения Vercel (GEMINI_API_KEY)" });
    } 

    // Парсим тело запроса
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

    // Делаем прямой запрос к стабильной эндпоинт-модели Google
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`; 
    const apiResponse = await fetch(url, {
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt.trim() }] }] 
      }) 
    }); 

    const data = await apiResponse.json(); 
    if (!apiResponse.ok) {
      const errorMsg = data?.error?.message || `Ошибка Google API, код статуса: ${apiResponse.status}`; 
      return res.status(500).json({ error: errorMsg }); 
    } 

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Нейросеть вернула пустой ответ."; 

    // Возвращаем ответ во всех возможных форматах для фронтенда
    return res.status(200).json({
      reply: answer, 
      text: answer, 
      response: answer, 
      answer: answer, 
      message: answer 
    }); 

  } catch (err) {
    return res.status(500).json({ error: "Сбой сервера Vercel: " + (err.message || "Неизвестная ошибка") }); 
  }
}
