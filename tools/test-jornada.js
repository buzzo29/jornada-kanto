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

console.log('\nTODO POKEMON TEM COMO SER CAPTURADO');
/* Uma especie na tabela que nao esta em rota nenhuma nem evolui de nada e uma vaga impossivel na
   Pokedex -- e a Pokedex completa e o que libera o desafio do Mewtwo. Quando Johto entrou, DEZESSETE
   nao-lendarios ficaram assim (Pichu, Togepi, Slowking, Skarmory, Unown...) e nada acusava. */
const alcancavel = new Set();
[S.ROUTE_MAP, S.JOHTO_ROUTE_MAP].forEach(mapa => mapa.forEach(par => par.forEach(r => {
  r.pool.forEach(id => alcancavel.add(id));
  (r.rare || []).forEach(x => alcancavel.add(typeof x === 'object' ? x.species : x));
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
const FORA = ['mewtwo','celebi'];
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

console.log('\nOS SEIS INICIAIS');
ok('sao 6 iniciais', S.STARTERS.length === 6, S.STARTERS.join(','));
ok('3 de Kanto e 3 de Johto',
   S.STARTERS.filter(id=>S.SPECIES[id].dex<=151).length === 3 &&
   S.STARTERS.filter(id=>S.SPECIES[id].dex>151).length === 3);
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
ok('mostra as rotas de cada lado', html.includes('Túnel de Pedra') && html.includes('Parque Nacional'));
ok('os dois botoes escolhem regioes diferentes',
   html.includes("escolherGinasio('kanto')") && html.includes("escolherGinasio('johto')"));
ok('mostra a INSIGNIA de verdade, nao o emoji num circulo',
   (html.match(/badge-visual-img/g)||[]).length === 2 && !html.includes('gym-choice-selo'),
   (html.match(/badge-visual-img/g)||[]).length + ' imagens');

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
