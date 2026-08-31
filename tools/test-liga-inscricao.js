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

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);

})();
