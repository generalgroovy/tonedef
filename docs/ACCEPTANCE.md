# Acceptance evidence — ToneDef 1.0.0

**Status: implemented locally; local verification completed within the boundaries below; publication pending GitHub authentication. No human musical acceptance claimed.** Recorded 2026-09-15, Windows, Node24.18.0, npm11.13.0, Codex in-app Chromium browser. The previous GeneralGroovy repository/site was only read.

## Executed checks

| Requirement | Result and evidence |
| --- | --- |
| 1. Canonical guitar/bass pitch, fret, capo and re-entrant tuning | PASS. Independent open-string MIDI fixtures, octave/capo arithmetic, re-entrant physical-string voicings. |
| 2. Spelled directed/compound intervals | PASS. C–E M3/+4; C–Eb m3/+3; E–C M3/-4; B3–C4+1; C4–C5P8; C4–E5M10; C–Fb d4; F#/Gb tritone spelling; B#4–C5d2. Scale spelling round-trips every MIDI24..100, all12 tonics and13 preset collections. |
| 3. Actual-pitch chord analysis | PASS. Major/minor, inversions, maj7/dom7 and ambiguous sixth/minor7 candidates. Borrowed Cm spells Eb and Cm/Eb; diminished7 spellings retain the sounding pitches. |
| 4. Separate key and event editing | PASS. Browser right-click changed collection and retained selected-note count; left click replaced a fret on the same string; second click toggled off. Touch Edit key retained10 melody events including repeated A4 occurrences. |
| 5. Ordered melody/timeline | PASS. Eight-event example + two repeated A4 appends =10 independent occurrences. Selected cards synchronize notes and inspector. Long timeline Next16 changed visible range1–16 to17–32 of128. Rest/duplicate/move models use the same validated event representation. |
| 6. Chord transition ranks | PASS. Independent [C3,E3,G3]→[D3,F3,A3] gives+2,+1,+2; extra destination note enters. Browser C→Cm displays third change and extra high E leaving. Physical duplicates are retained. |
| 7. Linked theory tools | PASS for visible fifths order and correct relative minor labels including E→C#. Chromatic collection and directed matrix implemented; candidate compatibility explains uncertainty. Keyboard and cross-view focus details below. |
| 8. Deterministic generation | PASS.250 seeded cases across guitar/bass, melody/chord/progression, exact replay, key/string/fret validity, complete actual chord identity. Generated protected IDs survive collision/reordering regression. |
| 9. Randomization locks and atomic failure | PASS.100 seeded cases assert exact unchecked settings/source preservation. Fixed disabled string survives real browser Randomize. Protected tuning rejects conflict. Empty key generation rejects. Invalid range input restores24..88 with explanation. |
| 10. Playback timing and transport | PASS.120BPM/288ticks=1.5s;6/8bar288/click144, eighth-based beat labels. Polyphonic free chords, physical upstroke order. Mock AudioContext proves advance loop scheduling, Stop cancellation of every voice, pending resume/audition cancellation and volume0 silence. Browser Play sets active state, Stop clears it, no captured console errors. Human listening NOT RUN. |
| 11. Persistence/import/export | PASS. All four examples JSON-round-trip exactly; malformed positions/markup IDs/versions rejected. Browser imported comparison, saved named copy, created blank project, loaded saved copy and reloaded with intact C/Cm notes. Invalid version left128-event project intact. Text tab export derives physical positions and duration/pick rows. |
| 12. Undo and instrument reconciliation | PASS. Pure remap preserves sounding pitches and undo/redo restores exact project; locked notes reject alteration. Browser capo-change dialog + Escape restored capo0 and closed without musical mutation. |
| 13. Responsive/keyboard/color review | PASS within tested environment. Screenshots reviewed at1440×900,1280×720,768×1024,390×844 and360×800. No page-level horizontal overflow in measured views; musical surfaces scroll intentionally. Fret arrow navigation focused next physical fret. Labels provide non-color meaning. |
| 14. Reconstruction | PASS for partial independent rehearsal: pitch/capo, six spelled intervals, key masks, one C chord, three transition levels, deterministic four-note generation and rhythm; imports no application source. [Executable record](evidence/rehearsal.mjs). This does not prove a full independent rebuild. |
| 15. Build/subpath | PASS for module syntax and dependency-free static build. Production subpath smoke result below. |
| 16. Publication | PENDING. GitHub CLI credential invalid and browser signed out at last check. No repository, CI deployment or public smoke result is claimed. |

## Commands and retained artifacts

`npm.cmd test`: **19 tests passed,0 failed** (latest pre-package run approximately0.68s). The19 test groups include the250 generation cases,100 randomization cases and12×13×77=12,012 scale spelling checks. `npm.cmd run check` passed all source module syntax. `npm.cmd run build` produced relative-path static assets. Final command output is retained in evidence/local-checks.txt when packaging.

Run `node docs/evidence/rehearsal.mjs` to repeat the isolated documented subset. It uses only standard assert and transcribed documented values.

Screenshots: [1440 desktop](evidence/desktop-1440.png), [1280 desktop](evidence/desktop-1280.png), [768 tablet](evidence/tablet-768.png), [390 phone](evidence/phone-390.png), [360 phone](evidence/phone-360.png). The screenshots were captured from the real local browser. They do not establish other browser engines or physical device behavior.

[Contrast measurements](evidence/contrast.json): default palette text on #1b2026 has minimum5.878:1; dark text on selected colored discs minimum6.623:1; muted text7.379:1; outside fret labels8.297:1. These pairs exceed4.5:1. This is a token/palette test, not a full WCAG conformance certification. Arbitrary user colors can lower contrast.

## Performance evidence

Actual UI clicks on12 physical strings ×37 positions (444 fret buttons),128-event repeated-C fixture. Full timeline rendering initially took132–287ms over5 edits. After bounded16-event timeline rendering and analysis memoization, five edit transactions measured **98.20,84.10,73.80,69.50,72.70ms**. Measurements include history validation, local autosave and DOM render (performance.now around commit), not end-to-end display latency. One machine and fixture; no universal performance claim. The whole project remains stored and played. Bounded generation runs in a cancellable worker.

## Fixed findings

- Borrowed minor chords displayed D# instead of Eb: chord-aware spelling and slash-bass spelling added.
- Relative-minor ring used inappropriate enharmonic names: spell from the corresponding major key.
- Phone context controls cramped and inspector did not stretch: revised phone rows and panel stretch.
- Locked generated IDs could collide after reordering: reserve all protected IDs before assigning generated IDs.
- Randomized dependent bounds could contradict fixed fields: atomic bounded attempts with exact fixed-value checks.
- Loop boundary could be scheduled late; Stop could lose a race with AudioContext resume: absolute-cycle lookahead and revision cancellation.
- Imported IDs could enter raw HTML attributes: canonical safe ID validation added.
- Cancelled instrument dialog left a proposed input value visible: cancel/Escape restores the current model.
- Compound timeline beat labels used quarters: separate meter denominator unit from quarter-note tempo.
- Largest timelines exceeded edit target: analysis cache and16-event pages added.

## Limits and remaining checks

- Firefox, WebKit, real iOS/Android, human listening, musician fingering/usability acceptance, screen-reader session: **NOT RUN**. Only the available in-app Chromium surface was controlled. These remain release follow-up checks, not inferred successes.
- Native200%browser zoom: **NOT RUN**. The in-app browser ignored zoom shortcuts; viewport-based reflow was tested at360/390/768px. Do not substitute these for actual zoom evidence.
- Automated axe accessibility audit, forced-colors/reduced-motion runtime, worker cancellation timing under a deliberately slow task, corrupt browser-storage recovery via UI: **NOT RUN**. Relevant code paths were reviewed; import corruption and scheduler cancellation have executed evidence.
- No arbitrary multi-event passage selection. Mode compatibility uses selected chord or complete melody. Generated chord span is not an ergonomic solver. Greedy melody/remap search can reject globally feasible alternatives. Finger sequence is an event practice annotation rather than a per-string finger map.
- No public URL/CI verification until authenticated publication succeeds. Current app is a local candidate, not a deployed release or human-accepted product.

## Production subpath smoke

Executed against the built dist at http://127.0.0.1:4174/tonedef/: initial78 fret positions/four example events; left-click removed high E from C and Undo recovered; Generate returned four actual named chords through the module worker; Play activated and Stop cleared; refresh preserved the generated four-event pattern; captured browser console errors=[] . [Production screenshot](evidence/production-1440.png). This is local production-build evidence, not GitHub deployment.

Baseline audit: the existing generalgroovy/generalgroovy reference at184d7d975c25351741974c35e31c408f9c1581c2 had no editable fretboard and allowed pitch/position/chord-label divergence and fixed-string randomization failures. ToneDef has a separate canonical model and repository.
