(() => {
  const grid = document.querySelector('#catalogList');
  if (!grid) return;

  const isUzbek = document.documentElement.lang === 'uz';
  const locale = isUzbek ? 'uz-UZ' : 'ru-RU';
  const cards = [...grid.querySelectorAll('.catalog-item')];
  const search = document.querySelector('#catalogSearch');
  const category = document.querySelector('#catalogCategory');
  const sort = document.querySelector('#catalogSort');
  const count = document.querySelector('#catalogResultCount');
  const empty = document.querySelector('#catalogEmpty');
  const pageSize = 40;
  let page = 1;
  let filteredCards = cards;

  const normalize = (value) => String(value ?? '')
    .toLocaleLowerCase(locale)
    .replace(/ё/g, 'е')
    .replace(/[‘’ʼ`]/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const formatCount = (value) => new Intl.NumberFormat(locale).format(value).replace(/\u00a0/g, ' ');
  const wordForGenitiveCount = (value) => {
    if (isUzbek) return 'ta pozitsiya';
    const lastTwo = value % 100;
    const last = value % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return 'позиций';
    if (last === 1) return 'позиция';
    if (last >= 2 && last <= 4) return 'позиции';
    return 'позиций';
  };

  const updatePagination = (pageCount) => {
    document.querySelectorAll('.catalog-page-indicator').forEach((indicator) => {
      indicator.textContent = isUzbek
        ? `Sahifa ${formatCount(page)} / ${formatCount(pageCount)}`
        : `Страница ${page} из ${pageCount}`;
    });
    document.querySelectorAll('[data-page-action="prev"]').forEach((button) => {
      button.disabled = page <= 1;
    });
    document.querySelectorAll('[data-page-action="next"]').forEach((button) => {
      button.disabled = page >= pageCount;
    });
  };

  const render = () => {
    const query = normalize(search?.value);
    const selectedCategory = category?.value || 'all';

    filteredCards = cards.filter((card) => {
      const matchesCategory = selectedCategory === 'all' || card.dataset.category === selectedCategory;
      const matchesQuery = !query || normalize(card.textContent).includes(query);
      return matchesCategory && matchesQuery;
    });

    const sortMode = sort?.value || 'source';
    if (sortMode === 'price-asc') {
      filteredCards.sort((a, b) => Number(a.dataset.priceUzs) - Number(b.dataset.priceUzs));
    } else if (sortMode === 'price-desc') {
      filteredCards.sort((a, b) => Number(b.dataset.priceUzs) - Number(a.dataset.priceUzs));
    } else if (sortMode === 'name') {
      filteredCards.sort((a, b) => a.querySelector('h2').textContent.localeCompare(b.querySelector('h2').textContent, locale, {sensitivity: 'base', numeric: true}));
    }

    const pageCount = Math.max(1, Math.ceil(filteredCards.length / pageSize));
    page = Math.min(Math.max(page, 1), pageCount);
    cards.forEach((card) => { card.hidden = true; });
    const start = (page - 1) * pageSize;
    const visible = filteredCards.slice(start, start + pageSize);
    visible.forEach((card) => {
      card.hidden = false;
      grid.appendChild(card);
    });

    if (count) {
      if (filteredCards.length === 0) {
        count.textContent = isUzbek ? 'Topildi: 0 ta pozitsiya' : 'Найдено: 0 позиций';
      } else {
        const end = Math.min(start + pageSize, filteredCards.length);
        count.textContent = isUzbek
          ? `Ko‘rsatilmoqda: ${formatCount(start + 1)}–${formatCount(end)} / ${formatCount(filteredCards.length)} ta pozitsiya`
          : `Показано ${formatCount(start + 1)}–${formatCount(end)} из ${formatCount(filteredCards.length)} ${wordForGenitiveCount(filteredCards.length)}`;
      }
    }
    if (empty) empty.hidden = filteredCards.length > 0;
    updatePagination(pageCount);
  };

  const urlCategory = new URLSearchParams(window.location.search).get('category');
  if (urlCategory && [...(category?.options ?? [])].some((option) => option.value === urlCategory)) {
    category.value = urlCategory;
  }

  search?.addEventListener('input', () => { page = 1; render(); });
  category?.addEventListener('change', () => { page = 1; render(); });
  sort?.addEventListener('change', () => { page = 1; render(); });
  document.querySelector('#catalogClear')?.addEventListener('click', () => {
    if (search) search.value = '';
    if (category) category.value = 'all';
    if (sort) sort.value = 'source';
    page = 1;
    render();
    search?.focus();
  });
  document.querySelectorAll('[data-page-action="prev"]').forEach((button) => {
    button.addEventListener('click', () => { page -= 1; render(); });
  });
  document.querySelectorAll('[data-page-action="next"]').forEach((button) => {
    button.addEventListener('click', () => { page += 1; render(); });
  });

  render();
})();
