"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = 4173;
const HOST = "127.0.0.1";
const ROOT = __dirname;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function sendFile(filePath, response) {
  const ext = path.extname(filePath).toLowerCase();
  response.statusCode = 200;
  response.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(response);
}

function resolveRequestPath(urlPathname) {
  const requestPath = urlPathname === "/" ? "/index.html" : decodeURIComponent(urlPathname);
  const normalized = path.normalize(requestPath).replace(/^(\.\.[\\/])+/, "");
  return path.join(ROOT, normalized);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${HOST}:${PORT}`);
  const filePath = resolveRequestPath(url.pathname);

  if (!filePath.startsWith(ROOT)) {
    response.statusCode = 403;
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }

    sendFile(filePath, response);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Swipey Critters server running at http://${HOST}:${PORT}`);
});
