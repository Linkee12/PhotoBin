// Pixel-level acceptance for album group headers and toolbar.
// Criteria: (A) 12px halo around each header name+meta is body colour;
// (B) curve clearance above title >= 24px at title left/mid/right;
// (C) 8px halo around each toolbar control is shelf colour (#0E0E0E);
// (D) header parts inside viewport, no horizontal scroll.
// Usage: CHROMIUM=<chrome binary> FIXTURE_DIR=<dir with img1..8.jpg> [BASE_URL] [OUT_DIR]
//        [PLAYWRIGHT_CORE=<path to playwright-core/index.mjs>] [PNGJS=<path to pngjs/lib/png.js>]
//        node scripts/layout-acceptance.mjs
// Exits non-zero when any criterion fails. Needs the app running at BASE_URL.
import path from "node:path";
import fs from "node:fs";
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? "playwright-core");
const { PNG } = await import(process.env.PNGJS ?? "pngjs");
const S = process.env.FIXTURE_DIR ?? ".";
const OUT = process.env.OUT_DIR ?? "layout-acceptance-out";
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [[390,844],[844,390],[1024,768],[1280,800],[1440,900],[1920,1080],[1980,2014],[2560,1440]];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto((process.env.BASE_URL ?? "http://localhost:3000") + "/"); await page.getByText("NEW ALBUM").click(); await page.waitForURL(/\/bin\//);
for (const set of [[1,2,3],[4,5],[6,7],[8]]) {
  await page.locator('input[type="file"]').setInputFiles(set.map((i) => path.join(S, `img${i}.jpg`)));
  await page.waitForTimeout(5000);
}
// rename first group to a long name
const nameEl = page.locator("[data-group-name]").first();
if (await nameEl.count()) { await nameEl.click(); await page.keyboard.press("Control+A"); await page.keyboard.type("Saturday at the lake with everyone 2026!"); await page.keyboard.press("Enter"); await page.waitForTimeout(800); }
const parse = (c) => { const m = c.match(/\d+/g).map(Number); return m.slice(0,3); };
const near = (a, b, t = 6) => Math.abs(a[0]-b[0])<=t && Math.abs(a[1]-b[1])<=t && Math.abs(a[2]-b[2])<=t;
const rows = [];
for (const [w, h] of VIEWPORTS) {
  await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  const png = PNG.sync.read(await page.screenshot({ fullPage: false }));
  const px = (x, y) => { x = Math.round(x); y = Math.round(y); if (x<0||y<0||x>=png.width||y>=png.height) return null; const i = (y*png.width+x)*4; return [png.data[i],png.data[i+1],png.data[i+2]]; };
  const info = await page.evaluate(() => {
    const secs = [...document.querySelectorAll("section")];
    const headers = secs.map((sec) => {
      const name = sec.querySelector("[data-group-name]"); const row = name?.closest("[role=button]");
      if (!name || !row) return null;
      const body = getComputedStyle(sec.querySelector("[data-section-body]") ?? sec).backgroundColor;
      const parts = [...row.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect().toJSON());
      const r = name.getBoundingClientRect(); const meta = row.querySelector("[data-group-meta]")?.getBoundingClientRect();
      const all = parts.length ? parts : [r];
      const box = { left: Math.min(...all.map((p) => p.left)), top: Math.min(...all.map((p) => p.top)), right: Math.max(...all.map((p) => p.right)), bottom: Math.max(...all.map((p) => p.bottom)) };
      return { title: name.textContent, box, parts, body };
    }).filter(Boolean);
    const toolbar = [...document.querySelectorAll("[data-toolbar-control]")].map((e) => ({ box: e.getBoundingClientRect().toJSON(), visible: e.getBoundingClientRect().width > 0 }));
    return { headers, toolbar, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, innerH: innerHeight };
  });
  const vp = `${w}x${h}`;
  rows.push([vp, "D no-hscroll", info.scrollW <= info.innerW ? "PASS" : "FAIL", `${info.scrollW}/${info.innerW}`]);
  for (const hd of info.headers) {
    if (hd.box.top > info.innerH) continue; // offscreen
    const body = parse(hd.body);
    const inside = hd.parts.every((p) => p.left >= 0 && p.right <= info.innerW);
    rows.push([vp, `D inside "${hd.title.slice(0,12)}"`, inside ? "PASS" : "FAIL", ""]);
    // A: halo
    const m = 12; let bad = 0, total = 0;
    const b = hd.box;
    for (let x = b.left - m; x <= b.right + m; x += 2) { for (const y of [b.top - m, b.bottom + m]) { const c = px(x, y); if (!c) continue; total++; if (!near(c, body)) bad++; } }
    for (let y = b.top - m; y <= b.bottom + m; y += 2) { for (const x of [b.left - m, b.right + m]) { const c = px(x, y); if (!c) continue; total++; if (!near(c, body)) bad++; } }
    rows.push([vp, `A halo "${hd.title.slice(0,12)}"`, bad === 0 ? "PASS" : "FAIL", `${bad}/${total} off-colour`]);
    // B: clearance
    let minD = Infinity;
    for (const x of [b.left, (b.left + b.right) / 2, b.right]) { let d = 0; while (d < 200) { const c = px(x, b.top - 1 - d); if (!c || !near(c, body)) break; d++; } minD = Math.min(minD, d); }
    rows.push([vp, `B clearance "${hd.title.slice(0,12)}"`, minD >= 24 ? "PASS" : "FAIL", `${minD}px`]);
  }
  for (const t of info.toolbar) {
    if (!t.visible) continue; const m = 8; let bad = 0, total = 0; const b = t.box;
    for (let x = b.left - m; x <= b.right + m; x += 2) for (const y of [b.top - m, b.bottom + m]) { const c = px(x, y); if (!c) continue; total++; if (!near(c, [14,14,14])) bad++; }
    for (let y = b.top - m; y <= b.bottom + m; y += 2) for (const x of [b.left - m, b.right + m]) { const c = px(x, y); if (!c) continue; total++; if (!near(c, [14,14,14])) bad++; }
    rows.push([vp, `C toolbar@${Math.round(b.left)}`, bad === 0 ? "PASS" : "FAIL", `${bad}/${total} off-shelf`]);
  }
  await page.screenshot({ path: `${OUT}/${vp}.png` });
}
for (const r of rows) console.log(r.join(" | "));
const fails = rows.filter((r) => r[2] === "FAIL").length;
console.log("FAILS:", fails, "/", rows.length);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
