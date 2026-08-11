# Economia de Habilidade — piso fixo, teto por mérito
*Jornada Kanto · v2 das propostas anti-feeding: punir a derrota intencional SEM achatar o jogo, premiando habilidade, estratégia, conhecimento e sorte. Sem limites de time.*

---

## O princípio de design

O problema da v1 (empréstimo puro + orçamento fechado) é que ela zera o feeding tornando o total **sempre 90** — determinístico demais: o jogador excelente e o mediano terminam idênticos. A correção é mudar de onde vem a variância:

> **A derrota define o PISO. O mérito e a sorte definem o TETO.**
> Variância só para cima, e só vinda de: desempenho na vitória, risco assumido por escolha, conhecimento aplicado e sorte — **nunca de perder**.

Com isso, perder de propósito não é punido com castigo — é punido com **custo de oportunidade**: cada derrota é uma vitória que deixou de pontuar bônus. O feeder não apanha; ele simplesmente fica pobre.

A fundação continua sendo o par da v1 (barato e obrigatório):
- **Empréstimo**: derrota dá +5 adiantados, descontados da próxima vitória → derrotas nunca somam;
- **Fim do nível por desmaio em derrota**: bônus de desmaio só quando a batalha foi vencida.

Tudo abaixo constrói o teto em cima desse piso.

---

## 1. HABILIDADE — Vitória com nota 🥊

A vitória deixa de valer +10 fixos e passa a valer **+8 a +14** conforme o desempenho:

| Componente | Bônus |
|---|---|
| Base da vitória | +8 |
| Cada Pokémon seu que sobreviveu (cap 3) | +1 |
| Vitória na primeira tentativa contra o líder | +2 |
| **Vitória perfeita** (nenhum desmaio no seu time) | +1 extra e ✨ na tela |

- Vencer raspando na 3ª tentativa: +8. Vencer redondo de primeira: +14. A diferença de ~40% entre o teto e o piso da vitória é sentida, mas não esmaga.
- Habilidade aqui = montar o time certo pro líder (conhecimento de tipos), distribuir pontos com inteligência e **ordenar a batalha bem** — que são exatamente as três decisões que o jogo já pede.
- O motor já sabe quantos sobreviveram (o resultado da batalha guarda cada confronto) — é ler o que já existe.

## 2. ESTRATÉGIA — Desafios declarados (risco opt-in) 🎯

Antes da batalha do ginásio, o jogador pode **declarar um handicap** em troca de bônus se vencer:

| Desafio declarado | Bônus se vencer |
|---|---|
| "Vou vencer com apenas 4 Pokémon" | +3 |
| "Sem nenhum Pokémon com vantagem de tipo contra o líder" | +4 |
| "Ordem cega" (a ordem do time é sorteada) | +3 |
| "Mão amarrada" (seu Pokémon mais forte fica de fora) | +3 |

- Falhou? Sem bônus — e a derrota conta normal. O risco é real, mas é **escolhido**, nunca imposto.
- Máximo de 1 desafio por batalha (senão vira multiplicação de exploits).
- É a válvula de expressão pros veteranos: o jogador que já zerou 5 vezes joga "no hard" por escolha própria e o placar mostra isso.
- De quebra vira conteúdo de conquistas: "Vença um ginásio de ordem cega", "Vença Sabrina sem vantagem de tipo".

## 3. CONHECIMENTO — A aposta do treinador 🧠

Antes da batalha, uma pergunta opcional: **"Qual Pokémon seu será o MVP?"** (mais confrontos vencidos). Acertou → +2 pontos.

- Premia leitura de matchup: saber que o seu Golduck come o ginásio da Erika é conhecimento de Pokémon aplicado.
- Variante adicional: prever o placar ("vou vencer perdendo no máximo 2") → +1. Duas camadas de meta-conhecimento sem nenhuma UI complexa — dois selects antes do botão de lutar.
- Sorte também participa (o RNG da batalha pode trair a previsão) — e tudo bem, aposta é aposta.

## 4. SORTE — A roleta do vencedor 🎰

**Só quem vence gira.** Após cada vitória de ginásio, 3 cartas viradas pra baixo (estilo Emerald Battle Frontier); o jogador escolhe uma:

- 🍬 **Doce Raro** — +1 nível imediato num Pokémon à escolha (~35%)
- 💰 **+3 pontos** de nível (~35%)
- 🎁 **Nada além de glória** — uma frase engraçada e um sticker cosmético no save (~30%)

- A sorte existe, é emocionante, e está **atrás da porta da vitória** — impossível farmar perdendo.
- Somado ao drop raro na jornada: ~5% de chance de um encontro selvagem vir com um Doce Raro "no bolso" do Pokémon capturado. Sorte na exploração, também sem relação com derrota.

## 5. CONSISTÊNCIA — Maré de vitórias 🔥

Vitórias consecutivas de ginásio sem nenhuma derrota acumulam **+1 ponto por elo da sequência** (2ª vitória seguida +1, 3ª +2… cap +4).

- Derrota (qualquer uma, até as honestas) zera a maré — mas custa só o bônus de sequência, não o progresso.
- É o anti-feeding emocional: o feeder não perde nada que já tinha, mas assiste a maré que ele nunca vai ter. E o speedrunner de "zerou sem perder" tem seu prêmio contínuo, não só uma conquista no final.

---

## A matemática de ponta a ponta

| Arquétipo | Pontos aproximados na jornada |
|---|---|
| **Feeder** (perde 4× de propósito, vence no arrastão) | ~72–80 (empréstimos descontados, sem bônus, sem maré, sem roleta extra) |
| **Jogador mediano** (vence tudo, 2ª/3ª tentativas, sem apostas) | ~90–100 |
| **Jogador habilidoso** (primeira tentativa, times certos, apostas moderadas) | ~110–120 |
| **Mestre sortudo** (perfeito, desafios declarados, MVPs certeiros, roleta gorda) | ~130–140 |

O espectro fica com ~70% de amplitude entre o pior e o melhor caminho — variância de sobra pra ter graça — e o feeding sai do melhor lugar da tabela (onde está hoje) para o **pior**. Sem nenhuma regra proibitiva: ninguém é impedido de nada, só deixa de ser pago por perder.

## E a Liga, sem limites de time?

Respeitando o desejo de não limitar times por enquanto, duas medidas que não tocam na composição:

1. **Validação por teto teórico** (isso não é limite de jogo, é integridade): a Cloud Function rejeita times cuja soma de níveis exceda o máximo alcançável pela economia (~140 pontos no caminho perfeito). Hoje ela aceita nível 200 — validar contra o teto teórico conserta o cheat sem impor nenhuma regra nova a jogadores legítimos.
2. **Transparência**: mostrar no chaveamento a soma de níveis de cada time. Se a comunidade enxerga, a própria Liga cria cultura — e vocês ganham dados reais pra decidir depois, com calma, se algum limite será necessário.

## Ordem de implementação sugerida

1. Fundação v1: empréstimo + desmaio só premia em vitória (fecha o exploit — 1 tarde);
2. Vitória com nota (o coração do mérito — 1 tarde);
3. Roleta do vencedor (a diversão — 1 dia com a animação das cartas);
4. Aposta do treinador + maré (2 selects e um contador — 1 tarde);
5. Desafios declarados (o endgame dos veteranos — 1 fim de semana);
6. Validação por teto teórico na Cloud Function (junto com o pacote de segurança).

E o teste de regressão continua valendo, agora com a régua nova: simular os quatro arquétipos da tabela e confirmar que a ordem **Feeder < Mediano < Habilidoso < Mestre** se mantém depois de qualquer ajuste na economia.
