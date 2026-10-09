'use strict';

const DEMO = true;
const PRICE_INTERVAL_MS = 12000;
const MAX_DATE_RANGE_DAYS = 14;
const STORAGE_KEY = 'tripsignal-price-history-v1';
const TARGET_KEY = 'tripsignal-price-targets-v1';
const LAST_VIEW_KEY = 'tripsignal-last-view-v1';

const AIRPORTS = {
  ICN: '인천', GMP: '김포', PUS: '부산/김해', NRT: '도쿄 나리타',
  KIX: '오사카 간사이', FUK: '후쿠오카', TPE: '타이베이', BKK: '방콕'
};
const FLIGHT_TEMPLATES = [
  {id:'KD701', airline:'Korea Demo Air', number:'KD701', from:'ICN', to:'NRT', depart:'08:20', arrive:'10:45', base:318000, kind:'직항'},
  {id:'SS103', airline:'Seoul Sample Airlines', number:'SS103', from:'ICN', to:'NRT', depart:'10:05', arrive:'12:30', base:336000, kind:'직항'},
  {id:'BD205', airline:'Blue Demo Jet', number:'BD205', from:'ICN', to:'NRT', depart:'13:40', arrive:'16:05', base:289000, kind:'직항'},
  {id:'TS221', airline:'Travel Sample Air', number:'TS221', from:'ICN', to:'KIX', depart:'09:15', arrive:'11:00', base:224000, kind:'직항'},
  {id:'BD121', airline:'Busan Demo Air', number:'BD121', from:'PUS', to:'FUK', depart:'11:25', arrive:'12:30', base:176000, kind:'직항'},
  {id:'SI611', airline:'Sample Island Airlines', number:'SI611', from:'GMP', to:'TPE', depart:'07:50', arrive:'09:35', base:264000, kind:'직항'},
  {id:'WD410', airline:'World Demo Airways', number:'WD410', from:'ICN', to:'BKK', depart:'18:30', arrive:'22:20', base:412000, kind:'직항'}
];
const HOTELS = [
  {id:'HT101',name:'Tokyo Maple Hotel',city:'도쿄',rating:4.7,base:142000,kind:'호텔',desc:'역에서 가까운 모던한 시티 호텔'},
  {id:'HT102',name:'Nippori Budget Stay',city:'도쿄',rating:4.1,base:87000,kind:'비즈니스 호텔',desc:'합리적인 가격의 깔끔한 숙소'},
  {id:'HT103',name:'Asakusa Garden Inn',city:'도쿄',rating:4.5,base:119000,kind:'게스트하우스',desc:'아사쿠사 주변의 아늑한 숙박 공간'},
  {id:'HT104',name:'Shinjuku Sky Suites',city:'도쿄',rating:4.8,base:208000,kind:'레지던스',desc:'넓은 객실과 도심 전망'},
  {id:'HT201',name:'Osaka Namba Stay',city:'오사카',rating:4.4,base:103000,kind:'호텔',desc:'난바 상권에 위치한 여행 거점'},
  {id:'HT202',name:'Osaka River House',city:'오사카',rating:4.6,base:158000,kind:'펜션형 숙소',desc:'강변 산책로가 가까운 감성 숙소'},
  {id:'HT301',name:'Fukuoka Harbor Hotel',city:'후쿠오카',rating:4.3,base:96000,kind:'호텔',desc:'하카타·항구 이동이 편리한 숙소'},
  {id:'HT401',name:'Taipei Lantern Inn',city:'타이베이',rating:4.5,base:112000,kind:'호텔',desc:'야시장과 대중교통 접근성이 좋은 숙소'}
];
const PRICE_PATTERNS = [0, -0.035, 0.025, -0.015, 0.055, -0.045, 0.012, -0.025, 0.018, -0.008];
const $ = (id) => document.getElementById(id);
let view = localStorage.getItem(LAST_VIEW_KEY) || 'flights';
let currentItems = [];
let currentTabItems = [];
let toastTimer = null;
let lastPriceTick = null;
let latestRecords = [];

function localISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function plusDays(date, days) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function dateRange(startString, endString) {
  const start = new Date(`${startString}T12:00:00`);
  const end = new Date(`${endString}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end < start) return [];
  const result = [];
  const limit = Math.min(Math.round((end - start) / 86400000), MAX_DATE_RANGE_DAYS);
  for (let i = 0; i <= limit; i++) result.push(localISODate(plusDays(start, i)));
  return result;
}
function money(value) { return new Intl.NumberFormat('ko-KR', {style:'currency', currency:'KRW', maximumFractionDigits:0}).format(value); }
function compactMoney(value) { return `₩${new Intl.NumberFormat('ko-KR', {maximumFractionDigits:0}).format(value)}`; }
function fmtTime(ts) { return new Date(ts).toLocaleString('ko-KR', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false}); }
function hashText(text) { let hash = 2166136261; for (let i=0;i<text.length;i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function currentPrice(base, key, tick = Math.floor(Date.now() / PRICE_INTERVAL_MS)) {
  const index = (tick + hashText(key) % PRICE_PATTERNS.length) % PRICE_PATTERNS.length;
  return Math.max(10000, Math.round((base * (1 + PRICE_PATTERNS[index])) / 1000) * 1000);
}
function readHistory() {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); return value && typeof value === 'object' ? value : {}; }
  catch { return {}; }
}
function writeHistory(history) { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); }
function getTargets() {
  try { return JSON.parse(localStorage.getItem(TARGET_KEY) || '{}') || {}; }
  catch { return {}; }
}
function saveSnapshot(item, tick, force = false) {
  const history = readHistory();
  const entries = Array.isArray(history[item.key]) ? history[item.key] : [];
  const price = item.price;
  const last = entries[entries.length - 1];
  if (!force && last && last.price === price && last.tick === tick) return false;
  entries.push({price, ts:Date.now(), tick, name:item.name, type:item.type, key:item.key, details:item.details || ''});
  history[item.key] = entries.slice(-100);
  writeHistory(history);
  checkTarget(item, price);
  return true;
}
function checkTarget(item, price) {
  const targets = getTargets();
  const target = Number(targets[item.key]);
  if (target > 0 && price <= target) {
    const previous = window.__alertedTargets || (window.__alertedTargets = {});
    const stamp = `${item.key}:${target}`;
    if (!previous[stamp]) {
      previous[stamp] = true;
      showToast(`목표 가격 도달! ${item.name} · ${money(price)}`);
      const message = $('alert-message');
      if (message && view === 'history' && $('history-item-select').value === item.key) {
        message.className = 'alert-message good';
        message.textContent = `목표 가격 도달: 현재 ${money(price)} (목표 ${money(target)})`;
      }
    }
  }
}
function allHistoryRecords() {
  const history = readHistory();
  const rows = [];
  for (const [key, entries] of Object.entries(history)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) rows.push({...entry, key});
  }
  return rows.sort((a,b) => b.ts - a.ts);
}
function getOldestComparablePrice(key) {
  const entries = readHistory()[key] || [];
  if (entries.length < 2) return null;
  return entries[entries.length - 2].price;
}
function buildFlights() {
  const origin = $('origin').value;
  const destination = $('destination').value;
  const start = $('flight-start').value;
  const end = $('flight-end').value;
  const dates = dateRange(start, end);
  if (!dates.length) { showToast('여행 종료일은 시작일 이후로 설정해 주세요.'); return []; }
  if (dates.length > MAX_DATE_RANGE_DAYS + 1) showToast('데모에서는 최대 15일 범위까지만 검색합니다.');
  let templates = FLIGHT_TEMPLATES.filter(f => f.from === origin && f.to === destination);
  if (!templates.length) {
    templates = [
      {id:`DM-${origin}-${destination}-1`,airline:'Demo Connect Air',number:'DC101',from:origin,to:destination,depart:'09:00',arrive:'11:30',base:245000,kind:'직항 예시'},
      {id:`DM-${origin}-${destination}-2`,airline:'Sample Budget Air',number:'SB202',from:origin,to:destination,depart:'14:20',arrive:'16:50',base:198000,kind:'직항 예시'},
      {id:`DM-${origin}-${destination}-3`,airline:'Demo Skyways',number:'DS303',from:origin,to:destination,depart:'19:05',arrive:'21:35',base:276000,kind:'직항 예시'}
    ];
  }
  const items = [];
  for (const date of dates) for (const f of templates) {
    const key = `flight|${f.id}|${date}|${origin}|${destination}`;
    items.push({...f, type:'항공편', name:`${f.airline} ${f.number}`, key, date, origin, destination, details:`${date} · ${origin} → ${destination}`, price:currentPrice(f.base,key)});
  }
  return items.sort((a,b) => a.date.localeCompare(b.date) || a.price-b.price);
}
function buildHotels() {
  const city = $('hotel-city').value;
  const checkin = $('checkin').value;
  const checkout = $('checkout').value;
  const start = new Date(`${checkin}T12:00:00`);
  const end = new Date(`${checkout}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) { showToast('체크아웃은 체크인보다 뒤 날짜여야 합니다.'); return []; }
  const nights = Math.round((end-start)/86400000);
  const hotels = HOTELS.filter(h => h.city === city).map(h => {
    const key = `hotel|${h.id}|${checkin}|${checkout}|${city}`;
    const price = currentPrice(h.base, key);
    return {...h,type:'숙소',key,checkin,checkout,nights,pricePerNight:price,price:price*nights,details:`${city} · ${checkin} ~ ${checkout} · ${nights}박`};
  });
  if ($('hotel-sort').value === 'rating') hotels.sort((a,b) => b.rating-a.rating || a.price-b.price);
  else hotels.sort((a,b) => a.price-b.price || b.rating-a.rating);
  return hotels;
}
function priceChange(item) {
  const previous = getOldestComparablePrice(item.key);
  if (previous === null || previous === 0) return {text:'첫 기록',cls:'same'};
  const delta = item.price - previous;
  const pct = delta / previous * 100;
  if (delta === 0) return {text:'변동 없음',cls:'same'};
  return {text:`${delta < 0 ? '▼' : '▲'} ${Math.abs(pct).toFixed(2)}%`,cls:delta < 0 ? 'down':'up'};
}
function saveCurrentSnapshots(force = false) {
  const tick = Math.floor(Date.now() / PRICE_INTERVAL_MS);
  let changed = false;
  for (const item of currentItems) changed = saveSnapshot(item,tick,force) || changed;
  if (changed) updateStats();
  lastPriceTick = tick;
  return changed;
}
function renderFlightCard(item) {
  const change = priceChange(item);
  const mark = item.airline.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  return `<article class="travel-card" data-key="${escapeHTML(item.key)}" data-price="${item.price}" data-type="flight">
    <div class="card-top"><div class="airline-mark">${escapeHTML(mark)}</div><span class="card-code">${escapeHTML(item.number)}</span><span class="mini-tag">${escapeHTML(item.kind)}</span></div>
    <h3>${escapeHTML(item.airline)}</h3><div class="card-subtitle">${escapeHTML(item.date)} 출발 · 1인 편도 예시 가격</div>
    <div class="route-block"><div class="route-point"><strong>${escapeHTML(item.depart)}</strong><small>${escapeHTML(item.from)} · ${escapeHTML(AIRPORTS[item.from] || item.from)}</small></div><div class="route-track"><span>✈</span></div><div class="route-point" style="text-align:right"><strong>${escapeHTML(item.arrive)}</strong><small>${escapeHTML(item.to)} · ${escapeHTML(AIRPORTS[item.to] || item.to)}</small></div></div>
    <div class="card-divider"></div><div class="card-price-row"><div><span class="price-label">현재 표시 가격</span><strong class="price-value">${money(item.price)}</strong></div><span class="price-change ${change.cls}">${change.text}</span></div>
    <div class="card-bottom"><span>가상 운임 · ${escapeHTML(item.date)}</span><button class="history-link" data-history-key="${escapeHTML(item.key)}">가격 기록 보기 ↗</button></div>
  </article>`;
}
function renderHotelCard(item) {
  const change = priceChange(item);
  const mark = item.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  return `<article class="travel-card" data-key="${escapeHTML(item.key)}" data-price="${item.price}" data-type="hotel">
    <div class="card-top"><div class="hotel-mark">⌂</div><span class="mini-tag neutral">${escapeHTML(item.kind)}</span><span class="card-code">${escapeHTML(item.city)}</span></div>
    <h3>${escapeHTML(item.name)}</h3><div class="card-subtitle hotel-description">${escapeHTML(item.desc)}</div>
    <div class="hotel-info-row"><span class="rating">★ ${item.rating.toFixed(1)}</span><span>${item.nights}박</span><span>${escapeHTML(item.checkin)} ~ ${escapeHTML(item.checkout)}</span><span class="availability">데모상 예약 가능</span></div>
    <div class="card-divider"></div><div class="card-price-row"><div><span class="price-label">숙박 총액 · 1박 ${money(item.pricePerNight)}</span><strong class="price-value">${money(item.price)}</strong></div><span class="price-change ${change.cls}">${change.text}</span></div>
    <div class="card-bottom"><span>가상 숙박 요금 · ${escapeHTML(item.city)}</span><button class="history-link" data-history-key="${escapeHTML(item.key)}">가격 기록 보기 ↗</button></div>
  </article>`;
}
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function setItems(items, kind) {
  currentItems = items;
  currentTabItems = items.slice();
  $('results').innerHTML = items.map(item => kind === 'flight' ? renderFlightCard(item) : renderHotelCard(item)).join('');
  $('empty-state').classList.toggle('hidden', items.length > 0);
  $('results').classList.toggle('hidden', items.length === 0);
  $('result-count').textContent = `${items.length}개 결과`;
  $('results-title').textContent = kind === 'flight' ? `${AIRPORTS[$('origin').value]} → ${AIRPORTS[$('destination').value]} 항공편` : `${$('hotel-city').value} 추천 숙소`;
  $('results-kicker').textContent = kind === 'flight' ? 'FLIGHT RESULTS' : 'HOTEL RESULTS';
  updateStats();
  populateHistorySelect();
  renderHistoryTable();
}
function runFlightSearch(showMessage = false) {
  const items = buildFlights();
  setItems(items,'flight');
  if (showMessage) showToast(`${items.length}개 항공편 예시를 검색했습니다.`);
  saveCurrentSnapshots(true);
}
function runHotelSearch(showMessage = false) {
  const items = buildHotels();
  if (!items.length) { $('results').innerHTML=''; $('result-count').textContent='0개 결과'; $('empty-state').classList.remove('hidden'); currentItems=[]; currentTabItems=[]; updateStats(); return; }
  setItems(items,'hotel');
  if (showMessage) showToast(`${items.length}개 숙소 예시를 검색했습니다.`);
  saveCurrentSnapshots(true);
}
function updateCurrentPrices(force = false) {
  if (view === 'history') {
    const tick = Math.floor(Date.now()/PRICE_INTERVAL_MS);
    if (tick !== lastPriceTick || force) {
      const rememberedKind = $('search-title').textContent.includes('숙소') ? 'hotel' : 'flight';
      const items = rememberedKind === 'hotel' ? buildHotels() : buildFlights();
      setItems(items, rememberedKind === 'hotel' ? 'hotel':'flight');
      saveCurrentSnapshots(force);
    }
    return;
  }
  const tick = Math.floor(Date.now()/PRICE_INTERVAL_MS);
  if (!force && tick === lastPriceTick) return;
  if (view === 'hotels') runHotelSearch(false); else runFlightSearch(false);
}
function updateStats() {
  const rows = allHistoryRecords();
  $('stat-results').textContent = String(currentItems.length);
  $('stat-records').textContent = new Intl.NumberFormat('ko-KR').format(rows.length);
  $('stat-updated').textContent = rows.length ? fmtTime(rows[0].ts).split(' ').slice(-1)[0] : '아직 없음';
  if (!rows.length) $('stat-lowest').textContent = '—';
  else $('stat-lowest').textContent = compactMoney(Math.min(...rows.map(r => Number(r.price) || Infinity)));
}
function populateHistorySelect(preferredKey = '') {
  const select = $('history-item-select');
  const all = readHistory();
  const entries = Object.entries(all).map(([key,list]) => ({key, last:Array.isArray(list) && list.length ? list[list.length-1] : null})).filter(x => x.last);
  entries.sort((a,b) => a.last.name.localeCompare(b.last.name,'ko'));
  const currentValue = preferredKey || select.value;
  select.innerHTML = '<option value="">상품 선택</option>' + entries.map(entry => `<option value="${escapeHTML(entry.key)}">${escapeHTML(entry.last.name)} · ${escapeHTML(entry.last.details || '')}</option>`).join('');
  if (currentValue && entries.some(entry => entry.key === currentValue)) select.value = currentValue;
  else if (entries.length) select.value = entries[0].key;
  renderHistoryChart();
}
function renderHistoryChart() {
  const key = $('history-item-select').value;
  const entryList = key ? (readHistory()[key] || []) : [];
  const selectOption = $('history-item-select').selectedOptions[0];
  const latest = entryList[entryList.length-1];
  $('chart-title').textContent = latest ? latest.name : (selectOption && selectOption.value ? selectOption.textContent : '상품을 선택하세요');
  $('chart-record-count').textContent = `${entryList.length}회 관측`;
  if (!entryList.length) {
    $('chart-summary').innerHTML = '<span>기록이 쌓이면 그래프가 표시됩니다.</span>';
    $('price-chart').innerHTML = '<text x="380" y="130" text-anchor="middle" class="chart-empty-label">가격 기록을 기다리는 중</text>';
    updateAlertMessage(key, latest);
    return;
  }
  const prices = entryList.map(e => e.price);
  const latestPrice = prices[prices.length-1];
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const previous = prices.length > 1 ? prices[prices.length-2] : null;
  const delta = previous ? ((latestPrice-previous)/previous)*100 : null;
  $('chart-summary').innerHTML = `<span>현재가 <strong>${money(latestPrice)}</strong></span><span>기록 최저가 <strong>${money(lowest)}</strong></span><span>기록 최고가 <strong>${money(highest)}</strong></span><span>직전 대비 <strong style="color:${delta===null?'#263854':delta<0?'#0ca97a':delta>0?'#de6c65':'#263854'}">${delta===null?'—':`${delta>0?'+':''}${delta.toFixed(2)}%`}</strong></span>`;
  drawSVGChart(entryList);
  updateAlertMessage(key, latest);
}
function drawSVGChart(entries) {
  const svg = $('price-chart');
  const W=760,H=260,L=68,R=20,T=18,B=36;
  const values=entries.map(e=>e.price);
  let min=Math.min(...values), max=Math.max(...values);
  if (min===max) { min*=0.96; max*=1.04; }
  const pad=(max-min)*0.14; min=Math.max(0,min-pad); max+=pad;
  const plotW=W-L-R, plotH=H-T-B;
  const x=i=> L+(entries.length===1?0:i/(entries.length-1))*plotW;
  const y=v=> T+(max-v)/(max-min)*plotH;
  let markup='<defs><linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#5876f6" stop-opacity=".22"/><stop offset="100%" stop-color="#5876f6" stop-opacity="0"/></linearGradient></defs>';
  for(let i=0;i<4;i++){const val=min+(max-min)*i/3;const yy=y(val);markup+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" class="chart-grid"/><text x="${L-10}" y="${yy+4}" text-anchor="end" class="chart-axis-label">${Math.round(val/1000)}k</text>`;}
  const points=entries.map((e,i)=>`${x(i)},${y(e.price)}`).join(' ');
  const area=`${x(0)},${H-B} ${points} ${x(entries.length-1)},${H-B}`;
  markup+=`<polygon points="${area}" class="chart-area"/><polyline points="${points}" class="chart-line"/>`;
  entries.forEach((e,i)=>{if(entries.length<=12||i===0||i===entries.length-1||i%Math.ceil(entries.length/6)===0){markup+=`<circle cx="${x(i)}" cy="${y(e.price)}" r="4" class="chart-point"><title>${escapeHTML(fmtTime(e.ts))} · ${money(e.price)}</title></circle>`;}});
  const tickIndexes = entries.length <= 5 ? entries.map((_,i)=>i) : [0,Math.floor((entries.length-1)/2),entries.length-1];
  tickIndexes.forEach(i=>{markup+=`<text x="${x(i)}" y="${H-10}" text-anchor="${i===0?'start':i===entries.length-1?'end':'middle'}" class="chart-axis-label">${escapeHTML(new Date(entries[i].ts).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}))}</text>`;});
  svg.innerHTML=markup;
}
function updateAlertMessage(key, latest) {
  const message=$('alert-message');
  if(!key || !latest){message.className='alert-message';message.textContent='상품을 선택한 뒤 목표 가격을 저장하세요.';return;}
  const target=Number(getTargets()[key]||0);
  if(!target){message.className='alert-message';message.textContent='목표 가격을 입력하고 저장하면 해당 상품의 가격을 확인합니다.';return;}
  if(latest.price<=target){message.className='alert-message good';message.textContent=`목표 가격 도달! 현재 ${money(latest.price)} · 목표 ${money(target)}`;}
  else {message.className='alert-message warn';message.textContent=`현재 ${money(latest.price)} · 목표까지 ${money(latest.price-target)} 남았습니다.`;}
  $('target-price').value=String(target);
}
function renderHistoryTable() {
  const rows=allHistoryRecords().slice(0,12);
  const body=$('history-table-body');
  if(!rows.length){body.innerHTML='<tr><td colspan="5" class="table-empty">아직 저장된 기록이 없습니다. 검색 화면을 열어 두면 가격이 기록됩니다.</td></tr>';return;}
  body.innerHTML=rows.map(row=>{
    const previous=getPreviousForRecord(row);
    let deltaText='—',deltaClass='';
    if(previous!==null && previous>0){const pct=(row.price-previous)/previous*100;deltaText=`${pct>0?'+':''}${pct.toFixed(2)}%`;deltaClass=pct<0?'delta-down':pct>0?'delta-up':'';}
    return `<tr><td>${escapeHTML(fmtTime(row.ts))}</td><td><strong>${escapeHTML(row.name||row.key)}</strong></td><td>${escapeHTML(row.type||'기타')}</td><td><strong>${money(row.price)}</strong></td><td class="${deltaClass}">${deltaText}</td></tr>`;
  }).join('');
}
function getPreviousForRecord(row) {
  const entries=readHistory()[row.key]||[];
  const index=entries.findIndex(e=>e.ts===row.ts && e.price===row.price);
  return index>0?entries[index-1].price:null;
}
function showToast(message) {
  const toast=$('toast'); toast.textContent=message; toast.classList.add('show');
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('show'),2800);
}
function setView(next) {
  view=next;localStorage.setItem(LAST_VIEW_KEY,view);
  document.querySelectorAll('.nav-link').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));
  $('search-panel').classList.toggle('hidden',view==='history');
  $('results-section').classList.toggle('hidden',view==='history');
  $('history-section').classList.toggle('hidden',view!=='history');
  $('flight-controls').classList.toggle('hidden',view!=='flights');
  $('hotel-controls').classList.toggle('hidden',view!=='hotels');
  if(view==='flights') { $('search-title').textContent='항공편 검색';$('filter-hint').textContent='여행 날짜 범위 안의 여러 항공편을 검색합니다. 데모 검색은 최대 15일 범위입니다.';runFlightSearch(false); }
  if(view==='hotels') { $('search-title').textContent='숙소 검색';$('filter-hint').textContent='체크인·체크아웃 조건으로 숙소를 찾고 가격순 또는 평점순으로 정렬합니다.';runHotelSearch(false); }
  if(view==='history') { populateHistorySelect();renderHistoryTable();updateStats(); }
}
function seedDates() {
  const today=new Date();
  const start=plusDays(today,14);const end=plusDays(start,2);const checkout=plusDays(start,3);
  $('flight-start').value=localISODate(start);$('flight-end').value=localISODate(end);
  $('checkin').value=localISODate(start);$('checkout').value=localISODate(checkout);
}
function init() {
  seedDates();
  $('search-flights').addEventListener('click',()=>{setView('flights');runFlightSearch(true);});
  $('search-hotels').addEventListener('click',()=>{setView('hotels');runHotelSearch(true);});
  $('refresh-now').addEventListener('click',()=>{
    if(view==='hotels')runHotelSearch(false);else runFlightSearch(false);
    saveCurrentSnapshots(true);populateHistorySelect();renderHistoryTable();showToast('현재 표시 가격을 다시 확인하고 기록했습니다.');
  });
  $('swap-route').addEventListener('click',()=>{const old=$('origin').value;$('origin').value=$('destination').value;$('destination').value=old;});
  document.querySelectorAll('.nav-link').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
  $('results').addEventListener('click',event=>{const btn=event.target.closest('[data-history-key]');if(btn){setView('history');populateHistorySelect(btn.dataset.historyKey);$('history-item-select').value=btn.dataset.historyKey;renderHistoryChart();}});
  $('history-item-select').addEventListener('change',()=>{renderHistoryChart();$('target-price').value=getTargets()[$('history-item-select').value]||'';});
  $('save-target').addEventListener('click',()=>{
    const key=$('history-item-select').value;const price=Number($('target-price').value);
    if(!key){showToast('먼저 가격을 추적할 상품을 선택하세요.');return;}
    if(!Number.isFinite(price)||price<=0){showToast('0보다 큰 목표 가격을 입력하세요.');return;}
    const targets=getTargets();targets[key]=price;localStorage.setItem(TARGET_KEY,JSON.stringify(targets));
    const rows=readHistory()[key]||[];if(rows.length)checkTarget({key,name:rows[rows.length-1].name},rows[rows.length-1].price);
    updateAlertMessage(key,rows[rows.length-1]);showToast('목표 가격을 저장했습니다.');
  });
  $('clear-history').addEventListener('click',()=>{if(!confirm('이 브라우저에 저장된 가격 기록을 모두 지울까요?'))return;localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(TARGET_KEY);window.__alertedTargets={};populateHistorySelect();renderHistoryTable();updateStats();showToast('가격 기록을 지웠습니다.');});
  $('reset-demo').addEventListener('click',()=>{if(!confirm('가격 기록과 검색 조건을 초기화할까요?'))return;localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(TARGET_KEY);localStorage.removeItem(LAST_VIEW_KEY);location.reload();});
  setView(view === 'flights' || view === 'hotels' || view === 'history' ? view : 'flights');
  // The client-side demo updates every 12 seconds while this page is open.
  setInterval(()=>{const tick=Math.floor(Date.now()/PRICE_INTERVAL_MS);if(tick!==lastPriceTick){updateCurrentPrices(true);renderHistoryTable();populateHistorySelect($('history-item-select').value);updateStats();}},1000);
}

document.addEventListener('DOMContentLoaded', init);
