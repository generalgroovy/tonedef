# Guitar-project consolidation

ToneDef is the canonical guitar and bass workspace. This consolidation preserves
the old repositories and their history while bringing suitable practice concepts
into the existing editor. It does not import old app storage or claim feature
parity with every experimental theory label.

## Source comparison

Inspected 2026-09-27:

| Repository and inspected revision | Existing overlap | Useful distinct concept | Decision |
| --- | --- | --- | --- |
| `generalgroovy/tonedef` `2f5809a88249914c955e70c4db44bbfd3922d993` | Actual-pitch theory, configurable strings/tuning/capo, fretboard editing, constrained melody/arpeggio/chord generation, randomization locks, Web Audio, JSON projects, tab export | Canonical physical fret model and expressive fretboard | Keep as the main application |
| `generalgroovy/guitar` `755a2e7091ded4aa9038e09b8fb766f1d477f797` | Chord, melody and picking generators; playback and fretboard | Random/ascending/descending/arch melody direction | Integrate contour into ToneDef's existing generator settings |
| `generalgroovy/generalgroovy` `e7dec0f634c4812da0581e4fa78904da5ab4331b` (default branch `codex/generalgroovy-initial`) | Guitar practice generation, theory, fretboard, playback, locks | Portable Markdown session cards | Export a practice card from the actual edited ToneDef pattern |

The GeneralGroovy runtime inspected at `184d7d975c25351741974c35e31c408f9c1581c2`
is byte-identical in the fetched default branch: subsequent changes only update
README and the Autocode case study. The repository also serves as a GitHub profile
repository, so deleting or replacing it would discard unrelated professional
material.

The older generators' more speculative theory labels, visual-only technique
instructions and text-only tempo-ramp guidance are not treated as tested audio or
musical behavior. ToneDef retains its documented 12-TET model. Automatic tempo
ramps, timed sessions, legacy-storage import and human technique assessment remain
outside this change.

## Interface

- Settings → Pattern → Melody reveals **Melody contour**. Other pattern types do
  not show the irrelevant control; its saved value is retained when switching.
- Random keeps the established seeded behavior. Ascending and Descending order
  sounding pitches; Arch rises to the middle sounding event and then falls.
  Rests do not count toward the midpoint. With repeats enabled, level steps are
  allowed. To require strict movement, disable repeated pitches.
- Locked events remain byte-for-byte intact. Their first note constrains the
  contour, including a locked chord left over from another pattern type.
- Projects → **Export practice card** downloads Markdown containing actual notes,
  rests, durations, picking, locks, tuning and tab, plus blank practice notes.
  The card reports quarter-note tempo and one-pass duration. It is a journal
  snapshot; JSON remains the format for re-import and full state recovery.
- Existing help popovers explain the contour. No extra dashboard, panel or
  always-visible instruction block is introduced.
- The editor shows the selected event's actual kind after generation. Editing a
  generated melody no longer fails because a fixed editor setting still says
  Chord. Generation preserves that setting; an explicit edit synchronizes it.
  Both mode controls now select an existing matching event or create one, and
  Undo restores the exact prior pattern and settings.

## Reconstruction and compatibility

Add `melodicContour` to the settings schema: enum `random`, `ascending`,
`descending`, `arch`, default `random`; its randomization flag defaults false.
For old version-2 projects, only a missing contour and its missing flag receive
these defaults. Explicit null/invalid values still fail validation. The existing
version-1 migration adds the current defaults. Project and generator versions
remain 2 and 1 because random generation and old settings keep their behavior.

For directed melody, draw the rest mask first, preserve locked anchors, and build
one pitch domain per sounding event. Deduplicate physical positions by MIDI pitch.
Starting at the final domain, remove any pitch that cannot reach a valid pitch in
the following domain with the required sign, maximum leap and repetition setting.
Then walk forward, making seeded choices only from reachable pitches, and choose
a physical position for each pitch. This avoids greedy false failures. The bound
is at most 64 layers × 128 pitches × 128 transitions, plus a bounded physical
position lookup. If no complete path exists, report it without changing state.
Arpeggio, chord and progression generation ignore the contour.

`src/practice.js` creates Markdown from a validated project. Escape the title as
Markdown text and keep arbitrary title text outside fenced tab content. Use the
actual edited events, not a regenerated approximation. Build automatically
includes this module through the existing source-module enumeration.

## Verification

The automated suite adds 300 deterministic contour cases, locked anchors,
impossible paths, strict/level movement, rest-only paths, re-entrant tuning,
legacy-save migration, invalid imports, unaffected other generator types, a
pre-change random output fixture, and Markdown escaping/actual-note export.
The browser regression exercises the real worker, contour persistence and the
download action at desktop and touch widths, alongside existing expressive-audio,
keyboard, edit/undo, layout and generation checks.

Fresh execution results and exact limitations belong in the delivery record.
Headless Web Audio checks do not establish human listening or physical-touch
acceptance. No runtime dependencies were added.

### Local acceptance, 2026-09-27

- `npm run check`: passed all application-module syntax checks.
- `npm test`: 44 test groups passed, zero failed/skipped.
- `npm run build`: version 1.4.0; 17 runtime files;
  SHA-256 `5499617943f5e88883558f9903a446b5f6a113c3166be7f96255039ce52fbec7`.
- `node scripts/check-layout.mjs`: passed all 13 widths (320–2560 px), no page
  overflow, fret targets at least 44 px, no browser/network errors. Full desktop
  (1440 px) and simulated-touch (390 px) journeys exercised expressive preview,
  editing/Undo, playback/Stop, workspace controls, real generation worker,
  contour persistence, direct editing after generation, and Markdown downloads.
- Desktop and touch contour screenshots visually inspected. Local screenshots
  and measurements are generated under `test-results/compact-ui/` and are not
  shipped as application assets.
- Validation used isolated Playwright 1.57.0 with installed Chromium. Runtime and
  build remain dependency-free. Publishing and live hosted verification are
  separate release steps; this record establishes local acceptance only.
