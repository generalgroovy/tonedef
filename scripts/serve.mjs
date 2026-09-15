import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(process.argv[2] || ".");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".md": "text/plain",
};
http
  .createServer(async (req, res) => {
    try {
      let uri = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (uri.startsWith("/tonedef/")) uri = uri.slice(8);
      let file = path.resolve(root, "." + uri);
      if (!file.startsWith(root + path.sep) && file !== root) throw Error();
      if ((await stat(file)).isDirectory())
        file = path.join(file, "index.html");
      const data = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(Number(process.env.TONEDEF_PORT || 4173), "127.0.0.1", () =>
    console.log(
      `ToneDef preview: http://127.0.0.1:${process.env.TONEDEF_PORT || 4173}/tonedef/`,
    ),
  );
