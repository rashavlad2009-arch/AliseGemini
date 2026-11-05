function cleanTextForAlice(text) {
  return text
    .replace(/[*#_`~>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // убирает markdown-ссылки
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch (e) {
    body = {};
  }

  const { request, session, version = "1.0" } = body;
  const command = request?.command?.trim() || "";
  const originalUtterance = request?.original_utterance?.trim() || command;

  // Техническая проверка навыка Яндексом
  if (command.toLowerCase() === "ping") {
    return res.status(200).json({
      version,
      session,
      response: { text: "pong", end_session: false }
    });
  }

  // Приветствие при запуске навыка
  if (session?.new && !originalUtterance) {
    return res.status(200).json({
      version,
      session,
      response: {
        text: "Привет! Я подключена к нейросети Grok. О чём хотите спросить?",
        tts: "Привет! Я подключена к нейросети Грок. О чём хотите спросить?",
        end_session: false
      }
    });
  }

  // Команда выхода
  if (["хватит", "стоп", "выход", "закончить", "пока"].includes(command.toLowerCase())) {
    return res.status(200).json({
      version,
      session,
      response: { text: "До встречи! Обращайтесь ещё.", end_session: true }
    });
  }

  // Подхватывает ключ из любой из этих переменных в Vercel
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      version,
      session,
      response: {
        text: "Не найден ключ API в настройках Vercel.",
        end_session: false
      }
    });
  }

  // Таймаут 3.8 секунды, чтобы Алиса не оборвала соединение сама
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3800);

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "grok-2-latest", // при необходимости можно заменить на "grok-3-mini-fast" или "grok-beta"
        messages: [
          {
            role: "system",
            content: "Ты голосовой помощник внутри Яндекс Алисы. Отвечай кратко, по делу, на русском языке, максимум 2-3 предложения. Не используй списки, жирный шрифт и спецсимволы — только чистый текст для озвучки голосом."
          },
          {
            role: "user",
            content: originalUtterance
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
        stream: false
      })
    });

    clearTimeout(timeout);
    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || data?.error || `Код ошибки ${response.status}`;
      return res.status(200).json({
        version,
        session,
        response: {
          text: cleanTextForAlice(`Ошибка Grok API: ${errMsg}`),
          end_session: false
        }
      });
    }

    const rawAnswer = data?.choices?.[0]?.message?.content || "Не удалось сформулировать ответ.";
    const cleanAnswer = cleanTextForAlice(rawAnswer);

    return res.status(200).json({
      version,
      session,
      response: {
        text: cleanAnswer,
        tts: cleanAnswer,
        end_session: false
      }
    });
  } catch (error) {
    clearTimeout(timeout);
    const isTimeout = error.name === "AbortError";
    return res.status(200).json({
      version,
      session,
      response: {
        text: isTimeout
          ? "Нейросеть задумалась слишком надолго. Попробуйте спросить короче."
          : "Произошла ошибка соединения с сервером Grok.",
        end_session: false
      }
    });
  }
}
