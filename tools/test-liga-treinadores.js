/**
 * A TRAVA DA TRAINERS LEAGUE -- quem forma liga hoje e quem fica pra amanha.
 *
 * Por que isso existe: em 31/08/2026 o dia tinha 4 inscritos e a liga NAO ACONTECEU. A regra do
 * "minimo pra formar" (pensada pro RESTO, quando outra liga ja se formou) dissolveu o unico grupo
 * do dia. E o estrago nao parou no dia perdido: sem nenhum grupo, ninguem chama o
 * trainersLeagueLockGroupInto -- que e quem grava status 'locked' --, entao o ciclo ficou parado em
 * 'locking'. A tela anunciava "Chaveamento sorteado" sem chaveamento nenhum, o agendador re-travava
 * a cada 2 minutos (trava vencida e roubavel) e cada volta mandava outra notificacao de adiamento
 * pros mesmos 4 inscritos.
 *
 * A divisao em grupos e uma funcao PURA justamente pra caber aqui, sem relogio e sem Firestore.
 * O teste de ponta a ponta (trava de verdade contra o Firestore em memoria) so roda depois da hora
 * da trava -- ele avisa quando pula.
 *
 *   node tools/test-liga-treinadores.js
 */
const path = require('path');
const Module = require('module');
const fake = require('./fake-firestore');

const db = fake.makeDb();
const notificacoes = [];
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

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const dividir = fns._trainersLeagueSplitGroups;
const gente = n => Array.from({length:n}, (_,i)=>({ uid:'u'+i, name:'T'+i }));
function caso(n){
  const r = dividir(gente(n));
  return { ligas: r.groups.map(g=>g.length), amanha: r.leftover.length };
}

console.log('\nQUEM FORMA LIGA E QUEM FICA PRA AMANHA');
/* O caso do incidente: 4 inscritos e UM grupo so. O minimo (4) vale pro resto, nao pro dia. */
ok('4 inscritos formam a liga do dia', JSON.stringify(caso(4)) === JSON.stringify({ligas:[4], amanha:0}),
   JSON.stringify(caso(4)));
ok('2 inscritos ja sao liga', JSON.stringify(caso(2)) === JSON.stringify({ligas:[2], amanha:0}), JSON.stringify(caso(2)));
/* Um sozinho nao e liga: o round-robin sai com 0 rodadas. */
ok('1 inscrito nao forma, fica pra amanha', JSON.stringify(caso(1)) === JSON.stringify({ligas:[], amanha:1}),
   JSON.stringify(caso(1)));
ok('ninguem inscrito nao forma nada', JSON.stringify(caso(0)) === JSON.stringify({ligas:[], amanha:0}));
ok('16 inscritos: uma liga cheia', JSON.stringify(caso(16)) === JSON.stringify({ligas:[16], amanha:0}), JSON.stringify(caso(16)));
/* Aqui o minimo VOLTA a valer: uma liga ja se formou, entao o resto pequeno espera pra amanha
   em vez de virar uma liga de uma pessoa so. */
ok('17 inscritos: 16 jogam, 1 fica pra amanha', JSON.stringify(caso(17)) === JSON.stringify({ligas:[16], amanha:1}),
   JSON.stringify(caso(17)));
ok('20 inscritos: 16 jogam, 4 ficam pra amanha', JSON.stringify(caso(20)) === JSON.stringify({ligas:[16], amanha:4}),
   JSON.stringify(caso(20)));
ok('21 inscritos: 16 e 5 -- o resto passou do minimo', JSON.stringify(caso(21)) === JSON.stringify({ligas:[16,5], amanha:0}),
   JSON.stringify(caso(21)));
ok('30 inscritos: 16 e 14', JSON.stringify(caso(30)) === JSON.stringify({ligas:[16,14], amanha:0}), JSON.stringify(caso(30)));
ok('34 inscritos: duas cheias e 2 pra amanha', JSON.stringify(caso(34)) === JSON.stringify({ligas:[16,16], amanha:2}),
   JSON.stringify(caso(34)));
/* Ninguem pode ser esquecido: todo inscrito ou joga hoje ou esta na fila de amanha. */
let somaErrada = 0;
for(let n=0; n<=40; n++){
  const r = dividir(gente(n));
  if(r.groups.reduce((s,g)=>s+g.length,0) + r.leftover.length !== n) somaErrada++;
}
ok('nenhum inscrito some no caminho (0 a 40)', somaErrada === 0, somaErrada + ' contagens erradas');

/* ---- ponta a ponta: o ciclo NUNCA pode parar num estado transitorio ---- */
(async () => {
  console.log('\nO CICLO DO DIA NAO PODE FICAR PRESO EM "locking"');
  await fns.advanceTrainersLeague({});   // cria os ciclos de hoje e amanha
  const todos = await db.collection('trainersLeagueCycles').get();
  const ids = todos.docs.map(d=>d.id).sort();
  const hoje = ids[0];
  const cycleRef = db.collection('trainersLeagueCycles').doc(hoje);
  const antes = (await cycleRef.get()).data();
  console.log('  (ciclo do dia comecou em "' + antes.status + '" -- a trava so roda depois das 11h)');
  // com 1 inscrito o dia nao forma liga: o ciclo TEM que terminar num estado final, com motivo
  await cycleRef.set({ status:'registering' }, { merge:true });
  await cycleRef.collection('registrants').doc('u0').set({ uid:'u0', name:'T0', registeredAt: 1 });
  await fns.advanceTrainersLeague({});
  const depois = (await cycleRef.get()).data();
  /* 'registering' e um estado de REPOUSO legitimo (antes da hora da trava). O que nao pode
     acontecer nunca e ficar num estado TRANSITORIO, que e onde o ciclo de 31/08 ficou preso. */
  const preso = depois.status === 'locking' || depois.status === 'advancing';
  ok('o ciclo nunca fica preso num estado transitorio', !preso, 'status: ' + depois.status);
  if(depois.status === 'complete'){
    ok('e a tela tem como dizer por que nao teve liga', !!depois.noLeagueReason, 'motivo: ' + depois.noLeagueReason);
  }

  console.log('\n=== OS TIMES ELEGIVEIS: ORDEM DE SLOT E LEITURA SO DO QUE EXISTE ===');
/* Esta funcao lia UMA REFERENCIA POR SLOT, existindo ou nao: com o teto em 20, um jogador com 1
   save custava 20 leituras por travamento de liga -- e isso roda uma vez por inscrito. Passou a ler
   a colecao, que cobra por documento devolvido.
   O RISCO DA TROCA e a ORDEM. O Firestore devolve por ID de documento em ordem de TEXTO, e ai o
   slot "10" cai ENTRE o "1" e o "2". O time de cada rodada e sorteado por INDICE nesta lista, com
   semente, e o cliente refaz o mesmo sorteio pra mostrar quem vai lutar -- ordens diferentes fazem
   a tela mostrar um time e a batalha usar outro. So aparece pra quem tem mais de 10 saves, ou seja,
   exatamente depois de subir o teto. */
/* O arquivo inteiro ja roda dentro de um async: sem o await aqui, este bloco terminaria DEPOIS
   do resumo -- imprimia o titulo e nenhuma checagem, e o teste passava sem testar. */
await (async function(){
  const TIME = (esp) => [{ id:'m0', speciesId:esp, level:70, shiny:false }];
  const saves = db.collection('users').doc('ordem').collection('saves');
  /* Grava FORA de ordem de proposito -- se a funcao devolvesse na ordem de gravacao, isso passaria
     despercebido. */
  for(const slot of [12, 3, 0, 10, 1, 2]){
    await saves.doc(String(slot)).set({ badgeCount:8, team: TIME('charizard') });
  }
  const codes = await fns._trainersLeagueGatherEligibleCodes('ordem');
  ok('devolve um codigo por save elegivel', codes.length === 6, codes.length + ' codigos');
  /* A prova da ordem: cada save recebe uma especie diferente, e a lista tem que sair na ordem
     NUMERICA do slot. Com a ordem de texto do Firestore, o slot 10 e o 12 viriam depois do 1. */
  const ESPECIES = { 0:'bulbasaur', 1:'charmander', 2:'squirtle', 3:'pikachu', 10:'snorlax', 12:'gyarados' };
  for(const slot of Object.keys(ESPECIES)){
    await saves.doc(String(slot)).set({ badgeCount:8, team: TIME(ESPECIES[slot]) });
  }
  const codes2 = await fns._trainersLeagueGatherEligibleCodes('ordem');
  const ordem = codes2.map(c => (fns._decodeTeamCode ? fns._decodeTeamCode(c) : [{speciesId:c}])[0].speciesId);
  const esperada = [0,1,2,3,10,12].map(s => ESPECIES[s]);
  ok('e na ordem NUMERICA do slot, nao na de texto do Firestore',
     JSON.stringify(ordem) === JSON.stringify(esperada), ordem.join(',') + '   (esperado ' + esperada.join(',') + ')');

  /* Save sem as 8 insignias nao entra, e slot fora do teto tambem nao. */
  await saves.doc('4').set({ badgeCount:3, team: TIME('onix') });
  await saves.doc('99').set({ badgeCount:8, team: TIME('mewtwo') });
  const codes3 = await fns._trainersLeagueGatherEligibleCodes('ordem');
  ok('save sem as 8 insignias fica de fora', codes3.length === 6, codes3.length + ' codigos');
  ok('e slot acima do teto tambem', codes3.length === 6);

  /* Conta sem save nenhum: antes isso custava o teto inteiro em leituras. */
  const vazio = await fns._trainersLeagueGatherEligibleCodes('nao-existe');
  ok('conta sem save devolve lista vazia', Array.isArray(vazio) && vazio.length === 0);
})();

console.log('\n=== A PODA LEVA AS SUBCOLECOES JUNTO ===');
/* ⚠️ APAGAR UM DOCUMENTO NO FIRESTORE NAO APAGA AS SUBCOLECOES DELE -- elas ficam, invisiveis no
   console (o pai vira "missing"), ocupando espaco pra sempre. A poda da Liga Classica apagava so o
   documento do ciclo, e em 13/09/2026 a producao tinha 687 ciclos orfaos com ~3.200 documentos de
   inscritos parados dentro, acumulados desde 13/08.
   O custo de LEITURA disso e zero (nada varre o leagueCycles: todo acesso e por id) e o de
   armazenamento eram alguns MB -- mas cresce pra sempre, e e o tipo de coisa que so vira problema
   quando ja e grande demais pra limpar sem susto. */
await (async function(){
  const ciclo = db.collection('leagueCycles').doc('classic__teste');
  await ciclo.set({ status:'complete' });
  /* 700 inscritos pra o laco de lotes ter que dar mais de uma volta (o batch vai de 300) */
  for(let i = 0; i < 700; i++) await ciclo.collection('registrants').doc('r' + i).set({ uid:'u' + i });
  await ciclo.collection('matchLogs').doc('L0_R0_M0').set({ matchups: [] });
  await ciclo.collection('terrainPicks').doc('u1').set({ picks: {} });

  const antes = (await ciclo.collection('registrants').get()).docs.length;
  ok('o cenario tem inscritos de sobra', antes === 700, antes + ' inscritos');

  const apagados = await fns._apagarSubcolecoes(ciclo, fns._SUBCOLECOES_DO_CICLO);
  ok('a limpeza apaga TODAS as subcolecoes, em lotes', apagados === 702, apagados + ' documentos');
  ok('e nao sobra nada dentro',
     (await ciclo.collection('registrants').get()).docs.length === 0 &&
     (await ciclo.collection('matchLogs').get()).docs.length === 0 &&
     (await ciclo.collection('terrainPicks').get()).docs.length === 0);
  /* ela nao encosta no documento do ciclo -- quem apaga e quem chamou */
  ok('o documento do ciclo continua de pe', (await ciclo.get()).exists);

  /* ⚠️ E A PODA TEM QUE CHAMAR A LIMPEZA ANTES DO DELETE. O caso acima chama a funcao na mao e
     passaria com a chamada orfa -- e uma chamada DEPOIS do delete nao limparia nada (o pai ja
     nao existe pra alcancar as subcolecoes por referencia). Por isso o teste le o codigo. */
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  const bloco = (src.match(/const toRemoveIds = new Set[\s\S]{0,700}/) || [''])[0];
  const iLimpa = bloco.indexOf('apagarSubcolecoes');
  const iDelete = bloco.indexOf('.delete()');
  ok('a poda limpa as subcolecoes ANTES de apagar o ciclo',
     iLimpa > 0 && iDelete > iLimpa, 'limpeza em ' + iLimpa + ', delete em ' + iDelete);
  /* a lista das subcolecoes vive numa constante: o dia em que nascer uma terceira, ela entra la e
     os dois caminhos de poda ja limpam junto */
  ok('e a lista de subcolecoes e uma so', Array.isArray(fns._SUBCOLECOES_DO_CICLO) &&
     fns._SUBCOLECOES_DO_CICLO.indexOf('registrants') >= 0 && fns._SUBCOLECOES_DO_CICLO.indexOf('matchLogs') >= 0,
     (fns._SUBCOLECOES_DO_CICLO || []).join(', '));
})();

console.log('\n=== A RODADA GRAVA O LOG, E SO ENTAO NOTIFICA ===');
/* O INCIDENTE DE 13/09/2026: um treinador recebeu 285 notificacoes iguais de "Voce perdeu na
   Trainers League", uma por minuto, e o outro 91. A liga de 11, 12 e 13/09 nunca terminou.

   Eram TRES defeitos em fila, e nenhum teste via nenhum deles:
   1. a Danca da Chuva gravava `chuva: comChuva || undefined` em cada confronto do log. O Firestore
      RECUSA undefined -- e recusa a gravacao INTEIRA, nao o campo. O fake-firestore clonava com
      JSON.parse(JSON.stringify()), que descarta undefined em silencio, entao a bateria ficava verde;
   2. a notificacao era criada ANTES do `ref.set`. Falhando a gravacao, o catch devolve o ciclo pra
      'locked' e o agendador (de minuto em minuto) refaz tudo -- inclusive as notificacoes;
   3. e a condicao `if(match.matchups && ...)` era lida DEPOIS do storeMatchLogAndStrip, que zera o
      campo quando consegue gravar: no caminho que da certo, a notificacao nao saia nunca.
   Os tres sao cobrados aqui, e o 1 tambem la dentro do fake (que agora recusa undefined). */
await (async function(){
  const TIME = (esp) => [{ id:'m0', speciesId:esp, level:70, shiny:false },
                         { id:'m1', speciesId:'gyarados', level:68, shiny:false }];
  for(const [uid, esp] of [['aa','venusaur'], ['bb','charizard']]){
    await db.collection('users').doc(uid).collection('saves').doc('0')
      .set({ badgeCount:8, team: TIME(esp) });
  }
  const codesA = await fns._trainersLeagueGatherEligibleCodes('aa');
  const codesB = await fns._trainersLeagueGatherEligibleCodes('bb');

  const HOJE = fns._trainersLeagueTodayDateStr();
  const ref = () => db.collection('trainersLeagueCycles').doc(HOJE);
  const montar = async () => {
    await ref().set({
      dateId: HOJE, status:'locked', currentRound: 0,
      players: [{ uid:'aa', name:'A', elite:false, eligibleCodes:codesA, specialties:[], mewtwoTeamCode:null },
                { uid:'bb', name:'B', elite:false, eligibleCodes:codesB, specialties:[], mewtwoTeamCode:null }],
      scheduleRounds: [{ matches: [{ a:{ uid:'aa', name:'A', code:codesA[0], specialties:[] },
                                      b:{ uid:'bb', name:'B', code:codesB[0], specialties:[] },
                                      winner:null, matchups:null, resolved:false, terrain:null }] }],
      roundTimes: [Date.now() - 60000], siblingCycleIds: [],
      lockedAt: Date.now(), updatedAt: Date.now()
    }, { merge:false });
  };
  const avisos = async (uid) => (await db.collection('users').doc(uid).collection('notifications').get())
    .docs.map(d=>d.data()).filter(n=>n.type === 'match_played');
  const limparAvisos = async (uid) => {
    const snap = await db.collection('users').doc(uid).collection('notifications').get();
    for(const d of snap.docs) await db.collection('users').doc(uid).collection('notifications').doc(d.id).delete();
  };

  /* ---- 1) o caminho que DA CERTO: log gravado e UMA notificacao de cada lado ---- */
  await montar();
  await limparAvisos('aa'); await limparAvisos('bb');
  await fns.advanceTrainersLeague({});
  const dep = (await ref().get()).data();
  ok('a partida fica resolvida', dep.scheduleRounds[0].matches[0].resolved === true);
  ok('e o ciclo fecha o dia', dep.status === 'complete', 'status: ' + dep.status);
  const logs = await ref().collection('matchLogs').get();
  ok('o log da batalha foi gravado', logs.docs.length === 1, logs.docs.length + ' log(s)');
  if(logs.docs.length){
    const m = (logs.docs[0].data().matchups) || [];
    ok('e ele tem os confrontos dentro', m.length > 0, m.length + ' confrontos');
  }
  /* ⚠️ ESTE E O DEFEITO 3: com a condicao lida depois do strip, isto dava ZERO dos dois lados. */
  ok('o vencedor e avisado UMA vez', (await avisos('aa')).length === 1, (await avisos('aa')).length + ' aviso(s)');
  ok('o perdedor tambem', (await avisos('bb')).length === 1, (await avisos('bb')).length + ' aviso(s)');

  /* ---- 2) o caminho que FALHA: ninguem pode ser avisado de um resultado que nao foi salvo ---- */
  let recusarEscrita = false;
  const collOriginal = db.collection.bind(db);
  db.collection = (nome) => {
    const c = collOriginal(nome);
    if(nome !== 'trainersLeagueCycles') return c;
    const docOriginal = c.doc.bind(c);
    c.doc = (id) => {
      const d = docOriginal(id);
      const setOriginal = d.set.bind(d);
      d.set = async (patch, opts) => {
        if(recusarEscrita) throw new Error('gravacao recusada de proposito (simula o undefined)');
        return setOriginal(patch, opts);
      };
      return d;
    };
    return c;
  };
  await montar();
  await limparAvisos('aa'); await limparAvisos('bb');
  recusarEscrita = true;
  await fns.advanceTrainersLeague({});
  await fns.advanceTrainersLeague({});
  await fns.advanceTrainersLeague({});   // tres passadas do agendador, como os tres minutos do incidente
  recusarEscrita = false;
  const spamA = (await avisos('aa')).length, spamB = (await avisos('bb')).length;
  ok('gravacao que falha NAO notifica ninguem', spamA === 0 && spamB === 0, spamA + ' e ' + spamB + ' aviso(s)');
  db.collection = collOriginal;

  /* ---- 3) e a trava que teria pegado a causa: um log de batalha DE VERDADE no banco ---- */
  const res = fns._simulateGymBattle(fns._decodeTeamCode(codesA[0]), fns._decodeTeamCode(codesB[0]),
                                     fns._makeSeededRng('undef'));
  let recusou = null;
  try{ await db.collection('provaDeLog').doc('1').set({ matchups: res.matchups, updatedAt: 1 }); }
  catch(e){ recusou = e.message; }
  ok('o log de uma batalha real cabe no Firestore (sem undefined)', recusou === null, recusou || '');
  /* e o fake precisa MESMO recusar, senao a linha acima nao prova nada */
  let pegou = false;
  try{ await db.collection('provaDeLog').doc('2').set({ a:[{ b: undefined }] }); } catch(e){ pegou = true; }
  ok('e o fake recusa undefined, como o Firestore de verdade', pegou);
})();

console.log('\n=== OS GOLPES ESCOLHIDOS CHEGAM NA LIGA E NO ONLINE (16/09/2026) ===');
{
  /* Reportado assim: *"o sanguessuga e outros ataques de absorver nao estao curando nas batalhas
     das ligas onlines"*. Era verdade, e a causa era UMA: o time da liga vem de um CODIGO
     (`especie:nivel:shiny`), que nao carrega golpe -- entao `melhorAtaque` devolvia null, o motor
     caia no de tipo, e TRES mecanicas simplesmente nao existiam la: a drenagem no golpe, o golpe de
     varios tapas e a escala do Rolamento. */
  const G = fns._golpesEspeciais;
  const NIVEL = 50;
  const code = ids => Buffer.from(ids.map(id => id + ':' + NIVEL).join(','), 'utf8').toString('base64');
  const mapa = ids => { const m = {}; for(const id of ids){
    const l = G.ataquesDisponiveis(id, NIVEL).slice(0, 3); if(l.length) m[id + ':' + NIVEL] = l; } return m; };

  /* ===== A CHAVE E ESPECIE:NIVEL, NAO A POSICAO ===== */
  /* ⚠️ Por posicao isto quebraria na Trainers League, que REORDENA o time (o override de rodada) e
     ACRESCENTA o codigo do Mewtwo ao sorteio. Nos dois casos o indice desanda e cada pokemon luta
     com o moveset de outro -- e isso nao aparece como erro, aparece como um Snorlax batendo de
     Raio Solar. */
  {
    const time = fns._decodeTeamCode(code(['blastoise','machamp','gengar']));
    /* o mapa vem na ordem TROCADA de proposito: por posicao, cada um pegaria o golpe do vizinho */
    fns._carimbaDoMatch(time, { ataques: mapa(['gengar','machamp','blastoise']) });
    const doBlastoise = (time.find(p => p.speciesId === 'blastoise').ataques || []);
    ok('o golpe vai pro pokemon certo mesmo fora de ordem',
       doBlastoise.every(id => G.ataquesDisponiveis('blastoise', NIVEL).indexOf(id) >= 0),
       doBlastoise.join(','));
    ok('e nenhum leva golpe que a especie nao aprende',
       time.every(p => (p.ataques||[]).every(id => G.ataquesDisponiveis(p.speciesId, NIVEL).indexOf(id) >= 0)));
  }
  /* ⚠️ O NIVEL ENTRA NA CHAVE porque o Doce Raro sobe nivel, e nivel novo pode ter destravado golpe
     novo. Sem ele, um time repropagado casaria com os golpes de antes. */
  {
    const time = fns._decodeTeamCode(code(['blastoise']));
    fns._carimbaDoMatch(time, { ataques: { 'blastoise:60': ['hydropump'] } });   // nivel que nao e o dele
    ok('chave de outro nivel nao cola', !time[0].ataques, (time[0].ataques||[]).join(','));
  }

  /* ===== O SERVIDOR NAO CONFIA NO CLIENTE ===== */
  /* O codigo de time e dado de cliente, e os golpes viajam ao lado dele -- sem validacao, uma linha
     no console poria Hiper Raio em tudo. O que sobra de um time forjado e o motor de tipo, ou seja
     exatamente o que a liga fazia antes desta mudanca: errar pro lado de TIRAR e o certo aqui. */
  {
    const forjado = ['hyperbeam','solarbeam','earthquake','naoexiste','thunder'];
    ok('um Caterpie Lv.5 nao recebe nada disso',
       fns._golpesValidos('caterpie', 5, forjado).length === 0,
       fns._golpesValidos('caterpie', 5, forjado).join(','));
    ok('golpe que nao existe na tabela e descartado',
       fns._golpesValidos('snorlax', 70, ['naoexiste','xyz']).length === 0);
    ok('e o que a especie REALMENTE aprende passa',
       fns._golpesValidos('snorlax', 70, ['hyperbeam']).join(',') === 'hyperbeam');
    /* o teto tambem e conferido aqui: mandar seis golpes nao da seis */
    const seis = G.ataquesDisponiveis('snorlax', 70).slice(0, 6);
    ok('mandar seis golpes nao da mais que ' + 3,
       fns._golpesValidos('snorlax', 70, seis).length <= 3,
       String(fns._golpesValidos('snorlax', 70, seis).length));
    /* ⚠️ O GOLPE DE HM passa pela LISTA DA ESPECIE, e nao pelo aprendizado por nivel -- HM ninguem
       aprende por nivel, entao sem isso o Surf de um Blastoise sumiria na liga. */
    ok('o Surf passa em quem surfa', fns._golpesValidos('blastoise', 70, ['surf']).join(',') === 'surf');
    ok('e NAO passa em quem nao surfa', fns._golpesValidos('machamp', 70, ['surf']).length === 0);
    ok('o Corte passa em quem corta e nao em quem nao corta',
       fns._golpesValidos('scyther', 70, ['cut']).join(',') === 'cut' &&
       fns._golpesValidos('blastoise', 70, ['cut']).length === 0);
    /* lixo nao derruba nada */
    ok('lista vazia, nula ou lixo nao quebra',
       fns._golpesValidos('snorlax', 70, null).length === 0 &&
       fns._golpesValidos('snorlax', 70, [null, 5, {}]).length === 0);
  }
  /* ⚠️ AS DUAS LISTAS DE HM SAO DUPLICADAS DO CLIENTE, e elas tem que bater: divergindo, o Surf de
     um Blastoise passa num motor e some no outro -- a mesma partida daria resultado diferente
     conforme quem a resolvesse. */
  {
    const cli = require('./game-sandbox').createSandbox(path.join(__dirname, '..', 'index.html'));
    ok('CORTADORES igual nos dois motores',
       fns._CORTADORES.slice().sort().join(',') === cli.CORTADORES.slice().sort().join(','),
       fns._CORTADORES.length + ' vs ' + cli.CORTADORES.length);
    ok('SURFISTAS igual nos dois motores',
       fns._SURFISTAS.slice().sort().join(',') === cli.SURFISTAS.slice().sort().join(','),
       fns._SURFISTAS.length + ' vs ' + cli.SURFISTAS.length);
    ok('VOADORES igual nos dois motores',
       fns._VOADORES.slice().sort().join(',') === cli.VOADORES.slice().sort().join(','),
       fns._VOADORES.length + ' vs ' + cli.VOADORES.length);
    /* ⚠️ E A TABELA TEM QUE COBRIR TODO HM DO JOGO: sem a entrada, o golpe do HM some na liga EM
       SILENCIO -- foi exatamente o que aconteceu com o `fly` quando ele nasceu, e so apareceu
       porque eu fui conferir. O proximo HM nasce coberto por esta trava. */
    {
      /* ⚠️ ELA PERGUNTA PELO COMPORTAMENTO, e nao lendo a tabela como texto -- a versao anterior
         casava /const APRENDEM_HM = \{...\}/ e quebrou sozinha no dia em que a tabela virou um
         Object.assign pra receber os TMs. O que importa nao e a FORMA dela: e o golpe sobreviver
         ao golpesValidos, que e o que decide se ele existe na liga e no online.
         ⚠️ E OS 23 TMs ENTRAM NA MESMA TRAVA: eles tem exatamente o mesmo problema dos HMs --
         ninguem os aprende por NIVEL, entao sem entrada la o golpe some da liga EM SILENCIO. */
      const maquinas = Object.entries(cli.HMS).map(([id, h]) => [id, h])
        .concat(Object.entries(cli.TMS));
      const furados = [];
      maquinas.forEach(([id, m]) => {
        const esp = (m.aprendem || [])[0];
        if(!esp){ furados.push(id + ' (lista vazia)'); return; }
        const sobreviveu = fns._golpesValidos(esp, 70, [m.golpe]) || [];
        if(sobreviveu.indexOf(m.golpe) < 0) furados.push(id + ':' + m.golpe);
      });
      ok('  e todo HM e TM do jogo sobrevive ao golpesValidos do servidor',
         furados.length === 0, furados.length ? 'some na liga: ' + furados.join(', ') : maquinas.length + ' maquinas');
      /* e o contrario continua valendo: quem NAO aprende nao passa, mesmo forjando */
      ok('  e quem NAO aprende continua sem o golpe',
         (fns._golpesValidos('caterpie', 70, ['earthquake', 'cut']) || []).length === 0);
    }
    /* e a CHAVE tem que ser a mesma nos dois: divergindo, o golpe e procurado numa chave que nao
       existe e o time inteiro cai no motor de tipo, EM SILENCIO */
    const txtCli = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const txtSrv = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const forma = t => (t.match(/function chaveDosGolpes\(p\)\{[^}]*\}/) || [''])[0];
    ok('e a chave dos golpes e a MESMA funcao nos dois', forma(txtCli) === forma(txtSrv) && !!forma(txtCli),
       forma(txtSrv));
  }

  /* ===== O CAMINHO REAL DA LIGA ===== */
  /* A prova que importa: a MESMA partida, com e sem o mapa de golpes ao lado do codigo. */
  {
    /* o elenco tem dono de DRENAGEM (a linha do Oddish, o Gastly) e de MULTI-TAPA de proposito:
       sem eles a trava mediria o que nao esta la.
       ⚠️ OS DONOS DE MULTI-TAPA TROCARAM EM 24/09/2026, quando a forma evoluida passou a HERDAR o
       aprendizado da linha: os antigos (Jigglypuff, Wigglytuff, Doduo, Dodrio, Rhyhorn, Rhydon)
       ganharam golpes MUITO mais fortes e o `ataquesPadrao` -- que pega os 3 de maior poder --
       parou de escolher o tapa deles. A Wigglytuff e o caso extremo: 15 -> 120. A trava caiu com o
       codigo certo (`0 -> 0`), e o conserto e o elenco, nao a regra: estes oito AINDA levam um
       multi-tapa no Lv.50 (medido). E a mesma licao do dono do Missil Agulha, que ja trocou do
       Beedrill pro Qwilfish quando o Beedrill ganhou a Agulha Dupla. */
    const ELENCO = ['oddish','gloom','vileplume','zubat','golbat','crobat','paras','parasect',
                    'bellsprout','weepinbell','victreebel','gastly','haunter','gengar','venonat',
                    'golduck','marowak','lickitung','chansey','dragonair','ariados','corsola'];
    const sorteia = (i,n) => { const o=[]; const b=(i*7)%ELENCO.length;
      for(let k=0;k<n;k++) o.push(ELENCO[(b+k*5)%ELENCO.length]); return o; };
    const terreno = fns._TERRAINS[0];
    const conta = comGolpes => {
      const c = { conf:0, comMove:0, dreno:0, tapas:0 };
      for(let i=0;i<220;i++){
        const A = sorteia(i,3), B = sorteia(i+3,3);
        const match = { a:{ code:code(A), ataques: comGolpes?mapa(A):null },
                        b:{ code:code(B), ataques: comGolpes?mapa(B):null },
                        terrain:{ id:terreno.id, name:terreno.name, types:terreno.types },
                        winner:null, matchups:null, resolved:false };
        fns._resolveLeagueMatch(match, 'trava|'+i, null);
        for(const m of match.matchups||[]){ c.conf++;
          if(m.playerMoveId || m.enemyMoveId) c.comMove++;
          for(const g of m.golpes||[]){ if(g.x==='dreno') c.dreno++; if(!g.x && g.t>1) c.tapas++; } }
      }
      return c;
    };
    const antes = conta(false), depois = conta(true);
    /* ⚠️ "ANTES" NAO E ZERO, e isso e o METRONOMO: ele sorteia entre TODOS os golpes de dano do
       jogo, entao ele e a unica porta por onde um drenante ou um multi-tapa entrava numa liga sem
       golpe escolhido. E por isso que a trava compara PROPORCAO e nao "zero contra alguma coisa". */
    ok('sem o mapa, quase nenhum confronto tem golpe escolhido',
       antes.comMove < antes.conf * 0.15, antes.comMove + ' de ' + antes.conf);
    ok('com o mapa, quase todos tem', depois.comMove > depois.conf * 0.9,
       depois.comMove + ' de ' + depois.conf);
    /* ⚠️ A ASSERCAO E ABSOLUTA, e nao uma razao: 'antes' costuma ser ZERO (so o Metronomo abre
       essa porta), e razao contra zero nao mede nada -- foi assim que esta trava nasceu falhando. */
    ok('a CURA por drenagem passa a acontecer', antes.dreno < 10 && depois.dreno >= 40,
       antes.dreno + ' -> ' + depois.dreno);
    ok('e o golpe de varios tapas tambem', antes.tapas < 10 && depois.tapas >= 40,
       antes.tapas + ' -> ' + depois.tapas);
  }

  /* ===== O ONLINE ===== */
  /* Ele nao passa pelo resolveLeagueMatch: resolve confronto a confronto, e o pokemon RENASCE a
     cada um (battleHydrate). Sem a linha de la, ele lutaria no motor de tipo pra sempre. */
  {
    const guardados = fns._battleInstances(code(['blastoise','gengar']), mapa(['blastoise','gengar']));
    ok('o battleInstances guarda os golpes JA validados',
       Array.isArray(guardados[0].ataques) && guardados[0].ataques.length > 0,
       (guardados[0].ataques||[]).join(','));
    ok('e valida na entrada: golpe forjado nao entra no estado',
       (fns._battleInstances(code(['caterpie']), { 'caterpie:50': ['hyperbeam'] })[0].ataques) === null);
    const vivo = fns._battleHydrate(guardados[0]);
    ok('e o battleHydrate devolve os golpes na instancia',
       (vivo.ataques||[]).join(',') === guardados[0].ataques.join(','), (vivo.ataques||[]).join(','));
    const semGolpe = fns._battleInstances(code(['blastoise']), null);
    ok('sem golpe mandado, o online continua no motor de tipo (como era)',
       semGolpe[0].ataques === null && !fns._battleHydrate(semGolpe[0]).ataques);
  }

  /* ===== O QUE NAO PODE TER MUDADO ===== */
  /* ⚠️ Time SEM golpe tem que sair IDENTICO ao que saia antes -- e isso nao e compatibilidade, e o
     que garante que inscricao velha (que nao tem o campo) e codigo de time continuem lutando
     exatamente como lutavam. */
  {
    const time = fns._decodeTeamCode(code(['blastoise','machamp']));
    fns._carimbaDoMatch(time, { ataques: null });
    ok('sem o campo, ninguem ganha golpe', time.every(p => !p.ataques));
    fns._carimbaDoMatch(time, {});
    ok('e um lado sem nada tambem nao', time.every(p => !p.ataques));
  }
  /* ⚠️ E OS SLOTS CONTINUAM SENDO POR POSICAO: eles dizem de que SAVE veio o pokemon, e dois saves
     podem ter a mesma especie no mesmo nivel -- por especie:nivel eles colidiriam. */
  {
    const time = fns._decodeTeamCode(code(['blastoise','machamp','gengar']));
    fns._carimbaDoMatch(time, { slots: ['3', '7', null] });
    ok('o slot continua sendo por POSICAO',
       time[0].slotDaConta === '3' && time[1].slotDaConta === '7' && !time[2].slotDaConta,
       time.map(p => p.slotDaConta).join(','));
  }
  /* ⚠️ E O CARIMBO E UM SO: ele estava COPIADO no resolveLeagueMatch e no resolveTrainersLeagueMatch,
     palavra por palavra, e os golpes seriam a terceira e a quarta copia. */
  {
    const txt = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    ok('o carimbaSlots copiado nao existe mais', txt.indexOf('const carimbaSlots') < 0);
    ok('e os dois resolvedores chamam a MESMA funcao',
       (txt.match(/carimbaDoMatch\(teamA, match\.a\); carimbaDoMatch\(teamB, match\.b\);/g) || []).length === 2,
       String((txt.match(/carimbaDoMatch\(teamA/g) || []).length));
    const cli = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    ok('e as DUAS copias do cliente tambem carimbam',
       (cli.match(/carimbaDoMatch\(teamA, match\.a\); carimbaDoMatch\(teamB, match\.b\);/g) || []).length === 2);
  }
  /* ⚠️ O BOT DA LIGA GANHOU MOVESET: ate hoje "todo mundo sem golpe" era igual pra todos; a partir
     desta mudanca, um bot sem golpe seria o unico time em desvantagem. Ele nao ESCOLHE -- leva o
     que a especie aprende por nivel, a regra de todo NPC do jogo. */
  {
    const txt = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const bloco = (txt.match(/function createBotRegistrant\([\s\S]*?\n\}/) || [''])[0];
    ok('o bot da liga entra com o moveset da especie',
       /ataquesDisponiveis\(/.test(bloco) && /ataques,/.test(bloco), bloco.length + ' chars');
  }
}

  /* ============================================================================
     ⚠️ O CONTADOR DE INSCRITOS DA LIGA CLÁSSICA (20/09/2026)
     ============================================================================
     Reportado assim: *"entrei para ver a liga clássica e estava com 4 treinadores inscritos, após
     eu me inscrever, o numero caiu para 1"*. Lido dos dados de produção: o documento do ciclo
     tinha `registrantCount: 1` e a coleção `registrants` tinha **5 documentos** -- ninguém foi
     apagado, só o número estava errado. O `createTime` do documento entregou a causa: ele nasceu
     no instante da 5ª inscrição, e `increment` sobre campo que NÃO EXISTE começa do zero.

     Os quatro primeiros estavam em ABAS ABERTAS de antes do deploy -- e é essa a lição: um
     contador mantido só pelo CLIENTE nunca é confiável, porque sempre existe cliente velho em
     cache. Hoje quem manda nele é o servidor, de minuto em minuto.
     ============================================================================ */
  {
    const typeId = fns._CLASSIC_LEAGUE_TYPE || 'classic';
    const cicloId = '9999000000';
    const cycleRef = db.collection('leagueCycles').doc(typeId + '__' + cicloId);
    const insc = cycleRef.collection('registrants');
    /* o cenário do relato: QUATRO inscritos e NENHUM contador (o documento do ciclo nem existe) */
    for(const nome of ['ana', 'bruno', 'caio', 'duda']) await insc.doc(nome).set({ name: nome });
    let snap = await cycleRef.get();
    ok('o cenário do relato: 4 inscritos e o documento do ciclo sem contador',
       !snap.exists || typeof (snap.data() || {}).registrantCount !== 'number');

    /* é isto que a inscrição do cliente faz -- e é o defeito: increment sobre campo inexistente */
    await cycleRef.set({ registrantCount: fake.FieldValue.increment(1) }, { merge: true });
    await insc.doc('fausto').set({ name: 'fausto' });
    snap = await cycleRef.get();
    ok('  o increment sobre campo que não existe grava 1 (a causa, reproduzida)',
       snap.data().registrantCount === 1, 'registrantCount=' + snap.data().registrantCount);
    const real = (await insc.get()).size;
    ok('  enquanto a coleção tem 5 -- ninguém foi apagado', real === 5, real + ' inscritos');

    /* ⚠️ O CRON RECONCILIA, e é ele o dono do número */
    const mudou = await fns._reconciliarContadorDeInscritos(typeId, { id: cicloId });
    snap = await cycleRef.get();
    ok('o cron ajusta o contador pro número de verdade', snap.data().registrantCount === 5,
       'registrantCount=' + snap.data().registrantCount);
    ok('  e ele avisa que mexeu', mudou === true);

    /* ⚠️ E NÃO ESCREVE À TOA: ler antes de escrever é o que evita 1.440 escritas por dia num
       documento que quase nunca muda -- escrita custa 3× mais que leitura no Firestore. */
    const antes = (await cycleRef.get()).updateTime;
    const denovo = await fns._reconciliarContadorDeInscritos(typeId, { id: cicloId });
    ok('  e não escreve de novo quando já está certo', denovo === false);

    /* o desvio pro outro lado (um cancelamento de cliente velho, que não decrementa) */
    await insc.doc('ana').delete();
    await fns._reconciliarContadorDeInscritos(typeId, { id: cicloId });
    snap = await cycleRef.get();
    ok('  e conserta o desvio pra baixo também', snap.data().registrantCount === 4,
       'registrantCount=' + snap.data().registrantCount);

    /* ⚠️ ELE CONTA PELO SERVIDOR, não varrendo: com 100 inscritos a varredura custaria 100
       leituras por minuto. A trava LÊ O CÓDIGO porque o fake não cobra leitura. */
    const fonte = require('fs').readFileSync('functions/index.js', 'utf8');
    const f = fonte.slice(fonte.indexOf('async function reconciliarContadorDeInscritos'),
                          fonte.indexOf('async function advanceLeagueOnceForType'));
    ok('  (a fatia da função tem o que ler)', f.length > 200 && f.length < 2000, f.length + ' chars');
    ok('  e ele usa a agregação count() do servidor', /\.count\(\)\.get\(\)/.test(f));
    ok('  sem varrer a coleção', !/registrantsCollRef\([^)]*\)\.get\(\)/.test(f));

    /* ⚠️ E O CRON O CHAMA -- os casos acima chamam a função na mão e passariam com a chamada órfã */
    const doCron = fonte.slice(fonte.indexOf('async function advanceLeagueOnceForType'),
                               fonte.indexOf('exports.advanceLeague'));
    ok('  (a fatia do cron tem o que ler)', doCron.length > 500, doCron.length + ' chars');
    ok('o cron chama a reconciliação no ciclo ABERTO',
     /else if\(entry\.status===.registering.\)\{[\s\S]{0,600}?reconciliarContadorDeInscritos/.test(doCron));

    await insc.doc('bruno').delete(); await insc.doc('caio').delete();
    await insc.doc('duda').delete(); await insc.doc('fausto').delete();
  }

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
  process.exit(falhas ? 1 : 0);
})();
