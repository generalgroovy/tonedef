# Rebuild ToneDef from these documents

For the current interface, also apply [Visual workspace](VISUAL-WORKSPACE.md) and the newer [GUI workspace supplement](GUI-WORKSPACE.md). The latter specifies version1.1.0, the independent panel preference schema, wooden fretboard, chord-line geometry, current stylesheet order and build assets; it supersedes earlier fixed-layout details while retaining the musical schema below.

This contract is sufficient to reconstruct functional and visual behavior without source files. Byte-identical source recovery requires backups. REBUILD and DESIGN are authoritative; ACCEPTANCE holds proof and fixtures. The original implementation uses native ES modules with no runtime dependencies; Node >=22 is needed only for development/tests/build, verified with 24.18.0 and npm 11.13.0 on Windows.

## 1. Recreate files in this order

1. `package.json` with type=module; scripts dev/start=`node scripts/serve.mjs`, test=`node --test tests/*.test.mjs`, check=`node scripts/check.mjs`, build=`node scripts/build.mjs`, preview=`node scripts/serve.mjs dist`; version 1.0.0. Run npm install --package-lock-only to recreate the dependency-free lockfile.
2. `src/theory.js`: pure pitch, spelling, interval, scale, chord and transition functions described below. No DOM, storage or audio access.
3. `src/model.js`: schema/defaults, canonical physical positions, validation, editor operations, reconciliation, examples, tab export and history.
4. `src/generator.js`: pure deterministic generate/randomize. `src/generation-worker.js`: accept `{mode,project}`, call the appropriate function, post success/error; terminate worker on cancellation. No state writes from a worker.
5. `src/audio.js`: playbackPlan(project) returns seconds-based events from tick durations; Player schedules Web Audio voices and reports active event IDs.
6. `src/app.js`: render DOM from the project, delegate click/change/keyboard handlers, validate every transaction, manage history/storage and discard stale worker results. Preserve open disclosures and fret focus through render. Compute selected chord analysis once per render for fret coloring.
7. `index.html`: viewport meta, title “ToneDef — Guitar & bass, understood”, description, relative favicon.svg/styles.css/src/app.js module, skip link to #fretboard, #app root. `styles.css` and favicon follow DESIGN.
8. `scripts/serve.mjs`: HTTP on 127.0.0.1:4173, optional TONEDEF_PORT; root from first arg or cwd; strip /tonedef prefix for local Pages testing. Correct HTML/JS/CSS/SVG MIME types, no-store, path traversal protection. `build.mjs`: copy index.html/styles.css/favicon.svg/src recursively into dist and create .nojekyll. `check.mjs`: node --check each src/*.js. Only generated dist is hosted.
9. Recreate tests from ACCEPTANCE and the executable fixtures below. Recreate Pages workflow from DEPLOYMENT. Validate at the /tonedef/ path before publishing.

## 2. Canonical state and validation

Project JSON (version 2, generatorVersion 1):

```text
{
 version:2, generatorVersion:1, title:string (0..120 chars),
 settings:{all IDs in table below, exact typed values},
 randomize:{each setting ID:boolean}, randomPattern:boolean,
 events:[Event] (0..128), selectedId:event ID or null
}
Event = {
 id:unique string, kind:'chord'|'melody'|'rest', duration:integer ticks 1..1536,
 notes:[Note], locked:boolean,
 picking:'free'|'up'|'down'|'fingers'|'alternate',
 fingers:string matching [pima ]{1,20}, interpretation:null|'rootPc:suffix'
}
Note = {id:globally unique note ID, stringId:'s0'..'s11', fret:integer,
        spelling?:letter + up to 2 sharps/flats + signed octave}
```

Event/note IDs must match [A-Za-z0-9_.:-]{1,120}; imported HTML-like IDs are rejected. One physical string ID per chord. Melody has zero/one note per event; rests zero. Notes require an existing string and capo<=fret<=last fret. A spelling override must equal the derived MIDI pitch. IDs remain stable during ordinary edits; duplicates get new IDs. Physical IDs must be canonical (s01 is invalid). All settings must be present and valid. Tonic spelling must match tonic pitch class; capo cannot exceed last fret; visible fret range must be ordered within the instrument; lowPitch<=highPitch. Import validates before state mutation, rejects files >500,000 characters (UI also checks bytes), unknown versions and invalid locks/notes. Treat all strings as text; HTML-escape dynamic rendering.

Version 1 migration: set version=2/generatorVersion=1, merge missing settings and randomization flags with current defaults, randomPattern defaults true, event locked=false/picking=free/fingers='p i m a'/interpretation=null; selectedId defaults first event or null. Version 1 must otherwise use the documented Event/Note structure; this is not an importer for the old GeneralGroovy application.

Project defaults: title “A little movement”, no events, selectedId=null, randomPattern=true. Only seed and restRate setting checkboxes start true; all others false. Initial UI uses the progression example rather than an empty project. Event defaults: chord, duration384, notes[], locked=false, picking free, fingers p i m a, interpretation null.

History: clone complete projects; validate before adding one transaction; retain 80 undo entries; new commits clear redo. Autosave key tonedef.current.v2, last valid previous value tonedef.backup.v2, up to20 named project copies in tonedef.library.v2. On corrupt current save try backup; do not overwrite damaged storage on boot. Report failure and encourage JSON export. Named copies persist whole valid projects.

## 3. Pitch, spelling and intervals

Use integer MIDI pitch and twelve-tone equal temperament. Positive modulo: ((n%12)+12)%12. Pitch class=MIDI mod12; sounding MIDI=open[string]+absolute physical fret. Never add capo a second time. C4=60; frequency=440*2^((MIDI-69)/12). A capo at fret2 on E2 gives42 at physical fret2; relative3 means physical5, MIDI45. Total supported pitch is0..127; open pitches capped91 and fret count36 ensure the maximum.

Natural letter pitch classes C,D,E,F,G,A,B = [0,2,4,5,7,9,11]. Parse flats/sharps and octave; MIDI=12*(octave+1)+naturalPC+alteration. B#3=60, Cb4=59. For a preset collection, choose the tonic spelling, then advance letters by its diatonic degree offsets in the tables; compute the accidental needed for the target pitch and adjust the octave from the natural letter. Auto tonics: C,Db,D,Eb,E,F,F#,G,Ab,A,Bb,B. Explicit tonicSpelling overrides the preference. Outside the collection use sharps unless flats are preferred or the auto tonic contains a flat.

Chord notes get chord-aware spelling, unless explicitly overridden. Choose the root spelling using the key context. Chromatic interval→diatonic letter offset: 0→0,1/2→1,3/4→2,5→3,6/7→4,8→5 (augmented chord:4),9→5 (dim7:6),10/11→6. Compute accidental/octave as above. Thus Cm contains Eb even in C-major context; Cdim7 contains Bbb, not A. Slash bass uses the same chord spelling.

Intervals use both spelling and register. Signed semitones = targetMIDI-sourceMIDI. Diatonic displacement=(targetOctave-sourceOctave)*7+targetLetterIndex-sourceLetterIndex. Number=abs(displacement)+1. Reference semitones=naturalPC[abs(displacement)%7]+12*floor(abs(displacement)/7). Measure semitones in the diatonic direction; for same-letter unison use absolute semitones. Perfect classes are letter steps0,3,4; delta0=P, positive delta=augmented, negative= diminished. Other classes: delta0=M,-1=m, positive=augmented, below-1=diminished. Compound labels keep the full number. Show signed semitones and direction separately. Same-pitch enharmonic spellings can be diminished seconds. Descending chromatic unisons retain positive-quality magnitude (E→Eb is descending A1, -1st).

Palette index for actual pairs=abs(semitones)%12, so direction does not invert colors. For tonic/chord-root pitch-class colors=(pitch-root+12)%12. The matrix shows directed row→column named intervals. Pinned reference uses absolute register.

## 4. Chords, modes and transitions

Chord detection deduplicates pitch classes for membership only, retains original positions for audio and transition. Candidate roots are present pitch classes, bass is min(MIDI)%12. For every chord table entry, reject any tone outside required+optional. Exact means no missing required tones. Incomplete candidates allow one missing required tone and >=2 selected classes. Label them as incomplete, not a detected full chord. Candidate score=100*missingCount + (root==bass?0:2) + optionalCount + max(0,requiredCount-4). Stable sort by score then root. Show all exact alternatives; an interpretation chooses a matching root:suffix. Do not add absent pitches to playback. Rootless extensions outside this bounded vocabulary remain unclassified.

Roman degrees use root-tonic chromatic classes [I,bII,II,bIII,III,IV,#IV,V,bVI,VI,bVII,VII], lowercasing minor-third qualities and appending the documented quality. These are degree/quality labels, not a complete functional-harmony analysis. The chord name remains authoritative for extensions.

Compatible scales: for each of12 roots and each non-chromatic preset, show selected pitch classes contained, outside and missing from the candidate. Rank outside count ascending, selected-tonic match first, missing count ascending, root ascending. This is set compatibility, not key or modulation inference. C major and A natural minor share tones. The UI analyzes the selected chord, or all melody events when a melody is selected; arbitrary passage selection is deferred.

Fifths outer order: (7*i)%12 for i=0..11 → C,G,D,A,E,B,F#,Db,Ab,Eb,Bb,F. Relative minor=root-3 mod12, spelled as the sixth of its major scale (E major→C# minor). Outer click sets major tonic/mask; inner click sets natural minor tonic/mask. Chromatic wheel order is0..11 and toggles the mask.

Rank comparison: sort both note arrays by MIDI ascending, then ID. Pair by index through maximum length. Keep octaves/doubled notes. Missing counterpart is explicitly enters/leaves; no interval is invented. Show actual bass row, root motion separately using octave3 representatives, common pitch classes and adjacent chord choices. Only immediately adjacent chord events are paired; a rest/melody interrupts chord adjacency.

## 5. Deterministic generation

Settings table below defines typed domains. Numeric random values are discrete min+n*step; booleans use rng>=.5; choices uniform; colors sample the default palette. Exceptions: restRate random0..35 by5, eventCount random1..16, open pitches at most ±12 from their current value within0..91, keyMask samples one of13 preset masks under the sampled tonic, tonicSpelling samples auto or a spelling matching tonic.

Algorithm generatorVersion=1 uses Mulberry32 exactly:

```js
function seededRandom(seed) {
  let a=seed>>>0;
  return () => {
    a=(a+0x6D2B79F5)>>>0;
    let t=a;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
```

Stable pool order: physical string ascending, fret ascending. Include enabled strings and frets in [fretMin,fretMax] with capo as effective open optionally admitted even outside the window. Exclude pitches outside [lowPitch,highPitch] and outside keyMask if inKey. AllowOpen=false excludes capo position. Pick=array[floor(rng()*length)]. Fisher-Yates shuffle from last index down to1, one draw each.

Generate validates and clones input, creates rng from seed, rejects empty pool and lengths that remove a locked event. At each event index preserve an existing locked event unchanged (its first note becomes previous melodic pitch if present). Otherwise first draw determines rest (rng<restRate/100), even when restRate=0. Rest does not update previous pitch. Melody filters pool by maxLeap from previous and repeatNotes; uniformly pick one, set previous. Arpeggio uses first supported chord rooted at tonic (else first target) and cycles its pitch classes by event index, additionally filtering the melody candidates. Failure at a later melodic step aborts whole result; this is a bounded greedy search, not a proof of global infeasibility.

Chord targets: root order starts at tonic; if inKey use key-mask roots and require all chord tones in mask. Vocabulary: triads major/minor/dim/aug; sevenths 7/maj7/m7/m7b5/dim7/m(maj7); sus2/sus4; power5. Shuffle targets; for chord prefer tonic; progression prefers root offsets [0,9,5,7] by event index, then other valid targets. In minor/custom keys these preferences are filtered by actual key membership and available chord quality; no unsupported major-key function is asserted.

Voicing search: filter pool to target chord classes, shuffle physical string order and each string's positions. Depth-first choose zero/one note per string, trying uncovered pitch classes first (stable sort). Stop when all required classes are covered. Bound six sounding notes and25,000 recursive visits per target. Fretted span=max(non-capo frets)-min(non-capo frets)<=maxSpan; open strings are excluded from reach. Insufficient remaining strings prune. Failure returns no result without state change. Generated chords contain every target class and no unrelated tone.

New events use duration/picking/fingers defaults and generated IDs g-SEED-INDEX / gn-SEED-INDEX-NOTE. Reserve locked event/note IDs first; append -copy to generated IDs until unique. Preserve locked content exactly. New selectedId is first event. Validate output.

Randomize makes up to32 candidate attempts using one rng from the original seed; each attempt starts from the original state. Visit fields in the settings-table order (tonicSpelling is handled after other fields). Conditionally constrain only eligible dependent values: fretCount must fit fixed capo/fretMax; eligible capo<=fretCount; eligible fretMax<=fretCount and>=fixedfretMin; eligible fretMin<=fretMax; eligiblelowPitch<=highPitch. Never clamp an unchecked field. Protected events (all if randomPattern=false, else event locks) must retain physical positions, sounding pitches, and schema validity under new instrument settings. Check every unchecked setting for exact equality before applying. If pattern is eligible, run Generate using sampled seed/settings; otherwise validate unchanged events. First valid candidate commits once; after32 failures report the last constraint and leave input untouched. Same full input reproduces the result. No eligible settings and pattern off returns a stated no-op. Randomize never starts playback.

## 6. Audio and export

PPQ=96. Seconds per tick=60/quarterBPM/96. Event start is cumulative preceding ticks; duration=ticks*secondsPerTick. Bar ticks=numerator*96*4/denominator. Simple metronome step=96*4/denominator; compound6/8,9/8,12/8 step=144. Reset metronome pattern at loop boundary. Timeline bar index=floor(startTicks/barTicks)+1 and beat=(startTicks%barTicks)/(96*4/denominator)+1.

Free/fingers chords schedule simultaneous voices. Down orders physical strings0→N, up reverses; alternate alternates per event index, including rests. Strum offset per note=min(.025,eventDuration/(noteCount+1))*index. Fingers are editable exercise markings, not a synthesized fingering assessment. Frequency formula above. Triangle/sine voice, peak volume=settingVolume/100*.22/sqrt(noteCount), attack min(.012,duration/4), hold to65%, exponential decay to.0001, stop afterduration+.03. Note duration=max(.04,eventDuration*.82-offset). Volume0 creates no voices. Metronome uses MIDI96/89 accent/nonaccent, sine,35ms, gainvolume/100*.1.

AudioContext is created/resumed from a user gesture. Every20ms schedule up to120ms ahead on context.currentTime, starting70ms ahead. Schedule next-loop events before boundary. Track all oscillator/gain pairs, stop and zero every scheduled/sounding node on Stop or project edit. An incrementing revision cancels outstanding asynchronous resume/audition starts. Backgrounding stops playback; returning does not auto-resume.

Tab text: title, quarter BPM, meter, absolute fret/capo convention, physical string rows high→low with note+octave open labels; one column per event containing fret or dash; separate ticks and pick rows. This is not a Standard MIDI File. JSON contains every field from the schema.

## 7. Independent goldens and rehearsal

- Standard guitar [40,45,50,55,59,64], bass[28,33,38,43]. Fret12 adds12; E2 capo2 is42.
- C4→E4=M3/+4; C4→Eb4=m3/+3; E4→C4=M3/-4; C4→E5=M10/+16; C4→Fb4=d4/+4; B#4→C5=d2/0.
- C-E-G=C; E3-G3-C4=C/E; C-Eb-G=Cm; C-E-G-B=Cmaj7; C-E-G-Bb=C7. C-E-G-A can be C6 or Am7/C.
- C-major mask=2741; A-natural-minor mask=2741, different tonic.
- C3-E3-G3 → D3-F3-A3 = [+2,+1,+2]; fourth destination note enters.
- One string openC4=60, fretCount/fretMax4, C major key, melody, eventCount4, maxLeap12, restRate0, seed1731: pool frets[0,2,4], four events frets[2,4,4,0], pitches[62,64,64,60]. Consume one rest draw and one pick draw per event. First8 random values: .27386758429929614,.5299165300093591,.9074956404510885,.719850878464058,.3065613384824246,.8975230071227998,.6557551682926714,.26971547002904117.
- At120BPM, duration288ticks=1.5sec. 6/8 bar288ticks, click144ticks. C chord voices must start together in Free.

Rehearsal: copy only this file and DESIGN/ACCEPTANCE into an isolated directory. Reimplement pitch parsing, intervals, mask, one chord, rank comparison and this deterministic melody fixture without importing implementation modules. Compare to the independent outputs above. Record executed result in ACCEPTANCE. This partial rehearsal is not proof of a full independent rebuild.

## 8. Complete lookup data and setting defaults

Tables below are the authoritative numeric reconstruction data. Numeric domains are inclusive; selections list every option; bool domain=false/true. All randomization rules and exceptions are given above. Settings order matters to deterministic randomization.

### Settings

| ID | Default | Type / domain | Label |
| --- | --- | --- | --- |
| tonicSpelling | "auto" | auto, C, C#, Db, D, D#, Eb, E, Fb, E#, F, F#, Gb, G, G#, Ab, A, A#, Bb, B, Cb, B# | Tonic spelling |
| tonic | 0 | 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 | Tonic |
| keyMask | 2741 | 0..4095, step 1 | Key collection |
| accidentals | "auto" | auto, sharps, flats | Spelling preference |
| stringCount | 6 | 1..12, step 1 | Number of strings |
| fretCount | 24 | 1..36, step 1 | Last physical fret |
| capo | 0 | 0..36, step 1 | Capo fret |
| leftHanded | false | boolean | Left-handed neck |
| fretMin | 0 | 0..36, step 1 | First visible fret |
| fretMax | 12 | 1..36, step 1 | Last visible fret |
| allowOpen | true | boolean | Use effective open strings |
| editorMode | "chord" | chord, melody | Editor mode |
| append | false | boolean | Append / record notes |
| generationType | "progression" | melody, arpeggio, chord, progression | Pattern type |
| eventCount | 4 | 1..64, step 1 | Pattern events |
| inKey | true | boolean | Generate only key tones |
| maxSpan | 4 | 0..12, step 1 | Maximum fretted span |
| maxLeap | 7 | 0..36, step 1 | Maximum melodic leap |
| repeatNotes | true | boolean | Allow consecutive repeated pitches |
| lowPitch | 24 | 0..127, step 1 | Lowest MIDI pitch |
| highPitch | 88 | 0..127, step 1 | Highest MIDI pitch |
| chordVocabulary | "triads" | triads, sevenths, sus, power | Chord vocabulary |
| restRate | 0 | 0..75, step 5 | Rest probability (%) |
| seed | 1731 | 1..2147483646, step 1 | Seed |
| tempo | 92 | 30..240, step 1 | Tempo · quarter notes / min |
| meter | "4/4" | 2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 9/8, 12/8 | Meter |
| duration | 384 | 24, 32, 48, 64, 96, 144, 192, 288, 384 | New event duration (ticks) |
| picking | "free" | free, up, down, fingers, alternate | Picking |
| fingerPattern | "p i m a" | p i m a, i m, p i m, i m a | Finger sequence |
| volume | 25 | 0..60, step 5 | Volume (%) |
| waveform | "triangle" | sine, triangle | Sound |
| loop | false | boolean | Loop pattern |
| metronome | false | boolean | Metronome |
| audition | false | boolean | Hear note on selection |
| labels | "notes" | notes, degrees, both | Fretboard labels |
| showOctaves | false | boolean | Show octaves |
| colorReference | "tonic" | tonic, chord, pinned | Interval color reference |
| pinnedMidi | 60 | 0..127, step 1 | Pinned reference MIDI pitch |
| open0 | 40 | 0..91, step 1 | String 1 open MIDI pitch |
| enabled0 | true | boolean | Use string 1 |
| open1 | 45 | 0..91, step 1 | String 2 open MIDI pitch |
| enabled1 | true | boolean | Use string 2 |
| open2 | 50 | 0..91, step 1 | String 3 open MIDI pitch |
| enabled2 | true | boolean | Use string 3 |
| open3 | 55 | 0..91, step 1 | String 4 open MIDI pitch |
| enabled3 | true | boolean | Use string 4 |
| open4 | 59 | 0..91, step 1 | String 5 open MIDI pitch |
| enabled4 | true | boolean | Use string 5 |
| open5 | 64 | 0..91, step 1 | String 6 open MIDI pitch |
| enabled5 | true | boolean | Use string 6 |
| open6 | 69 | 0..91, step 1 | String 7 open MIDI pitch |
| enabled6 | true | boolean | Use string 7 |
| open7 | 74 | 0..91, step 1 | String 8 open MIDI pitch |
| enabled7 | true | boolean | Use string 8 |
| open8 | 79 | 0..91, step 1 | String 9 open MIDI pitch |
| enabled8 | true | boolean | Use string 9 |
| open9 | 84 | 0..91, step 1 | String 10 open MIDI pitch |
| enabled9 | true | boolean | Use string 10 |
| open10 | 88 | 0..91, step 1 | String 11 open MIDI pitch |
| enabled10 | true | boolean | Use string 11 |
| open11 | 88 | 0..91, step 1 | String 12 open MIDI pitch |
| enabled11 | true | boolean | Use string 12 |
| color0 | "#e9e6dc" | #RRGGBB | Interval 0 color |
| color1 | "#be98ed" | #RRGGBB | Interval 1 color |
| color2 | "#70d4e4" | #RRGGBB | Interval 2 color |
| color3 | "#5b9dff" | #RRGGBB | Interval 3 color |
| color4 | "#f17668" | #RRGGBB | Interval 4 color |
| color5 | "#69c8b0" | #RRGGBB | Interval 5 color |
| color6 | "#de8fcf" | #RRGGBB | Interval 6 color |
| color7 | "#e5c06c" | #RRGGBB | Interval 7 color |
| color8 | "#a7a5f4" | #RRGGBB | Interval 8 color |
| color9 | "#eca868" | #RRGGBB | Interval 9 color |
| color10 | "#95b9dd" | #RRGGBB | Interval 10 color |
| color11 | "#ee9fae" | #RRGGBB | Interval 11 color |

### Scale collections

| Name | Semitone offsets | Diatonic letter offsets |
| --- | --- | --- |
| Major / Ionian | 0, 2, 4, 5, 7, 9, 11 | 0, 1, 2, 3, 4, 5, 6 |
| Dorian | 0, 2, 3, 5, 7, 9, 10 | 0, 1, 2, 3, 4, 5, 6 |
| Phrygian | 0, 1, 3, 5, 7, 8, 10 | 0, 1, 2, 3, 4, 5, 6 |
| Lydian | 0, 2, 4, 6, 7, 9, 11 | 0, 1, 2, 3, 4, 5, 6 |
| Mixolydian | 0, 2, 4, 5, 7, 9, 10 | 0, 1, 2, 3, 4, 5, 6 |
| Natural minor / Aeolian | 0, 2, 3, 5, 7, 8, 10 | 0, 1, 2, 3, 4, 5, 6 |
| Locrian | 0, 1, 3, 5, 6, 8, 10 | 0, 1, 2, 3, 4, 5, 6 |
| Major pentatonic | 0, 2, 4, 7, 9 | 0, 1, 2, 4, 5 |
| Minor pentatonic | 0, 3, 5, 7, 10 | 0, 2, 3, 4, 6 |
| Blues | 0, 3, 5, 6, 7, 10 | 0, 2, 3, 4, 4, 6 |
| Harmonic minor | 0, 2, 3, 5, 7, 8, 11 | 0, 1, 2, 3, 4, 5, 6 |
| Melodic minor (ascending) | 0, 2, 3, 5, 7, 9, 11 | 0, 1, 2, 3, 4, 5, 6 |
| Chromatic | 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 | chromatic spelling |

### Chord definitions

| Suffix | Quality | Required offsets | Optional offsets |
| --- | --- | --- | --- |
| (none) | major | 0, 4, 7 | none |
| m | minor | 0, 3, 7 | none |
| dim | diminished | 0, 3, 6 | none |
| aug | augmented | 0, 4, 8 | none |
| sus2 | suspended second | 0, 2, 7 | none |
| sus4 | suspended fourth | 0, 5, 7 | none |
| 5 | power chord | 0, 7 | none |
| 6 | major sixth | 0, 4, 7, 9 | none |
| m6 | minor sixth | 0, 3, 7, 9 | none |
| 7 | dominant seventh | 0, 4, 7, 10 | none |
| maj7 | major seventh | 0, 4, 7, 11 | none |
| m7 | minor seventh | 0, 3, 7, 10 | none |
| m(maj7) | minor major seventh | 0, 3, 7, 11 | none |
| m7b5 | half-diminished seventh | 0, 3, 6, 10 | none |
| dim7 | diminished seventh | 0, 3, 6, 9 | none |
| add9 | added ninth | 0, 2, 4, 7 | none |
| 9 | dominant ninth | 0, 2, 4, 10 | 7 |
| maj9 | major ninth | 0, 2, 4, 11 | 7 |
| m9 | minor ninth | 0, 2, 3, 10 | 7 |
| 11 | dominant eleventh | 0, 2, 4, 5, 10 | 7 |
| m11 | minor eleventh | 0, 2, 3, 5, 10 | 7 |
| 13 | dominant thirteenth | 0, 4, 9, 10 | 2, 5, 7 |
| maj13 | major thirteenth | 0, 4, 9, 11 | 2, 5, 7 |
| m13 | minor thirteenth | 0, 3, 9, 10 | 2, 5, 7 |

### Presets (physical string order)

| Name | Open MIDI pitches |
| --- | --- |
| Guitar · standard | 40, 45, 50, 55, 59, 64 |
| Guitar · Drop D | 38, 45, 50, 55, 59, 64 |
| Guitar · DADGAD | 38, 45, 50, 55, 57, 62 |
| Guitar · 7 strings | 35, 40, 45, 50, 55, 59, 64 |
| Guitar · 8 strings | 30, 35, 40, 45, 50, 55, 59, 64 |
| Bass · 4 strings | 28, 33, 38, 43 |
| Bass · 5 strings | 23, 28, 33, 38, 43 |
| Bass · 6 strings | 23, 28, 33, 38, 43, 48 |

### Interval palette

| Semitone class | Common label | Hex |
| --- | --- | --- |
| 0 | P1 | #e9e6dc |
| 1 | m2 | #be98ed |
| 2 | M2 | #70d4e4 |
| 3 | m3 | #5b9dff |
| 4 | M3 | #f17668 |
| 5 | P4 | #69c8b0 |
| 6 | A4 / d5 | #de8fcf |
| 7 | P5 | #e5c06c |
| 8 | m6 | #a7a5f4 |
| 9 | M6 | #eca868 |
| 10 | m7 | #95b9dd |
| 11 | M7 | #ee9fae |

### Starter projects

Physical frets are listed string0 upward; x is mute. C=[x,3,2,0,1,0], Am=[x,0,2,2,1,0], F=[1,3,3,2,1,1], G=[3,2,0,0,0,3], Cm=[x,3,1,0,1,x]. Progression C-Am-F-G and comparison C-Cm use384ticks/event. A-minor melody is string5 frets[5,8,7,5,5,7,8,5],48ticks/event. Bass4 C-major arpeggio positions[(s1,3),(s2,2),(s3,0),(s3,5),(s3,0),(s2,2),(s1,3),(s1,3)] use96ticks and fingers i m.

Long timelines render16 events at a time with Previous/Next controls and the true total count. Selecting a page selects its first event. Playback retains the whole128-event project and displays its current event number even beyond the visible page. Memoize event analysis by exact event content and settings; invalidate when either changes. This avoids recalculating unchanged chord names on every fret edit.
