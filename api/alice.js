import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  // Алиса всегда отправляет POST-запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { request, version } = req.body;
    // Извлекаем команду пользователя. Если ее нет (запуск навыка), ставим пустую строку.
    const prompt = request?.command || request?.original_utterance || '';

    // Если пользователь только открыл навык и еще ничего не спросил
    if (!prompt) {
      return res.status(200).json({
        response: {
          text: 'Привет! Я на связи с нейросетью Gemini. Что вы хотите узнать?',
          end_session: false
        },
        version: version || '1.0'
      });
    }

    // Отправляем запрос пользователя в Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    // Возвращаем ответ в строгом формате Яндекс Диалогов
    return res.status(200).json({
      response: {
        text: response.text,
        end_session: false
      },
      version: version || '1.0'
    });
  } catch (error) {
    // В случае ошибки возвращаем статус 200, чтобы Алиса смогла озвучить текст ошибки
    return res.status(200).json({
      response: {
        text: 'Произошла ошибка при обращении к нейросети.',
        end_session: false
      },
      version: '1.0'
    });
  }
}
