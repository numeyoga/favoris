# Couverture des tests & fonctionnalités non couvertes

## Ce qui est couvert automatiquement

- **Tests unitaires (Vitest)** — `tests/*.test.js`
  - `tests/core.test.js` : logique pure (`public/assets/core.js`) — uid, slugify,
    favicon, makeSpaceId, isSpaceSynced, recherche, formes de données, suppression
    lien/tag, réorganisation (`moveItem`).
  - `tests/sync-engine.test.js` : moteur de synchronisation (`engine.js`) avec un
    test double mémoire — périmètre, invisibilité des espaces locaux, basculement,
    fusion d'index multi-appareils.
- **Tests de bout en bout (Playwright)** — `tests/e2e/*.spec.js`, navigateur réel
  - `app.spec.js` : amorçage, rendu des liens, recherche + état « aucun résultat »,
    ajout/suppression de lien, mode édition, bascule + persistance du thème,
    création/changement/renommage d'espace.
  - `sync.spec.js` : synchronisation par espace **via un test double du stockage
    remote** (adapter mémoire injecté dans la page, `tests/e2e/helpers/memory-sync.js`)
    — local par défaut, activation, tombstone à la mise en local, non-fuite du nom
    et du contenu d'un espace local, synchronisation manuelle.

Les tests servent aussi de **documentation exécutable** des fonctionnalités.

## Ce qui n'est pas couvert (et pourquoi)

- **Adapter Appwrite réel** (`public/assets/sync/adapter-appwrite.js`) et flux
  **magic-link** : dépendent du réseau et du SDK externe. Le _contrat_ qu'ils
  implémentent est, lui, exercé par le test double (unitaire et e2e).
- **Modale de synchronisation** (`public/assets/sync/ui.js`) : formulaire de
  configuration/connexion. La logique sous-jacente du moteur est couverte.
- **Gestes de glisser-déposer** (pointeur) : le câblage `dragstart`/`drop` n'est
  pas piloté en e2e (fragile en headless). La transformation pure `moveItem` est
  testée unitairement.
- **Import / Export JSON** et **« Tout effacer »** (menu ⋯) : non encore scriptés
  en e2e (manipulent le système de fichiers / des confirmations).

## Vérification manuelle (résiduelle)

Pour les points ci-dessus : servir `public/` (`node tests/e2e/static-server.mjs`
ou `python3 -m http.server`), puis tester import/export, glisser-déposer, et la
synchro réseau réelle en suivant `DOCS-SYNC.md`.
