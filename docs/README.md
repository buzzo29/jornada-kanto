# Documentação — Jornada Kanto

Avaliação técnica e roadmap de evolução do jogo, produzidos em agosto/2026.
Tudo aqui é **proposta** — nada foi implementado no código ainda.

## Índice

| Doc | Sobre |
|---|---|
| [01 — Avaliação técnica](01-avaliacao-tecnica.md) | Análise do repo: arquitetura, qualidade, **segurança (XSS, regras do Firestore, anti-cheat)**, bugs e ferramentas recomendadas (Claude Code, GitHub Actions, UI kits, Vercel) |
| [02 — Ideias de jornada e balanceamento](02-ideias-jornada-e-balanceamento.md) | Equipe Rocket, rival estilo Gary, eventos (Safári, Snorlax, shinies, Nuzlocke) e ajustes de balanceamento |
| [03 — Anti-feeding](03-anti-feeding.md) | O exploit de perder de propósito, com a matemática, e 6 propostas de correção |
| [04 — Economia de habilidade](04-economia-de-habilidade.md) | Evolução do doc 03: piso fixo + teto por mérito, premiando habilidade, estratégia, conhecimento e sorte |
| [05 — Rotas ramificadas](05-rotas-ramificadas.md) | Mapa de escolhas (floresta × praia) com pools temáticos, risco opt-in e exclusivos de rota |

## Protótipos

- [`prototipos/pokeball-intro.html`](prototipos/pokeball-intro.html) — animação de abertura: Pokébola fecha, luz vermelha acende, balanço de captura, barra de carregamento estilo HP e revelação do login. **Abra no navegador** (arquivo único, sem dependências). Para integrar: a barra de progresso deve acompanhar o `onAuthStateChanged` do Firebase e o carregamento do save.

## Por onde começar

1. **Urgente (doc 01)**: escapar HTML no nome do treinador (XSS), endurecer `firestore.rules`, validar o time na Cloud Function — hoje ela aceita nível até 200.
2. **Barato e divertido (doc 02)**: shinies, provocações do rival, starter invertido, Jessie & James.
3. **Economia (docs 03/04)**: empréstimo de pontos + bônus de desmaio só em vitória fecham o exploit; vitória com nota e roleta do vencedor devolvem a variância pelo lado do mérito.
4. **Estrutural (docs 01/05)**: modularizar o `index.html`, unificar o motor de batalha com `functions/index.js` (~450 linhas duplicadas hoje), e então ramificar as rotas.
