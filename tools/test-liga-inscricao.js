/**
 * A TELA DA LIGA TEM QUE REFLETIR A INSCRICAO NA HORA.
 *
 * Por que isso existe: a lista do time inscrito sai de game.registeredTeam, que e uma COPIA na
 * memoria da aba -- e ela so era relida ao ABRIR a tela da Liga. Entao trocar de time (cancelar a
 * inscricao e entrar com outro) deixava o time ANTIGO na tela, e um Doce Raro deixava o nivel
 * antigo, ate a pessoa sair da Liga e voltar. Foi reportado das duas formas.
 *
 * O teste dirige as funcoes de verdade com os colaboradores trocados por espioes -- o que importa
 * aqui nao e o que vai pro Firestore (isso o servidor ja faz), e sim que a tela nao fique
 * mostrando uma inscricao que nao existe mais.
 *
 *   node tools/test-liga-inscricao.js
 */
const { createSandbox } = require('./game-sandbox');

const S = createSandbox();
const g = S.__getGame();

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}

const TIPO = 'classic';
const timeAntigo = [{ id:'a1', speciesId:'gyarados', level:70 }];
const timeNovo   = [{ id:'b1', speciesId:'venusaur', level:72 }];

// colaboradores: o que interessa e o efeito na TELA, nao o que chega no Firestore
let relidas = [];
S.checkLeagueRegistrationStatus = (typeId) => { relidas.push(typeId); return Promise.resolve(); };
S.refreshLeagueView = () => Promise.resolve();
S.ensureRegisteringCycle = () => Promise.resolve({ id:'ciclo1' });
S.isAccountActiveInLeague = () => Promise.resolve(false);
const docFalso = { get: () => Promise.resolve({ exists:false }), delete: () => Promise.resolve(), set: () => Promise.resolve() };
S.registrantDocRef = () => docFalso;
S.scheduleDocRef = () => ({ get: () => Promise.resolve({ exists:true, data: () => ({ cycles:[{ id:'ciclo1', status:'registering' }] }) }) });

function estadoBase(){
  g.authUser = { uid:'u1' };
  g.trainerName = 'Buzzo';
  g.currentLeagueTypeId = TIPO;
  g.accountLeagueSlots = { [TIPO]: 0 };
  g.registeredTeam = timeAntigo;
  g.saveSlots = [
    { team: timeAntigo, badgeCount: 8, customName: 'Time 1' },
    { team: timeNovo,   badgeCount: 8, customName: 'Time 2' }
  ];
  g.leagueError = null;
  g.leagueSubmitting = false;
  g.screen = 'league';
  S.__setGame(g);
}

(async () => {

console.log('\nTROCAR O TIME INSCRITO');
estadoBase();
relidas = [];
await S.cancelLeagueRegistration(TIPO);
let est = S.__getGame();
ok('cancelar tira o time da tela na hora', est.registeredTeam === null,
   'registeredTeam: ' + JSON.stringify(est.registeredTeam));
ok('e libera o slot da conta', (est.accountLeagueSlots||{})[TIPO] == null);

relidas = [];
await S.registerForLeague(TIPO, 1, false);
est = S.__getGame();
/* Nao basta gravar: a tela le a inscricao de uma copia em memoria, entao alguem precisa mandar
   reler. Sem isso, a lista continuava mostrando o time que acabou de sair. */
ok('inscrever manda reler a inscricao', relidas.includes(TIPO), JSON.stringify(relidas));
ok('e o slot da conta ja aponta pro time novo', (est.accountLeagueSlots||{})[TIPO] === 1,
   String((est.accountLeagueSlots||{})[TIPO]));
ok('sem erro na tela', !est.leagueError, est.leagueError || '');
ok('e sem ficar preso em "Inscrevendo..."', est.leagueSubmitting === false);

console.log('\nO DOCE RARO TEM QUE CHEGAR NA TELA');
/* O servidor ja repropaga o codigo do time pras inscricoes (atualizarInscricoesComTime, chamado
   dentro do proprio useRareCandy). O que ficava velho era a copia desta aba. */
estadoBase();
relidas = [];
let slotsRecarregados = 0;
S.loadSaveSlots = () => { slotsRecarregados++; return Promise.resolve(); };
S.functionsClient = { httpsCallable: () => () => Promise.resolve({ data:{ rareCandies: 0 } }) };
g.tower = { rareCandies: 1 };
g.candyPicker = {};
S.__setGame(g);
await S.useRareCandyOn(0, 'a1');
est = S.__getGame();
ok('recarrega os saves', slotsRecarregados === 1);
ok('joga fora a inscricao velha da memoria', est.registeredTeam === null,
   'registeredTeam: ' + JSON.stringify(est.registeredTeam));
ok('e manda reler a inscricao da liga aberta', relidas.includes(TIPO), JSON.stringify(relidas));

console.log('\nSEM LIGA ABERTA, NAO SAI LENDO NADA');
estadoBase();
g.currentLeagueTypeId = null; g.tower = { rareCandies: 1 }; g.candyPicker = {}; S.__setGame(g);
relidas = [];
await S.useRareCandyOn(0, 'a1');
ok('nenhuma leitura extra quando a Liga nem foi aberta', relidas.length === 0, JSON.stringify(relidas));


console.log('\nA ESCOLHA DE TIME PRA LIGA');
estadoBase();
g.currentLeagueTypeConfig = null;
g.saveSlots = [
  { badgeCount:8, customName:'Os Clássicos', team:[{speciesId:'venusaur',level:70},{speciesId:'charizard',level:72}],
    mewtwoReward:{ earned:true, used:false } },
  { badgeCount:8, customName:'Time 2', team:[{speciesId:'blastoise',level:60}] },
  { badgeCount:3, customName:'Inacabado', team:[{speciesId:'pidgey',level:20}] }
];
S.__setGame(g);
const picker = S.renderLeagueTeamPicker();
/* O card inteiro é o botão -- não havia motivo pra um botão vermelho separado embaixo de um card
   que já é a coisa clicável em todo o resto do jogo. */
ok('o card e o proprio botao',
   /<button class="save-slot-card[^"]*"[^>]*onclick="registerForLeague/.test(picker));
ok('sumiu o botao vermelho de inscrever', !picker.includes('Inscrever esse time'));
ok('so os times com 8 insignias aparecem',
   picker.includes('Os Clássicos') && picker.includes('Time 2') && !picker.includes('Inacabado'));
/* A MESMA estrela da home: o jogador reconhece o time por ela. */
ok('cada card traz a estrela com a media do time',
   (picker.match(/team-avg-star-num/g)||[]).length === 2 && picker.includes('>71<'),
   'medias esperadas: 71 e 60');
ok('e o trofeu saiu de perto do nome', !picker.includes('🏆'));
/* O botão do Mewtwo fica FORA do card: <button> dentro de <button> é HTML inválido e o clique de
   dentro se perde (a mesma lição do card do encontro selvagem). */
ok('o botao do Mewtwo nao fica dentro do card',
   !/<button class="save-slot-card(?:(?!<\/button>)[\s\S])*<button/.test(picker));
/* O premio de '1 uso' do Mewtwo saiu (01/09/2026): o emprestimo poe o Mewtwo NO time salvo por
   24h, entao qualquer codigo montado a partir do save ja sai com ele -- sem botao especial. */
ok('nao existe mais botao de inscrever COM o Mewtwo', !picker.includes('COM o Mewtwo'));

console.log('\nO AVISO DA LIGA SOME PRA QUEM JA ESTA DENTRO');
/* Reportado: inscrito na liga e o aviso "inscrições abertas" continuava aparecendo nas batalhas.
   O aviso vive numa cópia em memória com folga de 5 minutos -- quem acabou de se inscrever
   continuava vendo o convite até a folga passar. */
estadoBase();
g.avisoLiga = { hora: Date.now() + 600000 };
S.__setGame(g);
await S.registerForLeague(TIPO, 1, false);
ok('inscrever apaga o aviso na hora', S.__getGame().avisoLiga === null,
   JSON.stringify(S.__getGame().avisoLiga));
/* ⚠️ ESTA TRAVA VIROU DO AVESSO EM 24/09/2026, e ela NAO foi apagada: ela media "quem esta
   DISPUTANDO um ciclo ja sorteado nao ve o convite", com a razao de que a tela da Liga BLOQUEAVA a
   inscricao nesse caso. A porta abriu (a pedido), e agora ela cobra o contrario -- senao alguem
   reintroduz a trava e ninguem ve.
   ⚠️ E O CASO NOVO E DE COMPORTAMENTO, nunca com a funcao dublada: dublando, ele passaria de volta
   com o ramo do chaveamento inteiro no lugar. O calendario tem um ciclo `drawn` COM o uid no
   chaveamento e um `registering` onde ele NAO esta -- e o convite tem que SAIR. */
estadoBase();
g.avisoLiga = null; g.ultimaChecagemDaLiga = 0; S.__setGame(g);
let leuChaveamento = 0;
S.scheduleDocRef = () => ({ get: () => Promise.resolve({ exists:true,
  data: () => ({ cycles:[{ id:'emcurso', status:'drawn' },
                          { id:'c9', status:'registering', scheduledTime: Date.now()+600000 }] }) }) });
S.cycleDocRef = () => ({ get: () => { leuChaveamento++; return Promise.resolve({ exists:true,
  data: () => ({ leagues:[{ id:'L1', rounds:{ 0:[{ a:{ uid:'u1' }, b:{ uid:'x' } }] } }] }) }); } });
S.registrantDocRef = () => ({ get: () => Promise.resolve({ exists:false }) });
await S.atualizarAvisoDaLiga();
ok('quem esta DISPUTANDO um chaveamento VE o convite', !!S.__getGame().avisoLiga,
   JSON.stringify(S.__getGame().avisoLiga));
ok('  e o chaveamento nem e lido (a varredura saiu)', leuChaveamento === 0, String(leuChaveamento));
/* ⚠️ MAS QUEM JA ESTA INSCRITO NO CICLO ABERTO CONTINUA SEM VER -- essa metade da trava FICA, e sem
   ela uma mudanca que apagasse a checagem inteira passaria. */
estadoBase();
g.avisoLiga = null; g.ultimaChecagemDaLiga = 0; S.__setGame(g);
S.scheduleDocRef = () => ({ get: () => Promise.resolve({ exists:true,
  data: () => ({ cycles:[{ id:'c9', status:'registering', scheduledTime: Date.now()+600000 }] }) }) });
S.registrantDocRef = () => ({ get: () => Promise.resolve({ exists:true, data: () => ({ slot:0 }) }) });
await S.atualizarAvisoDaLiga();
ok('quem ja esta INSCRITO no ciclo aberto nao ve', S.__getGame().avisoLiga === null,
   JSON.stringify(S.__getGame().avisoLiga));
S.registrantDocRef = () => ({ get: () => Promise.resolve({ exists:false }) });
g.ultimaChecagemDaLiga = 0;   // a folga de 5min ja tinha sido gasta pela checagem acima
S.__setGame(g);
await S.atualizarAvisoDaLiga();
ok('e quem esta de fora ve', !!S.__getGame().avisoLiga, JSON.stringify(S.__getGame().avisoLiga));


/* =====================================================================
   A TELA COM UM CHAVEAMENTO EM ANDAMENTO (24/09/2026)
   ⚠️ E ELA QUE O JOGADOR VE: o aviso e o `disabled` do botao liam o `accountLeagueSlots`, e dentro
   do ramo "NAO estou inscrito" ele so pode vir de um ciclo JA SORTEADO -- se fosse o ciclo ABERTO, o
   `alreadyIn` seria true e aquele bloco nem existiria. Ou seja a condicao isola o caso sozinha, e o
   que mudou foi o botao destravar e o texto deixar de mandar esperar.
   ===================================================================== */
console.log('\n=== A TELA COM UM CHAVEAMENTO EM ANDAMENTO ===');
{
  estadoBase();
  g.screen = 'league';
  g.currentLeagueTypeId = TIPO;
  g.accountLeagueSlots = { [TIPO]: 3 };
  /* ⚠️ O ESTADO QUE O renderLeague LE E O leagueData, com os ciclos -- e o leagueScreenLoading
     precisa estar DESLIGADO, senao ele cai no ramo "Carregando..." e a trava mede o VAZIO. A
     primeira versao deste fixture usava um leagueView que nao existe, e as seis asserções falhavam
     com o codigo certo: e a armadilha do fixture que nao cai na faixa em que a regra vale. */
  g.leagueScreenLoading = false;
  g.leagueData = { cycles: [{ id:'c9', status:'registering', scheduledTime: Date.now()+6e5,
                             registrants: [], amIRegistered: false }] };
  S.__setGame(g);
  const tela = S.renderLeague();
  ok('o botao de escolher time NAO esta desabilitado',
     /openLeagueTeamPicker\(\)/.test(tela) &&
     !/<button[^>]*disabled[^>]*onclick="openLeagueTeamPicker/.test(tela));
  ok('  e o aviso continua na tela, informativo', /j[aá] est[aá] disputando essa Liga/.test(tela));
  ok('    e ele nao manda mais ESPERAR', !/Espere ela terminar/.test(tela));
  ok('    e nomeia o time que esta disputando', tela.indexOf(S.slotDisplayName(3)) >= 0);
  /* ⚠️ E QUEM ESTA INSCRITO NO CICLO ABERTO continua vendo a outra caixa -- essa metade nao mudou, e
     sem este caso uma mudanca que apagasse o `alreadyIn` passaria. */
  g.leagueData.cycles[0].amIRegistered = true;
  S.__setGame(g);
  const dentro = S.renderLeague();
  ok('quem JA esta inscrito ve a caixa de inscrito', /Voc[eê] est[aá] inscrito/.test(dentro));
  ok('  e nao ve o botao de escolher time', !/openLeagueTeamPicker\(\)/.test(dentro));
}

/* =====================================================================
   QUANTAS IDAS AO SERVIDOR O CLIQUE CUSTA (16/09/2026)
   ⚠️ ESTA TRAVA E DE CONTAGEM, NAO DE TEMPO -- e de proposito. Medir milissegundos num teste
   daria um numero que muda com a maquina e com o dia; o que decide o tempo aqui e o numero de
   idas EM SEQUENCIA, porque cada uma espera a anterior. A 150ms de RTT (celular), cada ida a
   mais e 150ms parado com o botao travado.
   Ela nasceu de um relato: *"pra se inscrever na liga a gente clica no botao Inscrever time e ta
   demorando um bom tempo"*. Medido na epoca: SEIS idas, das quais tres eram desperdicio -- o
   calendario lido duas vezes, o documento do inscrito lido duas vezes, e uma TRANSACAO no lugar
   de uma leitura no caso comum (transacao custa duas idas: ler + confirmar).
   ===================================================================== */

console.log('\nOS QUADROS QUE ABREM E FECHAM (17/09/2026)');
{
  /* Pedidos assim: *"na liga classica e trainers league, nos quadros de Top 10, Suas ultimas ligas e
     Ultimas Ligas, coloque um quadrado azul com um sinal de + alinhado na direita do titulo, e
     quando o usuario clicar, abre as linhas que aparecem hoje"*. */
  const SQ = createSandbox();
  const gq = SQ.__getGame();

  /* 1) O CABECALHO: o titulo, o + a direita, e o conteudo SO quando aberto. */
  gq.quadrosAbertos = {};
  SQ.__setGame(gq);
  const fechado = SQ.quadroDobravelHtml('x', '🏆 Top 10', '<div class="linhas">CONTEUDO</div>');
  ok('fechado: o titulo aparece', fechado.indexOf('🏆 Top 10') >= 0);
  ok('e o sinal e um +', /quadro-dobra-mais[^>]*>\+</.test(fechado),
     (fechado.match(/quadro-dobra-mais[^<]*<[^>]*>[^<]*/) || ['?'])[0]);
  ok('e o CONTEUDO nao e desenhado', fechado.indexOf('CONTEUDO') < 0);
  SQ.alternarQuadro('x');
  const aberto = SQ.quadroDobravelHtml('x', '🏆 Top 10', '<div class="linhas">CONTEUDO</div>');
  ok('aberto: o conteudo aparece', aberto.indexOf('CONTEUDO') >= 0);
  ok('e o sinal vira um menos', /quadro-dobra-mais[^>]*>−</.test(aberto));
  SQ.alternarQuadro('x');
  ok('e clicar de novo FECHA',
     SQ.quadroDobravelHtml('x', 't', 'CONTEUDO').indexOf('CONTEUDO') < 0);

  /* ⚠️ 2) O CABECALHO E UMA <div role="button">, NUNCA UM <button>: o conteudo destes quadros TEM
     botoes dentro (o "▶ Rever" dos historicos, e o nome do treinador do Top 10, que abre o perfil).
     <button> dentro de <button> e HTML invalido -- o navegador fecha o de fora e o clique de dentro
     se perde, com a tela continuando a PARECER certa. Essa armadilha ja custou dois defeitos aqui
     (a lupa do encontro selvagem e a do montador). */
  ok('o cabecalho NAO e um <button>', fechado.indexOf('<button') < 0, fechado.slice(0, 90));
  ok('e ele e uma div com role=button e tabindex',
     /<div class="quadro-dobra-cab" role="button" tabindex="0"/.test(fechado));
  ok('e responde ao teclado (Enter e Espaco)',
     /onkeydown=.*Enter/.test(fechado) && /event\.preventDefault/.test(fechado));
  ok('e diz se esta aberto (aria-expanded)',
     /aria-expanded="false"/.test(fechado) && /aria-expanded="true"/.test(aberto));
  /* ⚠️ E O CONTEUDO E IRMAO do cabecalho, nao filho: o </div> do cabecalho vem ANTES dele. */
  ok('e o conteudo e IRMAO do cabecalho (o </div> fecha antes)',
     aberto.indexOf('</div>') < aberto.indexOf('CONTEUDO'),
     aberto.replace(/\s+/g, ' ').slice(0, 200));

  /* ⚠️ 3) OS QUATRO QUADROS DO JOGO usam a MESMA funcao -- escritos um a um, o quinto nasceria com
     o + fora de lugar ou sem fechar. */
  {
    const txt = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
    const ids = (txt.match(/quadroDobravelHtml\('([a-z0-9_]+)'/g) || [])
      .map(m => m.replace(/quadroDobravelHtml\('|'/g, ''));
    ok('sao QUATRO quadros no jogo', ids.length === 4, ids.join(', '));
    ok('e os ids nao repetem (senao dois abrem juntos)',
       new Set(ids).size === ids.length, ids.join(', '));
    ok('e sao os quatro pedidos (os dois Top 10 e os dois historicos)',
       ids.slice().sort().join(',') === 'classic_top10,minhas_ligas,tl_top10,ultimas_ligas',
       ids.slice().sort().join(','));
    /* ⚠️ E NENHUM <h2> SOLTO SOBROU nos quatro titulos: um deles fora da funcao seria um quadro que
       nao abre nem fecha, e so quem abrisse aquela liga descobriria. */
    const soltos = ['🏆 Top 10 maiores vencedores', '📜 Suas últimas Ligas', '🌐 Últimas Ligas']
      .filter(t => txt.indexOf('<h2>' + t + '</h2>') >= 0);
    ok('e nenhum titulo desses ficou num <h2> solto', soltos.length === 0, soltos.join(' | ') || 'nenhum');
  }

  /* ⚠️ 4) ELES COMECAM FECHADOS e ZERAM ao entrar na liga: o "aberto" de ontem nao e uma
     preferencia -- e o estado em que o jogador largou a tela na vez passada. */
  {
    const txt = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
    const zera = t => {
      const i = txt.indexOf(t);
      return i >= 0 && txt.slice(i, i + 700).indexOf('game.quadrosAbertos = {}') >= 0;
    };
    ok('a Liga Classica zera os quadros ao entrar', zera('function openLeague(typeId, typeConfig){'));
    ok('e a Trainers League tambem', zera('function openTrainersLeague(){'));
    /* e o estado NAO vai pro save: ele e de tela */
    gq.quadrosAbertos = { classic_top10: true };
    SQ.__setGame(gq);
    ok('e o estado nao vai pro save',
       SQ.serializeGame().quadrosAbertos === undefined,
       JSON.stringify(SQ.serializeGame().quadrosAbertos));
  }

  /* 5) NA TELA DE VERDADE: os tres da Classica, com as linhas so quando abertas. */
  {
    const g2 = SQ.__getGame();
    g2.screen = 'league';
    g2.currentLeagueTypeId = SQ.CLASSIC_LEAGUE_TYPE;
    g2.leagueScreenLoading = false;
    g2.leagueData = { cycles: [] };
    g2.trainerName = 'Buzzo';
    g2.leagueLeaderboard = Array.from({length:10},(_,i)=>({ uid:'u'+i, name:'T'+(i+1), count:10-i }));
    g2.myLeagueHistory = [{ cycleId:'c1', leagueId:1, cycleTime:1758000000, placement:'Campeão',
                            leagueSize:16, leagueTypeId:'classic', leagueTypeName:'Liga Clássica' }];
    /* ⚠️ O CAMPO E UM MAPA POR TIPO desde 25/09/2026, quando a Liga Pro ganhou o quadro global: ele
       era um campo so, carregado apenas quando a Classica abria e NUNCA limpo -- o historico dela
       aparecia nas outras ligas, com o "Rever" levando ao chaveamento errado. Hoje o render le a
       chave do tipo CORRENTE, e um array aqui deixa a Classica sem o quadro (foi o que esta trava
       acusou, e ela estava certa: o fixture e que estava no formato antigo).
       ⚠️ QUEM TEM A ABA ABERTA DE ANTES DO DEPLOY tem o formato velho por alguns segundos -- o campo
       nao vai pro save, e a proxima varredura (a abertura da liga ou o tique de 5s) repoe o mapa. */
    g2.globalLeagueHistory = { classic: [{ cycleId:'g1', cycleTime:1758000000,
                                league:{ id:1, size:16, champion:{ name:'Buzzo' } } }] };
    g2.quadrosAbertos = {};
    SQ.__setGame(g2);
    const conta = h => (h.match(/quadro-dobra-cab/g) || []).length;
    const linhas = h => (h.match(/leaderboard-row|status-row/g) || []).length;
    const f = SQ.renderLeague();
    ok('a Liga Classica desenha os TRES quadros', conta(f) === 3, conta(f) + ' quadros');
    ok('e comeca sem linha nenhuma', linhas(f) === 0, linhas(f) + ' linhas');
    SQ.alternarQuadro('classic_top10');
    SQ.alternarQuadro('minhas_ligas');
    SQ.alternarQuadro('ultimas_ligas');
    const a = SQ.renderLeague();
    ok('e abertos trazem as 12 linhas', linhas(a) === 12, linhas(a) + ' linhas');
    /* ⚠️ E O BOTAO "Rever" DOS HISTORICOS CONTINUA INTEIRO -- ele fica DENTRO do conteudo, e uma
       crase mal fechada na montagem o comeria em silencio. */
    ok('e o Rever dos historicos continua la',
       (a.match(/viewLeagueHistory/g) || []).length === 2,
       (a.match(/viewLeagueHistory/g) || []).length + ' botoes');
    /* e o nome do treinador do Top 10 continua clicavel (o perfil) */
    ok('e o nome do Top 10 continua abrindo o perfil', a.indexOf('openTrainerProfile') >= 0);
  }

  /* ⚠️ 6) O CSS: o + e um QUADRADO (mesma largura e altura) e AZUL -- isso nao aparece em assercao
     de HTML nenhuma, entao a trava le a folha. E o limite [^}]* e obrigatorio: sem ele o
     quantificador atravessa o arquivo e casa em outra regra. */
  {
    const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
    const r = (css.match(/\.quadro-dobra-mais\{[^}]*\}/) || [''])[0];
    const w = (r.match(/width:(\d+)px/) || [])[1];
    const h = (r.match(/height:(\d+)px/) || [])[1];
    ok('o + e um QUADRADO', !!w && w === h, 'w=' + w + ' h=' + h);
    ok('e ele e azul', /background:var\(--blue\)/.test(r), r);
    /* ⚠️ E O TITULO EMPURRA O + PRA DIREITA: e o flex:1 dele que faz isso, e foi o pedido
       ("alinhado na direita do titulo"). */
    const t = (css.match(/\.quadro-dobra-tit\{[^}]*\}/) || [''])[0];
    ok('e o titulo empurra o + pra DIREITA (flex:1)', /flex:1/.test(t), t);
    const cab = (css.match(/\.quadro-dobra-cab\{[^}]*\}/) || [''])[0];
    ok('e o cabecalho e uma linha clicavel', /display:flex/.test(cab) && /cursor:pointer/.test(cab), cab);
  }
}

console.log('\nO CLIQUE EM INSCREVER NAO PODE VOLTAR A CUSTAR SEIS IDAS');
{
  const S2 = createSandbox();          // sandbox proprio: o de cima tem os colaboradores trocados
  const g2 = S2.__getGame();
  const idas = [];
  /* o calendario de PRODUCAO: 48 ciclos concluidos mais o aberto (ver o CLAUDE.md) */
  const CICLOS = [];
  for(let i = 0; i < 48; i++) CICLOS.push({ id:'c'+i, status:'complete' });
  CICLOS.push({ id:'agora', status:'registering' });
  const doc = (caminho) => ({
    __p: caminho,
    collection(n){ return doc(caminho + '/' + n); },
    doc(id){ return doc(caminho + '/' + id); },
    get(){
      idas.push('get ' + caminho);
      if(caminho.indexOf('schedule') >= 0){
        return Promise.resolve({ exists:true, data:()=>({ cycles: CICLOS }) });
      }
      return Promise.resolve({ exists:false, data:()=>({}) });
    },
    set(){ return Promise.resolve(); },
    onSnapshot(){ return ()=>{}; }
  });
  S2.db = {
    collection(n){ return doc(n); },
    runTransaction(fn){
      const tx = {
        get(ref){
          idas.push('tx.get ' + ref.__p);
          if(String(ref.__p).indexOf('schedule') >= 0){
            return Promise.resolve({ exists:true, data:()=>({ cycles: CICLOS }) });
          }
          return Promise.resolve({ exists:false, data:()=>({}) });
        },
        set(){}
      };
      return Promise.resolve(fn(tx)).then(r => { idas.push('commit'); return r; });
    }
  };
  g2.authUser = { uid:"u1" };
  g2.trainerName = "Buzzo";
  g2.specialties = [];
  g2.saveSlots = [{ badgeCount:8, trainerName:"Buzzo",
    team:[{ speciesId:"gyarados", level:70, shiny:false }] }];
  S2.__setGame(g2);
  S2.checkLeagueRegistrationStatus = () => {};
  S2.refreshLeagueView = () => {};

  S2.registerForLeague(S2.CLASSIC_LEAGUE_TYPE, 0, true).then(()=>{
    const emSequencia = idas.filter(x => /^get |^tx\.get |^commit$/.test(x)).length;
    ok('o clique custa no maximo TRES idas ao servidor', emSequencia <= 3,
       emSequencia + ' idas: ' + idas.join(' | '));
    /* ⚠️ E CADA UMA DESSAS TEM DONO: o calendario UMA vez, e a gravacao (ler + confirmar). */
    const calendario = idas.filter(x => x.indexOf('schedule') >= 0).length;
    ok('o calendario e lido UMA vez so', calendario === 1, calendario + 'x');
    const inscrito = idas.filter(x => x.indexOf('registrants') >= 0).length;
    ok('e o documento do inscrito tambem', inscrito === 1, inscrito + 'x');
    /* a gravacao continua sendo uma TRANSACAO: e ela que recusa a inscricao dupla */
    ok('a gravacao continua dentro de uma transacao', idas.indexOf('commit') >= 0);
    console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
    process.exit(falhas ? 1 : 0);
  }).catch(e => { console.error(e); process.exit(1); });
}


})();
