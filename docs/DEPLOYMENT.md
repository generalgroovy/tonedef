# Deployment and rollback

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
