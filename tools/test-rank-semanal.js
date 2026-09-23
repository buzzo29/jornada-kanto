/**
 * O RANKING SEMANAL DOS TRÊS JOGOS DAS ILHAS -- servidor e tela (23/09/2026).
 *
 * Pedido: *"crie um ranking semanal para os jogos pescaria, corrida e resgate das ilhas laranjas.
 * O lider de cada semana ganha 2 rare candy, o vice lider ganha 1 rare candy e o terceiro colocado
 * ganha 50 moedas, reseta toda segunda feira meia noite, e mantem o rank de sempre, serao 2
 * rankings, coloque 2 abas no ranking que existe hoje, e pode copiar os dois igual"*.
 *
 * ⚠️ NÃO EXISTE "RESETAR": cada semana é uma SUBCOLEÇÃO própria (`<base>Weekly/<segunda>/players`).
 * Semana nova é outra subcoleção, então não há o que apagar -- e de quebra isso dispensa índice
 * composto (a consulta continua sendo um `orderBy` de um campo só) e guarda o histórico de graça.
 *
 * O QUE ESTE ARQUIVO TRANCA, e por quê:
 *   - a conta da SEMANA (segunda a domingo, no fuso do jogo), porque ela decide quando o prêmio sai;
 *   - o geral e o semanal serem INDEPENDENTES -- quem não bate o recorde de sempre ainda bate o da
 *     semana, e sem isso a aba nova mostraria os mesmos números da antiga;
 *   - o pódio ser de PLACAR DISTINTO (dois empatados no topo são os DOIS líderes), a regra da Torre;
 *   - o fechamento ser IDEMPOTENTE: o cron passa de hora em hora, e pagar duas vezes é moeda do nada;
 *   - a trava de "já pago" ser por RANKING, senão a Corrida pagaria só uma das duas modalidades;
 *   - a CÓPIA INICIAL preencher só quem falta -- reescrevendo, ela apagaria um recorde novo com o
 *     valor antigo do geral;
 *   - e as abas: elas existem, só UMA está acesa, e o modal do time da Corrida lê a MESMA célula.
 *
 *   node tools/test-rank-semanal.js
 */
const path = require('path');
const Module = require('module');
const fs = require('fs');
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

const S = fns._rankSemanal;
const SRV = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const REGRAS = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

let falhas = 0;
function ok(nome, cond, detalhe){
  if(cond) console.log('  OK     ' + nome + (detalhe ? '   ' + detalhe : ''));
  else { falhas++; console.log('  FALHOU ' + nome + (detalhe ? '   ' + detalhe : '')); }
}
const chamar = (fn, uid, data)=> fn({ auth: uid ? { uid, token: { sign_in_provider: 'password' } } : null, data: data || {} });
const conta  = (uid)=> db.collection('users').doc(uid);
const semana = (base, sem, uid)=> S.rankSemanaPlayersRef(base, sem).doc(uid);
const DIA = 24 * 3600 * 1000;

(async ()=>{

console.log('\n=== A CONTA DA SEMANA: segunda a domingo ===');
{
  /* 21/09/2026 é uma SEGUNDA. A semana dela tem que ser ela mesma, e o domingo seguinte (27)
     ainda tem que cair nela -- é isso que faz o prêmio sair uma vez por semana e não sete. */
  const meioDia = (d)=> new Date(d + 'T15:00:00Z').getTime();   // meio-dia em SP
  const seg = S.semanaDoRanking(meioDia('2026-09-21'));
  ok('a segunda é a própria semana', seg === '2026-09-21', seg);
  for(const [d, esperado] of [['2026-09-22','2026-09-21'], ['2026-09-25','2026-09-21'],
                              ['2026-09-27','2026-09-21'], ['2026-09-28','2026-09-28']]){
    const r = S.semanaDoRanking(meioDia(d));
    ok('  ' + d + ' cai na semana de ' + esperado, r === esperado, r);
  }
  /* ⚠️ E A VIRADA É NA SEGUNDA 00:00 DO FUSO DO JOGO, não do UTC: o jogador vira a semana na
     meia-noite dele. São 03:00 UTC (SP é UTC-3), então 02:59Z de segunda ainda é a semana velha. */
  const antes = S.semanaDoRanking(new Date('2026-09-28T02:59:00Z').getTime());
  const depois = S.semanaDoRanking(new Date('2026-09-28T03:01:00Z').getTime());
  ok('23:59 de domingo (SP) ainda é a semana velha', antes === '2026-09-21', antes);
  ok('00:01 de segunda (SP) já é a nova', depois === '2026-09-28', depois);
}

console.log('\n=== O GERAL E O SEMANAL SÃO INDEPENDENTES ===');
{
  await conta('ana').set({ trainerName: 'Ana' });
  const sem = S.semanaDoRanking();
  let r = await chamar(fns.submitFishingScore, 'ana', { pontos: 400, capturas: 5 });
  ok('o envio grava nos dois', r.gravado === true && r.gravadoSemana === true, JSON.stringify(r));
  ok('  e o geral tem 400', ((await db.collection('fishingRanking').doc('ana').get()).data()||{}).pontos === 400);
  ok('  e a semana tem 400', ((await semana('fishingRanking', sem, 'ana').get()).data()||{}).pontos === 400);

  /* ⚠️ O CASO QUE A ABA NOVA EXISTE PRA MOSTRAR: uma semana nova zera o placar dela, e um placar
     PIOR que o recorde de sempre ainda é o melhor DA SEMANA. Sem a independência, a aba da semana
     mostraria os mesmos números da de sempre e a feature não teria acontecido. */
  await semana('fishingRanking', sem, 'ana').delete();
  r = await chamar(fns.submitFishingScore, 'ana', { pontos: 350, capturas: 4 });
  ok('350 NÃO bate o recorde de sempre (400)', r.gravado === false, JSON.stringify(r));
  ok('  mas É o recorde da semana', r.gravadoSemana === true);
  ok('  o geral continua 400', ((await db.collection('fishingRanking').doc('ana').get()).data()||{}).pontos === 400);
  ok('  e a semana ficou 350', ((await semana('fishingRanking', sem, 'ana').get()).data()||{}).pontos === 350);
}

console.log('\n=== A LEITURA DEVOLVE AS DUAS LISTAS ===');
{
  const sem = S.semanaDoRanking();
  await conta('bruno').set({ trainerName: 'Bruno' });
  await chamar(fns.submitFishingScore, 'bruno', { pontos: 900, capturas: 9 });
  const leu = await chamar(fns.getFishingRanking, 'bruno', {});
  ok('a lista de sempre vem', Array.isArray(leu.lista) && leu.lista.length === 2, JSON.stringify(leu.lista.map(x=>x.nome+':'+x.pontos)));
  ok('a lista da semana vem', Array.isArray(leu.semanal.lista) && leu.semanal.lista.length === 2, JSON.stringify(leu.semanal.lista.map(x=>x.nome+':'+x.pontos)));
  ok('e a semana é NOMEADA', leu.semanaId === sem, leu.semanaId);
  /* ⚠️ AS DUAS VÊM NA MESMA RESPOSTA, e é isso que faz trocar de aba não custar rede -- com duas
     chamadas, a aba piscaria "Carregando…" a cada toque. */
  ok('as duas na MESMA resposta (a aba não custa rede)', !!leu.lista && !!leu.semanal);
  /* e os números são diferentes: a Ana está com 400 no geral e 350 na semana */
  const gAna = leu.lista.find(x=>x.nome==='Ana'), sAna = leu.semanal.lista.find(x=>x.nome==='Ana');
  ok('  e eles DIFEREM de verdade', gAna.pontos === 400 && sAna.pontos === 350, gAna.pontos + ' x ' + sAna.pontos);
}

console.log('\n=== A CORRIDA: duas modalidades, e MENOR é melhor ===');
{
  const sem = S.semanaDoRanking();
  await conta('cida').set({ trainerName: 'Cida' });
  let r = await chamar(fns.submitRaceTime, 'cida', { modalidade: 'single', tempo: 20.5, time: [] });
  ok('o tempo individual grava nos dois', r.gravado === true && r.gravadoSemana === true);
  r = await chamar(fns.submitRaceTime, 'cida', { modalidade: 'relay', tempo: 110.0, time: [] });
  ok('e o revezamento também', r.gravado === true && r.gravadoSemana === true);
  /* ⚠️ MERGE: as duas modalidades vivem no MESMO documento, e sem o merge a segunda apagaria a
     primeira -- quem correu as duas perderia uma delas. */
  const d = (await semana('raceRanking', sem, 'cida').get()).data() || {};
  ok('  e as DUAS ficam no mesmo doc', d.single === 20.5 && d.relay === 110.0, JSON.stringify({s:d.single,r:d.relay}));
  /* um tempo MAIOR não é recorde */
  r = await chamar(fns.submitRaceTime, 'cida', { modalidade: 'single', tempo: 25.0, time: [] });
  ok('um tempo PIOR não grava', r.gravado === false && r.gravadoSemana === false, JSON.stringify(r));
  const leu = await chamar(fns.getRaceRanking, 'cida', {});
  ok('a leitura traz as duas modalidades da semana',
     !!leu.semanal && !!leu.semanal.single && !!leu.semanal.relay,
     JSON.stringify(Object.keys(leu.semanal || {})));
  ok('  e a de sempre também', !!leu.single && !!leu.relay);
}

console.log('\n=== O PÓDIO É DE PLACAR DISTINTO, E OS PRÊMIOS SÃO OS PEDIDOS ===');
{
  const sem = '2026-08-03';    /* uma semana fechada, longe da corrente */
  for(const [u, p] of [['p1', 900], ['p2', 900], ['p3', 700], ['p4', 500], ['p5', 100]]){
    await conta(u).set({ trainerName: u.toUpperCase() });
    await semana('rescueRanking', sem, u).set({ uid: u, nome: u.toUpperCase(), pontos: p, semanaId: sem });
  }
  const res = await S.fecharSemanaDoRanking('rescueRanking', sem, 'pontos', true, 'Resgate');
  ok('fechou e premiou 4 (os dois empatados contam)', res && res.premiados === 4, JSON.stringify(res));
  ok('  e o pódio são os TRÊS placares distintos', JSON.stringify(res.podio) === '[900,700,500]', JSON.stringify(res.podio));
  const doces = async (u)=> ((await conta(u).get()).data() || {}).rareCandies || 0;
  const moedas = async (u)=> ((await conta(u).get()).data() || {}).moedas || 0;
  ok('o 1º leva 2 doces', await doces('p1') === 2, String(await doces('p1')));
  ok('  e o EMPATADO no topo leva os 2 também', await doces('p2') === 2, String(await doces('p2')));
  ok('o 2º leva 1 doce', await doces('p3') === 1, String(await doces('p3')));
  ok('o 3º leva 50 moedas', await moedas('p4') === 50, String(await moedas('p4')));
  ok('  e nenhum doce', await doces('p4') === 0);
  ok('o 4º não leva nada', await doces('p5') === 0 && await moedas('p5') === 0);
  /* ⚠️ A NOTIFICAÇÃO DIZ O QUE ELE GANHOU -- prêmio que o jogador não vê é o erro da
     especialidade de novo (ela valia 1%, não tinha selo, e a conclusão foi "não mudou nada"). */
  const n = await db.collection('users').doc('p1').collection('notifications').get();
  const txt = n.docs.map(d => (d.data().title || '') + ' ' + (d.data().body || '')).join(' | ');
  ok('a notificação nomeia a posição', /líder da semana/.test(txt), txt.slice(0, 80));
  ok('  e o que ele ganhou', /Doces Raros/.test(txt));
  ok('  e que a posição foi DIVIDIDA', /dividiu essa posição/.test(txt));
}

console.log('\n=== FECHAR DE NOVO NÃO PAGA NADA ===');
{
  const sem = '2026-08-03';
  const antes = ((await conta('p1').get()).data() || {}).rareCandies;
  const r = await S.fecharSemanaDoRanking('rescueRanking', sem, 'pontos', true, 'Resgate');
  ok('a segunda passada é no-op', r === null, JSON.stringify(r));
  ok('  e ninguém ganhou de novo', ((await conta('p1').get()).data() || {}).rareCandies === antes);
  /* ⚠️ E A TRAVA DE VERDADE É POR TREINADOR: mesmo com a marca da semana apagada, quem já foi
     pago não é pago de novo -- é ela que protege quando o cron morre no meio do laço. */
  await S.rankSemanaDocRef('rescueRanking', sem).set({ awarded_pontos: false }, { merge: true });
  await S.fecharSemanaDoRanking('rescueRanking', sem, 'pontos', true, 'Resgate');
  ok('  mesmo com a marca da semana apagada', ((await conta('p1').get()).data() || {}).rareCandies === antes,
     String(((await conta('p1').get()).data() || {}).rareCandies));
}

console.log('\n=== A TRAVA DE "JÁ PAGO" É POR RANKING, e a Corrida tem DOIS ===');
{
  const sem = '2026-08-10';
  await conta('q1').set({ trainerName: 'Q1' });
  await semana('raceRanking', sem, 'q1').set({ uid: 'q1', nome: 'Q1', single: 18.0, relay: 90.0, semanaId: sem });
  await S.fecharSemanaDoRanking('raceRanking', sem, 'single', false, 'Corrida individual');
  const d1 = ((await conta('q1').get()).data() || {}).rareCandies || 0;
  await S.fecharSemanaDoRanking('raceRanking', sem, 'relay', false, 'Corrida em revezamento');
  const d2 = ((await conta('q1').get()).data() || {}).rareCandies || 0;
  ok('o individual pagou 2', d1 === 2, String(d1));
  ok('  e o revezamento pagou MAIS 2 (são dois rankings)', d2 === 4, String(d2));
  const ch = Object.keys(((await conta('q1').get()).data() || {}).premiosSemanais || {});
  ok('  com DUAS chaves distintas', ch.length === 2, JSON.stringify(ch));
}

console.log('\n=== A SEMANA VAZIA FECHA SEM PAGAR ===');
{
  const sem = '2026-08-17';
  const r = await S.fecharSemanaDoRanking('fishingRanking', sem, 'pontos', true, 'Pescaria');
  ok('fechou', r && r.premiados === 0, JSON.stringify(r));
  const d = (await S.rankSemanaDocRef('fishingRanking', sem).get()).data() || {};
  ok('  e ficou MARCADA (o cron não volta nela)', d.awarded_pontos === true);
}

console.log('\n=== O CRON FECHA A ANTERIOR, NUNCA A CORRENTE ===');
{
  const atual = S.semanaDoRanking();
  const ant = S.semanaDoRanking(Date.now() - 7 * DIA);
  await conta('z1').set({ trainerName: 'Z1' });
  await semana('fishingRanking', ant, 'z1').set({ uid: 'z1', nome: 'Z1', pontos: 555, semanaId: ant });
  await S.fecharSemanasPendentes();
  const dAnt = (await S.rankSemanaDocRef('fishingRanking', ant).get()).data() || {};
  const dCor = (await S.rankSemanaDocRef('fishingRanking', atual).get()).data() || {};
  ok('a semana anterior fechou', dAnt.awarded_pontos === true);
  /* ⚠️ ISTO É O PONTO: fechando a corrente, o prêmio sairia no meio da semana e ela continuaria
     aceitando pontuação depois de paga -- quem jogasse na quarta correria por nada. */
  ok('a CORRENTE não fechou', !dCor.awarded_pontos, JSON.stringify(dCor));
  ok('  e o Z1 ganhou os 2 doces', (((await conta('z1').get()).data() || {}).rareCandies || 0) === 2);
  /* e ele varre mais de uma semana pra trás, pra uma que ficou pra fora se recuperar sozinha */
  ok('ele varre ' + S.RANK_SEMANAS_A_FECHAR + ' semanas pra trás', S.RANK_SEMANAS_A_FECHAR >= 2);
}

console.log('\n=== A CÓPIA INICIAL ===');
{
  const sem = S.semanaDoRanking();
  /* a Dani só tem recorde de SEMPRE; o Élio já jogou nesta semana, com placar MENOR */
  await db.collection('rescueRanking').doc('dani').set({ uid: 'dani', nome: 'Dani', pontos: 1000 });
  await db.collection('rescueRanking').doc('elio').set({ uid: 'elio', nome: 'Elio', pontos: 800 });
  await semana('rescueRanking', sem, 'elio').set({ uid: 'elio', nome: 'Elio', pontos: 300, semanaId: sem });
  await S.copiarGeralParaASemana();
  ok('quem só tinha o de sempre foi copiado', ((await semana('rescueRanking', sem, 'dani').get()).data()||{}).pontos === 1000);
  /* ⚠️ E QUEM JÁ JOGOU NESTA SEMANA NÃO É REESCRITO: o placar da semana é dele, e o do geral pode
     ser de um dia anterior -- reescrevendo, a cópia apagaria um recorde novo com o valor antigo. */
  ok('  e quem já jogou na semana FICOU com o dele', ((await semana('rescueRanking', sem, 'elio').get()).data()||{}).pontos === 300,
     String(((await semana('rescueRanking', sem, 'elio').get()).data()||{}).pontos));
  /* ⚠️ E ELA RODA UMA VEZ SÓ: o cron passa de hora em hora, e sem a marca cada volta reescreveria
     os placares -- inclusive por cima de um recorde novo, com o valor velho do geral. */
  await semana('rescueRanking', sem, 'dani').set({ uid: 'dani', nome: 'Dani', pontos: 1500, semanaId: sem });
  await S.copiarGeralParaASemana();
  ok('rodar de novo não mexe em nada', ((await semana('rescueRanking', sem, 'dani').get()).data()||{}).pontos === 1500,
     String(((await semana('rescueRanking', sem, 'dani').get()).data()||{}).pontos));
  const marca = (await S.rankSemanaDocRef('rescueRanking', sem).get()).data() || {};
  ok('  e a marca ficou no documento da semana', marca.copiado === true);
  /* ⚠️ E A MARCA É O QUE FAZ ELA RODAR UMA VEZ SÓ -- as duas guardas (ela e o `if(ja.exists)`)
     protegem o DADO igual, então só isto distingue as duas: quem entra no geral DEPOIS da cópia
     não é copiado. É o que impede o cron de varrer as três coleções inteiras de hora em hora.
     ⚠️ E não é buraco: quem faz um placar de sempre novo o fez JOGANDO, e o envio grava nos dois. */
  await db.collection('rescueRanking').doc('fabio').set({ uid: 'fabio', nome: 'Fabio', pontos: 1234 });
  await S.copiarGeralParaASemana();
  ok('  e quem entrou no geral DEPOIS dela não é copiado',
     !(await semana('rescueRanking', sem, 'fabio').get()).exists);
}

console.log('\n=== O SERVIDOR: as quatro listas e as portas (lendo o código) ===');
{
  ok('são QUATRO pódios (a Corrida tem duas modalidades)', S.RANKS_SEMANAIS.length === 4,
     JSON.stringify(S.RANKS_SEMANAIS.map(x => x.base + '.' + x.campo)));
  const chaves = S.RANKS_SEMANAIS.map(x => x.base + '.' + x.campo);
  ok('  e nenhum repete', new Set(chaves).size === 4);
  ok('  a Corrida é MENOR é melhor', S.RANKS_SEMANAIS.filter(x => !x.maior).length === 2);
  ok('  e os outros dois são MAIOR é melhor', S.RANKS_SEMANAIS.filter(x => x.maior).length === 2);
  ok('os prêmios são 2 doces / 1 doce / 50 moedas',
     JSON.stringify(S.RANK_SEMANAL_PREMIOS.map(p => p.doces + ':' + p.moedas)) === '["2:0","1:0","0:50"]',
     JSON.stringify(S.RANK_SEMANAL_PREMIOS.map(p => p.doces + ':' + p.moedas)));
  /* ⚠️ O CRON CHAMA AS DUAS, E A CÓPIA VEM ANTES: os casos chamam as funções na mão e passariam
     com a chamada órfã -- a mesma trava que o `applySpecialtyBuff` e o `equiparItens` já têm. */
  const iCopia = SRV.indexOf('await copiarGeralParaASemana()');
  const iFecha = SRV.indexOf('await fecharSemanasPendentes()');
  ok('o cron chama a cópia', iCopia > 0);
  ok('o cron chama o fechamento', iFecha > 0);
  ok('  e a cópia vem ANTES', iCopia > 0 && iFecha > iCopia, iCopia + ' < ' + iFecha);
  /* ⚠️ E A MARCA `awarded` É ESCRITA POR ÚLTIMO: marcada antes, um erro no meio do laço apagaria o
     resto do pódio pra sempre -- a volta seguinte do cron veria a marca e iria embora. */
  const corpo = SRV.slice(SRV.indexOf('async function fecharSemanaDoRanking('));
  const fatia = corpo.slice(0, corpo.indexOf('async function premiarSemana('));
  ok('  (a fatia do fechamento tem o que ler)', fatia.length > 400, String(fatia.length));
  /* ⚠️ E A CONTA É A PRIMEIRA OCORRÊNCIA DEPOIS DO PÓDIO, não a última: acrescentar a marca no
     `set` do pódio (e manter a do fim) é um defeito de verdade -- a volta seguinte do cron veria
     a marca e iria embora com metade do pódio pago --, e um `lastIndexOf` passa por ele em branco.
     A fatia começa no cálculo do pódio, ou seja depois do ramo da semana VAZIA, que marca ali
     mesmo de propósito (não há o que pagar). */
  const daqui = fatia.slice(fatia.indexOf('const valores = ['));
  ok('  (a fatia do pódio tem o que ler)', daqui.length > 200 && daqui.indexOf('await premiarSemana(') > 0);
  ok('a marca awarded é escrita DEPOIS de premiar',
     daqui.indexOf('[marca]: true') > daqui.indexOf('await premiarSemana('),
     daqui.indexOf('[marca]: true') + ' > ' + daqui.indexOf('await premiarSemana('));
}

console.log('\n=== AS REGRAS DO FIRESTORE (lidas como texto) ===');
{
  /* ⚠️ PONTUAÇÃO É PLACAR PÚBLICO: uma linha no console poria qualquer número no topo, e o
     prêmio agora é DOCE RARO -- ou seja, nível. As três coleções semanais são fechadas pra
     escrita do cliente, como as três de sempre. */
  for(const c of ['fishingRankingWeekly', 'rescueRankingWeekly', 'raceRankingWeekly']){
    const i = REGRAS.indexOf('match /' + c + '/');
    ok(c + ' está nas regras', i > 0);
    const bloco = REGRAS.slice(i, i + 700);
    ok('  o cliente LÊ', /allow read: if request\.auth != null;/.test(bloco));
    ok('  e NÃO escreve', /allow write: if false;/.test(bloco));
    ok('  e a subcoleção players também', /match \/players\/\{/.test(bloco) &&
       (bloco.match(/allow write: if false;/g) || []).length >= 2,
       String((bloco.match(/allow write: if false;/g) || []).length));
  }
}

console.log('\n=== A TELA: as duas abas ===');
{
  const { createSandbox } = require('./game-sandbox');
  const S2 = createSandbox(path.join(__dirname, '..', 'index.html'));
  S2.game.authUser = { uid: 'u' };
  S2.game.trainerName = 'Buzzo';
  const nomes = (h)=> (h.match(/pesc-rank-nome">([^<]*)/g) || []).map(x => x.split('>')[1]);

  S2.pescariaRank.lista = [{ pos: 1, nome: 'ANA', pontos: 900, eu: false }];
  S2.pescariaRank.semanal = { lista: [{ pos: 1, nome: 'CIDA', pontos: 500, eu: false }], meu: null };
  S2.pescariaRank.semanaId = '2026-09-21';

  let h = S2.pescariaRankHtml();
  ok('há DUAS abas', (h.match(/<button class="tower-rank-aba/g) || []).length === 2, String((h.match(/<button class="tower-rank-aba/g)||[]).length));
  /* ⚠️ A ABA É A `tower-rank-aba` DA TORRE, e não uma nova: o jogo já tinha esse controle, e um
     próprio faria o jogador reaprender a ler o mesmo botão. A primeira versão era uma classe
     própria que usava um nome de variável de cor INEXISTENTE -- o navegador descarta a declaração
     e a aba inativa saía sem moldura, com o mesmo fundo da caixa. Em HTML ela passava. */
  ok('  e ela é a MESMA classe que a Torre usa', HTML.indexOf('.tower-rank-aba{') > 0 &&
     h.indexOf('tower-rank-aba') >= 0);
  ok('só UMA está acesa', (h.match(/tower-rank-aba on"/g) || []).length === 1);
  ok('a padrão é a DA SEMANA', /tower-rank-aba on"[^>]*>Da semana</.test(h));
  ok('  e ela mostra a lista da SEMANA', JSON.stringify(nomes(h)) === '["CIDA"]', JSON.stringify(nomes(h)));
  ok('  com a nota do prêmio', /Lidere até o fim da semana e ganhe Doces Raros/.test(h));
  /* ⚠️ A DATA É O PRAZO (o DOMINGO), não a abertura: o que decide se vale jogar hoje é quanto
     tempo ainda há. O `semanaId` é a segunda (21/09), então a nota tem que dizer 27/09.
     ⚠️ E ELA É DERIVADA do `trainersLeagueDateStrPlusDays` -- a MESMA regra de data que o cron
     usa pra fechar a semana. Uma conta própria discordaria dele em algum fuso, e a tela
     anunciaria um prazo que o fechamento não pratica. */
  ok('  nomeando o FIM da semana, não o começo', /Até 27\/09/.test(h) && !/desde 21\/09/.test(h),
     (h.match(/\(([^)]*)\)<\/span>/) || [])[1]);
  ok('  e a data vem da regra do jogo, não de uma conta própria',
     /trainersLeagueDateStrPlusDays\(semanaId, 6\)/.test(HTML));

  S2.rankTrocarAba('pescaria', 'sempre');
  h = S2.pescariaRankHtml();
  ok('a aba de sempre mostra a lista de sempre', JSON.stringify(nomes(h)) === '["ANA"]', JSON.stringify(nomes(h)));
  ok('  e a acesa passou a ser ela', /tower-rank-aba on"[^>]*>De sempre</.test(h));
  /* ⚠️ A NOTA É SÓ DA SEMANA: no de sempre não há prêmio pra convidar, e ela mentiria. */
  ok('  e a nota do prêmio SOME', !/Lidere/.test(h) && !/Doces Raros/.test(h));

  /* ⚠️ A ABA É POR JOGO: a Pescaria e o Resgate são telas diferentes, e uma aba só faria a
     escolha de uma valer na outra. */
  S2.resgateRank.lista = [{ pos: 1, nome: 'ANA', pontos: 900, eu: false }];
  S2.resgateRank.semanal = { lista: [{ pos: 1, nome: 'CIDA', pontos: 400, eu: false }], meu: null };
  S2.resgateRank.semanaId = '2026-09-21';
  const hr = S2.resgateRankHtml();
  ok('o Resgate continua na aba DELE (a da semana)', JSON.stringify(nomes(hr)) === '["CIDA"]', JSON.stringify(nomes(hr)));

  /* o vazio da semana diz outra coisa que o vazio de sempre */
  S2.pescariaRank.semanal = { lista: [], meu: null };
  S2.rankTrocarAba('pescaria', 'semana');
  h = S2.pescariaRankHtml();
  ok('a semana vazia diz "nesta semana"', /nesta semana ainda/.test(h), (h.match(/hint-text">([^<]*)/)||[])[1]);
  ok('  e as abas continuam na tela (dá pra voltar pro de sempre)', (h.match(/<button class="tower-rank-aba/g) || []).length === 2);

  /* ===== a Corrida: dois eixos ===== */
  const t1 = [{ speciesId: 'jolteon', level: 70 }], t2 = [{ speciesId: 'raichu', level: 60 }];
  S2.corrida.formato = 'single';
  S2.corridaRank.single = { lista: [{ pos: 1, nome: 'ANA', tempo: 20, time: t1, eu: false }], meu: null };
  S2.corridaRank.relay  = { lista: [{ pos: 1, nome: 'ANA', tempo: 99, time: t1, eu: false }], meu: null };
  S2.corridaRank.semanal = {
    single: { lista: [{ pos: 1, nome: 'CIDA', tempo: 22, time: t2, eu: false }], meu: null },
    relay:  { lista: [], meu: null }
  };
  S2.corridaRank.semanaId = '2026-09-21';
  S2.rankTrocarAba('corrida', 'semana');
  const hc = S2.corridaRankHtml();
  ok('a Corrida desenha as abas', (hc.match(/<button class="tower-rank-aba/g) || []).length === 2);
  ok('  e mostra a semana da modalidade corrente', /CIDA/.test(hc) && !/ANA/.test(hc));
  /* ⚠️ O MODAL DO TIME LÊ A MESMA CÉLULA: com `corridaRank[formato]` direto, um toque na aba da
     SEMANA abriria o time do ranking de SEMPRE -- e o modal mostraria um time que não é o da linha. */
  S2.corridaVerTimeDoRank('lista', 0);
  ok('o modal do time abre o da SEMANA', S2.corrida.timeDoRank &&
     S2.corrida.timeDoRank.time[0].speciesId === 'raichu',
     S2.corrida.timeDoRank ? S2.corrida.timeDoRank.time[0].speciesId : 'nao abriu');
  S2.rankTrocarAba('corrida', 'sempre');
  S2.corridaVerTimeDoRank('lista', 0);
  ok('  e na aba de sempre, o de sempre', S2.corrida.timeDoRank &&
     S2.corrida.timeDoRank.time[0].speciesId === 'jolteon',
     S2.corrida.timeDoRank ? S2.corrida.timeDoRank.time[0].speciesId : 'nao abriu');
  /* ⚠️ E A MODALIDADE CONTINUA SENDO UM EIXO À PARTE: trocar de aba não pode trocar de prova. */
  S2.rankTrocarAba('corrida', 'semana');
  S2.corrida.formato = 'relay';
  const hv = S2.corridaRankHtml();
  ok('o revezamento vazio na semana diz "nesta semana"', /nesta semana ainda/.test(hv),
     (hv.match(/hint-text">([^<]*)/)||[])[1]);

  /* ⚠️ E UMA LISTA QUE AINDA NÃO CHEGOU NÃO PODE QUEBRAR: o semanal vem na mesma resposta, mas um
     cliente que leu antes do deploy (ou um erro de rede) tem `semanal` nulo -- e aí a aba da
     semana cai no de sempre em vez de estourar. */
  S2.pescariaRank.semanal = null;
  S2.rankTrocarAba('pescaria', 'semana');
  const hn = S2.pescariaRankHtml();
  ok('sem a lista da semana ele cai no de sempre', JSON.stringify(nomes(hn)) === '["ANA"]', JSON.stringify(nomes(hn)));
}

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas ? 1 : 0);

})().catch(e => { console.error(e); process.exit(1); });
