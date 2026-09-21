/**
 * O RANKING DO RESGATE -- servidor (21/09/2026).
 *
 * Pedido: *"na página principal do resgate, adicione também um ranking com as maiores
 * pontuações"*.
 *
 * ⚠️ COM ELE O RESGATE GANHOU A PRIMEIRA OPERAÇÃO DE SERVIDOR DELE: até aqui o modo era offline
 * inteiro -- nenhuma callable, nada no Firestore, nada no save --, e o CLAUDE.md registrava isso
 * como decisão em aberto (*"quando houver, é aí que nasce a terceira checagem de permissão"*).
 *
 * O que este arquivo tranca é o que só existe do lado de lá:
 *   - quem grava é o SERVIDOR, e a coleção é `allow write: if false` inclusive pro dono;
 *   - o recorde SÓ SOBE (uma partida ruim depois de uma boa não apaga a boa), em transação;
 *   - ZERO não entra (documento de quem não resgatou ninguém é linha morta);
 *   - o nome fica DENORMALIZADO (senão o top 10 custaria 10 leituras a mais em `users/`);
 *   - e o MEU resultado volta junto mesmo fora do top.
 *
 *   node tools/test-resgate-rank.js
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
const rank  = (uid)=> db.collection('rescueRanking').doc(uid);
const doc   = async (uid)=> (await rank(uid).get()).data() || {};

(async ()=>{

console.log('\n=== O ACESSO ===');
{
  let erro = null;
  try { await chamar(fns.submitRescueScore, null, { pontos: 10 }); } catch(e){ erro = e; }
  ok('sem login o envio recusa', !!erro && erro.code === 'unauthenticated', erro && erro.code);
  erro = null;
  try { await chamar(fns.getRescueRanking, null, {}); } catch(e){ erro = e; }
  ok('  e a leitura também', !!erro && erro.code === 'unauthenticated', erro && erro.code);
}

console.log('\n=== O RECORDE SÓ SOBE ===');
{
  await conta('ash').set({ trainerName: 'Ash' });
  const a = await chamar(fns.submitRescueScore, 'ash', { pontos: 210, venceu: true, resgatados: 3 });
  ok('a primeira pontuação entra', a.gravado === true && a.pontos === 210, JSON.stringify(a));
  ok('  com o nome DENORMALIZADO', (await doc('ash')).nome === 'Ash', (await doc('ash')).nome);
  ok('  e os resgates junto', (await doc('ash')).resgatados === 3);

  /* ⚠️ UMA PARTIDA RUIM NÃO APAGA A BOA: é o que "recorde" quer dizer, e é a diferença pro
     ranking da Seleção, que é um CONTADOR. */
  const b = await chamar(fns.submitRescueScore, 'ash', { pontos: 90, venceu: false, resgatados: 1 });
  ok('  uma partida pior NÃO regrava', b.gravado === false, JSON.stringify(b));
  ok('    e o documento fica com o MELHOR', (await doc('ash')).pontos === 210, String((await doc('ash')).pontos));
  ok('    inclusive os resgates daquele dia', (await doc('ash')).resgatados === 3);

  const c = await chamar(fns.submitRescueScore, 'ash', { pontos: 400, venceu: true, resgatados: 6 });
  ok('  uma partida melhor regrava', c.gravado === true && (await doc('ash')).pontos === 400);

  /* o empate exato não regrava: não melhora nada e só gastaria uma escrita */
  const d = await chamar(fns.submitRescueScore, 'ash', { pontos: 400 });
  ok('  e o empate exato não regrava', d.gravado === false, JSON.stringify(d));
}

console.log('\n=== O QUE NÃO ENTRA ===');
{
  /* ⚠️ ZERO NÃO ENTRA: um documento de quem não resgatou ninguém é linha morta na coleção, e um
     "0 pontos" no topo não diz nada. */
  const z = await chamar(fns.submitRescueScore, 'zero', { pontos: 0 });
  ok('zero não entra', z.gravado === false && z.motivo === 'zero', JSON.stringify(z));
  ok('  e não nasce documento', !(await rank('zero').get()).exists);

  for(const [rot, v] of [['negativo', -50], ['texto', 'mil'], ['infinito', Infinity], ['ausente', undefined]]){
    const r = await chamar(fns.submitRescueScore, 'lixo', { pontos: v });
    ok('  ' + rot + ' não entra', r.gravado === false, JSON.stringify(r));
  }
  ok('  e a coleção continua sem ele', !(await rank('lixo').get()).exists);
}

console.log('\n=== O TOP 10 E O MEU ===');
{
  for(let i = 1; i <= 12; i++){
    await conta('t' + i).set({ trainerName: 'T' + i });
    await chamar(fns.submitRescueScore, 't' + i, { pontos: i * 10, resgatados: i });
  }
  const r = await chamar(fns.getRescueRanking, 't1', {});
  ok('o top vem com 10', r.lista.length === 10, r.lista.length + ' linhas');
  const decrescente = r.lista.every((x, i) => i === 0 || r.lista[i - 1].pontos >= x.pontos);
  ok('  ordenado do MAIOR pro menor', decrescente, r.lista.map(x => x.pontos).join(','));
  ok('    e o topo e o maior de todos', r.lista[0].pontos === 400, String(r.lista[0].pontos));
  ok('  com a posição carimbada', r.lista[0].pos === 1 && r.lista[9].pos === 10);

  /* ⚠️ O MEU VEM JUNTO MESMO FORA DO TOP: quem está em 12º abre a tela e não veria nada seu. */
  ok('  e o meu vem junto mesmo fora do top', r.meu && r.meu.pontos === 10 && r.meu.eu === true,
     JSON.stringify(r.meu));
  const r2 = await chamar(fns.getRescueRanking, 't12', {});
  ok('  e quem ESTÁ no top não vem duas vezes', r2.meu === null && r2.lista.some(x => x.eu),
     JSON.stringify(r2.meu));
  const r3 = await chamar(fns.getRescueRanking, 'ninguem', {});
  ok('  e quem nunca jogou não tem `meu`', r3.meu === null, JSON.stringify(r3.meu));

  /* ⚠️ UM DOCUMENTO POR JOGADOR: quatro envios do mesmo uid não viram quatro linhas. */
  const tudo = await db.collection('rescueRanking').get();
  ok('  e é UM documento por jogador', tudo.size === 13, tudo.size + ' documentos pra 13 contas');
}

console.log('\n=== A REGRA FECHA A COLEÇÃO ===');
{
  /* ⚠️ LER A REGRA COMO TEXTO: o que protege o placar não é a callable, é a coleção ser
     `allow write: if false` INCLUSIVE pro dono -- uma linha no console poria qualquer número. */
  const regras = require('fs').readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  const i = regras.indexOf('match /rescueRanking/');
  const bloco = i >= 0 ? regras.slice(i, i + 200) : '';
  ok('(e a trava lê a regra)', bloco.length > 50, bloco.length + ' chars');
  ok('a coleção é de leitura livre pra quem está logado', /allow read: if request\.auth != null;/.test(bloco));
  ok('  e de escrita NEGADA a todos', /allow write: if false;/.test(bloco));
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
