# Carnet de voyage

Application familiale pour préparer, vivre et clôturer un voyage :

- programme jour par jour, avec des activités cotées `+` / `++` / `+++` et des conseils du jour ;
- itinéraire et temps de route estimés ;
- Jour J (trajet domicile ↔ aéroport) et voiture de location ;
- dépenses partagées (comme Tricount) ;
- budget prévu et réel, récap de fin de voyage ;
- historique des voyages ;
- import de documents d'un voyage passé ou à venir (budget Word ou Excel, programme tapé ou manuscrit, mails, notes) : un bouton « Analyser », puis récap complet (budget, organisation, programme, notes) ;
- aéroports proposés pendant la saisie (code, ville, pays) ;
- exports Word et impression.

Elle est en ligne sur <https://coemathieu-hub.github.io/>. Elle s'installe sur l'écran d'accueil (PWA) ou en APK : voir **[TUTO_APK.md](TUTO_APK.md)** ([version page web](tuto-apk.html)).

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | **Toute l'app** (HTML, CSS et JS en un seul fichier, en sections numérotées commentées en français). |
| `manifest.webmanifest` | Description de l'app pour l'installation. |
| `sw.js` | Service worker : garde l'app et ses bibliothèques pour le hors ligne. |
| `icons/` | Icônes (192, 512, 512 adaptative, 180 pour iPhone). |
| `data/aeroports.json` | Base des aéroports (3 220 aéroports avec vols commerciaux) : code IATA, nom, ville, pays, fuseau horaire, coordonnées. |
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
- **Import de documents, automatique.** Chaque document ajouté (photo, fichier, dépôt) est analysé aussitôt, sans bouton à presser ; « Analyser à nouveau » sert pour un texte collé :
  - sans clé Gemini, l'analyse se fait sur le téléphone, gratuitement et hors ligne (section 1.11 bis) : dates et nom du voyage, lignes de budget (« Libellé : 120 euros », compléments, total indiqué contrôlé), programme daté (jours, cotations, horaires, prix), rappels en conseils, le reste en notes ;
  - avec une clé Gemini (gratuite, Réglages), tous les documents sont lus par l'API Gemini, y compris photos, scans et écriture manuscrite : appel REST direct `generateContent` (alias `gemini-flash-latest`, repli `gemini-flash-lite-latest` puis modèle « flash » listé pour la clé), réponse JSON exigée. Si Gemini échoue (quota, réseau), l'analyse du téléphone prend le relais et l'erreur est affichée avec « Réessayer » ;
  - dans tous les cas, le résultat (format `carnet/1`) est validé puis montré en aperçu avant intégration. Pour un voyage à venir, un budget devient le budget prévu ; pour un voyage passé, des dépenses pour information.
- **Clé Gemini (facultative).** Elle reste sur l'appareil : ni synchronisée ni sauvegardée, envoyée uniquement dans l'en-tête `x-goog-api-key`. Les documents analysés partent chez Google : conditions de l'offre gratuite (quotas, usage des données, règles propres à l'Union européenne) à vérifier sur ai.google.dev/gemini-api/terms.
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
| API Gemini (Google) | Lecture des documents importés (photos, scans, manuscrits) | Facultative, clé personnelle saisie sur l'appareil |

## Données intégrées

| Données | Source | Licence |
| --- | --- | --- |
| Aéroports (`data/aeroports.json`) | [OurAirports](https://ourairports.com/data/), instantané 2023, aéroports avec code IATA et vols commerciaux | Domaine public |
| Fuseaux horaires des aéroports | Calculés depuis les coordonnées avec [tz-lookup](https://github.com/photostructure/tz-lookup) | CC0 |

## Bibliothèques (versions figées)

Firebase JS 12.19.0 · Leaflet 1.9.4 · qrcode-generator 2.0.4 · pdf.js 6.3.289 · docx 9.8.1 · postal-mime 4.0.3 · msgreader 1.28.0 · SheetJS 0.18.5 (via jsDelivr et gstatic). L'API Gemini est appelée en REST, sans SDK. Les documents Word (.docx) et OpenDocument (.odt) sont lus sans bibliothèque, avec le décompresseur du navigateur.

## Développement

- `index.html` est le fichier de référence : on le modifie directement.
- Tests du cœur métier (famille et voyages fictifs) : `node --test tests/core.test.mjs`.
- Test de synchro entre deux appareils, contre les émulateurs Firebase (Firestore + Auth, chargés avec `firestore.rules`) :
  - lancer `firebase emulators:start --only firestore,auth --project demo-carnet` (Firestore sur le port 8180, Auth sur 9199) ;
  - puis `DEVLIBS=<node_modules avec les bibliothèques ci-dessus> node tests/e2e-sync.mjs` ;
  - il vérifie : invitation, synchro en temps réel, hors ligne puis renvoi, historique, refus des intrus.
- Test des nouveautés (accueil, aéroports, voyage passé depuis des documents, analyse automatique, Gemini simulé et repli en cas de quota atteint, programme papier) : `DEVLIBS=… node tests/e2e-nouveautes.mjs`.
- Chromium et Playwright sont nécessaires pour les tests de bout en bout. Les services externes y sont coupés, ce qui vérifie aussi les replis hors ligne.
- Le test de recette sur les vrais voyages utilise le fichier de départ privé. Il reste hors du dépôt (`.gitignore`).
