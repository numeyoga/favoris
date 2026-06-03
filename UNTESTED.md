# Fonctionnalités non couvertes par les tests automatisés

Les tests unitaires (Vitest) couvrent toute la **logique pure** de l'application
(`public/assets/core.js`) et le **moteur de synchronisation** (`public/assets/sync/engine.js`).
Voir `tests/core.test.js` et `tests/sync-engine.test.js`, qui servent aussi de
documentation exécutable.

Les éléments ci-dessous ne sont **pas** couverts par des tests automatisés, soit
parce qu'ils dépendent fortement du DOM/navigateur, soit parce qu'ils touchent un
service réseau externe. Ils sont à vérifier manuellement (voir « Vérification
manuelle » plus bas).

## Interface (DOM) — `public/favoris.html`

- **Rendu** : `render()`, `renderSpaceChip()`, regroupement des liens par tag,
  cartes de tags, état vide, état « aucun résultat ».
- **Menu des espaces** : `openSpaceMenu()` / `renderList()` — affichage, sélection,
  renommage en ligne, duplication, suppression, bascule de synchronisation (☁️),
  indicateur `· local`.
- **Modales** : ajout/édition de lien (`openLinkModal`), édition de tag, et la
  modale de synchronisation (`public/assets/sync/ui.js`).
- **Glisser-déposer** : le câblage DOM des événements `dragstart`/`dragover`/`drop`
  pour réordonner liens et cartes. _La transformation pure sous-jacente
  (`moveItem`) est, elle, testée dans `core.js`._
- **Barre d'outils** : recherche (champ), bascule mode édition, bascule de thème
  clair/sombre et sa persistance (`favoris.theme`), raccourcis clavier.
- **Presse-papier / toasts** : `copyText()`, `toast()`.

## Persistance et amorçage — `public/favoris.html`

- `ensureSpaces()` (migration depuis l'ancienne clé unique `favoris.v1`),
  `loadSpaces` / `saveSpaces`, `loadCurrentSpaceId` / `setCurrentSpace`,
  `loadData` / `save`, `spaceLinkCount`.
  Ces fonctions sont couplées au `localStorage` réel et à l'état mutable du module ;
  leur logique de fond (formes de données) est testée indirectement via `core.js`.

## Synchronisation — couche réseau

- `public/assets/sync/adapter-appwrite.js` : client Appwrite (SDK chargé en lazy),
  authentification par magic-link (`signIn`, `completeFromUrl`), `pull`/`push`/`remove`.
  Non testé car dépendant du réseau et du SDK externe ; exclu de la couverture.
- `public/assets/sync/index.js` : point d'entrée (enregistrement de l'adapter,
  démarrage, branchement UI).
- `public/assets/sync/ui.js` : modale de configuration/connexion/état.

## Vérification manuelle

1. Servir le dossier : `python3 -m http.server` dans `public/`, ouvrir `favoris.html`.
2. Créer/renommer/dupliquer/supprimer des espaces ; ajouter/éditer/supprimer des
   liens et des tags ; réordonner par glisser-déposer ; rechercher ; basculer le
   thème ; basculer un espace en synchronisé/local (☁️).
3. Pour la synchronisation réseau, suivre `DOCS-SYNC.md` (backend Appwrite), ou
   injecter un adapter mémoire en console comme dans `tests/sync-engine.test.js`.
