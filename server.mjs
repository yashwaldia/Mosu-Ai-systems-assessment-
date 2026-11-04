import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { resolve, extname } from 'node:path';
import { runSuite } from './cases.mjs';
import { handle } from './workflow.mjs';

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // API Check Endpoint
  if (url.pathname === '/api/check') {
    try {
      const results = await runSuite(handle);
      const passedCount = results.filter((r) => r.passed).length;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          {
            status: 'ok',
            passed: passedCount,
            total: results.length,
            allPassed: passedCount === results.length,
            results,
          },
          null,
          2
        )
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', error: err.message }));
    }
    return;
  }

  // Serve static files from dist or root
  let filePath = resolve('dist', url.pathname.slice(1));
  if (!existsSync(filePath) || url.pathname === '/') {
    filePath = resolve('dist', 'index.html');
  }

  if (existsSync(filePath)) {
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>MOSU Visual Systems Demonstrator</h1><p>Run npm run build to populate dist, or use npm run dev.</p>');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MOSU Visual Systems Demonstrator running at http://localhost:${PORT}`);
  console.log(`API verification check available at http://localhost:${PORT}/api/check`);
});
