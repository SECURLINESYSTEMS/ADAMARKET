document.documentElement.classList.add('js-enabled');

const menuButton = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('#mainNav');
if (menuButton && mainNav) {
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Открыть меню' : 'Закрыть меню');
    mainNav.classList.toggle('is-open', !isOpen);
  });
  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Открыть меню');
      mainNav.classList.remove('is-open');
    });
  });
}

const filterButtons = [...document.querySelectorAll('.filter-button')];
const equipmentItems = [...document.querySelectorAll('.equipment-item')];
const filterStatus = document.querySelector('.filter-status');
const searchInput = document.querySelector('#equipmentSearch');
const searchResults = document.querySelector('#searchResults');
const totalEquipmentCount = document.querySelector('#totalEquipmentCount');
const noResults = document.querySelector('#noResults');
let activeCategory = 'all';

if (totalEquipmentCount) totalEquipmentCount.textContent = String(equipmentItems.length);

const normalizeText = (text) => text.toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
const positionWord = (count) => {
  const lastTwo = count % 100;
  const lastDigit = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'позиций';
  if (lastDigit === 1) return 'позиция';
  if (lastDigit >= 2 && lastDigit <= 4) return 'позиции';
  return 'позиций';
};

function updateEquipmentList() {
  const query = normalizeText(searchInput?.value ?? '');
  let visibleCount = 0;

  equipmentItems.forEach((item) => {
    const matchesCategory = activeCategory === 'all' || item.dataset.category === activeCategory;
    const matchesSearch = !query || normalizeText(item.textContent).includes(query);
    const isVisible = matchesCategory && matchesSearch;
    item.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  });

  if (filterStatus) filterStatus.textContent = `Показано позиций: ${visibleCount}`;
  if (searchResults) searchResults.textContent = `Показано ${visibleCount} ${positionWord(visibleCount)}`;
  if (noResults) noResults.hidden = visibleCount > 0;
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activeCategory = button.dataset.filter;
    filterButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    updateEquipmentList();
  });
});
searchInput?.addEventListener('input', updateEquipmentList);

const form = document.querySelector('#contactForm');
if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const subject = `Запрос для SecurLineUz — ${fields.get('Направление')}`;
    const body = [
      `Имя: ${fields.get('Имя')}`,
      `Телефон: ${fields.get('Телефон')}`,
      `Направление: ${fields.get('Направление')}`,
      `Комментарий: ${fields.get('Комментарий') || 'не указан'}`,
    ].join('\n');
    window.location.href = `mailto:kasfuri377@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const note = document.querySelector('#formNote');
    if (note) note.textContent = 'Письмо подготовлено в вашем почтовом приложении. Если оно не открылось, позвоните по номеру +998 95 021 43 34.';
  });
}

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

const revealTargets = document.querySelectorAll('.solution-card, .equipment-item, .rate-row, .approach-list > div, .use-case-items article');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
  revealTargets.forEach((element) => {
    element.classList.add('reveal');
    observer.observe(element);
  });
} else {
  revealTargets.forEach((element) => element.classList.add('is-visible'));
}
