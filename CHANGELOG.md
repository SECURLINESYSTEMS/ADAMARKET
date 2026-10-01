# Changelog

## Unreleased — 2026-10-01

- Переведено состояние frontend на единый `window.AdamarketState` без дублирующих lexical globals.
- Авторизация и формы используют явные DOM-ссылки через `document.getElementById`.
- Android demo теперь загружает канонический локальный `index.html`, а не удалённый сайт с набором устаревших runtime-патчей.
- Оставлен рабочий Leaflet-пикер координат.
- Добавлен frontend smoke-тест для state-архитектуры, авторизации, поиска, избранного, карты и API actions.
- Release signing по-прежнему требует keystore через CI Secrets; секреты в репозитории отсутствуют.
