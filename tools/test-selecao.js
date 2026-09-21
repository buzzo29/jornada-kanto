/**
 * SELEÇÃO POKÉMON -- o draft da Ilha Kumquat (21/09/2026).
 *
 * O que ele existe pra pegar, em ordem de importância:
 *   1. o ACESSO: é modo administrativo, e a visibilidade não é a trava;
 *   2. a ORDEM DO DRAFT é a do pedido (1-2-2-2-2-2-1) e ela FECHA: 12 sorteados, 6 de cada lado --
 *      uma ordem que não fecha deixaria o jogador com 5 ou o bolo com sobra, e isso não aparece
 *      como erro, aparece como uma tela travada;
 *   3. o BOLO não tem lendário, não tem intocável e não repete LINHA evolutiva;
 *   4. quem RECUSA é a ação: fora da vez, fora da fase e no índice forjado;
 *   5. os dois lados lutam com o MESMO motor da casa e com o moveset inteiro da espécie;
 *   6. nada disto vai pro save.
 *
 *   node tools/test-selecao.js
 */
const path = require('path');
const raiz = path.join(__dirname, '..');
const { createSandbox } = require(path.join(__dirname, 'game-sandbox.js'));
const S = createSandbox();
const src = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');

let falhas = 0;
function ok(titulo, cond, extra){
  if(cond){ console.log('  OK     ' + titulo + (extra ? '   ' + extra : '')); }
  else { falhas++; console.log('  FALHOU ' + titulo + (extra ? '   ' + extra : '')); }
}
const g = S.__getGame ? S.__getGame() : S.game;
function contaAdmin(){
  g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
  g.saveSlotsCarregados = true; g.contaCarregada = true; g.ehAdmin = true;
  g.trainerName = 'Matheus'; g.aposentados = []; g.specialties = [];
  S.selecaoZerar();
}
/* roda o draft inteiro; `politica` diz o que O JOGADOR faz a cada vez */
function draftar(politica){
  S.selecaoComecar();
  let v = 0;
  while(S.selecao.fase === 'draft' && v++ < 60){
    if(S.selecaoVez() === 'npc') S.selecaoPicaNpc();
    else {
      const livres = S.selecao.pool.filter(p => !p.dono);
      const alvo = politica ? politica(livres) : livres[0];
      S.selecaoEscolher(S.selecao.pool.indexOf(alvo));
    }
  }
  return v;
}
const melhorBst = (l) => l.reduce((a, b) => S.bstOf(b.id) > S.bstOf(a.id) ? b : a);
const piorBst   = (l) => l.reduce((a, b) => S.bstOf(b.id) < S.bstOf(a.id) ? b : a);

/* ============================================================================
   1) O ACESSO
   ============================================================================ */
console.log('\n=== O ACESSO É SÓ DE QUEM TEM admin === true ===');
{
  contaAdmin(); g.ehAdmin = false; g.screen = 'ilhas';
  S.abrirSelecao();
  /* ⚠️ AS ILHAS ABRIRAM PRA TODO MUNDO em 21/09/2026 -- estas travas cobravam a RECUSA e
     viraram a trava da regra nova. O teste das ilhas cobre as SEIS portas num laço só. */
  ok('a AÇÃO ABRE pra quem não é admin', g.screen === 'selecao', 'tela: ' + g.screen);
  contaAdmin(); g.contaCarregada = false; g.screen = 'ilhas';
  S.abrirSelecao();
  ok('  e a conta carregando tambem abre', g.screen === 'selecao', 'tela: ' + g.screen);
  contaAdmin(); S.abrirSelecao();
  ok('  e deixa entrar quem é', g.screen === 'selecao', 'tela: ' + g.screen);
  /* ⚠️ E ELE NÃO PEDE TIME CAMPEÃO, ao contrário dos outros três: o bolo é sorteado na hora, e
     nenhum pokémon do jogador entra em campo. Exigir as 8 insígnias aqui seria uma régua sobre uma
     coleção que o modo não usa. */
  contaAdmin(); g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
  S.abrirSelecao();
  ok('  e entra mesmo sem save campeão nenhum', g.screen === 'selecao', 'tela: ' + g.screen);
}

/* ============================================================================
   2) ⚠️ A ORDEM DO DRAFT -- e ela é a trava que mais importa
   ============================================================================ */
console.log('\n=== A ORDEM 1-2-2-2-2-2-1 ===');
{
  const O = S.SELECAO_ORDEM;
  const total = O.reduce((s, [, n]) => s + n, 0);
  const meus = O.filter(([l]) => l === 'eu').reduce((s, [, n]) => s + n, 0);
  const dele = O.filter(([l]) => l === 'npc').reduce((s, [, n]) => s + n, 0);
  /* ⚠️ ELA TEM QUE FECHAR COM O BOLO: uma ordem que soma 11 ou 13 deixa o jogador com 5 ou o bolo
     com sobra -- e isso não aparece como erro, aparece como uma tela que não avança. */
  ok('a ordem gasta o bolo inteiro', total === S.SELECAO_POOL, total + ' de ' + S.SELECAO_POOL);
  ok('  e dá ' + S.SELECAO_TIME + ' pra cada lado', meus === S.SELECAO_TIME && dele === S.SELECAO_TIME,
     meus + ' x ' + dele);
  ok('  e o líder abre', O[0][0] === 'npc' && O[0][1] === 1, JSON.stringify(O[0]));
  ok('  e o líder fecha', O[O.length - 1][0] === 'npc' && O[O.length - 1][1] === 1);
  /* ⚠️ E ELA É EXATAMENTE JUSTA, e isso foi MEDIDO e não escolhido: com os dois lados pegando
     sempre o melhor disponível, a soma das POSIÇÕES escolhidas dá igual dos dois lados. É a
     propriedade do snake que o pedido descreve, e é ela que faz o modo não ser decidido pela vez. */
  let pos = 1, somaEu = 0, somaNpc = 0;
  O.forEach(([lado, n]) => { for(let k = 0; k < n; k++){
    if(lado === 'eu') somaEu += pos; else somaNpc += pos; pos++; } });
  ok('  e a soma das POSIÇÕES é a mesma dos dois lados', somaEu === somaNpc,
     somaEu + ' x ' + somaNpc);
}

/* ============================================================================
   3) O BOLO
   ============================================================================ */
console.log('\n=== OS 12 SORTEADOS ===');
{
  contaAdmin();
  let lendarios = 0, linhaRepetida = 0, especieRepetida = 0;
  const tamanhos = new Set();
  const vistos = new Set();
  for(let i = 0; i < 400; i++){
    const pool = S.selecaoSortearPool().bolo;
    tamanhos.add(pool.length);
    pool.forEach(p => vistos.add(p.id));
    /* ⚠️ NEM LENDÁRIO NEM INTOCÁVEL: um Mewtwo no bolo decidiria o draft sozinho, e os três
       intocáveis são bicho que o jogador nunca pode ter. */
    if(pool.some(p => S.ehLendario(p.id))) lendarios++;
    if(pool.some(p => (S.ESPECIES_INTOCAVEIS || []).indexOf(p.id) >= 0)) lendarios++;
    /* ⚠️ E SEM REPETIR LINHA: com Magikarp e Gyarados no mesmo bolo, os 12 viram 11 opções de
       verdade -- é a mesma regra do encontro selvagem e dos guardiões da Montanha. */
    if(new Set(pool.map(p => S.raizDaLinha(p.id))).size !== pool.length) linhaRepetida++;
    if(new Set(pool.map(p => p.id)).size !== pool.length) especieRepetida++;
  }
  ok('o bolo tem sempre ' + S.SELECAO_POOL, tamanhos.size === 1 && tamanhos.has(S.SELECAO_POOL),
     [...tamanhos].join(','));
  ok('  e nunca traz lendário nem intocável', lendarios === 0, lendarios + ' de 400');
  ok('  e nunca repete linha evolutiva', linhaRepetida === 0, linhaRepetida + ' de 400');
  ok('  nem espécie', especieRepetida === 0, especieRepetida + ' de 400');
  /* e ele VARIA de verdade -- um sorteio preso devolveria os mesmos 12 sempre */
  ok('  e ele varia entre os sorteios', vistos.size > 100, vistos.size + ' espécies distintas');
  /* ============================================================================
     ⚠️ AS TRÊS FAIXAS DE NÍVEL (21/09/2026, a pedido). Uma partida inteira roda numa faixa SÓ, e
     a ESPÉCIE tem que acompanhar -- foi na Vigília que isso custou um relato (*"está aparecendo
     Charizard no level 24"*), porque o `especieNoNivel` só anda PRA FRENTE.
     ============================================================================ */
  {
    const vistas = new Set();
    let foraDaFaixa = 0, formaErrada = 0, misturou = 0;
    for(let i = 0; i < 300; i++){
      const so = S.selecaoSortearPool();
      const f = so.faixa;
      vistas.add(f.join('-'));
      /* ⚠️ A PARTIDA INTEIRA RODA NUMA FAIXA SÓ: um bolo com níveis de duas faixas seria o
         contrário do pedido, e a escolha viraria uma conta de nível. */
      if(so.bolo.some(p => p.nivel < f[0] || p.nivel > f[1])) foraDaFaixa++;
      if(new Set(so.bolo.map(p => (p.nivel >= 55 ? 3 : p.nivel >= 35 ? 2 : 1))).size > 1) misturou++;
      /* ⚠️ E A ESPÉCIE BATE COM O NÍVEL: nada de Charizard no 24 nem de Caterpie no 58. */
      so.bolo.forEach(p => { if(S.formaNoNivel(p.id, p.nivel) !== p.id) formaErrada++; });
    }
    ok('as três faixas são sorteadas', vistas.size === S.SELECAO_FAIXAS.length,
       [...vistas].join(' | '));
    ok('  e a partida inteira roda numa faixa só', foraDaFaixa === 0 && misturou === 0,
       foraDaFaixa + ' fora / ' + misturou + ' misturados');
    ok('  e a espécie acompanha o nível', formaErrada === 0, formaErrada + ' formas impossíveis');
    /* a prova de que a conversão MORDE: na faixa baixa nada sai evoluído demais, e na alta as
       formas base somem -- é o que faz as três faixas serem três jogos diferentes */
    const bstDa = (f) => { let s = 0, n = 0;
      for(let i = 0; i < 80; i++) S.selecaoSortearPool(null, f).bolo.forEach(p => { s += S.bstOf(p.id); n++; });
      return s / n; };
    const baixa = bstDa(S.SELECAO_FAIXAS[0]), alta = bstDa(S.SELECAO_FAIXAS[2]);
    ok('  e a faixa alta traz formas MAIS evoluídas', alta > baixa + 40,
       'BST médio ' + baixa.toFixed(0) + ' (baixa) x ' + alta.toFixed(0) + ' (alta)');
  }
  /* ⚠️ E O NÍVEL DE CADA UM É O QUE O CARD MOSTRA: a instância nasce no SORTEIO, não no fim do
     draft -- senão o card mostraria um moveset que o time não levaria. */
  ok('a instância nasce no sorteio, com o nível e o moveset do card', (() => {
    draftar(melhorBst);
    const doBolo = S.selecao.pool.filter(p => p.dono === 'eu').map(p => p.mon);
    return S.selecao.meu.every((p, i) => p === doBolo[i]);
  })());
}

/* ============================================================================
   4) O DRAFT ACONTECE, E QUEM RECUSA É A AÇÃO
   ============================================================================ */
console.log('\n=== O DRAFT ===');
{
  contaAdmin(); S.abrirSelecao();
  ok('ele começa em `setup`', S.selecao.fase === 'setup', S.selecao.fase);
  S.selecaoComecar();
  ok('  e `Sortear` abre o draft', S.selecao.fase === 'draft' && S.selecao.pool.length === S.SELECAO_POOL);
  /* ⚠️ O LÍDER ABRE -- e enquanto é a vez dele a AÇÃO do jogador não faz nada. */
  ok('  com a vez do líder', S.selecaoVez() === 'npc');
  const antes = S.selecaoLivres().length;
  S.selecaoEscolher(0);
  ok('  e fora da minha vez o toque não faz nada', S.selecaoLivres().length === antes,
     S.selecaoLivres().length + ' livres');
  S.selecaoPicaNpc();
  ok('  o líder pega um', S.selecaoLivres().length === antes - 1);
  ok('  e passa a vez', S.selecaoVez() === 'eu', S.selecaoVez());
  /* ⚠️ ÍNDICE FORJADO E CARD JÁ LEVADO TAMBÉM NÃO: o toque pode vir do console. */
  const jaLevado = S.selecao.pool.findIndex(p => p.dono);
  const livres2 = S.selecaoLivres().length;
  [jaLevado, -1, 99, null, undefined, 'mikan'].forEach(v => {
    S.selecaoEscolher(v);
  });
  ok('  e o índice forjado ou já levado não muda nada', S.selecaoLivres().length === livres2,
     S.selecaoLivres().length + ' livres');

  /* o draft inteiro fecha em 6x6 */
  const voltas = draftar(melhorBst);
  ok('o draft fecha', S.selecao.fase === 'ordem', S.selecao.fase + ' em ' + voltas + ' voltas');
  ok('  com 6 de cada lado', S.selecao.meu.length === S.SELECAO_TIME &&
     S.selecao.dele.length === S.SELECAO_TIME, S.selecao.meu.length + ' x ' + S.selecao.dele.length);
  ok('  e o bolo vazio', S.selecaoLivres().length === 0);
  ok('  e ninguém nos dois times', (() => {
    const meus = new Set(S.selecao.meu.map(p => p.speciesId));
    return S.selecao.dele.every(p => !meus.has(p.speciesId));
  })());
  /* ⚠️ E OS DOIS LADOS LEVAM O MOVESET INTEIRO DA ESPÉCIE: ninguém ESCOLHEU golpe aqui (o bolo é
     sorteado, não vem de save), e a regra da casa é que quem não escolhe cai no `equiparNpc`. Dar
     a um lado e não ao outro seria a assimetria que o pedido não pede. */
  /* ⚠️ E A CONTA É CONTRA O QUE A ESPÉCIE OFERECE, não contra 6: o `equiparNpc` dá o moveset por
     NÍVEL, e há espécie que não aprende golpe de dano nenhum (o Ditto). Comparar com 6 fazia a
     trava falhar num bolo que sorteasse um deles -- um flake, o pior tipo de teste que existe. */
  const semGolpe = (t) => t.filter(p => !(p.ataques || []).length &&
     (S.ataquesPadrao(p) || []).length).map(p => p.name);
  ok('  e os DOIS lados levam o moveset que a espécie dá',
     semGolpe(S.selecao.meu).length === 0 && semGolpe(S.selecao.dele).length === 0,
     semGolpe(S.selecao.meu).concat(semGolpe(S.selecao.dele)).join(',') || 'todos');
}

/* ============================================================================
   5) ⚠️ O DRAFT DECIDE -- e é esse o número que justifica o modo
   ============================================================================ */
console.log('\n=== O QUE A ESCOLHA VALE ===');
{
  contaAdmin();
  const N = 120;
  const jogar = (politica) => {
    let venci = 0;
    for(let i = 0; i < N; i++){
      draftar(politica);
      if(S.simulateGymBattle(S.selecao.meu, S.selecao.dele).win) venci++;
    }
    return venci / N * 100;
  };
  const bem = jogar(melhorBst), mal = jogar(piorBst);
  /* ⚠️ COM OS DOIS JOGANDO A MESMA POLÍTICA O DUELO É MOEDA AO AR -- é a consequência do snake ser
     justo, e é o que prova que o modo não é decidido pela ordem. */
  ok('jogando igual ao líder, o duelo fica perto do empate', bem > 35 && bem < 65,
     bem.toFixed(1) + '%');
  /* e escolher MAL custa caro: sem isso o draft seria enfeite */
  ok('  e escolher mal afunda', mal < bem - 25, 'bem ' + bem.toFixed(1) + '% x mal ' + mal.toFixed(1) + '%');
}

/* ============================================================================
   6) A ORDEM DE ENTRADA E A BATALHA
   ============================================================================ */
console.log('\n=== A ORDEM E A LUTA ===');
{
  contaAdmin(); draftar(melhorBst);
  const antes = S.selecao.meu.map(p => p.speciesId).join(',');
  S.selecaoMover(0, 1);
  ok('as setas trocam a ordem', S.selecao.meu.map(p => p.speciesId).join(',') !== antes);
  S.selecaoMover(1, -1);
  ok('  e desfazem', S.selecao.meu.map(p => p.speciesId).join(',') === antes);
  S.selecaoMover(0, -1); S.selecaoMover(S.selecao.meu.length - 1, 1);
  ok('  e não saem da lista', S.selecao.meu.map(p => p.speciesId).join(',') === antes);

  /* ⚠️ A BATALHA É A DA CASA: o `simulateGymBattle` e o MESMO ciclo de revelação da Torre. */
  g.screen = 'selecao';
  S.selecaoLutar();
  ok('a batalha usa o ciclo de revelação da casa', g.screen === 'trainerBattling',
     'tela: ' + g.screen);
  ok('  com a marca da seleção', g.selecaoBattlePending === true);
  ok('  e um resultado com confrontos', !!g.trainerBattleResult &&
     (g.trainerBattleResult.matchups || []).length > 0,
     (g.trainerBattleResult.matchups || []).length + ' confrontos');
  /* ⚠️ E O 1º DE CADA LADO SE ENCARA -- é o que a tela promete. */
  const m0 = g.trainerBattleResult.matchups[0];
  ok('  e o 1º de cada lado abre', m0.playerSpecies === S.selecao.meu[0].speciesId &&
     m0.enemySpecies === S.selecao.dele[0].speciesId,
     m0.playerSpecies + ' x ' + m0.enemySpecies);
  /* o fim volta pro resultado, e o resultado traz o log da casa */
  S.finishTrainerBattle ? S.finishTrainerBattle() : (g.selecaoBattlePending = false, g.screen = 'selecaoResultado');
  ok('  e o fim leva ao resultado', g.screen === 'selecaoResultado', 'tela: ' + g.screen);
  const h = S.renderSelecaoResultado();
  ok('  que traz o log da casa', h.indexOf('matchup-row') >= 0);
  /* ⚠️ O "SORTEAR OUTRO BOLO" SAIU (21/09/2026, a pedido) -- e a função foi junto, porque ela não
     tinha outro chamador. Função de apresentação sem chamador é exatamente o tipo de coisa que
     fica anos no arquivo. */
  ok('  e NÃO tem mais o "sortear outro bolo"', h.indexOf('selecaoReiniciar') < 0);
  ok('  e a função foi junto', src.indexOf('function selecaoReiniciar') < 0);
  /* ⚠️ E ELE MOSTRA O TOP 10 CONTRA A LUANA, que é o que a tela passou a ter no lugar. */
  ok('  e mostra o Top 10 contra a Luana', h.indexOf('Top 10 contra Luana') >= 0);
}

/* ============================================================================
   7) A TELA
   ============================================================================ */
console.log('\n=== A TELA ===');
{
  contaAdmin(); S.abrirSelecao();
  ok('o roteador conhece a tela `selecao`', /case 'selecao': html = renderSelecao\(\); break;/.test(src));
  ok('  e a `selecaoResultado`', /case 'selecaoResultado': html = renderSelecaoResultado\(\); break;/.test(src));
  ok('o setup tem o botão de sortear', S.renderSelecao().indexOf('selecaoComecar()') >= 0);
  ok('  e uma saída', S.renderSelecao().indexOf('sairDaSelecao()') >= 0);

  S.selecaoComecar();
  while(S.selecaoVez() === 'npc') S.selecaoPicaNpc();
  const h = S.renderSelecao();
  /* ⚠️ O CARD TEM CLASSE PRÓPRIA desde 21/09/2026 (`.selecao-card`): ele cresceu pra caber nível,
     tipos e ataques, e o `.tower-pick` da casa é um quadro de sprite e nome. */
  ok('o bolo desenha os ' + S.SELECAO_POOL, (h.match(/selecao-card/g) || []).length === S.SELECAO_POOL,
     (h.match(/selecao-card/g) || []).length);
  /* ⚠️ E CADA CARD MOSTRA NÍVEL, TIPOS E ATAQUES -- as três coisas que a escolha usa. */
  ok('  com o nível de cada um', S.selecao.pool.every(x => h.indexOf('Lv.' + x.nivel) >= 0));
  ok('  com os tipos', (h.match(/selecao-tipos/g) || []).length === S.SELECAO_POOL);
  ok('  e com os ataques', (h.match(/selecao-golpes/g) || []).length === S.SELECAO_POOL);
  /* ⚠️ ORDENADOS POR PODER, o mais forte primeiro: num card de 12 candidatos o olho lê os dois
     primeiros, e ali tem que estar o que decide. */
  /* ⚠️ SÃO OS TRÊS MAIS FORTES desde 21/09/2026 (a pedido), e a trava mudou de forma junto: ela
     procurava o golpe MAIS FRACO no HTML, e ele deixou de estar lá -- `indexOf` devolvia -1 e ela
     caía com o código certo. Hoje ela cobra a regra: no máximo três, e eles são o topo da lista.
     ⚠️ E O QUE O CARD ESCONDE FOI MEDIDO: o motor escolhe pelo DANO, então o golpe fraco quase
     nunca sai -- o escolhido está fora dos três mais fortes em 2,0% dos pares. */
  {
    /* ⚠️ OS NOMES SÃO EXTRAÍDOS DO HTML, um por selo -- nunca procurados com `indexOf`: "Investida"
       é SUBSTRING de "Investida Dupla", e com a busca por nome um golpe ESCONDIDO contava como
       mostrado sempre que o nome dele fosse pedaço do nome de outro. Isso derrubava a trava ~1
       rodada em 8, com o card certo o tempo todo. */
    const nomesDoHtml = (html) => (html.match(/<span class="type-pill"[^>]*>([^<]*)<\/span>/g) || [])
      .map(t => t.replace(/^[^>]*>/, '').replace(/<\/span>$/, ''));
    const comGolpe = S.selecao.pool.find(x => (x.mon.ataques || []).length > 1) || S.selecao.pool[0];
    const ordenado = (comGolpe.mon.ataques || []).slice()
      .sort((a, b) => S.poderEfetivo(b) - S.poderEfetivo(a));
    const mostrados = nomesDoHtml(S.selecaoGolpesHtml(comGolpe.mon));
    ok('  e o card mostra no máximo ' + S.SELECAO_GOLPES_NO_CARD + ' golpes',
       mostrados.length <= S.SELECAO_GOLPES_NO_CARD,
       mostrados.length + ' de ' + ordenado.length);
    /* ⚠️ E A COMPARAÇÃO PASSA PELO MESMO `escapeHtmlSafe` DO JOGO: o nome sai ESCAPADO no HTML, e
       "Jato d'Água" vira "Jato d&#39;Água". Comparado com o nome cru, a trava caía ~1 rodada em 10
       -- só nos bolos que sorteavam um golpe com apóstrofo. */
    ok('  e eles são os mais fortes, do mais forte pro mais fraco',
       mostrados.every((n, k) => n === S.escapeHtmlSafe(S.nomeDoAtaque(ordenado[k]))),
       mostrados.join(' > '));
    /* ⚠️ E QUEM TEM MAIS QUE TRÊS TEM MESMO ALGO DE FORA -- sem isso a trava acima passaria num bolo
       que por acaso não tivesse ninguém com quatro golpes, e não mediria nada. */
    const gordo = S.selecao.pool.find(x => (x.mon.ataques || []).length > S.SELECAO_GOLPES_NO_CARD);
    if(gordo){
      const vistos = nomesDoHtml(S.selecaoGolpesHtml(gordo.mon));
      ok('  e o que sobra do topo fica de fora',
         vistos.length === S.SELECAO_GOLPES_NO_CARD,
         gordo.mon.ataques.length + ' golpes, ' + (gordo.mon.ataques.length - vistos.length) + ' fora');
    }
    /* ⚠️ E A BATALHA NÃO FOI TOCADA: o corte é do CARD. Cortar o moveset seria mexer no
       balanceamento da ilha, que não foi o que se pediu. */
    ok('  e o pokémon continua LEVANDO o moveset inteiro',
       S.selecao.pool.every(x => (x.mon.ataques || []).length
         === S.ataquesDisponiveis(x.mon.speciesId, x.mon.level).length),
       'o card corta, o time não');
  }
  /* ⚠️ QUEM JÁ FOI LEVADO NÃO SOME: ele apaga e ganha a faixa de quem levou. Sumindo, o jogador
     perderia a única coisa que um draft tem a contar -- o que o outro lado está montando. */
  const levados = S.selecao.pool.filter(p => p.dono).length;
  ok('  e quem já foi levado continua na tela, com a faixa',
     (h.match(/selecao-dono/g) || []).length === levados, levados + ' levados');
  ok('  e só os livres clicam',
     (h.match(/selecaoEscolher\(/g) || []).length === S.selecaoLivres().length,
     (h.match(/selecaoEscolher\(/g) || []).length + ' de ' + S.selecaoLivres().length);

  /* ⚠️ NA VEZ DO LÍDER NINGUÉM CLICA -- a tela não pode oferecer um toque que a ação vai recusar. */
  S.selecaoEscolher(S.selecao.pool.findIndex(p => !p.dono));
  S.selecaoEscolher(S.selecao.pool.findIndex(p => !p.dono));
  ok('na vez do líder nenhum card clica',
     S.selecaoVez() !== 'npc' || S.renderSelecao().indexOf('selecaoEscolher(') < 0,
     'vez: ' + S.selecaoVez());

  /* a tela de ordem */
  contaAdmin(); draftar(melhorBst);
  const ho = S.renderSelecao();
  ok('a tela de ordem tem as setas', (ho.match(/selecaoMover\(/g) || []).length === S.SELECAO_TIME * 2,
     (ho.match(/selecaoMover\(/g) || []).length);
  ok('  e mostra o time do líder', S.selecao.dele.every(p => ho.indexOf(p.name) >= 0));
  /* ⚠️ OS DOIS TÍTULOS SÃO `<h2>`, a MESMA fonte do "A ordem de entrada" logo acima (21/09/2026,
     a pedido). Eles eram uma `div` de classe própria -- e a classe NUNCA teve regra na folha, ou
     seja eles saíam em texto de corpo ao lado de um título. Classe que não existe não dá erro:
     ela só não faz nada. A varredura de classe fantasma do `test-pescaria` cobre só `class="btn
     ..."`, então ela não pegava esta.
     ⚠️ E O "Seu time" VIROU "Time de Treinador", também a pedido. */
  ok('  e os títulos dos dois times são `h2`, como o da ordem',
     ho.indexOf('<h2>Time de Treinador</h2>') >= 0 &&
     ho.indexOf('<h2>Time de Luana</h2>') >= 0,
     (ho.split('<h2>').length - 1) + ' blocos h2');
  ok('  e o `section-title` saiu da tela', ho.indexOf('section-title') < 0);
  ok('  e não diz mais "Seu time"', !/Seu [Tt]ime/.test(ho));
  ok('  e o botão de lutar', ho.indexOf('selecaoLutar()') >= 0);
}

/* ============================================================================
   8) NADA DISTO VAI PRO SAVE
   ============================================================================ */
console.log('\n=== O SAVE ===');
{
  contaAdmin();
  g.saveSlots[0] = { team: [{ speciesId: 'blastoise', level: 70, id: 'a1' }], badgeCount: 8 };
  const antes = JSON.stringify(g.saveSlots[0]);
  draftar(melhorBst);
  S.selecaoLutar();
  ok('o save fica byte a byte igual', JSON.stringify(g.saveSlots[0]) === antes);
  /* ⚠️ O ESTADO VIVE FORA DO `game`: nada disto pode ir pro Firestore. */
  ok('  e `selecao` não é um campo do game', g.selecao === undefined);
  g.screen = 'saveSelect';
  ok('  nem aparece no serializeGame', JSON.stringify(S.serializeGame()).indexOf('selecao') < 0);
}

/* ============================================================================
   9) A ILHA
   ============================================================================ */
console.log('\n=== A ILHA KUMQUAT ===');
{
  const ilha = S.ILHAS_LARANJA.find(i => i.id === 'kumquat');
  ok('a Kumquat deixou de ser "em breve"', !!ilha && !!ilha.jogo, ilha ? ilha.jogo : 'sem ilha');
  ok('  e ela leva ao `abrirSelecao`', ilha.abrir === S.abrirSelecao);
  contaAdmin(); g.screen = 'ilhas';
  S.entrarNaIlha(S.ILHAS_LARANJA.indexOf(ilha));
  ok('  e entrar nela abre o modo', g.screen === 'selecao', 'tela: ' + g.screen);
  /* ⚠️ E O `sairDaSelecao` VOLTA PRA AS ILHAS, como os outros três. */
  S.sairDaSelecao();
  ok('  e sair volta pra as ilhas', g.screen === 'ilhas', 'tela: ' + g.screen);
  ok('  e zera o draft', S.selecao.fase === 'setup' && S.selecao.pool.length === 0);
  /* ⚠️ ESTA TRAVA DIZIA "sobra UMA em branco" e caiu em 21/09/2026, quando a Queimada fechou o
     arquipélago -- **sem nada estar errado**. Ela fixava um NÚMERO (o de ilhas que faltavam), e
     esse número é justamente o que muda quando um jogo novo nasce: é a mesma família das cinco
     que caíram quando o trecho da Corrida virou 150 m.
     Hoje ela cobra o que ela sempre quis dizer -- que a Kumquat é uma ilha do mapa como as outras,
     e que o arquipélago não tem buraco. Quem cuida do caso da ilha SEM jogo é o `test-ilhas`, que
     é o dono do mapa. */
  ok('o arquipélago não tem buraco', S.ILHAS_LARANJA.every(i => typeof i.abrir === 'function'),
     S.ILHAS_LARANJA.filter(i => !i.abrir).map(i => i.nome).join(',') || '(nenhuma vazia)');
}


/* ============================================================================
   AS DUAS FILEIRAS DO DRAFT (21/09/2026)
   ============================================================================ */
console.log('=== O TIME SE MONTA NA FRENTE DO JOGADOR ===');
{
  contaAdmin();
  S.selecaoComecar();
  const html0 = S.renderSelecao();
  ok('a tela do draft traz as DUAS fileiras',
     (html0.match(/selecao-fileira /g) || []).length === 2,
     (html0.match(/selecao-fileira /g) || []).length + ' fileiras');
  /* as VAGAS vazias ficam desenhadas: sem elas, duas fileiras de tamanhos diferentes se leem como
     "ela tem mais", e nao como "faltam 4" */
  /* ⚠️ ELAS SAO O CARD DE TIME DA CASA (21/09/2026, a pedido) -- o mesmo da home e da tela de
     inscricao das ligas. A trava cobra as PECAS dele, e nao uma classe propria: se o card
     da casa mudar, as duas previas mudam junto, que e o ponto de reusar. */
  ok('  e elas sao o card de time da casa',
     (html0.match(/save-slot-card/g) || []).length >= 2
     && (html0.match(/team-avg-star/g) || []).length >= 2
     && (html0.match(/save-slot-team-row spread/g) || []).length === 2);
  /* ⚠️ SEM ACAO O CARD E UMA <div>, nunca um <button> apagado: aqui ele e uma PREVIA, e um botao
     que nao faz nada convida um toque que nao responde -- a mesma decisao da ilhota do setup do
     Resgate e da ilha sem jogo do mapa das Laranja. */
  ok('  e elas nao sao botoes',
     !/<button[^>]*selecao-fileira/.test(html0)
     && (html0.match(/<div class="save-slot-card[^"]*selecao-fileira/g) || []).length === 2);
  ok('  e as 6 vagas de cada um ja estao la',
     (html0.match(/save-slot-mon vazia/g) || []).length === S.SELECAO_TIME * 2,
     (html0.match(/save-slot-mon vazia/g) || []).length + ' vagas vazias');
  ok('  e nenhuma cheia antes da primeira escolha',
     (html0.match(/save-slot-mon-sprite/g) || []).length === 0);

  /* ⚠️ EM TEMPO REAL: a cada escolha uma vaga a mais fica cheia -- e ela sai do `pool`, que e a
     UNICA fonte durante o draft (o `selecao.meu` so e montado no fim). */
  const passos = [];
  let v = 0;
  while(S.selecao.fase === 'draft' && v++ < 60){
    if(S.selecaoVez() === 'npc') S.selecaoPicaNpc();
    else S.selecaoEscolher(S.selecao.pool.findIndex(p => !p.dono));
    if(S.selecao.fase !== 'draft') break;
    const h = S.renderSelecao();
    passos.push((h.match(/save-slot-mon-sprite/g) || []).length);
  }
  const sobe = passos.every((n, i) => i === 0 || n >= passos[i - 1]);
  ok('  e ela so cresce, escolha a escolha', sobe && passos.length > 3,
     passos.join(' '));

  /* e no FIM as duas fileiras estao cheias, e batem com os times de verdade */
  ok('  o draft fecha as duas fileiras',
     S.selecao.meu.length === S.SELECAO_TIME && S.selecao.dele.length === S.SELECAO_TIME);
}

console.log('=== E A LINHA DE TEXTO DO DRAFT SAIU ===');
{
  contaAdmin();
  S.selecaoComecar();
  const html = S.renderSelecao();
  /* ⚠️ A FRASE SAIU (a pedido) -- ela dizia quantos faltam, quantos cada um tem e a faixa de
     nivel. As duas fileiras contam as tres coisas melhor, e o nivel esta em cada sprite. */
  ok('a tela nao repete a contagem em texto',
     html.indexOf('Voce tem') < 0 && html.indexOf('ela tem') < 0
     && html.indexOf(String.fromCharCode(86,111,99,234) + ' tem') < 0);
  ok('  nem a faixa de nivel em texto', !/Faixa <strong>Lv\./.test(html));
  /* mas o NIVEL continua na tela, em cada vaga cheia -- e e ele que a frase dizia */
  S.selecaoPicaNpc();
  const h2 = S.renderSelecao();
  ok('  e o nivel continua, na etiqueta do card',
     /save-slot-mon-level">Lv\.\d+</.test(h2));
  /* e a VEZ continua sendo dita: e a unica coisa da frase que as fileiras nao contam */
  ok('  e de quem e a vez continua no titulo',
     /Sua vez|escolhendo/.test(h2));
}

/* ============================================================================
   O TITULO DA VEZ (21/09/2026, a pedido: "quando for a vez do usuario escolher os times,
   apareca assim: Sua vez: Escolha 2 pokemons")

   ⚠️ A TRAVA QUE IMPORTA NAO E A FRASE, E O NUMERO SER DERIVADO. Com o 2 escrito a mao o
   titulo passaria nos dois casos nomeados ("2" na entrada da vez) e mentiria na segunda
   metade de TODA vez do jogador -- e mentiria de novo no dia em que a SELECAO_ORDEM
   tivesse um passo de 1 ou de 3. E a mesma armadilha do "Golpe repete entre 2-5x" e do
   "Revezamento 900 m": texto fixo que descreve uma tabela envelhece com ela.
   ============================================================================ */
console.log('');
console.log('=== O TITULO DIZ QUANTOS FALTAM NESTA VEZ ===');
{
  contaAdmin();
  S.selecaoComecar();
  const tituloAgora = () => ((S.renderSelecao().match(/<h2>([\s\S]*?)<\/h2>/) || [])[1] || '').trim();

  /* o passo 0 da SELECAO_ORDEM e dela -- e ali o titulo continua sendo o nome dela */
  S.selecao.passo = 0; S.selecao.restam = S.SELECAO_ORDEM[0][1];
  ok('na vez dela o titulo e o nome dela', /escolhendo/.test(tituloAgora()), tituloAgora());
  ok('  e nao diz Sua vez', tituloAgora().indexOf('Sua vez') < 0, tituloAgora());

  /* a primeira vez do jogador: a SELECAO_ORDEM da 2, que e a frase do pedido */
  S.selecao.passo = 1; S.selecao.restam = 2;
  ok('na minha vez com 2 faltando, a frase do pedido',
     tituloAgora() === 'Sua vez: Escolha 2 pokémons', tituloAgora());

  /* ⚠️ ESCOLHIDO O PRIMEIRO DO PAR, O TITULO ANDA -- e o plural anda junto */
  S.selecao.restam = 1;
  ok('  e com 1 faltando ele ANDA, no singular',
     tituloAgora() === 'Sua vez: Escolha 1 pokémon', tituloAgora());

  /* ⚠️ E ELE SEGUE O ESTADO, nao o numero 2: um passo de 3 diria 3. E este caso que um texto
     fixo NAO passa -- os dois de cima ele passaria se a frase fosse escrita a mao com o 2. */
  S.selecao.restam = 3;
  ok('  e um passo de 3 diria 3 -- o numero sai do estado, nao do texto',
     tituloAgora() === 'Sua vez: Escolha 3 pokémons', tituloAgora());

  /* e pelo caminho de verdade: escolher UM no meio do par move o titulo sozinho */
  S.selecao.passo = 1; S.selecao.restam = 2;
  const antes = tituloAgora();
  S.selecaoEscolher(S.selecao.pool.findIndex(p => !p.dono));
  ok('  e escolher um DE VERDADE move o titulo',
     antes.indexOf(' 2 ') >= 0 && tituloAgora().indexOf(' 1 ') >= 0,
     antes + ' -> ' + tituloAgora());
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
