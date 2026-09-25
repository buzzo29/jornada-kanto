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

/* ---- os dois golpes do pokemon ---- */
/* As duas telas de escolha de golpe. Valem a 320px porque o nome de golpe e longo ("Deslizamento de
   Rochas") e cada linha carrega selo, poder e nivel. */
{
  const gy = sb.createInstance('gyarados', 40);
  gy.id = 'prev1'; gy.escolherAtaques = true;
  game.team = [gy];
  game.escolhaDeAtaques = gy.id;
  game.ataquesMarcados = [];
  add('Golpes', 'Escolher os 2 golpes — nada marcado', ()=>sb.renderEscolhaDeAtaques());
  game.ataquesMarcados = sb.ataquesDisponiveis('gyarados', 40).slice(0, 2);
  add('Golpes', 'Escolher os 2 golpes — com os dois marcados', ()=>sb.renderEscolhaDeAtaques());

  const kb = sb.createInstance('kabuto', 33);
  kb.id = 'prev2'; kb.ataques = ['scratch','absorb']; kb.nivelDosAtaques = 30;
  game.team = [kb];
  game.escolhaDeAtaques = null;
  game.aprenderAtaque = { id: kb.id, golpe: 'mudshot', nivel: 33 };
  add('Golpes', 'Aprender um golpe novo (qual sai?)', ()=>sb.renderAprenderAtaque());
  const gn = sb.createInstance('gengar', 45);
  gn.id = 'prev2b'; gn.ataques = ['shadowball','sludgebomb'];
  game.team = [gn];
  game.aprenderAtaque = { id: gn.id, golpe: 'dreameater', nivel: 45 };
  add('Golpes', 'Aprender — nome comprido e tipo escuro', ()=>sb.renderAprenderAtaque());
  game.aprenderAtaque = null;

  /* O ANUNCIO. Ele e a tela mais comum das tres -- 2,9 por jornada, contra 11 de troca -- e a que
     o jogador pediu em 09/09/2026. Vale a 320px pelo mesmo motivo das outras: nome de golpe longo,
     e aqui ele divide a linha com o sprite e o nome do pokemon. */
  const bu = sb.createInstance('bulbasaur', 13);
  bu.id = 'prev3'; bu.ataques = ['tackle','vinewhip'];
  const gy2 = sb.createInstance('gyarados', 20);
  gy2.id = 'prev4'; gy2.ataques = ['tackle','thrash'];
  game.team = [bu, gy2];
  game.golpesAprendidos = [{ id: bu.id, golpe: 'vinewhip' }];
  add('Golpes', 'Aprendeu um golpe (o caso comum: 94% deles)', ()=>sb.renderGolpeAprendido());
  game.golpesAprendidos = [{ id: bu.id, golpe: 'vinewhip' }, { id: gy2.id, golpe: 'thrash' }];
  add('Golpes', 'Aprendeu dois na mesma passada', ()=>sb.renderGolpeAprendido());
  game.golpesAprendidos = [];
}

/* ---- a fileira de quem nao escolhe golpe ---- */
/* O Togepi nao tem UM golpe de dano ate o nivel 38 e as 4 especies do METRONOMO atacam de tipo
   sorteado -- a fileira delas saia MUDA, e foi reportado. Agora ela anuncia o Metronomo, tracejado
   pra nao se confundir com os dois golpes que o jogador escolheu. */
{
  const meg = sb.createInstance('meganium', 32); meg.id = 'prevA'; meg.ataques = ['bodyslam','razorleaf'];
  const tog = sb.createInstance('togepi', 33);   tog.id = 'prevB';
  const pol = sb.createInstance('poliwag', 16);  pol.id = 'prevC'; pol.ataques = ['bubble','watergun'];
  const abr = sb.createInstance('abra', 20);     abr.id = 'prevD';
  game.team = [meg, tog, pol, abr];
  game.inventario = {}; game.equipados = {}; game.escolhaDeItem = null;
  add('Golpes', 'Ordem de batalha — o Togepi anuncia o Metronomo', ()=>sb.renderTeamOrder());
}

/* ---- a linha de status da batalha ---- */
/* Ela e a MESMA linha do "Trocando golpes...", so que dizendo o golpe que acabou de sair. Vale a
   320px porque o nome do pokemon e o selo do golpe dividem uma linha so. */
{
  const a1 = ['charizard','gengar'].map(id => { const p = sb.createInstance(id, 55); p.ataques = sb.ataquesPadrao(p); return p; });
  const b1 = ['onix','alakazam'].map(id => sb.createInstance(id, 55));
  const r1 = sb.simulateGymBattle(a1, b1);
  const m1 = r1.matchups[0];
  const seq1 = sb.buildAnimatedHitSequence(m1);
  add('Batalha', 'A linha de status: o golpe de cada passo', () =>
    `<div class="box">${seq1.map((h, i) =>
      `<div class="battle-status-area">${sb.statusDoConfrontoHtml(m1, i + 1, h)}</div>`).join('')}</div>`);
}

/* ---- a ficha da Pokedex com a lista de golpes ---- */
/* A lista rola por dentro: o Nidoking aprende 11 golpes de dano, e sem o teto o botao Fechar
   ia parar fora da tela num celular. */
{
  game.pokedexFicha = { id:'nidoking', shiny:false };
  add('Pokedex', 'Ficha com a lista de golpes (o pior caso: 11)', ()=>sb.renderPokedexFicha());
  game.pokedexFicha = { id:'qwilfish', shiny:false };
  add('Pokedex', 'Ficha — caso comum', ()=>sb.renderPokedexFicha());
  game.pokedexFicha = null;
}

/* ---- itens equipados ---- */
/* A tela de ordem é onde o item entra num pokémon: o + fica na linha dele, à esquerda das setas.
   Vale ver a 320px, que é onde a linha aperta -- são quatro elementos disputando a mesma faixa
   (sprite+nome, tipos, o + e as duas setas). */
{
  const timeExemplo = ['blastoise','gengar','dragonite','alakazam','snorlax','arcanine']
    .map((id, i) => { const p = sb.createInstance(id, 62 + i); p.ataques = sb.ataquesPadrao(p); return p; });
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

/* ---- Ligas ----
   ⚠️ A TELA DA LIGA PRECISA DO leagueData JÁ CARREGADO: o renderLeague desenha "Carregando..."
   enquanto o leagueScreenLoading for verdadeiro, e aí a prévia mediria a tela de espera -- que é
   exatamente o tipo de zero perfeito que este projeto paga caro. */
game.authUser = { uid:'u1' };
game.contaCarregada = true;
game.novidadeVista = null;
game.novidadesModal = true;
add('Ligas', 'Anúncio da Liga Pro', ()=>sb.renderNovidadesModal());
game.novidadesModal = false;

game.screen = 'league';
game.currentLeagueTypeId = 'classic';
game.leagueScreenLoading = false;
game.leagueData = { cycles: [{ id:'c9', status:'registering', scheduledTime: agora + 6e5,
                               registrants: [{ name:'Ash' }, { name:'Misty' }], amIRegistered: false }] };
add('Ligas', 'Clássica — inscrição aberta', ()=>sb.renderLeague());

/* ⚠️ o caso que mais me custou medição: quem JÁ está num chaveamento em andamento continua podendo
   se inscrever no ciclo seguinte (24/09/2026) -- o botão fica CLICÁVEL e o aviso é informativo. */
game.accountLeagueSlots = { classic: 3 };
add('Ligas', 'Clássica — com um chaveamento rodando', ()=>sb.renderLeague());
game.accountLeagueSlots = null;

game.currentLeagueTypeId = 'pro';
add('Ligas', 'Liga Pro — inscrição aberta', ()=>sb.renderLeague());

/* ⚠️ O QUADRO GLOBAL ("🌐 Últimas Ligas") PASSOU A VALER NA PRO EM 25/09/2026, e ele é DOBRÁVEL --
   o conteúdo só é montado ABERTO, então sem o `quadrosAbertos` a prévia mostraria só o título.
   As duas telas ficam aqui porque o que distingue as duas é o CONTEÚDO, não o quadro existir: a
   marcação é idêntica (conferido), e o que muda é cada uma ler a chave DELA. */
const histGlobal = (q) => [1,2,3].map(i => ({ cycleId:'g'+i, cycleTime: agora - i*36e5,
  league:{ id:0, size: i===1 ? 16 : 8, champion:{ name: q + ' Campeão ' + i } } }));
/* ⚠️ O QUADRO GLOBAL VIVE DENTRO DE `if(game.trainerName)` -- sem o nome ele nao e desenhado, e a
   previa saia com a tela CERTA e o quadro AUSENTE. Foi o navegador que pegou. */
game.trainerName = 'Buzzo';
game.globalLeagueHistory = { classic: histGlobal('Ash'), pro: histGlobal('Gary') };
game.myLeagueHistory = [{ cycleId:'g1', leagueId:0, cycleTime: agora - 36e5, placement:'Campeão',
                          leagueSize:8, leagueTypeId:'pro', leagueTypeName:'Liga Pro' }];
game.leagueLeaderboard = [{ name:'Gary', wins:4 }, { name:'Ash', wins:2 }];
game.quadrosAbertos = { ultimas_ligas: true, top10: true, minhas_ligas: true };
add('Ligas', 'Liga Pro — o histórico das últimas Ligas Pro', ()=>sb.renderLeague());
game.currentLeagueTypeId = 'classic';
add('Ligas', 'Clássica — o histórico dela, pra comparar', ()=>sb.renderLeague());
game.quadrosAbertos = {};
game.globalLeagueHistory = {};
game.myLeagueHistory = [];
game.leagueLeaderboard = [];
game.leagueData = null;
game.currentLeagueTypeId = null;
game.screen = 'saveSelect';

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
  /* o transform faz o position:fixed dos modais se ancorar NESTA caixa, e nao na janela --
   sem ele o modal e medido com a largura do navegador e a conferencia a 320px nao vale nada */
.pv-tela{transform:translateZ(0); width:var(--pv-w,390px); max-width:100%; }
  .pv-tela .app{ padding:10px 12px; }
  [hidden]{ display:none !important; }
.pv-medida{margin:8px 0 0;padding:8px;background:#11131a;color:#cfe3ff;font:11px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap;border-radius:6px;max-height:40vh;overflow:auto}
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
  <div class="pv-grupo"><span class="pv-grupo-l">Conferir</span>
    <button class="pv-aba" onclick="mostrarMedida()">Medir TODAS a 320px</button>
  </div>
  <pre id="pv-medida" class="pv-medida" hidden></pre>
</div>
${sb.svgDosSelos ? sb.svgDosSelos() : ''}
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

  /* A MEDICAO MORA AQUI, e nao num script solto por sessao: montar iframe na mao ja fez ler a TELA
     ERRADA (dois iframes empilhados no mesmo canto, o querySelector pegou o velho), e a versao por
     servidor HTTP local ainda custava subir e matar um processo. Aqui ela varre TODAS as telas de
     uma vez, na largura que decide -- 320 e a menor que a casa mira.

     ATENCAO: ela mede as telas ESCONDIDAS tambem. Um elemento com hidden tem caixa ZERO, entao ela
     revela cada tela pra medir e esconde de novo. Sem isso ela reportaria "0x0, nada cortado" pra
     29 das 30 telas -- um zero perfeito, que e o falso verde mais comum deste projeto.

     Chame medir() no console pra receber o objeto, ou aperte o botao pra ver a tabela. */
  var DOLAR_CHAVE = String.fromCharCode(36) + String.fromCharCode(123);

  function medir(w){
    w = w || 320;
    var antes = atual, linhas = [];
    document.querySelectorAll('.pv-tela').forEach(function(el){ el.style.setProperty('--pv-w', w+'px'); });

    document.querySelectorAll('.pv-tela').forEach(function(tela, i){
      var escondida = tela.hidden;
      if(escondida) tela.hidden = false;
      /* ATENCAO: num modal o .app fica com altura ~0 -- a caixa e position:fixed e sai do fluxo.
         Medir o .app ali reporta "20px, nada cortado" pra uma tela inteira. */
      var app = tela.querySelector('.modal-box') || tela.querySelector('.app');
      var r = app.getBoundingClientRect();

      /* texto cortado: so FOLHAS com texto -- um pai com filhos rola por desenho */
      var cortados = [];
      app.querySelectorAll('*').forEach(function(e){
        if(e.children.length || !e.textContent.trim()) return;
        /* ATENCAO: dentro de <svg> o scrollWidth nao quer dizer "cortado" -- um <text> de SVG
           reporta overflow por desenho, e sem esta guarda cada emoji do mapa vira um falso
           positivo (foram 5 telas na primeira medicao). */
        if(e.closest && e.closest('svg')) return;
        if(e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)
          cortados.push(e.textContent.trim().slice(0, 24));
      });

      /* selo fantasma: o <use> existe e desenha NADA. Ele nao da erro -- some em silencio. */
      var usos = app.querySelectorAll('use'), vazios = 0;
      usos.forEach(function(u){ var b = u.getBoundingClientRect(); if(b.width < 2 || b.height < 2) vazios++; });

      /* interpolacao que nao interpolou: ela sai LITERAL na tela, e o node --check aprova */
      var literal = app.textContent.indexOf(DOLAR_CHAVE) >= 0;

      /* h2 em mais de uma linha: na fonte de pixel isso quase sempre e texto longo demais */
      var h2duplo = [];
      app.querySelectorAll('h2').forEach(function(h){
        if(h.getBoundingClientRect().height > 26) h2duplo.push(h.textContent.trim().slice(0, 22));
      });

      var aba = document.querySelector('.pv-aba[data-i="' + i + '"]');
      linhas.push({
        tela: aba ? aba.textContent.trim() : ('#' + i),
        alturaPx: Math.round(r.height),
        estouraLargura: app.scrollWidth > w ? (app.scrollWidth + ' > ' + w) : '',
        cortados: cortados,
        selosVazios: vazios ? (vazios + ' de ' + usos.length) : '',
        interpolacaoLiteral: literal,
        h2emDuasLinhas: h2duplo
      });
      if(escondida) tela.hidden = true;
    });
    mostrar(antes);
    return linhas;
  }

  function mostrarMedida(){
    var out = medir(320);
    var ruim = out.filter(function(l){
      return l.estouraLargura || l.cortados.length || l.selosVazios || l.interpolacaoLiteral || l.h2emDuasLinhas.length;
    });
    /* ATENCAO: este texto vive dentro de um template literal do gerar-preview.js, entao um \n
       escrito aqui viraria uma QUEBRA DE LINHA DE VERDADE na hora de montar a pagina -- e uma
       quebra literal dentro de aspas simples e SyntaxError: o script inteiro para de rodar, e o
       node --check do gerador PASSA, porque quem quebra e o artefato. Por isso: array + join. */
    var NL = String.fromCharCode(10);
    var L = ['MEDIDO A 320px -- ' + out.length + ' telas, ' + ruim.length + ' com algo a olhar', ''];
    (ruim.length ? ruim : out).forEach(function(l){
      L.push(l.tela + '  (' + l.alturaPx + 'px)');
      if(l.estouraLargura)        L.push('    ESTOURA A LARGURA: ' + l.estouraLargura);
      if(l.interpolacaoLiteral)   L.push('    INTERPOLACAO LITERAL na tela');
      if(l.selosVazios)           L.push('    selos vazios: ' + l.selosVazios);
      if(l.h2emDuasLinhas.length) L.push('    h2 em 2 linhas: ' + l.h2emDuasLinhas.join(' | '));
      if(l.cortados.length)       L.push('    texto cortado: ' + l.cortados.join(' | '));
    });
    if(!ruim.length) L.push('(nenhuma tela com problema)');
    var el = document.getElementById('pv-medida');
    el.textContent = L.join(NL); el.hidden = false;
  }
</script>
</body></html>`;

const SERVIR = process.argv.indexOf('--servir') > 0;
/* ⚠️ CONFERE O ARTEFATO, e não só este arquivo. O que quebra a prévia é quase sempre uma camada
   de escape a mais ou a menos entre o template literal daqui e o <script> da página -- e nenhuma
   verificação do gerador pega isso, porque o gerador está válido. Um script de página que não
   compila não dá erro visível: as abas simplesmente param de responder. */
function conferaOsScriptsDaPagina(html){
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, i = 0;
  while((m = re.exec(html))){
    i++;
    try{ new Function(m[1]); }
    catch(e){
      console.error('X o <script> #' + i + ' da pagina NAO COMPILA: ' + e.message);
      console.error('  (nada foi escrito -- a previa abriria com as abas mortas)');
      process.exit(1);
    }
  }
}

const saida = path.join(RAIZ, 'preview-telas.html');
conferaOsScriptsDaPagina(pagina);
fs.writeFileSync(saida, pagina);
console.log('Gerado: ' + saida);

if(SERVIR){
  /* servidor mínimo: um arquivo, sem cache. O no-store é o que evita medir a versão ANTERIOR
     depois de regerar -- e "medi a tela velha" já custou uma volta inteira. */
  const porta = 8765;
  require('http').createServer((req, res) => {
    const alvo = req.url.split('?')[0] === '/' ? saida : path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
    if(!alvo.startsWith(RAIZ) || !fs.existsSync(alvo)){ res.writeHead(404); return res.end('nao achei'); }
    res.writeHead(200, { 'Content-Type': /\.html$/.test(alvo) ? 'text/html; charset=utf-8' : 'application/octet-stream',
                         'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(alvo));
  }).listen(porta, () => {
    console.log('Servindo em http://127.0.0.1:' + porta + '/   (Ctrl+C pra parar)');
  });
}
console.log(telas.length + ' telas. Abra o arquivo no navegador -- não precisa de servidor.');
