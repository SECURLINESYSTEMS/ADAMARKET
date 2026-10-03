#!/usr/bin/env python3
import json, os, re, sqlite3, time, hashlib
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "adamarket.db"
MAX_BODY = 64 * 1024
ALLOWED_TYPES = {"Баннер", "Билборд", "LED-экран", "Вывеска", "Световой короб"}


def now():
    return datetime.now(timezone.utc).isoformat()


def db():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    return c


def init_db():
    c = db()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, type TEXT NOT NULL, price INTEGER NOT NULL,
      unit TEXT NOT NULL DEFAULT 'month', city TEXT NOT NULL DEFAULT 'Ташкент',
      district TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
      latitude REAL, longitude REAL, description TEXT NOT NULL DEFAULT '',
      cover_image TEXT NOT NULL DEFAULT '', owner_name TEXT NOT NULL DEFAULT '',
      owner_contact TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'approved',
      source_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT, place_id INTEGER NOT NULL,
      reason TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, place_id INTEGER NOT NULL,
      requester_name TEXT NOT NULL, requester_contact TEXT NOT NULL,
      message TEXT NOT NULL, budget INTEGER, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_places_status ON places(status);
    CREATE INDEX IF NOT EXISTS idx_places_created ON places(created_at);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
    """)
    c.commit(); c.close()


def json_response(h, status, payload):
    raw = json.dumps(payload, ensure_ascii=False).encode()
    h.send_response(status)
    h.send_header("Content-Type", "application/json; charset=utf-8")
    h.send_header("Cache-Control", "no-store")
    h.send_header("Content-Length", str(len(raw)))
    h.end_headers(); h.wfile.write(raw)


def read_json(h):
    length = int(h.headers.get("Content-Length", "0"))
    if length <= 0 or length > MAX_BODY: raise ValueError("Некорректный размер запроса")
    return json.loads(h.rfile.read(length).decode("utf-8"))


def clean(v, limit=500):
    return re.sub(r"[\x00-\x1f\x7f]", "", str(v or "")).strip()[:limit]


def place_obj(row):
    d = dict(row)
    d["price"] = int(d["price"])
    return d


def list_places():
    c = db(); rows = c.execute("SELECT id,title,type,price,unit,city,district,address,latitude,longitude,description,cover_image,owner_name,CASE WHEN owner_contact <> '' THEN 1 ELSE 0 END AS has_contact,created_at FROM places WHERE status='approved' ORDER BY created_at DESC LIMIT 200").fetchall(); c.close()
    return [place_obj(r) for r in rows]


def recommend_places(data):
    district = clean(data.get("district"), 80).lower()
    typ = clean(data.get("type"), 40).lower()
    try: budget = int(float(data.get("budget"))) if data.get("budget") else None
    except Exception: budget = None
    places = list_places()
    scored = []
    for p in places:
        hay = f"{p['title']} {p['type']} {p['district']} {p['address']}".lower()
        if district and district not in hay: continue
        if typ and typ not in p['type'].lower() and typ not in hay: continue
        if budget and p['price'] > budget: continue
        score = 0
        if district and district in hay: score += 3
        if typ and typ in hay: score += 3
        if budget and p['price'] <= budget: score += 2
        scored.append((score, p))
    return [p for _, p in sorted(scored, key=lambda x: (-x[0], -x[1]['id']))[:20]]


def budget_from_message(message):
    nums = re.findall(r"(?<!\d)(\d[\d\s.,]*)(?:\s*(?:млн|мillion|тыс|k))?", message.lower())
    values = []
    for raw in nums:
        try:
            value = float(raw.replace(" ", "").replace(",", "."))
            if re.search(r"(?:млн|миллион|миллионов|million)", message.lower()): value *= 1_000_000
            elif re.search(r"(?:тыс|тысяч|тысячи|k)", message.lower()): value *= 1_000
            if value >= 10_000: values.append(int(value))
        except ValueError:
            pass
    return max(values) if values else None


def empty_catalog_advice(message):
    budget = budget_from_message(message)
    budget_text = f"Ваш бюджет — до {budget:,} сум в месяц.".replace(",", " ") if budget else "Бюджет пока не указан."
    return (f"{budget_text}\n\nСейчас в каталоге ещё нет опубликованных рекламных мест, поэтому я не буду придумывать конкретный адрес или цену. "
            "Для такого бюджета в Ташкенте стоит рассмотреть LED-экран, билборд 6×3 м, световую вывеску или несколько баннерных размещений. "
            "Оставьте запрос: район, формат, срок и контакт — мы добавим подходящие варианты, когда владельцы разместят объявления.\n\n"
            "Пока можно бесплатно добавить своё рекламное место или пригласить владельца места в ADAMARKET.")


def create_place(data, ip):
    title = clean(data.get("title"), 120); typ = clean(data.get("type"), 40)
    if len(title) < 3: raise ValueError("Укажите название объявления")
    if typ not in ALLOWED_TYPES: typ = "Другое"
    try: price = int(float(data.get("price", 0)))
    except Exception: raise ValueError("Укажите корректную цену")
    if price < 0 or price > 10_000_000_000: raise ValueError("Некорректная цена")
    contact = clean(data.get("owner_contact"), 120); owner = clean(data.get("owner_name"), 100)
    fingerprint = hashlib.sha256((title.lower()+"|"+contact.lower()+"|"+ip).encode()).hexdigest()
    c = db()
    recent = c.execute("SELECT id FROM places WHERE (owner_contact=? OR source_hash=?) AND created_at >= datetime('now','-30 day') LIMIT 1", (contact, fingerprint)).fetchone()
    if recent: c.close(); raise ValueError("Бесплатное объявление уже размещалось за последние 30 дней")
    image = clean(data.get("cover_image"), 500) or "assets/tashkent-hero.jpg"
    cur = c.execute("INSERT INTO places(title,type,price,unit,city,district,address,latitude,longitude,description,cover_image,owner_name,owner_contact,status,source_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (title, typ, price, "month", clean(data.get("city"),60) or "Ташкент", clean(data.get("district"),80), clean(data.get("address"),180), data.get("latitude"), data.get("longitude"), clean(data.get("description"),1000), image, owner, contact, "approved", fingerprint, now()))
    c.commit(); row = c.execute("SELECT id,title,type,price,unit,city,district,address,latitude,longitude,description,cover_image,owner_name,created_at FROM places WHERE id=?", (cur.lastrowid,)).fetchone(); c.close()
    return place_obj(row)


def ai_answer(message):
    message = clean(message, 1200)
    if not message: raise ValueError("Напишите вопрос")
    places = list_places()
    if not places:
        return {"answer": empty_catalog_advice(message), "places": [], "catalog_empty": True, "request_prompt": "Укажите район, формат рекламы, срок и контакт для подбора места."}
    context = "\n".join(f"#{p['id']} | {p['title']} | {p['type']} | {p['price']} сум/месяц | {p['district']} | {p['address']}" for p in places[:80]) or "Каталог пока пуст."
    key, base = os.environ.get("OPENAI_API_KEY"), os.environ.get("OPENAI_API_BASE")
    if not key or not base:
        return {"answer":"AI временно работает в демо-режиме. Каталог доступен через поиск, а подключение серверного AI будет активировано в публичной инфраструктуре.", "places": places[:8]}
    payload = {"model":"gpt-5-nano","messages":[{"role":"system","content":"Ты AI-помощник ADAMARKET по рекламным местам Ташкента. Отвечай на языке пользователя. Используй только каталог ниже, не выдумывай места и цены. Если данных мало, честно скажи это. Дай короткий полезный ответ и до 5 подходящих ID.\nКАТАЛОГ:\n"+context},{"role":"user","content":message}],"max_completion_tokens":1000}
    req = Request(base.rstrip("/")+"/chat/completions", data=json.dumps(payload).encode(), headers={"Authorization":"Bearer "+key,"Content-Type":"application/json"}, method="POST")
    try:
        with urlopen(req, timeout=25) as r: result = json.loads(r.read().decode())
        text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        return {"answer": text or "Не удалось получить ответ AI.", "places": places[:8]}
    except Exception:
        return {"answer":"AI сейчас недоступен, но поиск по каталогу продолжает работать. Попробуйте уточнить район, формат или бюджет.", "places": places[:8]}


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/api/health": return json_response(self, 200, {"ok": True, "database": DB_PATH.exists(), "ai": bool(os.environ.get("OPENAI_API_KEY"))})
        if u.path == "/api/places": return json_response(self, 200, {"ok": True, "places": list_places()})
        if u.path.startswith("/api/places/") and u.path.endswith("/contact"):
            try: place_id = int(u.path.split("/")[3])
            except Exception: return json_response(self, 400, {"ok": False, "error": "Некорректное объявление"})
            c = db(); row = c.execute("SELECT owner_name,owner_contact FROM places WHERE id=? AND status='approved'", (place_id,)).fetchone(); c.close()
            if not row: return json_response(self, 404, {"ok": False, "error": "Объявление не найдено"})
            return json_response(self, 200, {"ok": True, "owner_name": row["owner_name"], "contact": row["owner_contact"]})
        if u.path == "/api/requests":
            owner_contact = clean(parse_qs(u.query).get("owner_contact", [""])[0], 120)
            if not owner_contact: return json_response(self, 400, {"ok": False, "error": "Укажите контакт владельца"})
            c = db(); rows = c.execute("SELECT r.id,r.place_id,p.title,r.requester_name,r.requester_contact,r.message,r.budget,r.status,r.created_at FROM requests r JOIN places p ON p.id=r.place_id WHERE p.owner_contact=? ORDER BY r.created_at DESC LIMIT 100", (owner_contact,)).fetchall(); c.close()
            return json_response(self, 200, {"ok": True, "requests": [dict(r) for r in rows]})
        return super().do_GET()
    def do_POST(self):
        u = urlparse(self.path)
        try: data = read_json(self)
        except Exception as e: return json_response(self, 400, {"ok": False, "error": str(e)})
        try:
            if u.path == "/api/places": return json_response(self, 201, {"ok": True, "place": create_place(data, self.client_address[0])})
            if u.path == "/api/recommend":
                matches = recommend_places(data); return json_response(self, 200, {"ok": True, "places": matches, "message": "Подходящие места найдены" if matches else "Пока нет точного совпадения. Добавьте запрос — каталог пополняется."})
            if u.path == "/api/ai": return json_response(self, 200, {"ok": True, **ai_answer(data.get("message", ""))})
            if u.path == "/api/reports":
                c=db(); c.execute("INSERT INTO reports(place_id,reason,created_at) VALUES(?,?,?)", (int(data.get("place_id")), clean(data.get("reason"),300) or "Жалоба", now())); c.commit(); c.close(); return json_response(self, 201, {"ok": True})
            if u.path == "/api/requests":
                place_id = int(data.get("place_id")); name = clean(data.get("requester_name"),100); contact = clean(data.get("requester_contact"),120); message = clean(data.get("message"),1000)
                if not name or not contact or not message: raise ValueError("Укажите имя, контакт и задачу")
                c=db(); exists=c.execute("SELECT id FROM places WHERE id=? AND status='approved'", (place_id,)).fetchone()
                if not exists: c.close(); raise ValueError("Объявление недоступно")
                c.execute("INSERT INTO requests(place_id,requester_name,requester_contact,message,budget,created_at) VALUES(?,?,?,?,?,?)", (place_id,name,contact,message,data.get("budget"),now())); c.commit(); c.close(); return json_response(self, 201, {"ok": True, "message": "Заявка принята и сохранена для владельца"})
            if u.path == "/api/requests/status":
                request_id = int(data.get("request_id")); status = clean(data.get("status"), 20)
                if status not in {"new", "contacted", "agreed", "closed", "rejected"}: raise ValueError("Некорректный статус")
                c=db(); c.execute("UPDATE requests SET status=? WHERE id=?", (status, request_id)); c.commit(); c.close(); return json_response(self, 200, {"ok": True})
            if u.path == "/api/admin/moderate":
                if not os.environ.get("ADMIN_KEY") or data.get("admin_key") != os.environ.get("ADMIN_KEY"): return json_response(self, 403, {"ok": False, "error": "Доступ запрещён"})
                place_id=int(data.get("place_id")); status=clean(data.get("status"),20)
                if status not in {"pending", "approved", "hidden", "rejected"}: raise ValueError("Некорректный статус объявления")
                c=db(); c.execute("UPDATE places SET status=? WHERE id=?", (status,place_id)); c.commit(); c.close(); return json_response(self,200,{"ok":True})
            return json_response(self, 404, {"ok": False, "error": "Маршрут не найден"})
        except ValueError as e: return json_response(self, 400, {"ok": False, "error": str(e)})
        except Exception as e: return json_response(self, 500, {"ok": False, "error": "Внутренняя ошибка сервера"})


if __name__ == "__main__":
    init_db(); port = int(os.environ.get("PORT", "8092")); print(f"ADAMARKET server on 0.0.0.0:{port}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
