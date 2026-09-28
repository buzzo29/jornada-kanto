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
  /* ⚠️ OS VALORES SAEM DA TABELA, nunca cravados: ela já mudou uma vez (27/09/2026, de
     2 doces / 1 doce / 🪙 50 pra 1 doce / 🪙 75 / 🪙 30) e derrubou quatro arquivos de teste que
     cravavam o número. O que a trava cobra é a REGRA: cada degrau paga o que a tabela diz, o
     empatado no topo leva o MESMO do 1º, e o pagamento DESCE degrau a degrau. */
  const PR = S.RANK_SEMANAL_PREMIOS;
  const valor = (p) => (p.doces || 0) * 300 + (p.moedas || 0);    // o doce custa 🪙 300 na loja
  ok('o 1º leva o prêmio do topo', await doces('p1') === PR[0].doces && await moedas('p1') === PR[0].moedas,
     (await doces('p1')) + ' doce(s) + 🪙 ' + (await moedas('p1')));
  ok('  e o EMPATADO no topo leva o MESMO', await doces('p2') === PR[0].doces && await moedas('p2') === PR[0].moedas,
     (await doces('p2')) + ' doce(s) + 🪙 ' + (await moedas('p2')));
  ok('o 2º leva o do segundo degrau', await doces('p3') === PR[1].doces && await moedas('p3') === PR[1].moedas,
     (await doces('p3')) + ' doce(s) + 🪙 ' + (await moedas('p3')));
  ok('o 3º leva o do terceiro', await doces('p4') === PR[2].doces && await moedas('p4') === PR[2].moedas,
     (await doces('p4')) + ' doce(s) + 🪙 ' + (await moedas('p4')));
  ok('  e o pagamento DESCE degrau a degrau', valor(PR[0]) > valor(PR[1]) && valor(PR[1]) > valor(PR[2]) && valor(PR[2]) > 0,
     PR.map(valor).join(' > '));
  ok('o 4º não leva nada', await doces('p5') === 0 && await moedas('p5') === 0);
  /* ⚠️ A NOTIFICAÇÃO DIZ O QUE ELE GANHOU -- prêmio que o jogador não vê é o erro da
     especialidade de novo (ela valia 1%, não tinha selo, e a conclusão foi "não mudou nada"). */
  const n = await db.collection('users').doc('p1').collection('notifications').get();
  const txt = n.docs.map(d => (d.data().title || '') + ' ' + (d.data().body || '')).join(' | ');
  ok('a notificação nomeia a posição', /líder da semana/.test(txt), txt.slice(0, 80));
  /* ⚠️ SINGULAR AGORA (1 doce): a frase é montada do número, então cravar "Doces Raros" era
     exatamente o que quebrou quando a tabela mudou. */
  ok('  e o que ele ganhou', /Doce Raro/.test(txt), txt.slice(txt.indexOf('Ganhou'), txt.indexOf('Ganhou') + 30));
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
  const umDoce = S.RANK_SEMANAL_PREMIOS[0].doces;
  ok('o individual pagou o prêmio do topo', d1 === umDoce, String(d1));
  ok('  e o revezamento pagou DE NOVO (são dois rankings)', d2 === 2 * umDoce, String(d2));
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
  ok('  e o Z1 ganhou o prêmio do topo',
     (((await conta('z1').get()).data() || {}).rareCandies || 0) === S.RANK_SEMANAL_PREMIOS[0].doces);
  /* e ele varre mais de uma semana pra trás, pra uma que ficou pra fora se recuperar sozinha */
  ok('ele varre ' + S.RANK_SEMANAS_A_FECHAR + ' semanas pra trás', S.RANK_SEMANAS_A_FECHAR >= 2);
}

console.log('\n=== A SEMANA NOVA NASCE VAZIA (28/09/2026) ===');
{
  /* ⚠️ AQUI HAVIA A TRAVA DA COPIA INICIAL, e ela virou o CONTRARIO -- porque a copia era o
     defeito. Ela nasceu em 23/09 como migracao de uma vez, mas a marca era por SEMANA: ela
     rodava TODA SEGUNDA e despejava o quadro de TODOS OS TEMPOS dentro da semana recem-nascida.
     Relatado em 28/09 (o ranking da semana continua os valores da semana passada -- eram os de
     SEMPRE), e o log do cron confirmou: fishingRanking/2026-09-28, 10 copiados do geral.
     ⚠️ E O ESTRAGO NAO ERA SO VISUAL: a semana anterior tambem nasceu copiada, entao o PODIO e
     os PREMIOS dela foram pros lideres de sempre, e nao pra quem se destacou na semana. */
  const semNova = S.semanaDoRanking();
  await db.collection('fishingRanking').doc('lenda').set({ uid:'lenda', nome:'Lenda', pontos: 9999 });
  await S.fecharSemanasPendentes();   /* o cron inteiro, como ele roda de verdade */
  const naSemana = await S.rankSemanaPlayersRef('fishingRanking', semNova).get();
  ok('o recordista DE SEMPRE nao aparece na semana nova',
     !naSemana.docs.some(d => d.id === 'lenda'),
     naSemana.docs.map(d => d.id).join(', ') || '(vazia)');
  /* ⚠️ E A FUNCAO NAO EXISTE MAIS: consertar a marca deixaria uma copia uma-vez-na-vida -- uma
     funcao que nunca mais roda, do tipo que fica anos no arquivo sem ninguem saber que morreu. */
  ok('  e a copiarGeralParaASemana nao existe mais', typeof S.copiarGeralParaASemana === 'undefined');
  ok('  e o cron nao a chama', SRV.indexOf('await copiarGeralParaASemana()') < 0);
}

console.log('\n=== O SERVIDOR: as listas e as portas (lendo o código) ===');
{
  /* ⚠️ ESTA TRAVA FIXAVA "QUATRO" e caiu em 24/09/2026, com o código certo, quando a ARENA entrou
     na lista -- a família que já envelheceu meia dúzia de vezes neste projeto. Ela não foi
     afrouxada: passou a cobrar a REGRA (um pódio por MODALIDADE, nenhum repetido, e a Corrida sendo
     a única em que MENOR é melhor), que é o que ela sempre quis provar. O número sai da tabela. */
  const chaves = S.RANKS_SEMANAIS.map(x => x.base + '.' + x.campo);
  ok('há um pódio por modalidade, e a Corrida tem DUAS',
     chaves.length >= 4 && S.RANKS_SEMANAIS.filter(x => x.base === 'raceRanking').length === 2,
     JSON.stringify(chaves));
  ok('  e nenhum repete', new Set(chaves).size === chaves.length);
  /* ⚠️ MENOR É MELHOR É SÓ DA CORRIDA: lá o placar é TEMPO. Um ranking novo que nascesse com
     `maior: false` estaria medindo tempo -- e o texto da notificação o trataria como segundos. */
  ok('  a Corrida é a ÚNICA em que MENOR é melhor',
     S.RANKS_SEMANAIS.filter(x => !x.maior).every(x => x.base === 'raceRanking')
     && S.RANKS_SEMANAIS.filter(x => !x.maior).length === 2);
  ok('  e todo o resto é MAIOR é melhor',
     S.RANKS_SEMANAIS.filter(x => x.maior).length === chaves.length - 2);
  /* ⚠️ E A UNIDADE SÓ EXISTE EM QUEM MEDE UM CONTADOR: os outros medem PLACAR, e declará-la neles
     trocaria a frase de uma notificação que já está no ar. */
  ok('  e só quem mede CONTADOR declara `unidade`',
     S.RANKS_SEMANAIS.filter(x => x.unidade).every(x => x.base === 'arenaRanking'),
     S.RANKS_SEMANAIS.filter(x => x.unidade).map(x => x.base).join(',') || '(nenhum)');
  /* ⚠️ ESTA CONTINUA CRAVADA, de propósito: ela é a única que prova que o PEDIDO de 27/09/2026
     ("1 rare candy, 75 moedas, 30 moedas") foi feito. As outras derivam dela. */
  ok('os prêmios são 1 doce / 🪙 75 / 🪙 30',
     JSON.stringify(S.RANK_SEMANAL_PREMIOS.map(p => p.doces + ':' + p.moedas)) === '["1:0","0:75","0:30"]',
     JSON.stringify(S.RANK_SEMANAL_PREMIOS.map(p => p.doces + ':' + p.moedas)));
  /* ⚠️ E A CÓPIA DA TELA TEM QUE BATER COM ELA -- o molde do `MOEDA_MODO_DIFICIL`: quem paga é o
     servidor, e o cliente precisa dos números pra a nota da aba e pro pódio não mentirem. */
  {
    const m = HTML.match(/const RANK_PREMIOS_TELA = \[([\s\S]{0,240}?)\];/);
    const naTela = m ? (m[1].match(/doces:\s*(\d+),\s*moedas:\s*(\d+)/g) || [])
      .map(s => s.match(/doces:\s*(\d+),\s*moedas:\s*(\d+)/).slice(1,3).join(':')) : null;
    ok('  e a cópia da TELA é a mesma tabela',
       !!naTela && JSON.stringify(naTela) === JSON.stringify(S.RANK_SEMANAL_PREMIOS.map(p => p.doces + ':' + p.moedas)),
       naTela ? JSON.stringify(naTela) : '(não achei o RANK_PREMIOS_TELA no index.html)');
    /* ⚠️ E A NOTA É MONTADA DELA, nunca escrita: a frase antiga ("ganhe Doces Raros") prometia doce
       pros três degraus e sobreviveu à mudança da tabela -- é a família de texto que mente. */
    /* ⚠️ A FATIA É A FUNÇÃO, nunca o arquivo inteiro: a primeira versão desta trava procurava a
       frase velha no HTML todo e acusava O PRÓPRIO COMENTÁRIO que explica por que ela saiu -- a
       família que o CLAUDE.md registra ("citar nome de líder num comentário faz um teste que
       procura nome de líder acusar o comentário"). */
    const iN = HTML.indexOf('function notaDoPremioSemanal(');
    const corpoNota = iN > 0 ? HTML.slice(iN, HTML.indexOf('\n}', iN)) : '';
    ok('  (a fatia da nota tem o que ler)', corpoNota.length > 200, String(corpoNota.length));
    ok('  e a nota da aba é montada da tabela (nenhum prêmio escrito à mão)',
       /premiosSemanaisHtml\(\)/.test(corpoNota)
       && !/Doce|🪙|\d\s*moeda/.test(corpoNota),
       /Doce|🪙/.test(corpoNota) ? 'tem prêmio escrito na frase' : '');
  }
  /* ⚠️ O CRON CHAMA AS DUAS, E A CÓPIA VEM ANTES: os casos chamam as funções na mão e passariam
     com a chamada órfã -- a mesma trava que o `applySpecialtyBuff` e o `equiparItens` já têm. */
  /* ⚠️ A TRAVA DA CÓPIA VIROU A DA AUSÊNCIA DELA (28/09/2026): ela cobrava que o cron chamasse a
     `copiarGeralParaASemana` e que ela viesse ANTES do fechamento -- e a cópia era o defeito
     (ver **A SEMANA NOVA NASCE VAZIA**, mais acima). */
  ok('o cron chama o fechamento', SRV.indexOf('await fecharSemanasPendentes()') > 0);
  ok('  e NÃO chama mais a cópia inicial', SRV.indexOf('await copiarGeralParaASemana()') < 0);
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
  ok('  com a nota do prêmio', /Lidere a semana:/.test(h) && /Doce Raro/.test(h) && /🪙 75/.test(h));
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

console.log('\n=== O PÓDIO DA SEMANA QUE FECHOU: o resumo no servidor (27/09/2026) ===');
{
  /* ⚠️ O `podium_` sozinho é uma lista de PLACARES -- um popup que diz "900, 700, 500" sem dizer
     QUEM não anuncia nada. O resumo é o que carrega os NOMES, e ele é escrito na MESMA gravação do
     pódio (antes de pagar e antes do `awarded`): escrito depois, uma semana que estourasse no meio
     do laço ficaria sem resumo pra sempre. */
  const sem = '2026-07-06';
  for(const [u, p] of [['r1', 900], ['r2', 900], ['r3', 700], ['r4', 500], ['r5', 100]]){
    await conta(u).set({ trainerName: u.toUpperCase() });
    await semana('fishingRanking', sem, u).set({ uid: u, nome: u.toUpperCase(), pontos: p, semanaId: sem });
  }
  await S.fecharSemanaDoRanking('fishingRanking', sem, 'pontos', true, 'Pescaria');
  const d = (await S.rankSemanaDocRef('fishingRanking', sem).get()).data() || {};
  const res = d.resumo_pontos;
  ok('o fechamento grava o resumo com NOMES', Array.isArray(res) && res.length === 3,
     JSON.stringify(res));
  ok('  e o degrau DIVIDIDO traz os dois nomes',
     JSON.stringify(res[0].nomes) === '["R1","R2"]' && res[0].total === 2 && res[0].valor === 900,
     JSON.stringify(res[0]));
  ok('  e os nomes vêm ORDENADOS (o corte é o mesmo em toda leitura)',
     JSON.stringify(res[0].nomes) === JSON.stringify(res[0].nomes.slice().sort()));
  ok('  e os degraus 2 e 3 são os placares seguintes',
     res[1].valor === 700 && res[2].valor === 500 && res[1].pos === 2 && res[2].pos === 3,
     res.map(x => x.pos + ':' + x.valor).join(' '));
  ok('  e o 4º (100 pts) NÃO entra', JSON.stringify(res).indexOf('R5') < 0);
  /* ⚠️ E ELE VEM ANTES DO `awarded` no código -- a mesma ordem que protege o pagamento. */
  /* ⚠️ A FATIA COMEÇA NO CÁLCULO DO PÓDIO, e não no início da função: o ramo da semana VAZIA marca
     o `awarded` ali mesmo (não há o que pagar), então medir desde o topo compara com a marca
     ERRADA e a trava dá falso negativo. É a mesma fatia que a trava irmã (a do awarded) usa. */
  const corpoF = SRV.slice(SRV.indexOf('async function fecharSemanaDoRanking('));
  const fatiaF0 = corpoF.slice(0, corpoF.indexOf('async function premiarSemana('));
  const fatiaF = fatiaF0.slice(fatiaF0.indexOf('const valores = '));
  ok('  (a fatia do pódio tem o que ler)', fatiaF.length > 200 && fatiaF.indexOf('[marca]: true') > 0,
     String(fatiaF.length));
  ok('  e o resumo é gravado ANTES da marca awarded',
     fatiaF.indexOf("'resumo_'") > 0 && fatiaF.indexOf("'resumo_'") < fatiaF.indexOf('[marca]: true'),
     fatiaF.indexOf("'resumo_'") + ' < ' + fatiaF.indexOf('[marca]: true'));
}

console.log('\n=== E A CALLABLE QUE O POPUP LÊ ===');
{
  const anterior = S.semanaDoRanking(Date.now() - 7 * DIA);
  await conta('pod1').set({ trainerName: 'POD1' });
  await semana('rescueRanking', anterior, 'pod1').set({ uid:'pod1', nome:'POD1', pontos: 300, semanaId: anterior });
  await semana('arenaRanking', anterior, 'pod1').set({ uid:'pod1', nome:'POD1', nivel: 12, semanaId: anterior });
  /* ⚠️ O PAINEL PRECISA DESMARCAR A SEMANA: o bloco do cron, lá em cima, já rodou o
     `fecharSemanasPendentes` -- sem isto os pódios novos nascem numa semana que já está fechada e
     o `fecharSemanaDoRanking` vai embora na porta. Medir isso era medir o conjunto vazio. */
  for(const b of ['fishingRanking','rescueRanking','raceRanking','arenaRanking']){
    await S.rankSemanaDocRef(b, anterior).set(
      { awarded_pontos:false, awarded_single:false, awarded_relay:false, awarded_nivel:false }, { merge:true });
  }

  /* ⚠️ ANTES DE O CRON FECHAR ela não anuncia nada: a semana vira à meia-noite de segunda e o cron
     passa de hora em hora -- anunciar ali seria anunciar um pódio antes de pagar. */
  const cru = await chamar(fns.getIslandsWeeklyPodium, 'pod1', {});
  ok('sem o fechamento ela NÃO anuncia', cru && cru.pronto === false, JSON.stringify(cru));

  await S.fecharSemanasPendentes();
  const r = await chamar(fns.getIslandsWeeklyPodium, 'pod1', {});
  ok('depois do fechamento ela traz os pódios', !!r && r.pronto === true && r.podios.length >= 2,
     r ? (r.semanaId + ': ' + r.podios.map(p => p.rotulo).join(', ')) : '');
  ok('  e a semana é a ANTERIOR, nunca a corrente', r.semanaId === anterior,
     r.semanaId + ' x corrente ' + S.semanaDoRanking());
  const arena = r.podios.find(p => p.rotulo === 'Arena 1x1');
  ok('  e a Arena declara a UNIDADE (nível, não pontos)', !!arena && arena.unidade === 'nivel',
     arena ? String(arena.unidade) : '(sem Arena)');
  ok('  e o degrau traz nome e valor',
     !!arena && arena.degraus[0].nomes[0] === 'POD1' && arena.degraus[0].valor === 12,
     arena ? JSON.stringify(arena.degraus[0]) : '');
  ok('  e ela manda a tabela de prêmios junto',
     JSON.stringify(r.premios) === JSON.stringify(S.RANK_SEMANAL_PREMIOS));

  /* ⚠️ A SAÍDA CURTA: quem já viu custa UMA leitura, e essa é a maioria esmagadora das chamadas --
     a tela das Ilhas abre várias vezes por visita e o popup é uma vez por semana. */
  await conta('pod1').set({ ilhasResumoVisto: anterior }, { merge: true });
  const v = await chamar(fns.getIslandsWeeklyPodium, 'pod1', {});
  ok('quem JÁ VIU recebe a saída curta', !!v && v.visto === true && !v.podios, JSON.stringify(v));
  /* e a marca é do SEMANA, não um booleano: a semana seguinte volta a anunciar */
  await conta('pod1').set({ ilhasResumoVisto: '1999-01-04' }, { merge: true });
  const v2 = await chamar(fns.getIslandsWeeklyPodium, 'pod1', {});
  ok('  e com a marca de OUTRA semana ela anuncia de novo', !!v2 && v2.pronto === true);
}

console.log('\n=== E O POPUP NA TELA DAS ILHAS ===');
{
  const { createSandbox } = require('./game-sandbox');
  const S3 = createSandbox();
  S3.game.authUser = null;                       // sem login ele nem pergunta
  S3.game.screen = 'ilhas';
  S3.game.ilhasResumo = { semanaId: '2026-09-21', pronto: true,
    premios: S.RANK_SEMANAL_PREMIOS,
    podios: [
      { rotulo:'Pescaria', unidade:null, maior:true,  degraus:[
        { pos:1, valor:900, total:2, nomes:['ANA','BIA'] }, { pos:2, valor:700, total:1, nomes:['CIDA'] }] },
      { rotulo:'Corrida individual', unidade:null, maior:false, degraus:[
        { pos:1, valor:18.5, total:1, nomes:['DUDA'] }] },
      { rotulo:'Arena 1x1', unidade:'nivel', maior:true, degraus:[
        { pos:1, valor:12, total:7, nomes:['E1','E2','E3','E4','E5'] }] }
    ] };
  const h = S3.renderIlhasResumoModal();
  ok('o popup nomeia os três modos',
     h.indexOf('Pescaria') > 0 && h.indexOf('Corrida individual') > 0 && h.indexOf('Arena 1x1') > 0);
  ok('  e traz os nomes do degrau dividido', h.indexOf('ANA, BIA') > 0);
  /* ⚠️ A UNIDADE VEM DO SERVIDOR: pontos, TEMPO (menor é melhor) e NÍVEL são três coisas, e uma
     regra própria aqui diria "com 12 pontos" onde o certo é "nível 12". */
  ok('  e a unidade de cada modo está certa',
     h.indexOf('900 pts') > 0 && h.indexOf('18,50s') > 0 && h.indexOf('nível 12') > 0,
     [/900 pts/.test(h), /18,50s/.test(h), /nível 12/.test(h)].join(','));
  /* ⚠️ E O "+N" EXISTE: o pódio é de PLACAR distinto, então um degrau pode ter dez empatados --
     cortar a lista sem dizer quantos sobraram esconderia gente que GANHOU o prêmio. */
  ok('  e o degrau com mais gente que o teto diz "+N"', h.indexOf('+2') > 0);
  ok('  e a data do período aparece', h.indexOf('21/09') > 0 && h.indexOf('27/09') > 0);
  ok('  e os prêmios saem da tabela que veio do servidor',
     h.indexOf('Doce Raro') > 0 && h.indexOf('🪙 75') > 0 && h.indexOf('🪙 30') > 0);

  /* ⚠️ FECHAR É O QUE MARCA, e a marca é o semanaId. */
  S3.fecharResumoDasIlhas();
  ok('fechar marca a semana e some com o popup',
     S3.game.ilhasResumoVisto === '2026-09-21' && !S3.game.ilhasResumo
     && S3.renderIlhasResumoModal() === '',
     String(S3.game.ilhasResumoVisto));

  /* ============================================================================
     ⚠️ O MODAL MUDOU DE TELA EM 28/09/2026: ele nasceu na tela-hub das Ilhas e foi pra HOME, a
     pedido -- *"não apareceu aquele modal no home"*. Eu tinha lido o "quando os usuários entrarem
     ... ver essa tela" do pedido original como sendo a tela das Ilhas.
     ⚠️ E O GATILHO DAS ILHAS SAIU JUNTO, em vez de ficar de reserva: passa-se pela home ANTES de
     chegar nelas, sempre -- então ele nunca dispararia. Estas travas cobram os DOIS lados (está
     na home E não está mais nas Ilhas), porque metade disso é o que o relato pegou.
     ============================================================================ */
  const iR = HTML.indexOf('function renderIlhas(');
  const corpoI = HTML.slice(iR, HTML.indexOf('\n}', iR));
  ok('  (a fatia do renderIlhas tem o que ler)', corpoI.length > 300, String(corpoI.length));
  ok('o modal NÃO está mais na tela das Ilhas', corpoI.indexOf('renderIlhasResumoModal()') < 0);
  const iA = HTML.indexOf('function abrirIlhas(');
  const corpoA = HTML.slice(iA, HTML.indexOf('\n}', iA));
  ok('  e o abrirIlhas não o chama mais', corpoA.indexOf('conferirResumoDasIlhas()') < 0);

  /* ⚠️ E ELE ESTÁ NA HOME, nos DOIS pontos que ela precisa: o gatilho (no carregamento da conta,
     ao lado do `conferirNovidades` -- ali o `ilhasResumoVisto` já foi lido) e a pilha de modais. */
  const iL = HTML.indexOf('conferirNovidades();');
  ok('a home CHAMA o conferirResumoDasIlhas no carregamento da conta',
     iL > 0 && HTML.indexOf('conferirResumoDasIlhas();', iL) > 0
     && HTML.indexOf('conferirResumoDasIlhas();', iL) - iL < 600);
  ok('  e o modal entra na pilha de modais da home',
     /if\(game\.ilhasResumo\)\{ html \+= renderIlhasResumoModal\(\); \}/.test(HTML));

  const iC = HTML.indexOf('async function conferirResumoDasIlhas(');
  const corpoC = HTML.slice(iC, HTML.indexOf('\n}', iC));
  /* ⚠️ A GUARDA DE TELA É A HOME, e o `contaCarregada` vem junto: sem ele o `ilhasResumoVisto` é
     `undefined` no primeiro desenho e o modal reabriria pra quem já fechou -- a mesma lição que o
     `conferirNovidades` já carrega. */
  ok('  e ele só roda na HOME', /game\.screen !== 'saveSelect'/.test(corpoC));
  ok('    e só depois de a conta carregar', /game\.contaCarregada/.test(corpoC));
  /* ⚠️ E O `render()` SÓ NA HOME: a resposta chega por promessa e o jogador pode já ter saído --
     um render() no meio de uma animação mata a transição, a regra da casa. */
  ok('  e o render() do conferir é guardado pela tela',
     /if\(game\.screen === 'saveSelect'\) render\(\)/.test(corpoC));
  ok('  e ele pergunta UMA vez por sessão', corpoC.indexOf('game.ilhasResumoPedido') > 0);

  /* ⚠️ OS TRÊS CAMPOS ESTÃO NO CAMPOS_DA_CONTA: sem eles o resetGame os apagaria ao abrir um save,
     e o popup voltaria pra quem já fechou (mais uma ida ao servidor por save aberto). */
  for(const c of ['ilhasResumoVisto','ilhasResumo','ilhasResumoPedido'])
    ok('  ' + c + ' está no CAMPOS_DA_CONTA', S3.CAMPOS_DA_CONTA.indexOf(c) >= 0);
  /* e a marca sobrevive ao resetGame, que é o que isso compra */
  S3.game.ilhasResumoVisto = '2026-09-21';
  S3.restauraDadosDaConta(S3.snapshotDaConta());
  ok('  e a marca atravessa o snapshot da conta', S3.game.ilhasResumoVisto === '2026-09-21');
}

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas ? 1 : 0);

})().catch(e => { console.error(e); process.exit(1); });
