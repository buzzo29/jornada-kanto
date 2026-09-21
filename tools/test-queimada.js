/**
 * QUEIMADA POKÉMON -- o jogo da Ilha Pummelo (21/09/2026).
 *
 * O que ele existe pra pegar, em ordem de importância:
 *   1. o ACESSO: é modo administrativo, e a visibilidade NUNCA é a trava;
 *   2. os QUATRO ATRIBUTOS que o pedido nomeia chegam de verdade na quadra -- a velocidade e o HP
 *      COM o nível, o escudo pela Defesa Especial, e o nome do botão saindo do `melhorAtaque`;
 *   3. a COMPRESSÃO do dano: uma eliminação nunca leva menos de 2 nem mais de 8 golpes. Sem ela
 *      15,5% dos pares são one-shot e a partida acaba em três arremessos -- é o único desvio
 *      desta tela em relação ao motor, e é o que precisa de trava;
 *   4. o ADVERSÁRIO é pareado por BST, no mesmo nível, e NÃO herda a especialidade do jogador;
 *   5. o PICKER é a lista da Corrida individual, paginada de 10, e quem valida é a AÇÃO;
 *   6. nada disto vai pro save, e o laço pára quando a tela muda.
 *
 *   node tools/test-queimada.js
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
const SP = S.SPECIES;
const mk = (id, lv, ex) => Object.assign({
  speciesId: id, level: lv, name: SP[id].name, types: SP[id].types, id: 'm' + id, hp: 1, maxHp: 1,
  ataques: S.ataquesDisponiveis(id, lv).slice(0, S.MAX_GOLPES),
}, ex || {});
function contaDeTeste(){
  g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
  g.saveSlots[0] = { team: [mk('jolteon', 60), mk('venusaur', 58), mk('snorlax', 62, { shiny: true }),
                            mk('alakazam', 59), mk('gyarados', 61), mk('shuckle', 55)],
                     badgeCount: 8, customName: 'Time A' };
  g.saveSlots[3] = { team: [mk('blastoise', 58), mk('arcanine', 57), mk('lapras', 60),
                            mk('machamp', 56), mk('starmie', 59), mk('magikarp', 20)],
                     badgeCount: 8, customName: 'Time B' };
  g.saveSlotsCarregados = true; g.contaCarregada = true; g.ehAdmin = true;
  g.trainerName = 'Buzzo'; g.aposentados = []; g.specialties = []; g.equipados = {};
  g.montadorPagina = 0;
  S.queimadaZerar();
  S.queimada.escolhido = null;
}
/* uma instância pronta pra medir, como a que entra na quadra */
const inst = (id, lv, ex) => S.queimadaInstancia(Object.assign({ speciesId: id, level: lv }, ex || {}), true);
/* ⚠️ A FOLHA FALSA DE SPRITE: sem ela o `queimadaComecar` sai pela porta do "faltou o sprite" e a
   suíte mediria o caminho do ERRO em vez do da partida. É a mesma folha do test-corrida. */
const folha = { img: {}, w: 32, h: 32, durations: [4, 4], caixas: [[4, 4, 28, 30], [4, 4, 28, 30]] };
function semearSprites(){ Object.keys(SP).forEach(id => { S.pmdCache[id] = folha; S.pmdCache[id + ':shiny'] = folha; }); }
/* monta uma partida de verdade e devolve os dois atores */
async function partida(slot, idx){
  contaDeTeste(); semearSprites();
  g.screen = 'queimada';
  S.queimadaEscolher(slot == null ? 0 : slot, idx == null ? 0 : idx);
  await S.queimadaComecar();
  return S.queimada.atores;
}

/* ============================================================================
   1) O ACESSO -- é o item que mais importa, porque o modo é ADMINISTRATIVO
   ============================================================================ */
console.log('\n=== O ACESSO É SÓ DE QUEM TEM admin === true ===');
{
  /* ⚠️ OS DEZ ESTADOS, e a regra é `=== true`: um `admin` escrito como texto no console não pode
     abrir o modo. É a mesma trava que a Corrida e a Pescaria ganharam quando as duas portas foram
     endurecidas (19/09/2026) -- elas eram `!game.ehAdmin`, ou seja truthy. */
  const ESTADOS = [['true (o certo)', true, true], ['false', false, false], ['a string sim', 'sim', false],
    ['a string true', 'true', false], ['o número 1', 1, false], ['o número 0', 0, false],
    ['null', null, false], ['undefined', undefined, false], ['um objeto', {}, false],
    ['a string admin', 'admin', false]];
  for(const [nome, valor, abre] of ESTADOS){
    contaDeTeste(); g.ehAdmin = valor; g.screen = 'ilhas';
    S.abrirQueimada();
    ok('  ' + nome + (abre ? ' ABRE' : ' não abre'), (g.screen === 'queimada') === abre, 'tela: ' + g.screen);
  }
  contaDeTeste(); g.contaCarregada = false; g.screen = 'ilhas';
  S.abrirQueimada();
  ok('a conta ainda carregando NÃO abre', g.screen !== 'queimada', 'tela: ' + g.screen);
  /* ⚠️ E ISSO É O CONTRÁRIO da porta dos modos de campeão, que erra pro lado de DEIXAR ENTRAR:
     mostrar um modo administrativo a quem não é admin, mesmo por meio segundo, é pior que
     escondê-lo de quem é. */
  ok('  e a mensagem diz por quê', String(g.modoBloqueado || '').indexOf('administrativo') >= 0, g.modoBloqueado);
}
console.log('\n=== E A LARGADA CONFERE DE NOVO ===');
(async () => {
  contaDeTeste(); semearSprites(); g.screen = 'queimada';
  S.queimadaEscolher(0, 0);
  g.ehAdmin = false;
  await S.queimadaComecar();
  ok('a AÇÃO recusa mesmo com o pokémon já escolhido', S.queimada.fase !== 'jogando', 'fase: ' + S.queimada.fase);
  ok('  e ela diz por quê', String(S.queimada.aviso).indexOf('administrativo') >= 0, S.queimada.aviso);

/* ============================================================================
   2) A VELOCIDADE -- o Speed do jogo, COM o nível, comprimido pra caber na quadra
   ============================================================================ */
console.log('\n=== A VELOCIDADE DE MOVIMENTO SAI DO SPEED, COM O NÍVEL ===');
{
  const j5 = inst('jolteon', 5), j50 = inst('jolteon', 50), j99 = inst('jolteon', 99);
  ok('ela escala com o NÍVEL', S.queimadaVelocidade(j5) < S.queimadaVelocidade(j50)
    && S.queimadaVelocidade(j50) < S.queimadaVelocidade(j99),
    [j5, j50, j99].map(p => Math.round(S.queimadaVelocidade(p))).join(' < '));
  /* ⚠️ É O `speedDaCorrida`, que é o `effectiveSpeed` do motor -- e é por isso que o shiny entra
     de graça. Uma segunda leitura de Speed escrita à mão divergiria dele no primeiro ajuste. */
  ok('  e é o Speed do MOTOR, não uma segunda leitura',
    /speedDaCorrida\(inst\)/.test(src.slice(src.indexOf('function queimadaVelocidade'), src.indexOf('function queimadaVelocidade') + 400)));
  const normal = inst('jolteon', 60), brilha = inst('jolteon', 60, { shiny: true });
  ok('  então o shiny (1,20×) é mais rápido', S.queimadaVelocidade(brilha) > S.queimadaVelocidade(normal),
    Math.round(S.queimadaVelocidade(normal)) + ' -> ' + Math.round(S.queimadaVelocidade(brilha)));

  /* ⚠️ O PONTO DE ANCORAGEM: em Speed 100 ela devolve os 120 px/s exatos do protótipo. As duas
     constantes não foram escolhidas no gosto -- é esse número que amarra as duas escalas. */
  ok('em Speed 100 ela dá os 120 px/s do protótipo',
    S.QUEIMADA_V_BASE + S.QUEIMADA_V_FATOR * Math.sqrt(1) === 120,
    S.QUEIMADA_V_BASE + ' + ' + S.QUEIMADA_V_FATOR);

  /* ⚠️ E A COMPRESSÃO É A COISA TODA: a faixa CRUA do jogo não cabe numa quadra. */
  const ids = Object.keys(SP);
  let cruMin = Infinity, cruMax = 0, pxMin = Infinity, pxMax = 0;
  for(const id of ids){
    for(const lv of [5, 50, 99]){
      const p = inst(id, lv);
      const cru = S.speedDaCorrida(p), px = S.queimadaVelocidade(p);
      cruMin = Math.min(cruMin, cru); cruMax = Math.max(cruMax, cru);
      pxMin = Math.min(pxMin, px); pxMax = Math.max(pxMax, px);
    }
  }
  const razaoCrua = cruMax / cruMin, razaoPx = pxMax / pxMin;
  ok('a faixa CRUA não caberia na quadra', razaoCrua > 20, 'razão crua: ' + razaoCrua.toFixed(1) + '×');
  ok('  e a comprimida cabe', razaoPx < 2.5, pxMin.toFixed(0) + ' a ' + pxMax.toFixed(0) + ' px/s ('
    + razaoPx.toFixed(2) + '×), contra 1,88× do protótipo');
  /* a quadra tem 350 px de fundo: o mais lento tem que atravessar o lado dele num tempo jogável */
  ok('  e o mais lento atravessa o campo dele em menos de 3 s', (S.QUEIMADA_H / 2) / pxMin < 3,
    ((S.QUEIMADA_H / 2) / pxMin).toFixed(1) + ' s');
}

/* ============================================================================
   3) O HP -- a MESMA fórmula do jogo, e ele é o HP da instância
   ============================================================================ */
console.log('\n=== O HP É O DO JOGO, COM O NÍVEL ===');
{
  const p = inst('snorlax', 60);
  const a = S.queimadaAtor(p, 0);
  ok('o ator entra com o `calcMaxHp` do jogo', a.maxHp === S.calcMaxHp(p) && a.hp === a.maxHp,
    a.maxHp + ' / ' + S.calcMaxHp(p));
  const h5 = S.queimadaAtor(inst('snorlax', 5), 0).maxHp;
  const h99 = S.queimadaAtor(inst('snorlax', 99), 0).maxHp;
  ok('  e ele escala com o nível', h5 < h99, h5 + ' -> ' + h99);
  const brilha = S.queimadaAtor(inst('snorlax', 60, { shiny: true }), 0).maxHp;
  ok('  e o shiny tem mais barra', brilha > a.maxHp, a.maxHp + ' -> ' + brilha);
  /* ⚠️ O PROTÓTIPO TINHA 100 FIXO PRA TODO MUNDO: é esta linha que faz a escolha do pokémon
     decidir quanto ele aguenta.
     ⚠️ MAS O NÍVEL PESA MAIS QUE A ESPÉCIE, e isso é medido e não intuído: o `calcMaxHp` é
     `30 + nível×5 + HP base`, ou seja no Lv.60 os 330 do nível são comuns a todo mundo e só o HP
     base separa os dois extremos do bestiário -- Shuckle (20) e Chansey (250) ficam em 350 contra
     580, **1,66×**. Uma trava que exigisse o dobro estaria medindo um número inventado. */
  const magra = S.queimadaAtor(inst('shuckle', 60), 0).maxHp;
  const gorda = S.queimadaAtor(inst('chansey', 60), 0).maxHp;
  ok('  e ele varia entre espécies', gorda > magra * 1.5,
     magra + ' (Shuckle) contra ' + gorda + ' (Chansey), ' + (gorda / magra).toFixed(2) + '×');
  /* ⚠️ E O NÍVEL É A ALAVANCA MAIOR -- é ele que faz a lista de escolha valer alguma coisa. */
  ok('  e o NÍVEL pesa mais que a espécie',
     (h99 / h5) > (gorda / magra), (h99 / h5).toFixed(2) + '× de nível contra '
     + (gorda / magra).toFixed(2) + '× de espécie');
}

/* ============================================================================
   4) O ESCUDO -- a Defesa Especial, que foi o pedido
   ============================================================================ */
console.log('\n=== O TEMPO DO RECEBER SAI DA DEFESA ESPECIAL ===');
{
  const baixo = inst('caterpie', 50), alto = inst('shuckle', 50);
  ok('mais Sp.Def, mais escudo', S.queimadaJanelaDeGuarda(alto) > S.queimadaJanelaDeGuarda(baixo),
    (S.queimadaJanelaDeGuarda(baixo) * 1000).toFixed(0) + ' ms contra ' + (S.queimadaJanelaDeGuarda(alto) * 1000).toFixed(0) + ' ms');
  ok('  e é o `effectiveSpDef` do motor',
    /effectiveSpDef\(inst\)/.test(src.slice(src.indexOf('function queimadaJanelaDeGuarda'), src.indexOf('function queimadaJanelaDeGuarda') + 300)));
  /* ⚠️ E ELE NÃO ESCALA COM O NÍVEL -- é o atributo BASE. É justamente isso que deixou a fórmula
     do protótipo entrar VERBATIM: a entrada está na mesma escala que o campo `spd` dele. */
  ok('  e ela é a mesma em qualquer nível (a Sp.Def é BASE)',
    S.queimadaJanelaDeGuarda(inst('alakazam', 5)) === S.queimadaJanelaDeGuarda(inst('alakazam', 99)));

  let fora = 0, noMin = 0, noMax = 0;
  for(const id of Object.keys(SP)){
    const j = S.queimadaJanelaDeGuarda(inst(id, 50));
    if(j < S.QUEIMADA_GUARDA_MIN - 1e-9 || j > S.QUEIMADA_GUARDA_MAX + 1e-9) fora++;
    if(Math.abs(j - S.QUEIMADA_GUARDA_MIN) < 1e-9) noMin++;
    if(Math.abs(j - S.QUEIMADA_GUARDA_MAX) < 1e-9) noMax++;
  }
  ok('as 250 ficam dentro do clamp', fora === 0, fora + ' fora');
  /* ⚠️ O CLAMP MORDE DOS DOIS LADOS, e é ele que impede o Shuckle (Sp.Def 230) de ficar com meio
     segundo de escudo -- e o Caterpie com quase nada. */
  ok('  e ele morde nos dois extremos', noMin > 0 && noMax > 0, noMin + ' no piso, ' + noMax + ' no teto');
  ok('  o Shuckle bate no teto', S.queimadaJanelaDeGuarda(inst('shuckle', 50)) === S.QUEIMADA_GUARDA_MAX);
}

/* ============================================================================
   5) O GOLPE -- o nome vem do `melhorAtaque`, e o especial é ×1,5
   ============================================================================ */
console.log('\n=== O BOTÃO ATACAR RECEBE O NOME DO GOLPE DO MOTOR ===');
{
  const meu = inst('jolteon', 60), dele = inst('gyarados', 60);
  meu.ataques = S.ataquesDisponiveis('jolteon', 60).slice(0, S.MAX_GOLPES);
  const m = S.melhorAtaque(meu, dele);
  const golpe = S.queimadaGolpeContra(meu, dele);
  ok('o golpe é EXATAMENTE o que o `melhorAtaque` escolhe', !!m && golpe.golpe === m.golpe,
    golpe.golpe + ' / ' + (m && m.golpe));
  ok('  e o nome é o nome DELE', golpe.nome === S.nomeDoAtaque(m.golpe), golpe.nome);
  ok('  e o tipo é o do golpe', golpe.tipo === S.GOLPES[m.golpe][0], golpe.tipo);

  /* ⚠️ OS DOIS CASOS DA JORNADA CONTINUAM SENDO OS DOIS CASOS AQUI: sem golpe escolhido, o motor
     de tipo decide e o nome sai do `nomeDoGolpe` -- o mesmo caminho do log. */
  const semGolpe = inst('jolteon', 60); semGolpe.ataques = null;
  const g2 = S.queimadaGolpeContra(semGolpe, dele);
  ok('sem golpe escolhido ele cai no motor de TIPO', g2.golpe === null && !!g2.nome && g2.nome !== 'Ataque',
    g2.nome + ' (' + g2.tipo + ')');

  /* ⚠️ O RNG É FIXO NO MEIO DA FAIXA: este número vai no RÓTULO do botão, então ele tem que ser o
     mesmo do começo ao fim da partida. Sorteado, o botão prometeria um dano e a barra mostraria
     outro. */
  const a1 = S.queimadaGolpeContra(meu, dele), a2 = S.queimadaGolpeContra(meu, dele);
  ok('e o número não dança entre duas leituras', a1.dano === a2.dano && a1.bruto === a2.bruto, a1.dano + ' de dano');

  ok('o ESPECIAL é o atk × 1,5', S.QUEIMADA_ESPECIAL_MULT === 1.5);
  ok('  e a tela usa a constante, não um 1.5 solto',
    /QUEIMADA_ESPECIAL_MULT/.test(src.slice(src.indexOf('function queimadaAtacar'), src.indexOf('function queimadaAtacar') + 1400)));
}

console.log('\n=== O DANO É COMPRIMIDO: NUNCA MENOS DE 2 NEM MAIS DE 8 GOLPES ===');
{
  /* ⚠️ ESTA É A TRAVA QUE MAIS IMPORTA DESTE ARQUIVO. Com o dano CRU do motor, 15,5% dos pares são
     one-shot -- num jogo de 3 eliminações, a partida acaba em três arremessos. */
  const pool = S.finaisDaCorrida();
  const rng = (() => { let s = 20260921 >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  let piores = 0, cruOneShot = 0, dentro = 0, noPiso = 0, noTeto = 0, total = 0, umGolpe = 0;
  for(let k = 0; k < 900; k++){
    const nivel = [20, 35, 50, 70, 90][k % 5];
    const A = pool[Math.floor(rng() * pool.length)], B = pool[Math.floor(rng() * pool.length)];
    if(A === B) continue;
    const a = inst(A, nivel), b = inst(B, nivel);
    a.ataques = S.ataquesDisponiveis(A, nivel).slice(0, S.MAX_GOLPES);
    S.equiparNpc([b]);
    const gp = S.queimadaGolpeContra(a, b);
    const golpes = b.maxHp / gp.dano;
    total++;
    /* ⚠️ A REGRA É SOBRE O DANO, e ela é EXATA: o número de golpes derrapa alguns centésimos por
       ARREDONDAMENTO (`round(305/8)` é 38, e 305/38 dá 8,03), que é a mesma cauda que a suavização
       do log já registra. Medir o quociente com uma folga inventada seria medir o arredondamento. */
    if(gp.dano < Math.floor(b.maxHp / S.QUEIMADA_GOLPES_MAX)
       || gp.dano > Math.ceil(b.maxHp / S.QUEIMADA_GOLPES_MIN)) piores++;
    if(gp.dano >= b.maxHp) umGolpe++;
    if(b.maxHp / Math.max(1, gp.bruto) < 1.02) cruOneShot++;
    if(gp.bruto > b.maxHp / S.QUEIMADA_GOLPES_MIN) noPiso++;
    else if(gp.bruto < b.maxHp / S.QUEIMADA_GOLPES_MAX) noTeto++;
    else dentro++;
  }
  ok('nenhum par sai da faixa de 2 a 8 golpes', piores === 0, piores + ' de ' + total);
  /* ⚠️ E O QUE ISSO EXISTE PRA IMPEDIR, dito em uma linha: nenhum golpe derruba de barra cheia. */
  ok('  e NENHUM derruba num golpe só', umGolpe === 0, umGolpe + ' de ' + total);
  /* ⚠️ E O PAINEL PRECISA TER ONE-SHOT PRA A TRAVA VALER ALGUMA COISA: sem ele, ela daria verde
     medindo pares que nunca precisaram de aparo. É a lição do painel forte demais. */
  ok('  e o painel TEM one-shot cru pra aparar', cruOneShot > total * 0.05,
    cruOneShot + ' de ' + total + ' seriam one-shot sem a compressão');
  /* ⚠️ E O DANO DO MOTOR VALE INTEIRO NO MEIO DA FAIXA -- é lá que a escolha do pokémon decide.
     Se tudo caísse no piso ou no teto, a compressão teria comido a mecânica. */
  ok('  e a maioria dos pares passa INTEIRA', dentro > total * 0.3,
    dentro + ' dentro · ' + noPiso + ' no piso · ' + noTeto + ' no teto');

  /* o par medido: o dano de dentro da faixa é o do motor, sem arredondar pra lugar nenhum */
  const a = inst('jolteon', 60), b = inst('gyarados', 60);
  a.ataques = S.ataquesDisponiveis('jolteon', 60).slice(0, S.MAX_GOLPES);
  const gp = S.queimadaGolpeContra(a, b);
  const bruto = gp.bruto, teto = b.maxHp / S.QUEIMADA_GOLPES_MIN, piso = b.maxHp / S.QUEIMADA_GOLPES_MAX;
  const esperado = Math.round(Math.max(piso, Math.min(teto, bruto)));
  ok('e a conta é a do motor aparada, nunca um número inventado', gp.dano === esperado,
    'bruto ' + bruto + ' -> ' + gp.dano);
  /* ⚠️ É A MESMA FORMA DO `MORIBUNDO_TETO_NO_CHEIO`: um teto em FRAÇÃO DA BARRA do alvo. */
  ok('  e o teto é uma FRAÇÃO da barra do alvo, não um valor fixo',
    /alvo\.maxHp \/ QUEIMADA_GOLPES_MAX[\s\S]{0,120}alvo\.maxHp \/ QUEIMADA_GOLPES_MIN/.test(src));
}

/* ============================================================================
   6) O ADVERSÁRIO -- pareado por BST, e ele NÃO é do jogador
   ============================================================================ */
console.log('\n=== O ADVERSÁRIO É PAREADO POR BST ===');
{
  contaDeTeste();
  const pool = S.finaisDaCorrida();
  const alvos = ['jolteon', 'magikarp', 'dragonite', 'pidgey', 'snorlax'];
  let somaPareada = 0, somaSorteio = 0, mesmaEspecie = 0, intocavel = 0, semMoveset = 0, nivelErrado = 0;
  const vistos = new Set();
  for(const id of alvos){
    for(let k = 0; k < 60; k++){
      const npc = S.queimadaSortearNpc(id, 55);
      vistos.add(npc.speciesId);
      somaPareada += Math.abs(S.bstOf(npc.speciesId) - S.bstOf(id));
      somaSorteio += Math.abs(S.bstOf(pool[Math.floor(Math.random() * pool.length)]) - S.bstOf(id));
      if(npc.speciesId === id) mesmaEspecie++;
      if((S.ESPECIES_INTOCAVEIS || []).indexOf(npc.speciesId) >= 0) intocavel++;
      /* ⚠️ A COMPARAÇÃO É COM O QUE A ESPÉCIE OFERECE, nunca com "tem golpe": o Ditto não aprende
         golpe de dano por nível NENHUM, e uma trava que exigisse lista cheia falharia sozinha
         quando ele fosse sorteado -- um flake, o pior tipo de teste que existe. */
      const oferece = S.ataquesDisponiveis(npc.speciesId, 55).length;
      if(oferece > 0 && (!npc.ataques || !npc.ataques.length)) semMoveset++;
      if(npc.level !== 55) nivelErrado++;
    }
  }
  ok('ele fica MUITO mais perto em BST que um sorteio uniforme', somaPareada < somaSorteio / 2,
    'distância média ' + Math.round(somaPareada / 300) + ' contra ' + Math.round(somaSorteio / 300));
  /* ⚠️ E NUNCA A MESMA ESPÉCIE: dois sprites idênticos na mesma quadra, separados só pela
     etiqueta, é uma tela que se lê errado -- a mesma razão do Resgate. */
  ok('  e nunca é a espécie do jogador', mesmaEspecie === 0);
  ok('  e nunca é um INTOCÁVEL', intocavel === 0);
  ok('  e ele entra no MESMO nível', nivelErrado === 0);
  /* ⚠️ O MOVESET É OBRIGATÓRIO: sem o `equiparNpc` ele cairia no motor de tipo com o poder
     implícito de 60, e aí o pareamento por BST seria uma promessa que o ataque não cumpre. */
  ok('  e ele leva o moveset da espécie (`equiparNpc`)', semMoveset === 0);
  ok('  e ele VARIA de verdade', vistos.size >= 20, vistos.size + ' espécies distintas');

  /* ⚠️ A ESPECIALIDADE É CONQUISTA DA CONTA: um adversário de tipo Elétrico não pode ganhar 1,05×
     porque o JOGADOR é especialista em Elétrico. É a mesma nota do `corridaInstancia`. */
  /* ⚠️ O `game.specialties` GUARDA O TIPO EM INGLÊS -- é a chave do `TYPE_CHART`. Com o nome PT
     o `applySpecialtyBuff` não casa e a trava mede um buff que nunca foi aplicado. */
  g.specialties = ['Electric'];
  const meuEletrico = S.queimadaInstancia({ speciesId: 'jolteon', level: 60 }, true);
  const deleEletrico = S.queimadaInstancia({ speciesId: 'jolteon', level: 60 }, false);
  ok('a especialidade vale SÓ pro pokémon do jogador',
    !!meuEletrico.specialtyBuffed && !deleEletrico.specialtyBuffed);
  /* ⚠️ E O `ehDoJogador` NÃO PODE TER PADRÃO: com `true` implícito, a próxima chamada esquecida
     daria o buff ao adversário em silêncio. */
  ok('  e o `ehDoJogador` não tem padrão', /function queimadaInstancia\(p, ehDoJogador\)\s*\{/.test(src));
  ok('  e o NPC é montado sem ele', /queimadaSortearNpc\(queimada\.escolhido\.speciesId/.test(src));
  g.specialties = [];
}

/* ============================================================================
   7) O PICKER -- a lista da Corrida individual, paginada de 10 em 10
   ============================================================================ */
console.log('\n=== A ESCOLHA É A MESMA LISTA DA CORRIDA INDIVIDUAL ===');
{
  contaDeTeste();
  const elegiveis = S.queimadaElegiveis();
  const torre = S.towerEligiblePokemon();
  const chave = (p) => String(p.slot) + ':' + p.idx;
  ok('é exatamente a lista do `towerEligiblePokemon`',
    elegiveis.map(chave).sort().join(',') === torre.map(chave).sort().join(','),
    elegiveis.length + ' elegíveis');
  /* ⚠️ A RÉGUA DAS 8 INSÍGNIAS JÁ VEM DE LÁ -- não é uma regra nova daqui. */
  g.saveSlots[1] = { team: [mk('pidgey', 30)], badgeCount: 3, customName: 'Meio do caminho' };
  ok('  e um save sem as 8 insígnias não entra',
    S.queimadaElegiveis().every(p => String(p.slot) !== '1'));
  g.saveSlots[1] = null;

  /* ⚠️ ORDENADA PELO SPEED DA QUEIMADA -- que é o número que decide o movimento na quadra. */
  const vels = S.queimadaElegiveis().map(p => p.velocidade);
  ok('ela é ordenada pela velocidade da QUEIMADA',
    vels.every((v, i) => i === 0 || vels[i - 1] >= v), vels.slice(0, 4).join(' >= '));

  ok('a paginação é a da casa', S.MONT_POR_PAGINA === 10);
  /* ⚠️ ABRIR ZERA A PÁGINA: o `game.montadorPagina` é COMPARTILHADO com a Torre, o Ginásio, a
     Corrida e a Pescaria, e uma página 3 sobrando de lá abriria esta lista no meio. */
  g.montadorPagina = 3;
  S.queimadaAbrirPicker();
  ok('  e abrir o picker zera a página', g.montadorPagina === 0, 'página ' + g.montadorPagina);

  /* ⚠️ QUEM VALIDA É A AÇÃO, nunca a tela. */
  contaDeTeste();
  S.queimadaEscolher(0, 0);
  ok('escolher um da lista funciona', !!S.queimada.escolhido && S.queimada.escolhido.idx === 0);
  const antes = S.queimada.escolhido;
  S.queimadaEscolher(9, 4);
  ok('  e um slot forjado não entra', S.queimada.escolhido === antes);
  S.queimadaEscolher(1, 0);
  ok('  e um save sem insígnia também não', S.queimada.escolhido === antes);
  S.queimada.fase = 'jogando';
  S.queimadaEscolher(3, 0);
  ok('  e não dá pra trocar com a partida em curso', S.queimada.escolhido === antes, 'fase: jogando');
  S.queimada.fase = 'setup';
}

console.log('\n=== E OS GOLPES ESCOLHIDOS VOLTAM DO SAVE ===');
{
  /* ⚠️ O `towerEligiblePokemon` NÃO DEVOLVE OS GOLPES: sem esta volta ao save, o pokémon entraria
     SEM `ataques` e cairia no motor de tipo -- o botão ATACAR mostraria o nome genérico do TIPO em
     vez do golpe que o jogador escolheu, que é o contrário do pedido. */
  contaDeTeste();
  const jolteon = S.queimadaElegiveis().find(p => p.speciesId === 'jolteon');
  ok('o `ataques` do save chega na lista', !!jolteon && !!jolteon.ataques && jolteon.ataques.length > 0,
    jolteon && (jolteon.ataques || []).join(','));
  ok('  e são os MESMOS do save', jolteon.ataques.join(',') === g.saveSlots[0].team[0].ataques.join(','));
  const semVolta = S.towerEligiblePokemon().find(p => p.speciesId === 'jolteon');
  ok('  e a lista da Torre, sozinha, não os tem', !semVolta.ataques);
  /* o efeito prático: com os golpes, o botão nomeia o GOLPE; sem eles, o TIPO */
  const dele = inst('gyarados', 60);
  const comGolpe = S.queimadaGolpeContra(S.queimadaInstancia(jolteon, true), dele);
  const cru = S.queimadaInstancia(Object.assign({}, jolteon, { ataques: null }), true);
  const semGolpe = S.queimadaGolpeContra(cru, dele);
  ok('  e é por isso que o botão nomeia o GOLPE e não o tipo', !!comGolpe.golpe && semGolpe.golpe === null,
    comGolpe.nome + ' contra ' + semGolpe.nome);
}

/* ============================================================================
   8) A PARTIDA -- o receber devolve, o especial atravessa, e o dano aparece
   ============================================================================ */
console.log('\n=== A PARTIDA ===');
{
  const [eu, ele] = await partida(0, 0);
  ok('a largada monta os dois atores', !!eu && !!ele && eu.lado === 0 && ele.lado === 1,
    eu && eu.inst.speciesId, ele && ele.inst.speciesId);
  ok('  e os dois golpes são calculados UMA vez', S.queimada.golpes.length === 2
    && S.queimada.golpes.every(x => x.dano > 0),
    S.queimada.golpes.map(x => x.nome + ' ' + x.dano).join(' / '));
  ok('  e o pokémon do jogador é o que ele escolheu',
    eu.inst.speciesId === S.queimada.escolhido.speciesId, eu.inst.speciesId);
  /* ⚠️ O ESPECIAL COMEÇA INDISPONÍVEL, carregando -- é o que impede a partida de abrir com ele. */
  ok('  e o especial começa carregando', eu.especialPronto === S.QUEIMADA_ESPECIAL_RECARGA,
    eu.especialPronto + ' s');

  /* o arremesso comum */
  S.queimada.t = 2; S.queimada.rodadaAte = 0;
  S.queimadaAtacar(0, false);
  ok('o ATACAR põe uma bola na quadra', S.queimada.bolas.length === 1, S.queimada.bolas.length + ' bola(s)');
  ok('  com o dano do botão', S.queimada.bolas[0].dano === S.queimada.golpes[0].dano,
    S.queimada.bolas[0].dano + ' de dano');
  ok('  e ele tem recarga', (S.queimadaAtacar(0, false), S.queimada.bolas.length === 1), 'não dá pra atirar duas vezes');

  /* ⚠️ O ESPECIAL É ×1,5 DO NÚMERO QUE O BOTÃO MOSTRA -- foi o pedido ao pé da letra. */
  S.queimada.bolas = []; S.queimada.t = 60; eu.tiroPronto = 0; eu.especialPronto = 0;
  S.queimadaAtacar(0, true);
  ok('o ESPECIAL sai com ×1,5 do dano do botão',
    S.queimada.bolas[0].dano === Math.round(S.queimada.golpes[0].dano * S.QUEIMADA_ESPECIAL_MULT),
    S.queimada.golpes[0].dano + ' -> ' + S.queimada.bolas[0].dano);
  ok('  e ele recarrega', eu.especialPronto === S.queimada.t + S.QUEIMADA_ESPECIAL_RECARGA);
}

console.log('\n=== O RECEBER DEVOLVE, E O ESPECIAL ATRAVESSA ===');
{
  const [eu, ele] = await partida(0, 0);
  S.queimada.t = 5; S.queimada.rodadaAte = 0;

  /* ⚠️ A JANELA DO RECEBER É A DA DEFESA ESPECIAL -- o pedido. */
  const janela = S.queimadaJanelaDeGuarda(eu.inst);
  S.queimadaReceber(0);
  ok('o RECEBER abre a janela da Sp.Def dele',
    Math.abs(eu.guardaAte - (S.queimada.t + janela)) < 1e-9, (janela * 1000).toFixed(0) + ' ms');
  ok('  e ele tem recarga própria', eu.guardaPronta === S.queimada.t + S.QUEIMADA_GUARDA_RECARGA);

  /* a bola do adversário chega em cima do jogador, com o escudo aberto */
  const hpAntes = eu.hp;
  const base = S.queimada.golpes[1].dano;
  S.queimada.bolas = [{ id: 1, dono: 1, x: eu.x, y: eu.y - 4, vx: 0, vy: 60, dano: base, base: base,
                        nasceu: S.queimada.t, devolvida: 0, especial: false }];
  S.queimadaPasso(0.05);
  const bola = S.queimada.bolas[0];
  ok('a bola é DEVOLVIDA', !!bola && bola.dono === 0, bola ? 'dono ' + bola.dono : 'sumiu');
  ok('  e o jogador não perde HP', eu.hp === hpAntes, hpAntes + ' -> ' + eu.hp);
  ok('  e ela ganha 25%', bola.dano === Math.min(Math.round(base * S.QUEIMADA_REFLEXO_MULT),
                                                 Math.round(base * S.QUEIMADA_REFLEXO_TETO)),
    base + ' -> ' + bola.dano);
  /* ⚠️ O TETO DE 160% existe pra uma bola ida e volta não virar um golpe que mata de uma vez. */
  let b2 = { dano: base, base: base };
  for(let k = 0; k < 6; k++) b2.dano = Math.min(Math.round(b2.dano * S.QUEIMADA_REFLEXO_MULT),
                                                Math.round(b2.base * S.QUEIMADA_REFLEXO_TETO));
  ok('  e ela nunca passa de 160% do original', b2.dano === Math.round(base * S.QUEIMADA_REFLEXO_TETO),
    b2.dano + ' de teto');

  /* ⚠️ O ESPECIAL ATRAVESSA O RECEBER -- é o que o aviso da tela promete. */
  const [eu2] = await partida(0, 0);
  S.queimada.t = 5; S.queimada.rodadaAte = 0;
  S.queimadaReceber(0);
  const hp2 = eu2.hp, dano2 = 40;
  S.queimada.bolas = [{ id: 1, dono: 1, x: eu2.x, y: eu2.y - 4, vx: 0, vy: 60, dano: dano2, base: dano2,
                        nasceu: S.queimada.t, devolvida: 0, especial: true }];
  S.queimadaPasso(0.05);
  ok('o ESPECIAL atravessa o escudo', eu2.hp === hp2 - dano2, hp2 + ' -> ' + eu2.hp);
  /* ⚠️ PROCURADA POR ID: o NPC atira a bola DELE no mesmo passo, então contar a lista inteira
     mediria o adversário em vez do escudo. */
  ok('  e ele não vira bola devolvida', !S.queimada.bolas.some(x => x.id === 1),
     S.queimada.bolas.length + ' bola(s) na quadra, nenhuma é a do especial');
}

console.log('\n=== QUANTO DE HP SAIU APARECE NA TELA -- nos DOIS lados ===');
{
  /* ⚠️ FOI O PEDIDO, e ele vale pros dois: o protótipo só dizia quando era o jogador que apanhava. */
  for(const lado of [0, 1]){
    const atores = await partida(0, 0);
    const alvo = atores[lado], dono = 1 - lado;
    S.queimada.t = 5; S.queimada.rodadaAte = 0;
    const dano = 37;
    S.queimada.bolas = [{ id: 1, dono: dono, x: alvo.x, y: alvo.y - 4, vx: 0, vy: 60, dano: dano, base: dano,
                          nasceu: S.queimada.t, devolvida: 0, especial: false }];
    const hp = alvo.hp;
    S.queimadaPasso(0.05);
    ok((lado ? 'o rival' : 'o jogador') + ' apanhando: o HP sai da barra', alvo.hp === hp - dano, hp + ' -> ' + alvo.hp);
    ok('  e o recado diz QUANTO', S.queimada.recado.indexOf('tirou ' + dano + ' de HP') >= 0, S.queimada.recado);
    ok('  e o número flutua na quadra',
      S.queimada.fx.some(f => f.txt === '−' + dano + ' HP'),
      (S.queimada.fx.map(f => f.txt).join(' / ') || '(nenhum)'));
  }
}

console.log('\n=== A ELIMINAÇÃO E O FIM ===');
{
  const [eu, ele] = await partida(0, 0);
  S.queimada.t = 5; S.queimada.rodadaAte = 0;
  ele.hp = 1;
  S.queimada.bolas = [{ id: 1, dono: 0, x: ele.x, y: ele.y - 4, vx: 0, vy: 60, dano: 999, base: 999,
                        nasceu: S.queimada.t, devolvida: 0, especial: false }];
  S.queimadaPasso(0.05);
  ok('derrubar o rival vale um ponto', S.queimada.atores[0].pontos === 1, S.queimada.atores[0].pontos + ' ponto(s)');
  ok('  e a quadra é limpa', S.queimada.bolas.length === 0);
  ok('  e os dois voltam com a barra cheia',
    S.queimada.atores.every(a => a.hp === a.maxHp), S.queimada.atores.map(a => a.hp + '/' + a.maxHp).join(' · '));
  ok('  e a rodada tem pausa', S.queimada.rodadaAte > S.queimada.t);
  ok('  e a tela diz o que houve', S.queimada.recado.indexOf('queimou o rival') >= 0, S.queimada.recado);

  /* ⚠️ PRIMEIRO A 3 TERMINA -- e o `QUEIMADA_KOS` é a régua, não um 3 escrito à mão. */
  S.queimada.atores[0].pontos = S.QUEIMADA_KOS - 1;
  S.queimada.t = 20; S.queimada.rodadaAte = 0;
  S.queimada.atores[1].hp = 1;
  S.queimada.bolas = [{ id: 2, dono: 0, x: S.queimada.atores[1].x, y: S.queimada.atores[1].y - 4,
                        vx: 0, vy: 60, dano: 999, base: 999, nasceu: 20, devolvida: 0, especial: false }];
  S.queimadaPasso(0.05);
  ok('o ' + S.QUEIMADA_KOS + 'º ponto encerra a partida', S.queimada.fase === 'fim', 'fase: ' + S.queimada.fase);
  ok('  e o vencedor é quem tem mais pontos', S.queimadaVencedor() > 0, 'vencedor: ' + S.queimadaVencedor());

  /* e o relógio também encerra */
  const atores = await partida(0, 0);
  S.queimada.decorrido = S.QUEIMADA_DURACAO - 0.01;
  S.queimadaPasso(1);
  ok('e os ' + S.QUEIMADA_DURACAO + ' s encerram sozinhos', S.queimada.fase === 'fim',
    'decorrido ' + S.queimada.decorrido.toFixed(0) + ' s');
  ok('  e o passo NÃO passa do relógio', S.queimada.decorrido <= S.QUEIMADA_DURACAO + 1e-9,
    S.queimada.decorrido.toFixed(2));
  void atores;
}

/* ============================================================================
   9) O LAÇO -- ele pára quando a tela muda, e não avança com a aba oculta
   ============================================================================ */
console.log('\n=== O LAÇO ===');
{
  await partida(0, 0);
  S.queimadaLaco();
  const antes = S.queimada.decorrido;
  S.__quadro(1000); S.__quadro(1100);
  ok('ele anda com a tela aberta', S.queimada.decorrido > antes, S.queimada.decorrido.toFixed(2) + ' s');
  /* ⚠️ ELE PÁRA QUANDO A TELA MUDA: sem isso ele continuaria pintando num canvas que já não está
     na página -- e, pior, escrevendo nos ids do HUD de outra tela. É a guarda do Resgate. */
  g.screen = 'ilhas';
  const parado = S.queimada.decorrido;
  S.__quadro(1200); S.__quadro(1300);
  ok('  e PÁRA quando a tela muda', S.queimada.decorrido === parado, 'parou em ' + parado.toFixed(2) + ' s');
  ok('  e solta o pedido de quadro', S.queimada.laco === null);

  /* ⚠️ COM A ABA OCULTA ELE NÃO ACUMULA TEMPO: o `ultimoQuadro` é zerado, então a volta seguinte
     tem dt=0 em vez de um salto do tamanho do tempo em que a aba ficou escondida. */
  g.screen = 'queimada';
  S.queimadaLaco();
  S.__quadro(2000);
  const t0 = S.queimada.decorrido;
  S.document.hidden = true;
  S.__quadro(32000);
  ok('  e a aba oculta não avança o relógio', S.queimada.decorrido === t0, t0.toFixed(2) + ' s');
  S.document.hidden = false;
  S.__quadro(33000);
  ok('  e a volta não dá um salto', S.queimada.decorrido - t0 < 0.1,
    (S.queimada.decorrido - t0).toFixed(3) + ' s no quadro da volta');
  S.queimadaTerminar();
}

/* ============================================================================
   10) NADA DISTO VAI PRO SAVE
   ============================================================================ */
console.log('\n=== NADA VAI PRO SAVE ===');
{
  contaDeTeste(); semearSprites();
  const antes = JSON.stringify(g.saveSlots);
  g.screen = 'queimada';
  S.queimadaEscolher(0, 0);
  await S.queimadaComecar();
  S.queimada.t = 5; S.queimada.rodadaAte = 0;
  for(let k = 0; k < 200; k++) S.queimadaPasso(1 / 60);
  ok('o time do save fica byte a byte igual', JSON.stringify(g.saveSlots) === antes);
  ok('  e o estado vive FORA do `game`', g.queimada === undefined);
  /* ⚠️ OLHANDO AS CHAVES, e não a string: `screen` vale "queimada" enquanto a tela está aberta, e
     isso é legítimo -- é assim que o save volta pra tela em que estava. O que não pode existir é
     um CAMPO da partida no save. */
  const ser = S.serializeGame();
  ok('  e nenhum campo dele entra no `serializeGame`',
     Object.keys(ser).every(k => !/^queimada/i.test(k)),
     Object.keys(ser).filter(k => /queimada/i.test(k)).join(',') || '(nenhum)');
  S.queimadaTerminar();
}

/* ============================================================================
   11) A ILHA PUMMELO -- e ela fecha o arquipélago
   ============================================================================ */
console.log('\n=== A ILHA PUMMELO ===');
{
  const ilha = S.ILHAS_LARANJA.find(i => i.id === 'pummelo');
  ok('a Pummelo deixou de ser "em breve"', !!ilha && !!ilha.jogo, ilha ? ilha.jogo : 'sem ilha');
  ok('  e ela leva ao `abrirQueimada`', ilha.abrir === S.abrirQueimada);
  /* ⚠️ O ADVERSÁRIO É O LÍDER DA ILHA, lido da TABELA e nunca escrito à mão: trocar o nome dele
     lá tem que trocar aqui junto. */
  ok('  e o adversário é o líder DELA', S.queimadaLider() === ilha.lider, S.queimadaLider());
  contaDeTeste(); g.screen = 'ilhas';
  S.entrarNaIlha(S.ILHAS_LARANJA.indexOf(ilha));
  ok('  e entrar nela abre o modo', g.screen === 'queimada', 'tela: ' + g.screen);
  /* ⚠️ SAIR VOLTA PRA AS ILHAS, e não pra home: o jogo mora numa ilha. */
  S.sairDaQueimada();
  ok('  e sair volta pra as ilhas', g.screen === 'ilhas', 'tela: ' + g.screen);
  ok('  e zera a partida', S.queimada.fase === 'setup' && S.queimada.atores.length === 0);
  /* ⚠️ E COM ELA O ARQUIPÉLAGO FECHOU: as CINCO ilhas têm jogo. */
  ok('as cinco ilhas têm jogo', S.ILHAS_LARANJA.every(i => typeof i.abrir === 'function' && !!i.jogo),
    S.ILHAS_LARANJA.map(i => i.nome + '/' + (i.jogo || '--')).join(' · '));
  ok('  e nenhum jogo aparece em duas ilhas',
    new Set(S.ILHAS_LARANJA.map(i => i.jogo)).size === S.ILHAS_LARANJA.length);
}

/* ============================================================================
   12) LENDO O CÓDIGO -- o que um caso de comportamento não alcança
   ============================================================================ */
console.log('\n=== LENDO O CÓDIGO ===');
{
  const bloco = src.slice(src.indexOf('async function queimadaComecar'), src.indexOf('function queimadaReiniciar'));
  ok('a fatia do `queimadaComecar` tem o que ler', bloco.length > 800, bloco.length + ' chars');
  /* ⚠️ A PÁGINA VAI PRO TOPO **DEPOIS** DO RENDER: a largada não troca de `game.screen`, então o
     render trata isso como a MESMA tela e repõe a rolagem anterior -- quem estava embaixo na lista
     via a quadra começar pela metade. Antes do render, o próprio render desfaria. */
  const iRender = bloco.lastIndexOf('render();'), iTopo = bloco.indexOf('window.scrollTo(0, 0)');
  ok('a rolagem vai pro topo DEPOIS do render', iTopo > iRender && iRender > 0,
    'render em ' + iRender + ', scrollTo em ' + iTopo);
  /* ⚠️ E SEM SPRITE A PARTIDA NÃO COMEÇA: nunca se substitui o sprite de uma espécie pelo de
     outra, e a tela diz QUAL faltou, pelo nome. */
  ok('sem sprite ela não larga', /faltou\.length\)\{[\s\S]{0,200}fase = 'setup'/.test(bloco));

  /* ⚠️ O CARTAZ DO MEIO É ESCONDIDO PELO PINTOR, e o `[hidden]` precisa de regra no CSS: o
     elemento tem `display`, e QUALQUER display do autor anula o hidden da folha do NAVEGADOR, que
     tem a menor prioridade que existe. Foi o defeito do modal da contagem da Corrida, reportado
     DUAS vezes -- e a marcação estava certa nas duas. */
  ok('o `[hidden]` do cartaz vence o display', /\.q-cartaz\[hidden\]\s*\{\s*display\s*:\s*none/.test(src));
  ok('  e quem o esconde é o PINTOR, não uma condição no render',
    /cartaz\.hidden !== !mostrar/.test(src) && src.indexOf("id=\"queimadaCartaz\"") > 0);

  /* ⚠️ O ESTADO É UM `const` QUE NUNCA É REATRIBUÍDO -- ele é MUTADO. O sandbox copia o valor na
     criação, então reatribuir deixaria as funções internas olhando pro objeto velho e as travas
     mediriam o nada. É a mesma decisão do `corrida` e do `pescaria`. */
  ok('o estado nunca é reatribuído', !/\bqueimada\s*=\s*\{/.test(src.replace('const queimada = {', '')));

  /* ⚠️ OS ids DOS BOTÕES NÃO PODEM SER O NOME DAS FUNÇÕES: um id de elemento vira propriedade
     nomeada do `window`, e `queimadaAtacar` viraria o BOTÃO em vez da função. */
  for(const nome of ['Atacar', 'Especial', 'Receber']){
    ok('o id do botão ' + nome + ' não colide com a função',
      src.indexOf('id="queimadaBt' + nome + '"') > 0 && src.indexOf('id="queimada' + nome + '"') < 0);
  }
}


/* ============================================================================
   13) O TOQUE MARCA UM DESTINO -- ele não arrasta (21/09/2026)
   ============================================================================ */
console.log('\n=== O TOQUE VAI ATÉ ONDE FOI TOCADO ===');
{
  const [eu] = await partida(0, 0);
  S.queimada.t = 5; S.queimada.rodadaAte = 0;
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: S.QUEIMADA_W, height: S.QUEIMADA_H }) };
  const antes = S.document.getElementById;
  S.document.getElementById = (id) => id === 'queimadaCanvas' ? canvas : antes(id);

  S.queimadaPonteiroDesce({ preventDefault(){}, clientX: 90, clientY: 260 });
  const alvo1 = { x: eu.tx, y: eu.ty };
  ok('o toque marca o destino', Math.abs(alvo1.x - 90) < 1, 'tx ' + Math.round(alvo1.x));
  /* ⚠️ ESTA É A TRAVA DO RELATO: *"ele fica seguindo o rastro do mouse"*. Sem um segundo toque, o
     destino NÃO pode mudar -- e é isso que faz o pokémon CHEGAR em vez de perseguir o cursor. */
  if(S.queimadaPonteiroMove) S.queimadaPonteiroMove({ preventDefault(){}, clientX: 300, clientY: 300 });
  ok('  e mexer o ponteiro NÃO o move', eu.tx === alvo1.x && eu.ty === alvo1.y,
     'tx ' + Math.round(eu.tx));
  S.queimadaPonteiroDesce({ preventDefault(){}, clientX: 280, clientY: 300 });
  ok('  e um segundo toque troca o destino', Math.abs(eu.tx - 280) < 1, 'tx ' + Math.round(eu.tx));
  /* ⚠️ E O ARRASTO NÃO EXISTE MAIS NO CÓDIGO: o pointermove no canvas era o que reescrevia o alvo
     60 vezes por segundo, e é por isso que o pokémon nunca chegava. */
  ok('  e o canvas não escuta o movimento do ponteiro', src.indexOf('onpointermove="queimadaPonteiroMove') < 0);
  ok('  e a função do arrasto não existe', !/function queimadaPonteiroMove/.test(src));
  ok('  e o estado do arrasto também não', !/queimada\.arrastando/.test(src));
  S.document.getElementById = antes;
}

console.log('\n=== AS SETAS DE ESQUERDA/DIREITA SAÍRAM ===');
{
  /* ⚠️ E ELAS SAÍRAM INTEIRAS, não só da tela: um estado que ninguém escreve é a forma mais
     silenciosa de código morto que existe -- ele ficaria no zerar e nas duas pausas esperando
     alguém tentar mexer nele de novo. */
  ok('os botões não existem', src.indexOf('q-mov') < 0 && src.indexOf('queimadaBtEsq') < 0);
  ok('  e a função de segurar também não', !/function queimadaSegurar/.test(src));
  ok('  e o estado `segurando` saiu', !/queimada\.segurando/.test(src));
  const [eu] = await partida(0, 0);
  S.queimada.t = 5; S.queimada.rodadaAte = 0;
  S.queimadaIrPara(0, 120, 280);
  S.queimadaPasso(0.2);
  ok('  e o ator continua andando sem elas', Math.abs(eu.x - 180) > 1, 'x ' + Math.round(eu.x));
}

/* ============================================================================
   14) OS 17 SELOS DE TIPO -- um desenho por tipo, na cor do tipo
   ============================================================================ */
console.log('\n=== UM SPRITE POR TIPO, NA COR DO TIPO ===');
{
  const tipos = Object.keys(S.TYPE_CHART);
  ok('a tabela cobre os ' + tipos.length + ' tipos do jogo',
     tipos.every(t => !!S.SELO_DO_TIPO[t]),
     tipos.filter(t => !S.SELO_DO_TIPO[t]).join(',') || '(nenhum de fora)');
  ok('  e nenhum desenho serve a dois tipos',
     new Set(Object.values(S.SELO_DO_TIPO)).size === Object.keys(S.SELO_DO_TIPO).length);
  ok('  e os ' + tipos.length + ' desenhos existem de verdade',
     tipos.every(t => !!S.DESENHOS[S.SELO_DO_TIPO[t]]),
     tipos.filter(t => !S.DESENHOS[S.SELO_DO_TIPO[t]]).map(t => S.SELO_DO_TIPO[t]).join(',') || '(todos)');
  /* ⚠️ A COR NÃO MORA NO DESENHO: ele é `currentColor`, e é isso que faz UM desenho servir às 17
     cores. Com a cor dentro, seriam 17 tabelas de cor pra manter em dia com o `TYPE_COLORS`. */
  ok('  e todos são desenhados em `currentColor`',
     tipos.every(t => S.DESENHOS[S.SELO_DO_TIPO[t]].join('').indexOf('*') >= 0));
  ok('  e nenhum deles traz cor fixa de tipo',
     tipos.every(t => !/[YyoRrqCcbBEegPpn]/.test(S.DESENHOS[S.SELO_DO_TIPO[t]].join(''))),
     tipos.filter(t => /[YyoRrqCcbBEegPpn]/.test(S.DESENHOS[S.SELO_DO_TIPO[t]].join(''))).join(',') || '(nenhum)');
  /* e o selo sai NA COR DO TIPO, que é a segunda metade do pedido */
  for(const t of ['Electric', 'Fire', 'Dragon']){
    const html = S.seloDoTipo(t);
    ok('  o selo de ' + t + ' sai na cor dele',
       html.indexOf(S.TYPE_COLORS[t]) >= 0 && html.indexOf('#s-' + S.SELO_DO_TIPO[t]) >= 0);
  }
  ok('  e um tipo desconhecido sai VAZIO, nunca com símbolo errado', S.seloDoTipo('Fada') === '');
}

console.log('\n=== E O BOTÃO DE ATAQUE SAI NA COR DO GOLPE ===');
{
  await partida(0, 1);
  const tipo = S.queimada.golpes[0].tipo;
  const html = S.renderQueimada();
  ok('o ATACAR leva a cor do tipo do golpe',
     html.indexOf('style="background:' + S.TYPE_COLORS[tipo] + '"') >= 0, tipo + ' = ' + S.TYPE_COLORS[tipo]);
  ok('  e o nome do golpe está nele', html.indexOf(S.queimada.golpes[0].nome) >= 0, S.queimada.golpes[0].nome);
  /* ⚠️ NOS DOIS, e contado: o ESPECIAL é o MESMO golpe, e com `indexOf` a trava daria verde
     com o selo removido de UM deles -- foi a conferência de acusação que mostrou isso. */
  ok('  e o selo do tipo está nos DOIS botões de ataque',
     html.split('#s-' + S.SELO_DO_TIPO[tipo]).length - 1 === 2,
     (html.split('#s-' + S.SELO_DO_TIPO[tipo]).length - 1) + ' selo(s)');
  /* ⚠️ O ESPECIAL É O MESMO GOLPE ×1,5, então ele leva a MESMA cor: o que o separa é a moldura. */
  ok('  e o ESPECIAL leva a mesma cor',
     html.split('style="background:' + S.TYPE_COLORS[tipo] + '"').length - 1 === 2);
  /* ⚠️ E O RECEBER NÃO PODE SER COR DE TIPO: com um golpe Elétrico ele ficava indistinguível do
     ATACAR -- `rgb(255,203,5)` ao lado de `rgb(248,208,48)` -- e os três botões viravam uma
     fileira amarela. */
  const receber = (src.match(/\.q-receber\{[^}]*\}/) || [''])[0];
  ok('o RECEBER não usa cor de tipo nenhuma',
     Object.values(S.TYPE_COLORS).every(c => receber.toLowerCase().indexOf(c.toLowerCase()) < 0),
     receber);
}

/* ============================================================================
   15) A TELA -- lendo o CSS, que é onde estas três coisas vivem
   ============================================================================ */
console.log('\n=== A TELA (lendo o CSS) ===');
{
  /* ⚠️ OS BOTÕES MORAM DENTRO DA CAIXA DA QUADRA: foi o pedido, e numa caixa própria eles ficavam
     a 40px do campo -- a mão tinha que viajar entre um toque e outro. */
  await partida(0, 0);
  const html = S.renderQueimada();
  const iQuadra = html.indexOf('q-quadra'), iAcoes = html.indexOf('q-acoes');
  const iFimQuadra = html.indexOf('<div class="box">', iQuadra);
  ok('os botões ficam DENTRO da caixa da quadra', iAcoes > iQuadra && iAcoes < iFimQuadra,
     'quadra em ' + iQuadra + ', ações em ' + iAcoes + ', caixa seguinte em ' + iFimQuadra);
  /* ⚠️ E O CARTAZ É ANCORADO NO CAMPO, não na caixa: com os botões dentro dela, o `top:44%`
     passou a medir uma caixa 25% mais alta e ele descia pra cima dos botões. */
  ok('  e o cartaz é ancorado no CAMPO', /\.q-campo\{[^}]*position:relative/.test(src)
     && html.indexOf('q-campo') > 0);
  ok('  e a caixa da quadra deixou de ser o âncora', !/\.q-quadra\{[^}]*position:relative/.test(src));

  /* ⚠️ A FONTE DO NOME É MAIOR E CENTRADA -- e isso só se lê no CSS, nunca numa asserção de HTML. */
  const nome = (src.match(/\.q-bt-nome\{[^}]*\}/) || [''])[0];
  ok('o nome do golpe é maior que o corpo do botão', /font-size:\.7[0-9]rem/.test(nome), nome);
  const acoes = (src.match(/\.q-acoes \.btn\{[^}]*\}/) || [''])[0];
  ok('  e o conteúdo do botão é centrado',
     acoes.indexOf('text-align:center') >= 0 && acoes.indexOf('align-items:center') >= 0, acoes);

  /* ⚠️ O PLACAR OCUPA O CARD INTEIRO, e a regra é ESCOPADA: o `.pesc-lado` é da PESCARIA, onde a
     informação fica mesmo à direita de um sprite. A causa do relato era o `.pesc-lado-info` não
     ter largura -- ele é uma coluna flex dimensionada pelo CONTEÚDO. */
  ok('as barras do placar ocupam o card',
     /\.q-placar \.pesc-lado-info\{[^}]*width:100%/.test(src)
     && /\.q-placar \.hp-bar-wrap\{[^}]*width:100%/.test(src));
  ok('  e tudo nele é centrado', /\.q-placar \.pesc-lado-info\{[^}]*text-align:center/.test(src));
  ok('  e a regra não encosta na Pescaria', src.indexOf('.q-placar .pesc-lado-info') > 0);
  ok('  e a tela pede a classe', html.indexOf('pesc-placar q-placar') > 0);
}
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
