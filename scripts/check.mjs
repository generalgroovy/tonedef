import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
for (const file of await readdir("src"))
  if (file.endsWith(".js")) {
    const result = spawnSync(process.execPath, ["--check", `src/${file}`], {
      stdio: "inherit",
    });
    if (result.status) process.exit(result.status);
  }
console.log("All application modules passed syntax checks.");
