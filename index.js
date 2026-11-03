const chatBox = document.getElementById('chatBox');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

function appendMessage(text, sender) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', sender);
  messageElement.textContent = text;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
  return messageElement;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const prompt = userInput.value.trim();
  if (!prompt) return;

  // 1. Отображаем сообщение пользователя
  appendMessage(prompt, 'user');
  userInput.value = '';

  // 2. Блокируем интерфейс и показываем индикатор загрузки
  userInput.disabled = true;
  sendBtn.disabled = true;
  const loadingMessage = appendMessage('Думаю...', 'bot');

  try {
    // 3. Отправляем запрос к нашему API на Vercel
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Ошибка сервера: ${response.status}`);
    }

    // 4. Выводим ответ модели
    loadingMessage.textContent = data.text || 'Получен пустой ответ.';
  } catch (error) {
    loadingMessage.classList.add('error');
    loadingMessage.textContent = `Ошибка: ${error.message}`;
  } finally {
    // 5. Разблокируем ввод
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
});
