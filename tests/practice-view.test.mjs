import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject, importProject } from '../src/model.js';
import { practiceControls } from '../src/practice-view.js';

const project = () => {
  const p = defaultProject();
  p.settings.generationType = 'melody';
  return p;
};
const field = (id, label = id) => `<label for="setting-${id}">${label}<input id="setting-${id}" data-setting="${id}"></label>`;
const view = (p, extra = {}) => practiceControls(p, {
  field,
  keyFields: '<div><select id="setting-tonic" data-setting="tonic"><option>C</option></select><select id="collection" data-collection><option>Major</option></select></div>',
  recipes: '<select id="exercise-recipe"><option selected>Scale walk</option></select>',
  ranges: '<details id="practice-ranges"></details>', busy: false, ...extra,
});
const tag = (html, id) => html.match(new RegExp(`<[^>]+\\bid="${id}"[^>]*>`))?.[0] ?? '';
const disabled = (html, id) => /\bdisabled\b/.test(tag(html, id));

test('random choices disable only their fixed inputs and show the related bounds without disabling the string pool', () => {
  const p = project(), before = structuredClone(p);
  const fixed = view(p);
  for (const id of ['setting-tonic','collection','setting-eventCount','practice-notesPerString']) assert.ok(!disabled(fixed,id));
  for (const kind of ['count','strings','notesPerString']) assert.equal(tag(fixed,`practice-${kind}Min`),'');
  for (const [flag, fixedId, kind] of [
    ['keyRandom','setting-tonic'], ['modeRandom','collection'], ['countRandom','setting-eventCount','count'],
    ['stringsRandom',null,'strings'], ['notesPerStringRandom','practice-notesPerString','notesPerString'],
  ]) {
    const next = structuredClone(p); next.practice[flag] = true;
    const html = view(next);
    for (const id of ['setting-tonic','collection','setting-eventCount','practice-notesPerString']) assert.equal(disabled(html,id),id===fixedId);
    for (const candidate of ['count','strings','notesPerString']) assert.equal(!!tag(html,`practice-${candidate}Min`),candidate===kind);
    assert.ok(!disabled(html,'practice-string-s0'));
    if (flag==='stringsRandom') assert.match(html,/Choose from these strings/);
    next.practice[flag] = false;
    assert.equal(view(next),fixed);
  }
  assert.deepEqual(p,before);
  assert.doesNotMatch(fixed,/id="practice-random-bounds"/);
});

test('imported grouping values 9 and 16 remain visibly selected and random bounds support the full saved range', () => {
  for (const grouping of [9,16]) {
    const p = project(); p.practice.notesPerString = grouping;
    const imported = importProject(JSON.stringify(p));
    assert.match(view(imported),new RegExp(`<option value="${grouping}" selected>${grouping}</option>`));
    imported.practice.notesPerStringRandom = true;
    imported.practice.notesPerStringMin = grouping;
    imported.practice.notesPerStringMax = grouping;
    const html = view(imported);
    for (const id of ['practice-notesPerStringMin','practice-notesPerStringMax']) {
      assert.match(tag(html,id),/max="16"/);
      assert.match(tag(html,id),new RegExp(`value="${grouping}"`));
    }
  }
});

test('chord grouping conflicts expose an explicit correction and never silently replace saved choices', () => {
  for (const generationType of ['chord','progression']) {
    const p = project(); p.settings.generationType = generationType;
    let html = view(p);
    assert.match(html,/>Chords<input id="setting-eventCount"/);
    assert.equal(tag(html,'practice-notesPerString'),'');
    assert.equal(tag(html,'practice-free-strings'),'');
    for (const practice of [{notesPerString:3},{notesPerStringRandom:true}]) {
      Object.assign(p.practice,practice);
      const before = structuredClone(p); html = view(p);
      assert.match(tag(html,'practice-free-strings'),/data-action="practice-free-strings"/);
      assert.match(html,/Chords play strings together/);
      assert.deepEqual(p,before);
    }
  }
});

test('controls describe only rules used by the current type and rhythm while preserved values survive rendering', () => {
  const p = project();
  p.settings.duration = 192; p.settings.maxSpan = 9;
  for (const generationType of ['melody','arpeggio','chord','progression']) {
    p.settings.generationType = generationType;
    for (const rhythmPattern of ['steady','triplets','syncopated']) {
      p.settings.rhythmPattern = rhythmPattern;
      const before = structuredClone(p), html = view(p);
      const single = ['melody','arpeggio'].includes(generationType);
      assert.equal(!!tag(html,'setting-duration'),rhythmPattern==='steady');
      assert.equal(!!tag(html,'setting-sequencePattern'),generationType==='melody');
      assert.equal(!!tag(html,'setting-melodicContour'),generationType==='melody');
      assert.equal(!!tag(html,'setting-maxLeap'),single);
      assert.equal(!!tag(html,'setting-repeatNotes'),single);
      assert.equal(!!tag(html,'setting-maxSpan'),!single);
      assert.equal(!!tag(html,'setting-chordVocabulary'),generationType!=='melody');
      assert.equal([...html.matchAll(/id="setting-generationType"/g)].length,1);
      assert.ok(html.indexOf('id="setting-generationType"')<html.indexOf('id="practice-more"'));
      assert.deepEqual(p,before);
    }
  }
});

test('string display numbers follow guitar convention while selection IDs and physical order are unchanged', () => {
  const p = project(), before = structuredClone(p);
  p.settings.enabled2 = false;
  for (const count of [4,6,12]) {
    p.settings.stringCount = count;
    const html = view(p);
    const ids = [...html.matchAll(/data-practice-string="(s\d+)"/g)].map(match=>match[1]);
    assert.deepEqual(ids,Array.from({length:count},(_,i)=>`s${i}`));
    for (let i=0;i<count;i++) assert.match(tag(html,`practice-string-s${i}`),new RegExp(`aria-label="Use string ${count-i},`));
    assert.ok(disabled(html,'practice-string-s2'));
    assert.deepEqual(p.practice,before.practice);
  }
});

test('errors and generation results remain adjacent to the action and escape untrusted text', () => {
  const text = '<img src=x onerror="bad()"> & unchanged';
  const html = view(project(),{errorText:text,resultText:text,busy:true});
  assert.match(tag(html,'practice-error'),/role="alert"/);
  assert.match(html,/&lt;img src=x onerror=&quot;bad\(\)&quot;&gt; &amp; unchanged/);
  assert.doesNotMatch(html,/<img/);
  assert.ok(html.indexOf('id="practice-error"')>html.indexOf('id="practice-new"'));
  assert.ok(disabled(html,'practice-new'));
  assert.match(html,/data-action="cancel-generation"/);
  assert.equal(tag(view(project()),'practice-error'),'');
});

test('active advanced rules and the provided matched recipe remain visible without inventing a different recipe', () => {
  const p = project();
  Object.assign(p.settings,{sequencePattern:'steps',melodicContour:'ascending',restRate:20});
  const html = view(p);
  assert.match(html,/<summary>More choices · Scale steps · Ascending · \+1<\/summary>/);
  assert.match(html,/<select id="exercise-recipe"><option selected>Scale walk<\/option><\/select>/);
  assert.match(html,/a rest replaces one step/);
});
