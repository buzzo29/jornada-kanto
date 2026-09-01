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
ok('o log ganha a linha da explosao', diario.some(g => g.x === 'boom' && g.g === 'Autodestruição'));

/* SONO: o alvo dorme e nao revida -- quem usou nao toma nada. */
a = inst('jigglypuff'); b = inst('onix');
a.maxHp = S.calcMaxHp(a); a.hp = a.maxHp; b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
const hpAntes = a.hp;
diario = [];
ok('dormiu: o confronto se resolve ali', S.tentarGolpeEspecial(a, b, rngFixo(0.01), diario) === true);
ok('o alvo cai e quem usou nao perde nada', b.hp === 0 && a.hp === hpAntes, 'a=' + a.hp + '/' + hpAntes + ' b=' + b.hp);
ok('e o log diz qual golpe foi', diario.some(g => g.x === 'sono' && g.g === 'Canto'));

/* Quem nao tem golpe especial nunca cai nesse caminho. */
a = inst('pidgey'); b = inst('onix');
let nenhum = 0;
for(let i=0;i<2000;i++){ if(S.tentarGolpeEspecial(inst('pidgey'), inst('onix'), Math.random, [])) nenhum++; }
ok('quem nao tem o golpe nunca usa', nenhum === 0, nenhum + ' de 2000');

console.log('\nAS CHANCES SAO AS PEDIDAS');
function frequencia(id, alvo, n){
  let boom = 0, sono = 0;
  for(let i=0;i<n;i++){
    const d = [];
    S.tentarGolpeEspecial(inst(id), inst(alvo), Math.random, d);
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

console.log('\nA MENSAGEM APARECE NA TELA');
const mBoom = { player:'Geodude', enemy:'Onix', playerSpecies:'geodude', enemySpecies:'onix',
  golpes:[{ q:'p', d:100, hp:0, x:'boom', g:'Autodestruição' }, { q:'e', d:80, hp:0, x:'boomself' }] };
const htmlBoom = S.passosHtml(mBoom);
ok('a explosao vira uma linha propria no log', htmlBoom.includes('Autodestruição') && htmlBoom.includes('caíram na hora'));
ok('e uma linha so (a do "caiu junto" nao repete)', (htmlBoom.match(/class="mlog-passo /g)||[]).length === 1);
const mSono = { player:'Jigglypuff', enemy:'Onix', playerSpecies:'jigglypuff', enemySpecies:'onix',
  golpes:[{ q:'p', d:100, hp:0, x:'sono', g:'Canto' }] };
ok('o sono tambem', S.passosHtml(mSono).includes('Canto') && S.passosHtml(mSono).includes('dormiu'));

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
