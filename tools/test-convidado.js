/**
 * JOGAR SEM CRIAR CONTA -- o convidado (23/09/2026)
 *
 * O pedido: um jeito de jogar sem cadastro; os modos que envolvem outros treinadores (Ligas,
 * Ginasio da Cidade, Torre, Batalha Online, Ilhas Laranja e -- desde 23/09 -- Amigos) so dao pra VER; um botao
 * "Criar Login" ao lado do nick; e -- a parte que faz a feature existir -- *"apos ele se
 * cadastrar, mantem os times que ele montou nessa conta"*.
 *
 * ⚠️ O QUE ESTE ARQUIVO PROTEGE, EM UMA FRASE: que o convidado nao e uma trava de BOTAO.
 * Ele e uma sessao anonima do Firebase, com uid de verdade -- entao ele passa em
 * `request.auth != null`, que era a unica pergunta que as regras e as 81 callables faziam. Ligar
 * a sessao anonima sem as duas camadas abaixo daria a ele escrita na agenda da Liga e no
 * chaveamento.
 *
 * SAO TRES CAMADAS, e nenhuma substitui a outra:
 *   1. o CLIENTE recusa na porta            -- a UX pedida (o modal que diz o que o modo e)
 *   2. as REGRAS recusam a escrita          -- a Liga Classica e ESCRITA DE CLIENTE: nao ha
 *                                              callable pra guardar, a trava so pode estar la
 *   3. as CALLABLES recusam                 -- callable e chamavel direto do console
 *
 *   node tools/test-convidado.js
 */
const path = require('path');
const fs = require('fs');
const { createSandbox } = require('./game-sandbox');

const RAIZ = path.join(__dirname, '..');
const SRV   = fs.readFileSync(path.join(RAIZ, 'functions', 'index.js'), 'utf8');
const REGRAS= fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8');
const HTML  = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}

/* ============================================================================
   1) O SERVIDOR
   ============================================================================ */
console.log('\nA GUARDA DAS CALLABLES');
ok('existe um `exigeCadastro`', /function exigeCadastro\(request\)/.test(SRV));
/* ⚠️ ELA NAO PODE LER O BANCO. O `exigeAdmin` le (`users/{uid}`) porque o campo `admin` mora la;
   aqui o dado vem DENTRO do token, entao a guarda custa ZERO leitura -- e e isso que permite
   po-la em 39 callables sem pesar. Se alguem a trocar por uma leitura, 39 chamadas passam a
   custar uma leitura a mais cada. */
/* ⚠️ SAO DUAS FUNCOES: o `exigeCadastro` chama o `ehConvidado`, e sem as duas o `new Function`
   abaixo estoura com ReferenceError -- e o teste acusaria a guarda inteira por um erro DELE. */
const corpoGuarda = ((SRV.match(/function ehConvidado\(request\)\{[\s\S]*?\n\}/) || [''])[0]
  + '\n' + (SRV.match(/function exigeCadastro\(request\)\{[\s\S]*?\n\}/) || [''])[0]);
ok('  a fatia da guarda tem o que ler', corpoGuarda.length > 80, corpoGuarda.length + ' chars');
ok('  ela NAO le o banco (custo zero)', !/db\.|await /.test(corpoGuarda));
ok('  ela le o sign_in_provider do TOKEN', /sign_in_provider/.test(corpoGuarda));
ok('  e recusa exatamente `anonymous`', /=== 'anonymous'/.test(corpoGuarda));

/* O comportamento, rodando a guarda de verdade */
const HttpsErrorFake = function(code, msg){ this.code = code; this.message = msg; };
const exigeCadastro = new Function('HttpsError', corpoGuarda + '; return exigeCadastro;')(HttpsErrorFake);
function tenta(req){
  try{ return { uid: exigeCadastro(req) }; } catch(e){ return { erro: e.code }; }
}
const CAD  = { auth:{ uid:'u1', token:{ firebase:{ sign_in_provider:'password' } } } };
const GOO  = { auth:{ uid:'u2', token:{ firebase:{ sign_in_provider:'google.com' } } } };
const ANON = { auth:{ uid:'u3', token:{ firebase:{ sign_in_provider:'anonymous' } } } };
ok('cadastrado por e-mail passa',  tenta(CAD).uid === 'u1');
ok('cadastrado por Google passa',  tenta(GOO).uid === 'u2');
ok('CONVIDADO e recusado',         tenta(ANON).erro === 'permission-denied', tenta(ANON).erro);
ok('sem login e recusado',         tenta({}).erro === 'unauthenticated');
/* ⚠️ TOKEN SEM O CAMPO NAO PODE DERRUBAR A CALLABLE: um `request.auth` sem `token.firebase` faria
   a guarda estourar com TypeError, e o jogador veria "internal" numa chamada legitima. */
ok('token sem o campo nao estoura', tenta({ auth:{ uid:'u4', token:{} } }).uid === 'u4');
ok('auth sem token nenhum nao estoura', tenta({ auth:{ uid:'u5' } }).uid === 'u5');

/* ============================================================================
   A COBERTURA -- e a trava que pega a callable NOVA.

   ⚠️ NAO DA PRA FILTRAR POR NOME: `reportMewtwoBattleResult` tem "Battle" no nome e e o desafio
   do Mewtwo, que sai da POKEDEX -- jogo principal. Por isso as duas listas sao escritas, e o que
   a trava cobra e que a UNIAO delas seja TODAS as callables: uma que nasca sem classificacao cai
   fora das duas e fica barulhenta. E o molde do `prateleiraDoItem` ("todo comprável aparece em
   exatamente uma").
   ============================================================================ */
console.log('\nA COBERTURA (a callable nova tem que ser classificada)');
const PROTEGIDAS = ['acceptOnlineMatch','challengeFriend','challengeLobbyPlayer','challengeNeighborhoodGym',
'compareTrainers','fightTrainerTowerFloor','getFishingRanking','getFriendRequestCount','getMyBattleHistory',
'getMyFriends','getNeighborhoodGymChallengeCooldowns','getNeighborhoodGymChallengeHistory',
'getNeighborhoodGymDetail','getNeighborhoodGymLeaderboard','getOnlineBattle','getOnlineBattleReplay',
'getRaceRanking','getRescueRanking','getSelecaoRanking','getTrainerProfile','getTrainerTower',
'getTrainerTowerHistory','getTrainerTowerRanking','joinBattleLobby','joinBattleQueue','leaveBattleLobby',
'leaveBattleQueue','leaveNeighborhoodGymLeadership','listMyNeighborhoodGyms','pickOnlineBattlePokemon',
'pickOnlineBattleTeam','pollBattleQueue','registerIslandPlay','removeFriend','reorderNeighborhoodGymDefense',
'resolveNeighborhood','respondFriendChallenge','respondFriendRequest','searchTrainers','sendFriendRequest',
'sendSelecaoResult','setNeighborhoodGymDefense','setTrainerTowerOrder','startTrainerTowerRun',
'submitFishingScore','submitRaceTime','submitRescueScore'];
/* AS LIVRES, e o motivo de cada grupo:
   - JOGO PRINCIPAL (a jornada, a loja, a Pokedex, as moedas): e a conta DELE, e e o que o
     convidado veio jogar. Bloquear aqui seria bloquear o jogo.
   - AS TRES DE FORA DO MODO: a home e o apagar-save as chamam. Elas devolvem vazio pro convidado
     por construcao -- ele nunca lidera ginasio, porque o `setNeighborhoodGymDefense` esta preso.
   - ADMIN: ja tem o `exigeAdmin`, e admin nunca e convidado.
   - AMIGOS: PROTEGIDOS desde 23/09/2026, a pedido ("nao pode adicionar amigos enquanto nao cria
     conta"). Sobram aqui o `pollFriendChallenge` e o `cancelFriendChallenge`: o poll ja nao e
     agendado pro convidado e o cancel e limpeza -- bloquea-los so daria erro em console.
   - BOSS: nao esta nos cinco, e o evento esta desligado (`BOSS_ATIVO`). */
const LIVRES = ['activateBoughtShinyBonus','activateEliteShinyBonus','activateMewtwoLoan','activateShinyBonus',
'adminAddLeagueRegistration','adminLeagueQueue','adminListTrainers','adminRemoveLeagueRegistration','buyItem',
'cancelFriendChallenge','checkMewtwoLoanUnlock','checkNeighborhoodGymDefenseForSlot','claimAchievementCoins',
'claimEliteShinyBonus','claimJourneyCoins','consumeEquipped','deleteNotification','deleteNotifications',
'equipItem','fightSundayBoss','getMyActiveGymDefenses','getMyNotifications','getSundayBoss',
'markNotificationsRead','payHardMode','pollFriendChallenge','reportMewtwoBattleResult','rerollWildOffer',
'sellItem','syncTrainerSpecialties','unequipItem','usarTM','useRareCandy','vacateNeighborhoodGymForDeletedSave'];
const TODAS = [...SRV.matchAll(/^exports\.([a-zA-Z0-9_]+) = onCall/gm)].map(m => m[1]).sort();
ok('a varredura achou as callables', TODAS.length > 60, TODAS.length + ' callables');
const semClasse = TODAS.filter(n => !PROTEGIDAS.includes(n) && !LIVRES.includes(n));
ok('toda callable esta classificada', semClasse.length === 0,
   semClasse.length ? 'sem classificacao: ' + semClasse.join(', ') : TODAS.length + ' de ' + TODAS.length);
const sumiu = [...PROTEGIDAS, ...LIVRES].filter(n => !TODAS.includes(n));
ok('nenhuma das listas cita callable que nao existe', sumiu.length === 0, sumiu.join(', '));
ok('nenhuma esta nas DUAS listas', PROTEGIDAS.filter(n => LIVRES.includes(n)).length === 0);

function corpoDa(nome){
  const i = SRV.indexOf('exports.' + nome + ' = onCall');
  return i < 0 ? '' : SRV.slice(i, i + 260);
}
const semGuarda = PROTEGIDAS.filter(n => !/exigeCadastro\(request\)/.test(corpoDa(n)));
ok('as ' + PROTEGIDAS.length + ' protegidas chamam a guarda', semGuarda.length === 0, semGuarda.join(', '));
/* ⚠️ E AS TRES DE FORA NAO PODEM TER: a home chama `getMyActiveGymDefenses` em TODA abertura, e o
   apagar-save chama as outras duas. Com a guarda elas dariam erro no console pro convidado em
   toda visita -- e o que elas devolvem pra ele ja e vazio por construcao. */
const DE_FORA = ['getMyActiveGymDefenses','checkNeighborhoodGymDefenseForSlot','vacateNeighborhoodGymForDeletedSave'];
const travouDemais = DE_FORA.filter(n => /exigeCadastro\(request\)/.test(corpoDa(n)));
ok('as 3 chamadas pelo JOGO PRINCIPAL ficam livres', travouDemais.length === 0, travouDemais.join(', '));
/* a guarda vem como PRIMEIRA linha: depois de um `await`, a callable ja teria lido o banco */
const tarde = PROTEGIDAS.filter(n => {
  const c = corpoDa(n);
  const i = c.indexOf('exigeCadastro(request)');
  return i < 0 || /await |\.get\(\)/.test(c.slice(0, i));
});
ok('e ela e a PRIMEIRA coisa da callable', tarde.length === 0, tarde.join(', '));

/* ============================================================================
   2) AS REGRAS -- a unica trava possivel pra Liga Classica
   ============================================================================ */
console.log('\nAS REGRAS DO FIRESTORE');
ok('existe a funcao `cadastrado()`', /function cadastrado\(\)/.test(REGRAS));
ok('  ela le o sign_in_provider', /sign_in_provider != 'anonymous'/.test(REGRAS));
/* ⚠️ AS SEIS COLECOES COMPARTILHADAS. A da Liga Classica e a que nao tem alternativa: o
   `registerForLeague` mora no index.html e escreve direto -- nenhuma callable guarda isso. */
/* ⚠️ O EXTRATOR CORTA NO PROXIMO `match /`, e NAO no primeiro `}` -- a primeira versao cortava no
   `}` e devolvia meia regra, acusando TRES blocos que estavam certos. E a armadilha do padrao
   largo/curto demais que este projeto ja registra meia duzia de vezes: medir com a regua errada
   da um numero plausivel. */
function regraDe(bloco){
  const i = REGRAS.indexOf(bloco);
  if(i < 0) return '';
  const j = REGRAS.indexOf('match /', i + bloco.length);
  return REGRAS.slice(i, j < 0 ? REGRAS.length : j);
}
[['leagues (a AGENDA da Classica)',           'match /leagues/{document}'],
 ['leagueCycles (o chaveamento)',             'match /leagueCycles/{cycleId}'],
].forEach(([rotulo, bloco]) => {
  const r = regraDe(bloco);
  ok('  ' + rotulo + ': escrita so pra cadastrado', /allow write: if cadastrado\(\)/.test(r), r ? '' : 'nao achei o bloco');
});
/* as subcolecoes de inscrito/escolha: a comparacao com o uid CONTINUA (ela nao foi trocada, foi
   somada) -- sem ela, um cadastrado escreveria no registro de outro */
const escritasComUid = (REGRAS.match(/allow write: if cadastrado\(\) && \w+ == request\.auth\.uid/g) || []).length;
ok('  os registrants/terrainPicks/teamPicks somam a guarda SEM perder o uid', escritasComUid === 4,
   escritasComUid + ' de 4');
/* ⚠️ E O QUE NAO PODE TER MUDADO: `users/{uid}` e os saves continuam do DONO. O convidado JOGA a
   jornada -- fechar isso seria fechar o jogo pra ele. */
const rUsers = regraDe('match /users/{userId}');
ok('  users/{uid} continua livre pro dono (o convidado joga)',
   /allow read: if request\.auth != null && request\.auth\.uid == userId/.test(rUsers)
   && !/cadastrado\(\)/.test(rUsers));
ok('  a LEITURA da liga continua aberta (ele "ve o que e")',
   /match \/leagues\/\{document\} \{\s*\n\s*allow read: if request\.auth != null;/.test(REGRAS));

/* ============================================================================
   3) O CLIENTE
   ============================================================================ */
console.log('\nA ENTRADA SEM CONTA');
const S = createSandbox(path.join(RAIZ, 'index.html'));
S.game.contaCarregada = true;
S.game.saveSlotsCarregados = true;

S.__auth.chamadas.length = 0;
S.entrarSemConta();
ok('`entrarSemConta` usa signInAnonymously', S.__auth.chamadas.includes('signInAnonymously'),
   S.__auth.chamadas.join(','));
/* ⚠️ E NAO signInWithPopup: um popup aqui pediria conta, que e justamente o que ela evita */
ok('  e nao abre popup de login', !S.__auth.chamadas.includes('signInWithPopup'));
ok('a tela de login oferece o caminho', /onclick="entrarSemConta\(\)"/.test(HTML));
ok('  e ela diz o preco antes (os modos fechados)',
   /Ligas, Ginásio da Cidade, Torre, Batalha Online e Ilhas Laranja/.test(HTML));
/* o provedor desligado no console e o caso mais provavel de tudo isto nao funcionar */
S.__auth.erro = { code:'auth/operation-not-allowed' };
S.game.authError = null;
return_ = S.entrarSemConta();
Promise.resolve().then(()=>{}); // a rejeicao e tratada dentro da funcao
setTimeout(()=>{}, 0);

console.log('\nA PORTA DOS CINCO MODOS');
const MODOS = ['ligas','ginasio','torre','online','ilhas','amigos'];
ok('os modos estao na tabela', MODOS.every(m => S.CONVIDADO_MODOS[m]),
   Object.keys(S.CONVIDADO_MODOS).join(','));
ok('  e cada um diz O QUE ELE E (o "ver o que e" do pedido)',
   MODOS.every(m => (S.CONVIDADO_MODOS[m].o || '').length > 40));
ok('  e nenhum texto se repete', new Set(MODOS.map(m => S.CONVIDADO_MODOS[m].o)).size === MODOS.length);

S.game.ehConvidado = false;
ok('quem e CADASTRADO passa em todos', MODOS.every(m => S.exigeCadastro(m) === true));
S.game.ehConvidado = true;
const recusou = MODOS.filter(m => { S.game.convidadoModal = null; return S.exigeCadastro(m) === false && S.game.convidadoModal === m; });
ok('o CONVIDADO e recusado em todos, com o modal do modo certo', recusou.length === MODOS.length, recusou.join(','));

/* os cinco BOTOES da home passam pela porta -- a acao e quem recusa, mas o botao tem que chamar */
console.log('\nOS CINCO BOTOES DA HOME');
[['ligas','openLeagueTypesList'],['ginasio','openNeighborhoodGymScreen'],['torre','openTrainerTower'],
 ['online','openOnlineBattle'],['ilhas','abrirIlhas'],['amigos','openFriends']].forEach(([id, fn]) => {
  ok('  ' + fn + ' passa pela porta',
     HTML.includes(`onclick="if(exigeCadastro('${id}')) ${fn}()"`));
});
/* ⚠️ E SO OS DA HOME: `openNeighborhoodGymScreen` aparece 5x no arquivo, e quatro sao botoes de
   "⬅ Voltar" de DENTRO do proprio modo -- um Voltar que abre modal de cadastro. Foi a armadilha
   do padrao largo demais (a mesma das regex do `mlog-mais` e do `matchup-row`). */
const portas = (HTML.match(/if\(exigeCadastro\('/g) || []).length;
/* ⚠️ O NUMERO SAI DA TABELA, nunca escrito: ele ja envelheceu uma vez -- era 5, e virou 6 quando
   os Amigos entraram (23/09/2026). E a familia de trava que este projeto ve envelhecer toda vez
   que uma regua muda (as cinco da metragem do revezamento, o "59 especies" da ficha). */
const nModos = Object.keys(S.CONVIDADO_MODOS).length;
ok('  a porta esta em UM lugar por modo (nao nos "Voltar")', portas === nModos,
   portas + ' portas para ' + nModos + ' modos');

/* ============================================================================
   ⚠️ O PROVEDOR DESLIGADO NO CONSOLE -- o caso mais provavel de tudo isto nao funcionar, e o que
   custou o PRIMEIRO relato desta feature: eu tratei so o `operation-not-allowed`, o Firebase
   devolveu `auth/admin-restricted-operation`, e o jogador viu o generico "Algo deu errado. Tente
   de novo." -- exatamente o "falhar calado" que a mensagem existe pra evitar.
   ============================================================================ */
console.log('\nQUANDO O ANONIMO ESTA DESLIGADO NO CONSOLE');
[['auth/admin-restricted-operation', 'o que o Firebase devolve de verdade'],
 ['auth/operation-not-allowed',      'a forma antiga, de outros SDKs']].forEach(([code, o]) => {
  ok('  ' + code + ' explica o que houve  (' + o + ')', S.ehAnonimoDesligado({ code }));
});
ok('  e outro erro qualquer NAO cai nessa frase', !S.ehAnonimoDesligado({ code:'auth/network-request-failed' }));
ok('  e `undefined` tambem nao', !S.ehAnonimoDesligado(undefined) && !S.ehAnonimoDesligado({}));

console.log('\nO CONVIDADO NAO APARECE NA BUSCA DE TREINADORES');
/* ⚠️ E o outro lado do "nao pode adicionar amigos": ele nao consegue ACEITAR pedido (o
   `respondFriendRequest` esta protegido), entao um pedido mandado PRA ele ficaria pendente pra
   sempre na conta de quem e cadastrado -- e a conta anonima e descartavel.
   ⚠️ E NAO BASTA nao gravar o `trainerNameLower`: o `searchTrainers` tem uma SEGUNDA consulta, por
   `trainerName` EXATO (a rede de seguranca pras contas antigas). Por isso o filtro e no resultado. */
ok('o servidor sabe quem e convidado pelo TOKEN', /function ehConvidado\(request\)/.test(SRV));
ok('  e a marca `anon` e gravada pelo SERVIDOR, nao pelo cliente',
   /async function touchLastSeen\(uid, userData, anon\)/.test(SRV) && !/anon:\s*true/.test(HTML));
ok('  o getMyNotifications passa o provedor (e o unico dos 4 que o convidado alcanca)',
   /touchLastSeen\(uid, u\.exists \? u\.data\(\) : null, ehConvidado\(request\)\)/.test(SRV));
const corpoBusca = (SRV.match(/exports\.searchTrainers = onCall[\s\S]*?\n\}\);/) || [''])[0];
ok('  a fatia da busca tem o que ler', corpoBusca.length > 400, corpoBusca.length + ' chars');
ok('  e a busca PULA quem esta marcado', /\.anon === true\) continue/.test(corpoBusca));

console.log('\nO MODAL QUE EXPLICA');
S.game.convidadoModal = 'torre';
const mTorre = S.renderConvidadoModal();
ok('o modal nomeia o modo', mTorre.includes('Torre dos Treinadores'));
ok('  e conta o que ele e', mTorre.includes('30 andares'));
ok('  e leva pro cadastro', mTorre.includes('abrirCriarLogin()'));
ok('  e diz que nao perde nada', /mantém tudo|mantem tudo/i.test(mTorre));
S.game.convidadoModal = 'modo_que_nao_existe';
ok('modo desconhecido NAO abre caixa vazia', S.renderConvidadoModal() === '');
S.game.convidadoModal = null;

console.log('\nO BOTAO "Criar Login"');
ok('o botao existe e e vermelho (`danger`)', /class="btn danger criar-login-btn"/.test(HTML));
ok('  e ele so e desenhado pra convidado',
   /game\.ehConvidado \? `<div class="criar-login-row"><button class="btn danger criar-login-btn"/.test(HTML));
/* ⚠️ ELE FICA EM LINHA PROPRIA, COLADO EMBAIXO DO NICK -- e isso e MEDIDO, nao gosto. Na linha do
   nick, a 320px, o NOME DO TREINADOR ia a largura ZERO (a moeda ao lado e flex-shrink:0 e comia o
   resto), e a tela continuava PARECENDO certa. Ver o comentario do CSS.
   Se alguem voltar a po-lo dentro da `home-header-row`, o nome some de novo. */
const iLinhaNick = HTML.indexOf('<div class="home-header-row">');
const iFimNick   = HTML.indexOf('</div>', HTML.indexOf('notif-bell-btn', iLinhaNick));
ok('  e ele NAO esta dentro da linha do nick (la o nome ia a zero)',
   HTML.slice(iLinhaNick, iFimNick).indexOf('criar-login-btn') < 0);
/* ⚠️ CLASSE SEM REGRA NAO DA ERRO: ela so nao faz nada, e so a tela mostra. Este projeto ja pagou
   isso cinco vezes (--cream, --yellow-soft, modal-backdrop, section-title, corrida-anuncio-time). */
ok('  a classe `criar-login-row` TEM regra no CSS', /\.criar-login-row\{/.test(HTML));
ok('  a classe `criar-login-btn` TEM regra no CSS', /\.criar-login-btn\{/.test(HTML));

/* ============================================================================
   ⚠️ O VINCULO -- A TRAVA MAIS IMPORTANTE DO ARQUIVO

   Trocar `link` por `signIn` NAO DA ERRO NENHUM: a pessoa entra numa conta nova, vazia, e o
   convidado fica orfao com os times dentro. A tela mostra "conta criada" e o jogador so descobre
   que perdeu tudo quando procura os saves. E exatamente o tipo de defeito que este projeto paga
   mais caro -- o que parece funcionar.
   ============================================================================ */
console.log('\nO VINCULO (e por que ele "mantem os times")');
const chamadas = [];
S.auth.currentUser = {
  uid:'convidado-1',
  linkWithPopup(p){ chamadas.push('linkWithPopup'); return Promise.resolve({}); },
  linkWithCredential(c){ chamadas.push('linkWithCredential:' + c.__cred); return Promise.resolve({}); },
};
S.game.ehConvidado = true;
(async () => {
  await S.vincularComGoogle();
  ok('Google usa linkWithPopup', chamadas.includes('linkWithPopup'), chamadas.join(','));
  ok('  e NUNCA signInWithPopup (isso trocaria de uid e perderia os saves)',
     !S.__auth.chamadas.includes('signInWithPopup'));
  ok('  e o uid e o MESMO -- e por isso que os times ficam', S.auth.currentUser.uid === 'convidado-1');
  ok('  depois do vinculo ele deixa de ser convidado', S.game.ehConvidado === false);
  ok('  e todos os modos abrem', MODOS.every(m => S.exigeCadastro(m) === true));
  ok('  e a home confirma o cadastro', S.game.linkFeito === true);

  /* e-mail/senha */
  S.game.ehConvidado = true; chamadas.length = 0;
  S.document.__setValue && S.document.__setValue();
  S.game.linkEmail = 'novo@exemplo.com';
  const el = S.document.getElementById('link-email-input'); el.value = 'novo@exemplo.com';
  const el2 = S.document.getElementById('link-password-input'); el2.value = 'senha123';
  await S.vincularComEmail();
  ok('e-mail/senha usa linkWithCredential', chamadas.some(c => c.startsWith('linkWithCredential')),
     chamadas.join(','));
  ok('  com a credencial de e-mail', chamadas.includes('linkWithCredential:email'));

  /* ⚠️ A CONTA QUE JA EXISTE: e o UNICO caso em que "mantem os times" nao vale, e a recusa tem que
     DIZER isso -- oferecer entrar na conta antiga perderia o progresso em silencio. */
  console.log('\nA CONTA QUE JA EXISTE (o unico caso que perde)');
  const msg = S.linkErrorMessage({ code:'auth/credential-already-in-use' });
  ok('a recusa avisa que o progresso ficaria pra tras', /deixaria pra trás|deixaria pra tras/i.test(msg), msg);
  ok('  e o mesmo vale pro e-mail ja cadastrado',
     /deixaria pra trás|deixaria pra tras/i.test(S.linkErrorMessage({ code:'auth/email-already-in-use' })));
  ok('  e ela NAO oferece entrar assim mesmo', !/entrar assim mesmo|continuar mesmo/i.test(msg));

  /* ============================================================================
     O QUE ATRAVESSA O SAVE
     ============================================================================ */
  console.log('\nA MARCA SOBREVIVE AO resetGame');
  /* ⚠️ Sem isto o convidado veria os cinco modos ABERTOS depois de abrir um save -- e o mesmo
     defeito que o `ehAdmin` e o `saveSlotsCarregados` teriam sem esta lista. */
  ['ehConvidado','convidadoModal','linkModo','linkFeito'].forEach(c =>
    ok('  `' + c + '` esta no CAMPOS_DA_CONTA', S.CAMPOS_DA_CONTA.includes(c)));
  /* e ela NAO vai pro banco: o serializeGame e uma lista de permissao */
  const serial = JSON.stringify(S.serializeGame ? S.serializeGame() : {});
  ok('  e `ehConvidado` NAO vai pro Firestore', !/ehConvidado/.test(serial));

  console.log('\nO DESAFIO DE AMIGO NAO E AGENDADO PRA ELE');
  /* ⚠️ aceitar um desafio de amigo ENTRA numa batalha online, e o servidor recusa
     (`respondFriendChallenge` esta protegida). Agendado, o poll rodaria a cada 10s pra nunca poder
     responder nada -- e o modal ofereceria uma luta que a acao ia recusar. */
  ok('o onAuthStateChanged le o isAnonymous', /game\.ehConvidado = user\.isAnonymous === true/.test(HTML));
  ok('  e so agenda o aviso pra quem NAO e convidado',
     /if\(!game\.ehConvidado\) agendarAvisoDesafio\(\)/.test(HTML));

  console.log('\nOS MODAIS NA ORDEM');
  /* os modais empilham na ordem em que entram, e o de "criar login" e aberto de DENTRO do aviso
     do modo -- vindo antes, abriria ATRAS */
  const iAviso = HTML.indexOf('if(game.convidadoModal){ html += renderConvidadoModal(); }');
  const iLink  = HTML.indexOf('if(game.linkModo){ html += renderCriarLoginModal(); }');
  ok('os dois estao anexados no render', iAviso > 0 && iLink > 0);
  ok('  e o de criar login vem DEPOIS do aviso do modo', iLink > iAviso);

  console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
  process.exit(falhas ? 1 : 0);
})();

/* ⚠️ O QUE FICOU DE FORA, e e decisao registrada -- nao esquecimento:

   O BOSS DE DOMINGO. Ele nao esta nos cinco modos do pedido, e o evento esta DESLIGADO
   (`BOSS_ATIVO`) -- ou seja ele ja recusa todo mundo. Se voltar, entra aqui.

   O `pollFriendChallenge` e o `cancelFriendChallenge` -- ver a nota das LIVRES acima. */
