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

  /* COM O BONUS SHINY LIGADO o preco sobe a cada re-sorteio NA MESMA ROTA: 3, 6, 9... O contador
     vem do SAVE, e isso e seguro por construcao -- ele entra na SEMENTE da oferta, entao mentir que
     e zero devolve a MESMA oferta de antes. Quem falsifica pra pagar menos nao ganha nada. */
  await conta('r', jaVisto(), 500);
  await userRef('r').set({ shinyBonusExpiresAt: Date.now() + 60*60*1000 }, { merge:true });
  await saveRef('r', 0).set({ wildRerolls: 0 }, { merge:true });
  const p1 = await chamar('rerollWildOffer', 'r', { slot:'0' });
  ok('com o bonus, o primeiro custa 3', p1.custo === 3, String(p1.custo));
  await saveRef('r', 0).set({ wildRerolls: 1 }, { merge:true });
  const p2 = await chamar('rerollWildOffer', 'r', { slot:'0' });
  ok('o segundo custa 6', p2.custo === 6, String(p2.custo));
  await saveRef('r', 0).set({ wildRerolls: 2 }, { merge:true });
  const p3 = await chamar('rerollWildOffer', 'r', { slot:'0' });
  ok('e o terceiro custa 9', p3.custo === 9, String(p3.custo));
  ok('e o saldo desceu 3+6+9', p3.moedas === 500 - 18, String(p3.moedas));

  /* SEM o bonus o preco nao sobe, por mais que ele tenha re-sorteado. */
  await conta('s', jaVisto(), 500);
  await saveRef('s', 0).set({ wildRerolls: 7 }, { merge:true });
  const semBonus = await chamar('rerollWildOffer', 's', { slot:'0' });
  ok('sem o bonus, sete re-sorteios depois, ainda custa 3', semBonus.custo === 3, String(semBonus.custo));

  /* BONUS VENCIDO tambem nao encarece. */
  await userRef('s').set({ shinyBonusExpiresAt: Date.now() - 1000 }, { merge:true });
  ok('bonus vencido nao encarece', (await chamar('rerollWildOffer', 's', { slot:'0' })).custo === 3);

  /* CLIENTE ANTIGO EM CACHE nao manda o slot: cai no preco de sempre, em vez de quebrar. */
  await userRef('s').set({ shinyBonusExpiresAt: Date.now() + 60*60*1000 }, { merge:true });
  ok('sem o slot, o preco e o de sempre', (await chamar('rerollWildOffer', 's', {})).custo === 3);

  /* A RECUSA diz o preco CERTO, nao os 3 fixos -- senao o botao promete um preco e a cobranca
     pratica outro. */
  await conta('u', jaVisto(), 5);
  await userRef('u').set({ shinyBonusExpiresAt: Date.now() + 60*60*1000 }, { merge:true });
  await saveRef('u', 0).set({ wildRerolls: 2 }, { merge:true });
  let msg = '';
  try { await chamar('rerollWildOffer', 'u', { slot:'0' }); } catch(e){ msg = e.message || ''; }
  ok('a recusa nomeia o preco escalonado', /custa 9/.test(msg), msg);
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

  /* COMPRAR VARIOS DE UMA VEZ. Quem valida a quantidade e o servidor, contra o saldo lido NA
     TRANSACAO -- o teto do popup e conveniencia da tela, nao a regra. */
  await conta('q', jaVisto(), 100);
  const q = await chamar('buyItem', 'q', { item:'potion', quantidade: 4 });
  ok('compra 4 pocoes de uma vez', q.inventario.potion === 4, JSON.stringify(q.inventario));
  ok('e cobra as 4', q.moedas === 40 && q.gastou === 60, q.moedas + ' moedas, gastou ' + q.gastou);
  /* PEDIR MAIS DO QUE CABE LEVA O QUE CABE. Recusar a compra inteira porque o saldo mudou entre a
     tela e a transacao (outra aba, um re-sorteio) seria pior que entregar o que da -- e a resposta
     diz quantos foram. */
  const q2 = await chamar('buyItem', 'q', { item:'potion', quantidade: 99 });
  ok('pedir 99 com dinheiro pra 2 leva 2', q2.comprou === 2, q2.comprou + ' comprados');
  ok('e sobra o troco, nao saldo negativo', q2.moedas === 10, String(q2.moedas));
  ok('quantidade zero e recusada', await recusa('buyItem', 'q', { item:'potion', quantidade: 0 }) === 'invalid-argument');
  ok('e quantidade negativa tambem', await recusa('buyItem', 'q', { item:'potion', quantidade: -5 }) === 'invalid-argument');
  /* Sem o campo, compra 1 -- e o que o cliente antigo em cache manda. */
  await userRef('q').set({ moedas: 100 }, { merge:true });
  const q3 = await chamar('buyItem', 'q', { item:'potion' });
  ok('sem quantidade, compra uma so', q3.comprou === 1, String(q3.comprou));

  /* O DOCE RARO NAO MORA NO INVENTARIO: ele e o contador rareCandies da conta, o mesmo que a Torre
     escreve e o useRareCandy desconta. Comprar e somar nele -- senao o doce passaria a existir em
     dois lugares, com duas contas que divergem no primeiro erro. */
  await userRef('q').set({ moedas: 1000, rareCandies: 2 }, { merge:true });
  const dc = await chamar('buyItem', 'q', { item:'doce_raro', quantidade: 3 });
  ok('o Doce Raro vai pro contador da conta', dc.rareCandies === 5, String(dc.rareCandies));
  ok('e nao pro inventario', !dc.inventario.doce_raro, JSON.stringify(dc.inventario));
  ok('cobrando 300 cada', dc.moedas === 100, String(dc.moedas));
  ok('e o contador gravado bate', ((await userRef('q').get()).data() || {}).rareCandies === 5);

  /* O BONUS SHINY COMPRADO e estoque de verdade, e tem funcao propria pra ativar: os outros dois
     caminhos leem um CUPOM (save campeao / notificacao), que e marca de premio e nao estoque. */
  await conta('q', jaVisto(), 1600);
  const bs = await chamar('buyItem', 'q', { item:'bonus_shiny', quantidade: 2 });
  ok('o Bonus Shiny comprado vira estoque', bs.inventario.bonus_shiny === 2, JSON.stringify(bs.inventario));
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
  const e1 = await chamar('equipItem', 'g', { speciesId:'blastoise', item:'awakening' });
  ok('equipar tira o item do armazem', e1.inventario.awakening === 0, JSON.stringify(e1.inventario));
  ok('e poe no pokemon, sob a RAIZ da linha dele', e1.equipados.squirtle === 'awakening', JSON.stringify(e1.equipados));
  ok('sem ter o item, equipar e recusado',
     await recusa('equipItem', 'g', { speciesId:'charizard', item:'awakening' }) === 'failed-precondition');
  ok('item que nao se equipa e recusado',
     await recusa('equipItem', 'g', { speciesId:'blastoise', item:'doce_raro' }) === 'invalid-argument');
  ok('e sem dizer o pokemon tambem',
     await recusa('equipItem', 'g', { item:'potion' }) === 'invalid-argument');

  /* TROCAR O QUE ELE JA CARREGAVA DEVOLVE O ANTIGO. Perder um item por ter clicado no botao errado
     seria pior que a troca nao acontecer. */
  const e2 = await chamar('equipItem', 'g', { speciesId:'blastoise', item:'potion' });
  ok('trocar de item devolve o antigo pro armazem', e2.inventario.awakening === 1, JSON.stringify(e2.inventario));
  ok('e o novo e o que fica no pokemon', e2.equipados.squirtle === 'potion', JSON.stringify(e2.equipados));

  /* DESEQUIPAR devolve. O item so se PERDE quando trabalha. */
  const antesDeTirar = ((await userRef('g').get()).data().inventario || {}).potion || 0;
  const d1 = await chamar('unequipItem', 'g', { speciesId:'blastoise' });
  ok('tirar o item devolve pro armazem', d1.inventario.potion === antesDeTirar + 1,
     antesDeTirar + ' -> ' + d1.inventario.potion);
  ok('e o pokemon fica sem nada', !d1.equipados.blastoise, JSON.stringify(d1.equipados));
  ok('tirar de quem nao tem nada e recusado',
     await recusa('unequipItem', 'g', { speciesId:'blastoise' }) === 'failed-precondition');

  /* O ITEM TRABALHOU: o cliente avisa e ele some. So sai o que a conta REALMENTE tinha equipado --
     o cliente diz o que gastou, mas nao escolhe o que some. */
  await chamar('equipItem', 'g', { speciesId:'blastoise', item:'awakening' });
  await chamar('consumeEquipped', 'g', { especies:['blastoise'] });
  const dep = (await userRef('g').get()).data() || {};
  ok('depois de trabalhar o item some do pokemon', !(dep.equipados||{}).blastoise, JSON.stringify(dep.equipados));
  ok('e NAO volta pro armazem', ((dep.inventario||{}).awakening || 0) === 0, JSON.stringify(dep.inventario));
  /* Uma especie que nao tinha nada equipado nao pode virar escrita nenhuma. */
  await chamar('consumeEquipped', 'g', { especies:['mewtwo'] });
  ok('e consumir quem nao tinha item nao quebra nem inventa nada',
     !((await userRef('g').get()).data().equipados || {}).mewtwo);

  /* A CHAVE E A RAIZ DA LINHA, NAO A ESPECIE -- senao o pokemon evolui e perde o item.
     Reportado em 03/09/2026: pocao no Charmeleon, ele evoluiu, e ela sumiu da tela e da batalha. */
  await userRef('g').set({ moedas: 100 }, { merge:true });   // recarrega: as compras acima zeraram o saldo
  await chamar('buyItem', 'g', { item:'potion' });
  const ev = await chamar('equipItem', 'g', { speciesId:'charmeleon', item:'potion' });
  ok('equipar num Charmeleon grava sob a RAIZ (charmander)',
     ev.equipados.charmander === 'potion' && !ev.equipados.charmeleon, JSON.stringify(ev.equipados));
  /* E o Charizard, depois de evoluir, e o mesmo pokemon pro servidor. */
  const antesDoUn = ((await userRef('g').get()).data().inventario || {}).potion || 0;
  const un = await chamar('unequipItem', 'g', { speciesId:'charizard' });
  ok('e o Charizard consegue tirar o item que o Charmeleon pos',
     un.inventario.potion === antesDoUn + 1 && !un.equipados.charmander, JSON.stringify(un));

  /* DADO JA ESTRAGADO, gravado com a chave velha: tem que ser resgatavel, senao o item fica preso
     pra sempre -- a tela so sabe pedir pela especie que esta vendo. */
  await userRef('g').set({ equipados: { charmeleon: 'potion' } }, { merge:true });
  const antesDoResgate = ((await userRef('g').get()).data().inventario || {}).potion || 0;
  const un2 = await chamar('unequipItem', 'g', { speciesId:'charizard' });
  ok('o item preso na chave velha volta pro armazem',
     un2.inventario.potion === antesDoResgate + 1, antesDoResgate + ' -> ' + un2.inventario.potion);
  ok('e a chave velha e apagada junto', !un2.equipados.charmeleon, JSON.stringify(un2.equipados));

  /* Equipar por cima de dado velho NAO pode deixar as duas chaves: a leitura aceita a linha
     inteira, entao a antiga ressuscitaria o item. */
  await userRef('g').set({ equipados: { charmeleon: 'awakening' } }, { merge:true });
  const ev2 = await chamar('equipItem', 'g', { speciesId:'charizard', item:'potion' });
  ok('equipar por cima da chave velha apaga a velha',
     ev2.equipados.charmander === 'potion' && !ev2.equipados.charmeleon, JSON.stringify(ev2.equipados));
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
    chamar('equipItem', 'h', { speciesId:'blastoise', item:'awakening' }),
    chamar('equipItem', 'h', { speciesId:'charizard', item:'awakening' })
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

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);

})();
