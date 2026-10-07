import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject, emptyEvent, clone, example } from '../src/model.js';
import { practiceIdentity, freshPracticeSession, practiceSessionStep, practiceTiming } from '../src/practice-coach.js';
import { EXERCISE_RECIPES, PRACTICE_GOALS, applyExerciseRecipe, matchingExercise } from '../src/exercises.js';
import { practiceGenerate } from '../src/practice-options.js';

test('Practice sessions require three self-reported passes at one speed and reset a streak after correction or tempo change',()=>{
  const initial=freshPracticeSession(),before=clone(initial);
  assert.deepEqual(practiceSessionStep(initial,'clean',60),initial);
  let state=practiceSessionStep(initial,'start',60);
  for(let i=1;i<=3;i++){state=practiceSessionStep(state,'clean',60);assert.equal(state.streak,i);}
  assert.equal(state.best,60);assert.equal(state.passes,3);
  state=practiceSessionStep(state,'sync',65);
  assert.equal(state.streak,0);assert.equal(state.best,60);
  state=practiceSessionStep(state,'clean',65);state=practiceSessionStep(state,'retry',65);
  assert.equal(state.streak,0);assert.equal(state.passes,4);
  for(let i=0;i<3;i++)state=practiceSessionStep(state,'clean',65);
  assert.equal(state.best,65);
  state=practiceSessionStep(state,'sync',60);assert.equal(state.streak,0,'Undoing tempo is a new streak too');
  assert.equal(practiceSessionStep(state,'end',60).active,false);
  assert.deepEqual(practiceSessionStep(state,'start',30),{...freshPracticeSession(),active:true,tempo:30,message:'Listen once, play a full pass on your instrument, then check yourself.'});
  assert.throws(()=>practiceSessionStep(state,'start',241),/30–240/);
  assert.deepEqual(initial,before);
});

test('Practice identity tracks actual music, tuning and meter without resetting for selection, locks, display or tempo',()=>{
  const p=example(),identity=practiceIdentity(p);
  for(const change of [n=>n.settings.tempo++,n=>n.events[0].locked=!n.events[0].locked,n=>n.selectedId=n.events[1].id,n=>n.settings.leftHanded=!n.settings.leftHanded,n=>n.settings.eventCount++]) {
    const next=clone(p);change(next);assert.equal(practiceIdentity(next),identity);
  }
  for(const change of [n=>n.events[0].duration++,n=>n.events[0].picking='up',n=>n.events[0].notes[0].fret++,n=>n.settings.open0++,n=>n.settings.meter='3/4',n=>n.settings.tonic++]) {
    const next=clone(p);change(next);assert.notEqual(practiceIdentity(next),identity);
  }
});

test('Timing explanation uses saved events rather than future generator choices, including rests and mixed rhythm',()=>{
  const p=defaultProject();p.settings.tempo=60;p.events=Array.from({length:4},()=>emptyEvent('melody',48));
  p.events[0].notes=[{id:'a',stringId:'s0',fret:0}];
  assert.match(practiceTiming(p),/^2 steps per quarter-note beat · 2 seconds/);
  p.settings.duration=96;assert.match(practiceTiming(p),/^2 steps/);
  p.events[1].duration=32;assert.match(practiceTiming(p),/^Mixed note lengths/);
  p.events.forEach(e=>e.duration=192);assert.match(practiceTiming(p),/1 step every 2 quarter-note beats · 8 seconds/);
  p.events=[];assert.match(practiceTiming(p),/Make a pattern/);
});

test('All practice goals have actionable depth and generate on the default guitar without replacing music during setup',()=>{
  for(const recipe of EXERCISE_RECIPES) {
    const p=defaultProject(),before=clone(p),next=applyExerciseRecipe(p,recipe.id);
    assert.deepEqual(p,before);assert.deepEqual(next.events,p.events);
    for(const key of ['group','aim','cue','stretch'])assert.ok(PRACTICE_GOALS[recipe.id][key]);
    assert.equal(matchingExercise(next.settings)?.id,recipe.id);
    const result=practiceGenerate(next,{advanceSeed:false}).project;
    assert.equal(result.events.length,recipe.settings.eventCount);
    next.settings.tempo=101;next.settings.eventCount=7;
    assert.equal(matchingExercise(next.settings)?.id,recipe.id,'Speed and count do not silently change the practice aim');
  }
});
