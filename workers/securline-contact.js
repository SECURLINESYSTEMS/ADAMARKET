const ALLOWED_ORIGIN = "https://adamarket.uz";
const RECIPIENT = "kasfuri377@gmail.com";
const SENDER = "SecurLineUz <noreply@adamarket.uz>";
const MAX_BODY_BYTES = 8192;
const MAX_MESSAGE_CHARS = 2500;

const RU_DIRECTIONS = new Set([
  "Видеонаблюдение",
  "Турникеты и контроль доступа",
  "Пожарное оповещение",
  "Wi-Fi и локальная сеть",
  "Комплексное решение",
]);
const UZ_DIRECTIONS = new Set([
  "Videokuzatuv",
  "Turniketlar va kirishni boshqarish",
  "Yong‘in haqida ogohlantirish",
  "Wi-Fi va mahalliy tarmoq",
  "Kompleks yechim",
]);
const ALLOWED_DIRECTIONS = new Set([...RU_DIRECTIONS, ...UZ_DIRECTIONS]);

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function plain(status, message) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function field(data, ...names) {
  for (const name of names) {
    const value = data.get ? data.get(name) : data[name];
    if (typeof value === "string") return value.trim();
  }
  return "";
}

function nativeFormResponse(request, status, success) {
  const referer = request.headers.get("Referer") || "";
  const uz = referer.startsWith(ALLOWED_ORIGIN + "/uz/");
  const message = success
    ? uz ? "So‘rov yuborildi. SecurLineUz siz bilan bog‘lanadi." : "Заявка отправлена. SecurLineUz свяжется с вами."
    : uz ? "So‘rov yuborilmadi. Iltimos, keyinroq urinib ko‘ring yoki telefon qiling." : "Заявку не удалось отправить. Попробуйте позже или позвоните нам.";
  const back = uz ? "/uz/" : "/";
  const title = success ? (uz ? "Rahmat" : "Спасибо") : (uz ? "Xatolik" : "Ошибка");
  const html = "<!doctype html><html lang=\"" + (uz ? "uz" : "ru") + "\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + title + " — SecurLineUz</title><body><main><h1>" + title + "</h1><p>" + message + "</p><p><a href=\"" + back + "#contact\">" + (uz ? "Saytga qaytish" : "Вернуться на сайт") + "</a></p></main></body></html>";
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

function errorResponse(request, isJson, status, error) {
  return isJson ? json(status, { ok: false, error }) : nativeFormResponse(request, status, false);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/contact") return plain(404, "Not found");
    if (request.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer");
    let refererOrigin = "";
    if (referer) {
      try {
        refererOrigin = new URL(referer).origin;
      } catch {
        refererOrigin = "";
      }
    }
    if (origin ? origin !== ALLOWED_ORIGIN : refererOrigin !== ALLOWED_ORIGIN) {
      return json(403, { ok: false, error: "forbidden" });
    }

    const contentType = (request.headers.get("Content-Type") || "").toLowerCase();
    const isJson = contentType.includes("application/json");
    const isForm = contentType.includes("application/x-www-form-urlencoded");
    if (!isJson && !isForm) return json(415, { ok: false, error: "unsupported_media_type" });

    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > MAX_BODY_BYTES) return errorResponse(request, isJson, 413, "payload_too_large");

    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return errorResponse(request, isJson, 413, "payload_too_large");

    let data;
    if (isJson) {
      try {
        data = JSON.parse(raw);
      } catch {
        return errorResponse(request, true, 400, "invalid_json");
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) return errorResponse(request, true, 400, "invalid_payload");
    } else {
      data = new URLSearchParams(raw);
    }

    const company = field(data, "company", "website");
    if (company) return isJson ? json(200, { ok: true }) : nativeFormResponse(request, 200, true);

    const name = field(data, "name", "Имя", "ism").replace(/\s+/g, " ");
    const phone = field(data, "phone", "Телефон", "telefon");
    const direction = field(data, "direction", "Направление", "yonalish");
    const comment = field(data, "comment", "Комментарий", "izoh").replace(/\r\n?/g, "\n").replace(/\u0000/g, "");

    if (name.length < 2 || name.length > 100) return errorResponse(request, isJson, 400, "invalid_name");
    if (!/^[0-9+() \t-]{7,30}$/.test(phone)) return errorResponse(request, isJson, 400, "invalid_phone");
    if (!ALLOWED_DIRECTIONS.has(direction)) return errorResponse(request, isJson, 400, "invalid_direction");
    if (comment.length > MAX_MESSAGE_CHARS) return errorResponse(request, isJson, 400, "message_too_long");

    if (!env.RESEND_API_KEY) return errorResponse(request, isJson, 503, "service_unavailable");

    const uz = UZ_DIRECTIONS.has(direction);
    const text = uz
      ? ["SecurLineUz saytidan yangi so‘rov", "", "Ism: " + name, "Telefon: " + phone, "Yo‘nalish: " + direction, "Izoh: " + (comment || "ko‘rsatilmagan")].join("\n")
      : ["Новая заявка с сайта SecurLineUz", "", "Имя: " + name, "Телефон: " + phone, "Направление: " + direction, "Комментарий: " + (comment || "не указан")].join("\n");

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + env.RESEND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: SENDER,
          to: [RECIPIENT],
          subject: uz ? "Yangi so‘rov — SecurLineUz" : "Новая заявка — SecurLineUz",
          text,
        }),
      });

      if (!response.ok) return errorResponse(request, isJson, 502, "send_failed");
      return isJson ? json(200, { ok: true }) : nativeFormResponse(request, 200, true);
    } catch {
      return errorResponse(request, isJson, 502, "send_failed");
    }
  },
};
