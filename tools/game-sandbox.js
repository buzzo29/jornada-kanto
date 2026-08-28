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
  const firestoreStub = () => ({
    collection(){ return firestoreStub(); },
    doc(){ return firestoreStub(); },
    get(){ return Promise.resolve({ exists:false, data(){ return {}; } }); },
    set(){ return Promise.resolve(); },
    onSnapshot(){ return noop; },
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
    db: firestoreStub()
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
    // terreno, buffs e atributos: sem eles nao da pra medir o efeito de terreno/shiny,
    // que e justamente onde cliente e servidor ja divergiram
    'TERRAINS','TERRAIN_BUFF_MULT','SHINY_BUFF_MULT','applyTerrainBuff','applySpecialtyBuff','withBuffs',
    'effectiveBaseHp','effectiveAttack','effectiveDefense','effectiveSpecial','effectiveSpeed','gen1MaxHp'
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
