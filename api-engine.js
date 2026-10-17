(function attachFareLabApi(root) {
  "use strict";

  const routes = Object.freeze({
    products: "/api/v1/products.json",
    detail: "/api/v1/detail.json",
    prices: "/api/v1/prices.json"
  });

  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function currentTick(url, now) {
    const supplied = Number(url.searchParams.get("tick"));
    return Number.isFinite(supplied) && supplied >= 0
      ? Math.floor(supplied)
      : Math.floor(now / 15000);
  }

  function priceAt(product, tick) {
    const seed = hash(product.id) % 10000 / 1000;
    const wave = Math.sin(tick * 0.21 + seed) * 0.041 + Math.sin(tick * 0.071 + seed * 1.7) * 0.023;
    const rounded = Math.round(product.basePrice * (1 + wave) / 1000) * 1000;
    return Math.max(1000, rounded);
  }

  function withPrice(product, tick, now) {
    const price = priceAt(product, tick);
    const previousPrice = priceAt(product, Math.max(0, tick - 1));
    const changeAmount = price - previousPrice;
    const changePercent = previousPrice ? Number(((changeAmount / previousPrice) * 100).toFixed(2)) : 0;
    const { basePrice, ...details } = product;
    return {
      ...details,
      price,
      previousPrice,
      changeAmount,
      changePercent,
      currency: product.currency || "KRW",
      lastUpdated: new Date(now).toISOString(),
      synthetic: true
    };
  }

  function envelope(url, now, tick, data, extraMeta = {}) {
    return {
      apiVersion: "1.0",
      meta: {
        generatedAt: new Date(now).toISOString(),
        tick,
        source: "FareLab synthetic price simulator",
        currency: "KRW",
        disclaimer: "합성된 학습용 데이터이며 실제 가격·예약과 무관합니다.",
        ...extraMeta
      },
      data
    };
  }

  function handle(urlLike, catalog, now = Date.now()) {
    const url = urlLike instanceof URL ? urlLike : new URL(String(urlLike), "http://farelab.local");
    const tick = currentTick(url, now);
    const rawPath = url.pathname;
    const apiIndex = rawPath.indexOf("/api/v1/");
    const path = apiIndex >= 0 ? rawPath.slice(apiIndex) : rawPath;
    const products = Array.isArray(catalog?.products) ? catalog.products : [];

    if (path === routes.products) {
      const type = url.searchParams.get("type") || "flight";
      const q = (url.searchParams.get("q") || "").trim().toLocaleLowerCase("ko-KR");
      const sort = url.searchParams.get("sort") || "price-asc";
      let filtered = products.filter((product) => (type === "all" || product.type === type));
      if (q) filtered = filtered.filter((product) => JSON.stringify(product).toLocaleLowerCase("ko-KR").includes(q));
      const data = filtered.map((product) => withPrice(product, tick, now));
      if (sort === "price-desc") data.sort((a, b) => b.price - a.price);
      else if (sort === "change-desc") data.sort((a, b) => Math.abs(b.changeAmount) - Math.abs(a.changeAmount));
      else data.sort((a, b) => a.price - b.price);
      return { status: 200, body: envelope(url, now, tick, data, { endpoint: routes.products, type, count: data.length, sort }) };
    }

    if (path === routes.detail) {
      const id = url.searchParams.get("id");
      const product = products.find((item) => item.id === id);
      if (!product) return { status: 404, body: { apiVersion: "1.0", error: { code: "PRODUCT_NOT_FOUND", message: "해당 모의 상품을 찾을 수 없습니다.", id: id || null } } };
      return { status: 200, body: envelope(url, now, tick, withPrice(product, tick, now), { endpoint: routes.detail, id }) };
    }

    if (path === routes.prices) {
      const id = url.searchParams.get("id");
      const product = products.find((item) => item.id === id);
      if (!product) return { status: 404, body: { apiVersion: "1.0", error: { code: "PRODUCT_NOT_FOUND", message: "가격 이력을 조회할 모의 상품이 없습니다.", id: id || null } } };
      const interval = 60 * 60 * 1000;
      const samples = Array.from({ length: 24 }, (_, index) => {
        const timestamp = now - (23 - index) * interval;
        const historicalTick = tick - (23 - index) * 240;
        return { timestamp: new Date(timestamp).toISOString(), price: priceAt(product, Math.max(0, historicalTick)), currency: product.currency || "KRW" };
      });
      const values = samples.map((point) => point.price);
      return { status: 200, body: envelope(url, now, tick, {
        productId: id,
        window: "24h",
        interval: "1h",
        currentPrice: priceAt(product, tick),
        lowPrice: Math.min(...values),
        highPrice: Math.max(...values),
        points: samples
      }, { endpoint: routes.prices, id, count: samples.length }) };
    }

    return { status: 404, body: { apiVersion: "1.0", error: { code: "ENDPOINT_NOT_FOUND", message: "FareLab에서 제공하지 않는 읽기 전용 API 경로입니다.", path } } };
  }

  const api = Object.freeze({ routes, handle, priceAt });
  root.FareLabApi = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : self);
