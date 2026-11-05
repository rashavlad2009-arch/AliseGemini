let cachedModel = null;

const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash"
];

async function callGeminiModel(modelName, prompt, apiKey, signal) {
  const cleanModel = modelName.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Отвечай кратко, по делу, на русском языке, без списков и спецсимволов (до 3-4 предложений). Вопрос: ${prompt}`
            }
          ]
        }
      ]
    })
  });

  const data = await response.json();
  return { status: response.status, ok: response.ok, data };
}

async function askGeminiForAlice(prompt, apiKey, signal) {
  const queue = cachedModel
    ? [cachedModel, ...FALLBACK_MODELS.filter(m => m !== cachedModel)]
    : [...FALLBACK_MODELS];

  const tried = new Set();

  while (queue.length > 0) {
    const model = queue.shift().replace(/^models\//, "");
    if (tried.has(model)) continue;
    tried.add(model);

    const { status, ok, data } = await callGeminiModel(model, prompt, apiKey, signal);

    if (ok) {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        cachedModel = model;
        return text;
      }
    }

    const errMsg = data?.error?.message || "";
    const suggestedMatch = errMsg.match(/models\/([a-zA-Z0-9._-]+)/);
    if (suggestedMatch && suggestedMatch[1] && !tried.has(suggestedMatch[1])) {
      queue.unshift(suggestedMatch[1]);
      continue;
    }

    if (status === 404 || status === 503 || status === 429 || status === 400) {
      continue;
    }
  }

  const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { signal });
  const listData = await listRes.json();

  if (listRes.ok && Array.isArray(listData.models)) {
    const dynamicModels = listData.models
      .filter(m =>
        m.supportedGenerationMethods?.includes("generateContent") &&
        m.name.includes("gemini") &&
        !m.name.includes("embedding") &&
        !m.name.includes("imagen") &&
        !m.name.includes("tts")
      )
      .map(m => m.name.replace(/^models\//, ""))
      .filter(m => !tried.has(m))
      .sort((a, b) => (b.includes("flash") ? 1 : 0) - (a.includes("flash") ? 1 : 0));

    for (const model of dynamicModels) {
      const { ok, data } = await callGeminiModel(model, prompt, apiKey, signal);
      if (ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          cachedModel = model;
          return text;
        }
      }
    }
  }

  return "Серверы нейросети сейчас перегружены. Повторите вопрос через пару секунд.";
}

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
        text: "Привет! Я подключена к Gemini. О чём хотите спросить?",
        tts: "Привет! Я подключена к Джем+ини. О чём хотите спросить?",
        end_session: false
      }
    });
  }

  // Команда выхода
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

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY;

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
    const rawAnswer = await askGeminiForAlice(originalUtterance, apiKey, controller.signal);
    clearTimeout(timeout);

    const cleanAnswer = cleanTextForAlice(rawAnswer) || "Не удалось сформулировать ответ.";

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
          : "Произошла ошибка при обращении к нейросети. Попробуйте ещё раз.",
        end_session: false
      }
    });
  }
}
