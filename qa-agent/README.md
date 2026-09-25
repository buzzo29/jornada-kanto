# QA Agent da Jornada Kanto

Base local de testes com TypeScript e Playwright. Esta pasta e ignorada pelo Firebase Hosting e nao deve ser publicada com o jogo.

## Primeiro smoke test

O teste sobe um servidor HTTP local para a raiz do projeto, abre a Jornada Kanto no Chromium e valida:

- resposta HTTP 200;
- titulo `Jornada Kanto`;
- presenca visivel do container `#app`;
- permanencia na URL local.

Durante o teste, toda requisicao externa e bloqueada. Isso inclui Firebase, Google Fonts e CDNs, portanto o smoke test nao le nem grava dados do Firebase real. Nesta primeira versao ele valida apenas que o shell local do jogo abre corretamente.

## Comandos

```powershell
npm run jarbas -- "teste se a Jornada Kanto abre"
npm run jarbas -- "verifique se o Onix dormindo não ataca depois do sono da Jynx"
npm run jarbas -- "abra o site com navegador visual"
npm run test:smoke
npm run test:smoke:headed
npm run typecheck
```

O comando `jarbas` aceita linguagem natural, mostra o plano e escolhe entre os cenarios disponiveis. Pedidos de outros cenarios sao recusados com uma explicacao clara ate que esses testes sejam implementados.

Falhas geram evidencias em `test-results/` e um relatorio HTML em `playwright-report/`.
