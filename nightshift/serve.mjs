import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const base = path.resolve(fileURLToPath(new URL("./dist/", import.meta.url)));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const port = Number(process.env.PORT || 4173);
http
  .createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const target = path.resolve(base, "." + pathname);
      if (target !== base && !target.startsWith(base + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      let file = target;
      if (existsSync(file) && statSync(file).isDirectory())
        file = path.join(file, "index.html");
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      if (req.method === "HEAD") res.end();
      else createReadStream(file).pipe(res);
    } catch {
      res.writeHead(400).end("Bad request");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`NIGHTSHIFT: http://localhost:${port}/`),
  );
