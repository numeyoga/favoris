// Scénarios d'utilisation de bout en bout (interface réelle dans un navigateur).
// Ces tests couvrent ce que les tests unitaires ne peuvent pas : rendu, modales,
// recherche, mode édition, thème, gestion des espaces.

import { test, expect } from '@playwright/test';
import { openApp, openSpaceMenu, spaceRow, createSpace, addLink } from './helpers/ui.js';

test.beforeEach(async ({ page }) => {
  // Chaque test démarre sur une app vierge (localStorage isolé par contexte).
  await openApp(page);
});

test('affiche l’espace par défaut amorcé avec des liens d’exemple', async ({ page }) => {
  await expect(page.locator('#space-label')).toHaveText('Mon espace');
  await expect(page.locator('#count')).toHaveText('5');
  await expect(page.getByText('MDN Web Docs')).toBeVisible();
});

test('la recherche filtre les liens et affiche un état « aucun résultat »', async ({ page }) => {
  await page.fill('#search', 'github');
  await expect(page.locator('#count')).toHaveText('1');
  await expect(page.getByText('GitHub')).toBeVisible();
  await expect(page.getByText('MDN Web Docs')).toHaveCount(0);

  await page.fill('#search', 'zzzzz');
  await expect(page.getByRole('heading', { name: 'Aucun résultat' })).toBeVisible();

  await page.fill('#search', '');
  await expect(page.locator('#count')).toHaveText('5');
});

test('ajoute un lien via la modale (URL normalisée en https)', async ({ page }) => {
  await addLink(page, { name: 'Mon Site', url: 'exemple.com', tag: 'tools' });
  await expect(page.locator('#count')).toHaveText('6');
  const link = page.locator('#grid a.name', { hasText: 'Mon Site' });
  await expect(link).toHaveAttribute('href', 'https://exemple.com');
});

test('supprime un lien depuis sa ligne', async ({ page }) => {
  const li = page.locator('#grid li', { hasText: 'GitHub' });
  await li.hover(); // révèle les actions de ligne (visibles au survol)
  await li.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByText('Lien supprimé')).toBeVisible();
  await expect(page.locator('#count')).toHaveText('4');
  await expect(page.locator('#grid a.name', { hasText: 'GitHub' })).toHaveCount(0);
});

test('bascule le mode édition', async ({ page }) => {
  await expect(page.locator('#edit-label')).toHaveText('Éditer');
  await page.click('#toggle-edit');
  await expect(page.locator('body')).toHaveClass(/edit/);
  await expect(page.locator('#edit-label')).toHaveText('Terminer');
  await page.click('#toggle-edit');
  await expect(page.locator('body')).not.toHaveClass(/edit/);
});

test('bascule le thème et le conserve après rechargement', async ({ page }) => {
  await page.click('#menu-btn');
  await page.click('#m-theme');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await page.waitForFunction(() => !!window.favorisSync);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('crée un nouvel espace, isolé et vide, puis revient au précédent', async ({ page }) => {
  await createSpace(page, 'Travail');
  await expect(page.locator('#count')).toHaveText('0');
  await expect(page.getByText('MDN Web Docs')).toHaveCount(0);

  // Le nouvel espace possède ses propres liens.
  await addLink(page, { name: 'Intranet', url: 'intranet.local' });
  await expect(page.locator('#count')).toHaveText('1');

  // Retour à l'espace d'origine : ses 5 liens sont intacts.
  await openSpaceMenu(page);
  await spaceRow(page, 'Mon espace').click();
  await expect(page.locator('#space-label')).toHaveText('Mon espace');
  await expect(page.locator('#count')).toHaveText('5');
});

test('renomme un espace depuis le menu', async ({ page }) => {
  await openSpaceMenu(page);
  await spaceRow(page, 'Mon espace').getByRole('button', { name: 'Renommer' }).click();
  // En mode édition, le libellé devient un champ : on le cible directement.
  const input = page.locator('.space-menu .item input');
  await input.fill('Perso');
  await input.press('Enter');
  await expect(page.locator('#space-label')).toHaveText('Perso');
});
