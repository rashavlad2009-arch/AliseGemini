const response = await fetch('/api/gemini', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'Привет, Gemini!' }),
});
const data = await response.json();
console.log(data.text);
