/**
 * Carrega a lógica do jogo (index.html) num sandbox Node, sem navegador
 * nem Firebase, e devolve todas as funções/dados globais do jogo.
 *
 * Serve para os scripts de balanceamento e para o teste de regressão da economia:
 * como o motor de batalha é JS puro e determinístico, dá para rodar centenas de
 * milhares de batalhas simuladas e ver exatamente quem está OP antes e depois de
 * cada ajuste (doc 02 §4.6).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function extractGameScript(htmlPath){
  const html = fs.readFileSync(htmlPath, 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  // o bloco do jogo é o maior de todos (os outros são config do Firebase)
  return blocks.sort((a,b)=>b.length-a.length)[0];
}

function makeElementStub(){
  const el = {
    style:{}, classList:{ add(){}, remove(){}, contains(){ return false; } },
    textContent:'', innerHTML:'', value:'',
    appendChild(){}, removeChild(){}, addEventListener(){}, remove(){},
    focus(){}, querySelector(){ return makeElementStub(); },
    getBoundingClientRect(){ return {top:0,left:0,width:0,height:0}; }
  };
  el.nextElementSibling = null;
  return el;
}

function createSandbox(htmlPath){
  const code = extractGameScript(htmlPath || path.join(__dirname, '..', 'index.html'));
  const noop = ()=>{};
  /* onSnapshot guarda os callbacks em vez de ignorá-los: é o que permite testar fora do navegador
     uma tela que ESCUTA o Firestore (o Boss de Domingo) -- dispara `sandbox.__snapshots.mew(...)`
     e vê o que a tela faz. Antes devolvia um noop e a escuta era invisível pro teste. */
  const escutas = {};
  const firestoreStub = (caminho) => ({
    collection(nome){ return firestoreStub(nome); },
    doc(id){ return firestoreStub(id); },
    get(){ return Promise.resolve({ exists:false, data(){ return {}; } }); },
    set(){ return Promise.resolve(); },
    onSnapshot(ok, err){
      escutas[caminho] = { ok, err, ativo:true };
      return ()=>{ if(escutas[caminho]) escutas[caminho].ativo = false; };
    },
    runTransaction(){ return Promise.resolve(); }
  });
  const sandbox = {
    console,
    Math, JSON, Date, Number, String, Object, Array, Boolean, Error, Set, Map, Promise, RegExp,
    isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout:(fn)=>{ /* nada: as animações não existem fora do navegador */ return 0; },
    clearTimeout: noop, setInterval:()=>0, clearInterval: noop,
    btoa:(str)=>Buffer.from(str,'binary').toString('base64'),
    atob:(str)=>Buffer.from(str,'base64').toString('binary'),
    document:{
      getElementById(){ return makeElementStub(); },
      querySelector(){ return makeElementStub(); },
      querySelectorAll(){ return []; },
      createElement(){ return makeElementStub(); },
      addEventListener: noop,
      body: makeElementStub()
    },
    navigator:{ clipboard:{ writeText(){ return Promise.resolve(); } } },
    // o jogo compara o hash da própria página a cada 5min pra avisar que saiu deploy novo
    // (__captureInitialVersion). Fora do navegador isso não tem sentido, mas sem estes quatro
    // stubs ele lança e o console.error do catch suja a saída de toda simulação. Com eles a
    // checagem roda até o fim, em silêncio, sobre uma página vazia.
    location:{ pathname:'/' },
    fetch:()=>Promise.resolve({ text:()=>Promise.resolve('') }),
    TextEncoder, crypto,
    firebase:{ initializeApp(){}, auth(){ return {}; }, firestore(){ return firestoreStub(); } },
    auth:{ onAuthStateChanged(){}, signOut(){ return Promise.resolve(); } },
    db: firestoreStub(),
    /* `db`, `auth` e `functionsClient` nascem num <script> SEPARADO da página (o da config do
       Firebase), e o sandbox só carrega o bloco maior -- o do jogo. Por isso eles entram aqui na
       mão. Sem o functionsClient, qualquer tela que chame uma Cloud Function derruba o teste com
       um ReferenceError que não tem nada a ver com o que estava sendo testado. */
    functionsClient: { httpsCallable(){ return ()=>Promise.resolve({ data:{} }); } },
    __escutas: escutas   // ver o onSnapshot acima
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.addEventListener = noop;
  vm.createContext(sandbox);
  // `const`/`let` no topo de um script vm ficam no escopo léxico e não viram propriedades do
  // sandbox -- este epílogo publica explicitamente o que os scripts de análise precisam.
  const EXPORTS = [
    'SPECIES','TYPE_CHART','EVOLUTIONS','LEGS','GYMS','STARTERS','ROUTE_MAP','LEGENDARY_BIRDS',
    'DECLARED_CHALLENGES','ROULETTE_PRIZES','WIN_BASE_POINTS','SURVIVOR_BONUS_CAP','STREAK_BONUS_CAP',
    'REMATCH_LEVEL_CAP','GIOVANNI_RELIEF_CAP','DEFEAT_ADVANCE','SHINY_CHANCE','ACHIEVEMENTS',
    'createInstance','calcMaxHp','calcDamage','doExchange','simulateGymBattle','makeSeededRng',
    'applyTeamBonuses','badgeDamageBonus','diversityDamageBonus','bestMultiplier','rolledMultiplier',
    'firstStrikeChance','tryEvolve','bstOf','rarityWeight','weightedPick','computeVictoryRewards',
    'theoreticalMaxPoints','gymTeamForBattle','battleLineup','buildRivalTeam','routeById','shuffle',
    'randomInt','freshGameDefaults','encodeTeamCode','decodeTeamCode',
    'chooseStarter','startLeg','chooseRoute','crossTunnelBlind','crossTunnelSlow','chooseFossil',
    'skipFossil','chooseDojoPrize','safariTry','finishSafari','acceptNpcTrade','declineNpcTrade',
    'leaveAtDayCare','skipDayCare','enterHideout','skipHideout','setCasinoBet','spinCasino',
    'leaveCasino','skipCasino','toggleWild','confirmWild','toggleRelease','confirmRelease',
    'chooseEeveeEvolution','addPoint','confirmLevels','continueFromEvolution','confirmOrder',
    'runBattle','advanceReveal','runEventBattle','advanceEventReveal','closeEventResult',
    'takeEmergencyMon','skipEmergency','goToRouletteOrContinue','pickRouletteCard','useRareCandy',
    'closeRoulette','prepareRetry','declareChallenge','setMvpBet','toggleScoreBet','challengeIsViable',
    'advanceJourney','startWildEncounter','rematchLevelBump','NPC_TRADES,'.slice(0,-1),
    // anti-artimanha: encontro selvagem preso ao contador do save e sorteio dos iniciais preso
    // ao slot (ver test-artimanha.js)
    'goToWildEncounter','montaOfertaSelvagem','currentShinyChance','ehLendario','nivelDeLendario','LENDARIOS','LEGS',
    'especieNoNivel','rollWildLevel','EVOLVED_MIN_LEVEL',
    // Boss de Domingo: a tela escuta o Firestore, e isso da pra exercitar aqui (ver __escutas)
    'ligarEscutaDoBoss','pararEscutaDoBoss','pararAcompanhamentoDoBoss','agendarPollDoBoss',
    'assinaturaDoBoss','renderSundayBoss','sairDoBoss','BOSS_POLL_MS',
    'sorteioDosIniciais','chaveDoSorteio','encerrarTentativaDoSlot','HARD_SHINY_CHANCE',
    // terreno, buffs e atributos: sem eles nao da pra medir o efeito de terreno/shiny,
    // que e justamente onde cliente e servidor ja divergiram
    // golpes especiais (ver test-especiais.js)
    'AUTODESTRUICAO','SONIFEROS','METRONOMO','tentarGolpeEspecial','sorteiaGolpeEspecial','tipoDoGolpe','passosHtml','CHANCE_AUTODESTRUICAO','CHANCE_SONO','DISABLE','CHANCE_DISABLE','tiposDeAtaque','bestAttackType','avisoDoConfronto','sequenciaDoConfronto','pausaDoEspecial','fraseDoEspecial','calcMaxHp','makeSeededRng','simulateGymBattle','createInstance',
    'TYPE_CHART','TYPE_NAMES_PT','TYPE_COLORS','englishTypeFromPortuguese','TERRAINS','TERRAIN_BUFF_MULT','SHINY_BUFF_MULT','applyTerrainBuff','applySpecialtyBuff','withBuffs',
    'effectiveBaseHp','effectiveAttack','effectiveDefense','effectiveSpAtk','effectiveSpDef','effectiveSpeed','gen1MaxHp',
    // lista de amigos: as telas sao HTML puro a partir do estado, entao dao pra renderizar aqui e
    // conferir que nenhum caminho quebra ou deixa escapar nome sem escape (ver test-amigos.js)
    'renderFriendsScreen','renderFriendCompareModal','vistoPorUltimo','friendRivalryHtml',
    'renderSaveSelect','renderSundayBoss','renderWild','nomeDoGolpe','passosHtml','openSundayBoss','especieParaTela','renderTrainerBattling',
    // mapa de Kanto: o SVG sai de uma função pura (estado -> markup), entao da pra renderizar
    // aqui e conferir a geografia num screenshot em vez de no olho
    'kantoMapSvg','kantoTrailHtml','renderKantoIntro','renderKantoMapScreen',
    'KANTO_PLACES','KANTO_JOURNEY','KANTO_GYM_CITIES','MAP_PLACES','JOHTO_PLACES','JOHTO_GYM_CITIES','jornadaDoTreinador','cidadeDaEtapa','etapaEscolhida','JOHTO_OFFSET_Y','kantoCurva','renderWalkNext','renderWalk',
    'comecarJornadaDoMapa','abrirMapaDeKanto','fecharMapaDeKanto',
    // bifurcação Kanto/Johto (ver renderGymChoice)
    'escolherGinasio','gymOf','gymAtual','regiaoDaEtapa','opcoesDeGinasio','todosOsGinasios',
    'KANTO_GYMS','JOHTO_GYMS','JOHTO_ROUTE_MAP','renderGymChoice','numGinasios','GYM_BADGE_VISUALS','routesForLeg','ROUTE_MAP','RIVAL_STARTER_COUNTER','STARTER_EVOLUTIONS','renderStart','STARTERS','ehDeDia','eeveeDoHorario','renderEeveeChoice','EVOLUTION_CHOICES','raizDaLinha','linhasDoTime','buildOfferFromPool','escolherEvolucao','evolucoesPendentes','renderEvoChoice','resolverEvolucoes','TYPE_NAMES_PT','TYPE_COLORS','englishTypeFromPortuguese','ELITE_FOUR','JOHTO_ELITE','eliteOpponentForStage','sortearCaminhoDaElite','eliteMembroDaEtapa','startEliteChallenge','openEliteIntro','renderEliteIntro',
    'continueJourney','showJourneyEnd',
    // resgate da Rocket com o time cheio (ver test-jornada.js)
    'finishSpecialBattle','continueAfterSpecial','confirmRelease','renderRelease','proceedToGymApproach',
    // busca online dentro da jornada e aviso da liga (ver test-jornada.js)
    'botaoBuscaOnlineHtml','avisoLigaHtml','startOnlineSearchAqui','entrarNaFilaOnline','timeElegiveisOnline','renderPreBattle','renderBattleResult','renderPokedex','renderBattling',
    // conquistas (ver test-conquistas.js)
    'ACHIEVEMENTS','getAchievementAggregate','getAllCaughtSpecies',
    // inscricao na Liga (ver test-liga-inscricao.js)
    'registerForLeague','cancelLeagueRegistration','renderLeagueTeamPicker','atualizarAvisoDaLiga','isAccountActiveInLeague','STAR_SVG','checkLeagueRegistrationStatus','useRareCandyOn','loadSaveSlots','refreshLeagueView','ensureRegisteringCycle','isAccountActiveInLeague','registrantDocRef','scheduleDocRef','encodeTeamCode','decodeTeamCode',
    // caixa de entrada (ver test-notificacoes.js)
    'renderNotificationsScreen','ctaDaNotificacao','abrirNotificacao','notificationIcon',
    'entrarNoModoSelecao','sairDoModoSelecao','alternarSelecaoNotificacao','marcarTodasNotificacoes','pedirApagarSelecionadas','cancelarApagarSelecionadas','confirmarApagarSelecionadas','renderDeleteNotificationsBulkModal','notificationPendingReward',
    // conta: rival padrao e recuperacao de senha (ver test-conta.js)
    'nomeDoRivalPadrao','gravarRivalPadrao','RIVAL_NAME_DEFAULT','renderNewSaveName','renderAuth','switchAuthMode','sendPasswordReset','confirmNewSaveName',
    'runSpecialBattle','advanceSpecialReveal','continueAfterSpecial','continueAfterWildDisguiseReveal'
  ];
  const epilogue = '\n;globalThis.render = function(){};\n' +
    EXPORTS.map(n=>`try{ globalThis[${JSON.stringify(n)}] = ${n}; }catch(e){}`).join('\n') +
    '\nglobalThis.__setGame = function(g){ game = g; };' +
    '\nglobalThis.__getGame = function(){ return game; };';
  vm.runInContext(code + epilogue, sandbox, { filename:'jornada-kanto.js' });
  sandbox.render = function(){};
  return sandbox;
}

module.exports = { createSandbox, extractGameScript };
