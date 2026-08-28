# Jornada Kanto

Fangame de Pokémon Gen 1 em português, jogável no navegador. No ar em jornadakanto.com.
Dev: Matheus (Buzzo no jogo).

Este arquivo guarda **decisões e armadilhas** — o que NÃO dá pra deduzir lendo o código.
Estrutura de arquivos, dependências e o que cada função faz: leia o código, ele é comentado.

---

## Regras de trabalho

- **Sempre medir antes de afirmar.** Este projeto tem um motor de batalha determinístico e
  simulável. Antes de mudar balanceamento, rode uma simulação (alguns milhares de batalhas) e
  mostre o número. Várias decisões aqui foram revertidas porque a simulação contradisse a intuição.
- **Nunca mudar balanceamento sem apresentar o impacto medido**, mesmo que o pedido seja direto.
  Fazer o que foi pedido E dizer o que aquilo custa.
- `pokemon-ginasio.html` e `index.js` têm **tabelas duplicadas** (SPECIES, EVOLUTIONS, TERRAINS,
  o motor de batalha). Ao mexer numa, mexer na outra e **verificar que ficaram idênticas**.
  Divergência aqui = mesma batalha com resultados diferentes no cliente e no servidor.
- Depois de editar o HTML, extrair os `<script>` e rodar `node --check`. O arquivo tem ~14k linhas
  e um erro de sintaxe quebra o jogo inteiro em silêncio.
- Comentar o **porquê**, não o quê. Os comentários deste projeto explicam decisões e bugs antigos;
  são eles que sobrevivem à troca de ferramenta ou de contexto.

## Deploy

- `firebase deploy` — tudo (regras → functions → hosting)
- `firebase deploy --only hosting` — só o HTML
- `firebase deploy --only functions` — só o servidor
- Quando cliente e servidor mudam juntos, **subir os dois na mesma leva**.

---

## Motor de batalha

- Fórmula fiel à Gen 1, com dano calculado como fração da vida e reescalado.
- **Multiplicador de tipo é comprimido (`^0.6`)**: 2× vira ~1,52×. Decisão consciente — não dá pra
  trocar de pokémon no meio do confronto, e tipo puro viraria sentença de morte.
- **Imunidades valem 0,25, não 0.** Consequência da mesma decisão. Normal acerta Fantasma.
- Crítico depende da velocidade (Gen 1). Velocidade alta é mais valiosa do que parece.
- Buffs: shiny 1,15× e terreno 1,10×, **só ofensivos**.
- Subtipos: 69 espécies atacam por um tipo alternativo quando rende mais dano. Sem STAB, com
  redutor 0,85.
- Teto de nível: **99** (`MAX_POKEMON_LEVEL`).

## Progressão da jornada

- Distribuição de níveis trava em **55**; acima disso só desmaio, Bônus de Kanto e Doce Raro.
- **Desmaiar dá +1 nível.** Isso já foi explorado: jogadores perdiam de propósito porque a
  distribuição tem teto e o desmaio não. Corrigido pelo Bônus de Kanto (abaixo), não removido —
  o desmaio ainda é a rede de quem está atrás.
- **Bônus de Kanto**: ao vencer o Giovanni, +4/+3/+2/+1/0 níveis pro time todo conforme as derrotas
  totais (0-5 / 6-10 / 11-15 / 16-22 / 23+). Inverte o incentivo: hoje quem farma derrota termina
  ABAIXO de quem joga limpo.
- **O limite de 5 derrotas é POR GINÁSIO**, não da jornada. O contador zera a cada vitória.
  (Errei isso numa simulação e conclui que o jogo era impossível.)
- Perder um ginásio dá +5 níveis pra distribuir (3 no modo difícil). É mecanismo previsto, não
  punição: sem ele, ~100% das jornadas morrem no Brock.
- **O bolo é do TIME; cada pokémon recebe no máximo metade dele.** Bolo 5 = teto 3 por pokémon.
  Fonte de confusão recorrente — a mensagem na tela diz os dois números.

## Modo difícil (`gameMode: 'hard'`)

- Bolo de vitória pela metade **a partir do 3º ginásio**. Os dois primeiros ficam normais porque
  reduzir desde o início matava 100% das jornadas no Brock (medido).
- Derrota vale 3 desde o 1º ginásio. Custo medido: 14% morrem no Brock, conclusão cai de 29% → 24%.
- 50% dos pokémon dos líderes vêm shiny. **Efeito mecânico pequeno** — é sinalização visual.
- Chance de shiny selvagem 4× (1/32). Vale também para os iniciais.

## Torre dos Treinadores

- 10 andares, médias **58, 61, 64, 67, 70, 73, 76, 79, 82, 85** (linear, +3 por andar).
  Escala escolhida pra ter porta de entrada: um campeão da Elite (~67) chega ao andar 5.
- Times de 6 evoluções finais, níveis espalhados ±3 com os dois extremos garantidos.
- Mewtwo e Eevee fora do pool.
- Recompensa: 1 Doce Raro por torre vencida (+1 nível num pokémon). Creditado no servidor.

## Batalha Online

- **Não é turno a turno.** É confronto a confronto: o motor resolve uma dupla de cada vez, e entre
  confrontos abre janela de escolha (10s no inicial, 5s nas trocas).
- **Não existe cron.** O estado guarda um prazo, e quem consultar depois dele dispara a resolução.
  Se os dois fecharem a aba, a partida congela em vez de gastar recursos.
- **Prazos são carimbos do servidor.** O cliente sincroniza o relógio (`serverNow` vem em toda
  resposta). Comparar com `Date.now()` local desloca a contagem — relógios de celular não batem.
- Folga de 600ms antes de resolver: escolhas em trânsito ainda contam.
- Pareamento e desafio do lobby criam a MESMA pendência, com 15s pra aceitar. Só volta pra fila
  quem tinha aceitado — recolocar quem não aceitou criava fantasmas eternos na fila.
- Presença do lobby: carimbo de tempo renovado a cada 4s, expira em 20s.

## Frontend

- **Não redesenhar a tela durante animações.** Cada `render()` recria o HTML e mata a transição
  CSS da barra de HP no meio. Animações atualizam o DOM diretamente. Já causou três bugs.
- Timers que dependem de `render()` param quando o render fica raro. Cronômetros têm laço próprio.
- Barra de HP: usar `renderHpBar` e as classes `hp-bar-fill` + `hpBarClass`. Marcação própria
  parece igual mas não recebe as regras de cor.
- Ícones da home são pixel art em base64 na constante `ICONES`. **Diagonais finas não sobrevivem
  à redução** — usar formas sólidas.
- Testar layout em 320px, não só 390px.

## Armadilhas conhecidas

- O Mewtwo emprestado é gravado pelo servidor com só `{speciesId, level, shiny}`. `hydrateTeam()`
  completa os campos no carregamento — sem isso, qualquer tela que leia `p.types` quebra.
- `createInstance()` não copia a flag `shiny`. Ao criar instâncias manualmente, copiar na mão.
- Ao transformar algo em fase própria (ex: a contagem regressiva da batalha online), **procurar o
  bloco antigo**: ele costuma continuar disparando sozinho. Aconteceu duas vezes.
- Pokédex normal e shiny são listas separadas. Marcador de "já tenho" precisa consultar a certa.

## Contexto do jogador

- Ele testa em celular e manda print. Vale renderizar a tela e conferir antes de entregar.
- Prefere entender o custo de uma decisão a receber só o resultado.
