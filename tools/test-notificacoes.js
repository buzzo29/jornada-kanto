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
ok('campeao sem ativar: botao de ativar o bonus',
   S.ctaDaNotificacao(notif('1','league_champion')).includes('activateShinyBonus'));
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

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
