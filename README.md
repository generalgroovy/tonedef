# ToneDef

Learn guitar and bass theory by hearing notes, exploring the neck, and making your own practice patterns. No account or download needed.

[Open ToneDef](https://generalgroovy.github.io/tonedef/) · [Release verification](docs/DEPLOYMENT.md)

ToneDef is the main guitar project. Useful melody contours from Guitar Practice Generator and practice cards from GeneralGroovy are included here; those older apps remain references.

## Start here

**Learn** opens first. Choose Notes, Steps, Scales or Modes, then tap a note to hear it and find it on the neck. Only the choices needed by that lesson appear. **Hear scale** plays the displayed notes without changing your pattern. Modes keep the same home note and name the notes that change from major. Definitions stay under Info.

**Practice** keeps the choices, fretboard and pattern together. Choose a pattern type, home note and scale, length, strings, and notes per string, then **New pattern**. Check **Random** only beside the choices you want to vary: its fixed control dims and any random limits appear beside it. String buttons remain the available pool. **Play pattern** follows the cards; **Keep step** protects a selected note, chord or rest. Undo restores the previous pattern and all its settings.

**More choices** holds recipes, note order, rhythm and per-string fret ranges. Its summary names active rules; controls appear only for the pattern type and rhythm that use them. A group of two plays two sounding notes per chosen string, from low to high on a standard guitar, then cycles; the last group may be shorter. **Any** allows free string changes. Optional rests count toward pattern length but do not consume string-group slots. Grouping supports 1–16 notes per string. Chords play strings together; a saved incompatible grouping rule gets an explicit correction, with Undo.

String **1** is the top string on the displayed neck (high E on a standard guitar); **6** is low E. The low-to-high practice row therefore reads **6 → 1**. This display correction leaves physical IDs, tuning, saved notes and fret ranges unchanged.

The simple fretboard always auditions without changing music, even if Studio's Hear clicks preference is off. Master volume still applies; **Turn sound on** appears when it is zero. Scale previews stop on Escape, navigation, changing the key, or starting another sound. **Studio** provides the full editor and analysis; **Arrange** restores your saved movable panels. **More → Settings** opens the instrument. **More → Projects** saves, imports and exports projects; **Backup** downloads editable JSON.

At laptop sizes, the main choices, neck and pattern share the screen. Small screens stack them, with the neck and longer patterns scrolling horizontally. Large targets, keyboard support and short instructions make a gentle starting point; suitability for a particular young learner still needs observation with that learner.

## Go deeper in Studio

1. Choose a recipe in **Exercise**: Scale walk, Thirds study, Triplet groups, Four-note groups, Chord pulse or Dotted line. This configures the rules without replacing your music.
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
