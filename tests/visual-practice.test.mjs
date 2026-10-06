import test from 'node:test';
import assert from 'node:assert/strict';
import {moveWindow,resizeWindow,pointerValue} from '../src/range-controls.js';
import {patternPositions,noteState} from '../src/note-state.js';
import {recallTargets,judgeRecall,RECALL_INTERVALS} from '../src/recall.js';
import {defaultProject,emptyEvent,createNote,midiOf} from '../src/model.js';
import {maskFor,mod} from '../src/theory.js';

test('dragging an inclusive window preserves width at both limits and never mutates the original',()=>{
  for(const [min,max] of [[0,36],[1,64],[1,12],[1,16]])for(let lo=min;lo<=max;lo++)for(let hi=lo;hi<=max;hi++) {
    const range={min:lo,max:hi};
    for(const delta of [-100,-5,-.49,0,.51,5,100]) {
      const moved=moveWindow(range,delta,min,max);
      assert.equal(moved.max-moved.min,hi-lo);assert.ok(moved.min>=min&&moved.max<=max);
      assert.deepEqual(range,{min:lo,max:hi});
    }
    assert.equal(resizeWindow(range,'min',max+10,min,max).min,hi);
    assert.equal(resizeWindow(range,'max',min-10,min,max).max,lo);
  }
});
test('pointer values cover the whole domain in both handedness directions, including zero-width tracks',()=>{
  const rect={left:100,width:360};
  assert.equal(pointerValue(150,rect,0,36),5);
  assert.equal(pointerValue(150,rect,0,36,true),31);
  assert.equal(pointerValue(-50,rect,1,64),1);
  assert.equal(pointerValue(900,rect,1,64),64);
  assert.equal(pointerValue(100,{left:100,width:0},1,12),1);
});
test('pattern membership uses exact physical positions across all steps; outside-key pattern notes remain distinct',()=>{
  const events=[{notes:[{stringId:'s0',fret:3}]},{notes:[]},{notes:[{stringId:'s1',fret:5},{stringId:'s0',fret:3}]}];
  const positions=patternPositions(events);
  assert.deepEqual([...positions],['s0:3','s1:5']);assert.ok(!positions.has('s2:3'));
  assert.equal(noteState(false,false,false).kind,'outside');assert.equal(noteState(true,false,false).kind,'key');
  assert.equal(noteState(true,true,false).kind,'pattern');assert.equal(noteState(false,true,true).kind,'pattern-outside');
  assert.match(noteState(true,true,true).classes,/current-note/);
});
test('recall notes and intervals follow transposed key tones and actual visible enabled pitches',()=>{
  for(let tonic=0;tonic<12;tonic++) {
    const p=defaultProject();p.settings.tonic=tonic;p.settings.keyMask=maskFor(tonic,[0,2,4,5,7,9,11]);
    for(const kind of ['notes','intervals']) {
      const before=structuredClone(p),{targets}=recallTargets(p,kind);
      assert.equal(targets.length,7);assert.deepEqual(targets.map(t=>mod(t.midi-tonic)),[0,2,4,5,7,9,11]);
      for(const target of targets) {
        assert.ok(judgeRecall(target,target.midi+12));assert.ok(!judgeRecall(target,target.midi+.5));
        assert.ok(!judgeRecall(target,target.midi+1));
      }
      assert.deepEqual(p,before);
    }
  }
  const p=defaultProject();Object.assign(p.settings,{stringCount:1,fretMin:0,fretMax:0,open0:40});
  assert.deepEqual(recallTargets(p,'notes').targets.map(t=>t.midi),[40]);
  p.settings.enabled0=false;assert.equal(recallTargets(p,'notes').targets.length,0);
  assert.equal(RECALL_INTERVALS[3],'a minor third');assert.equal(RECALL_INTERVALS[4],'a major third');
});
test('melody recall retains ordered pitches and repeats, ignores rests, requires register, rejects chords and unreachable patterns',()=>{
  const p=defaultProject();
  p.events=[0,2,2,3].map(fret=>{const e=emptyEvent('melody');e.notes=[createNote('s0',fret)];return e;});
  p.events.splice(1,0,emptyEvent('rest'));
  const before=structuredClone(p),result=recallTargets(p,'melody');
  assert.deepEqual(result.targets.map(t=>t.midi),[40,42,42,43]);
  assert.ok(judgeRecall(result.targets[1],42));assert.ok(!judgeRecall(result.targets[1],54));
  assert.deepEqual(p,before);
  p.events[0].notes.push(createNote('s1',2));assert.match(recallTargets(p,'melody').reason,/single-note/);
  p.events=before.events;p.settings.fretMax=1;assert.match(recallTargets(p,'melody').reason,/outside the visible/);
  p.events=[];assert.equal(recallTargets(p,'melody').targets.length,0);
});
