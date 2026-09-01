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
/* E quem está DISPUTANDO um ciclo já sorteado também não pode ver o convite: a tela da Liga não
   deixa se inscrever no próximo enquanto o atual não acabar. */
estadoBase();
g.avisoLiga = null; S.__setGame(g);
S.isAccountActiveInLeague = () => Promise.resolve(true);
S.scheduleDocRef = () => ({ get: () => Promise.resolve({ exists:true,
  data: () => ({ cycles:[{ id:'c9', status:'registering', scheduledTime: Date.now()+600000 }] }) }) });
await S.atualizarAvisoDaLiga();
ok('quem ja esta na liga nao ve o convite', S.__getGame().avisoLiga === null);
S.isAccountActiveInLeague = () => Promise.resolve(false);
g.ultimaChecagemDaLiga = 0;   // a folga de 5min ja tinha sido gasta pela checagem acima
S.__setGame(g);
await S.atualizarAvisoDaLiga();
ok('e quem esta de fora ve', !!S.__getGame().avisoLiga, JSON.stringify(S.__getGame().avisoLiga));

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);

})();
