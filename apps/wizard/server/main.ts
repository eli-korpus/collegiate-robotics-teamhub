/**
 * `npm run setup` — starts the local wizard (spec §5.1): Hono API + Vite-served UI on http://localhost:4747.
 * Everything runs on this computer; secrets never leave it except to Supabase's own API.
 */
import { createServer as createHttpServer } from 'node:http';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRequestListener } from '@hono/node-server';
import { createServer as createVite } from 'vite';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { normalize } from 'node:path';
import { teamDir } from '@teamhub/generator';
import { createApp } from './app';

const PORT = Number(process.env.TEAMHUB_WIZARD_PORT ?? 4747);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const vite = await createVite({ root, configFile: join(root, 'vite.config.ts'), server: { middlewareMode: true }, appType: 'spa', logLevel: 'warn' });
  const api = getRequestListener(createApp().fetch);
  const server = createHttpServer((req, res) => {
    if (req.url?.startsWith('/api/')) return api(req, res);
    if (req.url?.startsWith('/__team/')) {
      // Serve uploaded logos for previews (read-only, inside team/ only).
      const rel = normalize(decodeURIComponent(req.url.slice(8).split('?')[0])).replace(/^(\.\.[/\\])+/, '');
      const file = join(teamDir(), rel);
      if (file.startsWith(teamDir()) && existsSync(file) && statSync(file).isFile()) {
        const ext = file.split('.').pop();
        res.setHeader('Content-Type', ext === 'svg' ? 'image/svg+xml' : `image/${ext}`);
        return createReadStream(file).pipe(res);
      }
      res.statusCode = 404;
      return res.end();
    }
    vite.middlewares(req, res, () => {
      res.statusCode = 404;
      res.end('Not found');
    });
  });
  server.listen(PORT, '127.0.0.1', () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n  TeamHub setup wizard is running at ${url}\n  (press Ctrl+C to stop)\n`);
    if (!process.env.TEAMHUB_NO_OPEN) {
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
      const args = process.platform === 'win32' ? ['/c', 'start', url] : [url];
      execFile(cmd, args, () => {});
    }
  });
  server.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') console.error(`\n  Port ${PORT} is busy — is the wizard already open? Set TEAMHUB_WIZARD_PORT to use another port.\n`);
    else console.error(e);
    process.exit(1);
  });
}

main();
