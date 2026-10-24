const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { createDataExplorer } = require('./data-engine');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname);
const PUBLIC = path.join(ROOT, 'public');
const explorer = createDataExplorer({ root: ROOT });

function sendJson(response, body, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/api/files') return sendJson(response, await explorer.listFiles());
    if (url.pathname === '/api/file') {
      const filePath = url.searchParams.get('path') || '';
      return sendJson(response, await explorer.readFile(filePath));
    }
    if (url.pathname === '/api/search') {
      const query = (url.searchParams.get('q') || '').trim();
      return sendJson(response, await explorer.search(query));
    }
    if (url.pathname === '/favicon.ico') {
      response.writeHead(204);
      return response.end();
    }
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const asset = path.resolve(PUBLIC, requested);
    if (!asset.startsWith(`${PUBLIC}${path.sep}`)) throw new Error('Invalid resource path');
    const extension = path.extname(asset);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };
    if (!types[extension]) throw new Error('Resource not found');
    response.writeHead(200, { 'Content-Type': types[extension] || 'application/octet-stream' });
    fs.createReadStream(asset).on('error', () => sendJson(response, { error: 'Resource not found' }, 404)).pipe(response);
  } catch (error) {
    sendJson(response, { error: error.message || 'Unexpected error' }, error.code === 'ENOENT' ? 404 : 400);
  }
});

server.listen(PORT, () => console.log(`Data Explorer is available at http://localhost:${PORT}`));
