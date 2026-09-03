/**
 * MOEDAS -- o pagamento da jornada e a cobrança do re-sorteio, no servidor, sem Firebase.
 *
 * Por que estas funções existem no SERVIDOR e não no cliente: moeda é poder de compra, e o que ela
 * compra hoje é re-sorteio do encontro selvagem. Cliente escrevendo moeda seria shiny à vontade --
 * exatamente a artimanha que a semente do encontro fecha. As regras do Firestore trancam o campo
 * `moedas` pelo mesmo motivo do `rareCandies`.
 *
 * O que este teste pega:
 *  - pagar duas vezes a mesma insígnia (o defeito mais fácil de introduzir aqui);
 *  - PERDER uma vitória porque a chamada morreu na rede -- o pagamento é por diferença, então a
 *    próxima chamada tem que cobrir as duas;
 *  - save antigo levando retroativo, que é a decisão irreversível desta feature;
 *  - re-sorteio saindo de graça pra quem não tem moeda, ou cobrando sem ter o que cobrar;
 *  - duas abas do mesmo jogador gastando a mesma moeda.
 *
 *   node tools/test-moedas.js
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
Module._load = function(req){ if(stubs[req]) return stubs[req]; return loadOriginal.apply(this, arguments); };
const fns = require(path.join(__dirname, '..', 'functions', 'index.js'));
Module._load = loadOriginal;

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const chamar = (fn, uid, data) => fns[fn]({ auth:{ uid }, data: data || {} });
async function recusa(fn, uid, data){
  try{ await chamar(fn, uid, data); return null; }catch(e){ return e.code || 'erro'; }
}
const userRef = (uid) => db.collection('users').doc(uid);
const saveRef = (uid, slot) => userRef(uid).collection('saves').doc(String(slot));
const moedasDe = async (uid) => ((await userRef(uid).get()).data() || {}).moedas || 0;

async function conta(uid, save, moedas){
  await userRef(uid).set({ trainerName: uid, moedas: moedas || 0 });
  if(save) await saveRef(uid, 0).set(save);
}
/* Save que JÁ passou pelo pagamento uma vez: é o estado normal de quem está jogando agora. */
const jaVisto = (extra) => Object.assign({ badgesEarned:[], badgeCount:0, coinsPaid:0 }, extra || {});

(async function(){

console.log('\n=== O PAGAMENTO DA JORNADA ===');
{
  await conta('a', jaVisto({ badgesEarned:['Insígnia'], badgeCount:1 }));
  const r = await chamar('claimJourneyCoins', 'a', { slot:'0' });
  ok('a primeira insígnia paga 5', r.ganhou === 5 && r.moedas === 5, JSON.stringify(r));

  /* PAGAR DUAS VEZES a mesma insígnia é o defeito mais fácil de introduzir aqui: a tela chama isso
     depois de toda vitória, e uma vitória pode ser reenviada (F5 na tela de vitória, duas abas). */
  const r2 = await chamar('claimJourneyCoins', 'a', { slot:'0' });
  ok('e chamar de novo não paga nada', r2.ganhou === 0 && r2.moedas === 5, JSON.stringify(r2));

  /* PERDER uma vitória é o erro contrário, e é pior: o pagamento é por DIFERENÇA, então uma chamada
     que morreu na rede não custa moeda -- a próxima cobre as duas. */
  await saveRef('a', 0).set({ badgesEarned:['1','2','3'], badgeCount:3 }, { merge:true });
  const r3 = await chamar('claimJourneyCoins', 'a', { slot:'0' });
  ok('duas insígnias ganhas sem chamada pagam as duas juntas', r3.ganhou === 10 && r3.moedas === 15,
     JSON.stringify(r3));

  /* AS OITO INSÍGNIAS valem 10 além dos 5 de cada uma. */
  await saveRef('a', 0).set({ badgesEarned:['1','2','3','4','5','6','7','8'], badgeCount:8 }, { merge:true });
  const r4 = await chamar('claimJourneyCoins', 'a', { slot:'0' });
  ok('fechar as oito paga as que faltavam mais o bônus de 10', r4.ganhou === 35 && r4.moedas === 50,
     JSON.stringify(r4) + '  (5 insígnias x5 = 25, +10 pelas oito)');

  /* A ELITE vale 20. */
  await saveRef('a', 0).set({ eliteStatus:'champion' }, { merge:true });
  const r5 = await chamar('claimJourneyCoins', 'a', { slot:'0' });
  ok('a Elite paga 20', r5.ganhou === 20 && r5.moedas === 70, JSON.stringify(r5));
  ok('e a jornada inteira vale 70', r5.moedas === 70, r5.moedas + ' moedas');

  const r6 = await chamar('claimJourneyCoins', 'a', { slot:'0' });
  ok('nada mais depois disso', r6.ganhou === 0, JSON.stringify(r6));
}

console.log('\n=== SAVE ANTIGO NÃO LEVA RETROATIVO ===');
{
  /* A DECISÃO IRREVERSÍVEL desta feature. Um save campeão de antes do sistema receberia 70 moedas
     de uma vez -- 23 re-sorteios de encontro caídos do céu. A primeira passagem grava a base e não
     paga; se um dia se decidir pagar retroativo, é trocar esse ramo. O contrário, tirar moeda que
     já foi paga, não tem volta. */
  await conta('b', { badgesEarned:['1','2','3','4','5','6','7','8'], badgeCount:8, eliteStatus:'champion' });
  const r = await chamar('claimJourneyCoins', 'b', { slot:'0' });
  ok('save campeão de antes do sistema não recebe nada', r.ganhou === 0 && r.moedas === 0, JSON.stringify(r));
  ok('mas a base fica gravada', (await saveRef('b',0).get()).data().coinsPaid === 70,
     String((await saveRef('b',0).get()).data().coinsPaid));
  /* E dali em diante ele ganha normal -- o que vier DEPOIS conta. */
  await saveRef('b', 0).set({ badgesEarned:['1','2','3','4','5','6','7','8','9'], badgeCount:9 }, { merge:true });
  const r2 = await chamar('claimJourneyCoins', 'b', { slot:'0' });
  ok('e a vitória seguinte paga normal', r2.ganhou === 5 && r2.moedas === 5, JSON.stringify(r2));
}

console.log('\n=== O RE-SORTEIO COBRA ===');
{
  await conta('c', jaVisto(), 7);
  const r = await chamar('rerollWildOffer', 'c', {});
  ok('re-sortear custa 3', r.custo === 3 && r.moedas === 4, JSON.stringify(r));
  await chamar('rerollWildOffer', 'c', {});
  ok('e de novo', await moedasDe('c') === 1, String(await moedasDe('c')));
  /* COM MENOS DE 3 ele RECUSA -- e a recusa diz quanto falta, senão o botão parece quebrado. */
  const erro = await recusa('rerollWildOffer', 'c', {});
  ok('com 1 moeda ele recusa', erro === 'failed-precondition', String(erro));
  ok('e não cobra nada na recusa', await moedasDe('c') === 1, String(await moedasDe('c')));

  await conta('d', jaVisto(), 0);
  ok('quem não tem moeda nenhuma também é recusado',
     await recusa('rerollWildOffer', 'd', {}) === 'failed-precondition');
  ok('e continua com zero, não fica negativo', await moedasDe('d') === 0, String(await moedasDe('d')));
}

console.log('\n=== DUAS ABAS NÃO GASTAM A MESMA MOEDA ===');
{
  /* Sem transação, as duas leem o mesmo saldo e as duas passam -- 6 moedas de re-sorteio saindo por
     3. É o mesmo cuidado do desconto da raide do Mew. */
  await conta('e', jaVisto(), 5);
  const rs = await Promise.allSettled([
    chamar('rerollWildOffer', 'e', {}),
    chamar('rerollWildOffer', 'e', {})
  ]);
  const passaram = rs.filter(x => x.status === 'fulfilled').length;
  ok('só uma das duas passa', passaram === 1, passaram + ' passaram');
  ok('e sobra o saldo certo', await moedasDe('e') === 2, String(await moedasDe('e')));

  /* O mesmo vale pro pagamento: duas telas de vitória reivindicando a mesma insígnia. */
  await conta('f', jaVisto({ badgesEarned:['1'], badgeCount:1 }), 0);
  await Promise.allSettled([
    chamar('claimJourneyCoins', 'f', { slot:'0' }),
    chamar('claimJourneyCoins', 'f', { slot:'0' })
  ]);
  ok('e a mesma insígnia não paga duas vezes', await moedasDe('f') === 5, String(await moedasDe('f')));
}

console.log('\n=== A LOJA: COMPRAR E USAR ===');
{
  /* A mochila deixou de ser uma leitura do que a conta ja tinha: item comprado precisa de armazem
     de verdade, e ele e do SERVIDOR pelo mesmo motivo das moedas -- uma linha no console viraria
     Despertar infinito, e Despertar infinito desliga um golpe do jogo inteiro. */
  await conta('g', jaVisto(), 100);
  const r = await chamar('buyItem', 'g', { item:'awakening' });
  ok('comprar o Despertar custa 50', r.moedas === 50 && r.inventario.awakening === 1, JSON.stringify(r));
  await chamar('buyItem', 'g', { item:'potion' });
  const r3 = await chamar('buyItem', 'g', { item:'hyperpotion' });
  ok('e os outros dois custam 15 e 30', r3.moedas === 5, r3.moedas + ' moedas sobrando');

  ok('sem moeda suficiente ele recusa',
     await recusa('buyItem', 'g', { item:'awakening' }) === 'failed-precondition');
  ok('e nao cobra nada na recusa', await moedasDe('g') === 5, String(await moedasDe('g')));
  ok('item que nao existe e recusado', await recusa('buyItem', 'g', { item:'masterball' }) === 'invalid-argument');

  /* USAR o Despertar: liga um cronometro na CONTA, nao no save -- vale em qualquer save e em
     qualquer modo, que foi o pedido. */
  const u = await chamar('useItem', 'g', { item:'awakening' });
  ok('usar o Despertar gasta um do armazem', u.inventario.awakening === 0, JSON.stringify(u.inventario));
  ok('e liga o cronometro por 10 minutos', u.awakeningUntil > Date.now() + 9*60*1000 && u.awakeningUntil <= Date.now() + 10*60*1000 + 500,
     'faltam ' + Math.round((u.awakeningUntil - Date.now())/1000) + 's');
  ok('sem ter o item, usar e recusado',
     await recusa('useItem', 'g', { item:'awakening' }) === 'failed-precondition');

  /* A POCAO fica ARMADA esperando. Uma por vez: armar a segunda por cima da primeira gastaria as
     duas e entregaria uma, e o jogador nao teria como saber que perdeu. */
  const u2 = await chamar('useItem', 'g', { item:'potion' });
  ok('a pocao fica armada', u2.pocaoArmada === 'potion', String(u2.pocaoArmada));
  ok('e a segunda e recusada enquanto a primeira espera',
     await recusa('useItem', 'g', { item:'hyperpotion' }) === 'failed-precondition');
  ok('sem gastar a que estava no armazem',
     ((await userRef('g').get()).data().inventario || {}).hyperpotion === 1);

  /* Quando ela dispara, sai da conta. */
  await chamar('consumePotion', 'g', {});
  ok('depois de disparar ela some', ((await userRef('g').get()).data() || {}).pocaoArmada === null);
  ok('e ai da pra armar outra', (await chamar('useItem', 'g', { item:'hyperpotion' })).pocaoArmada === 'hyperpotion');
}

console.log('\n=== DUAS ABAS NAO COMPRAM O MESMO ITEM DUAS VEZES ===');
{
  /* Sem transacao as duas leem o mesmo saldo e as duas passam -- dois itens pelo preco de um. */
  await conta('h', jaVisto(), 50);
  const rs = await Promise.allSettled([
    chamar('buyItem', 'h', { item:'awakening' }),
    chamar('buyItem', 'h', { item:'awakening' })
  ]);
  const passaram = rs.filter(x => x.status === 'fulfilled').length;
  ok('so uma das duas passa', passaram === 1, passaram + ' passaram');
  ok('e sobra zero, nao negativo', await moedasDe('h') === 0, String(await moedasDe('h')));
  ok('e um item so no armazem', ((await userRef('h').get()).data().inventario || {}).awakening === 1);
}

console.log('\n=== AS RECUSAS BÁSICAS ===');
{
  ok('sem login não paga', await recusa('claimJourneyCoins', null, { slot:'0' }) !== null);
  ok('sem login não re-sorteia', await recusa('rerollWildOffer', null, {}) !== null);
  ok('save que não existe é recusado',
     await recusa('claimJourneyCoins', 'z', { slot:'9' }) === 'failed-precondition');
  ok('sem slot é recusado', await recusa('claimJourneyCoins', 'z', {}) === 'invalid-argument');
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);

})();
