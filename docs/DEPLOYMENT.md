# Deployment and rollback

## Workspace update 1.1 (2026-09-20)

Application revision `f8c059097fc26079b1233bbfc600a01ffccc5ad3` is pushed to main. Local syntax/build and 28 test groups passed. The same revision passed [verification CI](https://github.com/generalgroovy/tonedef/actions/runs/35475041682) and [browser regression across 13 desktop/touch viewport configurations](https://github.com/generalgroovy/tonedef/actions/runs/35475041712) before promotion. Local browser interaction and visual checks are detailed in [GUI-WORKSPACE](GUI-WORKSPACE.md).

**Public deployment verification pending:** main [publish run 35475145030](https://github.com/generalgroovy/tonedef/actions/runs/35475145030) was last observed queued and [browser run 35475144928](https://github.com/generalgroovy/tonedef/actions/runs/35475144928) in progress. Subsequent GitHub API and public HTTPS requests timed out. This is not evidence of deployment failure or success. Live browser loading also timed out. Do not extend the first-release byte audit below to this update.

Expected build manifest: version `1.1.0`, source revision above, runtime SHA-256 `6b1bfd5b82c428118d29464e38d143a890d57dd84b25290e1118bff5483882ed`. To close verification, inspect the main publish run, fetch public build.json and runtime files, compare their aggregate hash, then exercise the public app. Build now copies all three stylesheets (styles.css, compact.css, workspace.css), every src module, index.html and favicon.svg; package.json supplies the manifest version.

## Original release status (2026-09-15)

**Published; CI and public runtime identity verified.** [Public app](https://generalgroovy.github.io/tonedef/) · [source repository](https://github.com/generalgroovy/tonedef). Source integration branch: `codex/tonedef-initial`; release/default branch: `main`. First deployed application revision: **`0de7613464216a879061d8fff0b9019b0c7b0f37`**. Documentation-only follow-up commits can be newer than the deployed application; this release record is committed with `[skip ci]` because it changes no runtime or workflow files. The public `build.json` is authoritative for the deployed revision.

The existing `generalgroovy/generalgroovy` repository/site was analyzed read-only and remains untouched. ToneDef uses its own public repository and GitHub Actions Pages source. Authenticated publication succeeded as generalgroovy.

### First release evidence

- [Workflow run 34939362081](https://github.com/generalgroovy/tonedef/actions/runs/34939362081): verify and deploy both succeeded; Pages deploy completed at 2026-09-15 06:58:35 UTC. Install, syntax, tests, build and artifact upload all passed. [Recorded result](evidence/github-first-deployment.json).
- Public manifest and all nine runtime files fetched over certificate-validated HTTPS. Recomputed SHA-256 **`3889baecacc3865f694f0e438e3e5ebbb14b45741081c5590bfeace63bce2d5c`**, exactly matching the reviewed local build. [Recorded result](evidence/public-runtime.json).
- The connection was intermittent. The successful file audit used one DNS-published GitHub Pages address for those requests, preserving the original HTTPS hostname and certificate checks. No system/browser network settings changed.
- **Live browser smoke: BLOCKED by connection timeouts.** The in-app browser did not load the public app after bounded attempts. Local production interaction tests passed as recorded in ACCEPTANCE; they are not substituted for live browser tests. Human listening and musician acceptance remain NOT RUN.

## Reconstruct publication or publish a future candidate

1. Confirm GitHub account generalgroovy and valid authentication. Never save tokens in project files/logs.
2. Create **public** repository `generalgroovy/tonedef`, without overwriting an existing repository. If that name exists, inspect it before writing. Push the reviewed source branch, create/review main from it, and use main for publication. The local repository is deliberately separate from the Apps parent checkout.
3. Repository Settings → Pages → Source: **GitHub Actions**. Keep default github-pages environment; authorize only main deployments.
4. Run `npm ci`, `npm run check`, `npm test`, `npm run build`. Serve `dist` at `/tonedef/` and repeat the production smoke below. Node24 is the CI runtime; there are no downloaded build dependencies.
5. Push/merge main. The included workflow verifies syntax/tests/build before uploading dist. The deploy job has needs:verify and only main is eligible. Inspect the successful workflow and Pages deployment, and record commit/run/URL here.
6. Open the actual public URL. Verify title/brand, CSS and module/worker loading; left-click notes, right-click key editing, chord/melody examples, generator, JSON saving/reload, Play/Stop. Check `build.json` against the intended content hash/revision. This live smoke is separate from local evidence.
7. Update README/ACCEPTANCE and this document with the actual source/public URLs and deployed revision only after it succeeds.

Illustrative commands after authentication (inspect remotes first):

```sh
gh repo create generalgroovy/tonedef --public --source=. --remote=origin
git push -u origin codex/tonedef-initial
git switch -c main
git push -u origin main
```

If a browser-created repo already contains an initial commit, fetch and integrate it normally; never force-push over unknown content. Enabling Pages through Actions is required before configure-pages can deploy. GitHub's supported [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) was checked during implementation.

## Workflow reconstruction

Trigger push(main,codex/**),pull_request,workflow_dispatch. Top-level permissions contents:read; concurrency group tonedef-${github.ref},cancel-in-progress=true. Verify job on ubuntu-latest: actions/checkout@v6; actions/setup-node@v6 with node-version24; npm ci; npm run check; npm test; npm run build; actions/upload-pages-artifact@v4 with path dist, only for main and non-PR. Deploy job needs verify, same main/non-PR condition, ubuntu-latest, permissions contents:read/pages:write/id-token:write, environment github-pages with URL steps.deployment.outputs.page_url; steps actions/configure-pages@v5 and actions/deploy-pages@v4 id deployment. This exact recipe recreates .github/workflows/pages.yml.

## Build identity

Build copies only index.html/styles.css/favicon.svg/src plus .nojekyll. `build.json` records version1.0.0, the local root repository HEAD (or local-uncommitted), and SHA-256 over sorted runtime relative paths followed by NUL and each file's bytes. Do not treat a local revision as deployed. Because browser storage is origin-scoped, local preview and public Pages have separate saves; JSON transfers work between them.

## Rollback

The first release baseline is `0de7613464216a879061d8fff0b9019b0c7b0f37`, verified by CI and exact public runtime bytes, with live browser smoke still pending. If public interaction testing exposes a defect, repair it and retain this evidence. The old GeneralGroovy app remains available.

After a known-good ToneDef deployment exists, record its commit. Revert the faulty main commit(s) with a normal revert commit, run verification, and deploy the previous known-good content through the same workflow. Verify build.json and the real URL again. Avoid force-push and repository deletion. Project JSON schema2 and generatorVersion1 are versioned; export local work before testing a future incompatible migration.
