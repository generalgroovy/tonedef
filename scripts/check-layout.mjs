// Real ES modules, storage, workers and Web Audio served over local HTTP.
// Optional dev tooling: playwright@1.57.0; no application dependencies added.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.TONEDEF_PLAYWRIGHT_PATH ? pathToFileURL(process.env.TONEDEF_PLAYWRIGHT_PATH).href : 'playwright');
const root = path.resolve('dist'), output = path.resolve('test-results/compact-ui');
await mkdir(output, {recursive:true});
const manifest = JSON.parse(await readFile(path.join(root,'build.json'),'utf8'));
for (const file of ['compact.css','src/help.js','src/interval-view.js','src/app.js']) {
  assert.ok(manifest.files.includes(file));
  assert.equal(await readFile(path.join(root,file),'utf8'), await readFile(file,'utf8'));
}
// Compare to the actual previous release, not the new DOM with CSS disabled.
const baselineRevision = 'a56e15387d75e1ffa943fa9fc67efd8cfa91eab3';
const baseline = await mkdtemp(path.join(tmpdir(),'tonedef-baseline-'));
const files = execFileSync('git',['ls-tree','-r','--name-only',baselineRevision],{encoding:'utf8'}).trim().split('\n')
  .filter(f => ['index.html','styles.css','compact.css','favicon.svg'].includes(f) || /^src\/[^/]+\.js$/.test(f));
for (const file of files) {
  await mkdir(path.dirname(path.join(baseline,file)),{recursive:true});
  await writeFile(path.join(baseline,file),execFileSync('git',['show',`${baselineRevision}:${file}`]));
}
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    const prefix=pathname.startsWith('/baseline/')?'/baseline/':'/tonedef/';
    if (!pathname.startsWith(prefix)) {res.writeHead(404).end();return;}
    const base=prefix==='/baseline/'?baseline:root;
    const file=path.resolve(base,decodeURIComponent(pathname.slice(prefix.length))||'index.html');
    if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
    res.end(data);
  } catch {res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const report={sourceRevision:manifest.sourceRevision,baselineRevision,viewports:[],interactions:[]};
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const measure=page=>page.evaluate(()=>{
  const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {width:Math.round(r.width),height:Math.round(r.height),top:Math.round(r.top)};};
  return {pageHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,fontSize:getComputedStyle(document.body).fontSize,
    header:box('.topbar'),board:box('.fretboard-panel'),fret:box('.fret'),timeline:box('.timeline-panel'),inspector:box('.inspector'),math:box('.math-panel'),wheel:box('.music-tools')};
});
async function geometry(page,label) {
  await settle(page);const m=await measure(page);
  assert.ok(m.scrollWidth<=m.viewportWidth+1,`${label}: page overflow ${m.scrollWidth}/${m.viewportWidth}`);
  assert.ok(m.fret.width>=44&&m.fret.height>=44,`${label}: fret target >=44px`);
  assert.equal(m.fontSize,'16px');
  const escaped=await page.locator('.topbar,.context-bar,.panel,.theory-row').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(e=>e.className));
  assert.deepEqual(escaped,[],`${label}: container overflow`);
  const width=await page.locator('.theory-row').evaluate(e=>e.getBoundingClientRect().width);
  const workspaceWidth=await page.locator('.workspace').evaluate(e=>e.getBoundingClientRect().width);
  assert.ok(Math.abs(width-workspaceWidth)<=1,`${label}: theory fills available width`);
  return m;
}
async function interact(page,label,touch) {
  const fret=page.locator('.fret').first(), selected=await fret.getAttribute('aria-pressed');
  await fret.click();assert.notEqual(await fret.getAttribute('aria-pressed'),selected);
  await page.locator('[data-action="undo"]').click();assert.equal(await fret.getAttribute('aria-pressed'),selected);
  await fret.focus();const position=await fret.getAttribute('data-pos');await page.keyboard.press('ArrowRight');
  assert.notEqual(await page.evaluate(()=>document.activeElement.dataset.pos),position);
  await page.keyboard.press('Escape');
  const stored=await page.evaluate(()=>localStorage.getItem('tonedef.current.v2'));
  await page.locator('#interval-cell-0-3').click();
  assert.match(await page.locator('.math-readout').innerText(),/\+12/);
  assert.match(await page.locator('.equation').innerText(),/2\.0000/);
  await page.locator('#interval-cell-3-0').click();
  assert.match(await page.locator('.math-readout').innerText(),/-12/);
  assert.match(await page.locator('.equation').innerText(),/0\.5000/);
  await page.locator('#interval-cell-3-0').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'interval-cell-3-1');
  await page.keyboard.press('Enter');assert.equal(await page.locator('#interval-cell-3-1').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Escape');
  await page.locator('#half-step-labels').click();assert.equal(await page.locator('.half-step-label').count(),0);
  await page.locator('#half-step-labels').click();assert.ok(await page.locator('.half-step-label').count()>0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('tonedef.current.v2')),stored,'Visualization must not modify project data');
  const help=page.locator('.board-bar > .help-trigger');
  if(touch) await help.tap(); else {await help.hover();await page.waitForTimeout(350);}
  assert.ok(await page.locator('#ui-tooltip').isVisible());
  if(!touch){await page.locator('#ui-tooltip').hover();await page.waitForTimeout(250);assert.ok(await page.locator('#ui-tooltip').isVisible());}
  await page.keyboard.press('Escape');assert.ok(await page.locator('#ui-tooltip').isHidden());
  await page.evaluate(()=>document.activeElement.blur());
  await help.focus();assert.ok(await page.locator('#ui-tooltip').isVisible());await page.keyboard.press('Escape');
  await page.locator('[data-event]').nth(1).click();assert.equal(await page.locator('[data-event]').nth(1).getAttribute('aria-pressed'),'true');
  await page.locator('#playButton').click();await page.waitForFunction(()=>document.querySelector('#playButton').getAttribute('aria-pressed')==='true');
  await page.locator('[data-action="stop"]').click();assert.equal(await page.locator('#playButton').getAttribute('aria-pressed'),'false');
  for(const tab of ['chromatic','fifths']) {await page.locator(`[data-tools-tab="${tab}"]`).click();assert.equal(await page.locator(`[data-tools-tab="${tab}"]`).getAttribute('aria-pressed'),'true');}
  await page.locator('[data-action="projects"]').click();assert.ok(await page.locator('dialog').evaluate(e=>e.open));
  await page.locator('[data-action="close-modal"]').click();
  await page.locator('[data-action="settings"]').click();
  await page.locator('#show-random').check();assert.ok(await page.locator('[data-random]').count()>10);
  await page.locator('#setting-labels').selectOption('both');assert.ok(await page.locator('.note-disc small').count()>0);
  await geometry(page,`${label} settings`);await page.keyboard.press('Escape');
  await page.screenshot({path:path.join(output,`${label}-settings.png`),fullPage:true});
  await page.locator('[data-action="generate"]').click();
  await page.waitForFunction(()=>!document.querySelector('[data-action="generate"]').disabled,null,{timeout:20000});
  assert.equal(await page.locator('.toast.error').count(),0);assert.ok(await page.locator('[data-event]').count()>0);
  await geometry(page,`${label} generated`);
  // Test dense instrument and re-entrant pitches without changing the user's files.
  await page.evaluate(async()=>{
    const {example}=await import('./src/model.js'); const p=example();
    Object.assign(p.settings,{stringCount:12,fretCount:36,fretMax:36,open0:64,open1:60});
    localStorage.setItem('tonedef.current.v2',JSON.stringify(p));
  });
  await page.reload();await page.waitForSelector('.fret');
  assert.equal(await page.locator('.string-row').count(),12);
  assert.equal(await page.locator('.fret').count(),444);
  await geometry(page,`${label} twelve strings`);
  await page.locator('[data-action="add"][data-kind="rest"]').click();
  assert.ok(await page.locator('.math-panel .empty').isVisible());await geometry(page,`${label} rest`);
  report.interactions.push({viewport:label,checks:['edit/undo','fret keyboard','signed octave/ratio','matrix keyboard','non-mutating views','hover/focus/tap help + Escape','timeline','play/stop','theory tabs','Projects','settings/random flags','generation worker','12 strings/36 frets/re-entrant tuning','empty/rest']});
}
try {
  for(const [width,height,touch] of [[2560,1440,false],[1920,1080,false],[1440,1000,false],[1280,900,false],[1100,900,false],[1024,768,false],[850,1000,false],[768,1024,true],[650,900,false],[570,900,true],[390,844,true],[360,800,true],[320,800,true]]) {
    const options={viewport:{width,height},hasTouch:touch,deviceScaleFactor:1,reducedMotion:'reduce'};
    const context=await browser.newContext(options),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    const label=`${width}${touch?'-touch':'-desktop'}`;
    await page.goto(origin+'/tonedef/',{waitUntil:'networkidle'});await page.waitForSelector('.fret');
    const after=await geometry(page,label),entry={width,touch,after};
    if([1440,390].includes(width)) {
      const oldContext=await browser.newContext(options),oldPage=await oldContext.newPage();
      await oldPage.goto(origin+'/baseline/',{waitUntil:'networkidle'});await oldPage.waitForSelector('.fret');
      entry.before=await measure(oldPage);entry.pageHeightReductionPercent=Math.round(100*(1-after.pageHeight/entry.before.pageHeight));
      assert.ok(after.pageHeight<entry.before.pageHeight,`${label}: shorter than previous release`);
      if(width===1440){assert.ok(after.board.width>entry.before.board.width);assert.ok(after.board.height<entry.before.board.height);}
      await oldPage.screenshot({path:path.join(output,`${label}-before.png`),fullPage:true});await oldContext.close();
    }
    await page.screenshot({path:path.join(output,`${label}-after.png`),fullPage:true});
    report.viewports.push(entry);
    if([1440,390].includes(width))await interact(page,label,touch);
    assert.deepEqual(errors,[],`${label}: browser/network errors`);
    console.log(`PASS ${label}: ${after.pageHeight}px, fretboard ${after.board.width}x${after.board.height}px`);
    await context.close();
  }
  console.log('VISUAL_WORKSPACE_REPORT='+JSON.stringify(report));
} finally {
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  await browser.close();await new Promise(resolve=>server.close(resolve));await rm(baseline,{recursive:true,force:true});
}
