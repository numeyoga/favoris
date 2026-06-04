// @vitest-environment node
//
// Tests du moteur de synchronisation (public/assets/sync/engine.js).
//
// Ces tests documentent le contrat du moteur : ce qui est synchronisé, ce qui
// reste local, et comment la synchronisation s'active/se désactive par espace.
// Un adapter « mémoire » remplace le backend réseau (Appwrite) afin que tout
// soit déterministe et hors-ligne.
//
// Environnement « node » volontaire : le moteur installe un shim en
// réassignant window.localStorage.setItem. Le Storage de jsdom est un Proxy
// non patchable ainsi ; on fournit donc un localStorage minimal en mémoire,
// fidèle au contrat réellement utilisé par le moteur.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { sync } from '../public/assets/sync/engine.js';

// localStorage en mémoire (le shim du moteur peut réassigner setItem dessus).
function makeLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i],
    get length() {
      return store.size;
    },
  };
}
const ls = makeLocalStorage();
globalThis.localStorage = ls;
globalThis.window = { localStorage: ls };
globalThis.document = { addEventListener() {}, hidden: false };

// --- Adapter mémoire : un dictionnaire { key: { value, updatedAt, deleted } }.
let remote;
const memoryAdapter = {
  id: 'memory',
  label: 'Mémoire (test)',
  async init() {},
  async currentUser() {
    return { id: 'u1', email: 'test@example.com' };
  },
  async signIn() {},
  async signOut() {},
  async pull() {
    return JSON.parse(JSON.stringify(remote));
  },
  async push(_app, key, value, t) {
    remote[key] = { value, updatedAt: t, deleted: false };
  },
  async remove(_app, key, t) {
    remote[key] = { value: remote[key] ? remote[key].value : null, updatedAt: t, deleted: true };
  },
};

const sp = (id, synced, label = id) => ({ id, label, synced });
const writeSpaces = (arr) => localStorage.setItem('favoris.spaces', JSON.stringify(arr));
const remoteSpaceIds = () =>
  JSON.parse(remote['favoris.spaces'].value)
    .map((s) => s.id)
    .sort();

beforeAll(async () => {
  sync.register(memoryAdapter);
  await sync.init(); // installe le shim localStorage une seule fois
});

beforeEach(async () => {
  localStorage.clear();
  remote = {};
  sync.meta = {};
  sync.config = null;
  sync.adapter = null;
  sync._user = null;
  sync._error = null;
  await sync.applyConfig({ provider: 'memory', settings: {} });
});

describe('Périmètre de synchronisation', () => {
  it("synchronise l'index des espaces et le contenu des espaces synchronisés", async () => {
    writeSpaces([sp('a', true)]);
    localStorage.setItem('favoris.v1:a', JSON.stringify({ links: [{ url: 'https://a' }] }));
    await sync.pushDirty();

    expect(remote['favoris.spaces']).toBeDefined();
    expect(remote['favoris.v1:a']).toBeDefined();
  });

  it("ne synchronise jamais le contenu d'un espace local (synced !== true)", async () => {
    writeSpaces([sp('secret', false)]);
    localStorage.setItem('favoris.v1:secret', JSON.stringify({ links: [{ url: 'https://x' }] }));
    await sync.pushDirty();

    expect(remote['favoris.v1:secret']).toBeUndefined();
  });

  it('garde les préférences propres à l’appareil hors du cloud', async () => {
    localStorage.setItem('favoris.theme', 'dark');
    localStorage.setItem('favoris.currentSpace', 'a');
    writeSpaces([sp('a', true)]);
    await sync.pushDirty();

    expect(remote['favoris.theme']).toBeUndefined();
    expect(remote['favoris.currentSpace']).toBeUndefined();
  });
});

describe('Invisibilité totale des espaces locaux', () => {
  it("filtre l'index poussé pour n'exposer que les espaces synchronisés", async () => {
    writeSpaces([sp('public', true, 'Public'), sp('secret', false, 'SECRET-banque')]);
    await sync.pushDirty();

    expect(remoteSpaceIds()).toEqual(['public']);
  });

  it("ne laisse jamais fuiter le nom d'un espace local dans le cloud", async () => {
    writeSpaces([sp('public', true, 'Public'), sp('secret', false, 'SECRET-banque')]);
    localStorage.setItem('favoris.v1:secret', JSON.stringify({ links: [] }));
    await sync.pushDirty();

    expect(JSON.stringify(remote)).not.toContain('SECRET-banque');
  });

  it('_filterPushValue ne touche que la clé favoris.spaces', () => {
    const spaces = JSON.stringify([sp('a', true), sp('b', false)]);
    expect(JSON.parse(sync._filterPushValue('favoris.spaces', spaces))).toHaveLength(1);
    // Toute autre clé est renvoyée telle quelle.
    expect(sync._filterPushValue('favoris.v1:a', 'blob')).toBe('blob');
  });
});

describe('Basculement de la synchronisation par espace', () => {
  it('synchronisé → local : retire le document distant (tombstone)', async () => {
    writeSpaces([sp('a', true)]);
    localStorage.setItem('favoris.v1:a', JSON.stringify({ links: [] }));
    await sync.pushDirty();
    expect(remote['favoris.v1:a'].deleted).toBe(false);

    // L'app passe l'espace en local puis demande le retrait du contenu.
    writeSpaces([sp('a', false)]);
    sync.requestRemove('favoris.v1:a');
    await sync.pushDirty();

    expect(remote['favoris.v1:a'].deleted).toBe(true);
    expect(remoteSpaceIds()).toEqual([]); // disparaît aussi de l'index
  });

  it('local → synchronisé : (re)pousse le contenu existant', async () => {
    writeSpaces([sp('a', false)]);
    localStorage.setItem('favoris.v1:a', JSON.stringify({ links: [{ url: 'https://a' }] }));
    await sync.pushDirty();
    expect(remote['favoris.v1:a']).toBeUndefined();

    writeSpaces([sp('a', true)]);
    sync.requestPush('favoris.v1:a');
    await sync.pushDirty();

    expect(remote['favoris.v1:a']).toBeDefined();
    expect(remote['favoris.v1:a'].deleted).toBe(false);
  });

  it('requestPush ignore une clé absente du stockage local', async () => {
    sync.requestPush('favoris.v1:inconnu');
    expect(sync.meta['favoris.v1:inconnu']).toBeUndefined();
  });
});

describe('Fusion de l’index multi-appareils (_mergeSpacesIndex)', () => {
  it('réinjecte les espaces locaux absents du distant', () => {
    writeSpaces([sp('a', true), sp('b', false)]);
    const merged = sync._mergeSpacesIndex(JSON.stringify([sp('c', true)]));
    expect(
      JSON.parse(merged)
        .map((s) => s.id)
        .sort()
    ).toEqual(['b', 'c']); // 'a' était synchronisé → vient du distant ; 'b' local préservé
  });

  it('ne duplique pas un espace présent des deux côtés', () => {
    writeSpaces([sp('a', false)]);
    const merged = sync._mergeSpacesIndex(JSON.stringify([sp('a', false)]));
    expect(JSON.parse(merged)).toHaveLength(1);
  });
});

describe('Gestion des erreurs (401 / permissions)', () => {
  it("status() expose error:null en absence d'erreur", () => {
    expect(sync.status().error).toBeNull();
  });

  it("un 401 dans pull reinitialise _user et expose le message d'erreur dans status()", async () => {
    // Simule un adapter dont pull() lève une AppwriteException 401.
    const err401 = Object.assign(new Error('The current user is not authorized'), { code: 401 });
    const failAdapter = {
      ...memoryAdapter,
      id: 'fail',
      async currentUser() {
        return { id: 'u1', email: 'test@example.com' };
      },
      async pull() {
        throw err401;
      },
    };
    sync.register(failAdapter);
    sync._error = null;

    // _activate() doit attraper le 401, remettre _user à null et propager.
    sync.config = { provider: 'fail', settings: {} };
    await sync._activate().catch(() => {});

    expect(sync._user).toBeNull();
    expect(sync.status().error).toBe('The current user is not authorized');
  });

  it('_error est effacé au début de chaque _activate()', async () => {
    sync._error = 'ancienne erreur';
    // _activate() avec le bon adapter (memoryAdapter) doit réinitialiser _error.
    sync.config = { provider: 'memory', settings: {} };
    await sync._activate();

    expect(sync._error).toBeNull();
  });
});

describe('Pull/merge de bout en bout', () => {
  it('applique un changement distant gagnant et préserve un espace local', async () => {
    // « Appareil 2 » a un espace local que le distant ne connaît pas.
    writeSpaces([sp('local-only', false)]);
    // Le distant (poussé plus tard par un autre appareil) gagne au LWW.
    const later = Date.now() + 10000;
    remote['favoris.spaces'] = {
      value: JSON.stringify([sp('shared', true)]),
      updatedAt: later,
      deleted: false,
    };
    remote['favoris.v1:shared'] = {
      value: JSON.stringify({ links: [] }),
      updatedAt: later,
      deleted: false,
    };

    await sync.pullAndApply();

    const local = JSON.parse(localStorage.getItem('favoris.spaces'))
      .map((s) => s.id)
      .sort();
    expect(local).toEqual(['local-only', 'shared']);
  });
});
