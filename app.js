(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const state = { type: "flight", products: [], selectedId: null, tick: Math.floor(Date.now() / 15000), timer: null, toastTimer: null, lastUrl: "", lastBody: null, busy: false };
  const appBase = new URL("./", document.baseURI);
  const apiBase = new URL("api/v1/", appBase);

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function currency(value) {
    return `${new Intl.NumberFormat("ko-KR").format(Number(value) || 0)}원`;
  }

  function shortTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2300);
  }

  function endpointUrl(filename, params = {}) {
    const url = new URL(filename, apiBase);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) url.searchParams.set(key, String(value));
    });
    url.searchParams.set("tick", String(state.tick));
    return url;
  }

  async function requestApi(filename, params = {}) {
    const url = endpointUrl(filename, params);
    const response = await fetch(url, { method: "GET", cache: "no-store", headers: { Accept: "application/json" } });
    const body = await response.json();
    state.lastUrl = `${url.pathname}${url.search}`;
    state.lastBody = body;
    renderApiPreview();
    if (!response.ok || body.error) throw new Error(body.error?.message || `API 응답 오류 (${response.status})`);
    return body;
  }

  function renderApiPreview() {
    const path = state.lastUrl || `${apiBase.pathname}products.json?type=${state.type}`;
    $("#api-endpoint").textContent = path;
    $("#metric-updated").textContent = shortTime(state.lastBody?.meta?.generatedAt) || "—";
    $("#metric-endpoint").textContent = state.lastBody?.meta?.endpoint || "응답 대기 중";
    const preview = state.lastBody || { status: "waiting", message: "가격 데이터를 불러오는 중입니다." };
    const trimmed = JSON.stringify(preview, null, 2);
    $("#api-response").innerHTML = `<code>${esc(trimmed.length > 7200 ? `${trimmed.slice(0, 7200)}\n… 응답 미리보기에서 일부 생략` : trimmed)}</code>`;
  }

  function changeBadgeClass(value) {
    return value < 0 ? "change-down" : value > 0 ? "change-up" : "change-flat";
  }

  function changeLabel(product) {
    const amount = Number(product.changeAmount) || 0;
    const sign = amount > 0 ? "+" : amount < 0 ? "−" : "±";
    const percent = Math.abs(Number(product.changePercent) || 0).toFixed(2);
    return `${sign}${percent}%`;
  }

  function renderFlightCard(product, index) {
    return `<button class="product-card ${product.id === state.selectedId ? "is-selected" : ""}" type="button" data-product-id="${esc(product.id)}" aria-pressed="${product.id === state.selectedId}">
      <span class="card-main"><span class="card-overline"><span class="product-type-label">FLIGHT · ${esc(product.provider)}</span><span class="card-ref">#${String(index + 1).padStart(2, "0")}</span></span>
      <span class="card-route"><span class="route-origin"><strong>${esc(product.originCode)}</strong><small>${esc(product.origin)}</small></span><i class="route-line" aria-hidden="true"></i><span class="route-destination"><strong>${esc(product.destinationCode)}</strong><small>${esc(product.destination)}</small></span></span>
      <span class="card-meta"><span>${esc(product.departAt)} 출발</span><span>${esc(product.duration)}</span><span>${esc(product.stops)}</span><span>${esc(product.date)}</span></span></span>
      <span class="card-price"><strong>${currency(product.price)}</strong><small class="${changeBadgeClass(product.changeAmount)}">${changeLabel(product)}</small></span>
    </button>`;
  }

  function renderStayCard(product, index) {
    return `<button class="product-card ${product.id === state.selectedId ? "is-selected" : ""}" type="button" data-product-id="${esc(product.id)}" aria-pressed="${product.id === state.selectedId}">
      <span class="card-main"><span class="card-overline"><span class="product-type-label">STAY · ${esc(product.city)}</span><span class="card-ref">#${String(index + 1).padStart(2, "0")}</span></span>
      <span class="stay-place"><strong>${esc(product.title)}</strong><small>${"★".repeat(Math.min(5, Math.max(1, Number(product.stars) || 3)))} <span class="stay-stars">${Number(product.rating).toFixed(1)}</span> · ${esc(product.district)}</small></span>
      <span class="card-meta"><span>${esc(product.nights)}박</span><span>${esc(product.room)}</span><span>${esc(product.checkIn)} 체크인</span></span></span>
      <span class="card-price"><strong>${currency(product.price)}</strong><small class="${changeBadgeClass(product.changeAmount)}">${changeLabel(product)}</small></span>
    </button>`;
  }

  function renderProducts() {
    const list = $("#product-list");
    const search = $("#search-input").value.trim().toLocaleLowerCase("ko-KR");
    const typedProducts = state.products.filter((product) => product.type === state.type);
    const visible = typedProducts.filter((product) => !search || JSON.stringify(product).toLocaleLowerCase("ko-KR").includes(search));
    $("#result-count").textContent = `${visible.length} RESULTS`;
    $("#list-caption").textContent = `${state.type === "flight" ? "항공편" : "숙소"} · 실시간 모의 피드`;
    $("#metric-products").textContent = String(typedProducts.length).padStart(2, "0");
    $("#empty-state").hidden = visible.length > 0;
    list.innerHTML = visible.length ? visible.map((product, index) => state.type === "flight" ? renderFlightCard(product, index) : renderStayCard(product, index)).join("") : "";
    $$(".product-card", list).forEach((card) => card.addEventListener("click", () => selectProduct(card.dataset.productId)));
    $$(".nav-count").forEach((counter) => { counter.textContent = "06"; });
  }

  function formatDateForChart(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(date);
  }

  function renderChart(points) {
    const width = 320, height = 88, pad = 5;
    const values = points.map((point) => point.price);
    const low = Math.min(...values), high = Math.max(...values);
    const spread = Math.max(1, high - low);
    const coords = points.map((point, index) => ({
      x: pad + (index / Math.max(1, points.length - 1)) * (width - pad * 2),
      y: height - pad - ((point.price - low) / spread) * (height - pad * 2)
    }));
    const line = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const area = `${line} L${coords.at(-1).x.toFixed(1)},${(height - pad).toFixed(1)} L${coords[0].x.toFixed(1)},${(height - pad).toFixed(1)} Z`;
    const circles = coords.filter((_, index) => index % 5 === 0 || index === coords.length - 1).map((point) => `<circle class="chart-point" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.4"/>`).join("");
    return `<svg class="price-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="최근 24시간 가격 변동 그래프">
      <defs><linearGradient id="areaFade" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#147d78" stop-opacity=".15"/><stop offset="100%" stop-color="#147d78" stop-opacity=".01"/></linearGradient></defs>
      <path class="chart-gridline" d="M0 22H320 M0 45H320 M0 67H320"/><path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>${circles}</svg>`;
  }

  function renderDetail(product, history) {
    if (!product) return;
    const flight = product.type === "flight";
    const title = flight ? `${product.origin} → ${product.destination}` : product.title;
    const subtitle = flight ? `${product.provider} · ${product.flightNo} · ${product.date}` : `${product.district} · ${product.nights}박 · ${product.room}`;
    const facts = flight
      ? [["출발 / 도착", `${product.departAt} → ${product.arriveAt}`], ["비행 정보", `${product.duration} · ${product.stops}`], ["좌석", product.cabin], ["수하물", product.baggage]]
      : [["체크인", product.checkIn], ["숙박", `${product.nights}박 · 2인`], ["평점", `${Number(product.rating).toFixed(1)} / 5.0 (${product.reviewCount}개)`], ["포함 정보", (product.amenities || []).join(" · ")]];
    const points = history?.points || [];
    $("#detail-panel").innerHTML = `<div class="detail-head"><div><div class="detail-kicker">${flight ? "FLIGHT DETAIL" : "STAY DETAIL"} / PRICE TRACE</div><h3 class="detail-title">${esc(title)}</h3><div class="detail-subtitle">${esc(subtitle)}</div></div><span class="detail-code">${esc(product.id)}</span></div>
      <div class="detail-price-row"><div><span class="detail-price-label">현재 모의 가격</span><strong class="detail-price" id="detail-current-price">${currency(product.price)}</strong></div><span class="detail-change ${changeBadgeClass(product.changeAmount)}">${changeLabel(product)} / 이전 응답</span></div>
      <div class="chart-wrap"><div class="chart-heading"><span>최근 24시간 가격 이력</span><strong>${currency(history?.lowPrice)} — ${currency(history?.highPrice)}</strong></div>${renderChart(points)}<div class="chart-footer"><span>${formatDateForChart(points[0]?.timestamp)} · 24시간 전</span><span>${shortTime(points.at(-1)?.timestamp)} · 지금</span></div></div>
      <div class="detail-facts">${facts.map(([label, value]) => `<div class="detail-fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}</div>
      <div class="detail-last-update"><span>API LAST UPDATED</span><span>${shortTime(product.lastUpdated)} · SYNTHETIC</span></div>`;
  }

  async function loadProductList({ keepSelection = true } = {}) {
    if (state.busy) return;
    state.busy = true;
    const list = $("#product-list");
    if (!state.products.length) list.innerHTML = '<div class="loading-state"><span class="spinner"></span> 모의 가격 데이터를 불러오는 중입니다…</div>';
    try {
      const body = await requestApi("products.json", { type: state.type, sort: $("#sort-select").value, q: $("#search-input").value.trim() });
      state.products = Array.isArray(body.data) ? body.data : [];
      const typedProducts = state.products.filter((product) => product.type === state.type);
      if (!keepSelection || !typedProducts.some((product) => product.id === state.selectedId)) state.selectedId = typedProducts[0]?.id || null;
      renderProducts();
      if (state.selectedId) await loadDetail(state.selectedId);
      else $("#detail-panel").innerHTML = '<div class="detail-loading">선택한 상품이 없습니다.</div>';
    } catch (error) {
      list.innerHTML = `<div class="empty-state">${esc(error.message)}<br />페이지를 새로고침해 주세요.</div>`;
      $("#result-count").textContent = "API ERROR";
      showToast(error.message);
    } finally {
      state.busy = false;
    }
  }

  async function loadDetail(id) {
    try {
      const [detailBody, historyBody] = await Promise.all([
        requestApi("detail.json", { id }),
        requestApi("prices.json", { id, window: "24h" })
      ]);
      const product = detailBody.data;
      if (!product) return;
      state.selectedId = id;
      renderProducts();
      renderDetail(product, historyBody.data);
    } catch (error) {
      $("#detail-panel").innerHTML = `<div class="detail-loading">${esc(error.message)}</div>`;
    }
  }

  async function selectProduct(id) {
    state.selectedId = id;
    renderProducts();
    await loadDetail(id);
  }

  async function refreshPrices({ manual = false } = {}) {
    if (state.busy) return;
    state.tick = Math.max(state.tick + 1, Math.floor(Date.now() / 15000));
    if (manual) {
      const button = $("#refresh-button");
      button.classList.add("is-refreshing");
      button.querySelector("span").textContent = "↻";
      setTimeout(() => button.classList.remove("is-refreshing"), 350);
    }
    await loadProductList({ keepSelection: true });
    if (manual) showToast("새 모의 가격을 가져왔습니다. Network 응답의 tick을 확인해 보세요.");
  }

  function setType(type) {
    if (type === state.type) return;
    state.type = type;
    state.selectedId = null;
    $$("[data-type]").forEach((button) => {
      const active = button.dataset.type === type;
      button.classList.toggle("is-active", active);
      if (button.matches("[role='tab']")) button.setAttribute("aria-selected", String(active));
    });
    loadProductList({ keepSelection: false });
  }

  async function registerWorker() {
    if (!("serviceWorker" in navigator)) {
      $("#api-mode-label").textContent = "정적 API 모드";
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register(new URL("sw.js", appBase), { scope: appBase.pathname });
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await Promise.race([
          new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true })),
          new Promise((resolve) => setTimeout(resolve, 1200))
        ]);
      }
      $("#api-mode-label").textContent = navigator.serviceWorker.controller ? "서비스워커 API" : "정적 응답 · SW 준비 중";
      if (!navigator.serviceWorker.controller && registration.active) setTimeout(() => location.reload(), 1200);
    } catch (error) {
      $("#api-mode-label").textContent = "API 연결 확인 필요";
      console.warn("FareLab service worker registration failed:", error);
    }
  }

  function copyText(text, successMessage) {
    const fallback = () => {
      const element = document.createElement("textarea");
      element.value = text;
      element.style.position = "fixed";
      element.style.opacity = "0";
      document.body.append(element);
      element.select();
      const copied = document.execCommand("copy");
      element.remove();
      if (copied) showToast(successMessage);
      else showToast("복사할 수 없습니다. 텍스트를 직접 선택해 주세요.");
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => showToast(successMessage)).catch(fallback);
    else fallback();
  }

  function bindEvents() {
    $$("[data-type]").forEach((button) => button.addEventListener("click", () => setType(button.dataset.type)));
    $("#refresh-button").addEventListener("click", () => refreshPrices({ manual: true }));
    $("#search-input").addEventListener("input", () => loadProductList());
    $("#sort-select").addEventListener("change", () => loadProductList());
    $("#copy-endpoint").addEventListener("click", () => copyText(`${location.origin}${state.lastUrl || endpointUrl("products.json", { type: state.type }).pathname}`, "현재 API 경로를 복사했습니다."));
    $("#copy-code").addEventListener("click", () => copyText(`from playwright.sync_api import sync_playwright\n\nwith sync_playwright() as p:\n    browser = p.chromium.launch(headless=True)\n    page = browser.new_page()\n    responses = []\n    page.on("response", lambda r: responses.append(r) if "/api/v1/" in r.url else None)\n    page.goto("${location.href}")\n    page.wait_for_timeout(1200)\n    for response in responses:\n        print(response.status, response.url, response.json())\n    browser.close()`, "Playwright 예제를 복사했습니다."));
    $("#help-button").addEventListener("click", () => $("#practice-guide").scrollIntoView({ behavior: "smooth" }));
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) { event.preventDefault(); $("#search-input").focus(); }
    });
  }

  async function start() {
    bindEvents();
    await registerWorker();
    await loadProductList({ keepSelection: false });
    state.timer = setInterval(() => refreshPrices(), 15000);
  }

  start();
})();
