# Compact workspace

The compact presentation is layered in `compact.css`, after the original
`styles.css`. Application state, musical algorithms, audio, keyboard handlers,
project storage, and the DOM are unchanged.

## Changes

- Replace 20px column gaps and 22–25px panel padding with 10px gaps and 12px
  padding (8px/10px on phones). Remove the 1700px desktop width cap.
- Reduce header/context padding. Put section numbers beside titles when space
  permits, while allowing headings and controls to wrap.
- Use 48px-wide, 46px-high minimum desktop fret cells, keeping the original
  note discs. Coarse pointers use 50px cells. The fretboard still scrolls
  horizontally without widening the page.
- Reduce timeline card padding and empty note-row height; align event labels
  with their controls. An empty playback status no longer takes a layout slot.
- Tighten the inspector, interval rows, transition rows, examples, generation
  strip, and settings. Long interval lists retain their existing scroll area.
- Preserve a readable two-ring wheel instead of shrinking its buttons into
  each other. Sidebar panels switch to one column below 650px.
- Keep 16px base text, focus/selection/contrast states, all controls, and
  responsive wrapping. Touch controls retain additional height.

Adjust `--workspace-gap`, `--panel-padding`, `--fret-width`, and
`--string-height` at the top of `compact.css` to tune density. A CSS layer is
used rather than browser zoom or a transform: text, hit targets, scrolling,
and coordinate-based keyboard navigation keep their native behavior.

## Verification

The optional `Compact UI regression` workflow tests the real built app at
320, 360, 390, 570, 650, 768, 850, 1024, 1280, 1440, 1920, and 2560px widths,
including coarse-pointer contexts. It compares the original and compact CSS
on the same DOM, checks that no buttons disappear, and records measurements
and screenshots as the `compact-ui-evidence` workflow artifact.

It also checks note editing, undo, keyboard navigation, timeline selection,
play/stop controls, theory tabs, Projects, expanded settings, randomization
checkboxes, combined note/degree labels, and worker-based generation. This is
not a subjective assessment of audible sound or real-device touch behavior.

To run locally with optional development-only browser tooling:

```sh
npm install --no-save --package-lock=false playwright@1.57.0
npx playwright install chromium
npm run build
node scripts/check-layout.mjs
```

The normal app build and runtime still need no third-party dependencies.
`build.json` includes the compact stylesheet in its content hash. Existing
unit tests and syntax checks continue to run in the publication workflow.

## Rollback

Revert the compact-workspace commit (or remove the second stylesheet link
from `index.html` to compare locally). The original stylesheet and all
application modules have been left intact.
