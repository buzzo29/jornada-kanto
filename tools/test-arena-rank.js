/**
 * O RANKING DA ARENA DA SEMANA, no SERVIDOR (24/09/2026).
 *
 * O que ele existe pra pegar:
 *   1. quem SOMA é o servidor: o cliente manda um BOOLEANO, e mandar `nivel` não muda nada;
 *   2. o nível SÓ SOBE -- perder não desce e nem cria documento;
 *   3. o TETO recusa o absurdo (medido: o melhor caso possível morre por volta do nível 40);
 *   4. cada SEMANA é uma subcoleção própria, então não há reset -- o nível da semana passada
 *      simplesmente não está na de hoje;
 *   5. o top 10 ordena por nível, e o MEU nível volta sempre (é ele que decide o adversário);
 *   6. as regras fecham a escrita pra todos, inclusive o dono.
 *
 *   node tools/test-arena-rank.js
 */
const path = require('path');
const Module = require('module');
const fs = require('fs');
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
const mod = require(path.join(__dirname, '..', 'functions', 'index.js'));
Module._load = loadOriginal;
const raiz = path.join(__dirname, '..');

let falhas = 0;
function ok(titulo, cond, extra){
  if(cond){ console.log('  OK     ' + titulo + (extra ? '   ' + extra : '')); }
  else { falhas++; console.log('  FALHOU ' + titulo + (extra ? '   ' + extra : '')); }
}

(async () => {
  /* ⚠️ O `auth` VEM SEMPRE, e o uid e o parametro: e ele que decide QUAL documento a
     callable escreve, e sem ele a suite mediria sempre o mesmo jogador. */
  const chamar = (nome, data, uid) => mod[nome]({ data: data || {}, auth: { uid: uid || 'u1' } });

  /* ---------- 1) quem soma e o servidor ---------- */
  console.log('\n=== QUEM SOMA É O SERVIDOR ===');
  await db.collection('users').doc('u1').set({ trainerName: 'Buzzo' });
  let r = await chamar('submitArenaWin', { venceu: true });
  ok('a primeira vitória leva ao nível 2', r.nivel === 2 && r.subiu === true, 'nível ' + r.nivel);
  r = await chamar('submitArenaWin', { venceu: true });
  ok('  e a segunda ao 3', r.nivel === 3, 'nível ' + r.nivel);
  /* ⚠️ O `nivel` DO CLIENTE É IGNORADO: aceitá-lo seria deixá-lo escrever o próprio lugar no
     ranking por outro caminho. */
  r = await chamar('submitArenaWin', { venceu: true, nivel: 99, subiu: true, pontos: 9e9 });
  ok('  e o `nivel` que vem do cliente é IGNORADO', r.nivel === 4, 'nível ' + r.nivel);
  /* ⚠️ `venceu` LIDO COMO BOOLEANO ESTRITO: um `'sim'` seria truthy. */
  for(const v of ['sim', 1, 'true', {}, [], 'x']){
    r = await chamar('submitArenaWin', { venceu: v });
    if(r.nivel !== 4){ ok('  e `venceu: ' + JSON.stringify(v) + '` não sobe', false, 'nível ' + r.nivel); }
  }
  ok('  e só o booleano `true` sobe (os 6 truthy não sobem)', r.nivel === 4, 'nível ' + r.nivel);

  /* ---------- 2) perder ---------- */
  console.log('\n=== PERDER NÃO DESCE NEM CRIA ===');
  r = await chamar('submitArenaWin', { venceu: false });
  ok('perder não desce o nível', r.nivel === 4, 'nível ' + r.nivel);
  ok('  e não diz que subiu', r.subiu === false);
  /* ⚠️ E NÃO CRIA DOCUMENTO: um jogador que só perdeu seria uma linha de "nível 1" no ranking. */
  await db.collection('users').doc('u9').set({ trainerName: 'Só perde' });
  r = await chamar('submitArenaWin', { venceu: false }, 'u9');
  ok('  e quem só perdeu não entra no ranking', r.nivel === 1);
  const rk = await chamar('getArenaRanking', {});
  ok('  (conferido: ele não aparece na lista)',
     rk.lista.every(x => x.uid !== 'u9'), rk.lista.map(x => x.uid).join(',') || '(vazia)');

  /* ---------- 3) o teto ---------- */
  console.log('\n=== O TETO ===');
  const TETO = mod._arena ? mod._arena.NIVEL_MAX : null;
  ok('o teto existe e é folgado', TETO >= 50, String(TETO));
  await db.collection('users').doc('u2').set({ trainerName: 'Teimoso' });
  for(let k = 0; k < TETO + 5; k++) await chamar('submitArenaWin', { venceu: true }, 'u2');
  r = await chamar('submitArenaWin', { venceu: true }, 'u2');
  ok('  e ele para o absurdo', r.nivel === TETO && r.subiu === false, 'nível ' + r.nivel);

  /* ---------- 4) o ranking ---------- */
  console.log('\n=== O TOP 10 ===');
  for(const [uid, nome, n] of [['a','Ana',7],['b','Bia',12],['c','Caio',3]]){
    await db.collection('users').doc(uid).set({ trainerName: nome });
    for(let k = 1; k < n; k++) await chamar('submitArenaWin', { venceu: true }, uid);
  }
  const top = await chamar('getArenaRanking', {}, 'a');
  ok('ele vem ordenado por nível, do maior pro menor',
     top.lista.every((x, i) => i === 0 || top.lista[i-1].nivel >= x.nivel),
     top.lista.map(x => x.nome + ':' + x.nivel).join(' '));
  ok('  e o Teimoso (no teto) lidera', top.lista[0].nivel === TETO);
  ok('  e ele marca quem sou eu', top.lista.some(x => x.eu && x.uid === 'a'));
  /* ⚠️ O MEU NÍVEL VOLTA SEMPRE: ele não é enfeite -- é ele que decide o NÍVEL DO ADVERSÁRIO. */
  ok('  e o MEU nível volta sempre', top.nivel === 7, 'nível ' + top.nivel);
  ok('  e a semana volta junto', /^\d{4}-\d{2}-\d{2}$/.test(String(top.semanaId)), String(top.semanaId));
  /* quem está fora do top ganha a linha própria */
  const semanaId = top.semanaId;
  for(let k = 0; k < 12; k++){
    const uid = 'enche' + k;
    await db.collection('users').doc(uid).set({ trainerName: 'Enche' + k });
    for(let j = 1; j < 30 + k; j++) await chamar('submitArenaWin', { venceu: true }, uid);
  }
  const fora = await chamar('getArenaRanking', {}, 'c');
  ok('  e quem está fora do top vem na linha `meu`',
     !fora.lista.some(x => x.eu) && fora.meu && fora.meu.uid === 'c' && fora.meu.pos === null,
     fora.meu ? 'nível ' + fora.meu.nivel : '(nenhum)');
  ok('  e o top tem no máximo 10 linhas', fora.lista.length <= 10, fora.lista.length + ' linhas');

  /* ---------- 5) a semana e uma subcolecao propria ---------- */
  console.log('\n=== CADA SEMANA É UMA SUBCOLEÇÃO PRÓPRIA ===');
  const doc = await db.collection('arenaRankingWeekly').doc(semanaId)
                      .collection('players').doc('u1').get();
  ok('o documento vive em `arenaRankingWeekly/<semana>/players/<uid>`', doc.exists);
  ok('  e ele guarda o nível, o nome e a semana', doc.data().nivel === 4
     && doc.data().nome === 'Buzzo' && doc.data().semanaId === semanaId,
     JSON.stringify(doc.data()));
  /* ⚠️ NÃO HÁ RESET: a semana passada simplesmente não está na coleção de hoje. */
  const outra = await db.collection('arenaRankingWeekly').doc('2020-01-06')
                        .collection('players').doc('u1').get();
  ok('  e a semana de outro id nasce VAZIA (não há reset a fazer)', !outra.exists);
  /* ⚠️ E NÃO HÁ COLEÇÃO "DE SEMPRE": um ranking de sempre compararia níveis contra espécies
     diferentes -- o adversário muda toda semana. */
  const sempre = await db.collection('arenaRanking').get();
  ok('  e não existe coleção "de sempre"', sempre.empty || sempre.size === 0,
     (sempre.size || 0) + ' documentos');

  /* ---------- 5b) o PREMIO da semana (24/09/2026) ---------- */
  console.log('\n=== O PRÊMIO DO LÍDER DA SEMANA ===');
  const RS = mod._rankSemanal;
  const arena = (RS.RANKS_SEMANAIS || []).filter(r => r.base === 'arenaRanking');
  ok('a Arena entra no RANKS_SEMANAIS (é o cron que fecha e paga)', arena.length === 1,
     arena.length + ' entrada(s)');
  ok('  e ela declara o campo `nivel`, com maior sendo melhor',
     !!arena[0] && arena[0].campo === 'nivel' && arena[0].maior === true);
  /* ⚠️ A UNIDADE É O QUE IMPEDE A NOTIFICAÇÃO DE MENTIR: os outros quatro medem PLACAR, e sem ela o
     texto genérico diria "com 12 pontos" onde o certo é "no nível 12". */
  ok('  e a UNIDADE dela é o nível (os outros quatro medem placar)',
     !!arena[0] && arena[0].unidade === 'nivel', arena[0] ? String(arena[0].unidade) : '-');
  /* ⚠️ E ELA NÃO ENTRA NA CÓPIA INICIAL: ela não TEM coleção de sempre pra copiar. Aquela lista é
     escrita à mão de propósito -- derivada do RANKS_SEMANAIS, a Arena entraria e o cron marcaria
     `copiado: true` sobre uma coleção que não existe. */
  const fonteCopia = fs.readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
  const listaCopia = (fonteCopia.match(/for\(const base of \[([^\]]*)\]\)/) || [, ''])[1];
  ok('  e ela NÃO entra na cópia inicial (não há coleção de sempre pra copiar)',
     listaCopia.indexOf('arenaRanking') < 0 && listaCopia.indexOf('fishingRanking') >= 0,
     listaCopia.replace(/['\s]/g, ''));

  /* o fechamento de verdade, com três níveis distintos */
  const semAnterior = RS.semanaDoRanking(Date.now() - 7 * 864e5);
  const P = RS.rankSemanaPlayersRef('arenaRanking', semAnterior);
  for(const [uid, nome, n] of [['p1','Lider',12],['p2','Vice',8],['p3','Terceiro',5],['p4','Quarto',2]]){
    await db.collection('users').doc(uid).set({ trainerName: nome, rareCandies: 0, moedas: 0 });
    await P.doc(uid).set({ uid, nome, nivel: n, semanaId: semAnterior, quando: Date.now() });
  }
  const fech = await RS.fecharSemanaDoRanking('arenaRanking', semAnterior, 'nivel', true,
                                              arena[0].rotulo, arena[0].unidade);
  ok('o fechamento premia os TRÊS degraus (e não o quarto)', fech && fech.premiados === 3,
     fech ? fech.premiados + ' premiado(s)' : '(nulo)');
  const doc1 = (await db.collection('users').doc('p1').get()).data();
  const doc2 = (await db.collection('users').doc('p2').get()).data();
  const doc3 = (await db.collection('users').doc('p3').get()).data();
  const doc4 = (await db.collection('users').doc('p4').get()).data();
  /* ⚠️ OS VALORES SAEM DA TABELA, nunca escritos aqui: cravá-los faria a trava envelhecer no primeiro
     reajuste de prêmio -- a família que já caiu meia dúzia de vezes neste projeto. */
  const PR = RS.RANK_SEMANAL_PREMIOS;
  ok('  o líder ganha Doce Raro', doc1.rareCandies === PR[0].doces, doc1.rareCandies + ' doce(s)');
  ok('  o vice ganha menos que ele, e mais que zero',
     doc2.rareCandies === PR[1].doces && PR[1].doces > 0 && PR[1].doces < PR[0].doces,
     doc2.rareCandies + ' doce(s)');
  ok('  o terceiro ganha moedas', doc3.moedas === PR[2].moedas, '🪙 ' + doc3.moedas);
  ok('  e o quarto não ganha nada', !doc4.rareCandies && !doc4.moedas);
  /* ⚠️ A FRASE: "no nível 12", nunca "com 12 pontos" */
  const notas = (await db.collection('users').doc('p1').collection('notifications').get()).docs
    .map(d => d.data()).filter(x => x.type === 'rank_semanal');
  ok('  e a notificação chega', notas.length === 1, notas.length + ' nota(s)');
  ok('  e ela diz "no nível 12", nunca "com 12 pontos"',
     !!notas[0] && notas[0].body.indexOf('no nível 12') >= 0 && notas[0].body.indexOf('pontos') < 0,
     notas[0] ? notas[0].body : '-');
  ok('  e ela nomeia o ranking', !!notas[0] && notas[0].body.indexOf(arena[0].rotulo) >= 0);
  /* ⚠️ E O TEXTO DOS QUATRO QUE JÁ EXISTEM NÃO MUDA -- sem esta metade, uma mudança que trocasse a
     frase dos cinco passaria. */
  const sem2 = RS.semanaDoRanking(Date.now() - 14 * 864e5);
  await db.collection('users').doc('q1').set({ trainerName: 'Pescador', rareCandies: 0 });
  await RS.rankSemanaPlayersRef('fishingRanking', sem2).doc('q1')
          .set({ uid: 'q1', nome: 'Pescador', pontos: 550, semanaId: sem2 });
  await RS.fecharSemanaDoRanking('fishingRanking', sem2, 'pontos', true, 'Pescaria', undefined);
  const nq = (await db.collection('users').doc('q1').collection('notifications').get()).docs
    .map(d => d.data()).filter(x => x.type === 'rank_semanal');
  ok('  e a Pescaria continua dizendo "com 550 pontos"',
     !!nq[0] && nq[0].body.indexOf('com 550 pontos') >= 0, nq[0] ? nq[0].body : '-');

  /* ⚠️ E O CAMINHO DE VERDADE: o CRON. Os casos acima chamam o `fecharSemanaDoRanking` na mão, com a
     unidade passada por aqui -- então eles passariam com o cron tendo parado de repassá-la, e a
     conferência de acusação mostrou isso: aquele defeito ficou MUDO. Este dirige a cadeia inteira
     (cron -> fechar -> premiar), que é a única forma de provar que a unidade viaja. */
  const sem3 = RS.semanaDoRanking(Date.now() - 21 * 864e5);
  await db.collection('users').doc('z1').set({ trainerName: 'Cronado', rareCandies: 0 });
  await RS.rankSemanaPlayersRef('arenaRanking', sem3).doc('z1')
          .set({ uid: 'z1', nome: 'Cronado', nivel: 20, semanaId: sem3 });
  await RS.fecharSemanasPendentes();
  const nz = (await db.collection('users').doc('z1').collection('notifications').get()).docs
    .map(d => d.data()).filter(x => x.type === 'rank_semanal');
  ok('e o CRON fecha a semana da Arena sozinho', nz.length === 1, nz.length + ' nota(s)');
  ok('  e a unidade VIAJA por ele (a frase diz "no nível 20")',
     !!nz[0] && nz[0].body.indexOf('no nível 20') >= 0 && nz[0].body.indexOf('pontos') < 0,
     nz[0] ? nz[0].body : '-');
  ok('  e ele pagou o doce', (await db.collection('users').doc('z1').get()).data().rareCandies === PR[0].doces);

  /* ---------- 6) o acesso ---------- */
  console.log('\n=== O ACESSO ===');
  let recusou = false;
  try { await mod.submitArenaWin({ data: { venceu: true }, auth: null }); }
  catch(e){ recusou = true; }
  ok('sem login a subida é recusada', recusou);
  recusou = false;
  try { await mod.getArenaRanking({ data: {}, auth: null }); }
  catch(e){ recusou = true; }
  ok('  e a leitura também', recusou);

  /* ---------- 7) as regras, lidas como TEXTO ---------- */
  console.log('\n=== AS REGRAS ===');
  const regras = fs.readFileSync(path.join(raiz, 'firestore.rules'), 'utf8');
  const m = regras.match(/match \/arenaRankingWeekly\/\{semanaId\} \{[\s\S]*?\n    \}/);
  ok('a coleção da semana está nas regras', !!m);
  /* ⚠️ ESCRITA NEGADA A TODOS, inclusive ao dono: aqui o que se grava é um CONTADOR que o servidor
     incrementa, e o prêmio de um ranking é o TOPO -- uma linha no console poria nível 99 lá. */
  ok('  e a escrita é negada a TODOS, no doc e na subcoleção',
     !!m && (m[0].match(/allow write: if false;/g) || []).length === 2);
  ok('  e a leitura é livre pra quem está logado',
     !!m && (m[0].match(/allow read: if request\.auth != null;/g) || []).length === 2);

  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
