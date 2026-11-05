function cleanTextForAlice(text) {
  return text
    .replace(/[*#_`~>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { request, session, version = "1.0" } = body;

  const command = request?.command?.trim() || "";
  const originalUtterance = request?.original_utterance?.trim() || command;

  if (command.toLowerCase() === "ping") {
    return res.status(200).json({
      version,
      session,
      response: { text: "pong", end_session: false }
    });
  }

  if (session?.new && !originalUtterance) {
    return res.status(200).json({
      version,
      session,
      response: {
        text: "Привет! Я подключена к нейросети Grok. О чём хотите спросить?",
        end_session: false
      }
    });
  }

  if (["хватит", "стоп", "выход", "закончить"].includes(command.toLowerCase())) {
    return res.status(200).json({
      version,
      session,
      response: {
        text: "До встречи! Обращайтесь ещё.",
        end_session: true
      }
    });
  }

  const rawKey =
    process.env.XAI_API_KEY ||
    process.env.GROK_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    "";

  const apiKey = rawKey.trim().replace(/^["']|["']$/g, "");

  if (!apiKey) {
    return res.status(200).json({
      version,
      session,
      response: {
        text: "Не настроен ключ API в переменных окружения Vercel.",
        end_session: false
      }
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3800);

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "grok-2-latest",
        messages: [
          {
            role: "system",
            content: "Отвечай кратко, по делу, на русском языке, без списков и спецсимволов, максимум 3 предложения."
          },
          { role: "user", content: originalUtterance }
        ],
        stream: false
      })
    });

    clearTimeout(timeout);
    const data = await response.json();

    if (!response.ok) {
      return res.status(200).json({
        version,
        session,
        response: {
          text: "Ошибка ключа или лимита xAI. Проверьте настройки в Vercel.",
          end_session: false
        }
      });
    }

    const rawAnswer = data.choices?.[0]?.message?.content || "";
    const cleanAnswer = cleanTextForAlice(rawAnswer) || "Не удалось получить ответ.";

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
    return res.status(200).json({
      version,
      session,
      response: {
        text: "Нейросеть задумалась слишком надолго. Попробуйте спросить короче.",
        end_session: false
      }
    });
  }
}
