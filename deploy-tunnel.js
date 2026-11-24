/**
 * CF 2800-3500 Arena - Instant Public Deployment Tool
 * Creates a local server and connects a secure HTTPS public tunnel via localtunnel.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8080;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(ROOT, reqPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, async () => {
  console.log(`=================================================`);
  console.log(`  Local server active at: http://localhost:${PORT}`);
  console.log(`  Connecting live public tunnel...`);
  console.log(`=================================================`);

  // Start localtunnel as a child process
  const lt = spawn('cmd.exe', ['/c', 'npx', 'localtunnel', '--port', String(PORT), '--subdomain', 'cf-arena-grandmaster']);

  lt.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text.includes('your url is:')) {
      console.log(`\n🚀 YOUR WEBSITE IS LIVE ONLINE:`);
      console.log(`👉 ${text.replace('your url is: ', '')}\n`);
      console.log(`(Share this link with anyone! Press Ctrl+C to stop)`);
    } else {
      console.log(text);
    }
  });

  lt.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  lt.on('close', (code) => {
    console.log(`Tunnel closed with code ${code}`);
    server.close();
    process.exit(0);
  });
});
