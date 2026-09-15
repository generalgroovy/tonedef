# Deployment and rollback

## Current status (2026-09-15)

**Local candidate; not published.** Dedicated repository target: `generalgroovy/tonedef`. Public Pages target: `https://generalgroovy.github.io/tonedef/`. Source integration branch: `codex/tonedef-initial`; release branch: `main`. Deployed revision: **none**. Actual local candidate revision is in `git log -1`; packaged runtime's `build.json` includes sourceRevision and a content SHA-256.

The existing `generalgroovy/generalgroovy` repository/site was analyzed read-only and remains untouched. Do not deploy into it. GitHub CLI currently reports an invalid generalgroovy credential; the browser login tab is ready for the user. The installed GitHub connector has no repository-creation capability. User authorization to create and publish ToneDef is already present; credentials are the remaining external prerequisite.

## Publish the tested candidate

1. Confirm GitHub account generalgroovy and restore its CLI login, or complete browser login. Never save tokens in project files/logs.
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

Before first publication there is no prior ToneDef release. If its first public smoke fails, repair the candidate or disable ToneDef Pages temporarily; preserve source and failed-run evidence. The old GeneralGroovy app remains available.

After a known-good ToneDef deployment exists, record its commit. Revert the faulty main commit(s) with a normal revert commit, run verification, and deploy the previous known-good content through the same workflow. Verify build.json and the real URL again. Avoid force-push and repository deletion. Project JSON schema2 and generatorVersion1 are versioned; export local work before testing a future incompatible migration.
