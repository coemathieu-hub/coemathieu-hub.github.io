// Test de bout en bout des nouveautés 1.1 (famille et voyages fictifs) :
// accueil, aéroports proposés à la saisie, voyage passé à partir de documents (Word + photo),
// analyse directe par Claude (API simulée), programme papier depuis l'accueil.
// Usage : DEVLIBS=<node_modules avec les bibliothèques et bundles/> node tests/e2e-nouveautes.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = process.env.DEVLIBS; const OUT = process.env.OUT || '/tmp/carnet-e2e'; mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p); if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(8126);
const MAP = [
  [/@anthropic-ai\/sdk@0\.133\.0\/\+esm$/, () => join(LIB, '../bundles/anthropic-sdk.mjs')],
  [/leaflet@1\.9\.4\/dist\/(leaflet\.(js|css))$/, m => join(LIB, 'leaflet/dist', m[1])],
  [/qrcode-generator@2\.0\.4\/dist\/qrcode\.mjs$/, () => join(LIB, 'qrcode-generator/dist/qrcode.mjs')],
];
const results = []; const ok = (n, c, x) => { results.push({ n, ok: !!c }); console.log((c ? '✔ ' : '✘ ') + n + (x ? ' — ' + x : '')); };
const sp = s => String(s).replace(/[\u00a0\u202f]/g, ' ');

// Pièces jointes de test : un récap Word (généré) et une « photo »
const docx = require(join(LIB, 'docx'));
const doc = new docx.Document({ sections: [{ children: [
  new docx.Paragraph('Récap budget Islande, juillet 2019'),
  new docx.Table({ rows: [['Vol Genève - Reykjavik', '1 200 €'], ['Location 4x4', '640 €']].map(r => new docx.TableRow({ children: r.map(t => new docx.TableCell({ children: [new docx.Paragraph(t)] })) })) }),
] }] });
const DOCX = join(OUT, 'recap-islande.docx'); writeFileSync(DOCX, await docx.Packer.toBuffer(doc));
const PHOTO = join(ROOT, 'icons/icon-512.png');

// Réponse simulée de Claude (format carnet/1)
const ANSWER = 'Voici le JSON :\n```json\n' + JSON.stringify({
  schema: 'carnet/1', type: 'archive',
  voyage: { nom: 'Islande 2019', emoji: '🌋', destination: 'Islande', debut: '2019-07-10', fin: '2019-07-17', devise: 'EUR' },
  jours: [{ date: '2019-07-11', etapes: [{ nom: 'Cascade de Seljalandsfoss', type: 'panorama', cotation: 3, duree_min: 60 }] }],
  depenses: [{ type: 'depense', titre: 'Vol Genève - Reykjavik', montant: 1200, devise: 'EUR', categorie: 'vol', date: '2019-07-10', partage: 'egal' }],
  budget: [{ categorie: 'voiture', montant: 640, note: 'Location 4x4' }],
}) + '\n```';
let apiReq = null;
function sse(text) {
  const ev = (type, data) => 'event: ' + type + '\ndata: ' + JSON.stringify({ type, ...data }) + '\n\n';
  return ev('message_start', { message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 1 } } }) +
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: text.slice(0, 40) } }) +
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: text.slice(40) } }) +
    ev('content_block_stop', { index: 0 }) +
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 300 } }) +
    ev('message_stop', {});
}

const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, async route => {
  const u = route.request().url();
  if (u.startsWith('https://api.anthropic.com/v1/messages')) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    apiReq = { headers: route.request().headers(), body: JSON.parse(route.request().postData() || '{}') };
    return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'text/event-stream' }, body: sse(ANSWER) });
  }
  for (const [re, fn] of MAP) { const m = u.match(re); if (m) { const f = fn(m); return route.fulfill({ status: 200, contentType: MIME[extname(f)] || 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: readFileSync(f) }); } }
  return route.abort('internetdisconnected');
});
await ctx.addInitScript(() => {
  if (!localStorage.getItem('carnet.famille')) {
    localStorage.setItem('carnet.famille', JSON.stringify([{ name: 'Hugo', birth: '1985-03-04', participe: true }, { name: 'Sam', birth: '1986-10-21', participe: true }, { name: 'Léa', birth: '2018-12-05', participe: false }, { name: 'Noé', birth: '2024-11-20', participe: false }]));
    localStorage.setItem('carnet.myName', 'Hugo');
  }
});
const p = await ctx.newPage();
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to load resource|net::/.test(m.text())) errors.push('console: ' + m.text()); });
const shot = name => p.screenshot({ path: join(OUT, name + '.png'), fullPage: true });
const noHScroll = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

// --- Voyages fictifs : un à venir, un passé avec dépenses
await p.goto('http://localhost:8126/'); await p.waitForSelector('.hello');
const year = new Date().getFullYear() + 1;
await p.evaluate(async y => {
  const t = (name, emoji, d0, d1, archived) => ({ name, emoji, destination: '', dateStart: d0, dateEnd: d1, currency: 'EUR', archived, settings: {}, gouts: {} });
  await window.__carnet.restoreBackup({ format: 'carnet-sauvegarde', version: 1, trips: [
    { trip: t('Crète ' + y, '🏛️', y + '-05-10', y + '-05-17', false), colls: { travelers: { t1: { name: 'Hugo', birth: '1985-03-04', participe: true } } } },
    { trip: t('Sicile 2025', '🍋', '2025-04-05', '2025-04-12', true), colls: { travelers: { t1: { name: 'Hugo', participe: true } }, expenses: { e1: { type: 'depense', title: 'Vol', category: 'vol', amount: 100000, amountTrip: 100000, currency: 'EUR', date: '2025-04-05' } } } },
  ] }, 'local');
}, year);
await p.goto('http://localhost:8126/#/'); await p.reload(); await p.waitForSelector('a.hist:has-text("Sicile 2025")');
const home = sp(await p.innerText('#app'));
ok('Accueil : salutation avec le prénom', /(Bonjour|Bon après-midi|Bonsoir) Hugo/.test(home));
ok('Accueil : prochain voyage mis en avant avec compte à rebours', await p.isVisible('a.hero:has-text("Crète ' + year + '")') && /J-\d+/.test(home));
ok('Accueil : actions Programme papier et Voyage passé', await p.isVisible('button.tile:has-text("Programme papier")') && await p.isVisible('button.tile:has-text("Voyage passé")'));
ok('Accueil : historique avec total calculé', /1 000 €/.test(sp(await p.innerText('a.hist:has-text("Sicile 2025")'))));
ok('Accueil : chiffres cumulés (1 voyage, 8 jours)', /1\s*voyage/.test(home) && /8\s*jours/.test(home));
ok('Accueil : pas de défilement horizontal (360 px)', await noHScroll());
await shot('n1-accueil-360');

// --- Aéroports proposés pendant la saisie
await p.goto('http://localhost:8126/#/nouveau'); await p.waitForSelector('input[name=toAirport]');
await p.fill('input[name=toAirport]', 'lanz');
await p.waitForSelector('.ac-item', { timeout: 8000 });
const firstSugg = sp(await p.innerText('.ac-item >> nth=0'));
ok('Aéroport : « lanz » propose Lanzarote en premier', /^ACE/.test(firstSugg), firstSugg);
await p.click('.ac-item >> nth=0');
ok('Aéroport : choix → code et fuseau affichés', (await p.inputValue('input[name=toAirport]')) === 'ACE' && /Espagne · Atlantic\/Canary/.test(await p.innerText('input[name=toAirport] >> xpath=..')));
await p.fill('input[name=fromAirport]', 'Genève'); await p.waitForSelector('.ac-item:has-text("GVA")'); await p.press('input[name=fromAirport]', 'Enter');
ok('Aéroport : Entrée choisit la première suggestion (Genève → GVA)', (await p.inputValue('input[name=fromAirport]')) === 'GVA');
await p.fill('input[name=toAirport]', 'Zanzibar'); // tapé sans choisir : résolu à l'enregistrement
await p.fill('input[name=name]', 'Zanzibar test'); await p.fill('input[name=dateStart]', year + '-02-01'); await p.fill('input[name=dateEnd]', year + '-02-10');
await p.click('summary:has-text("Vols")'); await p.fill('input[name=allerDep]', '10:00'); await p.fill('input[name=allerArr]', '20:00');
ok('Nouveau voyage : pas de défilement horizontal (360 px)', await noHScroll());
await shot('n2-nouveau-voyage');
await p.click('button:has-text("Créer le voyage")');
await p.waitForFunction(() => location.hash.includes('/programme'), null, { timeout: 10000 });
await p.waitForFunction(() => window.__carnet.T.loaded && Object.keys(window.__carnet.T.bookings).length > 0, null, { timeout: 10000 });
const vol = await p.evaluate(() => Object.values(window.__carnet.T.bookings)[0]);
ok('Aéroport : ville tapée sans choisir → code (ZNZ) et fuseau de la base', vol.from === 'GVA' && vol.to === 'ZNZ' && vol.toTz === 'Africa/Dar_es_Salaam', vol.from + '→' + vol.to + ' ' + vol.toTz);

// --- Voyage passé à partir de documents (sans clé API : prompt à copier)
await p.goto('http://localhost:8126/#/'); await p.waitForSelector('button.tile:has-text("Voyage passé")');
await p.click('button.tile:has-text("Voyage passé")'); await p.waitForSelector('#sheet button:has-text("Choisir les documents")');
let fc = p.waitForEvent('filechooser');
await p.click('#sheet button:has-text("Choisir les documents")');
await (await fc).setFiles([DOCX, PHOTO]);
await p.waitForSelector('text=Voyage passé >> nth=0'); await p.waitForSelector('.item:has-text("recap-islande.docx")', { timeout: 10000 });
const src = sp(await p.innerText('#app'));
const nChars = +((src.match(/document · (\d+) caractères/) || [])[1] || 0);
ok('Voyage passé : Word lu (texte extrait)', nChars > 40, nChars + ' caractères');
ok('Voyage passé : photo prise en compte', /photo envoyée à Claude/.test(src));
ok('Voyage passé : sans clé, prompt à copier proposé', await p.isVisible('button:has-text("Préparer le prompt")') && !(await p.isVisible('button:has-text("Analyser avec Claude")')));
await p.click('button:has-text("Préparer le prompt")'); await p.waitForSelector('button:has-text("Partager vers Claude")');
const full = await p.evaluate(() => window.__carnet.App.imp.full || '');
ok('Prompt : dates à déduire des documents + texte du Word', /à déduire des documents/.test(full) && /Location 4x4 \| 640 €/.test(sp(full)));
await shot('n3-voyage-passe-sources');

// --- Analyse directe avec une clé (API simulée)
await p.evaluate(() => localStorage.setItem('carnet.anthropicKey', JSON.stringify('sk-ant-test-0000')));
await p.evaluate(() => window.__carnet.App.render ? window.__carnet.App.render() : null);
await p.goto(p.url().replace('/imports', '/programme')); await p.goBack();
await p.waitForSelector('button:has-text("Analyser avec Claude")', { timeout: 8000 });
await p.click('button:has-text("Analyser avec Claude")');
await p.waitForSelector('#impRes button:has-text("Intégrer la sélection")', { timeout: 15000 });
const h = apiReq ? apiReq.headers : {}; const b = apiReq ? apiReq.body : {};
ok('API : modèle et repli en cas de refus', b.model === 'claude-opus-5-5' && b.fallbacks === 'default' && /server-side-fallback-2026-07-01/.test(h['anthropic-beta'] || ''), b.model);
ok('API : clé en en-tête, accès navigateur autorisé', h['x-api-key'] === 'sk-ant-test-0000' && h['anthropic-dangerous-direct-browser-access'] === 'true');
const blocks = (b.messages && b.messages[0].content) || [];
ok('API : photo jointe (JPEG réduit) + prompt texte', blocks.some(x => x.type === 'image' && x.source.media_type === 'image/jpeg') && blocks.some(x => x.type === 'text' && /Location 4x4/.test(x.text)));
await shot('n4-apercu-import');
await p.click('#impRes button:has-text("Intégrer la sélection")');
await p.waitForFunction(() => window.__carnet.T.trip && window.__carnet.T.trip.draftImport === false, null, { timeout: 8000 });
const tr = await p.evaluate(() => ({ ...window.__carnet.T.trip, nSteps: Object.keys(window.__carnet.T.steps).length, nExp: Object.keys(window.__carnet.T.expenses).length }));
ok('Voyage passé : nom, dates et destination tirés des documents', tr.name === 'Islande 2019' && tr.dateStart === '2019-07-10' && tr.dateEnd === '2019-07-17' && tr.destination === 'Islande' && tr.archived, tr.name + ' ' + tr.dateStart + '→' + tr.dateEnd);
ok('Voyage passé : étape et dépenses intégrées', tr.nSteps === 1 && tr.nExp === 2, tr.nSteps + ' étape, ' + tr.nExp + ' dépenses');
await p.goto('http://localhost:8126/#/'); await p.waitForSelector('a.hist:has-text("Islande 2019")', { timeout: 8000 });
ok('Accueil : le voyage reconstitué rejoint l\'historique (année 2019)', /2019/.test(await p.innerText('#app')));

// --- Programme papier depuis l'accueil
await p.click('button.tile:has-text("Programme papier")'); await p.waitForSelector('#sheet button.item:has-text("Crète ' + year + '")');
fc = p.waitForEvent('filechooser');
await p.click('#sheet button.item:has-text("Crète ' + year + '")');
await (await fc).setFiles([PHOTO]);
await p.waitForSelector('.item:has-text("icon-512.png")', { timeout: 10000 });
ok('Programme papier : voyage choisi, photo ajoutée, type « Programme »', /Programme/.test(await p.innerText('.topbar')) && /Crète/.test(await p.evaluate(() => window.__carnet.T.trip.name)));
await shot('n5-programme-papier');

// --- Réglages : carte de la clé
await p.goto('http://localhost:8126/#/reglages'); await p.waitForSelector('text=Analyse directe par Claude');
ok('Réglages : clé enregistrée, masquée', /Clé enregistrée · …0000/.test(sp(await p.innerText('#app'))) && !/sk-ant-test-0000/.test(await p.innerText('#app')));

// --- Z Fold déplié
await p.setViewportSize({ width: 884, height: 1104 }); await p.goto('http://localhost:8126/#/'); await p.waitForSelector('.tiles');
ok('Déplié : tuiles sur une ligne, pas de défilement horizontal', await noHScroll() && await p.evaluate(() => { const t = [...document.querySelectorAll('.tile')]; return t.length === 4 && t.every(x => Math.abs(x.getBoundingClientRect().top - t[0].getBoundingClientRect().top) < 2); }));
await shot('n6-accueil-deplie');

ok('Aucune erreur JavaScript', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close(); server.close();
const failed = results.filter(r => !r.ok);
console.log('\n' + (results.length - failed.length) + ' / ' + results.length + ' contrôles OK');
process.exit(failed.length ? 1 : 0);
