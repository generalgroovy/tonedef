# ToneDef

**Guitar and bass theory, made tangible.** A minimal, local-first workspace by GeneralGroovy for exploring a fretboard, understanding harmony and generating practice patterns.

Publication target: `https://generalgroovy.github.io/tonedef/` · repository target: `generalgroovy/tonedef`. **Publication is pending authenticated GitHub access.** See [deployment status](docs/DEPLOYMENT.md).

## Start

Node.js 22 or newer; verified with Node 24.18.0. There are no runtime or build dependencies.

```sh
npm ci
npm test
npm run check
npm run build
npm start
```

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. Open `http://127.0.0.1:4173/tonedef/`. For the built version: `npm run preview`. All assets use relative URLs; deploy only `dist/`. HTTP is needed for ES modules and the generation worker; opening index.html as a file is unsupported.

## Try it

1. Start with **C → Cm**. Select the second timeline card. The E becomes E♭, changing the root's major third (warm coral) to a minor third (blue).
2. Click a fret to add/remove a note. Chord mode replaces any other note on that string. Melody mode preserves ordered occurrences; **Append / record** permits repeated notes.
3. Right-click a fret to change the key's pitch-class collection. For touch, choose **Edit key**; for keyboard, use arrows, Enter/Space, and Shift+F10.
4. Follow **Between chords** from lowest sounding note upward. Extra notes enter/leave explicitly. Select **Intervals** for a matrix, or explore major and relative minor keys on **Fifths**.
5. **Generate pattern** uses the current settings. **Randomize** changes only eligible settings and pattern content. Expand settings and turn on **Show randomization checkboxes**. Unchecked settings stay exactly fixed. Lock any event that must survive regeneration.
6. Press **Play**, adjust tempo/metronome/picking, and practice the pattern. **Projects** saves named copies and imports/exports portable JSON. Use **Export a backup** to keep a copy outside browser storage.

## Included

- 1–12 physical strings, per-string octave-aware tuning, guitar/bass presets, 1–36 frets, capo, left-handed display and fret window.
- Chord/melody/rest timeline, durations including triplets, reorder, duplicate, locks, undo/redo.
- Actual-pitch chord recognition with inversions, alternatives, explicit incomplete matches, Roman degree labels and spelled simple/compound intervals.
- Thirteen scale collections; circle of fifths, relative minors, chromatic wheel, interval matrix and ranked compatibility.
- Seeded melody/arpeggio/chord/progression generation with allowed strings, pitch range, key, span, leap, rhythm and picking constraints.
- Web Audio playback, simultaneous chords and directional strums, metronome, loop, immediate Stop; volume zero mutes.
- Autosave, last-good recovery, 20 named local copies, versioned JSON and readable text tablature export.

## Musical boundaries

Twelve-tone equal temperament, A4 = 440 Hz, C4 = MIDI 60. Frets are **absolute physical fret numbers**: capo 2 + relative fret 3 means physical fret 5. Physical string 1 begins as the lowest but retains its identity under re-entrant tuning. Stroke direction refers to physical string order, never pitch direction.

Chord/scale names describe supported candidates. A note set does not uniquely prove a key or modulation. Rank comparison does not infer independent voices. Fret span is a reach heuristic, not a guarantee of comfortable fingering. Finger letters are practice instructions; the synthesizer does not reproduce or assess human technique. Chord extensions have explicit bounded required/optional tones. Ascending melodic minor is labeled as such. Colors are a learning convention and always accompanied by text/shape.

Maximum 128 edited events, 64 generated events, 12 sounding notes per edited chord, 6 in generated voicings, and 500 KB per imported file. Generation uses finite search and may report that it did not find a solution. Progress tracking, microphone assessment, cloud accounts and other instrument adapters are future work. Export is text tablature, not a MIDI file.

## Engineering and evidence

Native browser ES modules and Node's built-in test runner keep the application reconstructable and dependency-free. Runtime state validation replaces the preferred TypeScript/Vite stack for this small static application. This is a documented implementation choice, not a claim that JavaScript provides compile-time type checking.

- [Rebuild contract](docs/REBUILD.md): complete schemas, musical tables, algorithms, defaults, build and reconstruction instructions.
- [Design](docs/DESIGN.md): interaction and visual decisions.
- [Acceptance evidence](docs/ACCEPTANCE.md): exact verified boundaries and unrun checks.
- [Deployment and rollback](docs/DEPLOYMENT.md).
- [Roadmap](docs/ROADMAP.md).

MIT license. No analytics, external fonts, tracking scripts or application backend.
