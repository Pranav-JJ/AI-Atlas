/**
 * Local emulator of GitHub Pages' serving rules.
 *
 * `vite preview` has its own SPA fallback built in, so it silently "fixes" deep
 * links that would break on Pages — which makes it useless for verifying the
 * one thing most likely to go wrong on this host. This server reproduces what
 * Pages actually does:
 *
 *   - exact file match          -> 200
 *   - directory with index.html -> 200
 *   - anything else             -> 404.html, with an HTTP 404 status
 *
 * Usage:
 *   npm run build
 *   node scripts/pages-emulator.mjs dist /AI-Atlas/ 4180
 *
 * Expected:
 *   /                    200  (dist/index.html)
 *   /about               200  (pre-rendered, dist/about/index.html)
 *   /library?q=nlp       404  serving the redirector, which restores the URL
 *
 * Development tool only — never deployed, and not part of the build.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'

const ROOT = process.argv[2] ?? 'dist'
const BASE = process.argv[3] ?? '/AI-Atlas/'
const PORT = Number(process.argv[4] ?? 4180)

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

async function resolveFile(candidate) {
  try {
    const stats = await stat(candidate)
    if (stats.isFile()) return candidate

    if (stats.isDirectory()) {
      const index = join(candidate, 'index.html')
      if ((await stat(index)).isFile()) return index
    }
  } catch {
    // Not found: fall through to the 404 handler.
  }
  return null
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`Outside the base path ${BASE}. GitHub Pages would 404 here too.`)
    return
  }

  const relative = url.pathname.slice(BASE.length)
  const file = await resolveFile(join(ROOT, relative || 'index.html'))

  if (file) {
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    })
    res.end(await readFile(file))
    return
  }

  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
  res.end(await readFile(join(ROOT, '404.html')))
})

server.listen(PORT, () => {
  console.log(`GitHub Pages emulator: http://localhost:${PORT}${BASE}`)
  console.log(`  serving ${ROOT} at base ${BASE}`)
})
