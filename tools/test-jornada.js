/**
 * A BIFURCACAO KANTO/JOHTO -- as regras que a jornada tem que manter.
 *
 * A escolha de caminho e o unico ponto do jogo onde duas tabelas paralelas precisam ficar
 * equivalentes: se um lado for mais facil, a escolha deixa de ser de TIPO e vira de dificuldade.
 * Este teste tranca o que da pra trancar sem simular (quantidade, media de nivel, pools, ids) --
 * a taxa de vitoria em si e medida pelo smoke com --regiao.
 *
 *   node tools/test-jornada.js
 */
const path = require('path');
const { createSandbox } = require('./game-sandbox');
const S = createSandbox(path.join(__dirname, '..', 'index.html'));

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const K = S.KANTO_GYMS, J = S.JOHTO_GYMS;
const media = g => g.team.reduce((s,p)=>s+p.level,0) / g.team.length;

console.log('\nOS DOIS CAMINHOS SAO EQUIVALENTES');
ok('8 ginasios de cada lado', K.length === 8 && J.length === 8, K.length+' e '+J.length);
const nDif = K.map((k,i)=>[k,J[i]]).filter(([k,j])=>k.team.length!==j.team.length);
ok('mesmo numero de pokemon em cada etapa', nDif.length === 0,
   nDif.map(([k,j])=>k.leaderName+' '+k.team.length+' x '+j.team.length+' '+j.leaderName).join(', '));
const mDif = K.map((k,i)=>[k,J[i]]).filter(([k,j])=>Math.abs(media(k)-media(j)) > 0.06);
ok('mesma media de nivel em cada etapa', mDif.length === 0,
   mDif.map(([k,j])=>k.leaderName+' '+media(k).toFixed(1)+' x '+media(j).toFixed(1)+' '+j.leaderName).join(', '));
K.forEach((k,i)=>console.log('         etapa '+(i+1)+': '+k.leaderName.padEnd(10)+' x '+J[i].leaderName.padEnd(10)+
  '  '+k.team.length+' pokemon, media '+media(k).toFixed(1)));

console.log('\nIDENTIDADE');
const todos = K.concat(J);
ok('nenhum id de ginasio repetido', new Set(todos.map(g=>g.id)).size === 16);
ok('nenhuma insignia repetida', new Set(todos.map(g=>g.badge)).size === 16);
const semSelo = todos.filter(g=>!S.GYM_BADGE_VISUALS || !S.GYM_BADGE_VISUALS[g.id]);
ok('todo ginasio tem selo', semSelo.length === 0, semSelo.map(g=>g.id).join(','));
const semEspecie = todos.flatMap(g=>g.team.map(p=>p.species)).filter(id=>!S.SPECIES[id]);
ok('todo pokemon de ginasio existe', semEspecie.length === 0, [...new Set(semEspecie)].join(','));

console.log('\nAS ROTAS');
const RK = S.ROUTE_MAP, RJ = S.JOHTO_ROUTE_MAP;
ok('8 etapas de rota em Johto', RJ.length === 8, String(RJ.length));
ok('2 caminhos por etapa nos dois lados',
   RK.every(p=>p.length===2) && RJ.every(p=>p.length===2));
const todasRotas = RK.flat().concat(RJ.flat());
ok('nenhum id de rota repetido', new Set(todasRotas.map(r=>r.id)).size === todasRotas.length,
   String(todasRotas.length)+' rotas');
const poolCurto = todasRotas.filter(r=>r.pool.length < 6);
ok('toda rota tem pelo menos 6 no pool', poolCurto.length === 0,
   poolCurto.map(r=>r.id+'='+r.pool.length).join(','));
const bicho = todasRotas.flatMap(r=>r.pool.concat((r.rare||[]).map(x=>typeof x==='object'?x.species:x)))
                        .filter(id=>!S.SPECIES[id]);
ok('todo pokemon de rota existe', bicho.length === 0, [...new Set(bicho)].join(','));
ok('routeById acha rota dos DOIS lados',
   !!S.routeById('viridian_forest') && !!S.routeById('dragons_den'));

console.log('\nO CAMINHO ESCOLHIDO MANDA');
const g = S.freshGameDefaults(); g.gymIndex = 0; S.__setGame(g);
ok('save sem gymPath cai em Kanto (jornada antiga intacta)', S.gymOf(0).id === 'brock');
g.gymPath = ['johto']; S.__setGame(g);
ok('escolher Johto troca o ginasio', S.gymOf(0).id === 'falkner');
ok('e troca as rotas oferecidas', S.routesForLeg(0).map(r=>r.id).join(',') === 'route_29_30,dark_cave',
   S.routesForLeg(0).map(r=>r.id).join(','));
g.gymPath = ['kanto']; S.__setGame(g);
ok('e volta pras de Kanto quando escolhe Kanto', S.routesForLeg(0).map(r=>r.id).join(',') === 'viridian_forest,route_22');
g.gymPath = ['johto','kanto','johto']; g.gymIndex = 2; S.__setGame(g);
ok('cada etapa guarda a SUA escolha',
   S.gymOf(0).id==='falkner' && S.gymOf(1).id==='misty' && S.gymOf(2).id==='whitney',
   [0,1,2].map(i=>S.gymOf(i).id).join(','));

console.log('\nOS LENDARIOS SAO 5% -- OS SEIS QUE DA PRA CAPTURAR');
/* Cada lendario mora numa rota so e sai a 5% POR ENCONTRO ali. Ja saiu errado: existia um sorteio
   extra de 5% no trecho 8 (de quando as aves nao tinham rota propria) que SOMAVA com o da rota, e
   Zapdos e Moltres apareciam a 6,6%. E os cinco de Johto nem eram reconhecidos como lendarios:
   entravam no nivel da etapa, o que dava um Lugia nivel 23. */
/* TODOS moram em trecho 7 ou 8 (índice 6 ou 7). Lendário em trecho baixo era um problema real:
   um Raikou nível 35 no trecho 4 resolve sozinho metade da jornada. */
const CASOS_LEND = [['raikou','mt_mortar',6],['suicune','lake_of_rage',6],['entei','pokemon_mansion',6],
  ['articuno','seafoam',6],
  ['zapdos','power_plant',7],['moltres','victory_road',7]];
ok('nenhum lendario mora em trecho abaixo do 7', CASOS_LEND.every(c=>c[2] >= 6),
   CASOS_LEND.filter(c=>c[2] < 6).map(c=>c[0]+' no trecho '+(c[2]+1)).join(', '));
ok('os 6 capturaveis estao na lista de lendarios',
   CASOS_LEND.every(c=>S.ehLendario(c[0])), CASOS_LEND.filter(c=>!S.ehLendario(c[0])).map(c=>c[0]).join(','));
/* Os INTOCAVEIS nao podem estar em rota nenhuma -- nem no pool, nem como raro. Lugia e Ho-Oh eram
   raros de 5% no Caminho de Gelo e no Covil do Dragao ate 31/08/2026; o Celebi nunca esteve. */
ok('nenhum intocavel aparece em rota nenhuma', (()=>{
  let achou = [];
  [S.ROUTE_MAP, S.JOHTO_ROUTE_MAP].forEach(m=>m.forEach(par=>par.forEach(r=>{
    (r.rare||[]).concat(r.pool).forEach(x=>{ const id = typeof x==='object'?x.species:x;
      if(['lugia','hooh','celebi','mewtwo'].includes(id)) achou.push(id+' em '+r.name); });
  })));
  return achou.length === 0 || (console.log('        ' + achou.join(', ')), false);
})());
const N_LEND = 8000;
const foraDaFaixa = [], nivelRuim = [];
CASOS_LEND.forEach(([id, rota, etapa])=>{
  const gL = S.freshGameDefaults();
  gL.currentSaveSlot = 0; gL.rivalName = 'R'; gL.starterId = 'cyndaquil';
  gL.team = [S.createInstance('cyndaquil', 5)];
  gL.gymIndex = etapa; gL.currentRoute = rota; gL.gymPath = [];
  gL.gymPath[etapa] = S.JOHTO_ROUTE_MAP[etapa].some(r=>r.id===rota) ? 'johto' : 'kanto';
  S.__setGame(gL);
  let saiu = 0, nivel = null;
  for(let i=0;i<N_LEND;i++){
    gL.wildEncounterSeq = i*7;
    S.goToWildEncounter();
    const o = (gL.wildOffer||[]).find(x=>x.speciesId===id);
    if(o){ saiu++; nivel = o.level; }
  }
  const pct = 100*saiu/N_LEND;
  if(Math.abs(pct - 5) > 1.2) foraDaFaixa.push(id+' '+pct.toFixed(1)+'%');
  const esperado = S.nivelDeLendario(S.LEGS[etapa]);
  if(nivel !== esperado) nivelRuim.push(id+' nv'+nivel+' (esperado '+esperado+')');
});
ok('cada lendario sai a ~5% por encontro na rota dele', foraDaFaixa.length === 0, foraDaFaixa.join(', '));
ok('e sempre 12 acima do teto da etapa, com teto em 50', nivelRuim.length === 0, nivelRuim.join(', '));
ok('nenhum lendario aparece em mais de uma rota', (()=>{
  const onde = {};
  [S.ROUTE_MAP, S.JOHTO_ROUTE_MAP].forEach(m=>m.forEach(par=>par.forEach(r=>{
    (r.rare||[]).concat(r.pool).forEach(x=>{ const id = typeof x==='object'?x.species:x;
      if(S.ehLendario(id)) onde[id] = (onde[id]||0) + 1; });
  })));
  return Object.values(onde).every(n=>n===1);
})());
ok('nenhum lendario esta num POOL (la nao ha chance propria)', (()=>{
  let noPool = false;
  [S.ROUTE_MAP, S.JOHTO_ROUTE_MAP].forEach(m=>m.forEach(par=>par.forEach(r=>{
    if(r.pool.some(id=>S.ehLendario(id))) noPool = true; })));
  return !noPool;
})());

console.log('\nA TELA DA ELITE LISTA A FILA SORTEADA');
/* Ela anuncia os cinco adversarios ANTES da primeira luta. Com a Elite misturada, listar sempre
   Lorelei/Bruno/Agatha/Lance anunciava quem o treinador nao vai enfrentar -- e escondia os de
   Johto que ele VAI. Por isso o sorteio acontece ao ABRIR essa tela, nao ao aceitar o desafio:
   sortear depois faria ele ler uma fila e enfrentar outra. */
const gEl = S.freshGameDefaults();
gEl.rivalName = 'Rafael'; gEl.eliteAttemptsUsed = 0; gEl.elitePath = null;
gEl.badgesEarned = [1,2,3,4,5,6,7,8]; gEl.team = [S.createInstance('typhlosion', 60)];
S.__setGame(gEl);
S.openEliteIntro();
ok('abrir a tela ja sorteia a fila', Array.isArray(gEl.elitePath) && gEl.elitePath.length === 4,
   (gEl.elitePath||[]).join(','));
const filaTela = [0,1,2,3].map(i=>S.eliteMembroDaEtapa(i).name);
ok('a fila nao repete adversario', new Set(filaTela).size === 4, filaTela.join(' -> '));
S.startEliteChallenge();
ok('aceitar o desafio nao re-sorteia',
   [0,1,2,3].map(i=>S.eliteMembroDaEtapa(i).name).join(',') === filaTela.join(','));
gEl.elitePath = ['johto','kanto','kanto','johto']; S.__setGame(gEl);
const htmlEl = S.renderEliteIntro ? S.renderEliteIntro() : null;
if(htmlEl){
  ok('a tela mostra os nomes da fila sorteada',
     htmlEl.includes('Will') && htmlEl.includes('Karen') && !htmlEl.includes('Lorelei'),
     [S.JOHTO_ELITE[0].name, S.ELITE_FOUR[1].name, S.ELITE_FOUR[2].name, S.JOHTO_ELITE[3].name].join(' -> '));
}

console.log('\nNENHUMA ESPECIE REPETIDA NO TIME');
/* A oferta selvagem não pode trazer o que o jogador já tem -- e a checagem é por LINHA, não por
   espécie: dois Magikarp viram dois Gyarados, e era assim que gente chegava na liga com o time
   duplicado. Um Gyarados no time bloqueia o Magikarp, e a bifurcação conta como uma linha só
   (Slowbro e Slowking são o mesmo Slowpoke). */
ok('a raiz junta Magikarp e Gyarados', S.raizDaLinha('magikarp') === S.raizDaLinha('gyarados'));
ok('a raiz junta os dois lados da bifurcacao',
   S.raizDaLinha('slowbro') === S.raizDaLinha('slowking') &&
   S.raizDaLinha('bellossom') === S.raizDaLinha('vileplume') &&
   S.raizDaLinha('politoed') === S.raizDaLinha('poliwrath'));
ok('linhas diferentes continuam diferentes',
   S.raizDaLinha('bulbasaur') !== S.raizDaLinha('charmander'));
const gW = S.freshGameDefaults();
gW.team = [{speciesId:'gyarados'},{speciesId:'slowking'},{speciesId:'bellossom'}];
S.__setGame(gW);
const poolT = ['magikarp','gyarados','slowpoke','slowbro','oddish','gloom','pikachu','geodude','zubat','onix'];
let repetiuW = 0;
for(let i=0;i<400;i++){
  if(S.buildOfferFromPool(poolT,3).some(id=>S.linhasDoTime().has(S.raizDaLinha(id)))) repetiuW++;
}
ok('a oferta nunca traz uma linha que o time ja tem', repetiuW === 0, repetiuW + ' de 400');
/* RESERVA: com o pool curto e o time cobrindo tudo, é melhor oferecer um repetido do que deixar a
   tela de encontro vazia. */
gW.team = [{speciesId:'geodude'},{speciesId:'zubat'},{speciesId:'onix'}]; S.__setGame(gW);
ok('pool esgotado ainda devolve oferta cheia',
   S.buildOfferFromPool(['geodude','zubat','onix'],3).length === 3);
// pior caso real: time montado só com bichos da própria rota
let curtas = 0, totalW = 0;
[S.ROUTE_MAP, S.JOHTO_ROUTE_MAP].forEach(m=>m.forEach(par=>par.forEach(r=>{
  for(let t=0;t<12;t++){
    const time=[]; while(time.length<6){ const id=r.pool[Math.floor(Math.random()*r.pool.length)];
      if(!time.some(p=>p.speciesId===id)) time.push({speciesId:id}); }
    gW.team = time; S.__setGame(gW);
    totalW++;
    if(S.buildOfferFromPool(r.pool,3).length < 3) curtas++;
  }
})));
ok('nenhuma rota real fica sem 3 opcoes', curtas === 0, curtas + ' de ' + totalW);

console.log('\nTODO POKEMON TEM COMO SER CAPTURADO');
/* Uma especie na tabela que nao esta em rota nenhuma nem evolui de nada e uma vaga impossivel na
   Pokedex -- e a Pokedex completa e o que libera o desafio do Mewtwo. Quando Johto entrou, DEZESSETE
   nao-lendarios ficaram assim (Pichu, Togepi, Slowking, Skarmory, Unown...) e nada acusava. */
/* Estar num pool NAO basta desde que a especie bate com o nivel: uma entrada de Tyrogue num trecho
   de nivel 33 nunca produz um Tyrogue -- produz um Hitmontop. O que cada entrada realmente
   entrega e o conjunto de formas que ela assume dentro da faixa de nivel daquele trecho. */
function formasPossiveis(id, leg){
  const L = S.LEGS[leg];
  const piso = S.EVOLVED_MIN_LEVEL[id];
  let de = L.minLevel, ate = L.maxLevel;
  if(piso && piso > L.minLevel){
    const teto = S.EVOLUTIONS[id] ? S.EVOLUTIONS[id].level - 1 : Infinity;
    de = piso; ate = Math.max(piso, Math.min(piso + (L.maxLevel - L.minLevel), teto));
  }
  const formas = new Set();
  for(let n = de; n <= ate; n++) formas.add(S.especieNoNivel(id, n));
  return formas;
}
const alcancavel = new Set();
[S.ROUTE_MAP, S.JOHTO_ROUTE_MAP].forEach(mapa => mapa.forEach((par, leg) => par.forEach(r => {
  r.pool.forEach(id => formasPossiveis(id, leg).forEach(f => alcancavel.add(f)));
  (r.rare || []).forEach(x => {
    const id = typeof x === 'object' ? x.species : x;
    // lendário tem nível próprio (nivelDeLendario) e nenhum deles evolui -- entra como está
    if(S.ehLendario(id)) alcancavel.add(id);
    else formasPossiveis(id, leg).forEach(f => alcancavel.add(f));
  });
})));
S.STARTERS.forEach(id => alcancavel.add(id));
for(let mudou = true; mudou; ){                       // fecho transitivo das evoluções
  mudou = false;
  for(const de in S.EVOLUTIONS){
    const para = S.EVOLUTIONS[de].into;
    if(alcancavel.has(de) && !alcancavel.has(para)){ alcancavel.add(para); mudou = true; }
  }
}
// o Eevee não passa por EVOLUTIONS: tem tela própria, e Espeon/Umbreon dependem da hora
if(alcancavel.has('eevee')) ['vaporeon','jolteon','flareon','espeon','umbreon'].forEach(id=>alcancavel.add(id));
/* As DUAS exceções legítimas, uma por região:
   - Mewtwo não vem de rota nenhuma: vem do desafio próprio, liberado por completar a Pokédex
     (ver mewtwoReward / checkMewtwoLoanUnlock).
   - Celebi é o "impossível" de Johto, como o Mew é o de Kanto (o Mew nem está no SPECIES -- é o
     chefe da raide do Boss de Domingo).
   Qualquer OUTRA espécie fora da lista é vaga impossível na Pokédex, e a Pokédex completa é o que
   libera o Mewtwo. */
/* Alem do Mewtwo (que vem do desafio proprio), os INTOCAVEIS: Lugia, Ho-Oh e Celebi existem na
   Pokedex e lutam, mas nao ha como capturar nenhum -- decisao de design de 31/08/2026. Quem
   desconta isso na conta do desafio do Mewtwo e o ESPECIES_INTOCAVEIS. */
const FORA = ['mewtwo','celebi','lugia','hooh'];
const orfaos = Object.keys(S.SPECIES).filter(id => !alcancavel.has(id) && !FORA.includes(id));
ok('nenhuma especie fica sem como capturar', orfaos.length === 0,
   orfaos.map(id=>S.SPECIES[id].name).slice(0,10).join(', '));
const johtoT = Object.keys(S.SPECIES).filter(id=>S.SPECIES[id].dex>151);
console.log('         Johto: '+johtoT.filter(id=>alcancavel.has(id)).length+'/'+johtoT.length+' alcancaveis');
const kantoT = Object.keys(S.SPECIES).filter(id=>S.SPECIES[id].dex<=151);
console.log('         Kanto: '+kantoT.filter(id=>alcancavel.has(id)).length+'/'+kantoT.length+' alcancaveis');

console.log('\nO EEVEE OLHA O RELOGIO');
ok('existe a regra de dia/noite', typeof S.ehDeDia === 'function' && typeof S.eeveeDoHorario === 'function');
const RealDate = Date;
function comHora(h, fn){
  global.Date = class extends RealDate { constructor(){ super(2026,7,30,h,0,0); }
                                          static now(){ return new RealDate(2026,7,30,h,0,0).getTime(); } };
  S.Date = global.Date;
  try { return fn(); } finally { global.Date = RealDate; S.Date = RealDate; }
}
const faixas = [[0,'umbreon'],[5,'umbreon'],[6,'espeon'],[12,'espeon'],[17,'espeon'],[18,'umbreon'],[23,'umbreon']];
const faixasErradas = faixas.filter(([h,esperado]) => comHora(h, ()=>S.eeveeDoHorario().id) !== esperado);
ok('dia das 6h as 17h59 (Espeon), noite das 18h as 5h59 (Umbreon)', faixasErradas.length === 0,
   faixasErradas.map(([h,e])=>h+'h deveria dar '+e).join(', '));
ok('a tela mostra a opcao do turno certo',
   comHora(3, ()=>{ const g=S.freshGameDefaults();
     g.team=[{speciesId:'eevee',id:'m',name:'Eevee',types:['Normal'],level:30}]; S.__setGame(g);
     const h=S.renderEeveeChoice();
     return h.includes("chooseEeveeEvolution('umbreon')") && !h.includes("chooseEeveeEvolution('espeon')"); }));

console.log('\nEVOLUCAO COM ESCOLHA (as linhas que se dividem)');
const CH = S.EVOLUTION_CHOICES;
/* Gloom, Poliwhirl e Slowpoke se dividem em duas; o Tyrogue em TRES (Hitmonlee, Hitmonchan e
   Hitmontop). No original quem decide e a pedra, o item de troca ou os atributos -- aqui, o jogador. */
ok('as quatro bifurcacoes existem', Object.keys(CH).length === 4, Object.keys(CH).join(','));
ok('o Tyrogue se divide em tres', (CH.tyrogue||[]).length === 3, (CH.tyrogue||[]).join(','));
const destinos = Object.values(CH).flat();
ok('todo destino existe no SPECIES', destinos.every(id=>S.SPECIES[id]),
   destinos.filter(id=>!S.SPECIES[id]).join(','));
ok('nenhuma bifurcacao repete destino',
   Object.values(CH).every(v=>v.length >= 2 && new Set(v).size === v.length));
/* A tela monta um botao por destino e o texto conta quantos sao -- com tres, precisa dizer tres. */
const gTy = S.freshGameDefaults();
gTy.team = [{ speciesId:'tyrogue', id:'t1', name:'Tyrogue', types:['Fighting'], level:20, pendingEvoChoice:'tyrogue' }];
S.__setGame(gTy);
const telaTy = S.renderEvoChoice();
ok('a tela do Tyrogue oferece os tres',
   ['hitmonlee','hitmonchan','hitmontop'].every(id=>telaTy.includes("escolherEvolucao('t1','"+id+"')")));
ok('e diz que a linha se divide em tres', telaTy.includes('<strong>três</strong>'));
ok('a origem de cada bifurcacao evolui por nivel (o gatilho)',
   Object.keys(CH).every(id=>S.EVOLUTIONS[id]),
   Object.keys(CH).filter(id=>!S.EVOLUTIONS[id]).join(','));
ok('o destino de Kanto continua no EVOLUTIONS (e o que os NPCs usam)',
   Object.keys(CH).every(id=>CH[id].includes(S.EVOLUTIONS[id].into)));
// fluxo: sobe de nivel, para na bifurcacao, escolhe, aplica
const gEv = S.freshGameDefaults();
gEv.team = [S.createInstance('oddish',41), S.createInstance('slowpoke',38)];
gEv.team.forEach((p,i)=>p.id='ev'+i);
gEv.evolutions = []; S.__setGame(gEv);
let evsT = []; gEv.team.forEach(p=>{ evsT = evsT.concat(S.tryEvolve(p)); });
gEv.evolutions = evsT;
ok('o Oddish evolui sozinho ate a bifurcacao e PARA',
   gEv.team[0].speciesId === 'gloom' && gEv.team[0].pendingEvoChoice === 'gloom');
ok('as duas esperam escolha', S.evolucoesPendentes().length === 2);
S.escolherEvolucao('ev0','bellossom');
S.escolherEvolucao('ev1','slowking');
const fim2 = S.__getGame();
ok('a escolha aplica especie e atributos',
   fim2.team[0].speciesId === 'bellossom' && fim2.team[0].baseHp === S.SPECIES.bellossom.hp &&
   fim2.team[1].speciesId === 'slowking' && fim2.team[1].spAtk === S.SPECIES.slowking.spAtk);
ok('nao sobra escolha pendente', S.evolucoesPendentes().length === 0);
ok('a tela avanca sozinha quando acaba', fim2.screen === 'evolution', fim2.screen);
ok('o log da evolucao registra as duas',
   fim2.evolutions.filter(e=>e.escolhida).length === 2,
   fim2.evolutions.map(e=>e.fromName+'->'+e.toName).join(', '));

console.log('\nOS INICIAIS');
ok('sao 7 iniciais', S.STARTERS.length === 7, S.STARTERS.join(','));
ok('3 de Kanto, 3 de Johto e o Pichu',
   S.STARTERS.filter(id=>S.SPECIES[id].dex<=151).length === 3 &&
   S.STARTERS.filter(id=>S.SPECIES[id].dex>151).length === 4 &&
   S.STARTERS.includes('pichu'));
/* O Pichu é o único inicial que já nasce com uma evolução pra frente (Pichu -> Pikachu -> Raichu).
   O triângulo dos outros seis não vale pra ele, e o rival responde com o Totodile. */
ok('o Pichu evolui, ao contrario dos outros seis',
   !!S.EVOLUTIONS.pichu && !S.STARTERS.filter(id=>id!=='pichu').some(id=>S.raizDaLinha(id)!==id),
   'raiz do pichu: ' + S.raizDaLinha('pichu'));
const semSp = S.STARTERS.filter(id=>!S.SPECIES[id]);
ok('todo inicial existe no SPECIES', semSp.length === 0, semSp.join(','));
ok('todo inicial tem contra-inicial pro rival',
   S.STARTERS.every(id=>S.STARTERS.includes(S.RIVAL_STARTER_COUNTER[id])),
   S.STARTERS.filter(id=>!S.STARTERS.includes(S.RIVAL_STARTER_COUNTER[id])).join(','));
ok('o contra-inicial nunca e o proprio', S.STARTERS.every(id=>S.RIVAL_STARTER_COUNTER[id] !== id));
ok('todo inicial tem evolucao mapeada',
   S.STARTERS.every(id=>S.SPECIES[S.STARTER_EVOLUTIONS[id]]),
   S.STARTERS.filter(id=>!S.SPECIES[S.STARTER_EVOLUTIONS[id]]).join(','));
ok('a evolucao mapeada e a que o EVOLUTIONS diz',
   S.STARTERS.every(id=>S.EVOLUTIONS[id] && S.EVOLUTIONS[id].into === S.STARTER_EVOLUTIONS[id]),
   S.STARTERS.filter(id=>!S.EVOLUTIONS[id] || S.EVOLUTIONS[id].into !== S.STARTER_EVOLUTIONS[id]).join(','));

console.log('\nA ELITE 4 SORTEADA');
ok('Johto tem os mesmos 4 postos', S.JOHTO_ELITE.length === S.ELITE_FOUR.length);
const medE = m => m.team.reduce((s,p)=>s+p.level,0) / m.team.length;
const eliteDif = S.ELITE_FOUR.map((k,i)=>[k,S.JOHTO_ELITE[i]])
  .filter(([k,j]) => k.team.length !== j.team.length || Math.abs(medE(k)-medE(j)) > 0.06);
ok('mesmo numero de pokemon e mesma media em cada posto', eliteDif.length === 0,
   eliteDif.map(([k,j])=>k.name+' x '+j.name).join(', '));
S.ELITE_FOUR.forEach((k,i)=>console.log('         posto '+(i+1)+': '+k.name.padEnd(9)+' x '+
  S.JOHTO_ELITE[i].name.padEnd(9)+'  '+k.team.length+' pokemon, media '+medE(k).toFixed(1)));
const semSpE = S.ELITE_FOUR.concat(S.JOHTO_ELITE).flatMap(m=>m.team.map(t=>t.speciesId)).filter(id=>!S.SPECIES[id]);
ok('todo pokemon da Elite existe', semSpE.length === 0, [...new Set(semSpE)].join(','));
ok('nenhum id de membro repetido',
   new Set(S.ELITE_FOUR.concat(S.JOHTO_ELITE).map(m=>m.id)).size === 8);
/* O Bruno está nos dois jogos e por isso nas duas listas. O sorteio não pode escalá-lo duas
   vezes na mesma fila -- o jogador enfrentaria o mesmo adversário em dois postos. */
let filaRepetida = 0, distintas = new Set();
for(let i = 0; i < 300; i++){
  const caminho = S.sortearCaminhoDaElite();
  const nomes = caminho.map((lado,s)=>(lado==='johto'?S.JOHTO_ELITE:S.ELITE_FOUR)[s].name);
  if(new Set(nomes).size !== nomes.length) filaRepetida++;
  distintas.add(nomes.join(','));
}
ok('o sorteio nunca repete adversario na mesma fila', filaRepetida === 0, filaRepetida + ' de 300');
ok('o sorteio varia de verdade', distintas.size >= 6, distintas.size + ' filas distintas em 300');
/* A fila é sorteada UMA VEZ: perder e voltar não pode ser um jeito de re-sortear até cair um
   caminho fácil. */
const gE = S.freshGameDefaults(); S.__setGame(gE);
gE.elitePath = null; gE.eliteAttemptsUsed = 0; gE.eliteStatus = null;
S.startEliteChallenge();
const filaInicial = (gE.elitePath||[]).join(',');
for(let tent = 1; tent <= 4; tent++){ gE.eliteAttemptsUsed = tent; S.startEliteChallenge(); }
ok('a fila NAO muda nas retentativas', gE.elitePath.join(',') === filaInicial,
   filaInicial + ' -> ' + gE.elitePath.join(','));
gE.elitePath = ['johto','kanto','johto','kanto'];
ok('o oponente da etapa segue a fila sorteada',
   S.eliteMembroDaEtapa(0).name === S.JOHTO_ELITE[0].name &&
   S.eliteMembroDaEtapa(1).name === S.ELITE_FOUR[1].name);

console.log('\nA DICA DE CADA GINASIO TEM QUE SER VERDADE');
/* `adviceTypes` é a frase "leve pokémon de tipo X". Se ela citar um tipo que mal acerta o time, o
   jogador gasta uma das 5 tentativas do ginásio seguindo o conselho do próprio jogo. Já aconteceu:
   a Jasmine dizia "Fogo, Lutador e Terra" copiando o time do jogo original -- só que aqui os
   Magnemite são Elétrico puro (tipagem da Gen 1) e Fogo/Lutador acertavam 1 de 5. */
const PT_EN = { Normal:'Normal', Fire:'Fogo', Water:'Água', Grass:'Planta', Electric:'Elétrico',
  Ice:'Gelo', Fighting:'Lutador', Poison:'Veneno', Ground:'Terra', Flying:'Voador',
  Psychic:'Psíquico', Bug:'Inseto', Rock:'Pedra', Ghost:'Fantasma', Dragon:'Dragão',
  Dark:'Sombrio', Steel:'Aço' };
const EN_PT = {}; Object.entries(PT_EN).forEach(([e,p]) => EN_PT[p] = e);
const multi = (atk, def) => def.reduce((m,d) => m * ((S.TYPE_CHART[atk]||{})[d] ?? 1), 1);
const dicaRuim = [], dicaInvalida = [];
todos.forEach(g => {
  g.adviceTypes.split(/,| e /).map(s=>s.trim()).filter(Boolean).forEach(p => {
    const t = EN_PT[p];
    if(!t){ dicaInvalida.push(g.leaderName + ': "' + p + '"'); return; }
    const n = g.team.filter(m => multi(t, S.SPECIES[m.species].types) > 1).length;
    if(n * 2 < g.team.length) dicaRuim.push(g.leaderName + ': ' + p + ' pega ' + n + '/' + g.team.length);
  });
});
ok('todo tipo citado na dica existe', dicaInvalida.length === 0, dicaInvalida.join(', '));
ok('todo tipo citado acerta ao menos metade do time', dicaRuim.length === 0, dicaRuim.join(' | '));

console.log('\nAS 16 INSIGNIAS SAO IMAGEM DE VERDADE');
const V = S.GYM_BADGE_VISUALS;
const semImg = todos.filter(g=>!V[g.id] || !V[g.id].img);
ok('todo ginasio tem URL de imagem', semImg.length === 0, semImg.map(g=>g.id).join(','));
/* A pasta do Archives e o MD5 do nome do arquivo. Conferir isso pega a classe de erro que ja
   aconteceu: as 8 URLs de Johto foram escritas de cabeca e deram 404 EM SILENCIO -- o onerror
   caia no emoji e ninguem via erro nenhum. */
const crypto = require('crypto');
const erradas = todos.filter(g=>{
  const arq = decodeURIComponent(V[g.id].img.split('/').pop().replace(/^50px-/, ''));
  const h = crypto.createHash('md5').update(arq).digest('hex').slice(0,2);
  return !V[g.id].img.includes('/thumb/'+h[0]+'/'+h+'/'+arq+'/');
});
ok('o caminho bate com o MD5 do nome do arquivo (regra do MediaWiki)', erradas.length === 0,
   erradas.map(g=>g.id).join(','));
ok('nenhuma URL repetida entre ginasios',
   new Set(todos.map(g=>V[g.id].img)).size === 16);

console.log('\nA TELA DE ESCOLHA');
g.gymIndex = 3; g.gymPath = []; g.starterId='charmander'; S.__setGame(g);
const html = S.renderGymChoice();
ok('mostra os dois ginasios da etapa', html.includes('Erika') && html.includes('Morty'));
/* Os dois caminhos ficam DENTRO da coluna centralizada, um por linha. Como linha propria embaixo
   do corpo (a primeira versao) viravam um rodape solto encostado na borda esquerda, e a insignia
   deixava de cobrir a altura do card. */
ok('mostra os dois caminhos de cada lado',
   (html.match(/class="gym-choice-rota"/g)||[]).length === 4 &&
   html.includes('Túnel de Pedra') && html.includes('Parque Nacional'),
   (html.match(/class="gym-choice-rota"/g)||[]).length + ' caminhos');
const entreCidadeERotas = html.slice(html.indexOf('gym-choice-cidade'), html.indexOf('gym-choice-rotas'));
const fechamentos = (entreCidadeERotas.match(/<[/]div>/g) || []).length;
ok('e eles ficam na coluna do lider, logo abaixo da cidade -- nao num rodape',
   fechamentos === 1, fechamentos + ' tag(s) fechando entre a cidade e os caminhos');
ok('os dois botoes escolhem regioes diferentes',
   html.includes("escolherGinasio('kanto')") && html.includes("escolherGinasio('johto')"));
ok('mostra a INSIGNIA de verdade, nao o emoji num circulo',
   (html.match(/badge-visual-img/g)||[]).length === 2,
   (html.match(/badge-visual-img/g)||[]).length + ' imagens');
ok('e o nome da insignia embaixo dela', (html.match(/gym-choice-selo-nome/g)||[]).length === 2);
/* O tipo tem que ser o SELO colorido, não a palavra solta ao lado do nome do líder. */
ok('o tipo do ginasio vira selo, nao texto no titulo',
   !html.includes('Brock — Pedra') && (html.match(/class="type-pill/g)||[]).length >= 2,
   (html.match(/class="type-pill/g)||[]).length + ' selos de tipo');
ok('nao anuncia mais a quantidade de pokemon', !/\d+ pokémon/.test(html));


console.log('\nA TELA DO ENCONTRO SELVAGEM');
g.screen = 'wild'; g.currentRoute = 'route_1'; g.wildSelected = [];
g.team = [{ speciesId:'charmander', level:16, types: S.SPECIES['charmander'].types }];
g.wildOffer = [{ speciesId:'kangaskhan', level:20, shiny:false },
               { speciesId:'nidorino',   level:15, shiny:true  },
               { speciesId:'ditto',      level:14, shiny:false, disguise:'mew' }];
S.__setGame(g);
const wild = S.renderWild();
/* A lupa e IRMA do card, nunca filha: <button> dentro de <button> e HTML invalido e o clique de
   dentro se perde. Ela so PARECE estar dentro, por position:absolute (ver .wild-dex no CSS). */
ok('a lupa nao esta aninhada dentro do card',
   !/<button class="btn wild-card(?:(?!<\/button>)[\s\S])*<button/.test(wild));
ok('cada card tem a sua lupa, menos o disfarcado',
   (wild.match(/class="wild-dex"/g) || []).length === 2,
   (wild.match(/class="wild-dex"/g) || []).length + ' lupas para 3 cards');
ok('a lupa e uma lupa, nao o icone da pokedex', wild.includes('>🔍</button>'));
/* O nivel mora na linha do NOME. Na linha de baixo ele saia menor e azul -- outra fonte, outra
   cor, outro texto. */
const primeiroCard = wild.split('mon-sub')[0];
ok('o nivel fica na linha do nome', /mon-name[\s\S]*— Lv\.20/.test(primeiroCard));
ok('o nivel nao se separa do travessao na quebra de linha', wild.includes('class="wild-lv">— Lv.'));
ok('o disfarcado nao ganha lupa: a ficha entregaria a pegadinha',
   !/Mew(?:(?!<\/div>)[\s\S])*wild-dex/.test(wild));
ok('a lupa abre a ficha da pokedex de verdade', wild.includes("abrirPokedexFicha('kangaskhan'"));


console.log('\nO TIPO DA ROTA PESA, MAS NAO DECIDE');
/* A rota citada pelo Matheus: Desvio por Lavender, Fantasma/Terra, com 3 do tipo num pool de 9.
   Sem peso ela dava 1,00 do tipo por oferta e em 23,5% das vezes NENHUM -- uma rota fantasma que
   nao parecia uma rota fantasma. O peso e 2 (dobro no sorteio, que nao e dobro de chance: o
   sorteio e sem reposicao e a oferta tem 3 vagas). */
const AMOSTRA = 4000;
g.team = []; S.__setGame(g);
const rotaLavender = S.ROUTE_MAP.flat().find(r => /Lavender/.test(r.name));
const tiposLav = rotaLavender.types;
const ehDoTipo = id => (S.SPECIES[id].types || []).some(x => tiposLav.includes(x));
let semPeso = 0, comPeso = 0, zeroComPeso = 0;
const vistas = new Set();
for(let i = 0; i < AMOSTRA; i++){
  semPeso += S.buildOfferFromPool(rotaLavender.pool, 3).filter(ehDoTipo).length;
  const of = S.buildOfferFromPool(rotaLavender.pool, 3, tiposLav);
  of.forEach(id => vistas.add(id));
  const q = of.filter(ehDoTipo).length;
  comPeso += q;
  if(q === 0) zeroComPeso++;
}
const mediaSem = semPeso / AMOSTRA, mediaCom = comPeso / AMOSTRA;
ok('o tipo da rota aparece mais', mediaCom > mediaSem + 0.2,
   mediaSem.toFixed(2) + ' -> ' + mediaCom.toFixed(2) + ' do tipo por oferta');
/* "mas nao muito": a oferta continua tendo mais de um pokemon de fora do tipo em media -- uma
   rota que so oferece o proprio tipo deixa de ser um encontro e vira uma loja. */
ok('mas a oferta continua mista', mediaCom < 2.0, mediaCom.toFixed(2) + ' de 3');
ok('e quase nunca sai uma oferta sem nenhum do tipo', zeroComPeso / AMOSTRA < 0.15,
   (zeroComPeso / AMOSTRA * 100).toFixed(1) + '% das ofertas');
/* Ninguem pode SUMIR da rota: uma especie que so mora aqui viraria uma vaga impossivel na
   Pokedex, e a Pokedex completa e o que libera o desafio do Mewtwo. */
ok('ninguem de fora do tipo some da rota', vistas.size === rotaLavender.pool.length,
   vistas.size + ' das ' + rotaLavender.pool.length + ' especies apareceram');
/* Rota sem tipo declarado tem que sortear exatamente como antes -- o peso 1 pra todo mundo E o
   embaralhamento uniforme. */
const poolLiso = S.ROUTE_MAP[0][0].pool;
const conta = {};
for(let i = 0; i < AMOSTRA; i++) for(const id of S.buildOfferFromPool(poolLiso, 3, [])) conta[id] = (conta[id]||0)+1;
const chances = poolLiso.map(id => (conta[id]||0) / AMOSTRA);
const alvo = 3 / poolLiso.length;
ok('sem tipo declarado, o sorteio continua uniforme',
   chances.every(c => Math.abs(c - alvo) < 0.04),
   'entre ' + (Math.min(...chances)*100).toFixed(1) + '% e ' + (Math.max(...chances)*100).toFixed(1) +
   '% (uniforme seria ' + (alvo*100).toFixed(1) + '%)');


console.log('\nA ESPECIE TEM QUE BATER COM O NIVEL');
/* O que foi reportado: um Caterpie Lv.17 e um Weedle Lv.13 na mesma tela. Nenhum dos dois existe
   nesse nivel -- aos 7 viram Metapod/Kakuna e aos 10, Butterfree/Beedrill. */
const eh = (id, n) => S.SPECIES[S.especieNoNivel(id, n)].name;
ok('Caterpie Lv.17 e um Butterfree', eh('caterpie',17) === 'Butterfree', eh('caterpie',17));
ok('Weedle Lv.13 e um Beedrill', eh('weedle',13) === 'Beedrill', eh('weedle',13));
ok('mas Caterpie Lv.8 ainda e um Metapod', eh('caterpie',8) === 'Metapod', eh('caterpie',8));
ok('e Caterpie Lv.6 continua Caterpie', eh('caterpie',6) === 'Caterpie', eh('caterpie',6));
ok('Oddish Lv.16 continua Oddish (so evolui no 21)', eh('oddish',16) === 'Oddish', eh('oddish',16));
ok('a cadeia anda mais de um passo de uma vez', eh('charmander',40) === 'Charizard', eh('charmander',40));
/* Nos pontos de bifurcacao quem escolhe e o JOGADOR (tela evoChoice). Escolher por ele aqui seria
   tirar a escolha antes mesmo da captura -- ele decide no primeiro nivel que subir depois de pegar. */
ok('Gloom Lv.45 continua Gloom: a escolha e do jogador', eh('gloom',45) === 'Gloom', eh('gloom',45));
ok('Poliwhirl e Slowpoke idem',
   eh('poliwhirl',45) === 'Poliwhirl' && eh('slowpoke',45) === 'Slowpoke');
ok('o Eevee tambem nao evolui sozinho', eh('eevee',45) === 'Eevee', eh('eevee',45));
/* O piso de nivel (pra uma evolucao nao aparecer cedo demais) nao pode empurrar a especie pra fora
   da propria janela: o Metapod existe do 7 ao 9, e a faixa deslocada chegava a 10. */
let foraDaJanela = 0;
for(let i=0;i<3000;i++){
  const n = S.rollWildLevel('metapod', 3, 6);
  if(n < 7 || n > 9) foraDaJanela++;
}
ok('o piso nao empurra o Metapod pra fora da janela dele (7-9)', foraDaJanela === 0,
   foraDaJanela + ' de 3000 fora');

console.log('\nO BOTAO "SEU TIME" ONDE SE DECIDE ALGO SOBRE O TIME');
g.gymIndex = 3; g.gymPath = []; g.starterId = 'charmander';
g.team = [{ speciesId:'charmander', level:16, types: S.SPECIES['charmander'].types }];
g.routeCards = null; S.__setGame(g);
ok('na escolha de ginasio', S.renderGymChoice().includes('abrirTimeModal()'));
ok('na escolha de rota (inicio da jornada)', S.renderWalk().includes('abrirTimeModal()'));
ok('e na escolha de rota dos trechos seguintes', S.renderWalkNext().includes('abrirTimeModal()'));
ok('com a contagem do time no rotulo', S.renderGymChoice().includes('Seu time (1)'));


console.log('\nBUSCAR PARTIDA ONLINE DE DENTRO DA JORNADA');
/* A busca ja era global (roda em qualquer tela e o convite aparece por cima). O que faltava era
   poder LIGAR ela sem ir ate a Batalha Online -- e ai a jornada ficava pra tras. */
const gB = S.freshGameDefaults();
gB.authUser = { uid:'u1' };
gB.saveSlots = [null, null, null];
gB.avisoLiga = null;
S.__setGame(gB);
ok('sem time com 8 insignias, nao oferece busca', S.botaoBuscaOnlineHtml() === '');
gB.saveSlots = [{ badgeCount:8, team:[{speciesId:'venusaur', level:70}] }, null, null];
S.__setGame(gB);
const parado = S.botaoBuscaOnlineHtml();
ok('com time pronto, o botao aparece', parado.includes('Ativar busca de partida online'));
ok('e ele liga a busca SEM sair da tela', parado.includes('startOnlineSearchAqui()'),
   parado.includes('startOnlineSearch()') ? 'esta chamando a versao que troca de tela' : '');
gB.onlineSearching = true; S.__setGame(gB);
const buscando = S.botaoBuscaOnlineHtml();
ok('buscando, o mesmo botao cancela', buscando.includes('cancelOnlineSearch()') && buscando.includes('Buscando oponente'));
gB.onlineSearching = false; S.__setGame(gB);
/* Sem login nao ha fila nenhuma pra entrar. */
gB.authUser = null; S.__setGame(gB);
ok('deslogado nao ve o botao', S.botaoBuscaOnlineHtml() === '');
gB.authUser = { uid:'u1' }; S.__setGame(gB);

console.log('\nO AVISO DA LIGA CLASSICA');
ok('sem inscricao aberta, nao aparece nada', !S.botaoBuscaOnlineHtml().includes('aviso-liga-jornada'));
gB.avisoLiga = { hora: new Date(2026, 7, 31, 14, 0, 0).getTime() };
S.__setGame(gB);
const comAviso = S.botaoBuscaOnlineHtml();
ok('com inscricao aberta, avisa a hora', comAviso.includes('aviso-liga-jornada') && comAviso.includes('14:00'),
   comAviso.includes('14:00') ? '' : 'a hora nao saiu no texto');
/* Pisca no mesmo ritmo do Bonus Shiny da home: mesma ideia, uma janela que expira. */
ok('e usa a classe que pisca', comAviso.includes('class="aviso-liga-jornada"'));

console.log('\nONDE O BOTAO APARECE (e onde NAO)');
gB.avisoLiga = null;
gB.team = [S.createInstance('charmander', 20)];
gB.gymIndex = 0; gB.gymPath = []; gB.losses = 0;
gB.battleResult = { win:true, matchups:[], playerStatus:[], brockStatus:[], leveledUpFromFaint:false };
S.__setGame(gB);
ok('na tela de antes da batalha', S.renderPreBattle().includes('startOnlineSearchAqui()'));
ok('e na tela de resultado', S.renderBattleResult(true).includes('startOnlineSearchAqui()'));
/* A Torre e as ligas ficam de FORA: la o jogador ja esta numa disputa organizada. */
gB.trainerBattleResult = { win:true, matchups:[{ player:'A', playerSpecies:'venusaur', playerLevel:70, playerShiny:false,
  enemy:'B', enemySpecies:'charizard', enemyLevel:70, enemyShiny:false, golpes:[], playerHpBefore:100, playerHpAfter:50,
  playerMaxHp:100, enemyHpBefore:100, enemyHpAfter:0, enemyMaxHp:100, playerAliveBefore:1, playerAliveAfter:1,
  playerTeamSize:1, enemyAliveBefore:1, enemyAliveAfter:0, enemyTeamSize:1, winner:'A' }] };
gB.trainerRevealIndex = 0; gB.trainerRevealPhase = 'done'; gB.trainerHitSequence = []; gB.trainerHitStep = 0;
gB.trainerBattleOpponentName = 'NPC'; gB.trainerBattlePlayerName = null;
S.__setGame(gB);
ok('a tela de batalha da Torre NAO oferece a busca', !S.renderTrainerBattling().includes('startOnlineSearchAqui()'));

console.log('\nO DESAFIO DO MEWTWO ABRE COM KANTO FECHADO');
/* Era "a Pokedex inteira menos o Mewtwo" -- com Johto isso virou 249 especies, tres delas
   impossiveis (Lugia, Ho-Oh, Celebi). Agora sao as 149 de Kanto. */
const kanto149 = Object.keys(S.SPECIES).filter(id => S.SPECIES[id].dex <= 151 && id !== 'mewtwo');
gB.permanentPokedex = kanto149; gB.permanentShinyDex = []; gB.saveSlots = [null,null,null];
gB.pokedexView = 'normal';
S.__setGame(gB);
ok('com as 149 de Kanto, o desafio abre', S.renderPokedex().includes('openMewtwoChallenge()'),
   kanto149.length + ' especies de Kanto');
gB.permanentPokedex = kanto149.slice(0, -1); S.__setGame(gB);
ok('faltando uma de Kanto, nao abre', !S.renderPokedex().includes('openMewtwoChallenge()'));
/* E Johto nao entra na conta: quem fechou Kanto nao precisa de Johto pra desafiar. */
gB.permanentPokedex = kanto149; S.__setGame(gB);
ok('e Johto nao faz falta nenhuma', S.renderPokedex().includes('openMewtwoChallenge()'));


console.log('\nO RESGATE DA ROCKET COM O TIME CHEIO');
/* Reportado: se a Rocket rouba um pokemon, o treinador enche o time com 6 e SO DEPOIS resgata, o
   resgatado nao cabia -- e voltava pro stolenMon "esperando uma vaga". Como stolenMon pendente e o
   que reabre o esconderijo, dava um laco sem fim: vencia a Rocket, nao recebia o pokemon, e podia
   desafiar de novo, pra sempre. */
function estadoResgate(tamanhoDoTime){
  const g = S.freshGameDefaults();
  g.gymIndex = 2; g.gymPath = []; g.starterId = 'charmander';
  g.team = Array.from({length: tamanhoDoTime}, (_,i)=>{
    const p = S.createInstance(['pidgey','ratata','oddish','zubat','geodude','machop'][i], 20+i);
    p.id = 'p'+i; return p;
  });
  g.stolenMon = Object.assign(S.createInstance('gyarados', 30), { id:'roubado' });
  g.hideoutStage = 1; g.hideoutAttemptsLeft = 3;
  g.specialBattle = { context:'hideout2', meta:{ opponentName:'Chefe Rocket' } };
  g.specialBattleResult = { win:true, matchups:[], playerStatus: g.team.map(()=>({})) };
  g.gymApproachRocketChecked = true; g.gymApproachRivalChecked = true;
  S.__setGame(g);
  return g;
}
// time com 4: o resgatado volta direto, como sempre foi
estadoResgate(4);
S.finishSpecialBattle();
let e = S.__getGame();
ok('com vaga, o resgatado volta pro time', e.team.length === 5 && e.team.some(p=>p.id==='roubado'));
ok('e o sequestro se encerra', e.stolenMon === null);

// time com 6: o buraco do relato
estadoResgate(6);
S.finishSpecialBattle();
e = S.__getGame();
/* Nao entra no time AGORA: 'specialResult' e ponto seguro de gravacao, e um time de 7 seria
   gravado assim. Ele espera num campo proprio ate a tela do Prof. Carvalho. */
ok('com o time cheio, o resgatado espera a vez', e.team.length === 6 && e.resgatadoSemVaga && e.resgatadoSemVaga.id === 'roubado');
ok('e o sequestro se encerra do mesmo jeito (fim do laco)', e.stolenMon === null,
   'stolenMon: ' + JSON.stringify(e.stolenMon && e.stolenMon.name));
S.continueAfterSpecial();
e = S.__getGame();
ok('a tela do Prof. Carvalho e quem resolve', e.screen === 'release', 'tela: ' + e.screen);
ok('e ai sim o time fica com 7', e.team.length === 7 && !e.resgatadoSemVaga);
ok('e ela sabe pra onde voltar depois', e.releaseDepois === 'gymApproach');
/* Escolhido quem sai, a jornada segue pra chegada no ginasio -- e nao pro fluxo do encontro
   selvagem, que e o outro caminho que usa essa mesma tela. */
e.releaseSelected = ['p0']; S.__setGame(e);
S.confirmRelease();
e = S.__getGame();
ok('sai um e o time volta a 6', e.team.length === 6 && !e.team.some(p=>p.id==='p0'));
ok('e a jornada continua (nao volta pro esconderijo)', e.screen !== 'rocketHideout' && !e.stolenMon,
   'tela: ' + e.screen);
ok('o marcador foi consumido', !e.releaseDepois);


/* A OFERTA SELVAGEM NUNCA REPETE UMA LINHA EVOLUTIVA.
   Um jogador viu DOIS Kingdra na mesma tela do Covil do Dragao (01/09/2026), e como a selecao e
   por especie (game.wildSelected guarda o id), clicar num marcava os dois. A causa nao estava no
   buildOfferFromPool -- ele ja evita isso no que sorteia -- e sim em quem entra DEPOIS dele: o
   raro da rota reivindica a vaga sem olhar pro resto, e um Seadra Lv.51 vira Kingdra pela regra
   de especie-por-nivel. Medido antes do conserto: 8,2% das ofertas de la, 0,88% do jogo, 9 rotas.
   Este teste roda TODAS as rotas das duas regioes porque o defeito nasceu numa so: quem escreve
   uma rota nova com um raro que ja mora no pool nao tem como lembrar disso sozinho. */
console.log('\n=== A OFERTA SELVAGEM ===');
(function(){
  let ofertas = 0, repetidas = 0, curtas = 0;
  const exemplos = [];
  [S.ROUTE_MAP, S.JOHTO_ROUTE_MAP].forEach(mapa => mapa.forEach((par, leg) => par.forEach(rota => {
    for(let i=0;i<400;i++){
      const g = S.__getGame();
      g.gymIndex = leg; g.team = []; g.starterId = 'bulbasaur'; g.gameMode = 'normal';
      g.currentRoute = rota.id;
      S.montaOfertaSelvagem();
      const oferta = S.__getGame().wildOffer || [];
      ofertas++;
      if(oferta.length < S.LEGS[leg].offerCount) curtas++;
      const raizes = oferta.map(o => S.raizDaLinha(o.speciesId));
      if(raizes.some((r, idx) => raizes.indexOf(r) !== idx)){
        repetidas++;
        if(exemplos.length < 3){
          exemplos.push(rota.name + ': ' + oferta.map(o => S.SPECIES[o.speciesId].name + ' Lv.' + o.level).join(' + '));
        }
      }
    }
  })));
  ok('nenhuma oferta traz duas da mesma linha', repetidas === 0,
     repetidas + ' de ' + ofertas + (exemplos.length ? '  |  ' + exemplos.join('  |  ') : ''));
  ok('e nenhuma oferta encolheu por causa disso', curtas === 0, curtas + ' de ' + ofertas);
})();
/* A troca da repetida sorteia -- entao ela nao pode furar a trava anti save-scumming: a mesma
   semente tem que devolver a mesma oferta, sempre. */
(function(){
  function ofertaCom(semente){
    const g = S.__getGame();
    g.gymIndex = 7; g.team = []; g.starterId = 'bulbasaur'; g.gameMode = 'normal';
    g.currentRoute = 'dragons_den';
    const orig = Math.random;
    Math.random = S.makeSeededRng(semente);
    try { S.montaOfertaSelvagem(); } finally { Math.random = orig; }
    return (S.__getGame().wildOffer || []).map(o => o.speciesId + ':' + o.level).join(',');
  }
  let iguais = 0;
  for(let i=0;i<200;i++){ if(ofertaCom('sem-' + i) === ofertaCom('sem-' + i)) iguais++; }
  ok('a mesma semente devolve a mesma oferta', iguais === 200, iguais + ' de 200');
})();

/* O RE-SORTEIO PAGO NÃO PODE FURAR A TRAVA ANTI SAVE-SCUMMING.
   O contador de re-sorteios entra na MESMA semente do encontro. Duas coisas têm que valer ao mesmo
   tempo: pagar troca a oferta (senão a moeda não comprou nada) e NÃO pagar devolve sempre a mesma
   (senão sair do save e voltar vira re-sorteio de graça, que é a artimanha inteira de volta). */
(function(){
  function preparar(){
    const g = S.__getGame();
    g.currentSaveSlot = 0; g.saveGen = 0; g.rivalName = 'Gary'; g.starterId = 'bulbasaur';
    g.gymIndex = 7; g.team = []; g.gameMode = 'normal';
    g.currentRoute = 'dragons_den'; g.wildEncounterSeq = 4;
    S.__setGame(g);
  }
  function ofertaComRerolls(n){
    const g = S.__getGame(); g.wildRerolls = n; S.__setGame(g);
    const orig = Math.random;
    Math.random = S.makeSeededRng(S.sementeDoEncontro());
    try { S.montaOfertaSelvagem(); } finally { Math.random = orig; }
    return (S.__getGame().wildOffer || []).map(o => o.speciesId + ':' + o.level).join(',');
  }
  preparar();
  const zero = ofertaComRerolls(0);
  ok('sem pagar, a oferta e sempre a mesma', ofertaComRerolls(0) === zero, zero.slice(0, 60));
  const um = ofertaComRerolls(1);
  ok('pagando, ela muda', um !== zero, zero.slice(0,40) + '  ->  ' + um.slice(0,40));
  ok('e o re-sorteio pago tambem e estavel', ofertaComRerolls(1) === um);
  /* Voltar ao contador anterior devolve a oferta anterior -- e o que garante que sair do save e
     voltar no meio de um re-sorteio nao inventa uma terceira oferta. */
  ok('e voltar ao contador antigo devolve a oferta antiga', ofertaComRerolls(0) === zero);
  /* Cada re-sorteio e uma oferta NOVA, nao um vaivem entre duas. */
  const varias = [0,1,2,3,4].map(ofertaComRerolls);
  ok('cinco re-sorteios dao cinco ofertas distintas', new Set(varias).size === 5,
     new Set(varias).size + ' distintas');
  /* ENCONTRO NOVO zera a contagem: o que foi pago valeu pra AQUELE encontro, nao pro proximo. */
  preparar();
  const g = S.__getGame(); g.wildRerolls = 3; g.authUser = null; S.__setGame(g);
  S.goToWildEncounter();
  ok('encontro novo zera os re-sorteios', (S.__getGame().wildRerolls || 0) === 0,
     String(S.__getGame().wildRerolls));
})();
/* E ele tem que SOBREVIVER AO SAVE: se nao fosse gravado, recarregar zeraria a contagem e a oferta
   voltaria a ser a original -- um re-sorteio pago que se desfaz sozinho. */
(function(){
  const g = S.__getGame();
  g.currentSaveSlot = 0; g.wildRerolls = 2; S.__setGame(g);
  const gravado = S.serializeGame();
  ok('o contador de re-sorteios vai pro save', gravado.wildRerolls === 2, String(gravado.wildRerolls));
})();

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
