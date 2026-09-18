import { mkdir, cp, writeFile, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
await mkdir("dist", { recursive: true });
const assets = ["index.html", "styles.css", "compact.css", "favicon.svg"];
const files = [
  ...assets,
  ...(await readdir("src"))
    .filter((n) => n.endsWith(".js"))
    .map((n) => "src/" + n),
].sort();
for (const file of [...assets, "src"])
  await cp(file, `dist/${file}`, { recursive: true });
await writeFile("dist/.nojekyll", "");
const hash = createHash("sha256");
for (const file of files) {
  hash.update(file + "\0");
  hash.update(await readFile(file));
}
let revision = "local-uncommitted";
try {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (path.resolve(root).toLowerCase() === process.cwd().toLowerCase())
    revision = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
} catch {}
const manifest = {
  version: "1.0.0",
  sourceRevision: revision,
  contentSha256: hash.digest("hex"),
  files,
};
await writeFile("dist/build.json", JSON.stringify(manifest, null, 2));
console.log(
  "Built self-contained static app in dist/; relative asset URLs. Content SHA-256: " +
    manifest.contentSha256,
);
