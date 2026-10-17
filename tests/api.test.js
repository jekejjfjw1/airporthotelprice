"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const api = require("../api-engine.js");
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "catalog.json"), "utf8"));

function get(pathname, query = "") {
  return api.handle(new URL(`${pathname}${query}`, "https://farelab.test"), catalog, Date.UTC(2026, 9, 17, 0, 0, 0));
}

test("항공편과 숙소 목록은 필터 가능한 일관된 가격 필드를 반환한다", () => {
  const flights = get("/api/v1/products.json", "?type=flight&tick=100");
  const stays = get("/api/v1/products.json", "?type=stay&tick=100");
  assert.equal(flights.status, 200);
  assert.equal(stays.status, 200);
  assert.equal(flights.body.data.length, 6);
  assert.equal(stays.body.data.length, 6);
  for (const product of [...flights.body.data, ...stays.body.data]) {
    assert.equal(typeof product.id, "string");
    assert.equal(typeof product.price, "number");
    assert.equal(product.currency, "KRW");
    assert.equal(product.synthetic, true);
    assert.ok(product.lastUpdated);
  }
});

test("가격은 tick이 바뀌면 재현 가능하게 변하고 같은 tick이면 같다", () => {
  const first = get("/api/v1/detail.json", "?id=flight-seoul-tokyo&tick=100").body.data;
  const sameTick = get("/api/v1/detail.json", "?id=flight-seoul-tokyo&tick=100").body.data;
  const nextTick = get("/api/v1/detail.json", "?id=flight-seoul-tokyo&tick=101").body.data;
  assert.equal(first.price, sameTick.price);
  assert.notEqual(first.price, nextTick.price);
});

test("가격 이력은 24시간의 시간순 가격 포인트와 범위를 반환한다", () => {
  const result = get("/api/v1/prices.json", "?id=stay-tokyo-kumo&window=24h&tick=100");
  assert.equal(result.status, 200);
  assert.equal(result.body.data.points.length, 24);
  assert.ok(result.body.data.lowPrice <= result.body.data.highPrice);
  assert.ok(Date.parse(result.body.data.points[0].timestamp) < Date.parse(result.body.data.points[23].timestamp));
});

test("알 수 없는 상품과 API 경로에는 JSON 오류를 반환한다", () => {
  const missing = get("/api/v1/detail.json", "?id=unknown&tick=100");
  const unknown = get("/api/v1/other.json", "?tick=100");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "PRODUCT_NOT_FOUND");
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error.code, "ENDPOINT_NOT_FOUND");
});
