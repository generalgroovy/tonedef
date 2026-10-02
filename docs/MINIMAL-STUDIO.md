# ToneDef 1.7 — focused studio

This is the current GUI contract. It supersedes the default all-panels layout and
interval tables in VISUAL-WORKSPACE and GUI-WORKSPACE. The theory, project schema,
generation, expressive audio and practice-range contracts remain unchanged.

## One place for each task

| Location | Functions |
| --- | --- |
| Header | Project name, undo/redo, one Play/Stop button, Projects, Layout, Help |
| Fretboard | Action: Play notes, Build a chord, Write a melody, Edit the key; key and scale; Hear notes; melody Append |
| Colors above the neck | Always name the current color reference; expand for tonic/chord-root/pinned reference, numeric intervals, palette legend, note/degree labels, octaves, enharmonic preference, tonic spelling, custom interval colors |
| Pattern | Select or add chord/note/rest events; drag to reorder; edit the selected event's duration, picking, fingers, order, duplication, lock and deletion; tempo, loop, metronome |
| Notes & intervals | Chord interpretation, actual note positions, pinning and enharmonic spelling; **one** From/To note comparison; optional frequency mathematics; adjacent chord motion by sorted pitch rank |
| Key map | Circle of fifths/relative minors, editable chromatic wheel, scale steps, compatible scales and modes |
| Practice | Type/count/contour/vocabulary/key constraint; reach, pitch and repeat limits; rhythm and picking defaults; per-string ranges; Generate; seed, randomization flags and Randomize; examples |
| Instrument | Tuning preset, 1–12 strings, 1–36 frets plus open strings, capo, visible range, handedness, per-string tuning/enabling, sound, volume, meter |
| Projects | Named local copies, new project, JSON import/export, text tab and Markdown practice card export |
| Layout → Customize panels | Restore independent saved panel order, visibility, collapsed state and size; keyboard and pointer arrangement; reset/fit controls |

Default view shows only the fretboard and pattern. Four clearly labelled disclosure
buttons open one additional section at a time; click again or Close to dismiss it.
Escape inside a section returns focus to its disclosure button, except while a
native select, range gesture, expression gesture or modal owns the interaction.
The optional custom workspace preserves its own preferences without rewriting them
when the focused view is used.

## Interaction and theory

- Build a chord toggles one physical position per string. Write a melody edits a
  one-note event; Append records successive events. Play notes auditions without
  editing. Edit the key toggles pitch-class membership. Right-click/Shift+F10 works
  as a key-edit shortcut. Selecting/adding a pattern event returns to editing.
- A contextual sentence describes the current action. How to play explains hold
  gestures and the visual hierarchy. Large filled discs are selected; medium
  colored discs are in the key; small discs are outside. The tonic has a double
  ring. Chord lines follow physical strings and do not imply a barre or voice leading.
- Hear notes defaults on but imported explicit mute preferences remain respected.
  Hold sideways to slide and vertically to bend; expression previews do not rewrite
  the saved fingering. Playback shows the sounding chord, then restores the edited
  selection. Existing guitar synthesis and physical string strum ordering remain.
- From/To options retain each note occurrence. For a selected chord, compare its
  actual notes; for a melody, compare any melody events in the pattern, labelled by
  event number. Swap reverses direction. Show spelled interval name, direction,
  and signed semitones including octaves. Color uses absolute interval mod 12.
- Frequency & pitch distance expands to the exact equal-temperament ratio
  `2^(signedSemitones/12)`, endpoint Hz, cents, directed pitch-class distance and
  an axis of the two compared pitches. A descending octave is -12 and ratio 0.5.
  There is no pairwise interval table or second copy of these calculations.
- Between chords compares consecutive chord events by sorted sounding pitch,
  preserving octaves and explicit entering/leaving pitches. Compatibility with a
  scale is not proof of a key. All details retain these distinctions.

## Reconstruction

1. Implement the musical modules and storage from REBUILD, plus CONSOLIDATION,
   EXPRESSIVE-FRETBOARD and GUITAR-PLAYBACK supplements. Per-string ranges use
   `settings.practiceRanges`: 12 `{min,max}` integer pairs, initially 0 and 36,
   indexed by physical string. Missing legacy ranges migrate to defaults;
   malformed explicit ranges are rejected. Intersect ranges with the visible
   window, capo, key, pitch limits and enabled strings before generation. Enabled
   effective open strings may lie outside the visible window but must still lie
   inside their per-string range. Bounds
   do not move existing notes and remain stored for temporarily absent strings.
   Range handles and numeric inputs form one transaction per gesture; Escape
   cancels; arrows move one fret, Shift five, Home/End to limits. Reversed bounds
   clamp to the other edge. No open-string exception bypasses these bounds.
2. `app.js` renders semantic native inputs, buttons and details; its delegated
   handlers perform validated transactions. Preserve focused input IDs, note
   positions, expanded disclosures and scroll positions when rendering.
3. `workspace.js` wraps the panels as documented in GUI-WORKSPACE. Then
   `studio.js` reparents the existing controls (never copies them), builds the four
   sections and forces core panels visible with natural height in focused mode.
   Contextual sections have unique labelled controls; all layout state is separate
   from the musical project and undo history.
4. Store only `{custom:boolean}` in `tonedef.studio.v1`; a missing/invalid value
   defaults false. Keep the open contextual section in memory, initially none.
   Never mutate `tonedef.workspace.v1` while merely switching presentation modes.
5. Keep `distanceData` and `pitchGeometry` pure. `intervalWorkspace` renders a
   comparator with From/To selects, Swap, a single result and a details disclosure.
   Clamp selection after event changes; no comparison changes project data.
6. Load styles in this order: `styles.css`, `compact.css`, `workspace.css`,
   `studio.css`. The latter controls the focused layout: dark green-gray surface,
   restrained light-green primary action, existing wood grain and interval colors,
   52px fret cells, a 1600px content cap, no external fonts/images/dependencies.
   Four section buttons become two columns below 760px; theory and instrument
   details stack. Fretboard/timeline overflow internally, never the page.
7. `build.mjs` includes all four stylesheets, index, favicon and every `src/*.js`
   in the manifest hash. Publish `dist/` with relative URLs at `/tonedef/`.

## Validation

Run syntax checks, all pure-module tests and build. The browser suite checks 13
viewport widths, all four sections, unique control IDs, fret target sizes, and
desktop/touch-emulated editing, audio state, comparison direction, presentation
non-mutation, project recovery, random flags, ranges, generation, custom layout
persistence, dense instruments and empty/rest states. Compare screenshots to the
previous published revision, not to a synthetic page with CSS disabled.

Record fresh results and live build identity in DEPLOYMENT. Browser audio state
tests do not prove human listening quality; emulated touch is not physical-device
acceptance. No usability study or universal immediate comprehension is claimed.
