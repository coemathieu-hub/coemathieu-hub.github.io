# Installer « Carnet de voyage » sur vos téléphones

## Ce que vous allez obtenir

- L'application **Carnet de voyage** en ligne à l'adresse <https://coemathieu-hub.github.io/>.
- Une **icône sur l'écran d'accueil** du Z Fold et des téléphones de la famille, qui ouvre l'app en plein écran.
- En option, un **fichier APK** à installer, comme une application classique.
- La **synchronisation** entre vos téléphones, et des invités qui rejoignent un voyage avec un simple lien.

**Temps estimé : environ 30 minutes la première fois**, tout depuis le téléphone :

- 10 min pour la mise en ligne et la synchro ;
- 5 min pour l'installation ;
- 15 min pour l'APK.

### Avant de commencer

- Le **Z Fold**, avec **Chrome** (déjà installé sur les téléphones Samsung).
- Votre **compte GitHub** (déjà créé) : <https://github.com>.
- Un **compte Google** pour Firebase : <https://console.firebase.google.com>.
- Un **gestionnaire de mots de passe**, par exemple celui de Google, intégré à Chrome, pour ranger un mot de passe important (étape 7).

> Les noms de boutons peuvent varier un peu selon la version de l'application ou du site. Cherchez le libellé le plus proche ; en cas de doute, la rubrique « Dépannage » est en fin de page.

---

## Partie 1 · Mettre l'app en ligne

**Mettre en ligne** veut dire publier l'app sur un **hébergement HTTPS** : un site web sécurisé, accessible depuis n'importe quel appareil. Ici, c'est **GitHub Pages**, gratuit.

### Étape 1 · Créer le dépôt GitHub

Un **dépôt** est le dossier en ligne qui contient les fichiers de l'app.

1. Ouvrez <https://github.com/new> dans Chrome.
2. Dans **Repository name**, tapez exactement :
   ```
   coemathieu-hub.github.io
   ```
3. Choisissez **Public**.
4. Cochez **Add a README file**.
5. Touchez **Create repository**.

**Vous devez voir** une page avec le nom `coemathieu-hub/coemathieu-hub.github.io` et un fichier `README.md`.
**Sinon** : si GitHub dit que le nom existe déjà, le dépôt est déjà créé. Passez à l'étape 2.

### Étape 2 · Prévenir Claude

1. Écrivez à Claude : « dépôt fait ».

Claude y dépose les fichiers de l'app. **Vous devez voir** ensuite, dans le dépôt, les fichiers `index.html`, `sw.js`, `manifest.webmanifest` et les dossiers `icons` et `android`.

### Étape 3 · Vérifier que le site s'affiche

1. Attendez 2 minutes après le dépôt des fichiers.
2. Ouvrez <https://coemathieu-hub.github.io/>.

**Vous devez voir** l'écran **Carnet de voyage**, avec les boutons « Nouveau voyage » et « Rejoindre ».

**Sinon (page 404)** :

1. Dans le dépôt, touchez **Settings**, puis **Pages** dans le menu.
2. Sous **Build and deployment**, choisissez **Deploy from a branch**.
3. Choisissez la branche **main** et le dossier **/ (root)**, puis touchez **Save**.
4. Attendez 2 minutes et rouvrez le lien.

### Étape 4 · Créer le projet Firebase (la synchro)

**Firebase** est le service gratuit de Google qui synchronise vos voyages entre les téléphones.

1. Ouvrez <https://console.firebase.google.com> et touchez **Créer un projet** (ou **Ajouter un projet**).
2. Nom : `carnet-de-voyage`. Touchez **Continuer**.
3. **Désactivez Google Analytics**, puis touchez **Créer le projet**.
4. Dans le menu, ouvrez **Créer** (ou **Build**) → **Firestore Database** → **Créer une base de données**.
   - Choisissez un emplacement en Europe, par exemple `europe-west9 (Paris)`.
   - Choisissez le **mode production**, puis **Créer**.
5. Dans le menu, ouvrez **Créer** → **Authentication** → **Commencer** → **Anonyme** → activez l'interrupteur → **Enregistrer**.
6. Touchez la **roue dentée** → **Paramètres du projet**. Sous **Vos applications**, touchez l'icône **Web `</>`**.
   - Surnom : `carnet`.
   - Ne cochez pas Hosting.
   - Touchez **Enregistrer l'application**.
7. Copiez le bloc qui commence par `const firebaseConfig = {` et envoyez-le à Claude. Ce n'est pas un secret.

**Vous devez voir**, à l'étape 7, un bloc contenant `apiKey`, `projectId` et `appId`.

### Étape 5 · Coller les règles de sécurité

Les **règles** décident qui peut lire quoi. Ici, seuls les membres d'un voyage y ont accès.

1. Dans Firebase, ouvrez **Firestore Database** → onglet **Règles**.
2. Effacez tout le texte affiché.
3. Collez les règles. Deux moyens de les obtenir :
   - dans l'app : **Réglages** → **Règles de sécurité Firestore** → **Copier les règles** ;
   - ou le fichier `firestore.rules` du dépôt.
4. Touchez **Publier**.

**Vous devez voir** « Règles publiées » ou une date de publication.
**Sinon** : si Firebase signale une erreur de syntaxe, vérifiez que tout le texte a été collé, du début (`rules_version`) à la dernière accolade.

---

## Partie 2 · Installer l'app sans APK (recommandé)

Une **PWA** (application web installable) est le site web lui-même, installé avec une icône. Elle fonctionne hors ligne et se met à jour toute seule.

### Étape 6 · Installer sur le Z Fold

1. Ouvrez <https://coemathieu-hub.github.io/> dans **Chrome**.
2. Touchez le menu **⋮** en haut à droite.
3. Touchez **Installer l'application**. Si ce choix n'apparaît pas, touchez **Ajouter à l'écran d'accueil**.
4. Confirmez avec **Installer**.

**Vous devez voir** l'icône bleue **Carnet de voyage** sur l'écran d'accueil. Ouverte depuis l'icône, l'app s'affiche **sans barre d'adresse**.
**Sinon** : si seul « Ajouter à l'écran d'accueil » existe, l'app fonctionne quand même. Ouvrez-la une fois en ligne pour qu'elle se garde pour le hors ligne.

C'est suffisant pour tout utiliser. L'APK (partie 3) est un **plus** : une vraie application Android dans la liste des applis.

---

## Partie 3 · Générer l'APK (fichier d'installation Android)

Un **APK** est le fichier d'installation d'une application Android. Celui-ci est une **TWA** (*Trusted Web Activity*) : une application qui affiche l'app en ligne en plein écran, sans barre d'adresse. Ses mises à jour viennent donc du site : **pas besoin de refaire l'APK** à chaque nouveauté.

### Étape 7 · Créer le mot de passe de la clé de signature

La **clé de signature** est la carte d'identité de votre APK : Android refuse une mise à jour qui n'est pas signée par la même clé. GitHub la crée pour vous ; vous ne choisissez que son mot de passe.

1. Inventez un mot de passe d'**au moins 16 caractères**, par exemple trois mots et des chiffres.
2. **Rangez-le tout de suite** dans votre gestionnaire de mots de passe, sous le nom `Carnet de voyage – clé APK`.
3. Dans le dépôt GitHub, ouvrez **Settings** → **Secrets and variables** → **Actions**.
4. Touchez **New repository secret**.
5. Dans **Name**, tapez exactement :
   ```
   KEYSTORE_PASSWORD
   ```
6. Dans **Secret**, collez votre mot de passe.
7. Touchez **Add secret**.

**Vous devez voir** `KEYSTORE_PASSWORD` dans la liste des secrets. GitHub ne vous le remontrera jamais : c'est normal.

### Étape 8 · Lancer la fabrication de l'APK

1. Dans le dépôt, touchez l'onglet **Actions**. Sur téléphone, il peut être dans le menu **⋯**.
2. Dans la liste à gauche (ou en haut), touchez **APK Android**.
3. Touchez **Run workflow**, laissez **main**, puis touchez le bouton vert **Run workflow**.
4. Attendez environ 5 minutes et rafraîchissez la page.

**Vous devez voir** une coche **verte** à côté de l'exécution.
**Sinon (croix rouge)** : prévenez Claude, qui lit le journal de fabrication, ou ouvrez l'exécution pour voir le message. La cause la plus fréquente est un secret absent ou mal nommé : refaites l'étape 7.

Lors de la première fabrication, GitHub crée la clé de signature, la range **chiffrée** dans le dépôt (`android/keystore.p12`) et publie le fichier de vérification `/.well-known/assetlinks.json`. Ce fichier permet à l'APK de s'afficher sans barre d'adresse.

### Étape 9 · Télécharger l'APK sur le Z Fold

1. Ouvrez ce lien dans Chrome :
   ```
   https://github.com/coemathieu-hub/coemathieu-hub.github.io/releases/latest/download/carnet-de-voyage.apk
   ```
2. Si Chrome avertit que « ce type de fichier peut être dangereux », touchez **Télécharger quand même**. C'est votre propre fichier.

**Vous devez voir** une notification « Téléchargement terminé : carnet-de-voyage.apk ».

### Étape 10 · Installer l'APK

1. Touchez la notification du téléchargement, ou ouvrez l'app **Mes fichiers** → **Téléchargements** → `carnet-de-voyage.apk`.
2. Si Android affiche « Pour votre sécurité, l'installation d'applications inconnues est bloquée » :
   1. touchez **Paramètres** ;
   2. activez **Autoriser à partir de cette source** pour Chrome (ou Mes fichiers) ;
   3. revenez en arrière.
3. Touchez **Installer**.
4. Si **Play Protect** affiche une alerte (« Application non sécurisée » ou « Développeur inconnu ») :
   1. touchez **Plus de détails** ;
   2. touchez **Installer quand même**.

   Si Play Protect propose d'**envoyer l'application pour analyse**, vous pouvez accepter ou refuser : cela ne change rien à l'installation.
5. Touchez **Ouvrir**.

**Vous devez voir** l'app en plein écran, **sans barre d'adresse**.
**Sinon (une barre avec l'adresse en haut)** : voir « Dépannage », point 1.

Par sécurité, vous pouvez ensuite désactiver « Autoriser à partir de cette source » (étape 10, point 2).

---

## Partie 4 · Les autres téléphones de la famille et les invités

### Un proche sur Android

1. Envoyez-lui le **lien d'invitation** du voyage. Dans l'app : **Plus** → **Membres et invitation** → **Partager**.
2. La personne installe l'app, au choix :
   - en **PWA** (étape 6) ;
   - ou avec l'**APK** (étapes 9 et 10) : envoyez-lui le lien de l'étape 9.
3. Elle ouvre le lien d'invitation, tape son prénom, puis **Rejoindre**.
4. Elle choisit son prénom à la question « Qui es-tu ? ».

Aucune inscription, aucun mot de passe. Avec l'APK installée, les liens d'invitation s'ouvrent directement dans l'app.

### Un invité sur iPhone (procédure séparée)

Sur iPhone, il n'y a pas d'APK : on installe la PWA depuis Safari. **Il faut installer avant de rejoindre**, car l'app installée ne partage pas ses données avec Safari.

1. Ouvrir le lien d'invitation dans **Safari** et toucher **Copier le lien**.
2. Toucher **Partager** (le carré avec une flèche vers le haut), puis **Sur l'écran d'accueil**, puis **Ajouter**.
3. Ouvrir **Carnet de voyage** depuis l'écran d'accueil.
4. Toucher **Rejoindre**, coller le lien, taper son prénom.

---

## Mises à jour

| Ce qui change | Que faire ? |
| --- | --- |
| Nouveautés de l'app (écrans, calculs, corrections) | **Rien** : la PWA et l'APK se mettent à jour seules à la réouverture. Pour forcer : **Réglages** → **Rechercher une mise à jour**. |
| Vos voyages | Synchronisés automatiquement entre les membres. |
| Nom de l'app, icône ou adresse du site | Relancer l'étape 8, puis réinstaller l'APK par-dessus (étapes 9 et 10). Vos données sont conservées. |

---

## À ne jamais perdre

> **Le mot de passe `KEYSTORE_PASSWORD`**, rangé dans votre gestionnaire de mots de passe et dans le secret GitHub.
>
> **La clé `android/keystore.p12`**, dans le dépôt GitHub. Elle est chiffrée par ce mot de passe. Téléchargez-en une copie dans Google Drive : dans le dépôt, ouvrez `android` → `keystore.p12` → **Download**.
>
> **Si vous les perdez** : impossible de mettre à jour l'APK installée. Il faudra la désinstaller et installer une nouvelle APK. Les voyages synchronisés ne sont pas perdus, ils sont dans Firebase, mais les modifications faites hors ligne et pas encore envoyées le seraient.
>
> **Vos voyages** : faites régulièrement une sauvegarde (**Réglages** → **Tout sauvegarder**) et rangez le fichier dans Google Drive. L'app vous le rappelle avant chaque départ et au retour.

---

## Dépannage

1. **Une barre d'adresse s'affiche en haut de l'APK.** Le site n'a pas encore publié le fichier de vérification, ou le téléphone l'a vérifié trop tôt.
   - Ouvrez <https://coemathieu-hub.github.io/.well-known/assetlinks.json> : vous devez voir un texte qui contient `sha256_cert_fingerprints`.
   - Si la page est introuvable, attendez 10 minutes.
   - Ensuite, désinstallez l'APK et réinstallez-la.
2. **« Application non installée » ou conflit lors d'une mise à jour.** L'ancienne APK a été signée avec une autre clé. Désinstallez l'ancienne version puis installez la nouvelle. Les voyages synchronisés reviennent.
3. **L'installation est bloquée.** Autorisez l'installation depuis Chrome ou Mes fichiers (étape 10, point 2). Si Play Protect bloque, touchez **Plus de détails** → **Installer quand même**.
4. **La fabrication de l'APK est en échec (croix rouge).** Vérifiez que le secret s'appelle exactement `KEYSTORE_PASSWORD` et fait au moins 12 caractères, puis relancez l'étape 8. Sinon, prévenez Claude : il lit le journal sur la branche `apk-logs`.
5. **L'app ne se synchronise pas.** Le badge en haut indique l'état :
   - **Hors ligne** ou **N en attente** : les modifications partiront au retour du réseau ;
   - **Local** : le voyage est sur ce téléphone seulement. Partagez-le avec **Plus** → **Partager ce voyage**.
   - Si un message parle de permissions, vérifiez les règles Firestore (étape 5).
6. **Le lien d'invitation ne fonctionne plus.** Le créateur du voyage a peut-être changé le lien. Demandez-lui un nouveau lien (**Plus** → **Membres et invitation**).
7. **L'app affiche une ancienne version.** Fermez-la complètement et rouvrez-la, en ligne. Ou **Réglages** → **Rechercher une mise à jour**.
8. **Sur iPhone, le voyage n'apparaît pas après avoir rejoint.** Le lien a été ouvert dans Safari et non dans l'app installée. Ouvrez l'app depuis l'écran d'accueil → **Rejoindre** → collez le lien.

---

## Mini-glossaire

| Terme | Explication |
| --- | --- |
| **APK** | Fichier d'installation d'une application Android. |
| **PWA** | Site web installable comme une application : icône, plein écran, hors ligne. |
| **TWA** | APK qui affiche un site de confiance en plein écran, sans barre d'adresse. |
| **Hébergement HTTPS** | Site web accessible de partout, avec une connexion sécurisée (le cadenas). |
| **GitHub Pages** | Hébergement gratuit de GitHub qui publie les fichiers du dépôt. |
| **Dépôt** | Dossier en ligne, sur GitHub, qui contient les fichiers de l'app. |
| **Manifeste** | Petit fichier qui décrit l'app au téléphone : nom, icône, couleurs. |
| **Service worker** | Petit programme qui garde l'app sur le téléphone pour qu'elle marche sans réseau. |
| **Clé de signature** | Carte d'identité de l'APK. Android n'accepte une mise à jour que si elle est signée par la même clé. |
| **Secret GitHub** | Valeur cachée (ici le mot de passe de la clé) que seuls les robots de GitHub peuvent lire. |
| **Workflow / Actions** | Robot de GitHub qui fabrique l'APK à votre place. |
| **Firebase / Firestore** | Service de Google qui stocke et synchronise les voyages. |
| **Play Protect** | Contrôle de sécurité d'Android qui avertit pour les applis installées hors Play Store. |
