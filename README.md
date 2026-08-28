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

O segundo carrega `functions/index.js` com `firebase-admin` e `firebase-functions` trocados por
stubs (`tools/fake-firestore.js`), então roda o fluxo inteiro — pedir, aceitar, desafiar, criar a
batalha — sem emulador e sem rede. É onde dá pra ver se o banco ficou num estado meio-gravado.

## Fluxo de trabalho entre colaboradores

- Cada um trabalha na própria cópia local (`git clone` → branch própria ou direto na `main`, como preferirem)
- Antes de começar a mexer, sempre `git pull` pra pegar o que o outro já mudou
- Depois de mexer, `git add`, `git commit`, `git push`
- Só um dos dois deve rodar `firebase deploy` por vez, pra não publicar por cima da mudança do outro sem querer — combinem quem publica depois de cada rodada de mudanças
