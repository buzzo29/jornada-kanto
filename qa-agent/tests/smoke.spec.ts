import { expect, test } from '@playwright/test';

test('abre a Jornada Kanto localmente sem acessar servicos externos', async ({ page }) => {
  const blockedExternalUrls: string[] = [];

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const isLocal = url.hostname === '127.0.0.1' || url.hostname === 'localhost';

    if (isLocal) {
      await route.continue();
      return;
    }

    blockedExternalUrls.push(url.href);
    await route.abort('blockedbyclient');
  });

  const response = await page.goto('/');

  expect(response, 'A pagina local deve responder').not.toBeNull();
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Jornada Kanto');
  await expect(page.locator('#app')).toBeVisible();
  expect(page.url()).toBe('http://127.0.0.1:4173/');

  await test.info().attach('acessos-externos-bloqueados.txt', {
    body: blockedExternalUrls.join('\n') || 'Nenhum acesso externo foi solicitado.',
    contentType: 'text/plain',
  });
});
