// ============================================================
// Logique « pure » de l'application (sans DOM ni stockage)
// ============================================================
// Module ES natif (aucun framework) importé par index.html ET par les tests.
// Tout ce qui est testable sans navigateur vit ici : constantes, fabrique
// d'identifiants, slug, recherche, formes de données et transformations.

// Tags proposés par défaut dans un nouvel espace.
export const DEFAULT_TAGS = [
  { id: 'docs', label: 'Documentation', color: '#6366f1', featured: true },
  { id: 'tools', label: 'Outils', color: '#0d9488' },
  { id: 'reading', label: 'Lecture', color: '#d97706' },
  { id: 'inspire', label: 'Inspiration', color: '#db2777' },
];

// Palette de couleurs proposée pour les tags.
export const PALETTE = [
  '#2563eb',
  '#0d9488',
  '#8b5cf6',
  '#d97706',
  '#16a34a',
  '#db2777',
  '#6366f1',
  '#64748b',
  '#f43f5e',
  '#0891b2',
  '#84cc16',
  '#a855f7',
];

// Identifiant court aléatoire (liens, tags, espaces de secours).
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Transforme un libellé en slug ASCII : minuscules, sans accents, tirets.
export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// URL du favicon (service Google) pour un lien donné ; '' si l'URL est invalide.
export function favicon(url) {
  try {
    const host = new URL(url).hostname;
    return 'https://www.google.com/s2/favicons?sz=32&domain=' + host;
  } catch (e) {
    return '';
  }
}

// Génère un id d'espace unique à partir d'un libellé, en évitant les collisions
// avec les espaces existants (suffixe -2, -3, … si besoin).
export function makeSpaceId(spaces, label) {
  const base = slugify(label) || uid();
  let id = base,
    i = 1;
  while (spaces.find((s) => s.id === id)) id = base + '-' + ++i;
  return id;
}

// Un espace est synchronisé seulement si synced === true (local par défaut).
export function isSpaceSynced(spaces, id) {
  const s = spaces.find((x) => x && x.id === id);
  return !!(s && s.synced === true);
}

// Recherche : filtre les liens dont le nom, l'URL, l'id de tag ou le libellé
// de tag contient la requête (insensible à la casse). Requête vide => tout.
export function filterLinks(links, tags, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return links;
  return links.filter((l) => {
    const tag = tags.find((t) => t.id === l.tag);
    return (
      (l.name || '').toLowerCase().includes(q) ||
      (l.url || '').toLowerCase().includes(q) ||
      (l.tag || '').toLowerCase().includes(q) ||
      (tag && (tag.label || '').toLowerCase().includes(q))
    );
  });
}

// Données d'un espace vide (tags par défaut, aucun lien).
export function emptyData(tags = DEFAULT_TAGS) {
  return { tags: tags.slice(), links: [], editMode: false };
}

// Données d'amorçage du premier espace (quelques liens d'exemple).
export function seededData(tags = DEFAULT_TAGS, mkId = uid) {
  return {
    tags: tags.slice(),
    links: [
      { id: mkId(), name: 'MDN Web Docs', url: 'https://developer.mozilla.org', tag: 'docs' },
      { id: mkId(), name: 'Can I Use', url: 'https://caniuse.com', tag: 'docs' },
      { id: mkId(), name: 'GitHub', url: 'https://github.com', tag: 'tools' },
      { id: mkId(), name: 'Hacker News', url: 'https://news.ycombinator.com', tag: 'reading' },
      { id: mkId(), name: 'Are.na', url: 'https://are.na', tag: 'inspire' },
    ],
    editMode: false,
  };
}

// Supprime un lien (retourne un nouveau tableau).
export function removeLink(links, id) {
  return links.filter((l) => l.id !== id);
}

// Supprime un tag et détache les liens qui le portaient (retourne {tags, links}).
export function removeTag(tags, links, id) {
  return {
    tags: tags.filter((t) => t.id !== id),
    links: links.map((l) => (l.tag === id ? { ...l, tag: '' } : l)),
  };
}

// Déplace un élément (identifié par id) avant/après une cible, dans un tableau
// d'objets {id,...}. Utilisé par le glisser-déposer. Retourne un nouveau tableau.
export function moveItem(arr, fromId, toId, place = 'before') {
  if (fromId === toId) return arr.slice();
  const from = arr.findIndex((x) => x.id === fromId);
  if (from < 0) return arr.slice();
  const next = arr.slice();
  const [moved] = next.splice(from, 1);
  let to = next.findIndex((x) => x.id === toId);
  if (to < 0) return arr.slice();
  if (place === 'after') to += 1;
  next.splice(to, 0, moved);
  return next;
}
