# Deployment and rollback

## Release 1.10.0, verified 2026-10-06 UTC

[ToneDef](https://generalgroovy.github.io/tonedef/) is published from application revision `1d620ad5fc016853091b1000f0b564dd7f6cb551`. [Visual practice](VISUAL-PRACTICE.md) specifies the new behavior and rebuild contract.

- The neck distinguishes outside-key notes, key tones, whole-pattern positions and the current step using size, shape, fill and outlines. Outside-key pattern notes remain visible with a dashed border. Chord connections and interval colors remain available; tonic markers no longer overlap interval numerals.
- Practice length and speed have sliders alongside exact entry. Random bounds and per-string fret windows have draggable endpoints and a separate 44px whole-range grip. Translation preserves width. Escape/cancellation discards previews; one Undo restores a completed gesture. Keyboard and left-handed directions are covered.
- Optional recall exercises cover note names, named intervals and ordered melody pitches. Hide hints removes visual and accessible answers; feedback and reference audio remain available. Session results never enter the saved project. Melody recall checks exact pitch, skips rests and explicitly rejects unsupported chord/unreachable patterns.
- 101 automated tests passed, including interval targets in all 12 keys, octave-aware melody judging, exact physical membership and bounded range movement. Syntax and production build passed. [Candidate browser regression](https://github.com/generalgroovy/tonedef/actions/runs/37536858809), [main browser regression](https://github.com/generalgroovy/tonedef/actions/runs/37537218932), and [verification/Pages publication](https://github.com/generalgroovy/tonedef/actions/runs/37537218897) succeeded.
- Browser coverage includes 21 primary configurations: two new desktop/touch gesture workflows, four learner workflows, and 15 Studio/Arrange layouts from 320 to 2560px. Checks include wrong/correct answers, hidden-hint restoration, keyboard activation, exact melody register, unchanged project data, value preview/commit/Undo/Escape, whole random/fret-window movement, crossing prevention, native touch cancellation, left-handed movement and persistence. Existing generation, audio, expressive gestures, imports, exports, locks, layout and 12-string regression also passed.
- All 26 public runtime files and the build manifest matched committed source over certificate-validated HTTPS. Runtime SHA-256: `42d1b6e68598fcc1c9a2f767d22ccea1510608247acb537fad3a1be429dc32ae`.
- Live browser smoke confirmed the new challenge, hidden/restored hints, speed 92 → 93 → Undo to 92, Play/Stop and current-chord highlighting. The existing five-step pattern was retained. No browser warnings or errors were recorded. Desktop and narrow layouts were visually inspected.

[Browser report](evidence/visual-practice-layout.json) · [Public byte receipt](evidence/visual-practice-public-runtime.json) · [Live screenshot](evidence/visual-practice-live.jpg)

This release publishes the canonical GitHub Pages app. The portfolio's separately pinned copy was not repackaged or deployed: its working copy had unrelated pending changes. A future portfolio update can package this exact reviewed revision using that project's documented single-project packager. Software and emulated-touch checks do not establish physical touch-device acceptance, subjective listening quality or learning outcomes. Documentation-only commits may follow the application revision without rebuilding the runtime.

## Historical release: 1.9.0, verified 2026-10-04

The simplified learning and practice interface is live at
[ToneDef](https://generalgroovy.github.io/tonedef/) and in the
[portfolio app](https://generalgroovy.web.app/play/tonedef/) from application
revision `2d4733d96c1ef74d44c722d4ef9f225914f0d211`.

- Learn shows the choices relevant to Notes, Steps, Scales or Modes. Modes names the notes that change from the same-root major scale. Hear scale previews the displayed pitches independently of the saved pattern; Play pattern follows the saved cards.
- Practice shows random bounds beside each enabled Random choice and disables the corresponding fixed value. String buttons remain an editable selection pool. Notes-per-string groups support 1–16. Chord patterns hide irrelevant grouping controls and offer an explicit, undoable correction for conflicting saved grouping rules.
- Generation errors remain beside New pattern until the settings change or generation is retried. Keep step uses plain language. Previewing notes works in Learn/Practice even when Studio's Hear clicks preference is off; an explicitly muted project offers Turn sound on.
- All displayed string numbers use the usual guitar convention: high E is string 1 and low E is string 6. Physical string IDs, stored tuning, range associations and generation order are preserved.
- The three main areas fit at 1280 × 720 and 1366 × 768. Extra choices scroll within the left area; long patterns scroll within the pattern area. Phones stack the areas. The layout does not promise every advanced control or pattern card is simultaneously visible.
- All 96 automated tests, syntax checks and the production build passed. [Candidate browser regression](https://github.com/generalgroovy/tonedef/actions/runs/37198859860), [main browser regression](https://github.com/generalgroovy/tonedef/actions/runs/37199012973), and [verification/Pages publication](https://github.com/generalgroovy/tonedef/actions/runs/37199012945) passed.
- Browser regression covers four fresh learner contexts (1366 × 768, 1280 × 720, 390 × 844 and 320 × 800; touch emulation for the latter two) and 15 Studio/Arrange viewport configurations. It checks lesson cancellation, keyboard and assistive activation, mode contrast, fixed/random choices, grouping correction and Undo, durable failure recovery, saved preferences, instrument protection and the existing full editor workflows.
- All 23 runtime files plus `build.json` matched the clean committed build over certificate-validated HTTPS. Runtime SHA-256: `e505ead14d14259086f295e077c30fb5984761b181ac993c77e0ee527521aa77`.
- The portfolio passed 648 site checks and 501 embed checks. Target-scoped Firebase publication completed, then all 152 public files, 20 former German routes and 20 retired-project redirects passed live checks. Other projects' records and embedded snapshots were preserved.
- Live browser checks confirmed Hear scale/Stop scale, topic navigation, conventional numbering and the three-area 1280 × 720 layout with the existing four-chord pattern intact. No browser warnings/errors were recorded. Local UI checks also confirmed the muted-state recovery action and its single-step Undo.

[Browser report](evidence/clarity-layout.json) ·
[Public byte receipt](evidence/clarity-public-runtime.json) ·
[Live screenshot](evidence/clarity-live.png)

These checks establish software behavior and rendered layout, not learning
effectiveness with young children, human listening quality or physical touch
hardware acceptance. Documentation-only commits may follow the application
revision; `build.json` identifies the deployed runtime.

## Historical release: 1.8.0, verified 2026-10-04

Learn and configurable Practice are live at
[ToneDef](https://generalgroovy.github.io/tonedef/) and in the
[portfolio app](https://generalgroovy.web.app/play/tonedef/) from application
revision `e02e9178288364f0deab6d80503bbc08c4e191a1`.

- Learn provides Notes, Steps, Scales and Modes, short prompts, audible pitch previews and matching fretboard highlights. Definitions stay under Info; the simple fretboard does not edit saved music.
- Practice exposes fixed or explicitly randomized key, scale, count, string pool and notes-per-string groups. More choices contains recipes, sequences, rhythms, per-string ranges and bounded randomization. Successful New pattern advances the seed; failure preserves the project; locks and Undo remain exact.
- Learn/Practice keep choices, neck and pattern together at laptop sizes; mobile stacks them. Chord cards summarize note counts. Studio retains the full editor and directional comparator; Arrange retains custom layouts. Large contents scroll within their areas.
- The latest 1.7 release was merged before publication, retaining comparator, narrow-header and sounding-reference fixes. Existing projects and custom layouts are preserved.
- 84 automated tests, syntax checks and the production build passed locally and in CI.
- [Candidate browser regression](https://github.com/generalgroovy/tonedef/actions/runs/37197002000), [main browser regression](https://github.com/generalgroovy/tonedef/actions/runs/37197084339), and [verification/Pages publication](https://github.com/generalgroovy/tonedef/actions/runs/37197084287) succeeded.
- Browser coverage includes three fresh Learn/Practice contexts (1366 × 768, 390 × 844 and 320 × 800, with touch emulation on the latter two) and 15 Studio/Arrange viewport configurations. Checks include all seven modes, previews, randomization, grouping, locks, Undo, instrument protection, persistence, 44px primary targets, focus, overflow, editing, expression, playback references, comparison, per-string ranges and the complete settings inventory.
- All 23 runtime files plus `build.json` matched the clean committed build over certificate-validated HTTPS. Runtime SHA-256: `1d6f994c44e8397bbc1f5201973796b5531c77b23cd65be3afeec8c3b358d869`.
- The portfolio passed 648 site checks and 500 embed checks. After target-scoped publication, all 152 public files, 20 former German routes and 20 retired-project redirects passed live checks. Other project records and embedded snapshots were preserved.
- Live browser navigation, pitch preview and Play/Stop passed with existing saved music intact. The final portfolio view shows all three main areas at 1366 × 768, including compact cards for an older chord pattern, without console warnings or errors.

[Browser report](evidence/learning-layout.json) ·
[Public byte receipt](evidence/learning-public-runtime.json) ·
[Live screenshot](evidence/learning-live.png)

An earlier range-drag test attempted to gesture outside the viewport; it now
centers the handle before measuring and dragging. The final passing runs above
also include the later chord-card simplification. Browser cache propagation can
temporarily retain an earlier rendering in an already-open tab; the byte audit
and final portfolio rendering were independently verified. These checks do not
establish learning effectiveness with a five-year-old, human listening quality,
or physical touch-device acceptance. Documentation-only commits may follow the
application revision; `build.json` identifies the deployed runtime.

## Historical release: 1.7.0, verified 2026-10-02

The [focused studio](MINIMAL-STUDIO.md) is live at
[ToneDef](https://generalgroovy.github.io/tonedef/) from application revision
`8659f4ab0ee167a0e0b51c7fbfd2589f65013e89`.

- [Verification and Pages deployment](https://github.com/generalgroovy/tonedef/actions/runs/36996993520): succeeded.
- [Browser regression on main](https://github.com/generalgroovy/tonedef/actions/runs/36996993405): succeeded. The same candidate passed [before publication](https://github.com/generalgroovy/tonedef/actions/runs/36996750083).
- 49 automated theory, model, generation, audio, expression, layout and interval test groups passed. Syntax checks and the static build passed locally and in CI.
- All 13 viewport configurations, 320–2560px, passed, including all four contextual sections. Desktop and touch-emulated workflows passed edit/undo, expression keyboard preview, comparison/swap/focus, tooltip access, playback/Stop/reference restoration, project save/import recovery/export, range numeric/keyboard/drag/cancel/persistence, contour generation, custom layout persistence and 12-string/36-fret cases.
- The browser inventory confirms exactly one control and one randomization flag for every schema setting, including conditional and per-string settings. There are no duplicate DOM IDs or pairwise interval tables.
- Compared with published 1.5 revision `3de8f1d`, default page height changed from 1799 to 1000px at 1440×1000 (44% shorter) and 3415 to 1149px at 390×844 (66% shorter). Details are now opened explicitly; the measurements do not compare all sections expanded simultaneously.
- All 20 public runtime files matched committed source byte-for-byte over certificate-validated HTTPS. Runtime SHA-256: `adc3a4c770f3419e9a697bf8f5f35d7ea4b4c0873c67f1e7eac8c8a17d68751b`.
- Live browser smoke passed all four sections, signed interval reversal, the single Play/Stop control, sounding-chord highlighting, restoration of the existing six-note selection, and Projects access. No browser warnings/errors were recorded. The existing saved public project was used without editing its music.

[Layout measurements](evidence/minimal-studio-layout.json) ·
[Public byte receipt](evidence/minimal-studio-public-runtime.json) ·
[Live screenshot](evidence/minimal-studio-live.jpg)

Initial candidate checks found a narrow header overflow and a test tapping a
musical action instead of a help trigger. Both were corrected before promotion;
the passing runs above are the final evidence. Human listening, physical touch
hardware and an independent usability study are not established by these checks.

## Historical baseline: 1.4.0, verified 2026-09-27

The guitar consolidation release is published at [ToneDef](https://generalgroovy.github.io/tonedef/) from application revision `ccb227c55b80bc0dab72a250dd7eb20c1ee1bc09`.

- [Verification and Pages deployment](https://github.com/generalgroovy/tonedef/actions/runs/36327032230): succeeded.
- [Browser regression](https://github.com/generalgroovy/tonedef/actions/runs/36327032190): succeeded.
- 44 automated test groups and 13 browser viewport configurations passed locally.
- All 17 public runtime files matched the tested local build over ordinary HTTPS with certificate validation. Runtime SHA-256: `5499617943f5e88883558f9903a446b5f6a113c3166be7f96255039ce52fbec7`.
- Live hosted smoke passed descending contour generation through the real worker, active editor mode, direct editing/Undo, Play/Stop and Markdown practice-card download. No browser/network errors occurred.

[Public byte receipt](evidence/consolidation-public-runtime.json) · [Live interaction receipt](evidence/consolidation-live.json)

These are dated release results. Later documentation commits may be newer than the application revision recorded here. The deployed `build.json` identifies the hosted revision. Human listening, physical touch hardware and musician acceptance are not established by automated checks.

## Publish a candidate

1. Confirm this checkout's origin is `generalgroovy/tonedef`, inspect local changes, and fetch the current `main`. Preserve unrelated work.
2. Run `npm ci`, `npm run check`, `npm test` and `npm run build` using Node 22 or newer (CI uses Node 24).
3. Run the browser regression against the build, using isolated Playwright/Chromium tooling. Exercise any changed controls and review screenshots.
4. Review the diff and promote through a normal fast-forward or merge to `main`. Publishing requires authorization; tests alone do not authorize a push.
5. Inspect both GitHub workflows. `.github/workflows/pages.yml` verifies and deploys `dist/` only for `main`; `.github/workflows/layout.yml` separately checks the browser interface. A successful build is not proof of a completed deployment.
6. Fetch the public `build.json`; match its source revision, version and content hash to the intended build. Compare runtime files and exercise the public app.
7. Record the verified revision, workflow links and evidence. Distinguish failed, pending, local and live checks.

This repository already exists and Pages uses GitHub Actions. Routine releases do not create a new repository or change account settings.

## Build identity and local preview

`npm run build` copies `index.html`, the three stylesheets, `favicon.svg` and JavaScript modules from `src/`, then writes `.nojekyll` and `build.json`. The manifest records the package version, repository HEAD and a SHA-256 over sorted runtime paths, a NUL separator and each file's bytes. A dirty working tree can still carry its existing HEAD in the manifest: inspect the Git diff before treating it as an exact commit build.

Serve the built output with `npm run preview` at `http://127.0.0.1:4173/tonedef/`. Preserve LF line endings when comparing Windows and CI builds. Rebuild from committed bytes if hashes differ. Localhost, GitHub Pages and other hosted origins have separate browser saves; use project JSON for transfers.

## Recovery and rollback

Export important project JSON before testing migrations. Revert a faulty application change with a normal commit, run the same checks and publish through the same workflow. Verify the public manifest and controls again. Keep the previous successful release evidence; do not force-push or delete repository history.

[Earlier deployment records](DEPLOYMENT-HISTORY.md) retain the original 1.0/1.1/1.3 results and their historical limitations. Use this page for the current release process.
