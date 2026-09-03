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
ok('37 especies tem golpe de sono', Object.keys(S.SONIFEROS).length === 37, Object.keys(S.SONIFEROS).length + '');
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
/* E NAO BASTA UM GOLPE NA FRENTE -- essa era a versao anterior, e ela deixava passar o defeito que
   foi reportado em 03/09/2026: um Poliwrath dormiu a Vileplume, o log mostrou UM golpe dele e em
   seguida DOIS dela. Lido de fora, parecia que quem estava dormindo tinha atacado mais vezes que
   quem estava acordado.
   O sono compra SONO_EM_TROCAS trocas livres -- e TRES golpes seguidos quando quem usou e o mais
   rapido, porque ele ainda bate primeiro na troca em que o outro acorda. O log tem que mostrar
   tantos golpes livres quantos a luta teve, limitado pelas vagas da reconstrucao (que sao 3).
   Medido antes do conserto: 99,6% dos confrontos com sono mostravam menos do que a luta teve. */
(function(){
  const POOL = ['poliwrath','vileplume','gengar','snorlax','alakazam','jynx','butterfree','venusaur','arbok','paras'];
  let casos = 0, contradiz = 0, duplos = 0, exemplo = null;
  for(let i = 0; i < 20000; i++){
    const a = POOL[i % POOL.length], b = POOL[(i*7+3) % POOL.length];
    const r = S.simulateGymBattle([inst(a, 50 + (i%20))], [inst(b, 45 + (i%15))], Math.random);
    for(const m of (r.matchups || [])){
      const g = m.golpes || [];
      const sonos = g.filter(x => x.x === 'sono');
      if(!sonos.length) continue;
      casos++;
      /* SONO DUPLO existe: os dois se dormem, e ai NINGUEM tem troca livre -- os dois contadores
         correm juntos. O log mostrando zero golpe livre esta certo nesses, e por isso o esperado
         sai do DIARIO e nao de SONO_EM_TROCAS. */
      if(sonos.length > 1) duplos++;
      const sono = sonos[0];
      const seq = S.sequenciaDoConfronto(m);
      const dano = seq.filter(x => !x.x);
      const iLog = dano.findIndex(x => x.q !== sono.q);
      const livresLog = iLog < 0 ? dano.length : iLog;
      const danoReal = g.filter(x => !x.x);
      const iReal = danoReal.findIndex(x => x.q !== sono.q);
      const livresReais = iReal < 0 ? danoReal.length : iReal;
      const disponiveis = dano.filter(x => x.q === sono.q).length;
      const ideal = Math.min(livresReais, disponiveis);
      if(livresLog < ideal){
        contradiz++;
        if(!exemplo) exemplo = 'luta: ' + g.map(x=>(x.x?'['+x.x+']':'')+x.q).join(' ')
          + '  |  log: ' + seq.map(x=>(x.x?'['+x.x+']':'')+x.q).join(' ');
      }
      break;
    }
  }
  ok('achei confrontos com sono de sobra pra medir', casos > 500, casos + ' confrontos (' + duplos + ' com os dois dormindo)');
  ok('o log mostra todos os golpes livres que cabem na reconstrucao', contradiz === 0,
     contradiz + ' de ' + casos + (exemplo ? '   |  ' + exemplo : ''));
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
ok('16 especies aprendem Disable por nivel', S.DISABLE.length === 16, S.DISABLE.length + '');
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
   S.especiaisDaEspecie('paras').map(e=>e.nome).join(',') === 'Esporo');
ok('e os DOIS de quem tem dois',
   S.especiaisDaEspecie('jigglypuff').map(e=>e.nome).join(' + ') === 'Canto + Anulação',
   S.especiaisDaEspecie('jigglypuff').map(e=>e.nome).join(' + '));
ok('quem nao tem nenhum nao ganha linha nenhuma', S.especiaisDaEspecie('pikachu').length === 0);
/* A chance vem junto porque ela e POR CONFRONTO: so o nome deixaria o jogador achar que sai todo golpe. */
ok('com a chance junto', S.especiaisDaEspecie('golem')[0].chance === S.CHANCE_AUTODESTRUICAO);
ok('e com o tipo, pro selo', S.especiaisDaEspecie('paras')[0].tipo === 'Grass');
/* Ninguem das quatro listas pode ficar de fora da ficha -- seria um golpe invisivel. */
const todasComEspecial = new Set([...S.AUTODESTRUICAO, ...Object.keys(S.SONIFEROS), ...S.DISABLE, ...S.METRONOMO]);
const semFicha = [...todasComEspecial].filter(id => S.especiaisDaEspecie(id).length === 0);
ok('e toda especie das quatro listas aparece', semFicha.length === 0,
   semFicha.join(',') || todasComEspecial.size + ' especies');
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
  const rC = S.simulateGymBattle(t1.map(p=>inst(p.id,p.level)), t2.map(p=>inst(p.id,p.level)), S.makeSeededRng('m'+i));
  const rS = srv._simulateGymBattle(t1.map(p=>srv._createInstance(p.id,p.level)),
                                    t2.map(p=>srv._createInstance(p.id,p.level)), srv._makeSeededRng('m'+i));
  if((rC.matchups||[]).some(m=>(m.golpes||[]).some(g=>g.x))) comEspecial++;
  if(resumo(rC) !== resumo(rS)) divergencias++;
}
ok('300 batalhas com a mesma semente, golpe a golpe', divergencias === 0,
   divergencias + ' divergencias | ' + comEspecial + ' batalhas tiveram golpe especial');

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
