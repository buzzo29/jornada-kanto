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

/* ⚠️ UM CONTEXTO 2D DE MENTIRA, com os métodos que o desenho usa (20/09/2026). Ele existe pela
   MESMA razão do `classList` de verdade e do `getAttribute`: o dublê tem que fazer o que o de
   verdade faz. Sem ele, `cv.getContext('2d')` é um TypeError -- e o `abrirResgate`, que pinta o
   mapa uma vez ao abrir a tela, derrubava o teste inteiro na PRIMEIRA linha.
   ⚠️ E ELE ANOTA AS CHAMADAS (`__ops`), como o `__timers` e o `__recargas`: assim a trava pode
   afirmar "o mapa FOI desenhado" em vez de só não quebrar. */
function makeCtxStub(){
  const ops = [];
  /* ⚠️ E ELE ANOTA A TINTA, não só o nome da chamada: com `ops` sozinho a trava consegue dizer
     "algo foi desenhado" e nada mais -- ela não distingue uma bola pintada na cor do golpe de uma
     pintada em qualquer outra. `tintas` guarda o que estava no pincel na hora de cada verbo que
     PINTA, e é isso que deixa a trava AFIRMAR a cor. Os dois convivem porque `ops` é lido como
     lista de strings por quem já existe. */
  const tintas = [];
  const ctx = { __ops: ops, __tintas: tintas,
    fillStyle:'', strokeStyle:'', lineWidth:1, font:'', textAlign:'', globalAlpha:1,
    imageSmoothingEnabled:true };
  const PINTAM = ['fill','stroke','fillRect','fillText','strokeRect','strokeText','drawImage'];
  for(const m of ['arc','beginPath','closePath','drawImage','ellipse','fill','fillRect','fillText',
                  'lineTo','moveTo','restore','rotate','save','setLineDash','setTransform',
                  'stroke','strokeRect','strokeText','translate','clearRect','rect','quadraticCurveTo',
                  'bezierCurveTo','clip','arcTo','scale','transform']){
    ctx[m] = (...a) => {
      ops.push(m);
      if(PINTAM.indexOf(m) >= 0) tintas.push({ m: m, fill: ctx.fillStyle, stroke: ctx.strokeStyle,
                                               lineWidth: ctx.lineWidth, args: a });
    };
  }
  const grad = { addColorStop(){}, __gradiente:true };
  ctx.createLinearGradient = () => { ops.push('createLinearGradient'); return grad; };
  ctx.createRadialGradient = () => { ops.push('createRadialGradient'); return grad; };
  ctx.createPattern = () => null;
  ctx.measureText = () => ({ width: 10 });
  ctx.getImageData = (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(0, w * h * 4)), width: w, height: h });
  ctx.putImageData = () => { ops.push('putImageData'); };
  return ctx;
}
function makeElementStub(){
  const el = {
    /* o contexto é criado sob demanda e GUARDADO: `getContext` chamado duas vezes no mesmo
       elemento devolve o mesmo objeto, como no DOM -- senão a trava perderia as anotações. */
    getContext(){ if(!this.__ctx) this.__ctx = makeCtxStub(); return this.__ctx; },
    /* ⚠️ O classList É DE VERDADE (19/09/2026), e isso não é zelo: ele era três no-ops com um
       `contains` que sempre devolvia false, e `toggle` nem existia. O pintor da Pescaria faz
       `if(el.classList.contains('viva') !== viva) el.classList.toggle('viva', viva)` -- ou seja,
       ele NUNCA quebrava enquanto nenhuma zona acendia, e derrubava o teste com um TypeError no
       primeiro peixe que aparecesse. Um dublê que mente sobre o que já está na tela não consegue
       testar código que PERGUNTA o que já está na tela -- é a mesma lição do getAttribute
       (18/09) e do increment do fake-firestore. */
    style:{},
    classList:(function(){
      const set = new Set();
      return {
        add(c){ set.add(c); }, remove(c){ set.delete(c); },
        contains(c){ return set.has(c); },
        toggle(c, forca){
          const quer = forca === undefined ? !set.has(c) : !!forca;
          if(quer) set.add(c); else set.delete(c);
          return quer;
        },
        get length(){ return set.size; },
        toString(){ return Array.from(set).join(' '); },
      };
    })(),
    /* `hidden` e `disabled` são propriedades de verdade no DOM, e o pintor da Pescaria escreve
       nas duas -- é por elas que o painel do momento aparece e que o lago reabre. */
    hidden:false, disabled:false, dataset:{},
    textContent:'', innerHTML:'', value:'', className:'', offsetWidth:0,
    appendChild(){}, removeChild(){}, addEventListener(){}, remove(){},
    focus(){}, querySelector(){ return makeElementStub(); },
    getBoundingClientRect(){ return {top:0,left:0,width:0,height:0}; },
    /* ⚠️ OS ATRIBUTOS SÃO DE VERDADE (18/09/2026): o jogo guarda a CHAVE da frase de status num
       'data-frase' (ver o chaveDaFrase), e sem estes dois o pintarStatusDoConfronto derruba o
       teste com um TypeError que não tem nada a ver com o que estava sendo testado.
       É a mesma lição do 'fake-firestore': o dublê tem que fazer o que o de verdade faz. */
    _attrs: {},
    getAttribute(n){ return Object.prototype.hasOwnProperty.call(this._attrs, n) ? this._attrs[n] : null; },
    setAttribute(n, v){ this._attrs[n] = String(v); },
    removeAttribute(n){ delete this._attrs[n]; },
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
  const elementos = {};
  /* As GRAVACOES ficam anotadas, e nao jogadas fora. O reparo das evolucoes atrasadas escreve em
     saves que o jogador nem abriu -- o teste precisa poder cobrar QUAIS saves foram regravados, e
     principalmente quais NAO foram (o da bifurcacao, que ele nao pode resolver sozinho). */
  const escritas = [];
  const timers = [];   // ver o setTimeout abaixo: ele ANOTA o prazo, nao roda nada
  /* ⚠️ O requestAnimationFrame GUARDA O CALLBACK e nao roda nada, como o setTimeout -- mas aqui
     isso nao e so pra nao explodir: e o que deixa a suite DIRIGIR o laco quadro a quadro, com o
     `ts` que ela quiser. Sem ele, a unica forma de medir um laco era ler o codigo dele.
     E medir POR CODIGO tem limite: a guarda do relogio real da Pescaria (20/09/2026) so se prova
     saltando o tempo -- "a aba ficou 20 s oculta; ao voltar, o relogio andou 20 s". E a mesma
     razao do onSnapshot que guarda os callbacks (test-boss-tela) e do contexto 2d.
     Use `S.__quadro(ts)` pra disparar o proximo quadro. */
  const rafs = [];
  const qsCache = {};   // ver o querySelector abaixo
  const recargas = [];  // location.reload() anotado, ver o aviso de versao nova
  const rolagens = [];  // window.scrollTo anotado, ver o scrollTo abaixo
  const firestoreStub = (caminho) => ({
    collection(nome){ return firestoreStub(nome); },
    doc(id){ return firestoreStub(id); },
    get(){ return Promise.resolve({ exists:false, data(){ return {}; } }); },
    set(dados, opcoes){ escritas.push({ caminho, dados, opcoes }); return Promise.resolve(); },
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
    /* ANOTA, MAS NAO RODA. As animacoes nao existem fora do navegador e as suites dirigem os
       lacos chamando advanceX() na mao -- rodar os timers aqui quebraria isso. O que ele passou a
       guardar e o PRAZO de cada um (`__timers`), pra um teste poder cobrar "essa cena dura 5s"
       sem precisar de relogio. */
    setTimeout:(fn, ms)=>{ timers.push({ ms: ms || 0, fn: fn }); return timers.length; },
    clearTimeout: noop, setInterval:()=>0, clearInterval: noop,
    requestAnimationFrame:(fn)=>{ rafs.push(fn); return rafs.length; },
    cancelAnimationFrame: noop,
    /* ANOTADO, NAO EXECUTADO -- a mesma razao do location.reload() logo abaixo. Quem o chama
       e a largada dos minigames (a pagina vai pro topo) e o reporRolagens; sem ele, qualquer
       teste que dirija uma largada de verdade morre com um TypeError que nao tem nada a ver
       com o que estava sendo testado. E a licao do fake-firestore de novo: o duble tem que
       fazer o que o de verdade faz -- e aqui fazer e existir sem rolar nada. */
    scrollTo:(x, y)=>{ rolagens.push({ x: x || 0, y: y || 0 }); },
    btoa:(str)=>Buffer.from(str,'binary').toString('base64'),
    atob:(str)=>Buffer.from(str,'base64').toString('binary'),
    document:{
      /* ⚠️ O MESMO id DEVOLVE O MESMO ELEMENTO, como no DOM de verdade. Devolvia um stub NOVO a
         cada chamada, e com isso qualquer codigo que PERGUNTE o que ja esta na tela ficava
         invisivel pro teste -- foi o caso da guarda que impede a frase da passiva de reentrar
         (12/09/2026): ela compara o texto novo com o que o elemento ja mostra, e contra um stub
         zerado a comparacao nunca dava igual. */
      getElementById(id){ if(!elementos[id]) elementos[id] = makeElementStub(); return elementos[id]; },
      /* ⚠️ O MESMO SELETOR DEVOLVE O MESMO ELEMENTO, pela razão do getElementById (12/09/2026):
         devolvendo um stub NOVO a cada chamada, qualquer código que ESCREVA num elemento achado
         por seletor escrevia num descartável -- e a trava, que chama de novo, recebia outro. O
         mapa da Pescaria (20/09) caiu exatamente nisso. */
      querySelector(sel){ if(!qsCache[sel]) qsCache[sel] = makeElementStub(); return qsCache[sel]; },
      querySelectorAll(){ return []; },
      createElement(){ return makeElementStub(); },
      addEventListener: noop,
      body: makeElementStub()
    },
    navigator:{ clipboard:{ writeText(){ return Promise.resolve(); } } },
    __elementos: elementos,
    /* A home pergunta se o jogo esta rodando como atalho-app (isRunningAsInstalledApp) pra decidir
       o botao de instalar. Sem este stub, renderSaveSelect derruba qualquer teste que desenhe a
       home com um TypeError que nao tem nada a ver com o que estava sendo testado. */
    matchMedia: () => ({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }),
    // o jogo compara o hash da própria página a cada 5min pra avisar que saiu deploy novo
    // (__captureInitialVersion). Fora do navegador isso não tem sentido, mas sem estes quatro
    // stubs ele lança e o console.error do catch suja a saída de toda simulação. Com eles a
    // checagem roda até o fim, em silêncio, sobre uma página vazia.
    /* O reload e ANOTADO, nao executado: e ele que o botao de "versao nova" chama, e um teste
       precisa cobrar que o botao recarrega sem que o processo do teste se recarregue. */
    location:{ pathname:'/', href:'http://localhost/', reload(){ recargas.push(Date.now()); } },
    fetch:()=>Promise.resolve({ text:()=>Promise.resolve('') }),
    TextEncoder, crypto,
    /* O FieldValue e de mentira mas TEM FORMA: o jogo grava listas com arrayUnion (a Pokedex, os
       HMs, os aposentados), e sem ele qualquer caminho que escreva uma lista derruba o teste com
       um TypeError sem relacao com o que estava sendo testado. Ele devolve um objeto RECONHECIVEL,
       pra o teste poder afirmar "isto foi um arrayUnion destes valores" em vez de so nao quebrar.
       E a mesma licao do fake-firestore: o duble tem que fazer o que o de verdade faz. */
    /* ⚠️ O AUTH DO DUBLE ANOTA O QUE FOI CHAMADO (`__auth`), como o `__timers` e o `__ops`. Sem
       isso a trava do CONVIDADO (23/09/2026) so conseguiria dizer "nao quebrou" -- e o defeito que
       ela existe pra pegar e justamente um que NAO quebra: trocar `linkWithPopup` por
       `signInWithPopup` cria uma conta NOVA e abandona o convidado com os saves dentro, sem erro
       nenhum na tela. Anotado, ela AFIRMA qual verbo foi usado.
       E a mesma licao do fake-firestore e do `classList` de verdade: o duble tem que fazer -- e
       registrar -- o que o de verdade faz. */
    firebase:{ initializeApp(){}, auth: Object.assign(function(){ return {}; }, {
        GoogleAuthProvider: function(){ this.__provedor = 'google'; },
        EmailAuthProvider: { credential: (email, senha) => ({ __cred:'email', email, senha }) },
      }),
      firestore: Object.assign(function(){ return firestoreStub(); }, {
        FieldValue: {
          arrayUnion: (...v) => ({ __op:'arrayUnion', valores: v }),
          delete: () => ({ __op:'delete' }),
          increment: (n) => ({ __op:'increment', n }),
          serverTimestamp: () => ({ __op:'serverTimestamp' }),
        },
      }) },
    auth:{
      onAuthStateChanged(){}, signOut(){ return Promise.resolve(); },
      /* o teste troca o `currentUser` e o `__auth.erro` pra montar cada caso */
      currentUser: null,
      signInAnonymously(){
        sandbox.__auth.chamadas.push('signInAnonymously');
        return sandbox.__auth.erro ? Promise.reject(sandbox.__auth.erro) : Promise.resolve({});
      },
      signInWithPopup(){ sandbox.__auth.chamadas.push('signInWithPopup'); return Promise.resolve({}); },
    },
    __auth: { chamadas: [], erro: null },
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
    'CONVIDADO_MODOS','ehAnonimoDesligado','exigeCadastro','entrarSemConta','abrirCriarLogin','vincularComGoogle','vincularComEmail','concluirCadastro','linkErrorMessage','trocarModoDoLink','fecharAvisoDeConvidado','renderConvidadoModal','renderCriarLoginModal','CAMPOS_DA_CONTA','renderAuth',
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
    'goToWildEncounter','sementeDoEncontro','resortearEncontro','montaOfertaSelvagem','currentShinyChance','ehLendario','nivelDeLendario','LENDARIOS','LEGS',
    'especieNoNivel','rollWildLevel','EVOLVED_MIN_LEVEL','SEM_PISO_DE_NIVEL','nivelSelvagem','GOLPES','GOLPES_IDS','GOLPES_PT','APRENDIZADO','ataquesDisponiveis','ataquesEscolhiveis','ataquesPadrao','nomeDoAtaque','nivelDoAtaque','melhorAtaque','hydrateTeam','hydrateTeamMember','escolhasDeAtaquePendentes','resolverEscolhaDeAtaques','marcarAtaque','confirmarAtaques','aprendizadosPendentes','aprendizadoDoSavePendente','resolverAprendizados','useRareCandyOn','continueFromEvolution','SCREENS_DE_VOLTA','tryEvolve','APRENDIZADO','GOLPES_IDS','GOLPES_PT','resolverAprendizados','responderAprendizado','renderEscolhaDeAtaques','renderAprenderAtaque','renderGolpeAprendido','anunciarGolpesAprendidos','seguirDoGolpeAprendido','aprendizadosPendentes','aprendizadoDoSavePendente','resolverAprendizados','useRareCandyOn','continueFromEvolution','SCREENS_DE_VOLTA','tryEvolve','APRENDIZADO','GOLPES_IDS','GOLPES_PT','resolverAprendizados','responderAprendizado','ataquesDisponiveis','ataquesPadrao','melhorAtaque','golpesDoTimeHtml','golpesDaEvolucao','nivelDoAtaque','nomeDoAtaque','APRENDIZADO','GOLPES','GOLPES_IDS','GOLPES_PT','especiaisDaEspecie','cartaoDeGolpe','seloDoTipoDoGolpe','TYPE_COLORS','startLevelDistribution','continueFromEvolution','chooseStarter',
    // Boss de Domingo: a tela escuta o Firestore, e isso da pra exercitar aqui (ver __escutas)
    'ligarEscutaDoBoss','pararEscutaDoBoss','pararAcompanhamentoDoBoss','agendarPollDoBoss',
    'assinaturaDoBoss','renderSundayBoss','sairDoBoss','BOSS_POLL_MS',
    'sorteioDosIniciais','chaveDoSorteio','encerrarTentativaDoSlot','HARD_SHINY_CHANCE',
    // terreno, buffs e atributos: sem eles nao da pra medir o efeito de terreno/shiny,
    // que e justamente onde cliente e servidor ja divergiram
    // golpes especiais (ver test-especiais.js)
    'AUTODESTRUICAO','SONIFEROS','MULTI_GOLPE','GOLPES_DRENO','GOLPES_SO_DORMINDO','GOLPES_QUE_QUEIMAM','GOLPES_QUE_CONGELAM','GOLPES_QUE_ENVENENAM','GOLPES_QUE_PARALISAM','GOLPES_QUE_MUDAM_ESTAGIO','GOLPE_ROLAMENTO','METRONOMO','DANCA_ESPADAS','DANCA_PLUMA','CHANCE_DANCA','DANCA_ESPADAS_MULT','DANCA_PLUMA_MULT','withDanca','tentarDancas','fighterHtml','selosDoConfronto','selo','DESENHOS','PALETA_SELO','svgDosSelos','guardarRolagens','reporRolagens','chaveDaRolagem','zerarRolagemDaLista','render','pontoFinal','REVIDE_PISO_MIN','REVIDE_PISO_MAX','MORIBUNDO_ABAIXO_DE','MORIBUNDO_TETO_NO_CHEIO','CHEIO_TETO_MIN','CHEIO_TETO_MAX','CHEIO_DIF_MAXIMA','tentarDancas','trocaDoRemoinho','CONFUSAO','GOLPES_QUE_CONFUNDEM','golpeQueConfunde','CHANCE_CONFUSAO','FURIA_DRAGAO','CHUVA','CHANCE_CHUVA','CHUVA_EM_CONFRONTOS','CHUVA_MULT','CHUVA_GOLPE_MULT','estaChovendo','multDaChuva','tentarChuva','limparClima','CHANCE_FURIA_DRAGAO','FURIA_DRAGAO_DANO','sorteiaGolpeDoMetronomo','POOL_METRONOMO','FURIA','CHANCE_FURIA','FURIA_BONUS','withFuria','obsDoGolpe','registrarSketch','ehJornada','finishNeighborhoodGymBattle','aprendizadosPendentes','aprendizadoDoSavePendente','resolverAprendizados','useRareCandyOn','continueFromEvolution','SCREENS_DE_VOLTA','tryEvolve','APRENDIZADO','GOLPES_IDS','GOLPES_PT','usaSketch','renderMatchupLog','alternarLogDoConfronto','abertosDoLog','chuvaBadgeHtml','GOLPES_CRIT_ALTO','chanceDeCritico','CRIT_BASE','CRIT_ALTO','CRIT_MULT','corDoGolpe','TYPE_COLORS','MAX_GOLPES','equiparNpc','ataquesDisponiveis','tentarGolpeEspecial','tapasDoGolpe','poderEfetivo','passosHtml','DMG_CAP_PCT','TETO_GOLPES','GOLPES_DRENO','GOLPES_SO_DORMINDO','melhorAtaque','METRONOMO','tentarGolpeEspecial','sorteiaGolpeEspecial','tipoDoGolpe','passosHtml','CHANCE_AUTODESTRUICAO','CHANCE_SONO','GOLPES_QUE_CONGELAM','GOLPES_QUE_QUEIMAM','GOLPES_QUE_ENVENENAM','VENENO_DANO','podeEnvenenar','tentarEnvenenar','GOLPES_QUE_PARALISAM','GOLPES_QUE_MUDAM_ESTAGIO','multDoEstagio','TMS','GOLPE_FACHADA','FACHADA_MULT','comStatus','multDaFachada','CHANCE_PODER_SECRETO','GOLPE_PODER_SECRETO','EFEITO_DO_TERRENO','terrenoDe','tentarPoderSecreto','applyTerrainBuff','TERRAINS','terrainColor','melhorAtaque','calcDamage','poderEfetivo','estagioDe','moverEstagio','withEstagio','limparEstagios','tentarEstagio','effectiveDefense','effectiveSpDef','NOME_DO_ATRIBUTO','fraseDoEspecial','ESTAGIO_MIN','ESTAGIO_MAX','PARALISIA_VELOCIDADE','CHANCE_PARALISIA_TRAVA','podeParalisar','tentarParalisar','withParalisia','golpeAfetaOAlvo','effectiveSpeed','typeVsType','QUEIMADURA_DANO','QUEIMADURA_FISICO','podeQueimar','tentarQueimar','withQueimadura','ICONES_ESPECIAIS','passosHtml','CHANCE_DESCONGELAR','podeCongelar','tentarCongelar','SONO_EM_TROCAS','sorteiaTrocasDeSono','DISABLE','CHANCE_RECUPERAR','RECUPERACAO','ABSORCAO','MOEDAS_RESSORTEIO','MAX_RESSORTEIOS_POR_SAVE','ressorteiosRestantes','precoDoRessorteio','bonusShinyAtivo','MOEDA_MODO_DIFICIL','HARD_SHINY_CHANCE','SHINY_CHANCE','currentShinyChance','pickGameMode','renderNewSaveMode','renderNewSaveName','CHANCE_ABSORVER','ABSORVER_MIN','ABSORVER_MAX','CURA_MAXIMO_DO_HP','CHANCE_DISABLE','tiposDeAtaque','ehDittoTransformado','tiposProprios','bestAttackType','avisoDoConfronto','SPECIALTY_BUFF','buildAnimatedHitSequence','pausaDoNomeDoGolpe','hpBarTransitionMs','ORCAMENTO_ANIM_ONLINE_MS','statusDoConfronto','statusDoConfrontoHtml','chaveDaFrase','document','fraseDoGolpeUsado','pintarStatusDoConfronto','pausaDaCura','avisoDaCura','towerEligiblePokemon','gymChallengeTogglePick','montadorDeTimeHtml','renderTrainerTower','ITENS','HMS','hmsDaConta','temHM','darHM','conquistouHM01','HM01_ROTA','HM01_GINASIO','MOSTRAR_TM_HM','abrirTmHm','sairDoTmHm','renderTmHm','CORTADORES','VOADORES','conquistouHM02','hmDaVitoria','HM02_GINASIO_IDX','tiposDoPokemon','GOLPE_DO_CORTE','podeAprenderHM','TMS','ehTM','maquinaPorId','podeAprenderMaquina','quantosTMs','temMaquina','maquinasDaConta','precoDoTM','abrirAptosDaMaquina','fecharAptosDaMaquina','meusQueAprendem','renderAptosModal','itensDaPrateleira','prateleiraDoItem','ITENS','GOLPES','nomeDoAtaque','cartaoDeGolpe','TYPE_NAMES_PT','TM_PISO','TM_POR_PODER','sabeCortar','timeQueCorta','ehOSlotAberto','timeDoSlot','candidatosDaMaquina','nomeDoSave','abrirEnsinarHm','sairDoEnsinarHm','voltarDaTrocaDaMaquina','escolherAlvoDaMaquina','ensinarOGolpeDaMaquina','renderHmAlvo','renderHmTroca','timesDaMaquina','abrirTimeDaMaquina','voltarAosTimesDaMaquina','telaDosTimesDaMaquina','telaDoTimeDaMaquina','ehGolpeDeMaquina','ataquesTrocaveis','responderAprendizado','renderAprenderAtaque','kantoMapSvg','renderKantoMapScreen','tryEvolve','ataquesEscolhiveis','cortadorDoTime','ROTA_DO_CORTE','CHANCE_ROTA_DO_CORTE','ROTA_DO_CORTE_A_PARTIR_DE','temRotaDoCorte','mataSaiNoTrecho','legDaMataFechada','cartasDeRota','chooseRoute','renderRouteCardsBlock','routesForLeg','routeById','montarAVigilia','entrarNaMataFechada','renderMataFechada','moverNaFila','GOLPE_ROLAMENTO','ROLAMENTO_USOS','escalaDoRolamento','atualizarRolamento','SINO_CURATIVO','CHANCE_SINO','definirClima','climaRestante','pontuada','passosDaAbertura','calcDamage','ataquesPadrao','comecarAVigilia','escolherOPremioDaVigilia','renderVigiliaPremio','VIGILIA_TAMANHO','VIGILIA_SHINIES','VIGILIA_ABAIXO','VIGILIA_ESPALHA','ESPECIES_INTOCAVEIS','avgTeamLevel','MONTANHA','MONTANHA_A_PARTIR_DE','CHANCE_MONTANHA','montanhaSaiNoTrecho','voadorDoTime','podeVoar','GOLPE_DO_VOO','NINHOS','MONTANHA_LENDARIOS','MONTANHA_NIVEL_LENDARIO','MONTANHA_GUARDIOES','missoesDaMontanha','ninhosDaConta','gravarNinhosDaConta','ninhoAceso','ninhosAcesos','acenderNinho','reiniciarMissoesDaMontanha','visitarOsNinhos','missoesComecaram','saveMostraVisita','MONTANHA_LENDARIOS','NINHOS','renderNinhoModal','acenderNinho','ninhoAceso','CAMPOS_DA_CONTA','snapshotDaConta','restauraDadosDaConta','continueAfterSpecial','cumpriuMoltres','passoDoZapdos','sequenciaDeGelo','cumpriuArticuno','conferirNinhos','voadoresDaGuarda','montarOsGuardioes','entrarNaMontanha','renderMontanha','enfrentarOsGuardioes','descerDaMontanha','abrirNinho','fecharNinho','renderNinhoModal','renderNinhos','escolherOGuardiao','enfrentarOsLendarios','escolherOLendario','entregarDaMontanha','renderMontanhaLendarios','ninhosAcesosHtml','gymAtual','formaNoNivel','LENDARIOS','startSpecialBattle','runSpecialBattle','finishSpecialBattle','continueAfterSpecial','advanceSpecialReveal','SAFE_SAVE_SCREENS','raizDaLinha','ehLendario','especieNoNivel','LEGS','serializeGame','applySavedState','hmGanhoHtml','openInventario','sairDaMochila','ctaDaNotificacao','irParaALiga','botaoDaLigaHtml','openLeague','openTrainersLeague','leagueTypeDocRef','TRAINERS_LEAGUE_TYPE','CLASSIC_LEAGUE_TYPE','pedirExclusaoDeItem','pilhasDoInventario','pilhasDaPrateleira','prateleirasDaMochila','escolherPrateleiraDaMochila','LOJA_PRATELEIRAS','openInventario','renderInventario','cuponsDeBonusShiny','slotsDaGrade','renderInventario','botaoDeItemHtml','renderTeamOrder','renderTowerOrderModal','abrirEscolhaDeItem','fecharEscolhaDeItem','renderEscolhaDeItemModal','renderLoja','LOJA_PRATELEIRAS','itensDaPrateleira','prateleiraDoItem','escolherPrateleira','quantoTenho','quantoPossoVender','precoDeVenda','abrirVenda','venderItem','tetoDoPopup','VENDA_FRACAO','maximoQueCabe','abrirCompra','fecharCompra','mudarQtdCompra','qtdCompraMax','renderCompraModal','comprarItem','escolherItem','escolherItemDaLoja','openLoja','GOLPES_IDS','GOLPES_PT','SPECIES','abrirEnsinarHm','ehGolpeDeMaquina','obsDoGolpe','createInstance','calcMaxHp','makeSeededRng','escolherItemDaLoja','openLoja','podeExcluir','motivoDeNaoExcluir','openCandyPicker','renderCandyPickerModal','renderSaveSelect','startNewSave','continueSave','continueCompleteSave','exigeNomeDeTreinador','confirmAccountSetup','renderAccountSetup','savesCampeoes','savesComOitoInsignias','saveAposentado','exigeTimeCampeao','podeAposentar','pedirAposentadoria','fecharAposentadoria','aposentarOTime','aposentados','paraOArquivo','abrirAposentados','renderAposentados','enderecoDoChaveamento','botaoDaLigaHtml','viewLeagueHistory','mostrarAvisoDeVersao','renderAposentadoriaModal','renderJourneyEnd','renderNeighborhoodGym','AVISO_SEM_CAMPEAO','openLeagueTypesList','openNeighborhoodGymScreen','openOnlineBattle','openSaveSelect','MAX_SAVE_SLOTS','gradeDeItensHtml','INVENTARIO_SLOTS_MINIMOS','montadorIrPara','montadorPaginaValida','MONT_POR_PAGINA','montadorOrdenar','montadorFiltrarTipo','montadorOrdenados','montadorTiposDisponiveis','abrirMontador','MONT_ORDENS','towerTogglePick','gymDefenseTogglePick','renderNeighborhoodGymTeamPicker','alternarEscolhaDeTime','chaveDoPokemon','esperaDosPokemon','renderNeighborhoodGymChallengeTeamPicker','startNeighborhoodGymChallenge','golpeSeloHtml','especiaisDaEspecie','TIPO_DO_ESPECIAL','EXPLICACAO_DO_ESPECIAL','textoDoEspecial','abrirEspecialInfo','fecharEspecialInfo','renderEspecialInfoModal','seloDeGolpe','openOnlineBattle','carregarHistoricoOnline','renderOnlineBattle','renderPokedexFicha','golpesDoItem','tiposDeAtaqueDaEspecie','listaEmPortugues','itemServeNoPokemon','nomeDoGolpe','abrirPokedexFicha','SPECIES_FORA_DA_DEX','PRAZO_HISTORICO_MS','sequenciaDoConfronto','pausaDoEspecial','pausaDaFaixa','PAUSA_LEITURA_ESPECIAL_MS','fraseDoEspecial','calcMaxHp','makeSeededRng','simulateGymBattle','createInstance','speedDaCorrida','velocidadeNormal','resultadoDoImpulso','CORRIDA_EFEITOS','CORRIDA_FAIXA','CORRIDA_TRAVESSIA','CORRIDA_NPC','CORRIDA_METROS','CORRIDA_TRECHOS','CORRIDA_PARTICIPANTES','CORRIDA_NPC_NOMES','corridaNomeDoNpc','corridaEtiquetaDe','corridaRotuloDaEscolha','corridaTotal','corrida','corridaZerar','corridaInstancia','finaisDaCorrida','nivelDoNpc','sortearNpcs','corridaVelocidade','aplicarEfeito','corridaAvancar','planejarNpc','corridaFisica','corridaRanking','corridaPosicao','corridaTravessia','corridaPosBarra','corridaImpulso','corridaQuantos','corridaElegiveis','corridaToggle','corridaMover','corridaCompleto','corridaTrocarFormato','corridaNovoCorredor','corridaLargar','corridaTerminar','corridaReiniciar','abrirCorrida','sairDaCorrida','renderCorrida','corridaPickerHtml','nomeDoCorredor','pmdPasta','pmdQuadro','CORRIDA_CORES','corridaTeclaNoBotao','centroDasFaixas','periodoDasFaixas','periodoDasFaixasAgora','corridaAvancarFaixas','fatorDaSequencia','CORRIDA_SEQUENCIA_PASSO','CORRIDA_SEQUENCIA_MIN','corridaChipDosPerfeitos','CORRIDA_FAIXA_AMPLITUDE','CORRIDA_FAIXA_RAZAO_MIN','CORRIDA_FAIXA_RAZAO_MAX','CORRIDA_DESLEIXO','CORRIDA_DESLEIXO_TRAVESSIAS','CORRIDA_DESLEIXO_MIN','corridaContarTravessia','corridaFisicaPasso','corridaEscala','CORRIDA_PX_POR_M','CORRIDA_Y_EU','CORRIDA_Y_CHEGADA','corridaRetaFinal','corridaCamera','corridaYdaMetragem','CORRIDA_NPC_VIZINHOS','npcParaOSpeed','RANK_VALIDADE_MS','rankVencido','rankInvalidar','pescariaRank','pescariaCarregarRank','pescariaEnviarRank','pescariaRankHtml','MEDALHA_DO_POSTO','equiparItens','pescaria','pescariaZerar','pescariaVivos','pescariaTimeDoSlot','pescariaMapaHtml','pescariaCardDoTime','pescariaTimeSprites','PESCARIA_TIME','PESCARIA_NPC_NOME','PESCARIA_PONTOS','PESCARIA_ILHA_SVG','placarDoTreinador','abrirPescaria','sairDaPescaria','pescariaElegiveis','pescariaAbrirPicker','pescariaFecharPicker','pescariaIrParaPagina','pescariaEscolher','pescariaPoolDoNpc','pescariaSortearNpc','pescariaInstancia','pescariaBatalhar','pescariaComecarBatalha','pescariaPassoDaBatalha','pescariaPremio','pescariaSurgir','pescariaEntrar','pescariaFisgar','pescariaSegurar','pescariaPerder','pescariaComportamento','pescariaAtualizar','pescariaLargar','pescariaTerminar','pescariaReiniciar','pescariaNovoPescador','renderPescaria','pescariaPickerHtml','pescariaPintar','PESCARIA_ZONAS','PESCARIA_DURACAO','PESCARIA_NPC_NIVEL','PESCARIA_NPC_BST_MIN','PESCARIA_TENSAO_MAX','PESCARIA_COMPORTAMENTO','pescariaNpcPuxa','pescariaPainelDoEstado','PESCARIA_PAINEIS','PESCARIA_BOIA','pescariaBatalhaHtml','pescariaPintar','pescariaAtualizar','pescariaPuxarLinha','pescariaDisputado','pescariaRitmoDoGolpe','PESCARIA_PASSO_MAX','PESCARIA_PASSOS_MAX','PESCARIA_SOBRA','chancesDaZona','bstOf','pescariaPintar','pescariaMoverBarra','pescariaPintarArea','pescariaPlacarHtml','pescariaLinhaDoFim','pescariaQuemEsta','pescariaMeuNome','pescariaResumoHtml','pokebolasHtml','PESCARIA_HIST_NA_TELA','pescariaAtividade','pescariaChipDoPeixe','pescariaFaixaDaTensao','pescariaChipDoDuelo','pescariaTextoDoParado','pescariaTamanho','pescariaRelogio','abrirZonaDaPescaria','fecharZonaDaPescaria','chancesDaZona','renderPescariaZonaModal','getAllCaughtSpecies','PESCARIA_PROGRESSO_PERFEITO','PESCARIA_PROGRESSO_NORMAL','PESCARIA_TENSAO_INICIAL','PESCARIA_JANELA_FISGADA','PESCARIA_FISGADA_PERFEITA','PESCARIA_TENSAO_AVISO','PESCARIA_TENSAO_PERIGO','PESCARIA_PUXAR_TXT','PESCARIA_SOBRA','PESCARIA_ABERTURA_MS','PESCARIA_ENTRE_GOLPES_MS','PESCARIA_DEPOIS_DO_ULTIMO_MS','PESCARIA_ENTRE_CONFRONTOS_MS','pescariaAbrirConfronto','PESCARIA_SEM_GOLPES_MS','matchupResultLine','suddenDeathNote','hpBarClass','preloadBattleSprites','MONT_POR_PAGINA','renderSaveSelect','DESENHOS','svgDosSelos','bstOf','SPECIES','serializeGame','montadorPaginaValida','pmdCache','corridaPintar','corridaDesenharPokemon','PMD_LINHA_COSTAS','sortearNpcs','finaisDaCorrida','nivelDoNpc','CORRIDA_H','CORRIDA_W','corridaIrParaPagina','MONT_POR_PAGINA','montadorPaginaValida','CORRIDA_METROS_TRECHO','corridaMetros','corridaMetrosDo','corridaTotalDo','corridaRank','corridaCarregarRank','corridaEnviarRank','corridaRankHtml','corridaTempoTxt','resgate','RESGATE_W','RESGATE_H','RESGATE_PRAIA','RESGATE_PONTOS','RESGATE_DURACAO','RESGATE_CAPACIDADE','RESGATE_NPC_NIVEL','RESGATE_TEMPO_NO_PONTO','RESGATE_CARGA_POR_PASSAGEIRO','RESGATE_CARGA_MIN','RESGATE_REDEMOINHO_MULT','RESGATE_CORRENTE_H','RESGATE_A_FAVOR','RESGATE_CONTRA','RESGATE_MAR_MIN','RESGATE_MAR_EXTRA','RESGATE_MAR_AVISO','RESGATE_RESGATADOS','RESGATE_VEL_BASE','RESGATE_VEL_FATOR','resgateVelocidade','resgateCarga','RESGATE_DESCARGA','resgateEntregar','resgateRotuloDaFaixa','abrirIlhotaDoResgate','fecharIlhotaDoResgate','renderResgateIlhotaModal','RESGATE_PTS_DIVISOR','resgatePontosDe','RESGATE_FAIXA_PTS','RESGATE_FAIXA_DO_PONTO','RESGATE_BOLO_DA_FAIXA','RESGATE_SPRITE_K','resgateLadoDoSprite','resgateEscalaDoSprite','resgateDesenharAtor','resgateDesenharMapa','resgatePontoHtml','resgateRank','resgateCarregarRank','resgateEnviarRank','resgateRankHtml','corridaFecharAnuncio','corridaAnuncioHtml','corridaTreinadorDe','corridaRanking','corridaPosicao','finishTrainerBattle','poderEfetivo','nomeDoAtaque','SELECAO_FAIXAS','selecaoRank','selecaoCarregarRank','selecaoEnviarResultado','selecaoRankHtml','selecaoPct','selecaoGolpesHtml','formaNoNivel','golpeSeloHtml','selecao','SELECAO_POOL','SELECAO_TIME','SELECAO_GOLPES_NO_CARD','QUEIMADA_MUNICAO','QUEIMADA_RECARGA','queimadaRecarga','queimadaFimHtml','queimadaEliminacao','queimadaTerminar','queimadaPintarHud','queimadaVencedor','QUEIMADA_KOS','SELECAO_NIVEL','SELECAO_ORDEM','SELECAO_PAUSA_NPC','selecaoZerar','selecaoSortearPool','selecaoVez','selecaoLivres','selecaoEscolhaDoLider','selecaoDescontar','selecaoPicaNpc','selecaoAgendarNpc','selecaoEscolher','selecaoFecharDraft','selecaoMover','selecaoLutar','abrirSelecao','sairDaSelecao','selecaoComecar','selecaoReiniciar','renderSelecao','renderSelecaoResultado','selecaoCardHtml','ehLendario','equiparNpc','COR_ILHAS','ILHAS_LARANJA','ILHAS_SVG','ILHA_DEFS','ILHAS_W','ILHAS_H','ilhaPino','ilhaPoligono','ilhaArte','PESCARIA_ILHA_SVG','abrirIlhas','sairDasIlhas','entrarNaIlha','ilhasMapaHtml','renderIlhas','ILHAS_COMO','abrirIlhaInfo','fecharIlhaInfo','renderIlhaInfoModal',
    'ROTA_DAS_ILHAS','ILHAS_TIME_MINIMO','CHANCE_ILHAS','ilhasSaemNoTrecho','surfistaDoTime','podeSurfar','GOLPE_DO_SURF','ROTAS_DE_CHAVE','chaveDaRota','ILHAS_CHANCES','ILHAS_PREMIO_NIVEIS','ilhasDaJornada','naJornadaDasIlhas','estadoDaIlha','tentativasDaIlha','ilhasComJogo','ilhasVencidas','ilhasFechouTudo','entrarNasIlhasDaJornada','ilhasTimeDaJornada','ilhasSurfistaDaVisita','registrarResultadoDaIlha','ilhaEmJogo','seguirDasIlhas','renderIlhasFim','ilhasChecklistHtml','cartasDeRota','routeById',
    /* o anuncio das novidades: as funcoes viram globais sozinhas (sao 'function'), mas a VERSAO e
       const -- e const NAO vira propriedade do global, a licao que o queimada ja custou */
    'NOVIDADES_VERSAO','conferirNovidades','marcarNovidadesLidas','fecharNovidades','novidadesIrParaAsIlhas','renderNovidadesModal','ESPECIES_INTOCAVEIS','bstOf','abrirResgate','sairDoResgate','resgateZerar','resgateElegiveis','resgateInstancia','resgateAbrirPicker','resgateFecharPicker','resgateIrParaPagina','resgateEscolher','resgateSortearNpc','resgateMarZerar','resgateMarPlano','resgateMarAtualizar','resgateAtor','resgateNovoOcupante','resgateSoltar','resgateIrPara','resgateChegou','resgateNpcPlano','resgateComando','resgateTocarPonto','resgateVoltarAPraia','resgateParar','resgateTocarMar','resgateAtualizar','resgateRetornoAutomatico','resgateTerminar','resgateComecar','resgatePintar','resgateCargaHtml','resgatePontoHtml','resgateDesenharMapa','resgateEtiqueta','resgateMapaHtml','resgatePickerHtml','renderResgate','resgateReiniciar','resgateResumoLado','resgateLinhaDoEscolhido','nomeDoTreinador','pmdCaixasDaLinha','pmdLinhaDoRumo','pmdCarregar','SURFISTAS','SEM_CAPTURA_SELVAGEM','spriteHtml','typesHtml','escJs','escapeHtmlSafe','applySpecialtyBuff',
    'corridaClasseDoTrecho','corridaTreinadorDe','corridaSpeedDoTime',
    'corridaPintarHud','corridaLinhaEscolhido','corridaPickerDeTimes','pmdChave','pmdDados',
    'corridaEscolherTime','MEDALHA_DO_POSTO',
    'corridaVerTimeDoRank','corridaFecharTimeDoRank','renderCorridaTimeModal','corridaRetratoDoTime',
    'pescariaTimeSprites',
    // o salvamento: o ciclo do _especialContra ja custou save de jogador (ver test-especiais.js)
    'limparParaFirestore','serializeGame','encerrarBatalha','placarDoTreinador','renderTowerRankingModal','openTowerRanking','abrirHistoricoDaTorre','paginarHistoricoDaTorre','abrirHojeDaTorre','closeTowerRanking','renderHpBar','renderTerrainInfoModal','abrirConfronto','formasDaRota','abrirPokemonsDaRota','fecharPokemonsDaRota','renderPokemonsDaRotaModal','faixaDeNivelSelvagem','spriteHtml','FORMAS_DO_UNOWN','sufixoDoUnown','sorteiaFormaDoUnown','spriteMarkupByDex','typesHtml','pokedexIcon','SEM_CAPTURA_SELVAGEM','SURFISTAS','conquistouHM03','formasDoHM03','conferirHM03','darHMComAviso','renderHmGanhoModal','fecharHmGanho','HM03_ROTA','HM03_LEG','markCaught','game','hydrateTeam',
    'REMOINHO','CHANCE_REMOINHO','tentarRemoinho',
    'TYPE_CHART','TYPE_NAMES_PT','TYPE_COLORS','englishTypeFromPortuguese','TERRAINS','TERRAIN_BUFF_MULT','SHINY_BUFF_MULT','applyTerrainBuff','applySpecialtyBuff','withBuffs',
    'equiparItens','itemEquipado','chaveDoEquipado','chavesDaLinha','itensGastosDaBatalha','CURA_DA_POCAO','POCAO_GATILHO_HP',
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
    'KANTO_GYMS','JOHTO_GYMS','JOHTO_ROUTE_MAP','renderGymChoice','numGinasios','GYM_BADGE_VISUALS','routesForLeg','ROUTE_MAP','RIVAL_STARTER_COUNTER','STARTER_EVOLUTIONS','renderStart','STARTERS','ehDeDia','eeveeDoHorario','renderEeveeChoice','EVOLUTION_CHOICES','EEVEE_EVOLUTIONS','cannotEvolveFurther','itemEquipado','chaveDoEquipado','raizDaLinha','linhasDoTime','buildOfferFromPool','escolherEvolucao','evolucoesPendentes','renderEvoChoice','resolverEvolucoes','TYPE_NAMES_PT','TYPE_COLORS','englishTypeFromPortuguese','ELITE_FOUR','JOHTO_ELITE','eliteOpponentForStage','sortearCaminhoDaElite','eliteMembroDaEtapa','startEliteChallenge','openEliteIntro','renderEliteIntro',
    'continueJourney','showJourneyEnd',
    // resgate da Rocket com o time cheio (ver test-jornada.js)
    'finishSpecialBattle','continueAfterSpecial','confirmRelease','renderRelease','ITENS_DE_BATALHA','proceedToGymApproach',
    // busca online dentro da jornada e aviso da liga (ver test-jornada.js)
    'botaoBuscaOnlineHtml','avisoLigaHtml','startOnlineSearchAqui','entrarNaFilaOnline','timeElegiveisOnline','renderPreBattle','renderBattleResult','renderPokedex','renderBattling',
    // conquistas (ver test-conquistas.js)
    'ACHIEVEMENTS','getAchievementAggregate','getAllCaughtSpecies',
    /* as moedas das conquistas: a tabela de niveis e os ajudantes que a tela usa */
    'NIVEL_DA_CONQUISTA','moedasDaConquista','conquistasGanhas','conquistasAResgatar',
    'moedasAResgatar','temConquistaAResgatar','resgatarConquistas','renderAchievements',
    'closeAchievements','CHANCE_HOOH_VIGILIA',
    // inscricao na Liga (ver test-liga-inscricao.js)
    'registerForLeague','cancelLeagueRegistration','renderLeagueTeamPicker','atualizarAvisoDaLiga','jaInscritoNoCicloAberto','STAR_SVG','checkLeagueRegistrationStatus','useRareCandyOn','loadSaveSlots','refreshLeagueView','ensureRegisteringCycle','preambuloDaInscricao','registrantDocRef','scheduleDocRef','encodeTeamCode','decodeTeamCode',
    // caixa de entrada (ver test-notificacoes.js)
    'renderNotificationsScreen','ctaDaNotificacao','irParaALiga','botaoDaLigaHtml','openLeague','openTrainersLeague','leagueTypeDocRef','TRAINERS_LEAGUE_TYPE','CLASSIC_LEAGUE_TYPE','abrirNotificacao','notificationIcon',
    'entrarNoModoSelecao','sairDoModoSelecao','alternarSelecaoNotificacao','marcarTodasNotificacoes','pedirApagarSelecionadas','cancelarApagarSelecionadas','confirmarApagarSelecionadas','renderDeleteNotificationsBulkModal','notificationPendingReward',
    // conta: rival padrao e recuperacao de senha (ver test-conta.js)
    'nomeDoRivalPadrao','gravarRivalPadrao','RIVAL_NAME_DEFAULT','renderNewSaveName','renderAuth','switchAuthMode','sendPasswordReset','confirmNewSaveName',
    'runSpecialBattle','advanceSpecialReveal','continueAfterSpecial','continueAfterWildDisguiseReveal',
    // emboscada da Jigglypuff da Rocket: a cena acontece na tela de BATALHA e so depois vira
    // resultado (ver test-jornada.js)
    /* OS LACOS DE REVELACAO. Eles precisam ser DIRIGIDOS por um teste ate o fim: um erro de
       tempo-de-execucao no meio (uma variavel usada antes de existir, por exemplo) mata a animacao
       e a tela fica parada pra sempre -- e nada no carregamento acusa. Foi o que aconteceu com o
       advanceLeagueWatch entre 09 e 13/09/2026 (ver test-especiais.js). */
    'advanceLeagueWatch','renderLeagueWatch','advanceTrainerReveal','startMewtwoBattle',
    // aviso de versao nova na home (ver test-inventario.js)
    'conferirVersaoNoAr','atualizarParaVersaoNova','CHECAGEM_DE_VERSAO_MS',
    'renderSpecialBattling','renderSpecialResult','triggerRocketSleepAmbush','fraseDoCantoDaRocket',
    'ROCKET_SLEEP_CHANCE','ROCKET_SLEEP_AVISO_MS','ROCKET_POOL','avgTeamLevel',
    /* QUEIMADA POKEMON (ver test-queimada.js). SO OS const PRECISAM ENTRAR AQUI: declaracao
       de FUNCAO no topo de um script ja vira propriedade do global sozinha, e const/let nao
       -- eles ficam no escopo lexical. Foi assim que queimadaVelocidade respondia enquanto o
       ESTADO vinha undefined, o que faria a suite medir o nada. */
    'queimada','queimadaLider','queimadaAtiva','queimadaLava','queimadaFadiga','SELO_DO_TIPO','PALETA_SELO','queimadaSpriteDoTipo','QUEIMADA_BOLA_LADO','QUEIMADA_BOLA_LADO_DEV','QUEIMADA_BOLA_LADO_ESP',
    'QUEIMADA_DURACAO','QUEIMADA_KOS','QUEIMADA_W','QUEIMADA_H',
    'QUEIMADA_V_BASE','QUEIMADA_V_FATOR',
    'QUEIMADA_FOLEGO_GASTO','QUEIMADA_FOLEGO_VOLTA','QUEIMADA_FOLEGO_DESCANSO','QUEIMADA_FOLEGO_PISO',
    'QUEIMADA_GUARDA_BASE','QUEIMADA_GUARDA_FATOR','QUEIMADA_GUARDA_MIN','QUEIMADA_GUARDA_MAX',
    'QUEIMADA_GUARDA_RECARGA','QUEIMADA_GOLPES_MIN','QUEIMADA_GOLPES_MAX','QUEIMADA_ESPECIAL_MULT',
    'QUEIMADA_TIRO_RECARGA','QUEIMADA_ESPECIAL_RECARGA','QUEIMADA_BOLA_V','QUEIMADA_BOLA_V_ESP',
    'QUEIMADA_BOLA_V_DEVOLVIDA','queimadaCorDaCauda','QUEIMADA_RECARGA_FREIO','queimadaAndar','queimadaDesenharAtor','queimadaFecharAnuncio','queimadaAnuncioHtml','queimadaDevolver','selecaoFileiraHtml','cardDeTimeHtml','pescariaCardDoTime','queimadaPintar','QUEIMADA_CAUDA_FUNDO','QUEIMADA_CONTORNO_BOLA','QUEIMADA_REFLEXO_MULT','QUEIMADA_REFLEXO_TETO',
    'QUEIMADA_REFLEXO_DESCONTO','QUEIMADA_ATORDOA','QUEIMADA_RAIO',
    'QUEIMADA_LAVA_A_CADA','QUEIMADA_LAVA_AVISO','QUEIMADA_SPRITE_K','QUEIMADA_NPC_VIZINHOS',
    /* A ARENA DA SEMANA (ver test-arena.js) -- os const dela, pela mesma razao acima */
    'arenaRank','ARENA_BST_MIN','ARENA_NIVEL_BASE','ARENA_NIVEL_PASSO'
  ];
  const epilogue = '\n;globalThis.render = function(){};\n' +
    EXPORTS.map(n=>`try{ globalThis[${JSON.stringify(n)}] = ${n}; }catch(e){}`).join('\n') +
    '\nglobalThis.__setGame = function(g){ game = g; };' +
    '\nglobalThis.__getGame = function(){ return game; };';
  vm.runInContext(code + epilogue, sandbox, { filename:'jornada-kanto.js' });
  sandbox.render = function(){};
  sandbox.__escritas = escritas;
  sandbox.__timers = timers;
  sandbox.__recargas = recargas;
  sandbox.__rolagens = rolagens;
  sandbox.__rafs = rafs;
  /* ⚠️ DISPARA UM QUADRO com o carimbo que a suite quiser -- é isso que permite SALTAR o tempo e
     medir o que um laço faz quando a aba volta de segundo plano. Ele consome a fila: o laço
     registra o próximo quadro dentro do callback, como o rAF de verdade. */
  sandbox.__quadro = function(ts){
    const fila = rafs.splice(0, rafs.length);
    fila.forEach(fn => fn(ts));
    return fila.length;
  };
  return sandbox;
}

module.exports = { createSandbox, extractGameScript };
