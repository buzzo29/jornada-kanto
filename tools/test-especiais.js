/**
 * OS GOLPES ESPECIAIS -- autodestruicao, sono e metronomo.
 *
 * Por que isso existe: sao os primeiros efeitos do jogo que NAO sao dano, e eles vivem no motor de
 * batalha, que e DUPLICADO (cliente e servidor). Uma diferenca de uma linha entre os dois faz a
 * liga decidir uma coisa e a animacao mostrar outra -- e o jogador so descobre isso quando perde
 * uma final. Por isso a ultima secao compara os dois motores golpe a golpe, com a mesma semente.
 *
 * Trancado aqui: as listas (que saem do aprendizado por NIVEL da Gen 1/2), as chances, o efeito de
 * cada golpe, quem ganha quando os dois ultimos caem juntos, a imunidade dos chefes, e a mensagem
 * na tela.
 *
 *   node tools/test-especiais.js
 */
const path = require('path');
const Module = require('module');
const raiz = path.join(__dirname, '..');
const { createSandbox } = require('./game-sandbox');
const S = createSandbox();

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const inst = (id, lv) => S.createInstance(id, lv || 50);
// rng de teste: devolve os numeros que a gente mandar, e depois 0.99 (nada acontece)
/* rng que sempre devolve o mesmo numero: com 0.01 todo sorteio de chance passa, com 0.99 nenhum.
   Mais legivel que uma sequencia -- a ordem em que o motor consome os numeros nao importa aqui. */
const rngFixo = (v) => () => v;

console.log('\nAS LISTAS SAO DO APRENDIZADO POR NIVEL DA GEN 1/2');
ok('9 especies aprendem autodestruicao', S.AUTODESTRUICAO.length === 9, S.AUTODESTRUICAO.join(', '));
ok('e sao as certas (Geodude/Voltorb/Koffing/Pineco e evolucoes)',
   ['geodude','graveler','golem','voltorb','electrode','koffing','weezing','pineco','forretress']
     .every(id => S.AUTODESTRUICAO.includes(id)));
ok('43 especies tem golpe de sono', Object.keys(S.SONIFEROS).length === 43, Object.keys(S.SONIFEROS).length + '');
ok('cada uma com o NOME do golpe dela',
   S.SONIFEROS.paras === 'Esporo' && S.SONIFEROS.jigglypuff === 'Canto' &&
   S.SONIFEROS.gengar === 'Hipnose' && S.SONIFEROS.oddish === 'Pó do Sono' && S.SONIFEROS.jynx === 'Beijo Adorável');
ok('metronomo e o quarteto pedido', S.METRONOMO.join(',') === 'togepi,togetic,cleffa,snubbull');
/* Especie que nao existe no SPECIES seria um golpe que nunca sai -- e ninguem perceberia. */
const foraDaTabela = [...S.AUTODESTRUICAO, ...Object.keys(S.SONIFEROS), ...S.METRONOMO].filter(id => !S.SPECIES[id]);
ok('nenhuma especie das listas esta fora do SPECIES', foraDaTabela.length === 0, foraDaTabela.join(','));

console.log('\nO QUE CADA GOLPE FAZ');
/* AUTODESTRUICAO: os dois caem. E o unico caminho do jogo em que isso acontece -- o doExchange
   normal sempre deixa um de pe (o desempate). */
let a = inst('geodude'), b = inst('onix');
a.maxHp = S.calcMaxHp(a); a.hp = a.maxHp; b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
let diario = [];
ok('explodiu: o confronto se resolve ali', S.tentarGolpeEspecial(a, b, rngFixo(0.01), diario) === true);
ok('e os dois caem na hora', a.hp === 0 && b.hp === 0, 'a=' + a.hp + ' b=' + b.hp);
ok('o log ganha a linha da explosao', diario.some(g => g.x === 'boom' && g.g === 'auto-destruição'));

/* SONO: o alvo passa DUAS TROCAS sem revidar e depois acorda -- a luta segue normal.
   Ja foi abate instantaneo, e os jogadores reclamaram com razao: nao era o numero que pesava
   (medido, valia +1,4 ponto de vitoria contra +0,8 do Recuperar), era a FORMA -- perder um pokemon
   inteiro pra um sorteio de 5%, sem jogada possivel e sem tomar um golpe.
   Medido depois da mudanca: o ganho cai de +1,4 pra +0,7 ponto. */
a = inst('jigglypuff'); b = inst('onix');
a.maxHp = S.calcMaxHp(a); a.hp = a.maxHp; b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
const hpAntes = a.hp;
diario = [];
ok('dormiu: o confronto NAO se resolve ali', S.tentarGolpeEspecial(a, b, rngFixo(0.01), diario) === false);
ok('ninguem cai por causa do sono', b.hp === b.maxHp && a.hp === hpAntes, 'a=' + a.hp + ' b=' + b.hp);
ok('e o alvo fica marcado por 2 trocas', b._dormindoPor === 2, 'dormindoPor: ' + b._dormindoPor);
ok('e o log diz qual golpe foi', diario.some(g => g.x === 'sono' && g.g === 'Canto'));
/* QUEM DORME NAO ATACA -- e nao vira linha no log. Uma linha de "-0 de HP" faria o log dizer que
   ele atacou e nao machucou, quando o que aconteceu foi ele nao ter atacado. */
(function(){
  let comSono = null;
  for(let i=0;i<30000 && !comSono;i++){
    const r = S.simulateGymBattle([inst('paras',60)], [inst('onix',60)], Math.random);
    const m = (r.matchups||[])[0];
    if(m && (m.golpes||[]).some(g=>g.x==='sono')) comSono = m;
  }
  ok('achei um confronto com sono', !!comSono);
  if(!comSono) return;
  const golpes = comSono.golpes.filter(g=>!g.x);
  ok('nenhuma linha de dano zero no registro', golpes.every(g=>g.d > 0),
     golpes.map(g=>g.d).join(','));
  /* As DUAS primeiras trocas depois do sono sao so do lado de quem usou. */
  const doisPrimeiros = golpes.slice(0,2);
  ok('os dois primeiros golpes sao de quem usou o sono',
     doisPrimeiros.every(g => g.q === 'p'), doisPrimeiros.map(g=>g.q).join(','));
})();
/* E o alvo pode SOBREVIVER e ganhar -- o que antes era impossivel. */
(function(){
  let venceuDepoisDeDormir = 0, total = 0;
  for(let i=0;i<20000;i++){
    const r = S.simulateGymBattle([inst('jigglypuff',60)], [inst('snorlax',60)], Math.random);
    const m = (r.matchups||[])[0];
    if(!m || !(m.golpes||[]).some(g=>g.x==='sono')) continue;
    total++;
    if(!m.playerWon) venceuDepoisDeDormir++;
  }
  ok('quem dorme pode acordar e VENCER o confronto', total > 0 && venceuDepoisDeDormir > 0,
     venceuDepoisDeDormir + ' de ' + total + ' (antes era 0 -- o sono matava na hora)');
})();
/* O LOG NAO PODE SE CONTRADIZER: em confronto longo a reconstrucao nao sabe do sono e comecava
   pelo golpe de quem tinha acabado de dormir. */
(function(){
  let longo = null;
  for(let i=0;i<30000 && !longo;i++){
    const r = S.simulateGymBattle([inst('jigglypuff',60)], [inst('snorlax',60)], Math.random);
    const m = (r.matchups||[])[0];
    if(m && (m.golpes||[]).some(g=>g.x==='sono') && (m.golpes||[]).filter(g=>!g.x).length > 3) longo = m;
  }
  ok('achei um confronto longo com sono', !!longo);
  if(!longo) return;
  const seq = S.sequenciaDoConfronto(longo);
  const sono = seq.find(g=>g.x==='sono');
  ok('o sono sobrevive ao teto de golpes', !!sono);
  ok('e vem primeiro', seq[0].x === 'sono');
  ok('e quem dormiu NAO ataca logo depois de dormir', seq[1] && seq[1].q === sono.q,
     seq.map(g=>(g.x||'golpe')+':'+g.q).join(' '));
})();
/* O LOG MOSTRA O DIARIO INTEIRO -- e a animacao mostra o mesmo.
   Havia um teto de 3 golpes, e ele estava errado por um numero: 99,4% dos confrontos passam de 3
   (mediana 4, maior 28), entao quase todo log que o jogador lia era uma divisao INVENTADA pela
   reconstrucao, nao a luta dele. Foi de la que sairam os dois defeitos de sono reportados em
   03/09/2026: a reconstrucao nao conhece os golpes especiais, entao ora invertia a ordem, ora
   esmagava os golpes livres de quem dormiu o outro num golpe so.
   Mostrando o diario nao ha o que contradizer -- e este bloco tranca as consequencias disso, que
   sao coisas que o teto escondia. */
(function(){
  const POOL = Object.keys(S.SPECIES).filter(id => S.SPECIES[id].dex <= 251);
  const rng = S.makeSeededRng('log-diario');
  const ehDano = x => !x.x || x.x === 'boom' || x.x === 'boomself';
  const TETO_ESPERADO = 3;
  let confrontos = 0, animDif = 0, somaErrada = 0, comZero = 0, caiuDefeito = 0;
  let comSono = 0, sonoOk = 0, exZero = null, exAnim = null, exCaiu = null;
  let passouDoTeto = 0, maiorComSono = 0, exTeto = null;
  for(let i = 0; i < 4000; i++){
    const a = POOL[Math.floor(rng()*POOL.length)], b = POOL[Math.floor(rng()*POOL.length)];
    const r = S.simulateGymBattle([inst(a, 30 + Math.floor(rng()*40))], [inst(b, 30 + Math.floor(rng()*40))], Math.random);
    for(const m of (r.matchups || [])){
      if(!(m.golpes||[]).length) continue;
      confrontos++;
      const seq = S.sequenciaDoConfronto(m);
      const desc = () => seq.map(x=>(x.x?'['+x.x+']':'')+x.q+':'+(x.d||0)).join(' ');

      /* 1) O PEDIDO DO JOGADOR: a animacao tem que ter EXATAMENTE os passos do log, inclusive as
            aberturas (sono e cura). Enquanto eram montadas em separado, ele via 3 golpes na tela e
            lia 7 linhas -- reportado tres vezes. */
      if(S.buildAnimatedHitSequence(m).length !== seq.length){ animDif++; if(!exAnim) exAnim = desc(); }

      /* 2) A soma de cada lado bate com o HP perdido. E o contrato do log desde sempre: somando as
            linhas nao pode dar mais dano do que o pokemon tinha. */
      const soma = { p:0, e:0 };
      seq.filter(ehDano).forEach(x => { soma[x.q] += x.d || 0; });
      if(soma.p !== Math.max(0, m.enemyHpBefore - m.enemyHpAfter) ||
         soma.e !== Math.max(0, m.playerHpBefore - m.playerHpAfter)) somaErrada++;

      /* 3) NENHUM GOLPE DE DANO ZERO. Ele existe no diario -- e o revide de quem caiu contra quem
            ja tinha caido, e o dano EFETIVO ali e 0 -- e viraria um "-0 de HP" na tela, que e
            exatamente o que faz procurar bug onde e regra. O teto escondia: aparecia em 0,50% dos
            confrontos. */
      const zeros = seq.filter(g => ehDano(g) && !(g.d > 0));
      if(zeros.length){ comZero++; if(!exZero) exZero = desc(); }

      /* 4) NINGUEM ATACA DEPOIS DE CAIR, tirando os dois casos que a casa aceita: a EXPLOSAO (um
            evento so, com duas entradas, porque os dois caem juntos) e o GOLPE MORIBUNDO, que entra
            ANTES do golpe que derrubou quem o deu -- os dois sao do mesmo instante, e alguem sempre
            vai parecer agir depois de cair; a regra escolhe que seja o golpe que MATOU. */
      let hpP = m.playerHpBefore, hpE = m.enemyHpBefore;
      const cura = seq.find(x => x.x === 'recover');
      if(cura){ if(cura.q === 'p') hpP = cura.hp; else hpE = cura.hp; }
      const lista = seq.filter(ehDano);
      const caiuEm = { p:-1, e:-1 };
      for(let k = 0; k < lista.length; k++){
        const g = lista[k];
        if((g.q === 'p' ? hpP : hpE) <= 0){
          if(g.x === 'boomself') break;
          if(caiuEm[g.q] === k - 1) break;    // o par do moribundo
          caiuDefeito++; if(!exCaiu) exCaiu = desc();
          break;
        }
        if(g.q === 'p'){ hpE = Math.max(0, hpE - (g.d||0)); if(hpE === 0 && caiuEm.e < 0) caiuEm.e = k; }
        else { hpP = Math.max(0, hpP - (g.d||0)); if(hpP === 0 && caiuEm.p < 0) caiuEm.p = k; }
      }

      /* 5) O SONO: as trocas livres que ele compra aparecem. Nao se exige igualdade exata com o
            diario porque o moribundo pode ser movido pra frente e cruzar a fronteira -- o que se
            exige e o que o sono garante. */
      const sono = (m.golpes||[]).find(x => x.x === 'sono');
      if(sono){
        comSono++;
        const real = (m.golpes||[]).filter(ehDano), log = lista;
        const iR = real.findIndex(x => x.q !== sono.q), iL = log.findIndex(x => x.q !== sono.q);
        const livresReais = iR < 0 ? real.length : iR, livresLog = iL < 0 ? log.length : iL;
        if(livresLog >= Math.min(livresReais, S.SONO_EM_TROCAS || 2)) sonoOk++;
      }
      /* 6) QUANTAS LINHAS. Luta comum tem que caber em duas ou tres -- e a leitura que o jogo
            sempre teve. Sem teto, uma troca banal de Gloom contra Miltank virava seis linhas, e foi
            o que apareceu na tela no dia em que o teto saiu inteiro (03/09/2026).
            COM SONO pode passar, e so por causa das trocas livres: elas sao o que o golpe E, e
            esmaga-las na reconstrucao foi a origem dos dois defeitos reportados naquele dia. */
      const linhas = lista.length;
      if(sono){ if(linhas > maiorComSono) maiorComSono = linhas; }
      else if(linhas > TETO_ESPERADO){ passouDoTeto++; if(!exTeto) exTeto = desc(); }
      break;
    }
  }
  ok('confrontos de sobra pra medir', confrontos > 2000, confrontos + ' (' + comSono + ' com sono)');
  ok('a animacao tem os MESMOS passos do log', animDif === 0, animDif + ' de ' + confrontos + (exAnim ? '  |  ' + exAnim : ''));
  ok('a soma de dano de cada lado fecha', somaErrada === 0, somaErrada + ' de ' + confrontos);
  ok('nenhum golpe de dano zero na tela', comZero === 0, comZero + ' de ' + confrontos + (exZero ? '  |  ' + exZero : ''));
  ok('ninguem ataca depois de cair (fora explosao e moribundo)', caiuDefeito === 0,
     caiuDefeito + ' de ' + confrontos + (exCaiu ? '  |  ' + exCaiu : ''));
  ok('o sono mostra as trocas livres que ele compra', sonoOk === comSono, sonoOk + ' de ' + comSono);
  ok('luta SEM golpe especial nao passa de 3 linhas', passouDoTeto === 0,
     passouDoTeto + ' de ' + (confrontos - comSono) + (exTeto ? '  |  ' + exTeto : ''));
  ok('e a com sono passa, que e o motivo da excecao', maiorComSono > TETO_ESPERADO,
     'maior confronto com sono: ' + maiorComSono + ' linhas');
})();

/* Quem nao tem golpe especial nunca cai nesse caminho. */
a = inst('pidgey'); b = inst('onix');
let nenhum = 0;
for(let i=0;i<2000;i++){ if(S.tentarGolpeEspecial(inst('pidgey'), inst('onix'), Math.random, [])) nenhum++; }
ok('quem nao tem o golpe nunca usa', nenhum === 0, nenhum + ' de 2000');

console.log('\nAS CHANCES SAO AS PEDIDAS');
/* O ALVO PRECISA TER VIDA DE VERDADE: a autodestruicao so sai contra alvo com mais de 50% do HP,
   e o createInstance devolve maxHp/hp zerados (quem enche e o simulateGymBattle). Sem encher aqui,
   a medicao da explosao dava 0% -- e o zero seria lido como 'a lista quebrou'. */
function cheio(p){ p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; return p; }
function frequencia(id, alvo, n){
  let boom = 0, sono = 0;
  for(let i=0;i<n;i++){
    const d = [];
    S.tentarGolpeEspecial(cheio(inst(id)), cheio(inst(alvo)), Math.random, d);
    if(d.some(g=>g.x==='boom')) boom++;
    if(d.some(g=>g.x==='sono')) sono++;
  }
  return { boom: boom/n, sono: sono/n };
}
const fGeo = frequencia('geodude', 'onix', 6000);
ok('autodestruicao perto de 15%', Math.abs(fGeo.boom - 0.15) < 0.02, (fGeo.boom*100).toFixed(1) + '%');
const fJig = frequencia('jigglypuff', 'onix', 6000);
ok('sono perto de 5%', Math.abs(fJig.sono - 0.05) < 0.015, (fJig.sono*100).toFixed(1) + '%');
const fTog = frequencia('togepi', 'onix', 6000);
ok('metronomo: ~10% de cada efeito',
   Math.abs(fTog.boom - 0.10) < 0.02 && Math.abs(fTog.sono - 0.10) < 0.02,
   'explosao ' + (fTog.boom*100).toFixed(1) + '%, sono ' + (fTog.sono*100).toFixed(1) + '%');
/* O metronomo tambem sorteia o TIPO do golpe: e o que faz dele uma aposta e nao um upgrade. */
const tipos = new Set();
for(let i=0;i<400;i++){ tipos.add(S.tipoDoGolpe(inst('togepi'), inst('onix'), Math.random).type); }
ok('e o tipo do golpe dele sai no sorteio', tipos.size > 5, tipos.size + ' tipos diferentes em 400 golpes');
const tipoFixo = new Set();
for(let i=0;i<50;i++){ tipoFixo.add(S.tipoDoGolpe(inst('pidgey'), inst('onix'), Math.random).type); }
ok('e o resto do jogo continua escolhendo o melhor golpe', tipoFixo.size === 1, [...tipoFixo].join(','));

console.log('\nOS CHEFES SAO IMUNES');
/* Sem isso um Geodude nivel 20 derrubaria o Mew de 25.125 de HP da raide com 15% de chance. */
let contraChefe = 0;
for(let i=0;i<3000;i++){
  if(S.tentarGolpeEspecial(inst('geodude'), inst('mewtwo', 99), Math.random, [])) contraChefe++;
}
ok('nada de explodir o Mewtwo', contraChefe === 0, contraChefe + ' de 3000');

console.log('\nQUEM GANHA QUANDO OS DOIS ULTIMOS CAEM');
/* A regra pedida: quem explodiu leva a batalha. Sem ela o jogador PERDIA justamente a batalha que
   decidiu explodindo, porque o laco so olha "sobrou alguem do meu lado?". */
let vitoriasPorExplosao = 0, batalhas = 0;
for(let i=0;i<3000;i++){
  const r = S.simulateGymBattle([inst('geodude')], [inst('onix')], Math.random);
  const explodiu = (r.matchups||[]).some(m => (m.golpes||[]).some(g=>g.x==='boom'));
  if(explodiu){ batalhas++; if(r.win) vitoriasPorExplosao++; }
}
ok('explodindo no ultimo de cada lado, quem explodiu vence',
   batalhas > 0 && vitoriasPorExplosao === batalhas,
   vitoriasPorExplosao + ' de ' + batalhas + ' explosoes viraram vitoria');

console.log('\nDISABLE: O MELHOR GOLPE SAI DE CENA');
ok('17 especies aprendem Disable por nivel', S.DISABLE.length === 17, S.DISABLE.length + '');
ok('as do Gen 1 estao la (Psyduck, Kadabra, Slowpoke, Grimer, Lickitung)',
   ['psyduck','golduck','kadabra','alakazam','slowpoke','slowbro','grimer','muk','lickitung']
     .every(id => S.DISABLE.includes(id)));
ok('e as que so a Gen 2 deu (Jigglypuff, Venonat, Drowzee, Slowking)',
   ['jigglypuff','wigglytuff','venonat','venomoth','drowzee','hypno','slowking']
     .every(id => S.DISABLE.includes(id)));
/* Vulpix e Ninetales aprendem Disable SO por reproducao -- a regra destas listas e nivel. */
ok('quem so aprende por reproducao ficou de fora',
   !['vulpix','ninetales','nidoranf','seel','kangaskhan','horsea','spinarak','stantler']
     .some(id => S.DISABLE.includes(id)));
/* O Mewtwo aprende nas duas geracoes, mas e imune ao bloco INTEIRO: a entrada seria letra morta. */
ok('o Mewtwo nao entra (ja e imune ao bloco inteiro)', !S.DISABLE.includes('mewtwo'));
ok('nenhuma esta fora do SPECIES', S.DISABLE.filter(id => !S.SPECIES[id]).length === 0);

/* O EFEITO: o tipo que rende mais some da escolha e sobra o segundo. */
const gengar = inst('gengar'), alaka = inst('alakazam'), onix2 = inst('onix');
const melhorAntes = S.bestAttackType(gengar, alaka).type;
gengar._anulado = { tipo: melhorAntes, contra: alaka };
const melhorDepois = S.bestAttackType(gengar, alaka).type;
ok('o melhor golpe deixa de ser escolhido', melhorDepois !== melhorAntes, melhorAntes + ' -> ' + melhorDepois);
ok('e o que entra e um golpe que ele tem mesmo', S.tiposDeAtaque(gengar).includes(melhorDepois));
/* A anulacao vale so contra quem anulou: adversario novo, confronto novo. */
ok('contra OUTRO adversario o golpe volta', S.bestAttackType(gengar, onix2).type === S.bestAttackType(inst('gengar'), onix2).type);

/* Quem tem um tipo de ataque so nao tem o que anular -- e o sorteio simplesmente nao vale. */
const monoTipo = Object.keys(S.SPECIES).find(id => S.tiposDeAtaque(inst(id)).length === 1);
let anulouMono = 0;
for(let i=0;i<600;i++){
  const alvo = inst(monoTipo);
  S.tentarGolpeEspecial(inst('alakazam'), alvo, rngFixo(0.01), []);
  if(alvo._anulado) anulouMono++;
}
ok('quem tem um golpe so nunca e anulado', anulouMono === 0, S.SPECIES[monoTipo].name + ': ' + anulouMono + ' de 600');

/* Ao contrario dos outros dois, o Disable NAO resolve o confronto -- a luta acontece inteira.
   A vitima aqui e um Charizard de proposito: um Gengar responderia com Hipnose (ele esta no
   SONIFEROS) e o confronto acabaria ali -- pelo sono, nao pelo Disable. */
const vitima = inst('charizard'), anulador = inst('alakazam');
vitima.maxHp = S.calcMaxHp(vitima); vitima.hp = vitima.maxHp;
anulador.maxHp = S.calcMaxHp(anulador); anulador.hp = anulador.maxHp;
const dRegistro = [];
const resolveu = S.tentarGolpeEspecial(anulador, vitima, rngFixo(0.01), dRegistro);
ok('o Disable nao encerra o confronto', resolveu === false);
ok('ninguem cai por causa dele', vitima.hp === vitima.maxHp && anulador.hp === anulador.maxHp);
ok('e o alvo fica marcado', !!vitima._anulado && vitima._anulado.contra === anulador);
ok('o log ganha a linha da anulacao', dRegistro.some(g => g.x === 'disable' && g.d === 0));
/* E o outro lado ainda pode usar o especial DELE na mesma abertura: anular nao consome o
   confronto. Um Gengar anulado responde com Hipnose e resolve a luta ali mesmo. */
let anulouEDormiu = 0;
for(let i=0;i<600;i++){
  const g2 = inst('gengar'), a2 = inst('alakazam');
  g2.maxHp = S.calcMaxHp(g2); g2.hp = g2.maxHp; a2.maxHp = S.calcMaxHp(a2); a2.hp = a2.maxHp;
  const d2 = [];
  S.tentarGolpeEspecial(a2, g2, rngFixo(0.01), d2);
  if(g2._anulado && d2.some(x => x.x === 'sono')) anulouEDormiu++;
}
ok('depois de anular, o outro lado ainda joga o especial dele', anulouEDormiu === 600, anulouEDormiu + ' de 600');

console.log('\nA CHANCE DO DISABLE');
function taxaDisable(id, alvoId, n){
  let c = 0;
  for(let i=0;i<n;i++){
    const alvo = inst(alvoId);
    S.tentarGolpeEspecial(inst(id), alvo, Math.random, []);
    if(alvo._anulado) c++;
  }
  return c/n;
}
const tAlaka = taxaDisable('alakazam', 'gengar', 6000);
ok('Disable perto de 10%', Math.abs(tAlaka - 0.10) < 0.02, (tAlaka*100).toFixed(1) + '%');
/* A Jigglypuff tem Canto E Disable: o sono e sorteado antes, entao a taxa efetiva do Disable
   dela e 0,95 x 0,10. Se um dia isso mudar, e aqui que aparece. */
const tJig = taxaDisable('jigglypuff', 'gengar', 6000);
ok('quem tem sono E Disable cai na taxa composta', Math.abs(tJig - 0.095) < 0.02, (tJig*100).toFixed(1) + '%');

console.log('\nAS FRASES SAO AS PEDIDAS');
/* As tres frases exatas do pedido. O log e o aviso do meio da batalha leem da MESMA funcao --
   se um dia divergirem, e aqui que se ve. */
const mBoom = { player:'Golem', enemy:'Raichu', playerSpecies:'golem', enemySpecies:'raichu',
  golpes:[{ q:'p', d:100, hp:0, x:'boom', g:'auto-destruição' }, { q:'e', d:80, hp:0, x:'boomself' }] };
const htmlBoom = S.passosHtml(mBoom);
ok('explosao: "Golem usou auto-destruicao"', /usou <span class="type-pill"[^>]*>auto-destruição</.test(htmlBoom), '');
ok('e uma linha so (o "caiu junto" nao vira outra)', (htmlBoom.match(/class="mlog-passo /g)||[]).length === 1);
ok('o aviso do meio da batalha diz o mesmo',
   S.avisoDoConfronto(mBoom) === '💥 Golem usou auto-destruição!', S.avisoDoConfronto(mBoom));

const mSono = { player:'Butterfree', enemy:'Arbok', playerSpecies:'butterfree', enemySpecies:'arbok',
  golpes:[{ q:'p', d:100, hp:0, x:'sono', g:'Pó do Sono' }] };
ok('sono: "Butterfree fez Arbok dormir"',
   S.avisoDoConfronto(mSono) === '😴 Butterfree fez Arbok dormir!', S.avisoDoConfronto(mSono));
/* No log cabe o nome do golpe -- ele e por especie de proposito (o Paras dorme com Esporo). */
ok('e no log ainda da pra ver com que golpe', /dormir com <span class="type-pill"[^>]*>Pó do Sono</.test(S.passosHtml(mSono)));

const mDis = { player:'Alakazam', enemy:'Gengar', playerSpecies:'alakazam', enemySpecies:'gengar',
  golpes:[{ q:'p', d:0, hp:120, x:'disable', g:'Anulação' }, { q:'p', d:40, hp:80 }, { q:'e', d:30, hp:90 }] };
ok('disable: "Gengar teve seu melhor ataque anulado por Alakazam"',
   S.avisoDoConfronto(mDis) === '🚫 Gengar teve seu melhor ataque anulado por Alakazam!', S.avisoDoConfronto(mDis));
/* O Disable nao pode virar um golpe de dano 0 na animacao nem gastar vaga do teto de 3 golpes:
   com ele contando, uma troca real de 2 golpes estouraria o teto e o log inteiro cairia na
   reconstrucao, perdendo os golpes de verdade. */
const seq = S.sequenciaDoConfronto(mDis);
ok('e ele nao entra na sequencia de golpes', seq.length === 2 && !seq.some(g=>g.x==='disable'), seq.length + ' passos');
const htmlDis = S.passosHtml(mDis);
ok('mas a linha dele aparece no log, e vem primeiro',
   htmlDis.indexOf('anulado por') > 0 && htmlDis.indexOf('anulado por') < htmlDis.indexOf('atacou'));

/* Sem golpe especial, a linha e a de sempre -- e o aviso nao aparece. */
ok('confronto comum nao ganha aviso', S.avisoDoConfronto({ player:'A', enemy:'B', golpes:[{q:'p',d:10,hp:5}] }) === '');
ok('e a pausa de leitura so existe quando ha o que ler',
   S.pausaDoEspecial(mBoom) === 1000 && S.pausaDoEspecial({ golpes:[{q:'p',d:10}] }) === 0);

console.log('\nDITTO: O GOLPE ACOMPANHA A TRANSFORMACAO');
/* A tela ja mostrava o sprite do adversario desde sempre; o golpe passou a acompanhar. Ele SOMA os
   tipos do alvo aos dele em vez de trocar -- trocar foi medido e saia pela culatra (o Normal e 1x
   em quase tudo, e no espelho um monte de tipo resiste a si mesmo), piorando justamente o pokemon
   mais fraco do jogo. */
(function(){
  const alvo = (id) => inst(id);
  const golpe = (id) => S.bestAttackType(inst('ditto'), alvo(id));
  const g1 = golpe('gengar');
  ok('contra um Fantasma ele ataca de Fantasma', g1.type === 'Ghost' && g1.mult === 2, g1.type + ' x' + g1.mult);
  const g2 = golpe('onix');
  ok('contra Pedra/Terra ele ataca de Terra', g2.type === 'Ground' && g2.mult === 2, g2.type + ' x' + g2.mult);
  const g3 = golpe('dragonite');
  ok('contra Dragao ele ataca de Dragao', g3.type === 'Dragon', g3.type + ' x' + g3.mult);
  /* O tipo copiado vale como PROPRIO: ele E a copia, entao tem STAB e nao paga redutor de subtipo. */
  ok('e o golpe copiado tem STAB', g1.stab && g2.stab && g3.stab);
  /* NAO TROCA, SOMA: contra um Psiquico, Psiquico seria 0,5x e o Normal dele rende mais. */
  const g4 = golpe('alakazam');
  ok('mas ele mantem o golpe dele quando o copiado e pior', g4.type === 'Normal', g4.type + ' x' + g4.mult);
  /* No EMPATE ganha a copia -- senao contra um Charizard ele atacava de Investida (Voador e Normal
     dao o mesmo dano ali) e a transformacao nao aparecia na tela. */
  const g5 = golpe('charizard');
  ok('no empate ganha o golpe da copia', g5.type !== 'Normal', g5.type);
  /* O nome do golpe existe pra todo tipo que ele possa copiar -- senao a linha do log sai sem golpe. */
  const semNome = Object.keys(S.TYPE_CHART).filter(tp => !S.nomeDoGolpe('ditto', tp));
  ok('e todo tipo copiado tem nome de golpe', semNome.length === 0, semNome.join(',') || 'todos tem');
  /* Ninguem mais copia nada: a regra e do Ditto, e so. */
  const outro = S.bestAttackType(inst('pikachu'), alvo('gengar'));
  ok('e so o Ditto copia', S.tiposDeAtaque(inst('pikachu'), alvo('gengar')).join(',') ===
     S.tiposDeAtaque(inst('pikachu')).join(','), outro.type);
  /* Ele copia SO o ataque: atributos e o tipo que ele apresenta continuam sendo dele. */
  const d = inst('ditto');
  ok('os atributos continuam sendo os dele', d.attack === 48 && (d.types||[]).join(',') === 'Normal',
     'atk ' + d.attack + ', tipo ' + (d.types||[]).join(','));
})();
console.log('\nO SELO DO TIPO NO NOME DO GOLPE');
/* O tipo foi PESQUISADO no aprendizado da Gen 1, e a intuicao erra aqui: autodestruicao e NORMAL,
   nao Terra nem Pedra. So os dois pos sao Planta e a Hipnose e Psiquico. */
ok('a autodestruicao sai no selo de Normal', S.TIPO_DO_ESPECIAL['auto-destruição'] === 'Normal');
ok('os dois pos saem no de Planta',
   S.TIPO_DO_ESPECIAL['Pó do Sono'] === 'Grass' && S.TIPO_DO_ESPECIAL['Esporo'] === 'Grass');
ok('e a Hipnose no de Psiquico', S.TIPO_DO_ESPECIAL['Hipnose'] === 'Psychic');
/* Todo golpe que o motor sabe gerar precisa de tipo -- sem ele o selo sai num cinza generico e
   ninguem percebe, porque so aparece no confronto que teve aquele golpe. */
const nomesPossiveis = [...new Set(['auto-destruição', ...Object.values(S.SONIFEROS), 'Anulação',
  'Metrônomo', 'Metrônomo (auto-destruição)', 'Metrônomo (sonífero)', 'Metrônomo (anulação)'])];
const semTipo = nomesPossiveis.filter(n => !S.TIPO_DO_ESPECIAL[n]);
ok('todo golpe especial tem tipo declarado', semTipo.length === 0, semTipo.join(',') || nomesPossiveis.length + ' golpes');

console.log('\nO DISABLE NOMEIA O GOLPE ANULADO');
/* O que interessa e o que o pokemon PERDEU, nao o nome da anulacao. O motor manda o TIPO e o
   cliente vira em palavra, como no resto do log -- e o selo e o do golpe perdido, entao um
   Nevasca sai no azul do Gelo e nao no bege do Normal. */
const mAnul = { player:'Venomoth', enemy:'Jynx', playerSpecies:'venomoth', enemySpecies:'jynx',
  playerHpBefore:180, playerHpAfter:140, playerMaxHp:180, enemyHpBefore:200, enemyHpAfter:0, enemyMaxHp:200,
  playerMove:'Bug', enemyMove:'Ice',
  golpes:[{ q:'p', d:0, hp:200, x:'disable', g:'Anulação', a:'Ice' }, { q:'p', d:200, hp:0 }, { q:'e', d:40, hp:140 }] };
ok('o aviso diz QUAL golpe foi anulado',
   S.avisoDoConfronto(mAnul) === '🚫 Jynx teve o ataque Nevasca anulado por Venomoth!', S.avisoDoConfronto(mAnul));
ok('e no log ele vem no selo do tipo DELE',
   S.passosHtml(mAnul).includes('teve o ataque <span class="type-pill" style="background:' +
                                S.TYPE_COLORS['Ice'] + '">Nevasca</span> anulado'));
/* Confronto gravado ANTES do campo existir cai na frase generica -- log velho nao pode sumir. */
const semCampo = mAnul.golpes.map(g => { const c = Object.assign({}, g); delete c.a; return c; });
const mVelho = Object.assign({}, mAnul, { golpes: semCampo });
ok('e log antigo, sem o campo, cai na frase generica',
   S.avisoDoConfronto(mVelho) === '🚫 Jynx teve seu melhor ataque anulado por Venomoth!', S.avisoDoConfronto(mVelho));

console.log('\nA FICHA DA POKEDEX DIZ QUE ESPECIAL A ESPECIE TEM');
/* E a unica coisa que uma especie faz em batalha que os seis numeros nao contam: um Geodude e um
   Graveler de atributo parecido jogam diferente porque um deles explode. */
ok('lista o especial da especie',
   S.especiaisDaEspecie('golem').map(e=>e.nome).join(',') === 'auto-destruição' &&
   S.especiaisDaEspecie('oddish').map(e=>e.nome).join(',') === 'Pó do Sono,Absorver',
   S.especiaisDaEspecie('oddish').map(e=>e.nome).join(','));
ok('e os DOIS de quem tem dois',
   S.especiaisDaEspecie('jigglypuff').map(e=>e.nome).join(' + ') === 'Canto + Anulação',
   S.especiaisDaEspecie('jigglypuff').map(e=>e.nome).join(' + '));
/* O Paras tem Esporo E Sanguessuga -- ele aprende os dois por nivel na Gen 1. */
ok('e o Paras, que dorme E drena',
   S.especiaisDaEspecie('paras').map(e=>e.nome).join(' + ') === 'Esporo + Sanguessuga',
   S.especiaisDaEspecie('paras').map(e=>e.nome).join(' + '));
ok('quem nao tem nenhum nao ganha linha nenhuma', S.especiaisDaEspecie('pikachu').length === 0);
/* A chance vem junto porque ela e POR CONFRONTO: so o nome deixaria o jogador achar que sai todo golpe. */
ok('com a chance junto', S.especiaisDaEspecie('golem')[0].chance === S.CHANCE_AUTODESTRUICAO);
ok('e com o tipo, pro selo', S.especiaisDaEspecie('paras')[0].tipo === 'Grass');
/* Ninguem das quatro listas pode ficar de fora da ficha -- seria um golpe invisivel. */
const todasComEspecial = new Set([...S.AUTODESTRUICAO, ...Object.keys(S.SONIFEROS), ...S.DISABLE,
                                  ...S.METRONOMO, ...Object.keys(S.ABSORCAO)]);
const semFicha = [...todasComEspecial].filter(id => S.especiaisDaEspecie(id).length === 0);
ok('e toda especie das quatro listas aparece', semFicha.length === 0,
   semFicha.join(',') || todasComEspecial.size + ' especies');
console.log('\nA FAIXA DE FOCO NAO PODE SER FURADA POR CAMINHO NENHUM');
/* REPORTADO em 04/09/2026: "equipei o charizard com Faixa de foco e ele morreu direto quando
   chegou com 0 de hp". A causa era a AUTODESTRUICAO -- ela zera o HP dentro do
   tentarGolpeEspecial, sem passar pelos dois pontos do doExchange onde a Faixa vigiava.
   Este teste nao olha um caminho especifico: ele afirma o INVARIANTE. Quem carrega a Faixa nunca
   pode terminar um confronto em 0 sem ela ter disparado antes. Qualquer caminho novo que zere HP
   -- um golpe especial futuro, uma regra nova -- cai aqui. */
(function(){
  const IDS = Object.keys(S.SPECIES);
  let furos = 0, disparou = 0, exemplos = [];
  for(let i = 0; i < 6000; i++){
    const meu = [S.createInstance('charizard', 55)];
    for(let k = 0; k < 5; k++) meu.push(S.createInstance(IDS[(i*7+k) % IDS.length], 55));
    S.equiparItens(meu, { charmander:'faixa_foco' });
    /* O adversario e mais forte de proposito: e assim que a Faixa e posta a prova. */
    const dele = [];
    for(let k = 0; k < 6; k++) dele.push(S.createInstance(IDS[(i*13+k) % IDS.length], 62));
    S.equiparItens(dele, null);
    const r = S.simulateGymBattle(meu, dele, Math.random);
    const usou = (r.matchups||[]).some(m => (m.golpes||[]).some(g => g.x === 'faixa'));
    const caiu = (r.playerStatus||[]).some(p => p.speciesId === 'charizard' && p.fainted);
    if(usou) disparou++;
    if(caiu && !usou){
      furos++;
      if(exemplos.length < 3){
        const m = (r.matchups||[]).find(x => x.playerSpecies === 'charizard' && x.playerHpAfter <= 0);
        exemplos.push(m ? (m.golpes||[]).map(g => g.x || 'golpe').join(',') : 'sem matchup');
      }
    }
  }
  ok('a Faixa dispara quando o Charizard ia cair', disparou > 5000, disparou + ' de 6000');
  ok('e NENHUM caminho a fura', furos === 0, furos + ' furos | ' + exemplos.join(' | '));

  /* O CASO QUE FUROU: a autodestruicao. Isolado, pra a causa ficar nomeada no teste. */
  let segurouBoom = 0, morreuNoBoom = 0;
  for(let i = 0; i < 4000; i++){
    const meu = [S.createInstance('charizard', 55)];
    S.equiparItens(meu, { charmander:'faixa_foco' });
    const r = S.simulateGymBattle(meu, [S.createInstance('golem', 60)], Math.random);
    const g = ((r.matchups||[])[0]||{}).golpes || [];
    if(!g.some(x => x.x === 'boom')) continue;
    if(g.some(x => x.x === 'faixa')) segurouBoom++; else morreuNoBoom++;
  }
  ok('a Faixa segura a AUTODESTRUICAO', segurouBoom > 100, segurouBoom + ' explosoes seguradas');
  ok('e nunca deixa passar uma', morreuNoBoom === 0, morreuNoBoom + '');

  /* O LOG TEM QUE CONTAR A HISTORIA -- e nao contava. REPORTADO em 04/09/2026 com print: o log
     dizia, em tres linhas reconstruidas, que o Charizard tomou 388 de 388 de HP, e embaixo que a
     Faixa o segurou com 1. As duas coisas na mesma tela.
     A causa eram DUAS: a reconstrucao (teto de 3) esmagava os golpes DEPOIS da Faixa, que sao o que
     ela compra; e a linha dela era um rodape solto no fim, longe do golpe que ela segurou.
     Hoje o confronto com Faixa mostra os golpes REAIS (a segunda excecao ao teto, como o sono) e a
     linha cai logo DEPOIS do golpe que ela segurou. */
  {
    let m = null;
    for(let i = 0; i < 4000 && !m; i++){
      const meu = [S.createInstance('charizard', 56)];
      S.equiparItens(meu, { charmander:'faixa_foco' });
      const r = S.simulateGymBattle(meu, [S.createInstance('electabuzz', 54)], Math.random);
      const x = (r.matchups||[])[0];
      if(x && (x.golpes||[]).some(g => g.x === 'faixa') && x.playerHpAfter <= 0) m = x;
    }
    ok('reproduzi o confronto do print (Faixa, e ele cai depois)', !!m);
    if(m){
      const seq = S.sequenciaDoConfronto(m);
      const iFaixa = seq.findIndex(g => g.x === 'faixa');
      ok('a Faixa esta NO MEIO da sequencia, nao no fim', iFaixa > 0 && iFaixa < seq.length - 1,
         'posicao ' + iFaixa + ' de ' + seq.length);
      /* O ULTIMO GOLPE DA METADE 1 e o que ia matar: ele bate no carregador. */
      ok('o golpe antes dela e contra o Charizard', seq[iFaixa-1] && seq[iFaixa-1].q === 'e',
         JSON.stringify(seq[iFaixa-1]));
      /* E DEPOIS DELA e o CHARIZARD quem ataca primeiro -- a metade 2 e uma luta nova em que ele
         entra fraco, e a reconstrucao da o primeiro golpe a quem entra abaixo de 50%. */
      ok('e depois dela quem ataca primeiro e o Charizard',
         seq[iFaixa+1] && seq[iFaixa+1].q === 'p', JSON.stringify(seq[iFaixa+1]));
      /* A SOMA CONTINUA FECHANDO: o log nao pode dizer que ele tomou mais do que tinha. A explosao
         conta junto (ela tem x='boom' mas E dano). */
      const tomou = seq.filter(g => (!g.x || g.x === 'boom') && g.q === 'e').reduce((a, g) => a + g.d, 0);
      ok('e a soma do dano fecha com o HP dele', tomou === m.playerHpBefore - m.playerHpAfter,
         tomou + ' de ' + (m.playerHpBefore - m.playerHpAfter));
      /* AS DUAS METADES RESPEITAM O TETO. E o pedido: a luta corre normal ate ele chegar a zero, a
         Faixa o devolve a 1, e o que vem depois se le como uma luta nova -- cada uma com o mesmo
         teto de 3 golpes de sempre. */
      const metade1 = seq.slice(0, iFaixa).filter(g => !g.x).length;
      const metade2 = seq.slice(iFaixa+1).filter(g => !g.x).length;
      ok('a metade 1 cabe no teto de 3', metade1 <= 3 && metade1 >= 1, metade1 + ' golpes');
      ok('e a metade 2 tambem', metade2 <= 3, metade2 + ' golpes');
      /* LOG E ANIMACAO CONTINUAM LENDO A MESMA LISTA -- a regra da casa. */
      ok('e a animacao tem os MESMOS passos', S.buildAnimatedHitSequence(m).length === seq.length,
         S.buildAnimatedHitSequence(m).length + ' vs ' + seq.length);
      /* A linha aparece UMA vez, no meio do log. */
      const linhas = S.passosHtml(m).split('</div>').filter(x => x.includes('mlog-passo'));
      const iLinha = linhas.findIndex(l => /Faixa de Foco segurou/.test(l));
      ok('o log mostra a linha da Faixa no meio', iLinha > 0 && iLinha < linhas.length - 1,
         'linha ' + iLinha + ' de ' + linhas.length);
    }

    /* O TAMANHO, que foi o motivo de a versao anterior (golpes reais, sem teto) ser desfeita: ela
       custava 7 linhas na maioria e ate 14 na cauda. Partido em duas metades, o teto volta a valer
       nas duas: no maximo 3 + a linha + 3. */
    {
      const IDS2 = Object.keys(S.SPECIES);
      let n = 0, maior = 0, somaErrada = 0, foraDePosicao = 0;
      for(let i = 0; i < 3000; i++){
        const meu = [S.createInstance(IDS2[(i*11) % IDS2.length], 58)];
        S.equiparItens(meu, { [S.raizDaLinha(meu[0].speciesId)]:'faixa_foco' });
        const r = S.simulateGymBattle(meu, [S.createInstance(IDS2[(i*17) % IDS2.length], 62)], Math.random);
        for(const x of (r.matchups||[])){
          if(!(x.golpes||[]).some(g => g.x === 'faixa')) continue;
          n++;
          const s = S.sequenciaDoConfronto(x);
          maior = Math.max(maior, s.filter(g => g.x !== 'boomself' && g.x !== 'absorbdano').length);
          const tomou = s.filter(g => (!g.x || g.x === 'boom') && g.q === 'e').reduce((a, g) => a + g.d, 0);
          if(tomou !== x.playerHpBefore - x.playerHpAfter) somaErrada++;
          if(s.findIndex(g => g.x === 'faixa') <= 0) foraDePosicao++;
        }
      }
      ok('nenhum confronto com Faixa passa de 8 linhas', maior <= 8, 'maior: ' + maior + ' em ' + n);
      /* A soma fecha SEMPRE -- inclusive quando a morte subita ressuscita quem carregava a Faixa
         acima de 1, caso em que a metade 2 nao tem como mostrar vida subindo e o ultimo golpe
         contra ele e aparado (o mesmo que o desempate ja faz no diario). */
      ok('e a soma do dano fecha em TODOS', somaErrada === 0, somaErrada + ' de ' + n);
      ok('e a Faixa nunca abre a sequencia', foraDePosicao === 0, foraDePosicao + '');
    }
  }

  /* QUEM EXPLODIU NAO E SALVO: o dano e dele mesmo, e salva-lo faria da autodestruicao um "mate o
     outro e sobreviva" -- ela deixaria de ter preco. */
  let explosorSobreviveu = 0;
  for(let i = 0; i < 4000; i++){
    const meu = [S.createInstance('golem', 55)];
    S.equiparItens(meu, { geodude:'faixa_foco' });
    const r = S.simulateGymBattle(meu, [S.createInstance('rhydon', 60)], Math.random);
    const g = ((r.matchups||[])[0]||{}).golpes || [];
    /* boom com q='p' = fomos NOS que explodimos. */
    if(g.some(x => x.x === 'boom' && x.q === 'p') && (r.matchups[0].playerHpAfter > 0)) explosorSobreviveu++;
  }
  ok('mas quem EXPLODIU nao e salvo pela propria Faixa', explosorSobreviveu === 0, explosorSobreviveu + '');
})();

console.log('\nA AUDITORIA DAS LISTAS (04/09/2026)');
/* Um jogador reportou que o Politoed aprende Hipnose por nivel na Gen 2 e nao estava na lista. A
   conferencia das SEIS listas, move a move no Bulbapedia, achou sete espécies faltando -- todas de
   Gen 2, e a de Hipnose era literalmente so a lista da Gen 1.
   Este teste existe pra a proxima omissao ser barulhenta: nomeia cada uma das sete. */
(function(){
  const esperado = {
    politoed:'Hipnose', noctowl:'Hipnose', yanma:'Hipnose', misdreavus:'Hipnose',
    tangela:'Pó do Sono', smoochum:'Canto'
  };
  const faltando = Object.keys(esperado).filter(id => S.SONIFEROS[id] !== esperado[id]);
  ok('as seis que faltavam no sono estao la', faltando.length === 0,
     faltando.map(id => id + ' (esperava ' + esperado[id] + ', tem ' + S.SONIFEROS[id] + ')').join(', '));
  ok('e o Igglybuff entrou no Disable', S.DISABLE.includes('igglybuff'));
  /* Todas tem que existir no SPECIES, senao a lista aponta pra fantasma. */
  const fora = Object.keys(esperado).filter(id => !S.SPECIES[id]);
  ok('e todas existem no SPECIES', fora.length === 0, fora.join(','));
  /* O Mewtwo e o Mew continuam fora de TODAS: eles sao imunes ao bloco inteiro, e uma entrada pra
     eles seria letra morta. */
  const listas = { AUTODESTRUICAO:S.AUTODESTRUICAO, DISABLE:S.DISABLE, METRONOMO:S.METRONOMO,
                   RECUPERACAO:S.RECUPERACAO };
  const imunesNaLista = [];
  for(const [nome, l] of Object.entries(listas)){
    for(const id of ['mew','mewtwo']) if(l.includes(id)) imunesNaLista.push(nome + ':' + id);
  }
  for(const id of ['mew','mewtwo']){
    if(S.SONIFEROS[id]) imunesNaLista.push('SONIFEROS:' + id);
    if(S.ABSORCAO[id]) imunesNaLista.push('ABSORCAO:' + id);
  }
  ok('e os dois imunes nao estao em lista nenhuma', imunesNaLista.length === 0, imunesNaLista.join(', '));
})();

console.log('\nDRENAGEM: TIRA DO OUTRO E POE EM SI, ANTES DA LUTA');
/* A LISTA SAI DO APRENDIZADO POR NIVEL DA GEN 1/2, conferida move a move no Bulbapedia -- e a
   intuicao erra: Kabuto e Kabutops aprendem Absorb/Mega Drain por nivel (sao Pedra/Agua), e o
   Bulbasaur NAO aprende nenhum dos tres (o que ele tem e Leech Seed, que e outra coisa). */
(function(){
  ok('23 especies drenam', Object.keys(S.ABSORCAO).length === 23, Object.keys(S.ABSORCAO).length + '');
  ok('os de Absorb estao la', ['oddish','gloom','vileplume','exeggcute','exeggutor','tangela',
      'kabuto','kabutops','bellossom','hoppip','skiploom','jumpluff','sunkern','sunflora']
      .every(id => S.ABSORCAO[id]));
  ok('e os de Leech Life tambem', ['zubat','golbat','crobat','venonat','venomoth',
      'spinarak','ariados','paras','parasect'].every(id => S.ABSORCAO[id]));
  ok('o Bulbasaur NAO drena (Leech Seed nao e drenagem)', !S.ABSORCAO.bulbasaur);
  ok('nenhuma esta fora do SPECIES', Object.keys(S.ABSORCAO).filter(id => !S.SPECIES[id]).length === 0,
     Object.keys(S.ABSORCAO).filter(id => !S.SPECIES[id]).join(','));
  /* Cada especie com o NOME do golpe dela: sem isso um Zubat drenaria com "Absorver". */
  ok('cada uma com o golpe dela', S.ABSORCAO.zubat === 'Sanguessuga' && S.ABSORCAO.oddish === 'Absorver' &&
     S.ABSORCAO.vileplume === 'Mega Dreno', [S.ABSORCAO.zubat, S.ABSORCAO.oddish, S.ABSORCAO.vileplume].join('/'));
  /* E TODO golpe que o motor gera precisa de tipo declarado, senao o selo sai num cinza generico. */
  const semTipo = [...new Set(Object.values(S.ABSORCAO))].filter(n => !S.TIPO_DO_ESPECIAL[n]);
  ok('e todos com tipo declarado, pro selo', semTipo.length === 0, semTipo.join(','));
  ok('Sanguessuga e Inseto, nao Planta', S.TIPO_DO_ESPECIAL['Sanguessuga'] === 'Bug');

  /* A MECANICA. Mesma hora do Recuperar (antes da luta) e a MESMA fracao dos dois lados, cada um do
     proprio teto: o exemplo do pedido e um Vileplume de 47% que sobe pra 72% enquanto o Fearow cai
     de 100% pra 75%. */
  let saiu = 0, fracaoErrada = 0, curouCheio = 0, matou = 0, foraDaFaixa = 0, semDuasEntradas = 0;
  for(let i = 0; i < 6000; i++){
    const v = S.createInstance('vileplume', 60), f = S.createInstance('fearow', 60);
    v.maxHp = S.calcMaxHp(v); f.maxHp = S.calcMaxHp(f);
    v.hp = Math.round(v.maxHp * 0.47); f.hp = f.maxHp;
    const antesV = v.hp, antesF = f.hp;
    const diario = [];
    S.tentarGolpeEspecial(v, f, Math.random, diario);
    const a = diario.find(g => g.x === 'absorb');
    if(!a) continue;
    saiu++;
    const d = diario.find(g => g.x === 'absorbdano');
    if(!d) { semDuasEntradas++; continue; }
    const fracaoCura = (v.hp - antesV) / v.maxHp, fracaoDano = (antesF - f.hp) / f.maxHp;
    if(Math.abs(fracaoCura - fracaoDano) > 0.01) fracaoErrada++;
    if(fracaoCura < 0.095 || fracaoCura > 0.305) foraDaFaixa++;
    if(v.hp > v.maxHp) curouCheio++;
    if(f.hp < 1) matou++;
  }
  ok('a drenagem dispara', saiu > 200, saiu + ' vezes em 6000');
  ok('sempre com DUAS entradas no diario (uma barra cada)', semDuasEntradas === 0, semDuasEntradas + '');
  ok('a MESMA fracao dos dois lados, cada um do proprio teto', fracaoErrada === 0, fracaoErrada + ' erradas');
  ok('e a fracao fica entre 10% e 30%', foraDaFaixa === 0, foraDaFaixa + ' fora da faixa');
  ok('a cura nunca passa do teto', curouCheio === 0, curouCheio + '');
  /* NAO MATA: todas as aberturas deste motor deixam a luta acontecer. */
  ok('e nunca mata o alvo (piso de 1 de HP)', matou === 0, matou + '');

  /* A TRAVA DOS 70%, a mesma do Recuperar: com a vida quase cheia nao ha o que recuperar, e a
     barra de quem drenou nao se moveria -- um passo de cura ZERO na animacao. */
  let comVidaCheia = 0;
  for(let i = 0; i < 6000; i++){
    const v = S.createInstance('vileplume', 60), f = S.createInstance('fearow', 60);
    v.maxHp = S.calcMaxHp(v); f.maxHp = S.calcMaxHp(f);
    v.hp = v.maxHp; f.hp = f.maxHp;
    const diario = [];
    S.tentarGolpeEspecial(v, f, Math.random, diario);
    if(diario.some(g => g.x === 'absorb')) comVidaCheia++;
  }
  ok('com a vida cheia ela nao sai', comVidaCheia === 0, comVidaCheia + ' de 6000');

  /* QUEM NAO TEM O GOLPE nunca drena -- a medida de controle. */
  let semGolpe = 0;
  for(let i = 0; i < 4000; i++){
    const a = S.createInstance('rhydon', 60), b = S.createInstance('fearow', 60);
    a.maxHp = S.calcMaxHp(a); b.maxHp = S.calcMaxHp(b);
    a.hp = Math.round(a.maxHp * 0.4); b.hp = b.maxHp;
    const diario = [];
    S.tentarGolpeEspecial(a, b, Math.random, diario);
    if(diario.some(g => g.x === 'absorb')) semGolpe++;
  }
  ok('quem nao tem o golpe nunca drena', semGolpe === 0, semGolpe + ' de 4000');

  /* NA TELA: as duas barras se movem, e a frase sobrevive aos DOIS passos. */
  const m = { player:'Vileplume', enemy:'Fearow', playerSpecies:'vileplume', enemySpecies:'fearow',
    playerHpBefore:190, playerHpAfter:0, playerMaxHp:404, enemyHpBefore:380, enemyHpAfter:0, enemyMaxHp:380,
    playerMove:'Grass', enemyMove:'Flying',
    golpes:[{q:'p',d:101,hp:291,x:'absorb',g:'Mega Dreno'},{q:'p',d:95,hp:285,x:'absorbdano'},
            {q:'e',d:291,hp:0},{q:'p',d:285,hp:0}] };
  const seq = S.sequenciaDoConfronto(m);
  ok('a drenagem ABRE a sequencia', seq.slice(0,2).map(g=>g.x).join(',') === 'absorb,absorbdano',
     seq.map(g=>g.x||'golpe').join(','));
  const anim = S.buildAnimatedHitSequence(m);
  ok('a barra de quem drenou SOBE', anim[0].side === 'player' && anim[0].amount === -101 && anim[0].cura === true,
     JSON.stringify(anim[0]));
  ok('e a do alvo DESCE', anim[1].side === 'enemy' && anim[1].amount === 95, JSON.stringify(anim[1]));
  const log = S.passosHtml(m);
  ok('o log fala da drenagem', /drenou a vida de/.test(log));
  ok('numa linha SO (a segunda entrada e pro calculo)',
     (log.match(/mlog-passo especial/g) || []).length === 1,
     (log.match(/mlog-passo especial/g) || []).length + ' linhas especiais');
  ok('com o selo do tipo do golpe', log.includes(S.TYPE_COLORS['Grass']));
  /* A FRASE tem que durar os DOIS passos: sumindo no primeiro, a segunda barra anda sem explicacao. */
  ok('a frase aparece no comeco', /drenou a vida de/.test(S.avisoDoConfronto(m, 0)), S.avisoDoConfronto(m, 0));
  ok('e sobrevive ao segundo passo', /drenou a vida de/.test(S.avisoDoConfronto(m, 1)), S.avisoDoConfronto(m, 1));
  ok('e some quando a luta comeca', S.avisoDoConfronto(m, 2) === '', S.avisoDoConfronto(m, 2));
})();

console.log('\nRECUPERAR: ANTES DA LUTA, E SO COM MENOS DE 70% DE VIDA');
/* Recover nao e TM em nenhuma das duas geracoes e nao sai por reproducao -- entao a lista de quem
   aprende por nivel e a lista inteira, sem recorte. */
ok('10 especies aprendem Recuperar', S.RECUPERACAO.length === 10, S.RECUPERACAO.join(', '));
ok('as da Gen 1 estao la', ['kadabra','alakazam','staryu','starmie','porygon']
   .every(id => S.RECUPERACAO.includes(id)));
ok('e as que so a Gen 2 deu', ['porygon2','corsola','lugia','hooh','celebi']
   .every(id => S.RECUPERACAO.includes(id)));
ok('o Mewtwo nao entra (e imune ao bloco inteiro)', !S.RECUPERACAO.includes('mewtwo'));
ok('nenhuma esta fora do SPECIES', S.RECUPERACAO.filter(id => !S.SPECIES[id]).length === 0);

/* O POKEMON QUE SOBREVIVEU AO CONFRONTO ANTERIOR entra machucado e se cura ANTES de o novo
   adversario atacar. Ficava no FIM do doExchange (o vencedor se curava depois de ganhar), e era o
   mesmo numero com metade da graca: a cura chegava com a luta ja decidida. */
(function(){
  function comVidaEm(pct, n){
    let curas = 0, curouAntesDeQualquerGolpe = 0;
    for(let i=0;i<n;i++){
      const a = inst('starmie'); a.maxHp = S.calcMaxHp(a); a.hp = Math.floor(a.maxHp*pct);
      const b = inst('rapidash'); b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
      const d = [];
      S.tentarGolpeEspecial(a, b, Math.random, d);
      if(d.some(g=>g.x==='recover')){
        curas++;
        if(a.hp === a.maxHp) curouAntesDeQualquerGolpe++;
      }
    }
    return { taxa: 100*curas/n, cheio: curas === curouAntesDeQualquerGolpe };
  }
  const r30 = comVidaEm(0.30, 4000);
  ok('com 30% de vida ele se cura, perto de 10%', Math.abs(r30.taxa - 10) < 3, r30.taxa.toFixed(1) + '%');
  ok('e a vida vai direto pro maximo', r30.cheio);
  ok('com 69% ainda se cura', comVidaEm(0.69, 3000).taxa > 6, comVidaEm(0.69, 3000).taxa.toFixed(1) + '%');
  /* Acima de 70% nao ha o que recuperar, e a frase anunciaria um efeito que mal se ve na barra. */
  ok('com 75% NAO se cura', comVidaEm(0.75, 3000).taxa === 0, comVidaEm(0.75, 3000).taxa.toFixed(1) + '%');
  ok('e com a vida cheia tambem nao', comVidaEm(1.00, 3000).taxa === 0);
  /* Como o Disable, ela NAO resolve o confronto: a luta acontece inteira, com ele curado. */
  const a = inst('starmie'); a.maxHp = S.calcMaxHp(a); a.hp = Math.floor(a.maxHp*0.3);
  const b = inst('rapidash'); b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
  const d = [];
  const resolveu = S.tentarGolpeEspecial(a, b, ()=>0.01, d);
  ok('e a cura NAO encerra o confronto', resolveu === false);
  ok('o registro guarda quanto subiu', d[0] && d[0].x === 'recover' && d[0].d > 0, JSON.stringify(d[0]));
})();
/* Quem nao esta na lista nunca cura, por mais machucado que entre. */
(function(){
  let curas = 0;
  for(let i=0;i<3000;i++){
    const a = inst('pikachu'); a.maxHp = S.calcMaxHp(a); a.hp = Math.floor(a.maxHp*0.2);
    const b = inst('rapidash'); b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
    const d = []; S.tentarGolpeEspecial(a, b, Math.random, d);
    if(d.some(g=>g.x==='recover')) curas++;
  }
  ok('quem nao tem o golpe nunca cura', curas === 0, curas + ' de 3000');
})();

console.log('\nA FRASE E A ANIMACAO DA CURA');
/* O confronto do pedido: o Alakazam entra com 30%, se cura, e ai a luta comeca. */
const mRec = { player:'Alakazam', enemy:'Rapidash', playerSpecies:'alakazam', enemySpecies:'rapidash',
  playerHpBefore:60, playerHpAfter:120, playerMaxHp:200,
  enemyHpBefore:210, enemyHpAfter:0, enemyMaxHp:210,
  playerMove:'Psychic', enemyMove:'Fire',
  golpes:[{ q:'p', d:140, hp:200, x:'recover', g:'Recuperar' }, { q:'p', d:210, hp:0 }, { q:'e', d:80, hp:120 }] };
ok('a frase e a pedida', S.avisoDoConfronto(mRec) === '💚 Alakazam usou Recuperar e restaurou seu HP!',
   S.avisoDoConfronto(mRec));
/* Ela anuncia a barra que VAI subir -- e some quando a barra ja subiu, senao ficaria uma frase
   velha ocupando o lugar do "Trocando golpes..." pelo resto da luta. */
ok('e ela aparece ANTES da cura acontecer (passo 0)', S.avisoDoConfronto(mRec, 0) !== '');
ok('e some depois que a barra subiu', S.avisoDoConfronto(mRec, 1) === '', S.avisoDoConfronto(mRec, 1));
/* Autodestruicao e sono sao o contrario: o confronto INTEIRO e aquilo, e a frase acompanha ate o fim. */
ok('a explosao continua avisando ate o fim', S.avisoDoConfronto(mBoom, 3) !== '');

/* A CURA E O PRIMEIRO PASSO da animacao: o pokemon entra machucado, se cura, e so entao luta. */
ok('a cura e o PRIMEIRO passo', S.sequenciaDoConfronto(mRec)[0].x === 'recover',
   S.sequenciaDoConfronto(mRec).map(g=>g.x||'golpe').join(','));
const seqAnim = S.buildAnimatedHitSequence(mRec);
ok('a barra que mexe e a de QUEM CUROU', seqAnim[0].side === 'player');
ok('e ela SOBE (valor negativo)', seqAnim[0].amount === -140, seqAnim[0].amount + '');
ok('marcada como cura, pro laco saber a hora de trocar a frase', seqAnim[0].cura === true);
ok('no log ela vem com o selo do tipo (Recover e Normal)',
   S.passosHtml(mRec).includes('usou <span class="type-pill" style="background:' + S.TYPE_COLORS['Normal'] + '">Recuperar</span> e restaurou'));
ok('e vem PRIMEIRO no log', S.passosHtml(mRec).indexOf('Recuperar') < S.passosHtml(mRec).indexOf('atacou'));
/* A cura nao gasta vaga do TETO_GOLPES: o teto conta GOLPES. */
const tresGolpesMaisCura = { player:'Starmie', enemy:'Onix', playerSpecies:'starmie', enemySpecies:'onix',
  playerHpBefore:80, playerHpAfter:140, playerMaxHp:200, enemyHpBefore:210, enemyHpAfter:0, enemyMaxHp:210,
  playerMove:'Water', enemyMove:'Rock',
  golpes:[{q:'p',d:120,hp:200,x:'recover',g:'Recuperar'},{q:'p',d:70,hp:140},{q:'e',d:60,hp:140},{q:'p',d:140,hp:0}] };
const seq3 = S.sequenciaDoConfronto(tresGolpesMaisCura);
ok('tres golpes + cura continuam sendo os golpes REAIS', seq3.length === 4 && seq3.filter(g=>!g.x).length === 3,
   seq3.length + ' passos, ' + seq3.filter(g=>!g.x).length + ' de dano');

/* CONFRONTO LONGO E DE VERDADE. Passando do TETO_GOLPES a luta vira a reconstrucao, que interpola
   entre o HP do COMECO e o do FIM -- e com a cura o comeco de verdade e a vida CHEIA. Reconstruir
   a partir do HP machucado desenharia a barra caindo de um valor que a luta nunca teve, e a cura
   sumiria da tela e do log (o "nao aparece animacao nenhuma" de 02/09/2026). */
(function(){
  const pool = Object.keys(S.SPECIES).filter(id => S.SPECIES[id].dex <= 251);
  function time(sem, primeiro){
    const rng = S.makeSeededRng(sem); const t = primeiro ? [inst(primeiro,70)] : [];
    while(t.length<6){ const x = pool[Math.floor(rng()*pool.length)]; if(!t.some(p=>p.speciesId===x)) t.push(inst(x,70)); }
    return t;
  }
  let m = null;
  for(let i=0;i<4000 && !m;i++){
    const r = S.simulateGymBattle(time('a'+i,'starmie'), time('b'+i), Math.random);
    m = (r.matchups||[]).find(c => (c.golpes||[]).some(g=>g.x==='recover') && (c.golpes||[]).filter(g=>!g.x).length > 3) || null;
  }
  ok('achei um confronto longo com cura', !!m, m ? (m.golpes.filter(g=>!g.x).length + ' golpes') : 'nenhum em 4.000 batalhas');
  if(!m) return;
  const seq = S.sequenciaDoConfronto(m);
  ok('a cura sobrevive ao teto de golpes', seq.some(g=>g.x==='recover'), seq.map(g=>g.x||'golpe').join(','));
  ok('e continua sendo o PRIMEIRO passo', seq[0].x === 'recover');
  /* A luta comeca da vida CHEIA -- e o que a reconstrucao tem que enxergar. */
  const cura = m.golpes.find(g=>g.x==='recover');
  const eu = cura.q === 'p';
  let hp = eu ? m.playerHpBefore : m.enemyHpBefore;
  const maxHp = eu ? m.playerMaxHp : m.enemyMaxHp;
  const anim = S.buildAnimatedHitSequence(m);
  const lado = eu ? 'player' : 'enemy';
  let chegouNoCheio = false;
  anim.forEach(h => { if(h.side===lado){ hp = Math.max(0, hp - h.amount); if(hp === maxHp) chegouNoCheio = true; } });
  ok('a barra sobe ate o maximo logo no comeco', chegouNoCheio, 'maxHp: ' + maxHp);
  ok('e o log fala da cura', /restaurou seu HP/.test(S.passosHtml(m)));
})();

console.log('\nO BUFF DE ESPECIALIDADE ENTRA EM TODA BATALHA');
/* A raide do Mew era a UNICA que nao aplicava -- e ninguem tinha como notar, porque o buff valia
   1% e nao aparecia em lugar nenhum. Achado em 02/09/2026, ao subir pra 5%.
   Este teste le o CODIGO: toda chamada que simula uma batalha tem que ter um applySpecialtyBuff
   perto. E chato de escrever e e o unico jeito de pegar a proxima omissao -- a anterior passou
   despercebida por semanas. */
(function(){
  const fs = require('fs');
  const arquivos = [
    ['cliente',  fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')],
    ['servidor', fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8')]
  ];
  const semBuff = [];
  for(const [nome, texto] of arquivos){
    const linhas = texto.split('\n');
    linhas.forEach((l, i) => {
      // as CHAMADAS (nao a definicao) de quem simula uma batalha
      if(!/(simulateGymBattle|simulateBossFight)\s*\(/.test(l)) return;
      if(/^\s*(function|exports\.)/.test(l)) return;
      /* Olha as 12 linhas anteriores: e onde o time e montado e o buff, aplicado. */
      const antes = linhas.slice(Math.max(0, i-12), i).join('\n');
      if(!/applySpecialtyBuff/.test(antes)) semBuff.push(nome + ':' + (i+1) + '  ' + l.trim().slice(0, 60));
    });
  }
  ok('toda batalha simulada aplica a especialidade', semBuff.length === 0, semBuff.join('  |  '));

  /* E O MESMO VALE PROS ITENS EQUIPADOS, pela mesma razao e pelo mesmo defeito: quando eles
     entraram, um dos DOIS caminhos de batalha do cliente ficou de fora -- o do rival/Rocket/Elite
     recebeu e o do LIDER DE GINASIO, que e A batalha da jornada, nao. O jogador usou a pocao, foi
     lutar e nao aconteceu nada. Reportado em 03/09/2026, horas depois de a loja subir.
     A regra aqui e SEM EXCECAO: toda chamada passa pelo equiparItens, inclusive a das ligas, que
     passa a lista VAZIA de proposito (item equipado hoje nao decide partida sorteada ontem).
     Excecao em lista e onde a proxima omissao se esconde. */
  const semItens = [];
  for(const [nome, texto] of arquivos){
    const linhas = texto.split(String.fromCharCode(10));
    linhas.forEach((l, i) => {
      if(!/(simulateGymBattle|simulateBossFight)\s*\(/.test(l)) return;
      if(/^\s*(function|exports\.)/.test(l)) return;
      /* As mesmas 12 linhas do applySpecialtyBuff: e ali que o time e montado e as flags, postas. */
      const antes = linhas.slice(Math.max(0, i-12), i).join(String.fromCharCode(10));
      if(!/equiparItens/.test(antes)) semItens.push(nome + ":" + (i+1) + "  " + l.trim().slice(0, 60));
    });
  }
  ok('e toda batalha simulada passa pelo equiparItens', semItens.length === 0, semItens.join('  |  '));
})();
/* E o valor: 5%, abaixo do terreno (1,15) e do shiny (1,20) de proposito -- a especialidade cobre
   um TIPO inteiro do time, nao um pokemon. */
ok('o buff e de 5%', S.SPECIALTY_BUFF === 1.05, S.SPECIALTY_BUFF + '');
ok('e fica abaixo do terreno e do shiny', S.SPECIALTY_BUFF < 1.15);
/* O confronto carrega a marca, pros dois lados -- e dela que sai o selo na tela. */
(function(){
  const a = inst('nidoking', 60), b = inst('onix', 60);
  S.applySpecialtyBuff([a], ['Poison']);
  const r = S.simulateGymBattle([a], [b], Math.random);
  const m = (r.matchups||[])[0];
  ok('o confronto diz quem estava com a especialidade', m.playerSpecialty === true && m.enemySpecialty === false,
     'jogador: ' + m.playerSpecialty + ', inimigo: ' + m.enemySpecialty);
})();
/* E o buff MUDA os atributos de verdade -- so de quem e do tipo. */
(function(){
  const semBuffPk = inst('nidoking', 60);
  const comBuffPk = inst('nidoking', 60);
  S.applySpecialtyBuff([comBuffPk], ['Poison']);
  const deFora = inst('pikachu', 60);
  S.applySpecialtyBuff([deFora], ['Poison']);
  ok('quem e do tipo fica mais forte', S.effectiveAttack(comBuffPk) > S.effectiveAttack(semBuffPk),
     S.effectiveAttack(semBuffPk) + ' -> ' + S.effectiveAttack(comBuffPk));
  ok('e quem nao e, nao muda', !deFora.specialtyBuffed);
})();
console.log('\nOS DOIS MOTORES DAO O MESMO RESULTADO');
/* O motor e duplicado (cliente e servidor). Uma diferenca aqui faz a liga decidir uma coisa e a
   animacao mostrar outra -- e o jogador so descobre quando perde uma final. */
const fake = require('./fake-firestore');
const db = fake.makeDb();
const stubs = {
  'firebase-functions/v2/scheduler': { onSchedule: (x,y)=> (typeof x==='function'?x:y) },
  'firebase-functions/v2/https': { onCall: fn=>fn, HttpsError: class extends Error { constructor(c,m){ super(m); this.code=c; } } },
  'firebase-functions/logger': { error(){}, info(){}, warn(){}, log(){} },
  'firebase-admin': { initializeApp(){}, firestore: Object.assign(()=>db, { FieldValue: fake.FieldValue }) }
};
const loadOriginal = Module._load;
Module._load = function(r){ if(stubs[r]) return stubs[r]; return loadOriginal.apply(this, arguments); };
const srv = require(path.join(raiz, 'functions', 'index.js'));
Module._load = loadOriginal;

const esp = srv._golpesEspeciais;
ok('as listas sao IDENTICAS nos dois motores',
   esp.AUTODESTRUICAO.join(',') === S.AUTODESTRUICAO.join(',') &&
   esp.METRONOMO.join(',') === S.METRONOMO.join(',') &&
   JSON.stringify(esp.SONIFEROS) === JSON.stringify(S.SONIFEROS) &&
   esp.CHANCE_AUTODESTRUICAO === S.CHANCE_AUTODESTRUICAO && esp.CHANCE_SONO === S.CHANCE_SONO);

const especies = Object.keys(S.SPECIES);
function timeAleatorio(rng, n){
  const t = [];
  while(t.length < n){
    const id = especies[Math.floor(rng()*especies.length)];
    if(!t.some(p=>p.id===id)) t.push({ id, level: 40 + Math.floor(rng()*30) });
  }
  return t;
}
const resumo = r => (r.win?'W':'L') + '|' + (r.matchups||[]).map(m =>
  m.playerSpecies+':'+m.playerHpAfter+'/'+m.enemySpecies+':'+m.enemyHpAfter+':' +
  (m.golpes||[]).map(g=>(g.x||'')+g.d).join(',')).join(';');
let divergencias = 0, comEspecial = 0;
for(let i=0;i<300;i++){
  const rngMonta = S.makeSeededRng('monta-'+i);
  const t1 = timeAleatorio(rngMonta, 6), t2 = timeAleatorio(rngMonta, 6);
  /* Um item de atributo diferente a cada volta, sempre no primeiro do time -- assim as 300
     batalhas cobrem os cinco, dos dois lados do motor. */
  const itemDaVez = ['hp_up','atk_up','def_up','spatk_up','spdef_up'][i % 5];
  const equipa = (time, fn) => { fn([time[0]], { [S.raizDaLinha(time[0].speciesId)]: itemDaVez }); return time; };
  const timeC = equipa(t1.map(p=>inst(p.id,p.level)), S.equiparItens);
  const timeS = equipa(t1.map(p=>srv._createInstance(p.id,p.level)), srv._equiparItens);
  const rC = S.simulateGymBattle(timeC, t2.map(p=>inst(p.id,p.level)), S.makeSeededRng('m'+i));
  const rS = srv._simulateGymBattle(timeS,
                                    t2.map(p=>srv._createInstance(p.id,p.level)), srv._makeSeededRng('m'+i));
  if((rC.matchups||[]).some(m=>(m.golpes||[]).some(g=>g.x))) comEspecial++;
  if(resumo(rC) !== resumo(rS)) divergencias++;
}
ok('300 batalhas com a mesma semente, golpe a golpe', divergencias === 0,
   divergencias + ' divergencias | ' + comEspecial + ' batalhas tiveram golpe especial');

console.log('\n=== OS ITENS EQUIPADOS DENTRO DA BATALHA ===');
/* O item e DO POKEMON, nao da conta: quem carrega o Despertar e o Machop, e a protecao vale pra
   ele. Foi assim que a mecanica virou escolha ("quem eu protejo do sono?") em vez de um interruptor
   ligado por fora, valendo pro time inteiro em qualquer save.
   DESPERTAR: o sono do ADVERSARIO nao pega em quem carrega o item. Nao desliga o golpe do jogo --
   os pokemon do jogador continuam podendo dormir o adversario, que e exatamente o que foi pedido. */
/* Monta um time ja com o item posto. Passa pelo equiparItens DE VERDADE (e nao escrevendo p.item na
   mao) porque e ele que a batalha usa: escrever o campo direto testaria o desenho e nao o caminho
   do dado ate ele -- o mesmo erro que deixou o timer do ginasio da cidade passar. */
function comItem(instancia, item){
  S.equiparItens([instancia], { [instancia.speciesId]: item });
  return [instancia];
}
(function(){
  let bloqueios = 0, jogadorDormiu = 0;
  for(let i = 0; i < 3000; i++){
    const r = S.simulateGymBattle(comItem(inst('machop',45),'awakening'), [inst('jynx',45)], Math.random);
    const m = (r.matchups||[])[0];
    if(!m) continue;
    if((m.golpes||[]).some(x => x.x === 'semSono')) bloqueios++;
    if((m.golpes||[]).some(x => x.x === 'sono' && x.q === 'e')) jogadorDormiu++;
  }
  ok('com o Despertar, o sono do adversario nunca pega', jogadorDormiu === 0, jogadorDormiu + ' de 3000');
  ok('e a tentativa dele vira linha no log', bloqueios > 50, bloqueios + ' bloqueios em 3000');
  let semItem = 0;
  for(let i = 0; i < 3000; i++){
    const r = S.simulateGymBattle([inst('machop',45)], [inst('jynx',45)], Math.random);
    const m = (r.matchups||[])[0];
    if(m && (m.golpes||[]).some(x => x.x === 'sono' && x.q === 'e')) semItem++;
  }
  ok('sem o item ele pega normal (a medida de controle)', semItem > 50, semItem + ' de 3000');
  /* O jogador continua podendo dormir o adversario. */
  let meuSono = 0;
  for(let i = 0; i < 3000; i++){
    const r = S.simulateGymBattle(comItem(inst('jynx',45),'awakening'), [inst('machop',45)], Math.random);
    const m = (r.matchups||[])[0];
    if(m && (m.golpes||[]).some(x => x.x === 'sono' && x.q === 'p')) meuSono++;
  }
  ok('e o MEU pokemon continua dormindo o adversario', meuSono > 50, meuSono + ' de 3000');
  /* O MOTOR ANOTA O GASTO. Sem a anotacao o item nunca sai da conta e o Despertar viraria eterno --
     e o defeito nao apareceria em batalha nenhuma, so num saldo que nunca desce. */
  let anotou = 0, semBloqueio = 0;
  for(let i = 0; i < 2000; i++){
    const r = S.simulateGymBattle(comItem(inst('machop',45),'awakening'), [inst('jynx',45)], Math.random);
    const m = (r.matchups||[])[0];
    const bloqueou = !!(m && (m.golpes||[]).some(x => x.x === 'semSono'));
    const gastos = S.itensGastosDaBatalha().filter(g => g.dono === 'p' && g.item === 'awakening');
    if(bloqueou && gastos.length === 1 && gastos[0].especie === 'machop') anotou++;
    if(!bloqueou && gastos.length) semBloqueio++;
  }
  ok('e o motor anota o gasto quando o item trabalha', anotou > 30, anotou + ' anotacoes em 2000');
  ok('e nao anota quando ele nao trabalhou', semBloqueio === 0, semBloqueio + ' anotacoes a toa');
  /* O ITEM E DE QUEM CARREGA, NAO DO TIME. Esta e a diferenca entre o modelo velho (interruptor da
     conta) e o de hoje, e e a parte que o jogador escolhe: o Machop protegido, o Geodude ao lado
     dele nao. Sem esta checagem, um equiparItens que espalhasse o item pelo time passaria batido. */
  let vizinhoDormiu = 0, donoDormiuComItem = 0, donoDormiuGasto = 0;
  for(let i = 0; i < 3000; i++){
    const time = [inst('machop',45), inst('geodude',45)];
    S.equiparItens(time, { machop:'awakening' });
    const r = S.simulateGymBattle(time, [inst('jynx',45), inst('jynx',45)], Math.random);
    /* O item e UM: depois de segurar um sono ele acabou, e o proximo pega. Por isso a conta
       acompanha se ele JA trabalhou -- sem isso o teste cobraria protecao eterna, que nao e a regra
       (falhou 1 vez em 6000 confrontos exatamente por isso, com o Machop enfrentando duas Jynx). */
    let gasto = false;
    (r.matchups||[]).forEach(m => {
      const g = m.golpes || [];
      const doDono = m.playerSpecies === 'machop';
      if(doDono && g.some(x => x.x === 'semSono')) gasto = true;
      if(!g.some(x => x.x === 'sono' && x.q === 'e')) return;
      if(!doDono){ vizinhoDormiu++; return; }
      if(gasto) donoDormiuGasto++; else donoDormiuComItem++;
    });
  }
  ok('quem NAO carrega o item continua dormindo', vizinhoDormiu > 30, vizinhoDormiu + ' vezes');
  ok('e quem carrega, nunca -- enquanto o item nao foi gasto', donoDormiuComItem === 0,
     donoDormiuComItem + ' com o item na mao, ' + donoDormiuGasto + ' depois de gasto');
  /* OS CINCO ITENS DE ATRIBUTO: +15 no que se comprou, o confronto inteiro.
     O bonus e FLAT e entra POR ULTIMO -- depois de shiny, terreno e especialidade, que sao
     multiplicadores. Entrando antes, eles o inflariam: +15 num shiny em terreno viraria +21, e
     "+15 de atributo" deixaria de ser 15. */
  {
    const cru = (esp, item) => { const p = S.createInstance(esp, 60); S.equiparItens([p], item ? { [S.raizDaLinha(esp)]: item } : null); return p; };
    const base = cru('charizard', null);
    const PARES = [['atk_up','effectiveAttack'], ['def_up','effectiveDefense'],
                   ['spatk_up','effectiveSpAtk'], ['spdef_up','effectiveSpDef'], ['hp_up','effectiveBaseHp']];
    let erradas = [];
    for(const [item, fn] of PARES){
      const com = cru('charizard', item);
      if(S[fn](com) - S[fn](base) !== 15) erradas.push(item + ':' + (S[fn](com) - S[fn](base)));
      /* E NAO PODE VAZAR: quem compra Atk Up nao ganha defesa junto. */
      for(const [, outra] of PARES){
        if(outra === fn) continue;
        if(S[outra](com) !== S[outra](base)) erradas.push(item + ' vazou em ' + outra);
      }
    }
    ok('cada item de atributo da +15 SO no dele', erradas.length === 0, erradas.join(', '));
    /* O HP Up mexe no TETO de vida, que e o que o jogador ve na barra. */
    ok('o HP Up sobe o teto de vida em 15', S.calcMaxHp(cru('charizard','hp_up')) - S.calcMaxHp(base) === 15,
       S.calcMaxHp(cru('charizard','hp_up')) + ' vs ' + S.calcMaxHp(base));
    /* FLAT, nao multiplicado: num shiny em terreno o bonus continua sendo 15, nao 15x1.38. */
    const shinyBase = S.createInstance('charizard', 60); shinyBase.shiny = true; S.applyTerrainBuff([shinyBase], { types:['Fire'] });
    const shinyItem = S.createInstance('charizard', 60); shinyItem.shiny = true; S.applyTerrainBuff([shinyItem], { types:['Fire'] });
    S.equiparItens([shinyBase], null); S.equiparItens([shinyItem], { charmander:'atk_up' });
    ok('e o bonus e FLAT, nao multiplicado pelos buffs',
       S.effectiveAttack(shinyItem) - S.effectiveAttack(shinyBase) === 15,
       (S.effectiveAttack(shinyItem) - S.effectiveAttack(shinyBase)) + ' de diferenca');
    /* ELES SE GASTAM: valem a BATALHA inteira e somem no fim dela, se o pokemon tiver entrado.
       O motor so anota o recado -- quem tira da conta e quem chamou a batalha. */
    const time = [S.createInstance('charizard', 60)];
    S.equiparItens(time, { charmander:'atk_up' });
    S.simulateGymBattle(time, [S.createInstance('onix', 55), S.createInstance('golem', 55)], Math.random);
    const g1 = S.itensGastosDaBatalha().filter(x => x.item === 'atk_up');
    ok('quem lutou gasta o item de atributo', g1.length === 1 && g1[0].especie === 'charizard',
       JSON.stringify(S.itensGastosDaBatalha()));

    /* MAS SO UMA VEZ POR BATALHA. O item vale a batalha INTEIRA: um pokemon que enfrenta tres
       adversarios seguidos nao pode gerar tres gastos, senao o servidor apagaria um item que ja
       nao existe e a conta ficaria mentindo. */
    const soUm = [S.createInstance('venusaur', 70)];
    S.equiparItens(soUm, { bulbasaur:'atk_up' });
    S.simulateGymBattle(soUm, [S.createInstance('ratata',5), S.createInstance('pidgey',5), S.createInstance('ratata',6)], Math.random);
    ok('e uma anotacao so, mesmo lutando varios confrontos',
       S.itensGastosDaBatalha().filter(x => x.item === 'atk_up').length === 1,
       JSON.stringify(S.itensGastosDaBatalha()));

    /* E O BONUS VALE ATE O FIM: ele nao pode sumir no meio da batalha. O gasto e so o recado. */
    const semItem = S.createInstance('venusaur', 70); S.equiparItens([semItem], null);
    ok('e o +15 vale ate o ultimo confronto da batalha',
       S.effectiveAttack(soUm[0]) - S.effectiveAttack(semItem) === 15,
       '+' + (S.effectiveAttack(soUm[0]) - S.effectiveAttack(semItem)));

    /* QUEM FICOU NO BANCO NAO GASTA. E o que o pedido diz -- gasta quem "for utilizado". */
    const banco = [S.createInstance('venusaur', 70), S.createInstance('charizard', 70)];
    S.equiparItens(banco, { bulbasaur:'atk_up', charmander:'hp_up' });
    const rb = S.simulateGymBattle(banco, [S.createInstance('ratata', 5)], Math.random);
    const entraram = new Set((rb.matchups||[]).map(m => m.playerSpecies));
    ok('so o Venusaur entrou no confronto', entraram.size === 1 && entraram.has('venusaur'),
       Array.from(entraram).join(', '));
    ok('e quem ficou no banco NAO gasta o item',
       !S.itensGastosDaBatalha().some(x => x.especie === 'charizard'),
       JSON.stringify(S.itensGastosDaBatalha()));
  }
  /* O ITEM SOBREVIVE A EVOLUCAO. A chave dos equipados e a RAIZ DA LINHA, nao a especie: era a
     especie, e um Charmeleon que evoluia perdia a pocao -- ela ficava presa em "charmeleon"
     enquanto o bicho passava a se chamar "charizard", e nem a tela nem a batalha achavam mais.
     Reportado em 03/09/2026 ("coloquei uma pocao no charmeleon... evoluiu, e a pocao sumiu").
     Nao era gasto indevido: o motor nao anotava nada. Era a chave que deixava de casar. */
  {
    const antes = S.createInstance('charmeleon', 35);
    S.equiparItens([antes], { charmander: 'potion' });
    ok('o Charmeleon acha o item pela raiz da linha', antes.item === 'potion', String(antes.item));
    const depois = S.createInstance('charizard', 40);
    S.equiparItens([depois], { charmander: 'potion' });
    ok('e o Charizard acha o MESMO item', depois.item === 'potion', String(depois.item));
    /* DADO JA ESTRAGADO: quem equipou antes do conserto tem a chave na especie do meio. A leitura
       aceita qualquer chave da MESMA linha, e e isso que devolve o item sem migrar nada. */
    const resgatado = S.createInstance('charizard', 40);
    S.equiparItens([resgatado], { charmeleon: 'potion' });
    ok('e o que ficou preso na especie velha volta a ser achado', resgatado.item === 'potion', String(resgatado.item));
    /* E NAO PODE VAZAR PRA LINHA VIZINHA: a raiz e tao unica quanto a especie era. */
    const outro = S.createInstance('blastoise', 40);
    S.equiparItens([outro], { charmander: 'potion' });
    ok('e nao vaza pra outra linha', outro.item === null, String(outro.item));
    /* A BIFURCACAO conta como a MESMA linha: Slowbro e Slowking sao o mesmo Slowpoke, e e por isso
       que o raizDaLinha le o EVOLUTION_CHOICES. Sem ele o Slowking seria raiz de si mesmo. */
    const rei = S.createInstance('slowking', 40);
    S.equiparItens([rei], { slowpoke: 'awakening' });
    ok('a bifurcacao tambem e a mesma linha (Slowking <- Slowpoke)', rei.item === 'awakening', String(rei.item));
  }
  /* A frase tem que existir: item invisivel e o erro da especialidade de novo. */
  const g = { x:'semSono', q:'e', g:'Hipnose' };
  const frase = S.fraseDoEspecial(g, 'Jynx', 'Machop', {});
  ok('a frase diz que o Despertar segurou', /Despertar segurou/.test(frase), frase);
})();
/* POCAO: MESMA MECANICA DO RECUPERAR -- ANTES da luta, nao depois.
   Ficava no fim do confronto (curava quem tinha acabado de vencer) e dava uma cena sem sentido: o
   pokemon matava o adversario sem tomar um golpe e tomava a pocao logo em seguida. Reportado em
   03/09/2026 com um "ele nem tinha tomado hit ainda" -- a vida que ele carregava era do confronto
   ANTERIOR, e a tela nao contava isso. */
(function(){
  let disparos = 0, entrouCheio = 0, noPrimeiro = 0, foraDoComeco = 0, curaErrada = 0, doisNaBatalha = 0;
  for(let i = 0; i < 3000; i++){
    const r = S.simulateGymBattle(comItem(inst('machamp',60),'hyperpotion'),
                                  [inst('onix',58), inst('golem',58), inst('rhydon',58)], Math.random);
    let naBatalha = 0;
    (r.matchups||[]).forEach((m, idx) => {
      const g = m.golpes || [];
      const p = g.find(x => x.x === 'pocao');
      if(!p) return;
      naBatalha++; disparos++;
      /* 1) SO com o pokemon entrando machucado -- o gatilho e o HP DE ENTRADA. */
      if(m.playerHpBefore > m.playerMaxHp * 0.25) entrouCheio++;
      /* 2) NUNCA no primeiro confronto: ali o time entra cheio (fora da Elite 4 toda batalha
            comeca curada), entao nao ha o que curar. */
      if(idx === 0) noPrimeiro++;
      /* 3) E E O PRIMEIRO PASSO, antes de qualquer golpe -- e isso que o pedido descreve. */
      if(g.indexOf(p) !== 0) foraDoComeco++;
      /* 4) Cura 80% do maximo, sem passar do teto. */
      const esperado = Math.min(m.playerMaxHp - m.playerHpBefore, Math.round(m.playerMaxHp * 0.80));
      if(p.d !== esperado) curaErrada++;
    });
    if(naBatalha > 1) doisNaBatalha++;
  }
  ok('a pocao dispara', disparos > 100, disparos + ' vezes em 3000 batalhas');
  ok('so com o pokemon entrando com 25% ou menos', entrouCheio === 0, entrouCheio + ' com vida demais');
  ok('nunca no primeiro confronto (o time entra cheio)', noPrimeiro === 0, noPrimeiro + ' no primeiro');
  ok('e sempre como PRIMEIRO passo, antes da luta', foraDoComeco === 0, foraDoComeco + ' fora do comeco');
  ok('curando 80% do maximo (sem passar do teto)', curaErrada === 0, curaErrada + ' com cura errada');
  ok('e UMA por batalha', doisNaBatalha === 0, doisNaBatalha + ' batalhas com duas');
  /* Sem o item, nada acontece -- a medida de controle. */
  let semItem = 0;
  for(let i = 0; i < 1000; i++){
    const r = S.simulateGymBattle([inst('machamp',60)], [inst('onix',58), inst('golem',58)], Math.random);
    if((r.matchups||[]).some(m => (m.golpes||[]).some(x => x.x === 'pocao'))) semItem++;
  }
  ok('sem o item ela nunca dispara', semItem === 0, semItem + ' de 1000');

  /* POCAO E RECUPERAR NUNCA SAEM JUNTOS. A pocao vem ANTES do doExchange, entao se ela subiu o HP
     pra cima de 70% o Recuperar nao dispara mais -- a ordem resolve sozinha, sem regra extra. */
  let juntos = 0, comRec = 0;
  for(let i = 0; i < 4000; i++){
    const r = S.simulateGymBattle(comItem(inst('alakazam',60),'hyperpotion'),
                                  [inst('onix',58), inst('golem',58)], Math.random);
    for(const m of (r.matchups||[])){
      const g = m.golpes || [];
      if(g.some(x => x.x === 'recover')) comRec++;
      if(g.some(x => x.x === 'pocao') && g.some(x => x.x === 'recover')) juntos++;
    }
  }
  ok('o Recuperar continua saindo com a pocao armada', comRec > 50, comRec + ' vezes');
  ok('mas nunca os dois no mesmo confronto', juntos === 0, juntos + ' confrontos com os dois');

  /* NA TELA: a cura e o primeiro passo e a barra SOBE, igual a do Recuperar. */
  const m = { player:'Machamp', enemy:'Rhydon', playerSpecies:'machamp', enemySpecies:'rhydon',
    playerHpBefore:40, playerHpAfter:0, playerMaxHp:420, enemyHpBefore:400, enemyHpAfter:0, enemyMaxHp:400,
    playerMove:'Fighting', enemyMove:'Ground',
    golpes:[{q:'p',d:336,hp:376,x:'pocao',g:'hyperpotion'},{q:'e',d:120,hp:256},{q:'p',d:400,hp:0},{q:'e',d:256,hp:0}] };
  const seq = S.sequenciaDoConfronto(m);
  ok('a pocao ABRE a sequencia', seq[0].x === 'pocao', seq.map(x=>x.x||'golpe').join(','));
  const anim = S.buildAnimatedHitSequence(m);
  ok('e a barra SOBE nela', anim[0].amount === -336 && anim[0].cura === true, JSON.stringify(anim[0]));
  ok('o log fala dela', /recuperou HP/.test(S.passosHtml(m)));
  ok('e a frase sai antes da luta e some depois', S.avisoDoConfronto(m, 0) !== '' && S.avisoDoConfronto(m, 1) === '',
     JSON.stringify([S.avisoDoConfronto(m,0), S.avisoDoConfronto(m,1)]));
})();

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
