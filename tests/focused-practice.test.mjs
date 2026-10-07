import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject, example, emptyEvent } from '../src/model.js';
import { playbackPlan, Player } from '../src/audio.js';
import { wholePassage, validatePassage, passageEvents, passageIdentity, passageLabel, stepInsight } from '../src/focused-practice.js';
import { windowTrack } from '../src/range-controls.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
test('A passage preserves exact saved events and IDs, original alternating strokes, rests and fractional ticks',()=>{
  const p=example();p.settings.tempo=120;
  p.events.forEach((e,i)=>{e.duration=[32,173,24,96][i%4];e.picking='alternate';});
  p.events[2].kind='rest';p.events[2].notes=[];
  const before=structuredClone(p),full=playbackPlan(p),plan=playbackPlan(p,{from:1,to:2,response:true,countIn:true});
  assert.deepEqual(plan.events.slice(0,2).map(e=>e.id),p.events.slice(1,3).map(e=>e.id));
  assert.deepEqual(plan.events[0].notes,full.events[1].notes,'A passage beginning on an upstroke stays an upstroke');
  assert.equal(plan.events[0].start,0);assert.equal(plan.events[1].start,173/192);
  near(plan.passDuration,197/192);near(plan.duration,394/192);
  assert.equal(plan.countIn,2);
  assert.equal(plan.events[1].notes.length,0);
  assert.ok(plan.events.slice(2).every(e=>e.phase==='answer'&&e.notes.length===0));
  assert.deepEqual(plan.events.slice(2).map(e=>e.id),p.events.slice(1,3).map(e=>e.id));
  near(plan.events[2].start,plan.passDuration);
  assert.deepEqual(p,before);
});

test('Passage bounds reject invalid ranges, cope with one step and empty patterns, and reset identity only for changed music',()=>{
  const p=example(),before=passageIdentity(p);
  assert.deepEqual(passageEvents(p,{min:2,max:3}),p.events.slice(1,3));
  assert.equal(passageLabel({min:1,max:p.events.length},p.events.length),'Whole pattern');
  assert.equal(passageLabel({min:2,max:2},p.events.length),'Step 2');
  assert.equal(passageLabel({min:2,max:3},p.events.length),'Steps 2–3');
  for(const range of [{min:0,max:2},{min:3,max:2},{min:1,max:200},{min:1.5,max:2},{min:NaN,max:2}])assert.throws(()=>validatePassage(range,p.events.length));
  for(const options of [{from:-1},{from:2,to:1},{to:200},{from:.2}])assert.throws(()=>playbackPlan(p,options));
  p.settings.tempo++;p.selectedId=p.events[1].id;p.events[0].locked=true;
  assert.equal(passageIdentity(p),before,'Selection, locks and speed retain a passage');
  p.events.reverse();assert.notEqual(passageIdentity(p),before,'Reordering invalidates the old passage');
  assert.doesNotMatch(windowTrack({key:'passage',id:'one',range:wholePassage(1),min:1,max:1,label:'Step'}),/NaN|Infinity/);
  p.events=[];assert.deepEqual(playbackPlan(p,{countIn:true,response:true}).events,[]);
  assert.equal(playbackPlan(p,{countIn:true}).countIn,0);
});

test('The step guide explains actual physical notes, spelling, direction, rests, chord bass movement and original picking',()=>{
  const p=defaultProject();
  const note=(s,f)=>{const e=emptyEvent('melody',32);e.notes=[{id:s+f,stringId:s,fret:f}];e.picking='alternate';return e;};
  p.events=[note('s1',3),note('s2',2),note('s5',0),emptyEvent('rest',96),note('s2',2)];
  const before=structuredClone(p);
  let insight=stepInsight(p,1);
  assert.equal(insight.position,'String 4 · fret 2');
  assert.equal(insight.timing,'⅓ quarter-note beats');assert.equal(insight.picking,'↑ Upstroke');
  assert.match(insight.movement,/From C3: major third, up 4 half steps/);
  assert.match(stepInsight(p,2).movement,/perfect octave, up 12 half steps/);
  assert.match(stepInsight(p,3).movement,/silent/);assert.equal(stepInsight(p,3).picking,'');
  assert.match(stepInsight(p,4).movement,/after the rest/);
  assert.deepEqual(p,before);
  p.events=example().events;
  assert.match(stepInsight(p,1).movement,/Lowest note[\s\S]*pitch ranks/);
  assert.equal(stepInsight(p,999),null);
});

test('Count-in and listen/answer phases use the audio clock, preserve compound pulse, and count in once across repeats',async()=>{
  const oldSet=globalThis.setInterval,oldClear=globalThis.clearInterval;
  let pump;globalThis.setInterval=fn=>(pump=fn,1);globalThis.clearInterval=()=>{};
  const seen=[],voices=[],player=new Player((id,_,state)=>seen.push({id,...state}));
  player.context={state:'running',currentTime:0};player.voice=(midi,start,duration,volume,wave)=>voices.push({midi,start,duration,wave});
  try {
    const p=example();p.settings.tempo=120;p.settings.meter='6/8';p.settings.loop=true;p.settings.metronome=false;
    p.events=p.events.slice(0,2);p.events.forEach(e=>e.duration=48);
    await player.play(p,{from:1,to:1,countIn:true,response:true});
    assert.equal(seen.at(-1).phase,'count-in');assert.equal(seen.at(-1).beats,2);
    const origin=player.origin;near(origin,1.57);
    for(let now=.02;now<3;now+=.01){player.context.currentTime=now;pump();}
    const clicks=voices.filter(v=>v.wave==='sine'),guitar=voices.filter(v=>v.wave!=='sine');
    const before=clicks.filter(v=>v.start<origin-1e-9);assert.equal(before.length,2);near(before[0].start,.07);near(before[1].start,.82);
    assert.ok(guitar.length>0);
    assert.ok(guitar.every(v=>v.start>=origin),'No guitar is scheduled in the count-in');
    assert.ok(guitar.every(v=>((v.start-origin+.0000001)%.5)<.25),'No guitar is scheduled in the answer');
    assert.ok(clicks.some(v=>Math.abs(v.start-(origin+.25))<1e-8),'Answer begins with a click even after a fractional-beat passage');
    assert.ok(seen.some(s=>s.phase==='listen'&&s.id===p.events[1].id));
    assert.ok(seen.some(s=>s.phase==='answer'&&s.id===p.events[1].id));
    assert.ok(seen.some(s=>s.phase==='listen'&&s.cycle===3));
    player.stop();assert.equal(player.running,false);assert.equal(seen.at(-1).id,null);
    const length=voices.length;player.context.currentTime=99;pump();assert.equal(voices.length,length,'Stop invalidates pending scheduling');
  } finally {player.stop();globalThis.setInterval=oldSet;globalThis.clearInterval=oldClear;}
});

test('Nonrepeating listen/play stops after both turns; stopping while audio unlocks cancels the count-in',async()=>{
  const oldSet=globalThis.setInterval,oldClear=globalThis.clearInterval;let pump;
  globalThis.setInterval=fn=>(pump=fn,1);globalThis.clearInterval=()=>{};
  const player=new Player();player.voice=()=>{};player.context={state:'running',currentTime:0};
  try {
    const p=example();p.events=p.events.slice(0,1);p.events[0].duration=32;p.settings.tempo=120;p.settings.loop=false;
    await player.play(p,{countIn:false,response:true});player.context.currentTime=.07+1/3+.001;pump();assert.equal(player.running,false);
    let resume;player.context={state:'suspended',currentTime:0,resume:()=>new Promise(resolve=>resume=resolve)};
    const pending=player.play(p,{countIn:true});player.stop();resume();await pending;assert.equal(player.running,false);
  } finally {player.stop();globalThis.setInterval=oldSet;globalThis.clearInterval=oldClear;}
});
