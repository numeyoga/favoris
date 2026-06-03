// Tests de la logique pure de l'application (public/assets/core.js).
//
// Ces tests documentent le comportement attendu de chaque fonctionnalité
// « métier » indépendante du DOM : identifiants, slug, recherche, formes de
// données, suppression de liens/tags, réorganisation par glisser-déposer.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TAGS,
  PALETTE,
  uid,
  slugify,
  favicon,
  makeSpaceId,
  isSpaceSynced,
  filterLinks,
  emptyData,
  seededData,
  removeLink,
  removeTag,
  moveItem,
} from '../public/assets/core.js';

describe('Constantes', () => {
  it('fournit 4 tags par défaut, dont « Documentation » mis en avant', () => {
    expect(DEFAULT_TAGS).toHaveLength(4);
    expect(DEFAULT_TAGS[0]).toMatchObject({ id: 'docs', featured: true });
  });

  it('fournit une palette de couleurs hexadécimales', () => {
    expect(PALETTE.length).toBeGreaterThan(0);
    PALETTE.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
  });
});

describe('uid', () => {
  it('génère un identifiant court alphanumérique', () => {
    expect(uid()).toMatch(/^[a-z0-9]+$/);
  });

  it('génère des valeurs distinctes', () => {
    expect(uid()).not.toBe(uid());
  });
});

describe('slugify', () => {
  it('met en minuscules et remplace les espaces par des tirets', () => {
    expect(slugify('Mon Espace')).toBe('mon-espace');
  });

  it('retire les accents', () => {
    expect(slugify('Été Café')).toBe('ete-cafe');
  });

  it('élague les tirets en début/fin et regroupe les séparateurs', () => {
    expect(slugify('  !! Hello --- World !! ')).toBe('hello-world');
  });

  it('renvoie une chaîne vide pour une entrée vide ou nulle', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
    expect(slugify('***')).toBe('');
  });
});

describe('favicon', () => {
  it("construit l'URL du favicon à partir du domaine", () => {
    expect(favicon('https://github.com/user/repo')).toBe(
      'https://www.google.com/s2/favicons?sz=32&domain=github.com'
    );
  });

  it('renvoie une chaîne vide pour une URL invalide', () => {
    expect(favicon('pas une url')).toBe('');
  });
});

describe('makeSpaceId', () => {
  it("dérive l'id du libellé via slugify", () => {
    expect(makeSpaceId([], 'Web Dev')).toBe('web-dev');
  });

  it('évite les collisions en suffixant un numéro', () => {
    const spaces = [{ id: 'docs' }, { id: 'docs-2' }];
    expect(makeSpaceId(spaces, 'Docs')).toBe('docs-3');
  });

  it('retombe sur un id aléatoire si le slug est vide', () => {
    expect(makeSpaceId([], '***')).toMatch(/^[a-z0-9]+$/);
  });
});

describe('isSpaceSynced', () => {
  const spaces = [
    { id: 'a', synced: true },
    { id: 'b', synced: false },
    { id: 'c' }, // pas de drapeau
  ];

  it('est vrai uniquement si synced === true', () => {
    expect(isSpaceSynced(spaces, 'a')).toBe(true);
  });

  it('est faux si synced === false ou absent (local par défaut)', () => {
    expect(isSpaceSynced(spaces, 'b')).toBe(false);
    expect(isSpaceSynced(spaces, 'c')).toBe(false);
  });

  it('est faux pour un espace inconnu', () => {
    expect(isSpaceSynced(spaces, 'zzz')).toBe(false);
  });
});

describe('filterLinks (recherche)', () => {
  const tags = [{ id: 'docs', label: 'Documentation' }];
  const links = [
    { id: '1', name: 'MDN', url: 'https://developer.mozilla.org', tag: 'docs' },
    { id: '2', name: 'GitHub', url: 'https://github.com', tag: 'tools' },
  ];

  it('renvoie tous les liens quand la requête est vide', () => {
    expect(filterLinks(links, tags, '')).toBe(links);
    expect(filterLinks(links, tags, '   ')).toBe(links);
  });

  it('filtre par nom (insensible à la casse)', () => {
    expect(filterLinks(links, tags, 'mdn')).toEqual([links[0]]);
  });

  it('filtre par URL', () => {
    expect(filterLinks(links, tags, 'github.com')).toEqual([links[1]]);
  });

  it('filtre par libellé de tag', () => {
    expect(filterLinks(links, tags, 'documentation')).toEqual([links[0]]);
  });

  it('renvoie un tableau vide si rien ne correspond', () => {
    expect(filterLinks(links, tags, 'introuvable')).toEqual([]);
  });
});

describe('emptyData / seededData', () => {
  it('emptyData fournit les tags par défaut et aucun lien', () => {
    const d = emptyData();
    expect(d.links).toEqual([]);
    expect(d.tags).toHaveLength(DEFAULT_TAGS.length);
    expect(d.editMode).toBe(false);
  });

  it("emptyData copie les tags (n'altère pas la constante partagée)", () => {
    const d = emptyData();
    d.tags.push({ id: 'x' });
    expect(DEFAULT_TAGS).toHaveLength(4);
  });

  it("seededData fournit des liens d'exemple avec des ids générés", () => {
    let n = 0;
    const d = seededData(DEFAULT_TAGS, () => 'id' + ++n);
    expect(d.links.length).toBeGreaterThan(0);
    expect(d.links[0].id).toBe('id1');
    expect(d.links.every((l) => l.url.startsWith('http'))).toBe(true);
  });
});

describe('removeLink', () => {
  it('retire le lien ciblé et conserve les autres', () => {
    const links = [{ id: 'a' }, { id: 'b' }];
    expect(removeLink(links, 'a')).toEqual([{ id: 'b' }]);
  });

  it("ne modifie pas le tableau d'origine (immutabilité)", () => {
    const links = [{ id: 'a' }];
    removeLink(links, 'a');
    expect(links).toHaveLength(1);
  });
});

describe('removeTag', () => {
  it('retire le tag et détache les liens qui le portaient', () => {
    const tags = [{ id: 'docs' }, { id: 'tools' }];
    const links = [
      { id: '1', tag: 'docs' },
      { id: '2', tag: 'tools' },
    ];
    const out = removeTag(tags, links, 'docs');
    expect(out.tags).toEqual([{ id: 'tools' }]);
    expect(out.links.find((l) => l.id === '1').tag).toBe('');
    expect(out.links.find((l) => l.id === '2').tag).toBe('tools');
  });
});

describe('moveItem (glisser-déposer)', () => {
  const arr = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('déplace un élément avant la cible', () => {
    expect(moveItem(arr, 'c', 'a', 'before').map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('déplace un élément après la cible', () => {
    expect(moveItem(arr, 'a', 'c', 'after').map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('est sans effet si la source et la cible sont identiques', () => {
    expect(moveItem(arr, 'b', 'b').map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('ne modifie pas le tableau original', () => {
    moveItem(arr, 'a', 'c', 'after');
    expect(arr.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});
