# Jornada Kanto

Jogo de desafio de ginásios estilo Gen 1 Pokémon, em um único arquivo HTML, com backend no Firebase (Auth + Firestore + Cloud Functions).

## Estrutura do projeto

```
├── index.html           → o jogo inteiro (front-end + lógica)
├── admin-panel.html     → painel de gestão das Ligas
├── functions/
│   ├── index.js         → Cloud Functions: Ligas, Torre, Ginásio da Cidade, batalha online
│   └── package.json
├── tools/               → simuladores em Node (rodam o motor sem navegador)
├── firestore.rules      → regras de segurança do Firestore
├── firebase.json        → config de Hosting e Functions
└── CLAUDE.md            → decisões de projeto e armadilhas conhecidas
```

> O jogo saiu de `public/index.html` para `index.html` na raiz — o `firebase.json` publica a
> raiz (`"public": "."`). Se você tem um clone antigo, é a mesma coisa em lugar novo.

## Como rodar/publicar

1. Instale o [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
2. Instale as dependências da função: `cd functions && npm install`
3. Faça login: `firebase login`
4. Publique: `firebase deploy --only hosting,functions` (`firebase.json` e `.firebaserc` já estão no repositório, então não é preciso rodar `firebase init`)
5. As regras do Firestore ficam em `firestore.rules` — publique com `firebase deploy --only firestore:rules`, ou cole o conteúdo manualmente em Firestore Database → Regras no console

Quando cliente e servidor mudam juntos, suba os dois na mesma leva — ver `CLAUDE.md`.

## Simuladores

O motor de batalha é JS puro e determinístico, então dá pra medir balanceamento sem abrir o navegador:

```
node tools/sim-balanceamento.js --n 200      # winrate por espécie
node tools/sim-balanceamento.js --ginasios   # winrate contra cada líder
```

`tools/sim-economia.js` e `tools/smoke-jornada.js` estão desatualizados (referenciam um fluxo de jornada que o jogo não tem mais) — ver o aviso no topo de cada um.

## Testes

```
node tools/test-amigos.js            # telas da lista de amigos (render, escape, presença)
node tools/test-amigos-servidor.js   # máquina de estados da amizade, com Firestore em memória
node tools/test-mapa.js              # mapa de Kanto nos 9 estados da jornada
```

## Ver as telas sem rodar o jogo

```
node tools/gerar-preview.js
```

Gera `preview-telas.html` na raiz: um arquivo só, que abre com dois cliques, sem servidor e sem
Firebase. Mostra as telas novas em estados que levariam meia jornada ou duas contas pra reproduzir
no jogo — o mapa em 0/2/5/8 insígnias, a lista de amigos com pedido pendente, o desafio esperando
resposta — renderizadas pelas **mesmas funções** do `index.html`. Tem seletor de largura (320 /
390 / 430) pra conferir o layout no celular.

É prova de layout, não o jogo: os botões não fazem nada e nada fala com o servidor.

## Rodar o jogo de verdade, local

O jogo usa o Firebase de produção (Auth + Firestore + Functions), então **não funciona em
`file://`** — o login do Google exige uma origem http(s), e `localhost` já vem na lista de
domínios autorizados do Firebase. Sirva a pasta:

```
npx serve .                              # http://localhost:3000
python -m http.server 8000               # http://localhost:8000
firebase emulators:start --only hosting  # http://localhost:5000
```

Qualquer um dos três serve só o HTML — Auth, Firestore e Functions continuam sendo os de
**produção**. Ou seja: os saves que você criar testando são saves de verdade. O que depende só do
cliente (mapa, trilha, telas) funciona assim, sem deploy nenhum. O que chama Cloud Function nova
(lista de amigos) só funciona depois de `firebase deploy --only functions`.

O segundo carrega `functions/index.js` com `firebase-admin` e `firebase-functions` trocados por
stubs (`tools/fake-firestore.js`), então roda o fluxo inteiro — pedir, aceitar, desafiar, criar a
batalha — sem emulador e sem rede. É onde dá pra ver se o banco ficou num estado meio-gravado.

## Fluxo de trabalho entre colaboradores

- Cada um trabalha na própria cópia local (`git clone` → branch própria ou direto na `main`, como preferirem)
- Antes de começar a mexer, sempre `git pull` pra pegar o que o outro já mudou
- Depois de mexer, `git add`, `git commit`, `git push`
- Só um dos dois deve rodar `firebase deploy` por vez, pra não publicar por cima da mudança do outro sem querer — combinem quem publica depois de cada rodada de mudanças
