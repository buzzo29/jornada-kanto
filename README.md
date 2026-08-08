# Jornada Kanto

Jogo de desafio de ginásios estilo Gen 1 Pokémon, em um único arquivo HTML, com backend no Firebase (Auth + Firestore + Cloud Functions).

## Estrutura do projeto

```
├── public/
│   └── index.html      → o jogo inteiro (front-end + lógica)
├── functions/
│   ├── index.js         → Cloud Function que avança a Liga Pokémon a cada minuto
│   └── package.json
└── firestore.rules      → regras de segurança do Firestore
```

> **Falta nesse repositório**: `firebase.json` e `.firebaserc`, que já existem no projeto Firebase de quem criou o projeto originalmente. Quem tiver esses dois arquivos localmente deve adicioná-los na raiz antes do primeiro `firebase deploy` (veja o Passo 4 abaixo).

## Como rodar/publicar

1. Instale o [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
2. Instale as dependências da função: `cd functions && npm install`
3. Faça login: `firebase login`
4. Se você não tiver `firebase.json`/`.firebaserc` ainda, rode `firebase init` na raiz do projeto (escolha Hosting apontando pra pasta `public`, e Functions apontando pra pasta `functions`, usando o projeto Firebase já existente)
5. Publique: `firebase deploy --only hosting,functions`
6. As regras do Firestore ficam em `firestore.rules` — publique com `firebase deploy --only firestore:rules`, ou cole o conteúdo manualmente em Firestore Database → Regras no console

## Fluxo de trabalho entre colaboradores

- Cada um trabalha na própria cópia local (`git clone` → branch própria ou direto na `main`, como preferirem)
- Antes de começar a mexer, sempre `git pull` pra pegar o que o outro já mudou
- Depois de mexer, `git add`, `git commit`, `git push`
- Só um dos dois deve rodar `firebase deploy` por vez, pra não publicar por cima da mudança do outro sem querer — combinem quem publica depois de cada rodada de mudanças
