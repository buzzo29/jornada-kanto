/**
 * APAGAR UMA MENSAGEM NÃO PODE CUSTAR UM ITEM DA MOCHILA.
 *
 * O que ele existe pra pegar, reportado em 10/09/2026: a notificação de campeão de liga É o cupom
 * do bônus shiny -- ela é a única forma de ativá-lo --, então apagá-la apagava o item da mochila
 * junto. Agora o prêmio é RESGATADO pro armazém (`inventario.bonus_shiny`) antes de a mensagem
 * sumir, e o jogador ativa por lá.
 *
 * Ele tranca também o que NÃO pode mudar junto:
 *   - o DOCE RARO é um contador na conta e notificação nenhuma o carrega -- apagar não o toca;
 *   - o prêmio da ELITE mora no SAVE e nunca dependeu da notificação;
 *   - o botão EXCLUIR da mochila (`descartar`) continua jogando fora de verdade, senão ele viraria
 *     um laço que devolve o item pro armazém e não descarta nada.
 *
 *   node tools/test-notif-premio.js
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

let falhas = 0, casos = 0;
function ok(nome, cond, detalhe){
  casos++;
  if(cond) console.log('  ✓ ' + nome);
  else { falhas++; console.log('  ✗ ' + nome + (detalhe ? ' — ' + detalhe : '')); }
}
const chamar = (fn, uid, data)=> fn({ auth:{ uid }, data });
const notifs = (uid)=> db.collection('users').doc(uid).collection('notifications');
const conta  = (uid)=> db.collection('users').doc(uid);

(async ()=>{
console.log('\nAPAGAR NOTIFICACAO x MOCHILA');

/* ---------- 1) o caso reportado: apagar em LOTE ---------- */
{
  const uid = 'ash';
  await conta(uid).set({ rareCandies: 3, inventario: { potion: 2 } });
  await notifs(uid).doc('n1').set({ type:'league_champion', title:'Campeao!', meta:{} });
  await notifs(uid).doc('n2').set({ type:'league_champion', title:'Campeao de novo!', meta:{} });
  await notifs(uid).doc('n3').set({ type:'league_champion', title:'Ja usado', meta:{ activated:true } });
  await notifs(uid).doc('n4').set({ type:'match_played', title:'Sua partida saiu' });

  const r = await chamar(fns.deleteNotifications, uid, { ids:['n1','n2','n3','n4'] });
  const d = (await conta(uid).get()).data() || {};

  ok('as quatro mensagens sumiram', r.deleted === 4);
  ok('e os DOIS cupons nao ativados viraram item na mochila',
     (d.inventario||{}).bonus_shiny === 2, 'bonus_shiny = ' + JSON.stringify((d.inventario||{}).bonus_shiny));
  ok('o servidor diz quantos resgatou (a tela usa pra atualizar sem recarregar)', r.resgatados === 2,
     'resgatados = ' + r.resgatados);
  /* O JA ATIVADO nao pode virar item de novo: ele foi gasto, e a mensagem so sobrou como recado. */
  ok('o cupom JA ATIVADO nao vira item de novo', (d.inventario||{}).bonus_shiny === 2);
  ok('o DOCE RARO nao foi tocado', d.rareCandies === 3, 'rareCandies = ' + d.rareCandies);
  ok('e o resto da mochila continua igual', (d.inventario||{}).potion === 2);
  const sobrou = await notifs(uid).get();
  ok('nenhuma mensagem sobrou', sobrou.docs.length === 0, sobrou.docs.length + ' sobraram');
}

/* ---------- 2) apagar AVULSO ---------- */
{
  const uid = 'misty';
  await conta(uid).set({ inventario: {} });
  await notifs(uid).doc('n1').set({ type:'league_champion', title:'Campea!', meta:{} });
  const r = await chamar(fns.deleteNotification, uid, { notificationId:'n1' });
  const d = (await conta(uid).get()).data() || {};
  ok('apagar avulso tambem resgata', (d.inventario||{}).bonus_shiny === 1 && r.resgatados === 1,
     'bonus_shiny = ' + JSON.stringify((d.inventario||{}).bonus_shiny));
}

/* ---------- 3) o botao EXCLUIR da mochila descarta DE VERDADE ---------- */
{
  const uid = 'brock';
  await conta(uid).set({ inventario: {} });
  await notifs(uid).doc('n1').set({ type:'league_champion', title:'Campeao!', meta:{} });
  const r = await chamar(fns.deleteNotification, uid, { notificationId:'n1', descartar:true });
  const d = (await conta(uid).get()).data() || {};
  ok('descartar NAO devolve o item pro armazem',
     !((d.inventario||{}).bonus_shiny > 0) && r.resgatados === 0,
     'bonus_shiny = ' + JSON.stringify((d.inventario||{}).bonus_shiny));
  const sobrou = await notifs(uid).get();
  ok('e a notificacao sumiu mesmo assim', sobrou.docs.length === 0);
}

/* ---------- 4) o premio da ELITE nao depende da notificacao ---------- */
{
  const uid = 'gary';
  await conta(uid).set({ inventario: {} });
  await db.collection('users').doc(uid).collection('saves').doc('0')
    .set({ eliteStatus:'champion', eliteShinyGranted:true });
  await notifs(uid).doc('n1').set({ type:'elite_champion', title:'Campeao da Elite!', meta:{} });
  await chamar(fns.deleteNotification, uid, { notificationId:'n1' });
  const save = (await db.collection('users').doc(uid).collection('saves').doc('0').get()).data() || {};
  const d = (await conta(uid).get()).data() || {};
  ok('o cupom da Elite continua no SAVE', save.eliteShinyGranted === true && !save.eliteShinyUsed);
  /* E ele NAO e resgatado pro armazem: seria o mesmo premio contado duas vezes -- uma no save,
     outra na mochila. */
  ok('e nao virou item na mochila (seria o mesmo premio duas vezes)',
     !((d.inventario||{}).bonus_shiny > 0), 'bonus_shiny = ' + JSON.stringify((d.inventario||{}).bonus_shiny));
  ok('e ele ainda da pra ativar pelo save', (await chamar(fns.activateEliteShinyBonus, uid, { slot:'0' })).expiresAt > Date.now());
}

console.log('\n' + (falhas ? falhas + ' de ' + casos + ' casos FALHARAM' : 'Tudo certo. (' + casos + ' casos)'));
process.exit(falhas ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(1); });
