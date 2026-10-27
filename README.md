# Carnet de voyage

Application familiale pour préparer, vivre et clôturer un voyage :

- programme jour par jour, avec des activités cotées `+` / `++` / `+++` et des conseils du jour ;
- itinéraire et temps de route estimés ;
- Jour J (trajet domicile ↔ aéroport) et voiture de location ;
- dépenses partagées (comme Tricount) ;
- budget prévu et réel, récap de fin de voyage ;
- exports Word et impression.

Elle est en ligne sur <https://coemathieu-hub.github.io/>. Elle s'installe sur l'écran d'accueil (PWA) ou en APK : voir **[TUTO_APK.md](TUTO_APK.md)** ([version page web](tuto-apk.html)).

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | **Toute l'app** (HTML, CSS et JS en un seul fichier, en sections numérotées commentées en français). |
| `manifest.webmanifest` | Description de l'app pour l'installation. |
| `sw.js` | Service worker : garde l'app et ses bibliothèques pour le hors ligne. |
| `icons/` | Icônes (192, 512, 512 adaptative, 180 pour iPhone). |
| `firestore.rules` | Règles de sécurité Firestore, à coller dans la console Firebase. |
| `android/` | Projet de l'APK (Trusted Web Activity). La clé `keystore.p12` y est ajoutée, chiffrée, par le workflow. |
| `.github/workflows/apk.yml` | Fabrication, signature et publication de l'APK sur GitHub. |
| `.well-known/assetlinks.json` | Vérification APK ↔ site (générée par le workflow). |
| `tests/` | Tests du cœur métier (Node) et de bout en bout (Playwright). |

## Fonctionnement

- **Hors ligne d'abord.**
  - Un voyage est soit **local** (IndexedDB, sur l'appareil), soit **synchronisé** (Firestore, avec son cache permanent).
  - Les modifications faites sans réseau attendent et repartent au retour du réseau.
  - Chaque élément (étape, dépense, conseil…) est un document séparé, modifié champ par champ et historisé ; les suppressions passent par une corbeille.
- **Accès sans inscription.**
  - Connexion anonyme Firebase, puis invitation par lien ou QR code contenant un code secret.
  - Les règles Firestore n'ouvrent un voyage qu'à ses membres.
- **Configuration cloud** : bloc `FIREBASE_CONFIG` (section 0 de `index.html`), ou collée dans **Réglages**, ou transmise par un lien d'invitation.
- **IA sans clé.** L'app prépare un prompt pour Claude. La réponse, au format `carnet/1` (documenté dans la section 1.11), est validée puis affichée en aperçu avant intégration.
- **Rien d'inventé.** Horaires, prix, règles locales, taux et infos pratiques sont saisis, importés ou marqués « à vérifier ». Les temps de route sont des **estimations OSRM sans trafic** (plus une marge famille), jamais présentés comme des temps Google.

## Données personnelles

Le dépôt est **public** : il ne contient **aucune donnée personnelle**. Prénoms, dates de naissance, voyages et domicile vivent sur les appareils et dans Firestore.

Le fichier de départ (famille et voyages archivés) est fourni à part. Il s'importe par **Restaurer** et ne doit pas être ajouté ici (voir `.gitignore`).

## Services externes (gratuits, sans clé)

| Service | Usage | Conditions respectées |
| --- | --- | --- |
| OpenStreetMap (tuiles) | Fond de carte | Attribution ; aucun téléchargement à l'avance ; hors ligne, seul le tracé enregistré s'affiche |
| OSRM (serveurs publics FOSSGIS) | Temps de route | 1 requête/s au plus, résultats gardés dans le voyage |
| Nominatim | Trouver un lieu | 1 requête/s au plus, sur demande seulement (pas d'autocomplétion), résultats mis en cache |
| Open-Meteo | Météo du jour | Usage non commercial, attribution CC BY 4.0 |
| Frankfurter | Taux de change BCE | Proposé, toujours modifiable |
| Google Maps | Navigation | Simples liens (3 étapes intermédiaires au plus par lien), sans API |

## Bibliothèques (versions figées)

Firebase JS 12.19.0 · Leaflet 1.9.4 · qrcode-generator 2.0.4 · pdf.js 6.3.289 · docx 9.8.1 · postal-mime 4.0.3 · msgreader 1.28.0 · SheetJS 0.18.5 (via jsDelivr et gstatic).

## Développement

- `index.html` est le fichier de référence : on le modifie directement.
- Tests du cœur métier (famille et voyages fictifs) : `node --test tests/core.test.mjs`.
- Test de synchro entre deux appareils, contre les émulateurs Firebase (Firestore + Auth, chargés avec `firestore.rules`) :
  - lancer `firebase emulators:start --only firestore,auth --project demo-carnet` (Firestore sur le port 8180, Auth sur 9199) ;
  - puis `DEVLIBS=<node_modules avec les bibliothèques ci-dessus> node tests/e2e-sync.mjs` ;
  - il vérifie : invitation, synchro en temps réel, hors ligne puis renvoi, historique, refus des intrus.
- Chromium et Playwright sont nécessaires pour les tests de bout en bout. Les services externes y sont coupés, ce qui vérifie aussi les replis hors ligne.
- Le test de recette sur les vrais voyages utilise le fichier de départ privé. Il reste hors du dépôt (`.gitignore`).
