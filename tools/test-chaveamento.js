/**
 * O CHAVEAMENTO ACEITA MENOS TIMES QUE VAGAS (BYE).
 *
 * Por que isso existe: o `buildRounds` so sabia montar chave do tamanho EXATO do grupo, e o
 * `drawCycle` so formava grupos de 8 ou 16 cravados -- com 13 inscritos, 8 jogavam e 5 iam pro
 * `leftover`. Agora a chave aceita vagas vazias: quem cai num confronto de BYE passa direto pra
 * fase seguinte, sem esperar partida nenhuma.
 *
 * ⚠️ AS DUAS COPIAS (cliente e servidor) TEM QUE CONCORDAR: o chaveamento e montado no servidor e
 * o cliente TAMBEM resolve partida de liga. Uma divergencia aqui faz a mesma liga terminar
 * diferente nos dois -- e por isso a distribuicao dos BYEs e DETERMINISTICA, sem rng.
 *
 *   node tools/test-chaveamento.js
 */
const fs = require('fs');
const { createSandbox } = require('./game-sandbox');

const R = 'C:/Users/Usuario/Documents/jornada-kanto/';
const S = createSandbox();
const srv = require(R + 'functions/index.js');
const srvSrc = fs.readFileSync(R + 'functions/index.js', 'utf8');
const cliSrc = fs.readFileSync(R + 'index.html', 'utf8');

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHOU') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const times = n => Array.from({ length: n }, (_, i) => ({ name: 'T' + (i + 1), uid: 'u' + i }));

/* ---------------------------------------------------------------- 1) NAO-REGRESSAO */
console.log('\n=== SEM O 2o ARGUMENTO, NADA MUDOU ===');
/* ⚠️ ESTE BLOCO E O QUE PERMITE A MUDANCA CABER: os dois chamadores de producao chamam
   `buildRounds(group)` sem tamanho, e ali o resultado tem que ser BYTE A BYTE o de antes. Sem ele,
   uma mudanca no motor de chaveamento mexeria em toda liga que ja funciona. */
function buildRoundsAntigo(players){
  const n = players.length;
  const numRounds = Math.round(Math.log2(n));
  const rounds = {}; const firstRound = [];
  for(let i=0;i<n;i+=2){ firstRound.push({ a:players[i], b:players[i+1], winner:null, matchups:null, resolved:false }); }
  rounds['0'] = firstRound;
  let mc = firstRound.length;
  for(let r=1;r<numRounds;r++){ mc=mc/2; const rm=[]; for(let i=0;i<mc;i++){ rm.push({ a:null,b:null,winner:null,matchups:null,resolved:false }); } rounds[String(r)]=rm; }
  return rounds;
}
let iguais = 0;
[2,4,8,16,32].forEach(n => {
  if(JSON.stringify(buildRoundsAntigo(times(n))) === JSON.stringify(srv._buildRounds(times(n)))) iguais++;
});
ok('sem tamanho, a chave sai identica a de antes', iguais === 5, iguais + ' de 5 tamanhos');
let iguais2 = 0;
[2,4,8,16].forEach(n => {
  if(JSON.stringify(buildRoundsAntigo(times(n))) === JSON.stringify(srv._buildRounds(times(n), n))) iguais2++;
});
ok('  e com tamanho === nº de times (zero BYEs), também', iguais2 === 4, iguais2 + ' de 4');
/* ⚠️ ESTA TRAVA MEDIA A REGRA DE ONTEM ('ninguem passa tamanho'), que era a nao-regressao enquanto o
   BYE existia e nao era usado. Hoje os dois chamadores PASSAM tamanho -- e a nao-regressao virou
   outra: TODO MULTIPLO DE 8 tem que formar exatamente os mesmos grupos de antes. */
ok('  e os dois chamadores de produção passam o tamanho da chave',
   (srvSrc.match(/rounds: buildRounds\(group, bracket\)/g) || []).length === 1 &&
   (cliSrc.match(/rounds: buildRounds\(group, bracket\)/g) || []).length === 1 &&
   !/rounds: buildRounds\(group\)/.test(srvSrc) && !/rounds: buildRounds\(group\)/.test(cliSrc),
   'servidor ' + (srvSrc.match(/rounds: buildRounds\(group, bracket\)/g)||[]).length + 'x, cliente ' + (cliSrc.match(/rounds: buildRounds\(group, bracket\)/g)||[]).length + 'x');

/* ---------------------------------------------------------------- 2) A POTENCIA DE 2 */
console.log('\n=== A PROXIMA POTENCIA DE 2 ===');
const P = srv._proximaPotenciaDe2;
ok('3 → 4, 5 → 8, 7 → 8, 9 → 16, 13 → 16, 15 → 16, 20 → 32',
   P(3)===4 && P(5)===8 && P(7)===8 && P(9)===16 && P(13)===16 && P(15)===16 && P(20)===32);
ok('  e potência exata não sobe', P(8)===8 && P(16)===16 && P(32)===32);
/* ⚠️ O PISO E 2, e nao e zelo: com 1 time a chave seria de 1, `log2(1) = 0`, o laço das rodadas
   nao roda NENHUMA vez e a liga nasce sem confronto -- travada, sem nunca definir campeao. */
ok('  e o piso é 2 (uma chave de 1 não é chave)', P(1)===2 && P(0)===2);

/* ---------------------------------------------------------------- 3) ONDE OS BYES CAEM */
console.log('\n=== OS BYES SAO ESPALHADOS ===');
const C = srv._calcularPosicoesBye;
ok('sem BYE, lista vazia', C(8,0).length === 0 && C(8,-1).length === 0);
const p3 = C(8,3);
ok('3 BYEs em 8 confrontos: ' + p3.join(', '), p3.length === 3 && new Set(p3).size === 3);
/* ⚠️ O QUE IMPORTA NAO E A POSICAO EXATA, E O ESPALHAMENTO: amontoados numa ponta, uma METADE da
   chave passaria quase inteira direto. A trava mede o VAO entre eles, nao os indices -- cravar
   `[0,2,5]` faria ela cair no primeiro ajuste do algoritmo, medindo a forma e nao a regra. */
const vaoMin = Math.min(...p3.slice(1).map((x,i) => x - p3[i]));
ok('  e o vão entre eles é pelo menos 2', vaoMin >= 2, 'menor vão: ' + vaoMin);
ok('  e nenhum BYE cai fora da chave', C(8,3).every(x => x >= 0 && x < 8) && C(4,3).every(x => x >= 0 && x < 4));
/* ⚠️ O TETO E UM POR CONFRONTO -- e ele que garante o `TIME x BYE` e proibe `BYE x BYE`. */
ok('  e nunca há mais BYEs que confrontos', C(4,9).length === 4, C(4,9).length + ' em 4 confrontos');
ok('  e a lista sai ordenada', JSON.stringify(C(8,3)) === JSON.stringify(C(8,3).slice().sort((a,b)=>a-b)));

/* ---------------------------------------------------------------- 4) A CHAVE COM BYE */
console.log('\n=== A CHAVE COM VAGAS VAZIAS ===');
const r13 = srv._buildRounds(times(13), 16);
ok('13 times numa chave de 16', Object.keys(r13).length === 4, Object.keys(r13).length + ' rodadas');
ok('  → 8 confrontos na primeira fase', r13['0'].length === 8);
ok('  → 3 BYEs', r13['0'].filter(m => m.bye).length === 3);
ok('  → 5 partidas de verdade', r13['0'].filter(m => !m.bye).length === 5);
/* ⚠️ A CONTA QUE FECHA: 5 vencedores + 3 que passaram direto = 8 nas quartas. */
ok('  e os 13 times entraram, sem repetir nem sumir', (() => {
  const vistos = [];
  r13['0'].forEach(m => { if(m.a) vistos.push(m.a.name); if(m.b) vistos.push(m.b.name); });
  return vistos.length === 13 && new Set(vistos).size === 13;
})());
ok('  e NUNCA existe BYE x BYE', r13['0'].every(m => !m.bye || !!m.a));
ok('  e nunca existe confronto totalmente vazio', r13['0'].every(m => m.a || m.b));

console.log('\n--- o confronto de BYE já nasce resolvido ---');
const bye = r13['0'].find(m => m.bye);
const normal = r13['0'].find(m => !m.bye);
ok('BYE: time1 preenchido, time2 null', !!bye.a && bye.b === null);
ok('  bye: true', bye.bye === true);
ok('  vencedor já definido', bye.winner === bye.a);
ok('  status finalizado (resolved)', bye.resolved === true);
ok('partida normal: os dois lados', !!normal.a && !!normal.b);
ok('  bye ausente/falso', !normal.bye);
ok('  sem vencedor, aguardando', normal.winner === null && normal.resolved === false);

console.log('\n--- e ele avança sozinho pra fase seguinte ---');
/* ⚠️ A LIGACAO ENTRE AS RODADAS E DERIVADA DO INDICE, nao um campo: o confronto `mi` alimenta o
   `floor(mi/2)` da rodada seguinte, na posicao `a` se `mi` e par e `b` se e impar. */
let promovidos = 0, certos = 0;
r13['0'].forEach((m, mi) => {
  if(!m.bye) return;
  promovidos++;
  const prox = r13['1'][Math.floor(mi/2)];
  if((mi % 2 === 0 ? prox.a : prox.b) === m.winner) certos++;
});
ok('os 3 BYEs já estão na fase seguinte', promovidos === 3 && certos === 3, certos + ' de ' + promovidos);
ok('  e na posição certa da chave (par → time1, ímpar → time2)', certos === promovidos);
ok('  e a fase seguinte tem 4 confrontos', r13['1'].length === 4);

/* ---------------------------------------------------------------- 5) PONTA A PONTA */
console.log('\n=== DA CHAVE ATE O CAMPEAO ===');
/* ⚠️ ESTE BLOCO E O QUE IMPORTA: ele repete o laco do `advanceCyclePhases` -- que so resolve
   confronto com OS DOIS lados -- e cobra que a liga TERMINA. Um BYE que nao fosse promovido
   deixaria a fase seguinte com um lado vazio pra sempre, e a liga travaria sem campeao. */
function rodarAteOFim(rounds){
  const ks = Object.keys(rounds).sort((a,b) => Number(a)-Number(b));
  for(let ri=0; ri<ks.length; ri++){
    const round = rounds[ks[ri]];
    for(let mi=0; mi<round.length; mi++){
      const m = round[mi];
      if(!m.resolved && m.a && m.b){ m.winner = m.a; m.resolved = true; }
      if(!m.resolved) return { erro: 'travou na rodada ' + ri + ', confronto ' + mi };
      if(ri+1 < ks.length){
        const nx = rounds[ks[ri+1]][Math.floor(mi/2)];
        if(mi % 2 === 0) nx.a = m.winner; else nx.b = m.winner;
      } else return { campeao: m.winner.name, rodadas: ks.length };
    }
  }
  return { erro: 'nao chegou ao fim' };
}
const CASOS = [[5,8],[9,16],[13,16],[15,16],[8,8],[16,16],[27,32],[57,64]];
let chegaram = 0;
CASOS.forEach(([n, size]) => {
  const res = rodarAteOFim(srv._buildRounds(times(n), size));
  if(res.campeao) chegaram++;
  else console.log('     ' + n + '/' + size + ': ' + res.erro);
});
ok('toda chave chega a um campeão', chegaram === CASOS.length, chegaram + ' de ' + CASOS.length);
let semDuplo = 0, semVazio = 0, todosEntram = 0;
CASOS.forEach(([n, size]) => {
  const r = srv._buildRounds(times(n), size);
  if(r['0'].every(m => !m.bye || !!m.a)) semDuplo++;
  if(r['0'].every(m => m.a || m.b)) semVazio++;
  const vistos = []; r['0'].forEach(m => { if(m.a) vistos.push(m.a.name); if(m.b) vistos.push(m.b.name); });
  if(vistos.length === n && new Set(vistos).size === n) todosEntram++;
});
ok('  e nenhuma tem BYE x BYE', semDuplo === CASOS.length);
ok('  e nenhuma tem confronto vazio', semVazio === CASOS.length);
ok('  e todos os inscritos entram na chave', todosEntram === CASOS.length);

/* ---------------------------------------------------------------- 6) AS DUAS COPIAS */
console.log('\n=== CLIENTE E SERVIDOR CONCORDAM ===');
/* ⚠️ ISSO NAO E ZELO: o chaveamento e montado no SERVIDOR e o cliente tambem resolve partida de
   liga. Se as duas copias divergirem, a mesma liga termina diferente nos dois -- e ninguem sabe
   qual esta certa. E por isso que a distribuicao dos BYEs nao pode usar `Math.random`. */
let batem = 0;
CASOS.forEach(([n, size]) => {
  if(JSON.stringify(srv._buildRounds(times(n), size)) === JSON.stringify(S.buildRounds(times(n), size))) batem++;
});
ok('a chave é idêntica nos dois motores', batem === CASOS.length, batem + ' de ' + CASOS.length + ' casos');
let bateBye = 0;
[[8,3],[8,1],[16,7],[4,3],[32,5]].forEach(([t,b]) => {
  if(JSON.stringify(srv._calcularPosicoesBye(t,b)) === JSON.stringify(S.calcularPosicoesBye(t,b))) bateBye++;
});
ok('  e a distribuição dos BYEs também', bateBye === 5, bateBye + ' de 5');
/* ⚠️ E ELA E DETERMINISTICA: duas chamadas iguais dao o mesmo resultado, sempre. */
ok('  e ela é determinística (10 chamadas, mesmo resultado)', (() => {
  const um = JSON.stringify(srv._calcularPosicoesBye(8,3));
  for(let i=0;i<10;i++) if(JSON.stringify(srv._calcularPosicoesBye(8,3)) !== um) return false;
  return true;
})());
ok('  e não há Math.random no caminho da chave',
   !/function calcularPosicoesBye[\s\S]{0,700}Math\.random/.test(srvSrc) &&
   !/function buildRounds[\s\S]{0,1600}Math\.random/.test(srvSrc));

/* ---------------------------------------------------------------- 7) O QUE O BYE NAO PODE FAZER */
console.log('\n=== O BYE NAO VIRA BATALHA, E NAO GANHA TERRENO ===');
/* ⚠️ A GUARDA DO AVANCO JA EXISTIA (`!match.resolved && match.a && match.b`) e e ela que faz o BYE
   nunca virar batalha -- ele chega resolvido e com um lado so. A trava le o codigo porque o caso
   e de AUSENCIA: nada acontece, e um teste de comportamento nao distingue "pulou" de "nao rodou". */
/* ⚠️ SAO DUAS GUARDAS, nao uma: o `advanceCyclePhases` resolve, e antes dele ha um "existe algo
   pendente?" que decide se vale a pena abrir a transacao. As DUAS precisam da mesma condicao --
   com a segunda sozinha, um BYE contaria como trabalho pendente e o ciclo ficaria acordando de
   minuto em minuto pra nao fazer nada. E elas vivem nos DOIS motores. */
ok('o avanço só resolve confronto com os DOIS lados (as 2 guardas, nos 2 motores)',
   (srvSrc.match(/if\(!match\.resolved && match\.a && match\.b\)/g) || []).length === 2 &&
   (cliSrc.match(/if\(!match\.resolved && match\.a && match\.b\)/g) || []).length === 2);
ok('  e o BYE não recebe terreno', /if\(!match\.bye\) assignMatchTerrain/.test(srvSrc));

console.log('\n--- o aviso de início ---');
/* ⚠️ ELE VIROU FUNCAO pra PODER ser exercitado: enquanto as duas frases eram montadas inline no
   meio do laco, a unica trava possivel era procurar o TEXTO no fonte -- e um `const corpo = false`
   deixa as duas frases la, intactas, com o ramo do BYE inalcancavel. A trava passava em branco
   sobre o defeito inteiro, e so a conferencia de acusacao mostrou. */
const A = srv._avisoDeInicioDeLiga;
const labels = ['Oitavas de Final','Quartas de Final','Semifinal','Final'];
const avBye = A({ a:{name:'T1'}, b:null, bye:true }, 'a', labels, 'Liga Pokémon', '14:00', '14:05');
const avNormal = A({ a:{name:'T1'}, b:{name:'T2'} }, 'a', labels, 'Liga Pokémon', '14:00', '14:05');
ok('quem passou direto é avisado disso', avBye.corpo.indexOf('passou direto pela Oitavas de Final') > 0);
/* ⚠️ E NUNCA "contra a definir": e a frase de quem TEM adversario a definir, e ela mandaria quem
   passou direto esperar uma luta que nao existe. */
ok('  e NÃO diz "contra a definir"', avBye.corpo.indexOf('contra a definir') < 0);
ok('  e aponta a fase SEGUINTE, no horário dela', avBye.corpo.indexOf('na Quartas de Final') > 0 && avBye.corpo.indexOf('14:05') > 0);
ok('  e o título é próprio', avBye.titulo.indexOf('passou direto') > 0);
ok('a partida normal continua nomeando o adversário', avNormal.corpo.indexOf('contra T2') > 0);
ok('  e no horário da primeira fase', avNormal.corpo.indexOf('14:00') > 0 && avNormal.corpo.indexOf('14:05') < 0);
ok('  e sem falar em passar direto', avNormal.corpo.indexOf('passou direto') < 0 && avNormal.titulo.indexOf('passou direto') < 0);
/* ⚠️ E O LADO IMPORTA: o `side` diz quem esta sendo avisado, e o adversario e o OUTRO. Lido ao
   contrario, a mensagem diria ao jogador que ele vai enfrentar a si mesmo. */
ok('  e o lado B é avisado do adversário certo',
   A({ a:{name:'T1'}, b:{name:'T2'} }, 'b', labels, 'Liga Pokémon', '14:00', '14:05').corpo.indexOf('contra T1') > 0);
ok('  e o nome da liga entra', avNormal.corpo.indexOf('A Liga Pokémon') === 0);
ok('  e sem nome ela cai no padrão', A({ a:{name:'T1'}, b:{name:'T2'} }, 'a', labels, null, '14:00', '14:05').corpo.indexOf('A Liga Pokémon') === 0);
/* e o laco de producao usa a funcao, em vez de montar a frase de novo */
ok('  e o aviso do sorteio sai dessa função', /aviso = avisoDeInicioDeLiga\(match, side, labels,/.test(srvSrc));

/* ---------------------------------------------------------------- 8) A TELA */
console.log('\n=== A TELA ===');
const g = S.__getGame();
g.authUser = { uid: 'u0' };
g.trainerName = 'T1';
const linha = (m) => S.leagueMatchRow(m, 'Oitavas de Final', 1790000000000, 0, '0', 0, r13, null, 'classic');
const htmlBye = linha(r13['0'].find(m => m.bye));
const htmlNormal = linha(r13['0'].find(m => !m.bye));
ok('o confronto de BYE diz "passou direto"', htmlBye.indexOf('passou direto') > 0);
/* ⚠️ E ELE NAO PODE DIZER "aguardando adversario": e a frase do confronto que ESPERA a fase
   anterior, e aqui nao ha o que esperar -- o jogador ficaria olhando uma luta que nunca vem. */
ok('  e NÃO diz "aguardando adversário"', htmlBye.indexOf('aguardando advers') < 0);
ok('  e sai como resolvido, não como pendente', htmlBye.indexOf('league-match resolved') > 0);
ok('  e o nome de quem passou aparece', htmlBye.indexOf('T1') > 0);
ok('a partida normal continua igual', htmlNormal.indexOf('passou direto') < 0);
/* ⚠️ E O CONFRONTO QUE ESPERA DE VERDADE (um lado vindo da fase anterior) continua com a frase
   dele -- sem este caso, trocar as duas frases passaria. */
const esperando = { a: { name:'T9', uid:'u8' }, b: null, winner: null, resolved: false };
ok('  e quem espera a fase anterior continua dizendo "aguardando adversário"',
   linha(esperando).indexOf('aguardando advers') > 0 && linha(esperando).indexOf('passou direto') < 0);
ok('  e o selo do BYE tem regra no CSS', /\.bye-tag\{/.test(cliSrc));

/* ---------------------------------------------------------------- 9) A COLOCACAO */
console.log('\n=== A COLOCACAO ENXERGA QUEM PASSOU DIRETO ===');
/* ⚠️ O `computePlacement` procura o jogador com `m.a && m.b` -- ou seja ele NAO ve um confronto de
   BYE. Quem passa direto e depois perde aparece na fase SEGUINTE com os dois lados, entao ele e
   achado; este caso existe pra provar isso, e nao supor. */
const chave = srv._buildRounds(times(13), 16);
const r = rodarAteOFim(JSON.parse(JSON.stringify(chave)));
ok('a chave de 13 tem campeão', !!r.campeao, r.campeao);
const liga = { champion: { name:'T1' }, rounds: JSON.parse(JSON.stringify(chave)) };
/* monta um desfecho: T1 (que passou direto) campeao, e T4 (que tambem passou) cai nas quartas */
liga.rounds['1'][0].a = { name:'T1' }; liga.rounds['1'][0].b = { name:'T2' };
liga.rounds['1'][1].a = { name:'T4' }; liga.rounds['1'][1].b = { name:'T5' };
ok('  e quem passou direto e caiu depois tem colocação', !!S.computePlacement(liga, 'T4'),
   String(S.computePlacement(liga, 'T4')));
ok('  e o campeão continua sendo Campeão', S.computePlacement(liga, 'T1') === 'Campeão');

/* ============================================================================
   (D) AS CHAVES EQUILIBRADAS: ninguem sobra, e as vagas ficam no minimo possivel.
   ⚠️ O QUE ESTE BLOCO EXISTE PRA PEGAR e o defeito que nao da erro: um agrupamento que forme liga
   com MENOS de 8 (a regra que a Liga Pro depende), que deixe gente de fora sem precisar, ou que
   MUDE os multiplos de 8 -- que e a jornada de quem ja joga hoje.
   ============================================================================ */
console.log('\n--- (D) as chaves equilibradas ---');
const div = srv._dividirEmChaves;
const MAXC = 16, MINC = 8;
const dv = n => div(n, MAXC, MINC);
const vagasDe = n => dv(n).reduce((s,t)=>s+srv._proximaPotenciaDe2(t), 0);

/* ⚠️ A NAO-REGRESSAO: o agrupamento de HOJE, reproduzido aqui, tem que bater em todo multiplo de 8.
   Sem este caso, uma regra que 'equilibrasse' 24 em 12+12 passaria -- e ela trocaria duas chaves
   cheias por duas chaves com OITO byes, piorando o caso que hoje ja e perfeito. */
function agrupamentoDeAntes(n){
  const g = []; let c = 0;
  for(let i=0;i<Math.floor(n/MAXC);i++){ g.push(MAXC); c += MAXC; }
  for(let i=0;i<Math.floor((n-c)/MINC);i++){ g.push(MINC); c += MINC; }
  return g;
}
let mult8 = 0, mult8ok = 0;
for(let n=8;n<=200;n+=8){ mult8++; if(JSON.stringify(agrupamentoDeAntes(n)) === JSON.stringify(dv(n))) mult8ok++; }
ok('todo multiplo de 8 forma os MESMOS grupos de antes', mult8ok === mult8, mult8ok + ' de ' + mult8);

/* ⚠️ E AS VAGAS FICAM NO MINIMO POSSIVEL (`ceil(N/8)*8`), que e o que faz a regra MINIMIZAR BYE em vez
   de so 'equilibrar'. E o caso de 24 e o que separa as duas: 16+8 (zero byes) contra 12+12 (oito). */
let vagasOk = 0, vagasTot = 0;
for(let n=8;n<=500;n++){ vagasTot++; if(vagasDe(n) === Math.ceil(n/MINC)*MINC) vagasOk++; }
ok('  e as vagas ficam no MINIMO possivel (ceil(N/8)*8)', vagasOk === vagasTot, vagasOk + ' de ' + vagasTot);
ok('  24 inscritos: 16+8, ZERO bye (nao 12+12)', JSON.stringify(dv(24)) === JSON.stringify([16,8]), dv(24).join('+'));
ok('  20 inscritos: 12+8 (24 vagas, 4 byes), nao 10+10 (32 vagas, 12)', JSON.stringify(dv(20)) === JSON.stringify([12,8]), dv(20).join('+'));

/* ⚠️ NINGUEM FICA DE FORA acima do minimo -- e o pedido inteiro. */
let sobrou = 0;
for(let n=8;n<=500;n++){ if(dv(n).reduce((s,t)=>s+t,0) !== n) sobrou++; }
ok('  e ninguem fica de fora, de 8 a 500 inscritos', sobrou === 0, sobrou + ' valores de N deixam gente fora');
ok('  13 inscritos formam UMA chave de 16 (antes: 8 jogavam e 5 sobravam)', JSON.stringify(dv(13)) === JSON.stringify([13]), dv(13).join('+'));
ok('  27 formam 16+11 (antes: 16+8 e 3 sobravam)', JSON.stringify(dv(27)) === JSON.stringify([16,11]), dv(27).join('+'));
ok('  57 formam 16+16+16+9 (antes: 1 sobrava)', JSON.stringify(dv(57)) === JSON.stringify([16,16,16,9]), dv(57).join('+'));

/* ⚠️ O MINIMO DE 8 CONTINUA SENDO O MINIMO. Sem este caso, uma regra que formasse liga com 5 quebraria
   a Liga Pro ('no minimo 8 treinadores') E faria a faixa dela girar num ciclo que nao devia. */
let abaixo = 0;
for(let n=0;n<8;n++){ if(dv(n).length) abaixo++; }
ok('  abaixo de 8 nao se forma liga nenhuma', abaixo === 0, abaixo + ' valores de N formaram');

/* ⚠️ E NENHUMA CHAVE FICA ABAIXO DE 8: uma chave de 1 coroaria campeao sem uma unica partida. */
let menorChave = 999;
for(let n=8;n<=500;n++) dv(n).forEach(t => { if(t < menorChave) menorChave = t; });
ok('  e nenhuma chave nasce abaixo de 8', menorChave >= 8, 'a menor tem ' + menorChave);

/* ⚠️ E NUNCA PASSA DE 4 RODADAS -- e o que faz a (D) caber na maquina de fases, que tem QUATRO
   horarios fixos (`phaseTimes`) e rotulos so pra chave de 3 e de 4 rodadas. Uma chave de 32 precisaria
   de 5 e uma de 64 de 6: era por isso que 'uma chave so' nao cabia. */
let maxRodadas = 0;
for(let n=8;n<=500;n++) dv(n).forEach(t => {
  const r = Object.keys(srv._buildRounds(times(t), srv._proximaPotenciaDe2(t))).length;
  if(r > maxRodadas) maxRodadas = r;
});
ok('  e nenhuma chave passa de 4 rodadas (a maquina de fases tem 4 horarios)', maxRodadas === 4, maxRodadas + ' rodadas no maximo');

/* ⚠️ O PIOR CASO E N ≡ 1 (mod 8): 7 BYEs na ultima chave, ou seja 8 dos 9 dela passam direto. Fica
   FIXADO pra ser decisao e nao surpresa -- e o preco de ninguem ficar de fora. */
let piorBye = 0;
for(let n=8;n<=500;n++) dv(n).forEach(t => { const b = srv._proximaPotenciaDe2(t) - t; if(b > piorBye) piorBye = b; });
ok('  o pior caso de BYE numa chave e 7 (N ≡ 1 mod 8)', piorBye === 7, 'o pior visto e ' + piorBye);

/* ---- o computePlacement nao promete lugar que nao existe ---- */
const plac = srv._computePlacement;
const chaveCom = (n, bracket) => {
  const r = srv._buildRounds(times(n), bracket);
  /* resolve tudo pra frente: o `a` sempre ganha */
  const ks = Object.keys(r).sort((a,b)=>Number(a)-Number(b));
  ks.forEach((k, ri) => r[k].forEach((m, mi) => {
    if(!m.winner && m.a && m.b){ m.winner = m.a; m.resolved = true; }
    if(m.winner && ri < ks.length-1){ const p = r[ks[ri+1]][Math.floor(mi/2)]; if(mi%2===0) p.a = m.winner; else p.b = m.winner; }
  }));
  return { rounds: r, champion: r[ks[ks.length-1]][0].winner, size: bracket };
};
const c16 = chaveCom(16, 16);
ok('chave CHEIA de 16: quem cai na 1ª fase e 9º–16º (identico ao de antes)',
   plac(c16, c16.rounds['0'][1].b.name) === '9º–16º Lugar', plac(c16, c16.rounds['0'][1].b.name));
const c8 = chaveCom(8, 8);
ok('  chave CHEIA de 8: 5º–8º (identico ao de antes)',
   plac(c8, c8.rounds['0'][1].b.name) === '5º–8º Lugar', plac(c8, c8.rounds['0'][1].b.name));
/* ⚠️ COM 13 NUMA CHAVE DE 16 O TETO E 13, NAO 16: `round.length*2` prometeria um '14º' que nao existe. */
const c13 = chaveCom(13, 16);
const perdedor13 = c13.rounds['0'].find(m => m.a && m.b).b.name;
ok('  13 numa chave de 16: o teto e 13º, nao 16º', plac(c13, perdedor13) === '9º–13º Lugar', plac(c13, perdedor13));
/* ⚠️ E COM 9 A FAIXA TEM UM LUGAR SO: '9º–9º Lugar' se leria como defeito. */
const c9 = chaveCom(9, 16);
const perdedor9 = c9.rounds['0'].find(m => m.a && m.b).b.name;
ok('  9 numa chave de 16: sai "9º Lugar", nunca "9º–9º"', plac(c9, perdedor9) === '9º Lugar', plac(c9, perdedor9));
ok('  e quem recebeu BYE e caiu na fase seguinte tem colocacao',
   (() => { const b = c13.rounds['0'].find(m => m.bye); if(!b) return false;
     const q = c13.rounds['1'].find(m => m.a && m.b && (m.a.name===b.winner.name || m.b.name===b.winner.name));
     if(!q) return true; /* ele ganhou a fase seguinte tambem */
     const perdeu = q.a.name===b.winner.name ? (q.winner.name===q.a.name?null:q.a) : (q.winner.name===q.b.name?null:q.b);
     return perdeu ? /Lugar|campeão/.test(String(plac(c13, perdeu.name))) : true; })(), 'ok');
/* ⚠️ E O CONFRONTO DE BYE NAO CONTA COMO 'estive aqui': quem passou direto nao foi eliminado ali. */
ok('  o confronto de BYE nao elimina ninguem',
   (() => { const b = c13.rounds['0'].find(m => m.bye); return b && plac(c13, b.winner.name) !== '9º–13º Lugar'; })(), 'ok');

/* ---- as duas copias concordam sobre o agrupamento ---- */
/* ⚠️ AS DUAS COPIAS SAO COMPARADAS BYTE A BYTE, e nao por 'existe no cliente'. As versoes anteriores
   destas duas travas mediam a PRESENCA (o nome da funcao, o nome da variavel) -- e a presenca
   sobrevive a `= []` e a `= 0`: as duas PASSARAM EM BRANCO na conferencia de acusacao, com o cliente
   divergindo do servidor. Uma divergencia aqui faz a MESMA liga terminar diferente nos dois. */
const fatia = (src, ini, fim) => {
  const i = src.indexOf(ini);
  if(i < 0) return null;
  const j = src.indexOf(fim, i + ini.length);
  return j < 0 ? null : src.slice(i, j + fim.length);
};
const TRECHOS = [
  ['dividirEmChaves', 'function dividirEmChaves(total, maxPorChave, chaveMinima){', '\n}'],
  ['o agrupamento do drawCycle', 'const tamanhosDasChaves = dividirEmChaves(', 'cursor += tam;'],
  ['computePlacement', 'function computePlacement(league, playerName){', '\n}'],
];
TRECHOS.forEach(([nome, ini, fim]) => {
  const a = fatia(srvSrc, ini, fim), b = fatia(cliSrc, ini, fim);
  ok('as duas copias concordam byte a byte: ' + nome,
     !!a && !!b && a === b,
     !a ? 'nao achei no servidor' : !b ? 'nao achei no cliente' : 'DIVERGEM (' + a.length + ' x ' + b.length + ' chars)');
});
/* ⚠️ E O AGRUPAMENTO ANTIGO NAO PODE SOBRAR EM LUGAR NENHUM: com ele de volta num dos dois, a liga
   se formaria de um jeito no servidor e de outro no cliente -- sem erro, e so na hora do sorteio. */
ok('  e o agrupamento antigo nao sobrou em nenhum dos dois',
   !/const grandeCount = Math\.floor\(workingList\.length/.test(srvSrc) &&
   !/const grandeCount = Math\.floor\(workingList\.length/.test(cliSrc), 'sobrou num dos dois');
/* ⚠️ E O `size` DA LIGA E O TAMANHO DA CHAVE, nao quantos entraram: e ele que o computePlacement, as
   rodadas e o titulo da tela leem. A consequencia -- uma 'Grande Liga' com 13 jogadores -- fica FIXADA
   aqui pra ser decisao e nao surpresa. */
ok('  e o size da liga e o TAMANHO DA CHAVE (uma Grande Liga pode ter 13)',
   /size: bracket,/.test(srvSrc) && /size: bracket,/.test(cliSrc), 'falta num dos dois');

/* ============================================================================
   PONTA A PONTA: o `drawCycle` de VERDADE, contra o Firestore em memoria.
   ⚠️ 13 inscritos numa Liga Classica -- um numero que ANTES formava uma liga de 8 e deixava CINCO
   de fora. Todos os outros casos deste arquivo chamam o `dividirEmChaves` e o `buildRounds` na mao:
   eles passariam com a chamada orfa la dentro.
   ============================================================================ */
console.log('\n=== PONTA A PONTA (o drawCycle de verdade) ===');
{
  const Module = require('module');
  const fake = require('./fake-firestore.js');
  const db = fake.makeDb();
  const stubs = {
    'firebase-functions/v2/scheduler': { onSchedule: (a, b) => (typeof a === 'function' ? a : b) },
    'firebase-functions/v2/https': { onCall: (fn) => fn,
      HttpsError: class HttpsError extends Error { constructor(c, m){ super(m); this.code = c; } } },
    'firebase-functions/logger': { error(){}, info(){}, warn(){}, log(){} },
    'firebase-admin': { initializeApp(){}, firestore: Object.assign(() => db, { FieldValue: fake.FieldValue }) }
  };
  const load = Module._load;
  Module._load = function(req){ if(stubs[req]) return stubs[req]; return load.apply(this, arguments); };
  delete require.cache[require.resolve(R + 'functions/index.js')];
  const F = require(R + 'functions/index.js');
  Module._load = load;

  const T = 'classic';
  const cyc = (cid) => db.collection('leagueCycles').doc(T + '__' + cid);
  const sch = () => db.collection('leagues').doc('schedule_' + T);

  const monta = async (cid, quantos) => {
    await sch().set({ cycles: [{ id: cid, scheduledTime: Date.now() - 1000, status: 'registering' }] });
    for(let i = 0; i < quantos; i++){
      await cyc(cid).collection('registrants').doc('tr' + i).set({ name: 'Treinador ' + i, uid: 'tr' + i,
        code: 'cGlrYWNodTo1MA', slot: null, ataques: {}, specialties: [], elite: false, registeredAt: 1000 + i });
    }
    const d = (await sch().get()).data();
    await F._drawCycle(T, d.cycles[0], null);
    return (await cyc(cid).get()).data() || {};
  };

  (async () => {
    /* ---- 13 inscritos: UMA chave de 16, tres BYEs, ninguem de fora ---- */
    const doc = await monta('1758600000000', 13);
    const L = (doc.leagues || [])[0] || {};
    const r0 = (L.rounds || {})['0'] || [];
    const r1 = (L.rounds || {})['1'] || [];
    const quem = new Set();
    Object.values(L.rounds || {}).forEach(r => (r || []).forEach(m => {
      if(m.a) quem.add(m.a.uid); if(m.b) quem.add(m.b.uid); }));
    const byes = r0.filter(m => m.bye);

    ok('13 inscritos formam UMA liga (antes: uma de 8 e CINCO de fora)', (doc.leagues || []).length === 1, (doc.leagues || []).length + ' liga(s)');
    ok('  e os 13 entram no chaveamento', quem.size === 13, quem.size + ' treinadores');
    /* ⚠️ O LEFTOVER VAZIO E O PEDIDO INTEIRO: era ele que deixava gente esperando o ciclo seguinte. */
    ok('  e o leftover fica VAZIO', (doc.leftover || []).length === 0, (doc.leftover || []).length + ' de fora');
    ok('  a chave e de 16 (4 fases)', L.size === 16 && Object.keys(L.rounds || {}).length === 4,
       'size ' + L.size + ', ' + Object.keys(L.rounds || {}).length + ' fases');
    ok('  e a primeira fase tem 3 BYEs em 8 confrontos', byes.length === 3 && r0.length === 8,
       byes.length + ' byes em ' + r0.length);
    /* ⚠️ E NENHUM `BYE x BYE`: o teto de um por confronto e o que garante isso. */
    ok('  nenhum confronto tem os DOIS lados vazios', !r0.some(m => !m.a && !m.b), 'achei confronto vazio');
    ok('  e todo BYE ja nasce resolvido, com vencedor', byes.every(m => m.resolved && m.winner && !m.b), 'algum BYE espera partida');
    /* ⚠️ E ELES JA ESTAO NA FASE SEGUINTE: sem isso a liga travaria na primeira fase, esperando
       partidas que nunca acontecem. */
    const promovidos = r0.filter(m => m.bye).every((m, _i) => {
      const mi = r0.indexOf(m); const prox = r1[Math.floor(mi/2)];
      return prox && (mi % 2 === 0 ? prox.a : prox.b) && (mi % 2 === 0 ? prox.a : prox.b).uid === m.winner.uid;
    });
    ok('  e os 3 ja estao na fase seguinte, na posicao certa', promovidos, 'algum nao foi promovido');
    /* ⚠️ E BYE NAO GANHA TERRENO: ali nao ha luta. */
    ok('  e nenhum BYE ganhou terreno', byes.every(m => !m.terrain && !m.terrainId), 'algum BYE tem terreno');
    ok('  e os confrontos de verdade ganharam', r0.filter(m => !m.bye).every(m => m.terrain || m.terrainId), 'algum confronto real ficou sem');

    /* ---- 7 inscritos: continua sem formar nada, e e a regra que a Liga Pro depende ---- */
    const doc7 = await monta('1758603600000', 7);
    ok('7 inscritos continuam sem formar liga', (doc7.leagues || []).length === 0, (doc7.leagues || []).length + ' liga(s)');
    ok('  e os 7 vao pro leftover', (doc7.leftover || []).length === 7, (doc7.leftover || []).length + ' de fora');

    /* ---- 24 inscritos: 16+8, ZERO bye -- a nao-regressao no caso que hoje ja e perfeito ---- */
    const doc24 = await monta('1758607200000', 24);
    const ls = doc24.leagues || [];
    const byes24 = ls.reduce((n, l) => n + ((l.rounds || {})['0'] || []).filter(m => m.bye).length, 0);
    ok('24 inscritos formam 16+8, como sempre formaram', ls.length === 2 && ls[0].size === 16 && ls[1].size === 8,
       ls.map(l => l.size).join('+'));
    ok('  e ZERO BYEs (a regra minimiza vaga vazia, nao "equilibra" em 12+12)', byes24 === 0, byes24 + ' byes');

    console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'Tudo certo.'));
    process.exit(falhas ? 1 : 0);
  })();
}
