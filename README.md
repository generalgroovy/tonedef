# ToneDef

A browser workspace for guitar and bass: edit a fretboard, explore harmony, generate practice patterns and play them back.

[Open ToneDef](https://generalgroovy.github.io/tonedef/) · [Release verification](docs/DEPLOYMENT.md)

ToneDef is the main guitar project. Useful melody contours from Guitar Practice Generator and practice cards from GeneralGroovy are included here; those older apps remain references.

## Start practicing

1. Choose **Build a chord**, **Write a melody**, **Play notes** or **Edit the key** above the fretboard. Click notes; hold and drag to slide or bend. The instruction below the neck follows your action.
2. Select a **Pattern** card to edit it. **Edit selected event** reveals duration, picking, reorder, duplicate, lock and delete. Enable **Append** when writing a sequence.
3. Open **Notes & intervals** for note positions, chord interpretation and one directional From/To comparison. **Key map** opens the circle of fifths and scale analysis. **Colors** above the neck controls the reference, labels and palette.
4. Open **Practice** to set generation rules and per-string ranges. **Generate pattern** uses the saved seed; **Randomize checked** changes only enabled settings. Locked events survive generation. **Instrument** holds tuning, strings, frets, sound and volume.
5. Press **Play**; the same button becomes **Stop**. Tempo, loop and metronome sit beside the pattern. Use **Projects** to save a copy, import/export JSON, export tab or download a practice card.
6. The focused view opens one section at a time. **Layout → Customize panels** restores draggable, resizable and hideable panels with their saved arrangement.

Projects opens with the name field focused. Save confirmations and import errors stay inside the dialog; **Import JSON** also works from the keyboard. A rejected import leaves the current project unchanged.

Per-string bounds intersect the visible fret window, capo, key, pitch and open-string settings. Even effective open strings must fit their range. Bounds attach to physical string numbers and remain saved when tuning or string count changes; off-instrument frets are unavailable. They constrain new generation, including randomized variants, without moving existing or locked notes.

An impossible generation request leaves your work unchanged. Widen the range, reduce the length, allow repeats or relax the leap limit. Arch rises to the middle sounding event and then falls; rests do not count toward its midpoint.

## Controls

| Control | Behavior |
| --- | --- |
| Build a chord / Write a melody | Tap to audition and toggle; drag to preview without editing |
| Play notes | Play without changing the pattern |
| Hold and drag | Horizontal slide on a physical string; vertical bend up to two semitones |
| Edit the key / right-click / Shift+F10 | Change key membership without changing selected notes |
| Arrow keys; Enter or Space | Move fret focus; edit the focused note |
| Play notes keyboard | Hold Space/Enter and use arrows for slide/bend; release or Escape stops |
| Undo / Redo | Restore project edits, including generation and settings |
| Layout → Customize panels | Show, hide, arrange, resize or reset panels |

Large filled notes are selected, medium colored notes are in the key and small notes are outside it. Labels accompany interval colors. The directional interval comparison, pitch wheel and chord-motion panel describe the current selection; chord motion compares sorted pitches, not inferred independent voices.

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

See the dated [release record](docs/DEPLOYMENT.md) for local, CI and live verification. Automated audio checks and emulated touch do not imply human listening or physical-device acceptance.

## Scope and reference

Supports 1–12 strings, octave-aware/re-entrant tuning, capo, up to 36 frets, 128 edited events and 64 generated events. Edited chords allow 12 notes; generated voicings allow six. JSON imports are limited to 500 KB. Twelve-tone equal temperament, A4 = 440 Hz; fret numbers are absolute physical frets. Fret-span limits are reach heuristics, not ergonomic guarantees. Microphone assessment, MIDI-file export and cloud sync are not implemented.

- [Current focused interface and complete control map](docs/MINIMAL-STUDIO.md)
- [Consolidation and contour behavior](docs/CONSOLIDATION.md)
- [Expressive fretboard](docs/EXPRESSIVE-FRETBOARD.md) and [sound/playback](docs/GUITAR-PLAYBACK.md)
- [Rebuild contract](docs/REBUILD.md) and [workspace behavior](docs/GUI-WORKSPACE.md)
- [Historical acceptance evidence](docs/ACCEPTANCE.md) and [roadmap](docs/ROADMAP.md)

MIT license.
