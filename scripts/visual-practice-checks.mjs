import assert from 'node:assert/strict';
export async function visualPracticeChecks(page,{touch,output,label}) {
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tonedef.current.v2')));
  const undo=()=>page.locator('[data-action="undo"]').click();
  const openDetails=async id=>{if(!await page.locator('#'+id).evaluate(node=>node.open))await page.locator('#'+id+' > summary').click();};
  const commitNumber=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).press('Tab');};
  const center=async(selector)=>{await page.locator(selector).evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));return page.locator(selector).boundingBox();};
  async function dragWindow(selector,delta,{cancel=false,pointerCancel=false}={}) {
    const box=await center(selector),track=await page.locator(selector).locator('..').boundingBox();
    const domain=await page.locator(selector).locator('..').evaluate(node=>Number(node.dataset.windowMax)-Number(node.dataset.windowMin));
    const x=box.x+box.width/2,y=box.y+box.height/2;
    assert.ok(y>=0&&y<=page.viewportSize().height,'Gesture origin is visible');
    if(touch) {
      // Chromium's real touch input path, not synthetic DOM events.
      const session=await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+delta/domain*track.width,y}]});
      if(cancel)await page.keyboard.press('Escape');
      await session.send('Input.dispatchTouchEvent',{type:pointerCancel?'touchCancel':'touchEnd',touchPoints:[]});
      await session.detach();
    } else {
      await page.mouse.move(x,y);await page.mouse.down();
      await page.mouse.move(x+delta/domain*track.width,y,{steps:8});
      if(cancel)await page.keyboard.press('Escape');
      await page.mouse.up();
    }
  }
  await page.locator('#setting-tonic').selectOption('0');
  const original=await saved();
  const states=await page.locator('.fret').evaluateAll(nodes=>nodes.reduce((acc,node)=>{
    const state=node.dataset.noteState,disc=node.querySelector('.note-disc');
    acc[state]??={count:0,size:disc.getBoundingClientRect().width,radius:getComputedStyle(disc).borderRadius};acc[state].count++;return acc;
  },{}));
  assert.equal(states.pattern.count,8,'All eight physical pattern positions are visible');
  assert.ok(states.outside.size<states.key.size&&states.key.size<states.pattern.size,'Three membership sizes are distinct');
  assert.equal(await page.locator('.current-note').count(),1,'One current melody step');
  await page.locator('#workspace-overview').click();
  await page.locator('[data-key-pc="2"]').click();
  assert.equal(await page.locator('.pattern-outside').count(),1,'A borrowed pitch remains a visible pattern member');
  assert.equal(await page.locator('.pattern-outside .note-disc').evaluate(node=>getComputedStyle(node).borderStyle),'dashed');
  await undo();await page.locator('#workspace-learn').click();

  await page.locator('#recall > summary').click();await page.locator('#recall-start').click();
  const prompt=await page.locator('.recall-prompt').innerText(),target=prompt.match(/^Find (\S+) ·/)[1];
  const buttons=await page.locator('.fret').evaluateAll(nodes=>nodes.map(node=>({pos:node.dataset.pos,name:node.getAttribute('aria-label').split(',')[0]})));
  const matching=buttons.find(node=>node.name.replace(/-?\d+$/,'')===target);
  const wrong=buttons.find(node=>node.name.replace(/-?\d+$/,'')!==target);
  await page.locator(`[data-pos="${wrong.pos}"]`).click();
  assert.match(await page.locator('#recall-feedback').innerText(),/Try again/);
  await page.locator(`[data-pos="${matching.pos}"]`).press('Enter');
  assert.match(await page.locator('#recall-feedback').innerText(),/^Yes/);
  assert.equal(await page.locator('#recall-next').isEnabled(),true);
  assert.match(await page.locator('.recall-score').innerText(),/1 solved · 0 first try/);
  // Replaying a solved answer never increases the score.
  await page.locator(`[data-pos="${matching.pos}"]`).click();
  assert.match(await page.locator('.recall-score').innerText(),/1 solved · 0 first try/);
  await page.locator('#recall-hidden').check();
  assert.equal(await page.locator('.learning-strip').isVisible(),false);
  assert.equal(await page.locator('.simple-panel .timeline').isVisible(),false);
  assert.match(await page.locator('.fret').first().getAttribute('aria-label'),/^string \d+, fret \d+$/);
  assert.equal(await page.locator('.in-pattern .note-disc').first().evaluate(node=>getComputedStyle(node).fontSize),'0px','Hints hidden in symbol and accessible name');
  await page.locator('#recall-next').click();
  await page.locator('#recall-kind').selectOption('intervals');
  await page.locator('#recall-start').click();
  assert.match(await page.locator('.recall-prompt').innerText(),/half steps/);
  assert.doesNotMatch(await page.locator('.recall-prompt').innerText(),/\b[Mm][2367]\b/,'Interval names are written out');
  await page.locator('#recall-kind').selectOption('melody');await page.locator('#recall-start').click();
  assert.match(await page.locator('.recall-prompt').innerText(),/note 1 of 8/);
  // C4 has the right name but the wrong register for the starting C3.
  await page.locator('[data-pos="s4:1"]').click();assert.match(await page.locator('#recall-feedback').innerText(),/Try again/);
  await page.locator('[data-pos="s1:3"]').click();assert.match(await page.locator('#recall-feedback').innerText(),/^Yes/);
  await page.locator('#recall-hear').click();
  assert.deepEqual(await saved(),original,'Exploration, guessing and reference audio leave the project unchanged');
  await page.locator('#recall > summary').click();
  await page.locator('.simple-panel .timeline').waitFor({state:'visible'});
  assert.equal(await page.locator('.simple-panel .timeline').isVisible(),true);
  assert.match(await page.locator('.fret').first().getAttribute('aria-label'),/^E4,/);

  await page.locator('#workspace-practice').click();
  await openDetails('practice-shape');
  await page.locator('#drag-setting-eventCount').press('ArrowRight');
  assert.equal((await saved()).settings.eventCount,original.settings.eventCount+1);await undo();
  const speedBefore=await saved();
  const slider=await center('#drag-setting-tempo');
  await page.mouse.move(slider.x+slider.width*.3,slider.y+slider.height/2);await page.mouse.down();
  await page.mouse.move(slider.x+slider.width*.75,slider.y+slider.height/2,{steps:8});
  assert.deepEqual(await saved(),speedBefore,'Value drag previews without saving');
  await page.mouse.up();assert.notEqual((await saved()).settings.tempo,speedBefore.settings.tempo);await undo();
  assert.deepEqual(await saved(),speedBefore,'One Undo restores one completed value drag');
  const again=await center('#drag-setting-tempo');
  await page.mouse.move(again.x+again.width*.4,again.y+again.height/2);await page.mouse.down();
  await page.mouse.move(again.x+again.width*.8,again.y+again.height/2);await page.keyboard.press('Escape');
  await page.mouse.move(again.x+again.width*.9,again.y+again.height/2);await page.mouse.up();
  assert.deepEqual(await saved(),speedBefore,'Escape cancels even if the pointer continues moving');
  assert.equal(Number(await page.locator('#setting-tempo').inputValue()),speedBefore.settings.tempo);

  await page.locator('#practice-countRandom').check();
  assert.equal(await page.locator('#drag-setting-eventCount').isDisabled(),true);
  await commitNumber('practice-countMax',24);await commitNumber('practice-countMin',8);
  const countBefore=await saved();
  await dragWindow('#bounds-count-band',5);
  assert.deepEqual([(await saved()).practice.countMin,(await saved()).practice.countMax],[13,29]);
  await undo();assert.deepEqual(await saved(),countBefore,'Random bounds move in one transaction');
  await dragWindow('#bounds-count-min',100);
  assert.equal((await saved()).practice.countMin,24,'Dragged bounds never cross');await undo();
  await dragWindow('#bounds-count-band',5,{cancel:true});assert.deepEqual(await saved(),countBefore);
  if(touch){await dragWindow('#bounds-count-band',5,{pointerCancel:true});assert.deepEqual(await saved(),countBefore);}

  await page.locator('#practice-more > summary').click();await page.locator('#practice-ranges > summary').click();
  await commitNumber('range-value-0-max',12);await commitNumber('range-value-0-min',4);
  const rangeBefore=await saved();
  await dragWindow('#range-0-band',6);
  assert.deepEqual((await saved()).settings.practiceRanges[0],{min:10,max:18});
  assert.deepEqual((await saved()).events,rangeBefore.events,'Practice ranges never move existing notes');
  await undo();assert.deepEqual(await saved(),rangeBefore);
  await page.locator('#range-0-band').press('End');assert.deepEqual((await saved()).settings.practiceRanges[0],{min:28,max:36});
  await undo();await page.locator('#range-0-band').press('Home');assert.deepEqual((await saved()).settings.practiceRanges[0],{min:0,max:8});await undo();
  await page.screenshot({path:output+'/'+label+'-visual-practice.png',fullPage:true});
  // Left-handed ranges reverse only horizontal drag and arrow directions.
  await page.locator('#workspace-overview').click();
  await page.locator('#instrument-detail > summary').click();await page.locator('#setting-leftHanded').check();
  await page.locator('#workspace-practice').click();await openDetails('practice-shape');await openDetails('practice-more');await openDetails('practice-ranges');
  await page.locator('#range-0-band').press('ArrowRight');
  assert.deepEqual((await saved()).settings.practiceRanges[0],{min:3,max:11});await undo();
  await dragWindow('#range-0-band',-4);
  assert.deepEqual((await saved()).settings.practiceRanges[0],{min:8,max:16});
  await page.reload();await page.waitForSelector('.fret');
  assert.deepEqual((await saved()).settings.practiceRanges[0],{min:8,max:16},'Completed windows persist');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
}
