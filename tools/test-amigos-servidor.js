/**
 * Teste da máquina de estados da LISTA DE AMIGOS, no servidor, sem Firebase.
 *
 * Carrega functions/index.js com firebase-admin e firebase-functions trocados por stubs (o
 * onCall passa a devolver o próprio handler, então dá pra chamar cada função como se fosse a
 * requisição), e roda os fluxos de ponta a ponta contra o Firestore em memória.
 *
 * O que ele existe pra pegar: estado meio-gravado. Amizade só de um lado, pedido que sobrevive
 * ao aceite, contador de pedidos que não desce, desafio que fica pendurado depois de recusado.
 * Nada disso aparece na tela até um jogador cair no caso.
 *
 *   node tools/test-amigos-servidor.js
 */
const path = require('path');
const Module = require('module');
const fake = require('./fake-firestore');

const db = fake.makeDb();
const stubs = {
  'firebase-functions/v2/scheduler': { onSchedule: (a, b)=> (typeof a === 'function' ? a : b) },
  'firebase-functions/v2/https': {
    onCall: (fn)=>fn,
    // erro com .code, como o HttpsError de verdade -- é o campo que o teste checa
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
async function esperaErro(nome, codigoEsperado, fn){
  casos++;
  try{ await fn(); falhas++; console.log(`  ✗ ${nome} — não lançou nada`); }
  catch(e){
    if(e.code === codigoEsperado) console.log('  ✓ ' + nome);
    else { falhas++; console.log(`  ✗ ${nome} — veio "${e.code}: ${e.message}"`); }
  }
}
const chamar = (fn, uid, data)=> fn({ auth:{ uid }, data: data || {} });
const doc = (p)=> fake.store.get(p);

async function criarConta(uid, nome, extra){
  await db.collection('users').doc(uid).set(Object.assign({ trainerName: nome, trainerNameLower: nome.toLowerCase() }, extra||{}));
}

(async ()=>{
console.log('\nPEDIDO E ACEITE');
fake.reset();
await criarConta('ash', 'Ash');
await criarConta('misty', 'Misty');
await criarConta('brock', 'Brock');

await chamar(fns.sendFriendRequest, 'ash', { targetUid:'misty' });
ok('o pedido chega na caixa de quem recebe', !!doc('users/misty/friendRequests/ash'));
ok('não cria amizade antes do aceite', !doc('users/ash/friends/misty') && !doc('users/misty/friends/ash'));
ok('notificação criada pra quem recebeu',
   [...fake.store.keys()].some(k=>k.startsWith('users/misty/notifications/')));
ok('contador de pedidos enviados subiu', doc('users/ash').friendRequestsSent === 1);

const repetido = await chamar(fns.sendFriendRequest, 'ash', { targetUid:'misty' });
ok('pedir de novo não duplica nem explode', repetido.jaPedido === true);

await esperaErro('não dá pra pedir amizade a si mesmo', 'invalid-argument',
  ()=>chamar(fns.sendFriendRequest, 'ash', { targetUid:'ash' }));
await esperaErro('não dá pra pedir a quem não existe', 'not-found',
  ()=>chamar(fns.sendFriendRequest, 'ash', { targetUid:'fantasma' }));

await chamar(fns.respondFriendRequest, 'misty', { fromUid:'ash', accept:true });
ok('amizade gravada NOS DOIS lados', !!doc('users/ash/friends/misty') && !!doc('users/misty/friends/ash'));
ok('o pedido some depois do aceite', !doc('users/misty/friendRequests/ash'));
ok('contador de pedidos enviados desceu', doc('users/ash').friendRequestsSent === 0);
await esperaErro('pedir a quem já é amigo é recusado', 'already-exists',
  ()=>chamar(fns.sendFriendRequest, 'ash', { targetUid:'misty' }));

console.log('\nPEDIDOS CRUZADOS (os dois se adicionam ao mesmo tempo)');
await chamar(fns.sendFriendRequest, 'brock', { targetUid:'ash' });
const cruzado = await chamar(fns.sendFriendRequest, 'ash', { targetUid:'brock' });
ok('vira aceite direto em vez de dois pedidos parados', cruzado.aceitoDireto === true);
ok('amizade dos dois lados', !!doc('users/ash/friends/brock') && !!doc('users/brock/friends/ash'));
ok('nenhum pedido sobrou aberto', !doc('users/ash/friendRequests/brock') && !doc('users/brock/friendRequests/ash'));

console.log('\nRECUSA E REMOÇÃO');
await criarConta('gary', 'Gary');
await chamar(fns.sendFriendRequest, 'gary', { targetUid:'ash' });
await chamar(fns.respondFriendRequest, 'ash', { fromUid:'gary', accept:false });
ok('recusa apaga o pedido', !doc('users/ash/friendRequests/gary'));
ok('recusa não cria amizade', !doc('users/ash/friends/gary'));
ok('recusa devolve o contador de quem pediu', doc('users/gary').friendRequestsSent === 0);
await esperaErro('responder um pedido que não existe', 'not-found',
  ()=>chamar(fns.respondFriendRequest, 'ash', { fromUid:'gary', accept:true }));

await chamar(fns.removeFriend, 'ash', { targetUid:'brock' });
ok('remover apaga os DOIS lados', !doc('users/ash/friends/brock') && !doc('users/brock/friends/ash'));

console.log('\nA LISTA');
await db.collection('users').doc('misty').set({ lastSeenAt: Date.now(), pokedexCaught:['pikachu','oddish'], onlineWins:4 }, { merge:true });
await db.collection('rivalries').doc(['ash','misty'].sort().join('__')).set({
  total:3, wins_ash:2, wins_misty:1, lastAt: Date.now(), lastWinnerUid:'ash'
});
const lista = await chamar(fns.getMyFriends, 'ash');
ok('a lista traz o amigo', lista.friends.length === 1 && lista.friends[0].uid === 'misty');
ok('lê nome e pokédex do documento do usuário, não da cópia na amizade',
   lista.friends[0].name === 'Misty' && lista.friends[0].pokedex === 2);
ok('retrospecto na perspectiva de quem pediu',
   lista.friends[0].rivalry.wins === 2 && lista.friends[0].rivalry.losses === 1,
   JSON.stringify(lista.friends[0].rivalry));
const listaDela = await chamar(fns.getMyFriends, 'misty');
ok('o mesmo retrospecto aparece invertido do outro lado',
   listaDela.friends[0].rivalry.wins === 1 && listaDela.friends[0].rivalry.losses === 2);
ok('presença foi carimbada', typeof doc('users/ash').lastSeenAt === 'number');

console.log('\nBUSCA');
await criarConta('ash2', 'Ash Ketchum');
const busca = await chamar(fns.searchTrainers, 'misty', { q:'ash' });
ok('acha por prefixo, sem diferenciar maiúscula', busca.trainers.length === 2);
ok('marca quem já é amigo', busca.trainers.find(t=>t.uid==='ash').jaAmigo === true);
const buscaPropria = await chamar(fns.searchTrainers, 'ash', { q:'ash' });
ok('não devolve você mesmo', !buscaPropria.trainers.some(t=>t.uid==='ash'));
await esperaErro('busca curta demais é recusada', 'invalid-argument',
  ()=>chamar(fns.searchTrainers, 'ash', { q:'a' }));

console.log('\nDESAFIO DIRETO');
// código de time de verdade: base64 de "especie:nivel,..." -- é o formato que decodeTeamCode
// aceita, e é ele que battleCodes valida antes de deixar o desafio sair
const codes = [Buffer.from('pikachu:60,charizard:60,blastoise:60,venusaur:60,snorlax:60,alakazam:60').toString('base64').replace(/=+$/,'')];
await esperaErro('não dá pra desafiar quem não é amigo', 'permission-denied',
  ()=>chamar(fns.challengeFriend, 'ash', { targetUid:'gary', codes }));

let desafioOk = true, motivo = '';
try{ await chamar(fns.challengeFriend, 'ash', { targetUid:'misty', codes }); }
catch(e){ desafioOk = false; motivo = e.code + ': ' + e.message; }
ok('desafio a um amigo é aceito', desafioOk, motivo);

if(desafioOk){
  const ptr = doc('friendChallengePointer/ash');
  ok('ponteiro dos dois lados', !!ptr && !!doc('friendChallengePointer/misty'));
  const d = doc('friendChallenges/' + ptr.challengeId);
  ok('notificação de desafio pra quem foi desafiado',
     [...fake.store.keys()].some(k=>k.startsWith('users/misty/notifications/') && (doc(k).type==='friend_challenge')));
  await esperaErro('segundo desafio ao mesmo tempo é barrado', 'failed-precondition',
    ()=>chamar(fns.challengeFriend, 'ash', { targetUid:'misty', codes }));

  const vista = await chamar(fns.getMyFriends, 'misty');
  ok('quem foi desafiado vê o desafio como "desafiado"', vista.challenge && vista.challenge.sou === 'desafiado');
  const vistaDele = await chamar(fns.getMyFriends, 'ash');
  ok('quem desafiou vê como "desafiante"', vistaDele.challenge && vistaDele.challenge.sou === 'desafiante');

  await chamar(fns.respondFriendChallenge, 'misty', { challengeId: d.id, accept:false });
  ok('recusa apaga o desafio e os dois ponteiros',
     !doc('friendChallenges/' + d.id) && !doc('friendChallengePointer/ash') && !doc('friendChallengePointer/misty'));

  // desafiante sumido: o aceite tem que recusar em vez de criar batalha contra aba fechada
  await chamar(fns.challengeFriend, 'ash', { targetUid:'misty', codes });
  const id2 = doc('friendChallengePointer/ash').challengeId;
  await db.collection('friendChallenges').doc(id2).set({ aliveAt: Date.now() - 120000 }, { merge:true });
  await esperaErro('aceite é recusado quando o desafiante saiu da tela', 'failed-precondition',
    ()=>chamar(fns.respondFriendChallenge, 'misty', { challengeId:id2, accept:true, codes }));
  ok('e o desafio morto é limpo', !doc('friendChallenges/' + id2));

  // caminho feliz
  await chamar(fns.challengeFriend, 'ash', { targetUid:'misty', codes });
  const id3 = doc('friendChallengePointer/ash').challengeId;
  const r = await chamar(fns.respondFriendChallenge, 'misty', { challengeId:id3, accept:true, codes });
  ok('aceite cria a batalha', !!r.battleId && !!doc('onlineBattles/' + r.battleId));
  ok('os dois ganham ponteiro pra batalha',
     doc('onlineBattlePointer/ash') && doc('onlineBattlePointer/misty'));
  const b = doc('onlineBattles/' + r.battleId);
  ok('a batalha nasce na escolha de time, com os códigos dos dois lados',
     b.phase === 'teamPick' && b.aCodes.length === 1 && b.bCodes.length === 1);
  ok('desafio e ponteiros limpos depois da batalha criada',
     !doc('friendChallenges/' + id3) && !doc('friendChallengePointer/ash'));
}

console.log(`\n${casos - falhas}/${casos} casos passaram.`);
if(falhas){ console.log(`${falhas} FALHA(S).`); process.exit(1); }
})().catch(e=>{ console.error('\nERRO NÃO TRATADO:', e); process.exit(1); });
