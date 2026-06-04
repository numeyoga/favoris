// Test double du stockage remote pour les tests e2e.
//
// Plutôt que de parler à Appwrite (réseau + SDK), on injecte dans la page un
// adapter « mémoire » conforme au contrat attendu par le moteur. Le contenu
// distant vit dans window.__remoteStore, inspectable depuis les tests.

// Installe l'adapter mémoire et active la synchronisation (utilisateur simulé).
export async function installMemorySync(page) {
  await page.evaluate(() => {
    const store = {};
    window.__remoteStore = store;
    window.favorisSync.register({
      id: 'memory',
      label: 'Mémoire (e2e)',
      async init() {},
      async currentUser() {
        return { id: 'u1', email: 'e2e@test.local' };
      },
      async signIn() {},
      async signOut() {},
      async pull() {
        return JSON.parse(JSON.stringify(store));
      },
      async push(_app, key, value, t) {
        store[key] = { value, updatedAt: t, deleted: false };
      },
      async remove(_app, key, t) {
        store[key] = { value: store[key] ? store[key].value : null, updatedAt: t, deleted: true };
      },
    });
    return window.favorisSync.applyConfig({ provider: 'memory', settings: {} });
  });
}

// Force l'envoi immédiat des écritures en attente (court-circuite le debounce).
export async function flushSync(page) {
  await page.evaluate(() => window.favorisSync.pushDirty());
}

// Renvoie l'intégralité du stockage distant simulé.
export async function getRemote(page) {
  return page.evaluate(() => window.__remoteStore);
}

// Renvoie les ids des espaces présents dans l'index distant (triés).
export async function remoteSpaceIds(page) {
  return page.evaluate(() => {
    const e = window.__remoteStore['favoris.spaces'];
    return e && !e.deleted
      ? JSON.parse(e.value)
          .map((s) => s.id)
          .sort()
      : [];
  });
}
