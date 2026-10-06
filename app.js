// Shared by index.html (guests) and host.html (organisers).
//
// Everything the pages share lives in two values on a free counter service:
//
//   state        session * 100 + groups. `groups` is how many groups the host
//                has announced (0 = not yet). `session` goes up by one each
//                time the host starts over. Only the host page can write it.
//   checkin-<s>  how many people have signed in during session s. Signing in
//                adds one and hands that person the new total as their number.
//
// A guest's group is worked out from their number and the announced group
// count, so the host can pick the count after seeing who turned up, and
// anyone who signs in later lands in a group straight away.
(function () {
  const CFG = window.TCN_CONFIG;
  const API = "https://abacus.jasoncameron.dev";
  const NS = CFG.counterNamespace;

  const MIN_GROUPS = 2;
  const MAX_GROUPS = 40;

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

  async function read(key) {
    try {
      return numberIn(await request(`get/${NS}/${key}`));
    } catch (err) {
      // A value nobody has written yet simply doesn't exist.
      if (err.status === 404) return 0;
      throw err;
    }
  }

  const decode = (value) => ({ session: Math.floor(value / 100), groups: value % 100 });
  const encode = (session, groups) => session * 100 + groups;

  const getState = (patience) => withRetry(() => read("state"), patience).then(decode);
  // Patient enough to sit out a couple of walls in a doorway rush.
  const takeNumber = (session) =>
    withRetry(() => request(`hit/${NS}/checkin-${session}`).then(numberIn), 20000);

  // Calls onValue(n) with a value's current number on connecting, and again
  // the moment it changes. onHealth(true/false) reports whether the line is
  // up. Listens only while the page is on screen: a pocketed phone drops the
  // line and catches up when it's looked at again. Returns a function that
  // stops watching.
  function watch(key, onValue, onHealth = () => {}) {
    let source = null;
    let timer = null;
    let failures = 0;
    let run = 0; // goes up whenever the line is dropped, so stale work can tell

    function stop() {
      run++;
      clearTimeout(timer);
      if (source) source.close();
      source = null;
    }

    function after(ms, next) {
      clearTimeout(timer);
      timer = setTimeout(next, ms);
    }

    function listen() {
      stop();
      if (document.hidden) return;
      const mine = run;
      let heard = false;
      source = new EventSource(`${API}/stream/${NS}/${key}`);

      source.onmessage = (event) => {
        let value;
        try {
          value = JSON.parse(event.data).value;
        } catch {
          return;
        }
        if (!Number.isInteger(value) || value < 0) return;
        heard = true;
        failures = 0;
        onHealth(true);
        onValue(value);
        // Nothing for a few minutes may mean the line died quietly; redial.
        after(180000 + Math.random() * 60000, listen);
      };

      // Turned away or cut off. Redial here, spaced out, rather than letting
      // every phone retry on the browser's fixed three-second beat.
      source.onerror = () => {
        failures++;
        onHealth(false);
        stop();
        after(Math.min(8000, 2000 * 1.6 ** failures) + Math.random() * 2000, listen);
      };

      // A stream says nothing until its value exists, and some networks hold
      // streams back altogether. If this one stays quiet, ask outright (and
      // rarely, see the note on polling above), leaving the line open in case
      // it does come through.
      const ask = async () => {
        let value = null;
        try {
          value = await withRetry(() => read(key), 3000);
        } catch {
          // Ask again next time round.
        }
        if (mine !== run || heard) return;
        if (value !== null) {
          onHealth(true);
          onValue(value);
        }
        after(30000 + Math.random() * 15000, ask);
      };
      after(6000, ask);
    }

    document.addEventListener("visibilitychange", listen);
    listen();

    return () => {
      document.removeEventListener("visibilitychange", listen);
      stop();
    };
  }

  const watchState = (onState, onHealth) => watch("state", (value) => onState(decode(value)), onHealth);
  const watchCount = (session, onCount, onHealth) => watch("checkin-" + session, onCount, onHealth);

  function clampGroups(value) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return null;
    return Math.min(MAX_GROUPS, Math.max(MIN_GROUPS, n));
  }

  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Which group the nth person to sign in belongs to. People are dealt out in
  // rounds: each round hands every group exactly one person, in a freshly
  // shuffled order. So who lands where is unpredictable, but group sizes
  // never differ by more than one, however many people turn up.
  function groupFor(n, groups, session) {
    const round = Math.floor((n - 1) / groups);
    const seat = (n - 1) % groups;
    const rand = mulberry32(Math.imul(session + 1, 2654435761) ^ Math.imul(round + 1, 40503) ^ groups);
    const order = Array.from({ length: groups }, (_, k) => k + 1);
    for (let k = groups - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [order[k], order[j]] = [order[j], order[k]];
    }
    return order[seat];
  }

  window.TCN = {
    config: CFG,
    MIN_GROUPS,
    MAX_GROUPS,
    getState,
    watchState,
    watchCount,
    takeNumber,
    clampGroups,
    groupFor,
  };
})();
