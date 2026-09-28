# ToneDef

A browser workspace for guitar and bass: edit a fretboard, explore harmony, generate practice patterns and play them back.

[Open ToneDef](https://generalgroovy.github.io/tonedef/) · [Release verification](docs/DEPLOYMENT.md)

ToneDef is the main guitar project. Useful melody contours from Guitar Practice Generator and practice cards from GeneralGroovy are included here; those older apps remain references.

## Start practicing

1. Select an event in **Pattern**. Tap a fret to edit its notes. **Chord** keeps one note per string; **Melody** edits one note per event. Enable **Append** to record a sequence.
2. Open **Settings** to choose tuning, strings, key and generation constraints. Select the Melody pattern type to reveal **Melody contour**: Random, Ascending, Descending or Arch.
3. Open **Practice range** above the fretboard to set each string’s first and last allowed physical fret. Drag either handle, tap the track, use arrow keys (Shift = five frets; Home/End = limit), or enter numbers. **Use visible frets** copies the current window; **Reset ranges** removes per-string restrictions.
4. Press **Generate** to use the saved seed. **Randomize** changes only settings whose randomization flags are checked. Lock timeline events that must survive regeneration.
5. Press **Play** and practice along. **Stop** releases playback and restores the editing selection. Tempo counts quarter notes; metronome, loop, volume and sound are in Settings.
6. Use **Projects** to save a named copy, export JSON, export tab or download a Markdown practice card.

Projects opens with the name field focused. Save confirmations and import errors stay inside the dialog; **Import JSON** also works from the keyboard. A rejected import leaves the current project unchanged.

Per-string bounds intersect the visible fret window, capo, key, pitch and open-string settings. Even effective open strings must fit their range. Bounds attach to physical string numbers and remain saved when tuning or string count changes; off-instrument frets are unavailable. They constrain new generation, including randomized variants, without moving existing or locked notes.

An impossible generation request leaves your work unchanged. Widen the range, reduce the length, allow repeats or relax the leap limit. Arch rises to the middle sounding event and then falls; rests do not count toward its midpoint.

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
| Workspace | Show, hide, arrange, resize or reset panels |

Large filled notes are selected, medium colored notes are in the key and small notes are outside it. Labels accompany interval colors. The interval matrix, pitch wheel and chord-motion panel describe the current selection; chord motion compares sorted pitches, not inferred independent voices.

## Saved work and recovery

The current project autosaves in this browser. Projects keeps up to 20 named copies; panel layout saves separately. A last-good backup is attempted if the current autosave cannot be read. On recovery failure, the app opens an example without overwriting the damaged storage until you make an edit.

**Export JSON before clearing browser data or moving between sites/devices.** The public GitHub app and localhost have separate browser storage. Exported JSON is the editable backup. Text tab and Markdown practice cards are reference exports and cannot be imported as projects. Older ToneDef version-2 saves receive the contour default and unrestricted per-string ranges automatically; GeneralGroovy browser storage is not migrated.

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

The 1.4.0 release passed 44 automated test groups, 13 browser widths and a live hosted smoke. See the dated [release record](docs/DEPLOYMENT.md); these results do not imply human listening or physical touch-device acceptance.

## Scope and reference

Supports 1–12 strings, octave-aware/re-entrant tuning, capo, up to 36 frets, 128 edited events and 64 generated events. Edited chords allow 12 notes; generated voicings allow six. JSON imports are limited to 500 KB. Twelve-tone equal temperament, A4 = 440 Hz; fret numbers are absolute physical frets. Fret-span limits are reach heuristics, not ergonomic guarantees. Microphone assessment, MIDI-file export and cloud sync are not implemented.

- [Consolidation and contour behavior](docs/CONSOLIDATION.md)
- [Expressive fretboard](docs/EXPRESSIVE-FRETBOARD.md) and [sound/playback](docs/GUITAR-PLAYBACK.md)
- [Rebuild contract](docs/REBUILD.md) and [workspace behavior](docs/GUI-WORKSPACE.md)
- [Historical acceptance evidence](docs/ACCEPTANCE.md) and [roadmap](docs/ROADMAP.md)

MIT license.
