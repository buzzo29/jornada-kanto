/**
 * Smoke test da LISTA DE AMIGOS -- roda as telas novas sem navegador e sem Firebase.
 *
 * Por que isso existe: as telas de amigos são HTML montado a partir de um estado, e o estado tem
 * casos que quase nunca aparecem no uso normal (amigo com a conta apagada, retrospecto vazio,
 * desafio recebido enquanto outro está saindo). No navegador, um helper com nome errado nesses
 * ramos só aparece quando um jogador cai neles -- e a tela some inteira, porque render() joga
 * innerHTML fora antes de montar o novo.
 *
 * O teste percorre TODOS os ramos e falha se algum: lançar, produzir "undefined"/"NaN" no HTML,
 * ou deixar passar um nome sem escape.
 *
 *   node tools/test-amigos.js
 */
const { createSandbox } = require('./game-sandbox');

const sb = createSandbox();
const game = sb.__getGame();

let falhas = 0, casos = 0;
function checa(nome, html, precisaConter){
  casos++;
  const erros = [];
  if(typeof html !== 'string' || !html.length) erros.push('devolveu vazio');
  if(/undefined|NaN/.test(html)) erros.push('tem "undefined" ou "NaN" no HTML');
  // o nome de ataque é o mesmo dos outros testes de escape do projeto: se ele sair cru, qualquer
  // treinador pode injetar HTML na tela de quem o tiver na lista
  if(html.includes('<img src=x')) erros.push('nome de treinador saiu SEM escape');
  for(const t of (precisaConter||[])){
    if(!html.includes(t)) erros.push(`faltou "${t}"`);
  }
  if(erros.length){ falhas++; console.log(`  ✗ ${nome}: ${erros.join('; ')}`); }
  else console.log(`  ✓ ${nome}`);
}
function roda(nome, fn, precisaConter){
  let html;
  try{ html = fn(); }
  catch(e){ casos++; falhas++; console.log(`  ✗ ${nome}: lançou ${e.message}`); return; }
  checa(nome, html, precisaConter);
}

const NOME_ATAQUE = `Ash<img src=x onerror=alert(1)>`;
const agora = Date.now();
const amigo = (over) => Object.assign({
  uid:'u1', name:'Misty', lastSeenAt: agora - 60000, eliteChampion:false,
  pokedex:120, onlineWins:8, onlineLosses:3, specialties:['agua'],
  since: agora - 86400000, rivalry:{ total:5, wins:3, losses:2, lastAt: agora-3600000, lastWon:true, lastBattleId:'ob_1' }
}, over||{});

console.log('\nTELA DE AMIGOS');

game.screen = 'friends';
game.friendChallenge = null; game.friendsBusy = null; game.friendsConfirmRemove = null;
game.friendsSearchResults = null; game.friendsError = null;

game.friendsData = null;
roda('carregando', ()=>sb.renderFriendsScreen(), ['Carregando sua lista']);

game.friendsData = { friends:[], requests:[], max:50 };
roda('lista vazia', ()=>sb.renderFriendsScreen(), ['Sua lista está vazia']);

game.friendsData = { max:50, requests:[], friends:[
  amigo(),
  amigo({ uid:'u2', name:NOME_ATAQUE, rivalry:{ total:0, wins:0, losses:0, lastAt:0, lastWon:null } }),
  amigo({ uid:'u3', name:'Brock', lastSeenAt:0, sumiu:true, rivalry:{ total:2, wins:0, losses:2, lastAt:agora, lastWon:false } }),
  amigo({ uid:'u4', name:'Gary', eliteChampion:true, lastSeenAt: agora - 40*86400000, rivalry:{ total:9, wins:1, losses:8, lastAt:agora, lastWon:null } })
]};
roda('lista cheia (inclui conta apagada, sem confronto e nome hostil)', ()=>sb.renderFriendsScreen(),
  ['Misty','Brock','conta apagada','sem confrontos','ganhando','perdendo']);

game.friendsData.requests = [{ uid:'u9', name:'Erika', createdAt: agora - 7200000 }];
roda('com pedido recebido', ()=>sb.renderFriendsScreen(), ['Pedidos de amizade','Erika']);

game.friendsConfirmRemove = 'u1';
roda('confirmando remoção', ()=>sb.renderFriendsScreen(), ['Remover Misty?']);
game.friendsConfirmRemove = null;

game.friendChallenge = { id:'fc_1', sou:'desafiante', oponente:'Misty', oponenteUid:'u1', expiresAt: agora + 130000, createdAt: agora };
roda('desafio enviado', ()=>sb.renderFriendsScreen(), ['Desafio enviado','Cancelar desafio','2:1']);

game.friendChallenge = { id:'fc_2', sou:'desafiado', oponente:NOME_ATAQUE, oponenteUid:'u2', expiresAt: agora + 5000, createdAt: agora };
roda('desafio recebido', ()=>sb.renderFriendsScreen(), ['te desafiou','Aceitar']);
game.friendChallenge = null;

game.friendsError = 'Não foi possível desafiar agora.';
roda('com erro na tela', ()=>sb.renderFriendsScreen(), ['Não foi possível desafiar']);
game.friendsError = null;

game.friendsSearchResults = [];
roda('busca sem resultado', ()=>sb.renderFriendsScreen(), ['Nenhum treinador com esse nome']);

game.friendsSearchResults = [
  { uid:'u5', name:'Ash', lastSeenAt: agora, pokedex:150, onlineWins:20, onlineLosses:2, eliteChampion:true, jaAmigo:false, pedidoEnviado:false, pedidoRecebido:false },
  { uid:'u6', name:'Ash', lastSeenAt: agora - 5*86400000, pokedex:12, onlineWins:0, onlineLosses:0, jaAmigo:true },
  { uid:'u7', name:NOME_ATAQUE, lastSeenAt: 0, pokedex:0, onlineWins:0, onlineLosses:0, pedidoEnviado:true },
  { uid:'u8', name:'Ash Jr', lastSeenAt: agora - 900000, pokedex:44, onlineWins:1, onlineLosses:1, pedidoRecebido:true }
];
roda('busca com homônimos e todos os estados de botão', ()=>sb.renderFriendsScreen(),
  ['amigo','⏳ enviado','enviarPedidoAmizade']);

console.log('\nMODAL DE COMPARAÇÃO');
const perfil = (over)=>Object.assign({
  found:true, name:'Misty', titles:{classic:1,trainers:0,custom:2,total:3},
  pokedex:120, shinyDex:4, eliteWins:2, towerClears:1, bestStreak:6, gymsLed:0, specialties:['agua','pedra']
}, over||{});

game.friendCompare = { loading:true, data:null, error:null, nome:'Misty' };
roda('comparação carregando', ()=>sb.renderFriendCompareModal(), ['Comparando']);

game.friendCompare = { loading:false, data:null, error:'Deu ruim.', nome:'Misty' };
roda('comparação com erro', ()=>sb.renderFriendCompareModal(), ['Deu ruim']);

game.friendCompare = { loading:false, nome:'Misty', error:null, data:{
  me: perfil({ name:'Eu' }),
  them: perfil({ name:NOME_ATAQUE, pokedex:150, titles:{classic:0,trainers:0,custom:0,total:0} }),
  rivalry:{ total:5, wins:3, losses:2, lastAt: agora }
}};
roda('comparação completa', ()=>sb.renderFriendCompareModal(), ['VOCÊ','fc-linha','na frente em']);

game.friendCompare.data.rivalry = { total:0, wins:0, losses:0, lastAt:0 };
roda('comparação sem confrontos', ()=>sb.renderFriendCompareModal(), ['nunca se enfrentaram']);

game.friendCompare = null;

console.log('\nPRESENÇA (visto por último)');
// as faixas são grossas de propósito -- o carimbo do servidor tem folga de 5min (touchLastSeen)
const faixas = [
  [0, 'nunca visto', 'off'],
  [agora - 30000, 'agora há pouco', 'on'],
  [agora - 9*60000, 'agora há pouco', 'on'],
  [agora - 11*60000, 'há 11 min', 'recente'],
  [agora - 3*3600000, 'há 3h', ''],
  [agora - 2*86400000, 'há 2 dias', 'off']
];
for(const [ms, esperado, classe] of faixas){
  casos++;
  const r = sb.vistoPorUltimo(ms);
  if(r.texto !== esperado || r.classe !== classe){
    falhas++; console.log(`  ✗ ${ms}: esperado "${esperado}"/${classe}, veio "${r.texto}"/${r.classe}`);
  } else console.log(`  ✓ ${esperado}`);
}

console.log(`\n${casos - falhas}/${casos} casos passaram.`);
if(falhas){ console.log(`${falhas} FALHA(S).`); process.exit(1); }
