/**
 * O RANKING DA CORRIDA -- servidor (20/09/2026).
 *
 * Pedido: *"crie o ranking individual de 300m e o ranking do revezamento, o tempo dos npc nao
 * coloque no ranking, apenas dos treinadores"*.
 *
 * ⚠️ QUEM GRAVA É O SERVIDOR, e o `firestore.rules` fecha a coleção pra escrita do cliente --
 * tempo é placar público, e uma linha no console poria 0,01 s no topo. Então o que este arquivo
 * tranca é o que só EXISTE do lado de lá:
 *   - **MELHOR É MENOR**: o recorde só desce, e uma corrida ruim depois de uma boa não apaga a boa;
 *   - as DUAS modalidades vivem no MESMO documento, e um recorde numa não apaga o da outra;
 *   - o tempo do NPC não entra -- e isso é por CONSTRUÇÃO: o que chega é UM tempo, gravado no
 *     documento de quem CHAMOU;
 *   - tempo zero, negativo ou absurdo não entra;
 *   - quem nunca correu uma modalidade não aparece no ranking dela;
 *   - e o MEU tempo volta junto mesmo fora do top.
 *
 *   node tools/test-corrida-rank.js
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

let falhas = 0;
function ok(nome, cond, detalhe){
  if(cond) console.log('  OK     ' + nome + (detalhe ? '   ' + detalhe : ''));
  else { falhas++; console.log('  FALHOU ' + nome + (detalhe ? '   ' + detalhe : '')); }
}
const chamar = (fn, uid, data)=> fn({ auth: uid ? { uid } : null, data: data || {} });
const conta = (uid)=> db.collection('users').doc(uid);
const rank  = (uid)=> db.collection('raceRanking').doc(uid);
const enviar = (uid, d)=> chamar(fns.submitRaceTime, uid, d);
const ler    = (uid)=> chamar(fns.getRaceRanking, uid, {});

(async ()=>{

console.log('\n=== O ACESSO ===');
{
  let erro = null;
  try{ await enviar(null, { modalidade: 'single', tempo: 20 }); } catch(e){ erro = e; }
  ok('sem login o envio recusa', !!erro && erro.code === 'unauthenticated', erro && erro.code);
  erro = null;
  try{ await ler(null); } catch(e){ erro = e; }
  ok('e a leitura também', !!erro && erro.code === 'unauthenticated', erro && erro.code);
  /* ⚠️ MODALIDADE DESCONHECIDA NÃO PASSA: sem isso, um cliente forjado criaria um campo novo no
     documento e um ranking fantasma que ninguém lê. */
  erro = null;
  try{ await enviar('u1', { modalidade: 'maratona', tempo: 20 }); } catch(e){ erro = e; }
  ok('e uma modalidade inventada recusa', !!erro && erro.code === 'invalid-argument', erro && erro.code);
}

console.log('\n=== A REGRA DA COLEÇÃO ===');
{
  const regras = require('fs').readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  const bloco = (regras.match(/match \/raceRanking\/\{[^}]*\}\s*\{[\s\S]*?\n    \}/) || [''])[0];
  ok('(a fatia da regra tem o que ler)', bloco.length > 40, bloco.length + ' chars');
  /* ⚠️ `if false` INCLUSIVE PRO DONO: tempo é placar público, e o dono do documento escrevendo
     nele poria 0,01 s no topo. É a mesma regra do `fishingRanking` e do `globalBoss`. */
  ok('a coleção é FECHADA pra escrita do cliente', /allow write:\s*if false/.test(bloco), bloco.replace(/\s+/g, ' '));
  ok('  e livre pra leitura de quem está logado', /allow read:\s*if request\.auth != null/.test(bloco));
}

console.log('\n=== MELHOR É MENOR ===');
{
  await conta('u1').set({ trainerName: 'Matheus' });
  let r = await enviar('u1', { modalidade: 'single', tempo: 30.5, especie: 'Jolteon', venceu: true });
  ok('o primeiro tempo grava', r.gravado === true, JSON.stringify(r));
  ok('  e o nome vai DENORMALIZADO junto', (await rank('u1').get()).data().nome === 'Matheus');

  r = await enviar('u1', { modalidade: 'single', tempo: 40.0 });
  ok('um tempo PIOR não grava', r.gravado === false);
  ok('  e o recorde continua o bom', (await rank('u1').get()).data().single === 30.5,
     String((await rank('u1').get()).data().single));

  r = await enviar('u1', { modalidade: 'single', tempo: 22.25, especie: 'Jolteon' });
  ok('um tempo MELHOR grava', r.gravado === true);
  ok('  e ele vira o recorde', (await rank('u1').get()).data().single === 22.25);

  /* o empate exato não é recorde: ele não melhora nada e só gastaria uma escrita */
  /* ⚠️ E O INFO ACOMPANHA O RECORDE, não a primeira corrida: ele descreve a corrida que ficou
     gravada. É por isso que o fixture acima repete a espécie. */
  r = await enviar('u1', { modalidade: 'single', tempo: 22.25 });
  ok('o empate exato NÃO regrava', r.gravado === false);
}

console.log('\n=== AS DUAS MODALIDADES NO MESMO DOCUMENTO ===');
{
  const r = await enviar('u1', { modalidade: 'relay', tempo: 120.0, especie: 'Time A' });
  ok('o revezamento grava no mesmo documento', r.gravado === true);
  const d = (await rank('u1').get()).data();
  /* ⚠️ O `merge` É O QUE IMPEDE O APAGÃO: sem ele, gravar o revezamento zeraria a individual --
     e o jogador perderia um recorde sem ter feito nada. */
  ok('  e a INDIVIDUAL continua lá', d.single === 22.25, 'single=' + d.single + ' relay=' + d.relay);
  ok('  com o info de cada uma separado',
     (d.singleInfo || {}).especie === 'Jolteon' && (d.relayInfo || {}).especie === 'Time A',
     JSON.stringify({ s: d.singleInfo, r: d.relayInfo }));
  /* e um recorde no revezamento não mexe na individual */
  await enviar('u1', { modalidade: 'relay', tempo: 110.0 });
  const d2 = (await rank('u1').get()).data();
  ok('  e melhorar uma não encosta na outra', d2.single === 22.25 && d2.relay === 110.0,
     'single=' + d2.single + ' relay=' + d2.relay);
}

console.log('\n=== O QUE NÃO ENTRA ===');
{
  const casos = [
    ['zero', 0], ['negativo', -5], ['texto', 'rapido'], ['nulo', null],
    ['infinito', Infinity], ['absurdo (acima do teto)', fns._corridaRank.tempoMax + 1],
  ];
  for(const [nome, t] of casos){
    const r = await enviar('u2', { modalidade: 'single', tempo: t });
    ok('  ' + nome + ' não grava', r.gravado === false, JSON.stringify(r));
  }
  ok('e o u2 não ganhou documento nenhum', !(await rank('u2').get()).exists,
     'um documento sem tempo é linha morta na coleção');
  /* o teto é generoso de propósito: uma corrida de verdade leva segundos, não uma hora */
  const r = await enviar('u2', { modalidade: 'single', tempo: fns._corridaRank.tempoMax - 1 });
  ok('  mas um tempo alto e VÁLIDO entra', r.gravado === true);
  await rank('u2').delete();
}

console.log('\n=== OS DOIS TOPS ===');
{
  /* três treinadores: um só na individual, um só no revezamento, um nos dois */
  await conta('a').set({ trainerName: 'Ana' });
  await conta('b').set({ trainerName: 'Beto' });
  await conta('c').set({ trainerName: 'Caio' });
  await enviar('a', { modalidade: 'single', tempo: 18.0, especie: 'Jolteon' });
  await enviar('b', { modalidade: 'relay',  tempo: 100.0, especie: 'Time B' });
  await enviar('c', { modalidade: 'single', tempo: 25.0 });
  await enviar('c', { modalidade: 'relay',  tempo: 90.0 });

  const vis = await ler('a');
  ok('a chamada devolve as DUAS modalidades', !!vis.single && !!vis.relay, Object.keys(vis).join(','));
  const nomesS = vis.single.lista.map(x => x.nome);
  const nomesR = vis.relay.lista.map(x => x.nome);
  /* ⚠️ ASCENDENTE: no tempo o MENOR vem primeiro -- é o contrário do ranking da pescaria */
  ok('  a individual vem do MENOR tempo pro maior',
     vis.single.lista.every((x, i) => i === 0 || vis.single.lista[i - 1].tempo <= x.tempo),
     vis.single.lista.map(x => x.nome + ':' + x.tempo).join(' '));
  ok('  e o revezamento também',
     vis.relay.lista.every((x, i) => i === 0 || vis.relay.lista[i - 1].tempo <= x.tempo),
     vis.relay.lista.map(x => x.nome + ':' + x.tempo).join(' '));
  /* ⚠️ QUEM NUNCA CORREU UMA MODALIDADE NÃO APARECE NELA -- o Firestore exclui quem não tem o
     campo, e é exatamente o certo: um "—" no ranking não diz nada. */
  ok('  quem só correu a individual não aparece no revezamento',
     nomesS.indexOf('Ana') >= 0 && nomesR.indexOf('Ana') < 0, 'S: ' + nomesS + ' | R: ' + nomesR);
  ok('  e quem só correu o revezamento não aparece na individual',
     nomesR.indexOf('Beto') >= 0 && nomesS.indexOf('Beto') < 0);
  ok('  e quem correu as duas aparece nas duas',
     nomesS.indexOf('Caio') >= 0 && nomesR.indexOf('Caio') >= 0);
  ok('  a posição começa em 1', vis.single.lista[0].pos === 1);
  ok('  e o "eu" é marcado', vis.single.lista.some(x => x.eu && x.nome === 'Ana'));
  ok('  e o info do tempo vem junto',
     (vis.single.lista.find(x => x.nome === 'Ana') || {}).especie === 'Jolteon');
}

console.log('\n=== O MEU TEMPO FORA DO TOP ===');
{
  /* enche o top com gente mais rápida que o alvo */
  const topo = fns._corridaRank.topo;
  for(let i = 0; i < topo + 2; i++){
    await conta('r' + i).set({ trainerName: 'Rival ' + i });
    await enviar('r' + i, { modalidade: 'single', tempo: 5 + i * 0.1 });
  }
  await conta('lento').set({ trainerName: 'Lento' });
  await enviar('lento', { modalidade: 'single', tempo: 300 });
  const vis = await ler('lento');
  ok('o top tem no máximo ' + topo, vis.single.lista.length === topo, String(vis.single.lista.length));
  ok('  e o lento não está nele', !vis.single.lista.some(x => x.eu));
  /* ⚠️ E O MEU VEM JUNTO: quem está em 14º abre a tela e não veria nada seu */
  ok('  mas o tempo DELE volta à parte', !!vis.single.meu && vis.single.meu.tempo === 300,
     JSON.stringify(vis.single.meu));
  ok('  marcado como meu', !!(vis.single.meu || {}).eu);
  /* e quem está NO top não vem duplicado embaixo */
  const vis2 = await ler('r0');
  ok('  e quem está no top não vem duplicado', vis2.single.meu === null,
     JSON.stringify(vis2.single.meu));
  /* quem nunca correu não tem "meu" */
  await conta('novato').set({ trainerName: 'Novato' });
  const vis3 = await ler('novato');
  ok('  e quem nunca correu não tem tempo nenhum', vis3.single.meu === null && vis3.relay.meu === null);
}

console.log('\n=== O TEMPO DO NPC NÃO ENTRA ===');
{
  /* ⚠️ ISSO É POR CONSTRUÇÃO e não por filtro: a callable grava no documento de quem CHAMOU, e o
     que chega é UM tempo. Não existe caminho pra um segundo tempo entrar -- e é isso que a trava
     mede: mandar um "tempoNpc" junto não cria documento nenhum pra ele. */
  await conta('solo').set({ trainerName: 'Solo' });
  await enviar('solo', { modalidade: 'single', tempo: 19.0, tempoNpc: 1.0, uidNpc: 'npc', nome: 'NPC' });
  const d = (await rank('solo').get()).data();
  ok('o documento é do treinador, com o tempo dele', d.uid === 'solo' && d.single === 19.0,
     JSON.stringify({ uid: d.uid, single: d.single }));
  ok('  e o nome é o da CONTA, não o que veio no pedido', d.nome === 'Solo', d.nome);
  ok('  e nenhum documento nasceu pro NPC', !(await rank('npc').get()).exists);
  const vis = await ler('solo');
  ok('  e o top não tem 1,0 s de ninguém',
     !vis.single.lista.some(x => x.tempo === 1.0),
     vis.single.lista.map(x => x.tempo).join(','));
}

console.log('\n=== O TIME QUE FEZ O TEMPO (20/09/2026) ===');
{
  /* ⚠️ ELE É SÓ APRESENTAÇÃO (o modal do ranking), então não dá vantagem nenhuma -- mas o
     documento é PÚBLICO e todo mundo o lê, então ele é saneado e tem teto. */
  await conta('t1').set({ trainerName: 'Ash' });
  const seis = [
    { speciesId: 'jolteon', level: 60, shiny: true },
    { speciesId: 'venusaur', level: 58, shiny: false },
    { speciesId: 'snorlax', level: 62 },
    { speciesId: 'alakazam', level: 59 },
    { speciesId: 'gyarados', level: 61 },
    { speciesId: 'shuckle', level: 55 },
  ];
  await enviar('t1', { modalidade: 'relay', tempo: 120.5, time: seis });
  const d = (await rank('t1').get()).data();
  const info = d.relayInfo || {};
  ok('o time é gravado junto do tempo', Array.isArray(info.time) && info.time.length === 6,
     JSON.stringify((info.time || []).slice(0, 2)));
  ok('  com espécie, nível e shiny', info.time[0].speciesId === 'jolteon'
     && info.time[0].level === 60 && info.time[0].shiny === true);
  ok('  e o shiny ausente vira false (nunca undefined -- o Firestore recusa)',
     info.time[2].shiny === false);

  /* ⚠️ E ELE VOLTA NA LEITURA, nas DUAS pontas: a lista e o "meu" fora do top */
  const vis = await ler('t1');
  const eu = vis.relay.lista.find(x => x.eu);
  ok('o time volta na lista do top', Array.isArray(eu.time) && eu.time.length === 6);

  /* ⚠️ O TETO É 6: o revezamento leva seis, e o resto seria lixo num documento público */
  await conta('t2').set({ trainerName: 'Gary' });
  const muitos = [];
  for(let i = 0; i < 40; i++) muitos.push({ speciesId: 'pidgey', level: 5 });
  await enviar('t2', { modalidade: 'single', tempo: 30, time: muitos });
  const d2 = ((await rank('t2').get()).data().singleInfo) || {};
  ok('o teto corta em ' + fns._corridaRank.timeMax, d2.time.length === fns._corridaRank.timeMax,
     d2.time.length + ' guardados');

  /* ⚠️ E UM TIME MALFORMADO NÃO JOGA FORA O TEMPO: o ranking é sobre o TEMPO, e perder um recorde
     por causa da legenda seria o lado errado pra errar. */
  await conta('t3').set({ trainerName: 'Lixo' });
  await enviar('t3', { modalidade: 'single', tempo: 21.0,
                       time: ['isto não é objeto', null, 42, { level: 9 }, { speciesId: 'x'.repeat(200), level: 'abc' }] });
  const d3 = (await rank('t3').get()).data();
  ok('time malformado não derruba o tempo', d3.single === 21.0, String(d3.single));
  const t3 = (d3.singleInfo || {}).time || [];
  ok('  e o que sobra é só o que tem espécie', t3.length === 1, JSON.stringify(t3));
  ok('  com a espécie cortada em 40', t3[0].speciesId.length === 40, t3[0].speciesId.length + ' chars');
  ok('  e o nível lixo virando 1', t3[0].level === 1, String(t3[0].level));

  /* sem time nenhum: o campo existe e é lista vazia -- nunca undefined */
  await conta('t4').set({ trainerName: 'Sem' });
  await enviar('t4', { modalidade: 'single', tempo: 22.0 });
  const t4 = ((await rank('t4').get()).data().singleInfo || {}).time;
  ok('sem time vem lista vazia, nunca undefined', Array.isArray(t4) && t4.length === 0);

  /* ⚠️ E O SANEADOR É O MESMO em qualquer chamador -- ele é exportado pra a trava não repetir a regra */
  const s = fns._corridaRank.saneia;
  ok('o saneador recusa o que não é lista', s(null).length === 0 && s('abc').length === 0 && s(7).length === 0);
  ok('  e o nível é aparado nos dois extremos',
     s([{ speciesId: 'a', level: -5 }])[0].level === 1
     && s([{ speciesId: 'a', level: 99999 }])[0].level === 999);
}
console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);

})().catch(e => { console.error(e); process.exit(1); });
