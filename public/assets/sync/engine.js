// ============================================================
// Moteur de synchronisation générique (agnostique du provider)
// ============================================================
// Paradigme : « localStorage distant ». On ne synchronise que des blobs
// (les valeurs telles que stockées par l'app, c.-à-d. des chaînes JSON)
// identifiés par leur clé localStorage. La logique de fusion vit ICI
// (Last-Write-Wins par clé + tombstones) ; un adapter ne fait que
// lire/écrire des blobs horodatés sur un backend.
//
// Aucune notion propre à Appwrite/Supabase ne remonte jusqu'à l'app.

const CONFIG_KEY = 'favoris.remote.config'; // { provider, settings, app } — NON secret
const META_KEY   = 'favoris.sync.meta';     // { [key]: { t, deleted, synced } }

// Quelles clés localStorage sont synchronisées ? On exclut volontairement
// les préférences propres à l'appareil : thème (favoris.theme) et espace
// courant (favoris.currentSpace) restent locaux. La clé héritée
// 'favoris.v1' (sans deux-points) est une sauvegarde et n'est pas suivie.
//
// La synchronisation est un opt-in PAR ESPACE : un espace n'est synchronisé
// que si son drapeau synced === true (local par défaut). Le contenu d'un
// espace local (clé favoris.v1:<id>) ne quitte jamais l'appareil, et son nom
// n'apparaît pas dans l'index distant (voir _filterPushValue / _mergeSpacesIndex).
function spaceSynced(id) {
  try {
    const arr = JSON.parse(localStorage.getItem('favoris.spaces') || '[]');
    const s = Array.isArray(arr) ? arr.find(x => x && x.id === id) : null;
    return !!(s && s.synced === true);
  } catch (e) { return false; }
}
function isSyncedKey(k) {
  if (k === 'favoris.spaces') return true; // index : toujours suivi, mais filtré au push
  if (typeof k === 'string' && k.startsWith('favoris.v1:'))
    return spaceSynced(k.slice('favoris.v1:'.length));
  return false;
}

export const sync = {
  app: 'favoris',          // namespace ; à changer pour réutiliser sur un autre site
  adapters: {},            // registry : id -> adapter
  adapter: null,
  config: null,
  meta: {},
  _user: null,
  applying: false,         // garde anti-boucle pendant l'application du distant
  pushTimer: null,
  listeners: new Set(),

  // ---- Registry / events -------------------------------------
  register(adapter) { this.adapters[adapter.id] = adapter; return this; },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { const s = this.status(); this.listeners.forEach(fn => { try { fn(s); } catch (e) {} }); },

  status() {
    return {
      configured: !!this.config,
      provider: this.config ? this.config.provider : null,
      adapters: Object.values(this.adapters).map(a => ({ id: a.id, label: a.label })),
      user: this._user,
      pending: Object.values(this.meta).some(m => !m.synced),
    };
  },

  // ---- Persistance locale (non secrète) ----------------------
  loadConfig() {
    try { this.config = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null'); }
    catch (e) { this.config = null; }
    return this.config;
  },
  saveConfig(cfg) { this.config = cfg; localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); },
  clearConfig() { this.config = null; localStorage.removeItem(CONFIG_KEY); },
  loadMeta() {
    try { this.meta = JSON.parse(localStorage.getItem(META_KEY) || '{}'); }
    catch (e) { this.meta = {}; }
  },
  saveMeta() { this._origSet(META_KEY, JSON.stringify(this.meta)); },

  // ---- Initialisation ----------------------------------------
  async init() {
    this.loadMeta();
    this.installShim();
    this.loadConfig();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this._user) this.pullAndApply().catch(() => {});
    });
    if (this.config) {
      try { await this._activate(); } catch (e) { console.warn('[sync] init', e); }
    }
    this.emit();
    return this;
  },

  async applyConfig(cfg) {
    this.saveConfig(cfg);
    await this._activate();
    this.emit();
  },

  async _activate() {
    const adapter = this.adapters[this.config.provider];
    if (!adapter) throw new Error('Adapter inconnu : ' + this.config.provider);
    this.adapter = adapter;
    await adapter.init(this.config.settings);
    if (adapter.completeFromUrl) await adapter.completeFromUrl();
    this._user = await adapter.currentUser();
    if (this._user) await this.pullAndApply();
  },

  async forget() {
    try { await this.signOut(); } catch (e) {}
    this.clearConfig();
    this.adapter = null;
    this._user = null;
    this.emit();
  },

  // ---- Auth (déléguée à l'adapter) ---------------------------
  async connect(email) {
    if (!this.adapter) throw new Error('Aucun backend configuré');
    await this.adapter.signIn(email);   // envoie le magic-link ; retour géré au reload
  },
  async signOut() {
    if (this.adapter) await this.adapter.signOut();
    this._user = null;
    this.emit();
  },

  // ---- Interception des écritures localStorage ---------------
  // Toute écriture sur une clé synchronisée marque la clé « sale » et
  // programme un push debouncé. Aucun appel à modifier dans l'app.
  installShim() {
    const ls = window.localStorage;
    const origSet = ls.setItem.bind(ls);
    const origRemove = ls.removeItem.bind(ls);
    const self = this;
    this._origSet = origSet;
    this._origRemove = origRemove;
    ls.setItem = function (k, v) {
      origSet(k, v);
      if (!self.applying && isSyncedKey(k)) self._touch(k, false);
    };
    ls.removeItem = function (k) {
      origRemove(k);
      if (!self.applying && isSyncedKey(k)) self._touch(k, true);
    };
  },

  _touch(key, deleted) {
    this.meta[key] = { t: Date.now(), deleted: deleted, synced: false };
    this.saveMeta();
    this.emit();
    this.schedulePush();
  },

  // ---- API explicite app -> moteur (basculement synchro par espace) ----
  // Tombstone ponctuel d'une clé (ex. contenu d'un espace passé en « local »).
  // pushDirty itère sur meta sans re-tester isSyncedKey : la suppression part
  // donc bien même si la clé est désormais considérée « non synchronisée ».
  requestRemove(key) {
    this.meta[key] = { t: Date.now(), deleted: true, synced: false };
    this.saveMeta();
    this.emit();
    this.schedulePush();
  },
  // (Re)pousse une clé existante (ex. espace repassé en « synchronisé »).
  requestPush(key) {
    if (localStorage.getItem(key) != null) this._touch(key, false);
  },

  // Valeur effectivement poussée pour une clé. L'index favoris.spaces est
  // filtré pour n'exposer QUE les espaces synchronisés : le nom des espaces
  // locaux ne quitte jamais l'appareil.
  _filterPushValue(key, value) {
    if (key !== 'favoris.spaces' || value == null) return value;
    try {
      const arr = JSON.parse(value);
      if (!Array.isArray(arr)) return value;
      return JSON.stringify(arr.filter(s => s && s.synced === true));
    } catch (e) { return value; }
  },

  // Fusion de l'index distant avec les espaces locaux. Le distant ne contient
  // jamais que des espaces synchronisés ; on réinjecte les espaces locaux
  // (synced !== true) qui n'existent que sur cet appareil, sinon ils
  // disparaîtraient à l'application d'un index distant gagnant.
  _mergeSpacesIndex(remoteValue) {
    let remote = [], local = [];
    try { remote = JSON.parse(remoteValue) || []; } catch (e) {}
    try { local = JSON.parse(localStorage.getItem('favoris.spaces') || '[]') || []; } catch (e) {}
    if (!Array.isArray(remote)) remote = [];
    if (!Array.isArray(local)) local = [];
    const remoteIds = new Set(remote.map(s => s && s.id));
    const localOnly = local.filter(s => s && s.synced !== true && !remoteIds.has(s.id));
    return JSON.stringify([...remote, ...localOnly]);
  },

  schedulePush() {
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.pushDirty().catch(() => {}), 1500);
  },

  // ---- Synchronisation ---------------------------------------
  async pushDirty() {
    if (!this.adapter || !this._user) return;
    for (const key of Object.keys(this.meta)) {
      const m = this.meta[key];
      if (m.synced) continue;
      try {
        if (m.deleted) await this.adapter.remove(this.app, key, m.t);
        else await this.adapter.push(this.app, key, this._filterPushValue(key, localStorage.getItem(key)), m.t);
        m.synced = true;
        this.saveMeta();
      } catch (e) { console.warn('[sync] push', key, e); }
    }
    this.emit();
  },

  async pullAndApply() {
    if (!this.adapter || !this._user) return;
    const remote = await this.adapter.pull(this.app);
    const remoteEmpty = Object.keys(remote).length === 0;

    // Amorçage du premier appariement : on date les clés locales encore
    // sans métadonnée. Remote vide => on adopte le local (timestamp récent,
    // donc poussé). Remote non vide => compte existant, on laisse le distant
    // l'emporter (timestamp 0) sauf édition locale ultérieure réelle.
    const seedT = remoteEmpty ? Date.now() : 0;
    for (const key of this._localSyncedKeys()) {
      if (!this.meta[key]) this.meta[key] = { t: seedT, deleted: false, synced: false };
    }

    const keys = new Set([
      ...Object.keys(remote),
      ...Object.keys(this.meta),
      ...this._localSyncedKeys(),
    ]);

    let changed = false;
    this.applying = true;
    try {
      for (const key of keys) {
        const r = remote[key];
        const localExists = localStorage.getItem(key) != null;
        const lm = this.meta[key];
        const localT = lm ? lm.t : (localExists ? 0 : -1);
        const remoteT = r ? r.updatedAt : -1;

        if (r && remoteT > localT) {
          // Le distant gagne -> on applique sans re-marquer « sale ».
          // Cas spécial de l'index : on fusionne pour préserver les espaces
          // locaux, absents du distant par construction.
          if (r.deleted) this._origRemove(key);
          else if (key === 'favoris.spaces') this._origSet(key, this._mergeSpacesIndex(r.value));
          else this._origSet(key, r.value);
          this.meta[key] = { t: remoteT, deleted: !!r.deleted, synced: true };
          changed = true;
        } else if (localT >= 0 && (!r || localT > remoteT)) {
          // Le local gagne (ou le distant l'ignore) -> à pousser.
          if (!lm) this.meta[key] = { t: localT, deleted: !localExists, synced: false };
          else lm.synced = false;
        }
      }
    } finally { this.applying = false; }

    this.saveMeta();
    if (changed && typeof window.favorisApplyExternalChange === 'function') {
      window.favorisApplyExternalChange();
    }
    await this.pushDirty();
  },

  async syncNow() { if (this._user) await this.pullAndApply(); },

  _localSyncedKeys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (isSyncedKey(k)) out.push(k);
    }
    return out;
  },
};
