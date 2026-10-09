const $ = (id) => document.getElementById(id);
let currentTab = 'flights';
const cards = [...document.querySelectorAll('.product-card')];
function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  $('flight-search').classList.toggle('hidden', tab !== 'flights');
  $('hotel-search').classList.toggle('hidden', tab !== 'hotels');
  $('flight-results').classList.toggle('hidden', tab !== 'flights');
  $('hotel-results').classList.toggle('hidden', tab !== 'hotels');
  $('list-kicker').textContent = tab === 'flights' ? 'FLIGHT RESULTS' : 'HOTEL RESULTS';
  $('list-title').textContent = tab === 'flights' ? '항공편 검색 결과' : '숙소 검색 결과';
  applyFilters();
}
function applyFilters() {
  const isFlight = currentTab === 'flights';
  const start = isFlight ? $('flight-start').value : $('checkin').value;
  const end = isFlight ? $('flight-end').value : $('checkout').value;
  const visible = [];
  cards.filter(card => card.dataset.productType === (isFlight ? 'flight' : 'hotel')).forEach(card => {
    let show = true;
    if (isFlight) {
      show = card.dataset.origin === $('origin').value && card.dataset.destination === $('destination').value && card.dataset.date >= start && card.dataset.date <= end;
    } else {
      show = card.dataset.city === $('hotel-city').value && card.dataset.checkin >= start && card.dataset.checkin < end && card.dataset.checkout <= end;
    }
    card.classList.toggle('hidden', !show);
    if (show) visible.push(card);
  });
  if (!isFlight) {
    visible.sort((a, b) => $('hotel-sort').value === 'rating'
      ? Number(b.dataset.rating) - Number(a.dataset.rating)
      : Number(a.querySelector('.price-value').dataset.priceValue) - Number(b.querySelector('.price-value').dataset.priceValue));
    visible.forEach(card => $('hotel-results').appendChild(card));
  }
  $('result-count').textContent = isFlight ? `항공편 ${visible.length}개` : `숙소 ${visible.length}개`;
  $('empty-state').classList.toggle('hidden', visible.length > 0);
}
document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));
$('filter-flights').addEventListener('click', applyFilters);
$('filter-hotels').addEventListener('click', applyFilters);
$('hotel-sort').addEventListener('change', applyFilters);
$('origin').addEventListener('change', applyFilters);
$('destination').addEventListener('change', applyFilters);
$('hotel-city').addEventListener('change', applyFilters);
$('flight-start').addEventListener('change', applyFilters);
$('flight-end').addEventListener('change', applyFilters);
$('checkin').addEventListener('change', applyFilters);
$('checkout').addEventListener('change', applyFilters);
setTab('flights');
