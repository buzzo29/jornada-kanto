/**
 * O RANKING DA SELEÇÃO -- servidor (21/09/2026).
 *
 * Pedido: *"após a batalha, exiba um quadro mostrando o top10 melhores aproveitamentos contra a
 * Luana, onde mostra a quantidade de partidas, o número de vitórias, e o número de derrotas e o
 * aproveitamento contra a Luana, ordenar pelo melhor aproveitamento"*.
 *
 * ⚠️ QUEM GRAVA É O SERVIDOR, e o `firestore.rules` fecha a coleção pra escrita do cliente. Aqui
 * isso pesa MAIS que nos outros dois rankings: o que se grava não é um recorde que só sobe, é um
 * CONTADOR -- um cliente forjado poria 999 vitórias e 0 derrotas.
 *
 * O que este arquivo tranca é o que só existe do lado de lá:
 *   - o que chega é um BOOLEANO, e a conta é do servidor (aceitar `vitorias` do cliente seria
 *     deixá-lo escrever o próprio aproveitamento por outro caminho);
 *   - é UM documento por jogador, com as partidas acumulando;
 *   - o `aproveitamento` é GRAVADO (o Firestore não ordena por razão entre campos) e é DERIVADO
 *     na mesma transação, então não tem como ficar velho;
 *   - a ordem é pelo aproveitamento, com as PARTIDAS como desempate;
 *   - o nome fica DENORMALIZADO;
 *   - e o MEU resultado volta junto mesmo fora do top.
 *
 *   node tools/test-selecao-rank.js
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
const rank  = (uid)=> db.collection('selecaoRanking').doc(uid);
const doc   = async (uid)=> (await rank(uid).get()).data() || {};

(async ()=>{

console.log('\n=== O ACESSO ===');
{
  let erro = null;
  try { await chamar(fns.sendSelecaoResult, null, { venceu: true }); } catch(e){ erro = e; }
  ok('sem login o envio recusa', !!erro && erro.code === 'unauthenticated', erro && erro.code);
  erro = null;
  try { await chamar(fns.getSelecaoRanking, null, {}); } catch(e){ erro = e; }
  ok('  e a leitura também', !!erro && erro.code === 'unauthenticated', erro && erro.code);
}

console.log('\n=== A CONTA É DO SERVIDOR ===');
{
  await conta('ash').set({ trainerName: 'Ash' });
  let r = await chamar(fns.sendSelecaoResult, 'ash', { venceu: true });
  ok('a primeira partida grava', r.partidas === 1 && r.vitorias === 1, JSON.stringify(r));
  ok('  com o nome DENORMALIZADO', (await doc('ash')).nome === 'Ash');
  ok('  e a derrota derivada', r.derrotas === 0);

  r = await chamar(fns.sendSelecaoResult, 'ash', { venceu: false });
  ok('a partida seguinte ACUMULA', r.partidas === 2 && r.vitorias === 1 && r.derrotas === 1,
     JSON.stringify(r));
  /* ⚠️ O `aproveitamento` É GRAVADO -- o Firestore não ordena por uma razão entre campos --, e é
     DERIVADO na mesma transação que conta a partida, então não tem como ficar velho. */
  ok('  e o aproveitamento é gravado e derivado', Math.abs((await doc('ash')).aproveitamento - 0.5) < 1e-9,
     String((await doc('ash')).aproveitamento));

  /* ⚠️ O QUE CHEGA É UM BOOLEANO: mandar `vitorias`/`partidas` não escreve nada. Aceitar isso
     seria deixar o cliente escrever o próprio aproveitamento por outro caminho. */
  r = await chamar(fns.sendSelecaoResult, 'ash', { venceu: false, vitorias: 999, partidas: 999,
                                                   aproveitamento: 1, derrotas: 0 });
  ok('o cliente não consegue mandar o placar', r.partidas === 3 && r.vitorias === 1,
     JSON.stringify(r));
  ok('  nem o aproveitamento', Math.abs((await doc('ash')).aproveitamento - 1 / 3) < 1e-9,
     String((await doc('ash')).aproveitamento));

  /* ⚠️ E `venceu` AUSENTE OU DE OUTRO TIPO CONTA COMO DERROTA -- ele é lido como `!!`, e um
     `'sim'` não pode virar vitória por ser truthy num campo que o servidor não controla. */
  const antes = (await doc('ash')).vitorias;
  await chamar(fns.sendSelecaoResult, 'ash', {});
  ok('  e sem `venceu` a partida conta como derrota', (await doc('ash')).vitorias === antes,
     antes + ' vitórias antes e depois');

  /* ⚠️ É UM DOCUMENTO POR JOGADOR, não um por partida: a coleção não cresce sem limite. */
  const todos = await db.collection('selecaoRanking').get();
  ok('quatro envios deixaram UM documento', todos.docs.length === 1, todos.docs.length + ' documentos');
}

console.log('\n=== A ORDEM É PELO APROVEITAMENTO ===');
{
  /* ash está em 1 de 4 (25%) */
  const montar = async (uid, nome, v, d)=>{
    await conta(uid).set({ trainerName: nome });
    for(let i = 0; i < v; i++) await chamar(fns.sendSelecaoResult, uid, { venceu: true });
    for(let i = 0; i < d; i++) await chamar(fns.sendSelecaoResult, uid, { venceu: false });
  };
  await montar('misty', 'Misty', 9, 1);      /* 90% em 10 */
  await montar('brock', 'Brock', 1, 0);      /* 100% em 1  */
  await montar('gary',  'Gary',  5, 5);      /* 50%  em 10 */
  await montar('lt',    'Surge', 18, 2);     /* 90% em 20  */

  const r = await chamar(fns.getSelecaoRanking, 'ash', {});
  const nomes = r.top.map(x => x.nome);
  ok('o top vem ordenado pelo aproveitamento',
     nomes[0] === 'Brock' && nomes.indexOf('Gary') > nomes.indexOf('Misty'),
     nomes.join(' > '));
  /* ⚠️ E O DESEMPATE É O NÚMERO DE PARTIDAS: Surge e Misty estão os dois em 90%, e quem jogou
     mais fica na frente. Sem ele a ordem entre empatados seria o que o Firestore devolvesse. */
  ok('  e empate se decide por quem jogou mais',
     nomes.indexOf('Surge') < nomes.indexOf('Misty'),
     nomes.join(' > '));
  /* ⚠️ CONSEQUÊNCIA CONHECIDA E ACEITA: 1 vitória em 1 (100%) fica ACIMA de 18 em 20 (90%). A
     tabela mostra as partidas justamente por isso -- quem lê vê o denominador. */
  ok('  (e 1 de 1 fica acima de 18 de 20 -- o preço de ordenar por razão)',
     nomes.indexOf('Brock') < nomes.indexOf('Surge'));

  /* a linha traz as três coisas que o pedido nomeia */
  const brock = r.top.find(x => x.nome === 'Brock');
  ok('cada linha traz partidas, vitórias e derrotas',
     brock.partidas === 1 && brock.vitorias === 1 && brock.derrotas === 0,
     JSON.stringify(brock));
  ok('  e a posição', r.top[0].pos === 1 && r.top[1].pos === 2);
  ok('  e o top para em ' + fns._selecaoRank.topo, r.top.length <= fns._selecaoRank.topo,
     r.top.length + ' linhas');
}

console.log('\n=== O MEU RESULTADO VEM JUNTO ===');
{
  /* ⚠️ QUEM ESTÁ FORA DO TOP abriria a tela e não veria nada seu -- e o próprio aproveitamento é
     o que ele mais procura ali. */
  for(let i = 0; i < 12; i++){
    await conta('bot' + i).set({ trainerName: 'Bot' + i });
    await chamar(fns.sendSelecaoResult, 'bot' + i, { venceu: true });
  }
  const r = await chamar(fns.getSelecaoRanking, 'ash', {});
  ok('o top continua com no máximo ' + fns._selecaoRank.topo, r.top.length === fns._selecaoRank.topo,
     r.top.length);
  ok('  e o ash está fora dele', !r.top.some(x => x.uid === 'ash'));
  ok('  mas o resultado dele volta junto', !!r.meu && r.meu.uid === 'ash' && r.meu.partidas === 4,
     JSON.stringify(r.meu));
  /* e quem está DENTRO do top não vem duplicado */
  const r2 = await chamar(fns.getSelecaoRanking, 'bot0', {});
  ok('  e quem está no top não vem duas vezes',
     r2.top.filter(x => x.uid === 'bot0').length === 1 &&
     (!r2.meu || r2.meu.uid === 'bot0'));
  /* quem nunca jogou não tem linha nenhuma */
  const r3 = await chamar(fns.getSelecaoRanking, 'ninguem', {});
  ok('  e quem nunca jogou não tem `meu`', r3.meu === null, JSON.stringify(r3.meu));
}

console.log('\n=== A REGRA FECHA A COLEÇÃO ===');
{
  /* ⚠️ LER A REGRA COMO TEXTO: o que protege o placar não é a callable, é a coleção ser
     `allow write: if false` INCLUSIVE pro dono. */
  const regras = require('fs').readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  const bloco = regras.slice(regras.indexOf('match /selecaoRanking/'),
                             regras.indexOf('match /selecaoRanking/') + 200);
  ok('(e a trava lê a regra)', bloco.length > 50, bloco.length + ' chars');
  ok('a coleção é de leitura livre pra quem está logado', /allow read: if request\.auth != null;/.test(bloco));
  ok('  e de escrita NEGADA a todos', /allow write: if false;/.test(bloco));
}


/* ============================================================================
   ⚠️ O INDICE COMPOSTO -- E O RANKING DA LUANA NUNCA CARREGOU SEM ELE (21/09/2026)

   Reportado assim: *"adicione o ranking de aproveitamento contra a Luana tambem na tela principal,
   e verifique se ele esta funcionando, porque acho que esta com problemas"*. E estava:

     `getSelecaoRanking` pede `.orderBy('aproveitamento','desc').orderBy('partidas','desc')`

   ⚠️ DOIS `orderBy` EM CAMPOS DIFERENTES EXIGEM INDICE COMPOSTO, e o projeto tinha **ZERO**
   (`firebase firestore:indexes` devolvia `"indexes": []`, e nao existia `firestore.indexes.json`).
   Em producao a consulta morria com `FAILED_PRECONDITION: The query requires an index` e o cliente
   caia no catch mostrando "nao deu pra carregar o ranking" -- **em toda abertura, desde o dia em
   que o ranking nasceu**.

   ⚠️ E O TESTE PASSAVA, porque o `fake-firestore` nao exigia indice nenhum: ele era mais
   permissivo que a producao pelo lado que mais engana. Hoje ele exige (le o proprio
   `firestore.indexes.json` do repo), entao rodar esta suite sem o arquivo ja falha sozinho -- e
   esta trava e a segunda metade: ela pega a query que NENHUM teste exercita.
   ============================================================================ */
console.log('\n=== TODA QUERY DE DOIS `orderBy` TEM INDICE DECLARADO ===');
{
  const fs2 = require('fs');
  const srv = fs2.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  const arquivo = path.join(__dirname, '..', 'firestore.indexes.json');

  ok('o `firestore.indexes.json` existe', fs2.existsSync(arquivo));
  const decl = JSON.parse(fs2.readFileSync(arquivo, 'utf8'));
  const declarados = (decl.indexes || []).map(i => i.collectionGroup + ':' +
    (i.fields || []).map(f => f.fieldPath + ':' + (f.order === 'DESCENDING' ? 'desc' : 'asc')).join(','));

  /* ⚠️ E O `firebase.json` TEM QUE APONTAR O ARQUIVO: sem a linha ele e letra morta -- o deploy
     nao publica indice que ele nao conhece, e o arquivo ficaria no repo sem nunca chegar ao ar. */
  const fb = JSON.parse(fs2.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
  ok('  e o `firebase.json` o aponta', (fb.firestore || {}).indexes === 'firestore.indexes.json',
     JSON.stringify(fb.firestore));
  ok('  e o hosting NAO o publica', ((fb.hosting || {}).ignore || []).includes('firestore.indexes.json'),
     'ele ficaria baixavel em jornadakanto.com, como o rules ja ficou');

  /* ⚠️ A COLECAO NEM SEMPRE ESTA COLADA NA QUERY: ela costuma vir de um ajudante
     (`selecaoRankCollRef()`), entao a varredura precisa dos DOIS caminhos. A primeira versao so
     olhava o `collection('X')` inline e achou **ZERO** queries -- ou seja ela passaria em branco
     sobre o defeito que ela existe pra pegar. Quem denunciou foi o `ok` de "a varredura achou o
     que ler", que e a rede que este projeto poe em toda fatia de codigo. */
  const ajudantes = {};
  [...srv.matchAll(/function\s+(\w+)\s*\(\)\s*\{\s*return\s+db\.collection\('([A-Za-z]+)'\)/g)]
    .forEach(m => { ajudantes[m[1]] = m[2]; });
  const encadeadas = [...srv.matchAll(/\.orderBy\('([^']+)',\s*'(asc|desc)'\)\s*\.orderBy\('([^']+)',\s*'(asc|desc)'\)/g)];
  ok('  (e a varredura achou o que ler)', encadeadas.length >= 1, encadeadas.length + ' query(s)');
  encadeadas.forEach(m => {
    const antes = srv.slice(Math.max(0, m.index - 400), m.index);
    const inline = [...antes.matchAll(/db\.collection\('([A-Za-z]+)'\)/g)].pop();
    const chamada = [...antes.matchAll(/(\w+)\(\)/g)].filter(x => ajudantes[x[1]]).pop();
    const col = (chamada && ajudantes[chamada[1]]) || (inline && inline[1]) || '?';
    const chave = col + ':' + m[1] + ':' + m[2] + ',' + m[3] + ':' + m[4];
    ok('  ' + col + ' (' + m[1] + ', ' + m[3] + ') tem indice', declarados.includes(chave),
       'pedido: ' + chave + ' | declarados: ' + declarados.join(' | '));
  });

  /* ⚠️ E O FAKE EXIGE JUNTO -- e o que faz o teste e a producao concordarem daqui pra frente.
     ⚠️ ELA EXECUTA, nao LE: a primeira versao procurava `function exigeIndice(` no arquivo, e a
     conferencia de acusacao pegou -- desligando so a CHAMADA (a funcao continua declarada) ela
     passava em branco com o dublê permissivo de volta. */
  await db.collection('semIndiceNenhum').doc('x').set({ a: 1, b: 2 });
  let recusou = null;
  try { await db.collection('semIndiceNenhum').orderBy('a', 'desc').orderBy('b', 'desc').get(); }
  catch(e){ recusou = e; }
  ok('  e o fake RECUSA dois orderBy sem indice', !!recusou && /requires an index/i.test(recusou.message),
     recusou ? recusou.message.slice(0, 60) : 'o dublê voltou a ser mais permissivo que a producao');
  /* e um orderBy so nunca precisa: o indice de campo unico o Firestore cria sozinho */
  let umSo = null;
  try { await db.collection('semIndiceNenhum').orderBy('a', 'desc').get(); } catch(e){ umSo = e; }
  ok('    e um orderBy so passa', !umSo, umSo && umSo.message);
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
