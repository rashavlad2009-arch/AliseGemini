async function askGemini(prompt, apiKey) {
  // Используем напрямую одну самую быструю и актуальную модель без лишних проверок
  const model = "gemini-2.5-flash"; 
  const cleanModel = model.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Ошибка API (код ${response.status})`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Пустой ответ от нейросети");
  }

  return text;
}
