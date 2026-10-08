# ToneDef

Learn guitar and bass theory by hearing notes, exploring the neck, and making your own practice patterns. No account or download needed.

[Open ToneDef](https://generalgroovy.github.io/tonedef/) · [Release verification](docs/DEPLOYMENT.md)

ToneDef is the main guitar project. Useful melody contours from Guitar Practice Generator and practice cards from GeneralGroovy are included here; those older apps remain references.

## Engineering overview

- **Musical modelling:** seeded pattern generation combines scale, rhythm, string and fret constraints while preserving locked notes and events.
- **Interactive audio:** a JavaScript fretboard and Web Audio playback connect musical structure to direct note, slide and bend controls.
- **State and recovery:** version-compatible projects, validated JSON imports, undo/redo and browser-storage recovery preserve editable work.

[Project overview](https://generalgroovy.web.app/apps/tonedef/) · [Architecture and rebuild guide](docs/REBUILD.md)

## Start here

**Find your way:** Learn explores theory, Practice builds exercises, and Studio opens the complete editor. **Instrument** beside the neck opens tuning, sound and display in place; **Back** returns to your previous lesson or choices. Setup tabs work with Left/Right and Home/End; Escape returns. Each view remembers its open sections and position for the session. On small screens, the bottom bar jumps between choices, fretboard and pattern. [Navigation and setup](docs/NAVIGATION.md).

**Read the neck at a glance:** small neutral discs are outside the key; colored rings are in the key; filled squares are positions used in your pattern. The white outline follows the current step. A dashed square keeps an outside-key pattern note distinct. Every position remains playable.

**Learn** opens first with a six-part path: Notes → Steps → Scales → Intervals → Chords → Modes. Jump into any lesson. Tap a note for an explanation of its place in the scale; in Steps or Intervals, tap two notes for the named distance, direction and exact half-step count, including octaves. **Hear pair** replays them; **New pair** chooses a new start. Chords builds a root–third–fifth triad on any degree of a seven-note scale. Hear its tones without editing your pattern. Modes keep home fixed and name the changes from major. Definitions stay under Info.

**Practice** begins with **What do you want to practise?** Choose a goal from first notes and pulse through scale sequences, triplets, sixteenth-note groups and seventh-chord changes. Each goal explains what to listen for and how to stretch it. Goal selection configures rules; **New pattern** makes the music. The main action stays above the optional **Shape next pattern** controls. Check **Random** only beside choices you want to vary. **Keep step** protects a selected note, chord or rest. Undo restores the previous pattern and settings.

**Practise a passage:** open **Choose passage** and drag its endpoints or enter first/last step numbers. The middle grip moves the whole group; **Whole pattern** restores the full scope. This never deletes or edits saved music. **Play along** follows the guitar guide; **Listen → play** alternates the guide with your own turn over a click. **Repeat** continues that cycle. An optional one-bar count-in gives you time to prepare, once per start. The neck follows both turns, including chords. Escape stops everything.

**Understand each move:** select a card or use the arrows below the neck. The step guide shows its pitches, position, duration, picking and spelled interval from the previous note. For chords it describes lowest-note movement and directs deeper analysis to Studio. **Hear** previews the selected step with its original picking direction.

**Check your progress:** play the current passage on your instrument, then mark **Clean pass** or **Needs work**. Three consecutive clean passes offer an optional 5 bpm increase; slower and exact tempo controls remain available. Music or passage changes reset the session. A tempo change resets its streak. Results are self-reported and stay in this session; ToneDef does not listen to or grade your instrument. The timing explanation uses actual notes and rests in the passage.

**Shape next pattern** groups order/rhythm/picking, per-string fret ranges, and pitch/reach/rests in separate disclosures. Active rules stay summarized; controls appear only for the pattern type and rhythm that use them. A group of two plays two sounding notes per chosen string, from low to high on a standard guitar, then cycles; the last group may be shorter. **Any** allows free string changes. Optional rests count toward pattern length but do not consume string-group slots. Grouping supports 1–16 notes per string. Chords play strings together; a saved incompatible grouping rule gets an explicit correction, with Undo.

**Drag to shape practice:** slide length or speed, drag a range endpoint to resize it, or move its middle grip to shift both ends together. Exact numbers and keyboard arrows remain available. Escape cancels a drag; one Undo reverses it. Random bounds and per-string fret ranges share these controls.

**Challenge yourself** adds optional recall in Learn and Practice. Find notes, work out named intervals, **Match by ear**, or recall a single-note melody in order. Ear matching plays a target from the current scale and hides hints automatically; it does not name the answer. Hide hints removes answers from the neck, lesson feedback and timeline. Notes, intervals and ear matching accept any octave; melody recall requires the exact pitch. Round results stay in the current session and never change your music. [Learning and practice contract](docs/LEARNING-PATH.md) · [Visual practice details](docs/VISUAL-PRACTICE.md).

String **1** is the top string on the displayed neck (high E on a standard guitar); **6** is low E. The low-to-high practice row therefore reads **6 → 1**. This display correction leaves physical IDs, tuning, saved notes and fret ranges unchanged.

The simple fretboard always auditions without changing music, even if Studio's Hear clicks preference is off. Master volume still applies; **Turn sound on** appears when it is zero. Scale previews stop on Escape, navigation, changing the key, or starting another sound. **Studio** provides the full editor and analysis; **Arrange** restores your saved movable panels. **Instrument** beside the neck or **More → Instrument setup** opens configuration. **More → Projects** saves, imports and exports projects; **Backup** downloads editable JSON.

At laptop sizes, the main choices, neck and pattern share the screen. Small screens stack them, with the neck and longer patterns scrolling horizontally. Large targets, keyboard support and short instructions make a gentle starting point; suitability for a particular young learner still needs observation with that learner.

## Go deeper in Studio

1. Choose one of eight recipes in **Exercise**, from First notes & pulse to Seventh-chord changes. This configures the rules without replacing your music.
2. Shape the type, length, melodic sequence/direction, rhythm, tempo and picking. **Pitch & reach** holds deeper limits; **Practice range** sets inclusive bounds for each physical string by drag, tap, keyboard or numeric entry.
3. Press **Generate** to use the saved seed. **Variation** advances the seed while retaining your rules. Lock timeline events that must survive regeneration. Advanced **Randomize flagged** can also alter explicitly enabled settings.
4. Select a card in **Pattern** and edit its notes on the fretboard. **Chord** keeps one note per string; **Melody** edits one note per event. Enable **Append** to record a sequence.
5. Press **Play**. Tempo, loop and metronome are in Exercise; sound and meter are in Instrument. **Stop** releases playback and restores the editing selection.
6. Use **Projects** to save a named copy, export JSON, export tab or download a Markdown practice card.

**Studio** keeps all eight core areas visible together on a laptop. Larger contents scroll within their area; ↗ expands it and Escape returns. Small screens stack the areas with independent neck panning. **Arrange** retains saved panel arrangements and resize controls.
Projects opens with the name field focused. Save confirmations and import errors stay inside the dialog; **Import JSON** also works from the keyboard. A rejected import leaves the current project unchanged.

Per-string bounds intersect the visible fret window, capo, key, pitch and open-string settings. Even effective open strings must fit their range. Bounds attach to physical string IDs and remain saved when tuning or string count changes; off-instrument frets are unavailable. They constrain new generation, including randomized variants, without moving existing or locked notes.

An impossible generation request leaves your work unchanged. Widen the range, reduce the length, allow repeats or relax the leap limit. Free-melody Arch rises and falls; structured Arch retraces the motif at its midpoint. Thirds and groups follow collection positions, so an ascending motif can contain local downward steps. Rests do not advance the melodic sequence. Rhythm cycles include rest slots; locked events retain their exact durations.

## Controls

| Control | Behavior |
| --- | --- |
| Edit notes | Tap to audition and toggle; drag to preview without editing |
| Explore | Play without changing the pattern |
| Hold and drag | Horizontal slide on a physical string; vertical bend up to two semitones |
| Edit key / right-click / Shift+F10 | Change key membership without changing selected notes |
| Arrow keys; Enter or Space | Move fret focus; edit the focused note |
| Explore keyboard | Hold Space/Enter and use arrows for slide/bend; release or Escape stops |
| Undo / Redo | Restore project edits, including generation and settings |
| Learn / Practice / Studio | Short learning activities, configurable patterns, or full editing and analysis |
| Studio → Arrange | Your saved adjustable panel arrangement |

Large filled notes are selected, medium colored notes are in the key and small notes are outside it. Labels accompany interval colors. The From/To interval comparison uses the selected chord or up to four nearby sounding melody events, with event numbers shown. Swap reverses the direction; detailed frequency calculations stay under a disclosure. Key map and chord motion add context; chord motion compares sorted pitches, not inferred independent voices.

## Saved work and recovery

The current project autosaves in this browser. Projects keeps up to 20 named copies; panel layout saves separately. A last-good backup is attempted if the current autosave cannot be read. On recovery failure, the app opens an example without overwriting the damaged storage until you make an edit.

**Export JSON before clearing browser data or moving between sites/devices.** The public GitHub app and localhost have separate browser storage. Exported JSON is the editable backup. Text tab and Markdown practice cards are reference exports and cannot be imported as projects. Older ToneDef saves receive missing contour/range, sequence/rhythm and Practice defaults automatically; all new Practice randomization options start off. GeneralGroovy browser storage is not migrated.

No account, server database, analytics or external fonts are required.

## Run locally

Requires Node.js 22 or newer. From this checkout:

```sh
npm start
```

Open `http://127.0.0.1:4173/tonedef/`. Use `npm.cmd` on Windows if PowerShell blocks `npm.ps1`. ES modules and the generation worker require HTTP; opening `index.html` directly is unsupported.

To build and preview the deployable app:

```sh
npm run build
npm run preview
```

Only `dist/` is published. There are no application or build dependencies.

## Check changes

```sh
npm ci
npm run check
npm test
npm run build
```

The optional browser suite is `node scripts/check-layout.mjs`. It needs Playwright 1.57.0 and its Chromium browser; `TONEDEF_PLAYWRIGHT_PATH` can point to an isolated installation's `index.mjs`. CI runs it separately from the dependency-free application tests.

The tests cover musical invariants, storage compatibility, locks, input recovery and the actual generation workflow. See the dated [release records](docs/DEPLOYMENT.md); software checks do not establish human listening, musical learning or physical touch-device acceptance.

## Scope and reference

Supports 1–12 strings, octave-aware/re-entrant tuning, capo, up to 36 frets, 128 edited events and 64 generated events. Edited chords allow 12 notes; generated voicings allow six. JSON imports are limited to 500 KB. Twelve-tone equal temperament, A4 = 440 Hz; fret numbers are absolute physical frets. Fret-span limits are reach heuristics, not ergonomic guarantees. Microphone assessment, MIDI-file export and cloud sync are not implemented.

- [Current learning, Practice and Studio contract](docs/EXERCISE-WORKSPACE.md)
- [Consolidation and contour behavior](docs/CONSOLIDATION.md)
- [Expressive fretboard](docs/EXPRESSIVE-FRETBOARD.md) and [sound/playback](docs/GUITAR-PLAYBACK.md)
- [Rebuild contract](docs/REBUILD.md) and [workspace behavior](docs/GUI-WORKSPACE.md)
- [Historical acceptance evidence](docs/ACCEPTANCE.md) and [roadmap](docs/ROADMAP.md)

MIT license.
