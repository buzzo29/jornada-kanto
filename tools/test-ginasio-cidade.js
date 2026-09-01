/**
 * GINASIO DA CIDADE -- a montagem de time dos DOIS lados, no servidor, sem Firebase.
 *
 * O que mudou em 01/09/2026: a defesa e o desafio deixaram de ser "um save inteiro" e passaram a
 * ser um time MONTADO com pokemon de qualquer save com 8 insignias, sem repetir especie -- a mesma
 * regra da Torre. Isso derrubou tres coisas que estavam presas ao slot e este teste tranca as tres:
 * a espera (que virou por JOGADOR), o time de quem vence (que agora e o time que venceu) e a
 * identidade do pokemon escolhido (o defeito do shiny que sumia, que ja aconteceu na Torre).
 *
 *   node tools/test-ginasio-cidade.js
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
Module._load = function(req){ if(stubs[req]) return stubs[req]; return loadOriginal.apply(this, arguments); };
const fns = require(path.join(__dirname, '..', 'functions', 'index.js'));
Module._load = loadOriginal;

let falhas = 0, casos = 0;
function ok(nome, cond, detalhe){
  casos++;
  if(cond) console.log('  ✓ ' + nome);
  else { falhas++; console.log('  ✗ ' + nome + (detalhe ? ' — ' + detalhe : '')); }
}
const chamar = (fn, uid, data)=> fn({ auth:{ uid }, data });
async function recusa(fn, uid, data){
  try { await chamar(fn, uid, data); return null; } catch(e){ return e.message || String(e); }
}
const mon = (id, especie, nivel, shiny)=>({ id, speciesId:especie, level:nivel, shiny:!!shiny });
const escolher = (time, slot, quais)=> quais.map(i => ({
  speciesId: time[i].speciesId, level: time[i].level, slot: String(slot), idx: i,
  monId: time[i].id, shiny: !!time[i].shiny
}));
const CIDADE = { city:'Sorocaba', countryCode:'BR' };
const GYM_ID = 'sorocaba__br';   // normalizeNeighborhoodName(city) + '__' + pais (ver neighborhoodGymId)
/* O time guardado e um codigo base64 de "especie:nivel[:1 se shiny]" separado por virgula. */
const lerTime = (code)=> Buffer.from(String(code||''), 'base64').toString('utf8');
const especiesDe = (code)=> lerTime(code).split(',').map(p => p.split(':')[0]);

(async ()=>{
console.log('\nGINASIO DA CIDADE: o time e MONTADO, nao e mais um save');

/* Dois treinadores, dois saves cada. O Gyarados aparece nos dois saves do Ash no MESMO nivel --
   um normal e um shiny -- porque e exatamente ai que a busca por especie+nivel erra. */
const ashA = [mon('a1','gyarados',73,false), mon('a2','alakazam',70), mon('a3','snorlax',71),
              mon('a4','arcanine',69), mon('a5','gengar',72), mon('a6','lapras',70)];
const ashB = [mon('b1','gyarados',73,true), mon('b2','machamp',70), mon('b3','starmie',71),
              mon('b4','vileplume',69), mon('b5','rhydon',72), mon('b6','ninetales',70)];
const garyA = [mon('g1','dragonite',75), mon('g2','tyranitar',74), mon('g3','blissey',73),
               mon('g4','steelix',72), mon('g5','espeon',71), mon('g6','feraligatr',70)];
await db.collection('users').doc('ash').set({ trainerName:'Ash', specialties:[] });
await db.collection('users').doc('gary').set({ trainerName:'Gary', specialties:[] });
await db.collection('users').doc('ash').collection('saves').doc('0').set({ badgeCount:8, team:ashA });
await db.collection('users').doc('ash').collection('saves').doc('1').set({ badgeCount:8, team:ashB });
await db.collection('users').doc('gary').collection('saves').doc('0').set({ badgeCount:8, team:garyA });

/* 1) DEFESA MISTURANDO SAVES -- o pedido em uma frase. */
const defesaMista = escolher(ashA, 0, [1,2,3]).concat(escolher(ashB, 1, [1,2,3]));
await chamar(fns.setNeighborhoodGymDefense, 'ash', Object.assign({ team: defesaMista }, CIDADE));
let gym = (await db.collection('neighborhoodGyms').doc(GYM_ID).get()).data();
ok('a defesa aceita pokemon de saves DIFERENTES no mesmo time', !!gym && !!gym.leaderTeamCode);
ok('e o ginasio ficou com o Ash como lider', gym.leaderUid === 'ash', 'lider: ' + (gym && gym.leaderUid));
/* A defesa vira um CODIGO congelado: depois de montada nao depende mais dos saves. */
ok('e o time guardado tem os 6 escolhidos', especiesDe(gym.leaderTeamCode).length === 6,
   lerTime(gym.leaderTeamCode));
/* Os tres vieram do save 0 e os tres do save 1 -- e isso que "qualquer save" quer dizer. */
ok('com pokemon dos DOIS saves', especiesDe(gym.leaderTeamCode).includes('alakazam') &&
   especiesDe(gym.leaderTeamCode).includes('machamp'), lerTime(gym.leaderTeamCode));
/* Sem slot: a defesa nao vem de save nenhum, e e isso que solta a exclusividade antiga. */
ok('e nao fica presa a um save (leaderTeamSlot nulo)', gym.leaderTeamSlot === null,
   'leaderTeamSlot: ' + JSON.stringify(gym.leaderTeamSlot));

/* 2) AS DUAS REGRAS DA CASA. */
const repetida = escolher(ashA, 0, [1,1,2]);
ok('recusa especie repetida', /repetir espécie/.test(await recusa(fns.setNeighborhoodGymDefense, 'ash',
   Object.assign({ team: repetida }, CIDADE)) || ''));
const alheio = [{ speciesId:'mewtwo', level:99, slot:'0', idx:0, monId:'x', shiny:false }];
ok('recusa pokemon que a conta nao tem', /não está em nenhum time seu/.test(
   await recusa(fns.setNeighborhoodGymDefense, 'ash', Object.assign({ team: alheio }, CIDADE)) || ''));
ok('recusa mais de 6', /precisa de 1 a 6/.test(await recusa(fns.setNeighborhoodGymDefense, 'ash',
   Object.assign({ team: escolher(ashA,0,[0,1,2,3,4,5]).concat(escolher(ashB,1,[1])) }, CIDADE)) || ''));

/* 3) O SHINY QUE SUMIA. Escolher o Gyarados do save 1 (shiny) nao pode trazer o do save 0. */
await chamar(fns.setNeighborhoodGymDefense, 'ash', Object.assign({ team: escolher(ashB, 1, [0,1,2]) }, CIDADE));
gym = (await db.collection('neighborhoodGyms').doc(GYM_ID).get()).data();
ok('escolheu o Gyarados shiny e o ginasio guardou o shiny',
   lerTime(gym.leaderTeamCode).startsWith('gyarados:73:1'), lerTime(gym.leaderTeamCode));
await chamar(fns.setNeighborhoodGymDefense, 'ash', Object.assign({ team: escolher(ashA, 0, [0,1,2]) }, CIDADE));
gym = (await db.collection('neighborhoodGyms').doc(GYM_ID).get()).data();
ok('e escolhendo o normal, vem o normal',
   lerTime(gym.leaderTeamCode).startsWith('gyarados:73,'), lerTime(gym.leaderTeamCode));

/* 4) O DESAFIANTE TAMBEM MONTA -- e a ESPERA E POR POKEMON.
   Pra isso a defesa do Ash precisa ser esmagadora: o que interessa aqui e o caminho da DERROTA,
   que e quando a espera pesa. */
console.log('');
console.log('O DESAFIO E A ESPERA POR POKEMON');
const muralha = [mon('m1','mewtwo',99), mon('m2','lugia',99), mon('m3','hooh',99),
                 mon('m4','tyranitar',99), mon('m5','dragonite',99), mon('m6','blissey',99)];
await db.collection('users').doc('ash').collection('saves').doc('2').set({ badgeCount:8, team:muralha });
await chamar(fns.setNeighborhoodGymDefense, 'ash', Object.assign({ team: escolher(muralha, 2, [0,1,2,3,4,5]) }, CIDADE));
await chamar(fns.setNeighborhoodGymDefense, 'ash', Object.assign({ terrainId: fns._TERRAINS[0].id }, CIDADE));

/* O Gary tem DOZE pokemon em dois saves -- e isso que deixa testar "os outros continuam livres". */
const garyB = [mon('k1','feraligatr',70), mon('k2','meganium',70), mon('k3','typhlosion',70),
               mon('k4','ampharos',70), mon('k5','umbreon',70), mon('k6','scizor',70)];
await db.collection('users').doc('gary').collection('saves').doc('1').set({ badgeCount:8, team:garyB });

const primeiroTime = escolher(garyA, 0, [0,1,2,3,4,5]);
const r1 = await chamar(fns.challengeNeighborhoodGym, 'gary', Object.assign({ team: primeiroTime }, CIDADE));
ok('o desafio aceita time montado', r1 && Array.isArray(r1.matchups) && r1.matchups.length > 0,
   'matchups: ' + (r1 && r1.matchups && r1.matchups.length));
ok('e contra a muralha ele perde', r1.win === false, 'win: ' + r1.win);

/* A REGRA NOVA: quem lutou descansa 10 minutos; o resto do bicharedo continua livre. */
const deNovo = await recusa(fns.challengeNeighborhoodGym, 'gary', Object.assign({ team: primeiroTime }, CIDADE));
ok('os MESMOS pokemon nao podem voltar na hora', /descanso/.test(deNovo || ''), deNovo);
ok('e a recusa DIZ quem esta descansando', /Dragonite/.test(deNovo || ''), deNovo);
/* Um so repetido ja basta pra barrar -- e a mensagem nomeia so ele. */
const umRepetido = escolher(garyB, 1, [0,1,2,3,4]).concat(escolher(garyA, 0, [0]));
const soUm = await recusa(fns.challengeNeighborhoodGym, 'gary', Object.assign({ team: umRepetido }, CIDADE));
ok('um repetido no meio ja barra, e a mensagem nomeia so ele',
   /Dragonite/.test(soUm || '') && !/Blissey/.test(soUm || ''), soUm);

/* E O QUE O PEDIDO QUER: com OUTROS pokemon, desafia de novo na hora. */
/* Falha LIMPA se a espera voltar a ser do jogador: sem o try, o teste morre com um throw e o
   relatorio nao mostra qual regra quebrou. */
let r2 = null, erroDoOutroTime = null;
try { r2 = await chamar(fns.challengeNeighborhoodGym, 'gary', Object.assign({ team: escolher(garyB, 1, [0,1,2,3,4,5]) }, CIDADE)); }
catch(e){ erroDoOutroTime = e.message; }
ok('mas com OUTROS pokemon ele desafia na hora', !!(r2 && Array.isArray(r2.matchups)), erroDoOutroTime || ('matchups: ' + (r2 && r2.matchups && r2.matchups.length)));
if(!r2) { console.log(String.fromCharCode(10) + (casos - falhas) + "/" + casos + " casos passaram.  " + falhas + " FALHA(S)"); process.exit(1); }

/* A tela precisa saber QUEM esta descansando, senao o jogador monta o time todo e so descobre no
   clique do desafio. */
const espera = await chamar(fns.getNeighborhoodGymChallengeCooldowns, 'gary', CIDADE);
const descansando = Object.keys(espera.mons || {});
ok('a consulta devolve os 12 descansando', descansando.length === 12, descansando.length + ' pokemon');
ok('com o tempo que falta pra cada um', Object.values(espera.mons).every(ms => ms > 0 && ms <= 10*60*1000));
/* A chave tem que ser a MESMA que o cliente calcula (id do bicho), senao a tela libera quem o
   desafio recusa. */
/* A chave e SAVE + ESPECIE, nao o id do bicho: o id repete entre saves (ver a secao 7). */
ok('e a chave e save + especie', descansando.every(k => /^g_\d+_[a-z0-9]+$/.test(k)), descansando.slice(0,2).join(', '));

/* 5) QUEM VENCE DEFENDE COM O TIME QUE VENCEU.
   Antes um sorteio escolhia um save LIVRE do vencedor -- fazia sentido quando a defesa era um save
   inteiro, e nao faz mais nenhum: ele montou um time, ganhou com ele, e e com ele que fica. */
console.log('');
console.log('A VITORIA');
/* Troca a muralha por um time fraco e da ao Gary pokemon descansados. */
await chamar(fns.setNeighborhoodGymDefense, 'ash', Object.assign({ team: escolher(ashA, 0, [0,1,2]) }, CIDADE));
const vencedor = [mon('v1','mewtwo',99), mon('v2','lugia',99), mon('v3','hooh',99),
                  mon('v4','tyranitar',99), mon('v5','dragonite',99), mon('v6','blissey',99)];
await db.collection('users').doc('gary').collection('saves').doc('2').set({ badgeCount:8, team:vencedor });
const timeVencedor = escolher(vencedor, 2, [0,1,2,3,4,5]);
const r3 = await chamar(fns.challengeNeighborhoodGym, 'gary', Object.assign({ team: timeVencedor }, CIDADE));
gym = (await db.collection('neighborhoodGyms').doc(GYM_ID).get()).data();
ok('vencendo, o desafiante vira lider', r3.win === true && gym.leaderUid === 'gary',
   'win: ' + r3.win + ', lider: ' + gym.leaderUid);
const especiesNoGinasio = especiesDe(gym.leaderTeamCode);
ok('e defende com o MESMO time que venceu',
   timeVencedor.every(p => especiesNoGinasio.includes(p.speciesId)), lerTime(gym.leaderTeamCode));
ok('e essa defesa tambem nao fica presa a save nenhum', gym.leaderTeamSlot === null);
/* Assumindo, o terreno volta a ficar pendente: o novo lider escolhe o dele. */
ok('e o terreno fica pendente pro novo lider escolher', gym.leaderTerrain === null,
   'terreno: ' + JSON.stringify(gym.leaderTerrain));

/* 6) OS GINASIOS QUE EU LIDERO -- liderar vale a distancia, so conquistar exige estar na cidade. */
console.log('');
console.log('GINASIOS LIDERADOS');
const meus = await chamar(fns.listMyNeighborhoodGyms, 'gary', {});
ok('a lista traz o ginasio que ele acabou de tomar',
   (meus.gyms||[]).some(g => g.city === 'Sorocaba'), JSON.stringify(meus.gyms));
ok('e avisa que falta escolher o terreno', (meus.gyms||[]).every(g => g.hasTerrain === false),
   JSON.stringify((meus.gyms||[]).map(g=>g.hasTerrain)));
const doAsh = await chamar(fns.listMyNeighborhoodGyms, 'ash', {});
ok('e o lider antigo some da lista dele', (doAsh.gyms||[]).length === 0, JSON.stringify(doAsh.gyms));


/* 7) A ESPERA NAO PODE PEGAR O XARA DE OUTRO SAVE.
   O id de um pokemon (`mon7`, `mon12`...) vem de um contador que recomeca do 1 a cada carregamento
   de pagina e so e reconciliado com o save CARREGADO -- entao dois saves tem `mon7` cada um. Com o
   id como chave, a espera de um caia em cima do xara do outro save: o jogador desafiou com 6 e viu
   8 apagados, um Golem e uma Meganium que ele nem tinha usado. Reportado em 01/09/2026.
   O fixture aqui REPETE os ids de proposito -- e exatamente assim que os saves de verdade sao, e e
   por os fixtures anteriores usarem ids distintos que o defeito passou. */
console.log('');
console.log('A ESPERA E DO POKEMON, NAO DO XARA DE OUTRO SAVE');
const saveUm  = [mon('mon1','golem',70), mon('mon2','meganium',70), mon('mon3','pidgeot',70),
                 mon('mon4','arcanine',70), mon('mon5','lapras',70), mon('mon6','machamp',70)];
const saveDois = [mon('mon1','gengar',70), mon('mon2','starmie',70), mon('mon3','nidoking',70),
                  mon('mon4','victreebel',70), mon('mon5','rhydon',70), mon('mon6','jolteon',70)];
await db.collection('users').doc('may').set({ trainerName:'May', specialties:[] });
await db.collection('users').doc('may').collection('saves').doc('0').set({ badgeCount:8, team:saveUm });
await db.collection('users').doc('may').collection('saves').doc('1').set({ badgeCount:8, team:saveDois });
/* O ginasio precisa de um lider forte pra ela perder -- o Gary acabou de assumir; da a ele a muralha. */
await chamar(fns.setNeighborhoodGymDefense, 'gary', Object.assign({ team: escolher(vencedor, 2, [0,1,2,3,4,5]) }, CIDADE));
await chamar(fns.setNeighborhoodGymDefense, 'gary', Object.assign({ terrainId: fns._TERRAINS[0].id }, CIDADE));

await chamar(fns.challengeNeighborhoodGym, 'may', Object.assign({ team: escolher(saveDois, 1, [0,1,2,3,4,5]) }, CIDADE));
const esperaDaMay = await chamar(fns.getNeighborhoodGymChallengeCooldowns, 'may', CIDADE);
const descansandoMay = Object.keys(esperaDaMay.mons || {});
ok('desafiou com 6 e SEIS estao descansando', descansandoMay.length === 6,
   descansandoMay.length + ': ' + descansandoMay.join(', '));
/* O Golem e a Meganium do OUTRO save dividem o id com dois que lutaram -- e nao podem estar aqui. */
const chaveDoSaveUm = (esp) => 'g_0_' + esp;
ok('e o Golem do outro save NAO esta', !descansandoMay.includes(chaveDoSaveUm('golem')),
   descansandoMay.join(', '));
ok('nem a Meganium', !descansandoMay.includes(chaveDoSaveUm('meganium')));
ok('os seis descansando sao os que lutaram de verdade',
   saveDois.every(p => descansandoMay.includes('g_1_' + p.speciesId)), descansandoMay.join(', '));
/* E o time do outro save desafia na hora: e o ponto inteiro da regra. */
const comOOutroSave = await chamar(fns.challengeNeighborhoodGym, 'may', Object.assign({ team: escolher(saveUm, 0, [0,1,2,3,4,5]) }, CIDADE));
ok('e o time do outro save desafia na hora', !!(comOOutroSave && comOOutroSave.matchups));

console.log('\n' + (casos - falhas) + '/' + casos + ' casos passaram.' + (falhas ? '  ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('\nEXPLODIU:', e); process.exit(1); });
