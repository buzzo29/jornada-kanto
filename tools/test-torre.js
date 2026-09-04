/**
 * Teste da escolha de time da TORRE DOS TREINADORES, no servidor, sem Firebase.
 * Mesmo esqueleto do test-amigos-servidor.js: stubs no lugar do firebase-admin/functions.
 *
 * O que ele existe pra pegar: o shiny sumindo. Quem tem o MESMO pokémon no MESMO nível em dois
 * saves (um shiny, um normal) escolhia o shiny e entrava na torre com o normal, porque a busca
 * era por espécie+nível e pegava o primeiro que casasse.
 *
 *   node tools/test-torre.js
 */
const path = require('path');
const Module = require('module');
const fake = require('./fake-firestore');

const db = fake.makeDb();
const stubs = {
  'firebase-functions/v2/scheduler': { onSchedule: (a, b)=> (typeof a === 'function' ? a : b) },
  'firebase-functions/v2/https': {
    onCall: (fn)=>fn,
    HttpsError: class HttpsError extends Error { constructor(code, msg){ super(msg); this.code = code; } }
  },
  'firebase-functions/logger': { error(){}, info(){}, warn(){}, log(){} },
  'firebase-admin': { initializeApp(){}, firestore: Object.assign(()=>db, { FieldValue: fake.FieldValue }) }
};
const loadOriginal = Module._load;
Module._load = function(req, parent, isMain){
  if(stubs[req]) return stubs[req];
  return loadOriginal.apply(this, arguments);
};
const fns = require(path.join(__dirname, '..', 'functions', 'index.js'));
Module._load = loadOriginal;

let falhas = 0, casos = 0;
function ok(nome, cond, detalhe){
  casos++;
  if(cond) console.log('  \u2713 ' + nome);
  else { falhas++; console.log('  \u2717 ' + nome + (detalhe ? ' \u2014 ' + detalhe : '')); }
}
const chamar = (fn, uid, data)=> fn({ auth:{ uid }, data });

(async ()=>{
console.log('\nTORRE: escolha do time');

const mon = (id, especie, nivel, shiny)=>({ id, speciesId:especie, level:nivel, shiny:!!shiny });
// save 0: o time com o Gyarados NORMAL. save 1: o mesmo Gyarados, mesmo nivel, SHINY.
const time0 = [mon('a1','gyarados',73,false), mon('a2','alakazam',70), mon('a3','snorlax',71),
               mon('a4','arcanine',69), mon('a5','gengar',72), mon('a6','lapras',70)];
const time1 = [mon('b1','gyarados',73,true), mon('b2','machamp',70), mon('b3','starmie',71),
               mon('b4','vileplume',69), mon('b5','rhydon',72), mon('b6','ninetales',70)];
await db.collection('users').doc('ash').collection('saves').doc('0').set({ badgeCount:8, team:time0 });
await db.collection('users').doc('ash').collection('saves').doc('1').set({ badgeCount:8, team:time1 });

// escolhe o SHINY (save 1) -- e os outros cinco do save 1, pra nao repetir especie
const escolha = time1.map(p=>({ speciesId:p.speciesId, level:p.level, slot:'1', idx:time1.indexOf(p), monId:p.id, shiny:p.shiny }));
const r = await chamar(fns.startTrainerTowerRun, 'ash', { team: escolha });
const gyara = r.run.team.find(p=>p.speciesId==='gyarados');
ok('escolheu o Gyarados shiny e a torre guardou o shiny', gyara && gyara.shiny === true,
   'guardou shiny=' + (gyara && gyara.shiny));

// e o contrario: escolher o NORMAL nao pode trazer o shiny
await db.collection('trainerTowerRuns').doc('ash').delete();
const escolha2 = time0.map(p=>({ speciesId:p.speciesId, level:p.level, slot:'0', idx:time0.indexOf(p), monId:p.id, shiny:p.shiny }));
const r2 = await chamar(fns.startTrainerTowerRun, 'ash', { team: escolha2 });
const gyara2 = r2.run.team.find(p=>p.speciesId==='gyarados');
ok('escolheu o normal e continua normal', gyara2 && gyara2.shiny === false);

// cliente ANTIGO (so especie+nivel, sem identidade): tem que continuar funcionando
await db.collection('trainerTowerRuns').doc('ash').delete();
const antigo = time1.map(p=>({ speciesId:p.speciesId, level:p.level }));
const r3 = await chamar(fns.startTrainerTowerRun, 'ash', { team: antigo });
ok('cliente antigo continua conseguindo montar o time', r3.run.team.length === 6);


/* O SHINY TEM QUE CHEGAR NA BATALHA -- nao basta ele estar no time gravado.
   Reclamacao real: "o shiny aparece como pokemon normal na hora da batalha". A conta e o desenho
   saem do MESMO campo (playerShiny em cada confronto), entao se ele se perder no caminho o jogador
   perde as duas coisas: a estrela na tela e o buff de 1,20x em todos os atributos. */
await db.collection('trainerTowerRuns').doc('ash').delete();
/* O slot tem que ser o DE VERDADE (time1 mora no save 1). Ele dizia '0', e o teste passava
   porque a busca comecava pelo id do bicho, que atravessava saves -- justamente o defeito que
   fez um jogador entrar na luta com o xara de outro save (ver test-ginasio-cidade). Com a busca
   comecando por save+posicao, um slot mentido acha o pokemon daquele slot, que e o certo. */
const escolhaShiny = time1.map((p,i)=>({ speciesId:p.speciesId, level:p.level, slot:'1', idx:i, monId:p.id, shiny:!!p.shiny }));
const rS = await chamar(fns.startTrainerTowerRun, 'ash', { team: escolhaShiny });
const shinysNoTime = rS.run.team.filter(p=>p.shiny).map(p=>p.speciesId);
ok('o time da subida guarda quem e shiny', shinysNoTime.length > 0, 'shinys: ' + shinysNoTime.join(', '));
const rF = await chamar(fns.fightTrainerTowerFloor, 'ash', {});
const brilhouNaLuta = new Set(rF.matchups.filter(m=>m.playerShiny).map(m=>m.playerSpecies));
const esperados = new Set(shinysNoTime);
const faltando = [...esperados].filter(id => rF.matchups.some(m=>m.playerSpecies===id) && !brilhouNaLuta.has(id));
ok('e cada confronto carrega o brilho de quem lutou', faltando.length === 0,
   faltando.length ? 'sem brilho: ' + faltando.join(', ') : '');
const semBrilhoAtoa = rF.matchups.filter(m=>m.playerShiny && !esperados.has(m.playerSpecies));
ok('e nao inventa brilho em quem nao e shiny', semBrilhoAtoa.length === 0);

/* OS QUATRO INTOCAVEIS NAO ENTRAM NO TIME DOS NPCs.
   Encontrar num andar comum da torre um bicho que o jogador nunca vai poder ter esvazia o que eles
   sao -- e ate 31/08/2026 Celebi e Ho-Oh saiam mesmo (conferido na torre gerada do dia). */
const PROIBIDOS = ['mewtwo','lugia','hooh','celebi'];
let achadosNaTorre = [];
for(let dia = 1; dia <= 60; dia++){
  const torre = fns._towerGenerate ? fns._towerGenerate('2026-01-' + String(dia).padStart(2,'0')) : null;
  if(!torre) break;
  torre.floors.forEach(f => f.team.forEach(p => {
    if(PROIBIDOS.includes(p.speciesId)) achadosNaTorre.push('dia ' + dia + ' andar ' + f.floor + ': ' + p.speciesId);
  }));
}
ok('nenhum intocavel no time dos NPCs (60 torres)', achadosNaTorre.length === 0,
   achadosNaTorre.slice(0,4).join(' | '));


/* O ID DE POKEMON REPETE ENTRE SAVES -- e por isso ele nao pode mandar na busca.
   `mon7`, `mon12`... saem de um contador que recomeca do 1 a cada carregamento de pagina e so e
   reconciliado com o save CARREGADO. Dois saves tem `mon1` cada um. Enquanto a busca comecava pelo
   id, ela varria a conta inteira e o PRIMEIRO save vencia sempre: o jogador escolhia da lista de um
   save e subia com o xara do outro. Foi assim que um jogador entrou num ginasio com um Golem e uma
   Meganium que ele nao tinha escolhido (01/09/2026).
   O fixture repete os ids de proposito -- e assim que os saves de verdade sao. */
await db.collection('trainerTowerRuns').doc('may').delete();
const casa0 = [mon('mon1','golem',70), mon('mon2','meganium',70), mon('mon3','pidgeot',70),
               mon('mon4','arcanine',70), mon('mon5','lapras',70), mon('mon6','machamp',70)];
const casa1 = [mon('mon1','gengar',70), mon('mon2','starmie',70), mon('mon3','nidoking',70),
               mon('mon4','victreebel',70), mon('mon5','rhydon',70), mon('mon6','jolteon',70)];
await db.collection('users').doc('may').collection('saves').doc('0').set({ badgeCount:8, team:casa0 });
await db.collection('users').doc('may').collection('saves').doc('1').set({ badgeCount:8, team:casa1 });
const doSave1 = casa1.map((p,i)=>({ speciesId:p.speciesId, level:p.level, slot:'1', idx:i, monId:p.id, shiny:false }));
const rX = await chamar(fns.startTrainerTowerRun, 'may', { team: doSave1 });
const subiuCom = rX.run.team.map(p=>p.speciesId).sort().join(',');
ok('escolhendo do save 1, sobe com o time do save 1 (e nao com os xaras do save 0)',
   subiuCom === casa1.map(p=>p.speciesId).sort().join(','), subiuCom);


console.log('');
console.log('A TORRE NOVA: 20 andares, derrota nao volta pro comeco, premio de quem foi mais longe');

/* 20 andares, media do 65 ao 122, de 3 em 3. Os ultimos passam do nivel 99 (teto do JOGADOR) de
   proposito: a torre deixou de ser algo pra zerar e virou uma medida de ate onde cada um chega. */
const torreHoje = fns._towerGenerate('2026-09-02');
ok('sao 30 andares', torreHoje.floors.length === 30, torreHoje.floors.length + '');
ok('o primeiro tem media 65', torreHoje.floors[0].avgLevel === 65, torreHoje.floors[0].avgLevel + '');
ok('o ultimo tem media 152', torreHoje.floors[29].avgLevel === 152, torreHoje.floors[29].avgLevel + '');
ok('e sobem de 3 em 3', torreHoje.floors.every((f,i) => i === 0 || f.avgLevel - torreHoje.floors[i-1].avgLevel === 3));
ok('com nome diferente em cada um', new Set(torreHoje.floors.map(f=>f.name)).size === 30);
/* E o sorteio precisa de FOLGA: com tantos nomes quanto andares, todo dia usaria todos e so a
   ordem mudaria -- a torre pareceria a mesma torre reembaralhada. */
const elenco1 = fns._towerGenerate('2026-09-10').floors.map(f=>f.name).join(',');
const elenco2 = fns._towerGenerate('2026-09-11').floors.map(f=>f.name).join(',');
ok('e o elenco muda de um dia pro outro', elenco1.split(',').filter(n=>!elenco2.includes(n)).length > 0,
   elenco1.split(',').filter(n=>!elenco2.includes(n)).length + ' nomes so aparecem num dos dias');
/* Os andares altos passam do teto do jogador -- e o ponto do modo. */
ok('e os ultimos passam do nivel 99', torreHoje.floors.filter(f=>f.avgLevel > 99).length === 18,
   torreHoje.floors.filter(f=>f.avgLevel > 99).length + ' andares acima de 99');

/* PERDER NAO VOLTA PRO COMECO -- e o time nao e apagado. */
{
  const hoje = (await chamar(fns.getTrainerTower, 'ivy', {})).dateId;
  const fracos = [mon('w1','caterpie',5), mon('w2','weedle',5), mon('w3','magikarp',5),
                  mon('w4','ratata',5), mon('w5','pidgey',5), mon('w6','zubat',5)];
  await db.collection('users').doc('ivy').set({ trainerName:'Ivy' });
  await db.collection('users').doc('ivy').collection('saves').doc('0').set({ badgeCount:8, team:fracos });
  await db.collection('trainerTowerRuns').doc('ivy').delete();
  await chamar(fns.startTrainerTowerRun, 'ivy', { team: fracos.map((p,i)=>({
    speciesId:p.speciesId, level:p.level, slot:'0', idx:i, monId:p.id, shiny:false })) });
  /* Nivel 5 contra media 65: a derrota e certa. */
  const perdeu = await chamar(fns.fightTrainerTowerFloor, 'ivy', {});
  ok('perdeu o andar 1', perdeu.win === false, 'win: ' + perdeu.win);
  ok('e continua NO ANDAR 1 (nao volta pro comeco nem zera nada)', perdeu.run.floor === 1, 'andar: ' + perdeu.run.floor);
  ok('com o time ainda montado -- da pra tentar de novo sem remontar',
     !!perdeu.run.team && perdeu.run.team.length === 6, JSON.stringify(perdeu.run.team && perdeu.run.team.length));
  /* E o dia guarda ate onde ele chegou, num documento que sobrevive a virada. */
  const doDia = await db.collection('trainerTowerDays').doc(hoje).collection('players').doc('ivy').get();
  ok('e o dia registra ate onde ele foi', doDia.exists && doDia.data().bestFloor === 1,
     JSON.stringify(doDia.exists && doDia.data()));
  /* E O CASO QUE IMPORTA: vencer alguns andares e ENTAO perder. Perdendo no andar 1 nao da pra
     distinguir "ficou onde estava" de "voltou pro comeco" -- os dois dao 1. */
  const forte = [mon('s1','mewtwo',99), mon('s2','lugia',99), mon('s3','hooh',99),
                 mon('s4','tyranitar',99), mon('s5','dragonite',99), mon('s6','blissey',99)];
  await db.collection('users').doc('ivy').collection('saves').doc('1').set({ badgeCount:8, team:forte });
  await db.collection('trainerTowerRuns').doc('ivy').delete();
  await chamar(fns.startTrainerTowerRun, 'ivy', { team: forte.map((p,i)=>({
    speciesId:p.speciesId, level:p.level, slot:'1', idx:i, monId:p.id, shiny:false })) });
  let andarAlcancado = 1;
  for(let i=0;i<3;i++){
    const r = await chamar(fns.fightTrainerTowerFloor, 'ivy', {});
    if(!r.win) break;
    andarAlcancado = r.run.floor;
  }
  ok('subiu alguns andares com um time forte', andarAlcancado > 1, 'chegou ao ' + andarAlcancado);
  /* Agora troca pro time fraco e perde de proposito: o andar tem que FICAR. */
  await chamar(fns.startTrainerTowerRun, 'ivy', { team: fracos.map((p,i)=>({
    speciesId:p.speciesId, level:p.level, slot:'0', idx:i, monId:p.id, shiny:false })) });
  const caiu = await chamar(fns.fightTrainerTowerFloor, 'ivy', {});
  ok('perdeu com o time fraco', caiu.win === false);
  ok('e CONTINUA no andar em que estava (nao volta pro 1)', caiu.run.floor === andarAlcancado,
     'esperava ' + andarAlcancado + ', ficou em ' + caiu.run.floor);

}

/* O PODIO SAO OS 3 ANDARES MAIS ALTOS, e o empate premia TODOS.
   O doce e o premio de PARTICIPACAO (os tres degraus); o ponto do ranking geral e o de VENCER (so
   o degrau de cima). Sao perguntas diferentes -- "quem apareceu" e "quem chegou mais longe" --, e
   por isso o ranking geral nao mudou de significado. */
{
  const ontem = '2026-08-30';
  const players = db.collection('trainerTowerDays').doc(ontem).collection('players');
  await players.doc('a').set({ uid:'a', name:'Ana',   bestFloor:14 });
  await players.doc('b').set({ uid:'b', name:'Bruno', bestFloor:14 });
  await players.doc('c').set({ uid:'c', name:'Caio',  bestFloor:13 });
  await players.doc('d').set({ uid:'d', name:'Duda',  bestFloor:2  });
  await players.doc('e').set({ uid:'e', name:'Edu',   bestFloor:1  });
  const r = await fns._towerFecharDia(ontem);
  ok('o topo do dia foi o andar 14', r && r.topFloor === 14, JSON.stringify(r));
  /* OS DEGRAUS SAO DE ANDAR, NAO DE PESSOA: com dois empatados no 14, o segundo degrau ainda e o
     proximo ANDAR que teve gente (13), e o terceiro o seguinte (2). */
  ok('os tres degraus sao os tres ANDARES mais altos', JSON.stringify(r.degraus) === JSON.stringify([14,13,2]),
     JSON.stringify(r.degraus));
  ok('e os DOIS que empataram no 14 estao no topo', r.vencedores === 2, r.vencedores + '');
  ok('com quatro premiados no total (2 + 1 + 1)', r.premiados === 4, r.premiados + '');
  const doce = async (uid) => (((await db.collection('users').doc(uid).get()).data() || {}).rareCandies || 0);
  ok('os dois do topo ganharam Doce Raro', await doce('a') === 1 && await doce('b') === 1);
  ok('o 2o degrau (andar 13) tambem', await doce('c') === 1, String(await doce('c')));
  ok('e o 3o degrau (andar 2) tambem', await doce('d') === 1, String(await doce('d')));
  /* QUEM FICOU DE FORA DO PODIO NAO GANHA NADA -- senao "pódio" nao quer dizer nada. */
  ok('mas quem ficou fora do podio nao ganhou', await doce('e') === 0, String(await doce('e')));
  const rank = async (uid) => ((await db.collection('trainerTowerRanking').doc(uid).get()).data() || {});
  const rankA = await rank('a');
  ok('o ranking conta o DIA NO TOPO', rankA && rankA.topDays === 1, JSON.stringify(rankA));
  ok('e guarda o andar mais alto que ele ja alcancou', rankA.bestFloorEver === 14, rankA.bestFloorEver + '');
  const rankB = await rank('b');
  ok('e o SEGUNDO do empate tambem pontuou', rankB.topDays === 1, JSON.stringify(rankB));
  /* SO O ANDAR MAIS ALTO PONTUA. O 2o e o 3o degrau ganham doce e entram no ranking (o documento
     existe, com o bestFloorEver), mas com topDays ZERO -- e isso que mantem o ranking geral
     medindo "quem chegou mais longe" e nao "quem apareceu". */
  const rankC = await rank('c'), rankD = await rank('d');
  ok('mas o 2o degrau NAO pontua no ranking geral', !(rankC.topDays > 0), JSON.stringify(rankC));
  ok('nem o 3o', !(rankD.topDays > 0), JSON.stringify(rankD));
  ok('e mesmo assim o andar deles fica registrado', rankC.bestFloorEver === 13 && rankD.bestFloorEver === 2,
     rankC.bestFloorEver + '/' + rankD.bestFloorEver);
  /* O cron roda de hora em hora: fechar de novo nao pode pagar duas vezes. */
  const denovo = await fns._towerFecharDia(ontem);
  ok('fechar o mesmo dia de novo nao paga ninguem duas vezes',
     denovo === null && await doce('a') === 1 && await doce('c') === 1,
     'doces: ' + await doce('a') + '/' + await doce('c'));
  /* Um dia sem ninguem fecha em silencio, sem premiar nada. */
  const vazio = await fns._towerFecharDia('2026-08-29');
  ok('dia sem ninguem fecha sem premiar', vazio && vazio.topFloor === 0 && vazio.vencedores === 0, JSON.stringify(vazio));

  /* MENOS DE TRES ANDARES DISTINTOS: o podio simplesmente tem menos degraus, sem inventar um
     terceiro nem quebrar. E o caso de um dia com pouca gente, que e o dia comum. */
  const outro = '2026-08-28';
  const p2 = db.collection('trainerTowerDays').doc(outro).collection('players');
  await p2.doc('x').set({ uid:'x', name:'Xu', bestFloor:9 });
  await p2.doc('y').set({ uid:'y', name:'Yan', bestFloor:9 });
  const r2 = await fns._towerFecharDia(outro);
  ok('com um andar so, o podio tem um degrau', JSON.stringify(r2.degraus) === JSON.stringify([9]),
     JSON.stringify(r2.degraus));
  ok('e os dois empatados levam doce e ponto', await doce('x') === 1 && await doce('y') === 1);

  /* QUEM FOI 2o ONTEM E 1o HOJE tem que ganhar as DUAS coisas. As travas de dia sao separadas
     (lastPrizeDate pro doce, lastTopDate pro ponto) exatamente por isso -- uma trava so faria o
     ponto de hoje sumir em silencio porque o doce de ontem ja tinha marcado o treinador. */
  const hojeD = '2026-08-31';
  const p3 = db.collection('trainerTowerDays').doc(hojeD).collection('players');
  await p3.doc('c').set({ uid:'c', name:'Caio', bestFloor:30 });
  await fns._towerFecharDia(hojeD);
  const rankC2 = await rank('c');
  ok('quem foi 2o ontem e 1o hoje pontua hoje', rankC2.topDays === 1, JSON.stringify(rankC2));
  ok('e ganha o segundo doce', await doce('c') === 2, String(await doce('c')));
}


console.log('');
console.log('QUEM ZEROU A TORRE ANTIGA NAO PODE FICAR TRAVADO');
/* A torre do dia ja estava gravada com 10 andares quando ela virou 20. Duas consequencias, as duas
   reportadas em 02/09/2026:
   1) a mudanca so valeria no dia seguinte -- a torre do dia continuava com 10 andares;
   2) quem tinha ZERADO os 10 travava no "voce ja venceu a torre hoje" e nao jogava mais nada.
   O fixture recria exatamente esse estado: torre velha gravada e subida marcada como zerada. */
{
  const hoje = (await chamar(fns.getTrainerTower, 'ivy', {})).dateId;
  const timeDoRex = [mon('r1','mewtwo',99), mon('r2','lugia',99), mon('r3','hooh',99),
                     mon('r4','tyranitar',99), mon('r5','dragonite',99), mon('r6','blissey',99)];
  /* Regrava a torre do dia no formato ANTIGO, com 10 andares. */
  const velha = fns._towerGenerate(hoje);
  velha.floors = velha.floors.slice(0, 10);   // formato antigo, com 10
  await db.collection('trainerTower').doc(hoje).set(velha);
  /* E um jogador que zerou aqueles 10. */
  await db.collection('trainerTowerRuns').doc('rex').set({
    dateId: hoje, floor: 10, bestFloor: 10, cleared: true,
    team: timeDoRex.map(p=>({ speciesId:p.speciesId, level:p.level, shiny:false })),
    startedAt: Date.now(), lastAt: Date.now()
  });
  await db.collection('users').doc('rex').set({ trainerName:'Rex' });
  await db.collection('users').doc('rex').collection('saves').doc('0').set({ badgeCount:8, team:timeDoRex });

  const vista = await chamar(fns.getTrainerTower, 'rex', {});
  ok('a torre do dia e refeita com o formato de hoje', (vista.floors||[]).length === 30,
     (vista.floors||[]).length + ' andares');
  ok('e a subida dele volta a ficar ativa', vista.run.cleared === false, 'cleared: ' + vista.run.cleared);
  ok('no andar seguinte ao ultimo que ele venceu', vista.run.floor === 11, 'andar: ' + vista.run.floor);
  ok('sem perder os 10 que ja tinha vencido', (vista.run.bestFloor||0) >= 10, 'bestFloor: ' + vista.run.bestFloor);
  /* E o principal: ele consegue LUTAR de novo. */
  const luta = await chamar(fns.fightTrainerTowerFloor, 'rex', {});
  ok('e ele consegue jogar de novo hoje mesmo', !!luta && typeof luta.win === 'boolean',
     'win: ' + (luta && luta.win));
  /* Quem zerou a torre de HOJE (20 andares) continua zerado -- a destrava e so pra torre menor. */
  await db.collection('trainerTowerRuns').doc('rex').set({
    dateId: hoje, floor: 30, bestFloor: 30, cleared: true, team: null, startedAt: Date.now(), lastAt: Date.now()
  });
  const zerouHoje = await chamar(fns.getTrainerTower, 'rex', {});
  ok('mas quem zerou a torre DE HOJE continua zerado', zerouHoje.run.cleared === true,
     'cleared: ' + zerouHoje.run.cleared);
}


console.log('');
console.log('O RANKING DO DIA');
/* Duas coisas diferentes e as duas importam: o GERAL diz quem e bom nisso ha tempo, e o de HOJE diz
   quem esta na frente AGORA -- que e o que faz o jogador voltar antes da virada pra tentar passar
   alguem. Os dois saem na MESMA chamada: sao a mesma tela. */
{
  const hoje = (await chamar(fns.getTrainerTower, 'ivy', {})).dateId;
  const players = db.collection('trainerTowerDays').doc(hoje).collection('players');
  await players.doc('p1').set({ uid:'p1', name:'Ana',   bestFloor:12 });
  await players.doc('p2').set({ uid:'p2', name:'Bruno', bestFloor:9  });
  await players.doc('p3').set({ uid:'p3', name:'Caio',  bestFloor:15 });
  await players.doc('p4').set({ uid:'p4', name:'Duda',  bestFloor:3  });
  const r = await chamar(fns.getTrainerTowerRanking, 'p1', {});
  ok('a chamada devolve os dois rankings', Array.isArray(r.hoje) && Array.isArray(r.top));
  /* Ordem decrescente, sem assumir QUEM esta na lista: os blocos anteriores deste teste tambem
     jogaram hoje, e travar a lista exata deixaria o teste refem da ordem dos blocos. */
  ok('e o de hoje vem ordenado do andar mais alto pro mais baixo',
     r.hoje.every((x,i) => i === 0 || x.bestFloor <= r.hoje[i-1].bestFloor),
     r.hoje.map(x=>x.name+':'+x.bestFloor).join(' '));
  ok('com o mais longe do dia no topo', r.hoje[0].bestFloor === 15, JSON.stringify(r.hoje[0]));
  ok('com o nome de cada treinador', r.hoje[0].name === 'Caio', JSON.stringify(r.hoje[0]));
  /* Quem nao jogou hoje nao aparece -- a lista sai do documento DO DIA. */
  const nomes = r.hoje.map(x=>x.name);
  ok('e os quatro que joguei aparecem', ['Ana','Bruno','Caio','Duda'].every(n=>nomes.includes(n)), nomes.join(', '));
  ok('e ninguem de fora do dia entra', r.hoje.length <= 10, r.hoje.length + ' (o teto e 10)');
}

console.log(`\n${casos - falhas}/${casos} casos passaram.`);
if(falhas){ console.log(`${falhas} FALHA(S).`); process.exit(1); }
})().catch(e=>{ console.error('\nERRO NAO TRATADO:', e); process.exit(1); });
