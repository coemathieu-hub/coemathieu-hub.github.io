// Test de bout en bout des nouveautés 1.1 (famille et voyages fictifs) :
// accueil, aéroports proposés à la saisie, voyage passé à partir de documents (Word + photo),
// analyse automatique dès l'ajout (téléphone, puis Gemini avec API simulée, repli si quota atteint),
// programme papier depuis l'accueil.
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
  [/pdfjs-dist@6\.3\.289\/build\/(pdf(\.worker)?\.min\.mjs)$/, m => join(LIB, 'pdfjs-dist/build', m[1])],
  [/leaflet@1\.9\.4\/dist\/(leaflet\.(js|css))$/, m => join(LIB, 'leaflet/dist', m[1])],
  [/qrcode-generator@2\.0\.4\/dist\/qrcode\.mjs$/, () => join(LIB, 'qrcode-generator/dist/qrcode.mjs')],
];
const results = []; const ok = (n, c, x) => { results.push({ n, ok: !!c }); console.log((c ? '✔ ' : '✘ ') + n + (x ? ' — ' + x : '')); };
const sp = s => String(s).replace(/[\u00a0\u202f]/g, ' ');

// Pièces jointes de test (fictives) : budget d'un voyage passé, budget d'un voyage à venir, une « photo »
const docx = require(join(LIB, 'docx'));
const mkDocx = async (name, lines) => { const f = join(OUT, name); writeFileSync(f, await docx.Packer.toBuffer(new docx.Document({ sections: [{ children: lines.map(l => new docx.Paragraph(l)) }] }))); return f; };
const DOCX = await mkDocx('budget-islande.docx', ['BUDGET ISLANDE 2019 du 10 au 17 juillet', 'VOL GENEVE – REYKJAVIK : 1200 euros', 'LOCATION 4X4 : 640 euros', 'Logement Vik : 900 euros + taxe séjour 12 euros', 'Jumelles pour les macareux', 'TOTAL : 2800 euros']);
const DOCX2 = await mkDocx('budget-crete.docx', ['Budget prévisionnel', 'Vol : 800 euros', 'Logement : 1000 euros', 'Location voiture : 300 euros']);
const PHOTO = join(ROOT, 'icons/icon-512.png');
// PDF sans texte (comme un scan manuscrit), reçu SANS extension (cas du sélecteur de fichiers Android)
const scanPdf = () => { const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>'];
  let out = '%PDF-1.6\n%\xe2\xe3\xcf\xd3\n'; const off = []; objs.forEach((o, i) => { off.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const x = out.length; out += 'xref\n0 4\n0000000000 65535 f \n' + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(out, 'latin1'); };
const SCAN = { name: 'programme', mimeType: 'application/octet-stream', buffer: scanPdf() };
const BINAIRE = { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from(Array.from({ length: 4000 }, (_, i) => (i * 37 + 11) % 256)) };

// Réponse simulée de Gemini (format carnet/1, JSON brut) pour la photo d'un programme
const ANSWER = JSON.stringify({
  schema: 'carnet/1', type: 'auto',
  jours: [{ date: '2019-07-11', etapes: [{ nom: 'Cascade de Seljalandsfoss', type: 'panorama', cotation: 3, duree_min: 60 }] }],
  vols: [{ sens: 'aller', compagnie: 'easyJet', numero: 'U2 1234', de: 'GVA', vers: 'KEF', depart_date: '2019-07-10', depart_heure: '10:00', arrivee_date: '2019-07-10', arrivee_heure: '12:30' }],
  notes: 'Prévoir des vêtements de pluie.',
});
let gemReq = null, gemCalls = 0, gemMode = 'ok'; const gemBodies = [];
const GEM = 'https://generativelanguage.googleapis.com/v1beta/';

const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, async route => {
  const u = route.request().url();
  if (u.startsWith(GEM)) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const json = (status, o) => route.fulfill({ status, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
    if (u.startsWith(GEM + 'models?')) return json(200, { models: [{ name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] }] });
    gemCalls++; gemReq = { url: u, headers: route.request().headers(), body: JSON.parse(route.request().postData() || '{}') }; gemBodies.push(gemReq.body);
    if (gemMode === '429') return json(429, { error: { code: 429, message: 'Resource has been exhausted (e.g. check quota).', status: 'RESOURCE_EXHAUSTED' } });
    if (gemMode === 'nothink' && gemReq.body.generationConfig.thinkingConfig) return json(400, { error: { code: 400, message: 'Thinking level is not supported for this model.', status: 'INVALID_ARGUMENT' } });
    if (gemMode === 'slow') { await new Promise(r => setTimeout(r, 15000)); try { await route.abort('timedout'); } catch { } return; }
    // Réponse en flux (SSE), découpée comme celle de l'API
    const chunk = (text, fin) => 'data: ' + JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, ...(fin ? { finishReason: 'STOP' } : {}) }], modelVersion: 'gemini-test' }) + '\r\n\r\n';
    return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'text/event-stream' }, body: chunk(ANSWER.slice(0, 60)) + chunk(ANSWER.slice(60, 200)) + chunk(ANSWER.slice(200), true) });
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
ok('Accueil : illustrations de vacances (bandeau, prochain voyage, historique)', await p.isVisible('.hello.scene svg') && await p.isVisible('a.hero.scene svg') && await p.isVisible('a.hist .hist-e svg'));
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

// --- Importer depuis l'accueil : nouveau voyage d'après les documents, analyse sur le téléphone (sans clé)
await p.goto('http://localhost:8126/#/'); await p.waitForSelector('button.tile:has-text("Importer")');
await p.click('button.tile:has-text("Importer")'); await p.waitForSelector('#sheet button:has-text("Nouveau voyage d\'après les documents")');
let fc = p.waitForEvent('filechooser');
await p.click('#sheet button:has-text("Nouveau voyage d\'après les documents")');
await (await fc).setFiles([DOCX, PHOTO]);
await p.waitForSelector('.item:has-text("budget-islande.docx")', { timeout: 10000 }); await p.waitForSelector('.item:has-text("icon-512.png")');
fc = p.waitForEvent('filechooser'); await p.click('button:has-text("Fichiers")'); await (await fc).setFiles([SCAN, BINAIRE]);
await p.waitForSelector('.item:has-text("programme")', { timeout: 10000 });
const srcScan = sp(await p.innerText('.item:has-text("programme")'));
ok('PDF scanné reçu sans extension : reconnu comme PDF sans texte lisible', /pas de texte lisible \(scan ou manuscrit\)/.test(srcScan), srcScan.replace(/\n/g, ' '));
await p.waitForSelector('.item:has-text("notes.txt")');
ok('Fichier binaire : refusé, jamais lu comme du texte', /non lu : format non reconnu/.test(sp(await p.innerText('.item:has-text("notes.txt")'))));
ok('Bouton Accueil dans la barre du haut', await p.isVisible('.topbar a[aria-label="Accueil"]'));
await p.waitForSelector('#impRes button:has-text("Intégrer la sélection")', { timeout: 8000 });
const src = sp(await p.innerText('#app'));
const nChars = +((src.match(/document · (\d+) caractères/) || [])[1] || 0);
ok('Import : Word lu (texte extrait)', nChars > 80, nChars + ' caractères');
ok('Import : analyse lancée seule à l\'ajout, sans bouton à presser', await p.isVisible('#impRes') && !(await p.isVisible('button.btn.primary:has-text("Analyser")')));
ok('Import : ni prompt, ni copier-coller, ni app Claude', !/prompt|copier|coller la réponse|claude/i.test(src));
ok('Import : photo et scan signalés, clé Gemini proposée', /2 documents sans texte lisible/.test(src) && await p.isVisible('a.btn:has-text("Ajouter la clé Gemini")'));
await shot('n3-import-documents');
const prev = sp(await p.innerText('#impRes'));
ok('Analyse sur le téléphone : 4 lignes de budget (voyage passé → dépenses) + notes', /dépenses \(4\)/i.test(prev) && /notes \(1\)/i.test(prev), (prev.match(/[A-Za-zéè ]+ \(\d+\)/g) || []).join(', '));
ok('Analyse : total indiqué ≠ somme des lignes, signalé', /total indiqué 2 800 €, somme des lignes 2 752 €/.test(prev));
ok('Analyse : aucune étape tirée du scan ou du binaire', !/programme \(/i.test(prev), (prev.match(/[A-Za-zéè ]+ \(\d+\)/g) || []).join(', '));
ok('Nom du voyage repris du document et modifiable', (await p.inputValue('#impName')) === 'Islande 2019');
await p.fill('#impName', 'Islande en famille 2019');
await shot('n4-apercu-local');
await p.click('#impRes button:has-text("Intégrer la sélection")');
await p.waitForFunction(() => window.__carnet.T.trip && window.__carnet.T.trip.draftImport === false, null, { timeout: 8000 });
let tr = await p.evaluate(() => ({ ...window.__carnet.T.trip, total: Object.values(window.__carnet.T.expenses).reduce((s, e) => s + e.amountTrip, 0) }));
ok('Voyage créé d\'après le Word : nom choisi, dates, archivé, total 2 752 €', tr.name === 'Islande en famille 2019' && tr.dateStart === '2019-07-10' && tr.dateEnd === '2019-07-17' && tr.archived && tr.total === 275200, tr.name + ' ' + tr.dateStart + '→' + tr.dateEnd + ' ' + tr.total);
ok('Notes du document gardées dans le voyage', /Jumelles pour les macareux/.test((tr.notes || {}).general || ''));
await p.waitForSelector('a.btn:has-text("Récap")', { timeout: 5000 }).catch(() => {});
ok('Après intégration : accès direct au récap, au programme et au budget', await p.isVisible('a.btn:has-text("Récap")') && await p.isVisible('a.btn:has-text("Budget")'));

// --- Même voyage : photo d'un programme lue automatiquement par Gemini (clé enregistrée, API simulée)
await p.evaluate(() => localStorage.setItem('carnet.geminiKey', JSON.stringify('AIzaTest-cle-fictive-0000000000000000')));
await p.goto(p.url().replace('/imports', '/plus')); await p.click('a.item:has-text("Importer des documents")');
await p.waitForSelector('button:has-text("Fichiers")');
ok('Avec une clé : documents lus automatiquement par Gemini', /lu automatiquement par Gemini/.test(await p.innerText('#app')));
fc = p.waitForEvent('filechooser'); await p.click('button:has-text("Fichiers")'); await (await fc).setFiles([PHOTO]);
await p.waitForSelector('.item:has-text("icon-512.png")');
await p.waitForSelector('#impRes button:has-text("Intégrer la sélection")', { timeout: 15000 });
const h = gemReq ? gemReq.headers : {}; const b = gemReq ? gemReq.body : {};
ok('Gemini appelé seul, une fois, sans appui sur « Analyser »', gemCalls === 1, gemCalls + ' appel(s)');
ok('API Gemini : modèle gemini-flash-latest en flux, clé en en-tête (pas dans l\'adresse)', /models\/gemini-flash-latest:streamGenerateContent\?alt=sse$/.test(gemReq.url) && h['x-goog-api-key'] === 'AIzaTest-cle-fictive-0000000000000000' && !/key=/.test(gemReq.url), gemReq.url);
const parts = (b.contents && b.contents[0].parts) || [];
ok('API Gemini : photo jointe (JPEG réduit) + demande, réponse JSON exigée', parts.some(x => x.inlineData && x.inlineData.mimeType === 'image/jpeg' && x.inlineData.data.length > 100) && parts.some(x => /Extrais TOUT/.test(x.text || '')) && b.generationConfig.responseMimeType === 'application/json');
ok('API Gemini : réflexion courte demandée (réponse plus rapide)', b.generationConfig.thinkingConfig && b.generationConfig.thinkingConfig.thinkingLevel === 'LOW');
await p.click('#impRes button:has-text("Intégrer la sélection")');
await p.waitForSelector('a.btn:has-text("Récap")');
await p.click('a.btn:has-text("Récap")'); await p.waitForSelector('text=Organisation');
const rec = sp(await p.innerText('#app'));
ok('Récap complet : organisation (vol), programme, budget, notes', /Aller GVA → KEF/.test(rec) && /Seljalandsfoss/.test(rec) && /budget par catégorie/i.test(rec) && /2 752 €/.test(rec) && /vêtements de pluie/.test(await p.inputValue('textarea[name=general]')), [/Aller GVA → KEF/.test(rec), /Seljalandsfoss/.test(rec), /budget par catégorie/i.test(rec), /2 752 €/.test(rec)].join(','));
await shot('n5-recap-complet');

// --- Modèle qui refuse le niveau de réflexion : relance seule sans ce réglage ; puis bouton Annuler pendant une lecture lente
gemMode = 'nothink'; gemCalls = 0; gemBodies.length = 0;
await p.goto(p.url().replace('/recap', '/plus')); await p.click('a.item:has-text("Importer des documents")'); await p.waitForSelector('button:has-text("Fichiers")');
fc = p.waitForEvent('filechooser'); await p.click('button:has-text("Fichiers")'); await (await fc).setFiles([PHOTO]);
await p.waitForSelector('#impRes button:has-text("Intégrer la sélection")', { timeout: 15000 });
ok('Modèle sans réglage de réflexion : relancé seul sans ce réglage', gemCalls === 2 && !!gemBodies[0].generationConfig.thinkingConfig && !gemBodies[1].generationConfig.thinkingConfig, gemCalls + ' appel(s)');
await p.click('#impRes button:has-text("Ne rien intégrer")');
gemMode = 'slow';
await p.click('button:has-text("Analyser à nouveau")');
await p.waitForSelector('button:has-text("Annuler")', { timeout: 5000 });
await p.waitForTimeout(1500);
ok('Lecture en cours : temps écoulé affiché', /Gemini lit le document… \d+ s/.test(await p.innerText('#impProg')), await p.innerText('#impProg'));
await p.click('button:has-text("Annuler")');
await p.waitForSelector('text=Lecture par Gemini annulée', { timeout: 5000 });
ok('Annuler : lecture arrêtée tout de suite, bouton Relancer', await p.isVisible('button:has-text("Relancer")') && !(await p.isVisible('.spin')));
gemMode = 'ok';

// --- Voyage à venir, quota Gemini atteint : repli automatique sur l'analyse du téléphone ; le budget devient le budget prévu
gemMode = '429'; gemCalls = 0;
await p.goto('http://localhost:8126/#/'); await p.click('button.tile:has-text("Importer")');
await p.waitForSelector('#sheet button.item:has-text("Crète ' + year + '")');
fc = p.waitForEvent('filechooser'); await p.click('#sheet button.item:has-text("Crète ' + year + '")'); await (await fc).setFiles([DOCX2]);
await p.waitForSelector('.item:has-text("budget-crete.docx")', { timeout: 10000 });
await p.waitForSelector('#impRes button:has-text("Intégrer la sélection")', { timeout: 15000 });
ok('Quota atteint : message clair + bouton Réessayer, analyse du téléphone à la place', gemCalls === 1 && /quota gratuit Gemini atteint/.test(await p.innerText('#app')) && await p.isVisible('button:has-text("Réessayer")'), gemCalls + ' appel(s)');
await shot('n4b-repli-quota');
const prev2 = sp(await p.innerText('#impRes'));
ok('Voyage à venir : lignes reconnues comme budget prévu', /budget prévu \(3\)/i.test(prev2), (prev2.match(/[A-Za-zéè ]+ \(\d+\)/g) || []).join(', '));
await p.click('#impRes button:has-text("Intégrer la sélection")'); await p.waitForSelector('a.btn:has-text("Budget")');
const man = await p.evaluate(() => window.__carnet.T.trip.budgetManuel || {});
ok('Budget prévu enregistré par catégorie', man.vol === 80000 && man.logement === 100000 && man.voiture === 30000, JSON.stringify(man));
gemMode = 'ok';
await p.evaluate(() => localStorage.removeItem('carnet.geminiKey'));

// --- Programme papier depuis l'accueil
await p.goto('http://localhost:8126/#/'); await p.waitForSelector('button.tile:has-text("Programme papier")');
await p.click('button.tile:has-text("Programme papier")'); await p.waitForSelector('#sheet button.item:has-text("Crète ' + year + '")');
fc = p.waitForEvent('filechooser');
await p.click('#sheet button.item:has-text("Crète ' + year + '")');
await (await fc).setFiles([PHOTO]);
await p.waitForSelector('.item:has-text("icon-512.png")', { timeout: 10000 });
ok('Programme papier : voyage choisi, photo ajoutée à l\'import', /Importer des documents/.test(await p.innerText('.topbar')) && /Crète/.test(await p.evaluate(() => window.__carnet.T.trip.name)));
ok('Programme papier sans clé : la clé Gemini est proposée', await p.isVisible('a.btn:has-text("Ajouter la clé Gemini")'));
await shot('n5-programme-papier');

// --- Réglages : carte de la clé Gemini
await p.evaluate(() => localStorage.setItem('carnet.anthropicKey', JSON.stringify('sk-ant-ancienne')));
await p.goto('http://localhost:8126/#/reglages'); await p.reload(); await p.waitForSelector('text=Lecture des photos');
ok('Réglages sans clé : lien pour obtenir une clé gratuite', await p.isVisible('a[href="https://aistudio.google.com/apikey"]'));
await p.fill('input[name=key]', ' AIzaTest-cle-fictive-1111111111111111 '); await p.click('button:has-text("Enregistrer la clé")');
await p.waitForSelector('text=Clé enregistrée');
ok('Réglages : clé enregistrée (espaces retirés), masquée', /Clé enregistrée · …1111/.test(sp(await p.innerText('#app'))) && !/AIzaTest/.test(await p.innerText('#app')) && await p.evaluate(() => JSON.parse(localStorage.getItem('carnet.geminiKey'))) === 'AIzaTest-cle-fictive-1111111111111111');
await p.click('button:has-text("Tester")'); await p.waitForSelector('text=Clé valide', { timeout: 8000 }).catch(() => {});
ok('Réglages : « Tester » vérifie la clé', /Clé valide/.test(await p.innerText('body')));
ok('Ancienne clé Claude effacée de l\'appareil', await p.evaluate(() => localStorage.getItem('carnet.anthropicKey') === null));

// --- Z Fold déplié
await p.setViewportSize({ width: 884, height: 1104 }); await p.goto('http://localhost:8126/#/'); await p.waitForSelector('.tiles');
ok('Déplié : tuiles sur une ligne, pas de défilement horizontal', await noHScroll() && await p.evaluate(() => { const t = [...document.querySelectorAll('.tile')]; return t.length === 4 && t.every(x => Math.abs(x.getBoundingClientRect().top - t[0].getBoundingClientRect().top) < 2); }));
await shot('n6-accueil-deplie');

ok('Aucune erreur JavaScript', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close(); server.close();
const failed = results.filter(r => !r.ok);
console.log('\n' + (results.length - failed.length) + ' / ' + results.length + ' contrôles OK');
process.exit(failed.length ? 1 : 0);
