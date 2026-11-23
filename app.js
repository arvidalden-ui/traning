/* Träning – markera tränade muskelgrupper och se uppskattad återhämtning. */
(function () {
  'use strict';

  const APP_VERSION = 11;
  const RECOVERY_DAYS = 3;
  const JOURNAL = 'traning-journal';
  const groups = [
    ['brost', 'Bröst', ['lutande-hantelpress-30-grader', 'lutande-press-skivstang-eller-maskin', 'kabelflyes-nerifran-och-upp']],
    ['rygg', 'Rygg', ['viktade-chins', 'broststodd-rodd', 'enarms-kabelrodd', 'latsdrag', 'sittande-kabelrodd-brett-grepp']],
    ['axlar', 'Axlar', ['sittande-axelpress-med-ryggstod', 'sidolyft', 'omvanda-flyes', 'face-pulls',
      'lutande-hantelpress-30-grader', 'lutande-press-skivstang-eller-maskin']],
    ['armar', 'Armar', ['hantelcurl', 'triceps-pushdown']],
    ['ben', 'Ben', ['hack-squat', 'rumansk-marklyft', 'benspark', 'sittande-larcurl', 'staende-vadpress',
      'benpress', 'bulgarsk-utfallsboj', 'hip-thrust', 'liggande-larcurl', 'sittande-vadpress', 'vadpress']],
    ['bal', 'Bål', ['ab-wheel', 'hangande-knalyft', 'planka', 'pallof-press']]
  ].map(([id, name, legacy]) => ({ key: 'muskel-' + id, name, legacy }));

  const $ = (id) => document.getElementById(id);
  const dateFormat = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateKey = (date = new Date()) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0')).join('-');
  const parseDate = (key) => new Date(key + 'T12:00:00');
  const validDate = (key) => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKey(parseDate(key)) === key;
  const dateDistance = (from, to) => (Date.parse(to) - Date.parse(from)) / 86400000;
  const emptyDay = () => ({ c: {}, log: {}, t: 0 });

  let db;
  let days = {};
  let start = null;
  let queue = Promise.resolve();
  let restoring = false;

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('traning', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('days');
        request.result.createObjectStore('meta');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transact(stores, mode, run) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error('Transaktionen avbröts'));
      run(tx);
    });
  }

  async function readDays() {
    let keys, values, first;
    await transact(['days', 'meta'], 'readonly', (tx) => {
      keys = tx.objectStore('days').getAllKeys();
      values = tx.objectStore('days').getAll();
      first = tx.objectStore('meta').get('start');
    });
    days = Object.fromEntries(keys.result.map((key, index) => [key, values.result[index]]).filter(([key]) => validDate(key)));
    start = first.result ?? null;
  }

  function cleanDay(record) {
    if (!record || typeof record !== 'object') return null;
    const day = emptyDay();
    day.t = Number.isFinite(+record.t) ? +record.t : 0;
    const validKey = (key) => /^[a-z0-9-]{1,64}$/.test(key);
    for (const [key, value] of Object.entries(record.c ?? {})) {
      if (!validKey(key)) continue;
      if (value === true) day.c[key] = true;
      else if (Array.isArray(value)) day.c[key] = value.slice(0, 12).map(Boolean);
    }
    const cleanNum = (value, max) => String(value ?? '').replace(/[^0-9.,]/g, '').slice(0, max);
    for (const [key, sets] of Object.entries(record.log ?? {})) {
      if (!validKey(key) || !Array.isArray(sets)) continue;
      day.log[key] = sets.slice(0, 12).map((set) => set?.min !== undefined
        ? { min: cleanNum(set.min, 3).replace(/[.,]/g, '') }
        : { kg: cleanNum(set?.kg, 7), reps: cleanNum(set?.reps, 3).replace(/[.,]/g, '') });
    }
    return day;
  }

  // Version 10 kunde ha en pågående skrivning i reservjournalen vid uppdateringen.
  async function replayJournal() {
    let raw, pending;
    try {
      raw = localStorage.getItem(JOURNAL);
      if (!raw) return;
      pending = JSON.parse(raw);
    } catch (error) {
      console.warn('Reservjournalen kunde inte läsas.', error);
      return;
    }
    await transact(['days'], 'readwrite', (tx) => {
      const store = tx.objectStore('days');
      for (const [date, entry] of Object.entries(pending ?? {})) {
        const record = validDate(date) && cleanDay(entry);
        if (!record) continue;
        const current = store.get(date);
        current.onsuccess = () => {
          if (!current.result || record.t >= current.result.t) store.put(record, date);
        };
      }
    });
    try {
      if (localStorage.getItem(JOURNAL) === raw) localStorage.removeItem(JOURNAL);
    } catch (error) {
      console.warn('Reservjournalen kunde inte rensas.', error);
    }
  }

  function runSerial(action) {
    const done = queue.then(action);
    queue = done.catch(() => {});
    return done;
  }

  async function mark(key, date, trained) {
    await transact(['days'], 'readwrite', (tx) => {
      const store = tx.objectStore('days');
      const request = store.get(date);
      request.onsuccess = () => {
        const day = request.result || emptyDay();
        if (trained) day.c[key] = true;
        else delete day.c[key];
        day.t = Date.now();
        store.put(day, date);
      };
    });
    await readDays();
  }

  function hasLegacySet(day, key) {
    const check = day.c?.[key];
    return check === true || (Array.isArray(check) && check.some(Boolean)) ||
      day.log?.[key]?.some?.((set) => [set?.kg, set?.reps].some((value) => value != null && value !== ''));
  }

  function lastTrained(group, dates) {
    return dates.find((date) => {
      const day = days[date];
      return day.c?.[group.key] === true || group.legacy.some((key) => hasLegacySet(day, key));
    });
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  const buttons = new Map();
  const pending = new Set();
  function render() {
    const today = dateKey();
    $('date').textContent = dateFormat.format(parseDate(today));
    const dates = Object.keys(days).filter((date) => date <= today).sort().reverse();
    $('recovery').replaceChildren(...groups.map((group) => {
      const button = buttons.get(group.key);
      button.setAttribute('aria-pressed', String(days[today]?.c?.[group.key] === true));
      button.disabled = !db || restoring || pending.has(group.key);

      const row = document.createElement('li');
      const label = document.createElement('div');
      label.append(element('strong', group.name));
      const last = lastTrained(group, dates);
      if (last) label.append(element('span', last === today ? 'Senast idag' : shortDate.format(parseDate(last)), 'muted'));
      const ready = last && dateDistance(last, today) >= RECOVERY_DAYS;
      const status = last ? (ready ? 'Troligen återhämtad' : 'Återhämtar sig') : 'Ingen träning registrerad';
      row.append(label, element('span', status, 'status ' + (last ? (ready ? 'status-ready' : 'status-rest') : 'muted')));
      return row;
    }));
    $('export').disabled = !db || restoring || pending.size > 0;
    $('import').disabled = !db || restoring;
  }

  function showError(message) {
    $('error').hidden = !message;
    $('error').textContent = message;
  }

  async function toggleGroup(group, button) {
    const date = dateKey();
    const trained = days[date]?.c?.[group.key] !== true;
    pending.add(group.key);
    $('export').disabled = true;
    button.disabled = true;
    try {
      await runSerial(() => mark(group.key, date, trained));
      $('feedback').textContent = group.name + (trained ? ' markerad som tränad.' : ' avmarkerad.');
      showError('');
    } catch (error) {
      console.error(error);
      showError('Ändringen kunde inte sparas. Försök igen.');
    } finally {
      pending.delete(group.key);
      render();
    }
  }

  async function exportBackup() {
    const file = new File([JSON.stringify({
      app: 'traning', format: 1, appVersion: APP_VERSION, exported: new Date().toISOString(),
      meta: { start }, days
    })], 'traning-sakerhetskopia-' + dateKey() + '.json', { type: 'application/json' });
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Träning – säkerhetskopia' });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    $('backup-status').textContent = 'Säkerhetskopian har sparats bland hämtade filer.';
  }

  async function restoreBackup(file) {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup?.app !== 'traning' || !backup.days || Array.isArray(backup.days) || typeof backup.days !== 'object') {
        throw new Error('Fel filformat.');
      }
      const records = Object.entries(backup.days).filter(([date]) => validDate(date))
        .map(([date, day]) => [date, cleanDay(day)]).filter(([, day]) => day);
      if (!window.confirm('Läsa in säkerhetskopian med ' + records.length + ' dagar? Den ersätter appens nuvarande logg.')) return;
      restoring = true;
      render();
      await runSerial(async () => {
        await transact(['days', 'meta'], 'readwrite', (tx) => {
          const log = tx.objectStore('days');
          const meta = tx.objectStore('meta');
          log.clear();
          meta.clear();
          for (const [date, day] of records) log.put(day, date);
          if (validDate(backup.meta?.start)) meta.put(backup.meta.start, 'start');
        });
        await readDays();
      });
      $('backup-status').textContent = 'Säkerhetskopian är inläst.';
    } catch (error) {
      console.error(error);
      $('backup-status').textContent = 'Säkerhetskopian kunde inte läsas in.';
    } finally {
      restoring = false;
      render();
    }
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    let controlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (controlled) queue.then(() => window.location.reload());
      controlled = true;
    });
    navigator.serviceWorker.register('./sw.js').then((registration) => {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) registration.update().catch(() => {});
      });
    }).catch((error) => console.warn('Offlineläget kunde inte förberedas.', error));
  }

  async function startApp() {
    for (const group of groups) {
      const button = element('button', group.name);
      button.type = 'button';
      button.addEventListener('click', () => toggleGroup(group, button));
      buttons.set(group.key, button);
      $('groups').append(button);
    }
    $('version').textContent = 'Version ' + APP_VERSION;
    $('export').addEventListener('click', exportBackup);
    $('import').addEventListener('change', (event) => {
      restoreBackup(event.target.files[0]);
      event.target.value = '';
    });
    render();
    try {
      db = await openDB();
      await replayJournal();
      await readDays();
      navigator.storage?.persist?.().catch(() => {});
    } catch (error) {
      console.error(error);
      db = null;
      showError('Träningsloggen kunde inte öppnas. Stäng appen och försök igen.');
    }
    render();
    setInterval(render, 60000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && db) {
        runSerial(readDays).then(render).catch((error) => console.error(error));
      }
    });
    registerSW();
  }

  startApp();
})();
