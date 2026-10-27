document.documentElement.classList.add('js-enabled');

const isUzbek = document.documentElement.lang === 'uz';
const uiText = isUzbek
  ? {
      openMenu: 'Menyuni ochish',
      closeMenu: 'Menyuni yopish',
      filterCount: (count) => `Ko‘rsatilmoqda: ${count} ta pozitsiya`,
      searchCount: (count) => `${count} ta pozitsiya ko‘rsatildi`,
      noResults: 'Hech narsa topilmadi. So‘rovni o‘zgartiring yoki boshqa bo‘limni tanlang.',
      sending: 'Yuborilmoqda…',
      sent: 'So‘rovingiz yuborildi. SecurLineUz siz bilan bog‘lanadi.',
      sendError: 'So‘rov yuborilmadi. Iltimos, qayta urinib ko‘ring yoki +998 95 021 43 34 raqamiga qo‘ng‘iroq qiling.',
    }
  : {
      openMenu: 'Открыть меню',
      closeMenu: 'Закрыть меню',
      filterCount: (count) => `Показано позиций: ${count}`,
      searchCount: (count) => `Показано ${count} ${positionWord(count)}`,
      noResults: 'Ничего не найдено. Измените запрос или выберите другой раздел.',
      sending: 'Отправляем заявку…',
      sent: 'Заявка отправлена. SecurLineUz свяжется с вами.',
      sendError: 'Не удалось отправить заявку. Попробуйте ещё раз или позвоните: +998 95 021 43 34.',
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
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const note = document.querySelector('#formNote');
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton?.disabled) return;
    const payload = {
      name: String(form.querySelector('#name')?.value ?? '').trim(),
      phone: String(form.querySelector('#phone')?.value ?? '').trim(),
      direction: String(form.querySelector('#system')?.value ?? ''),
      comment: String(form.querySelector('#message')?.value ?? '').trim(),
    };

    if (submitButton) submitButton.disabled = true;
    if (note) note.textContent = uiText.sending;
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error('Submission failed');
      if (note) note.textContent = uiText.sent;
      form.reset();
    } catch {
      if (note) note.textContent = uiText.sendError;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}


const reviewForm = document.querySelector('#reviewForm');
const reviewList = document.querySelector('#reviewList');
const reviewNote = document.querySelector('#reviewNote');
const reviewText = isUzbek ? {
  loading: 'Fikrlar yuklanmoqda…', empty: 'Hozircha fikrlar yo‘q. Birinchi bo‘lib fikr qoldiring.',
  failed: 'Fikrlarni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.',
  sending: 'Fikr yuborilmoqda…', sent: 'Rahmat! Fikringiz saytda e’lon qilindi.',
  sendError: 'Fikr yuborilmadi. Iltimos, qayta urinib ko‘ring.',
  rating: 'baho', name: 'Mijoz'
} : {
  loading: 'Загружаем отзывы…', empty: 'Пока отзывов нет. Будьте первым, кто поделится впечатлением.',
  failed: 'Не удалось загрузить отзывы. Попробуйте позже.',
  sending: 'Отправляем отзыв…', sent: 'Спасибо! Ваш отзыв опубликован на сайте.',
  sendError: 'Не удалось отправить отзыв. Попробуйте ещё раз.',
  rating: 'оценка', name: 'Клиент'
};
function renderReviews(items) {
  if (!reviewList) return;
  reviewList.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p'); empty.className = 'review-note'; empty.textContent = reviewText.empty;
    reviewList.append(empty); return;
  }
  items.forEach((item) => {
    const card = document.createElement('article'); card.className = 'review-card';
    const head = document.createElement('div'); head.className = 'review-card-head';
    const author = document.createElement('strong'); author.textContent = item.name || reviewText.name;
    const rating = document.createElement('span'); rating.className = 'review-rating'; rating.textContent = '★'.repeat(Math.max(1, Math.min(5, Number(item.rating))));
    rating.setAttribute('aria-label', Number(item.rating) + '/5');
    head.append(author, rating);
    const body = document.createElement('p'); body.textContent = item.comment;
    card.append(head, body); reviewList.append(card);
  });
}
async function loadReviews() {
  if (!reviewList) return;
  reviewList.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/reviews', { headers: { Accept: 'application/json' } });
    const result = await response.json();
    if (!response.ok || !result?.ok || !Array.isArray(result.reviews)) throw new Error('load');
    renderReviews(result.reviews);
  } catch {
    reviewList.replaceChildren();
    const error = document.createElement('p'); error.className = 'review-note'; error.textContent = reviewText.failed;
    reviewList.append(error);
  } finally { reviewList.setAttribute('aria-busy', 'false'); }
}
loadReviews();
if (reviewForm) {
  reviewForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!reviewForm.reportValidity()) return;
    const button = reviewForm.querySelector('[type="submit"]');
    if (button?.disabled) return;
    if (button) button.disabled = true;
    if (reviewNote) reviewNote.textContent = reviewText.sending;
    const payload = {
      name: String(reviewForm.querySelector('[name="name"]')?.value ?? '').trim(),
      rating: Number(reviewForm.querySelector('[name="rating"]')?.value ?? 0),
      comment: String(reviewForm.querySelector('[name="comment"]')?.value ?? '').trim(),
      consent: Boolean(reviewForm.querySelector('[name="consent"]')?.checked),
      company: String(reviewForm.querySelector('[name="company"]')?.value ?? '').trim(),
    };
    try {
      const response = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || 'submit');
      reviewForm.reset();
      if (reviewNote) reviewNote.textContent = reviewText.sent;
      await loadReviews();
    } catch {
      if (reviewNote) reviewNote.textContent = reviewText.sendError;
    } finally { if (button) button.disabled = false; }
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
