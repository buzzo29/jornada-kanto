/**
 * A CAIXA DE ENTRADA -- a tela de notificacoes em lista + corpo.
 *
 * Por que isso existe: a tela tem um ramo por TIPO de notificacao (bonus de campeao, pedido de
 * amizade, desafio com prazo, emprestimo do Mewtwo em tres estados) e cada ramo so aparece pra
 * quem recebeu aquela notificacao. Um helper com nome errado num ramo desses nao quebra a tela
 * pra quem testa: quebra pra quem recebeu, e render() joga o innerHTML fora antes de montar o
 * novo -- some a tela inteira.
 *
 * Trancado aqui: os tres estados da tela, a selecao (abre a mais recente sozinha, so uma aberta
 * por vez, e cair na mais recente quando a aberta e apagada), o selo NOVA, o escape de titulo e
 * corpo, e o CTA de cada tipo.
 *
 *   node tools/test-notificacoes.js
 */
const { createSandbox } = require('./game-sandbox');

const S = createSandbox();
const g = S.__getGame();

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const AGORA = 1756000000000;   // data fixa: o sandbox nao pode depender do relogio
function notif(id, type, extra){
  return Object.assign({ id, type, title:'Titulo ' + id, body:'Corpo ' + id, createdAt: AGORA, read:true }, extra||{});
}
function tela(lista, selecionada, novas){
  g.notificationsList = lista;
  g.notificationSelected = selecionada || null;
  g.notificationsNovas = novas || [];
  g.notificationsActionError = null;
  S.__setGame(g);
  return S.renderNotificationsScreen();
}

console.log('\nOS TRES ESTADOS DA TELA');
ok('carregando', tela(null).includes('Carregando'));
ok('sem nenhuma notificacao', tela([]).includes('Nenhuma notificação ainda'));
const tres = [notif('a','league_started'), notif('b','match_played'), notif('c','gym_leadership_lost')];
const html = tela(tres);
ok('com notificacoes, uma linha por notificacao', (html.match(/class="notif-item[ "]/g)||[]).length === 3,
   (html.match(/class="notif-item[ "]/g)||[]).length + ' linhas');

console.log('\nA SELECAO FUNCIONA COMO NUM E-MAIL');
/* A tela existe pra LER a notificacao: abrir com o painel de baixo vazio cobraria um clique so
   pra chegar onde a pessoa ja queria chegar. */
ok('abre a mais recente sozinha', html.includes('Corpo a') && !html.includes('Corpo b'));
ok('e marca a linha dela na lista', (html.match(/notif-item aberta/g)||[]).length === 1);
const html2 = tela(tres, 'b');
ok('clicar em outra troca o corpo', html2.includes('Corpo b') && !html2.includes('Corpo a</p>'));
ok('e continua com uma aberta so', (html2.match(/notif-item aberta/g)||[]).length === 1);
/* A aberta pode ter sido apagada enquanto estava aberta -- a lista some dela e a selecao fica
   apontando pro nada. */
ok('apagar a aberta cai na mais recente', tela([tres[1], tres[2]], 'a').includes('Corpo b'));
ok('cada linha chama a propria notificacao',
   html.includes("abrirNotificacao('a')") && html.includes("abrirNotificacao('c')"));

console.log('\nO SELO NOVA');
const comNovas = tela(tres, 'a', ['b']);
ok('so as que estavam por ler ganham o selo', (comNovas.match(/notif-nova/g)||[]).length === 1);
ok('e a linha delas fica marcada', (comNovas.match(/class="notif-item nova"/g)||[]).length === 1,
   'classes: ' + (comNovas.match(/class="notif-item[^"]*"/g)||[]).join(' | '));
ok('sem novas, nenhum selo', !tela(tres).includes('notif-nova'));

console.log('\nTITULO E CORPO SAO TEXTO, NAO MARCACAO');
/* Titulo e corpo vem do servidor, mas passam por nome de treinador (pedido de amizade, desafio):
   se sairem crus, quem escolhe o proprio nome escolhe o HTML da tela do outro. */
const veneno = notif('x','friend_request', { title:'<img src=x onerror=alert(1)>', body:'<b>corpo</b>' });
const htmlVeneno = tela([veneno]);
ok('titulo escapado', !htmlVeneno.includes('<img src=x') && htmlVeneno.includes('&lt;img src=x'));
ok('corpo escapado', !htmlVeneno.includes('<b>corpo</b>'));

console.log('\nCADA TIPO OFERECE A SUA ACAO');
ok('campeao sem ativar: manda pra mochila, que e onde o premio mora agora',
   S.ctaDaNotificacao(notif('1','league_champion')).includes('openInventario()'));
ok('e nao ativa mais dentro da notificacao',
   !S.ctaDaNotificacao(notif('1','league_champion')).includes('activateShinyBonus'));
ok('campeao ja ativado: so o aviso',
   S.ctaDaNotificacao(notif('2','league_champion',{meta:{activated:true}})).includes('já ativado'));
ok('pedido de amizade leva pra lista',
   S.ctaDaNotificacao(notif('3','friend_request')).includes('openFriends'));
ok('desafio vencido nao oferece responder',
   S.ctaDaNotificacao(notif('4','friend_challenge',{meta:{expiresAt: AGORA}})).includes('expirou'));
ok('desafio no prazo oferece responder',
   S.ctaDaNotificacao(notif('5','friend_challenge',{meta:{expiresAt: Date.now()+60000}})).includes('openFriends'));
g.mewtwoLoanActive = false; g.mewtwoLoanCooldownUntil = 0; S.__setGame(g);
ok('mewtwo livre: botao de colocar no time',
   S.ctaDaNotificacao(notif('6','mewtwo_loan_unlocked')).includes('openMewtwoLoanTeamPicker'));
g.mewtwoLoanActive = true; S.__setGame(g);
ok('mewtwo ja emprestado: so o aviso',
   S.ctaDaNotificacao(notif('7','mewtwo_loan_unlocked')).includes('já tem um Mewtwo'));
g.mewtwoLoanActive = false; g.mewtwoLoanCooldownUntil = Date.now() + 86400000; S.__setGame(g);
ok('mewtwo em cooldown: a data de volta',
   S.ctaDaNotificacao(notif('8','mewtwo_loan_unlocked')).includes('cooldown'));
g.mewtwoLoanCooldownUntil = 0; S.__setGame(g);
ok('tipo sem acao nenhuma nao inventa botao', S.ctaDaNotificacao(notif('9','league_ended')) === '');

console.log('\nDA PRA APAGAR SEM SAIR DA TELA');
ok('a aberta tem o botao de apagar', html.includes("requestDeleteNotification('a')"));
ok('e so a aberta -- a lista e so titulo',
   (html.match(/requestDeleteNotification/g)||[]).length === 1);

(async () => {

console.log('\nESCOLHER VARIAS E APAGAR DE UMA VEZ');
g.notifModoSelecao = true; g.notifSelecionadas = []; g.deleteNotifBulk = null;
const modoVazio = tela(tres, 'a');
ok('no modo de selecao a linha marca em vez de abrir',
   modoVazio.includes("alternarSelecaoNotificacao('a')") && !modoVazio.includes("abrirNotificacao('a')"));
/* Ninguem esta LENDO uma notificacao enquanto separa dez pra apagar -- e sem o corpo a lista
   inteira cabe na tela. */
ok('e o corpo some da tela', !modoVazio.includes('Corpo a'));
ok('a barra conta quantas estao marcadas', modoVazio.includes('>0 de 3<'));
ok('sem nenhuma marcada, o apagar fica desligado', /perigo" disabled/.test(modoVazio));
ok('cada linha ganha a caixinha de marcar', (modoVazio.match(/notif-check/g)||[]).length === 3);

S.alternarSelecaoNotificacao('a');
S.alternarSelecaoNotificacao('c');
ok('marcar duas guarda as duas', JSON.stringify(S.__getGame().notifSelecionadas) === JSON.stringify(['a','c']));
S.alternarSelecaoNotificacao('a');
ok('marcar de novo desmarca', JSON.stringify(S.__getGame().notifSelecionadas) === JSON.stringify(['c']));
g.notifSelecionadas = ['c']; S.__setGame(g);
const comUma = tela(tres, 'a');
ok('a marcada aparece marcada', (comUma.match(/notif-item marcada/g)||[]).length === 1);
ok('e o apagar liga', !/perigo" disabled/.test(comUma));

S.marcarTodasNotificacoes();
ok('"Todas" marca todas', S.__getGame().notifSelecionadas.length === 3);
S.marcarTodasNotificacoes();
ok('e com todas marcadas o mesmo botao desmarca', S.__getGame().notifSelecionadas.length === 0);

/* A MESMA pergunta do apagar avulso: apagar um bonus shiny sem ativar e perda definitiva, e num
   lote e ainda mais facil levar junto sem ver. */
console.log('\nA CONFIRMACAO NOMEIA O QUE TEM PREMIO DENTRO');
const comPremio = [notif('p','league_champion',{meta:{}}), notif('q','match_played'), notif('r','league_ended')];
g.notificationsList = comPremio; g.notifSelecionadas = ['q','r']; S.__setGame(g);
S.pedirApagarSelecionadas();
ok('lote sem premio nenhum nao inventa aviso', (S.__getGame().deleteNotifBulk.avisos||[]).length === 0);
ok('o modal diz quantas vao embora', S.renderDeleteNotificationsBulkModal().includes('Apagar 2 notificações?'));
g.notifSelecionadas = ['p','q']; g.deleteNotifBulk = null; S.__setGame(g);
S.pedirApagarSelecionadas();
const bulk = S.__getGame().deleteNotifBulk;
ok('lote COM premio avisa qual e', (bulk.avisos||[]).length === 1 && /Bônus Shiny/.test(bulk.avisos[0].titulo),
   JSON.stringify((bulk.avisos||[]).map(a=>a.titulo)));
ok('e o aviso aparece no modal', S.renderDeleteNotificationsBulkModal().includes('Bônus Shiny'));
S.cancelarApagarSelecionadas();
ok('cancelar nao apaga nada', S.__getGame().deleteNotifBulk === null && S.__getGame().notificationsList.length === 3);

console.log('\nO APAGAR EM LOTE MANDA UMA CHAMADA SO');
let chamadas = [];
S.functionsClient = { httpsCallable: (nome) => (args) => { chamadas.push({nome, args}); return Promise.resolve({data:{ok:true}}); } };
g.notificationsList = comPremio.slice(); g.notifSelecionadas = ['q','r']; g.notifModoSelecao = true; S.__setGame(g);
S.pedirApagarSelecionadas();
await S.confirmarApagarSelecionadas();
const depoisDoLote = S.__getGame();
ok('uma chamada so, com todos os ids', chamadas.length === 1 && chamadas[0].nome === 'deleteNotifications' &&
   JSON.stringify(chamadas[0].args.ids) === JSON.stringify(['q','r']), JSON.stringify(chamadas));
ok('as apagadas somem da lista na hora', depoisDoLote.notificationsList.map(n=>n.id).join(',') === 'p');
ok('e a tela sai do modo de selecao', !depoisDoLote.notifModoSelecao && depoisDoLote.notifSelecionadas.length === 0);

/* Apagar otimista tem que saber VOLTAR: se o servidor recusa, a notificacao reaparece -- senao a
   pessoa acha que apagou e o servidor discorda na proxima vez que a tela abrir. */
chamadas = [];
S.functionsClient = { httpsCallable: () => () => Promise.reject(new Error('sem rede')) };
g.notificationsList = comPremio.slice(); g.notifSelecionadas = ['q']; g.notifModoSelecao = true; S.__setGame(g);
S.pedirApagarSelecionadas();
const erroOriginal = console.error; console.error = ()=>{};   // o rollback loga o erro de proposito; aqui ele so sujaria a saida
await S.confirmarApagarSelecionadas();
console.error = erroOriginal;
const depoisDoErro = S.__getGame();
ok('servidor recusou: a lista volta inteira', depoisDoErro.notificationsList.length === 3);
ok('e a tela avisa', !!depoisDoErro.notificationsActionError, depoisDoErro.notificationsActionError);
g.notificationsActionError = null; g.notifModoSelecao = false; g.notifSelecionadas = []; S.__setGame(g);


(async () => {

/* ---- o outro lado: o apagar em lote no servidor ----
   Vale testar porque ele APAGA dado de jogador em lote, e o caminho errado (coleção de outro uid,
   id vazio virando a coleção inteira) não daria erro nenhum -- só sumiria com o que não devia. */
console.log('\nO APAGAR EM LOTE NO SERVIDOR');
{
  const path = require('path');
  const Module = require('module');
  const fake = require('./fake-firestore');
  const db = fake.makeDb();
  const stubs = {
    'firebase-functions/v2/scheduler': { onSchedule: (a,b)=> (typeof a === 'function' ? a : b) },
    'firebase-functions/v2/https': { onCall: (fn)=>fn,
      HttpsError: class HttpsError extends Error { constructor(code, msg){ super(msg); this.code = code; } } },
    'firebase-functions/logger': { error(){}, info(){}, warn(){}, log(){} },
    'firebase-admin': { initializeApp(){}, firestore: Object.assign(()=>db, { FieldValue: fake.FieldValue }) }
  };
  const loadOriginal = Module._load;
  Module._load = function(req){ if(stubs[req]) return stubs[req]; return loadOriginal.apply(this, arguments); };
  const fns = require(path.join(__dirname, '..', 'functions', 'index.js'));
  Module._load = loadOriginal;

  const minhas = db.collection('users').doc('eu').collection('notifications');
  const dele   = db.collection('users').doc('outro').collection('notifications');
  const semear = async () => {
    for(const id of ['n1','n2','n3']) await minhas.doc(id).set({ type:'x', title:id, createdAt: 1 });
    await dele.doc('n1').set({ type:'x', title:'do outro', createdAt: 1 });
  };
  const quantas = async ref => (await ref.get()).docs.length;

    await semear();
    await fns.deleteNotifications({ auth:{ uid:'eu' }, data:{ ids:['n1','n3'] } });
    ok('apaga as marcadas', (await quantas(minhas)) === 1);
    ok('e nao encosta na caixa de outro treinador', (await quantas(dele)) === 1);

    let recusou = false;
    try{ await fns.deleteNotifications({ auth:{ uid:'eu' }, data:{ ids:[] } }); }
    catch(e){ recusou = e.code === 'invalid-argument'; }
    ok('lista vazia e recusada', recusou);

    recusou = false;
    try{ await fns.deleteNotifications({ data:{ ids:['n2'] } }); }
    catch(e){ recusou = e.code === 'unauthenticated'; }
    ok('sem login e recusado', recusou);

    recusou = false;
    try{ await fns.deleteNotifications({ auth:{ uid:'eu' }, data:{ ids: new Array(401).fill('x') } }); }
    catch(e){ recusou = e.code === 'invalid-argument'; }
    ok('lote grande demais e recusado (o batch do Firestore vai ate 500)', recusou);
    ok('e nada foi apagado nas recusas', (await quantas(minhas)) === 1);
}


console.log('\nO BOTAO QUE LEVA ATE O CAMPEONATO (16/09/2026)');
{
  const meta = id => ({ meta: { leagueTypeId: id } });
  /* AS CINCO DA FAMILIA: comecou, acabou, foi adiada, o resultado da partida e o campeao */
  const FAMILIA = ['league_started','league_ended','league_delayed','match_played','league_champion'];
  /* ⚠️ A TRAVA VALIDA O ATRIBUTO, e nao so a presenca do nome da funcao -- e essa diferenca e o
     defeito de 17/09/2026 inteiro (*"o botao que leva para a liga nao esta levando para lugar
     nenhum, nada acontece"*). O HTML gerado era:
       onclick="irParaALiga("classic")"
     porque o valor saia de um JSON.stringify, que poe ASPAS DUPLAS -- e o atributo onclick e
     delimitado por aspas duplas, entao a aspa do valor FECHAVA o atributo. O clique nao fazia nada,
     em silencio. A trava velha procurava 'irParaALiga' no HTML, e ele estava la: ela media a
     PRESENCA, nao a validade.
     O que se cobra agora e a chamada INTEIRA, com aspas simples dentro das duplas -- que e o que o
     escJs (o ajudante da casa pras duas camadas) produz. */
  const chamada = /onclick="irParaALiga\('[^"']*'\)"/;
  FAMILIA.forEach(t => {
    const html = S.ctaDaNotificacao(notif('n', t, meta('classic')));
    ok('a notificacao ' + t + ' leva ate a liga', chamada.test(html),
       (html.match(/onclick="irParaALiga[^>]*/) || ['(sem botao)'])[0]);
  });
  /* ⚠️ E NENHUM onclick DO ARQUIVO INTEIRO pode ter aspas duplas no meio: e o mesmo defeito, e ele
     pode nascer de novo em qualquer botao novo. Esta e a trava que teria pego o de hoje. */
  {
    const txt = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
    const ruins = (txt.match(/onclick="[^"]*\$\{JSON\.stringify/g) || []);
    ok('e nenhum onclick do jogo usa JSON.stringify (a aspa dupla fecha o atributo)',
       ruins.length === 0, ruins.join(' | ') || 'nenhum');
  }
  /* ⚠️ O TEXTO NOMEIA O DESTINO: "Ver a liga" num aviso de Trainers League faria o jogador
     procurar qual delas. */
  ok('e o texto diz QUAL liga -- Classica',
     S.ctaDaNotificacao(notif('n','league_started', meta('classic'))).indexOf('Liga Clássica') >= 0);
  ok('e Trainers League',
     S.ctaDaNotificacao(notif('n','league_ended', meta(S.TRAINERS_LEAGUE_TYPE))).indexOf('Trainers League') >= 0);
  /* ⚠️ SEM leagueTypeId NAO HA BOTAO: notificacao antiga (gravada antes do meta) nao pode virar um
     botao que leva pra lugar nenhum. */
  ok('notificacao sem leagueTypeId nao ganha botao',
     S.ctaDaNotificacao(notif('n','league_started')).indexOf('irParaALiga') < 0);
  /* o campeao mantem o premio E ganha a liga -- o premio vem primeiro, porque e o que EXPIRA */
  {
    const html = S.ctaDaNotificacao(notif('n','league_champion', meta('classic')));
    ok('o campeao continua com o botao da mochila', html.indexOf('openInventario') >= 0);
    ok('e o premio vem ANTES da liga', html.indexOf('openInventario') < html.indexOf('irParaALiga'));
  }
  /* e o que NAO e de liga continua sem ele */
  ok('friend_request nao ganha botao de liga',
     S.ctaDaNotificacao(notif('n','friend_request')).indexOf('irParaALiga') < 0);
}

console.log('\nE A LIGA CUSTOMIZADA CHEGA COM A CONFIG');
{
  /* ⚠️ ESTA E A ARMADILHA DA FEATURE. O `currentLeagueTypeConfig` carrega o `allowedTypes`, e e ELE
     que decide qual montador de time abre. Abrindo so com o id, uma liga restrita a um tipo cairia
     no montador comum -- e o jogador inscreveria um time que ela nao aceita, descobrindo isso so
     na hora de perder. */
  let aberta = null;
  S.openLeague = (id, config) => { aberta = { id, config }; };
  S.openTrainersLeague = () => { aberta = { id: S.TRAINERS_LEAGUE_TYPE, config: null }; };
  S.leagueTypeDocRef = (id) => ({
    get: () => Promise.resolve({ exists: true, data: () => ({ name:'Liga do Fogo', allowedTypes:['Fire'] }) })
  });
  return S.irParaALiga('liga_fogo').then(()=>{
    ok('a liga customizada abre COM a config', !!(aberta && aberta.config), JSON.stringify(aberta && aberta.config));
    ok('e com o allowedTypes, que e o que decide o montador',
       !!(aberta && aberta.config && aberta.config.allowedTypes),
       aberta && aberta.config ? String(aberta.config.allowedTypes) : '(sem)');
    return S.irParaALiga(S.TRAINERS_LEAGUE_TYPE);
  }).then(()=>{
    ok('a Trainers League abre pela porta dela', aberta && aberta.id === S.TRAINERS_LEAGUE_TYPE);
    return S.irParaALiga('classic');
  }).then(()=>{
    ok('e a Classica nao gasta leitura de config', aberta && aberta.id === 'classic' && !aberta.config);
    /* ⚠️ E SE A LEITURA FALHAR, ele abre assim mesmo: chegar na tela certa sem o cabecalho e
       melhor que nao sair do lugar. */
    S.leagueTypeDocRef = () => ({ get: () => Promise.reject(new Error('sem rede')) });
    return S.irParaALiga('liga_fogo');
  }).then(()=>{
    ok('com a leitura falhando, ele abre a liga mesmo assim', aberta && aberta.id === 'liga_fogo');
    
console.log('\nA LISTA MOSTRA 6 E O QUADRO DE BAIXO E FIXO (17/09/2026)');
{
  /* Pedido assim: *"a lista de notificacoes, coloque para exibir no maximo 6, depois disso coloque
     para rolar a barra. E deixe o quadro debaixo onde exibe as informacoes sobre a notificacao,
     fixo na tela, hoje ele fica se movendo, aumentando e diminuindo, conforme deleta ou troca de
     notificacao"*. */
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

  /* ⚠️ 1) O TETO DA LISTA E EM PX, e nao em vh -- e essa e a diferenca que faz o "6" ser verdade.
     Ele era '42vh', que e relativo a JANELA: a 320x568 dava 239px (5,8 linhas, por acaso perto de
     6), e numa tela de 800px de altura daria 8. A linha mede 41px, entao 6 delas sao 246. */
  const lista = (css.match(/\.notif-lista\{[^}]*\}/) || [''])[0];
  ok('a lista tem teto em PX (nao em vh)', /max-height:\s*\d+px/.test(lista) && !/vh/.test(lista), lista);
  const teto = +((lista.match(/max-height:\s*(\d+)px/) || [])[1] || 0);
  ok('e o teto e 6 linhas de 41px', teto === 246, teto + 'px');
  ok('e ela ROLA depois disso', /overflow-y:\s*auto/.test(lista), lista);

  /* ⚠️ 2) O QUADRO DE BAIXO TEM ALTURA FIXA. Medido a 320px nos dez tipos, ele ia de 188 a 355px --
     167px de diferenca, e a tela inteira pulava a cada troca de notificacao.
     ⚠️ ALTURA E NAO MIN-HEIGHT: com min-height o pulo volta no primeiro texto que passar dela. */
  const corpo = (css.match(/\.notif-corpo\{[^}]*\}/) || [''])[0];
  ok('o quadro de baixo tem altura FIXA', /height:\s*\d+px/.test(corpo) && !/min-height/.test(corpo), corpo);
  ok('e ele e uma coluna (topo, miolo, rodape)',
     /display:flex/.test(corpo) && /flex-direction:column/.test(corpo), corpo);
  /* ⚠️ E O 'overflow' VIVE NO MIOLO, nao no quadro: no quadro inteiro o rodape rolaria junto e o
     botao de apagar voltaria a sair do lugar -- que e o que se pediu pra parar. */
  const miolo = (css.match(/\.notif-corpo-miolo\{[^}]*\}/) || [''])[0];
  ok('e quem rola e o MIOLO', /flex:\s*1/.test(miolo) && /overflow-y:\s*auto/.test(miolo), miolo);
  ok('e o quadro inteiro NAO rola', !/overflow/.test(corpo), corpo);
  const rodape = (css.match(/\.notif-corpo-rodape\{[^}]*\}/) || [''])[0];
  ok('e o rodape nao cede espaco', /flex-shrink:\s*0/.test(rodape), rodape);

  /* 3) NA TELA: a marcacao dos tres andares, e o apagar no rodape. */
  {
    const S2 = createSandbox();
    const g2 = S2.__getGame();
    g2.authUser = { uid:'x' };
    g2.notificationsList = ['league_champion','friend_request','tower_top'].map((t,i)=>({
      id:'n'+i, type:t, title:'T'+i, body:'corpo '.repeat(i*20+1),
      createdAt:{ seconds:1758000000 }, meta:{ leagueTypeId:'classic' } }));
    g2.notificationsLoaded = true;
    g2.notificationSelected = 'n0';
    g2.screen = 'notifications';
    S2.__setGame(g2);
    const h = S2.renderNotificationsScreen();
    ok('o quadro de baixo usa a classe de altura fixa', h.indexOf('box notif-corpo') >= 0);
    ok('e tem miolo e rodape', h.indexOf('notif-corpo-miolo') >= 0 && h.indexOf('notif-corpo-rodape') >= 0);
    /* ⚠️ O APAGAR FICA NO RODAPE: e a acao que nao muda de notificacao pra notificacao, e e ela que
       a mao procura sempre no mesmo lugar. */
    ok('e o Apagar fica DENTRO do rodape',
       /notif-corpo-rodape[\s\S]{0,200}requestDeleteNotification/.test(h),
       (h.match(/notif-corpo-rodape[\s\S]{0,120}/) || ['?'])[0].replace(/\s+/g, ' '));
    /* e o botao que leva pra liga continua no MIOLO, junto do texto que ele acompanha */
    const ini = h.indexOf('notif-corpo-miolo'), fim = h.indexOf('notif-corpo-rodape');
    ok('e o botao da liga continua no miolo',
       h.slice(ini, fim).indexOf('irParaALiga') >= 0);
  }
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
    process.exit(falhas ? 1 : 0);
  });
}

})();
})();
