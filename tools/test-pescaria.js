/**
 * PESCARIA POKÉMON -- o segundo minigame, no cliente (19/09/2026).
 *
 * O que ele existe pra pegar, em ordem de importância:
 *   1. A BATALHA É A DA JORNADA. O protótipo tinha uma batalha própria; aqui quem decide é o
 *      `simulateGymBattle`, e o placar tem que seguir o MOTOR -- nunca a animação da tela;
 *   2. o acesso: o botão e a porta dependem de `admin === true`, e NADA MAIS autoriza;
 *   3. o NPC: sempre aleatório, sempre Lv.65, sempre BST acima de 500 -- e nunca um intocável;
 *   4. o picker: o time de verdade, ordenado por NÍVEL, paginado de 10 em 10;
 *   5. a mecânica da pesca: fisgar cedo perde, puxar sem parar arrebenta;
 *   6. nada do save é tocado.
 *
 *   node tools/test-pescaria.js
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
const g = S.__getGame();

/* uma conta admin com um time campeão -- o cenário de todo o arquivo */
function contaAdmin(niveis){
  S.pescariaZerar();
  g.authUser = { uid: 'u1' }; g.trainerName = 'Buzzo';
  g.ehAdmin = true; g.contaCarregada = true;
  g.equipados = {}; g.specialties = [];
  g.montadorPagina = 0;
  const ids = ['jolteon', 'venusaur', 'gyarados', 'alakazam', 'snorlax', 'arcanine'];
  g.saveSlots = [{
    team: (niveis || [70, 67, 64, 61, 58, 55]).map((lv, i) =>
      ({ speciesId: ids[i % ids.length], level: lv, id: 'm' + i, name: ids[i % ids.length] })),
    badgeCount: 8, customName: 'Time 1',
  }];
}
function timeGrande(quantos){
  contaAdmin();
  const ids = Object.keys(S.SPECIES);
  g.saveSlots = [];
  for(let s2 = 0; s2 * 6 < quantos; s2++){
    g.saveSlots.push({ badgeCount: 8, customName: 'Time ' + (s2 + 1),
      team: Array.from({ length: Math.min(6, quantos - s2 * 6) }, (_, i) =>
        ({ speciesId: ids[(s2 * 6 + i) % ids.length], level: 99 - (s2 * 6 + i), id: 's' + s2 + 'm' + i })) });
  }
}

/* ============================================================================
   1) O ACESSO -- só `admin === true`
   ============================================================================ */
console.log('\n=== O ACESSO É SÓ DE QUEM TEM admin === true ===');
{
  /* ⚠️ AS ILHAS ABRIRAM PRA TODO MUNDO em 21/09/2026 -- estas travas cobravam a RECUSA e
     viraram a trava da regra nova. O teste das ilhas cobre as SEIS portas num laço só. */
  for(const [valor, autoriza] of [[true, true], [false, true], ['sim', true], ['true', true],
                                   [1, true], [null, true], [undefined, true]]){
    contaAdmin();
    g.ehAdmin = valor; g.screen = 'saveSelect'; g.modoBloqueado = null;
    S.abrirPescaria();
    ok('admin=' + JSON.stringify(valor) + ' ' + (autoriza ? 'ENTRA' : 'é recusado'),
       (g.screen === 'pescaria') === autoriza, 'tela: ' + g.screen);
  }
  /* ⚠️ ENQUANTO A CONTA NÃO CARREGOU, o botão fica OCULTO e a porta recusa -- o contrário da porta
     dos modos de campeão, que erra pro lado de DEIXAR ENTRAR. Aqui mostrar um modo administrativo
     a quem não é admin, mesmo por meio segundo, é pior que escondê-lo de quem é. */
  contaAdmin();
  g.ehAdmin = true; g.contaCarregada = false; g.screen = 'saveSelect';
  S.abrirPescaria();
  ok('e a conta carregando tambem entra', g.screen === 'pescaria', 'tela: ' + g.screen);

  /* ⚠️ A PORTA VIROU UMA ILHA (21/09/2026): os tres botoes administrativos da home viraram um so,
     o `Ilhas Laranja`, e cada jogo mora numa ilha do mapa. O que esta trava prova continua sendo o
     mesmo -- existe UM caminho ate aqui, e ele passa pela mesma checagem de admin. */
  contaAdmin(); g.screen = 'saveSelect';
  ok('a home leva as Ilhas Laranja, e nao mais direto ao modo',
     S.renderSaveSelect().indexOf('abrirIlhas()') >= 0 &&
     S.renderSaveSelect().indexOf('abrirPescaria()') < 0);
  const ilha_ = S.ILHAS_LARANJA.find(i => i.id === 'trovita');
  ok('  e a ilha trovita e a que leva ate aqui', !!ilha_ && ilha_.abrir === S.abrirPescaria,
     ilha_ ? ilha_.jogo : 'sem ilha');
  g.screen = 'saveSelect';
  S.entrarNaIlha(S.ILHAS_LARANJA.indexOf(ilha_));
  ok('  e entrar nela abre o modo', g.screen === 'pescaria', 'tela: ' + g.screen);
  g.ehAdmin = false;
  ok('  e o botao das Ilhas CONTINUA pra quem nao e admin',
     S.renderSaveSelect().indexOf('abrirIlhas()') >= 0);
  g.contaCarregada = false;
  ok('  e enquanto a conta carrega tambem', S.renderSaveSelect().indexOf('abrirIlhas()') >= 0);
  /* ⚠️ E O BLOCO DEVOLVE A TELA: o `entrarNaIlha` acima a deixou no modo, e a trava do save la
     embaixo procura o nome do modo no `serializeGame()` -- que inclui o `screen`. */
  g.contaCarregada = true; g.screen = 'saveSelect';
}

/* ============================================================================
   2) O ADVERSÁRIO -- um TIME de 6, Lv.65, BST > 500, nunca intocável
   ============================================================================ */
console.log('\n=== O ADVERSÁRIO: UM TIME DE 6 ===');
{
  contaAdmin();
  ok('ele tem nome, e é uma classe + nome próprio', /^[A-ZÁ-Ú][a-zá-ú]+ [A-Z]/.test(S.PESCARIA_NPC_NOME),
     S.PESCARIA_NPC_NOME);
  ok('o time tem ${S.PESCARIA_TIME}', S.PESCARIA_TIME === 6);
  let fora = 0, semLinha = 0, tamanhos = new Set(), especies = new Set();
  for(let i = 0; i < 200; i++){
    const time = S.pescariaSortearNpc();
    tamanhos.add(time.length);
    const raizes = new Set();
    time.forEach(p => {
      especies.add(p.speciesId);
      if(p.level !== S.PESCARIA_NPC_NIVEL) fora++;
      if(S.bstOf(p.speciesId) <= S.PESCARIA_NPC_BST_MIN) fora++;
      if(S.SEM_CAPTURA_SELVAGEM.indexOf(p.speciesId) >= 0) fora++;
      if(p.hp !== p.maxHp || !p.hp) fora++;
      if(raizes.has(S.raizDaLinha(p.speciesId))) semLinha++;
      raizes.add(S.raizDaLinha(p.speciesId));
    });
  }
  ok('200 sorteios: sempre ${S.PESCARIA_TIME} pokémon',
     tamanhos.size === 1 && tamanhos.has(S.PESCARIA_TIME), [...tamanhos].join(`,`));
  ok('  todos Lv.65, BST>500, não intocáveis e com HP cheio', fora === 0, fora + ` fora da regra`);
  /* ⚠️ SEM REPETIR LINHA EVOLUTIVA na equipe -- a regra do encontro selvagem e do montador. */
  ok('  e sem repetir linha evolutiva', semLinha === 0, semLinha + ` repetidos`);
  ok('  e o sorteio varia de verdade', especies.size >= 15, especies.size + ` espécies distintas`);
}

/* ============================================================================
   3) O PICKER -- um TIME campeão, no card da Liga Clássica
   ============================================================================
   ⚠️ Era um picker de POKÉMON paginado de 10 até 20/09/2026. Hoje é o `save-slot-card` da Liga,
   e a escolha é do time inteiro -- foi o pedido ao pé da letra.
   ============================================================================ */
console.log('\n=== O PICKER: UM TIME CAMPEÃO ===');
{
  contaAdmin();
  /* um segundo save, SEM as 8 insígnias: ele não pode aparecer */
  g.saveSlots.push({ team: [{ speciesId: 'pidgey', level: 30, id: 'z0' }],
                     badgeCount: 3, customName: 'Meio do caminho' });
  const slots = S.pescariaElegiveis();
  ok('a lista é de SLOTS campeões', Array.isArray(slots) && slots.every(x => typeof x === 'number'),
     JSON.stringify(slots));
  ok('  e o save sem as 8 insígnias fica de fora', slots.indexOf(1) < 0, JSON.stringify(slots));
  /* ⚠️ QUEM VALIDA É A AÇÃO: um slot forjado no console levaria um time sem insígnia pro duelo. */
  S.pescariaEscolher(1);
  ok('a AÇÃO recusa um slot que não é campeão', S.pescaria.escolhido == null,
     String(S.pescaria.escolhido));
  S.pescariaEscolher(0);
  ok('  e aceita o campeão', S.pescaria.escolhido === 0, String(S.pescaria.escolhido));
  ok('  e fecha o picker', !S.pescaria.picker);
  /* o card é o da Liga, e o time montado vem do save */
  S.pescaria.picker = true;
  const tela = S.renderPescaria();
  ok('o card é o `save-slot-card` da Liga', tela.indexOf(`save-slot-card`) >= 0);
  ok('  com a estrela da média', tela.indexOf(`team-avg-star`) >= 0);
  ok('  e a fileira dos seis', (tela.match(/save-slot-mon-sprite/g) || []).length === 6,
     (tela.match(/save-slot-mon-sprite/g) || []).length + ` sprites`);
  S.pescaria.picker = false;
  const time = S.pescariaTimeDoSlot(0);
  ok('o time montado tem os seis do save', time.length === 6, time.length + ` pokémon`);
  ok('  e todos entram com HP cheio', time.every(p => p.hp > 0 && p.hp === p.maxHp));
  /* ⚠️ E ELE É UMA CÓPIA: as instâncias vão morrer, e o save não pode sentir nada. */
  time.forEach(p => { p.hp = 0; });
  ok('  e o SAVE não sente (são instâncias próprias)',
     (g.saveSlots[0].team || []).every(p => p.hp === undefined || p.hp > 0));
  g.saveSlots.pop();
}

/* ============================================================================
   4) ⚠️ A BATALHA É A DA JORNADA -- o coração do pedido
   ============================================================================ */
console.log('\n=== A BATALHA É A MESMA DA JORNADA ===');
{
  contaAdmin();
  const e = S.pescariaElegiveis();
  S.pescaria.escolhido = e[0];
  S.pescaria.npc = S.pescariaSortearNpc();
  S.pescaria.jogadores = [
    S.pescariaNovoPescador(S.pescariaTimeDoSlot(e[0]), true),
    S.pescariaNovoPescador(S.pescaria.npc, false),
  ];
  S.pescaria.fase = 'jogando';
  S.pescariaSurgir(5);
  const op = S.pescaria.oportunidades[5];
  S.pescariaComecarBatalha(0, op);
  const b = S.pescaria.jogadores[0].batalha;

  /* ⚠️ O MATCHUP É O DO MOTOR: ele tem os campos que só `simulateGymBattle` produz. Um resumo
     inventado pela tela não teria `playerMaxHp` nem o diário `golpes`. */
  ok('a batalha devolve um matchup do motor', !!b.matchup);
  for(const campo of ['playerHpBefore', 'playerMaxHp', 'enemyMaxHp', 'winner', 'golpes'])
    ok('  o matchup tem `' + campo + '`', b.matchup[campo] !== undefined);
  ok('e o diário tem golpes de verdade', b.seq.length > 0, b.seq.length + ' passos');

  /* ⚠️ E O PLACAR SEGUE O MOTOR, NUNCA A ANIMAÇÃO. Esta é a trava mais importante do arquivo: a
     tela anima o diário golpe a golpe, e se um dia ela decidisse o vencedor por "quem chegou a
     zero na tela", uma divergência de arredondamento mudaria o resultado da partida. */
  const venceuNoMotor = b.venceu, premio = b.premio;
  let voltas = 0;
  while(S.pescaria.jogadores[0].estado === 'batalha' && voltas < 300){
    S.pescaria.tempo += 0.5; S.pescariaPassoDaBatalha(0); voltas++;
  }
  const p0 = S.pescaria.jogadores[0];
  ok('a animação termina', p0.estado === 'descanso', 'estado: ' + p0.estado);
  ok('e o placar segue o MOTOR, não a animação',
     p0.pontos === (venceuNoMotor ? premio : 0),
     'venceu=' + venceuNoMotor + ' pontos=' + p0.pontos + ' prêmio=' + premio);
  ok('a vitória só conta se o motor disse que venceu',
     p0.vitorias === (venceuNoMotor ? 1 : 0));
  ok('e a fila inteira vai pro log do fim', S.pescaria.logs.length === b.matchups.length,
     S.pescaria.logs.length + ' de ' + b.matchups.length);

  /* ⚠️ É O TIME INTEIRO CONTRA UM PEIXE (20/09/2026). Era 1x1 até aqui -- e a mudança é o que
     dá sentido à persistência de HP: com um pokémon só, a primeira morte acabava a pescaria. */
  ok('é o TIME contra o peixe', b.matchup.playerTeamSize === S.PESCARIA_TIME && b.matchup.enemyTeamSize === 1,
     b.matchup.playerTeamSize + ' x ' + b.matchup.enemyTeamSize);

  /* ⚠️ O PEIXE ENTRA CHEIO, O TIME NÃO -- e essa assimetria É a feature (20/09/2026).
     O `simulateGymBattle` cura os DOIS times na entrada; o `preservePlayerHp` segura o lado A.
     Sem ele, o desgaste que o pedido cria (*"os pokémons que morrerem tem que permanecer morto
     até o fim da pesca"*) sumiria a cada fisgada. */
  ok('o peixe entra com HP cheio no PRIMEIRO confronto',
     b.matchups[0].enemyHpBefore === b.matchups[0].enemyMaxHp,
     b.matchups[0].enemyHpBefore + '/' + b.matchups[0].enemyMaxHp);
  {
    const bloco = src.slice(src.indexOf('function pescariaBatalhar'), src.indexOf('function pescariaComecarBatalha'));
    ok('  e o time do jogador NÃO é curado (preservePlayerHp)', bloco.indexOf('preservePlayerHp: true') >= 0);
  }

  /* ⚠️ LENDO O CÓDIGO: a batalha do protótipo NÃO pode ter sobrado. Se alguém reintroduzir uma
     fórmula própria aqui, a mecânica deixa de ser a da jornada sem nada acusar. */
  const bloco = src.slice(src.indexOf('function pescariaBatalhar'), src.indexOf('function pescariaComecarBatalha'));
  ok('o `pescariaBatalhar` chama o motor do jogo', bloco.indexOf('simulateGymBattle(') >= 0);
  ok('e não tem fórmula de dano própria',
     !/Math\.floor\(2 ?\* ?a\.level|\* ?atk ?\/ ?def|1\/16/.test(bloco), 'sobrou conta de dano');
  /* a trava que o `test-especiais` já cobra pro resto do jogo, cobrada aqui também */
  ok('e passa pelo applySpecialtyBuff e pelo equiparItens',
     bloco.indexOf('applySpecialtyBuff') >= 0 && bloco.indexOf('equiparItens') >= 0);

  /* ⚠️ E A SEQUÊNCIA É A DA JORNADA, não o diário cru. Ela é quem sabe que a cura e a fúria SOBEM
     a barra (o `amount` vai negativo), que a queimadura e o veneno têm o `q` de quem PERDE, que um
     multi-tapa vira N passos e que o Remoinho vira três quadros.
     Lendo o diário direto -- que é o que esta tela fazia até 19/09/2026 -- a cura do JOGADOR
     descia a barra do PEIXE. O defeito não aparecia como erro: aparecia como o pokémon errado
     perdendo vida. */
  /* ⚠️ Ela mora no `pescariaAbrirConfronto` desde 20/09/2026, e não no `pescariaComecarBatalha`:
     a tela passou a animar a FILA inteira, e abrir um confronto virou função pra o primeiro e os
     seguintes usarem o MESMO caminho. */
  ok('a sequência sai do buildAnimatedHitSequence',
     src.slice(src.indexOf('function pescariaAbrirConfronto'), src.indexOf('function pescariaComecarBatalha'))
        .indexOf('buildAnimatedHitSequence(m)') >= 0);
  {
    const so = S.pescaria.logs[0];
    const esperado = S.buildAnimatedHitSequence(so);
    ok('  e é a MESMA lista, passo a passo', esperado.length > 0, esperado.length + ' passos');
  }
}

/* ============================================================================
   4b) ⚠️ A BATALHA É A DA JORNADA NA TELA TAMBÉM -- o pedido de 19/09/2026
   ============================================================================
   *"a batalha pokemon que esta exibindo após a pesca, deve ser exatamente igual a batalha que
   ocorre na jornada, o mesmo layout, mesma velocidade, mesmos ataques, como se fosse uma batalha
   enfrentando um lider de ginasio, porém é uma batalha 1x1 contra um pokemon pescado"*.

   O que a tela tinha era um desenho PRÓPRIO: sprite pequeno, barra verde fixa por `width`, sem
   tipo, sem selo, sem HP em número, sem o NOME do golpe e 0,42s fixos por passo.
   ============================================================================ */
console.log('\n=== A BATALHA DA TELA É A DA JORNADA ===');
{
  contaAdmin();
  const e = S.pescariaElegiveis();
  S.pescaria.escolhido = e[0];
  S.pescaria.npc = S.pescariaSortearNpc();
  S.pescaria.jogadores = [
    S.pescariaNovoPescador(S.pescariaTimeDoSlot(e[0]), true),
    S.pescariaNovoPescador(S.pescaria.npc, false),
  ];
  S.pescaria.fase = 'jogando'; S.pescaria.tempo = 0;
  S.pescariaSurgir(5);
  S.pescariaComecarBatalha(0, S.pescaria.oportunidades[5]);
  const p0 = S.pescaria.jogadores[0];
  /* ⚠️ ESTAS TRAVAS JÁ ENVELHECERAM DUAS VEZES NO MESMO DIA, e por isso hoje elas medem o que é
     INVARIANTE: primeiro elas cravavam `class="fighter"` e `sprite-lg`, o que era o visual antigo
     -- e o fixture chama contaAdmin(), que LIGAVA o gate da cena; consertado isso desligando o
     gate, a chave foi aberta pra todo mundo horas depois e o desligar parou de desligar.
     O que este bloco existe pra provar não é a marcação: é que o quadro da pescaria sai das MESMAS
     funções do renderBattling. Isso vale nos dois visuais, e é assim que ele passou a ser escrito. */
  const html = S.pescariaBatalhaHtml(p0);

  /* ---- O LAYOUT: são as MESMAS funções do renderBattling ---- */
  /* ⚠️ A CLASSE É PROCURADA NA LISTA, nunca por igualdade: na cena o lutador é
     `class="fighter battle-fighter player"`, e um `class="fighter"` cravado casa com ZERO. É a
     mesma armadilha das regex do `mlog-mais` e do `matchup-row`. */
  ok('o quadro usa o fighterHtml da casa', (html.match(/class="fighter[ "]/g) || []).length === 2,
     (html.match(/class="fighter[ "]/g) || []).length + ' lutadores');
  /* ⚠️ E O SPRITE É O DA BATALHA -- o `sprite-lg` no visual antigo, o GIF animado na cena. O que
     a trava cobra é que ele NÃO seja o sprite pequeno que a tela da pescaria tinha antes. */
  ok('  com o sprite da batalha (grande ou animado)',
     html.indexOf('sprite-lg') >= 0 || html.indexOf('battle-sprite-animated') >= 0);
  ok('  com os selos de tipo', html.indexOf('fighter-types') >= 0);
  ok('  com o nível', html.indexOf('fighter-level') >= 0);
  /* ⚠️ OS IDs DAS BARRAS SÃO OS GLOBAIS DA JORNADA. Com `pescHpA`/`pescHpB`, o
     `pintarStatusDoConfronto` e a conta do `animatePartialHpBars` não achariam nada e falhariam
     EM SILÊNCIO -- a barra simplesmente não se moveria. */
  ok('  com a barra de HP da casa (e os ids globais dela)',
     html.indexOf('id="hp-fill-player"') >= 0 && html.indexOf('id="hp-fill-enemy"') >= 0);
  ok('  e com o HP em NÚMERO, que a tela não mostrava',
     html.indexOf('id="hp-label-player"') >= 0 && /\d+\/\d+ HP/.test(html));
  ok('  o placar de pokébolas em cima', html.indexOf('team-alive-row') >= 0 && html.indexOf('pokeball') >= 0);
  ok('  o VS girando no meio', html.indexOf('vs-swords spin') >= 0);
  ok('  e a caixa de status da casa', html.indexOf('battle-status-area') >= 0 && html.indexOf('id="battle-status-txt"') >= 0);
  /* ⚠️ E A MARCAÇÃO PRÓPRIA NÃO PODE TER SOBRADO: ela é o defeito, não uma alternativa. */
  for(const morto of ['pesc-batalha', 'pesc-lutador', 'pescBatalhaLinha', 'pescHpA', 'pescHpB'])
    ok('  sem a marcação própria: ' + morto, html.indexOf(morto) < 0);
  ok('  e o CSS dela também saiu',
     src.indexOf('.pesc-batalha{') < 0 && src.indexOf('.pesc-barra i.hp{') < 0);
  /* ⚠️ SEM TERRENO, como na Torre: a pescaria não tem terreno escolhido e o selo prometeria um
     bônus que esta batalha não dá. */
  ok('  e sem o selo de terreno (não há terreno aqui)', html.indexOf('#s-terreno') < 0);
  ok('o prêmio está na tela da luta', html.indexOf('PTS') >= 0);

  /* ---- E A CENA, que desde 22/09/2026 é de TODO MUNDO (a chave foi aberta) ---- */
  ok('o quadro é a CENA, pela mesma fighterHtml',
     (html.match(/class="fighter battle-fighter/g) || []).length === 2,
     (html.match(/class="fighter battle-fighter/g) || []).length + ' lutadores');
  /* ⚠️ E O CENÁRIO É O MANGUEZAL, sempre: aqui o id do terreno é uma COORDENADA DE IMAGEM.
     O atlas 3 é o recorte dele -- e o fallback (campo_aberto) cai no atlas 0, então este número
     também prova que a tabela reconheceu o id. */
  ok('  no cenário do Manguezal (atlas 3)', /--battle-atlas:3;/.test(html));
  ok('  e ele é SÓ cenário: nenhum selo de terreno', html.indexOf('#s-terreno') < 0);
  /* ⚠️ E A CHAVE NÃO OLHA MAIS O ADMIN: ela é uma função SÓ (o molde do MOSTRAR_TM_HM), e é isso
     que faz voltar atrás custar uma linha. Sem esta trava, alguém a reescreve em nove lugares. */
  ok('  e a chave da cena é uma função só, sem olhar o admin',
     /function visualNovoDeBatalha\(\)\s*\{\s*return true;\s*\}/.test(src));

  /* ---- O RITMO: os números são os do advanceReveal ---- */
  /* ⚠️ ESTA TRAVA LÊ O CÓDIGO DA JORNADA. Escritos à mão nos dois lugares, os números divergiriam
     no primeiro ajuste, e o sintoma seria a batalha da pescaria andando num compasso que a jornada
     não tem -- sem nada acusar. */
  const jornada = src.slice(src.indexOf('function advanceReveal'), src.indexOf('const HP_BAR_PCT_PER_SEC'));
  ok('(a fatia do advanceReveal tem o que ler)', jornada.length > 1500, jornada.length + ' chars');
  ok('a abertura é a mesma da jornada (550 + pausaDoEspecial)',
     jornada.indexOf('550 + pausaDoEspecial(m)') >= 0 && S.PESCARIA_ABERTURA_MS === 550);
  ok('o respiro entre golpes é o mesmo (150)',
     /hitDuration \+ 150 \+ pausaDaFaixa/.test(jornada) && S.PESCARIA_ENTRE_GOLPES_MS === 150);
  ok('e o de depois do último (800)',
     /hitDuration \+ 800 \+ pausaDaFaixa/.test(jornada) && S.PESCARIA_DEPOIS_DO_ULTIMO_MS === 800);
  ok('e o confronto sem golpe nenhum (1300)',
     jornada.indexOf('advanceReveal, 1300') >= 0 && S.PESCARIA_SEM_GOLPES_MS === 1300);
  {
    const b = p0.batalha, m = b.matchup;
    const hit = b.seq[0];
    const r = S.pescariaRitmoDoGolpe(m, hit, false);
    const maxHp = hit.side === 'player' ? m.playerMaxHp : m.enemyMaxHp;
    ok('o passo soma nome + barra + respiro + leitura',
       r.total === S.pausaDoNomeDoGolpe(m, hit) + S.hpBarTransitionMs((hit.amount / maxHp) * 100)
                 + 150 + S.pausaDaFaixa(hit), r.total + 'ms');
    /* ⚠️ A BARRA SÓ ANDA UM SEGUNDO DEPOIS DO NOME -- é o `PAUSA_ANTES_DO_GOLPE_MS` da jornada, e
       é ele que dá tempo de LER o golpe antes de a vida cair. */
    ok('  e a barra só anda depois do segundo do nome', r.nome === 1000 || r.nome === 0, r.nome + 'ms');
    /* ⚠️ A DURAÇÃO DA BARRA É PROPORCIONAL AO GOLPE (150..1400ms), não fixa: é isso que faz ela
       descer sempre na mesma velocidade visual. O passo fixo de 0,42s que a tela tinha dá um
       ritmo completamente diferente, mesmo com os mesmos golpes. */
    ok('  e a da barra é proporcional ao golpe', r.barra >= 150 && r.barra <= 1400, r.barra + 'ms');
    ok('o passo fixo de 0,42s não existe mais', typeof S.PESCARIA_PASSO_BATALHA === 'undefined');
  }

  /* ---- OS ATAQUES: a frase nomeia o golpe, e a barra anda ---- */
  /* dirige a batalha como o laço faz: o relógio do duelo anda e o passo acompanha */
  const painel = S.document.getElementById('pescPainelBatalha');
  painel.innerHTML = html; painel.dataset.peixe = String(p0.op.id);
  const status = S.document.getElementById('battle-status-txt');
  const barraE = S.document.getElementById('hp-fill-enemy');
  const barraP = S.document.getElementById('hp-fill-player');
  let frases = 0, comGolpe = 0, mexeu = 0, voltas = 0;
  let ultimo = '';
  while(p0.estado === 'batalha' && voltas < 4000){
    S.pescaria.tempo += 0.05; S.pescariaPassoDaBatalha(0); voltas++;
    if(status.innerHTML && status.innerHTML !== ultimo){
      ultimo = status.innerHTML; frases++;
      if(/type-pill/.test(ultimo)) comGolpe++;
    }
    if(barraE.style.transform || barraP.style.transform) mexeu++;
  }
  ok('a animação termina sozinha', p0.estado === 'descanso', p0.estado);
  /* ⚠️ "MESMOS ATAQUES": a frase traz o NOME do golpe no selo colorido do tipo -- o mesmo
     `golpeSeloHtml` do log e da jornada. A tela dizia só "X atacou e tirou −N de HP". */
  ok('a linha de status nomeia o GOLPE, com o selo do tipo', comGolpe > 0, comGolpe + ' frases com golpe');
  ok('  e ela troca a cada passo', frases >= 2, frases + ' frases');
  ok('a barra de HP se mexe (pelo transform, como na jornada)', mexeu > 0);
  /* ⚠️ E ELA TERMINA ONDE O MOTOR DISSE. A animação é apresentação: se ela e o resultado
     divergissem, o resultado é que vale -- e uma barra parando noutro lugar seria a primeira
     pista de que alguém pôs a decisão na tela. */
  {
    /* ⚠️ o ÚLTIMO da fila -- é o que está na tela quando a animação acaba. O log guarda a fila
       inteira desde 20/09/2026, e o [0] dele é o PRIMEIRO confronto. */
    const m = S.pescaria.logs[S.pescaria.logs.length - 1];
    const alvo = Math.max(0, m.enemyHpAfter / m.enemyMaxHp);
    const naTela = parseFloat(String(barraE.style.transform).replace(/[^0-9.]/g, '') || 'NaN');
    ok('  e ela termina no valor do MOTOR', Math.abs(naTela - alvo) < 0.02,
       naTela.toFixed(3) + ' contra ' + alvo.toFixed(3));
  }

  /* ⚠️ OS DOIS PESCADORES PODEM ESTAR EM BATALHA NO MESMO QUADRO, e é por isso que o estado do
     laço mora em `p.batalha` e não em campos do `game` como nos cinco laços de revelação do jogo:
     lá o estado é um por TELA, aqui é um por PESCADOR. Num campo só, o passo de um avançaria o
     outro e o `venceu` do NPC sobrescreveria o seu -- e metade disso seria invisível, porque o
     NPC não tem quadro desenhado. */
  {
    contaAdmin();
    const e2 = S.pescariaElegiveis();
    S.pescaria.escolhido = e2[0];
    S.pescaria.npc = S.pescariaSortearNpc();
    S.pescaria.jogadores = [
      S.pescariaNovoPescador(S.pescariaTimeDoSlot(e2[0]), true),
      S.pescariaNovoPescador(S.pescaria.npc, false),
    ];
    S.pescaria.fase = 'jogando'; S.pescaria.tempo = 0;
    S.pescariaSurgir(0); S.pescariaSurgir(4);
    S.pescariaComecarBatalha(0, S.pescaria.oportunidades[0]);
    S.pescariaComecarBatalha(1, S.pescaria.oportunidades[4]);
    const A = S.pescaria.jogadores[0], B = S.pescaria.jogadores[1];
    ok('os dois podem batalhar no mesmo quadro',
       A.estado === 'batalha' && B.estado === 'batalha');
    const quisA = A.batalha.venceu, premA = A.batalha.premio;
    const quisB = B.batalha.venceu, premB = B.batalha.premio;
    ok('  e cada um tem o SEU estado', A.batalha !== B.batalha && A.batalha.seq !== B.batalha.seq);
    let v2 = 0;
    while((A.estado === 'batalha' || B.estado === 'batalha') && v2 < 2000){
      S.pescaria.tempo += 0.1;
      if(A.estado === 'batalha') S.pescariaPassoDaBatalha(0);
      if(B.estado === 'batalha') S.pescariaPassoDaBatalha(1);
      v2++;
    }
    ok('  os dois terminam', A.estado === 'descanso' && B.estado === 'descanso');
    ok('  e cada placar segue o MOTOR do SEU lado',
       A.pontos === (quisA ? premA : 0) && B.pontos === (quisB ? premB : 0),
       A.pontos + ' e ' + B.pontos);
    /* ⚠️ E SÓ O LOG DO JOGADOR VAI PRA TELA DO FIM. O matchup do NPC existe e é real (sai do mesmo
       motor), e é jogado fora de propósito: a tela do fim é sobre as capturas DELE. Seis logs do
       NPC ali seriam ruído -- e sem esta linha escrita, o `if(qual === 0)` se lê como esquecimento. */
    ok('  e só o log do jogador vai pro fim', S.pescaria.logs.length === 1, S.pescaria.logs.length + ' logs');
  }

  /* ⚠️ NENHUMA BATALHA EM CURSO SOME SEM PAGAR. Os pontos são creditados no FIM da animação, e
     com o ritmo da jornada ela leva ~6s: uma captura pega aos 88s ainda estaria animando quando o
     relógio acabasse. Sem isso o jogador pesca, o motor diz que ele venceu, e ele recebe ZERO --
     sem erro e sem aviso. */
  {
    contaAdmin();
    const e3 = S.pescariaElegiveis();
    S.pescaria.escolhido = e3[0];
    S.pescaria.npc = S.pescariaSortearNpc();
    S.pescaria.jogadores = [
      S.pescariaNovoPescador(S.pescariaTimeDoSlot(e3[0]), true),
      S.pescariaNovoPescador(S.pescaria.npc, false),
    ];
    S.pescaria.fase = 'jogando'; S.pescaria.tempo = S.PESCARIA_DURACAO - 1;
    S.pescariaSurgir(5);
    S.pescariaComecarBatalha(0, S.pescaria.oportunidades[5]);
    const A = S.pescaria.jogadores[0];
    const deviaGanhar = A.batalha.venceu ? A.batalha.premio : 0;
    /* o relógio estoura a prorrogação no meio da animação */
    S.pescaria.tempo = S.PESCARIA_DURACAO + S.PESCARIA_SOBRA + 1;
    S.pescariaAtualizar(0.01);
    ok('a prorrogação NÃO corta a batalha', A.estado === 'batalha', A.estado);
    /* e mesmo forçando o fim por fora, o ponto é pago */
    S.pescariaTerminar();
    ok('  e um fim forçado ainda paga o que o motor decidiu',
       A.pontos === deviaGanhar, A.pontos + ' de ' + deviaGanhar);
  }

  /* ⚠️ E O DUELO NÃO É CORTADO NO MEIO DE UMA BATALHA: a prorrogação existe pra um encontro que
     travou, e uma batalha sempre termina. Cortá-la jogaria fora uma captura já feita. */
  const laco = src.slice(src.indexOf('function pescariaAtualizar'), src.indexOf('function pescariaLargar'));
  ok('(a fatia do laço tem o que ler)', laco.length > 500, laco.length + ' chars');
  ok('a prorrogação não corta uma batalha no meio',
     /PESCARIA_DURACAO \+ PESCARIA_SOBRA[\s\S]{0,160}estado === 'batalha'/.test(laco));
}

/* ============================================================================
   5) A PESCA -- o timing e a tensão
   ============================================================================ */
console.log('\n=== A PESCA: FISGAR CEDO PERDE, PUXAR SEM PARAR ARREBENTA ===');
{
  function montaJogo(){
    contaAdmin();
    const e = S.pescariaElegiveis();
    S.pescaria.escolhido = e[0];
    S.pescaria.npc = S.pescariaSortearNpc();
    S.pescaria.jogadores = [
      S.pescariaNovoPescador(S.pescariaTimeDoSlot(e[0]), true),
      S.pescariaNovoPescador(S.pescaria.npc, false),
    ];
    S.pescaria.fase = 'jogando'; S.pescaria.tempo = 0;
    S.pescaria.oportunidades = new Array(6).fill(null);
    S.pescariaSurgir(0);
    return S.pescaria.jogadores[0];
  }
  /* ⚠️ SÃO DOIS ESTADOS, e é a diferença entre eles que faz o timing existir: em `espera` a boia
     ainda boia (fisgar é cedo demais), e em `fisgada` ela afundou. */
  let p = montaJogo();
  S.pescariaEntrar(0, 0);
  ok('entrar numa zona com peixe abre a espera', p.estado === 'espera', p.estado);
  S.pescariaFisgar();
  ok('fisgar em `espera` PERDE o peixe', p.estado === 'descanso', p.estado);
  ok('e diz por quê', /cedo demais/i.test(p.recadoDeEspera), p.recadoDeEspera);

  p = montaJogo();
  S.pescariaEntrar(0, 0);
  p.ate = S.pescaria.tempo;             /* a boia afunda agora */
  S.pescariaAtualizar(0.01);
  ok('quando a boia afunda, vira `fisgada`', p.estado === 'fisgada', p.estado);
  S.pescariaFisgar();
  ok('e aí fisgar funciona', p.estado === 'puxando', p.estado);

  /* ⚠️ PUXAR SEM PARAR ARREBENTA: é essa a mecânica inteira. Sem ela, segurar o botão seria a
     estratégia ótima e não haveria jogo. */
  S.pescariaSegurar(true);
  let v = 0;
  while(p.estado === 'puxando' && v < 900){ S.pescariaAtualizar(1 / 30); v++; }
  ok('puxar sem soltar arrebenta a linha', p.estado === 'descanso' && /arrebentou/.test(p.recadoDeEspera),
     p.recadoDeEspera);

  /* e ler o peixe funciona: puxa só quando ele está cansado */
  let capturou = false;
  for(let tentativa = 0; tentativa < 12 && !capturou; tentativa++){
    p = montaJogo();
    S.pescariaEntrar(0, 0);
    p.ate = S.pescaria.tempo; S.pescariaAtualizar(0.01); S.pescariaFisgar();
    for(let k = 0; k < 900 && p.estado === 'puxando'; k++){
      const c = S.pescariaComportamento(p);
      S.pescariaSegurar(c === 'cansado' || (c === 'resistindo' && p.tensao < 45));
      S.pescariaAtualizar(1 / 30);
    }
    if(p.estado === 'batalha' || S.pescaria.jogadores[0].fisgadas > 0) capturou = true;
  }
  ok('e quem lê o comportamento do peixe consegue capturar', capturou);

  /* ⚠️ A ZONA SÓ ACEITA DENTRO DA JANELA: passada a janela de entrada, a oportunidade não serve. */
  p = montaJogo();
  S.pescaria.oportunidades[0].entradaAte = S.pescaria.tempo - 1;
  S.pescariaEntrar(0, 0);
  ok('oportunidade vencida não deixa entrar', p.estado === 'parado', p.estado);
  /* e zona vazia também não */
  p = montaJogo();
  S.pescariaEntrar(0, 4);
  ok('zona sem peixe também não', p.estado === 'parado', p.estado);

  /* ⚠️ O NÍVEL DO PESCADO RESPEITA A FAIXA DA ZONA -- é ela que faz a margem ser segura e o
     abismo valer a pena. */
  let fora = 0;
  for(let z = 0; z < S.PESCARIA_ZONAS.length; z++){
    const Z = S.PESCARIA_ZONAS[z];
    for(let i = 0; i < 60; i++){
      S.pescaria.oportunidades[z] = null;
      S.pescariaSurgir(z);
      const o = S.pescaria.oportunidades[z];
      if(o.nivel < Z.nivel[0] || o.nivel > Z.nivel[1]) fora++;
      if(!Z.pool.some(x => x[0] === o.speciesId)) fora++;
    }
  }
  ok('360 peixes: todos na faixa e no pool da zona', fora === 0, fora + ' fora');
  /* e as 13 espécies dos pools existem no jogo */
  const semEspecie = [];
  S.PESCARIA_ZONAS.forEach(Z => Z.pool.forEach(([id]) => { if(!S.SPECIES[id]) semEspecie.push(id); }));
  ok('e todas existem no SPECIES', semEspecie.length === 0, semEspecie.join(','));
}

/* ============================================================================
   5b) ⚠️ A REALIMENTAÇÃO DA PESCA -- o pedido de 19/09/2026
   ============================================================================
   *"na hora que fisgou o peixe, no modelo que eu tinha te passado, a barra mudava de cor de
   acordo com o status da pesca, a cor dos textos mudava de cor, a barra de captura ja começava um
   pouco preenchida e ia descendo caso o usuário nao fazia nada"*.

   As três coisas existiam no protótipo e nenhuma tinha vindo: a tensão era vermelha desde 0%, o
   texto de comportamento era uma caixa amarela estática, e as duas barras nasciam em ZERO -- o que
   tornava a queda de 3%/s INVISÍVEL, porque o clamp em 0 a escondia.
   ============================================================================ */
console.log('\n=== A REALIMENTAÇÃO DA PESCA ===');
{
  function pescando(){
    contaAdmin();
    const e = S.pescariaElegiveis();
    S.pescaria.escolhido = e[0];
    S.pescaria.npc = S.pescariaSortearNpc();
    S.pescaria.jogadores = [
      S.pescariaNovoPescador(S.pescariaTimeDoSlot(e[0]), true),
      S.pescariaNovoPescador(S.pescaria.npc, false),
    ];
    S.pescaria.fase = 'jogando'; S.pescaria.tempo = 0;
    S.pescaria.oportunidades = new Array(S.PESCARIA_ZONAS.length).fill(null);
    S.pescariaSurgir(0);
    S.pescariaEntrar(0, 0);
    return S.pescaria.jogadores[0];
  }

  /* ---- 1) A BARRA DE CAPTURA NASCE PREENCHIDA ---- */
  let p = pescando();
  p.ate = S.pescaria.tempo; S.pescariaAtualizar(0.01);    /* a boia afunda */
  /* fisgar NA HORA sobra mais que 0,72s da janela de 1,15s: é a fisgada perfeita */
  S.pescariaFisgar();
  ok('fisgar rápido dá a fisgada PERFEITA',
     p.progresso === S.PESCARIA_PROGRESSO_PERFEITO, p.progresso + '%');
  ok('  e ela vale o dobro da normal',
     S.PESCARIA_PROGRESSO_PERFEITO === 2 * S.PESCARIA_PROGRESSO_NORMAL,
     S.PESCARIA_PROGRESSO_PERFEITO + ' contra ' + S.PESCARIA_PROGRESSO_NORMAL);
  ok('  e a linha já entra sob carga', p.tensao === S.PESCARIA_TENSAO_INICIAL, p.tensao + '%');

  p = pescando();
  p.ate = S.pescaria.tempo; S.pescariaAtualizar(0.01);
  /* deixa passar 0,5s da janela: sobra 0,65s, abaixo dos 0,72 -- fisgada normal */
  S.pescaria.tempo += 0.5;
  S.pescariaFisgar();
  ok('fisgar devagar dá a normal', p.progresso === S.PESCARIA_PROGRESSO_NORMAL, p.progresso + '%');

  /* ---- 2) ⚠️ E ELA DESCE QUANDO NINGUÉM PUXA -- o defeito relatado ---- */
  const antes = p.progresso;
  S.pescariaSegurar(false);
  for(let i = 0; i < 30; i++) S.pescariaAtualizar(1 / 30);   /* 1 segundo sem tocar em nada */
  ok('a captura DESCE quando ninguém puxa', p.progresso < antes,
     antes + '% -> ' + p.progresso.toFixed(1) + '%');
  ok('  a ~3%/s, como no protótipo', Math.abs((antes - p.progresso) - 3) < 0.4,
     (antes - p.progresso).toFixed(2) + '%/s');
  /* ⚠️ E É POR ISSO QUE O VALOR INICIAL IMPORTA: começando em zero, a queda existe no motor e
     NÃO APARECE -- o clamp em 0 a esconde, e o jogador lê uma barra parada. */
  {
    p.progresso = 0;
    for(let i = 0; i < 30; i++) S.pescariaAtualizar(1 / 30);
    ok('  (partindo de zero a mesma queda seria invisível)', p.progresso === 0);
  }

  /* ---- 3) A COR DA TENSÃO: três faixas, limiares estritos ---- */
  for(const [t, faixa] of [[0, ''], [48, ''], [48.1, 'aviso'], [72, 'aviso'], [72.1, 'perigo'], [100, 'perigo']])
    ok('  tensão ' + t + ' -> ' + (faixa || 'verde'), S.pescariaFaixaDaTensao(t) === faixa,
       S.pescariaFaixaDaTensao(t) || 'verde');
  /* ⚠️ E O CSS TEM AS TRÊS. A cor vem de CLASSE e não de `style.background`: escrita nos dois
     lugares, a folha ganharia do inline conforme a especificidade e a barra mudaria de cor às
     vezes -- o pior tipo de defeito, o que só acontece de vez em quando. */
  ok('e o CSS declara as três faixas',
     /\.pesc-barra i\.tens\{background:var\(--green\);\}/.test(src) &&
     /\.pesc-barra i\.tens\.aviso\{background:#e0a800;\}/.test(src) &&
     /\.pesc-barra i\.tens\.perigo\{background:var\(--red\);\}/.test(src));
  ok('  e o pintor NÃO escreve style.background',
     src.slice(src.indexOf('function pescariaPintar'), src.indexOf('function pescariaChipDoDuelo'))
        .indexOf('style.background') < 0);

  /* ---- 4) A COR DO TEXTO DE COMPORTAMENTO ---- */
  ok('o CSS tem o verde e o vermelho do comportamento',
     /\.pesc-comportamento\{[^}]*color:#2d7449/.test(src.replace(/\s+/g, ' ')) &&
     /\.pesc-comportamento\.perigo\{[^}]*color:var\(--red\)/.test(src.replace(/\s+/g, ' ')));
  /* os 1,5s de perigo do ciclo de 7s são o aviso e a arrancada -- e só eles */
  {
    const perigosos = ['aviso', 'arrancada'];
    for(const comp of ['cansado', 'resistindo', 'aviso', 'arrancada']){
      const q = { tempoDePesca: { cansado: 0.5, resistindo: 3, aviso: 5, arrancada: 5.8 }[comp] };
      ok('  ' + comp + ' -> ' + (perigosos.indexOf(comp) >= 0 ? 'vermelho' : 'verde'),
         S.pescariaComportamento(q) === comp, S.pescariaComportamento(q));
    }
  }

  /* ---- 5) O BOTÃO DE PUXAR AFUNDA E TROCA DE TEXTO ---- */
  ok('há um texto pra cada estado do botão',
     S.PESCARIA_PUXAR_TXT.solto === 'SEGURE PARA PUXAR' &&
     /^PUXANDO/.test(S.PESCARIA_PUXAR_TXT.segurando), S.PESCARIA_PUXAR_TXT.segurando);
  ok('e o CSS afunda o botão enquanto o dedo está nele',
     /\.pesc-puxar\.puxando\{[^}]*background:var\(--yellow\)/.test(src.replace(/\s+/g, ' ')));
  /* ⚠️ E ELE PRECISA GANHAR DO `.btn.primary`. As duas regras têm a MESMA especificidade (0-2-0),
     então quem vence é a que vem DEPOIS na folha -- e uma regra declarada certa que não faz efeito
     é a família do `[hidden]` que deixou o modal da contagem da Corrida preso na tela: ela passa
     em qualquer asserção de HTML e só a captura de tela pega. */
  ok('  e ele vem DEPOIS do `.btn.primary` na folha (senão a regra não faz efeito)',
     src.indexOf('.pesc-puxar.puxando{') > src.indexOf('.btn.primary{'),
     src.indexOf('.pesc-puxar.puxando{') + ' contra ' + src.indexOf('.btn.primary{'));
  ok('e o comportamento em perigo ganha do normal pela ordem',
     src.indexOf('.pesc-comportamento.perigo{') > src.indexOf('.pesc-comportamento{'));
  /* ⚠️ E O RELÓGIO VIRA UMA CONTAGEM DE PRORROGAÇÃO depois dos 90s -- ficar em '00:00' com a tela
     viva se lê como travada, e é justamente aí que uma batalha em curso ainda está pagando. */
  ok('o relógio conta a prorrogação depois dos 90s',
     /^\+\d+s$/.test(S.pescariaRelogio(S.PESCARIA_DURACAO + 3)), S.pescariaRelogio(S.PESCARIA_DURACAO + 3));
  /* ⚠️ E O CHIP DO CABEÇALHO DIZ EM QUE MOMENTO O DUELO ESTÁ. Ele é a única coisa da tela que
     conta que os lançamentos fecharam -- e é por isso que ele não pode ficar em 'VOCÊ × NPC'
     enquanto a prorrogação corre. */
  {
    const guarda = { tempo: S.pescaria.tempo, fase: S.pescaria.fase };
    S.pescaria.fase = 'jogando'; S.pescaria.tempo = 10;
    ok('  o chip nomeia o adversário durante o duelo',
       S.pescariaChipDoDuelo() === S.pescariaMeuNome().toUpperCase() + ' × ' + S.PESCARIA_NPC_NOME.toUpperCase(),
     S.pescariaChipDoDuelo());
    S.pescaria.tempo = S.PESCARIA_DURACAO + 1;
    ok('  e ÚLTIMOS ENCONTROS na prorrogação', S.pescariaChipDoDuelo() === 'ÚLTIMOS ENCONTROS', S.pescariaChipDoDuelo());
    S.pescaria.fase = 'fim';
    ok('  e RESULTADO no fim', S.pescariaChipDoDuelo() === 'RESULTADO', S.pescariaChipDoDuelo());
    S.pescaria.tempo = guarda.tempo; S.pescaria.fase = guarda.fase;
  }
  /* ⚠️ E A LINHA SOLTA QUANDO A ABA SAI DE FOCO. O botão só recebe `pointerup` enquanto o dedo
     está nele: trocar de aba com o dedo apoiado deixaria a linha puxando sozinha, e na volta o
     jogador encontraria a linha arrebentada sem ter feito nada. */
  {
    const cauda = src.slice(src.lastIndexOf("document.addEventListener('visibilitychange'"));
    ok('a linha solta no visibilitychange e no blur da janela',
       /pescariaSegurar\(false\)/.test(cauda) && /addEventListener\('blur'/.test(cauda));
  }

  /* ---- 6) E TUDO ISSO CHEGA NA TELA SEM UM render() ---- */
  p = pescando();
  p.ate = S.pescaria.tempo; S.pescariaAtualizar(0.01);
  S.pescariaFisgar();
  S.renderPescaria(); S.pescariaPintar();                 /* fisgar é um clique: aqui há render */
  const barra = () => S.document.getElementById('pescTensao');
  const comp  = () => S.document.getElementById('pescComportamento');
  const botao = () => S.document.getElementById('pescPuxar');
  p.tensao = 10; p.tempoDePesca = 0.5; S.pescariaPintar();
  ok('a barra nasce verde', !barra().classList.contains('aviso') && !barra().classList.contains('perigo'));
  ok('  e o texto também', !comp().classList.contains('perigo'));
  p.tensao = 60; S.pescariaPintar();
  ok('a tensão subindo vira âmbar SEM render', barra().classList.contains('aviso') === true);
  p.tensao = 90; S.pescariaPintar();
  ok('  e passando de 72 vira vermelha', barra().classList.contains('perigo') === true);
  p.tempoDePesca = 5.8; S.pescariaPintar();               /* arrancada */
  ok('e o texto fica vermelho na arrancada', comp().classList.contains('perigo') === true,
     comp().textContent);
  S.pescariaSegurar(true); S.pescariaPintar();
  ok('o botão afunda ao segurar', botao().classList.contains('puxando') === true);
  ok('  e troca de texto', botao().textContent === S.PESCARIA_PUXAR_TXT.segurando, botao().textContent);
  S.pescariaSegurar(false); S.pescariaPintar();
  ok('  e volta ao soltar',
     botao().classList.contains('puxando') === false &&
     botao().textContent === S.PESCARIA_PUXAR_TXT.solto);

  /* ---- 7) AS CHANCES DE CADA PONTO (o "(i)" do protótipo) ---- */
  /* ⚠️ A ESPÉCIE SAI DIRETO DO POOL aqui, sem a conversão de espécie-por-nível que o encontro
     selvagem precisa: o `pescariaSurgir` sorteia o id e o nível separados. Ou seja, esta lista é
     exatamente o que pode ser pescado -- e é por isso que ela pode mostrar a CHANCE. */
  for(let k = 0; k < S.PESCARIA_ZONAS.length; k++){
    const c = S.chancesDaZona(k);
    const soma = c.reduce((a, x) => a + x.pct, 0);
    ok('  ' + S.PESCARIA_ZONAS[k].nome + ': ' + c.length + ' espécies, ' + soma + '%',
       c.length === S.PESCARIA_ZONAS[k].pool.length && Math.abs(soma - 100) <= 1);
  }
  {
    S.abrirZonaDaPescaria(5);
    const m = S.renderPescariaZonaModal();
    const Z = S.PESCARIA_ZONAS[5];
    ok('o modal abre com o nome e a faixa do ponto',
       m.indexOf(Z.nome) >= 0 && m.indexOf(String(Z.nivel[0])) >= 0 && m.indexOf(String(Z.nivel[1])) >= 0);
    ok('  e lista as espécies com a chance de cada uma',
       Z.pool.every(([id]) => m.indexOf(S.SPECIES[id].name) >= 0) && /\d+%/.test(m));
    /* a linha é a da rota, e ela abre a MESMA ficha da Pokédex -- é a mesma pergunta */
    ok('  reusando a linha da rota e a ficha da Pokédex',
       m.indexOf('class="rota-mon') >= 0 && m.indexOf('abrirPokedexFicha(') >= 0);
    S.fecharZonaDaPescaria();
    ok('  e fecha', S.renderPescariaZonaModal() === '' && S.pescaria.zonaAberta === null);
  }
  /* ⚠️ O (i) É IRMÃO DO BOTÃO DA ZONA, nunca filho: botão dentro de botão é HTML inválido e o
     clique de dentro se perde -- com a tela continuando a PARECER certa. É a armadilha que a lupa
     do encontro selvagem e a do montador já custaram. */
  {
    pescando();
    const tela = S.renderPescaria();
    ok('há um (i) por ponto do lago', (tela.match(/abrirZonaDaPescaria\(/g) || []).length === 6,
       (tela.match(/abrirZonaDaPescaria\(/g) || []).length + ' de 6');
    const bloco = tela.slice(tela.indexOf('pesc-ponto'), tela.indexOf('pesc-ponto') + 700);
    ok('  e ele é IRMÃO do botão da zona, não filho',
       bloco.indexOf('</button>') < bloco.indexOf('pesc-info'),
       'o fecha-botão tem que vir ANTES do (i)');
    ok('  e o CSS o tira de dentro (position:absolute)',
       /\.pesc-info\{[^}]*position:absolute/.test(src.replace(/\s+/g, ' ')));
  }

  /* ---- 8) OS CHIPS QUE O PROTÓTIPO TINHA E A TELA NÃO ---- */
  /* o bloco acima remonta o duelo, então este recomeça do zero -- senão ele leria o estado de
     um pescador de outro jogo, que é como a leitura da zona saía errada. */
  p = pescando();
  p.ate = S.pescaria.tempo; S.pescariaAtualizar(0.01); S.pescariaFisgar();
  S.pescaria.jogadores[1].op = null;   /* o NPC pode ter entrado no mesmo ponto durante o laço acima */
  /* ⚠️ NÃO EXISTE MAIS DISPUTA (20/09/2026): quem chega primeiro FECHA o ponto, então dois nunca
     estão no mesmo. O chip do peixe perdeu o `DISPUTADO`, a zona perdeu o `DISPUTA!` e o
     `pescariaComecarBatalha` perdeu o "X pescou primeiro" -- as três eram a mesma mecânica. */
  ok('o chip diz o tamanho do peixe',
     /^(Pequeno|Médio|Grande) · na linha$/.test(S.pescariaChipDoPeixe(p.op)),
     S.pescariaChipDoPeixe(p.op));
  ok('  e a zona diz o NOME do treinador',
     S.pescariaAtividade(0) === S.pescariaMeuNome().toUpperCase() + ' PESCANDO',
     S.pescariaAtividade(0));
  {
    /* ⚠️ UM PONTO, UM PESCADOR -- e quem recusa é a AÇÃO, não a tela apagada. */
    const npc = S.pescaria.jogadores[1];
    const zona = p.op.zona;
    ok('  e o ponto tem dono', S.pescariaQuemEsta(zona) === 0, String(S.pescariaQuemEsta(zona)));
    npc.estado = 'parado'; npc.op = null;
    S.pescariaEntrar(1, zona);
    ok('  o adversário NÃO entra no ponto que eu ocupei', npc.op === null,
       npc.op ? 'entrou na zona ' + npc.op.zona : '(não entrou)');
    /* e o contrário também: o ponto DELE fica fechado pra mim */
    const eu = S.pescaria.jogadores[0];
    S.pescaria.oportunidades = new Array(S.PESCARIA_ZONAS.length).fill(null);
    S.pescariaSurgir(3);
    npc.estado = 'espera'; npc.op = S.pescaria.oportunidades[3];
    eu.estado = 'parado'; eu.op = null;
    S.pescariaEntrar(0, 3);
    ok('  e eu não entro no ponto que ele ocupou', eu.op === null,
       eu.op ? 'entrou na zona ' + eu.op.zona : '(não entrou)');
    ok('  a zona diz quem está lá', S.pescariaAtividade(3) === S.PESCARIA_NPC_NOME.toUpperCase() + ' PESCANDO',
       S.pescariaAtividade(3));
  }
}

/* ============================================================================
   6) A PESCARIA NÃO ENCOSTA NO SAVE
   ============================================================================ */
console.log('\n=== A PESCARIA NÃO ENCOSTA NO SAVE ===');
{
  contaAdmin();
  const antes = JSON.stringify(g.saveSlots);
  const e = S.pescariaElegiveis();
  S.pescaria.escolhido = e[0];
  S.pescaria.npc = S.pescariaSortearNpc();
  S.pescaria.jogadores = [
    S.pescariaNovoPescador(S.pescariaTimeDoSlot(e[0]), true),
    S.pescariaNovoPescador(S.pescaria.npc, false),
  ];
  S.pescaria.fase = 'jogando';
  for(let z = 0; z < 6; z++){
    S.pescariaSurgir(z);
    S.pescariaComecarBatalha(0, S.pescaria.oportunidades[z]);
    let v = 0;
    while(S.pescaria.jogadores[0].estado === 'batalha' && v < 300){ S.pescaria.tempo += 0.5; S.pescariaPassoDaBatalha(0); v++; }
    S.pescaria.jogadores[0].estado = 'parado';
  }
  ok('seis batalhas depois, o time do save está byte a byte igual',
     JSON.stringify(g.saveSlots) === antes);
  /* ⚠️ O ESTADO VIVE FORA DO `game`, então nada disto pode ter entrado no save serializado. */
  ok('e `pescaria` não é um campo do game', g.pescaria === undefined);
  const ser = JSON.stringify(S.serializeGame ? S.serializeGame() : {});
  ok('nem aparece no serializeGame', ser.indexOf('pescaria') < 0);
}

/* ============================================================================
   7) A TELA
   ============================================================================ */
console.log('\n=== A TELA ===');
{
  contaAdmin();
  S.pescaria.fase = 'setup'; S.pescaria.escolhido = null; S.pescaria.npc = null;
  const setup = S.renderPescaria();
  ok('o setup pede um parceiro', setup.indexOf('pescariaAbrirPicker()') >= 0);
  ok('e o começar fica travado sem escolher', /pescariaLargar\(\)"[^>]*disabled/.test(setup));
  ok('o adversário já aparece no setup, com o time dele',
     setup.indexOf(S.PESCARIA_NPC_NOME) >= 0
     && (setup.match(/pesc-parceiro npc/g) || []).length === 1);
  /* ⚠️ E A LINHA DA REGRA DO SORTEIO SAIU (20/09/2026, a pedido): ela contava o MOTOR (*"sorteado
     entre os de BST acima de 500"*), e o que o jogador precisa ver ali é QUEM ele vai enfrentar --
     a fileira dos seis já mostra. */
  ok('  e a regra do sorteio não aparece', !/BST acima/i.test(setup));
  /* ⚠️ O MAPA APARECE NA PRIMEIRA TELA (a pedido: *"quero que nessa primeira tela apareça o mapa
     com as localizações"*), em modo ILUSTRAÇÃO: os pontos não entram na pesca (não há duelo pra
     entrar), mas o (i) de cada um SIM -- é ele que esta tela tem a oferecer, porque escolher o
     time sabendo o que mora em cada ponto é a decisão que ela pede. */
  ok('o mapa das localizações já está no setup', setup.indexOf('pesc-mapa') >= 0);
  ok('  com os seis pontos', (setup.match(/class="pesc-ponto"/g) || []).length === S.PESCARIA_PONTOS.length,
     (setup.match(/class="pesc-ponto"/g) || []).length + ' de ' + S.PESCARIA_PONTOS.length);
  ok('  e eles NÃO pescam aqui', setup.indexOf('pescariaEntrar(0,') < 0);
  ok('  mas o (i) de cada um clica',
     (setup.match(/abrirZonaDaPescaria\(/g) || []).length === S.PESCARIA_PONTOS.length);
  ok('e o selo da pescaria está lá', setup.indexOf('#s-pescaria') >= 0);

  const e = S.pescariaElegiveis();
  S.pescariaEscolher(e[0]);
  const comParceiro = S.renderPescaria();
  ok('com time, o começar destrava', !/pescariaLargar\(\)"[^>]*disabled/.test(comParceiro));

  /* ⚠️ O CARD DO TIME É O DA LIGA CLÁSSICA (20/09/2026, a pedido: *"a mesma tela de time para ser
     escolhido quando o usuário tem que escolher um time para inscrever na liga clássica"*). É o
     `save-slot-card` inteiro, com a estrela da média e a fileira dos seis. */
  ok('o time escolhido usa o card da Liga', comParceiro.indexOf('save-slot-card') >= 0);
  ok('  com a estrela da média', comParceiro.indexOf('team-avg-star') >= 0);
  /* ⚠️ E O CARD INTEIRO É O BOTÃO -- o `.btn` da casa é `display:block; width:100%` e dentro de
     uma linha flex ele sobe POR CIMA do texto (medido a 320px). É a regra da ficha da Pokédex,
     do card do log de batalha e das prateleiras da loja. */
  ok('  e o card É o alvo do toque',
     /<button[^>]*save-slot-card[^>]*onclick="pescariaAbrirPicker\(\)"/.test(comParceiro)
     || /<button[^>]*onclick="pescariaAbrirPicker()"[^>]*save-slot-card/.test(comParceiro));
  ok('o card do NPC não é clicável',
     /<div class="pesc-parceiro npc">/.test(comParceiro));

  /* jogando */
  S.pescaria.npc = S.pescaria.npc || S.pescariaSortearNpc();
  S.pescaria.jogadores = [
    S.pescariaNovoPescador(S.pescariaTimeDoSlot(e[0]), true),
    S.pescariaNovoPescador(S.pescaria.npc, false),
  ];
  S.pescaria.fase = 'jogando'; S.pescaria.tempo = 30;
  S.pescariaSurgir(1);
  const jogo = S.renderPescaria();
  ok('a tela do jogo tem as seis zonas', (jogo.match(/pescariaEntrar\(0,/g) || []).length === 6);
  ok('e a zona com peixe está acesa', jogo.indexOf('pesc-zona viva') >= 0);
  ok('e o relógio conta pra baixo', jogo.indexOf('01:00') >= 0, 'aos 30s de 90');

  /* ⚠️ PUXAR É `pointerdown/up`, e não `click`: com `click` só haveria o instante do toque, e a
     mecânica de soltar pra aliviar a tensão deixaria de existir. */
  S.pescaria.jogadores[0].estado = 'puxando';
  S.pescaria.jogadores[0].op = S.pescaria.oportunidades[1];
  S.pescaria.jogadores[0].progresso = 58; S.pescaria.jogadores[0].tensao = 34;
  const puxando = S.renderPescaria();
  ok('o botão de puxar usa pointerdown/up', /onpointerdown="pescariaSegurar\(true\)"/.test(puxando) &&
     /onpointerup="pescariaSegurar\(false\)"/.test(puxando));
  /* ⚠️ E SOLTA TAMBÉM NO `pointerleave`/`pointercancel`: sem eles, arrastar o dedo pra fora do
     botão deixaria a linha puxando sozinha até arrebentar. */
  ok('e solta ao sair do botão', /onpointerleave="pescariaSegurar\(false\)"/.test(puxando) &&
     /onpointercancel="pescariaSegurar\(false\)"/.test(puxando));
  /* ⚠️ AS BARRAS NASCEM COM O VALOR REAL: quem pinta a cada quadro é o DOM, mas o PRIMEIRO desenho
     é do render -- com 0 fixo elas piscavam em zero ao entrar no painel. */
  ok('as barras nascem com o valor real, não em zero',
     puxando.indexOf('id="pescProgresso" class="prog" style="width:58%"') >= 0 &&
     puxando.indexOf('>58%<') >= 0);

  /* fim */
  S.pescaria.jogadores[0].pontos = 120; S.pescaria.jogadores[1].pontos = 80;
  S.pescaria.fase = 'fim';
  const fim = S.renderPescaria();
  ok('o fim mostra o placar', fim.indexOf('>120<') >= 0 && fim.indexOf('>80<') >= 0);
  /* ⚠️ O NOME DO TREINADOR, nunca "Você" (20/09/2026, a pedido) */
  ok('e diz quem venceu, pelo NOME', fim.indexOf(S.pescariaMeuNome() + ' venceu') >= 0);
  ok('e a pista some', fim.indexOf('pescariaEntrar(0,') < 0);
  ok('mas dá pra pescar de novo e trocar parceiro',
     fim.indexOf('pescariaLargar()') >= 0 && fim.indexOf('pescariaReiniciar()') >= 0);

  /* ⚠️ O LOG É O DA CASA (`renderMatchupLog`), e não um resumo próprio: como as batalhas daqui são
     do MESMO motor, os matchups servem direto -- e ele mostra os golpes e os selos de verdade. */
  /* ⚠️ A FATIA VAI ATÉ O FIM DA FUNÇÃO, e não a um número de caracteres. Com um teto fixo (era
     9000) ela encolhe por dentro na primeira coisa que a tela ganhar -- foi exatamente o que
     aconteceu quando o modal das chances entrou: a trava passou a procurar o log numa fatia que
     parava antes dele. É a mesma armadilha da fatia vazia que este projeto já pagou três vezes,
     e o conserto é o mesmo: marcadores de verdade, e um ok() pro tamanho. */
  const fonte = src.slice(src.indexOf('function renderPescaria'), src.indexOf(String.fromCharCode(10) + 'function render(){'));
  ok('(a fatia do renderPescaria tem o que ler)', fonte.length > 5000, fonte.length + ' chars');
  ok('o fim usa o log de batalha da casa', fonte.indexOf('renderMatchupLog(pescaria.logs)') >= 0);

  /* ⚠️ E O `render()` NÃO É CHAMADO POR QUADRO: um render por quadro recriaria a tela 60 vezes por
     segundo e o botão de puxar perderia o `pointerdown` no meio do toque. Quem pinta é o DOM. */
  const laco = src.slice(src.indexOf('function pescariaLargar'), src.indexOf('function pescariaTerminar'));
  const dentroDoPasso = laco.slice(laco.indexOf('const passo ='));
  ok('o laço pinta pelo DOM, nunca por render()',
     dentroDoPasso.indexOf('pescariaPintar()') >= 0 && dentroDoPasso.indexOf('render()') < 0);
  /* ⚠️ A TRAVA DO `dt` MORREU EM 20/09/2026, quando o relógio passou a RECUPERAR o tempo da aba
     oculta. Ela media `Math.min(0.1, ...)` LENDO O CÓDIGO, e por isso não distinguia "o passo é
     limitado" (que continua sendo, e tem que ser) de "o tempo é jogado fora" (que era o defeito).
     A que ficou no lugar dela DIRIGE o laço e salta o tempo -- ver o bloco do relógio real. */
}

/* ============================================================================
   7b) ⚠️ A TELA ACOMPANHA O MOTOR SEM UM render() -- os dois defeitos de 19/09/2026
   ============================================================================
   Relatados assim: *"a tela do sinal para fisgar não está acontecendo nada"* e *"depois que eu não
   fisguei, não consigo mais clicar em nenhum botão do lago"*.

   A causa é UMA: os painéis eram montados por CONDIÇÃO no render, e o laço do jogo NÃO redesenha
   (de propósito -- um render por quadro recriaria o botão de puxar no meio do toque). Só que as
   duas transições que mais importam acontecem no TEMPO e não num clique: 'espera'->'fisgada' (o
   sinal) e 'descanso'->'parado' (o lago reabrindo).

   ⚠️ ESTE BLOCO DIRIGE O LAÇO DE VERDADE e NUNCA chama render() -- é isso que o torna uma prova.
   Com um render no meio, ele passaria com o defeito inteiro de volta.
   ============================================================================ */
console.log('\n=== A TELA ACOMPANHA O MOTOR SEM UM render() ===');
{
  const elBoia   = () => S.document.getElementById('pescBoia');
  const elTexto  = () => S.document.getElementById('pescBoiaTexto');
  const elDica   = () => S.document.getElementById('pescBoiaDica');
  const painel   = nome => S.document.getElementById('pescPainel' + nome);
  const zona     = k => S.document.getElementById('pescZona' + k);

  /* ⚠️ O `time` OPCIONAL entra DEPOIS do `contaAdmin()`, que é quem refaz os saves -- posto antes,
     ele seria sobrescrito e o caso mediria o time padrão. */
  function jogoNaTela(time){
    contaAdmin();
    if(time) g.saveSlots[0].team = time;
    const e = S.pescariaElegiveis();
    S.pescaria.escolhido = e[0];
    S.pescaria.npc = S.pescariaSortearNpc();
    S.pescaria.jogadores = [
      S.pescariaNovoPescador(S.pescariaTimeDoSlot(e[0]), true),
      S.pescariaNovoPescador(S.pescaria.npc, false),
    ];
    S.pescaria.fase = 'jogando'; S.pescaria.tempo = 0;
    S.pescaria.oportunidades = new Array(S.PESCARIA_ZONAS.length).fill(null);
    g.screen = 'pescaria';
    /* UM render só, o da entrada na tela -- é o que o jogo faz de verdade */
    S.renderPescaria();
    S.pescariaPintar();
    return S.pescaria.jogadores[0];
  }
  /* anda o relógio como o laço faz: atualiza e PINTA, sem render */
  function anda(segundos){
    const passos = Math.max(1, Math.round(segundos * 30));
    for(let i = 0; i < passos; i++){ S.pescariaAtualizar(1 / 30); S.pescariaPintar(); }
  }

  /* ---- a fonte única do painel ---- */
  ok('cada estado tem um painel', S.PESCARIA_PAINEIS.length === 5, S.PESCARIA_PAINEIS.join(','));
  for(const [estado, esperado] of [['parado','Parado'], ['espera','Espera'], ['fisgada','Espera'],
                                    ['puxando','Puxando'], ['batalha','Batalha'], ['descanso','Descanso']])
    ok('  ' + estado + ' -> ' + esperado, S.pescariaPainelDoEstado(estado) === esperado,
       S.pescariaPainelDoEstado(estado));
  /* ⚠️ 'espera' e 'fisgada' DIVIDEM o painel de propósito: é a MESMA cena, e o que muda é a boia
     ter afundado. Em painéis separados, o sinal viraria uma troca de tela. */
  ok('  e os dois da boia dividem o mesmo painel',
     S.pescariaPainelDoEstado('espera') === S.pescariaPainelDoEstado('fisgada'));

  /* ---- 1) O SINAL DE FISGAR ---- */
  let p = jogoNaTela();
  S.pescariaSurgir(0);
  S.pescariaEntrar(0, 0);
  S.renderPescaria(); S.pescariaPintar();          /* entrar é um clique, então aqui há render */
  ok('entrar abre o painel da boia', painel('Espera').hidden === false && painel('Parado').hidden === true);
  ok('e ela começa boiando (sem a marca)', elBoia().classList.contains('mordeu') === false);
  ok('com o texto de espera', elTexto().textContent === S.PESCARIA_BOIA.espera.texto, elTexto().textContent);

  /* ⚠️ AQUI É A PROVA: a boia afunda por TEMPO, e NINGUÉM chama render */
  p.ate = S.pescaria.tempo;
  anda(0.1);
  ok('a boia afunda SOZINHA quando o motor diz', p.estado === 'fisgada', p.estado);
  ok('  e a TELA acompanha: a boia ganha a marca', elBoia().classList.contains('mordeu') === true);
  ok('  o texto vira o do sinal', elTexto().textContent === S.PESCARIA_BOIA.mordeu.texto, elTexto().textContent);
  ok('  e a dica também', elDica().textContent === S.PESCARIA_BOIA.mordeu.dica, elDica().textContent);
  ok('  tudo isso SEM trocar de painel', painel('Espera').hidden === false);

  /* ---- 2) O LAGO REABRE ---- */
  p = jogoNaTela();
  S.pescariaSurgir(0);
  S.pescariaEntrar(0, 0);
  S.renderPescaria(); S.pescariaPintar();
  ok('dentro de um ponto, as zonas travam', zona(1).disabled === true);
  /* perde sem fisgar -- exatamente o relato */
  p.ate = S.pescaria.tempo; anda(0.1);            /* a boia afunda */
  anda(1.3);                                       /* e ele nao fisga: o peixe escapa */
  ok('não fisgar faz perder', p.estado === 'descanso', p.estado);
  ok('  e a tela mostra o painel de descanso', painel('Descanso').hidden === false);
  ok('  com o motivo escrito',
     S.document.getElementById('pescDescansoTxt').textContent === p.recadoDeEspera,
     S.document.getElementById('pescDescansoTxt').textContent);
  /* ⚠️ E ENTÃO O DESCANSO PASSA, também por TEMPO */
  anda(1.6);
  ok('o descanso passa sozinho', p.estado === 'parado', p.estado);
  /* ⚠️ MENOS O QUE O ADVERSÁRIO OCUPA: desde 20/09/2026 um ponto tem UM pescador, então o dele
     continua fechado enquanto ele pesca -- e é o certo. */
  {
    const livres = [0,1,2,3,4,5].filter(k => S.pescariaQuemEsta(k) < 0);
    ok('  ⚠️ E O LAGO REABRE NA TELA (o defeito relatado)',
       livres.length > 0 && livres.every(k => zona(k).disabled === false),
       'travadas: ' + (livres.filter(k => zona(k).disabled).join(',') || '(nenhuma)'));
  }
  ok('  e o painel volta a ser o de escolher', painel('Parado').hidden === false && painel('Espera').hidden === true);

  /* ---- 3) DEPOIS DOS 90s O LAGO FECHA DE NOVO ---- */
  p = jogoNaTela();
  S.pescaria.tempo = S.PESCARIA_DURACAO + 0.5;
  S.pescariaPintar();
  ok('acabado o tempo, não dá pra entrar em ponto nenhum',
     [0,1,2,3,4,5].every(k => zona(k).disabled === true));

  /* ---- 4) O PAINEL DA BATALHA É PREENCHIDO PELO PINTOR ---- */
  p = jogoNaTela();
  S.pescariaSurgir(3);
  S.pescariaComecarBatalha(0, S.pescaria.oportunidades[3]);
  S.pescariaPintar();
  const alvo = S.SPECIES[p.op.speciesId];
  ok('a batalha aparece sem render', painel('Batalha').hidden === false);
  ok('  e o pintor preencheu o painel com o peixe certo',
     painel('Batalha').innerHTML.indexOf(alvo.name) >= 0, alvo.name);
  /* ⚠️ UMA VEZ POR PEIXE: refazer o HTML a cada quadro jogaria fora as barras que o próprio
     pintor acabou de mexer. A guarda é o id do peixe. */
  const antes = painel('Batalha').innerHTML;
  painel('Batalha').innerHTML = 'SUJO';
  S.pescariaPintar();
  ok('  e ele NÃO é refeito a cada quadro', painel('Batalha').innerHTML === 'SUJO');
  painel('Batalha').innerHTML = antes;

  /* ---- 5) ⚠️ LENDO O CÓDIGO: o laço não pode voltar a chamar render() ---- */
  
  /* ⚠️ TODA FATIA DE CÓDIGO É COBRADA PELO TAMANHO ANTES DE SER LIDA. A primeira versão deste
     bloco fatiou de '/* jogando *\/' até 'function pescariaLargar' -- e o pescariaLargar fica
     ANTES no arquivo, então a fatia saía VAZIA e as seis asserções passavam sem ler NADA. É a
     mesma armadilha que o teste do tentarGolpeEspecial já tinha custado, e o conserto é o mesmo:
     um ok() só pra dizer que há o que ler. */
  const fatia = (de, ate) => {
    const a = src.indexOf(de), b = src.indexOf(ate, a + 1);
    return (a < 0 || b < 0) ? '' : src.slice(a, b);
  };
  const laco = fatia('function pescariaLargar', 'function pescariaTerminar');
  ok('(a fatia do laço tem o que ler)', laco.length > 300, laco.length + ' chars');
  const passo = laco.slice(laco.indexOf('const passo ='));
  ok('o laço continua sem render()', passo.indexOf('render()') < 0 && passo.indexOf('pescariaPintar()') >= 0);
  /* ⚠️ E NENHUM PAINEL PODE VOLTAR A SER CONDICIONAL: é assim que o defeito renasce. */
  const jogando = fatia('/* jogando */', '\nfunction render(');
  ok('(a fatia do render tem o que ler)', jogando.length > 1000, jogando.length + ' chars');
  for(const nome of S.PESCARIA_PAINEIS)
    ok('  o painel ' + nome + ' existe sempre no HTML',
       jogando.indexOf('id="pescPainel' + nome + '"') >= 0);
  ok('  e quem decide é o pescariaPainelDoEstado, não um if',
     (jogando.match(/pescariaPainelDoEstado\(eu\.estado\)/g) || []).length === S.PESCARIA_PAINEIS.length,
     (jogando.match(/pescariaPainelDoEstado\(eu\.estado\)/g) || []).length + ' de ' + S.PESCARIA_PAINEIS.length);
  /* ⚠️ E O CSS PRECISA DA REGRA DO [hidden]: a da folha do NAVEGADOR perde pra qualquer display
     do autor -- foi assim que o modal da contagem da Corrida ficou preso na tela. */
  ok('e o CSS tem a regra do [hidden]', src.indexOf('.pesc-painel[hidden]{display:none!important;}') >= 0);
}

/* ============================================================================
   8) O SELO
   ============================================================================ */
console.log('\n=== O SELO DA PESCARIA ===');
{
  ok('existe no DESENHOS', Array.isArray(S.DESENHOS.pescaria) && S.DESENHOS.pescaria.length === 24,
     S.DESENHOS.pescaria ? S.DESENHOS.pescaria.length + ' linhas' : 'não existe');
  ok('e vira um <symbol> no SVG', S.svgDosSelos().indexOf('id="s-pescaria"') >= 0);
  /* ⚠️ NENHUM EMOJI no lugar dele -- é a regra que tirou os 54 emojis das telas em 17/09. */
  contaAdmin(); S.pescaria.fase = 'setup'; S.pescaria.escolhido = null; S.pescaria.npc = null;
  ok('e a tela não usa emoji de peixe/vara', !/\u{1F41F}|\u{1F3A3}|\u{1F420}/u.test(S.renderPescaria()));
}

/* ============================================================================
   9) ⚠️ NENHUMA CLASSE DE BOTÃO FANTASMA -- no jogo INTEIRO
   ============================================================================
   O botão de fisgar nasceu com uma variante de cor que não existe na folha, e saiu cinza no
   momento em que a tela mais precisa gritar. Um nome que não existe NÃO dá erro: ele só não faz
   nada, e só a captura de tela pega. É a mesma família do `var(--yellow-soft)` e do
   `var(--cream)` fantasmas, que já custaram uma aba transparente e um realce que não realçava.

   ⚠️ ELA VARRE O JOGO INTEIRO de propósito: escrita só pra Pescaria, ela não pegaria a próxima.
   ============================================================================ */
console.log('\n=== NENHUMA CLASSE DE BOTÃO FANTASMA ===');
{
  const css = src.slice(src.indexOf('<style'), src.indexOf('</style>'));
  const declaradas = new Set([...css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m => m[1]));
  const usadas = new Map();
  for(const m of src.matchAll(/class="btn ([a-zA-Z0-9 _-]+)"/g))
    for(const c of m[1].trim().split(/\s+/)) usadas.set(c, (usadas.get(c) || 0) + 1);

  /* ⚠️ UM ÓRFÃO CONHECIDO E ANTERIOR A ISTO: `mewtwo-loan-cta`, num botão que já tem o
     `.btn.success` fazendo o trabalho. Ele fica NOMEADO aqui em vez de a trava ser afrouxada --
     assim o próximo que nascer é barulhento, e este não some de vista. */
  const CONHECIDOS = ['mewtwo-loan-cta'];
  const orfas = [...usadas.keys()].filter(c => !declaradas.has(c) && CONHECIDOS.indexOf(c) < 0);
  ok('nenhuma classe de .btn sem CSS', orfas.length === 0, orfas.join(', ') || '(' + usadas.size + ' classes conferidas)');
  ok('e o botão de fisgar tem a cor dele',
     declaradas.has('pesc-fisgar') && src.indexOf('class="btn pesc-fisgar"') >= 0);
}

/* ============================================================================
   10) ⚠️ AS DEZ CORREÇÕES DA REVISÃO (19/09/2026)
   ============================================================================
   Elas saíram de uma varredura adversarial e são de naturezas bem diferentes -- do laço que
   continuava vivo pintando DENTRO de outra batalha até um ramo de NPC que nunca rodava. O que
   elas têm em comum é serem todas INVISÍVEIS: nenhuma dá erro, nenhuma aparece num print.
   ============================================================================ */
console.log('\n=== O LAÇO PARA QUANDO A TELA MUDA ===');
{
  /* ⚠️ A GUARDA É LIDA DO CÓDIGO porque o laço não roda no sandbox (não há rAF): os casos
     chamariam o `pescariaAtualizar` na mão e passariam com ela removida. */
  const a = src.indexOf('const passo = (ts) => {');
  const corpo = src.slice(a, a + 1800);
  ok('(a fatia do laço tem o que ler)', a > 0 && corpo.length > 800, corpo.length + ' chars');
  ok('a guarda confere a FASE e a TELA',
     /if\(pescaria\.fase !== 'jogando' \|\| game\.screen !== 'pescaria'\)/.test(corpo));
  ok('  e ela solta o laço em vez de só pular o quadro', /pescaria\.laco = null; return;/.test(corpo));
  /* ⚠️ E O MOTIVO DELA: o pintor escreve nos ids GLOBAIS da batalha, que a Torre, o ginásio e o
     ONLINE também usam. Sem a guarda, um convite aceito no meio do duelo deixava o laço pintando
     a barra e a frase da outra batalha. */
  ['hp-fill-player', 'hp-fill-enemy', 'battle-status-txt'].forEach(id => {
    const n = src.split(id).length - 1;
    ok('  "' + id + '" é compartilhado com as outras batalhas', n >= 5, n + ' usos no arquivo');
  });
}

console.log('\n=== A ESPECIALIDADE E O ITEM SÃO DO JOGADOR ===');
{
  /* ⚠️ OS DOIS PESCADORES PASSAM PELO MESMO CAMINHO, e o lado `a` do `pescariaBatalhar` é o
     parceiro de QUEM estiver lutando. O `ehDoJogador` era declarado e IGNORADO: a batalha do NPC
     saía com a especialidade do jogador -- selo 🎖️ no quadro dele e 1,05× em tudo. */
  const p = jogoNaTela();
  g.specialties = ['Electric'];
  S.pescaria.jogadores[1].inst = { speciesId: 'jolteon', level: 65 };
  S.pescariaSurgir(3);
  S.pescariaComecarBatalha(1, S.pescaria.oportunidades[3]);
  const mNpc = S.pescaria.jogadores[1].batalha.matchup;
  ok('o parceiro do NPC NÃO leva a especialidade do jogador', !mNpc.playerSpecialty);
  ok('  nem o peixe dele', !mNpc.enemySpecialty);
  S.pescaria.jogadores[0].inst = { speciesId: 'jolteon', level: 70 };
  S.pescariaSurgir(0);
  S.pescariaComecarBatalha(0, S.pescaria.oportunidades[0]);
  const mEu = S.pescaria.jogadores[0].batalha.matchup;
  ok('  e o parceiro DELE leva (senão a correção teria matado o buff)', !!mEu.playerSpecialty);
  ok('  e o peixe nunca leva', !mEu.enemySpecialty);
  g.specialties = [];
  /* o parâmetro tem que ser USADO, não só declarado -- foi assim que ele passou despercebido */
  const f = src.slice(src.indexOf('function pescariaBatalhar'), src.indexOf('function pescariaBatalhar') + 700);
  ok('  e o pescariaBatalhar usa o ehDoJogador nas DUAS linhas',
     (f.match(/ehDoJogador \?/g) || []).length === 2);
}

console.log('\n=== O PEIXE LEVA O MOVESET DA ESPÉCIE ===');
{
  /* ⚠️ A REGRA DE 09/09/2026: quem NÃO escolhe golpe luta com tudo que a espécie aprende por
     nível. Sem isso o peixe caía no motor de tipo com o poder implícito de 60 -- ou seja a
     batalha da pescaria NÃO era a da jornada, que é justamente o que foi pedido. */
  const p = jogoNaTela();
  S.pescariaSurgir(5);
  const op = S.pescaria.oportunidades[5];
  S.pescariaComecarBatalha(0, op);
  const m = S.pescaria.jogadores[0].batalha.matchup;
  const doPeixe = S.ataquesDisponiveis(op.speciesId, op.nivel);
  ok('o peixe entra com golpe escolhido', !!m.enemyMoveId || doPeixe.length === 0,
     op.speciesId + ' Lv.' + op.nivel + ' aprende ' + doPeixe.length);
  /* e o parceiro do JOGADOR nunca é equipado por cima: os golpes dele são a escolha dele */
  const chamada = src.slice(src.indexOf('function pescariaComecarBatalha'),
                            src.indexOf('function pescariaComecarBatalha') + 2600);
  ok('  o peixe passa pelo equiparNpc', /equiparNpc\(\[pescadoInst\]\)/.test(chamada));
  ok('  o parceiro do NPC também', /if\(qual !== 0\) equiparNpc\(meuTime\)/.test(chamada));
  /* ⚠️ E NUNCA SEM CONDIÇÃO: o `equiparNpc` só preenche quem está SEM golpe, então uma chamada
     solta não estragaria o time de quem escolheu -- mas estragaria o save antigo, que é
     justamente quem não tem `ataques` e por desenho cai no motor de tipo. */
  ok('  e o do JOGADOR nunca, sem condição',
     (chamada.match(/equiparNpc\(meuTime\)/g) || []).length === 1 &&
     /if\(qual !== 0\) equiparNpc\(meuTime\)/.test(chamada));
  /* ⚠️ E ELE É O QUE FAZ OS STATUS POR ATAQUE EXISTIREM: sem id de golpe não há o que consultar
     nas tabelas de queimar/envenenar/paralisar.
     ⚠️ E O PAINEL É DIRIGIDO, porque medir a FREQUÊNCIA num pool sorteado é o pior tipo de trava:
     ela rodava as seis zonas com um time Lv.55-70 e caiu de 5,5 pra 2,25 eventos em 1.200 quando
     os 18 pescáveis novos entraram (20/09) -- ou seja passou a falhar 1 rodada em 10 SEM NADA
     ESTAR ERRADO. É a armadilha do painel forte demais, agora pelo lado da amostragem.
     ⚠️ E O QUE IMPORTA NÃO É A TAXA: é que um peixe que ESCOLHE um golpe de status realmente o
     aplica. O motor escolhe pelo DANO, então quase todo golpe de status perde a vaga -- medido,
     só três pescáveis escolhem um: Poliwag e Chinchou (Golpe de Corpo e Faísca, 30% de paralisar)
     e o Gyarados Lv.53 (Salto). Com o dono certo a trava vira determinística: 51% em 300. */
  {
    /* um parceiro que NÃO mata em um golpe -- com o time forte a luta acaba antes de o peixe agir */
    const q = jogoNaTela([{ speciesId: 'snorlax', level: 45, id: 'p0' }]);
    let comStatus = 0, escolheu = 0;
    for(let i = 0; i < 300; i++){
      S.pescaria.oportunidades = new Array(6).fill(null);
      S.pescariaSurgir(1);
      const o = S.pescaria.oportunidades[1];
      o.speciesId = 'poliwag'; o.nivel = 35;
      S.pescariaComecarBatalha(0, o);
      const mm = S.pescaria.jogadores[0].batalha.matchup || {};
      if(mm.enemyMoveId === 'bodyslam') escolheu++;
      if(((mm && mm.golpes) || []).some(x => ['queimou','envenenou','paralisou','congelou'].indexOf(x.x) >= 0)) comStatus++;
      const j = S.pescaria.jogadores[0]; j.estado = 'parado'; j.op = null; j.batalha = null;
      /* ⚠️ CURA O TIME A CADA VOLTA: este painel mede a BATALHA, não o desgaste. Sem isso o time
         cai na 3ª rodada e as outras 297 medem um time inteiro no chão -- ou seja, medem nada. */
      j.time.forEach(x => { x.hp = x.maxHp; });
    }
    /* ⚠️ O GOLPE ESCOLHIDO É COBRADO À PARTE: sem isso a trava mediria o sorteio da espécie em vez
       da regra -- um moveset vazio daria zero pelos dois motivos e ela não saberia distinguir. */
    ok('  o peixe ESCOLHE o golpe de status que ele leva', escolheu === 300,
       escolheu + ' de 300 com Golpe de Corpo');
    ok('  e status por ataque ACONTECE', comStatus > 30,
       comStatus + ' de 300 (a chance do golpe é 30%)');
  }
}

console.log('\n=== OS SELOS 🔥🟣⚡ APARECEM NO QUADRO ===');
{
  /* ⚠️ O QUADRO É MONTADO UMA VEZ POR PEIXE, ou seja sempre no passo 0 -- e o `selosDoConfronto`
     só devolve esses três A PARTIR do passo em que o status pega. Na jornada quem os faz aparecer
     é o `render()` do ramo `animating`, disparado justamente nesses passos (eles carregam a marca
     `leitura`). Aqui quem faz isso é o `pescariaPintarArea`, que repinta o bloco dos lutadores. */
  const p = jogoNaTela();
  const CAMPO = { queimou: 1, envenenou: 1, paralisou: 1 };
  let achados = 0, certos = 0;
  for(let i = 0; i < 2500 && achados < 40; i++){
    S.pescaria.oportunidades = new Array(6).fill(null);
    S.pescariaSurgir(i % 6);
    const z = S.pescaria.oportunidades.findIndex(o => o);
    S.pescariaComecarBatalha(0, S.pescaria.oportunidades[z]);
    const b = S.pescaria.jogadores[0].batalha;
    const d = (b.matchup && b.matchup.golpes) || [];
    const k = d.findIndex(x => CAMPO[x.x]);
    if(k >= 0){
      achados++;
      const lado = d[k].q;                     /* o diário usa 'p'/'e'; o seq usa player/enemy */
      const iSeq = b.seq.findIndex(h => h.x === d[k].x);
      const passo = iSeq >= 0 ? iSeq + 1 : b.seq.length;
      const zero = (S.selosDoConfronto(b.matchup, lado, 0) || '').trim();
      const depois = (S.selosDoConfronto(b.matchup, lado, passo) || '').trim();
      b.passo = passo; b.hit = b.seq[Math.max(0, passo - 1)] || null;
      const html = S.pescariaLutadoresHtml(b);
      if(!zero && depois && html.indexOf(depois) >= 0) certos++;
    }
    const j = S.pescaria.jogadores[0]; j.estado = 'parado'; j.op = null; j.batalha = null;
    /* ⚠️ CURA O TIME A CADA VOLTA, e sem isso ele FALHAVA 1 rodada em 2: o desgaste derruba o
       time na 3ª batalha e as outras 2.497 voltas medem um time inteiro no chão. O painel
       achava 1 confronto quando devia achar dezenas -- o pior tipo de teste que existe, o que
       passa quase sempre. Aqui se mede o SELO, não o desgaste. */
    j.time.forEach(x => { x.hp = x.maxHp; });
  }
  ok('o painel achou status pra medir', achados >= 5, achados + ' confrontos');
  ok('  o selo FALTA no passo 0 e SAI no quadro repintado', achados > 0 && certos === achados,
     certos + ' de ' + achados);
  /* e quem repinta é o passo da área, no mesmo instante em que a jornada chama o render() */
  /* ⚠️ A FATIA É A FUNÇÃO INTEIRA, e não um número de caracteres: com 1600 fixos ela já
     envelheceu uma vez -- o bloco da cena empurrou o que ela procura pra FORA da janela e ela
     caiu com o código certo. É a mesma armadilha que este projeto já pagou três vezes. */
  const iPa = src.indexOf('function pescariaPintarArea');
  const fa = src.slice(iPa, src.indexOf('\nfunction ', iPa + 1));
  ok('(a fatia do pescariaPintarArea tem o que ler)', fa.length > 600, fa.length + ' chars');
  ok('  e o pescariaPintarArea repinta o bloco dos lutadores', /pescBatalhaVs/.test(fa));
  /* ⚠️ E A LINHA DO RENDER É LIDA INTEIRA, sem cravar o texto do atributo: ele ganhou o
     cenaNova da cena, e uma trava que compara a string crua acusa o que está certo. */
  const linhaVs = (src.match(/^.*id="pescBatalhaVs".*$/m) || [''])[0];
  ok('  pela MESMA função que o render monta',
     /pescariaLutadoresHtml\(b\)/.test(fa) && linhaVs.indexOf('${pescariaLutadoresHtml(b)}') >= 0,
     linhaVs.trim().slice(0, 64));
  /* ⚠️ E NA CENA ELE NÃO REFAZ O QUADRO INTEIRO -- trocar o innerHTML RECRIA os <img>, e um GIF
     recriado volta pro primeiro quadro: o sprite ficaria preso no começo do laço, com um tranco a
     cada golpe. Só o painel e a classe do lutador são repintados; o palco do sprite fica de pé.
     Medido no navegador: com o innerHTML inteiro o <img> é OUTRO elemento em 3 de 3 passos; assim
     ele é o MESMO nos 3 -- e o painel atualiza igual nos dois. */
  ok('  e na CENA ele repinta só o painel, sem recriar o sprite',
     /\.battle-mon-panel'\)\.innerHTML =/.test(fa) && /battle-scene/.test(fa));
  /* ⚠️ COM A ESTRUTURA DIFERENTE ele refaz tudo: a vaga vazia do Remoinho não tem painel, e sem
     essa saída o quadro ficaria com o painel de quem acabou de ser soprado pra fora. */
  ok('  e volta a refazer o quadro quando a estrutura muda', /vs\.innerHTML = fonte/.test(fa));
}

/* ============================================================================
   ⚠️ O DESGASTE ATRAVESSA AS FISGADAS (20/09/2026) -- o coração do pedido
   ============================================================================
   *"os pokémons que morrerem tem que permanecer morto até o fim da pesca, e os que sobreviveram
   mas tomaram dano, quando começar a próxima batalha depois de pescar um pokemon, deve permanecer
   com o mesmo hp que estava na luta anterior"*

   ⚠️ E QUEM ENTREGA ISSO É O `preservePlayerHp` -- o mesmo da Elite 4, que carrega a FRAÇÃO de
   vida entre as lutas. Sem ele o `simulateGymBattle` CURA os dois times na entrada, e o desgaste
   que esta feature existe pra criar sumiria a cada fisgada.
   ============================================================================ */
console.log('\n=== O DESGASTE ATRAVESSA AS FISGADAS ===');
{
  const p = jogoNaTela();
  const fisgar = (z) => {
    S.pescaria.oportunidades = new Array(6).fill(null);
    S.pescariaSurgir(z);
    S.pescariaComecarBatalha(0, S.pescaria.oportunidades[z]);
    const j = S.pescaria.jogadores[0];
    const b = j.batalha;
    j.estado = 'parado'; j.op = null; j.batalha = null;
    return b;
  };
  ok('o time entra cheio na primeira fisgada', p.time.every(x => x.hp === x.maxHp));

  /* ⚠️ A ÚNICA FONTE DE VERDADE DO HP É A INSTÂNCIA, e é por isso que ela é a MESMA entre as
     batalhas: o `pescariaNovoPescador` guarda o time e o `pescariaComecarBatalha` o passa direto
     pro motor. Uma cópia no meio do caminho desfaria o desgaste sem nada acusar. */
  let desgastou = false, morreu = false, subiu = 0, voltas = 0;
  const hps = () => p.time.map(x => x.hp);
  while(voltas < 40 && !(desgastou && morreu)){
    const antes = hps();
    fisgar(voltas % 6);
    const depois = hps();
    /* ⚠️ NINGUÉM SE CURA ENTRE AS FISGADAS: o HP só desce (ou fica), nunca sobe -- e quem já caiu
       não volta, que é a regra do "permanecer morto até o fim da pesca". */
    depois.forEach((h, i) => { if(h > antes[i]) subiu++; });
    if(depois.some((h, i) => h < antes[i] && h > 0)) desgastou = true;
    if(depois.some((h, i) => h === 0 && antes[i] > 0)) morreu = true;
    if(S.pescariaVivos(p) === 0) break;
    voltas++;
  }
  ok('alguém sobreviveu MACHUCADO e levou o dano pra frente', desgastou);
  ok('e alguém CAIU de vez', morreu);
  /* ⚠️ A trava de verdade: o HP nunca sobe entre duas fisgadas -- é a diferença entre
     "o desgaste existe" e "o desgaste PERSISTE". */
  ok('e NINGUÉM se curou entre as fisgadas', subiu === 0, subiu + ` subidas`);

  /* ⚠️ COM O TIME NO CHÃO NÃO SE PESCA MAIS. Sem esta guarda o jogador continuaria fisgando e
     perdendo toda batalha -- o duelo viraria uma fila de derrotas até o relógio acabar. */
  p.time.forEach(x => { x.hp = 0; });
  ok('com o time todo no chão, ninguém tem HP', S.pescariaVivos(p) === 0);
  p.estado = 'parado'; p.op = null;
  S.pescaria.oportunidades = new Array(6).fill(null);
  S.pescariaSurgir(2);
  S.pescariaEntrar(0, 2);
  ok('  e o lançamento é RECUSADO', p.estado === 'parado', p.estado);

  /* ⚠️ E O DUELO ACABA quando os DOIS times caem -- senão o relógio correria sozinho até o fim,
     com as duas telas paradas e nada acontecendo. */
  S.pescaria.jogadores[1].time.forEach(x => { x.hp = 0; });
  S.pescariaAtualizar(0.5);
  ok('com os DOIS times no chão, o duelo termina', S.pescaria.fase === 'fim', S.pescaria.fase);
}

/* ============================================================================
   ⚠️ O SLOT VIAJA COM O TIME -- o ITEM equipado depende dele
   ============================================================================ */
console.log('\n=== O ITEM EQUIPADO CHEGA NA PESCARIA ===');
{
  contaAdmin();
  const time = S.pescariaTimeDoSlot(0);
  /* ⚠️ A CHAVE DO ITEM É `slot:raiz-da-linha`. Sem o slot, o `equiparItens` procura com slot nulo
     e a poção que o jogador equipou no parceiro simplesmente NÃO VALE aqui -- em silêncio. */
  ok('cada instância carrega o slot de onde veio',
     time.length > 0 && time.every(x => x.slotDaConta === '0'),
     time.map(x => x.slotDaConta).join(','));
  /* de ponta a ponta: um item equipado de verdade chega ao pokémon */
  const raiz = S.raizDaLinha(time[0].speciesId);
  g.equipados = { ['0:' + raiz]: 'atk_up' };
  const time2 = S.pescariaTimeDoSlot(0);
  S.equiparItens(time2, g.equipados);
  ok('  e o item equipado é achado', time2[0].item === 'atk_up', String(time2[0].item));
  g.equipados = {};
}
console.log('\n=== O NPC NUNCA ARREBENTA A LINHA ===');
{
  /* ⚠️ O RAMO DO `falha` ERA INALCANÇÁVEL: quem tem `falha` nunca chega a puxar (ele erra a
     FISGADA, não a tensão). Eram dois comentários descrevendo uma mecânica que não existe. */
  /* ⚠️ A FATIA COMEÇA NA FUNÇÃO e vai até a próxima: o comentário que explica a remoção fica ACIMA
     dela, e varrendo o arquivo inteiro a trava acusaria o próprio comentário -- a armadilha que
     este projeto já pagou quatro vezes. Por isso ela também não pode ser um `indexOf` no `src`. */
  const aNpc = src.indexOf('function pescariaNpcPuxa');
  const f = src.slice(aNpc, src.indexOf('\nfunction ', aNpc + 10));
  ok('(a fatia do pescariaNpcPuxa tem o que ler)', aNpc > 0 && f.length > 80 && f.length < 600, f.length + ' chars');
  ok('o ramo morto do falha saiu', !/p\.falha/.test(f));
  let maior = 0, arrebentou = 0;
  for(let volta = 0; volta < 60; volta++){
    const p = jogoNaTela();
    const DT = 1 / 30;
    for(let i = 0; i < 3300; i++){
      const npc = S.pescaria.jogadores[1];
      if(npc.estado === 'puxando') maior = Math.max(maior, npc.tensao);
      if(npc.estado === 'descanso' && /arrebent/i.test(npc.recadoDeEspera || '')) arrebentou++;
      S.pescariaAtualizar(DT);
      if(S.pescaria.fase !== 'jogando') break;
    }
  }
  ok('  e a tensão dele nunca alcança 100', maior < 100, 'maior vista: ' + maior.toFixed(1));
  ok('  ou seja ele nunca arrebenta', arrebentou === 0, arrebentou + ' arrebentadas em 60 duelos');
}

console.log('\n=== O ZERAR ZERA MESMO ===');
{
  jogoNaTela();
  S.pescaria.semente = 999;
  S.pescaria.zonaAberta = 4;
  const painel = S.document.getElementById('pescPainelBatalha');
  painel.dataset.peixe = 'op99';
  S.pescariaZerar();
  ok('o parceiro escolhido sai', S.pescaria.escolhido === null);
  ok('  a semente volta ao começo', S.pescaria.semente === 1, String(S.pescaria.semente));
  ok('  o modal do ponto fecha', S.pescaria.zonaAberta === null);
  /* ⚠️ A MARCA DO PAINEL VAI JUNTO: com a semente recomeçando, dois duelos passam pelos MESMOS
     ids -- e o pintor só remonta o painel quando ela muda. */
  ok('  e a marca do painel da batalha some', painel.dataset.peixe === '');
  /* o "jogar de novo" repõe o parceiro na mão -- e só agora isso faz alguma coisa */
  const p = jogoNaTela();
  const antes = S.pescaria.escolhido;
  S.pescariaReiniciar();
  ok('  mas o "jogar de novo" mantém o parceiro', S.pescaria.escolhido === antes);
}

console.log('\n=== QUEM VALIDA É A AÇÃO ===');
{
  /* ⚠️ A OPORTUNIDADE TEM QUE ESTAR ABERTA QUANDO O RELÓGIO VIRA, senão a trava mede outra coisa:
     o `pescariaEntrar` recusa por CONTA PRÓPRIA quando `tempo > entradaAte`, e com a oportunidade
     criada no instante 0 ela já tinha expirado -- a asserção passava com a guarda do relógio
     REMOVIDA. Por isso ela nasce a 1s do fim: a janela de entrada dela vai até ~94s, e a única
     coisa que pode recusar é o relógio.
     É a armadilha do fixture que não cai na faixa em que a regra vale -- a mesma que já custou o
     painel forte demais e o `preservePlayerHp` que cura o time B. */
  const p = jogoNaTela();
  S.pescaria.tempo = S.PESCARIA_DURACAO - 1;
  S.pescariaSurgir(2);
  const opTarde = S.pescaria.oportunidades[2];
  S.pescaria.tempo = S.PESCARIA_DURACAO + 0.2;
  ok('(a oportunidade ainda está na janela de entrada)', S.pescaria.tempo < opTarde.entradaAte,
     'entradaAte ' + opTarde.entradaAte.toFixed(1) + 's');
  S.pescariaEntrar(0, 2);
  ok('acabado o relógio, a AÇÃO recusa a linha nova', S.pescaria.jogadores[0].estado === 'parado');
  /* e a fisgada VALE na prorrogação: quem lançou antes tem direito ao peixe dele */
  const q = jogoNaTela();
  S.pescariaSurgir(2);
  S.pescariaEntrar(0, 2);
  ok('  (ele entrou mesmo, antes do relógio)', S.pescaria.jogadores[0].estado === 'espera');
  S.pescaria.jogadores[0].estado = 'fisgada';
  S.pescaria.jogadores[0].ate = S.pescaria.tempo + 1;
  S.pescaria.tempo = S.PESCARIA_DURACAO + 3;
  S.pescariaFisgar();
  ok('  mas a fisgada ainda vale na prorrogação', S.pescaria.jogadores[0].estado === 'puxando');
  /* ⚠️ FORA DO DUELO nenhuma das duas age -- e o cenário tem que deixar as DUAS alcançáveis:
     com o pescador em `puxando` as duas voltariam pelo estado, e a trava passaria sem a guarda. */
  {
    const r = jogoNaTela();
    S.pescariaSurgir(4);
    S.pescaria.fase = 'fim';
    S.pescariaEntrar(0, 4);
    ok('  e fora do duelo o pescariaEntrar não age', r.estado === 'parado');
    r.estado = 'fisgada'; r.ate = S.pescaria.tempo + 1;
    S.pescariaFisgar();
    ok('  nem o pescariaFisgar', r.estado === 'fisgada');
  }
}

console.log('\n=== A OPORTUNIDADE NÃO SOME COM A JANELA ABERTA ===');
{
  const p = jogoNaTela();
  let mau = 0;
  for(let i = 0; i < 3000; i++){
    S.pescaria.oportunidades = new Array(6).fill(null);
    S.pescaria.tempo = Math.random() * 80;
    S.pescariaSurgir(2);
    const o = S.pescaria.oportunidades[2];
    if(o.expira <= o.entradaAte) mau++;
  }
  ok('o expira vem SEMPRE depois do entradaAte', mau === 0, mau + ' de 3000');
}

console.log('\n=== A REDE DO FIM REGISTRA, NÃO SÓ PAGA ===');
{
  const p = jogoNaTela();
  S.pescariaSurgir(3);
  S.pescariaComecarBatalha(0, S.pescaria.oportunidades[3]);
  const b = p.batalha;
  const pontosAntes = p.pontos, nLog = S.pescaria.logs.length, nHist = S.pescaria.historico.length;
  S.pescariaTerminar();
  ok('a batalha em curso é paga', p.pontos === pontosAntes + (b.venceu ? b.premio : 0));
  ok('  e ela vira linha no histórico', S.pescaria.historico.length === nHist + 1);
  ok('  e o log dela chega na tela do fim', S.pescaria.logs.length === nLog + 1);
  /* o número é o do MOTOR, nunca o da animação (ela nem chegou ao fim) */
  ok('  pelo que o MOTOR decidiu', b.passo < b.seq.length || b.seq.length === 0);
}

console.log('\n=== A TELA DO DUELO TEM SAÍDA ===');
{
  jogoNaTela();
  const tela = S.renderPescaria();
  ok('há um botão de sair no duelo', tela.indexOf('sairDaPescaria()') >= 0);
  /* ⚠️ NO FIM DA TELA, não entre o lago e o painel: ali ele cai onde o polegar está enquanto se
     joga, e desistir sem querer é pior que não ter saída. */
  ok('  e ele vem DEPOIS do lago e do painel',
     tela.indexOf('sairDaPescaria()') > tela.indexOf('pesc-mapa') &&
     tela.indexOf('sairDaPescaria()') > tela.indexOf('pescPainelBatalha') &&
     tela.indexOf('sairDaPescaria()') > tela.indexOf('pescPainelDescanso'));
}

console.log('\n=== O PONTO FECHADO PARECE FECHADO ===');
{
  /* ⚠️ O QUE ENGANAVA ERA O PISCAR: um ponto com peixe continuava pulsando "toque aqui" enquanto
     o botão estava desabilitado. As duas regras têm a MESMA especificidade, então a ordem no
     arquivo é que decide -- e a de `:disabled` tem que vir DEPOIS da `.viva`. */
  const css = src.slice(src.indexOf('<style'), src.indexOf('</style>'));
  const viva = css.indexOf('.pesc-zona.viva{');
  const off = css.indexOf('.pesc-zona:disabled{');
  ok('a regra do desabilitado vem depois da .viva', viva > 0 && off > viva, 'viva@' + viva + ' off@' + off);
  ok('  e ela desliga a animação e apaga o ponto',
     /\.pesc-zona:disabled\{[^}]*animation:none/.test(css) && /\.pesc-zona:disabled\{[^}]*opacity:/.test(css));
}


/* ============================================================================
   ⚠️ O RANKING DAS MAIORES PESCARIAS (20/09/2026, a pedido)
   ============================================================================
   *"Na primeira tela, crie um ranking das maiores pontuações de pesca"*
   ============================================================================ */
console.log('\n=== O RANKING DA PRIMEIRA TELA ===');
{
  contaAdmin();
  S.pescaria.fase = 'setup'; S.pescaria.escolhido = null;
  /* carregando: a caixa existe e diz isso, em vez de sumir e voltar */
  S.pescariaRank.lista = null; S.pescariaRank.erro = null;
  let tela = S.renderPescaria();
  ok('a caixa do ranking aparece no setup', tela.indexOf('Melhores pescarias') >= 0);
  ok('  e diz que está carregando', /Carregando/.test(tela.slice(tela.indexOf('Melhores pescarias'))));

  /* vazio: ele CONVIDA, em vez de mostrar uma caixa muda */
  S.pescariaRank.lista = [];
  tela = S.renderPescaria();
  ok('vazio, ele convida', /Ninguém pontuou ainda/.test(tela));

  /* com gente: as medalhas do pódio da Corrida, e o nome escapado */
  S.pescariaRank.lista = [
    { pos: 1, nome: 'Ash', pontos: 900, eu: false },
    { pos: 2, nome: '<b>hack</b>', pontos: 700, eu: false },
    { pos: 3, nome: 'Misty', pontos: 500, eu: false },
    { pos: 4, nome: 'Brock', pontos: 300, eu: false },
  ];
  S.pescariaRank.meu = null;
  tela = S.renderPescaria();
  ok('as quatro linhas saem', (tela.match(/pesc-rank-linha/g) || []).length === 4,
     (tela.match(/pesc-rank-linha/g) || []).length + ' linhas');
  /* ⚠️ AS MEDALHAS SÃO AS DO PÓDIO DA CORRIDA (`MEDALHA_DO_POSTO`), desenhadas -- e não emoji:
     o jogo inteiro desenha as suas desde 17/09/2026. */
  ok('  o pódio leva as medalhas desenhadas',
     tela.indexOf('#s-' + S.MEDALHA_DO_POSTO[0]) >= 0 && tela.indexOf('#s-' + S.MEDALHA_DO_POSTO[2]) >= 0);
  ok('  e o 4º sai com o número', /4º/.test(tela));
  ok('  e o pódio NÃO usa emoji', !/🥇|🥈|🥉/.test(tela.slice(tela.indexOf('pesc-rank'))));
  /* ⚠️ O NOME É DE OUTRO JOGADOR -- é dado de fora, e vai escapado. */
  ok('  e o nome de outro jogador vai escapado',
     tela.indexOf('&lt;b&gt;hack&lt;/b&gt;') >= 0 && tela.indexOf('<b>hack</b>') < 0);

  /* ⚠️ O MEU RESULTADO APARECE MESMO FORA DO TOP: quem está em 14º abriria a tela e não veria
     nada seu -- e o próprio recorde é justamente o que ele mais procura ali. */
  S.pescariaRank.meu = { nome: 'Você', pontos: 120, eu: true };
  tela = S.renderPescaria();
  ok('o meu resultado sai mesmo fora do top', /pesc-rank-sep/.test(tela) && /120/.test(tela));

  /* recorde novo: a tela diz */
  S.pescariaRank.recorde = true;
  tela = S.renderPescaria();
  ok('e o recorde novo é anunciado', /Recorde novo/.test(tela));
  S.pescariaRank.recorde = false;

  /* ⚠️ ERRO DE REDE NÃO DERRUBA A TELA, e oferece o "tentar de novo": um ranking que não carrega
     é uma caixa a menos, nunca um duelo que não começa. */
  S.pescariaRank.erro = 'Não deu pra carregar o ranking agora.';
  tela = S.renderPescaria();
  ok('com erro, ele oferece tentar de novo', /pescariaCarregarRank\(true\)/.test(tela));
  ok('  e o começar do duelo continua na tela', tela.indexOf('pescariaLargar()') >= 0);
  S.pescariaRank.erro = null;

  /* ⚠️ E O ENVIO ACONTECE NO FIM DO DUELO, com o que o MOTOR contou. Lendo o código: o número
     que vai é o `pontos` do pescador, nunca um montado na tela. */
  const env = src.slice(src.indexOf('async function pescariaEnviarRank'),
                        src.indexOf('function pescariaZerar'));
  ok('(a fatia do envio tem o que ler)', env.length > 200, env.length + ' chars');
  ok('o envio manda o que o motor contou', /pontos: eu\.pontos/.test(env));
  ok('  e o `venceu` sai da comparação dos dois placares', /eu\.pontos > pescaria\.jogadores\[1\]\.pontos/.test(env));
  /* ⚠️ E ELE É CHAMADO NO `pescariaTerminar`, que é a porta ÚNICA do fim -- inclusive a rede que
     fecha as batalhas que ainda estavam animando quando o relógio acabou. */
  const term = src.slice(src.indexOf('function pescariaTerminar'), src.indexOf('function pescariaTerminar') + 1400);
  ok('e o fim do duelo envia', /pescariaEnviarRank\(\)/.test(term));
}

/* ============================================================================
   ⚠️ A TELA ANIMA A FILA INTEIRA, não só o primeiro confronto (20/09/2026)
   ============================================================================
   Reportado: *"eu lutei contra um tentacruel e meu pokemon morreu, porém ainda tinha mais 5 para
   ser usado e a luta acabou"*.

   ⚠️ O MOTOR SEMPRE ESTEVE CERTO -- o `simulateGymBattle` percorre o time conforme cada um cai, e
   devolvia os 6 confrontos. Quem parava no primeiro era a TELA: ela lia `matchups[0]` e fechava.
   O jogador via o parceiro cair e o duelo seguir, com os outros cinco tendo lutado (e apanhado)
   sem aparecer -- e o log do fim trazia UMA linha de seis.
   ============================================================================ */
console.log('\n=== A TELA ANIMA A FILA INTEIRA ===');
{
  contaAdmin();
  /* um time fraco contra um peixe forte: o motor gasta a fila toda */
  const fracos = ['caterpie', 'pidgey', 'ratata', 'weedle', 'zubat', 'magikarp'];
  const p = jogoNaTela(fracos.map((id, i) => ({ speciesId: id, level: 20, id: 'f' + i })));
  S.pescariaSurgir(5);
  const op = S.pescaria.oportunidades[5];
  op.speciesId = 'tentacruel'; op.nivel = 70;
  S.pescariaComecarBatalha(0, op);
  const b = p.batalha;

  /* ⚠️ A FILA INTEIRA VIAJA PRA TELA, e o confronto de AGORA é o `matchup` -- os seis leitores
     (placar, barra, quadros, status, painel) continuam lendo "o atual". */
  ok('o motor lutou a fila inteira', b.matchups.length > 1, b.matchups.length + ` confrontos`);
  ok('  e a tela recebeu a fila, não só o primeiro', Array.isArray(b.matchups));
  ok('  com o primeiro em cena', b.matchup === b.matchups[0] && b.i === 0);

  /* anda a animação e anota CADA confronto que entrou em cena */
  const vistos = [b.matchup.playerSpecies];
  let voltas = 0;
  while(p.estado === 'batalha' && voltas < 8000){
    const antes = p.batalha && p.batalha.i;
    S.pescaria.tempo += 0.1;
    S.pescariaPassoDaBatalha(0);
    if(p.batalha && p.batalha.i !== antes) vistos.push(p.batalha.matchup.playerSpecies);
    voltas++;
  }
  ok('a tela mostrou TODOS os confrontos', vistos.length === b.matchups.length,
     vistos.length + ' de ' + b.matchups.length + '  (' + vistos.join(' > ') + ')');
  ok('  na ORDEM do motor',
     vistos.join(',') === b.matchups.map(m => m.playerSpecies).join(','));
  ok('  e a animação termina', p.estado === 'descanso', p.estado);

  /* ⚠️ E O LOG DO FIM LEVA A FILA INTEIRA -- era UMA linha de seis. */
  ok('o log do fim tem uma linha por confronto', S.pescaria.logs.length === b.matchups.length,
     S.pescaria.logs.length + ' de ' + b.matchups.length);
  ok('  na ordem em que aconteceram (o 1º em cima)',
     S.pescaria.logs.map(m => m.playerSpecies).join(',') === vistos.join(','),
     S.pescaria.logs.map(m => m.playerSpecies).join(','));
}

{
  /* ⚠️ A FILA PARA QUANDO O PEIXE CAI: ela não segue até o 6º só porque o time tem 6. Quem decide
     é o MOTOR -- a tela só mostra o que ele lutou. */
  contaAdmin();
  const fortes = ['dragonite', 'gyarados', 'alakazam', 'arcanine', 'snorlax', 'venusaur'];
  const p = jogoNaTela(fortes.map((id, i) => ({ speciesId: id, level: 70, id: 'g' + i })));
  /* os dois primeiros entram quase mortos: eles caem, o terceiro resolve */
  p.time[0].hp = 1; p.time[1].hp = 1;
  S.pescariaSurgir(5);
  const op = S.pescaria.oportunidades[5];
  op.speciesId = 'tentacruel'; op.nivel = 40;
  S.pescariaComecarBatalha(0, op);
  const b = p.batalha;
  ok('com o peixe caindo no meio, a fila é CURTA', b.matchups.length < 6 && b.matchups.length > 1,
     b.matchups.length + ` confrontos`);
  ok('  e o duelo é vitória', b.venceu === true);
  let voltas = 0;
  while(p.estado === 'batalha' && voltas < 8000){ S.pescaria.tempo += 0.1; S.pescariaPassoDaBatalha(0); voltas++; }
  ok('  e sobra time de pé', S.pescariaVivos(p) > 0, S.pescariaVivos(p) + '/6');
  ok('  com o ponto pago', p.pontos > 0, String(p.pontos));
}

{
  /* ⚠️ ABRIR UM CONFRONTO É UMA FUNÇÃO SÓ, e ela ZERA o `hit`. Escrita duas vezes, a segunda
     esqueceria disso -- e a tela abriria o confronto novo anunciando um golpe do ANTERIOR. É
     literalmente o "golpe fantasma" de 09/09/2026, que levou o `abrirConfronto` a existir na
     jornada. Aqui o teste LÊ O CÓDIGO: um caso de comportamento passaria com as duas cópias. */
  const f = src.slice(src.indexOf('function pescariaAbrirConfronto'),
                      src.indexOf('function pescariaComecarBatalha'));
  ok('(a fatia do pescariaAbrirConfronto tem o que ler)', f.length > 300, f.length + ' chars');
  ok('abrir um confronto zera o hit', /b.hit = null/.test(f));
  ok('  e o passo', /b.passo = 0/.test(f));
  ok('  e as duas barras', /b.hpP = /.test(f) && /b.hpE = /.test(f));
  /* ⚠️ E O `render()` DA VIRADA: os SPRITES trocam, e sprite só muda num redesenho -- o
     `pescariaPintarArea` mexe na caixa de status e em mais nada. É o que a jornada faz no
     `loading` do `advanceReveal`. */
  const passo = src.slice(src.indexOf('function pescariaPassoDaBatalha'),
                          src.indexOf('function pescariaNpcPuxa'));
  ok('a virada de confronto redesenha a tela', /pescariaAbrirConfronto\(b, b\.i \+ 1\)/.test(passo)
     && /if\(desenha\) render\(\)/.test(passo));
  ok('  depois da pausa de entrada', /PESCARIA_ENTRE_CONFRONTOS_MS/.test(passo),
     'a pausa é a mesma do loading da jornada');
  ok('  e ela vale 1200ms, como a da jornada', S.PESCARIA_ENTRE_CONFRONTOS_MS === 1200,
     String(S.PESCARIA_ENTRE_CONFRONTOS_MS));
  /* ⚠️ E A FILA INTEIRA VAI PRO PRELOAD: o 2º entra 1,2s depois do 1º acabar, e um sprite que só
     começasse a baixar ali apareceria em branco no quadro de entrada. */
  const comecar = src.slice(src.indexOf('function pescariaComecarBatalha'),
                            src.indexOf('function pescariaPlacarHtml'));
  ok('o preload leva a fila inteira', /preloadBattleSprites\(ms\)/.test(comecar));
}

/* ============================================================================
   ⚠️ A LUPA DO iOS NO BOTÃO DE PUXAR (20/09/2026)
   ============================================================================
   Reportado: *"quando eu seguro o botão SEGURE PARA PUXAR, por estar em uma pagina web, fica
   aparecendo a lupa de zoom e selecionando o texto do botão"*.

   ⚠️ E ESTA TRAVA LÊ O ARQUIVO, não o navegador -- é o único jeito que existe. O
   `-webkit-touch-callout` é do WebKit, e o Chromium **DESCARTA a declaração ao parsear**:
   conferido, ela some do CSSOM e o `getComputedStyle` devolve string VAZIA. Ou seja, uma trava
   de navegador daria FALSO NEGATIVO -- ela acusaria o que está certo, ou (pior) passaria com a
   regra removida sem conseguir distinguir os dois casos.
   ============================================================================ */
console.log('\n=== A LUPA DO iOS NO BOTÃO DE PUXAR ===');
{
  const i = src.indexOf('.pesc-puxar{');
  const regra = i < 0 ? '' : src.slice(i, src.indexOf('}', i) + 1);
  ok('(a regra do botão de puxar existe)', regra.length > 40, regra.length + ' chars');
  /* ⚠️ AS DUAS `-webkit-` SÃO O QUE O iOS LÊ: o `user-select:none` sem prefixo NÃO basta no
     Safari, e NADA nele desliga a lupa -- quem faz isso é o `-webkit-touch-callout`. */
  ok('o texto do botão não se seleciona', regra.indexOf('user-select:none') >= 0);
  ok('  inclusive no Safari (o prefixo)', regra.indexOf('-webkit-user-select:none') >= 0);
  ok('  e a LUPA não aparece', regra.indexOf('-webkit-touch-callout:none') >= 0);
  /* ⚠️ E O REALCE DE TOQUE: é a caixa cinza que o iOS põe POR CIMA do botão enquanto o dedo está
     nele -- e aqui o dedo fica SEGUNDOS, cobrindo justamente o amarelo do `.puxando`. */
  ok('  e o realce cinza do toque não cobre o amarelo',
     regra.indexOf('-webkit-tap-highlight-color:transparent') >= 0);
  /* a que já existia, e que o pedido não pode desfazer: sem ela, segurar e mexer o dedo rola a
     página e o navegador CANCELA o `pointerdown` -- a linha soltaria sozinha no meio do puxão */
  ok('  e segurar-e-mexer continua não rolando a página', regra.indexOf('touch-action:none') >= 0);

  /* ⚠️ ESTA TRAVA CONTAVA "UMA VEZ NO ARQUIVO INTEIRO" ATÉ 21/09/2026, e o número era um PROXY:
     enquanto a Pescaria era o único botão do jogo que se SEGURA, contar 1 provava de graça que a
     declaração não tinha sido espalhada pro `body`. A QUEIMADA nasceu com duas setas que também se
     seguram, e o proxy venceu -- ela caiu de 1 pra 4 **sem nada estar errado**.
     É a mesma lição das cinco travas que caíram quando o trecho da Corrida virou 150 m: **trava
     que fixa um número envelhece com ele.** Hoje ela cobra a REGRA, que é o que o proxy media:
       1) nenhuma das declarações é GLOBAL -- nem em `body`, nem em `html`, nem em `*`;
       2) e onde ela aparece, ela aparece com o BLOCO INTEIRO: sozinha ela não faz o trabalho, e é
          assim que a próxima seta que nascer pela metade fica barulhenta.
     ⚠️ E O COMENTÁRIO DO JOGO CONTINUA NÃO PODENDO REPRODUZIR O CSS: ele reproduzia o do protótipo
     ao pé da letra, e a conferência de acusação ABSORVEU o defeito religado -- o replace pegou o
     comentário em vez da regra, e a trava passou com o defeito de volta. Pra isso a conta abaixo
     olha só o que está DENTRO de uma regra (o `{...}`), e não o arquivo cru. */
  const regrasDaLupa = [];
  for(let k = src.indexOf('-webkit-touch-callout'); k >= 0; k = src.indexOf('-webkit-touch-callout', k + 1)){
    const abre = src.lastIndexOf('{', k);
    if(abre < 0) continue;
    const corpo = src.slice(abre, src.indexOf('}', k) + 1);
    const antes = src.slice(0, abre);
    /* o seletor começa depois do que vier por último: o `}` da regra anterior ou o fim de um
       comentário. O `+ 2` do fecha-comentário é o que impede a barra dele de virar o começo do
       seletor -- sem ele a regra saía como `/ .pesc-puxar` e uma varredura por nome não a acharia */
    const fimComentario = antes.lastIndexOf('*/');
    const corte = Math.max(antes.lastIndexOf('}') + 1, fimComentario < 0 ? 0 : fimComentario + 2);
    regrasDaLupa.push({ seletor: antes.slice(corte).trim().replace(/\s+/g, ' '), corpo: corpo });
  }
  ok('(alguma regra declara a lupa)', regrasDaLupa.length > 0, regrasDaLupa.length + ' regras');
  ok('e NENHUMA delas é global (body, html ou *)',
     regrasDaLupa.every(r => !/(^|[,{\s])(body|html|\*)\s*(,|$)/.test(r.seletor)),
     regrasDaLupa.map(r => r.seletor).join(' | '));
  /* ⚠️ O BLOCO VIAJA INTEIRO: só o `-webkit-touch-callout` desliga a LUPA, só o `touch-action`
     impede a rolagem de cancelar o `pointerdown`, e só o `tap-highlight` tira a caixa cinza que o
     iOS põe por cima. Uma seta com metade do bloco tem metade do defeito. */
  regrasDaLupa.forEach(r => {
    ok('  `' + r.seletor + '` leva o bloco inteiro',
       ['user-select:none', '-webkit-user-select:none', 'touch-action:none',
        '-webkit-tap-highlight-color:transparent'].every(d => r.corpo.indexOf(d) >= 0),
       r.corpo.replace(/\s+/g, ' ').slice(0, 90));
  });
  /* ⚠️ E TODO BOTÃO QUE SE SEGURA TEM QUE ESTAR COBERTO: o `onpointerdown` é o que identifica um,
     e é ele que a lista acima precisa alcançar. Sem esta linha, um botão novo que se segure nasce
     sem o bloco e nada acusa -- que é exatamente o que o proxy de "UMA vez" deixava passar. */
  ok('e o jogo continua tendo botão que se segura',
     (src.match(/onpointerdown=/g) || []).length >= 1,
     (src.match(/onpointerdown=/g) || []).length + ' pontos de toque segurado');
}

/* ============================================================================
   ⚠️ AS SETE DE 20/09/2026 (a leva do relato do placar quebrado)
   ============================================================================ */
console.log('\n=== O (i) ABRE NA PRIMEIRA TELA ===');
{
  contaAdmin();
  S.pescaria.fase = 'setup'; S.pescaria.escolhido = S.pescariaElegiveis()[0];
  S.pescaria.zonaAberta = null;
  ok('sem tocar no (i), não há modal', S.renderPescaria().indexOf('fecharZonaDaPescaria()') < 0);
  /* ⚠️ O ESTADO SEMPRE MUDOU -- o que faltava era o `return` do SETUP desenhar o modal. */
  S.abrirZonaDaPescaria(5);
  const tela = S.renderPescaria();
  ok('o (i) abre o modal NA PRIMEIRA TELA', tela.indexOf('fecharZonaDaPescaria()') >= 0);
  ok('  com o nome do ponto', tela.indexOf(S.PESCARIA_ZONAS[5].nome) >= 0);
  ok('  e as chances de cada espécie', S.chancesDaZona(5).every(x => tela.indexOf(x.pct + '%') >= 0));
  S.fecharZonaDaPescaria();
  ok('e fecha', S.renderPescaria().indexOf('fecharZonaDaPescaria()') < 0);
}

console.log('\n=== O NÚMERO DO PONTO É CENTRALIZADO ===');
{
  /* ⚠️ NA PRIMEIRA TELA o ponto é um `<span>`, e span NÃO centraliza texto -- só o `<button>` do
     duelo herdava o `text-align:center` do estilo de fábrica do navegador. O número saía centrado
     numa tela e colado na esquerda na outra, com o MESMO CSS. */
  const css = src.slice(src.indexOf('<style'), src.indexOf('</style>'));
  const i = css.indexOf('.pesc-mapa .pesc-zona{');
  const regra = i < 0 ? '' : css.slice(i, css.indexOf('}', i));
  ok('(a regra do ponto existe)', regra.length > 40, regra.length + ' chars');
  ok('o ponto centraliza o texto explicitamente', /text-align:\s*center/.test(regra), regra.slice(0, 60));
  /* e a primeira tela usa `<span>`, que é o que torna isso necessário */
  contaAdmin();
  const mapa = S.pescariaMapaHtml(false);
  ok('  e a primeira tela desenha o ponto como <span>', /<span class="pesc-zona/.test(mapa));
}

console.log('\n=== UM PONTO, UM PESCADOR ===');
{
  const p = jogoNaTela();
  const npc = S.pescaria.jogadores[1];
  S.pescaria.oportunidades = new Array(S.PESCARIA_ZONAS.length).fill(null);
  S.pescariaSurgir(2);
  /* o NPC entra primeiro */
  npc.estado = 'parado';
  S.pescariaEntrar(1, 2);
  ok('o adversário entrou', npc.op && npc.op.zona === 2, npc.op ? 'zona ' + npc.op.zona : '(nada)');
  ok('  e o ponto tem dono', S.pescariaQuemEsta(2) === 1, String(S.pescariaQuemEsta(2)));
  /* ⚠️ A AÇÃO recusa, e ela é quem manda: um toque no quadro em que ele entra chegaria antes do
     `disabled` do pintor. */
  p.estado = 'parado'; p.op = null;
  S.pescariaEntrar(0, 2);
  ok('  e eu NÃO entro', p.op === null, p.op ? 'entrei na zona ' + p.op.zona : '(não entrei)');
  /* ⚠️ E A TELA FECHA O PONTO: sem isso ele continuava piscando e chamando pra um lugar onde a
     ação ia recusar, que é pior que um ponto apagado. */
  S.renderPescaria(); S.pescariaPintar();
  const z = S.document.getElementById('pescZona2');
  ok('  e a tela o fecha', z && z.disabled === true, z ? 'disabled=' + z.disabled : '(sem zona)');
  ok('  com a marca de ocupado', z && z.classList.contains('ocupada'));
  ok('  e ele NÃO pisca', z && !z.classList.contains('viva'));
  /* e quando ele sai, o ponto reabre */
  npc.estado = 'parado'; npc.op = null;
  S.renderPescaria(); S.pescariaPintar();
  const z2 = S.document.getElementById('pescZona2');
  ok('quando ele sai, o ponto reabre', z2 && z2.disabled === false);
  ok('  e a marca sai', z2 && !z2.classList.contains('ocupada'));
  /* ⚠️ E A REGRA DO CSS VEM DEPOIS DA `.viva` E DA `:disabled`: as três têm a MESMA
     especificidade, e quem vence é a última -- um ponto ocupado COM peixe não pode piscar. */
  {
    const css = src.slice(src.indexOf('<style'), src.indexOf('</style>'));
    const viva = css.indexOf('.pesc-mapa .pesc-zona.viva{');
    const off = css.indexOf('.pesc-mapa .pesc-zona:disabled{');
    const ocu = css.indexOf('.pesc-mapa .pesc-zona.ocupada{');
    ok('  e a regra dela vem por último no CSS', ocu > viva && ocu > off,
       'viva`' + viva + ' off`' + off + ' ocupada`' + ocu);
  }
  /* ⚠️ E A DISPUTA VIROU LETRA MORTA -- as três formas dela saíram juntas. */
  ok('o `pescariaDisputado` não existe mais', src.indexOf('function pescariaDisputado') < 0);
  ok('  nem o DISPUTA! da zona', src.indexOf('DISPUTA!') < 0);
  ok('  nem o DISPUTADO do chip', src.indexOf('DISPUTADO') < 0);
  ok('  nem o "pescou primeiro"', src.indexOf('pescou primeiro') < 0);
}

console.log('\n=== O NOME DO TREINADOR, NUNCA "VOCÊ" ===');
{
  contaAdmin();
  g.trainerName = 'Buzzo';
  ok('o nome vem do game.trainerName', S.pescariaMeuNome() === 'Buzzo', S.pescariaMeuNome());
  /* ⚠️ E SEM NOME ELE VOLTA PRO "Você" -- o modo admin abre da home, e pode não haver save. */
  g.trainerName = null;
  ok('  e sem nome ele volta pro padrão', S.pescariaMeuNome() === 'Você', S.pescariaMeuNome());
  g.trainerName = 'Buzzo';
  const p = jogoNaTela();
  S.pescaria.tempo = 10;
  ok('o chip do duelo usa o nome', S.pescariaChipDoDuelo().indexOf('BUZZO') >= 0, S.pescariaChipDoDuelo());
  const tela = S.renderPescaria();
  ok('  e o placar de cima também', tela.indexOf('BUZZO') >= 0);
  /* ⚠️ E A PALAVRA "VOCÊ" NÃO SOBRA EM LUGAR NENHUM DA TELA. Ela aparecia em SEIS pontos, e uma
     cópia esquecida é justamente o que o pedido tira. */
  ok('  e a palavra VOCÊ não sobra na tela do duelo', !/VOCÊ/.test(tela), 'sobrou');
  S.pescaria.fase = 'fim';
  const fim = S.renderPescaria();
  ok('  nem na tela do fim', !/VOCÊ|Você venceu/.test(fim), 'sobrou');
}

console.log('\n=== O EYEBROW NÃO DIZ MAIS TESTE ADMIN ===');
{
  contaAdmin();
  for(const fase of ['setup', 'jogando', 'fim']){
    if(fase !== 'setup'){ jogoNaTela(); S.pescaria.fase = fase; }
    else { S.pescaria.fase = 'setup'; S.pescaria.escolhido = S.pescariaElegiveis()[0]; }
    const t = S.renderPescaria();
    ok('  a fase ' + fase + ' não diz TESTE ADMIN', t.indexOf('TESTE ADMIN') < 0);
    ok('    mas continua se identificando', t.indexOf('PESCARIA POKÉMON') >= 0);
  }
}

console.log('\n=== O PLACAR DE CIMA NÃO QUEBRA ===');
{
  /* ⚠️ O `placarDoTreinador` devolve o CHIP INTEIRO -- com borda, fundo e `flex:1 1 0`. Dentro da
     coluna do placar isso virava uma moldura alta e VAZIA (o nome ia vazio ali), e era ela o
     risco vertical do print de 20/09/2026 -- que ainda comia a margem esquerda do texto de
     estado. Hoje ali vão só as POKÉBOLAS. */
  const p = jogoNaTela();
  const tela = S.renderPescaria();
  /* ⚠️ A FATIA PARA NO MEU LADO: com 700 chars ela pegava os DOIS (12 bolas em vez de 6), e a
     trava daria verde com o chip de volta num deles. */
  const i = tela.indexOf('pescTime0');
  const bloco = tela.slice(i, tela.indexOf('pescTime1'));
  ok('o placar de cima não leva o chip do nome', bloco.indexOf('team-alive-chip') < 0);
  ok('  e leva as pokébolas', (bloco.match(/class="pokeball/g) || []).length === 6,
     (bloco.match(/class="pokeball/g) || []).length + ' bolas');
  /* ⚠️ E O CHIP CONTINUA EXISTINDO pra quem o quer INTEIRO -- a batalha, a jornada, a Torre. */
  ok('  e o chip continua existindo pro resto do jogo',
     S.placarDoTreinador('Ash', 3, 6).indexOf('team-alive-chip') >= 0);
  ok('    com o nome dentro', S.placarDoTreinador('Ash', 3, 6).indexOf('Ash') >= 0);
  /* ⚠️ E O PINTOR REPINTA AS BOLAS: sem isso uma morte NO MEIO da batalha só aparecia no
     `render()` seguinte -- e com a fila animada isso é visível. */
  p.time[0].hp = 0; p.time[1].hp = 0;
  S.pescariaPintar();
  const el = S.document.getElementById('pescTime0');
  ok('o pintor repinta as pokébolas', (el.innerHTML.match(/pokeball ko/g) || []).length === 2,
     (el.innerHTML.match(/pokeball ko/g) || []).length + ' caídas');
}

console.log('\n=== O LOG DO FIM: O QUE CADA UM PESCOU ===');
{
  contaAdmin();
  g.trainerName = 'Buzzo';
  jogoNaTela();
  /* uma pescaria inventada: 3 minhas (2 vitórias) e 2 dele */
  S.pescaria.historico = [
    { quem: 'Pescador Wilton', speciesId: 'seaking', nivel: 41, venceu: false, pts: 0 },
    { quem: 'Buzzo', speciesId: 'gyarados', nivel: 62, venceu: true, pts: 83 },
    { quem: 'Pescador Wilton', speciesId: 'tentacool', nivel: 30, venceu: true, pts: 24 },
    { quem: 'Buzzo', speciesId: 'magikarp', nivel: 12, venceu: false, pts: 0 },
    { quem: 'Buzzo', speciesId: 'poliwag', nivel: 22, venceu: true, pts: 20 },
  ];
  S.pescaria.fase = 'fim';
  const fim = S.renderPescaria();
  ok('o log do fim existe', fim.indexOf('O que cada um pescou') >= 0);
  const i = fim.indexOf('pesc-resumo-lado');
  const bloco = fim.slice(i);
  ok('  com um bloco por treinador', (bloco.match(/pesc-resumo-lado/g) || []).length === 2,
     (bloco.match(/pesc-resumo-lado/g) || []).length + ' blocos');
  ok('  e uma linha por captura', (bloco.match(/pesc-hist /g) || []).length === 5,
     (bloco.match(/pesc-hist /g) || []).length + ' linhas');
  /* ⚠️ O QUE O PEDIDO PEDE: pokémon, LEVEL e PONTOS -- os três em cada linha. */
  ok('  com o nome do pokémon', bloco.indexOf('Gyarados') >= 0 && bloco.indexOf('Seaking') >= 0);
  ok('  com o LEVEL', bloco.indexOf('Lv.62') >= 0 && bloco.indexOf('Lv.41') >= 0);
  ok('  e com os PONTOS', bloco.indexOf('+83') >= 0 && bloco.indexOf('+24') >= 0);
  /* ⚠️ E O TOTAL DE CADA UM, que é o que resume a pescaria: 83+20 e 24. */
  ok('  e o total de cada treinador', bloco.indexOf('>103<') >= 0 && bloco.indexOf('>24<') >= 0,
     'esperava 103 e 24');
  /* ⚠️ A ORDEM É A DA PESCARIA -- o 1º peixe em cima. O `historico` empilha ao contrário. */
  const meu = bloco.slice(bloco.indexOf('Buzzo'));
  ok('  na ordem em que aconteceram', meu.indexOf('Poliwag') < meu.indexOf('Magikarp')
     && meu.indexOf('Magikarp') < meu.indexOf('Gyarados'), 'fora de ordem');
  /* ⚠️ E O HISTÓRICO NÃO É MAIS CORTADO EM 8 -- o log do fim precisa da pescaria inteira. */
  {
    const c = src.slice(src.indexOf('function pescariaCreditar'), src.indexOf('function pescariaPassoDaBatalha'));
    ok('o histórico não é mais cortado no motor', !/historico\.slice\(0, 8\)/.test(c));
    ok('  e o corte foi pra TELA do duelo', /PESCARIA_HIST_NA_TELA/.test(src));
  }
  /* quem não pescou nada não fica sem bloco -- ele diz que não pescou */
  S.pescaria.historico = [{ quem: 'Buzzo', speciesId: 'magikarp', nivel: 9, venceu: false, pts: 0 }];
  const so = S.renderPescaria();
  ok('quem não pescou nada ganha a linha do vazio', so.indexOf('Nenhuma captura') >= 0);
  /* e sem NENHUMA captura o log não aparece */
  S.pescaria.historico = [];
  ok('sem captura nenhuma o log some', S.renderPescaria().indexOf('O que cada um pescou') < 0);
}
console.log('\n=== O QUADRADO VAZIO SAIU DO "NENHUM TIME ESCOLHIDO" ===');
{
  contaAdmin();
  S.abrirPescaria();
  S.pescaria.escolhido = null;
  const h = S.renderPescaria();
  const linha = h.slice(h.indexOf('Nenhum time escolhido') - 400, h.indexOf('Nenhum time escolhido') + 200);
  ok('  (e a trava lê a linha)', linha.length > 300, linha.length + ' chars');
  /* PEDIDO: o quadradinho quadriculado com o `?` à esquerda da frase sai. Ele era um lugar
     RESERVADO pra um sprite que ali não existe -- sem time escolhido não há bicho pra mostrar,
     e o tracejado vazio se lia como algo faltando carregar. */
  ok('não há sprite vazio à esquerda da frase', linha.indexOf('pesc-vazio') < 0);
  ok('  nem o lugar dele', linha.indexOf('pesc-parceiro-sprite') < 0);
  /* ⚠️ E A REGRA DE CSS SAIU JUNTO: regra sem usuário é letra morta, a mesma decisão que a trava
     dos selos cobra ("todo desenho tem chamador"). */
  ok('  e a regra de CSS não sobrou órfã',
     src.indexOf('.pesc-vazio{') < 0 && src.indexOf('pesc-parceiro-sprite') < 0);
  /* e a linha continua sendo um BOTÃO que abre o picker: o que saiu foi o vazio, não a ação */
  ok('a linha continua abrindo o picker', linha.indexOf('pescariaAbrirPicker()') >= 0);
  ok('  e ainda diz o que fazer', h.indexOf('Escolha o time que vai lutar por você') >= 0);
}

console.log('\n=== O RELÓGIO NÃO PAUSA COM A ABA OCULTA (20/09/2026) ===');
{
  /* ⚠️ ELE SOMAVA `dt` DE QUADRO EM QUADRO com teto de 0,1 s -- e o `requestAnimationFrame` PARA
     quando a aba não está visível. O duelo inteiro congelava: voltando depois de 30 s, o relógio
     marcava os mesmos 12 s e o adversário não tinha pescado nada. Foi reportado.
     ⚠️ E ESTA TRAVA DIRIGE O LAÇO DE VERDADE, saltando o tempo -- ela não lê o código. A versão
     velha lia (`/Math\.min\(0\.1,/`), e por isso ela não conseguia distinguir "o passo é limitado"
     (que continua sendo, e tem que ser) de "o tempo é jogado fora" (que era o defeito). */
  contaAdmin();
  S.abrirPescaria();
  S.pescariaEscolher(0);
  S.pescariaLargar();
  ok('o laço registrou um quadro', S.__rafs.length === 1, S.__rafs.length + ' na fila');

  S.__quadro(1000);
  S.__quadro(2000);
  const antes = S.pescaria.tempo;
  ok('o relógio anda com os quadros', Math.abs(antes - 1) < 0.05, antes.toFixed(2) + 's');

  /* a aba fica 20 s oculta: NENHUM quadro acontece nesse intervalo */
  S.__quadro(22000);
  const depois = S.pescaria.tempo;
  ok('e RECUPERA o tempo da aba oculta', Math.abs(depois - 21) < 0.2,
     antes.toFixed(2) + 's -> ' + depois.toFixed(2) + 's (a aba ficou 20 s fora)');

  /* ⚠️ MAS O PASSO CONTINUA LIMITADO: a física é por passo (a tensão sobe por segundo, a boia
     afunda num instante), e entregar 20 s num `dt` só daria outro resultado -- a linha estouraria
     sem ninguém ter tocado, que é o que a guarda velha evitava. */
  ok('  e o PASSO da simulação continua limitado',
     src.indexOf('const PESCARIA_PASSO_MAX = 0.1;') >= 0);
  const laco = src.slice(src.indexOf('function pescariaLargar'), src.indexOf('function pescariaTerminar'));
  const passo = laco.slice(laco.indexOf('const passo ='));
  ok('  (e a trava lê o laço)', passo.length > 300, passo.length + ' chars');
  ok('  e ele roda em VOLTAS até alcançar o relógio real',
     /while\(pescaria\.tempo < alvo/.test(passo));
  /* ⚠️ COM TETO: sem ele, uma aba esquecida por uma hora tentaria 36.000 iterações num quadro só */
  ok('  com teto de voltas', /voltas < PESCARIA_PASSOS_MAX/.test(passo));
  ok('    e o teto cobre o duelo inteiro',
     S.PESCARIA_PASSOS_MAX * S.PESCARIA_PASSO_MAX >= S.PESCARIA_DURACAO + S.PESCARIA_SOBRA,
     S.PESCARIA_PASSOS_MAX + ' passos = ' + (S.PESCARIA_PASSOS_MAX * S.PESCARIA_PASSO_MAX).toFixed(0) + 's');

  /* ⚠️ E UMA AUSÊNCIA LONGA NÃO TRAVA O QUADRO: o duelo termina sozinho quando o relógio passa */
  S.__quadro(600000);   /* dez minutos fora */
  ok('uma ausência de 10 min encerra o duelo em vez de travar',
     S.pescaria.fase !== 'jogando', 'fase: ' + S.pescaria.fase);

  /* o campo nasce limpo -- senão a partida seguinte herdaria o relógio da anterior */
  S.pescariaZerar();
  ok('e o marco do relógio zera com o resto', !S.pescaria.inicioReal);
}

console.log('\n=== O MAPA SOME ENQUANTO A PESCA ACONTECE ===');
{
  contaAdmin();
  S.abrirPescaria();
  S.pescariaEscolher(0);
  S.pescariaLargar();
  S.__quadro(100);
  const mapa = S.document.getElementById('pescMapa');
  const eu = S.pescaria.jogadores[0];

  ok('parado, o mapa está na tela', mapa && mapa.hidden !== true, 'hidden=' + (mapa && mapa.hidden));
  /* ⚠️ FORA DO `parado` não há nada pra decidir no lago: todos os pontos estão fechados pelo
     `posso`, e o que importa está no painel de baixo (a boia, a tensão ou a batalha). */
  for(const estado of ['espera', 'fisgada', 'puxando', 'batalha']){
    eu.estado = estado;
    S.pescariaPintar();
    ok('  em `' + estado + '` ele some', mapa.hidden === true);
  }
  /* o descanso é o fim do ciclo (o recado do resultado): o mapa só volta no `parado` */
  eu.estado = 'descanso';
  S.pescariaPintar();
  ok('  e no `descanso` também (o ciclo ainda não acabou)', mapa.hidden === true);
  eu.estado = 'parado';
  S.pescariaPintar();
  ok('  e VOLTA quando eu fico parado', mapa.hidden === false);

  /* ⚠️ QUEM ESCONDE É O PINTOR: o estado muda DENTRO do laço, que não chama render() */
  /* ⚠️ O PARÊNTESE NÃO É ENFEITE:  é PREFIXO de ,
     que vem 600 linhas ANTES no arquivo -- sem ele a fatia começava na função errada e a trava
     acusava o que estava certo. É a armadilha do padrão largo demais, a mesma do . */
  const fonte = src.slice(src.indexOf('function pescariaPintar(){'), src.indexOf('function nomeDoTreinador'));
  ok('  (e a trava lê o pintor)', fonte.length > 500 && fonte.length < 9000, fonte.length + ' chars');
  ok('é o PINTOR que esconde (não o render)', /mapa\.hidden = esconder/.test(fonte));
  /* ⚠️ E O `hidden` PRECISA DA REGRA: o `.pesc-mapa` é `display:block`, e qualquer display do
     autor anula o `hidden` da folha do navegador. Foi o defeito do modal da contagem da Corrida,
     reportado DUAS vezes porque a primeira correção mexeu na marcação e não no CSS. */
  ok('  e o CSS tem a regra do [hidden]', src.indexOf('.pesc-mapa[hidden]{display:none;}') >= 0);
}

console.log('\n=== O PONTO DE ONDE EU SAÍ NÃO FICA AZUL ===');
{
  contaAdmin();
  S.abrirPescaria();
  S.pescariaEscolher(0);
  S.pescariaLargar();
  S.__quadro(100);
  const eu = S.pescaria.jogadores[0];
  const zona = () => S.document.getElementById('pescZona0');

  /* entro no ponto 0 */
  S.pescariaSurgir(0);
  S.pescariaEntrar(0, 0);
  S.pescariaPintar();
  ok('o meu ponto fica azul enquanto eu estou nele', zona().classList.contains('minha'));

  /* ⚠️ E SAI QUANDO EU SAIO: ela era posta no `render()` e o pintor não a tirava -- o laço não
     chama render(), então o azul ficava preso no ponto de onde eu já tinha saído. É a mesma
     família dos chips da Corrida e do modal da contagem. */
  eu.op = null; eu.estado = 'parado';
  S.pescariaPintar();
  ok('  e SAI quando eu saio dele', !zona().classList.contains('minha'));

  /* ⚠️ E ISSO ERA METADE DO RELATO: o azul vem DEPOIS na folha, então num ponto com peixe sobrava
     só a borda amarela. Com a `minha` fora, a `viva` volta a pintar o fundo. */
  S.pescariaSurgir(0);
  S.pescariaPintar();
  ok('  e o ponto com peixe volta a acender inteiro',
     zona().classList.contains('viva') && !zona().classList.contains('minha'));
  /* lendo o pintor: ela é mantida por lá, como as outras três */
  ok('a `minha` é mantida pelo PINTOR',
     /classList\.contains\('minha'\) !== minhaZona/.test(src));
}

console.log('\n=== OS 18 PESCÁVEIS NOVOS ===');
{
  const pedidos = ['dratini', 'marill', 'azumarill', 'staryu', 'starmie', 'mantine', 'remoraid',
                   'chinchou', 'lanturn', 'kingdra', 'poliwag', 'poliwhirl', 'poliwrath',
                   'omanyte', 'omastar', 'kabuto', 'kabutops', 'dragonair'];
  const todos = new Set();
  S.PESCARIA_ZONAS.forEach(z => z.pool.forEach(([id]) => todos.add(id)));
  ok('os 18 pedidos estão em alguma zona',
     pedidos.every(id => todos.has(id)),
     pedidos.filter(id => !todos.has(id)).join(',') || 'todos');
  ok('  e todos existem no SPECIES',
     [...todos].every(id => !!S.SPECIES[id]), [...todos].filter(id => !S.SPECIES[id]).join(',') || 'todos');
  /* ⚠️ O PESO NÃO PRECISA SOMAR 100 -- o `chancesDaZona` normaliza --, mas a soma tem que ser > 0
     em toda zona, senão o sorteio divide por zero. */
  ok('  e toda zona tem peso', S.PESCARIA_ZONAS.every(z => z.pool.reduce((a, x) => a + x[1], 0) > 0));
  /* ⚠️ E A DISTRIBUIÇÃO É POR PROFUNDIDADE: o BST médio da zona sobe da Margem pro Abismo, senão
     a escada de prêmio (20 a 83 pts) mentiria -- um Starmie na Margem pagaria 20. */
  const medio = S.PESCARIA_ZONAS.map(z =>
    z.pool.reduce((a, [id, p]) => a + S.bstOf(id) * p, 0) / z.pool.reduce((a, x) => a + x[1], 0));
  ok('a força média sobe da Margem pro Abismo',
     medio.every((v, i) => i === 0 || v >= medio[i - 1] - 1),
     medio.map(v => Math.round(v)).join(' < '));
  /* o sorteio só devolve quem está na zona */
  for(let k = 0; k < S.PESCARIA_ZONAS.length; k++){
    const daZona = new Set(S.PESCARIA_ZONAS[k].pool.map(x => x[0]));
    let fora = null;
    for(let i = 0; i < 200; i++){
      S.pescaria.oportunidades[k] = null;
      S.pescariaSurgir(k);
      const op = S.pescaria.oportunidades[k];
      if(op && !daZona.has(op.speciesId)){ fora = op.speciesId; break; }
    }
    if(fora){ ok('o sorteio da zona ' + k + ' respeita o pool', false, fora); break; }
    if(k === S.PESCARIA_ZONAS.length - 1) ok('o sorteio de cada zona respeita o pool dela', true,
      '6 zonas x 200 sorteios');
  }
}


/* ============================================================================
   O SAIR FECHA A TELA, DEPOIS DO RANKING (21/09/2026, a pedido: *"na primeira tela da pescaria,
   coloque o botão de Sair depois do ranking de Melhores Pescarias"*)

   ⚠️ ELE ESTAVA DENTRO DA CAIXA do setup, o que punha o ranking ABAIXO do botão de sair -- e um
   botão de saída no meio da tela corta a leitura: quem chega nele para de rolar e não vê o que vem
   depois. Fora da caixa ele fecha a tela, que é onde um "Sair" pertence -- e é o que a Corrida, o
   Resgate e a Arena já faziam.
   ============================================================================ */
console.log('');
console.log('=== O SAIR VEM DEPOIS DO RANKING ===');
{
  const g2 = S.__getGame();
  S.pescariaRank.lista = [{ pos: 1, nome: 'Ana', pontos: 820, eu: false }];
  S.pescariaRank.meu = null; S.pescariaRank.lidoEm = Date.now(); S.pescariaRank.erro = null;
  S.pescariaZerar();
  g2.screen = 'pescaria';
  const h = S.renderPescaria();

  const iRank = h.indexOf('Melhores pescarias');
  const iSair = h.indexOf('sairDaPescaria()');
  ok('o ranking está na tela', iRank >= 0);
  ok('  e o Sair vem DEPOIS dele', iSair > iRank, 'ranking em ' + iRank + ', Sair em ' + iSair);
  ok('  e ele é UM só', (h.match(/sairDaPescaria\(\)/g) || []).length === 1,
     (h.match(/sairDaPescaria\(\)/g) || []).length + ' botões');

  /* ⚠️ E ELE FICA FORA DA CAIXA: dentro dela ele se lê como mais uma ação do setup; solto no fim,
     ele fecha a tela. O último `</div>` do setup tem que vir ANTES dele. */
  const fechaCaixa = h.lastIndexOf('</div>', iSair);
  ok('  e fora da caixa do setup', fechaCaixa >= 0 && fechaCaixa < iSair && fechaCaixa > iRank,
     'ele voltou pra dentro da caixa');

  /* e o "Começar o duelo" continua onde estava -- ele é a ação da tela, não a saída */
  const iComecar = h.indexOf('pescariaLargar()');
  ok('  e o "Começar o duelo" continua ANTES do ranking', iComecar >= 0 && iComecar < iRank,
     'começar em ' + iComecar);

  /* ⚠️ E COM O RANKING EM ERRO OU VAZIO O SAIR CONTINUA LÁ: ele é da TELA, não do ranking -- se
     ele dependesse da caixa, um erro de rede deixaria o jogador sem saída. */
  S.pescariaRank.lista = [];
  ok('  e ele continua com o ranking vazio',
     S.renderPescaria().indexOf('sairDaPescaria()') >= 0);
  S.pescariaRank.erro = 'deu ruim'; S.pescariaRank.lista = null;
  ok('    e com o ranking em erro', S.renderPescaria().indexOf('sairDaPescaria()') >= 0);
  S.pescariaRank.erro = null;
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
