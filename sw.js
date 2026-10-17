/* FareLab training API: same-origin, read-only and fully synthetic. */
importScripts(new URL("api-engine.js", self.registration.scope).href);

const scopeUrl = new URL(self.registration.scope);
const scopePath = scopeUrl.pathname.endsWith("/") ? scopeUrl.pathname : `${scopeUrl.pathname}/`;
const apiPrefix = `${scopePath}api/v1/`;
const catalogUrl = new URL("data/catalog.json", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== scopeUrl.origin || !requestUrl.pathname.startsWith(apiPrefix)) return;

  event.respondWith((async () => {
    try {
      const catalogResponse = await fetch(catalogUrl, { cache: "no-store" });
      if (!catalogResponse.ok) throw new Error("The local catalog could not be loaded.");
      const catalog = await catalogResponse.json();
      const result = self.FareLabApi.handle(requestUrl, catalog, Date.now());
      return new Response(JSON.stringify(result.body, null, 2), {
        status: result.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-FareLab-Source": "synthetic-service-worker",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        apiVersion: "1.0",
        error: { code: "SIMULATOR_ERROR", message: "모의 API 응답을 만들지 못했습니다.", detail: String(error.message || error) }
      }, null, 2), { status: 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
    }
  })());
});
