import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
const shoot = async (url, out, width) => {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } });
  try {
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), { timeout: 30000 });
  } catch { /* proceed with whatever loaded */ }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
};
for (const [slug, proto] of [['features-recover', 'features-recover-proposed'], ['stripe', 'stripe-proposed']]) {
  for (const w of [1440, 390]) {
    await shoot(`${BASE}/qa/${slug}.html`, `qa/shot-${slug}-${w}.png`, w);
    await shoot(`http://localhost:8791/${proto}.html`, `qa/proto-${slug}-${w}.png`, w);
  }
}
await browser.close();
server.close();
console.log('shots done');
