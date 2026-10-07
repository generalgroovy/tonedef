import assert from 'node:assert/strict';
import path from 'node:path';

export async function focusedPracticeChecks(page,{touch,label,output}) {
  const tap=async selector=>touch?await page.locator(selector).tap():await page.locator(selector).click();
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tonedef.current.v2')));
  const number=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).press('Tab');};
  await page.evaluate(async()=>{
    const {defaultProject,emptyEvent}=await import('./src/model.js');
    const p=defaultProject();p.settings.tempo=120;p.settings.loop=true;p.settings.generationType='melody';p.settings.editorMode='melody';
    p.events=[['s1',3],['s2',0],['s2',2],['s2',3]].map(([stringId,fret])=>{const e=emptyEvent('melody',96);e.notes=[{id:e.id+'note',stringId,fret}];e.picking='alternate';return e;});
    p.selectedId=p.events[0].id;
    localStorage.setItem('tonedef.current.v2',JSON.stringify(p));localStorage.setItem('tonedef.workspace.mode.v3','practice');
  });
  await page.reload();await page.waitForSelector('#practice-stage');
  const original=await saved();
  assert.equal(await page.locator('#practice-shape').getAttribute('open'),null);
  const primary=await page.locator('#practice-new').boundingBox();
  assert.ok(primary.y+primary.height<720,'New pattern is reachable without scrolling past generation fields');
  await tap('#practice-passage > summary');
  await number('passage-max',3);await number('passage-min',2);
  assert.equal(await page.locator('.outside-passage').count(),2);
  assert.equal(await page.locator('#playButton').innerText(),'▶ Play passage');
  assert.deepEqual(await saved(),original,'Choosing a passage never edits saved music');
  await page.locator('#passage-range-band').press('ArrowRight');
  assert.equal(await page.locator('#passage-min').inputValue(),'3');assert.equal(await page.locator('#passage-max').inputValue(),'4');
  await page.locator('#passage-range-band').press('Home');
  assert.equal(await page.locator('#passage-min').inputValue(),'1');assert.equal(await page.locator('#passage-max').inputValue(),'2');
  // The existing range gesture implementation is also exercised through this new owner.
  await page.locator('#passage-range-band').scrollIntoViewIfNeeded();
  const band=await page.locator('#passage-range-band').boundingBox(),track=await page.locator('[data-window="passage"]').boundingBox();
  await page.mouse.move(band.x+band.width/2,band.y+band.height/2);await page.mouse.down();
  await page.mouse.move(band.x+band.width/2+track.width/3,band.y+band.height/2,{steps:6});
  await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await page.locator('#passage-min').inputValue(),'1','Escape cancels the whole-passage drag');
  if(touch) {
    const client=await page.context().newCDPSession(page);
    const b=await page.locator('#passage-range-band').boundingBox(),t=await page.locator('[data-window="passage"]').boundingBox();
    const x=b.x+b.width/2,y=b.y+b.height/2;
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+t.width/3,y}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    // Keep the input session alive until this isolated browser context closes.
    assert.equal(await page.locator('#passage-min').inputValue(),'2','Native touch moves the whole passage');
    assert.equal(await page.locator('#passage-max').inputValue(),'3');
  } else {await page.locator('#passage-range-band').press('ArrowRight');}
  const inputTrace=[];
  await page.exposeFunction('recordFocusedInput',entry=>inputTrace.push(entry));
  await page.evaluate(()=>{
    for(const type of ['pointerdown','pointerup','touchend','mousedown','mouseup','focusout','change','click'])document.addEventListener(type,event=>{
      queueMicrotask(()=>window.recordFocusedInput({type,id:event.target.id,connected:event.target.isConnected,prevented:event.defaultPrevented,pointer:event.pointerType,primary:event.isPrimary,touches:event.touches?.length,track:event.target.closest('[data-window]')?.dataset.window,mode:document.querySelector('#practice-response')?.getAttribute('aria-pressed')}));
    },true);
  });
  await tap('#practice-response');
  await page.waitForFunction(()=>document.querySelector('#practice-response')?.getAttribute('aria-pressed')==='true',null,{timeout:1500}).catch(()=>{throw Error(JSON.stringify(inputTrace));});
  assert.equal(await page.locator('#practice-response').getAttribute('aria-pressed'),'true',JSON.stringify(inputTrace));
  await tap('#playButton');
  await page.waitForFunction(()=>document.querySelector('#practice-stage')?.dataset.phase==='count-in');
  assert.equal(await page.locator('#practice-phase').innerText(),'Get ready');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#playButton').getAttribute('aria-pressed'),'false');
  await tap('#playButton');
  await page.waitForFunction(()=>document.querySelector('#practice-stage')?.dataset.phase==='listen');
  await page.waitForFunction(()=>document.querySelector('#practice-stage')?.dataset.phase==='answer');
  assert.equal(await page.locator('#practice-phase').innerText(),'Your turn');
  assert.equal(await page.locator('.event-card.playing').count(),1);
  assert.ok((await page.locator('.event-card.playing').getAttribute('id')).match(/simple-event-[12]/));
  await page.waitForFunction(()=>document.querySelector('#practice-stage')?.dataset.phase==='listen'&&document.querySelector('#practice-scope')?.textContent.includes('pass 2'));
  await tap('#playButton');
  assert.deepEqual(await saved(),original,'Both turns, repeated passage playback and count-in preserve the complete project');
  await tap('#simple-event-1');
  assert.match(await page.locator('#step-guide').innerText(),/Step 2 · D3[\s\S]*String 4 · fret 0[\s\S]*Upstroke[\s\S]*major second, up 2 half steps/);
  await tap('#step-next');assert.match(await page.locator('#step-guide').innerText(),/Step 3 · E3/);
  await tap('#step-hear');await page.waitForFunction(()=>document.querySelector('#playButton').getAttribute('aria-pressed')==='true');
  await page.keyboard.press('Escape');
  await tap('#practice-coach > summary');await tap('#coach-start');
  assert.match(await page.locator('.practice-timing').innerText(),/1 second/);
  await tap('#coach-clean');
  await tap('#passage-selected');assert.equal(await page.locator('#coach-start').count(),1,'Changing the passage resets its self-assessment');
  await tap('#passage-whole');assert.equal(await page.locator('.outside-passage').count(),0);
  await tap('#recall > summary');await page.locator('#recall-kind').selectOption('notes');await tap('#recall-start');await page.locator('#recall-hidden').check();
  assert.equal(await page.locator('#step-guide').isVisible(),false,'Practice guide does not leak challenge answers');
  await tap('#playButton');await page.keyboard.press('Escape');
  assert.equal(await page.locator('#step-guide').isVisible(),false,'Playback callbacks do not restore hidden answers');
  await tap('#recall > summary');await page.locator('#step-guide').waitFor({state:'visible'});
  await tap('#practice-passage > summary');await tap('#practice-coach > summary');
  await page.screenshot({path:path.join(output,`${label}-focused-practice.png`),fullPage:true});
  const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(size.scroll<=size.width+1);
  return ['immediate generation action and folded depth','passage exact inputs, range translation, keyboard, Escape and touch','one-bar count-in cancellation','listen/answer turns, repeated cycle and neck/timeline synchronization','unaltered saved music and picking','selected-step theory, manual navigation and Hear','passage-scoped self-assessment reset','challenge hints stay hidden after playback'];
}
