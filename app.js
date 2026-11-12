/* Träning – daglig träningschecklista.
   Allt sparas bara i den här telefonen (IndexedDB). Inget skickas någonstans. */
(function () {
  'use strict';

  const APP_VERSION = 3;
  const MAX_AHEAD = 7;        // kommande dagar som går att titta på
  const STREAK_MIN = 0.8;     // minst 80 % avbockat räknas i "dagar i rad"
  const OVERVIEW_DAYS = 14;

  /* ================= Programmet ================= */

  const slug = (s) => s.toLowerCase()
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const topReps = (reps) => { const m = String(reps).match(/(\d+)\s*$/); return m ? Number(m[1]) : null; };

  const GENERAL_HOW = 'Sluta setet 1–2 reps före max. Sänk vikten på 2–3 sekunder med hela rörelsen.';
  const REST = {
    T: { text: 'vila 2–3 min', secs: 150 },   // vilklocka 2 min 30 s
    L: { text: 'vila 1–2 min', secs: 90 }     // vilklocka 1 min 30 s
  };

  // Styrkeövning: namn, antal set, repstal, vila (T/L), "Så gör du", tillägg efter repstalet.
  function lift(name, sets, reps, rest, how, unit) {
    return { id: slug(name), key: slug(name), name, sets, reps, rest, unit: unit || '', how: how || GENERAL_HOW, top: topReps(reps), lift: true };
  }

  const POSTURE = [
    { id: 'andning', name: 'Andning i 90/90', amount: '2 omgångar × 5 andetag', sets: 2,
      how: 'Ligg på rygg med fötterna på en stol, höfter och knän i 90 grader. Tryck hälarna lätt nedåt så att svanken plattas mot golvet. Andas in genom näsan i 4 sekunder utan att revbenen lyfter. Andas ut genom munnen i 6–8 sekunder tills revbenen sjunker och magen spänns. Håll 2 sekunder.' },
    { id: 'dead-bug', name: 'Dead bug', amount: '3 × 6 per sida', sets: 3,
      how: 'Ligg på rygg med armarna rakt upp och höfter och knän i 90 grader. Pressa svanken mot golvet. Sträck motsatt arm och ben långsamt medan du andas ut, gå tillbaka och byt sida. Lyfter svanken gör du rörelsen kortare.' },
    { id: 'hoftbojarstretch', name: 'Höftböjarstretch på knä', amount: '2 × 45 sekunder per sida', sets: 2,
      how: 'Ena knät i golvet, andra foten framför. Spänn rumpan på det bakre benets sida och tippa bäckenet bakåt. Skjut höften lätt framåt utan att svanka. Det ska kännas på framsidan av höften.' },
    { id: 'glute-bridge', name: 'Glute bridge', amount: '2 × 12', sets: 2,
      how: 'Ligg på rygg med böjda knän och fötterna höftbrett. Dra ner revbenen, tippa bäckenet bakåt, lyft höften tills kroppen är rak från knä till axel, håll 2 sekunder och sänk kontrollerat.' }
  ];

  // Index = JavaScripts veckodag (0 = söndag).
  const PASSES = [
    { name: 'Vila', focus: '', strength: false, rows: [
      { id: 'vila', name: 'Vila från träning', amount: '', sets: 0, how: 'Vila från träning. En promenad går bra.' }
    ] },
    { name: 'Ben A', focus: 'Framsida lår i fokus', strength: true, rows: [
      lift('Hack squat', 4, '6–10', 'T', 'Fullt djup, sänk på 3 sekunder.'),
      lift('Rumänsk marklyft', 3, '8–10', 'T', 'Skjut höften bakåt med lätt böjda knän, stången nära benen, vänd när det sträcker i baksida lår. Revbenen ner.'),
      lift('Benspark', 3, '10–15', 'L', 'Håll 1 sekund i toppen. Sista setet till max.'),
      lift('Sittande lårcurl', 3, '10–15', 'L', 'Långsam väg tillbaka. Sista setet till max.'),
      lift('Stående vadpress', 4, '8–12', 'L', '2 sekunders paus i botten, upp så högt det går.'),
      lift('Ab wheel', 3, '6–10', 'L', 'Tippa bäckenet bakåt, håll revbenen nere, rulla bara så långt du klarar utan att svanka.')
    ] },
    { name: 'Överkropp A', focus: 'Rygg i fokus', strength: true, rows: [
      lift('Viktade chins', 4, '6–10', 'T', 'Häng på så mycket vikt att du hamnar på 6–10 reps. Full sträckning i botten.'),
      lift('Bröststödd rodd', 4, '8–12', 'T', 'Dra armbågarna bakåt och kläm ihop skulderbladen i 1 sekund.'),
      lift('Lutande hantelpress, 30 grader', 3, '8–12', 'T', 'Sänk djupt, armbågarna ungefär 45 grader från kroppen.'),
      lift('Enarms kabelrodd', 3, '10–12', 'L', 'Armbågen nära kroppen, dra mot höften.'),
      lift('Omvända flyes', 3, '12–15', 'L', 'Sista setet till max.'),
      lift('Sidolyft', 3, '12–20', 'L', 'Lyft till axelhöjd. Sista setet till max.'),
      lift('Hantelcurl', 2, '10–12', 'L', 'Sista setet till max.')
    ] },
    { name: 'Lugn kondition', focus: '', strength: false, rows: [
      { id: 'kondition', name: 'Rask promenad i uppförslut eller cykel', amount: '30–40 minuter', sets: 0, how: 'Du ska kunna prata i hela meningar. Inga vikter.' }
    ] },
    { name: 'Ben B', focus: 'Baksida lår och säte i fokus', strength: true, rows: [
      lift('Benpress', 4, '8–12', 'T', 'Djupt, utan att ländryggen lyfter från dynan.'),
      lift('Bulgarsk utfallsböj', 2, '8–12', 'T', 'Långt steg, överkroppen lätt framåtlutad.', 'per ben'),
      lift('Hip thrust', 3, '8–12', 'T', 'Revbenen ner, håll 1 sekund i toppen.'),
      lift('Liggande lårcurl', 3, '8–12', 'L', 'Sista setet till max.'),
      lift('Benspark', 3, '12–15', 'L', 'Sista setet till max.'),
      lift('Sittande vadpress', 4, '10–15', 'L', 'Paus i botten.'),
      lift('Hängande knälyft', 3, '8–12', 'L', 'Rulla upp bäckenet i toppen, gunga inte.')
    ] },
    { name: 'Överkropp B', focus: 'Bröst och axlar i fokus', strength: true, rows: [
      lift('Lutande press, skivstång eller maskin', 4, '6–10', 'T'),
      lift('Latsdrag', 3, '8–12', 'T', 'Full sträckning i toppen, dra armbågarna mot höfterna.'),
      lift('Sittande kabelrodd, brett grepp', 3, '10–12', 'T', 'Armbågarna utåt, dra mot nedre bröstet.'),
      lift('Sittande axelpress med ryggstöd', 3, '8–12', 'T', 'Revbenen ner, svanka inte.'),
      lift('Kabelflyes nerifrån och upp', 2, '12–15', 'L', 'Sista setet till max.'),
      lift('Sidolyft', 3, '12–20', 'L', 'Sista setet till max.'),
      lift('Face pulls', 3, '12–15', 'L', 'Dra mot ansiktet med armbågarna högt.'),
      lift('Triceps pushdown', 3, '10–15', 'L', 'Sista setet till max.')
    ] },
    { name: 'Intervaller, bål och vader', focus: '', strength: false, rows: [
      { id: 'intervaller', name: 'Intervaller på cykel eller roddmaskin', amount: '6 varv: 1 min hårt, 2 min lugnt', sets: 0,
        how: '5 minuter lugn uppvärmning, 6 varv med 1 minut hårt och 2 minuter lugnt, 3 minuter nedvarvning.' },
      { id: 'planka', name: 'Planka med bakåttippat bäcken', amount: '3 × 20–30 sekunder', sets: 3,
        how: 'Spänn rumpa och mage maximalt.' },
      lift('Pallof press', 3, '10', 'L', 'Stå i sidled mot kabeln, pressa rakt fram, låt inte kroppen vrida sig.', 'per sida'),
      lift('Vadpress', 3, '10–15', 'L', 'Paus i botten.')
    ] }
  ];
  // Styrkepassens första rad är uppvärmning i passets första övning.
  PASSES.forEach((p) => {
    if (!p.strength) return;
    const first = p.rows[0];
    p.rows.unshift({ id: 'uppvarmning', name: 'Uppvärmning', amount: '2–3 lättare set i ' + first.name, sets: 0,
      how: 'Två till tre lättare set i passets första övning: ' + first.name + '.' });
  });

  /* ================= Klockor: fasta tider ================= */
  // Varje fas: rubrik, undertext, längd i sekunder, ton, och vilket set som blir klart när fasen är slut.
  function ph(label, sub, dur, tone, set) { return { label, sub, dur, tone, set: set === undefined ? null : set }; }
  const CLOCKS = {
    breath: (() => {   // 4 s in, 7 s ut, 2 s håll, fem andetag, två omgångar, 30 s vila emellan
      const out = [];
      for (let r = 0; r < 2; r++) {
        if (r) out.push(ph('Vila', 'Omgång 2 börjar sedan', 30, 'rest'));
        for (let b = 1; b <= 5; b++) {
          const sub = 'Andetag ' + b + ' av 5 · omgång ' + (r + 1) + ' av 2';
          out.push(ph('Andas in', sub, 4, 'in'), ph('Andas ut', sub, 7, 'out'), ph('Håll', sub, 2, 'hold', b === 5 ? r : null));
        }
      }
      return out;
    })(),
    stretch: (() => {  // 45 s vänster, 45 s höger, två varv, 5 s för att byta sida
      const out = [];
      for (let v = 0; v < 2; v++) {
        const sub = 'Varv ' + (v + 1) + ' av 2';
        out.push(ph('Vänster sida', sub, 45, 'work'), ph('Byt sida', 'Höger sida sedan', 5, 'switch'), ph('Höger sida', sub, 45, 'work', v));
        if (v === 0) out.push(ph('Byt sida', 'Vänster sida sedan', 5, 'switch'));
      }
      return out;
    })(),
    plank: (() => {    // 3 × 30 s med 60 s vila
      const out = [];
      for (let i = 0; i < 3; i++) {
        out.push(ph('Planka', 'Set ' + (i + 1) + ' av 3', 30, 'work', i));
        if (i < 2) out.push(ph('Vila', 'Set ' + (i + 2) + ' sedan', 60, 'rest'));
      }
      return out;
    })(),
    interval: (() => { // 5 min uppvärmning, 6 × (1 min hårt, 2 min lugnt), 3 min nedvarvning
      const out = [ph('Uppvärmning', 'Lugnt tempo', 300, 'rest')];
      for (let v = 1; v <= 6; v++) out.push(ph('Hårt', 'Varv ' + v + ' av 6', 60, 'work'), ph('Lugnt', 'Varv ' + v + ' av 6', 120, 'rest'));
      out.push(ph('Nedvarvning', 'Lugnt tempo', 180, 'rest'));
      return out;
    })()
  };
  const CLOCK_ROWS = { 'andning': 'breath', 'hoftbojarstretch': 'stretch', 'planka': 'plank', 'intervaller': 'interval' };
  const totalSecs = (phases) => phases.reduce((acc, p) => acc + p.dur, 0);
  const fmt = (secs) => { const x = Math.max(0, Math.ceil(secs - 1e-6)); return Math.floor(x / 60) + ':' + (x % 60 < 10 ? '0' : '') + (x % 60); };

  /* ================= Datum ================= */

  const WEEKDAYS = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
  const WD_SHORT = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
  const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  const MON_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  const pad = (n) => (n < 10 ? '0' : '') + n;
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parse(s)) === s;
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const mondayOf = (s) => addDays(s, -((parse(s).getDay() + 6) % 7));
  const todayStr = () => ymd(new Date());
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function longDate(date) {
    const d = parse(date);
    let s = WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    if (d.getFullYear() !== parse(state.today).getFullYear()) s += ' ' + d.getFullYear();
    return cap(s);
  }
  function relative(date) {
    const n = daysBetween(date, state.today);
    if (n === 0) return 'Idag';
    if (n === 1) return 'Igår';
    if (n === -1) return 'Imorgon';
    return n > 0 ? n + ' dagar sedan' : 'Om ' + (-n) + ' dagar';
  }

  /* ================= Tillstånd ================= */

  const state = {
    today: todayStr(),
    view: null,
    days: {},          // 'ÅÅÅÅ-MM-DD' -> { c: {radId: true | [bool…]}, log: {}, t }
    start: null,       // måndagen i veckan då något kryssades för första gången
    db: null,
    persisted: null,
    reloadPending: false,
    clock: null,       // { kind, date, row, rest, start, applied } – går på klocktid
    wakeNote: ''
  };

  const passFor = (date) => PASSES[parse(date).getDay()];
  const isLocked = (date) => date > state.today;
  const maxDate = () => addDays(state.today, MAX_AHEAD);

  function weekNo(date) {
    if (!state.start) return 0;
    const d = daysBetween(state.start, mondayOf(date));
    return d < 0 ? 0 : Math.floor(d / 7) + 1;
  }
  function isLight(date) { const w = weekNo(date); return w > 0 && w % 7 === 0; }

  function setCount(row, date) {
    if (!row.sets) return 0;
    return (row.lift && passFor(date).strength && isLight(date)) ? Math.ceil(row.sets / 2) : row.sets;
  }
  function amountText(row, date) {
    if (!row.lift) return row.amount;
    return setCount(row, date) + ' × ' + row.reps + (row.unit ? ' ' + row.unit : '');
  }
  const allRows = (date) => POSTURE.concat(passFor(date).rows);

  function rowFrac(date, row) {
    const rec = state.days[date];
    const v = rec && rec.c[row.id];
    const n = setCount(row, date);
    if (!n) return v === true ? 1 : 0;
    if (!Array.isArray(v)) return 0;
    let k = 0;
    for (let i = 0; i < n; i++) if (v[i]) k++;
    return k / n;
  }
  function dayFrac(date) {
    const rows = allRows(date);
    let sum = 0;
    rows.forEach((r) => { sum += rowFrac(date, r); });
    return sum / rows.length;
  }
  function streak() {
    let d = state.today, n = 0;
    if (dayFrac(d) < STREAK_MIN - 1e-9) d = addDays(d, -1);
    while (dayFrac(d) >= STREAK_MIN - 1e-9) { n++; d = addDays(d, -1); }
    return n;
  }

  function ensureDay(date) {
    if (!state.days[date]) state.days[date] = { c: {}, log: {}, t: 0 };
    return state.days[date];
  }
  function findRow(date, id) { return allRows(date).find((r) => r.id === id) || null; }

  /* ---------- Logg: vikt och reps per set ---------- */
  const hasVal = (s) => !!s && (s.kg !== '' || s.reps !== '');
  const hasLog = (arr) => Array.isArray(arr) && arr.some(hasVal);
  const kgNum = (s) => parseFloat(String(s).replace(',', '.'));
  function logSets(date, row) {
    const rec = state.days[date];
    const arr = rec && rec.log[row.key];
    return Array.isArray(arr) ? arr : [];
  }
  // Senaste gången samma övning loggades före det här datumet (samma namn = samma övning i alla pass).
  function prevSession(key, date) {
    let best = null;
    Object.keys(state.days).forEach((d) => {
      if (d < date && (!best || d > best) && hasLog(state.days[d].log[key])) best = d;
    });
    return best ? { date: best, sets: state.days[best].log[key] } : null;
  }
  function sessionsOf(key) {
    return Object.keys(state.days).filter((d) => hasLog(state.days[d].log[key])).sort().reverse()
      .map((d) => ({ date: d, sets: state.days[d].log[key].filter(hasVal) }));
  }
  // Alla set har nått översta repstalet.
  function reachedTop(date, row) {
    const n = setCount(row, date);
    const sets = logSets(date, row);
    if (!row.top || !n || sets.length < n) return false;
    for (let i = 0; i < n; i++) {
      const r = parseInt(sets[i] && sets[i].reps, 10);
      if (!(r >= row.top)) return false;
    }
    return true;
  }
  const kgText = (kg) => String(kg).replace('.', ',');
  function setText(s, short) {
    if (!hasVal(s)) return '–';
    if (s.kg !== '' && s.reps !== '') return kgText(s.kg) + (short ? '' : ' kg') + ' × ' + s.reps;
    return s.kg !== '' ? kgText(s.kg) + ' kg' : s.reps + ' reps';
  }
  const cleanKg = (v) => {
    let x = String(v).replace(/\./g, ',').replace(/[^0-9,]/g, '');
    const k = x.indexOf(',');
    if (k >= 0) x = x.slice(0, k + 1) + x.slice(k + 1).replace(/,/g, '').slice(0, 2);
    return x.slice(0, 6);
  };
  const cleanReps = (v) => String(v).replace(/\D/g, '').slice(0, 3);
  function setLog(date, row, i, field, value) {
    const n = setCount(row, date);
    const rec = ensureDay(date);
    const arr = logSets(date, row).map((s) => ({ kg: s.kg, reps: s.reps }));
    while (arr.length < Math.max(n, i + 1)) arr.push({ kg: '', reps: '' });
    arr[i][field] = value;
    if (hasLog(arr)) rec.log[row.key] = arr; else delete rec.log[row.key];
    rec.t = Date.now();
    scheduleSave(date);
  }

  function toggleCheck(date, row) {
    const rec = ensureDay(date);
    if (rec.c[row.id] === true) delete rec.c[row.id]; else rec.c[row.id] = true;
    changed(date);
  }
  function setSet(date, row, i, on) {
    const n = setCount(row, date);
    const rec = ensureDay(date);
    const arr = Array.isArray(rec.c[row.id]) ? rec.c[row.id].slice(0, Math.max(n, rec.c[row.id].length)) : [];
    while (arr.length < n) arr.push(false);
    arr[i] = on;
    rec.c[row.id] = arr;
    changed(date);
  }
  function changed(date) {
    state.days[date].t = Date.now();
    if (!state.start) {
      state.start = mondayOf(state.today);
      putMeta('start', state.start);
      requestPersist();
    }
    saveDay(date);
  }

  /* ================= Lagring (IndexedDB) ================= */

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('webbläsaren saknar IndexedDB')); return; }
      const req = indexedDB.open('traning', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('days')) db.createObjectStore('days');
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('kunde inte öppna databasen'));
    });
  }
  function loadAll() {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(['days', 'meta'], 'readonly');
      const days = {}, meta = {};
      tx.objectStore('days').openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { days[c.key] = c.value; c.continue(); } };
      tx.objectStore('meta').openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { meta[c.key] = c.value; c.continue(); } };
      tx.oncomplete = () => resolve({ days, meta });
      tx.onerror = () => reject(tx.error);
    });
  }
  function write(store, ops) {
    if (!state.db) return Promise.reject(new Error('lagringen gick inte att öppna'));
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(store, 'readwrite');
      ops(tx);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('skrivningen avbröts'));
    });
  }
  function reportSave(p) {
    return p.then(() => { if (state.saveError) { state.saveError = null; renderAlert(); } },
      (e) => { console.error('Kunde inte spara:', e); state.saveError = 'Kunde inte spara i telefonen (' + errText(e) + '). Ändringen finns kvar tills appen stängs.'; renderAlert(); });
  }
  // Reservjournal: varje ändring skrivs först synkront till telefonens localStorage och tas bort
  // när IndexedDB har sparat den. Stängs appen innan databasen hunnit skriva förs ändringen in vid nästa start.
  const JOURNAL = 'traning-journal';
  const saveVer = {};
  function readJournal() {
    try { return JSON.parse(localStorage.getItem(JOURNAL) || '{}') || {}; } catch (e) {
      console.error('Reservjournalen gick inte att läsa:', e);
      return {};
    }
  }
  function journalSet(date, rec) {
    try {
      const j = readJournal();
      if (rec) j[date] = rec; else delete j[date];
      if (Object.keys(j).length) localStorage.setItem(JOURNAL, JSON.stringify(j)); else localStorage.removeItem(JOURNAL);
    } catch (e) {
      console.info('Reservjournalen kunde inte skrivas (databasen sparar ändå):', errText(e));
    }
  }
  function saveDay(date) {
    const rec = state.days[date];
    const ver = (saveVer[date] = (saveVer[date] || 0) + 1);
    journalSet(date, rec);
    return reportSave(write('days', (tx) => tx.objectStore('days').put(rec, date))
      .then(() => { if (saveVer[date] === ver) journalSet(date, null); }));
  }
  function putMeta(key, value) {
    return reportSave(write('meta', (tx) => tx.objectStore('meta').put(value, key)));
  }
  const errText = (e) => (e && (e.message || e.name)) || String(e);

  // Varje inmatning sparas direkt (så att inget går förlorat om appen stängs mitt i).
  // flushSaves väntar in skrivningar som pågår, t.ex. innan en ny version laddas.
  const inflight = new Set();
  function scheduleSave(date) {
    const p = saveDay(date);
    inflight.add(p);
    p.then(() => inflight.delete(p));
  }
  function flushSaves() { return Promise.all(Array.from(inflight)); }

  function requestPersist() {
    const st = navigator.storage;
    if (!st || !st.persist) { state.persisted = null; renderFoot(); return; }
    st.persisted()
      .then((p) => (p ? true : st.persist()))
      .then((p) => { state.persisted = p; renderFoot(); },
        (e) => { console.error('navigator.storage.persist misslyckades:', e); state.persisted = false; renderFoot(); });
  }

  // Rensar en dag från fil eller databas så att bara giltiga värden finns kvar.
  const cleanNum = (v, max) => String(v == null ? '' : v).replace(/[^0-9.,]/g, '').slice(0, max);
  function cleanDay(r) {
    if (!r || typeof r !== 'object') return null;
    const out = { c: {}, log: {}, t: Number.isFinite(+r.t) ? +r.t : 0 };
    if (r.c && typeof r.c === 'object') {
      Object.keys(r.c).forEach((k) => {
        if (!/^[a-z0-9-]{1,64}$/.test(k)) return;
        const v = r.c[k];
        if (v === true) out.c[k] = true;
        else if (Array.isArray(v)) out.c[k] = v.slice(0, 12).map(Boolean);
      });
    }
    if (r.log && typeof r.log === 'object') {
      Object.keys(r.log).forEach((k) => {
        if (!/^[a-z0-9-]{1,64}$/.test(k) || !Array.isArray(r.log[k])) return;
        out.log[k] = r.log[k].slice(0, 12).map((s) => ({
          kg: cleanNum(s && s.kg, 7),
          reps: cleanNum(s && s.reps, 3).replace(/[.,]/g, '')
        }));
      });
    }
    return out;
  }
  function earliestChecked(days) {
    const dates = Object.keys(days).filter((d) => {
      const c = days[d].c;
      return Object.keys(c).some((k) => c[k] === true || (Array.isArray(c[k]) && c[k].some(Boolean)));
    }).sort();
    return dates[0] || null;
  }

  /* ================= Visning ================= */

  const $ = (id) => document.getElementById(id);
  function h(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach((c) => { if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return node;
  }
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach((k) => node.setAttribute(k, attrs[k]));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function checkIcon() {
    const svg = s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    svg.appendChild(s('path', { d: 'M20 6 9 17l-5-5' }));
    return svg;
  }
  function ringSvg(cls, size, r, width, frac, label, sub) {
    const c = size / 2;
    const svg = s('svg', { class: cls, viewBox: '0 0 ' + size + ' ' + size, 'aria-hidden': 'true' });
    svg.appendChild(s('circle', { class: 'track', cx: c, cy: c, r: r, fill: 'none', 'stroke-width': width }));
    if (frac > 0) {
      const len = 2 * Math.PI * r;
      svg.appendChild(s('circle', { class: 'arc', cx: c, cy: c, r: r, fill: 'none', 'stroke-width': width, 'stroke-linecap': 'round',
        transform: 'rotate(-90 ' + c + ' ' + c + ')', 'stroke-dasharray': len.toFixed(2), 'stroke-dashoffset': (len * (1 - Math.min(1, frac))).toFixed(2) }));
    }
    svg.appendChild(s('text', { class: 'num', x: c, y: sub ? c + 4 : c + 4, 'text-anchor': 'middle' }, label));
    if (sub) svg.appendChild(s('text', { class: 'of', x: c, y: c + 22, 'text-anchor': 'middle' }, sub));
    return svg;
  }
  const pct = (f) => Math.round(f * 100);

  function renderBar() {
    $('date-main').textContent = longDate(state.view);
    $('date-sub').textContent = relative(state.view);
    $('next').disabled = state.view >= maxDate();
    $('to-today').disabled = state.view === state.today;
  }

  function heroCard(date) {
    const pass = passFor(date);
    const frac = dayFrac(date);
    const dial = ringSvg('dial', 96, 40, 9, frac, pct(frac) + ' %', 'avbockat');
    dial.setAttribute('id', 'dial');
    const card = h('section', { class: 'card hero', 'aria-labelledby': 'pass-name' }, [
      dial,
      h('div', null, [
        h('p', { class: 'eyebrow', text: pass.strength ? 'Styrkepass' : 'Dagens pass' }),
        h('h1', { id: 'pass-name', text: pass.name }),
        pass.focus ? h('p', { class: 'focus', text: pass.focus }) : null
      ])
    ]);
    if (isLight(date)) {
      card.appendChild(h('p', { class: 'notice', id: 'light-week', text: 'Lättvecka: hälften så många set i styrkepassen den här veckan. Hållningsrutinen är som vanligt.' }));
    }
    if (isLocked(date)) {
      card.appendChild(h('p', { class: 'notice locked', id: 'locked-note', text: 'Den här dagen har inte kommit än. Du kan titta, men inte kryssa i.' }));
    }
    return card;
  }

  function rowEl(date, row) {
    const n = setCount(row, date);
    const locked = isLocked(date);
    const rec = state.days[date];
    const v = rec && rec.c[row.id];
    const done = rowFrac(date, row) === 1;

    const text = h('div', { class: 'row-text' }, [
      h('span', { class: 'name', text: row.name }),
      h('span', { class: 'amount' }, [
        amountText(row, date) || '',
        row.rest ? h('span', { class: 'tag', text: row.rest + ' · ' + REST[row.rest].text }) : null
      ])
    ]);
    const main = h('div', { class: 'row-main' }, []);
    if (!n) {
      const btn = h('button', { class: 'check', type: 'button', role: 'checkbox', 'data-act': 'check',
        'aria-checked': String(v === true), 'aria-label': row.name, disabled: locked }, [checkIcon()]);
      main.appendChild(btn);
    }
    main.appendChild(text);

    const li = h('li', { class: 'row' + (done ? ' is-done' : ''), 'data-row': row.id }, [main]);
    if (n && row.lift && !locked) {
      li.appendChild(setLines(date, row, n, v));
    } else if (n) {
      const sets = h('div', { class: 'sets' }, []);
      for (let i = 0; i < n; i++) sets.appendChild(ringBtn(row, i, n, Array.isArray(v) && !!v[i], locked));
      li.appendChild(sets);
    }
    const actions = [];
    const kind = CLOCK_ROWS[row.id];
    if (kind) actions.push(h('button', { class: 'pill clock-btn', type: 'button', 'data-act': 'clock', disabled: locked }, ['Starta klocka · ' + fmt(totalSecs(CLOCKS[kind]))]));
    if (row.rest) actions.push(h('button', { class: 'pill clock-btn', type: 'button', 'data-act': 'rest', disabled: locked }, ['Vila ' + fmt(REST[row.rest].secs)]));
    if (actions.length) li.appendChild(h('div', { class: 'row-actions' }, actions));
    li.appendChild(h('details', { class: 'how' }, [h('summary', { text: 'Så gör du' }), h('p', { text: row.how })]));
    return li;
  }

  function ringBtn(row, i, n, on, locked) {
    return h('button', { class: 'ring', type: 'button', role: 'checkbox', 'data-act': 'set', 'data-i': String(i),
      'aria-checked': String(on), 'aria-label': row.name + ', set ' + (i + 1) + ' av ' + n, disabled: locked }, [String(i + 1)]);
  }
  // En rad per set: ring, kg, reps och förra gångens siffror bredvid.
  function setLines(date, row, n, v) {
    const sets = logSets(date, row);
    const prev = prevSession(row.key, date);
    const d = prev ? parse(prev.date) : null;
    const wrap = h('div', { class: 'setlines' }, [
      h('div', { class: 'setline head', 'aria-hidden': 'true' }, [
        h('span', { text: 'Set' }), h('span', { text: 'kg' }), h('span'), h('span', { text: 'reps' }),
        h('span', { class: 'prev', text: prev ? 'Förra (' + d.getDate() + ' ' + MON_SHORT[d.getMonth()] + ')' : 'Förra gången' })
      ])
    ]);
    for (let i = 0; i < n; i++) {
      const s = sets[i] || { kg: '', reps: '' };
      const p = prev ? prev.sets[i] : null;
      const kg = h('input', { class: 'kg', type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'next', maxlength: '6',
        'data-log': 'kg', 'data-i': String(i), placeholder: 'kg', 'aria-label': row.name + ', set ' + (i + 1) + ', vikt i kg' });
      const reps = h('input', { class: 'reps', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', enterkeyhint: 'next', maxlength: '3',
        'data-log': 'reps', 'data-i': String(i), placeholder: 'reps', 'aria-label': row.name + ', set ' + (i + 1) + ', reps' });
      kg.value = kgText(s.kg);
      reps.value = s.reps;
      wrap.appendChild(h('div', { class: 'setline' }, [
        ringBtn(row, i, n, Array.isArray(v) && !!v[i], false), kg, h('span', { class: 'times', 'aria-hidden': 'true', text: '×' }), reps,
        h('span', { class: 'prev', 'data-prev': String(i), 'aria-label': 'Förra gången set ' + (i + 1) + ': ' + setText(p, false) }, [setText(p, true)])
      ]));
    }
    wrap.appendChild(h('p', { class: 'raise', 'data-raise': '', hidden: !reachedTop(date, row) }, ['Höj vikten nästa pass']));
    return wrap;
  }

  function sectionCard(id, title, sub, rows, date, intro) {
    const done = rows.filter((r) => rowFrac(date, r) === 1).length;
    return h('section', { class: 'card', id: id, 'aria-labelledby': 'h-' + id }, [
      h('div', { class: 'card-head' }, [h('h2', { id: 'h-' + id, text: title }), h('span', { class: 'count', 'data-count': id, text: done + '/' + rows.length })]),
      sub ? h('p', { class: 'card-sub', text: sub }) : null,
      intro || null,
      h('ul', { class: 'rows' }, rows.map((r) => rowEl(date, r)))
    ]);
  }

  function strengthIntro() {
    return h('div', { class: 'intro', id: 'strength-intro' }, [
      h('p', { class: 'lead', text: 'I alla stående lyft: andas ut, dra ner revbenen, spänn rumpan lätt.' }),
      h('p', { class: 'more', text: 'Varje set slutar 1–2 reps före max, utom där det står ”sista setet till max”. Vikten sänks på 2–3 sekunder med hela rörelsen. Vila: T = 2–3 minuter, L = 1–2 minuter.' })
    ]);
  }

  function renderPage() {
    const date = state.view;
    const pass = passFor(date);
    const page = $('page');
    page.textContent = '';
    page.appendChild(heroCard(date));
    page.appendChild(sectionCard('posture', 'Hållningsrutin', 'Varje dag, cirka 8 minuter', POSTURE, date));
    page.appendChild(sectionCard('pass', 'Dagens pass', pass.name, pass.rows, date, pass.strength ? strengthIntro() : null));
    page.setAttribute('data-date', date);
  }

  // Uppdaterar en rad och summeringarna utan att rita om sidan.
  function refreshRow(li, date, row) {
    const rec = state.days[date];
    const v = rec && rec.c[row.id];
    li.classList.toggle('is-done', rowFrac(date, row) === 1);
    const chk = li.querySelector('[data-act="check"]');
    if (chk) chk.setAttribute('aria-checked', String(v === true));
    li.querySelectorAll('[data-act="set"]').forEach((b) => {
      b.setAttribute('aria-checked', String(Array.isArray(v) && !!v[+b.getAttribute('data-i')]));
    });
    refreshSummary(date);
  }
  function refreshSummary(date) {
    const old = $('dial');
    if (old) {
      const frac = dayFrac(date);
      const dial = ringSvg('dial', 96, 40, 9, frac, pct(frac) + ' %', 'avbockat');
      dial.setAttribute('id', 'dial');
      old.replaceWith(dial);
    }
    const counts = { posture: POSTURE, pass: passFor(date).rows };
    Object.keys(counts).forEach((k) => {
      const el = document.querySelector('[data-count="' + k + '"]');
      if (el) el.textContent = counts[k].filter((r) => rowFrac(date, r) === 1).length + '/' + counts[k].length;
    });
    renderOverview();
  }

  function renderOverview() {
    const hist = $('hist');
    hist.textContent = '';
    const first = addDays(state.today, -(OVERVIEW_DAYS - 1));
    for (let i = 0; i < 7; i++) hist.appendChild(h('span', { class: 'wd', text: WD_SHORT[parse(addDays(first, i)).getDay()] }));
    for (let i = 0; i < OVERVIEW_DAYS; i++) {
      const date = addDays(first, i);
      const d = parse(date);
      const frac = dayFrac(date);
      const label = WD_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MON_SHORT[d.getMonth()] + ', ' + passFor(date).name + ', ' +
        (frac > 0 ? pct(frac) + ' % avbockat' : 'inget avbockat');
      const b = h('button', { class: 'day' + (date === state.today ? ' is-today' : ''), type: 'button', 'data-date': date,
        'data-pct': String(pct(frac)), 'aria-label': label, 'aria-current': date === state.view ? 'date' : null }, [ringSvg('mini', 40, 16, 3.5, frac, String(d.getDate()))]);
      hist.appendChild(b);
    }
    const n = streak();
    const p = $('streak');
    p.textContent = '';
    p.appendChild(h('b', { id: 'streak-count', text: String(n) }));
    p.appendChild(document.createTextNode((n === 1 ? ' dag' : ' dagar') + ' i rad med minst 80 % avbockat'));
  }

  function renderAlert() {
    const msgs = [state.openError, state.saveError].filter(Boolean);
    $('alert').hidden = msgs.length === 0;
    $('alert').textContent = msgs.join(' ');
  }

  function renderFoot() {
    const parts = ['Version ' + APP_VERSION, 'Allt sparas bara i den här telefonen'];
    if (state.persisted === true) parts.push('Beständig lagring: på');
    else if (state.persisted === false) parts.push('Beständig lagring: inte beviljad');
    $('foot').textContent = parts.join(' · ');
  }

  function renderInstallHint() {
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    const el = $('install-hint');
    if (standalone) { el.hidden = true; return; }
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    el.textContent = ios
      ? 'Lägg appen på hemskärmen: tryck på Dela-knappen och välj ”Lägg till på hemskärmen”. Det du kryssar här i Safari följer inte med dit.'
      : 'Lägg appen på startskärmen: öppna webbläsarens meny (⋮) och välj ”Installera app” eller ”Lägg till på startskärmen”.';
    el.hidden = false;
  }

  function renderAll() {
    renderBar();
    renderPage();
    renderOverview();
    renderAlert();
    renderFoot();
  }

  /* ================= Loggvyn ================= */

  // Alla styrkeövningar i programmets ordning (måndag först); samma namn räknas som samma övning.
  function programOrder() {
    const out = [];
    const seen = {};
    [1, 2, 3, 4, 5, 6, 0].forEach((wd) => PASSES[wd].rows.forEach((r) => {
      if (r.lift && !seen[r.key]) { seen[r.key] = true; out.push({ key: r.key, name: r.name }); }
    }));
    return out;
  }
  const shortDay = (date) => { const d = parse(date); return d.getDate() + ' ' + MON_SHORT[d.getMonth()] + (d.getFullYear() !== parse(state.today).getFullYear() ? ' ' + d.getFullYear() : ''); };
  const setsLine = (sets) => sets.map((s) => setText(s, false)).join(' · ');

  function renderLogList() {
    $('log-title').textContent = 'Logg';
    const body = $('log-body');
    body.textContent = '';
    const items = programOrder().map((ex) => ({ ex, s: sessionsOf(ex.key) })).filter((x) => x.s.length);
    if (!items.length) {
      body.appendChild(h('p', { class: 'muted', id: 'log-empty', text: 'Inget loggat än. Fyll i vikt och reps vid övningarna på dagens sida.' }));
      return;
    }
    body.appendChild(h('ul', { class: 'log-list', id: 'log-list' }, items.map(({ ex, s }) =>
      h('li', null, [h('button', { class: 'log-item', type: 'button', 'data-key': ex.key }, [
        h('span', { class: 'name', text: ex.name }),
        h('span', { class: 'amount', text: s.length + (s.length === 1 ? ' gång' : ' gånger') + ' · senast ' + shortDay(s[0].date) })
      ])]))));
  }

  function renderLogDetail(key) {
    const ex = programOrder().find((x) => x.key === key);
    if (!ex) { renderLogList(); return; }
    $('log-title').textContent = ex.name;
    const body = $('log-body');
    body.textContent = '';
    const s = sessionsOf(key);
    if (!s.length) { body.appendChild(h('p', { class: 'muted', text: 'Inget loggat för den här övningen än.' })); return; }
    let best = null;
    s.slice().reverse().forEach((x) => x.sets.forEach((set) => {
      const kg = kgNum(set.kg);
      if (kg > 0 && (!best || kg > best.kg)) best = { kg, text: kgText(set.kg), date: x.date };
    }));
    const first = s[s.length - 1];
    const last = s[0];
    body.appendChild(h('section', { class: 'card log-summary', id: 'log-summary' }, [
      h('dl', null, [
        h('dt', { text: 'Tyngsta vikt hittills' }),
        h('dd', { id: 'log-best', text: best ? best.text + ' kg (' + shortDay(best.date) + ')' : 'Ingen vikt loggad' }),
        h('dt', { text: 'Första gången · ' + longDate(first.date) }),
        h('dd', { id: 'log-first', text: setsLine(first.sets) }),
        h('dt', { text: 'Senaste gången · ' + longDate(last.date) }),
        h('dd', { id: 'log-last', text: setsLine(last.sets) })
      ])
    ]));
    body.appendChild(h('h3', { class: 'log-sub', text: 'Alla gånger, nyast först' }));
    body.appendChild(h('ol', { class: 'log-sessions', id: 'log-sessions' }, s.map((x) =>
      h('li', { 'data-date': x.date }, [h('span', { class: 'log-date', text: longDate(x.date) }), h('span', { class: 'log-sets', text: setsLine(x.sets) })]))));
  }

  function showLog(key) {
    flushSaves();
    $('logview').hidden = false;
    document.body.classList.add('log-open');
    if (key) renderLogDetail(key); else renderLogList();
    $('logview').scrollTop = 0;
  }
  function hideLog() {
    $('logview').hidden = true;
    document.body.classList.remove('log-open');
  }
  function openLog(key) {
    history.pushState({ log: key || 'list' }, '');
    showLog(key);
  }
  function onPopState(e) {
    const st = e.state;
    if (st && st.log) showLog(st.log === 'list' ? null : st.log); else hideLog();
  }

  /* ================= Bläddra ================= */

  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let anim = null;   // pågående bladvändning

  function finishAnim() {
    if (!anim) return;
    const a = anim;
    anim = null;
    clearTimeout(a.timer);
    a.done();
  }
  function setPageStyle(transition, x, opacity) {
    const page = $('page');
    page.style.transition = transition;
    page.style.transform = x ? 'translateX(' + x + 'px)' : '';
    page.style.opacity = opacity === 1 ? '' : String(opacity);
  }
  function showDate(date) {
    state.view = date;
    renderBar();
    renderPage();
    renderOverview();
    window.scrollTo(0, 0);
  }
  // dir: +1 = nästa dag (bladet åker åt vänster), -1 = föregående.
  function goTo(date, dir) {
    if (!isDate(date) || date > maxDate()) return false;
    finishAnim();
    if (date === state.view) { window.scrollTo(0, 0); return true; }
    dir = dir || (date > state.view ? 1 : -1);
    if (reduceMotion()) { showDate(date); return true; }
    const w = $('clip').clientWidth || window.innerWidth;
    state.view = date;
    renderBar();          // datumraden byts direkt, sidan efter bladvändningen
    setPageStyle('transform 150ms ease-in, opacity 150ms ease-in', -dir * w, 0.2);
    const done = () => {
      showDate(date);
      setPageStyle('none', dir * w * 0.5, 0.2);
      void $('page').offsetWidth;
      setPageStyle('transform 200ms ease-out, opacity 200ms ease-out', 0, 1);
    };
    anim = { done, timer: setTimeout(finishAnim, 170) };
    return true;
  }
  const turn = (dir) => goTo(addDays(state.view, dir), dir);

  let swipe = null;
  function onTouchStart(e) {
    if (e.touches.length !== 1 || (e.target.closest && e.target.closest('[data-noswipe]'))) { swipe = null; return; }
    swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), mode: null, dx: 0 };
  }
  function onTouchMove(e) {
    if (!swipe || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - swipe.x;
    const dy = e.touches[0].clientY - swipe.y;
    if (!swipe.mode) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) { swipe.mode = 'h'; finishAnim(); }
      else if (Math.abs(dy) > 10) swipe.mode = 'v';
    }
    if (swipe.mode !== 'h') return;
    if (e.cancelable) e.preventDefault();
    let off = dx;
    if (dx < 0 && state.view >= maxDate()) off = dx / 4;   // gränsen en vecka fram: bara lite gummiband
    swipe.dx = dx;
    setPageStyle('none', off, 1 - Math.min(Math.abs(off) / 600, 0.5));
  }
  function onTouchEnd() {
    if (!swipe) return;
    const sw = swipe;
    swipe = null;
    if (sw.mode !== 'h') return;
    const w = $('clip').clientWidth || window.innerWidth;
    const fast = Math.abs(sw.dx) > 40 && Date.now() - sw.t < 300;
    const dir = sw.dx < 0 ? 1 : -1;
    const target = addDays(state.view, dir);
    if ((Math.abs(sw.dx) > w * 0.22 || fast) && target <= maxDate()) {
      goTo(target, dir);
    } else {
      setPageStyle('transform 180ms ease-out, opacity 180ms ease-out', 0, 1);
    }
  }
  function onTouchCancel() {
    if (swipe && swipe.mode === 'h') setPageStyle('transform 180ms ease-out, opacity 180ms ease-out', 0, 1);
    swipe = null;
  }

  /* ================= Säkerhetskopia ================= */

  function backupMsg(text, isError) {
    const el = $('backup-msg');
    el.textContent = text;
    el.classList.toggle('is-error', !!isError);
  }
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function exportBackup() {
    flushSaves();
    const data = {
      app: 'traning', format: 1, appVersion: APP_VERSION, exported: new Date().toISOString(),
      meta: { start: state.start },
      days: state.days
    };
    const name = 'traning-sakerhetskopia-' + state.today + '.json';
    const json = JSON.stringify(data);
    const file = new File([json], name, { type: 'application/json' });
    const download = () => {
      const url = URL.createObjectURL(file);
      const a = h('a', { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      backupMsg('Säkerhetskopian sparades som ' + name + ' (' + Object.keys(state.days).length + ' dagar). Den ligger bland hämtade filer.');
    };
    // På iPhone fungerar delningsmenyn ("Spara i Filer") bäst i en app på hemskärmen.
    if (isIOS() && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Träning – säkerhetskopia' }).then(
        () => backupMsg('Säkerhetskopian ' + name + ' är delad. Välj ”Spara i Filer” om du inte redan gjorde det.'),
        (e) => {
          if (e && e.name === 'AbortError') backupMsg('Ingen säkerhetskopia sparades (avbrutet).', true);
          else { console.error('Delning misslyckades:', e); download(); }
        });
    } else {
      download();
    }
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => backupMsg('Filen gick inte att läsa: ' + errText(reader.error), true);
    reader.onload = () => {
      let data;
      try { data = JSON.parse(String(reader.result)); } catch (e) {
        backupMsg('Filen är inte en säkerhetskopia från Träning (den gick inte att tolka).', true);
        return;
      }
      if (!data || data.app !== 'traning' || !data.days || typeof data.days !== 'object') {
        backupMsg('Filen är inte en säkerhetskopia från Träning.', true);
        return;
      }
      const days = {};
      Object.keys(data.days).forEach((k) => { if (isDate(k)) { const r = cleanDay(data.days[k]); if (r) days[k] = r; } });
      const n = Object.keys(days).length;
      const when = typeof data.exported === 'string' && isDate(data.exported.slice(0, 10)) ? longDate(data.exported.slice(0, 10)).toLowerCase() : 'okänt datum';
      if (!window.confirm('Läsa in säkerhetskopian från ' + when + ' med ' + n + ' dagar? Den ersätter allt som finns i appen nu.')) {
        backupMsg('Ingenting lästes in.');
        return;
      }
      const start = data.meta && isDate(data.meta.start) ? mondayOf(data.meta.start) : (earliestChecked(days) ? mondayOf(earliestChecked(days)) : null);
      write(['days', 'meta'], (tx) => {
        const ds = tx.objectStore('days');
        const ms = tx.objectStore('meta');
        ds.clear();
        ms.clear();
        Object.keys(days).forEach((k) => ds.put(days[k], k));
        if (start) ms.put(start, 'start');
      }).then(() => {
        try { localStorage.removeItem(JOURNAL); } catch (e) { console.info('Reservjournalen kunde inte rensas:', errText(e)); }
        if (state.clock) { clearInterval(clockTimer); clockTimer = null; state.clock = null; releaseAwake(); hideClockPanel(); }
        state.days = days;
        state.start = start;
        renderAll();
        backupMsg('Säkerhetskopian är inläst: ' + n + ' dagar.');
      }, (e) => {
        console.error('Inläsning misslyckades:', e);
        backupMsg('Säkerhetskopian kunde inte sparas i telefonen (' + errText(e) + '). Inget ändrades.', true);
      });
    };
    reader.readAsText(file);
  }

  /* ================= Klockan ================= */

  let clockTimer = null, doneTimer = null, actx = null, wake = null;

  function clockPhases(c) {
    if (c.kind === 'rest') return [ph('Vila', c.rest === 'T' ? 'T · 2 min 30 s' : 'L · 1 min 30 s', REST[c.rest].secs, 'rest')];
    return CLOCKS[c.kind];
  }
  // Var klockan står just nu, räknat på klocktid från starttiden (stämmer även om skärmen varit släckt).
  function clockPos(c, now) {
    const phases = clockPhases(c);
    const t = Math.max(0, (now - c.start) / 1000);
    let acc = 0;
    for (let i = 0; i < phases.length; i++) {
      if (t < acc + phases[i].dur) return { i, left: acc + phases[i].dur - t, t, total: totalSecs(phases), phases, done: false };
      acc += phases[i].dur;
    }
    return { i: phases.length, left: 0, t, total: acc, phases, done: true };
  }
  const validClock = (c) => !!c && typeof c === 'object' && isDate(c.date) && typeof c.row === 'string' && Number.isFinite(c.start) &&
    !!(CLOCKS[c.kind] || (c.kind === 'rest' && REST[c.rest])) && Number.isInteger(c.applied);

  function audioUnlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!actx) actx = new AC();
    if (actx.state !== 'running') actx.resume().catch((e) => console.info('Ljudet kunde inte startas:', errText(e)));
    const src = actx.createBufferSource();       // ett tyst ljud låser upp ljudet på iPhone
    src.buffer = actx.createBuffer(1, 1, 22050);
    src.connect(actx.destination);
    src.start(0);
  }
  const TONES = {
    in: [[880, 0.16]], out: [[523, 0.16]], hold: [[698, 0.16]], switch: [[784, 0.16]],
    work: [[988, 0.14], [988, 0.14]], rest: [[523, 0.28]], done: [[784, 0.14], [988, 0.14], [1319, 0.32]]
  };
  function feedback(kind) {
    if (navigator.vibrate) navigator.vibrate(kind === 'done' ? [200, 100, 200, 100, 400] : 120);
    if (!actx) return;
    if (actx.state !== 'running') actx.resume().catch((e) => console.info('Ljudet kunde inte startas:', errText(e)));
    let at = actx.currentTime + 0.02;
    (TONES[kind] || TONES.switch).forEach(([freq, dur]) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.6, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g);
      g.connect(actx.destination);
      o.start(at);
      o.stop(at + dur + 0.02);
      at += dur + 0.06;
    });
  }

  function keepAwake() {
    if (!state.clock) return;
    if (!('wakeLock' in navigator)) {
      state.wakeNote = 'Den här telefonen låter inte appen hålla skärmen vaken. Klockan räknar rätt ändå om skärmen släcks.';
      renderClockNote();
      return;
    }
    if (wake || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then((lock) => {
      if (!state.clock) { lock.release(); return; }
      wake = lock;
      lock.addEventListener('release', () => { if (wake === lock) wake = null; });
      state.wakeNote = '';
      renderClockNote();
    }, (e) => {
      console.info('Skärmen kunde inte hållas vaken:', errText(e));
      state.wakeNote = 'Skärmen kunde inte hållas vaken (' + errText(e) + '). Klockan räknar rätt ändå om skärmen släcks.';
      renderClockNote();
    });
  }
  function releaseAwake() {
    if (wake) {
      const lock = wake;
      wake = null;
      lock.release().catch((e) => console.info('Skärmlåset var redan släppt:', errText(e)));
    }
  }

  function startClock(kind, date, rowId, rest) {
    if (isLocked(date)) return;
    audioUnlock();
    clearTimeout(doneTimer);
    state.clock = { kind, date, row: rowId, rest: rest || null, start: Date.now(), applied: 0 };
    putMeta('clock', state.clock);
    feedback(clockPhases(state.clock)[0].tone);
    keepAwake();
    runClock();
  }
  function runClock() {
    clearInterval(clockTimer);
    clockTimer = setInterval(tickClock, 200);
    tickClock();
  }
  function tickClock() {
    const c = state.clock;
    if (!c) return;
    const pos = clockPos(c, Date.now());
    if (pos.i > c.applied) {
      for (let k = c.applied; k < pos.i && k < pos.phases.length; k++) {
        if (pos.phases[k].set !== null) markFromClock(c, pos.phases[k].set);
      }
      c.applied = pos.i;
      if (pos.done) { finishClock(); return; }
      putMeta('clock', c);
      feedback(pos.phases[pos.i].tone);   // en ton även om flera faser gått medan skärmen var släckt
    }
    renderClock(pos);
  }
  // Kryssar i ett set (eller bocken) från klockan och uppdaterar raden om den syns.
  function markFromClock(c, setIndex) {
    const row = findRow(c.date, c.row);
    if (!row) return;
    const n = setCount(row, c.date);
    const rec = state.days[c.date];
    const v = rec && rec.c[row.id];
    if (n) {
      if (setIndex >= n) return;
      if (!(Array.isArray(v) && v[setIndex])) setSet(c.date, row, setIndex, true);
    } else if (v !== true) {
      toggleCheck(c.date, row);
    }
    const li = $('page').getAttribute('data-date') === c.date ? document.querySelector('#page [data-row="' + row.id + '"]') : null;
    if (li) refreshRow(li, c.date, row); else renderOverview();
  }
  function finishClock() {
    const c = state.clock;
    const row = findRow(c.date, c.row);
    if (c.kind !== 'rest' && row) {          // klockan gick klart: raden kryssas i
      const n = setCount(row, c.date);
      if (n) for (let i = 0; i < n; i++) markFromClock(c, i);
      else markFromClock(c, 0);
    }
    stopClock();
    feedback('done');
    const name = row ? row.name : '';
    showClockPanel(c.kind === 'rest' ? 'Vila · ' + name : name, 'Klart', '0:00',
      c.kind === 'rest' ? 'Vilan är slut.' : 'Raden är ikryssad.', 1);
    $('clock-stop').textContent = 'Stäng';
    doneTimer = setTimeout(hideClockPanel, 5000);
  }
  function stopClock() {
    clearInterval(clockTimer);
    clockTimer = null;
    state.clock = null;
    state.wakeNote = '';
    reportSave(write('meta', (tx) => tx.objectStore('meta').delete('clock')));
    releaseAwake();
    setTimeout(tryReload, 0);
  }
  function hideClockPanel() {
    clearTimeout(doneTimer);
    $('clock').hidden = true;
    document.body.classList.remove('has-clock');
  }
  function showClockPanel(title, phase, time, sub, frac) {
    $('clock-title').textContent = title;
    if ($('clock-phase').textContent !== phase) $('clock-phase').textContent = phase;
    $('clock-time').textContent = time;
    $('clock-sub').textContent = sub;
    $('clock-fill').style.width = (Math.min(1, Math.max(0, frac)) * 100).toFixed(1) + '%';
    $('clock-stop').textContent = 'Stoppa';
    $('clock').hidden = false;
    document.body.classList.add('has-clock');
    renderClockNote();
  }
  function renderClock(pos) {
    const c = state.clock;
    const row = findRow(c.date, c.row);
    const name = row ? row.name : '';
    const p = pos.phases[pos.i];
    showClockPanel(c.kind === 'rest' ? 'Vila · ' + name : name, p.label, fmt(pos.left), p.sub, pos.t / pos.total);
  }
  function renderClockNote() {
    const note = $('clock-note');
    note.textContent = state.clock ? state.wakeNote : '';
    note.hidden = !note.textContent;
  }
  function onClockStop() {
    if (state.clock) stopClock();
    hideClockPanel();
  }

  /* ================= Ny version ================= */

  function isTyping() {
    const a = document.activeElement;
    return !!a && a.tagName === 'INPUT' && a.type !== 'file';
  }
  function tryReload() {
    if (!state.reloadPending || isTyping() || state.clock) return;
    state.reloadPending = false;
    flushSaves().then(() => window.location.reload());
  }
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) { hadController = true; return; }
      state.reloadPending = true;   // ny version har tagit över: ladda om när inget pågår
      tryReload();
    });
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      const check = () => reg.update().catch((e) => console.info('Kunde inte leta efter ny version just nu:', errText(e)));
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    }, (e) => {
      console.error('Service worker kunde inte registreras:', e);
      state.openError = 'Appen kunde inte förberedas för att fungera utan internet (' + errText(e) + ').';
      renderAlert();
    });
  }

  /* ================= Händelser ================= */

  function onPageClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const li = btn.closest('[data-row]');
    const date = $('page').getAttribute('data-date');   // sidan som visas (kan ligga efter under bladvändning)
    if (!li || !date || isLocked(date)) return;
    const row = findRow(date, li.getAttribute('data-row'));
    if (!row) return;
    const act = btn.getAttribute('data-act');
    if (act === 'clock') { startClock(CLOCK_ROWS[row.id], date, row.id, null); return; }
    if (act === 'rest') { startClock('rest', date, row.id, row.rest); return; }
    if (act === 'check') toggleCheck(date, row);
    else if (act === 'set') setSet(date, row, +btn.getAttribute('data-i'), btn.getAttribute('aria-checked') !== 'true');
    else return;
    refreshRow(li, date, row);
  }

  function onLogInput(e) {
    const inp = e.target;
    if (!inp.matches || !inp.matches('input[data-log]')) return;
    const li = inp.closest('[data-row]');
    const date = $('page').getAttribute('data-date');
    if (!li || !date || isLocked(date)) return;
    const row = findRow(date, li.getAttribute('data-row'));
    if (!row) return;
    const field = inp.getAttribute('data-log');
    const clean = field === 'kg' ? cleanKg(inp.value) : cleanReps(inp.value);
    if (clean !== inp.value) inp.value = clean;
    setLog(date, row, +inp.getAttribute('data-i'), field, clean);
    const raise = li.querySelector('[data-raise]');
    if (raise) raise.hidden = !reachedTop(date, row);
  }

  function checkToday() {
    const now = todayStr();
    if (now === state.today) return;
    const wasToday = state.view === state.today;
    state.today = now;
    if (wasToday || state.view > maxDate()) state.view = now;
    renderAll();
  }

  function bindEvents() {
    $('prev').addEventListener('click', () => turn(-1));
    $('next').addEventListener('click', () => turn(1));
    $('to-today').addEventListener('click', () => goTo(state.today));
    $('page').addEventListener('click', onPageClick);
    $('page').addEventListener('input', onLogInput);
    $('open-log').addEventListener('click', () => openLog(null));
    $('log-back').addEventListener('click', () => history.back());
    $('log-body').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-key]');
      if (b) openLog(b.getAttribute('data-key'));
    });
    window.addEventListener('popstate', onPopState);
    window.addEventListener('pagehide', flushSaves);
    $('hist').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-date]');
      if (b) goTo(b.getAttribute('data-date'));
    });
    $('export').addEventListener('click', exportBackup);
    $('import-file').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      importBackup(f);
      e.target.value = '';
    });
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushSaves();
      if (document.visibilityState === 'visible') {
        checkToday();
        if (state.clock) { tickClock(); keepAwake(); }
        tryReload();
      }
    });
    $('clock-stop').addEventListener('click', onClockStop);
    // Efter omstart med en klocka som går: ljudet låses upp vid första trycket.
    document.addEventListener('click', () => { if (state.clock && (!actx || actx.state !== 'running')) audioUnlock(); }, true);
    document.addEventListener('focusout', (e) => {
      if (e.target.matches && e.target.matches('input[data-log]')) flushSaves();
      setTimeout(tryReload, 0);
    });
    window.addEventListener('focus', checkToday);
    setInterval(checkToday, 30000);
  }

  async function start() {
    state.view = state.today;
    bindEvents();
    renderInstallHint();
    try {
      state.db = await openDB();
      const { days, meta } = await loadAll();
      Object.keys(days).forEach((k) => { if (isDate(k)) { const r = cleanDay(days[k]); if (r) state.days[k] = r; } });
      const journal = readJournal();     // ändringar som inte hann sparas i databasen förra gången
      Object.keys(journal).forEach((k) => {
        const r = isDate(k) ? cleanDay(journal[k]) : null;
        if (r && (!state.days[k] || r.t >= state.days[k].t)) { state.days[k] = r; saveDay(k); } else journalSet(k, null);
      });
      if (validClock(meta.clock)) state.clock = meta.clock;
      if (isDate(meta.start)) state.start = meta.start;
      else {
        const first = earliestChecked(state.days);
        if (first) { state.start = mondayOf(first); putMeta('start', state.start); }
      }
    } catch (e) {
      console.error('Kunde inte öppna lagringen:', e);
      state.db = null;
      state.openError = 'Lagringen i telefonen gick inte att öppna (' + errText(e) + '). Det du kryssar nu sparas inte.';
    }
    renderAll();
    if (history.state && history.state.log) showLog(history.state.log === 'list' ? null : history.state.log);
    if (state.clock) { keepAwake(); runClock(); }
    requestPersist();
    registerSW();
  }

  start();
})();
