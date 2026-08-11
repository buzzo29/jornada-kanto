# Propostas — Acabar com o "intentional feeding"
*Jornada Kanto · O problema: hoje perder de propósito é a estratégia ótima.*

---

## O exploit, com números

A economia atual entrega poder por **tentativa**, não por **mérito**:

- Vitória no ginásio → **+10 pontos** de nível
- Derrota no ginásio → **+5 pontos** e revanche liberada
- Cada Pokémon que desmaia na batalha → **+1 nível** de graça
- Limite: 5 derrotas = game over

Quem vence tudo de primeira termina a jornada com **90 pontos** (20 iniciais + 7×10). Quem perde de propósito 4 vezes (parando a um passo do game over) termina com **110 pontos + até ~24 níveis de desmaio** — cerca de **30% mais forte** para a Liga, que é onde a força importa. Ou seja: o jogador "ruim de propósito" chega mais forte que o jogador excelente. O sistema pune quem joga bem.

Qualquer solução precisa respeitar duas restrições ao mesmo tempo:

1. **Perder nunca pode ser lucro líquido** (mata o feeding);
2. **Perder não pode virar espiral da morte** (quem perde de verdade precisa conseguir se recuperar — senão o game over vira arrastado e frustrante).

O truque é separar **total de poder** (que deve ser fixo ou favorecer vitória) de **fluxo de caixa** (que pode socorrer quem perdeu).

---

## Proposta A — Empréstimo, não bônus ⭐ (a recomendada)

**A derrota adianta pontos; não cria pontos.**

Perdeu? Recebe +5 agora, MAS a próxima vitória paga +5 em vez de +10 (o adiantamento é descontado). O total da jornada é **sempre 90**, ganhe de primeira ou na décima tentativa.

| Cenário | Total de pontos |
|---|---|
| Vence tudo de primeira | 90 |
| Perde 4× de propósito | 90 (identical) |
| Perde 2× de verdade e se recupera | 90 |

- ✅ Feeding rende exatamente **zero**. Não há o que farmar.
- ✅ Quem perdeu de verdade ainda recebe socorro imediato (+5 na hora da dificuldade — é quando ele precisa).
- ✅ Implementação mínima: um campo `pointsOwed` no save e um `if` na hora de premiar a vitória.
- ⚠️ Comunicar bem na UI: "Seus Pokémon treinaram no vale da derrota (+5 adiantados da próxima vitória)" — o jogador entende que não está sendo roubado.

---## Proposta B — Orçamento fechado por jornada

**Todo save tem um teto vitalício de pontos: 90. Ponto final.**

Registrem `totalPointsEarned` no save; nenhuma fonte (vitória, derrota, piedade, evento Rocket) pode ultrapassar o teto. Derrota pode continuar dando +5 — mas esses +5 saem do mesmo orçamento que as vitórias futuras dariam.

- ✅ É a versão "à prova de futuro" da Proposta A: vale automaticamente para qualquer mecânica nova que vocês criarem depois (cassino, eventos, piedade). Nenhuma ideia nova reabre o exploit por acidente.
- ✅ Trivial de **validar no servidor**: a Cloud Function pode rejeitar qualquer time cuja soma de níveis exceda o possível com 90 pontos — vira anti-cheat de graça.
- ⚠️ Sozinha não conserta o +1 por desmaio (ver Proposta D).

*A e B combinam perfeitamente: A define o fluxo, B é a trava de segurança.*

---

## Proposta C — Revanche encarece (o ginásio aprende)

**Cada revanche contra o mesmo líder aumenta o time dele em +1 nível** ("o Brock decorou sua estratégia"). Farmar derrotas faz o obstáculo crescer mais rápido que o farm rende.

- ✅ Narrativamente deliciosa e auto-limitante: na 4ª tentativa o ginásio está +3 e os +5/derrota já não compensam.
- ✅ Combina com o arco Rocket (enfraquecer Giovanni vencendo emboscadas segue sendo o caminho "honesto" de facilitar o final).
- ⚠️ Cuidado com a dose: +1 por revanche, cap de +3, senão pune demais quem está travado de verdade. Ideal como **complemento** de A, não como solução única.

---

## Proposta D — Desmaio não dá nível; desempenho dá

O canal escondido do feeding é o **+1 nível por desmaio**: deixar o time inteiro cair rende +6 níveis por derrota, fora dos pontos. Inverter o sinal da recompensa:

- Nível de bônus vai para quem **vence confrontos**, não para quem desmaia: +1 nível para cada Pokémon que derrotou ao menos um oponente na batalha (cap +1 por batalha).
- Ou, mais simples: bônus de desmaio **só em batalha vencida** ("perdeu lutando numa vitória" = experiência; "time inteiro no chão numa derrota" = nada).

- ✅ Fecha o segundo buraco que as propostas de pontos não tocam.
- ✅ Uma condição a mais no código que já distribui o +1.
- ⚠️ Sem isso, A/B/C resolvem só metade do problema. **Esta é obrigatória em qualquer combinação.**

---

## Proposta E — Socorro não-numérico (piedade que não engorda)

Substituir o prêmio em pontos da derrota por ajudas que **facilitam vencer sem aumentar poder permanente**:

- Revelar o time completo do líder antes da revanche (informação);
- Uma reorganização grátis da ordem de batalha com dica ("o Onix dele abre a luta…");
- +10% de HP só na próxima revanche (buff temporário, expira ao vencer);
- Na 4ª derrota (à beira do game over): escolher 1 Pokémon do pool da perna atual como reforço de emergência — poder novo, mas limitado ao pool, não empilhável.

- ✅ Quem perde recebe ferramentas, não músculos: feeding não acumula nada.
- ✅ O drama da 5ª tentativa fica épico (reforço de emergência!) sem quebrar a Liga.
- ⚠️ Mais telas/UX para desenhar; é a proposta mais cara em trabalho de interface.

---

## Proposta F — A Liga nivela tudo (mata o motivo do feeding)

O feeding só vale a pena porque o nível farmado **entra na Liga**. Então normalizem na porta:

- **Orçamento de níveis na inscrição**: a soma dos níveis do time inscrito não pode passar de ~270 (média 45). Excedeu? A UI pede para escalar quais Pokémon abrem mão de níveis (só para a Liga; o save não muda).
- Ou o modo "Flat" dos jogos oficiais: **todos os Pokémon entram nivelados em 50** — a Liga vira 100% composição, tipo e estratégia.

- ✅ Elimina o incentivo na raiz: não importa o que você farmou, a Liga não vê.
- ✅ **Precisa ser validada na Cloud Function** de qualquer forma (hoje ela aceita nível 200!) — vocês ganham o anti-feeding e o anti-cheat na mesma linha de código.
- ✅ De quebra equilibra novatos vs veteranos no online.
- ⚠️ Reduz a sensação de "meu time ficou forte" na Liga — por isso funciona melhor **junto com** A+D (a jornada continua premiando, a Liga continua justa).

---

## Comparação rápida

| | Mata o feeding? | Protege quem perde de verdade? | Esforço | Pode ser burlada? |
|---|---|---|---|---|
| **A — Empréstimo** | ✅ total | ✅ +5 imediato na dificuldade | 🟢 mínimo | Não — total é invariante |
| **B — Orçamento 90** | ✅ total | ➖ neutra | 🟢 baixo | Não — e valida no servidor |
| **C — Revanche encarece** | ✅ desestimula | ⚠️ pode punir demais | 🟢 baixo | Não, mas dose importa |
| **D — Fim do nível por desmaio** | ✅ fecha canal oculto | ➖ neutra | 🟢 mínimo | Não |
| **E — Socorro não-numérico** | ✅ nada acumula | ✅✅ a melhor nesse quesito | 🟡 médio | Reforço de emergência precisa de cap |
| **F — Liga nivelada** | ✅ remove o motivo | ✅ novatos competem | 🟡 médio (+ função) | Só se não validar no servidor |

## Recomendação de pacote

**A + D agora** (duas mudanças pequenas que zeram o exploit matematicamente), **B como trava permanente** na sequência, e **F na Liga junto com a validação server-side** que já era urgente por segurança — o mesmo deploy conserta cheat e feeding. C e E são temperos opcionais por cima: C dá narrativa, E dá drama.

Um teste de sanidade depois de implementar: peçam ao Claude Code um script que simule as duas estratégias ("vencer tudo" vs "perder 4× de propósito") e confirme que a segunda nunca termina com mais poder total. Se a simulação empatar ou favorecer a vitória, o buraco está fechado — e fica um teste de regressão pra sempre que mexerem na economia.
