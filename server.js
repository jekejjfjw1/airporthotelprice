"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const FareLabApi = require("./api-engine.js");

const ROOT = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "X-FareLab-Source": "synthetic-node-api"
  });
  response.end(JSON.stringify(body, null, 2));
}

function handle(request, response) {
  const url = new URL(request.url, "http://localhost");
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", "Access-Control-Allow-Headers": "Accept, Content-Type", "Access-Control-Max-Age": "86400" });
    response.end();
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { apiVersion: "1.0", error: { code: "METHOD_NOT_ALLOWED", message: "FareLab API는 읽기 전용 GET 요청만 지원합니다." } });
    return;
  }
  if (url.pathname.startsWith("/api/v1/")) {
    const result = FareLabApi.handle(url, catalog, Date.now());
    if (request.method === "HEAD") {
      response.writeHead(result.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "X-FareLab-Source": "synthetic-node-api" });
      response.end();
    } else sendJson(response, result.status, result.body);
    return;
  }

  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { sendJson(response, 400, { error: { code: "INVALID_PATH", message: "잘못된 경로입니다." } }); return; }
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
    sendJson(response, 403, { error: { code: "FORBIDDEN", message: "허용되지 않는 경로입니다." } });
    return;
  }
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendJson(response, 404, { error: { code: "NOT_FOUND", message: "파일을 찾을 수 없습니다." } });
      return;
    }
    response.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(filePath).pipe(response);
  });
}

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";
const server = http.createServer(handle);

if (require.main === module) {
  server.listen(port, host, () => console.log(`FareLab ready at http://${host}:${port}`));
}

module.exports = { handle, server };
