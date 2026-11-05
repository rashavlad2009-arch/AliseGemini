import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  // Алиса всегда отправляет POST-запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { request, version } = req.body || {};

  try {
    // Извлекаем команду пользователя
    const prompt = request?.command || request?.original_utterance || '';

    // Если пользователь только запустил навык
    if (!prompt) {
      return res.status(200).json({
        response: {
          text: 'Привет! Я на связи с нейросетью Gemini. Что вы хотите узнать?',
          end_session: false
        },
        version: version || '1.0'
      });
    }

    // Команда выхода из навыка
    if (/^(выход|стоп|хватит|пока)$/i.test(prompt.trim())) {
      return res.status(200).json({
        response: {
          text: 'До встречи! Обращайтесь еще.',
          end_session: true
        },
        version: version || '1.0'
      });
    }

    // Отправляем запрос в актуальную быструю модель
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Ты голосовой помощник внутри Яндекс Алисы. Отвечай кратко, по делу, максимум в 2-3 предложениях. Не используй Markdown-разметку, списки и спецсимволы — только чистый текст для озвучки.',
        maxOutputTokens: 250,
        temperature: 0.7,
      }
    });

    // Очищаем текст от случайных символов разметки и обрезаем под лимит Алисы (1024 символа)
    const cleanText = (response.text || 'Не удалось получить ответ.')
      .replace(/[*#_~`>]/g, '')
      .slice(0, 1000);

    return res.status(200).json({
      response: {
        text: cleanText,
        end_session: false
      },
      version: version || '1.0'
    });

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(200).json({
      response: {
        text: 'Произошла ошибка при обращении к нейросети. Попробуйте спросить еще раз.',
        end_session: false
      },
      version: version || '1.0'
    });
  }
}
