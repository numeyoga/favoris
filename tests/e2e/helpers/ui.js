// Helpers d'interaction avec l'interface (sélecteurs + gestes réutilisés).
import { expect } from '@playwright/test';

// Charge l'app et attend que le moteur de synchro soit exposé.
export async function openApp(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.favorisSync);
  await expect(page.locator('#space-label')).not.toHaveText('—');
}

// Ouvre le menu des espaces.
export async function openSpaceMenu(page) {
  await page.click('#space-btn');
  await expect(page.locator('.space-menu')).toBeVisible();
}

// Ferme toute surcouche ouverte (menu/modale) en cliquant le fond du scrim.
export async function closeOverlay(page) {
  const scrim = page.locator('.scrim').last();
  if (await scrim.count()) {
    const box = page.viewportSize();
    await page.mouse.click(box.width - 5, box.height - 5);
    await expect(page.locator('.scrim')).toHaveCount(0);
  }
}

// Localise la ligne d'un espace par son libellé dans le menu.
export function spaceRow(page, label) {
  return page.locator('.space-menu .item', { hasText: label });
}

// Crée un espace via le bouton « Nouvel espace » (boîte de dialogue prompt).
export async function createSpace(page, name) {
  await openSpaceMenu(page);
  page.once('dialog', (d) => d.accept(name));
  await page.getByRole('button', { name: 'Nouvel espace' }).click();
  await expect(page.locator('#space-label')).toHaveText(name);
}

// Ajoute un lien via la modale (#add-link).
export async function addLink(page, { name, url, tag } = {}) {
  await page.click('#add-link');
  await expect(page.locator('#f-url')).toBeVisible();
  if (name) await page.fill('#f-name', name);
  await page.fill('#f-url', url);
  if (tag) await page.selectOption('#f-tag', tag);
  await page.click('#ok');
  await expect(page.locator('#modal-root .scrim')).toHaveCount(0);
}
