document.documentElement.classList.add('js-enabled');

const isUzbek = document.documentElement.lang === 'uz';
const uiText = isUzbek
  ? {
      openMenu: 'Menyuni ochish',
      closeMenu: 'Menyuni yopish',
      filterCount: (count) => `Ko‘rsatilmoqda: ${count} ta pozitsiya`,
      searchCount: (count) => `${count} ta pozitsiya ko‘rsatildi`,
      noResults: 'Hech narsa topilmadi. So‘rovni o‘zgartiring yoki boshqa bo‘limni tanlang.',
      subject: (direction) => `SecurLineUz uchun so‘rov — ${direction}`,
      formBody: (name, phone, direction, comment) => [
        `Ism: ${name}`,
        `Telefon: ${phone}`,
        `Yo‘nalish: ${direction}`,
        `Izoh: ${comment || 'ko‘rsatilmagan'}`,
      ].join('\n'),
      sentNote: 'Xat pochta ilovasida tayyorlandi. Ochilmasa, +998 95 021 43 34 raqamiga qo‘ng‘iroq qiling.',
    }
  : {
      openMenu: 'Открыть меню',
      closeMenu: 'Закрыть меню',
      filterCount: (count) => `Показано позиций: ${count}`,
      searchCount: (count) => `Показано ${count} ${positionWord(count)}`,
      noResults: 'Ничего не найдено. Измените запрос или выберите другой раздел.',
      subject: (direction) => `Запрос для SecurLineUz — ${direction}`,
      formBody: (name, phone, direction, comment) => [
        `Имя: ${name}`,
        `Телефон: ${phone}`,
        `Направление: ${direction}`,
        `Комментарий: ${comment || 'не указан'}`,
      ].join('\n'),
      sentNote: 'Письмо подготовлено в вашем почтовом приложении. Если оно не открылось, позвоните по номеру +998 95 021 43 34.',
    };

const menuButton = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('#mainNav');
if (menuButton && mainNav) {
  menuButton.setAttribute('aria-label', uiText.openMenu);
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? uiText.openMenu : uiText.closeMenu);
    mainNav.classList.toggle('is-open', !isOpen);
  });
  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', uiText.openMenu);
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

const normalizeText = (text) => text.toLocaleLowerCase(isUzbek ? 'uz-UZ' : 'ru-RU').replace(/ё/g, 'е').trim();
function positionWord(count) {
  if (isUzbek) return 'ta pozitsiya';
  const lastTwo = count % 100;
  const lastDigit = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'позиций';
  if (lastDigit === 1) return 'позиция';
  if (lastDigit >= 2 && lastDigit <= 4) return 'позиции';
  return 'позиций';
}

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

  if (filterStatus) filterStatus.textContent = uiText.filterCount(visibleCount);
  if (searchResults) searchResults.textContent = uiText.searchCount(visibleCount);
  if (noResults) {
    noResults.textContent = uiText.noResults;
    noResults.hidden = visibleCount > 0;
  }
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
    const direction = String(form.querySelector('#system')?.value ?? '');
    const name = String(form.querySelector('#name')?.value ?? '');
    const phone = String(form.querySelector('#phone')?.value ?? '');
    const comment = String(form.querySelector('#message')?.value ?? '');
    const subject = uiText.subject(direction);
    const body = uiText.formBody(name, phone, direction, comment);
    window.location.href = `mailto:kasfuri377@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const note = document.querySelector('#formNote');
    if (note) note.textContent = uiText.sentNote;
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
