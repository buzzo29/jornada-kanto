/**
 * O RANKING DA PESCARIA -- servidor (20/09/2026).
 *
 * Pedido: *"na primeira tela, crie um ranking das maiores pontuações de pesca"*.
 *
 * ⚠️ QUEM GRAVA É O SERVIDOR, e o `firestore.rules` fecha a coleção pra escrita do cliente --
 * pontuação é placar público, e uma linha no console poria qualquer número no topo. Então o que
 * este arquivo tranca é o que só EXISTE do lado de lá:
 *   - o recorde SÓ SOBE (uma partida ruim depois de uma boa não apaga a boa);
 *   - zero NÃO entra (documento morto na coleção e uma linha de "0 pontos" que não diz nada);
 *   - é UM documento por jogador, não um por partida (a coleção não cresce sem limite);
 *   - o nome fica DENORMALIZADO (ler o top 10 custaria 10 leituras a mais em `users/`);
 *   - e o MEU resultado volta junto mesmo fora do top -- quem está em 14º abriria a tela e não
 *     veria nada seu, que é justamente o que ele mais procura ali.
 *
 *   node tools/test-pescaria-rank.js
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
const rank  = (uid)=> db.collection('fishingRanking').doc(uid);

(async ()=>{

console.log('\n=== O RECORDE SÓ SOBE ===');
{
  await conta('ash').set({ trainerName: 'Ash' });
  let r = await chamar(fns.submitFishingScore, 'ash', { pontos: 300, venceu: true, capturas: 4 });
  ok('a primeira pontuação grava', r.gravado === true, JSON.stringify(r));
  ok('  com o nome DENORMALIZADO', ((await rank('ash').get()).data() || {}).nome === 'Ash');
  ok('  e com as capturas', ((await rank('ash').get()).data() || {}).capturas === 4);

  /* ⚠️ UMA PARTIDA PIOR NÃO APAGA A MELHOR -- é "o recorde", não "a última". */
  r = await chamar(fns.submitFishingScore, 'ash', { pontos: 120, venceu: false, capturas: 2 });
  ok('uma pontuação MENOR não grava', r.gravado === false, JSON.stringify(r));
  ok('  e o recorde continua o de antes', ((await rank('ash').get()).data() || {}).pontos === 300);

  r = await chamar(fns.submitFishingScore, 'ash', { pontos: 301, venceu: true, capturas: 5 });
  ok('uma pontuação MAIOR grava', r.gravado === true);
  ok('  e o recorde sobe', ((await rank('ash').get()).data() || {}).pontos === 301);

  /* ⚠️ É UM DOCUMENTO POR JOGADOR, não um por partida: quatro envios, um documento. */
  const todos = await db.collection('fishingRanking').get();
  ok('quatro envios deixaram UM documento', todos.docs.length === 1, todos.docs.length + ' documentos');
}

console.log('\n=== ZERO NÃO ENTRA ===');
{
  await conta('novato').set({ trainerName: 'Novato' });
  const r = await chamar(fns.submitFishingScore, 'novato', { pontos: 0, venceu: false, capturas: 0 });
  ok('zero é recusado', r.gravado === false, JSON.stringify(r));
  ok('  e nenhum documento nasce', !(await rank('novato').get()).exists);
  /* número forjado e negativo também não vira linha */
  await chamar(fns.submitFishingScore, 'novato', { pontos: -50 });
  await chamar(fns.submitFishingScore, 'novato', { pontos: 'muitos' });
  ok('  nem um número negativo ou inválido', !(await rank('novato').get()).exists);
}

console.log('\n=== SEM LOGIN, NADA ===');
{
  let erro = null;
  try { await chamar(fns.submitFishingScore, null, { pontos: 500 }); } catch(e){ erro = e; }
  ok('o envio sem login é recusado', !!erro && erro.code === 'unauthenticated', erro && erro.code);
  erro = null;
  try { await chamar(fns.getFishingRanking, null, {}); } catch(e){ erro = e; }
  ok('e a leitura também', !!erro && erro.code === 'unauthenticated', erro && erro.code);
}

console.log('\n=== O TOP VEM ORDENADO, E CORTADO NO TOPO ===');
{
  /* mais gente do que cabe no top */
  for(let i = 0; i < fns._pescariaRank.topo + 5; i++){
    const uid = 'tr' + i;
    await conta(uid).set({ trainerName: 'Treinador ' + i });
    await chamar(fns.submitFishingScore, uid, { pontos: 100 + i * 10, venceu: i % 2 === 0, capturas: i });
  }
  const r = await chamar(fns.getFishingRanking, 'tr0', {});
  ok('o top tem o tamanho declarado', r.lista.length === fns._pescariaRank.topo,
     r.lista.length + ' de ' + fns._pescariaRank.topo);
  const pts = r.lista.map(x => x.pontos);
  ok('  e vem do MAIOR pro menor', pts.every((p, i) => i === 0 || pts[i - 1] >= p), pts.join(','));
  ok('  com a colocação a partir de 1', r.lista[0].pos === 1 && r.lista[1].pos === 2);

  /* ⚠️ E O MEU RESULTADO VEM JUNTO MESMO FORA DO TOP: o `tr0` é o de menor pontuação. */
  ok('quem está fora do top recebe o próprio resultado', !!r.meu, JSON.stringify(r.meu));
  ok('  marcado como seu', r.meu && r.meu.eu === true);
  ok('  e ele NÃO aparece na lista do top', !r.lista.some(x => x.uid === 'tr0'));

  /* quem está DENTRO não repete embaixo */
  const dentro = await chamar(fns.getFishingRanking, 'tr14', {});
  ok('quem está no top é marcado na própria lista',
     dentro.lista.some(x => x.uid === 'tr14' && x.eu === true));
  ok('  e não vem repetido embaixo', dentro.meu === null, JSON.stringify(dentro.meu));
}

console.log('\n=== A CONTA SEM NOME NÃO QUEBRA ===');
{
  /* conta que nunca passou pelo `touchLastSeen` -- o campo `trainerName` pode não existir */
  await chamar(fns.submitFishingScore, 'anonimo', { pontos: 90, venceu: false, capturas: 1 });
  const d = (await rank('anonimo').get()).data() || {};
  ok('ela grava com um nome padrão', typeof d.nome === 'string' && d.nome.length > 0, d.nome);
}

console.log('\n=== A REGRA FECHA A ESCRITA DO CLIENTE ===');
{
  /* ⚠️ LENDO A REGRA COMO TEXTO -- é ela que faz o "quem grava é o servidor" ser verdade, e um
     `allow write` solto ali transformaria o ranking numa linha no console. */
  const fs = require('fs');
  const regras = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  const i = regras.indexOf('match /fishingRanking/');
  const bloco = i < 0 ? '' : regras.slice(i, regras.indexOf('}', regras.indexOf('allow write', i)));
  ok('a coleção tem regra própria', i > 0);
  ok('  e a escrita é negada a TODOS', /allow write: if false/.test(bloco), bloco.replace(/\s+/g, ' ').slice(0, 90));
  ok('  e a leitura é de quem está logado', /allow read: if request\.auth != null/.test(bloco));
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
})();
