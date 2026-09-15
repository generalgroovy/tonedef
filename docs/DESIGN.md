# ToneDef design contract

## Product

A playable theory notebook. Main workflow: choose context → select real fret/string positions → inspect → hear → generate a variation → practice. The initial project is an immediately usable C–Am–F–G example. Examples are undoable replacements, as is starting a new blank project.

## Layout and tokens

Dark background #111418; panel #1b2026 (source may use nearby structural shades); readable pale text #e9e6dc; muted text #a6afb9; thin gray-green borders; restrained pale sage primary buttons. System sans-serif font (no font download), 16 px base; ordinary controls 14 px; metadata at least 12 px. Panels radius 10–12 px, controls 7 px, panel spacing 20 px desktop / 14 px phone. Brand: outlined square with green t and coral d, ToneDef wordmark and “by GeneralGroovy”. Recreate the favicon as an SVG square and two letters; no raster assets are needed.

Header: project name (desktop), undo, redo, Play, Stop, Projects. Context row: tonic, collection, key-tone chips. Desktop uses a main column and a 340 px inspector/tools column; below 1150 px inspector is 300 px. At 850 px the workspace stacks; at 570 px tools stack and all panels stretch. Phone header places actions on a second row. Fretboard appears before the fold. Fretboard and timeline scroll horizontally inside their containers; the page itself must not scroll sideways. Phone fret targets are 52 px square, desktop 57×59. Smaller controls retain at least 24 px target size. Inspector shortcut beside the neck makes detailed analysis reachable on a phone.

Settings begin collapsed. Expandable groups: Instrument; Practice pattern; Rhythm & technique / Sound; Display & editor. Individual tuning and interval colors expand separately. The expert-facing MIDI pitch bounds have explicit labels; tuning itself accepts note+octave strings.

## State and interaction

- There is one project, selected event, tonal context and set of physical strings. Sounding pitches, names, intervals and exports derive from positions. No second editable MIDI array.
- Left click toggles the chosen position. A chord replaces the previous fret on that string; a melody edits its single occurrence. Append creates a fresh melody event even for a repeated pitch. A rest becomes the chosen editor type when edited.
- Right click/Shift F10 toggles the pitch class throughout the collection, without editing any events. The tonic may remain outside a custom collection; show a warning, never silently add it.
- Circle outer buttons choose the named major key; inner buttons choose its relative natural minor and preserve its proper spelling. Chromatic wheel buttons toggle collection membership. Hover links all positions with that pitch class.
- Frets use one roving tab stop. Arrows follow the displayed neck, Home reaches the effective open/capo, Enter/Space toggles. UI shortcuts never intercept typing in fields. Ctrl/Cmd+Z and Shift+Z undo/redo; Space on blank page toggles playback. Native dialogs trap focus and Escape closes them.
- Timeline selection synchronizes fretboard and inspector. Add/duplicate/delete/move have accessible buttons; drag is supplemental. Protected events reject pitch/content edits and direct reordering. Generation preserves locked events at their current index; inserting/deleting earlier events changes that index deliberately.
- Instrument changes that affect existing notes open a reconciliation dialog: preserve sounding pitches by finding new positions, or preserve positions and retune. Impossible mappings and locked-note changes fail atomically; Cancel/Undo recover the prior instrument. Greedy remapping can reject a feasible complex mapping; it never deletes a note to force success.
- Generate uses current settings. Randomize changes eligible settings as one transaction; a count summary follows. “Keep all fixed” changes setting flags; pattern eligibility has its own checkbox. Turning pattern eligibility off protects the exact current events. Commands, IDs, selection, title, per-event content and checkbox metadata are not recursively randomized settings.
- Native number changes commit on change/blur. Invalid input reports a readable toast and restores the last valid state. Worker errors keep the project intact. Generation has Cancel and discards stale results if the project changed during work.

## Color semantics

The complete palette is in REBUILD. A tonic/chord-root reference uses upward pitch-class distance modulo 12. A pinned absolute note or an actual pair uses absolute semitone magnitude modulo 12; direction remains explicit in text. Root/chord/pinned reference is always labeled. Selected notes have filled discs, key members outlined discs, tonic a second outline; outside notes retain text. Major third 4 = coral #f17668; minor third 3 = blue #5b9dff. Spelling determines quality: C–F♭ is a diminished fourth sharing the four-semitone color with C–E. An octave uses the unison-class color with P8 or a compound interval in text. Custom colors can reduce contrast; default palette is contrast-checked.

## Musical explanation

Inspector identifies actual root/bass, full notes and octave, string/fret, tonic-relative chromatic degree, outside-key membership, candidate ambiguity and pairwise intervals. Seventh/ninth/eleventh/thirteenth naming is bounded by explicit tone tables. Compatible collections list contained/missing/outside pitch classes and explicitly disclaim key certainty. Timeline cards show bar/beat position, exact note/chord label, duration and picking. The expanded tools supply compatibility for the selected chord or the whole melody; this version does not offer arbitrary multi-event passage selection.

Transition rows pair sorted sounding pitches including doubled notes, resolving equal pitches by stable ID. A3→C4 is +3/m3; root motion uses stated same-octave representatives because roots are pitch classes. No voice-leading optimization or invented modulation is shown.

## Accessibility and practical review

Use actual buttons/labels/selects, accessible names containing note, string, fret and state, visible focus outlines, live status messages, keyboard equivalents, reduced-motion CSS and forced-colors outlines. Keep all theory usable without hearing or color. Automated/browser checks supplement musical and real-device evaluation; none establishes musician acceptance. Maintain the test matrix in ACCEPTANCE.

Long timelines render16 events at a time with Previous/Next controls and the true total count. Selecting a page selects its first event. Playback retains the whole128-event project and displays its current event number even beyond the visible page. Memoize event analysis by exact event content and settings; invalidate when either changes. This avoids recalculating unchanged chord names on every fret edit.
