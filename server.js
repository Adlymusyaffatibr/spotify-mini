const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = 3000;

// Path ke yt-dlp (terinstall via pip)
const YTDLP_PATH = 'C:\\Users\\Latitude User\\AppData\\Roaming\\Python\\Python314\\Scripts\\yt-dlp.exe';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API Route: cari YouTube video ID via yt-dlp
  if (url.pathname === '/api/search-youtube') {
    const query = url.searchParams.get('q');
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing query parameter q' }));
      return;
    }

    const args = [
      '--get-id',
      '--no-playlist',
      '--no-warnings',
      '--quiet',
      `ytsearch1:${query}`
    ];

    execFile(YTDLP_PATH, args, { timeout: 15000 }, (err, stdout) => {
      const videoId = stdout.trim();
      if (!err && videoId && videoId.length === 11) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ videoId }));
      } else {
        console.error('yt-dlp error:', err?.message);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Video not found' }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);

  // Safe directory check to prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'text/javascript';
    if (ext === '.css') contentType = 'text/css';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
