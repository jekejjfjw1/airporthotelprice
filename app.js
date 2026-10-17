const priceRoot = document.getElementById("prices");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const updatedAt = document.getElementById("updatedAt");
const itemCount = document.getElementById("itemCount");
let lastPrices = new Map();

function money(value) {
  return new Intl.NumberFormat("ko-KR").format(value) + "원";
}
function timeLabel(seconds) {
  return new Date(seconds * 1000).toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}
async function refreshPrices() {
  try {
    const response = await fetch("/api/prices", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    statusText.textContent = "서버 연결됨";
    statusDot.style.background = "#20b978";
    updatedAt.textContent = timeLabel(data.updated_at);
    itemCount.textContent = data.prices.length + "개";
    priceRoot.innerHTML = "";
    for (const item of data.prices) {
      const previous = lastPrices.get(item.id);
      const changed = previous !== undefined && previous !== item.price;
      const card = document.createElement("article");
      card.className = "price-card" + (changed ? " changed" : "");
      const kind = document.createElement("div");
      kind.className = "kind";
      kind.textContent = item.kind;
      const name = document.createElement("div");
      name.className = "destination";
      name.textContent = item.name;
      const price = document.createElement("div");
      price.className = "price";
      price.textContent = money(item.price);
      card.append(kind, name, price);
      if (changed) {
        const note = document.createElement("div");
        note.className = "changed-note";
        note.textContent = "가격이 변경되었습니다";
        card.append(note);
      }
      priceRoot.append(card);
      lastPrices.set(item.id, item.price);
    }
  } catch (error) {
    statusText.textContent = "서버 연결 실패 — 잠시 후 다시 시도합니다";
    statusDot.style.background = "#df5b5b";
  }
}
refreshPrices();
setInterval(refreshPrices, 12000);
