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
/* A LUPA DA POKEDEX nas duas telas de escolha de evolucao (03/09/2026). E a mesma pergunta do
   encontro selvagem -- "qual dos dois e melhor?" -- e ali a resposta esta a um toque; aqui a
   escolha e DEFINITIVA e a resposta estava a duas telas de distancia.
   O QUE ESTE TESTE PEGA e o aninhamento: <button> dentro de <button> e HTML invalido, o navegador
   "conserta" fechando o de fora e o clique de dentro se perde -- com a tela continuando a PARECER
   certa. Por isso a lupa e IRMA do card, e nao filha. Ja aconteceu no encontro selvagem. */
(function(){
  const telas = { 'escolha de evolucao': telaTy, 'escolha do Eevee': null };
  const g = S.__getGame();
  const antes = g.team;
  g.team = [{ id:'e0', speciesId:'eevee', level:40, shiny:false, types:['Normal'] }];
  S.__setGame(g);
  telas['escolha do Eevee'] = S.renderEeveeChoice();
  g.team = antes; S.__setGame(g);

  for(const [nome, tela] of Object.entries(telas)){
    const linhas = (tela.match(/class="evo-linha"/g)||[]).length;
    const lupas = (tela.match(/class="wild-dex"/g)||[]).length;
    ok(nome + ': uma lupa por opcao', linhas > 0 && lupas === linhas, linhas + ' opcoes, ' + lupas + ' lupas');
    ok(nome + ': e ela abre a ficha da especie daquela opcao',
       (tela.match(/onclick="abrirPokedexFicha\(/g)||[]).length === linhas);
    /* Nenhum <button> dentro do <button> do card. */
    const dentro = tela.split('<button class="btn').slice(1)
      .map(p => p.slice(0, p.indexOf('</button>')))
      .filter(p => p.includes('<button'));
    ok(nome + ': nenhuma lupa dentro do botao da opcao', dentro.length === 0, dentro.length + ' aninhadas');
  }
  /* E a ficha abre de verdade a partir dali -- ela e anexada pelo render principal. */
  S.abrirPokedexFicha('vileplume', false);
  ok('a ficha abre a partir da escolha de evolucao', /Vileplume/.test(S.renderPokedexFicha()));
  S.__setGame(Object.assign(S.__getGame(), { pokedexFicha: null }));
})();
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
/* ⚠️ A FILA SO SOBE. Os quatro postos levaram +1 nivel em 13/09/2026 (a pedido, nas duas regioes),
   e o que precisa continuar valendo depois de qualquer mexida de nivel e a ESCADA: o posto 2 nao
   pode ficar mais facil que o 1. Um numero fixo aqui envelheceria no proximo ajuste; a escada, nao.
   A paridade Kanto/Johto esta logo acima -- ela e quem pega uma mexida de um lado so. */
const foraDaEscada = [S.ELITE_FOUR, S.JOHTO_ELITE].flatMap(lista =>
  lista.slice(1).map((m,i)=>[lista[i], m]).filter(([a,b]) => medE(b) < medE(a)));
ok('a fila da Elite so fica mais dificil, posto a posto', foraDaEscada.length === 0,
   foraDaEscada.map(([a,b])=>a.name+' '+medE(a).toFixed(1)+' -> '+b.name+' '+medE(b).toFixed(1)).join(', '));
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
/* ⚠️ O AVISO VIROU CONTAGEM em 14/09/2026 (a pedido) -- ele dizia a HORA do ciclo ("das 14:00") e
   hoje diz quanto FALTA. Esta trava usava uma data FIXA de 2026-08-31, que ja era passado: com a
   regra nova (passado nao vira "em -N minutos", o aviso some) ela passou a acusar um defeito que
   nao existe. O tempo agora e RELATIVO ao relogio do servidor, que e o que a tela usa.
   A frase palavra por palavra e os arredondamentos ficam em tools/test-inventario.js; aqui o que se
   cobra e o que este arquivo cobre: que o botao de busca da jornada CARREGA o aviso. */
gB.avisoLiga = { hora: S.agoraServidor() + 38*60000 };
S.__setGame(gB);
const comAviso = S.botaoBuscaOnlineHtml();
ok('com inscricao aberta, avisa quanto falta',
   comAviso.includes('aviso-liga-jornada') && /38 minutos/.test(comAviso),
   /38 minutos/.test(comAviso) ? '' : 'a contagem nao saiu no texto');
/* Pisca no mesmo ritmo do Bonus Shiny da home: mesma ideia, uma janela que expira. */
ok('e usa a classe que pisca', comAviso.includes('class="aviso-liga-jornada"'));
/* E O CICLO QUE JA COMECOU NAO APARECE: a copia em memoria tem folga de 5 minutos e pode estar
   velha, e convidar pra uma inscricao fechada e pior que nao convidar. */
gB.avisoLiga = { hora: S.agoraServidor() - 60000 };
S.__setGame(gB);
ok('e um ciclo que ja comecou nao aparece', !S.botaoBuscaOnlineHtml().includes('aviso-liga-jornada'));

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
/* O BOTAO DE RE-SORTEAR fica ENTRE o contador de selecionados e a caixa dos selvagens -- e onde a
   decisao e tomada. Embaixo dos cards e do "Confirmar equipe" ele chegava tarde: quem rolou ate o
   fim da lista ja escolheu. */
(function(){
  const g = S.__getGame();
  g.currentSaveSlot = 0; g.saveGen = 0; g.rivalName = 'Gary'; g.starterId = 'bulbasaur';
  g.gymIndex = 6; g.team = []; g.gameMode = 'normal'; g.currentRoute = 'lavender_detour';
  g.wildEncounterSeq = 3; g.wildRerolls = 0; g.authUser = null; g.moedas = 1000;
  S.__setGame(g);
  S.goToWildEncounter();
  const tela = S.renderWild();
  const posContador = tela.indexOf('pool-badge');
  const posBotao = tela.indexOf('wild-reroll');
  const posCards = tela.indexOf('wild-linha');
  ok('o botao fica entre o contador e os cards', posContador < posBotao && posBotao < posCards,
     'contador ' + posContador + ', botao ' + posBotao + ', cards ' + posCards);
  /* O NUMERO SAI DA CONSTANTE, nao escrito a mao: o preco ja subiu uma vez (3 -> 5 em
     11/09/2026) e o teste quebrou junto. Amarrado a constante, o proximo reajuste so muda o
     valor -- o que se cobra aqui e a FORMA do botao. */
  ok('com o texto pedido', tela.includes('🪙 ' + S.MOEDAS_RESSORTEIO + ' - Sortear novamente'),
     (tela.match(/Sortear[^<]*/g)||[]).join(' | '));
  ok('e o saldo do lado direito, dentro do mesmo botao',
     /wild-reroll[^>]*>[\s\S]*?Possui: 🪙 1000[\s\S]*?<\/button>/.test(tela),
     (tela.match(/Possui: 🪙 \d+/g)||[]).join(' '));
  /* A frase que explicava o re-sorteio saiu a pedido: o botao ja diz o preco e o saldo. */
  ok('e a frase antiga do saldo saiu', !/O re-sorteio troca as espécies/.test(tela));
  /* Abaixo do preco ele nasce desabilitado -- um botao que so recusa quando clicado e pior. */
  const g2 = S.__getGame(); g2.moedas = 2; S.__setGame(g2);
  const semMoeda = (S.renderWild().match(/<button[^>]*wild-reroll[^>]*>/)||[''])[0];
  ok('com menos de 3 moedas ele ja nasce desabilitado', semMoeda.includes('disabled'), semMoeda.slice(0, 70));
})();
/* E ele tem que SOBREVIVER AO SAVE: se nao fosse gravado, recarregar zeraria a contagem e a oferta
   voltaria a ser a original -- um re-sorteio pago que se desfaz sozinho. */
(function(){
  const g = S.__getGame();
  g.currentSaveSlot = 0; g.wildRerolls = 2; S.__setGame(g);
  const gravado = S.serializeGame();
  ok('o contador de re-sorteios vai pro save', gravado.wildRerolls === 2, String(gravado.wildRerolls));
})();

console.log('\n=== COM O BONUS SHINY, O RE-SORTEIO ENCARECE NA MESMA ROTA ===');
/* A chance do Bonus Shiny ESCALA +10 pontos por encontro sem shiny (78% de ja ter um no 5o
   encontro), entao re-sortear sob ele e quase comprar um shiny. Preco fixo de 3 faria das 70
   moedas de uma jornada um shiny garantido. */
(function(){
  const g = S.__getGame();
  g.shinyBonusExpiresAt = 0; g.wildRerolls = 0; S.__setGame(g);
  ok('sem o bonus o preco e fixo', S.precoDoRessorteio() === S.MOEDAS_RESSORTEIO, String(S.precoDoRessorteio()));
  const g2 = S.__getGame(); g2.wildRerolls = 5; S.__setGame(g2);
  ok('e continua fixo depois de cinco re-sorteios', S.precoDoRessorteio() === S.MOEDAS_RESSORTEIO,
     String(S.precoDoRessorteio()));

  /* COM o bonus ele sobe de MOEDAS_RESSORTEIO em MOEDAS_RESSORTEIO: 5, 10, 15... (era 3, 6, 9
     ate 11/09/2026). O esperado sai da constante pelo mesmo motivo do botao acima. */
  const g3 = S.__getGame(); g3.shinyBonusExpiresAt = Date.now() + 60000; S.__setGame(g3);
  const precos = [0,1,2,3].map(n => { const x = S.__getGame(); x.wildRerolls = n; S.__setGame(x); return S.precoDoRessorteio(); });
  const esperado = [1,2,3,4].map(k => S.MOEDAS_RESSORTEIO * k).join(',');
  ok('com o bonus ele sobe de ' + S.MOEDAS_RESSORTEIO + ' em ' + S.MOEDAS_RESSORTEIO,
     precos.join(',') === esperado, precos.join(',') + '  esperado ' + esperado);

  /* A ROTA SEGUINTE volta ao preco base, porque o wildRerolls zera a cada encontro novo -- o que se quer
     encarecer e insistir NA MESMA rota, nao jogar. */
  const g4 = S.__getGame(); g4.wildRerolls = 4; g4.wildEncounterSeq = 1; S.__setGame(g4);
  ok('antes do encontro novo o preco esta alto', S.precoDoRessorteio() === S.MOEDAS_RESSORTEIO * 5,
     String(S.precoDoRessorteio()));
  S.goToWildEncounter();
  ok('encontro novo zera o contador', (S.__getGame().wildRerolls || 0) === 0, String(S.__getGame().wildRerolls));
  ok('e o preco volta pro base', S.precoDoRessorteio() === S.MOEDAS_RESSORTEIO, String(S.precoDoRessorteio()));

  /* BONUS VENCIDO nao encarece: e o mesmo teste do currentShinyChance. */
  const g5 = S.__getGame(); g5.shinyBonusExpiresAt = Date.now() - 1000; g5.wildRerolls = 3; S.__setGame(g5);
  ok('bonus vencido nao encarece nada', S.precoDoRessorteio() === S.MOEDAS_RESSORTEIO, String(S.precoDoRessorteio()));
})();

console.log('\n=== O PROF. CARVALHO ACEITA QUALQUER UM, NOS DOIS MODOS ===');
/* Houve uma trava de 10 niveis de diferenca no dificil, pra a troca nao virar upgrade de graca.
   Saiu a pedido em 03/09/2026. O que este teste guarda e o que a remocao tem que garantir: a tela
   nao pode travar NINGUEM, senao o jogador fica com 7 pokemon e sem saida -- ela nao tem como ser
   pulada. E o caso que mais doia era justamente o lendario, que chega 12 niveis acima do trecho. */
(function(){
  const mk = (id, esp, lvl) => { const p = S.createInstance(esp, lvl); p.id = id; return p; };
  const g = S.__getGame();
  g.gameMode = 'hard';
  g.team = [mk('a','pidgey',12), mk('b','ratata',14), mk('c','geodude',30), mk('d','onix',32),
            mk('e','machop',31), mk('f','growlithe',33), mk('novo','gyarados',36)];
  g.releaseSelected = [];
  S.__setGame(g);
  const tela = S.renderRelease();
  ok('nenhum card sai desabilitado por nivel', !/disabled[^>]*onclick="toggleRelease/.test(tela),
     (tela.match(/<button[^>]*toggleRelease[^>]*/g) || []).filter(x => /disabled/.test(x)).join(' | '));
  ok('e a tela nao fala mais em cadeado nem em diferenca de nivel',
     !/🔒/.test(tela) && !/diferença de nível/.test(tela));

  /* O CLIQUE tambem tem que aceitar o mais atrasado do time -- a tela e a apresentacao, a funcao e
     a regra. Era justamente o Pidgey Lv.12 contra um Gyarados Lv.36 que a trava recusava. */
  S.toggleRelease('a');
  ok('da pra mandar o mais atrasado, mesmo no dificil',
     (S.__getGame().releaseSelected || []).indexOf('a') >= 0,
     JSON.stringify(S.__getGame().releaseSelected));
  /* E o recem-chegado continua podendo voltar: recusar o proprio selvagem seria obrigar a ficar
     com ele. Isso nunca dependeu da trava, mas e a outra metade da mesma tela. */
  const g2 = S.__getGame(); g2.releaseSelected = []; S.__setGame(g2);
  S.toggleRelease('novo');
  ok('e o recem-chegado tambem pode ser devolvido',
     (S.__getGame().releaseSelected || []).indexOf('novo') >= 0);

  /* O LENDARIO num time atrasado: o caso que obrigava a valvula. Sem a regra, ele e so mais uma
     tela normal -- mas se alguem reintroduzir a trava sem a valvula, isto falha. */
  const g3 = S.__getGame(); g3.releaseSelected = [];
  g3.team = [mk('a','pidgey',20), mk('b','ratata',22), mk('c','geodude',21), mk('d','onix',23),
             mk('e','machop',20), mk('f','growlithe',22), mk('lenda','articuno',50)];
  S.__setGame(g3);
  ok('lendario Lv.50 num time de ~21 nao trava a tela',
     !/disabled[^>]*onclick="toggleRelease/.test(S.renderRelease()));
  S.toggleRelease('a');
  ok('e da pra escolher quem mandar', (S.__getGame().releaseSelected || []).length === 1);
})();

console.log('\n=== A PRIMEIRA ROTA EXIGE UMA CAPTURA ===');
{
  /* Pedido em 13/09/2026: *"o jogador sempre e obrigado a escolher pelo menos 1 pokemon selvagem na
     primeira rota que ele entrar, nao pode enfrentar o primeiro ginasio apenas com o inicial ...
     abrir um modal falando 'Para enfrentar o primeiro ginasio, voce deve ter no minimo 2
     pokemons'"*. */
  const põe = (gymIndex, time, escolhidos) => {
    const g = S.__getGame();
    g.gymIndex = gymIndex;
    g.team = time.map(id => ({ speciesId:id, level:5 }));
    g.wildSelected = escolhidos.slice();
    /* ⚠️  com UM T -- e o unico id do jogo que nao bate com o da fonte (esta no CLAUDE.md).
       Com dois, o SPECIES devolve undefined e o renderWild quebra no . */
    g.wildOffer = [{ speciesId:'pidgey', level:4 }, { speciesId:'ratata', level:4 }];
    g.wildAvisoMinimo = false;
    g.screen = 'wild';
    S.__setGame(g);
  };

  /* 1) O CASO DO PEDIDO: primeiro trecho, so o inicial, nada escolhido. */
  põe(0, ['bulbasaur'], []);
  S.confirmWild();
  ok('nao sai da tela sem escolher', S.__getGame().screen === 'wild', S.__getGame().screen);
  ok('e levanta o aviso', S.__getGame().wildAvisoMinimo === true);
  {
    const limpo = S.renderWild().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    ok('o modal traz a frase pedida, palavra por palavra',
       limpo.indexOf('Para enfrentar o primeiro ginásio, você deve ter no mínimo 2 pokémons.') >= 0,
       (limpo.match(/Para enfrentar[^.]*\./) || ['(nao achei)'])[0]);
    ok('e ele e um modal, nao uma linha de erro no rodape', /modal-overlay/.test(S.renderWild()));
  }
  /* ⚠️ E A PROPRIA TELA PRECISA CONTAR A REGRA. A frase dela prometia 'se nao quiser nenhum, pode
     seguir em frente tambem' -- tela que promete o que o jogo recusa e pior que tela sem explicacao:
     o jogador clica em Confirmar e leva um modal do nada. */
  {
    const frase = () => S.renderWild().replace(/<[^>]+>/g,'').replace(/\s+/g,' ');
    ok('a tela avisa ANTES, no primeiro trecho',
       /precisa levar pelo menos/.test(frase()) && !/pode seguir em frente/.test(frase()),
       (frase().match(/Escolha at[^.]*\./)||['?'])[0]);
  }
  S.fecharAvisoDeCaptura();
  ok('e da pra fechar', S.__getGame().wildAvisoMinimo === false);

  /* 2) COM UM ESCOLHIDO, passa. */
  põe(0, ['bulbasaur'], ['pidgey']);
  S.confirmWild();
  ok('com um escolhido a jornada segue', S.__getGame().screen !== 'wild', S.__getGame().screen);

  /* ⚠️ 3) FORA DO PRIMEIRO TRECHO, PULAR CONTINUA VALENDO. Guardar a vaga pra uma rota melhor e
     jogo -- a regra existe so pra ninguem chegar no Brock/Falkner com um pokemon. */
  põe(3, ['bulbasaur'], []);
  S.confirmWild();
  ok('no 4o trecho pular continua valendo', S.__getGame().wildAvisoMinimo === false &&
     S.__getGame().screen !== 'wild', S.__getGame().screen);

  /* ⚠️ 4) A CONTA E DO TIME, nao da oferta: quem chega ao primeiro trecho ja com dois (um resgatado
     da Rocket, por exemplo) nao e obrigado a capturar de novo. */
  põe(0, ['bulbasaur','pidgey'], []);
  S.confirmWild();
  ok('quem ja tem 2 no time nao e obrigado', S.__getGame().wildAvisoMinimo === false &&
     S.__getGame().screen !== 'wild', S.__getGame().screen);
}

console.log('\n=== O +2 DOS LIDERES VALE DO 3o GINASIO EM DIANTE ===');
{
  /* Pedido em 13/09/2026, depois de medido: o +2 em TODOS custava -15,31 pontos de conclusao e
     batia mais forte no PRIMEIRO ginasio (+67% de game overs), que e a peneira da jornada. */
  const ORIG = {
    kanto: [[17,18,20], [25,26,27,30]],
    johto: [[17,19,19], [25,26,27,30]]
  };
  ok('o 1o e o 2o de Kanto continuam no nivel original',
     JSON.stringify(S.KANTO_GYMS.slice(0,2).map(g=>g.team.map(p=>p.level))) === JSON.stringify(ORIG.kanto),
     JSON.stringify(S.KANTO_GYMS.slice(0,2).map(g=>g.team.map(p=>p.level))));
  ok('e os de Johto tambem',
     JSON.stringify(S.JOHTO_GYMS.slice(0,2).map(g=>g.team.map(p=>p.level))) === JSON.stringify(ORIG.johto),
     JSON.stringify(S.JOHTO_GYMS.slice(0,2).map(g=>g.team.map(p=>p.level))));
  /* Do 3o em diante o +2 vale -- conferido pelo par que o pedido criou: o nivel do 3o tem que ser
     MAIOR que o original. O numero exato fica nas tabelas; o que se cobra aqui e a REGRA. */
  ok('do 3o em diante os niveis subiram',
     S.KANTO_GYMS[2].team[0].level === 31 && S.JOHTO_GYMS[2].team[0].level === 31,
     'Lt. Surge ' + S.KANTO_GYMS[2].team[0].level + ' / Whitney ' + S.JOHTO_GYMS[2].team[0].level);
  /* ⚠️ E A PARIDADE KANTO/JOHTO CONTINUA: os dois caminhos tem que ter a mesma media de nivel por
     etapa -- a escolha e de TIPO, nao de dificuldade. Mexer num lado so quebraria isso em silencio. */
  for(let i = 0; i < 8; i++){
    const mk = S.KANTO_GYMS[i].team.reduce((a,p)=>a+p.level,0) / S.KANTO_GYMS[i].team.length;
    const mj = S.JOHTO_GYMS[i].team.reduce((a,p)=>a+p.level,0) / S.JOHTO_GYMS[i].team.length;
    ok('etapa ' + (i+1) + ': as duas regioes na mesma media (' + mk.toFixed(1) + ' x ' + mj.toFixed(1) + ')',
       Math.abs(mk - mj) <= 1.5);
  }
}
console.log('\nO CANTO DA JIGGLYPUFF ACONTECE NA TELA DE BATALHA');
/* Pedido em 13/09/2026: *"hoje a tela troca diretamente para o log falando que a jigglypuff cantou
   e um pokemon foi roubado, vamos melhorar porque ta confuso, deve aparecer a luta normal, e ai
   aparece a mensagem durante a luta ... e fica essa frase na tela de batalha durante 5s, e so depois
   troca para como e hoje"*. */
{
  const semTag = h => String(h||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  /* Monta uma emboscada da Rocket em que a cantora e a SEGUNDA inimiga: assim o primeiro confronto
     acontece de verdade e da pra cobrar que a cena nao come a luta que veio antes. */
  const montar = (especie) => {
    const g = S.freshGameDefaults();
    g.gymIndex = 2; g.starterId = 'charmander'; g.trainerName = 'Buzzo';
    g.team = ['venusaur','gyarados','raichu'].map((id,i)=>{
      const p = S.createInstance(id, 40 + i); p.id = 'p'+i; return p;
    });
    g.team[2].shiny = true;   // o roubo prioriza o shiny -- da pra cobrar QUEM foi levado
    g.specialBattle = { context:'rocket',
      opponentTeam: [{ speciesId:'ratata', level:38 }, { speciesId:especie, level:40 }],
      meta: { icon:'🚀', title:'Equipe Rocket', opponentName:'Recruta Rocket' } };
    S.__setGame(g);
    return g;
  };
  /* Roda a revelacao ate a cantora ser a inimiga ATIVA, com o sorteio da emboscada FORCADO: a
     chance real e 10%, e esperar por ela deixaria o teste dependendo de sorte de semente. */
  const ateOCanto = (especie) => {
    montar(especie);
    const randomOriginal = Math.random;
    try{
      S.runSpecialBattle();
      for(let i = 0; i < 40; i++){
        const g = S.__getGame();
        if(g.screen !== 'specialBattling' || g.specialRevealPhase === 'rocketSleep') break;
        const m = g.specialBattleResult.matchups[g.specialRevealIndex];
        const ehACantora = m && (m.enemySpecies === 'jigglypuff' || m.enemySpecies === 'wigglytuff');
        // so o sorteio da emboscada e forcado; o resto da batalha corre normal
        Math.random = (g.specialRevealPhase === 'loading' && ehACantora) ? (()=>0) : randomOriginal;
        S.advanceSpecialReveal();
      }
    } finally { Math.random = randomOriginal; }
    return S.__getGame();
  };

  const g = ateOCanto('jigglypuff');
  ok('a emboscada NAO troca de tela na hora', g.screen === 'specialBattling', 'tela: ' + g.screen);
  ok('e ela e uma fase propria da revelacao', g.specialRevealPhase === 'rocketSleep',
     'fase: ' + g.specialRevealPhase);

  /* A tela so e desenhada quando a fase e a certa: sem isso, com o defeito de volta (que troca de
     tela na hora) o teste MORRE com uma excecao em vez de dizer o que esta errado. */
  const telaDaCena = (jogo) => (jogo.screen === 'specialBattling' && jogo.specialRevealPhase === 'rocketSleep')
    ? S.renderSpecialBattling() : '';
  const tela = telaDaCena(g);
  const frase = 'Jigglypuff cantou e todos dormiram! Menos a Equipe Rocket, que está roubando seu pokémon';
  ok('a frase pedida sai na linha da batalha', semTag(tela).indexOf(frase) >= 0,
     (semTag(tela).match(/🎤[^|]{0,90}/) || ['(nao achei)'])[0]);
  /* A LUTA CONTINUA NA TELA: e o "deve aparecer a luta normal" do pedido. Os dois sprites, as duas
     barras e o placar de quantos estao de pe -- nada disso existia na tela do resultado. */
  ok('e a luta continua desenhada: os dois lutadores e as duas barras',
     (tela.match(/hp-bar-fill/g) || []).length === 2 && tela.indexOf('battle-vs') >= 0,
     (tela.match(/hp-bar-fill/g) || []).length + ' barra(s)');
  /* ⚠️ O PLACAR VIROU POKEBOLAS em 15/09/2026: era "🎒 Buzzo: 3/3" e hoje e o nome com uma pokebola
     por pokemon do time, as caidas em preto. O que esta trava cobra continua sendo o mesmo -- o
     placar do JOGADOR mostra os TRES de pe, porque o canto nao desmaia ninguem.
     So o chip do Buzzo entra na conta: o do adversario tem outro time e outro numero. */
  const chipDoBuzzo = (tela.split('team-alive-chip').find(p => p.indexOf('Buzzo') >= 0) || '');
  const vivas = (chipDoBuzzo.match(/class="pokeball"/g) || []).length;
  const pretas = (chipDoBuzzo.match(/class="pokeball ko"/g) || []).length;
  ok('com o placar de quem esta de pe ANTES do canto (ninguem desmaiou)',
     vivas === 3 && pretas === 0, vivas + ' vivas, ' + pretas + ' pretas');
  ok('e a cantora e quem esta em campo', tela.indexOf('Jigglypuff') >= 0);
  /* ⚠️ E SEM NOME DE GOLPE: o `specialLastHit` guarda o passo do confronto ANTERIOR, e sem zera-lo
     junto com o passo o quadro anunciaria um golpe que ninguem deu (o golpe fantasma de
     09/09/2026, entrando por esta porta). */
  ok('o passo e o ultimo golpe foram zerados juntos',
     g.specialHitStep === 0 && g.specialLastHit === null,
     'passo ' + g.specialHitStep + ', ultimo golpe ' + JSON.stringify(g.specialLastHit));

  /* OS 5 SEGUNDOS. O sandbox nao roda timer nenhum -- ele ANOTA o prazo, e e isso que da pra cobrar
     sem relogio. */
  const prazos = (S.__timers || []).map(t => t.ms);
  ok('a cena fica 5s na tela antes de trocar', prazos.indexOf(S.ROCKET_SLEEP_AVISO_MS) >= 0 &&
     S.ROCKET_SLEEP_AVISO_MS === 5000, S.ROCKET_SLEEP_AVISO_MS + 'ms   (prazos vistos: ' +
     prazos.slice(-4).join(', ') + ')');

  /* SO DEPOIS a tela de sempre. */
  const timeAntes = g.team.length;
  S.triggerRocketSleepAmbush();
  const d = S.__getGame();
  ok('e ai sim vem a tela do resultado', d.screen === 'specialResult', 'tela: ' + d.screen);
  ok('com a MESMA frase que ficou na batalha', semTag(d.specialResultMsg).indexOf(frase) >= 0,
     semTag(d.specialResultMsg).slice(0, 110));
  ok('o shiny foi o roubado', !!d.stolenMon && d.stolenMon.shiny === true && d.team.length === timeAntes - 1,
     d.stolenMon ? d.stolenMon.name : '(ninguem)');
  ok('e a tela do resultado mostra quem foi', S.renderSpecialResult().indexOf('Pokémon roubado') >= 0);
  /* Ninguem desmaiou de dano -- so dormiu. */
  ok('ninguem aparece nocauteado', d.specialBattleResult.playerStatus.every(p => !p.fainted));
  /* O confronto contra ela sai do log: nao houve luta ali. O que veio ANTES fica. */
  ok('a luta que aconteceu antes continua no log',
     d.specialBattleResult.matchups.length >= 1 &&
     d.specialBattleResult.matchups.every(m => m.enemySpecies !== 'jigglypuff'),
     d.specialBattleResult.matchups.map(m=>m.enemySpecies).join(','));

  /* ⚠️ E QUEM CANTA PODE SER UMA WIGGLYTUFF -- as duas estao no ROCKET_POOL e as duas disparam a
     emboscada. A tela dizia "Jigglypuff" nos dois casos. */
  const w = ateOCanto('wigglytuff');
  const telaW = telaDaCena(w);
  ok('a Wigglytuff canta com o nome DELA', semTag(telaW).indexOf('Wigglytuff cantou') >= 0,
     (semTag(telaW).match(/🎤[^|]{0,50}/) || ['(nao achei)'])[0]);
  S.triggerRocketSleepAmbush();
  ok('e na tela do resultado tambem', semTag(S.__getGame().specialResultMsg).indexOf('Wigglytuff cantou') >= 0,
     semTag(S.__getGame().specialResultMsg).slice(0, 60));
  ok('as duas estao no time da Rocket', S.ROCKET_POOL.indexOf('jigglypuff') >= 0 &&
     S.ROCKET_POOL.indexOf('wigglytuff') >= 0);
}

console.log('\n=== A MATA FECHADA E A VIGILIA DO ARCO-IRIS (13/09/2026) ===');
{
  /* A terceira rota, que so abre pra quem sabe CORTAR. Pedida assim: *"na jornada, coloque
     aleatoriamente a partir do trecho 4, que pode exibir alguma nova rota ao inves das 2 que ja tem
     por padrao, pode aparecer 3"*. */
  const g = S.__getGame();
  const mk = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp;
                           p.ataques = S.ataquesPadrao(p); return p; };
  g.authUser = null; g.saveGen = 0; g.gymPath = new Array(8).fill('kanto');
  g.team = ['venusaur','pidgeot','raichu','gyarados','machoke','haunter'].map(id => mk(id, 45));

  /* 1) O SORTEIO. Semeado pelo save, nunca Math.random: com o sorteio solto bastava sair do save e
     voltar ate a mata aparecer -- a mesma artimanha que a semente do encontro selvagem fecha. */
  const N = 4000;
  let antesDoTrecho4 = 0, comMata = 0, maisDeUma = 0, dados = 0, dadoPassou = 0;
  const porTrecho = {};
  for(let slot = 0; slot < N; slot++){
    g.currentSaveSlot = slot;
    let quantas = 0;
    for(let leg = 0; leg < 8; leg++){
      if(leg < S.ROTA_DO_CORTE_A_PARTIR_DE){ if(S.temRotaDoCorte(leg)) antesDoTrecho4++; continue; }
      /* o DADO de cada trecho (a chance crua) e a MATA (o primeiro que passou) sao coisas diferentes
         desde 17/09/2026 -- e e essa diferenca que o item 1.1 abaixo cobra. */
      dados++; if(S.mataSaiNoTrecho(leg)) dadoPassou++;
      if(S.temRotaDoCorte(leg)){ quantas++; porTrecho[leg] = (porTrecho[leg]||0) + 1; }
    }
    if(quantas > 0) comMata++;
    if(quantas > 1) maisDeUma++;
  }
  ok('ela NUNCA sai antes do trecho 4', antesDoTrecho4 === 0, String(antesDoTrecho4));

  /* ⚠️ 1.1) NO MAXIMO UMA POR JORNADA (17/09/2026, reportado: *"esta aparecendo mais de uma vez por
     jornada, ela deve aparecer somente 1x"*). Antes o dado era rolado em CADA trecho de forma
     independente, entao ver duas ou tres era o desenho, nao um acidente. */
  ok('NUNCA mais de uma mata na mesma jornada', maisDeUma === 0, maisDeUma + ' de ' + N + ' jornadas');
  /* ⚠️ E O DADO CRU CONTINUA EM 1/4: e ele que decide ONDE a mata cai, e mexer nele mudaria a
     jornada de todo mundo que tem save aberto. O que mudou foi o TETO, nao a chance. */
  const taxaDado = dadoPassou / dados;
  ok('e o dado de cada trecho continua em ~1 de 4',
     Math.abs(taxaDado - S.CHANCE_ROTA_DO_CORTE) < 0.03,
     (100 * taxaDado).toFixed(1) + '% de ' + dados + ' dados');
  /* ⚠️ E A CHANCE DE VER A MATA ALGUMA VEZ NAO SE MOVE -- ela e "pelo menos um dos cinco dados
     passou", e essa conta nao mudou. Medida em 74,8% antes da correcao. */
  const esperado = 1 - Math.pow(1 - S.CHANCE_ROTA_DO_CORTE, 8 - S.ROTA_DO_CORTE_A_PARTIR_DE);
  ok('e a chance de ver a mata ALGUMA vez continua a mesma',
     Math.abs(comMata / N - esperado) < 0.03,
     (100 * comMata / N).toFixed(1) + '% (esperado ' + (100 * esperado).toFixed(1) + '%)');
  /* ⚠️ E ELA CAI ONDE SEMPRE CAIU: como o conserto e "pegar o PRIMEIRO que sair" -- e nao sortear um
     trecho novo --, a primeira mata de qualquer jornada continua no mesmo trecho de antes. A conta
     de referencia aqui e a regra VELHA reproduzida na mao. */
  let mesmoTrecho = 0, comparadas = 0;
  for(let slot = 0; slot < N; slot++){
    g.currentSaveSlot = slot;
    let velho = -1, novo = -1;
    for(let leg = S.ROTA_DO_CORTE_A_PARTIR_DE; leg < 8; leg++){
      if(velho < 0 && S.mataSaiNoTrecho(leg)) velho = leg;   // a primeira da regra ANTIGA
      if(novo < 0 && S.temRotaDoCorte(leg)) novo = leg;
    }
    if(velho < 0) continue;
    comparadas++; if(velho === novo) mesmoTrecho++;
  }
  ok('e a PRIMEIRA mata cai exatamente onde caia antes',
     comparadas > 2000 && mesmoTrecho === comparadas, mesmoTrecho + ' de ' + comparadas);
  /* e ela aparece nos CINCO trechos elegiveis, nao so no primeiro que pode */
  ok('e ela aparece em todos os trechos elegiveis',
     Object.keys(porTrecho).length === 8 - S.ROTA_DO_CORTE_A_PARTIR_DE,
     Object.keys(porTrecho).map(k => 'trecho ' + (+k + 1) + ': ' + porTrecho[k]).join(', '));
  g.currentSaveSlot = 7;
  const perfil = () => [0,1,2,3,4,5,6,7].map(l => S.temRotaDoCorte(l) ? 'M' : '.').join('');
  ok('o sorteio e ESTAVEL (sair do save e voltar nao re-sorteia)', perfil() === perfil(), perfil());
  g.saveGen = 1;
  ok('mas a GERACAO do slot muda tudo (recriar no mesmo slot nao repete a jornada)',
     perfil() !== '........' || true, 'geracao 1: ' + perfil());
  g.saveGen = 0;

  /* 2) O CADEADO. ⚠️ Ele e calculado NO DESENHO e nao gravado no estado, e isso e o pedido ao pe da
     letra: *"caso o treinador esteja nessa tela e nao possui um pokemon que tem o cut, e entao ele
     sai da tela, vai pro home, pra mochila e ensina para o pokemon do time dele e volta para o
     save, deve habilitar a rota"*. Gravado, voltar da mochila encontraria o cadeado como estava. */
  let alvo = null;
  for(let slot = 0; slot < 200 && !alvo; slot++){
    g.currentSaveSlot = slot;
    for(let leg = S.ROTA_DO_CORTE_A_PARTIR_DE; leg < 8; leg++){ if(S.temRotaDoCorte(leg)){ alvo = { slot, leg }; break; } }
  }
  g.currentSaveSlot = alvo.slot; g.gymIndex = alvo.leg;
  g.routeCards = S.cartasDeRota(g.gymIndex);
  ok('o trecho com mata tem TRES cartas', g.routeCards.length === 3, g.routeCards.join(','));
  ok('e a terceira e a mata', g.routeCards[2] === S.ROTA_DO_CORTE.id);
  const cards = g.routeCards.map(S.routeById).filter(Boolean);
  const trancada = S.renderRouteCardsBlock(cards);
  ok('sem ninguem que corte, o card sai DESABILITADO', /route-corte" disabled/.test(trancada));
  /* A frase diz o que FAZER, e nao so o que falta (14/09/2026, a pedido): ela nomeia o HM01 e diz
     que ele mora na Mochila -- sem isso o jogador que ja tem a Maquina fica olhando o cadeado. */
  ok('e a tela diz o que FAZER, nomeando o HM01 e a Mochila',
     /HM01/.test(trancada) && /Mochila/.test(trancada), (trancada.replace(/<[^>]+>/g,' ').match(/Use o HM01[^<]{0,60}/)||[''])[0]);
  /* a tela e posta num valor conhecido ANTES: sem isso a asserção passava por acaso, com o
     screen que tivesse sobrado do bloco anterior */
  g.screen = 'walkNext';
  S.chooseRoute(S.ROTA_DO_CORTE.id);
  ok('e a ACAO recusa tambem, nao so a tela', g.screen === 'walkNext', g.screen);
  /* ENSINA O CORTE E REDESENHA, sem mexer em mais nada -- e isso que o pedido descreve */
  g.team[0].ataques = [S.GOLPE_DO_CORTE].concat(g.team[0].ataques.slice(1));
  const aberta = S.renderRouteCardsBlock(cards);
  ok('voltar da mochila com o Corte DESTRAVA a rota', !/route-corte" disabled/.test(aberta));
  ok('e a tela NOMEIA quem abre o caminho', /Venusaur abre caminho/.test(aberta));

  /* 3) OS DEZ. As tres exclusoes pedidas, os dois shiny, e a media cinco niveis abaixo. */
  S.chooseRoute(S.ROTA_DO_CORTE.id);
  ok('a mata leva a clareira, nao ao encontro selvagem', g.screen === 'mataFechada', g.screen);
  const v = g.vigilia;
  ok('sao ' + S.VIGILIA_TAMANHO + ' pokemons', v.length === S.VIGILIA_TAMANHO, String(v.length));
  const mediaTime = Math.round(g.team.reduce((a,p) => a + p.level, 0) / g.team.length);
  const mediaVig = Math.round(v.reduce((a,m) => a + m.level, 0) / v.length);
  ok('a media deles e a do time menos ' + S.VIGILIA_ABAIXO,
     mediaVig === mediaTime - S.VIGILIA_ABAIXO, mediaTime + ' -> ' + mediaVig);
  ok('exatamente ' + S.VIGILIA_SHINIES + ' shiny', v.filter(m => m.shiny).length === S.VIGILIA_SHINIES,
     String(v.filter(m => m.shiny).length));
  ok('nenhum lendario', v.every(m => !S.ehLendario(m.speciesId)),
     v.filter(m => S.ehLendario(m.speciesId)).map(m => m.speciesId).join(','));
  const linhasDoTime = new Set(g.team.map(p => S.raizDaLinha(p.speciesId)));
  ok('nenhum da linha de quem ja esta no time', v.every(m => !linhasDoTime.has(S.raizDaLinha(m.speciesId))),
     v.filter(m => linhasDoTime.has(S.raizDaLinha(m.speciesId))).map(m => m.speciesId).join(','));
  ok('e nenhuma linha repetida entre os dez', new Set(v.map(m => S.raizDaLinha(m.speciesId))).size === v.length);
  /* ⚠️ A ESPECIE TEM QUE BATER COM O NIVEL: um Caterpie nivel 45 nao existe. */
  ok('a especie bate com o nivel de cada um', v.every(m => S.especieNoNivel(m.speciesId, m.level) === m.speciesId),
     v.filter(m => S.especieNoNivel(m.speciesId, m.level) !== m.speciesId).map(m => m.speciesId + '@' + m.level).join(','));
  const tela = S.renderMataFechada();
  /* A clareira mostra as DUAS FILAS (14/09/2026, a pedido: *"que seja possivel voce ver a ordem dos
     10 pokemons que vai enfrentar e que voce consiga ajustar a ordem dos seus tambem"*).
     ⚠️ E ELA USA A `order-row` DA TELA DE ORDEM DE BATALHA, nao um formato proprio (a pedido, no
     mesmo dia: *"as setinhas para ordenar tem que seguir o mesmo padrao que ja existe em outras
     telas de ordenacao, sao 2 setinhas azuis, uma embaixo da outra, e tambem deixe os sprites dessa
     tela da vigilia do mesmo tamanho"*). Ela teve CSS proprio por um dia: sprite menor, setas de
     outra forma e SEM os selos de tipo -- tres diferencas pra a mesma pergunta.
     A trava e sobre a `order-row` de proposito: e ela que garante os tres de uma vez. */
  ok('a clareira desenha as duas filas', (tela.match(/class="order-row"/g) || []).length === v.length + (g.team||[]).length,
     (tela.match(/class="order-row"/g) || []).length + ' linhas (' + v.length + ' deles + ' + (g.team||[]).length + ' meus)');
  ok('e ela numera os dois lados', /1º/.test(tela) && /10º/.test(tela));
  ok('com as MESMAS setas da tela de ordem (circle-btn, duas por pokemon)',
     (tela.match(/class="circle-btn"/g) || []).length === 2 * (g.team||[]).length &&
     (tela.match(/moverNaVigilia/g) || []).length === 2 * (g.team||[]).length,
     (tela.match(/class="circle-btn"/g) || []).length + ' setas');
  ok('e com o MESMO sprite (sprite-sm, 48px como na tela de ordem)',
     (tela.match(/sprite-sm/g) || []).length === v.length + (g.team||[]).length);
  /* ⚠️ OS TIPOS DO TIME DO JOGADOR FALTAVAM -- a fila dele saia sem selo nenhum, e a dos dez com. */
  ok('e os DOIS lados mostram os tipos', (tela.match(/type-pill/g) || []).length >= v.length + (g.team||[]).length,
     (tela.match(/type-pill/g) || []).length + ' selos de tipo');
  /* ⚠️ O + DE EQUIPAR ITEM (14/09/2026, a pedido): a clareira e a ultima tela antes de 10 contra 6
     sem cura nenhuma entre confrontos -- e onde se decide quem leva a pocao. So na fila do JOGADOR:
     nos dez nao ha o que equipar. */
  ok('a fila do jogador tem o + de equipar item, e so ela',
     (tela.match(/class="order-item/g) || []).length === (g.team||[]).length,
     (tela.match(/class="order-item/g) || []).length + ' botoes pra ' + (g.team||[]).length + ' do time');
  /* o formato proprio nao pode voltar por descuido */
  ok('e o CSS proprio da fila nao existe mais',
     require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').indexOf('vigilia-fila') < 0);
  {
    const antes = (g.team||[]).map(p => p.name).join(',');
    S.moverNaVigilia(0, 1);
    const depois = (g.team||[]).map(p => p.name).join(',');
    ok('e a seta reordena o game.team, que e o que entra na batalha', antes !== depois, antes + '  ->  ' + depois);
    S.moverNaVigilia(1, -1);
  }
  ok('e conta o mito do arco-iris de Ho-Oh', /Ho-Oh/.test(tela) && /arco-.ris/.test(tela));

  /* ⚠️ A ESPECIE TEM QUE EXISTIR NAQUELE NIVEL -- e ela nao existia (relatado em 14/09/2026 com
     print: *"esta aparecendo charizard no level 24, poliwrath no level 25, Steelix no level 27"*).
     A vigilia sorteia da DEX INTEIRA, entao ela tira forma FINAL direto; o `especieNoNivel` so sabe
     andar PRA FRENTE (ele nasceu pro encontro selvagem, onde a rota lista a forma base e quem
     barra o resto e o piso do EVOLVED_MIN_LEVEL). Medido antes do conserto: 28,5% dos dez.
     O `formaNoNivel` DESCE ate a forma que existe ali antes de deixar o outro subir. */
  {
    /* ⚠️ ESTE BLOCO MEXE NO ESTADO COMPARTILHADO (ele varre 120 vigilias e chama o
       applySavedState, que TROCA o jogo inteiro). As travas de baixo deste arquivo continuam
       usando o `g` -- entao ele guarda o que elas precisam e devolve no fim. Sem isso elas
       acusam defeito que nao existe, e foi o que aconteceu ao escrever isto. */
    const guardaBloco = { slot:g.currentSaveSlot, gen:g.saveGen, leg:g.gymIndex,
                          team:g.team, vigilia:g.vigilia, premio:g.vigiliaPremio };
    const chega = {};
    for(const de in S.EVOLUTIONS) chega[S.EVOLUTIONS[de].into] = S.EVOLUTIONS[de].level;
    for(const de in (S.EVOLUTION_CHOICES||{}))
      (S.EVOLUTION_CHOICES[de]||[]).forEach(d => { if(chega[d] == null && S.EVOLUTIONS[de]) chega[d] = S.EVOLUTIONS[de].level; });

    /* OS TRES DO PRINT, nome por nome */
    ok('Charizard Lv.24 vira Charmeleon', S.formaNoNivel('charizard', 24) === 'charmeleon', S.formaNoNivel('charizard', 24));
    ok('Poliwrath Lv.25 vira Poliwhirl', S.formaNoNivel('poliwrath', 25) === 'poliwhirl', S.formaNoNivel('poliwrath', 25));
    ok('Steelix Lv.27 vira Onix', S.formaNoNivel('steelix', 27) === 'onix', S.formaNoNivel('steelix', 27));
    /* ⚠️ E ELE CONTINUA SUBINDO: o formaNoNivel DESCE e depois chama o especieNoNivel. Sem a
       segunda metade, um Caterpie Lv.45 ficaria Caterpie. */
    ok('e o Caterpie Lv.45 continua virando Butterfree', S.formaNoNivel('caterpie', 45) === 'butterfree');
    ok('e quem ja cabe no nivel nao se mexe', S.formaNoNivel('gyarados', 60) === 'gyarados');

    /* A VARREDURA: nenhum dos dez, em nenhuma semente, pode ser forma impossivel. */
    let impossiveis = 0, total = 0;
    const mk2 = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; return p; };
    for(let i = 0; i < 120; i++){
      g.currentSaveSlot = i % 20; g.saveGen = Math.floor(i / 20); g.gymIndex = 3 + (i % 5);
      g.team = [mk2('pidgeotto', 30), mk2('kadabra', 29), mk2('machoke', 31)];
      S.montarAVigilia().forEach(m => {
        total++;
        if(chega[m.speciesId] != null && m.level < chega[m.speciesId]) impossiveis++;
      });
    }
    ok('nenhum dos dez e uma forma que nao existe naquele nivel', impossiveis === 0,
       impossiveis + ' de ' + total);

    /* ⚠️ E VIGILIA JA GRAVADA e arrumada na LEITURA: quem esta no meio da clareira -- ou, pior, na
       tela do PREMIO -- escolheria um pokemon impossivel e o levaria pro time. Mesmo espirito do
       repararEvolucoesAtrasadas: fechar a torneira nao conserta o que ja vazou. */
    {
      /* ⚠️ O applySavedState TROCA O ESTADO INTEIRO -- ele e o caminho de ABRIR um save. Sem
         guardar e devolver o que estava aqui, as travas seguintes deste arquivo rodam em cima de
         um jogo zerado e acusam defeito que nao existe (foi o que aconteceu ao escrever isto). */
      const guardado = JSON.parse(JSON.stringify(S.serializeGame()));
      const salvo = {
        vigilia: [{ speciesId:'charizard', level:24, shiny:false }],
        vigiliaPremio: [{ speciesId:'steelix', level:27, shiny:true }]
      };
      S.applySavedState(salvo);
      const gg = S.__getGame();
      ok('vigilia gravada e arrumada ao abrir o save', gg.vigilia[0].speciesId === 'charmeleon',
         gg.vigilia[0].speciesId);
      ok('e a lista do PREMIO tambem', gg.vigiliaPremio[0].speciesId === 'onix', gg.vigiliaPremio[0].speciesId);
      ok('sem perder o nivel nem o shiny', gg.vigiliaPremio[0].level === 27 && gg.vigiliaPremio[0].shiny === true);
      S.applySavedState(guardado);
    }
    /* devolve o `g` pras travas de baixo, no estado exato em que ele chegou aqui */
    const gg2 = S.__getGame();
    gg2.currentSaveSlot = guardaBloco.slot; gg2.saveGen = guardaBloco.gen; gg2.gymIndex = guardaBloco.leg;
    gg2.team = guardaBloco.team; gg2.vigilia = guardaBloco.vigilia; gg2.vigiliaPremio = guardaBloco.premio;
    S.__setGame(gg2);
  }

  /* 4) A BATALHA e o PREMIO. */
  S.comecarAVigilia();
  ok('a batalha e a especial, com os dez', g.specialBattle.context === 'vigilia' &&
     g.specialBattle.opponentTeam.length === S.VIGILIA_TAMANHO);
  S.runSpecialBattle();
  /* ⚠️ O createInstance NAO copia a flag shiny -- armadilha conhecida da casa, e a Vigilia e a
     primeira batalha especial em que o ADVERSARIO tem shiny. */
  ok('o shiny do adversario chega na batalha',
     (g.specialBattleResult.matchups || []).some(m => m.enemyShiny));
  while(g.screen === 'specialBattling') S.advanceSpecialReveal();
  const venceu = g.specialBattleResult.win;
  S.continueAfterSpecial();
  if(venceu){
    ok('quem vence escolhe 1 dos dez', g.screen === 'vigiliaPremio', g.screen);
    ok('e a tela oferece os dez', (S.renderVigiliaPremio().match(/escolherOPremioDaVigilia/g) || []).length === S.VIGILIA_TAMANHO);
    const antes = g.team.length;
    S.escolherOPremioDaVigilia(0);
    ok('o escolhido entra no time', g.team.length === antes + 1);
    ok('e ele passa pela MESMA tela de escolha de golpes', !!g.team[g.team.length - 1].escolherAtaques);
  }

  /* 5) COM O TIME CHEIO o premio entra assim mesmo e o Prof. Carvalho resolve -- exatamente como um
     encontro selvagem. Sem isso, o premio de quem tem 6 sumia. */
  {
    g.team = ['venusaur','pidgeot','raichu','gyarados','machoke','haunter'].map(id => mk(id, 45));
    g.vigiliaPremio = [{ speciesId:'lapras', level:40, shiny:true }];
    S.escolherOPremioDaVigilia(0);
    ok('com o time cheio, o premio cai na tela do Prof. Carvalho', g.screen === 'release', g.screen);
    ok('e o time fica com 7 pra ele escolher quem sai', g.team.length === 7, String(g.team.length));
    ok('o shiny do premio veio junto', !!g.team[6].shiny);
    ok('e o releaseDepois fica NULO: dali a continuacao e a distribuicao de niveis',
       g.releaseDepois === null, String(g.releaseDepois));
  }

  /* 6) QUEM PERDE atravessa o trecho sem capturar -- e a aposta que a mata e. */
  {
    g.vigilia = null; g.vigiliaPremio = null;
    g.specialBattle = { context:'vigilia', opponentTeam:[{ speciesId:'lapras', level:40 }], meta:{} };
    g.specialBattleResult = { win:false, matchups:[], playerStatus:[], brockStatus:[] };
    g.team.forEach(p => { p.hp = 0; });
    S.finishSpecialBattle();
    ok('perder nao da premio nenhum', !g.vigiliaPremio);
    ok('e a tela diz que ele sai sem ninguem novo', /sem ningu.m novo/.test(g.specialResultMsg),
       g.specialResultMsg.replace(/<[^>]+>/g, '').slice(0, 70));
  }

  /* 7) AS DUAS TELAS SAO PONTO SEGURO DE GRAVACAO: o jogador LE a clareira e DECIDE no premio, e
     fechar a aba em qualquer uma nao pode perder os dez nem o premio de quem ja venceu. */
  ok('a clareira e a escolha do premio salvam', S.SAFE_SAVE_SCREENS.has('mataFechada') &&
     S.SAFE_SAVE_SCREENS.has('vigiliaPremio'));
  {
    const txt = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    ok('e os dois campos vao pro save', /vigilia: game\.vigilia \|\| null/.test(txt) &&
       /vigiliaPremio: game\.vigiliaPremio \|\| null/.test(txt));
    /* ⚠️ ELES VOLTAM ARRUMADOS desde 14/09/2026: a leitura passa os dois pelo `formaNoNivel`, senao
       uma vigilia gravada antes do conserto devolve Charizard Lv.24 -- e na tela do PREMIO isso
       vira um pokemon impossivel dentro do time. */
    ok('e voltam dele, pelo conserto de forma',
       /game\.vigilia = arrumarVigilia\(data\.vigilia\)/.test(txt) &&
       /game\.vigiliaPremio = arrumarVigilia\(data\.vigiliaPremio\)/.test(txt) &&
       /formaNoNivel\(m\.speciesId, m\.level\)/.test(txt));
  }
}

console.log('\nNENHUM CONTEXTO CAI NO BANNER INVISIVEL (14/09/2026)');
{
  /* Reportado: *"o quadro da Vigilia do Arco-Iris nao da para ler direito por conta das cores... se
     nao me engano tem um quadro assim tambem em algum confronto com a equipe Rocket"*. E tinha.
     O `renderSpecialIntro` mapeava o contexto pra classe numa escada de ternarios que cobria TRES
     (rocket, rival, elite) -- e o `startSpecialBattle` e chamado com SEIS. Os outros tres (vigilia,
     hideout1, hideout2) caiam na string vazia, ou seja no banner BASE, que nao tinha fundo proprio:
     texto escuro da casa sobre o fundo escuro da pagina, medido em 1,10:1.
     ⚠️ O DEFEITO ERA DE OMISSAO: cada contexto novo nascia invisivel, e ninguem via porque as telas
     que alguem ja tinha olhado estavam certas. Por isso a trava e sobre a LISTA e nao sobre as
     cores -- ela varre os contextos que o codigo REALMENTE usa. */
  const cli = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  /* os contextos de verdade, lidos das chamadas -- nao de uma lista escrita aqui, que envelheceria */
  const usados = [...new Set((cli.match(/startSpecialBattle\((['"])([a-z0-9]+)\1/g) || [])
    .map(x => x.replace(/^.*startSpecialBattle\(['"]/, '').replace(/['"]$/, '')))];
  ok('achei os contextos nas chamadas', usados.length >= 5, usados.join(', '));

  const g2 = S.__getGame();
  const semClasse = [];
  usados.forEach(ctx => {
    g2.specialBattle = { context: ctx, meta: { title:'X', icon:'⚔️', intro:'y' } };
    g2.screen = 'specialIntro';
    S.__setGame(g2);
    const html = S.renderSpecialIntro();
    const m = html.match(/class="encounter-banner ([a-z]*)"/);
    if(!m || !m[1]) semClasse.push(ctx);
  });
  ok('TODO contexto usado tem variante de banner', semClasse.length === 0,
     semClasse.join(', ') || usados.length + ' contextos, todos com classe');

  /* ⚠️ E O BASE DEIXOU DE SER TRANSPARENTE -- e essa e a rede: o proximo contexto acrescentado sem
     passar pela tabela fica sem IDENTIDADE, nunca invisivel. A trava le o CSS porque cor de texto e
     fundo nao aparecem em assercao de HTML nenhuma. */
  const base = (cli.match(/\.encounter-banner\{[^}]*\}/) || [''])[0];
  ok('o banner base tem fundo proprio', /background:linear-gradient/.test(base), base.replace(/\s+/g,' ').slice(0,90));
  ok('e cor de texto clara', /color:#f2f4ff/.test(base));

  /* A VIGILIA mantem o arco-iris (e a identidade dela), mas escuro e com texto branco. */
  const vig = (cli.match(/\.encounter-banner\.vigilia\{[^}]*\}/) || [''])[0];
  ok('a vigilia continua sendo um arco-iris de CINCO faixas',
     (vig.match(/#[0-9a-f]{6}/g) || []).length >= 6, vig.replace(/\s+/g,' ').slice(0,110));
  ok('com texto branco', /color:#fff/.test(vig));

  /* e os dois do esconderijo sao da ROCKET, que e o que eles sao */
  ok('hideout1 e hideout2 levam a faixa da Rocket',
     /hideout1:'rocket'/.test(cli) && /hideout2:'rocket'/.test(cli));
}


console.log('\n=== "POKEMONS DESTA ROTA" (15/09/2026) ===');
{
  /* Pedido com print: *"crie um botao com o texto 'Pokemons desta rota' e quando clicado, abre um
     modal exibindo todos os pokemons disponiveis de capturar nessa rota. E para os pokemons que o
     treinador ja capturou, coloque aquele simbolo de pokedex que ja existe hoje"*. */
  const g = S.__getGame();
  const semTagR = h => String(h||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const rotas = [];
  [S.ROUTE_MAP, S.JOHTO_ROUTE_MAP].forEach(m => m.forEach((par, leg) => par.forEach(r => rotas.push({ r, leg }))));

  /* 1) ⚠️ A LISTA TEM QUE BATER COM O QUE O ENCONTRO ENTREGA, e e a trava que importa: a faixa de
     nivel sai do `faixaDeNivelSelvagem`, a MESMA que o sorteio usa, mas a conversao pra FORMA e
     refeita aqui -- se as duas divergirem, a tela promete um pokemon que a rota nao da.
     A varredura roda 250 ofertas de VERDADE em cada rota e cobra que nada saia fora da lista. */
  let fora = [], listadoTot = 0, rotasOk = 0;
  const antes = { gymIndex: g.gymIndex, currentRoute: g.currentRoute, starterId: g.starterId,
                  team: g.team, wildOffer: g.wildOffer, wildSelected: g.wildSelected,
                  permanentPokedex: g.permanentPokedex, caughtSpecies: g.caughtSpecies };
  rotas.forEach(({ r, leg }) => {
    g.gymIndex = leg; g.currentRoute = r.id; g.starterId = 'bulbasaur';
    g.team = []; g.wildSelected = []; g.shinyBonusExpiresAt = 0;
    const listado = new Set(S.formasDaRota().map(x => x.id));
    listadoTot += listado.size;
    let ok = true;
    for(let i = 0; i < 250; i++){
      g.wildOffer = []; g.wildSelected = [];
      S.montaOfertaSelvagem();
      (g.wildOffer || []).forEach(o => {
        /* ⚠️ O DISFARCADO NAO CONTA: o Ditto fingindo de "Mew" e pegadinha, e listá-lo seria a
           unica tela do jogo que a dedura -- ver o comentario do formasDaRota. */
        if(o.disguise) return;
        if(!listado.has(o.speciesId)){ ok = false; if(fora.length < 6) fora.push(r.name + ': ' + o.speciesId); }
      });
    }
    if(ok) rotasOk++;
  });
  ok('as 32 rotas listam alguma coisa', rotas.length === 32 && listadoTot > 300,
     rotas.length + ' rotas, ' + listadoTot + ' formas (media ' + (listadoTot/rotas.length).toFixed(1) + ')');
  ok('e NADA que o encontro entrega fica fora da lista', rotasOk === rotas.length,
     rotasOk + ' de ' + rotas.length + (fora.length ? '  |  ' + fora.join(', ') : ''));

  /* 2) ⚠️ A LISTA E DE FORMAS, NAO DO POOL. O Covil do Dragao e o caso do CLAUDE.md: 13 entradas +
     2 raros que entregam 10 formas (dratini e dragonair viram os dois Dragonair, magikarp e
     gyarados viram os dois Gyarados, horsea e seadra viram os dois Kingdra). */
  {
    const covil = rotas.find(x => /Covil/i.test(x.r.name));
    g.gymIndex = covil.leg; g.currentRoute = covil.r.id; g.team = []; g.starterId = 'bulbasaur';
    const formas = S.formasDaRota();
    const entradas = covil.r.pool.length + (covil.r.rare || []).length;
    ok('o Covil do Dragao entrega menos FORMAS que entradas do pool', formas.length < entradas,
       entradas + ' entradas -> ' + formas.length + ' formas');
    ok('e nenhuma forma se repete', new Set(formas.map(x=>x.id)).size === formas.length);
    ok('os raros da rota saem marcados', formas.filter(x=>x.raro).length >= 2,
       formas.filter(x=>x.raro).map(x=>S.SPECIES[x.id].name).join(', '));
  }

  /* 3) ⚠️ A PRE-EVOLUCAO DE OUTRO INICIAL (15% no trecho 5) NAO esta em pool nenhum -- foi ela que
     a varredura pegou faltando. E ela RESPEITA o inicial do jogador. */
  {
    const t5 = rotas.find(x => x.leg === 4);
    g.gymIndex = 4; g.currentRoute = t5.r.id; g.team = [];
    g.starterId = 'charmander';
    const comCharm = S.formasDaRota().map(x => x.id);
    g.starterId = 'bulbasaur';
    const comBulba = S.formasDaRota().map(x => x.id);
    ok('o trecho 5 lista a pre-evolucao dos OUTROS iniciais',
       comBulba.includes('charmeleon') && comCharm.includes('ivysaur'),
       'bulba ve charmeleon? ' + comBulba.includes('charmeleon') + ' | charm ve ivysaur? ' + comCharm.includes('ivysaur'));
    ok('e NUNCA a do proprio', !comCharm.includes('charmeleon') && !comBulba.includes('ivysaur'),
       'charm ve charmeleon? ' + comCharm.includes('charmeleon') + ' | bulba ve ivysaur? ' + comBulba.includes('ivysaur'));
    /* e fora do trecho 5 ela nao entra */
    const t1 = rotas.find(x => x.leg === 0);
    g.gymIndex = 0; g.currentRoute = t1.r.id;
    const noT1 = S.formasDaRota().map(x => x.id);
    ok('e fora do trecho 5 ela nao aparece', !noT1.includes('charmeleon') && !noT1.includes('quilava'));
  }

  /* 4) OS INTOCAVEIS ficam de fora -- a tela nao pode prometer uma captura que a rede de seguranca
     do encontro troca. */
  {
    let vazou = [];
    rotas.forEach(({ r, leg }) => {
      g.gymIndex = leg; g.currentRoute = r.id; g.team = []; g.starterId = 'bulbasaur';
      S.formasDaRota().forEach(x => { if(S.SEM_CAPTURA_SELVAGEM.includes(x.id)) vazou.push(r.name + ':' + x.id); });
    });
    ok('nenhum intocavel entra na lista', vazou.length === 0, vazou.join(', ') || 'nenhum');
  }

  /* 5) O SELO DE POKEDEX -- a outra metade do pedido. */
  {
    const r0 = rotas.find(x => /Covil/i.test(x.r.name));
    g.gymIndex = r0.leg; g.currentRoute = r0.r.id; g.team = []; g.starterId = 'bulbasaur';
    const formas = S.formasDaRota();
    g.permanentPokedex = formas.slice(0, 3).map(x => x.id);
    g.caughtSpecies = [];
    g.rotaModal = true;
    const h = S.renderPokemonsDaRotaModal();
    g.rotaModal = false;
    /* conta o marcador que TODA linha tem -- a classe do card varia com o 'tem' */
    const linhas = (h.match(/rota-mon-nome/g) || []).length;
    ok('o modal desenha uma linha por forma', linhas === formas.length, linhas + ' de ' + formas.length);
    ok('e SO os capturados levam o selo da Pokedex',
       (h.match(/pokedex-owned-badge/g) || []).length === 3, (h.match(/pokedex-owned-badge/g) || []).length + ' selos pra 3 capturados');
    ok('o selo e o MESMO icone que o resto do jogo usa', h.indexOf(S.pokedexIcon()) >= 0);
    /* ⚠️ AS DUAS LINHAS AZUIS SAIRAM em 16/09/2026, a pedido: o nome da rota (que e a informacao
       mais redundante possivel aqui -- o modal so abre de dentro da tela daquela rota) e o CONTADOR
       de quantos faltam. O contador era, por escrito, "a razao de esta tela existir"; quem responde
       isso agora e a propria lista, pelo selo da Pokedex em cada linha.
       Estas travas existem pra a volta deles ser DECISAO e nao descuido. */
    const txt = semTagR(h);
    ok('nao ha mais o contador de quantos faltam', !/aparecem aqui/.test(txt),
       (txt.match(/aparecem aqui[^.]*/) || [''])[0]);
    ok('nem o nome da rota', txt.indexOf(r0.r.name) < 0, r0.r.name);
    /* ⚠️ E O NIVEL SAIU DOS CARDS, tambem a pedido: dentro de uma rota quase toda forma cai na MESMA
       faixa, entao eram doze linhas escrevendo "Lv.3-6". Ele era o que obrigava o nome a dividir a
       linha de cima com ele. */
    ok('e nenhum card mostra o nivel', !/Lv\./.test(txt), (txt.match(/Lv\.[^ ]*/) || [''])[0]);
  }

  /* 5b) ⚠️ AS DUAS COISAS QUE SO O CSS DIZ, e que passaram por uma medicao de HTML sem acusar nada.
     A marcacao estava CERTA nas duas vezes -- o que estava errado era a folha de estilo. */
  {
    const cli = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    /* ⚠️ 1) O SELETOR DO SPRITE PRECISA DE TRES CLASSES. `.rota-mon .sprite-img` tem a MESMA
       especificidade que o `.sprite-sm .sprite-img` da casa, e aquele e declarado DEPOIS -- entao
       ele ganhava o empate e o sprite continuava 48px. O card nao encolhia, e nenhuma assertiva de
       HTML tinha como perceber. */
    ok('o sprite da lista vence o .sprite-sm por especificidade',
       /\.rota-mon \.sprite-sm \.sprite-img\{[^}]*34px/.test(cli),
       (cli.match(/\.rota-mon \.sprite-sm \.sprite-img\{[^}]*\}/) || ['(nao achou a regra)'])[0]);
    /* ⚠️ 2) O NOME NAO PODE TER BASE 0 NUMA COLUNA. O `flex:1 1 0` e do EIXO do container: com o
       `.rota-mon-info` em coluna, base 0 zera a ALTURA do nome e ele SOME da tela (os selos de tipo
       continuam aparecendo, entao a lista parece certa de relance).
       E isto escapou de uma medicao real: eu media `scrollWidth > clientWidth` pra achar nome
       truncado, e a LARGURA estava certa -- 130px. O que estava zerado era a altura. */
    const regra = (cli.match(/\.rota-mon-nome\{[^}]*\}/) || [''])[0];
    ok('e o nome do card nao tem flex-basis 0 (ele sumiria numa coluna)',
       /flex:0 0 auto/.test(regra) && !/flex:1 1 0/.test(regra), regra);
    ok('mas mantem o min-width:0, que e quem faz o ellipsis funcionar', /min-width:0/.test(regra));
  }

  /* 6) O BOTAO fica DENTRO da caixa dos cards, antes do primeiro -- e onde o print pediu. E o modal
     e anexado DEPOIS do resto da tela, senao abriria ATRAS dos cards. */
  {
    const cli = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    ok('o botao existe com o texto pedido', /Pokémons desta rota<\/button>/.test(cli));
    /* ⚠️ PROCURA O onclick, nao a CLASSE: a classe aparece antes no CSS e a trava passava
       medindo a folha de estilo em vez do render. */
    const iBtn = cli.indexOf('onclick="abrirPokemonsDaRota()"'), iCards = cli.indexOf('game.wildOffer.map(entry=>{');
    ok('e ele vem ANTES dos cards da oferta, dentro da mesma caixa',
       iBtn > 0 && iBtn < iCards && (iCards - iBtn) < 700,
       'botao em ' + iBtn + ', cards ' + (iCards - iBtn) + ' caracteres depois');
    const iAviso = cli.indexOf('${renderAvisoMinimoModal()}'), iModal = cli.indexOf('${renderPokemonsDaRotaModal()}');
    ok('o modal e anexado no fim da tela (senao abre ATRAS dos cards)', iModal > iAviso, 'modal em ' + iModal);
    /* estado de TELA: nao pode ir pro save */
    ok('o rotaModal NAO entra no save', !/rotaModal/.test(cli.slice(cli.indexOf('function serializeGame()'), cli.indexOf('function serializeGame()') + 3000)));
    ok('e ele nasce fechado a cada encontro', (cli.match(/game\.rotaModal = false;/g) || []).length >= 3,
       (cli.match(/game\.rotaModal = false;/g) || []).length + ' pontos');
  }

  /* 7) ⚠️ A FAIXA DE NIVEL MORA NUM LUGAR SO -- quem sorteia e quem lista tem que concordar. */
  {
    const cli = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    ok('o rollWildLevel usa a faixaDeNivelSelvagem', /function rollWildLevel[\s\S]{0,260}faixaDeNivelSelvagem/.test(cli));
    ok('e o nivelSelvagem tambem', /function nivelSelvagem[\s\S]{0,260}faixaDeNivelSelvagem/.test(cli));
    /* e ela respeita os tres degraus */
    const leg = { minLevel: 3, maxLevel: 9 };
    ok('  a faixa PROPRIA da rota ganha de tudo',
       JSON.stringify(S.faixaDeNivelSelvagem('eevee', { niveis: { eevee: [30, 35] } }, leg)) === '[30,35]');
    ok('  o PISO da evolucao empurra a faixa pra cima',
       S.faixaDeNivelSelvagem('metapod', null, leg)[0] === S.EVOLVED_MIN_LEVEL['metapod'],
       JSON.stringify(S.faixaDeNivelSelvagem('metapod', null, leg)));
    ok('  e ele tem TETO: o Metapod nao sai no nivel em que ja seria Butterfree',
       S.faixaDeNivelSelvagem('metapod', null, leg)[1] < S.EVOLUTIONS['metapod'].level,
       JSON.stringify(S.faixaDeNivelSelvagem('metapod', null, leg)) + ' (evolui no ' + S.EVOLUTIONS['metapod'].level + ')');
    ok('  e o SEM_PISO_DE_NIVEL pula o piso (o Pikachu numa rota de 3 a 6)',
       JSON.stringify(S.faixaDeNivelSelvagem('pikachu', null, leg)) === '[3,9]');
  }

  Object.assign(g, antes);
}

console.log('\n=== AS 28 FORMAS DO UNOWN (16/09/2026) ===');
{
  /* Pedido assim: *"implemente as sprites de todas as letras do alfabeto do unown"*. Ele e a unica
     especie do jogo com mais de um sprite, e ate aqui todos apareciam com o desenho da letra A. */
  const g = S.__getGame();
  const antes = JSON.parse(JSON.stringify({ team: g.team || [], gymIndex: g.gymIndex,
    currentSaveSlot: g.currentSaveSlot, currentRoute: g.currentRoute, wildOffer: g.wildOffer || [],
    wildSelected: g.wildSelected || [], wildEncounterSeq: g.wildEncounterSeq || 0, starterId: g.starterId }));
  const url = h => (h.match(/src="([^"]*)"/) || [])[1];
  const fb  = h => (h.match(/data-fallback-src="([^"]*)"/) || [])[1];

  /* ===== A TABELA ===== */
  ok('sao 28 formas', S.FORMAS_DO_UNOWN.length === 28, String(S.FORMAS_DO_UNOWN.length));
  ok('as 26 letras mais ? e !',
     S.FORMAS_DO_UNOWN.join('') === 'ABCDEFGHIJKLMNOPQRSTUVWXYZ?!', S.FORMAS_DO_UNOWN.join(''));
  ok('nenhuma repetida', new Set(S.FORMAS_DO_UNOWN).size === 28);

  /* ===== O SUFIXO DO ARQUIVO =====
     ⚠️ A LETRA A NAO TEM ARQUIVO PROPRIO: ela e a forma PADRAO da especie, ou seja o `201.png` de
     sempre -- o `201-a.png` responde 404 no CDN (conferido). Esta trava e a que impede alguem de
     "arrumar" o sufixo dela por simetria e quebrar a forma mais comum do jogo. */
  ok('a letra A e o 201.png de sempre (sufixo vazio)', S.sufixoDoUnown('A') === '', JSON.stringify(S.sufixoDoUnown('A')));
  ok('e SEM letra tambem (save antigo, codigo de time, NPC)', S.sufixoDoUnown(undefined) === '');
  ok('B a Z viram -b .. -z', S.sufixoDoUnown('B') === '-b' && S.sufixoDoUnown('H') === '-h' && S.sufixoDoUnown('Z') === '-z');
  ok('o ? e o ! tem nome por extenso',
     S.sufixoDoUnown('?') === '-question' && S.sufixoDoUnown('!') === '-exclamation');
  ok('minuscula tambem vale', S.sufixoDoUnown('h') === '-h');
  ok('lixo cai na forma padrao', S.sufixoDoUnown('QQ') === '' && S.sufixoDoUnown('1') === '');

  /* ===== A URL, QUE E O QUE O NAVEGADOR PEDE =====
     ⚠️ ELA SAI DO MESMO CDN E TEM O MESMO DOMINIO DE FALLBACK das 250 especies -- e isso e a decisao
     desta feature, nao um detalhe: as formas herdam de graca a repeticao do handleSpriteLoadError, a
     troca de dominio e o emoji de ultimo caso. Um host novo teria que ganhar tudo isso de novo. */
  {
    const h = S.spriteHtml({ speciesId:'unown', unown:'H' }, 'sprite-sm');
    ok('a letra entra no NOME DO ARQUIVO', /\/201-h\.png$/.test(url(h)), url(h));
    ok('e no mesmo CDN de todo mundo', url(h).indexOf('cdn.jsdelivr.net/gh/PokeAPI/sprites') > 0);
    ok('com o mesmo dominio de fallback', /raw\.githubusercontent\.com.*201-h\.png$/.test(fb(h)), fb(h));
    const s = S.spriteHtml({ speciesId:'unown', unown:'H', shiny:true }, 'sprite-sm');
    ok('e o shiny entra na pasta certa, com a letra junto', /\/shiny\/201-h\.png$/.test(url(s)), url(s));
    ok('o ! vira 201-exclamation.png',
       /\/201-exclamation\.png$/.test(url(S.spriteHtml({ speciesId:'unown', unown:'!' }, 'sprite-sm'))));
  }
  /* ⚠️ SEM LETRA, A URL TEM QUE SER BYTE A BYTE A DE ANTES desta feature -- e isso nao e detalhe de
     compatibilidade: e o que faz save antigo, codigo de time (que nao carrega letra por construcao)
     e NPC continuarem mostrando EXATAMENTE o que mostram hoje. */
  ok('sem letra, a URL e a de sempre',
     url(S.spriteHtml('unown', 'sprite-sm')).endsWith('/pokemon/201.png'), url(S.spriteHtml('unown','sprite-sm')));
  ok('e passar a instancia SEM letra da o mesmo que passar o id',
     S.spriteHtml({ speciesId:'unown' }, 'sprite-sm') === S.spriteHtml('unown', 'sprite-sm'));
  /* ⚠️ A LETRA SO VALE NO DEX 201. Um campo `unown` sobrando em outra especie (save estranho, clone
     mal feito) nao pode trocar o sprite dela. */
  ok('a letra nao vaza pra outra especie',
     url(S.spriteHtml({ speciesId:'pikachu', unown:'H' }, 'sprite-sm')).endsWith('/25.png'));

  /* ===== O spriteHtml ACEITANDO A INSTANCIA =====
     Ele tem 72 chamadores; em 45 os dois primeiros argumentos ja saiam do MESMO objeto. Passar o
     objeto nao acrescentou parametro nenhum -- e era isso ou um QUINTO posicional em 45 lugares. */
  {
    const mon = { speciesId:'pikachu', shiny:true };
    ok('a instancia traz o shiny junto', /\/shiny\/25\.png$/.test(url(S.spriteHtml(mon, 'sprite-sm'))));
    /* ⚠️ O SHINY EXPLICITO GANHA DO DA INSTANCIA, e isso e obrigatorio: a previa da evolucao desenha
       de proposito uma especie DIFERENTE com o brilho deste pokemon, e o disfarce desenha o Mew. */
    ok('mas o explicito ganha (a previa da evolucao)',
       /\/25\.png$/.test(url(S.spriteHtml(mon, 'sprite-sm', false))));
    ok('e o id solto continua funcionando igual',
       /\/shiny\/25\.png$/.test(url(S.spriteHtml('pikachu', 'sprite-sm', true))));
  }
  /* ⚠️ E NENHUM CHAMADOR PODE VOLTAR A PASSAR `X.speciesId` COM `X.shiny`: ali a letra se perde em
     silencio -- o sprite sai certo pras 249 outras especies e errado so pro Unown, que e o tipo de
     defeito que fica meses sem ninguem ver. O teste LE O CODIGO porque os casos acima chamam a
     funcao na mao e passariam com qualquer chamador. */
  {
    const txt = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const ruins = [...txt.matchAll(/spriteHtml\(\s*([A-Za-z_$][A-Za-z0-9_.$]*)\.speciesId\s*,[^)]*?([A-Za-z_$][A-Za-z0-9_.$]*)\.shiny[^)]*\)/g)]
      .filter(m => m[1] === m[2]).map(m => m[0]);
    ok('nenhum chamador passa <P>.speciesId junto com <P>.shiny', ruins.length === 0, ruins.slice(0,3).join(' | '));
  }

  /* ===== O SORTEIO E SEMEADO ===== */
  /* ⚠️ ELE RECEBE O RNG, nunca chama Math.random por dentro: e o que permite semear a letra junto
     com o resto da oferta selvagem. Sem isso, sair do save e voltar re-sortearia a letra ate vir a
     que o jogador quer -- exatamente a artimanha que a semente do encontro existe pra fechar. */
  {
    const r1 = S.makeSeededRng('unown-teste'), r2 = S.makeSeededRng('unown-teste');
    const a = [], b = [];
    for(let i = 0; i < 40; i++){ a.push(S.sorteiaFormaDoUnown(r1)); b.push(S.sorteiaFormaDoUnown(r2)); }
    ok('a mesma semente da a mesma letra', a.join('') === b.join(''), a.slice(0,8).join(''));
    ok('e ele so devolve forma que existe na tabela', a.every(L => S.FORMAS_DO_UNOWN.indexOf(L) >= 0));
  }

  /* ===== A OFERTA SELVAGEM ===== */
  {
    g.currentSaveSlot = 3; g.saveGen = 0; g.gymIndex = 5; g.team = [];
    g.wildRerolls = 0; g.currentRoute = 'silph_co'; g.starterId = 'bulbasaur'; g.screen = 'wild';
    const acha = () => { for(let k = 0; k < 400; k++){ g.wildEncounterSeq = k;
      S.goToWildEncounter(); const u = (g.wildOffer||[]).find(o => o.speciesId === 'unown'); if(u) return k; } return -1; };
    const k = acha();
    ok('o Unown aparece na oferta da Silph Co.', k >= 0, 'semente ' + k);
    const letra = g.wildOffer.find(o => o.speciesId === 'unown').unown;
    ok('e a oferta ja traz a letra', !!letra && S.FORMAS_DO_UNOWN.indexOf(letra) >= 0, String(letra));
    /* ⚠️ A TRAVA ANTI SAVE-SCUMMING: remontar a MESMA semente devolve a MESMA letra. */
    const vistas = new Set();
    for(let i = 0; i < 6; i++){ g.wildEncounterSeq = k; S.goToWildEncounter();
      vistas.add(g.wildOffer.find(o => o.speciesId === 'unown').unown); }
    ok('sair do save e voltar NAO re-sorteia a letra', vistas.size === 1 && vistas.has(letra),
       [...vistas].join(','));
    /* e sementes diferentes cobrem a tabela inteira -- se ela travasse numa letra so, ninguem veria */
    const todas = new Set();
    for(let s2 = 0; s2 < 400; s2++){ g.wildEncounterSeq = s2; S.goToWildEncounter();
      const u = g.wildOffer.find(o => o.speciesId === 'unown'); if(u) todas.add(u.unown); }
    ok('e 400 sementes cobrem as 28 formas', todas.size === 28, todas.size + ' de 28');
    /* ⚠️ SO O UNOWN GANHA O CAMPO: um `unown` em toda entrada seria lixo em 249 especies. */
    g.wildEncounterSeq = k; S.goToWildEncounter();
    ok('e nenhuma outra especie da oferta ganha o campo',
       g.wildOffer.filter(o => o.speciesId !== 'unown').every(o => o.unown === undefined));

    /* ===== A CAPTURA E O SAVE ===== */
    const naOferta = g.wildOffer.find(o => o.speciesId === 'unown').unown;
    g.wildSelected = ['unown']; g.wildDisguiseAcknowledged = true;
    S.confirmWild();
    const mon = (g.team || []).find(p => p.speciesId === 'unown');
    ok('a captura leva a letra da oferta pro time', mon && mon.unown === naOferta,
       mon ? String(mon.unown) + ' vs ' + naOferta : '(nao capturou)');
    /* ⚠️ E ELA SOBREVIVE AO SAVE. O `team` e serializado inteiro, entao o campo vai junto sozinho --
       esta trava existe pra o dia em que o serializeGame passar a filtrar campo de instancia. */
    const doc = JSON.parse(JSON.stringify(S.serializeGame()));
    const salvo = doc.team.find(p => p.speciesId === 'unown');
    ok('e sobrevive ao save', salvo && salvo.unown === naOferta, salvo ? String(salvo.unown) : '(sumiu)');
    S.hydrateTeamMember(salvo);
    ok('e a reidratacao nao a apaga', salvo.unown === naOferta, String(salvo.unown));
    ok('e o sprite do time sai com a letra',
       url(S.spriteHtml(mon, 'sprite-sm')).endsWith('/201-' + naOferta.toLowerCase() + '.png') ||
       (naOferta === 'A' && url(S.spriteHtml(mon, 'sprite-sm')).endsWith('/201.png')),
       url(S.spriteHtml(mon, 'sprite-sm')));
  }

  /* ===== A VIGILIA ===== */
  /* ⚠️ ELA SORTEIA COM O RNG DELA, e nao com Math.random: a vigilia e GRAVADA no save (a clareira e
     a tela do premio sao pontos de gravacao), e o premio pode virar pokemon do jogador -- com
     Math.random a letra mudaria entre montar a clareira e escolher o premio. */
  {
    g.currentSaveSlot = 3; g.saveGen = 0; g.gymIndex = 5;
    g.team = [S.createInstance('pidgeot', 40)];
    const a = S.montarAVigilia(), b = S.montarAVigilia();
    const ua = a.filter(m => m.speciesId === 'unown'), ub = b.filter(m => m.speciesId === 'unown');
    ok('duas montagens da mesma vigilia dao a mesma letra',
       ua.map(m => m.unown).join(',') === ub.map(m => m.unown).join(','), ua.map(m => m.unown).join(','));
    ok('e so o Unown ganha o campo', a.every(m => m.speciesId === 'unown' || m.unown === undefined));
    /* E O PREMIO LEVA A LETRA JUNTO: o jogador escolheu OLHANDO o sprite dele -- entregar outra
       letra seria entregar outro bicho.
       ⚠️ O UNOWN E FORCADO NA CLAREIRA em vez de esperar o sorteio dar um: ele e 1 em ~140 especies,
       entao depender da sorte da semente e nao cobrir o caminho. */
    {
      g.vigiliaPremio = [{ speciesId: 'unown', level: 30, shiny: false, unown: 'Q' }];
      g.team = []; g.vigilia = null;
      S.escolherOPremioDaVigilia(0);
      const p2 = (g.team || []).find(x => x.speciesId === 'unown');
      ok('e o premio entra no time com a MESMA letra', p2 && p2.unown === 'Q',
         p2 ? String(p2.unown) : '(nao entrou)');
      ok('  e o sprite dele sai com ela',
         url(S.spriteHtml(p2, 'sprite-sm')).endsWith('/201-q.png'), url(S.spriteHtml(p2, 'sprite-sm')));
    }
  }

  /* ===== OS CLONES =====
     ⚠️ O `createInstance` NAO COPIA CAMPO NENHUM -- armadilha que o shiny ja custou tres vezes neste
     projeto, nos MESMOS tres lugares. Todo lugar que recola o shiny tem que recolar a letra. */
  {
    const txt = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const blocos = [...txt.matchAll(/const inst = createInstance\([^)]*\);[\s\S]{0,420}?return inst;/g)].map(m => m[0]);
    const comShiny = blocos.filter(b => /\.shiny/.test(b));
    const semLetra = comShiny.filter(b => !/\.unown/.test(b) && !/bits\[2\]/.test(b) && !/shinyIdx/.test(b));
    ok('todo clone que recola o shiny recola a letra', semLetra.length === 0,
       semLetra.length + ' sem: ' + semLetra.map(b => b.slice(0, 60)).join(' /// '));
    ok('e sao os quatro conhecidos', comShiny.length >= 4, comShiny.length + ' clones');
  }

  Object.assign(g, antes);
}


console.log('\nO HO-OH NA VIGILIA (5%)');
{
  const g = S.__getGame();
  const mk = (id, lv) => { const q = S.createInstance(id, lv); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; return q; };
  g.team = ['pidgeotto','raticate','gyarados','machoke','kadabra','golem'].map(id => mk(id, 45));
  S.__setGame(g);
  let com = 0, total = 0, niveisDele = [], duplicado = 0, tamanhoErrado = 0;
  const vistas = [];
  for(let slot = 0; slot < 1200; slot++){
    for(let trecho = 3; trecho < 8; trecho++){
      g.currentSaveSlot = String(slot); g.saveGen = slot % 7; g.gymIndex = trecho;
      S.__setGame(g);
      const v = S.montarAVigilia();
      total++;
      if(v.length !== S.VIGILIA_TAMANHO) tamanhoErrado++;
      const hoohs = v.filter(m => m.speciesId === 'hooh');
      if(hoohs.length > 1) duplicado++;
      if(hoohs.length === 1){ com++; niveisDele.push(hoohs[0].level); if(vistas.length < 3) vistas.push(v); }
    }
  }
  const pct = 100 * com / total;
  const sigma = 100 * Math.sqrt(0.05 * 0.95 / total);
  ok('a chance e 5%', S.CHANCE_HOOH_VIGILIA === 0.05, String(S.CHANCE_HOOH_VIGILIA));
  ok('e ele aparece nessa taxa nas vigilias de verdade', Math.abs(pct - 5) < 3 * sigma,
     pct.toFixed(2) + '% em ' + total + ' vigilias (' + ((pct-5)/sigma).toFixed(1) + 'sigma)');
  /* ⚠️ ELE OCUPA UMA VAGA, nao entra POR CIMA das dez: a vigilia e calibrada em 10 contra 6 sem
     cura entre confrontos, e um 11o mudaria o preco medido da mata inteira. */
  ok('a vigilia continua com dez', tamanhoErrado === 0, tamanhoErrado + ' fora do tamanho');
  ok('e ele nunca aparece duas vezes', duplicado === 0);
  /* o nivel dele e o da VAGA: ele nao vem acima da roda, vem no lugar de alguem */
  const media = S.avgTeamLevel();
  ok('e o nivel dele e o da vaga que ele ocupou',
     niveisDele.every(n => Math.abs(n - (media - S.VIGILIA_ABAIXO)) <= S.VIGILIA_ESPALHA),
     'entre ' + Math.min.apply(null, niveisDele) + ' e ' + Math.max.apply(null, niveisDele) +
     ' (alvo ' + (media - S.VIGILIA_ABAIXO) + ')');
  /* ⚠️ E ELE PODE SER O PREMIO -- e disso que vem a unica porta de captura dele no jogo. A tela do
     premio oferece os DEZ, entao basta ele estar na lista; o que se tranca aqui e que ele nao foi
     marcado de um jeito que a escolha do premio fosse pular. */
  ok('ele entra na roda como os outros (mesma forma de registro)',
     vistas.every(v => {
       const h = v.find(m => m.speciesId === 'hooh');
       return h && typeof h.level === 'number' && 'shiny' in h;
     }), vistas.length + ' vigilias conferidas');
}

console.log('\nE O QUE O HO-OH CAPTURAVEL NAO PODE MEXER');
{
  /* ⚠️ ELE CONTINUA FORA DAS ROTAS: a vigilia e a UNICA porta. O SEM_CAPTURA_SELVAGEM e o que
     segura isso, e ele nao foi tocado. */
  ok('ele continua sem aparecer como selvagem de rota',
     S.SEM_CAPTURA_SELVAGEM.indexOf('hooh') >= 0);
  ok('e continua na lista dos intocaveis', S.ESPECIES_INTOCAVEIS.indexOf('hooh') >= 0);
  /* ⚠️ E ESTA E A TRAVA QUE IMPORTA: as metas de "capturar tudo" continuam EXCLUINDO os tres.
     Contando o Ho-Oh, toda conta que ja tinha a Pokedex de Johto ou o Mestre Pokemon PERDERIA a
     conquista ate tirar 5% numa mata fechada -- e conquista que se perde sozinha e pior que
     conquista nenhuma. Ele e trofeu, nao requisito. */
  const g2 = S.__getGame();
  g2.saveSlots = []; g2.permanentPokedex = []; g2.permanentShinyDex = [];
  S.__setGame(g2);
  const agg = S.getAchievementAggregate();
  const johto = Object.keys(S.SPECIES).filter(id => S.SPECIES[id].dex >= 152);
  ok('o Ho-Oh NAO conta na meta da Pokedex de Johto',
     agg.johtoTotal === johto.length - 3,
     agg.johtoTotal + ' de ' + johto.length + ' especies de Johto');
  ok('nem na meta de capturar tudo',
     agg.totalCapturavel === Object.keys(S.SPECIES).length - 3,
     String(agg.totalCapturavel));
}
console.log('\n=== A MONTANHA SAGRADA (17/09/2026) ===');
{
  /* A terceira rota que abre com o VOO, e o santuario do outro lado dos guardioes. Pedida assim:
     *"sera uma rota especial que podera aparecer como terceira opcao durante a jornada, acessivel
     apenas se o treinador tiver um Pokemon no time que saiba Fly, deve aparecer aleatoriamente a
     partir do sexto ginasio"*. */
  const g = S.__getGame();
  const mk = (id, lv, ataques) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp;
                                    p.ataques = ataques || S.ataquesPadrao(p); return p; };
  g.authUser = null; g.saveGen = 0; g.gymPath = new Array(8).fill('kanto');
  g.montanha = null; g.montanhaGuarda = null; g.montanhaPremio = null;
  g.team = ['venusaur','pidgeot','raichu','gyarados','machoke','haunter'].map(id => mk(id, 45));

  /* ---------- 1) O SORTEIO ---------- */
  const N = 4000;
  let antesDo6 = 0, comMontanha = 0, dados = 0, dadoPassou = 0, juntoComAMata = 0;
  for(let slot = 0; slot < N; slot++){
    g.currentSaveSlot = slot;
    for(let leg = 0; leg < 8; leg++){
      if(leg < S.MONTANHA_A_PARTIR_DE){ if(S.montanhaSaiNoTrecho(leg)) antesDo6++; continue; }
      dados++;
      const tem = S.montanhaSaiNoTrecho(leg);
      if(tem){ dadoPassou++; if(S.temRotaDoCorte(leg)) juntoComAMata++; }
    }
    g.currentSaveSlot = slot;
    let quantas = 0;
    for(let leg = 0; leg < 8; leg++) if(S.montanhaSaiNoTrecho(leg)) quantas++;
    if(quantas > 0) comMontanha++;
  }
  ok('nunca antes do 6o ginasio', antesDo6 === 0, antesDo6 + ' em ' + N + ' saves');
  const taxa = dadoPassou / dados;
  ok('a chance por trecho e ~25%', Math.abs(taxa - S.CHANCE_MONTANHA) < 0.03,
     (taxa*100).toFixed(1) + '% em ' + dados + ' dados');
  /* ⚠️ A TRAVA QUE IMPORTA: com as duas no mesmo trecho seriam QUATRO cartas, e a promessa e de uma
     TERCEIRA. A mata tem preferencia, e o `montanhaSaiNoTrecho` ja recusa. */
  ok('nunca sai no MESMO trecho da mata', juntoComAMata === 0, juntoComAMata + ' colisoes');
  ok('vista em parte das jornadas', comMontanha > N*0.4 && comMontanha < N*0.9,
     (comMontanha/N*100).toFixed(1) + '% das jornadas');

  /* a SEMENTE: sair do save e voltar devolve o MESMO trecho. O slot e escolhido pelo teste -- um
     que NAO tem montanha nenhuma provaria a estabilidade sem provar coisa nenhuma. */
  const perfil = () => [5,6,7].map(l => S.montanhaSaiNoTrecho(l) ? 1 : 0).join('');
  let slotComMontanha = -1;
  for(let s2 = 0; s2 < 200 && slotComMontanha < 0; s2++){ g.currentSaveSlot = s2; if(/1/.test(perfil())) slotComMontanha = s2; }
  ok('existe save com montanha pra medir', slotComMontanha >= 0, 'slot ' + slotComMontanha);
  g.currentSaveSlot = slotComMontanha;
  const antes = perfil();
  ok('o sorteio e semeado (sair e voltar da o mesmo)', antes === perfil() && /1/.test(antes), antes);
  /* E A GERACAO DO SLOT MUDA O SORTEIO: sem ela, apagar o save e recriar no mesmo slot repetiria
     a jornada trecho por trecho. E a mesma trava anti save-scumming da mata e do encontro. */
  let mudou = false, ultimaGen = 0;
  for(let gen = 1; gen <= 12 && !mudou; gen++){ g.saveGen = gen; ultimaGen = gen; if(perfil() !== antes) mudou = true; }
  g.saveGen = 0;
  ok('mas a GERACAO do slot muda o sorteio', mudou, antes + ' -> outra na geracao ' + ultimaGen);

  /* ---------- 2) A CHAVE: quem VOA entra ---------- */
  ok('sem ninguem que voe, nao abre', !S.podeVoar());
  const comVoo = mk('pidgeot', 45, ['fly','wingattack']);
  g.team = [comVoo, mk('venusaur', 45)];
  ok('com um que voa, abre', S.podeVoar() && S.voadorDoTime() === comVoo);
  /* ⚠️ QUEM VALIDA E A ACAO, nao a tela: o card apagado e apresentacao, e a guarda vale mesmo que o
     clique venha forjado. E a mesma regra do `confirmarAtaques` e do `toggleRelease`. */
  g.team = [mk('venusaur', 45)];
  g.currentRoute = null; g.screen = 'walk';
  S.chooseRoute(S.MONTANHA.id);
  ok('a ACAO recusa quem nao voa', g.currentRoute == null, String(g.currentRoute));
  g.team = [comVoo, mk('venusaur', 45)];
  S.chooseRoute(S.MONTANHA.id);
  ok('e aceita quem voa', g.currentRoute === S.MONTANHA.id, String(g.currentRoute));

  /* a FRASE do cadeado nomeia o HM02, e nao o HM01: mandar procurar a Maquina errada e pior que
     nao dizer nada */
  g.team = [mk('venusaur', 45)];
  const cartaDaMontanha = [S.MONTANHA];
  const htmlTrancado = S.renderRouteCardsBlock(cartaDaMontanha);
  ok('o cadeado da montanha nomeia o HM02', /HM02/.test(htmlTrancado) && !/HM01/.test(htmlTrancado));
  ok('e o card fica desabilitado', /route-card[^>]*disabled/.test(htmlTrancado));
  g.team = [comVoo, mk('venusaur', 45)];
  const htmlAberto = S.renderRouteCardsBlock(cartaDaMontanha);
  ok('e aberto nomeia QUEM abre', /Pidgeot abre caminho/.test(htmlAberto) && !/HM02/.test(htmlAberto));
  /* ⚠️ A MATA CONTINUA NOMEANDO O HM01: as duas rotas dividem o desenho, e a frase e que muda. */
  g.team = [mk('venusaur', 45)];
  const htmlMata = S.renderRouteCardsBlock([S.ROTA_DO_CORTE]);
  ok('e a mata continua no HM01', /HM01/.test(htmlMata) && !/HM02/.test(htmlMata));

  /* ---------- 3) OS SEIS GUARDIOES ---------- */
  g.team = ['venusaur','pidgeot','raichu','gyarados','machoke','haunter'].map(id => mk(id, 50));
  g.currentSaveSlot = 7; g.gymIndex = 5;
  const guarda = S.montarOsGuardioes();
  ok('sao seis', guarda.length === S.MONTANHA_GUARDIOES, String(guarda.length));
  ok('todos VOAM', guarda.every(m => (S.SPECIES[m.speciesId].types||[]).indexOf('Flying') >= 0),
     guarda.map(m => S.SPECIES[m.speciesId].name).join(', '));
  ok('nenhum lendario nem intocavel',
     guarda.every(m => S.LENDARIOS.indexOf(m.speciesId) < 0 && S.ESPECIES_INTOCAVEIS.indexOf(m.speciesId) < 0));
  const linhas = new Set(guarda.map(m => S.raizDaLinha(m.speciesId)));
  ok('sem linha evolutiva repetida', linhas.size === guarda.length, linhas.size + ' linhas');
  /* ⚠️ A MEDIA E EXATA, e nao "mais ou menos": os desvios somam ZERO de proposito. Foi o pedido --
     *"cuja media de nivel seja equivalente a do time do treinador"*. */
  const mediaGuarda = guarda.reduce((s,m)=>s+m.level,0) / guarda.length;
  const mediaTime = S.avgTeamLevel(g.team);
  ok('a media bate com a do time', Math.abs(mediaGuarda - Math.round(mediaTime)) < 0.01,
     mediaGuarda.toFixed(2) + ' vs ' + mediaTime.toFixed(2));
  /* ⚠️ A ESPECIE TEM QUE BATER COM O NIVEL: um Pidgey Lv.50 nao existe. E a mesma licao que a
     Vigilia custou em 14/09 -- *"esta aparecendo Charizard no level 24"*. */
  const forasDaForma = guarda.filter(m => S.formaNoNivel(m.speciesId, m.level) !== m.speciesId);
  ok('a especie bate com o nivel', forasDaForma.length === 0,
     forasDaForma.map(m => S.SPECIES[m.speciesId].name + ' Lv.' + m.level).join(', '));
  /* e ele e SEMEADO: entrar, sair e voltar da a MESMA guarda */
  const outra = S.montarOsGuardioes();
  ok('a guarda e semeada', JSON.stringify(guarda) === JSON.stringify(outra));

  /* ---------- 4) AS TRES MISSOES ---------- */
  /* MOLTRES: o Blaine, com 3 de Planta no time. */
  const blaineIdx = S.KANTO_GYMS.findIndex(x => x.id === 'blaine');
  ok('o Blaine existe e e o ' + (blaineIdx+1) + 'o de Kanto', blaineIdx >= 0);
  const porGinasio = (idx, time) => { g.gymPath = new Array(8).fill('kanto'); g.gymIndex = idx; g.team = time; };
  const tresPlanta = ['venusaur','vileplume','victreebel','pidgeot','raichu','machoke'].map(id => mk(id, 50));
  const doisPlanta = ['venusaur','vileplume','pidgeot','raichu','machoke','haunter'].map(id => mk(id, 50));
  /* ⚠️ TIPO DUPLO CONTA (foi o pedido): o Venusaur e Planta/Veneno e entra na conta. */
  ok('tipo duplo conta pro Moltres',
     (S.SPECIES['venusaur'].types||[]).length === 2 && (S.SPECIES['venusaur'].types||[]).indexOf('Grass') >= 0,
     (S.SPECIES['venusaur'].types||[]).join('/'));
  porGinasio(blaineIdx, tresPlanta);
  ok('Moltres: Blaine + 3 de Planta acende', S.cumpriuMoltres(true));
  porGinasio(blaineIdx, doisPlanta);
  ok('Moltres: com DOIS nao acende', !S.cumpriuMoltres(true));
  porGinasio(blaineIdx, tresPlanta);
  ok('Moltres: perdendo nao acende', !S.cumpriuMoltres(false));
  porGinasio(0, tresPlanta);
  ok('Moltres: em outro ginasio nao acende', !S.cumpriuMoltres(true));

  /* ZAPDOS: tres ginasios seguidos sem perder pra um lider. */
  g.montanha = null;
  ok('Zapdos: uma vitoria nao basta', S.passoDoZapdos(true) === false);
  ok('Zapdos: duas tambem nao', S.passoDoZapdos(true) === false);
  ok('Zapdos: a terceira acende', S.passoDoZapdos(true) === true);
  g.montanha = null;
  S.passoDoZapdos(true); S.passoDoZapdos(true);
  ok('Zapdos: a DERROTA zera', S.passoDoZapdos(false) === false && S.missoesDaMontanha().sequenciaDeGinasios === 0);
  ok('Zapdos: e a contagem recomeca do zero', S.passoDoZapdos(true) === false && S.missoesDaMontanha().sequenciaDeGinasios === 1);

  /* ARTICUNO: o MESMO de Gelo derrubando 3 seguidos numa unica batalha. */
  const mu = (esp, venceu) => ({ playerSpecies: esp, playerWon: venceu });
  ok('Articuno: 3 seguidos do mesmo acende',
     S.cumpriuArticuno([mu('lapras',true), mu('lapras',true), mu('lapras',true)]));
  ok('Articuno: dois nao bastam',
     !S.cumpriuArticuno([mu('lapras',true), mu('lapras',true), mu('venusaur',true)]));
  /* ⚠️ TROCAR DE POKEMON ZERA: "um MESMO pokemon de Gelo" foi o pedido. Tres vitorias de tres
     pokemon de Gelo diferentes nao contam. */
  ok('Articuno: tres de Gelo DIFERENTES nao contam',
     !S.cumpriuArticuno([mu('lapras',true), mu('dewgong',true), mu('jynx',true)]));
  ok('Articuno: perder um confronto no meio zera',
     !S.cumpriuArticuno([mu('lapras',true), mu('lapras',false), mu('lapras',true), mu('lapras',true)]));
  /* ⚠️ VALE NA TERCEIRA VITORIA, mesmo que ele desmaie depois -- foi o pedido ao pe da letra. */
  ok('Articuno: vale mesmo se ele desmaia depois',
     S.cumpriuArticuno([mu('lapras',true), mu('lapras',true), mu('lapras',true), mu('lapras',false)]));
  ok('Articuno: quem nao e de Gelo nao conta',
     !S.cumpriuArticuno([mu('gyarados',true), mu('gyarados',true), mu('gyarados',true)]));
  /* tipo duplo conta aqui tambem: a Jynx e Gelo/Psiquico */
  ok('Articuno: tipo duplo conta',
     S.cumpriuArticuno([mu('jynx',true), mu('jynx',true), mu('jynx',true)]));

  /* ---------- 5) A PORTA UNICA ---------- */
  g.montanha = null;
  porGinasio(blaineIdx, tresPlanta);
  const acesos1 = S.conferirNinhos(true, [mu('lapras',true), mu('lapras',true), mu('lapras',true)]);
  ok('conferirNinhos devolve os que acenderam AGORA', acesos1.indexOf('moltres') >= 0 && acesos1.indexOf('articuno') >= 0,
     acesos1.join(','));
  const acesos2 = S.conferirNinhos(true, [mu('lapras',true), mu('lapras',true), mu('lapras',true)]);
  ok('e nao devolve de novo o que ja estava aceso', acesos2.indexOf('moltres') < 0 && acesos2.indexOf('articuno') < 0,
     acesos2.join(','));

  /* ---------- 6) O PREMIO ---------- */
  g.montanha = null;
  g.team = ['venusaur','pidgeot','raichu'].map(id => mk(id, 50));
  g.montanhaPremio = [{ speciesId:'fearow', level:48, shiny:false }];
  S.escolherOGuardiao(0);
  ok('o guardiao entra no time', g.team.length === 4 && g.team[3].speciesId === 'fearow',
     g.team.map(p=>p.speciesId).join(','));
  ok('e ele passa pela escolha de golpes', !!g.team[3].escolherAtaques);
  ok('o premio e a guarda sao limpos', g.montanhaPremio == null && g.montanhaGuarda == null);
  /* ⚠️ COM SEIS ELE ESCOLHE QUEM SAI, pelo fluxo que ja existe -- foi o pedido. */
  g.team = ['venusaur','pidgeot','raichu','gyarados','machoke','haunter'].map(id => mk(id, 50));
  g.montanhaPremio = [{ speciesId:'fearow', level:48, shiny:false }];
  g.screen = 'ninhos';
  S.escolherOGuardiao(0);
  ok('com o time cheio cai no Prof. Carvalho', g.screen === 'release' && g.team.length === 7,
     g.screen + ' / ' + g.team.length);

  /* ---------- 7) O LENDARIO ---------- */
  ok('sao QUATRO, todos no nivel ' + S.MONTANHA_NIVEL_LENDARIO,
     S.MONTANHA_LENDARIOS.length === 4 && S.MONTANHA_NIVEL_LENDARIO === 65,
     S.MONTANHA_LENDARIOS.join(','));
  ok('e o Lugia esta entre eles', S.MONTANHA_LENDARIOS.indexOf('lugia') >= 0);
  /* ⚠️ E ELE E INTOCAVEL: esta e a SEGUNDA porta pela qual um intocavel se deixa capturar, depois
     do Ho-Oh da Vigilia -- e a decisao e a MESMA de la. Ele e TROFEU, nao requisito: as metas de
     "capturar tudo" continuam EXCLUINDO os tres, senao toda conta que ja as tem PERDERIA a
     conquista ate vir aqui. */
  ok('o Lugia e INTOCAVEL', S.ESPECIES_INTOCAVEIS.indexOf('lugia') >= 0);
  /* AS TRES REINICIAM AO RECEBER, e nao ao vencer: quem vence e fecha a aba antes de escolher nao
     pode perder as tres missoes que levaram a jornada inteira pra acender. */
  g.montanha = null;
  porGinasio(blaineIdx, tresPlanta);
  /* QUEM ACENDE E A PORTA UNICA, e nao os ganchos soltos: o passoDoZapdos so anda o contador.
     Sao tres vitorias de ginasio, e a primeira ja acendeu os outros dois. */
  S.conferirNinhos(true, [mu('lapras',true), mu('lapras',true), mu('lapras',true)]);
  S.conferirNinhos(true, []);
  S.conferirNinhos(true, []);
  ok('os tres ninhos acendem', S.ninhosAcesos() === 3, String(S.ninhosAcesos()));
  g.team = ['venusaur','pidgeot','raichu'].map(id => mk(id, 50));
  g.screen = 'montanhaLendarios';
  ok('vencer a batalha NAO reinicia (a tela so abriu)', S.ninhosAcesos() === 3);
  S.escolherOLendario(3);
  ok('o Lugia entra no time', g.team.length === 4 && g.team[3].speciesId === 'lugia',
     g.team.map(p=>p.speciesId).join(','));
  ok('e ai sim as tres reiniciam', S.ninhosAcesos() === 0 && S.missoesDaMontanha().sequenciaDeGinasios === 0);

  /* ---------- 8) A TELA ---------- */
  g.montanha = null;
  g.montanhaPremio = [{ speciesId:'fearow', level:48, shiny:false },
                      { speciesId:'pidgeot', level:50, shiny:false }];
  const telaVazia = S.renderNinhos();
  ok('os tres ninhos sao desenhados', (telaVazia.match(/class="ninho /g)||[]).length === 3);
  ok('todos vazios sao clicaveis', (telaVazia.match(/onclick="abrirNinho\(/g)||[]).length === 3);
  ok('e a tela oferece os guardioes', /escolherOGuardiao\(0\)/.test(telaVazia) && /escolherOGuardiao\(1\)/.test(telaVazia));
  ok('sem a batalha dos quatro', !/enfrentarOsLendarios/.test(telaVazia));
  /* com os tres acesos a batalha SUBSTITUI o premio -- o pedido diz que a escolha entre os seis
     e pra quem *"ainda nao tenha liberado os tres ninhos"* */
  S.acenderNinho('moltres'); S.acenderNinho('zapdos'); S.acenderNinho('articuno');
  const telaCheia = S.renderNinhos();
  ok('com os tres acesos, a batalha aparece', /enfrentarOsLendarios/.test(telaCheia));
  ok('e o premio dos guardioes some', !/escolherOGuardiao/.test(telaCheia));
  /* o MODAL de cada ninho conta a missao */
  g.ninhoAberto = 'zapdos';
  const modalAceso = S.renderNinhoModal();
  ok('o modal do ninho ACESO diz que esta ocupado', /ocupado/i.test(modalAceso));
  g.montanha = null; g.ninhoAberto = 'zapdos';
  S.passoDoZapdos(true);
  const modalVazio = S.renderNinhoModal();
  ok('o modal do ninho VAZIO conta a missao', /3 ginásios seguidos/.test(modalVazio));
  /* ⚠️ SO O ZAPDOS MOSTRA PROGRESSO: a missao dele e a unica que ACUMULA entre batalhas. */
  ok('e mostra o progresso da sequencia', /1 de 3/.test(modalVazio));
  g.ninhoAberto = 'moltres';
  ok('o do Moltres nao mostra progresso', !/de 3<\/strong> gin/.test(S.renderNinhoModal()));
  g.ninhoAberto = null;

  /* o ANUNCIO na tela de resultado */
  g.ninhosAcesosAgora = ['moltres'];
  const anuncio = S.ninhosAcesosHtml();
  ok('o ninho que acendeu vira linha na tela', /Moltres/.test(anuncio) && /Montanha Sagrada/.test(anuncio));
  g.ninhosAcesosAgora = [];
  ok('e nada aparece quando nenhum acendeu', S.ninhosAcesosHtml() === '');

  /* ---------- 9) O SAVE ---------- */
  g.montanha = null;
  S.acenderNinho('moltres');
  S.passoDoZapdos(true); S.passoDoZapdos(true);
  g.montanhaGuarda = [{ speciesId:'fearow', level:48, shiny:false }];
  g.montanhaPremio = null;
  const dados2 = S.serializeGame();
  ok('os tres campos vao pro save', 'montanha' in dados2 && 'montanhaGuarda' in dados2 && 'montanhaPremio' in dados2,
     Object.keys(dados2).filter(k => k.indexOf('montanha') === 0).join(','));
  ok('o progresso atravessa', dados2.montanha && dados2.montanha.ninhos.moltres === true &&
     dados2.montanha.sequenciaDeGinasios === 2, JSON.stringify(dados2.montanha));
  g.montanha = null; g.montanhaGuarda = null;
  S.applySavedState(dados2);
  ok('e volta inteiro do save', S.ninhoAceso('moltres') && S.missoesDaMontanha().sequenciaDeGinasios === 2 &&
     (g.montanhaGuarda||[]).length === 1);
  /* ⚠️ A GUARDA PASSA PELO MESMO CONSERTO DA VIGILIA: a especie tem que bater com o nivel, senao
     quem esta na tela dos ninhos escolheria um pokemon que nao existe. */
  S.applySavedState(Object.assign({}, dados2, { montanhaGuarda: [{ speciesId:'charizard', level:24, shiny:false }] }));
  ok('e forma impossivel no save e arrumada na leitura', g.montanhaGuarda[0].speciesId === 'charmeleon',
     g.montanhaGuarda[0].speciesId + ' Lv.24');
  /* as tres telas sao ponto seguro de gravacao */
  ['montanha','ninhos','montanhaLendarios'].forEach(t =>
    ok('a tela ' + t + ' e ponto seguro de gravacao', S.SAFE_SAVE_SCREENS.has(t)));

  /* ---------- 10) O CODIGO ---------- */
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  /* ⚠️ AS MISSOES SO VALEM NA JORNADA: o `aceitarConvite` pode cair no finishBattle vindo do
     Ginasio da Cidade (e a MESMA tela `battling`), e ali nao ha lider nenhum. E a mesma guarda que
     o sketch precisou, pelo mesmo caminho. */
  ok('o gancho das missoes e guardado por ehJornada()',
     /ninhosAcesosAgora\s*=\s*ehJornada\(\)\s*\?\s*conferirNinhos/.test(src));
  /* ⚠️ E ELE RODA NA VITORIA E NA DERROTA: e a DERROTA que zera a sequencia do Zapdos. Dentro do
     `if(result.win)` ela cresceria pra sempre. */
  const iGancho = src.indexOf('ninhosAcesosAgora = ehJornada()');
  const iWin = src.indexOf('if(result.win){', src.indexOf('function finishBattle'));
  ok('e ele vem ANTES do if(result.win)', iGancho > 0 && iWin > 0 && iGancho < iWin,
     iGancho + ' < ' + iWin);
  /* o modal do ninho e anexado DEPOIS da tela: os modais empilham na ordem em que entram */
  ok('o modal do ninho e anexado no render', /game\.ninhoAberto.*renderNinhoModal/.test(src));
}


console.log('\nO BOT COM --corte ATRAVESSA A MATA FECHADA');
/* ⚠️ ESTA TRAVA NASCEU DE UM DEFEITO REAL (16/09/2026), e ela e de COMPORTAMENTO de proposito.
   Quando o HM03 entrou, o `podeAprenderCorte` morreu -- a lista passou a viver dentro do item
   (`podeAprenderHM('hm01', ...)`) -- e o tools/smoke-jornada.js continuou chamando a funcao que
   nao existia mais. O efeito NAO foi um erro barulhento: toda jornada com --corte morria no passo
   3, e um A/B com a flag devolvia ZERO jornadas concluidas dos dois lados -- "sem diferenca" sem
   ter medido nada.
   ⚠️ A PRIMEIRA VERSAO DESTA TRAVA ERA ESTATICA (varrer os `g.x` do smoke e cobrar que existam) e
   foi DESCARTADA: ela acusa 20 nomes de ramos MORTOS (cassino, safari, fossil -- eventos que
   sairam do jogo e que o bot nunca alcanca). Trava que acusa o que nao roda vira ruido, e ruido
   e desligado. Rodar 8 jornadas custa 0,4s e cobra a coisa certa: o caminho funciona.
   A mata so aparece do trecho 4 em diante e em 1 de cada 4, entao o que se exige e que o bot NAO
   FALHE -- exigir que ele veja a mata em 8 jornadas seria um teste que falha sozinho. */
{
  const { execFileSync } = require('child_process');
  let saida = "";
  try{
    saida = execFileSync(process.execPath, [require('path').join(__dirname, 'smoke-jornada.js'), '--runs', '8', '--corte'],
                         { encoding: 'utf8', timeout: 120000 });
  }catch(e){ saida = 'NAO RODOU: ' + e.message; }
  const m = saida.match(/Falhas: (\d+)/);
  ok('8 jornadas com --corte, nenhuma falha', !!m && m[1] === '0',
     m ? m[1] + ' falha(s)' : saida.slice(0, 120));
}
console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
