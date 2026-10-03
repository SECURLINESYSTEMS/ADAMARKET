/* Defense-in-depth for the packaged ADAMARKET Android WebView.
 * Native WebView mixed-content restrictions remain the primary transport control;
 * authentication and authorization must still be enforced by the backend.
 */
(() => {
  "use strict";

  let blockedInsecureRequests = 0;

  function asUrl(value) {
    if (value && typeof value === "object" && typeof value.url === "string") {
      value = value.url;
    }
    try {
      return new URL(String(value), document.baseURI);
    } catch (_) {
      return null;
    }
  }

  function isInsecureHttp(value) {
    const url = asUrl(value);
    return Boolean(url && url.protocol === "http:");
  }

  function rejectInsecureRequest() {
    blockedInsecureRequests += 1;
    return new TypeError("Insecure HTTP requests are blocked in ADAMARKET Android.");
  }

  if (typeof window.fetch === "function") {
    const nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      if (isInsecureHttp(input)) {
        return Promise.reject(rejectInsecureRequest());
      }
      return nativeFetch.call(this, input, init);
    };
  }

  if (window.XMLHttpRequest) {
    const nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...args) {
      if (isInsecureHttp(url)) {
        throw rejectInsecureRequest();
      }
      return nativeOpen.call(this, method, url, ...args);
    };
  }

  if (typeof navigator.sendBeacon === "function") {
    const nativeSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (isInsecureHttp(url)) {
        rejectInsecureRequest();
        return false;
      }
      return nativeSendBeacon(url, data);
    };
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (form instanceof HTMLFormElement && isInsecureHttp(form.action)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      rejectInsecureRequest();
    }
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!target) return;

    const url = asUrl(target.href);
    const allowed = url && ["https:", "mailto:", "tel:"].includes(url.protocol);
    if (!allowed) {
      event.preventDefault();
      event.stopImmediatePropagation();
      rejectInsecureRequest();
    }
  }, true);

  Object.defineProperty(window, "__ADAMARKET_PROD_HARDENING__", {
    configurable: false,
    enumerable: false,
    value: Object.freeze({
      version: "1.0.0",
      secureContext: Boolean(window.isSecureContext),
      isInsecureHttp,
      get blockedInsecureRequests() {
        return blockedInsecureRequests;
      }
    }),
    writable: false
  });
})();
