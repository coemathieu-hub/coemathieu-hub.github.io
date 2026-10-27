// Test de synchro réelle entre deux appareils, contre les émulateurs Firebase
// (Firestore + Auth) chargés avec firestore.rules.
// Prérequis : firebase emulators:start --only firestore,auth --project demo-carnet
//             (Firestore 127.0.0.1:8180, Auth 127.0.0.1:9199)
// Usage : DEVLIBS=… node tests/e2e-sync.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = process.env.DEVLIBS; const OUT = process.env.OUT || '/tmp/carnet-e2e'; mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p); if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(8125);
const MAP = [
  [/gstatic\.com\/firebasejs\/12\.19\.0\/(firebase-[a-z-]+\.js)$/, m => join(LIB, 'firebase', m[1])],
  [/leaflet@1\.9\.4\/dist\/(leaflet\.(js|css))$/, m => join(LIB, 'leaflet/dist', m[1])],
  [/qrcode-generator@2\.0\.4\/dist\/qrcode\.mjs$/, () => join(LIB, 'qrcode-generator/dist/qrcode.mjs')],
];
const results = []; const ok = (n, c, x) => { results.push({ n, ok: !!c }); console.log((c ? '✔ ' : '✘ ') + n + (x ? ' — ' + x : '')); };
const sp = s => String(s).replace(/[  ]/g, ' ');
const CFG = { apiKey: 'demo-key', authDomain: 'demo-carnet.firebaseapp.com', projectId: 'demo-carnet', appId: '1:1:web:demo' };
const browser = await chromium.launch();
const errors = [];
async function device(name, w = 390) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, route => {
    const u = route.request().url();
    for (const [re, fn] of MAP) { const m = u.match(re); if (m) { const f = fn(m); return route.fulfill({ status: 200, contentType: MIME[extname(f)] || 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: readFileSync(f) }); } }
    return route.abort('internetdisconnected');
  });
  await ctx.addInitScript(cfg => { if (!localStorage.getItem('carnet.firebaseConfig')) { localStorage.setItem('carnet.firebaseConfig', JSON.stringify(cfg)); localStorage.setItem('carnet.emulator', JSON.stringify({ host: '127.0.0.1', fs: 8180, auth: 9199 })); } }, CFG);
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(name + ': ' + e.message));
  if (process.env.DEBUG) p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('   [' + name + ' ' + m.type() + '] ' + m.text().slice(0, 300)); });
  return { ctx, p };
}
const A = await device('Hugo'); const B = await device('Sam');
// A : famille + voyage synchronisé
await A.p.goto('http://localhost:8125/');
await A.p.waitForSelector('text=synchro cloud active', { timeout: 20000 });
ok('Appareil A connecté au cloud (connexion anonyme)', true);
await A.p.evaluate(() => { localStorage.setItem('carnet.famille', JSON.stringify([{ name: 'Hugo', birth: '1985-03-04', participe: true }, { name: 'Sam', birth: '1986-10-21', participe: true }, { name: 'Léa', birth: '2018-12-05', participe: false }, { name: 'Noé', birth: '2024-11-20', participe: false }])); localStorage.setItem('carnet.myName', 'Hugo'); });
await A.p.goto('http://localhost:8125/#/nouveau'); await A.p.waitForSelector('text=Créer le voyage');
await A.p.fill('input[name=name]', 'Synchro test'); await A.p.fill('input[name=dateStart]', '2027-02-10'); await A.p.fill('input[name=dateEnd]', '2027-02-14');
ok('Choix « Synchronisé » proposé', await A.p.isVisible('text=Synchronisé : partageable'));
await A.p.click('button:has-text("Créer le voyage")');
await A.p.waitForFunction(() => location.hash.includes('/v/cloud/'), null, { timeout: 15000 });
const tripHash = await A.p.evaluate(() => location.hash);
const base = tripHash.split('/').slice(0, 4).join('/');
ok('Voyage créé dans le cloud', base.includes('/v/cloud/'), base);
// A : une étape et une dépense
await A.p.goto('http://localhost:8125/' + base + '/jour/2027-02-11'); await A.p.waitForSelector('.main >> text=Jeudi 11 février', { timeout: 15000 });
await A.p.click('button:has-text("Ajouter une étape")'); await A.p.fill('#sheet input[name=name]', 'Musée des glaces'); await A.p.click('#sheet button:has-text("Enregistrer")');
await A.p.waitForSelector('.main >> text=Musée des glaces');
await A.p.goto('http://localhost:8125/' + base + '/depenses'); await A.p.waitForSelector('text=Mes dépenses');
if (await A.p.isVisible('button.chip:has-text("Hugo")')) await A.p.click('button.chip:has-text("Hugo")');
await A.p.click('button.fab'); for (const k of ['1', '2', '0']) await A.p.click('#qe .keypad button:text-is("' + k + '")'); await A.p.click('#qe button:has-text("Enregistrer")');
await A.p.waitForTimeout(800);
// Lien d'invitation
await A.p.goto('http://localhost:8125/' + base + '/membres'); await A.p.waitForSelector('text=Inviter quelqu');
const link = await A.p.evaluate(() => { const T = window.__carnet.T; return location.origin + location.pathname + '#/rejoindre/' + T.id + '/' + T.trip.inviteToken; });
ok('Lien d\'invitation généré', /#\/rejoindre\/[A-Za-z0-9]+\/[A-Za-z0-9]+/.test(link));
await A.p.waitForSelector('#qr svg', { timeout: 8000 }).catch(() => {});
ok('QR code affiché', await A.p.isVisible('#qr svg'));
// B rejoint
await B.p.goto(link.replace('8125', '8125')); await B.p.waitForSelector('text=Ton prénom', { timeout: 20000 });
await B.p.fill('input[name=name]', 'Sam'); await B.p.click('button:has-text("Rejoindre")');
await B.p.waitForSelector('text=Qui es-tu sur cet appareil', { timeout: 20000 });
ok('Appareil B a rejoint sans inscription', true);
await B.p.click('#sheet button:has-text("Sam")'); await B.p.waitForTimeout(500);
await B.p.goto('http://localhost:8125/' + base + '/jour/2027-02-11'); await B.p.waitForSelector('.main >> text=Musée des glaces', { timeout: 15000 });
ok('B voit l\'étape créée par A', true);
await B.p.goto('http://localhost:8125/' + base + '/depenses'); await B.p.waitForSelector('text=Total des dépenses');
ok('B voit la dépense de A (120,00 €)', sp(await B.p.innerText('#app')).includes('120,00 €'));
ok('B : « Mes dépenses » = sa quote-part (60,00 €)', sp(await B.p.innerText('#app')).includes('60,00 €'));
// B ajoute une dépense → A la voit en temps réel
await B.p.click('button.fab'); for (const k of ['3', '0']) await B.p.click('#qe .keypad button:text-is("' + k + '")'); await B.p.click('#qe button:has-text("Enregistrer")');
await A.p.goto('http://localhost:8125/' + base + '/depenses');
await A.p.waitForFunction(() => document.querySelector('#app').innerText.replace(/[  ]/g, ' ').includes('150,00 €'), null, { timeout: 15000 }).catch(() => {});
ok('A reçoit la dépense de B en temps réel (total 150,00 €)', sp(await A.p.innerText('#app')).includes('150,00 €'));
// Équilibres identiques sur les deux appareils
await A.p.goto('http://localhost:8125/' + base + '/equilibres'); await B.p.goto('http://localhost:8125/' + base + '/equilibres');
await A.p.waitForSelector('text=Soldes'); await B.p.waitForSelector('text=Soldes');
const ea = sp(await A.p.innerText('#app')), eb = sp(await B.p.innerText('#app'));
ok('Équilibres cohérents : A « On vous doit 45,00 € », B « Vous devez 45,00 € »', ea.includes('On vous doit 45,00 €') && eb.includes('Vous devez 45,00 €'));
ok('Somme des soldes = 0,00 € (A et B)', ea.includes('somme des soldes = 0,00 €') && eb.includes('somme des soldes = 0,00 €'));
// Hors ligne sur B : saisie en attente puis envoi au retour du réseau
await B.p.goto('http://localhost:8125/' + base + '/depenses'); await B.p.waitForSelector('text=Total des dépenses');
await B.ctx.setOffline(true);
await B.p.click('button.fab'); for (const k of ['1', '0']) await B.p.click('#qe .keypad button:text-is("' + k + '")'); await B.p.click('#qe button:has-text("Enregistrer")');
await B.p.waitForTimeout(1200);
const off = sp(await B.p.innerText('#app'));
ok('Hors ligne : dépense visible localement (160,00 €)', off.includes('160,00 €'));
ok('Hors ligne : badge « en attente »', /Hors ligne|en attente/.test(off));
await B.ctx.setOffline(false);
await A.p.goto('http://localhost:8125/' + base + '/depenses');
await A.p.waitForFunction(() => document.querySelector('#app').innerText.replace(/[  ]/g, ' ').includes('160,00 €'), null, { timeout: 20000 }).catch(() => {});
ok('Retour du réseau : A reçoit la dépense faite hors ligne', sp(await A.p.innerText('#app')).includes('160,00 €'));
// Modification simultanée du même champ : rien de perdu (historique)
const stepId = await A.p.evaluate(() => Object.values(window.__carnet.T.steps).find(s => s.name === 'Musée des glaces').id);
await Promise.all([
  A.p.evaluate(id => window.__carnet.write([{ coll: 'steps', id, patch: { notes: 'Note de Hugo' } }]), stepId),
  B.p.evaluate(id => window.__carnet.write([{ coll: 'steps', id, patch: { notes: 'Note de Sam' } }]), stepId),
]);
await A.p.waitForTimeout(2500);
const na = await A.p.evaluate(id => window.__carnet.T.steps[id].notes, stepId), nb = await B.p.evaluate(id => window.__carnet.T.steps[id].notes, stepId);
ok('Modifs simultanées : les deux appareils convergent', na === nb, na);
await A.p.goto('http://localhost:8125/' + base + '/historique'); await A.p.waitForSelector('text=Note de Sam', { timeout: 10000 }).catch(() => {});
const hist = await A.p.innerText('#app');
ok('Historique : les deux versions sont conservées', hist.includes('Note de Hugo') && hist.includes('Note de Sam'));
const kinds = await A.p.evaluate(async id => (await window.__carnet.Cloud.loadHistory(id)).map(h => h.coll + ':' + h.op), base.split('/')[3]);
ok('Historique : création notée « création », sans faux changement', kinds.includes('steps:create') && kinds.includes('expenses:create') && !kinds.includes('expenses:update'), kinds.join(' '));
await A.p.screenshot({ path: join(OUT, 'sync-historique.png'), fullPage: true });
// Sécurité : un appareil sans invitation n'accède à rien
const C = await device('Intrus');
await C.p.goto('http://localhost:8125/' + base + '/programme');
await C.p.waitForSelector('text=Voyage indisponible', { timeout: 20000 }).catch(() => {});
ok('Sécurité : appareil non invité refusé', await C.p.isVisible('text=Voyage indisponible'));
const tripId = base.split('/')[3];
const bad = await C.p.evaluate(async id => { try { await window.__carnet.Cloud.joinTrip(id, 'mauvais-code', 'X'); return 'accepté'; } catch (e) { return e.code || e.message; } }, tripId);
ok('Sécurité : mauvais code d\'invitation refusé', /permission/.test(bad), bad);
// Rotation du lien par le créateur : l'ancien lien ne marche plus
await A.p.evaluate(() => window.__carnet.write([{ coll: '', id: window.__carnet.T.id, patch: { inviteToken: 'nouveau' + Date.now() } }]));
await A.p.waitForTimeout(1500);
const oldTok = link.split('/').pop();
const D = await device('Ancien lien');
await D.p.goto('http://localhost:8125/'); await D.p.waitForSelector('text=synchro cloud active', { timeout: 20000 });
const res = await D.p.evaluate(async ([id, tok]) => { try { await window.__carnet.Cloud.joinTrip(id, tok, 'Y'); return 'accepté'; } catch (e) { return e.code || e.message; } }, [tripId, oldTok]);
ok('Sécurité : lien remplacé → ancien code refusé', /permission/.test(res), res);
// Un membre ne peut pas changer le code ni supprimer le voyage
const r2 = await B.p.evaluate(async id => { const C = window.__carnet.Cloud; try { await C.fb.setDoc(C.ref(id), { inviteToken: 'pirate' }, { mergeFields: ['inviteToken'] }); return 'accepté'; } catch (e) { return e.code || e.message; } }, tripId);
ok('Sécurité : un membre ne peut pas changer le lien d\'invitation', /permission/.test(r2), r2);
const r3 = await B.p.evaluate(async id => { const C = window.__carnet.Cloud; try { await C.fb.deleteDoc(C.ref(id)); return 'accepté'; } catch (e) { return e.code || e.message; } }, tripId);
ok('Sécurité : un membre ne peut pas supprimer le voyage', /permission/.test(r3), r3);
ok('Aucune erreur JavaScript', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close(); server.close();
const failed = results.filter(r => !r.ok);
console.log('\n' + (results.length - failed.length) + ' / ' + results.length + ' contrôles OK');
process.exit(failed.length ? 1 : 0);
