// Shared by index.html (guests) and host.html (organisers).
(function () {
  const CFG = window.TCN_CONFIG;
  const API = "https://abacus.jasoncameron.dev";
  const NS = CFG.counterNamespace;

  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

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

  // The service gives each network (so, everyone on the same wifi) 30
  // requests, and only refills them after ten seconds without accepting one.
  // Two consequences shape everything below:
  //   - never poll. Anything asking on a timer runs the allowance dry and
  //     then hits a ten-second wall, again and again. Pages hold a live
  //     stream instead, which costs one request however long it stays open.
  //   - any request can land on that wall (429), so each one keeps trying
  //     for up to `patience` ms. The jitter stops a crowd of phones from all
  //     retrying on the same beat.
  // A dropped connection gets one quick retry, so a real outage is given up
  // on fast. Any other refusal is final.
  async function withRetry(attemptOnce, patience) {
    const started = Date.now();
    for (let attempt = 1; ; attempt++) {
      try {
        return await attemptOnce();
      } catch (err) {
        const limited = err.status === 429;
        const refused = err.status && !limited && err.status < 500;
        const giveUp = refused || (limited ? Date.now() - started > patience : attempt >= 2);
        if (giveUp) throw err;
        await sleep((limited ? 2000 : 800) + Math.random() * 1500);
      }
    }
  }

  window.TCN = {
    config: CFG,
  };
})();
