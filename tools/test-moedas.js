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
  /* O PRECO SUBIU DE 3 PRA 5 em 11/09/2026, a pedido -- e o pedido veio junto com a VENDA de
     itens, que tinha criado uma torneira de moeda (ver a secao VENDER no CLAUDE.md). */
  await conta('c', jaVisto(), 11);
  /* O SLOT E OBRIGATORIO desde 11/09/2026, quando o TETO por save entrou: sem ele nao ha como
     contar, e deixar passar transformaria "nao mandar o slot" no jeito de furar o teto. */
  const r = await chamar('rerollWildOffer', 'c', { slot:'0' });
  ok('re-sortear custa 5', r.custo === 5 && r.moedas === 6, JSON.stringify(r));
  await chamar('rerollWildOffer', 'c', { slot:'0' });
  ok('e de novo', await moedasDe('c') === 1, String(await moedasDe('c')));
  /* COM MENOS DE 5 ele RECUSA -- e a recusa diz quanto falta, senão o botão parece quebrado. */
  const erro = await recusa('rerollWildOffer', 'c', { slot:'0' });
  ok('com 1 moeda ele recusa', erro === 'failed-precondition', String(erro));
  ok('e não cobra nada na recusa', await moedasDe('c') === 1, String(await moedasDe('c')));

  await conta('d', jaVisto(), 0);
  ok('quem não tem moeda nenhuma também é recusado',
     await recusa('rerollWildOffer', 'd', { slot:'0' }) === 'failed-precondition');
  ok('e continua com zero, não fica negativo', await moedasDe('d') === 0, String(await moedasDe('d')));

  /* COM O BONUS SHINY LIGADO o preco sobe a cada re-sorteio NA MESMA ROTA: 5, 10, 15... O contador
     vem do SAVE, e isso e seguro por construcao -- ele entra na SEMENTE da oferta, entao mentir que
     e zero devolve a MESMA oferta de antes. Quem falsifica pra pagar menos nao ganha nada. */
  await conta('r', jaVisto(), 500);
  await userRef('r').set({ shinyBonusExpiresAt: Date.now() + 60*60*1000 }, { merge:true });
  await saveRef('r', 0).set({ wildRerolls: 0 }, { merge:true });
  const p1 = await chamar('rerollWildOffer', 'r', { slot:'0' });
  ok('com o bonus, o primeiro custa 5', p1.custo === 5, String(p1.custo));
  await saveRef('r', 0).set({ wildRerolls: 1 }, { merge:true });
  const p2 = await chamar('rerollWildOffer', 'r', { slot:'0' });
  ok('o segundo custa 10', p2.custo === 10, String(p2.custo));
  await saveRef('r', 0).set({ wildRerolls: 2 }, { merge:true });
  const p3 = await chamar('rerollWildOffer', 'r', { slot:'0' });
  ok('e o terceiro custa 15', p3.custo === 15, String(p3.custo));
  ok('e o saldo desceu 5+10+15', p3.moedas === 500 - 30, String(p3.moedas));

  /* SEM o bonus o preco nao sobe, por mais que ele tenha re-sorteado. */
  await conta('s', jaVisto(), 500);
  await saveRef('s', 0).set({ wildRerolls: 7 }, { merge:true });
  const semBonus = await chamar('rerollWildOffer', 's', { slot:'0' });
  ok('sem o bonus, sete re-sorteios depois, ainda custa 5', semBonus.custo === 5, String(semBonus.custo));

  /* BONUS VENCIDO tambem nao encarece. */
  await userRef('s').set({ shinyBonusExpiresAt: Date.now() - 1000 }, { merge:true });
  ok('bonus vencido nao encarece', (await chamar('rerollWildOffer', 's', { slot:'0' })).custo === 5);

  /* ⚠️ SEM O SLOT ELE PASSOU A RECUSAR em 11/09/2026, com o teto por save. Antes ele caia no
     preco de sempre ("cliente antigo em cache"), e isso virou um buraco: sem slot nao ha como
     contar, entao nao mandar o slot seria o jeito de furar o teto. O index.html vai com no-cache e
     revalida, entao cliente velho de verdade dura um F5. */
  await userRef('s').set({ shinyBonusExpiresAt: Date.now() + 60*60*1000 }, { merge:true });
  ok('sem o slot ele recusa, em vez de cair no preco de sempre',
     await recusa('rerollWildOffer', 's', {}) === 'failed-precondition');

  /* A RECUSA diz o preco CERTO, nao os 3 fixos -- senao o botao promete um preco e a cobranca
     pratica outro. */
  await conta('u', jaVisto(), 5);
  await userRef('u').set({ shinyBonusExpiresAt: Date.now() + 60*60*1000 }, { merge:true });
  await saveRef('u', 0).set({ wildRerolls: 2 }, { merge:true });
  let msg = '';
  try { await chamar('rerollWildOffer', 'u', { slot:'0' }); } catch(e){ msg = e.message || ''; }
  ok('a recusa nomeia o preco escalonado', /custa 15/.test(msg), msg);
}

console.log('\n=== DUAS ABAS NÃO GASTAM A MESMA MOEDA ===');
{
  /* Sem transação, as duas leem o mesmo saldo e as duas passam -- 10 moedas de re-sorteio saindo
     por 5. É o mesmo cuidado do desconto da raide do Mew.
     O saldo é 8 de propósito: dá pra UM re-sorteio de 5 e não pra dois. */
  await conta('e', jaVisto(), 8);
  const rs = await Promise.allSettled([
    chamar('rerollWildOffer', 'e', { slot:'0' }),
    chamar('rerollWildOffer', 'e', { slot:'0' })
  ]);
  const passaram = rs.filter(x => x.status === 'fulfilled').length;
  ok('só uma das duas passa', passaram === 1, passaram + ' passaram');
  ok('e sobra o saldo certo', await moedasDe('e') === 3, String(await moedasDe('e')));

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
  /* Precos revisados em 04/09/2026: Super Pocao 30 -> 50 e Pocao 15 -> 30. O saldo do fixture subiu
     junto, senao ele quebra na segunda compra em vez de testar o que devia. */
  await conta('g', jaVisto(), 135);
  const r = await chamar('buyItem', 'g', { item:'awakening' });
  ok('comprar o Despertar custa 50', r.moedas === 85 && r.inventario.awakening === 1, JSON.stringify(r));
  await chamar('buyItem', 'g', { item:'potion' });          // 30
  const r3 = await chamar('buyItem', 'g', { item:'hyperpotion' });   // 50
  ok('e os outros dois custam 30 e 50', r3.moedas === 5, r3.moedas + ' moedas sobrando');

  ok('sem moeda suficiente ele recusa',
     await recusa('buyItem', 'g', { item:'awakening' }) === 'failed-precondition');
  ok('e nao cobra nada na recusa', await moedasDe('g') === 5, String(await moedasDe('g')));
  ok('item que nao existe e recusado', await recusa('buyItem', 'g', { item:'masterball' }) === 'invalid-argument');

  /* COMPRAR VARIOS DE UMA VEZ. Quem valida a quantidade e o servidor, contra o saldo lido NA
     TRANSACAO -- o teto do popup e conveniencia da tela, nao a regra. */
  /* A pocao custa 30 desde 04/09/2026, entao 200 moedas compram 6. */
  await conta('q', jaVisto(), 200);
  const q = await chamar('buyItem', 'q', { item:'potion', quantidade: 4 });
  ok('compra 4 pocoes de uma vez', q.inventario.potion === 4, JSON.stringify(q.inventario));
  ok('e cobra as 4', q.moedas === 80 && q.gastou === 120, q.moedas + ' moedas, gastou ' + q.gastou);
  /* PEDIR MAIS DO QUE CABE LEVA O QUE CABE. Recusar a compra inteira porque o saldo mudou entre a
     tela e a transacao (outra aba, um re-sorteio) seria pior que entregar o que da -- e a resposta
     diz quantos foram. */
  const q2 = await chamar('buyItem', 'q', { item:'potion', quantidade: 99 });
  ok('pedir 99 com dinheiro pra 2 leva 2', q2.comprou === 2, q2.comprou + ' comprados');
  ok('e sobra o troco, nao saldo negativo', q2.moedas === 20, String(q2.moedas));
  ok('quantidade zero e recusada', await recusa('buyItem', 'q', { item:'potion', quantidade: 0 }) === 'invalid-argument');
  ok('e quantidade negativa tambem', await recusa('buyItem', 'q', { item:'potion', quantidade: -5 }) === 'invalid-argument');
  /* Sem o campo, compra 1 -- e o que o cliente antigo em cache manda. */
  await userRef('q').set({ moedas: 100 }, { merge:true });
  const q3 = await chamar('buyItem', 'q', { item:'potion' });
  ok('sem quantidade, compra uma so', q3.comprou === 1 && q3.gastou === 30, q3.comprou + '/' + q3.gastou);

  /* O DOCE RARO NAO MORA NO INVENTARIO: ele e o contador rareCandies da conta, o mesmo que a Torre
     escreve e o useRareCandy desconta. Comprar e somar nele -- senao o doce passaria a existir em
     dois lugares, com duas contas que divergem no primeiro erro. */
  await userRef('q').set({ moedas: 1000, rareCandies: 2 }, { merge:true });
  const dc = await chamar('buyItem', 'q', { item:'doce_raro', quantidade: 3 });
  ok('o Doce Raro vai pro contador da conta', dc.rareCandies === 5, String(dc.rareCandies));
  ok('e nao pro inventario', !dc.inventario.doce_raro, JSON.stringify(dc.inventario));
  ok('cobrando 300 cada', dc.moedas === 100, String(dc.moedas));
  ok('e o contador gravado bate', ((await userRef('q').get()).data() || {}).rareCandies === 5);

  /* ⚠️ O BONUS SHINY NAO SE COMPRA MAIS (12/09/2026, a pedido): ele saiu do catalogo da LOJA, e e
     isso que fecha a compra -- o buyItem consulta o catalogo antes de qualquer outra coisa, entao
     nem um cliente velho em cache consegue comprar. */
  await conta('q', jaVisto(), 1600);
  ok('o Bonus Shiny NAO se compra',
     await recusa('buyItem', 'q', { item:'bonus_shiny', quantidade: 2 }) === 'invalid-argument');
  ok('e o dinheiro nao foi tocado', ((await userRef('q').get()).data() || {}).moedas === 1600);

  /* MAS QUEM JA TEM ESTOQUE CONTINUA USANDO -- apagar o que ja foi comprado (ou resgatado de uma
     notificacao de liga, que escreve no MESMO campo) seria tirar o que a pessoa ja tinha.
     O activateBoughtShinyBonus le o inventario direto e NAO passa pelo catalogo. */
  await userRef('q').set({ inventario: { bonus_shiny: 2 } }, { merge:true });
  const a1 = await chamar('activateBoughtShinyBonus', 'q', {});
  ok('ativar gasta um do armazem', a1.inventario.bonus_shiny === 1, JSON.stringify(a1.inventario));
  ok('e liga a janela de 1 hora', a1.expiresAt > Date.now() + 59*60*1000 && a1.expiresAt <= Date.now() + 60*60*1000 + 500,
     'faltam ' + Math.round((a1.expiresAt - Date.now())/60000) + ' min');
  /* O SEGUNDO SOMA no que sobrou, em vez de reiniciar: reiniciar jogaria fora o tempo restante e o
     jogador nao teria como saber que perdeu. */
  const a2 = await chamar('activateBoughtShinyBonus', 'q', {});
  ok('o segundo SOMA o tempo, nao reinicia', a2.expiresAt > a1.expiresAt + 59*60*1000,
     Math.round((a2.expiresAt - a1.expiresAt)/60000) + ' min a mais');
  ok('sem nenhum no armazem, ativar e recusado',
     await recusa('activateBoughtShinyBonus', 'q', {}) === 'failed-precondition');

  /* EQUIPAR: o item sai do armazem e vai num pokemon ESPECIFICO. A chave e a ESPECIE porque um save
     nao tem duas da mesma -- o id da instancia repete entre saves e ja fez o jogador ver oito
     pokemon marcados por causa de seis. */
  const e1 = await chamar('equipItem', 'g', { speciesId:'blastoise', item:'awakening', slot:'0' });
  ok('equipar tira o item do armazem', e1.inventario.awakening === 0, JSON.stringify(e1.inventario));
  ok('e poe no pokemon, sob SLOT:RAIZ da linha dele', e1.equipados['0:squirtle'] === 'awakening', JSON.stringify(e1.equipados));
  ok('sem ter o item, equipar e recusado',
     await recusa('equipItem', 'g', { speciesId:'charizard', item:'awakening', slot:'0' }) === 'failed-precondition');
  ok('item que nao se equipa e recusado',
     await recusa('equipItem', 'g', { speciesId:'blastoise', item:'doce_raro', slot:'0' }) === 'invalid-argument');
  ok('e sem dizer o pokemon tambem',
     await recusa('equipItem', 'g', { item:'potion' }) === 'invalid-argument');

  /* TROCAR O QUE ELE JA CARREGAVA DEVOLVE O ANTIGO. Perder um item por ter clicado no botao errado
     seria pior que a troca nao acontecer. */
  const e2 = await chamar('equipItem', 'g', { speciesId:'blastoise', item:'potion', slot:'0' });
  ok('trocar de item devolve o antigo pro armazem', e2.inventario.awakening === 1, JSON.stringify(e2.inventario));
  ok('e o novo e o que fica no pokemon', e2.equipados['0:squirtle'] === 'potion', JSON.stringify(e2.equipados));

  /* DESEQUIPAR devolve. O item so se PERDE quando trabalha. */
  const antesDeTirar = ((await userRef('g').get()).data().inventario || {}).potion || 0;
  const d1 = await chamar('unequipItem', 'g', { speciesId:'blastoise', slot:'0' });
  ok('tirar o item devolve pro armazem', d1.inventario.potion === antesDeTirar + 1,
     antesDeTirar + ' -> ' + d1.inventario.potion);
  ok('e o pokemon fica sem nada', !d1.equipados['0:squirtle'], JSON.stringify(d1.equipados));
  ok('tirar de quem nao tem nada e recusado',
     await recusa('unequipItem', 'g', { speciesId:'blastoise', slot:'0' }) === 'failed-precondition');

  /* O ITEM TRABALHOU: o cliente avisa e ele some. So sai o que a conta REALMENTE tinha equipado --
     o cliente diz o que gastou, mas nao escolhe o que some. */
  await chamar('equipItem', 'g', { speciesId:'blastoise', item:'awakening', slot:'0' });
  await chamar('consumeEquipped', 'g', { gastos:[{ especie:'blastoise', slot:'0' }] });
  const dep = (await userRef('g').get()).data() || {};
  ok('depois de trabalhar o item some do pokemon', !(dep.equipados||{})['0:squirtle'], JSON.stringify(dep.equipados));
  ok('e NAO volta pro armazem', ((dep.inventario||{}).awakening || 0) === 0, JSON.stringify(dep.inventario));
  /* Uma especie que nao tinha nada equipado nao pode virar escrita nenhuma. */
  await chamar('consumeEquipped', 'g', { gastos:[{ especie:'mewtwo', slot:'0' }] });
  ok('e consumir quem nao tinha item nao quebra nem inventa nada',
     !((await userRef('g').get()).data().equipados || {})['0:mewtwo']);

  /* A CHAVE E A RAIZ DA LINHA, NAO A ESPECIE -- senao o pokemon evolui e perde o item.
     Reportado em 03/09/2026: pocao no Charmeleon, ele evoluiu, e ela sumiu da tela e da batalha. */
  await userRef('g').set({ moedas: 100 }, { merge:true });   // recarrega: as compras acima zeraram o saldo
  await chamar('buyItem', 'g', { item:'potion' });
  const ev = await chamar('equipItem', 'g', { speciesId:'charmeleon', item:'potion', slot:'0' });
  ok('equipar num Charmeleon grava sob SLOT:RAIZ (0:charmander)',
     ev.equipados['0:charmander'] === 'potion' && !ev.equipados['0:charmeleon'], JSON.stringify(ev.equipados));
  /* E o Charizard, depois de evoluir, e o mesmo pokemon pro servidor. */
  const antesDoUn = ((await userRef('g').get()).data().inventario || {}).potion || 0;
  const un = await chamar('unequipItem', 'g', { speciesId:'charizard', slot:'0' });
  ok('e o Charizard consegue tirar o item que o Charmeleon pos',
     un.inventario.potion === antesDoUn + 1 && !un.equipados['0:charmander'], JSON.stringify(un));

  /* DADO JA ESTRAGADO, gravado com a chave velha: tem que ser resgatavel, senao o item fica preso
     pra sempre -- a tela so sabe pedir pela especie que esta vendo. */
  await userRef('g').set({ equipados: { charmeleon: 'potion' } }, { merge:true });
  const antesDoResgate = ((await userRef('g').get()).data().inventario || {}).potion || 0;
  const un2 = await chamar('unequipItem', 'g', { speciesId:'charizard', slot:'0' });
  ok('o item preso na chave velha volta pro armazem',
     un2.inventario.potion === antesDoResgate + 1, antesDoResgate + ' -> ' + un2.inventario.potion);
  ok('e a chave velha (sem slot) e apagada junto', !un2.equipados.charmeleon, JSON.stringify(un2.equipados));

  /* Equipar por cima de dado velho NAO pode deixar as duas chaves: a leitura aceita a linha
     inteira, entao a antiga ressuscitaria o item. */
  await userRef('g').set({ equipados: { charmeleon: 'awakening' } }, { merge:true });
  const ev2 = await chamar('equipItem', 'g', { speciesId:'charizard', item:'potion', slot:'0' });
  ok('equipar por cima da chave velha apaga a velha',
     ev2.equipados['0:charmander'] === 'potion' && !ev2.equipados.charmeleon, JSON.stringify(ev2.equipados));
  ok('e devolve o item que estava la', ev2.devolvido === 'awakening', String(ev2.devolvido));
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

  /* E NEM EQUIPAR O MESMO ITEM EM DOIS POKEMON. Mesmo motivo, mesma transacao: sem ela as duas leem
     o mesmo armazem e as duas passam -- dois pokemon protegidos por um Despertar so. */
  const re = await Promise.allSettled([
    chamar('equipItem', 'h', { speciesId:'blastoise', item:'awakening', slot:'0' }),
    chamar('equipItem', 'h', { speciesId:'charizard', item:'awakening', slot:'0' })
  ]);
  const equiparam = re.filter(x => x.status === 'fulfilled').length;
  ok('so um dos dois equipa', equiparam === 1, equiparam + ' passaram');
  const dh = (await userRef('h').get()).data();
  ok('e o armazem zera, nao fica negativo', (dh.inventario||{}).awakening === 0, JSON.stringify(dh.inventario));
  ok('com um pokemon so carregando', Object.keys(dh.equipados||{}).length === 1, JSON.stringify(dh.equipados));
}

console.log('\n=== AS RECUSAS BÁSICAS ===');
{
  ok('sem login não paga', await recusa('claimJourneyCoins', null, { slot:'0' }) !== null);
  ok('sem login não re-sorteia', await recusa('rerollWildOffer', null, {}) !== null);
  ok('save que não existe é recusado',
     await recusa('claimJourneyCoins', 'z', { slot:'9' }) === 'failed-precondition');
  ok('sem slot é recusado', await recusa('claimJourneyCoins', 'z', {}) === 'invalid-argument');
}

console.log('\n=== O MODO DIFICIL E PAGO ===');
{
  /* Quem cobra e o servidor, pelo mesmo motivo de tudo que mexe em moeda: o campo esta na trava do
     firestore.rules, e cliente escrevendo moeda e chance de shiny a vontade. */
  await conta('dif1', null, 25);
  const r = await chamar('payHardMode', 'dif1');
  ok('cobra o preco cheio', r.custo === fns._MOEDA_MODO_DIFICIL && r.moedas === 25 - fns._MOEDA_MODO_DIFICIL,
     JSON.stringify(r));
  ok('e o saldo no banco bate', await moedasDe('dif1') === 15, String(await moedasDe('dif1')));

  /* COBRAR DE NOVO e o caso normal: cada jornada nova no dificil paga de novo. */
  await chamar('payHardMode', 'dif1');
  ok('duas jornadas custam duas vezes', await moedasDe('dif1') === 5, String(await moedasDe('dif1')));

  /* Sem saldo, a recusa e limpa e NAO tira moeda nenhuma. */
  const cod = await recusa('payHardMode', 'dif1');
  ok('sem moeda suficiente, recusa', cod === 'failed-precondition', String(cod));
  ok('e nao cobra nada na recusa', await moedasDe('dif1') === 5, String(await moedasDe('dif1')));

  /* Conta nova comeca em ZERO: o dificil so abre depois de jogar. */
  await conta('dif2', null, 0);
  ok('conta zerada nao entra no dificil', await recusa('payHardMode', 'dif2') === 'failed-precondition');
  ok('e continua com zero', await moedasDe('dif2') === 0);
}

console.log('\n=== O TETO DE RE-SORTEIOS POR SAVE ===');
{
  /* Pedido em 11/09/2026: "so pode usar no maximo 8 re-sorteio por save". Ele e a trava que o PRECO
     nao consegue ser -- preco depende do saldo, e toda fonte de moeda nova reabre a torneira. */
  await conta('t', jaVisto(), 10000);
  await saveRef('t', 0).set({ saveGen: 0 }, { merge:true });
  let ok8 = 0;
  for(let i = 0; i < 8; i++){
    const r = await chamar('rerollWildOffer', 't', { slot:'0' });
    if(r.ressorteiosUsados === i + 1 && r.ressorteiosRestantes === 8 - (i + 1)) ok8++;
  }
  ok('os oito primeiros passam, contando certo', ok8 === 8, ok8 + ' de 8');
  const cod = await recusa('rerollWildOffer', 't', { slot:'0' });
  ok('e o NONO e recusado', cod === 'failed-precondition', String(cod));
  /* E A RECUSA NAO COBRA -- senao o teto viraria uma forma de perder moeda. */
  const saldo = await moedasDe('t');
  await recusa('rerollWildOffer', 't', { slot:'0' });
  ok('e a recusa nao cobra nada', await moedasDe('t') === saldo, String(await moedasDe('t')));
  /* A RECUSA DIZ POR QUE -- "sem moeda" e "acabaram os re-sorteios" sao problemas diferentes, e um
     botao apagado sem motivo faz procurar bug. */
  let msg = '';
  try { await chamar('rerollWildOffer', 't', { slot:'0' }); } catch(e){ msg = e.message || ''; }
  ok('e a recusa nomeia o teto, nao a moeda', /8 re-sorteios/.test(msg) && !/moeda/.test(msg), msg);

  /* ⚠️ O TETO E POR SAVE, e o OUTRO SLOT nao e afetado. */
  await saveRef('t', 1).set({ saveGen: 0 }, { merge:true });
  const outro = await chamar('rerollWildOffer', 't', { slot:'1' });
  ok('outro slot tem o teto proprio', outro.ressorteiosUsados === 1, String(outro.ressorteiosUsados));

  /* ⚠️ E ELE ZERA QUANDO UM SAVE NOVO NASCE NO MESMO SLOT. A chave e slot:geracao, e a geracao
     avanca quando o save novo e criado (o mesmo mecanismo que fecha o save-scumming dos iniciais).
     Sem isso, apagar e recriar o save herdaria o teto gasto -- ou, pior, resolver com uma limpeza a
     mao esqueceria algum caminho. */
  await saveRef('t', 0).set({ saveGen: 1 }, { merge:true });
  const novo = await chamar('rerollWildOffer', 't', { slot:'0' });
  ok('save novo no mesmo slot comeca com o teto cheio', novo.ressorteiosUsados === 1,
     String(novo.ressorteiosUsados));
  ok('e o teto do save ANTIGO continua gravado',
     (((await userRef('t').get()).data() || {}).rerollsPorSave || {})['0:0'] === 8,
     JSON.stringify(((await userRef('t').get()).data() || {}).rerollsPorSave));

  /* ⚠️ O CONTADOR NAO MORA NO SAVE, e este caso e o que prova. O save e LIVRE pro dono, entao zerar
     o wildRerolls dele nao pode devolver re-sorteio nenhum -- o que ele controla e o PRECO
     escalonado, nao o teto. */
  await conta('t2', jaVisto(), 10000);
  await saveRef('t2', 0).set({ saveGen: 0 }, { merge:true });
  for(let i = 0; i < 8; i++) await chamar('rerollWildOffer', 't2', { slot:'0' });
  await saveRef('t2', 0).set({ wildRerolls: 0 }, { merge:true });   // o jogador "limpa" o save
  ok('zerar o contador do SAVE nao devolve re-sorteio',
     await recusa('rerollWildOffer', 't2', { slot:'0' }) === 'failed-precondition');

  /* SEM SLOT ele RECUSA em vez de passar livre: deixar passar transformaria "nao mandar o slot" no
     jeito de furar o teto, e um cliente adulterado faria exatamente isso. */
  await conta('t3', jaVisto(), 1000);
  ok('sem o slot ele recusa', await recusa('rerollWildOffer', 't3', {}) === 'failed-precondition');
  ok('e nao cobra nada', await moedasDe('t3') === 1000, String(await moedasDe('t3')));

  /* DUAS ABAS NAO FURAM O TETO: o contador sobe na MESMA transacao da cobranca. */
  await conta('t4', jaVisto(), 10000);
  await saveRef('t4', 0).set({ saveGen: 0 }, { merge:true });
  for(let i = 0; i < 7; i++) await chamar('rerollWildOffer', 't4', { slot:'0' });
  const duas = await Promise.allSettled([
    chamar('rerollWildOffer', 't4', { slot:'0' }),
    chamar('rerollWildOffer', 't4', { slot:'0' })
  ]);
  ok('com 1 sobrando, so UMA das duas abas passa',
     duas.filter(x => x.status === 'fulfilled').length === 1,
     duas.filter(x => x.status === 'fulfilled').length + ' passaram');
  ok('e o total fica exatamente em 8',
     (((await userRef('t4').get()).data() || {}).rerollsPorSave || {})['0:0'] === 8,
     JSON.stringify(((await userRef('t4').get()).data() || {}).rerollsPorSave));

  /* OS DOIS LADOS TEM QUE CONCORDAR NO TETO: o cliente desabilita o botao com esse numero e o
     servidor recusa com ele. Se divergirem, a tela oferece o que a cobranca nega. */
  {
    const S = require('./game-sandbox').createSandbox();
    const srv = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const m = srv.match(/const MAX_RESSORTEIOS_POR_SAVE = (\d+)/);
    ok('o teto e o mesmo nos dois lados',
       !!m && Number(m[1]) === S.MAX_RESSORTEIOS_POR_SAVE,
       'cliente ' + S.MAX_RESSORTEIOS_POR_SAVE + '  servidor ' + (m && m[1]));
    ok('e ele e 8', S.MAX_RESSORTEIOS_POR_SAVE === 8, String(S.MAX_RESSORTEIOS_POR_SAVE));
  }

  /* ⚠️ E O CAMPO PRECISA ESTAR NA TRAVA DAS REGRAS -- senao o teto inteiro e decorativo: uma linha
     no console zeraria o contador. Lido do firestore.rules, que e a fonte da verdade desde
     30/08/2026. */
  {
    const regras = require('fs').readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const naTrava = (regras.match(/hasAny\(\[[^\]]*'rerollsPorSave'[^\]]*\]\)/g) || []).length;
    ok('o rerollsPorSave esta na trava do firestore.rules (escrita E criacao)', naTrava === 2,
       naTrava + ' ocorrencias');
  }
}
console.log('\n=== A LOJA: VENDER POR METADE ===');
{
  /* Pedido em 11/09/2026: "caso o usuario ja tenha um dos itens listado, ele pode ter a opcao
     vender por 50% do valor de compra". */
  await conta('v', jaVisto(), 0);
  await userRef('v').set({ inventario: { potion: 4, awakening: 1 }, rareCandies: 2 }, { merge:true });

  const r = await chamar('sellItem', 'v', { item:'potion' });
  ok('vender uma Pocao (30) rende 15', r.moedas === 15 && r.recebeu === 15, JSON.stringify(r));
  ok('e tira do armazem', r.inventario.potion === 3, JSON.stringify(r.inventario));

  /* A METADE E SOBRE O PRECO DE COMPRA, item a item -- e o numero sai do MESMO preco, nunca de uma
     segunda tabela. Aqui se cobra o resultado dos quatro precos que o jogo tem hoje. */
  const v2 = await chamar('sellItem', 'v', { item:'awakening' });   // 50 -> 25
  ok('o Despertar (50) rende 25', v2.recebeu === 25, String(v2.recebeu));

  /* VENDER VARIOS DE UMA VEZ, e a mesma regra da compra: pedir mais do que se tem vende o que tem.
     Recusar tudo porque o estoque mudou entre a tela e a transacao seria pior que fazer o que da. */
  const v3 = await chamar('sellItem', 'v', { item:'potion', quantidade: 99 });
  ok('pedir 99 tendo 3 vende 3', v3.vendeu === 3, v3.vendeu + ' vendidas');
  ok('e paga as 3', v3.recebeu === 45, String(v3.recebeu));
  ok('e o armazem zera, nao fica negativo', v3.inventario.potion === 0, JSON.stringify(v3.inventario));

  /* SEM ESTOQUE ELE RECUSA -- e nao paga nada. E a guarda que impede moeda do nada. */
  const antes = await moedasDe('v');
  ok('vender o que nao se tem e recusado',
     await recusa('sellItem', 'v', { item:'faixa_foco' }) === 'failed-precondition');
  ok('e nao paga nada na recusa', await moedasDe('v') === antes, String(await moedasDe('v')));
  ok('item que nao existe e recusado', await recusa('sellItem', 'v', { item:'masterball' }) === 'invalid-argument');
  ok('quantidade zero e recusada', await recusa('sellItem', 'v', { item:'awakening', quantidade: 0 }) === 'invalid-argument');

  /* O DOCE RARO SAI DO CONTADOR, nao do inventario -- o mesmo caminho da compra, ao contrario. */
  const dc = await chamar('sellItem', 'v', { item:'doce_raro', quantidade: 2 });
  ok('o Doce Raro sai do contador da conta', dc.rareCandies === 0, String(dc.rareCandies));
  ok('e rende 150 cada', dc.recebeu === 300, String(dc.recebeu));
  ok('e o contador gravado bate', ((await userRef('v').get()).data() || {}).rareCandies === 0);
  ok('e sem doce ele recusa', await recusa('sellItem', 'v', { item:'doce_raro' }) === 'failed-precondition');

  /* ⚠️ NAO EXISTE LOOP DE ARBITRAGEM, e isso e por construcao: comprar e vender de volta PERDE
     metade. Qualquer fracao acima de 100% viraria maquina de moeda, e este caso e o que grita se
     alguem mexer nela. */
  await conta('w', jaVisto(), 300);
  await chamar('buyItem', 'w', { item:'potion', quantidade: 10 });   // -300
  const volta = await chamar('sellItem', 'w', { item:'potion', quantidade: 10 });   // +150
  ok('comprar e vender de volta PERDE metade', volta.moedas === 150, volta.moedas + ' de 300');

  /* ⚠️ O BONUS SHINY NAO SE VENDE, tendo estoque ou nao (12/09/2026, a pedido). Ele era a maior
     torneira de moeda da loja: 400 por unidade, ou seja quase 6 jornadas de renda por um premio
     que vem de jogar. Hoje ele nao esta no catalogo, e o sellItem recusa pela mesma porta do
     buyItem -- o que tambem cobre o cliente velho em cache que ainda desenhe o botao.
     O CASO COM ESTOQUE e o que importa: sem ele, "nao vende" passaria so por nao haver o que
     descontar, e a regra ficaria sem trava. */
  await conta('x', jaVisto(), 0);
  ok('sem estoque, o Bonus Shiny nao se vende',
     await recusa('sellItem', 'x', { item:'bonus_shiny' }) === 'invalid-argument');
  await userRef('x').set({ inventario: { bonus_shiny: 1 } }, { merge:true });
  ok('e COM estoque tambem nao',
     await recusa('sellItem', 'x', { item:'bonus_shiny' }) === 'invalid-argument');
  ok('e o estoque continua la, intacto',
     ((await userRef('x').get()).data() || {}).inventario.bonus_shiny === 1);
  ok('sem ter recebido moeda nenhuma', (((await userRef('x').get()).data() || {}).moedas || 0) === 0);

  /* OS DOIS LADOS TEM QUE CONCORDAR NO PRECO. O cliente desenha "Vender por N" e o servidor paga N;
     se divergirem, a tela promete o que a cobranca nao pratica -- o mesmo cuidado que o preco de
     COMPRA ja carrega. Isto compara os DOIS catalogos, item a item. */
  {
    const S = require('./game-sandbox').createSandbox();
    const compravel = Object.keys(S.ITENS).filter(id => S.ITENS[id].comprável);
    const fora = compravel.filter(id => S.precoDeVenda(id) !== Math.floor(S.ITENS[id].preco / 2));
    ok('o cliente calcula a metade de todos', fora.length === 0, fora.join(','));
    /* E a metade do CLIENTE tem que ser a mesma do SERVIDOR, que e quem paga. Lido do codigo do
       servidor, porque o preco de la vive na tabela LOJA e nao e exportado. */
    const srv = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const divergem = compravel.filter(id => {
      const m = srv.match(new RegExp('\\b' + id + ':\\s*\\{[^}]*preco:\\s*(\\d+)'));
      return !m || Math.floor(Number(m[1]) / 2) !== S.precoDeVenda(id);
    });
    ok('e o servidor paga exatamente essa metade', divergem.length === 0, divergem.join(','));
  }
}
console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);

})();
