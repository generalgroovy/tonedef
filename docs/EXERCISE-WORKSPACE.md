# Exercise workspace — ToneDef 1.9

## Clarity refinements in 1.9

Learn places topics first and shows one relevant collection chooser. Notes/Steps
keep it under Info, Scales shows it directly, and Modes uses only its seven
buttons. Mode comparisons name actual altered pitches relative to the same-root
major scale. Changed degree buttons have a dashed outline and accessible text.

Hear scale uses `learningPitches()` and a separate `Player.playSequence()` at
90 notes per minute, with no loop or metronome. It never creates project events.
Escape, blur/hidden tab, render/navigation, pattern playback (including Space),
and other note auditions cancel it, including pending audio initialization.
Play pattern explicitly plays saved events. Lesson and fretboard auditions share
pitch feedback; synthetic/assistive clicks update the same polite readout.
Simple views override audition locally without changing Studio's saved preference.

Randomized Practice fields are disabled while their inline bounds are active;
string buttons still choose the pool. Pattern type is visible, grouping supports
the model's full 0–16 range, and unused type/rhythm controls are absent. Saved
chord/grouping conflicts require an explicit undoable correction. Failure messages
stay by New pattern while that project snapshot is unchanged. The matching recipe
and an active-rules summary show what governs generation.

Displayed strings count from the top of the drawn neck: standard guitar high E
is 1 and low E is 6. `stringNumber()` provides all visible/exported labels; saved
IDs s0…s11, fret-range indices, generation order and musical values do not change.
The master volume is respected; a zero volume exposes Turn sound on in simple views.

## Learn and Practice first

The default is **Learn**, with Notes, Steps, Scales and Modes activities. Each has
a short playable task, named pitch buttons, and definitions under Info. The seven
major-scale modes are compared in parallel around the same home note; they do
not silently replace existing pattern notes. Tapping a lesson pitch highlights
matching pitch classes on the neck. Learn and Practice use the neck for audition;
editing, chord mathematics, pitch wheels and full instrument controls live in
**Studio**. **More** contains Projects, Settings, help, Redo and JSON Backup.

**Practice** exposes home/scale, note count, a string pool, notes per string,
New pattern, speed and repeat. Random key, scale, count, strings and group size
are independent opt-ins. More choices holds recipes, rhythm, melodic order,
per-string fret ranges and reach/rest constraints. Random bounds appear beside
the enabled random choice. The generated
string subset and group size appear after successful generation. That receipt is
session-only; project options and actual notes persist. Impossible requests leave
the project unchanged, including its seed. One Undo restores a whole generation.

At 1280 × 720 and 1366 × 768, the choices, neck and pattern share the viewport;
extra controls can scroll inside their panel. Below 1100px width or 700px height,
they stack.
Main learner targets are at least 44px. No age-based gate or separate child data
is used. Software checks cover interaction and readability, not proof of learning
or suitability for every child; observe real learners before making those claims.

Presentation uses `tonedef.workspace.mode.v3`: learn, practice, overview (Studio),
custom (Arrange). It defaults to learn and preserves the old adjustable layout
under `tonedef.workspace.v1`. Topic navigation is temporary and does not edit
music. JSON contains no presentation layout or learning progress tracking.

## Practice generation contract

Version 2 exports optionally carry `practice`. Import adds missing defaults;
malformed supplied objects reject. New flags all default false:

| Choice | Stored fields | Defaults |
|---|---|---|
| Home/key | keyRandom | false |
| Scale/mode | modeRandom | false |
| Event count | countRandom, countMin, countMax | false, 4, 16 |
| Eligible strings | stringIds | s0 through s11, intersect present/enabled strings |
| Random subset | stringsRandom, stringsMin, stringsMax | false, 1, 6 |
| Group size | notesPerString | 0 (free choice), otherwise 1–8 |
| Random groups | notesPerStringRandom, notesPerStringMin, notesPerStringMax | false, 1, 4 |

`practiceGenerate(project,{advanceSeed:true})` returns `{project,changed,choices}`.
It increments the seed only in the successful returned project; false replays
resolution from the same input. Only opted-in musical choices can change. Fixed
custom pitch sets transpose intact when key alone randomizes. Random scale draws
from the 13 supported scales, including the seven modes. Tuning, capo, enabled
flags, fret ranges, rhythm and other constraints stay fixed.

The selected string pool is sorted in physical order. With N notes per string,
each successive block of N sounding melody/arpeggio events belongs to the next
string, wrapping at the end. Rests do not consume a slot, and a final block may
be partial. Free choice permits any selected string. Chords use the selected
pool but reject nonzero grouping rather than pretending to satisfy it. Disabled
or absent strings are not eligible. The random subset maximum is capped to the
eligible pool, but an impossible minimum rejects.

Per-layer string domains constrain the complete-path solvers for free melodies,
contours, motifs and arpeggios. Locked notes remain exact and must fit the chosen
string schedule; their historical pitches may remain outside new pitch/key/fret
bounds. Locks beyond a shortened pattern reject. Random resolution tries at
most 32 candidates and never relaxes fixed rules. Existing generator calls
without Practice options retain the historical seeded output where feasible.

## Practice loop

Choose a recipe in **Exercise**, adjust its rules, **Generate**, lock or edit any
event, then **Play**. A recipe changes settings only; existing music stays intact
until generation succeeds. **Variation** advances only the seed. It preserves
the instrument, key, bounds, rhythm and locked events. Tight constraints can
produce the same pitches with a different fingering or even the same result.
**Generate** repeats the saved seed. Undo restores the entire previous project.

The six starting recipes are Scale walk, Thirds study, Triplet groups, Four-note
groups, Chord pulse and Dotted line. They are editable configurations, not skill
levels or guarantees of physical playability. Start slowly and tighten the fret
window or per-string ranges to work on a particular position.

## One overview, deeper controls

Studio uses the overview presentation. At laptop sizes (at least 1100 × 680 CSS
pixels), eight areas share the viewport: Exercise, Fretboard, Pattern, Instrument,
Notes & intervals, Intervals, Key map and Chord motion. Larger contents scroll
inside their area. Use ↗ to expand an area and ↙ or Escape to return. On narrow
or short screens, areas reflow vertically and the neck pans independently; no
musical control is made smaller merely to fit a phone.

The exercise's primary fields are visible beside the neck. Pitch & reach,
Practice range, and Seed & randomization hold additional constraints. Instrument
shows tuning and the visible fret window; strings, capo, colors, sound and
examples remain within its disclosures. Generate and Variation are separate
from advanced Randomize flagged, which may alter any enabled setting.

Key map shows a compact major-key grid in fifths order in the desktop overview.
Expand it for the full circle and relative minors, or choose Pitch wheel to edit
collection tones. From/To comparison and detailed frequency calculations remain available in Intervals.
For a melody, that view compares a maximum of four nearby sounding melody events
and labels their original event numbers. Rests are skipped. The fretboard and
note inspector continue to edit only the selected event.

Arrange preserves the prior arrange/resize/hide workflow and saved layouts.
Studio does not overwrite `tonedef.workspace.v1`; expansion is temporary.
Neither preference changes project JSON or musical undo history.

## Rebuild the generation additions

Project version remains 2 and generatorVersion remains 1. Add two typed SCHEMA
select fields, with optional-field migration for older exports:

| Field | Default | Values |
|---|---|---|
| sequencePattern | free | free, steps, thirds, groups3, groups4 |
| rhythmPattern | steady | steady, eighth-quarter, triplets, syncopated |

Missing fields gain defaults and fixed randomization flags; explicitly invalid
fields are rejected. Include both in autosave, JSON, validation, randomization
and Markdown practice cards. Build every src/*.js module, including exercises.js
and analysis-context.js; no external runtime dependency is added.

Sequences apply to melody generation. Build an ordered collection of MIDI pitches
0–127 allowed by the key mask (chromatic when inKey is false), independently of
physical availability. Motifs use collection indices: steps [0], thirds [0,2],
groups3 [0,1,2], groups4 [0,1,2,3]. For sounding step n, the offset is
floor(n / motif.length) + motif[n % motif.length]. Ascending adds offsets;
descending subtracts them. Random considers both directions and chooses a valid
whole phrase from the saved RNG. Arch retraces the motif path at its midpoint.
Rests do not advance the melodic step. Missing physical degrees must reject the
path, never be silently skipped. Thus custom collections need not produce literal
diatonic thirds despite the skip-one motif name.

Enumerate feasible start/direction paths, then select with the existing seeded
generator. Require unlocked pitches to have physical positions in the common
candidate pool; intersect physical string bounds, enabled strings, tuning/capo,
visible frets, open-string rules, key, MIDI limits, leap and repetition settings.
Locked sounding events are exact anchors and may remain outside new generation
bounds. No complete path means an actionable error and no project mutation.

Keep historical free/steady seeded output when the greedy melody/arpeggio path
succeeds. On a dead end or invalid incoming transition into a locked anchor,
retry through a bounded backward reachability solver over at most 64 layers of
128 pitches, then choose a feasible forward path. Do not swallow unrelated errors.
Future locks, rests and arpeggio pitch classes constrain each layer.

At 96 ticks per quarter note, rhythms are: steady = the existing duration field;
eighth-quarter = [48,96]; triplets = [32,32,32]; syncopated (Dotted pulse) =
[72,24,48,48]. Cycle by event index, including rests. Preserve exact locked-event
durations. Rhythm presets change newly generated events, never existing edits.

Recipes are immutable catalogue entries `{id,label,description,settings}`.
`applyExerciseRecipe(project,id)` returns a cloned validated project and changes
only the recipe's generator/rhythm/technique/editor settings. Preserve title,
events, selection, key, instrument, ranges, seed and randomization flags.

## Interaction and verification contract

Every setting/recipe transaction is validated and undoable. Worker completion is
discarded if the user edited the baseline while it ran. Generation failure and
cancellation leave notes/settings untouched; Variation commits its new seed only
with a successful result. Keep keyboard focus after re-render, including action
kind/direction, recipe/setting fields, mode/tool buttons and async generation.
Panel scrolling, open disclosures and fretboard focus survive ordinary renders.

Regression coverage includes exact motifs/ticks, future locked anchors, missing
degrees, arches, rests, migration, recipe preservation, legacy seed fixtures,
arpeggio dead-end recovery, melodic interval context, custom layout preservation,
full overview bounds and the Generate → lock → Variation → Undo workflow.
It also covers all seven modes over twelve roots, safe note previews, Practice
opt-ins/bounds/string scheduling, atomic failures, migration, and complete Undo.

Layout decisions follow [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
and [focus visibility guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html):
keep prose/controls within the viewport while meaningful diagrams scroll locally,
and retain access to keyboard-focused controls. This is a design rationale, not
a claim of a complete accessibility audit. Browser checks do not establish human
learning outcomes, listening quality or physical touch/guitar ergonomics.
