// Service worker MÍNIMO e de propósito SEM CACHE.
//
// O navegador só oferece "instalar como app" se o site tiver um service worker registrado com um
// handler de fetch -- é só por isso que esse arquivo existe.
//
// A tentação aqui seria fazer cache pra funcionar offline, mas isso seria um tiro no pé nesse projeto:
// o jogo é um HTML único que muda a cada deploy, e um service worker com cache serviria a versão
// ANTIGA pros jogadores que já instalaram, mesmo depois do deploy. Já que o jogo depende do Firebase
// (ligas, ginásio, saves) e não funciona offline de verdade de qualquer jeito, o cache só traria o
// problema de versão velha sem nenhum benefício real.
//
// Se um dia quiser cache de verdade, o caminho certo é versionar o cache e limpar os antigos no
// 'activate' -- não simplesmente adicionar cache aqui.

self.addEventListener('install', () => {
  self.skipWaiting(); // assume o controle na hora, sem esperar abas antigas fecharem
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // sempre rede, direto -- sem intermediar nada
  event.respondWith(fetch(event.request));
});
