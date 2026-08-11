# Avaliação — Jornada Kanto
*Repo: github.com/buzzo29/jornada-kanto · Avaliado em 11/08/2026*

Jogo de desafio de ginásios estilo Pokémon Gen 1, em um único `index.html` (~4.078 linhas) + Firebase (Auth, Firestore, Cloud Functions). O jogo tem 150 espécies, 8 ginásios fiéis à Gen 1, sistema de Liga online com ciclos de 1 hora, Pokédex permanente por conta, conquistas, ranking global e até um desafio secreto do Mewtwo. É um projeto muito mais ambicioso e bem pensado do que a estrutura de arquivo único sugere.

---

## 1. Nota geral

**7/10 como projeto de hobby entre amigos. Design de jogo criativo e vários padrões avançados bem aplicados — mas com problemas sérios de segurança que precisam ser corrigidos antes de divulgar o jogo para mais gente.**

### O que está muito bom 👏

- **Design da Liga**: um documento por inscrito no Firestore (evita contenção de escrita), agenda leve separada do chaveamento pesado, "lacre" transacional para evitar que dois processos avancem o mesmo ciclo, RNG com seed determinística (dois clientes que simulam a mesma partida chegam ao mesmo resultado). Isso é engenharia de gente grande.
- **Estética retrô caprichada**: caixas estilo Game Boy com sombra dura, fonte Press Start 2P, cursor ▼ piscante, sprites reais do PokéAPI com `image-rendering: pixelated` e fallback para emoji quando a imagem falha.
- **Comentários que explicam o porquê** das decisões, migrações defensivas de dados antigos, fallbacks em vários pontos.
- Balanceamento de jogo interessante: pontos de nível limitados, teto de nível 55, cap de +3 em evoluções finais, 5 derrotas = game over.

### O que precisa de atenção urgente 🚨

| # | Problema | Gravidade |
|---|----------|-----------|
| 1 | **XSS armazenado**: o nome do treinador não é escapado e é renderizado via `innerHTML` no ranking global e no chaveamento da Liga. Um nome como `<img src=x onerror=...>` executa código no navegador de TODOS os jogadores, com a sessão Firebase deles logada. | Crítica |
| 2 | **Regras do Firestore abertas demais**: `leagues/*` e `leagueCycles/*` têm escrita liberada para qualquer conta logada. Do console do navegador dá para forjar o ranking, se declarar campeão, apagar a inscrição de outro jogador ou corromper a agenda da Liga inteira. | Crítica |
| 3 | **Anti-cheat inexistente**: a batalha roda 100% no cliente e o save grava direto `badgeCount`, `team`, etc. A Cloud Function aceita qualquer time no código base64 — **6 Mewtwo Lv.200 passa na validação** (o limite é lvl ≤ 200!). Dá até para trocar o time entre rodadas da Liga. | Crítica |
| 4 | **Cloud Function sobrescreve saves sem merge/transação**: se o jogador estiver jogando enquanto a Liga avança, perde progresso. E ela confia no `uid` gravado pelo cliente — dá para fazer a função escrever no save de outro usuário. | Alta |
| 5 | **Bug do fuso horário**: o horário do ciclo é calculado em hora local no cliente e em UTC na função. Fusos de meia hora (Índia etc.) geram ciclos duplicados. | Média |
| 6 | **Bug do Mewtwo**: capturado, ele não entra na Pokédex permanente — some ao recarregar e dá para refazer a batalha infinitamente. | Média |
| 7 | **Limite de 1 MiB por doc**: `leagueCycles/{id}` guarda todas as ligas do ciclo com log completo de cada confronto. Com algumas centenas de jogadores, o doc estoura e o ciclo trava em retentativa infinita. | Média (só com escala) |
| 8 | **~450 linhas duplicadas** entre `index.html` e `functions/index.js` (espécies, tabela de tipos, motor de batalha, lógica da Liga) — mantidas em sincronia na mão. Qualquer ajuste de balanceamento feito só de um lado dessincroniza os resultados. | Média |
| 9 | Faltam `firebase.json`/`.firebaserc` no repo (o README admite) — um clone limpo não faz deploy. | Baixa |

### Correções rápidas recomendadas (ordem sugerida)

1. **Criar `escapeHtml()`** e aplicar em TODO lugar que interpola nome de jogador em `innerHTML` (+ `maxlength` no input do nome). ~1h de trabalho, elimina o risco maior.
2. **Endurecer `firestore.rules`**: escrita em `leagueCycles` só no próprio doc de registrant (validar que `request.resource.data.uid == request.auth.uid`), bloquear escrita do cliente em `leagues/schedule` e `champions_alltime` (deixar só a Cloud Function, via Admin SDK, escrever).
3. **Validar o time na Cloud Function**: nível máximo 55, cruzar com o save real do jogador (a função tem acesso admin ao Firestore), rejeitar time diferente do inscrito entre rodadas.
4. Corrigir bug do Mewtwo (chamar a sincronização da Pokédex permanente) e o cálculo de horário do ciclo (usar UTC nos dois lados).
5. Trocar `set()` por transação/merge na sincronização de níveis da Liga.
6. Commitar `firebase.json` e `.firebaserc` (não são segredo).

---

## 2. Ferramentas de Claude para o projeto

### Claude Code + GitHub (o combo ideal para vocês dois)

- **[Claude Code](https://code.claude.com)** no terminal ou desktop, cada um na sua máquina. Com um repo desse tamanho (1 arquivo de 4 mil linhas), Claude Code navega, refatora e corrige com contexto do projeto inteiro.
- **Criar um `CLAUDE.md` na raiz do repo** — é o arquivo de memória do projeto que o Claude Code lê automaticamente. Coloquem nele: a arquitetura (estado global `game` + `render()` total), as regras de negócio (teto 55, +3 em final, 5 derrotas), e o aviso de que `functions/index.js` duplica o motor de batalha e precisa ser atualizado junto. Isso evita que o Claude (e vocês) quebrem a sincronia cliente/servidor sem querer.
- **[Claude Code GitHub Actions](https://code.claude.com/docs/pt/github-actions)** — instala no repo e aí vocês podem mencionar `@claude` em qualquer issue ou PR para ele implementar, corrigir ou explicar código direto no GitHub. Perfeito para colaboração a dois: um abre a issue "corrigir XSS no ranking", o outro só revisa a PR que o Claude abre.
- **[Code Review automático com Claude](https://support.claude.com/en/articles/14233555-set-up-code-review-for-claude-code)** — review automático em toda PR. Com dois colaboradores mexendo no mesmo arquivo gigante, um revisor automático pega conflito de lógica antes do merge.
- **Plan Mode** do Claude Code para as refatorações grandes (ex.: quebrar o index.html em módulos) — ele planeja antes de tocar no código, vocês aprovam o plano.

### Fluxo de colaboração recomendado (substitui o "combinem quem publica" do README)

1. Branch por feature + Pull Request (proteger a `main` no GitHub: exigir PR).
2. **Firebase Hosting preview channels via GitHub Action** (`FirebaseExtended/action-hosting-deploy`): cada PR ganha uma URL de preview temporária automaticamente. Acabou o problema de "só um dá deploy por vez" — o deploy de produção vira automático no merge para a `main`.
3. **Firebase Emulators** (`firebase emulators:start`) para testar Auth/Firestore/Functions localmente sem sujar produção — essencial para testar a Liga sem esperar ciclos de 1 hora reais.

---

## 3. UI kits e visual retrô

O visual atual já é bom — a evolução natural é sair do "CSS que imita Game Boy" para assets pixel art reais:

- **[NES.css](https://nostalgic-css.github.io/NES.css/)** — framework CSS estilo 8-bit (botões, caixas de diálogo, barras de progresso, badges, avatares). É o mais famoso e combina perfeitamente com o estilo do jogo. Drop-in: dá para adotar só os componentes que quiserem.
- **[RPGUI](https://github.com/RonenNess/RPGUI)** — framework CSS de interface de RPG (molduras ornamentadas, sliders, checkboxes temáticos). Alternativa mais "RPG de mesa".
- **Packs de UI pixel art gratuitos** no [itch.io](https://itch.io/game-assets/free/tag-pixel-art/tag-user-interface) e [CraftPix](https://craftpix.net/freebies/free-basic-pixel-art-ui-for-rpg/) — molduras, botões e ícones prontos para dar identidade própria (importante: os sprites de Pokémon e insígnias são propriedade da Nintendo/Game Freak; para um projeto de fãs sem fins lucrativos ok, mas nunca monetizem).
- **Sprites animados**: hoje o jogo usa PNGs estáticos do PokéAPI. O mesmo CDN tem a pasta `versions/generation-v/black-white/animated/` com GIFs animados dos 151 — upgrade de 1 linha na função `spriteHtml`. Há também sprites de costas (`/back/`) para dar cara de batalha Gen 1 real (seu Pokémon de costas embaixo, oponente de frente em cima).
- **Animações de batalha**: hoje a batalha é texto revelado por `setTimeout`. Sugestões em ordem de esforço:
  - `canvas-confetti` (1 linha via CDN) para vitórias e captura de lendários;
  - CSS keyframes de "shake" no sprite ao tomar dano e flash branco ao desmaiar (padrão Gen 1);
  - [GSAP](https://gsap.com) se quiserem coreografar sequências (entrada de Pokébola, ataque avançando, HP drenando) — roda tranquilo num HTML único via CDN.
- **Acessibilidade/UX rápidos**: remover `maximum-scale=1.0` da viewport (bloqueia zoom no celular), adicionar `@media` query para aproveitar telas grandes (o jogo hoje é uma coluna de 460px até no desktop), e corrigir o scroll que volta ao topo a cada re-render na tela da Liga (re-renderizar só o miolo, ou salvar/restaurar `scrollY`).

---

## 4. Vercel — vale a pena?

**Honestamente: para este projeto, não agora.** O jogo está acoplado ao Firebase (Auth + Firestore + Cloud Functions agendadas), e o Firebase Hosting já faz tudo que a Vercel faria aqui — CDN, HTTPS, deploy por CLI e previews por PR. Migrar hosting para a Vercel adicionaria complexidade sem ganho.

Onde a Vercel **agrega** para vocês:

- **[v0.dev](https://v0.dev)** — gerador de UI por prompt da Vercel. Ótimo para prototipar visual novo de telas (ex.: "tela de batalha pokémon retrô, game boy, barras de HP") e depois adaptar o HTML/CSS gerado para o jogo. Usem como ferramenta de brainstorm visual, não como código final.
- **Se um dia reescreverem** o jogo em React/Next.js (o passo natural depois de quebrar o arquivo único), aí sim Vercel vira a opção padrão de deploy — mantendo Firestore/Auth como backend.

O upgrade de tooling que faz sentido **antes** de qualquer Vercel: adotar **[Vite](https://vitejs.dev)** e quebrar o `index.html` em módulos ES (`data/species.js`, `battle/engine.js`, `league/`, `ui/`...), compartilhando o motor de batalha entre cliente e Cloud Function como pacote único — isso elimina as ~450 linhas duplicadas e é a melhoria estrutural mais valiosa do projeto.

---

## 5. Roteiro sugerido (resumo executivo)

| Fase | O quê | Esforço |
|------|-------|---------|
| **0 — Agora** | escapeHtml no nome de jogador + endurecer firestore.rules + validação de time na Function | 1 fim de semana |
| **1 — Colaboração** | CLAUDE.md, Claude GitHub Action + code review, branch protection, preview channels, emuladores, commitar firebase.json | 1 tarde |
| **2 — Bugs** | Mewtwo na Pokédex permanente, fuso UTC, merge no sync de saves, dedupe do ranking | 1 fim de semana |
| **3 — Visual** | Sprites animados + de costas, shake/flash na batalha, confetti, NES.css nos componentes, zoom mobile, @media desktop | incremental |
| **4 — Estrutura** | Vite + módulos ES, motor de batalha compartilhado cliente/função, dados em JSON | maior, mas transforma o projeto |
