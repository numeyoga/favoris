// Scénarios de synchronisation de bout en bout, via un test double du stockage
// remote (adapter mémoire injecté dans la page). Valide la fonctionnalité clé :
// la synchronisation par espace et l'invisibilité totale des espaces locaux.

import { test, expect } from '@playwright/test';
import {
  openApp,
  openSpaceMenu,
  closeOverlay,
  spaceRow,
  createSpace,
  addLink,
} from './helpers/ui.js';
import { installMemorySync, flushSync, getRemote, remoteSpaceIds } from './helpers/memory-sync.js';

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await installMemorySync(page);
});

// Active/désactive la synchro d'un espace via le bouton ☁️ de sa ligne.
async function toggleSync(page, label, { expectConfirm = false } = {}) {
  await openSpaceMenu(page);
  const row = spaceRow(page, label);
  const toLocal = row.getByRole('button', { name: 'garder local' });
  const toSynced = row.getByRole('button', { name: 'cliquer pour synchroniser' });
  if (expectConfirm) page.once('dialog', (d) => d.accept());
  if (await toLocal.count()) await toLocal.click();
  else await toSynced.click();
  await flushSync(page);
  await closeOverlay(page);
}

test('un espace est local par défaut : rien ne part vers le cloud', async ({ page }) => {
  await flushSync(page);
  expect(await remoteSpaceIds(page)).toEqual([]);
  const remote = await getRemote(page);
  expect(remote['favoris.v1:default']).toBeUndefined();
});

test('activer la synchro pousse le contenu et l’entrée d’index de l’espace', async ({ page }) => {
  await toggleSync(page, 'Mon espace');

  expect(await remoteSpaceIds(page)).toContain('default');
  const remote = await getRemote(page);
  expect(remote['favoris.v1:default']).toBeDefined();
  expect(remote['favoris.v1:default'].deleted).toBe(false);

  // Le bouton reflète désormais l'état synchronisé.
  await openSpaceMenu(page);
  await expect(
    spaceRow(page, 'Mon espace').getByRole('button', { name: 'garder local' })
  ).toBeVisible();
});

test('rendre un espace local retire ses données du cloud (tombstone)', async ({ page }) => {
  await toggleSync(page, 'Mon espace'); // -> synchronisé
  expect(await remoteSpaceIds(page)).toContain('default');

  await toggleSync(page, 'Mon espace', { expectConfirm: true }); // -> local

  const remote = await getRemote(page);
  expect(remote['favoris.v1:default'].deleted).toBe(true);
  expect(await remoteSpaceIds(page)).not.toContain('default');
});

test('le nom et le contenu d’un espace local ne fuitent jamais vers le cloud', async ({ page }) => {
  await createSpace(page, 'Comptes Bancaires');
  await addLink(page, { name: 'RIB confidentiel', url: 'banque-secrete.example' });
  await flushSync(page);

  const dump = JSON.stringify(await getRemote(page));
  expect(dump).not.toContain('Comptes Bancaires');
  expect(dump).not.toContain('comptes-bancaires'); // l'id slugifié non plus
  expect(dump).not.toContain('RIB confidentiel');
  expect(dump).not.toContain('banque-secrete');
});

test('un espace synchronisé reste visible après synchronisation manuelle', async ({ page }) => {
  await toggleSync(page, 'Mon espace');
  await page.evaluate(() => window.favorisSync.syncNow());
  expect(await remoteSpaceIds(page)).toContain('default');
});
