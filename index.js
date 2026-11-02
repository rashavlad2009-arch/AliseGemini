const http = require('http');
const server = http.createServer((req,
                                  res) => res.end('Тест работает!'));
server.listen(process.env.PORT || 3000);.
