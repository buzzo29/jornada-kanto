/**
 * O TIME DE UM CICLO NAO PODE VAZAR PRO CHAVEAMENTO DE OUTRO.
 *
 * ⚠️ POR QUE ISSO EXISTE (25/09/2026, reportado e REPRODUZIDO nos dados de producao).
 * Um jogador disputava a Liga Pro BRONZE (pokemons de 15 a 30) e, ANTES da semifinal, inscreveu-se
 * na PRATA (35 a 50) do ciclo seguinte. O time dele foi SUBSTITUIDO no meio da competicao:
 *
 *   ciclo pro__1790308800000, o de 01:00 -- lido do Firestore:
 *     rodada 0 (quartas):  furret:17 swinub:18 doduo:27 wobbuffet:28 wartortle:25 quilava:30
 *     rodada 1 (semi):     nidoking:40 octillery:50 porygon2:44 exeggutor:41 weezing:41 venusaur:45
 *     rodada 2 (final):    o mesmo time PRATA -- e ele foi campeao
 *
 * A CAUSA e o `updateRegisteredTeamCode`: ele varria TODOS os ciclos `drawn` e reescrevia o `code`
 * de todo confronto nao resolvido em que o uid aparecesse, com o `game.registeredTeam`. E o
 * `checkLeagueRegistrationStatus` olha o ciclo `registering` PRIMEIRO -- entao, com o jogador nos
 * dois, o `registeredTeam` e o do ciclo NOVO.
 *
 * ⚠️ E O SERVIDOR JA FAZIA O CERTO: o `atualizarInscricoesComTime` (o caminho do Doce Raro) so mexe
 * em ciclo `registering`, com a razao escrita ao lado. O cliente fazia o CONTRARIO.
 *
 * ⚠️ E O ESTRAGO SE PROPAGA SOZINHO: o `advanceCyclePhases` promove o OBJETO do vencedor
 * (`nextMatch.a = match.winner`), entao o codigo trocado na semifinal chega na final de carona.
 *
 * SAO DUAS CAMADAS, e o teste cobra as duas:
 *   1. a CAUSA -- o sync so mexe no ciclo de onde o time veio (`game.registeredTeamCycle`);
 *   2. a REDE  -- e so se o code novo for o MESMO time em outra ORDEM (a reordenacao e o unico
 *      chamador do sync, e ela nao muda o conjunto).
 *
 *   node tools/test-liga-time-do-ciclo.js
 */
const { createSandbox } = require('./game-sandbox');

const S = createSandbox();
const g = S.__getGame();

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}

const TIPO = 'pro';
const UID = 'jogador1';

/* os dois times do relato: o da Bronze (o que esta no chaveamento) e o da Prata (a inscricao nova) */
const BRONZE = [
  { id:'m1', speciesId:'furret',    level:17 }, { id:'m2', speciesId:'swinub',    level:18 },
  { id:'m3', speciesId:'doduo',     level:27 }, { id:'m4', speciesId:'wobbuffet', level:28 },
  { id:'m5', speciesId:'wartortle', level:25 }, { id:'m6', speciesId:'quilava',   level:30 }];
const PRATA = [
  { id:'n1', speciesId:'nidoking',  level:40 }, { id:'n2', speciesId:'octillery', level:50 },
  { id:'n3', speciesId:'porygon2',  level:44 }, { id:'n4', speciesId:'exeggutor', level:41 },
  { id:'n5', speciesId:'weezing',   level:41 }, { id:'n6', speciesId:'venusaur',  level:45 }];

const codeBronze = S.encodeTeamCode(BRONZE);
const codePrata  = S.encodeTeamCode(PRATA);
const CICLO_EM_ANDAMENTO = 'c-bronze', CICLO_NOVO = 'c-prata';

/* ---------------------------------------------------------------- o Firestore dublado */
let doc, gravacoesNaInscricao;
function montaBanco(){
  gravacoesNaInscricao = [];
  /* o chaveamento em andamento: a rodada 0 ja resolvida, a 1 com ele esperando */
  doc = { leagues:[{ id:0, size:8, rounds:{
    '0': [{ resolved:true,  a:{ uid:UID, name:'Dioggy', code:codeBronze }, b:{ uid:'x', name:'Rdking', code:codeBronze } }],
    '1': [{ resolved:false, a:{ uid:UID, name:'Dioggy', code:codeBronze }, b:{ uid:'y', name:'Beyonda', code:codeBronze } }]
  } }] };
}
function refDoCiclo(){
  return { __ref:true };
}
S.cycleDocRef = (typeId, id) => ({ __id:id });
S.registrantDocRef = (typeId, cicloId, uid) => ({
  get: () => Promise.resolve({ exists:true, data: () => ({ uid, code:'antigo' }) }),
  set: (d) => { gravacoesNaInscricao.push({ cicloId, code:d.code }); return Promise.resolve(); }
});
S.scheduleDocRef = () => ({ get: () => Promise.resolve({ exists:true, data: () => ({ cycles:[
  { id:CICLO_EM_ANDAMENTO, status:'drawn' },
  { id:CICLO_NOVO,         status:'registering' }
] }) }) });
S.golpesDoTime = () => ({});
S.db = { runTransaction: async (fn) => {
  await fn({
    get: (ref) => Promise.resolve({ exists:true, data: () => doc }),
    set: (ref, d) => { if(ref.__id === CICLO_EM_ANDAMENTO) doc = d; }
  });
} };

function timeDoChaveamento(){
  const m = doc.leagues[0].rounds['1'][0];
  return (S.decodeTeamCode(m.a.code) || []).map(p => p.speciesId + ':' + p.level).join(' ');
}
const ESPERADO_BRONZE = BRONZE.map(p => p.speciesId + ':' + p.level).join(' ');
const ESPERADO_PRATA  = PRATA.map(p => p.speciesId + ':' + p.level).join(' ');

/* ================================================================ 1) O CASO DO RELATO */
console.log('\n=== O CASO DO RELATO: inscrever-se na PRATA nao pode trocar o time da BRONZE ===');
(async () => {
  montaBanco();
  g.authUser = { uid:UID };
  g.currentLeagueTypeId = TIPO;
  /* o estado de quem esta nos DOIS: a tela mostra o time da inscricao NOVA, porque o
     `checkLeagueRegistrationStatus` olha o ciclo `registering` primeiro */
  g.registeredTeam = PRATA.slice();
  g.registeredTeamCycle = { typeId:TIPO, id:CICLO_NOVO, status:'registering' };

  ok('o chaveamento comeca com o time BRONZE', timeDoChaveamento() === ESPERADO_BRONZE, timeDoChaveamento());

  await S.updateRegisteredTeamCode(TIPO);

  ok('e o time da BRONZE continua sendo o BRONZE depois do sync',
     timeDoChaveamento() === ESPERADO_BRONZE, timeDoChaveamento());
  ok('  (o do relato era: ' + ESPERADO_PRATA.slice(0, 46) + '...)', true);
  /* ⚠️ E A INSCRICAO NOVA CONTINUA SENDO ATUALIZADA -- o sync nao foi desligado, ele foi
     APONTADO: a reordenacao do time da PRATA tem que valer na inscricao da PRATA. */
  ok('e a INSCRICAO do ciclo novo recebe o code', gravacoesNaInscricao.length === 1
     && gravacoesNaInscricao[0].cicloId === CICLO_NOVO && gravacoesNaInscricao[0].code === codePrata,
     JSON.stringify(gravacoesNaInscricao.map(x => x.cicloId)));

  /* ================================================================ 2) A REORDENACAO CONTINUA VALENDO */
  console.log('\n=== E A REORDENACAO, que e pra isso que o sync existe, continua valendo ===');
  montaBanco();
  const reordenado = BRONZE.slice().reverse();
  g.registeredTeam = reordenado;
  g.registeredTeamCycle = { typeId:TIPO, id:CICLO_EM_ANDAMENTO, status:'drawn' };
  await S.updateRegisteredTeamCode(TIPO);
  ok('o chaveamento aceita a ORDEM nova',
     timeDoChaveamento() === reordenado.map(p => p.speciesId + ':' + p.level).join(' '), timeDoChaveamento());
  ok('  e sao os MESMOS seis pokemon',
     timeDoChaveamento().split(' ').sort().join() === ESPERADO_BRONZE.split(' ').sort().join());
  /* ⚠️ E A INSCRICAO DO CICLO NOVO NAO E TOCADA: o time reordenado e o do chaveamento, nao o dela. */
  ok('  e a inscricao do outro ciclo NAO e tocada', gravacoesNaInscricao.length === 0,
     JSON.stringify(gravacoesNaInscricao));

  /* ============================================== 2b) O CASO QUE SO A CAUSA PEGA */
  /* ⚠️ ESTE E O CASO QUE A REDE NAO DISTINGUE, e foi a conferencia de acusacao que o apontou:
     religando o defeito de producao INTEIRO (o sync varrendo todos os ciclos drawn), o teste
     passava em branco -- porque no relato o time da PRATA nao e permutacao do da BRONZE, e a rede
     ja o barrava. Ou seja a camada 1 era INOBSERVAVEL pelo caso do relato.
     ⚠️ ELE E REAL NA LIGA CLASSICA: la o time E da conta, entao quem disputa um chaveamento e se
     inscreve no ciclo seguinte se inscreve com O MESMO TIME. Reordenar a inscricao NOVA nao pode
     mexer na ordem de entrada do chaveamento que ja esta rolando -- ele foi congelado de proposito.
     E o mesmo vale pra quem esta em DOIS chaveamentos `drawn`, que e possivel desde 24/09. */
  console.log('\n=== O MESMO TIME nos dois ciclos: reordenar a INSCRICAO nao mexe no chaveamento ===');
  montaBanco();
  const outraOrdem = BRONZE.slice().reverse();
  g.registeredTeam = outraOrdem;
  g.registeredTeamCycle = { typeId:TIPO, id:CICLO_NOVO, status:'registering' };
  await S.updateRegisteredTeamCode(TIPO);
  ok('o chaveamento mantem a ORDEM que foi sorteada',
     timeDoChaveamento() === ESPERADO_BRONZE, timeDoChaveamento());
  ok('  e a INSCRICAO nova recebe a ordem nova',
     gravacoesNaInscricao.length === 1 && gravacoesNaInscricao[0].cicloId === CICLO_NOVO
     && gravacoesNaInscricao[0].code === S.encodeTeamCode(outraOrdem),
     JSON.stringify(gravacoesNaInscricao.map(x => x.cicloId)));

  /* ================================================================ 3) A REDE, sozinha */
  console.log('\n=== A REDE: mesmo APONTANDO pro ciclo certo, trocar o TIME nao passa ===');
  montaBanco();
  /* o carimbo diz o ciclo CERTO e o time e OUTRO -- e o caso que a camada 1 nao pega:
     um estado inconsistente, um caminho novo que escreva o `registeredTeam` sem carimbar. */
  g.registeredTeam = PRATA.slice();
  g.registeredTeamCycle = { typeId:TIPO, id:CICLO_EM_ANDAMENTO, status:'drawn' };
  await S.updateRegisteredTeamCode(TIPO);
  ok('o time nao troca', timeDoChaveamento() === ESPERADO_BRONZE, timeDoChaveamento());

  console.log('\n=== A REDE, unidade: o que ela aceita e o que ela recusa ===');
  const permuta = S.encodeTeamCode(BRONZE.slice().reverse());
  ok('a MESMA ordem passa',            S.mesmoTimeEmOutraOrdem(codeBronze, codeBronze));
  ok('a ordem TROCADA passa',          S.mesmoTimeEmOutraOrdem(codeBronze, permuta));
  ok('outro TIME nao passa',           !S.mesmoTimeEmOutraOrdem(codeBronze, codePrata));
  /* ⚠️ O NIVEL ENTRA NA CHAVE: o Doce Raro sobe o nivel, e subir nivel no meio de um chaveamento
     e justamente o que o servidor ja recusa ("mudar o nivel no meio de uma disputa seria pior que
     nao atualizar"). Sem o nivel na chave, o doce passaria por aqui. */
  const umNivelAMais = BRONZE.map((p,i) => i===0 ? { ...p, level:p.level+1 } : p);
  ok('e UM NIVEL a mais nao passa',    !S.mesmoTimeEmOutraOrdem(codeBronze, S.encodeTeamCode(umNivelAMais)));
  /* ⚠️ E O SHINY TAMBEM: ele vale 1,20x em todos os atributos -- trocar um normal por um shiny da
     mesma especie e do mesmo nivel e trocar de pokemon. */
  const shiny = BRONZE.map((p,i) => i===0 ? { ...p, shiny:true } : p);
  ok('e o SHINY entra na chave',       !S.mesmoTimeEmOutraOrdem(codeBronze, S.encodeTeamCode(shiny)));
  const cinco = BRONZE.slice(0,5);
  ok('e um time MENOR nao passa',      !S.mesmoTimeEmOutraOrdem(codeBronze, S.encodeTeamCode(cinco)));
  ok('e code invalido nao passa',      !S.mesmoTimeEmOutraOrdem(codeBronze, 'lixo!!!'));

  /* ================================================================ 4) SEM CARIMBO, NAO ESCREVE */
  console.log('\n=== SEM CARIMBO o sync nao escreve nada (o lado certo pra errar) ===');
  montaBanco();
  g.registeredTeam = BRONZE.slice().reverse();
  g.registeredTeamCycle = null;
  await S.updateRegisteredTeamCode(TIPO);
  ok('o chaveamento fica como estava', timeDoChaveamento() === ESPERADO_BRONZE, timeDoChaveamento());
  ok('  e a inscricao tambem nao e tocada', gravacoesNaInscricao.length === 0);

  montaBanco();
  g.registeredTeamCycle = { typeId:'classic', id:CICLO_EM_ANDAMENTO, status:'drawn' };
  await S.updateRegisteredTeamCode(TIPO);
  ok('e o carimbo de OUTRA liga tambem nao', timeDoChaveamento() === ESPERADO_BRONZE
     && gravacoesNaInscricao.length === 0, timeDoChaveamento());

  /* ================================================================ 5) O CARIMBO, lendo o codigo */
  console.log('\n=== O CARIMBO acompanha o time, nos dois pontos que o escrevem ===');
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const escrevem = [...src.matchAll(/game\.registeredTeam = decodeTeamCode\([^\n]*\n([^\n]*)/g)];
  ok('os dois pontos que escrevem um TIME carimbam o ciclo',
     escrevem.length === 2 && escrevem.every(m => /registeredTeamCycle = \{/.test(m[1])),
     escrevem.length + ' ponto(s)');
  /* ⚠️ E O CARIMBO NASCE DEFINIDO, ao lado do time: sem isso ele e `undefined` na primeira leitura
     e o sync sai sem escrever -- o que e seguro, mas esconde a intencao. */
  ok('e ele nasce no default, ao lado do registeredTeam',
     /registeredTeam:null,\s*\n\s*registeredTeamCycle:null,/.test(src));
  /* ⚠️ E O SERVIDOR CONTINUA SO MEXENDO EM `registering` -- ele e o outro caminho que repropaga
     time (o Doce Raro), e foi a comparacao com ele que apontou o erro do cliente. */
  const srvSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  const fn = srvSrc.slice(srvSrc.indexOf('async function atualizarInscricoesComTime'));
  const corpo = fn.slice(0, fn.indexOf('\n}\n'));
  ok('o servidor (o Doce Raro) so repropaga em ciclo `registering`',
     corpo.indexOf("c.status === 'registering'") > 0 && corpo.indexOf("'drawn'") < 0);

  console.log('');
  if(falhas){ console.log('  ' + falhas + ' FALHA(S)'); process.exit(1); }
  console.log('  Tudo certo.');
})().catch(e => { console.log('  ESTOUROU: ' + (e && e.stack || e)); process.exit(1); });
