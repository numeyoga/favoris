// ============================================================
// Point d'entrée de la synchronisation
// ============================================================
// Enregistre les adapters disponibles, démarre le moteur et branche l'UI.
// Pour réutiliser ce module sur un autre site : copier le dossier
// public/assets/sync/, ajuster `sync.app` (ci-dessous) et le bouton
// #sync-btn dans la page.

import { sync } from './engine.js';
import appwriteAdapter from './adapter-appwrite.js';
import { initUI } from './ui.js';

// Namespace de ce site dans la collection partagée.
sync.app = 'favoris';

// Registry : ajouter ici d'autres clients (supabase, pocketbase, …).
sync.register(appwriteAdapter);

// Expose pour debug / usage éventuel par l'app.
window.favorisSync = sync;

// Démarre : installe l'interception localStorage, restaure la session et
// effectue un premier pull si un backend est configuré + connecté.
sync.init().then(() => initUI(sync));
