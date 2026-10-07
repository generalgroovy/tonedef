// Real ES modules, storage, workers and Web Audio served over local HTTP.
// Optional dev tooling: playwright@1.57.0; no application dependencies added.
import assert from 'node:assert/strict';
import {visualPracticeChecks} from './visual-practice-checks.mjs';
import {learningPathChecks} from './learning-path-checks.mjs';
import {focusedPracticeChecks} from './focused-practice-checks.mjs';
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
for (const file of ['compact.css','workspace.css','src/layout.js','src/exercises.js','src/analysis-context.js','src/learning.js','src/practice-options.js','src/practice-view.js','src/expression.js','src/workspace.js','src/help.js','src/interval-view.js','src/app.js']) {
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
const browser=await chromium.launch({headless:true, ...(process.env.TONEDEF_CHROMIUM_PATH ? {executablePath:process.env.TONEDEF_CHROMIUM_PATH} : {})});
const report={sourceRevision:manifest.sourceRevision,baselineRevision,viewports:[],interactions:[]};
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const measure=page=>page.evaluate(()=>{
  const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {width:Math.round(r.width),height:Math.round(r.height),top:Math.round(r.top)};};
  return {pageHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,fontSize:getComputedStyle(document.body).fontSize,
    header:box('.topbar'),board:box('.fretboard-panel'),fret:box('.fret'),timeline:box('.timeline-panel'),inspector:box('.inspector'),math:box('.math-panel'),wheel:box('.music-tools')};
});
async function geometry(page,label,panelCount=8) {
  await settle(page);const m=await measure(page);
  assert.ok(m.scrollWidth<=m.viewportWidth+1,`${label}: page overflow ${m.scrollWidth}/${m.viewportWidth}`);
  assert.ok(m.fret.width>=44&&m.fret.height>=44,`${label}: fret target >=44px`);
  assert.equal(m.fontSize,'16px');
  const escaped=await page.locator('.topbar,.context-bar,.dock-panel:not([hidden])').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(e=>e.className));
  assert.deepEqual(escaped,[],`${label}: container overflow`);
  const width=await page.locator('.dock-grid').evaluate(e=>e.getBoundingClientRect().width);
  const workspaceWidth=await page.locator('.workspace').evaluate(e=>e.getBoundingClientRect().width);
  assert.ok(Math.abs(width-workspaceWidth)<=1,`${label}: dock fills available width`);
  assert.equal(await page.locator('.dock-panel').count(),panelCount,`${label}: applicable areas retained`);
  const overview = await page.locator('[data-workspace-mode="overview"]').getAttribute('aria-pressed') === 'true';
  if (overview) {
    assert.equal(await page.locator('.dock-panel[hidden],.dock-body[hidden]').count(),0,`${label}: Overview keeps every area open`);
    assert.equal(await page.locator('[data-layout-action="collapse"]').count(),0,`${label}: Overview has no panel collapse controls`);
    if (page.viewportSize().width >= 1100 && page.viewportSize().height >= 680) {
      const outside = await page.locator('.dock-panel').evaluateAll(es => es.filter(e => {
        const r=e.getBoundingClientRect();return r.top < -1 || r.bottom > innerHeight+1 || r.width <= 0 || r.height <= 0;
      }).map(e=>({panel:e.dataset.panel,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom})));
      assert.deepEqual(outside,[],`${label}: all eight panel frames are visible together`);
      assert.ok(m.pageHeight <= page.viewportSize().height+1,`${label}: Overview does not require page scrolling`);
    }
  }
  return m;
}
const savedProject = page => page.evaluate(()=>JSON.parse(localStorage.getItem('tonedef.current.v2')));
const instrumentOf = project => Object.fromEntries(Object.entries(project.settings).filter(([key]) =>
  ['stringCount','fretCount','capo','fretMin','fretMax','practiceRanges'].includes(key) || /^(open|enabled)\d+$/.test(key)));
async function simpleGeometry(page,label) {
  await settle(page);
  const m=await measure(page);
  assert.ok(m.scrollWidth<=m.viewportWidth+1,`${label}: no horizontal page overflow`);
  assert.equal(m.fontSize,'16px',`${label}: readable base text`);
  assert.ok(m.fret.width>=44&&m.fret.height>=44,`${label}: playable fret targets >=44px`);
  const outside=await page.locator('.topbar,.context-bar,.simple-panel').evaluateAll(nodes=>nodes.filter(node=>{
    const r=node.getBoundingClientRect();return r.width && (r.left< -1||r.right>innerWidth+1);
  }).map(node=>node.dataset.panel||node.className));
  assert.deepEqual(outside,[],`${label}: learner containers stay within viewport`);
  const small=await page.locator('[data-workspace-mode],[data-learn-topic],[data-learn-scale],[data-learn-pitch],[data-practice-string],#learn-listen,#practice-new').evaluateAll(nodes=>nodes.filter(node=>{
    const r=node.getBoundingClientRect();return r.width && (r.width<44||r.height<44);
  }).map(node=>({id:node.id,width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})));
  assert.deepEqual(small,[],`${label}: primary learning and practice targets >=44px`);
  assert.equal(await page.locator('.math-panel:visible,.inspector:visible,.music-tools:visible,.transition-panel:visible,.reference-row:visible').count(),0,`${label}: advanced analysis stays in Studio`);
  const duplicates=await page.locator('[id]').evaluateAll(nodes=>{
    const counts=new Map();for(const node of nodes)counts.set(node.id,(counts.get(node.id)||0)+1);
    return [...counts].filter(([,count])=>count>1).map(([id])=>id);
  });
  assert.deepEqual(duplicates,[],`${label}: every visible control has an unambiguous ID`);
  return m;
}
async function generate(page,action='generate') {
  await page.locator(`[data-action="${action}"]`).click();
  await page.waitForFunction(()=>!document.querySelector('[data-action="generate"]').disabled,null,{timeout:20000});
  assert.equal(await page.locator('.toast.error').count(),0,`${action}: generation succeeds`);
  return savedProject(page);
}
async function generatePractice(page) {
  await page.locator('#practice-new').click();
  await page.waitForFunction(()=>document.querySelector('#practice-new')?.disabled===false,null,{timeout:20000});
  assert.equal(await page.locator('.toast.error').count(),0,'Practice worker succeeds');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'practice-new','New pattern restores keyboard focus');
  return savedProject(page);
}
async function learnerInteractions(page,label,touch) {
  assert.equal(await page.locator('[data-workspace-mode="learn"]').getAttribute('aria-pressed'),'true','Fresh visitors begin in Learn');
  assert.equal(await page.locator('[data-workspace-mode="custom"]').count(),0,'Arranging stays out of the beginner navigation');
  assert.equal(await page.locator('#learn-topic-notes').getAttribute('aria-pressed'),'true','The first lesson is Notes');
  assert.equal(await page.locator('#collection').isVisible(),false,'Notes begins without an extra collection selector');
  assert.equal(await page.locator('.hear-toggle').count(),0,'Simple views always audition without an extra sound checkbox');
  assert.ok(await page.locator('#learn-topic-notes').evaluate(node=>Boolean(node.compareDocumentPosition(document.querySelector('#setting-tonic'))&Node.DOCUMENT_POSITION_FOLLOWING)),'Lesson topics precede tonal controls');
  await simpleGeometry(page,`${label} Learn`);
  const firstScreen=await page.locator('#app').innerText();
  assert.doesNotMatch(firstScreen,/\b(?:MIDI|ticks?|12-TET|reference)\b/i,'Learn avoids technical reference clutter');
  await page.screenshot({path:path.join(output,`${label}-learn.png`),fullPage:true});
  // Commit the displayed home note so the initially unsaved example has a stable,
  // inspectable identity. Lesson navigation itself must not edit that project.
  await page.locator('#setting-tonic').selectOption(await page.locator('#setting-tonic').inputValue());
  // A stored Studio audition preference must not silently mute learner gestures.
  await page.locator('#workspace-overview').click();
  await page.getByLabel('Hear clicks',{exact:true}).uncheck();
  await page.locator('#workspace-learn').click();
  const original=await savedProject(page);
  assert.equal(original.settings.audition,false);
  assert.ok(original,'The displayed project is saved after a context edit');
  for(const topic of ['steps','scales','modes','notes','modes']) {
    await page.locator(`#learn-topic-${topic}`).click();
    assert.equal(await page.locator(`#learn-topic-${topic}`).getAttribute('aria-pressed'),'true');
    assert.equal(await page.evaluate(()=>document.activeElement.id),`learn-topic-${topic}`,'Lesson navigation retains focus');
    assert.deepEqual(await savedProject(page),original,'Lesson navigation preserves music and settings');
    if(topic==='scales') assert.equal(await page.locator('#collection').isVisible(),true,'Scales exposes its collection selector');
    else if(topic==='modes') assert.equal(await page.locator('#collection').count(),0,'Mode buttons are the only mode selector');
    else {
      assert.equal(await page.locator('#learning-info #collection').count(),1,'Advanced collection choice remains available under Info');
      assert.equal(await page.locator('#collection').isVisible(),false);
    }
    if(topic==='steps') {
      assert.equal(await page.locator('[data-learn-pitch]').count(),3);
      assert.deepEqual(await page.locator('[data-half-steps]').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.halfSteps))),[1,1]);
    }
  }
  const beforeListening=await savedProject(page);
  await page.locator('#learn-listen').click();
  await page.waitForFunction(()=>document.querySelector('#learn-listen')?.getAttribute('aria-pressed')==='true');
  assert.equal(await page.locator('#playButton').getAttribute('aria-pressed'),'false','Hear scale is independent of saved-pattern playback');
  assert.deepEqual(await savedProject(page),beforeListening,'Listening to the scale does not replace or save the pattern');
  await page.locator('#learn-listen').click();
  assert.equal(await page.locator('#learn-listen').getAttribute('aria-pressed'),'false','Hear scale can be stopped');
  await page.locator('#learn-listen').click();
  await page.waitForFunction(()=>document.querySelector('#learn-listen')?.getAttribute('aria-pressed')==='true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#learn-listen').getAttribute('aria-pressed'),'false','Escape stops lesson playback');
  await page.locator('#learn-listen').click();
  await page.waitForFunction(()=>document.querySelector('#learn-listen')?.getAttribute('aria-pressed')==='true');
  await page.locator('#learn-topic-scales').click();
  assert.equal(await page.locator('#learn-listen').getAttribute('aria-pressed'),'false','Changing topic stops the previous lesson');
  await page.locator('#learn-listen').click();
  await page.waitForFunction(()=>document.querySelector('#learn-listen')?.getAttribute('aria-pressed')==='true');
  await page.locator('#workspace-practice').click();
  await page.locator('#workspace-learn').click();
  assert.equal(await page.locator('#learn-listen').getAttribute('aria-pressed'),'false','Changing workspace stops the previous lesson');
  assert.deepEqual(await savedProject(page),beforeListening,'Lesson playback and cancellation leave all project data intact');
  await page.locator('#learn-listen').click();
  await page.waitForFunction(()=>document.querySelector('#learn-listen')?.getAttribute('aria-pressed')==='true');
  await page.locator('[data-panel="exercise"]').focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.querySelector('#playButton')?.getAttribute('aria-pressed')==='true');
  assert.equal(await page.locator('#learn-listen').getAttribute('aria-pressed'),'false','Keyboard pattern playback stops the scale preview');
  await page.locator('#playButton').click();
  await page.locator('#learn-topic-modes').click();
  const expectedMasks=await page.evaluate(async()=>{
    const {maskFor,SCALE_DEFS}=await import('./src/theory.js');
    const p=JSON.parse(localStorage.getItem('tonedef.current.v2'));
    return SCALE_DEFS.slice(0,7).map(scale=>maskFor(p.settings.tonic,scale.intervals));
  });
  for(let index=0;index<7;index++) {
    await page.locator(`[data-learn-scale="${index}"]`).click();
    const chosen=await savedProject(page);
    assert.equal(chosen.settings.keyMask,expectedMasks[index],'Each mode applies its own interval recipe around home');
    assert.equal(chosen.settings.tonic,original.settings.tonic,'Mode comparison keeps the same home note');
    assert.deepEqual(chosen.events,original.events,'Mode comparison leaves the existing pattern intact');
    assert.deepEqual(instrumentOf(chosen),instrumentOf(original),'Mode comparison leaves the guitar intact');
    assert.equal(await page.locator(`[data-learn-scale="${index}"]`).getAttribute('aria-pressed'),'true');
    assert.equal(await page.evaluate(()=>document.activeElement.id),`learn-scale-${index}`,'Mode comparison retains focus');
  }
  await page.locator('[data-learn-scale="0"]').click();
  const beforePreview=await savedProject(page);
  const pitch=page.locator('[data-learn-pitch]').first();
  if(touch) await pitch.tap(); else await pitch.click();
  assert.equal(await pitch.getAttribute('aria-pressed'),'true','The chosen lesson note is visibly identified');
  assert.ok(await page.locator('.fret.learning-match').count()>0,'The lesson note is linked to matching positions on the neck');
  assert.ok((await page.locator('#expression-readout').textContent()).trim(),'The note preview has a readable pitch label');
  assert.deepEqual(await savedProject(page),beforePreview,'Hearing a lesson note does not alter the project');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'learn-pitch-0','Pitch preview retains focus');
  if(touch) await page.locator('[data-pos="s0:0"]').tap(); else await page.locator('[data-pos="s0:0"]').click();
  assert.equal(await page.locator('[data-learn-pitch]').first().getAttribute('aria-pressed'),'false','Playing a different fret clears the stale strip selection');
  const matchedPitches=await page.locator('.fret.learning-match').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.pc)));
  assert.ok(matchedPitches.length>0&&matchedPitches.every(pc=>pc===original.settings.open0%12),'The neck highlight follows the auditioned fret');
  await page.locator('[data-pos="s0:2"]').evaluate(node=>node.click());
  assert.equal((await page.locator('#expression-readout').textContent()).trim(),'F♯2','Assistive click activation announces the newly heard pitch');
  await page.locator('[data-pos="s0:0"]').focus();
  await page.keyboard.down('Space');
  await page.waitForFunction(()=>document.querySelectorAll('.fret.sounding').length===1);
  await page.keyboard.up('Space');
  assert.equal(await page.locator('.fret.sounding').count(),0,'Keyboard audition releases despite the stored Studio mute preference');
  assert.deepEqual(await savedProject(page),beforePreview,'The beginner fretboard auditions rather than editing existing notes');
  await page.locator('#playButton').click();
  await page.waitForFunction(()=>document.querySelector('#playButton')?.getAttribute('aria-pressed')==='true');
  await page.locator('#playButton').click();
  assert.equal(await page.locator('#playButton').getAttribute('aria-pressed'),'false','One header control starts and stops the saved pattern');
  assert.deepEqual(await savedProject(page),beforePreview,'Pattern playback leaves learning and practice data intact');
  await simpleGeometry(page,`${label} Modes`);
  await page.screenshot({path:path.join(output,`${label}-modes.png`),fullPage:true});
  await page.locator('#workspace-practice').click();
  assert.equal(await page.locator('#workspace-practice').getAttribute('aria-pressed'),'true');
  assert.deepEqual(await savedProject(page),beforePreview,'Opening Practice does not replace existing music');
  assert.equal(await page.locator('#practice-more').getAttribute('open'),null,'Extra choices start closed');
  assert.equal(await page.locator('#practice-shape').getAttribute('open'),null,'Shape choices start folded so New pattern is immediately reachable');
  assert.equal(await page.locator('#practice-new').isVisible(),true);
  await page.locator('#practice-shape > summary').click();
  assert.equal(await page.locator('#setting-generationType').isVisible(),true,'Pattern type is reachable inside Shape next pattern');
  assert.equal(await page.locator('#practice-countMin,#practice-stringsMin,#practice-notesPerStringMin').count(),0,'Random bounds stay out of the way until requested');
  for(const key of ['keyRandom','modeRandom','countRandom','stringsRandom','notesPerStringRandom']) {
    assert.equal(await page.locator(`#practice-${key}`).isChecked(),false,`${key}: randomization requires an explicit choice`);
  }
  const available=await page.locator('[data-practice-string]:enabled').evaluateAll(nodes=>nodes.map(node=>node.dataset.practiceString));
  assert.ok(available.length>=2,'The starting guitar has at least two strings');
  for(const id of available) assert.equal(await page.locator(`#practice-string-${id}`).getAttribute('aria-pressed'),'true','Available strings begin selected');
  for(const id of available) {
    const expected=original.settings.stringCount-Number(id.slice(1));
    assert.equal((await page.locator(`#practice-string-${id} small`).textContent()).trim(),String(expected),'String numbers follow conventional high-string-first numbering');
    assert.match(await page.locator(`#practice-string-${id}`).getAttribute('aria-label'),new RegExp(`\\bstring ${expected}\\b`,'i'));
  }
  await page.locator('#setting-tonic').selectOption('0');
  await page.locator('#collection').selectOption('0');
  await page.locator('#setting-eventCount').fill('8');await page.locator('#setting-eventCount').press('Tab');
  for(const id of available.slice(2)) await page.locator(`#practice-string-${id}`).click();
  await page.locator('#practice-notesPerString').focus();
  await page.locator('#practice-notesPerString').selectOption('16');
  assert.equal((await savedProject(page)).practice.notesPerString,16,'The UI preserves the full supported grouping range');
  await page.locator('#practice-notesPerString').selectOption('2');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'practice-notesPerString','Group selection retains focus');
  await page.locator('#practice-more > summary').click();
  await page.locator('#setting-generationType').selectOption('melody');
  await page.locator('#setting-sequencePattern').selectOption('free');
  await page.locator('#setting-melodicContour').selectOption('random');
  await page.locator('#setting-rhythmPattern').selectOption('triplets');
  assert.equal(await page.locator('#setting-duration').count(),0,'A rhythm recipe does not show an ignored steady-note duration');
  await page.locator('#setting-rhythmPattern').selectOption('steady');
  assert.equal(await page.locator('#setting-duration').isVisible(),true);
  await page.locator('#setting-generationType').selectOption('chord');
  const incompatible=await savedProject(page);
  assert.equal(await page.locator('#practice-free-strings').isVisible(),true,'Chord/group incompatibility has an explicit correction');
  await page.locator('#practice-free-strings').click();
  const corrected=await savedProject(page);
  assert.equal(corrected.practice.notesPerString,0);
  assert.equal(corrected.practice.notesPerStringRandom,false);
  assert.equal(corrected.settings.generationType,'chord','Correction keeps the chosen pattern type');
  assert.deepEqual(corrected.events,incompatible.events,'Correction does not regenerate the existing music');
  await page.locator('[data-action="undo"]').click();
  assert.deepEqual(await savedProject(page),incompatible,'One Undo restores the grouping correction');
  await page.locator('#setting-generationType').selectOption('melody');
  const fixed=await savedProject(page);
  assert.deepEqual(fixed.events,original.events,'Choosing practice constraints does not replace existing music');
  const generated=await generatePractice(page);
  assert.equal(generated.events.length,8);
  assert.equal(generated.settings.tonic,0);
  assert.equal(generated.settings.keyMask,fixed.settings.keyMask);
  assert.deepEqual(instrumentOf(generated),instrumentOf(fixed),'Practice never randomizes the instrument');
  assert.deepEqual(generated.events.map(event=>event.notes[0]?.stringId),Array.from({length:8},(_,index)=>available[Math.floor(index/2)%2]),'Two-note groups cycle through only the selected strings');
  for(const event of generated.events) {
    assert.equal(event.kind,'melody');
    assert.equal(event.notes.length,1);
    const note=event.notes[0],midi=generated.settings['open'+note.stringId.slice(1)]+note.fret;
    assert.ok(generated.settings.keyMask & (1<<((midi%12+12)%12)),'Practice uses the fixed key');
  }
  await page.locator('[data-event]').first().click();
  await page.locator('[data-action="lock-event"]').click();
  const locked=await savedProject(page),kept=locked.events.find(event=>event.id===locked.selectedId);
  assert.equal(kept.locked,true);
  await page.locator(`#practice-string-${kept.notes[0].stringId}`).click();
  const impossible=await savedProject(page);
  await page.locator('#practice-new').click();
  await page.waitForFunction(()=>document.querySelector('#practice-new')?.disabled===false&&document.querySelector('#practice-error'));
  assert.equal(await page.locator('#practice-error').getAttribute('role'),'alert');
  assert.ok((await page.locator('#practice-error').innerText()).trim(),'An impossible kept-note choice explains the problem beside generation');
  assert.deepEqual(await savedProject(page),impossible,'A failed pattern leaves notes, options and seed unchanged');
  if(!touch) {
    await page.locator('#toast.error').waitFor({state:'detached',timeout:15000});
    assert.equal(await page.locator('#practice-error').isVisible(),true,'The correction message outlives the temporary toast');
  }
  await page.locator('[data-action="undo"]').click();
  assert.deepEqual(await savedProject(page),locked,'One Undo restores the valid string selection after a failed generation');
  const regenerated=await generatePractice(page);
  assert.equal(await page.locator('#practice-error').count(),0,'Successful generation clears the previous durable error');
  assert.deepEqual(regenerated.events.find(event=>event.id===kept.id),kept,'New pattern preserves a kept note exactly');
  assert.notEqual(regenerated.settings.seed,locked.settings.seed,'New pattern advances the seed');
  await page.locator('[data-action="undo"]').click();
  assert.deepEqual(await savedProject(page),locked,'One Undo restores the pattern, selection, options and seed');
  await page.locator('[data-action="lock-event"]').click();
  for(const key of ['keyRandom','modeRandom','countRandom','stringsRandom','notesPerStringRandom']) await page.locator(`#practice-${key}`).check();
  for(const selector of ['#setting-tonic','#collection','#setting-eventCount','#practice-notesPerString']) assert.equal(await page.locator(selector).isDisabled(),true,`${selector}: a randomized field cannot misleadingly edit an ignored fixed value`);
  assert.equal(await page.locator('#practice-random-bounds').count(),0);
  for(const id of available) assert.equal(await page.locator(`#practice-string-${id}`).isEnabled(),true,'The random string pool remains editable');
  for(const [id,value] of [['countMin',5],['countMax',5],['stringsMin',1],['stringsMax',1],['notesPerStringMin',3],['notesPerStringMax',3]]) {
    await page.locator(`#practice-${id}`).fill(String(value));await page.locator(`#practice-${id}`).press('Tab');
  }
  const optedIn=await savedProject(page),randomized=await generatePractice(page);
  assert.equal(randomized.events.length,5,'Random note count obeys its exact configured bounds');
  const usedStrings=[...new Set(randomized.events.flatMap(event=>event.notes.map(note=>note.stringId)))];
  assert.equal(usedStrings.length,1,'Random strings obey their exact configured count');
  assert.ok(available.slice(0,2).includes(usedStrings[0]),'Random string choice stays inside the selected pool');
  assert.deepEqual(randomized.practice,optedIn.practice,'Generation retains the user’s randomization configuration');
  assert.deepEqual(instrumentOf(randomized),instrumentOf(optedIn),'Random choices preserve tuning, enabled strings, capo and ranges');
  const mutable=new Set(['seed','tonic','tonicSpelling','keyMask','eventCount']);
  for(const [key,value] of Object.entries(optedIn.settings)) if(!mutable.has(key)) assert.deepEqual(randomized.settings[key],value,`Practice randomization preserves ${key}`);
  await page.locator('[data-action="undo"]').click();
  assert.deepEqual(await savedProject(page),optedIn,'Undo restores all data after randomized generation');
  await page.locator('#practice-more > summary').click();
  await simpleGeometry(page,`${label} Practice`);
  await page.screenshot({path:path.join(output,`${label}-practice.png`),fullPage:true});
  await page.reload();await page.waitForSelector('#practice-new');
  assert.equal(await page.locator('#workspace-practice').getAttribute('aria-pressed'),'true','The chosen view survives reload');
  assert.deepEqual(await savedProject(page),optedIn,'Practice configuration and music survive reload');
  await page.locator('[data-workspace-mode="learn"]').click();
  assert.deepEqual(await savedProject(page),optedIn,'Returning to Learn preserves practice work');
  report.interactions.push({viewport:label,checks:['fresh Learn default','topic-first controls and contextual scale choice','no advanced reference clutter','44px learning/practice controls','Notes/Steps/Scales/Modes navigation','transient lesson play/stop/restart/Escape/navigation cancellation','seven parallel-mode masks','synchronized strip/neck preview without mutation','learner audition independent of Studio preference','single pattern Play/Stop control','conventional string numbers','explicit randomization opt-ins with disabled fixed fields and inline limits','fixed key/count/string pool','full notes-per-string grouping range','explicit chord/grouping correction and Undo','kept-note generation and persistent atomic failure feedback','new-pattern seed advance','one-step complete Undo','bounded random count and strings','instrument protection','view/configuration persistence','keyboard focus']});
}
async function overviewInteractions(page,label) {
  assert.equal(await page.locator('[data-workspace-mode="overview"]').getAttribute('aria-pressed'),'true','Studio shows every analysis area');
  // The initial example is intentionally unsaved until a user edits it.
  await page.locator('#project-title').fill('Overview exercise check');
  await page.locator('#project-title').press('Tab');
  const original = await savedProject(page);
  await page.locator('#exercise-recipe').focus();
  await page.locator('#exercise-recipe').selectOption('triplet-groups');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'exercise-recipe','Recipe remains keyboard focused after rendering');
  const configured = await savedProject(page);
  assert.deepEqual(configured.events,original.events,'Choosing a recipe leaves existing music intact');
  for (const key of ['stringCount','fretCount','capo','fretMin','fretMax','practiceRanges','tonic','keyMask','seed']) {
    assert.deepEqual(configured.settings[key],original.settings[key],`Recipe preserves ${key}`);
  }
  assert.equal(await page.locator('#setting-sequencePattern').inputValue(),'groups3');
  assert.equal(await page.locator('#setting-rhythmPattern').inputValue(),'triplets');
  await page.locator('#setting-sequencePattern').focus();
  await page.locator('#setting-sequencePattern').selectOption('thirds');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'setting-sequencePattern','Sequence selection preserves focus');
  await page.locator('#setting-rhythmPattern').focus();
  await page.locator('#setting-rhythmPattern').selectOption('eighth-quarter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'setting-rhythmPattern','Rhythm selection preserves focus');
  await page.locator('#practice-ranges > summary').click();
  await page.locator('#range-value-0-min').fill('3');
  await page.locator('#range-value-0-min').press('Tab');
  await page.locator('#range-value-0-max').fill('9');
  await page.locator('#range-value-0-max').press('Tab');
  const generated = await generate(page);
  assert.equal(generated.events.length,12);
  assert.equal(generated.settings.sequencePattern,'thirds');
  assert.equal(generated.settings.rhythmPattern,'eighth-quarter');
  assert.deepEqual(generated.settings.practiceRanges[0],{min:3,max:9});
  for (const [i,event] of generated.events.entries()) {
    assert.equal(event.kind,'melody');
    assert.equal(event.duration,i%2===0?48:96);
    for (const note of event.notes) {
      const index=Number(note.stringId.slice(1)),s=generated.settings,range=s.practiceRanges[index];
      assert.ok(note.fret>=Math.max(s.fretMin,range.min)&&note.fret<=Math.min(s.fretMax,range.max),'Generated note respects physical string range');
      assert.ok(s['enabled'+index],'Generated string is enabled');
      const midi=s['open'+index]+note.fret;
      assert.ok(Boolean(s.keyMask & (1<<((midi%12+12)%12))),'Generated note belongs to the chosen collection');
    }
  }
  assert.equal(await page.evaluate(()=>document.activeElement.id),'generate-exercise','Generating restores its action focus');
  await page.locator('[data-event]').first().click();
  await page.locator('[data-action="lock-event"]').click();
  const locked = await savedProject(page),lockedEvent=locked.events.find(event=>event.id===locked.selectedId);
  assert.equal(lockedEvent.locked,true);
  const varied=await generate(page,'variation');
  assert.notEqual(varied.settings.seed,locked.settings.seed,'Variation advances the seed');
  assert.deepEqual({...varied.settings,seed:locked.settings.seed},locked.settings,'Variation preserves all constraints and instrument settings');
  assert.deepEqual(varied.events.find(event=>event.id===lockedEvent.id),lockedEvent,'Variation preserves the locked event exactly');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'vary-exercise','Variation restores its action focus');
  await page.locator('[data-action="undo"]').click();
  assert.deepEqual(await savedProject(page),locked,'One Undo restores the complete pre-variation project');
  await page.locator('#playButton').click();
  await page.waitForFunction(()=>document.querySelector('.board-context').textContent.startsWith('Playing · '));
  await page.locator('[data-action="stop"]').click();
  assert.equal(await page.locator('#playButton').getAttribute('aria-pressed'),'false');
  assert.deepEqual(await savedProject(page),locked,'Playback does not alter the exercise');
  const melodyLabels=await page.locator('#interval-from option').allTextContents();
  assert.deepEqual(melodyLabels.map(text=>Number(text.match(/ · Event (\d+)/)?.[1])),[1,2,3,4],'Melody comparison identifies nearby events by their original position');
  await page.locator('#practice-ranges > summary').click();
  await page.locator('[data-action="settings"]').click();
  assert.ok(await page.locator('[data-panel="settings"]').isVisible(),'Settings shortcut works in Overview');
  await page.locator('#overview-expand-fretboard').click();
  assert.equal(await page.locator('#overview-expand-fretboard').getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#overview-expand-fretboard').getAttribute('aria-expanded'),'false','Escape returns from a focused panel');
  assert.deepEqual(await savedProject(page),locked,'Expanding a panel leaves the exercise intact');
  await geometry(page,`${label} generated Overview`);
  await page.screenshot({path:path.join(output,`${label}-exercise.png`),fullPage:true});
  report.interactions.push({viewport:label,checks:['Overview all eight panels','recipe preserves existing music and instrument','sequence/rhythm field focus','per-string generation bounds','recipe generation worker','event lock','seed-only Variation','one-step Undo','play/stop','Overview Settings shortcut','expand/Escape without music changes']});
}
async function interact(page,label,touch) {
  // Custom arranging is deliberately offered inside Studio, away from Learn.
  await page.locator('[data-workspace-mode="overview"]').click();
  await page.locator('[data-workspace-mode="custom"]').click();
  const originalNotes = await page.locator('.fret.selected').count();
  assert.equal(await page.locator('.shape-line').count(),originalNotes-1);
  await page.locator('#workspace-controls > summary').click();
  await page.locator('#layout-edit-').click();
  const initialOrder = await page.locator('.dock-panel').evaluateAll(es => es.map(e => e.dataset.panel));
  const timelineIndex = initialOrder.indexOf('timeline');
  assert.ok(timelineIndex > 0, 'Timeline starts after another panel');
  const expectedOrder = [...initialOrder];
  [expectedOrder[timelineIndex - 1], expectedOrder[timelineIndex]] = [expectedOrder[timelineIndex], expectedOrder[timelineIndex - 1]];
  await page.locator('#layout-earlier-timeline').click();
  assert.deepEqual(await page.locator('.dock-panel').evaluateAll(es=>es.map(e=>e.dataset.panel)),expectedOrder);
  await page.locator('#layout-resize-fretboard').press('ArrowLeft');
  await page.locator('#layout-resize-fretboard').press('ArrowDown');
  const resized = await page.locator('#panel-body-fretboard').getAttribute('style');
  await page.locator('#layout-collapse-fretboard').click();
  await page.reload(); await page.waitForSelector('.dock-panel');
  assert.deepEqual(await page.locator('.dock-panel').evaluateAll(es=>es.map(e=>e.dataset.panel)),expectedOrder);
  assert.ok(await page.locator('#panel-body-fretboard').isHidden());
  assert.equal(await page.locator('#panel-body-fretboard').getAttribute('style'),resized);
  const savedArrangement = await page.evaluate(()=>localStorage.getItem('tonedef.workspace.v1'));
  await page.locator('[data-workspace-mode="overview"]').click();
  await geometry(page,`${label} Overview after arranging`);
  assert.equal(await page.evaluate(()=>localStorage.getItem('tonedef.workspace.v1')),savedArrangement,'Overview does not overwrite the custom arrangement');
  await page.locator('[data-workspace-mode="custom"]').click();
  assert.deepEqual(await page.locator('.dock-panel').evaluateAll(es=>es.map(e=>e.dataset.panel)),expectedOrder);
  assert.ok(await page.locator('#panel-body-fretboard').isHidden());
  assert.equal(await page.locator('#panel-body-fretboard').getAttribute('style'),resized);
  await page.locator('#workspace-controls > summary').click();
  await page.locator('#layout-show-math').uncheck();
  assert.ok(await page.locator('[data-panel="math"]').isHidden());
  await page.locator('#layout-reset-').click();
  assert.ok(await page.locator('[data-panel="math"]').isVisible());
  assert.equal(await page.locator('.fret.selected').count(),originalNotes);
  await page.locator('#workspace-controls > summary').click();
  // Expressive preview never mutates the saved fingering; full cells remain targets.
  await page.getByLabel('Hear clicks',{exact:true}).check();
  await page.locator('[data-tool="explore"]').click();
  const expressiveBefore = await page.evaluate(()=>localStorage.getItem('tonedef.current.v2'));
  const expressionFret = page.locator('[data-pos="s3:0"]');
  await expressionFret.focus();
  await page.keyboard.down('Space');
  await page.waitForFunction(()=>document.querySelectorAll('.fret.sounding').length===1);
  await page.keyboard.press('ArrowUp');
  assert.match(await page.locator('#expression-readout').textContent(),/bend \+25 cents/);
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('#expression-readout').textContent(),/slide/);
  await page.keyboard.up('Space');
  assert.equal(await page.locator('.fret.sounding').count(),0);
  await page.keyboard.down('Space');await page.keyboard.press('Escape');await page.keyboard.up('Space');
  assert.equal(await page.locator('.fret.sounding').count(),0);
  if(touch) await expressionFret.tap(); else await expressionFret.click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('tonedef.current.v2')),expressiveBefore);
  await page.locator('[data-tool="notes"]').click();
  const fret=page.locator('.fret').first(), selected=await fret.getAttribute('aria-pressed');
  await fret.click();assert.notEqual(await fret.getAttribute('aria-pressed'),selected);
  await page.locator('[data-action="undo"]').click();assert.equal(await fret.getAttribute('aria-pressed'),selected);
  await fret.focus();const position=await fret.getAttribute('data-pos');await page.keyboard.press('ArrowRight');
  assert.notEqual(await page.evaluate(()=>document.activeElement.dataset.pos),position);
  await page.keyboard.press('Escape');
  const stored=await page.evaluate(()=>localStorage.getItem('tonedef.current.v2'));
  assert.equal(await page.locator('.distance-matrix').count(),0,'Intervals use one focused From/To comparison');
  await page.locator('#interval-from').focus();
  await page.locator('#interval-from').selectOption('0');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'interval-from','From selection retains keyboard focus');
  await page.locator('#interval-to').focus();
  await page.locator('#interval-to').selectOption('3');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'interval-to','To selection retains keyboard focus');
  await page.locator('#pitch-detail > summary').click();
  assert.match(await page.locator('.math-readout').innerText(),/\+12/);
  assert.match(await page.locator('.equation').innerText(),/2\.0000/);
  await page.locator('#interval-swap').focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.math-readout').innerText(),/-12/);
  assert.match(await page.locator('.equation').innerText(),/0\.5000/);
  assert.equal(await page.locator('#interval-from').inputValue(),'3');
  assert.equal(await page.locator('#interval-to').inputValue(),'0');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'interval-swap','Swapping direction retains keyboard focus');
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
  await page.locator('#setting-colorReference').selectOption('chord');
  await page.locator('[data-event]').nth(1).click();assert.equal(await page.locator('[data-event]').nth(1).getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('.reference-readout').textContent(),/A chord root/);
  const editPositions = await page.locator('.fret.selected').evaluateAll(nodes=>nodes.map(n=>n.dataset.pos));
  await page.locator('#playButton').click();
  await page.waitForFunction(()=>document.querySelector('.board-context').textContent.startsWith('Playing · '));
  assert.equal(await page.locator('.board-context').textContent(), 'Playing · '+await page.locator('.event-card.playing strong').textContent());
  assert.ok(await page.locator('.fret:disabled').count()>0);
  assert.match(await page.locator('.reference-readout').textContent(),/C chord root/,'Playback reference follows the sounding chord');
  await page.locator('[data-action="stop"]').click();assert.equal(await page.locator('#playButton').getAttribute('aria-pressed'),'false');
  assert.match(await page.locator('.reference-readout').textContent(),/A chord root/,'Stopping restores the selected chord reference');
  assert.deepEqual(await page.locator('.fret.selected').evaluateAll(nodes=>nodes.map(n=>n.dataset.pos)),editPositions);
  assert.equal(await page.locator('.fret:disabled').count(),0);
  for(const tab of ['chromatic','fifths']) {await page.locator(`[data-tools-tab="${tab}"]`).click();assert.equal(await page.locator(`[data-tools-tab="${tab}"]`).getAttribute('aria-pressed'),'true');}
  await page.locator('[data-action="projects"]').click();assert.ok(await page.locator('dialog').evaluate(e=>e.open));
  assert.equal(await page.locator('dialog').getAttribute('aria-labelledby'),'dialog-title');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'save-name');
  const beforeProjects = await page.evaluate(()=>localStorage.getItem('tonedef.current.v2'));
  await page.locator('#save-name').fill('Practice copy');
  await page.getByRole('button',{name:'Save named copy',exact:true}).click();
  assert.ok(await page.locator('#dialog-feedback').isVisible());
  assert.match(await page.locator('#dialog-feedback').textContent(),/Named copy saved/);
  assert.equal(await page.locator('[data-load-project]').first().textContent(),'Practice copy '+await page.locator('[data-load-project] small').first().textContent());
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Import JSON',exact:true}).focus();
  await page.keyboard.press('Enter');
  await (await chooser).setFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
  await page.waitForFunction(()=>document.querySelector('#dialog-feedback')?.getAttribute('role')==='alert');
  assert.ok(await page.locator('#dialog-feedback').isVisible());
  assert.match(await page.locator('#dialog-feedback').textContent(),/This file is not valid JSON\. Choose a ToneDef JSON backup and try again\./);
  assert.equal(await page.evaluate(()=>localStorage.getItem('tonedef.current.v2')),beforeProjects,'Saving a copy and failed import preserve the active project');
  const cardDownload = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export practice card',exact:true}).click();
  const card = await cardDownload;
  assert.equal(card.suggestedFilename(),'tonedef-practice.md');
  const chunks=[];for await(const chunk of await card.createReadStream())chunks.push(chunk);
  const markdown=Buffer.concat(chunks).toString('utf8');
  assert.ok(markdown.includes('ToneDef practice card')&&markdown.includes('## Pattern'));
  assert.ok(markdown.includes('JSON backup for re-import'));
  await page.locator('[data-action="close-modal"]').click();
  await page.locator('#practice-ranges > summary').click();
  const rangeBefore = await page.evaluate(()=>JSON.parse(localStorage.getItem('tonedef.current.v2')));
  await page.locator('#range-value-0-min').fill('5');
  await page.locator('#range-value-0-min').press('Tab');
  assert.equal(await page.locator('#range-0-min').getAttribute('aria-valuenow'),'5');
  await page.locator('#range-0-min').focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#range-0-min').getAttribute('aria-valuenow'),'6');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'range-0-min');
  // Internal s0 (the lowest string) is the last visual row. Its lower thumb may be below the viewport
  // even after focusing the upper thumb, particularly with Linux fonts.
  await page.locator('#range-0-max').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
  await settle(page);
  const track = await page.locator('[data-range-track="0"]').boundingBox();
  const handle = await page.locator('#range-0-max').boundingBox();
  assert.ok(handle.y >= 0 && handle.y + handle.height <= page.viewportSize().height,
    `${label}: drag handle is entirely in the viewport before coordinate input`);
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
  await page.mouse.move(track.x+track.width*10/36,handle.y+handle.height/2,{steps:8});await page.mouse.up();
  assert.equal(await page.locator('#range-0-max').getAttribute('aria-valuenow'),'10');
  await page.locator('[data-action="undo"]').click();
  assert.equal(await page.locator('#range-0-max').getAttribute('aria-valuenow'),'36','One drag is one undo entry');
  await page.locator('#range-0-max').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
  await settle(page);
  const cancelTrack=await page.locator('[data-range-track="0"]').boundingBox();
  const cancelHandle=await page.locator('#range-0-max').boundingBox();
  await page.mouse.move(cancelHandle.x+cancelHandle.width/2,cancelHandle.y+cancelHandle.height/2);await page.mouse.down();
  await page.mouse.move(cancelTrack.x+cancelTrack.width*12/36,cancelHandle.y+cancelHandle.height/2);await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await page.locator('#range-0-max').getAttribute('aria-valuenow'),'36');
  const rangeSaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tonedef.current.v2')));
  assert.deepEqual(rangeSaved.events,rangeBefore.events,'Range edits preserve existing music');
  assert.equal(rangeSaved.settings.practiceRanges[0].min,6);
  await geometry(page,`${label} practice ranges`);
  await page.screenshot({path:path.join(output,`${label}-practice-ranges.png`),fullPage:true});
  await page.reload();await page.waitForSelector('.fret');
  await page.locator('#practice-ranges > summary').click();
  assert.equal(await page.locator('#range-0-min').getAttribute('aria-valuenow'),'6');
  await page.locator('[data-action="ranges-reset"]').click();
  await page.locator('#practice-ranges > summary').click();
  await page.locator('[data-action="settings"]').click();
  await page.locator('#exercise-random > summary').click();
  await page.locator('#show-random').check();assert.ok(await page.locator('[data-random]').count()>10);
  await page.locator('#instrument-detail > summary').click();
  await page.locator('#setting-labels').selectOption('both');assert.ok(await page.locator('.note-disc small').count()>0);
  await geometry(page,`${label} settings`);await page.keyboard.press('Escape');
  await page.screenshot({path:path.join(output,`${label}-settings.png`),fullPage:true});
  await page.locator('[data-action="generate"]').click();
  await page.waitForFunction(()=>!document.querySelector('[data-action="generate"]').disabled,null,{timeout:20000});
  assert.equal(await page.locator('.toast.error').count(),0);assert.ok(await page.locator('[data-event]').count()>0);
  await geometry(page,`${label} generated`);
  assert.equal(await page.locator('#setting-melodicContour').count(),0);
  await page.locator('#setting-generationType').selectOption('melody');
  await page.locator('#setting-melodicContour').selectOption('ascending');
  await page.locator('#exercise-constraints > summary').click();
  await page.locator('#setting-repeatNotes').uncheck();
  await page.locator('#setting-eventCount').fill('8');
  await page.locator('#setting-eventCount').press('Tab');
  await page.locator('[data-action="generate"]').click();
  await page.waitForFunction(()=>!document.querySelector('[data-action="generate"]').disabled,null,{timeout:20000});
  assert.equal(await page.locator('.toast.error').count(),0);
  const generated=await page.evaluate(()=>JSON.parse(localStorage.getItem('tonedef.current.v2')));
  assert.equal(generated.events.length,8);
  const pitches=generated.events.map(e=>generated.settings['open'+e.notes[0].stringId.slice(1)]+e.notes[0].fret);
  assert.ok(pitches.every((m,i)=>!i||m>pitches[i-1]));
  assert.equal(await page.locator('[data-mode="melody"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-pos="s5:12"]').click();
  assert.equal(await page.locator('.toast.error').count(),0);
  const edited=await page.evaluate(()=>JSON.parse(localStorage.getItem('tonedef.current.v2')));
  assert.equal(edited.settings.editorMode,'melody');
  assert.equal(edited.events[0].notes.length,1);
  assert.equal(edited.events[0].notes[0].fret,12);
  await page.locator('[data-action="undo"]').click();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('tonedef.current.v2'))),generated);
  await page.reload();await page.waitForSelector('.fret');
  await page.locator('[data-action="settings"]').click();
  assert.equal(await page.locator('#setting-melodicContour').inputValue(),'ascending');
  // Empty chord motion keeps its place and explains how to populate it.
  assert.match(await page.locator('.transition-panel .empty').textContent(),/two chords/);
  await geometry(page,`${label} melody contour`);
  await page.screenshot({path:path.join(output,`${label}-contour.png`),fullPage:true});
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
  // Every advanced setting and its opt-in randomization flag remains reachable.
  await page.locator('[data-mode="melody"]').click();
  await page.locator('#setting-colorReference').selectOption('pinned');
  await page.locator('#setting-generationType').selectOption('melody');
  await page.locator('#exercise-random > summary').click();
  await page.locator('#show-random').check();
  const inventory=await page.evaluate(async()=>{
    const {SCHEMA}=await import('./src/model.js');
    const controls=[...document.querySelectorAll('[data-setting]')].map(node=>node.dataset.setting);
    controls.push('keyMask',...[...document.querySelectorAll('[data-tuning]')].map(node=>'open'+node.dataset.tuning));
    const flags=[...document.querySelectorAll('[data-random]')].map(node=>node.dataset.random);
    return {keys:Object.keys(SCHEMA).sort(),controls:controls.sort(),flags:flags.sort()};
  });
  assert.deepEqual(inventory.controls,inventory.keys,'Every setting has exactly one control');
  assert.deepEqual(inventory.flags,inventory.keys,'Every setting has exactly one randomization flag');
  await page.locator('[data-action="add"][data-kind="rest"]').click();
  assert.ok(await page.locator('.math-panel .empty').isVisible());await geometry(page,`${label} rest`);
  report.interactions.push({viewport:label,checks:['edit/undo','fret keyboard','signed octave/ratio','From/To comparator and keyboard swap','non-mutating views','hover/focus/tap help + Escape','timeline','play/stop with sounding chord reference','theory tabs','Projects/practice-card download','every schema control/random flag once','practice-range numeric/keyboard/drag/cancel/undo/persistence','generation worker/melody contour/persistence','12 strings/36 frets/re-entrant tuning','empty/rest']});
}
try {
  for(const [width,height,touch] of [[1280,720,false],[390,844,true]]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch,deviceScaleFactor:1,reducedMotion:'reduce'});
    context.setDefaultTimeout(10000);
    const page=await context.newPage(),errors=[],label=`${width}x${height}-visual-practice`;
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/tonedef/',{waitUntil:'networkidle'});await page.waitForSelector('.fret');
    try { await visualPracticeChecks(page,{touch,output,label}); }
    catch(error) { await page.screenshot({path:path.join(output,label+'-failure.png'),fullPage:true});throw error; }
    assert.deepEqual(errors,[],`${label}: browser errors`);
    report.interactions.push({viewport:label,checks:['three membership sizes and current step','outside-key pattern shape','recall wrong/correct/keyboard/hidden hints','melody register and project preservation','value drag preview/commit/Undo/Escape','whole random-bound drag/crossing/cancel','whole fret-window drag/Home/End/Undo','left-handed direction/persistence',...(touch?['native touch movement and cancellation']:[])]});
    console.log(`PASS ${label}`);await context.close();
  }
  for(const [width,height,touch] of [[1366,768,false],[1280,720,false],[390,844,true],[320,800,true]]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch,deviceScaleFactor:1,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
    const label=`${width}x${height}-learner${touch?'-touch':''}`;
    await page.goto(origin+'/tonedef/',{waitUntil:'networkidle'});await page.waitForSelector('.fret');
    await learnerInteractions(page,label,touch);
    try {
      const checks=await learningPathChecks(page,{touch,label,output});
      report.interactions.push({viewport:label,checks});
      report.interactions.push({viewport:label,checks:await focusedPracticeChecks(page,{touch,label,output})});
    } catch(error) {
      await page.screenshot({path:path.join(output,`${label}-learning-failure.png`),fullPage:true});
      throw error;
    }
    assert.deepEqual(errors,[],`${label}: browser/network errors`);
    console.log(`PASS ${label}: Learn, Practice and configured generation`);
    await context.close();
  }
  for(const [width,height,touch] of [[2560,1440,false],[1920,1080,false],[1440,1000,false],[1440,900,false],[1366,768,false],[1280,900,false],[1100,900,false],[1024,768,false],[850,1000,false],[768,1024,true],[650,900,false],[570,900,true],[390,844,true],[360,800,true],[320,800,true]]) {
    const options={viewport:{width,height},hasTouch:touch,deviceScaleFactor:1,reducedMotion:'reduce'};
    const context=await browser.newContext(options),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    const label=`${width}x${height}${touch?'-touch':'-desktop'}`;
    await page.goto(origin+'/tonedef/',{waitUntil:'networkidle'});await page.waitForSelector('.fret');
    // Keep the original advanced-workspace fixture explicit now that new learners
    // start with a short single-note scale instead of the progression example.
    await page.evaluate(async()=>{
      const {example}=await import('./src/model.js');
      localStorage.setItem('tonedef.current.v2',JSON.stringify(example('progression')));
    });
    await page.reload();await page.waitForSelector('.fret');
    await page.locator('[data-workspace-mode="overview"]').click();
    const after=await geometry(page,label),entry={width,touch,after};
    if([1440,390].includes(width)) {
      const oldContext=await browser.newContext(options),oldPage=await oldContext.newPage();
      await oldPage.goto(origin+'/baseline/',{waitUntil:'networkidle'});await oldPage.waitForSelector('.fret');
      entry.before=await measure(oldPage);entry.pageHeightReductionPercent=Math.round(100*(1-after.pageHeight/entry.before.pageHeight));
      // User-adjustable areas and larger symbols supersede the old minimum-height target.
      // Retain before/after measurements without imposing the previous fixed layout.
      await oldPage.screenshot({path:path.join(output,`${label}-before.png`),fullPage:true});await oldContext.close();
    }
    await page.screenshot({path:path.join(output,`${label}-after.png`),fullPage:true});
    report.viewports.push(entry);
    if ((width===1440&&height===900)||width===1366) await overviewInteractions(page,label);
    if((width===1440&&height===1000)||width===390)await interact(page,label,touch);
    assert.deepEqual(errors,[],`${label}: browser/network errors`);
    console.log(`PASS ${label}: ${after.pageHeight}px, fretboard ${after.board.width}x${after.board.height}px`);
    await context.close();
  }
  console.log('VISUAL_WORKSPACE_REPORT='+JSON.stringify(report));
} finally {
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  await browser.close();await new Promise(resolve=>server.close(resolve));await rm(baseline,{recursive:true,force:true});
}
