// Shared by index.html (guests) and host.html (organisers).
(function () {
  const CFG = window.TCN_CONFIG;
  const API = "https://abacus.jasoncameron.dev";
  const NS = CFG.counterNamespace;

  async function request(path, options) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(`${API}/${path}`, { ...options, signal: ctrl.signal, cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error("counter responded " + res.status), { status: res.status });
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  function numberIn(body) {
    if (!Number.isInteger(body.value) || body.value < 0) throw new Error("counter sent a bad value");
    return body.value;
  }

  window.TCN = {
    config: CFG,
  };
})();
