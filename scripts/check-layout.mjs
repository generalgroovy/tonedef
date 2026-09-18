// Optional browser regression check. The app itself remains dependency-free.
// Build first; install playwright@1.57.0 and its Chromium browser for this check.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.TONEDEF_PLAYWRIGHT_PATH
  ? pathToFileURL(process.env.TONEDEF_PLAYWRIGHT_PATH).href : "playwright");
const root = path.resolve("dist");
const output = path.resolve("test-results/compact-ui");
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(root, "build.json"), "utf8"));
assert.ok(manifest.files.includes("compact.css"), "Build manifest includes compact.css");
assert.equal(await readFile(path.join(root, "compact.css"), "utf8"),
  await readFile("compact.css", "utf8"), "Built stylesheet matches its source");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (!pathname.startsWith("/tonedef/")) { res.writeHead(404).end(); return; }
    const file = path.resolve(root, decodeURIComponent(pathname.slice(9)) || "index.html");
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const url = `http://127.0.0.1:${server.address().port}/tonedef/`;
const browser = await chromium.launch({ headless: true });
const report = { sourceRevision: manifest.sourceRevision, viewports: [], interactions: [] };
const settle = (page) => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const measure = (page) => page.evaluate(() => {
  const box = selector => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top) };
  };
  return {
    pageHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    fontSize: getComputedStyle(document.body).fontSize,
    header: box(".topbar"), board: box(".fretboard-panel"),
    fret: box(".fret"), timeline: box(".timeline-panel"), inspector: box(".inspector"),
    visibleButtons: [...document.querySelectorAll("button")].filter(e => e.getClientRects().length > 0).length,
  };
});
async function geometry(page, label) {
  await settle(page);
  const m = await measure(page);
  assert.ok(m.scrollWidth <= m.viewportWidth + 1, `${label}: no page overflow (${m.scrollWidth}/${m.viewportWidth})`);
  assert.ok(m.fret.width >= 44 && m.fret.height >= 44, `${label}: fret targets remain >=44px`);
  assert.equal(m.fontSize, "16px", `${label}: body text is not scaled down`);
  const escaped = await page.locator(".topbar, .context-bar, .panel, .generate-strip").evaluateAll(elements =>
    elements.filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(e => e.className));
  assert.deepEqual(escaped, [], `${label}: panels stay within the viewport`);
  return m;
}
async function interactions(page, label) {
  const fret = page.locator(".fret").first();
  const selected = await fret.getAttribute("aria-pressed");
  await fret.click();
  assert.notEqual(await fret.getAttribute("aria-pressed"), selected, `${label}: fret click edits`);
  await page.locator('[data-action="undo"]').click();
  assert.equal(await fret.getAttribute("aria-pressed"), selected, `${label}: undo restores note`);
  await fret.focus();
  const originalPosition = await fret.getAttribute("data-pos");
  await page.keyboard.press("ArrowRight");
  assert.notEqual(await page.evaluate(() => document.activeElement.dataset.pos), originalPosition, `${label}: arrow navigation`);
  await page.locator('[data-event]').nth(1).click();
  assert.equal(await page.locator('[data-event]').nth(1).getAttribute("aria-pressed"), "true", `${label}: timeline selection`);
  await page.locator('#playButton').click();
  await page.waitForFunction(() => document.querySelector('#playButton').getAttribute('aria-pressed') === 'true');
  await page.locator('[data-action="stop"]').click();
  assert.equal(await page.locator('#playButton').getAttribute('aria-pressed'), 'false', `${label}: playback stops`);
  for (const tab of ["matrix", "chromatic", "fifths"]) {
    await page.locator(`[data-tools-tab="${tab}"]`).click();
    assert.equal(await page.locator(`[data-tools-tab="${tab}"]`).getAttribute("aria-pressed"), "true");
  }
  await page.locator('[data-action="projects"]').click();
  assert.ok(await page.locator('dialog').evaluate(e => e.open), `${label}: Projects dialog opens`);
  await page.locator('[data-action="close-modal"]').click();
  await page.locator('#settings-panel > summary').click();
  await page.locator('#show-random').check();
  assert.ok(await page.locator('[data-random]').count() > 10, `${label}: randomization controls retained`);
  await page.locator('#setting-labels').selectOption("both");
  assert.ok(await page.locator('.note-disc small').count() > 0, `${label}: note/degree labels retained`);
  await geometry(page, `${label} expanded settings`);
  await page.screenshot({ path: path.join(output, `${label}-settings.png`), fullPage: true });
  await page.locator('[data-action="generate"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-action="generate"]').disabled, null, { timeout: 20000 });
  assert.equal(await page.locator('.toast.error').count(), 0, `${label}: generation completes without an error`);
  assert.ok(await page.locator('[data-event]').count() > 0, `${label}: worker generated a pattern`);
  await geometry(page, `${label} generated pattern`);
  report.interactions.push({ viewport: label, checks: ["note editing", "undo", "keyboard navigation", "timeline", "play/stop", "theory tabs", "Projects", "expanded settings", "randomization controls", "both labels", "generation worker"] });
}
try {
  for (const [width, height, touch] of [[2560,1440,false], [1920,1080,false], [1440,1000,false], [1280,900,false], [1024,768,false], [850,1000,false], [768,1024,true], [650,900,false], [570,900,true], [390,844,true], [360,800,true], [320,800,true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector('.fret');
    const label = `${width}${touch ? "-touch" : "-desktop"}`;
    const compact = await geometry(page, label);
    const entry = { width, touch, compact };
    if ([1440,390].includes(width)) {
      const sheet = page.locator('link[href="./compact.css"]');
      await sheet.evaluate(e => { e.disabled = true; });
      await settle(page);
      entry.before = await measure(page);
      await page.screenshot({ path: path.join(output, `${label}-before.png`), fullPage: true });
      await sheet.evaluate(e => { e.disabled = false; });
      await settle(page);
      assert.equal(compact.visibleButtons, entry.before.visibleButtons, `${label}: no controls removed`);
      assert.ok(compact.board.height < entry.before.board.height, `${label}: fretboard panel is shorter`);
      assert.ok(compact.pageHeight < entry.before.pageHeight, `${label}: page is shorter`);
      if (width === 1440) assert.ok(compact.board.height <= entry.before.board.height * .88, "Desktop board height reduced by at least 12%");
      entry.pageHeightReductionPercent = Math.round(100 * (1 - compact.pageHeight / entry.before.pageHeight));
    }
    await page.screenshot({ path: path.join(output, `${label}-after.png`), fullPage: true });
    if ([1440,390].includes(width)) await interactions(page, label);
    assert.deepEqual(errors, [], `${label}: no browser errors or missing runtime assets`);
    report.viewports.push(entry);
    console.log(`PASS ${label}: page ${compact.pageHeight}px; board ${compact.board.height}px; fret ${compact.fret.width}x${compact.fret.height}px`);
    await context.close();
  }
  console.log("COMPACT_UI_REPORT=" + JSON.stringify(report));
} finally {
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
