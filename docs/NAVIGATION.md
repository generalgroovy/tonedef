# ToneDef 1.13 — navigation and configuration

This supplement extends [Focused practice](FOCUSED-PRACTICE.md) and the [rebuild guide](REBUILD.md). Keep all musical, audio, generation, gesture, randomization and project-recovery contracts. The project schema and runtime dependency list do not change.

## Navigation contract

- Learn, Practice and Studio remain the primary workspaces. Instrument beside the simple fretboard opens setup in the choices panel. It keeps the current workspace, pattern, passage and neck available. The same shortcut toggles setup closed; Back to lesson/practice and Escape return explicitly. More → Instrument setup opens the same interface.
- Setup has three keyboard-accessible tabs: Instrument (preset tuning, string/fret count, capo, handedness, visible frets, individual string pitches and enabled flags), Sound (volume with exact entry and slider, timbre, meter, finger order), Display (labels, octave labels, spelling and interval colors). Exactly one control represents each setting. Individual tuning and colors use disclosures; Studio keeps its complete settings and example inventory.
- Tabs use `tablist`, `tab`, `tabpanel`, selected state, controlled panel IDs and one tab stop. Left/Right wrap; Home/End choose the first/last tab. Choosing a tab preserves project data. Each section restores its own scroll position.
- Settings use the existing validation, history and instrument-reconciliation transaction. A retune that affects notes requires the existing preserve-pitches/preserve-positions choice. Cancel or Escape restores the real value and returns focus to the originating control; rejected changes leave the project intact. Successful changes remain in setup and are undoable.
- Each workspace and setup section remembers open disclosures and vertical position for the session. Restore disclosure state before scroll offsets to avoid clamping against closed content. These view preferences never enter the musical project, export or Undo history. Reload ends the view-position session; the existing saved workspace preference still applies.
- At widths below 1100px or heights below 700px, a fixed bottom bar jumps between Lesson/Choices/Setup, Fretboard and Pattern. It replaces the old one-way inline jump links. Keep the primary Play/Stop header visible. Jumps focus their section and account for the actual header height. Highlight the section at the top of the reading area; reaching the document end highlights Pattern. Reserve bottom space and safe-area inset so the last controls remain reachable.
- Respect reduced motion: section jumps become instant and control transitions disappear. Otherwise use short color/focus transitions and smooth section movement. Fretboard cell hit targets and expression gestures stay unchanged. The thin scrollbars preserve native scrolling.
- More closes after an action, an outside click or Escape. Escape restores summary focus. An open menu or reconciliation dialog takes precedence over closing setup.

## Practice organization

Shape next pattern retains type, length, string pool and grouping. Its direct child disclosures are Order, rhythm & picking; Practice range; and Pitch, reach & rests. Reach and fret ranges are no longer nested inside rhythm. A compact active-rule summary explains nondefault generation rules. Controls remain conditional on pattern type and rhythm; the existing exact values, drag gestures and Random flags are retained.

## Rebuild and verification

`src/workspace.js` owns transient setup/tab state, section jumps, menu dismissal and the simple panel assembly. `src/app.js` renders setup using the same field and transaction functions as Studio, records/restores per-surface positions, and recovers retune focus. `src/practice-view.js` owns the flatter hierarchy. `workspace.css` adds the settings grid, tabs, bottom navigation, focus and motion behavior.

Run `npm test`, `npm run check`, `npm run build`. `scripts/navigation-checks.mjs` runs inside the existing browser regression at 1366×768, 1280×720, 390×844 touch and 320×800 touch. Verify navigation without project changes, keyboard tabs, a sound edit with exact Undo, retune cancellation and confirmed retune/Undo, invalid value recovery, disclosure/scroll restoration, menu dismissal, mobile section focus and overflow. Existing theory, generation, playback, touch and full Studio/Arrange checks still apply. Inspect desktop and narrow screenshots, then verify the published manifest and runtime bytes and smoke-test the live app. Record only completed release checks in DEPLOYMENT.
