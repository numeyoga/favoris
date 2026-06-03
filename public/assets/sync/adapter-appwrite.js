// ============================================================
// Adapter Appwrite (client unique du registry pour l'instant)
// ============================================================
// Implémente le contrat RemoteAdapter attendu par le moteur :
//   init / completeFromUrl / signIn / signOut / currentUser
//   pull(app) / push(app,key,value,t) / remove(app,key,t)
//
// Modèle de données : une collection générique partagée par tous les
// sites. Un document = une clé localStorage d'un utilisateur.
//   attributs : app (string), key (string), data (string, JSON),
//               updatedAt (integer, ms), deleted (boolean)
//   sécurité  : document-level — chaque document appartient à son auteur
//               (Role.user), donc listDocuments ne renvoie que les siens.
//
// Le SDK est chargé paresseusement : sans backend configuré, aucune
// requête réseau, l'app reste 100 % hors-ligne.

// Version épinglée pour la reproductibilité ; ajustable (voir DOCS-SYNC.md).
const SDK_URL = 'https://esm.sh/appwrite@18';

let _sdk = null;
async function sdk() { return _sdk || (_sdk = await import(SDK_URL)); }

const adapter = {
  id: 'appwrite',
  label: 'Appwrite Cloud',
  // Décrit le formulaire de configuration (généré par l'UI).
  configFields: [
    { key: 'endpoint',     label: 'Endpoint',      placeholder: 'https://fra.cloud.appwrite.io/v1' },
    { key: 'projectId',    label: 'Project ID',    placeholder: 'ex. 665f…' },
    { key: 'databaseId',   label: 'Database ID',   placeholder: 'main' },
    { key: 'collectionId', label: 'Collection ID', placeholder: 'app_state' },
  ],

  _cfg: null, _client: null, _account: null, _db: null,

  async init(settings) {
    const { Client, Account, Databases } = await sdk();
    this._cfg = settings;
    this._client = new Client().setEndpoint(settings.endpoint).setProject(settings.projectId);
    this._account = new Account(this._client);
    this._db = new Databases(this._client);
  },

  // Au retour du magic-link, l'URL porte ?userId=&secret= -> on crée la session.
  async completeFromUrl() {
    const p = new URLSearchParams(location.search);
    const userId = p.get('userId'), secret = p.get('secret');
    if (!userId || !secret) return;
    try { await this._account.createSession(userId, secret); }
    catch (e) { console.warn('[appwrite] session', e); }
    p.delete('userId'); p.delete('secret');
    const qs = p.toString();
    history.replaceState({}, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  },

  async signIn(email) {
    const { ID } = await sdk();
    const redirect = location.origin + location.pathname; // doit être déclaré comme plateforme web
    await this._account.createMagicURLToken(ID.unique(), email, redirect);
  },

  async signOut() { try { await this._account.deleteSession('current'); } catch (e) {} },

  async currentUser() {
    try { const u = await this._account.get(); return { id: u.$id, email: u.email }; }
    catch (e) { return null; }
  },

  async _find(app, key) {
    const { Query } = await sdk();
    const r = await this._db.listDocuments(this._cfg.databaseId, this._cfg.collectionId,
      [Query.equal('app', app), Query.equal('key', key), Query.limit(1)]);
    return r.documents[0] || null;
  },

  async pull(app) {
    const { Query } = await sdk();
    const out = {};
    const r = await this._db.listDocuments(this._cfg.databaseId, this._cfg.collectionId,
      [Query.equal('app', app), Query.limit(200)]);
    for (const d of r.documents) {
      out[d.key] = { value: d.data, updatedAt: d.updatedAt, deleted: !!d.deleted };
    }
    return out;
  },

  async push(app, key, value, t) {
    const { ID, Permission, Role } = await sdk();
    const me = await this._account.get();
    const existing = await this._find(app, key);
    const payload = { app, key, data: value, updatedAt: t, deleted: false };
    if (existing) {
      await this._db.updateDocument(this._cfg.databaseId, this._cfg.collectionId, existing.$id, payload);
    } else {
      await this._db.createDocument(this._cfg.databaseId, this._cfg.collectionId, ID.unique(), payload, [
        Permission.read(Role.user(me.$id)),
        Permission.update(Role.user(me.$id)),
        Permission.delete(Role.user(me.$id)),
      ]);
    }
  },

  // Suppression = tombstone (on conserve la ligne marquée deleted).
  async remove(app, key, t) {
    const existing = await this._find(app, key);
    if (existing) {
      await this._db.updateDocument(this._cfg.databaseId, this._cfg.collectionId, existing.$id,
        { deleted: true, updatedAt: t });
    }
  },
};

export default adapter;
