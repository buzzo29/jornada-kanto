# Ideias — Jornada Kanto
*Baseadas nas mecânicas reais do jogo (pools por perna, pontos de nível, 5 derrotas = game over, batalha automática por tipo/BST, Liga por ciclos).*

Legenda de esforço: 🟢 fácil (algumas horas) · 🟡 médio (um fim de semana) · 🔴 grande (muda estrutura)

---

## 1. EQUIPE ROCKET 🚀

### 1.1 Emboscadas Rocket entre ginásios 🟡
Depois do encontro selvagem, chance de ~20% de um Recruta Rocket emboscar o jogador. Batalha extra com time temático (Rattata, Zubat, Ekans, Koffing, Grimer — todos já estão no jogo). Vitória = +3 pontos de nível bônus; derrota = ele **rouba metade dos pontos** da próxima distribuição (não conta como derrota das 5 — a punição é econômica, não fatal). Usa o motor de batalha que já existe, só precisa de times fixos e uma tela.

### 1.2 Jessie & James recorrentes 🟢
A dupla aparece 2–3 vezes na jornada com o Meowth, sempre um pouco mais forte, sempre perdendo com falas cômicas ("Estamos decolando de novooo! ✨"). Vencer as três = conquista nova. Custo baixíssimo, retorno de carisma altíssimo — o jogo já tem sistema de conquistas pronto.

### 1.3 Roubo de Pokémon + resgate no esconderijo 🔴
Se perder para um Rocket, ele **sequestra um Pokémon aleatório do time**. Antes do próximo ginásio, abre o "Esconderijo Rocket": 2 batalhas seguidas sem redistribuir pontos para resgatá-lo. Se ignorar, o Pokémon volta só depois do ginásio (com -2 níveis, "maltratado"). Cria tensão real sem ser cruel.

### 1.4 Arco que culmina no Giovanni 🟢
O 8º líder já É o Giovanni — usem isso! Cada emboscada Rocket vencida durante a jornada **enfraquece o ginásio final** (-1 nível no time dele por emboscada vencida, cap -4). O jogador que enfrenta os Rocket é recompensado na narrativa e na dificuldade. É só um contador no save.

### 1.5 Cassino Rocket (Celadon) 🟡
Na perna 4 (Erika/Celadon), evento opcional: apostar X pontos de nível num "caça-níquel" retrô (animação de 3 rolos com sprites). Prêmios: pontos em dobro, um Pokémon raro do pool (Porygon!, Scyther, Pinsir), ou perder tudo. Porygon como exclusivo do cassino é fiel ao original e dá motivo pra arriscar.

---

## 2. O RIVAL (tipo Gary) 😤

### 2.1 A mecânica de ouro: o rival fica com o que você recusou 🟡⭐
Esta é a ideia mais forte da lista e encaixa perfeitamente no sistema de vocês: a cada encontro selvagem o jogador vê 5 ofertas e leva até 3 — **as que você recusou vão pro time do rival**. Quando ele te desafia, você enfrenta literalmente as suas escolhas rejeitadas. Custo técnico baixo (guardar os IDs recusados no save) e profundidade estratégica enorme: recusar um Abra forte vira uma decisão com consequência.

### 2.2 Starter clássico invertido 🟢
O rival começa com o inicial forte contra o seu (escolheu Bulbasaur → ele tem Charmander) e o evolui no mesmo ritmo que o seu. Uma linha de código na criação do save.

### 2.3 Batalhas em pontos fixos com escala dinâmica 🟡
Rival aparece após os ginásios 2, 4 e 6, e uma última vez **antes da Liga** (como Gary campeão). Níveis dele = média do seu time +1 (sempre um passinho à frente, como o original). Derrota pro rival não conta nas 5 derrotas — mas ele zomba, e vencer todas as 4 dá conquista ("Cheiro de derrota, Gary?").

### 2.4 Nome e provocações 🟢
Jogador nomeia o rival na criação do save (default sugerido: "Gary"). Banco de ~15 falas de provocação sorteadas antes/depois das batalhas. Texto puro, custo zero, memorabilidade máxima.

### 2.5 Rival na Liga online 🔴
Se quiserem ousar: o "fantasma" do rival (time + nome) entra como bot preenchendo vagas ímpares nos chaveamentos da Liga — resolve o problema real de sobras no sorteio (hoje quem sobra espera o próximo ciclo) e dá crossover entre modo solo e online.

---

## 3. OUTRAS COISAS DIVERTIDAS ✨

- **Snorlax bloqueando a estrada** 🟢 — evento fixo na perna 5: lutar contra um Snorlax Lv.30 (difícil) para capturá-lo, ou contorná-lo (sem prêmio). Um botão, uma batalha, memória afetiva instantânea.
- **Torre de Lavender** 🟡 — na perna 6, mini-evento de 3 batalhas contra fantasmas (Gastly/Haunter/Gengar). Recompensa: o Gengar entra nas ofertas do próximo encontro.
- **Zona de Safári** 🟡 — uma vez por jornada, rodada especial de captura: 8 ofertas em vez de 5, incluindo raros (Chansey, Kangaskhan, Tauros, Dratini), mas cada escolha tem 30% do Pokémon "fugir". Tensão de Safári real.
- **Trocas com NPC** 🟢 — 2–3 ofertas fixas por jornada ("troco seu Slowbro por meu Machamp"). De quebra, resolve as evoluções por troca (Machamp, Golem, Alakazam, Gengar) que hoje dependem de nível 40.
- **Shinies** 🟢⭐ — chance de 1/128 no encontro: sprite shiny (o PokéAPI tem a pasta `/shiny/` — troca de URL) + borda dourada + conquista "Estrela Rara". Praticamente grátis e os jogadores AMAM.
- **Creche (Day Care)** 🟢 — deixar 1 Pokémon fora da batalha do ginásio; ele volta com +2 níveis depois. Decisão de gestão de time simples e interessante.
- **Modo Nuzlocke** 🟡 — toggle na criação do save: Pokémon que desmaia é liberado pra sempre, e derrota = game over direto. Ranking separado na Liga pra quem zerar assim. Rejogabilidade infinita pra veteranos.
- **Desafio diário com seed global** 🟡 — todo dia, uma seed compartilhada gera as MESMAS ofertas selvagens pra todo mundo (o jogo já tem RNG com seed!). Ranking do dia: quem zerou com menos derrotas. Custo baixo, retenção alta.
- **Insígnias com efeito passivo** 🟢 — cada insígnia dá +1% de dano na jornada (max +8%). As insígnias viram progressão sentida, não só enfeite.

---

## 4. BALANCEAMENTO ⚖️

*O motor atual: dano = (nível×2,5 + BST/35) × melhor multiplicador de tipo do atacante ÷ defesa derivada do BST, com aleatório 0,75–1,25 e fadiga progressiva de quem vence.*

### 4.1 O problema nº 1: BST é rei absoluto 🟡⭐
Como ataque E defesa derivam do BST total, um time é basicamente "some os maiores BST". Dragonite/Snorlax/lendários dominam qualquer composição criativa. Ideias em ordem de esforço:

- **Orçamento de BST por time (salary cap)**: o time de 6 pode somar no máx. ~2.800 de BST na Liga. De repente Dragonite (600) custa caro e um Raticate (413) tem função. Cria um metagame de composição em vez de "6 maiores números". 🟡
- **Usar stats reais em vez de BST**: o PokéAPI tem Atk/Def/Speed separados. Ataque usa Atk do atacante vs Def do defensor; **Speed decide quem bate primeiro** (hoje o dano é simultâneo). Golduck rápido vira viável; Snorlax leva dano antes de responder. É a mudança que mais adiciona profundidade. 🔴
- **Suavizar o termo BST**: trocar `BST/35` por `√BST×k` comprime a vantagem dos topos sem reescrever nada. 🟢

### 4.2 Multiplicador de tipo: "melhor tipo sempre" achata as dual-types 🟢
Hoje o atacante sempre usa o melhor multiplicador entre seus tipos — dual-type é estritamente melhor, sem downside. Alternativa: a cada confronto, sortear qual tipo o Pokémon "usa" (70% melhor / 30% outro), ou aplicar média ponderada. Dual-types continuam bons, mas não dominantes automáticos.

### 4.3 Espiral da morte nas derrotas 🟢⭐
Perder dá +5 pontos vs +10 da vitória — quem perde fica pra trás E gasta uma das 5 vidas: punição dupla que gera espiral. Sugestões: derrota dá +8 (quase alcança, ainda dói), e um **mecanismo de piedade**: na 4ª derrota, +12 pontos ("seus Pokémon treinaram com raiva"). Game over continua existindo, mas a reta final fica épica em vez de arrastada.

### 4.4 Raridade nos pools 🟢
Se hoje as 5 ofertas são uniformes no pool, um Dratini vale o mesmo sorteio que um Rattata. Pesar a chance pelo inverso do BST (raros são raros) + **pity system**: se em 3 encontros não veio nenhuma oferta acima de X BST, a próxima garante uma. O momento "VEIO UM LAPRAS!" é o dopamina-core do gênero.

### 4.5 Liga: validação e fairness 🟡 (urgente, cruza com segurança)
- **Aplicar o teto 55 e o cap de evolução no servidor** — hoje a Cloud Function aceita nível até 200; as regras do jogo só existem na UI. É balanceamento E anti-cheat ao mesmo tempo.
- **Máx. 1 lendário por time na Liga** (Moltres/Zapdos/Articuno/Mewtwo) — senão o endgame vira corrida de aves.
- **Seeds por força**: chavear a Liga ordenando por soma de níveis+BST (fortes se enfrentam cedo) ou criar divisões — hoje o sorteio é puro, e um novato cai no 6-Dragonite na primeira rodada.
- **Bônus de diversidade**: +2% de dano por tipo único no time (max +12%). Empurra gentilmente contra times monotipo de meta.

### 4.6 Balancear com dados, não com achismo 🟡⭐
A maior vantagem de vocês: o motor de batalha é JS puro e determinístico. Dá pra escrever um script Node que roda **100 mil batalhas simuladas** entre todas as espécies/níveis e cospe uma tabela de winrate — aí vocês enxergam exatamente quem está OP antes e depois de cada ajuste (e o Claude Code escreve esse script em minutos). Nenhum jogo indie balanceia melhor do que isso.

### 4.7 Detalhe que já está bom 👍
A fadiga progressiva de quem vence confrontos seguidos é uma ótima ideia anti-snowball — mantém batalhas 6×6 disputadas. Só documentem a curva num comentário pra não quebrarem sem querer (e lembrem: ela existe COPIADA em `functions/index.js` — qualquer ajuste tem que ir nos dois lugares até unificarem o motor).

---

## Ordem sugerida de implementação

| Rodada | Itens | Por quê |
|--------|-------|---------|
| 1 | Shinies (3.5) + provocações do rival (2.4) + starter invertido (2.2) + Jessie & James (1.2) | Máximo carisma por hora de trabalho |
| 2 | Rival com recusados (2.1) + emboscadas Rocket (1.1) + arco Giovanni (1.4) | A jornada ganha história e consequência |
| 3 | Piedade nas derrotas (4.3) + raridade nos pools (4.4) + suavizar BST (4.1) | Balanceamento sentido por todo jogador |
| 4 | Validação da Liga (4.5) + script de simulação (4.6) | Liga justa e dados pra iterar |
| 5 | Safári, Snorlax, Nuzlocke, desafio diário | Conteúdo de longo prazo |
