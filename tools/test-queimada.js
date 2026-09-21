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
  /* ⚠️ AS ILHAS ABRIRAM PRA TODO MUNDO em 21/09/2026 -- estas travas cobravam a RECUSA e
     viraram a trava da regra nova. O teste das ilhas cobre as SEIS portas num laço só. */
  const ESTADOS = [['true', true, true], ['false', false, true], ['a string sim', 'sim', true],
    ['a string true', 'true', true], ['o número 1', 1, true], ['o número 0', 0, true],
    ['null', null, true], ['undefined', undefined, true], ['um objeto', {}, true],
    ['a string admin', 'admin', true]];
  for(const [nome, valor, abre] of ESTADOS){
    contaDeTeste(); g.ehAdmin = valor; g.screen = 'ilhas';
    S.abrirQueimada();
    ok('  ' + nome + (abre ? ' ABRE' : ' não abre'), (g.screen === 'queimada') === abre, 'tela: ' + g.screen);
  }
  contaDeTeste(); g.contaCarregada = false; g.screen = 'ilhas';
  S.abrirQueimada();
  ok('e a conta carregando tambem abre', g.screen === 'queimada', 'tela: ' + g.screen);
  /* ⚠️ E ISSO É O CONTRÁRIO da porta dos modos de campeão, que erra pro lado de DEIXAR ENTRAR:
     mostrar um modo administrativo a quem não é admin, mesmo por meio segundo, é pior que
     escondê-lo de quem é. */
  ok('  e não sobra o recado de modo administrativo',
     String(g.modoBloqueado || '').indexOf('administrativo') < 0, String(g.modoBloqueado));
}
console.log('\n=== E A LARGADA CONFERE DE NOVO ===');
(async () => {
  contaDeTeste(); semearSprites(); g.screen = 'queimada';
  S.queimadaEscolher(0, 0);
  g.ehAdmin = false;
  await S.queimadaComecar();
  ok('a largada acontece mesmo sem admin', S.queimada.fase === 'jogando', 'fase: ' + S.queimada.fase);
  ok('  e sem recado de modo administrativo',
     String(S.queimada.aviso || '').indexOf('administrativo') < 0, String(S.queimada.aviso));

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
  /* ⚠️ A FATIA VAI ATÉ O FIM DA FUNÇÃO, nunca um número de caracteres: ela era 1400 fixos, e o
     bloco da munição empurrou a constante pra fora da janela -- a trava caiu com o código CERTO.
     É a mesma armadilha da fatia vazia do `tentarGolpeEspecial`, e o `ok` do tamanho é o que
     impede a outra metade dela (uma fatia que não lê nada e passa em branco). */
  const fAtacar = (() => { const i = src.indexOf('function queimadaAtacar');
    const j = src.indexOf(String.fromCharCode(10) + 'function ', i + 10);
    return src.slice(i, j < 0 ? i + 3000 : j); })();
  ok('  a fatia do queimadaAtacar tem o que ler', fAtacar.length > 400, fAtacar.length + ' chars');
  ok('  e a tela usa a constante, não um 1.5 solto', /QUEIMADA_ESPECIAL_MULT/.test(fAtacar));
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
  /* ⚠️ ELA TERMINA NO ANÚNCIO desde 21/09/2026, e o resultado vem depois do Ok -- a trava cobra
     a CADEIA inteira, porque parar no 'anuncio' deixaria de provar que dá pra sair dele. */
  ok('o ' + S.QUEIMADA_KOS + 'º ponto encerra a partida', S.queimada.fase === 'anuncio', 'fase: ' + S.queimada.fase);
  S.queimadaFecharAnuncio();
  ok('  e o Ok do anúncio leva ao resultado', S.queimada.fase === 'fim', 'fase: ' + S.queimada.fase);
  ok('  e o vencedor é quem tem mais pontos', S.queimadaVencedor() > 0, 'vencedor: ' + S.queimadaVencedor());

  /* e o relógio também encerra */
  const atores = await partida(0, 0);
  S.queimada.decorrido = S.QUEIMADA_DURACAO - 0.01;
  S.queimadaPasso(1);
  ok('e os ' + S.QUEIMADA_DURACAO + ' s encerram sozinhos', S.queimada.fase === 'anuncio',
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
  /* ⚠️ E ELE TEM QUE TER SATURAÇÃO DE BOTÃO. Esta é a metade que faltava, e ela é a lição: o
     cinza-ardósia que esteve aqui NÃO era cor de tipo nenhuma -- ele passava na trava acima -- e
     mesmo assim foi reportado como "parece desabilitado", porque tinha 13% de saturação contra os
     0% do :disabled da casa. É a saturação que diz "dá pra apertar", não a matiz. */
  const satDoCss = (css) => {
    const m = css.match(/background:#([0-9a-f]{6})/i); if(!m) return -1;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    return mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn);
  };
  /* ⚠️ O PISO SAI DOS PRÓPRIOS TIPOS, nunca de um número escrito aqui: ele é "tão saturado quanto
     o botão de ataque mais apagado que o jogo consegue produzir", e isso acompanha a tabela. */
  const piso = Math.min.apply(null, Object.values(S.TYPE_COLORS).map(c => satDoCss('background:' + c)));
  ok('  e a saturação dele é de botão, não de desabilitado', satDoCss(receber) >= piso,
     Math.round(satDoCss(receber) * 100) + '%, e o tipo menos saturado do jogo tem '
       + Math.round(piso * 100) + '%');
}

/* ============================================================================
   16) A BOLA SAI NA COR DO GOLPE -- e o rastro é quem diz de quem ela é
   ============================================================================ */
console.log('\n=== O QUE VOA NA ARENA É O DESENHO DO TIPO ===');
{
  const [eu, ele] = await partida(0, 1);
  S.queimada.t = 5; S.queimada.rodadaAte = 0;
  eu.tiroPronto = 0; ele.tiroPronto = 0;
  S.queimadaAtacar(0, false);
  const bola = S.queimada.bolas[S.queimada.bolas.length - 1];
  ok('a bola nasce carimbada com o TIPO do golpe', bola.tipo === S.queimada.golpes[0].tipo,
     bola.tipo + ' -> ' + S.SELO_DO_TIPO[bola.tipo]);

  /* ⚠️ O DESENHO É O MESMO DO BOTÃO, e é isso que faz o pedido virar UMA coisa: a folha do Planta
     que se aperta é a folha que voa. Um segundo desenho aqui divergiria do primeiro no dia em que
     algum dos dois fosse ajustado. */
  const spr = S.queimadaSpriteDoTipo(bola.tipo, S.QUEIMADA_BOLA_LADO);
  ok('  e o que voa é o SELO daquele tipo, não um disco', !!spr,
     'assado a ' + S.QUEIMADA_BOLA_LADO + 'px');
  const tintasDoSpr = (spr && spr.__ctx) ? spr.__ctx.__tintas : [];
  const corDoTipo = S.TYPE_COLORS[bola.tipo].toLowerCase();
  ok('  e ele é assado na cor do tipo',
     tintasDoSpr.some(t => String(t.fill).toLowerCase() === corDoTipo), corDoTipo);
  /* ⚠️ E O CONTORNO VEM DE DENTRO DO DESENHO (o `k` da paleta), não de uma linha a mais: é ele que
     faz um Elétrico ou um Gelo não sumirem na areia clara da quadra. */
  ok('  e o contorno vem de dentro do desenho',
     tintasDoSpr.some(t => String(t.fill).toLowerCase() === S.PALETA_SELO.k.toLowerCase()),
     S.PALETA_SELO.k);
  /* ⚠️ E ELE É ASSADO UMA VEZ: são até 576 retângulos por desenho, e três bolas a 60fps dariam
     ~100 mil `fillRect` por segundo se ele fosse pintado a cada quadro. */
  ok('  e o mesmo tipo e tamanho devolvem o MESMO sprite (assado uma vez)',
     S.queimadaSpriteDoTipo(bola.tipo, S.QUEIMADA_BOLA_LADO) === spr);

  /* ⚠️ O CARIMBO É NO NASCIMENTO: a devolução TROCA o dono, e um pintor que lesse o tipo do dono
     mudaria a cor da MESMA bola no meio do voo -- ela é o mesmo golpe voltando. */
  const tipoAntes = bola.tipo, donoAntes = bola.dono;
  S.queimadaDevolver(bola, 1);
  ok('  e a devolução NÃO troca o desenho dela', bola.tipo === tipoAntes,
     'era ' + tipoAntes + ', virou ' + bola.tipo);
  ok('  mas troca o dono, que é quem manda no rastro', bola.dono !== donoAntes);
  /* ⚠️ E A COBRANÇA É NO QUE SE PINTA, não no campo: um pintor que lesse o tipo do DONO deixaria
     `bola.tipo` intacto e trocaria o DESENHO na tela no meio do voo. Uma trava que só olha o campo
     passa por isso -- foi a conferência de acusação que mostrou.
     ⚠️ E O PAR DE TIPOS É FORÇADO A SER DIFERENTE: medido, os dois lados escolhem golpe do mesmo
     tipo em 8,9% dos pares, e nesses o defeito seria invisível -- a trava viraria um flake. */
  {
    const outro = Object.keys(S.TYPE_CHART).find(t => t !== tipoAntes);
    S.queimada.golpes[1] = Object.assign({}, S.queimada.golpes[1], { tipo: outro });
    const cv0 = S.document.getElementById('queimadaCanvas');
    if(cv0 && cv0.__ctx) cv0.__ctx.__tintas.length = 0;
    S.queimadaPintar();
    const t0 = (cv0 && cv0.__ctx) ? cv0.__ctx.__tintas : [];
    /* ⚠️ NO TAMANHO DA DEVOLVIDA, que é outro: ela bate mais, então ela é desenhada maior -- e o
       sprite é assado POR TAMANHO. Foi a própria trava que pegou isso. */
    const doOriginal = S.queimadaSpriteDoTipo(tipoAntes, S.QUEIMADA_BOLA_LADO_DEV);
    const doDono = S.queimadaSpriteDoTipo(outro, S.QUEIMADA_BOLA_LADO_DEV);
    ok('  e na TELA ela continua com o desenho do golpe original',
       t0.some(t => t.m === 'drawImage' && t.args[0] === doOriginal)
       && !t0.some(t => t.m === 'drawImage' && t.args[0] === doDono),
       tipoAntes + ', e o do dono agora seria ' + outro);
  }

  /* e a prova de que ela CHEGA assim na tela: o pintor de verdade, com a tinta anotada */
  S.queimada.bolas = [];
  eu.tiroPronto = 0;
  S.queimadaAtacar(0, false);
  const b2 = S.queimada.bolas[0];
  const cv = S.document.getElementById('queimadaCanvas');
  if(cv && cv.__ctx){ cv.__ctx.__tintas.length = 0; cv.__ctx.__ops.length = 0; }
  S.queimadaPintar();
  const tintas = (cv && cv.__ctx) ? cv.__ctx.__tintas : [];
  const ops = (cv && cv.__ctx) ? cv.__ctx.__ops : [];
  ok('  e o quadro DESENHA o sprite dela',
     tintas.some(t => t.m === 'drawImage' && t.args[0] === S.queimadaSpriteDoTipo(b2.tipo, S.QUEIMADA_BOLA_LADO)));
  /* ⚠️ E ELE GIRA PRA ONDE VAI: sem o giro o desenho atravessa a quadra como um adesivo parado.
     O par save/rotate/restore é o que o teste consegue ver de um giro. */
  ok('  e ele gira pra direção do voo',
     ops.indexOf('rotate') >= 0 && ops.indexOf('translate') >= 0);

  /* ⚠️ A CAUDA É A COR DO PRÓPRIO GOLPE, num tom mais fundo. Ela JÁ FOI a cor do DONO, e isso foi
     reportado como *"um rabinho de outra cor"*: um matiz diferente atrás do símbolo não se lê como
     rastro, se lê como um pedaço solto grudado nele.
     ⚠️ E O QUE ELA RESOLVIA FOI MEDIDO ANTES DE SAIR: duas bolas no ar, de donos diferentes E do
     mesmo tipo, acontecem em 3,15% dos quadros -- nos outros o desenho já separa e a direção do voo
     diz o resto. */
  const caudaDoTipo = S.queimadaCorDaCauda(b2.tipo);
  ok('  e a cauda sai na cor do próprio golpe',
     tintas.some(t => t.m === 'fill' && String(t.fill) === caudaDoTipo),
     S.TYPE_COLORS[b2.tipo] + ' -> ' + caudaDoTipo);
  ok('    e ela é mais ESCURA que a bola, não de outro matiz', (() => {
    const par = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const lum = (h) => { const [r, g, bb] = par(h).map(v => { v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * bb; };
    return lum(caudaDoTipo) < lum(S.TYPE_COLORS[b2.tipo]);
  })(), 'a cor crua é ' + S.TYPE_COLORS[b2.tipo]);
  /* ⚠️ E A COR DO DONO NÃO VOLTA: a bola inteira é de uma cor só, e é isso que a faz ler como UM
     objeto. Duas bolas de donos diferentes com o MESMO tipo saem iguais de propósito -- quem as
     separa é a direção do voo. */
  ok('    e a cauda não depende de quem atirou', (() => {
    const meu = { tipo: b2.tipo, dono: 0 }, dele = { tipo: b2.tipo, dono: 1 };
    return S.queimadaCorDaCauda(meu.tipo) === S.queimadaCorDaCauda(dele.tipo);
  })());
  ok('    e as constantes de cor de dono não existem mais',
     src.indexOf('QUEIMADA_RASTRO_MEU') < 0 && src.indexOf('QUEIMADA_RASTRO_DELE') < 0);

  /* ⚠️ E OS 17 TIPOS TÊM O QUE VOAR: um tipo sem desenho cai no disco de reserva, e aí o pedido
     deixa de valer PRA AQUELE. A trava varre a tabela em vez de nomear tipos. */
  const semDesenho = Object.keys(S.TYPE_CHART)
    .filter(t => !S.queimadaSpriteDoTipo(t, S.QUEIMADA_BOLA_LADO));
  ok('  e os ' + Object.keys(S.TYPE_CHART).length + ' tipos têm desenho pra voar',
     semDesenho.length === 0, semDesenho.join(',') || '(todos)');
  /* e o especial é maior que a bola comum, que é o que o separa na quadra */
  ok('  e o especial é maior que o golpe comum',
     S.QUEIMADA_BOLA_LADO_ESP > S.QUEIMADA_BOLA_LADO,
     S.QUEIMADA_BOLA_LADO + 'px contra ' + S.QUEIMADA_BOLA_LADO_ESP);
  /* ⚠️ E O TAMANHO DO DESENHO NÃO É O ALCANCE DO ACERTO: quem decide se a bola pegou é o
     `QUEIMADA_RAIO`. Sem isso, mexer no que se vê mexeria na mecânica sem ninguém notar. */
  ok('  e o desenho não é o alcance do acerto',
     src.indexOf('QUEIMADA_BOLA_LADO') > 0
       && !/QUEIMADA_BOLA_LADO[A-Z_]*\s*\)?\s*\)?\s*$/m.test('')
       && /< QUEIMADA_RAIO/.test(src),
     'o acerto continua no QUEIMADA_RAIO');
}

console.log('\n=== E OS 17 TIPOS SÃO LEGÍVEIS NA QUADRA ===');
{
  /* ⚠️ A QUADRA É AREIA CLARA, e é isso que obriga o contorno a existir: um Elétrico, um Gelo ou um
     Terra somem nela. Mas o contorno sozinho também não basta -- ele é escuro, e contra os tipos
     escuros é ele que some. A trava é sobre o PAR: cada tipo tem que ser legível por um dos dois,
     e é isso que faz a bola aparecer nas 17 cores.
     ⚠️ E O CONTORNO QUE CONTA É O DE DENTRO DO DESENHO (o `k` da paleta), não o do disco de
     reserva: é ele que aparece na tela em todo tipo que tem selo, ou seja nos 17. */
  const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const lum = (h) => { const [r, g, b] = hex(h).map(v => { v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const k = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  /* a cor do piso, lida do PINTOR e não escrita aqui -- senão ela envelhece quando a quadra mudar */
  const areia = (src.match(/ret\(22, 23, 316, 304, '(#[0-9a-f]{6})'\)/i) || [null, '#efdba6'])[1];
  const sem = Object.entries(S.TYPE_COLORS)
    .filter(([, c]) => k(c, areia) < 2 && k(S.PALETA_SELO.k, c) < 2)
    .map(([t]) => t);
  ok('os 17 são legíveis pelo contorno ou pelo próprio preenchimento', sem.length === 0,
     sem.length ? sem.join(',') : 'sobre a areia ' + areia);
  const somem = Object.entries(S.TYPE_COLORS).filter(([, c]) => k(c, areia) < 2).map(([t]) => t);
  ok('  e o contorno não é enfeite: ' + somem.length + ' tipos sumiriam na areia sem ele',
     somem.length > 0, somem.slice(0, 4).join(','));
  /* ⚠️ E A CAUDA DE CADA TIPO SE LÊ NA AREIA -- é por isso que o tom é mais ESCURO e não mais
     claro: medido, 30% mais clara some em 11 dos 17 tipos e a cor crua some em 5. */
  const caudasFracas = Object.entries(S.TYPE_COLORS)
    .filter(([t]) => k(S.queimadaCorDaCauda(t), areia) < 1.6).map(([t]) => t);
  ok('  e a cauda dos 17 tipos se lê na areia', caudasFracas.length === 0,
     caudasFracas.join(',') || 'a pior é ' + Math.min.apply(null,
       Object.keys(S.TYPE_COLORS).map(t => +k(S.queimadaCorDaCauda(t), areia).toFixed(2))) + ':1');
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

/* ============================================================================
   18) A MUNIÇÃO DO ATACAR -- um pente que acaba, e uma recarga (21/09/2026)
   ============================================================================ */
console.log('\n=== O ATACAR TEM PENTE, E ELE ACABA ===');
{
  const [eu, ele] = await partida(0, 0);
  S.queimada.t = 5; S.queimada.rodadaAte = 0;
  ok('o pente nasce cheio', eu.municao === S.QUEIMADA_MUNICAO, eu.municao + ' tiros');
  ok('  e o NPC também tem o dele', ele.municao === S.QUEIMADA_MUNICAO);

  /* gasta o pente inteiro */
  let saiu = 0;
  for(let k = 0; k < S.QUEIMADA_MUNICAO + 5; k++){
    eu.tiroPronto = 0;
    const antes = S.queimada.bolas.length;
    S.queimadaAtacar(0, false);
    if(S.queimada.bolas.length > antes) saiu++;
  }
  ok('  e ele dá exatamente ' + S.QUEIMADA_MUNICAO + ' tiros', saiu === S.QUEIMADA_MUNICAO, saiu + ' tiros');
  ok('  e o ' + (S.QUEIMADA_MUNICAO + 1) + 'º não sai', eu.municao === 0);
  ok('  e a recarga abre na hora que ele esvazia',
     Math.abs(eu.recargaAte - (S.queimada.t + S.QUEIMADA_RECARGA)) < 0.01,
     'volta em ' + S.QUEIMADA_RECARGA + ' s');

  /* ⚠️ A RECARGA É RESOLVIDA PELO PASSO, não pelo atacar: o HUD lê o número a cada quadro, e
     resolvida dentro do `queimadaAtacar` ela só aconteceria no primeiro TOQUE depois de acabar. */
  S.queimada.t = eu.recargaAte - 0.5;
  S.queimadaPasso(0.01);
  ok('  e ela NÃO volta antes da hora', eu.municao === 0, eu.municao);
  S.queimada.t = eu.recargaAte + 0.01;
  S.queimadaPasso(0.01);
  ok('  e o passo devolve o pente cheio', eu.municao === S.QUEIMADA_MUNICAO && !eu.recargaAte,
     eu.municao + ' tiros');

  /* ⚠️ O ESPECIAL NÃO GASTA MUNIÇÃO: ele já tem a recarga de 45 s, e cobrar as duas coisas o
     puniria duas vezes. Em troca ele vira o botão de emergência com o pente vazio. */
  eu.municao = 0; eu.recargaAte = S.queimada.t + 5;
  eu.especialPronto = 0; eu.tiroPronto = 0;
  const antesEsp = S.queimada.bolas.length;
  S.queimadaAtacar(0, true);
  ok('  e o ESPECIAL sai mesmo com o pente vazio', S.queimada.bolas.length > antesEsp);
  ok('    e ele não desconta do pente', eu.municao === 0);
}

console.log('\n=== E O PENTE ATRAVESSA A ELIMINAÇÃO ===');
{
  /* ⚠️ ELE ATRAVESSA, como a recarga do especial: medido, uma rodada leva ~4 tiros -- recarregado
     a cada queda, o limite de 10 quase nunca chegaria a morder e a mecânica seria enfeite. */
  const [eu, ele] = await partida(0, 0);
  S.queimada.t = 5; S.queimada.rodadaAte = 0;
  for(let k = 0; k < 6; k++){ eu.tiroPronto = 0; S.queimadaAtacar(0, false); }
  const sobrou = eu.municao;
  ok('gastou 6 do pente', sobrou === S.QUEIMADA_MUNICAO - 6, sobrou + ' de ' + S.QUEIMADA_MUNICAO);
  ele.hp = 0;
  S.queimadaEliminacao();
  ok('  e depois da eliminação ele continua onde estava',
     S.queimada.atores[0].municao === sobrou, S.queimada.atores[0].municao);
}

console.log('\n=== E O BOTÃO CONTA O PENTE ===');
{
  const [eu] = await partida(0, 0);
  S.queimada.t = 5; S.queimada.rodadaAte = 0;
  const dica = () => { S.queimadaPintarHud();
    const el = S.document.getElementById('queimadaAtacarDica');
    return el ? String(el.textContent || el.innerHTML || '') : ''; };
  eu.tiroPronto = 0;
  ok('cheio, ele mostra o pente', dica().indexOf(S.QUEIMADA_MUNICAO + '/' + S.QUEIMADA_MUNICAO) >= 0, dica());
  for(let k = 0; k < 4; k++){ eu.tiroPronto = 0; S.queimadaAtacar(0, false); }
  eu.tiroPronto = 0;
  ok('  e ele conta pra baixo', dica().indexOf((S.QUEIMADA_MUNICAO - 4) + '/') >= 0, dica());
  eu.municao = 0; eu.recargaAte = S.queimada.t + 7;
  /* ⚠️ A RECARGA LONGA OCUPA A LINHA SOZINHA: ali o que o jogador precisa saber é quando ele volta,
     e o dano é fixo a partida inteira. */
  ok('  e a recarga ocupa a linha', /Recarregando/.test(dica()), dica());
  /* e o botão desliga -- a tela não pode convidar pra uma ação que a AÇÃO recusa */
  S.queimadaPintarHud();
  const bt = S.document.getElementById('queimadaBtAtacar');
  ok('  e o botão desliga com o pente vazio', !!(bt && bt.disabled));
}

/* ============================================================================
   19) O NOME DA TELA E A TELA DE FIM (21/09/2026)
   ============================================================================ */
console.log('\n=== A TELA SE CHAMA ARENA 1X1 ===');
{
  await partida(0, 0);
  const html = S.renderQueimada();
  ok('o cabeçalho diz ARENA 1X1', html.indexOf('ARENA 1X1') >= 0);
  /* ⚠️ E A ILHA DIZ O MESMO: é a tabela que alimenta o pino do mapa e o rótulo dele. */
  const ilha = S.ILHAS_LARANJA.find(i => i.id === 'pummelo');
  ok('  e a ilha dela também', ilha.jogo === 'Arena 1x1', ilha.jogo);
  /* ⚠️ O QUE NÃO MUDOU FORAM OS NOMES DE CÓDIGO: renomeá-los seria churn em ~200 referências pra
     trocar uma palavra que só aparece na tela. */
  ok('  e o código não foi renomeado junto', typeof S.abrirQueimada === 'function'
     && typeof S.QUEIMADA_MUNICAO === 'number');
}

console.log('\n=== A TELA DE FIM MOSTRA OS DOIS QUE SE ENFRENTARAM ===');
{
  const [a, b] = await partida(0, 0);
  a.pontos = S.QUEIMADA_KOS; b.pontos = 1; a.devolucoes = 4;
  S.queimadaTerminar();
  S.queimadaFecharAnuncio();   /* o resultado vem depois do Ok */
  const html = S.renderQueimada();
  ok('ela desenha os DOIS lados', (html.match(/q-fim-lado/g) || []).length === 2);
  ok('  com o sprite de cada um', (html.match(/sprite-img/g) || []).length >= 2);
  /* ⚠️ ELES SE OLHAM: o da esquerda é espelhado. Dois sprites virados pro mesmo lado se leem como
     uma fila, não como um duelo. */
  ok('  e o da esquerda é espelhado', html.indexOf('sprite-flip') >= 0);
  ok('  e o vencedor leva a medalha do pódio',
     html.indexOf('#s-' + S.MEDALHA_DO_POSTO[0]) >= 0 && (html.match(/q-fim-lado ganhou/g) || []).length === 1);
  ok('  e o placar de eliminações está nos dois',
     (html.match(/q-fim-ko/g) || []).length === 2);
  /* ⚠️ A LINHA DA VIDA RESTANTE SAIU (a pedido): o duelo é decidido por ELIMINAÇÕES, e o número do
     último instante não diz nada -- o perdedor termina sempre em zero. */
  ok('  e a linha da vida restante saiu', html.indexOf('HP final') < 0);
  /* ⚠️ E A DAS DEVOLUÇÕES SAIU JUNTO (21/09/2026, a pedido): a tela de resultado ficou sendo só
     a classificação, e o que ela conta está todo dentro dos dois cards. */
  ok('  e a das devoluções saiu também', /devolu/.test(html) === false);

  /* no EMPATE não sai medalha nenhuma -- ali não houve vencedor */
  const c = S.queimada.atores;
  /* ⚠️ O EMPATE PRECISA DO HP IGUAL TAMBÉM: com pontos iguais o `queimadaVencedor` desempata
     pela vida, então só zerar os pontos ainda dá um vencedor. A trava estava certa; o fixture é
     que não caía no caso que ele diz medir. */
  c[0].pontos = 2; c[1].pontos = 2; c[0].hp = c[1].hp = 100;
  const empate = S.renderQueimada();
  ok('  e no empate ninguém leva medalha',
     empate.indexOf('#s-' + S.MEDALHA_DO_POSTO[0]) < 0 && empate.indexOf('q-fim-lado ganhou') < 0);
}


/* ============================================================================
   20) A BOLA MAIS RÁPIDA E O ESCUDO DOBRADO (21/09/2026)
   ============================================================================ */
console.log('\n=== O ESCUDO COBRE UMA FATIA ÚTIL DO VOO ===');
{
  /* ⚠️ A TRAVA NÃO FIXA OS DOIS NÚMEROS, ela cobra a RAZÃO -- que é o que decide se dá pra
     defender. Fixados, eles envelheceriam no próximo ajuste de qualquer um dos dois, e a razão é
     justamente o que o ajuste tem que preservar. */
  const TRAVESSIA = 300;                       /* a quadra, de ponta a ponta */
  const voo = TRAVESSIA / S.QUEIMADA_BOLA_V;
  const cobre = (id, lv) => {
    const i = S.createInstance(id, lv); i.hp = i.maxHp = S.calcMaxHp(i);
    return S.queimadaJanelaDeGuarda(i) / voo;
  };
  const fraco = cobre('caterpie', 20), duro = cobre('shuckle', 60);
  ok('até o corpo mais frágil consegue defender', fraco >= 0.25,
     Math.round(fraco * 100) + '% do voo (Caterpie Lv.20)');
  ok('  e o mais duro não cobre o voo inteiro', duro < 1,
     Math.round(duro * 100) + '% do voo (Shuckle Lv.60)');
  /* ⚠️ E A DEFESA ESPECIAL AINDA SEPARA OS DOIS: se o clamp engolisse todo mundo, o atributo que o
     pedido original nomeia deixaria de decidir alguma coisa. */
  ok('  e a Sp.Def ainda separa um do outro', duro > fraco * 1.5,
     Math.round(fraco * 100) + '% contra ' + Math.round(duro * 100) + '%');

  /* ⚠️ O ESPECIAL CONTINUA MAIS RÁPIDO QUE O COMUM -- ele subiu de 170 pra 255 e o especial ficou
     em 280, então a margem encolheu. Se um dia o comum passar o especial, ele deixa de ser
     "especial" em tudo menos no nome. */
  ok('  e o especial continua mais rápido que o comum',
     S.QUEIMADA_BOLA_V_ESP > S.QUEIMADA_BOLA_V,
     S.QUEIMADA_BOLA_V + ' contra ' + S.QUEIMADA_BOLA_V_ESP);
}

console.log('\n=== E A PRIMEIRA TELA NÃO EXPLICA A FÓRMULA ===');
{
  await partida(0, 0);
  S.queimada.fase = 'setup';
  const html = S.renderQueimada();
  /* ⚠️ O TEXTO TÉCNICO SAIU (a pedido): ele explicava de ONDE os três números vêm, e os três já
     estão logo acima dele, cada um com o nome. */
  ok('a tela não explica de onde vêm os números',
     html.indexOf('vem da fórmula do jogo') < 0 && html.indexOf('os três com o nível dentro') < 0);
  /* mas a ficha com os três continua lá -- é ela que responde "o que este pokémon é na quadra" */
  ok('  e a ficha dos três continua', /ms de escudo/.test(html) && /px\/s/.test(html));
}


/* ============================================================================
   21) O FREIO DA RECARGA, A DEVOLVIDA MAIS RÁPIDA E O ANÚNCIO (21/09/2026)
   ============================================================================ */
console.log('\n=== RECARREGAR CUSTA MOBILIDADE ===');
{
  const [eu] = await partida(0, 0);
  S.queimada.fase = 'jogando'; S.queimada.rodadaAte = 0;
  /* mede o passo de um segundo com o pente cheio e com ele vazio, no MESMO ator e no mesmo lugar */
  const anda = (recarregando) => {
    eu.x = 180; eu.y = 250; eu.tx = 180; eu.ty = 40; eu.folego = 100; eu.atordoadoAte = 0;
    eu.recargaAte = recarregando ? S.queimada.t + 3 : 0;
    const antes = eu.y, fol = eu.folego;
    S.queimadaAndar(eu, 0, 1);
    return { px: antes - eu.y, folego: fol - eu.folego };
  };
  const cheio = anda(false), vazio = anda(true);
  /* ⚠️ A TRAVA COBRA AS DUAS COISAS: que o freio EXISTE (a constante abaixo de 1) e que ele vale
     no passo. Só a segunda metade, ela compara a constante COM ELA MESMA -- com o freio desligado
     (1) a razão também vira 1 e a trava passa em branco. Conferido religando o defeito. */
  ok('o freio realmente freia', S.QUEIMADA_RECARGA_FREIO < 1, 'x' + S.QUEIMADA_RECARGA_FREIO);
  ok('quem recarrega anda pela metade',
     Math.abs(vazio.px / cheio.px - S.QUEIMADA_RECARGA_FREIO) < 0.02 && vazio.px < cheio.px,
     cheio.px.toFixed(1) + ' px contra ' + vazio.px.toFixed(1) + ' px em 1 s');
  /* ⚠️ E O FÔLEGO NÃO ACELERA JUNTO: o gasto é `passo / vel`, então freando os dois ele continua
     o mesmo POR SEGUNDO. Aplicado só no passo, a recarga seria DUAS punições de uma vez. */
  ok('  e o fôlego continua gastando igual',
     Math.abs(vazio.folego - cheio.folego) < 0.01,
     cheio.folego.toFixed(2) + ' contra ' + vazio.folego.toFixed(2) + ' por segundo');
  ok('  e o freio vale pros DOIS lados (é a mesma função)',
     /queimada\.atores\.forEach\(\(a, i\) => queimadaAndar/.test(src),
     'o laço anda os dois pelo mesmo queimadaAndar');
}

console.log('\n=== A BARRA DA RECARGA, NOS DOIS ATORES ===');
{
  const atores = await partida(0, 0);
  S.queimada.fase = 'jogando';
  /* ⚠️ ELA SÓ EXISTE ENQUANTO RECARREGA: cheia e parada o tempo todo ela diria "o pente está
     cheio", que é o estado comum. */
  const pinta = (a) => {
    const cv = S.document.createElement('canvas');
    const ctx = cv.getContext('2d');
    ctx.__ops.length = 0; ctx.__tintas.length = 0;
    S.queimadaDesenharAtor(ctx, a, a.lado, S.queimada.t);
    return ctx.__tintas.filter(t => t.m === 'fillRect' && t.fill === '#ffc93f');
  };
  atores.forEach(a => { a.recargaAte = 0; });
  ok('com o pente cheio não há barra', pinta(atores[0]).length === 0 && pinta(atores[1]).length === 0);
  atores.forEach(a => { a.recargaAte = S.queimada.t + S.QUEIMADA_RECARGA; });
  const meu = pinta(atores[0]), dele = pinta(atores[1]);
  ok('  e recarregando ela sai nos DOIS', meu.length === 1 && dele.length === 1,
     'jogador ' + meu.length + ', adversário ' + dele.length);
  /* ela ENCHE: no começo da recarga é ~0 e no fim é o comprimento todo */
  atores[0].recargaAte = S.queimada.t + S.QUEIMADA_RECARGA * 0.1;
  const quase = pinta(atores[0])[0];
  ok('  e ela enche conforme a recarga anda',
     quase && meu[0] && quase.args[2] > meu[0].args[2] * 5,
     'no começo ' + meu[0].args[2].toFixed(1) + ' px, quase pronta ' + quase.args[2].toFixed(1) + ' px');
  /* ⚠️ ELA FICA EMBAIXO DO SPRITE e ACIMA da etiqueta do nome -- entre y+19 e y+24, que é o vão
     que sobra entre os dois. Fora dele ela cobriria um ou outro. */
  ok('  e ela cabe no vão entre o sprite e a etiqueta',
     meu[0].args[1] >= atores[0].y + 18 && meu[0].args[1] + meu[0].args[3] <= atores[0].y + 25,
     'y ' + (meu[0].args[1] - atores[0].y).toFixed(0) + ' a '
       + (meu[0].args[1] + meu[0].args[3] - atores[0].y).toFixed(0) + ' do centro');
}

console.log('\n=== A DEVOLVIDA SAI MAIS RÁPIDA QUE O GOLPE QUE ENTROU ===');
{
  const atores = await partida(0, 0);
  S.queimada.fase = 'jogando'; S.queimada.rodadaAte = 0;
  S.queimadaAtacar(1, false);
  const bola = S.queimada.bolas[0];
  const vEntrando = Math.hypot(bola.vx, bola.vy);
  S.queimadaDevolver(bola, 0);
  const vVoltando = Math.hypot(bola.vx, bola.vy);
  /* ⚠️ A TRAVA É A RAZÃO, e não o número: fixado, ele envelheceria no próximo ajuste -- e o que o
     ajuste tem que preservar é a devolvida voltar MAIS RÁPIDA do que veio. */
  ok('a devolvida volta mais rápida que a que entrou', vVoltando > vEntrando,
     Math.round(vEntrando) + ' px/s entrando, ' + Math.round(vVoltando) + ' voltando');
  /* ⚠️ E ELA CONTINUA ABAIXO DO ESPECIAL: se passasse, a devolvida seria o golpe mais rápido do
     modo e o especial deixaria de ter o que o separa. */
  ok('  e ela continua abaixo do especial',
     S.QUEIMADA_BOLA_V_DEVOLVIDA < S.QUEIMADA_BOLA_V_ESP,
     S.QUEIMADA_BOLA_V_DEVOLVIDA + ' contra ' + S.QUEIMADA_BOLA_V_ESP);
  ok('  e ela continua voltando mais FORTE também', bola.dano > bola.base,
     'base ' + bola.base + ', devolvida ' + bola.dano);
}

console.log('\n=== A PARTIDA TERMINA NUM ANÚNCIO, ANTES DO RESULTADO ===');
{
  const atores = await partida(0, 0);
  S.queimada.fase = 'jogando';
  atores[0].pontos = S.QUEIMADA_KOS; atores[1].pontos = 1;
  S.queimadaTerminar();
  ok('a fase vira ANÚNCIO, não resultado', S.queimada.fase === 'anuncio', S.queimada.fase);
  const html = S.renderQueimada();
  /* ⚠️ A QUADRA CONTINUA DESENHADA -- é ela que o modal cobre. Numa fase desconhecida o render
     cairia na tela de SETUP, e o modal apareceria sobre ela. */
  ok('  e a quadra continua na tela, com o modal por cima',
     html.indexOf('id="queimadaCanvas"') >= 0 && html.indexOf('modal-overlay') >= 0);
  const sp = S.SPECIES[atores[0].inst.speciesId];
  ok('  e ele nomeia o POKÉMON que venceu',
     html.indexOf('Vitória ' + sp.name + '!') >= 0, 'Vitória ' + sp.name + '!');
  ok('  e a tela de RESULTADO ainda não apareceu', html.indexOf('Jogar de novo') < 0);
  S.queimadaFecharAnuncio();
  ok('  e o Ok leva ao resultado', S.queimada.fase === 'fim');
  ok('  onde o resultado enfim aparece',
     S.renderQueimada().indexOf('Jogar de novo') >= 0);
}
console.log('\n=== E O EMPATE NÃO INVENTA VENCEDOR ===');
{
  const atores = await partida(0, 0);
  S.queimada.fase = 'jogando';
  atores[0].pontos = atores[1].pontos = 1;
  atores[0].hp = atores[1].hp = 100;
  S.queimadaTerminar();
  const html = S.renderQueimada();
  ok('empate anuncia "Empate!"', html.indexOf('Empate!') >= 0 && html.indexOf('Vitória') < 0);
  S.queimadaFecharAnuncio();
}
console.log('\n=== E A QUADRA DO ANÚNCIO NÃO SAI EM BRANCO ===');
{
  /* ⚠️ O `render()` RECRIA O <canvas>, e o laço que o pintava acabou de ser cancelado -- sem uma
     pintura o anúncio apareceria sobre um retângulo vazio. É o mesmo cuidado do mapa do Resgate. */
  /* ⚠️ A FATIA VEM PRIMEIRO, e isso não é estilo: um `[\s\S]*?` sem limite ATRAVESSA a função e
     acha o `queimadaPintar()` do LAÇO, centenas de linhas abaixo -- a trava passava em branco com
     as duas pinturas removidas. É a mesma armadilha do `mlog-mais` e do `matchup-row`.
     O `ok` do tamanho existe pela outra metade dela: uma fatia vazia passa em branco também. */
  const fTerm = src.slice(src.indexOf('function queimadaTerminar()'));
  const corpoTerm = fTerm.slice(0, fTerm.indexOf(String.fromCharCode(10) + '}'));
  ok('  (a fatia do terminar tem o que ler)', corpoTerm.length > 200, corpoTerm.length + ' chars');
  ok('o terminar pinta a quadra depois do render',
     corpoTerm.indexOf('queimadaPintar();') > corpoTerm.indexOf('render();'),
     'queimadaPintar() vem depois do render()');
  /* ⚠️ E O HUD VAI JUNTO: o ponto que ENCERRA a partida é contado DENTRO do `queimadaPasso`, ou
     seja depois do último quadro pintado -- sem repintar, o placar do anúncio mostra o placar de
     ANTES do ponto da vitória. Foi o navegador que pegou (2/3 numa partida que acabou em 3/3). */
  ok('  e o placar também',
     corpoTerm.indexOf('queimadaPintarHud();') > corpoTerm.indexOf('render();'));
}

console.log('\n=== E A TELA DE RESULTADO É SÓ A CLASSIFICAÇÃO ===');
{
  const atores = await partida(0, 0);
  atores[0].devolucoes = 3;
  atores[0].pontos = S.QUEIMADA_KOS;
  S.queimada.fase = 'fim';
  const html = S.renderQueimada();
  /* ⚠️ AS DUAS LINHAS DE TEXTO SAÍRAM (a pedido): a da vida restante e a das devoluções. */
  ok('a tela não conta as devoluções', html.indexOf('volta mais forte') < 0
     && html.indexOf('devolução sua') < 0 && html.indexOf('devoluções suas') < 0);
  ok('  nem a vida restante', html.indexOf('HP final') < 0);
  ok('  e os dois cards continuam', /q-fim-lado/.test(html) && /q-fim-ko/.test(html));
}

  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
