// Tests du cœur métier (Node ≥ 20) : node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../index.html'), 'utf8');
const code = src.slice(src.indexOf('// @@CORE-START'), src.indexOf('// @@CORE-END'));
const C = new Function(code + '\nreturn Core;')();
const sp = s => s.replace(/[  ]/g, ' ');

test('formats français', () => {
  assert.equal(sp(C.fmtMoney(111600)), '1 116,00 €');
  assert.equal(sp(C.fmtMoney(1675)), '16,75 €');
  assert.equal(sp(C.fmtMoneyShort(419200)), '4 192 €');
  assert.equal(sp(C.fmtSigned(-10382)), '−103,82 €');
  assert.equal(C.fmtDay('2027-08-03'), 'mardi 3 août');
  assert.equal(C.fmtDay('2027-08-09'), 'lundi 9 août');
  assert.equal(C.fmtDay('2027-04-05'), 'lundi 5 avril');
  assert.equal(C.parseAmount('9,50 €'), 950);
  assert.equal(C.parseAmount('1 116,00'), 111600);
  assert.equal(C.parseAmount('1.116,00'), 111600);
  assert.equal(C.parseAmount('16.75'), 1675);
  assert.equal(C.parseAmount(9), 900);
  assert.equal(C.parseAmount('abc'), null);
  assert.equal(C.fmtDur(85), '1 h 25');
  assert.equal(C.fmtDur(45), '45 min');
});

// Famille fictive : Alex (1985-03-04), Sam (1986-10-21), Léa (2018-12-05), Noé (2024-11-20)
test('âges calculés par jour (Léa 8 ans, Noé 2 ans sur les deux voyages)', () => {
  for (const d of ['2027-04-05', '2027-04-12', '2027-08-03', '2027-08-10']) {
    assert.equal(C.ageOn('2018-12-05', d), 8);
    assert.equal(C.ageOn('2024-11-20', d), 2);
  }
  assert.equal(C.ageOn('2018-12-05', '2027-12-04'), 8);
  assert.equal(C.ageOn('2018-12-05', '2027-12-05'), 9);
});

test('anniversaire pendant un voyage fictif en décembre', () => {
  const t = [{ id: 'l', name: 'Léa', birth: '2018-12-05' }, { id: 'n', name: 'Noé', birth: '2024-11-20' }];
  const b = C.birthdaysInRange(t, '2027-12-01', '2027-12-10');
  assert.equal(b.length, 1);
  assert.equal(b[0].date, '2027-12-05');
  assert.equal(b[0].age, 9);
  assert.equal(C.birthdaysInRange(t, '2027-08-03', '2027-08-10').length, 0);
});

test('tarifs selon l\'âge : Aquarium 2 × 16 € + 11 €, Noé gratuit = 43 €', () => {
  const trav = [{ birth: '1985-03-04' }, { birth: '1986-10-21' }, { birth: '2018-12-05' }, { birth: '2024-11-20' }];
  const step = { prix: { adulte: 1600, enfant: 1100, gratuitSousAge: 3 } };
  assert.equal(C.stepCost(step, trav, '2027-08-10'), 4300);
});

test('fuseaux : Genève 10:10 → Arrecife 13:10 = 4 h 00 de vol', () => {
  assert.equal(C.flightDurationMin({ from: 'GVA', to: 'ACE', depDate: '2027-08-03', depTime: '10:10', arrDate: '2027-08-03', arrTime: '13:10' }), 240);
  assert.equal(C.flightDurationMin({ from: 'ACE', to: 'GVA', depDate: '2027-08-10', depTime: '14:00', arrDate: '2027-08-10', arrTime: '18:50' }), 230);
  assert.equal(C.flightDurationMin({ from: 'LYS', to: 'BRI', depDate: '2027-04-05', depTime: '09:00', arrDate: '2027-04-05', arrTime: '10:55' }), 115);
  assert.equal(C.tzDiffHours('Europe/Paris', 'Atlantic/Canary', '2027-08-03'), -1);
});

test('partages exacts au centime', () => {
  assert.deepEqual(C.splitEqual(1675, ['m', 'c']), { m: 838, c: 837 });
  assert.deepEqual(C.splitEqual(1000, ['a', 'b', 'c']), { a: 334, b: 333, c: 333 });
  const w = C.splitWeighted(10000, { a: 2, b: 2, c: 1 }, ['a', 'b', 'c']);
  assert.equal(C.sumValues(w), 10000);
  assert.deepEqual(w, { a: 4000, b: 4000, c: 2000 });
  const w2 = C.splitWeighted(1001, { a: 1, b: 1, c: 1 }, ['a', 'b', 'c']);
  assert.equal(C.sumValues(w2), 1001);
});

test('soldes : somme = 0,00 € sur 1 000 dépenses aléatoires, tous modes', () => {
  const ids = ['m', 'c', 'x', 'y'];
  let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const exps = [];
  for (let i = 0; i < 1000; i++) {
    const modes = ['egal', 'parts', 'montants', 'aucun'];
    const mode = modes[Math.floor(rnd() * 4)];
    const type = rnd() < 0.08 ? 'transfert' : rnd() < 0.05 ? 'revenu' : 'depense';
    const amount = Math.floor(rnd() * 50000) + 1;
    const rate = rnd() < 0.2 ? 1.1734 : 1;
    const e = { type, amount, rate, amountTrip: C.convert(amount, rate), paidBy: ids[Math.floor(rnd() * 4)], to: ids[Math.floor(rnd() * 4)],
      split: { mode, participants: ids.filter(() => rnd() < 0.8), parts: { m: 2, c: 2, x: 1, y: 3 }, amounts: { m: 100, c: 250, x: 0, y: 75 } } };
    if (!e.split.participants.length) e.split.participants = ['m'];
    e.shares = C.computeShares(e, ids);
    if (type !== 'transfert') assert.equal(C.sumValues(e.shares), e.amountTrip, 'parts = montant');
    exps.push(e);
  }
  const b = C.balances(exps, ids);
  assert.equal(C.sumValues(b), 0);
  const s = C.settle(b);
  assert.ok(s.length <= ids.length - 1);
  const after = { ...b };
  for (const t of s) { after[t.from] += t.amount; after[t.to] -= t.amount; }
  for (const v of Object.values(after)) assert.equal(v, 0);
});

test('« Mes dépenses » = ma quote-part, total, solde (cas 2 personnes)', () => {
  const ids = ['m', 'c'];
  const mk = (a, p) => { const e = { type: 'depense', amountTrip: a, paidBy: p, split: { mode: 'egal' } }; e.shares = C.computeShares(e, ids); return e; };
  const ex = [mk(1000, 'c'), mk(1300, 'c'), mk(5700, 'c'), mk(4300, 'c'), mk(1675, 'c'), mk(1400, 'c'), mk(26000, 'm')];
  assert.equal(C.totalExpenses(ex), 41375);
  const b = C.balances(ex, ids);
  assert.equal(b.m + b.c, 0);
  assert.equal(C.myShare(ex, 'm') + C.myShare(ex, 'c'), 41375);
  // transfert : rembourse exactement
  const s = C.settle(b);
  assert.equal(s.length, 1);
});

test('horaires de la journée : sieste, déjeuner, marges', () => {
  const trav = [{ birth: '1985-03-04' }, { birth: '2024-11-20' }];
  const steps = [
    { id: 'a', name: 'A', type: 'visite', order: 1, duree: 60, route: { minutes: 20 } },
    { id: 'b', name: 'B', type: 'rando', order: 2, duree: 90, route: { manuel: 15 } },
    { id: 'c', name: 'C', type: 'plage', order: 3, duree: 120, route: { manuel: 30 } },
  ];
  const r = C.buildTimeline({ date: '2027-08-09', steps, travelers: trav, settings: {} });
  const st = r.items.filter(x => x.kind === 'step');
  assert.equal(C.min2hm(st[0].time), '09:24'); // 20 min estimé + 20 %
  assert.equal(C.min2hm(st[1].time), '10:54'); // +60 + 15 marge + 15 manuel
  assert.ok(r.items.some(x => x.kind === 'bloc' && x.type === 'sieste'));
  assert.ok(r.items.some(x => x.kind === 'bloc' && x.type === 'repas'));
});

test('conseils : règles, routine et absence de conseil identique tous les jours', () => {
  const trav = [{ birth: '1985-03-04' }, { birth: '2018-12-05' }, { birth: '2024-11-20' }];
  const days = [
    { date: 'd1', steps: [{ name: 'Vol', type: 'trajet' }], flight: true },
    { date: 'd2', steps: [{ name: 'Matera', type: 'village', poussette: 'non', restauration: 'oui' }] },
    { date: 'd3', steps: [{ name: 'Playa Blanca', type: 'plage', restauration: 'oui' }] },
    { date: 'd4', steps: [{ name: 'Caldera Colorada', type: 'rando' }, { name: 'Playa', type: 'plage' }] },
    { date: 'd5', steps: [{ name: 'Plage', type: 'plage', restauration: 'oui' }] },
    { date: 'd6', steps: [{ name: 'Piscine', type: 'piscine', restauration: 'oui' }] },
    { date: 'd7', steps: [{ name: 'Vol', type: 'trajet' }], flight: true },
  ];
  const ctxs = days.map((d, i) => ({ date: d.date, fullDay: i > 0 && i < days.length - 1, ctx: C.dayTipContext({ date: '2027-08-1' + (i + 2), steps: d.steps, travelers: trav, isFlightDay: !!d.flight }) }));
  const res = C.computeTips(ctxs, []);
  const texts = d => [...res.byDay[d].tips, ...res.byDay[d].routine].map(t => t.text + (t.routine ? ' [routine]' : ''));
  assert.ok(texts('d2').some(t => t.startsWith('Porte-bébé à la place de la poussette')), 'Matera → porte-bébé');
  assert.ok(texts('d3').some(t => t.startsWith('Maillots')), 'plage → maillots');
  assert.ok(texts('d4').some(t => t.startsWith('Chaussures de marche, eau')), 'rando → chaussures et eau');
  assert.ok(texts('d4').some(t => t.startsWith('Prévoir sandwichs')), 'sans restauration → pique-nique');
  assert.ok(res.routineRules.some(r => r.ruleId === 'baignade'), 'baignade en routine (5 jours pleins sur 5)');
  // Aucun conseil détaillé identique sur tous les jours
  const all = Object.keys(res.byDay).map(d => new Set(res.byDay[d].tips.map(t => t.ruleId)));
  for (const rid of all[0]) assert.ok(!all.every(s => s.has(rid)), rid + ' présent tous les jours');
});

test('import Claude : lecture tolérante et validation', () => {
  const txt = 'Voici le JSON :\n```json\n{ "schema": "carnet/1", "type": "programme", "jours": [ { "date": "2027-08-09", "etapes": [ { "nom": "Caldera Colorada", "type": "randonnée", "cotation": "+++", "prix_adulte": "9,50 €", "duree_min": {"a_verifier": true, "valeur": 60}, }, ] } ], }\n```\nBonne journée';
  const r = C.extractJson(txt);
  assert.ok(r.obj, r.error);
  assert.ok(r.fixes.length > 0);
  const n = C.normalizeImport(r.obj, { travelers: [], steps: [] });
  const st = n.items.find(i => i.kind === 'step');
  assert.equal(st.data.type, 'rando');
  assert.equal(st.data.rating, 3);
  assert.equal(st.data.prix.adulte, 950);
  assert.equal(st.data.duree, 60);
  assert.ok(st.data.aVerifier.includes('durée'));
  assert.ok(st.ok);
  assert.equal(C.extractJson('rien').error !== undefined, true);
});

test('import : doublons de dépenses et budget converti', () => {
  const trip = { dateStart: '2027-08-03', dateEnd: '2027-08-10', currency: 'EUR' };
  const existing = [{ title: 'Essence', amount: 1000, amountTrip: 1000, date: '2027-08-10' }];
  const obj = { schema: 'carnet/1', type: 'depenses', depenses: [{ titre: 'Essence', montant: 10, date: '2027-08-10', categorie: 'essence' }, { titre: 'Glaces', montant: '4,5', date: '10/08/2027', categorie: 'courses' }], budget: [{ categorie: 'vol', montant: 1200 }] };
  const n = C.normalizeImport(obj, { trip, expenses: existing, travelers: [] });
  const ex = n.items.filter(i => i.kind === 'expense');
  assert.equal(ex.length, 3);
  assert.equal(ex[0].dup, true);
  assert.equal(ex[0].data.category, 'carburant');
  assert.equal(ex[1].data.amount, 450);
  assert.equal(ex[1].data.date, '2027-08-10');
  assert.equal(ex[2].data.category, 'vol');
  assert.equal(ex[2].data.split.mode, 'aucun');
});

test('liens Google Maps découpés par 3 étapes intermédiaires', () => {
  const pts = Array.from({ length: 7 }, (_, i) => ({ lat: 29 + i / 100, lon: -13.6, label: 'P' + i }));
  const l = C.gmapsLinks(pts);
  assert.equal(l.length, 2);
  assert.equal(l[0].n, 5);
  assert.equal(l[1].n, 3);
  assert.ok(l[0].url.includes('waypoints='));
  assert.ok(!l[1].url.includes('waypoints=') || l[1].url.split('%7C').length === 1);
});

test('budget : total toujours calculé', () => {
  const lines = [120000, 3500, 14000, 98000, 25000, 7000, 66000, 15500, 20000, 11000];
  const ex = lines.map((v, i) => ({ type: 'depense', amountTrip: v, category: ['vol', 'trajet', 'parking_aeroport', 'logement', 'voiture', 'carburant', 'restaurants', 'courses', 'loisirs', 'souvenirs'][i] }));
  assert.equal(C.sumBudget(C.budgetReel(ex)), 380000);
});

test('prompt : découpage des données longues', () => {
  const head = C.promptHeader('programme', { trip: { name: 'Test', dateStart: '2027-08-03', dateEnd: '2027-08-10' }, travelers: [{ name: 'Noé', birth: '2024-11-20' }] });
  assert.ok(head.includes('Noé : 2 ans'));
  const parts = C.splitPrompt(head, ['a'.repeat(20000), 'b'.repeat(20000), 'c'.repeat(5000)], 30000);
  assert.equal(parts.length, 3);
  assert.ok(parts[0].includes('partie 1/3'));
  for (const p of parts) assert.ok(p.length <= 30000);
});

test('aéroports : base OurAirports, recherche par code, ville, nom français, pays, île', () => {
  const d = JSON.parse(readFileSync(join(here, '../data/aeroports.json'), 'utf8'));
  assert.ok(d.rows.length > 3000, 'base complète');
  assert.ok(d.rows.every(r => /^[A-Z]{3}$/.test(r[0]) && r[4]), 'code IATA et fuseau pour chaque aéroport');
  const dn = new Intl.DisplayNames(['fr'], { type: 'region' });
  const idx = C.airportIndex(d.rows, c => dn.of(c));
  const first = q => (C.airportSearch(idx, q, 5)[0] || {}).iata;
  const all = q => C.airportSearch(idx, q, 8).map(a => a.iata);
  assert.equal(first('ACE'), 'ACE');
  assert.equal(first('ace'), 'ACE');
  assert.equal(first('lanz'), 'ACE');
  assert.equal(first('Genève'), 'GVA');
  assert.equal(first('bâle'), 'BSL');
  assert.equal(first('Bari'), 'BRI');
  assert.equal(first('Albanie'), 'TIA');
  assert.ok(['CDG', 'ORY'].includes(first('paris')));
  assert.ok(all('londres').includes('LHR'), 'nom français d\'une ville étrangère');
  assert.ok(all('sardaigne').includes('CAG') && all('sardaigne').includes('OLB'), 'île → ses aéroports');
  assert.deepEqual(C.airportSearch(idx, '', 5), []);
  // Fuseau : table intégrée, puis base une fois chargée
  for (const a of idx) if (!C.AIRPORTS[a.iata]) C.AIRPORT_EXTRA[a.iata] = [a.city, a.tz];
  assert.equal(C.airportTz('ZNZ'), 'Africa/Dar_es_Salaam');
  assert.equal(C.airportTz('HER'), 'Europe/Athens');
  assert.equal(C.airportTz('JFK'), 'America/New_York');
});
