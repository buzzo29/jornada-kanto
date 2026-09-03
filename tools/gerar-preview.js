/**
 * Gera `preview-telas.html`: UM arquivo, sem servidor, sem Firebase, sem rede.
 * Abrir com dois cliques e olhar as telas.
 *
 * Por que existe: as telas novas (mapa, trilha, lista de amigos) dependem de estados que levam
 * meia jornada ou duas contas pra reproduzir no jogo de verdade -- o mapa no trecho 6, a lista
 * com um pedido pendente, o desafio esperando resposta. Aqui cada estado é montado na mão e
 * renderizado pelas MESMAS funções do jogo, então o que você vê é o que o jogo desenha.
 *
 * O que ele NÃO testa: nada que fale com o servidor. Botão clicado aqui não faz nada -- é uma
 * prova de layout, não o jogo rodando.
 *
 *   node tools/gerar-preview.js
 */
const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./game-sandbox');

const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const estilos = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const links = [...((html.match(/<head[\s\S]*?<\/head>/) || [''])[0])
  .matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].join('\n');

const sb = createSandbox();
const game = sb.__getGame();
const agora = Date.now();
const ROTAS = ['viridian_forest','coast_24_25','ss_anne','lavender_detour','safari_zone','silph_co','seafoam','victory_road'];

const telas = [];
function add(grupo, titulo, fn){
  let corpo;
  try{ corpo = fn(); }
  catch(e){ corpo = `<div class="box"><p class="error-text">Esta tela lançou: ${e.message}</p></div>`; }
  telas.push({ grupo, titulo, corpo });
}

/* ---- jornada ---- */
game.starterId = 'charmander';
game.gymIndex = 0; game.routeHistory = []; game.currentRoute = null; game.badgeCount = 0;
add('Jornada', 'Abertura — Kanto se abre', ()=>sb.renderKantoIntro());

for(const t of [0, 2, 5, 8]){
  game.gymIndex = t;
  game.badgeCount = t;
  game.routeHistory = ROTAS.slice(0, t);
  game.currentRoute = ROTAS[t] || null;
  add('Jornada', `Mapa — ${t}/8 insígnias`, ()=>sb.renderKantoMapScreen());
}
game.gymIndex = 3; game.badgeCount = 3;
game.routeHistory = ROTAS.slice(0, 3);
game.routeCards = ['rock_tunnel','lavender_detour'];
add('Jornada', 'Escolha de caminho (trecho 4)', ()=>sb.renderWalkNext());

/* ---- itens equipados ---- */
/* A tela de ordem é onde o item entra num pokémon: o + fica na linha dele, à esquerda das setas.
   Vale ver a 320px, que é onde a linha aperta -- são quatro elementos disputando a mesma faixa
   (sprite+nome, tipos, o + e as duas setas). */
{
  const timeExemplo = ['blastoise','gengar','dragonite','alakazam','snorlax','arcanine']
    .map((id, i) => sb.createInstance(id, 62 + i));
  game.team = timeExemplo;
  /* O que esta EQUIPADO ja saiu do armazem -- e assim que o servidor grava, e uma fixture que
     mentisse isso esconderia justamente o caso mais comum (ter 1, equipar, ficar com 0). */
  game.inventario = { hyperpotion: 1, potion: 2 };
  game.equipados = { blastoise: 'awakening', snorlax: 'potion' };
  game.escolhaDeItem = null;
  add('Itens', 'Ordem de batalha — com o + de item', ()=>sb.renderTeamOrder());
  game.escolhaDeItem = 'gengar';
  add('Itens', 'A caixa de escolher o item', ()=>sb.renderTeamOrder() + sb.renderEscolhaDeItemModal());
  game.escolhaDeItem = 'blastoise';
  add('Itens', 'Caixa de quem JA carrega um item', ()=>sb.renderEscolhaDeItemModal());
  game.inventario = {};
  add('Itens', 'Caixa com a mochila vazia', ()=>sb.renderEscolhaDeItemModal());
  game.escolhaDeItem = null;
  game.inventario = { awakening: 2, potion: 1 };
  sb.escolherItem('awakening');
  add('Itens', 'A mochila: o item de equipar', ()=>sb.renderInventario());
  /* A LOJA e o popup de quantidade. Vale ver a 320px: o stepper e o Max dividem uma linha so. */
  game.moedas = 1250; game.rareCandies = 3; game.compraItem = null;
  sb.openLoja();
  add('Itens', 'A loja com os cinco itens', ()=>sb.renderLoja());
  sb.abrirCompra('potion'); sb.qtdCompraMax();
  add('Itens', 'O popup de quantidade (no Max)', ()=>sb.renderLoja() + sb.renderCompraModal());
  game.compraItem = 'doce_raro'; game.compraQtd = 1;
  add('Itens', 'Popup de um item caro', ()=>sb.renderCompraModal());
  game.compraItem = null;
}

/* ---- amigos ---- */
const amigo = (o)=>Object.assign({
  uid:'u1', name:'Misty', lastSeenAt: agora-60000, pokedex:120, eliteChampion:false,
  onlineWins:8, onlineLosses:3,
  rivalry:{ total:5, wins:3, losses:2, lastAt:agora, lastWon:true }
}, o||{});

game.screen = 'friends'; game.friendChallenge = null; game.friendsSearchResults = null;
game.friendsBusy = null; game.friendsConfirmRemove = null; game.friendsError = null;
game.friendsData = { max:50, requests:[], friends:[] };
add('Amigos', 'Lista vazia', ()=>sb.renderFriendsScreen());

game.friendsData = { max:50,
  requests:[{ uid:'u9', name:'Erika', createdAt: agora-7200000 }],
  friends:[
    amigo(),
    amigo({ uid:'u4', name:'Gary Oak', eliteChampion:true, lastSeenAt: agora-3*3600000, pokedex:150,
            rivalry:{ total:9, wins:1, losses:8, lastAt:agora, lastWon:false } }),
    amigo({ uid:'u2', name:'Sabrina', lastSeenAt: agora-4*86400000, pokedex:77,
            rivalry:{ total:0, wins:0, losses:0, lastAt:0, lastWon:null } }),
    amigo({ uid:'u3', name:'Brock', lastSeenAt:0, pokedex:0, sumiu:true,
            rivalry:{ total:2, wins:1, losses:1, lastAt:agora, lastWon:null } })
  ]};
add('Amigos', 'Lista + pedido recebido', ()=>sb.renderFriendsScreen());

game.friendChallenge = { id:'fc_1', sou:'desafiante', oponente:'Misty', oponenteUid:'u1',
                         expiresAt: agora+134000, createdAt: agora };
add('Amigos', 'Desafio enviado (esperando)', ()=>sb.renderFriendsScreen());

game.friendChallenge = { id:'fc_2', sou:'desafiado', oponente:'Gary Oak', oponenteUid:'u4',
                         expiresAt: agora+92000, createdAt: agora };
add('Amigos', 'Desafio recebido', ()=>sb.renderFriendsScreen());
game.friendChallenge = null;

game.friendsSearchResults = [
  { uid:'u5', name:'Ash', lastSeenAt:agora, pokedex:150, onlineWins:20, onlineLosses:2, eliteChampion:true },
  { uid:'u6', name:'Ash', lastSeenAt:agora-5*86400000, pokedex:12, onlineWins:0, onlineLosses:0, jaAmigo:true },
  { uid:'u8', name:'Ash Jr', lastSeenAt:agora-900000, pokedex:44, onlineWins:1, onlineLosses:1, pedidoEnviado:true }
];
add('Amigos', 'Busca (com homônimos)', ()=>sb.renderFriendsScreen());
game.friendsSearchResults = null;

const perfil = (o)=>Object.assign({
  name:'Treinador', titles:{classic:1,trainers:0,custom:2,total:3},
  pokedex:120, shinyDex:4, eliteWins:2, towerClears:1, bestStreak:6, gymsLed:0, specialties:['agua','pedra']
}, o||{});
game.friendCompare = { loading:false, nome:'Gary Oak', error:null, data:{
  me: perfil({ name:'Você' }),
  them: perfil({ name:'Gary Oak', titles:{classic:2,trainers:1,custom:1,total:4}, pokedex:150,
                 shinyDex:2, eliteWins:5, towerClears:0, bestStreak:9, gymsLed:2, specialties:['fogo'] }),
  rivalry:{ total:9, wins:1, losses:8, lastAt:agora }
}};
add('Amigos', 'Comparar conquistas', ()=>sb.renderFriendsScreen() + sb.renderFriendCompareModal());
game.friendCompare = null;

/* ---- a página ---- */
const grupos = [...new Set(telas.map(t=>t.grupo))];
const abas = grupos.map(g=>`<div class="pv-grupo"><span class="pv-grupo-l">${g}</span>${
  telas.map((t,i)=> t.grupo===g
    ? `<button class="pv-aba" data-i="${i}" onclick="mostrar(${i})">${t.titulo}</button>` : '').join('')
}</div>`).join('');

const pagina = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jornada Kanto — preview de telas</title>
${links}
<style>${estilos}</style>
<style>
  html,body{ margin:0; background:#0b0e1c; }
  .pv-topo{ position:sticky; top:0; z-index:50; background:#11152b; border-bottom:2px solid #2b3358;
            padding:10px 12px; font-family:'Inter',sans-serif; }
  .pv-titulo{ color:#ffcb05; font-weight:800; font-size:13px; margin-bottom:2px; }
  .pv-aviso{ color:#8d9bc0; font-size:11px; margin-bottom:8px; }
  .pv-grupo{ display:flex; flex-wrap:wrap; align-items:center; gap:5px; margin-bottom:5px; }
  .pv-grupo-l{ color:#6d7ba6; font-size:10px; font-weight:800; letter-spacing:.06em;
               text-transform:uppercase; width:62px; flex-shrink:0; }
  .pv-aba{ background:#1d2444; color:#cdd8f5; border:1px solid #2f3a68; border-radius:4px;
           padding:4px 9px; font:700 11px 'Inter',sans-serif; cursor:pointer; }
  .pv-aba.ativa{ background:#ffcb05; color:#11152b; border-color:#ffcb05; }
  .pv-larguras{ display:flex; gap:5px; margin-top:6px; }
  .pv-palco{ display:flex; justify-content:center; padding:16px 8px 60px; }
  .pv-tela{ width:var(--pv-w,390px); max-width:100%; }
  .pv-tela .app{ padding:10px 12px; }
  [hidden]{ display:none !important; }
</style></head>
<body>
<div class="pv-topo">
  <div class="pv-titulo">Jornada Kanto — preview de telas</div>
  <div class="pv-aviso">Só layout: os botões não fazem nada e nada fala com o servidor. Gerado por <code>node tools/gerar-preview.js</code>.</div>
  ${abas}
  <div class="pv-grupo"><span class="pv-grupo-l">Largura</span>
    <button class="pv-aba" onclick="largura(320,this)">320px</button>
    <button class="pv-aba ativa" onclick="largura(390,this)">390px</button>
    <button class="pv-aba" onclick="largura(430,this)">430px</button>
  </div>
</div>
<div class="pv-palco">${telas.map((t,i)=>
  `<div class="pv-tela" id="pv${i}" ${i?'hidden':''}><div class="app">${t.corpo}</div></div>`).join('')}</div>
<script>
  var atual = 0;
  function mostrar(i){
    var a = document.getElementById('pv'+atual); if(a) a.hidden = true;
    var b = document.getElementById('pv'+i); if(b) b.hidden = false;
    document.querySelectorAll('.pv-aba[data-i]').forEach(function(el){
      el.classList.toggle('ativa', Number(el.dataset.i) === i);
    });
    atual = i;
  }
  function largura(w, botao){
    document.querySelectorAll('.pv-tela').forEach(function(el){ el.style.setProperty('--pv-w', w+'px'); });
    botao.parentElement.querySelectorAll('.pv-aba').forEach(function(el){ el.classList.remove('ativa'); });
    botao.classList.add('ativa');
  }
  mostrar(0);
</script>
</body></html>`;

const saida = path.join(RAIZ, 'preview-telas.html');
fs.writeFileSync(saida, pagina);
console.log('Gerado: ' + saida);
console.log(telas.length + ' telas. Abra o arquivo no navegador -- não precisa de servidor.');
