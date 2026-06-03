# Synchronisation (optionnelle)

L'application fonctionne **sans aucune configuration** : tout est stocké dans
le `localStorage` du navigateur (offline-first). La synchronisation est une
surcouche facultative qui sauvegarde les données sur un backend et les
réplique entre appareils. Tant qu'aucun backend n'est configuré, **aucun SDK
n'est chargé** et l'app reste 100 % hors-ligne.

## Architecture

```
favoris (UI)  ─►  localStorage              (toujours, source rapide)
                       │
                       ▼
            assets/sync/engine.js            moteur agnostique
              · interception localStorage    (LWW par clé + tombstones)
              · merge / debounce / registry
                       │
                       ▼
            assets/sync/adapter-appwrite.js  client provider (lazy SDK)
                       │
                       ▼
                   Appwrite Cloud
```

| Fichier | Rôle |
|---|---|
| `engine.js` | Moteur générique : interception des écritures, fusion LWW, tombstones, registry, persistance de la config/méta. Ne connaît aucun provider. |
| `adapter-appwrite.js` | Seul code spécifique à un backend. Implémente le contrat `RemoteAdapter`. |
| `ui.js` | Bouton topbar + modale (choix backend / connexion / état). |
| `index.js` | Enregistre les adapters, démarre le moteur, branche l'UI. |

### Ce qui est synchronisé
- `favoris.spaces` (index des espaces)
- `favoris.v1:<id>` (données de chaque espace : tags + liens)

### Ce qui reste local à l'appareil
- `favoris.theme` (thème clair/sombre)
- `favoris.currentSpace` (espace affiché)
- `favoris.remote.config` et `favoris.sync.meta` (réglages de sync)

## Stockage de la configuration — note de sécurité

La config (`endpoint`, IDs de projet) est stockée **en clair** dans
`localStorage`. Ce ne sont **pas** des secrets : ces identifiants sont publics
par conception et protégés côté serveur par l'allowlist de plateformes web et
les permissions par document. Le **jeton de session** (après connexion) est
géré par le SDK Appwrite lui-même.

> ⚠️ Ne jamais saisir de clé **secrète / API admin** dans le formulaire : dans
> une app purement front, aucune valeur ne peut être réellement cachée.

## Mettre en place le backend Appwrite

1. **Créer un projet** sur [Appwrite Cloud](https://cloud.appwrite.io),
   région **Frankfurt** (`https://fra.cloud.appwrite.io/v1`).
2. **Déclarer une plateforme Web** par domaine qui héberge l'app
   (ex. `localhost`, `favoris.mondomaine.fr`). Un sous-domaine = une
   plateforme distincte. C'est ce qui autorise le CORS et le retour du
   magic-link.
3. **Activer l'auth Magic URL** (Auth → Settings).
4. **Créer une base** (ex. `main`) et une **collection** `app_state` avec
   **Document Security activée** et les attributs :

   | Attribut | Type | Taille / détail |
   |---|---|---|
   | `app` | String | 64 |
   | `key` | String | 255 |
   | `data` | String | ~1 000 000 (le blob JSON) |
   | `updatedAt` | Integer | horodatage ms |
   | `deleted` | Boolean | défaut `false` |

   Permissions de collection : aucune permission globale (la sécurité est
   au niveau document, posée automatiquement par le client à la création).
   Index conseillé : sur `app` + `key`.

5. **Configurer l'app** : bouton ☁️ dans la barre → *Appwrite Cloud* →
   renseigner `endpoint`, `Project ID`, `Database ID` (`main`),
   `Collection ID` (`app_state`) → *Enregistrer* → se connecter par email.

## Réutiliser sur un autre site

Copier `public/assets/sync/` tel quel, ajouter le bouton `#sync-btn` et le
`<script type="module" src="assets/sync/index.js">`, puis changer **une seule
ligne** dans `index.js` :

```js
sync.app = 'mon-autre-site'; // namespace distinct dans la MÊME collection
```

Le même projet Appwrite (et la même collection `app_state`) sert alors tous
les sites ; les données sont cloisonnées par `app` et par utilisateur.

## Limites connues (stratégie LWW par espace)

- **Édition concurrente du même espace** sur deux appareils → le dernier
  enregistrement écrase l'autre (pas de fusion fine par lien). Acceptable
  pour un usage mono-utilisateur.
- **Index des espaces** (`favoris.spaces`) en LWW : créer un espace sur deux
  appareils hors-ligne en parallèle peut perdre l'un des deux ajouts au
  prochain merge. Les suppressions, elles, sont propres (tombstones).
- L'horodatage LWW utilise l'**horloge de l'appareil** : des horloges très
  désynchronisées peuvent fausser l'arbitrage.

## Version du SDK

`adapter-appwrite.js` épingle `https://esm.sh/appwrite@18`. Si l'API du SDK
change, ajuster cette URL en tête de fichier.
