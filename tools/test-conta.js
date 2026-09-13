/**
 * A CONTA -- rival padrao e recuperacao de senha.
 *
 * Por que isso existe: sao dois caminhos que quase nunca sao percorridos a mao. O rival padrao so
 * aparece na PRIMEIRA tela de uma jornada nova, e a recuperacao de senha so quando alguem esquece
 * a senha -- e nesse segundo caso um defeito nao aparece pra quem testa: aparece pra quem esta
 * trancado do lado de fora.
 *
 * O que fica trancado aqui:
 *   - a precedencia do rival padrao (conta > save antigo > reserva do jogo)
 *   - que trocar o nome no formulario grava na conta, e repetir o mesmo nome NAO grava
 *   - que a tela de recuperacao nao vira ORACULO: e-mail sem conta responde igual a e-mail com
 *     conta, senao qualquer um descobre quem tem conta no jogo testando e-mails um a um
 *   - que erro de verdade (limite de tentativas) continua aparecendo
 *   - que o continue URL recusado nao impede o e-mail de sair
 *
 *   node tools/test-conta.js
 */
const { createSandbox } = require('./game-sandbox');

const S = createSandbox();
const g = S.__getGame();

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
// o sandbox nao tem DOM: cada teste diz o que o campo da tela "contem"
function campoComValor(valor){ S.document.getElementById = () => ({ value: valor }); }

(async () => {

console.log('\nO RIVAL PADRAO VEM DA CONTA');
g.rivalNameDefault = 'Gary'; g.saveSlots = [null, {rivalName:'Silver'}, null]; S.__setGame(g);
ok('a conta ganha de tudo', S.nomeDoRivalPadrao() === 'Gary', S.nomeDoRivalPadrao());
/* Conta anterior ao campo: em vez de oferecer a reserva do jogo pra quem ja tem rival ha tres
   jornadas, aproveita o nome que ja esta num save. */
g.rivalNameDefault = ''; S.__setGame(g);
ok('sem padrao na conta, aproveita o rival de um save', S.nomeDoRivalPadrao() === 'Silver', S.nomeDoRivalPadrao());
g.saveSlots = [null,null,null]; S.__setGame(g);
ok('conta nova cai na reserva do jogo', S.nomeDoRivalPadrao() === S.RIVAL_NAME_DEFAULT, S.nomeDoRivalPadrao());
g.rivalNameDefault = '   '; S.__setGame(g);
ok('padrao so de espaco nao conta', S.nomeDoRivalPadrao() === S.RIVAL_NAME_DEFAULT);

console.log('\nA TELA DE NOME DO RIVAL JA VEM PREENCHIDA');
g.rivalNameDefault = 'Gary'; g.rivalNameError = null; S.__setGame(g);
const telaRival = S.renderNewSaveName();
ok('o campo vem com o padrao da conta', telaRival.includes('value="Gary"'));
ok('e a tela explica que isso vale pras proximas', telaRival.includes('rival padrão da sua conta'));
/* Nome de rival nao filtra caractere nenhum (so corta em 20) e agora entra num ATRIBUTO: sem
   escape, uma aspa fecha o value e o resto vira marcacao. */
g.rivalNameDefault = 'Ga"ry onload=x'; S.__setGame(g);
const telaComAspas = S.renderNewSaveName();
ok('nome com aspas nao escapa do atributo',
   telaComAspas.includes('value="Ga&quot;ry onload=x"') && !telaComAspas.includes('value="Ga"ry'));

console.log('\nTROCAR NO FORMULARIO TROCA O PADRAO DA CONTA');
let gravacoes = [];
S.userDocRef = () => ({ set: (dados) => { gravacoes.push(dados); return Promise.resolve(); } });
g.authUser = { uid:'u1' }; g.rivalNameDefault = 'Gary'; S.__setGame(g);
S.gravarRivalPadrao('Silver');
ok('nome novo grava na conta', gravacoes.length === 1 && gravacoes[0].rivalNameDefault === 'Silver',
   JSON.stringify(gravacoes));
ok('e vale na hora, sem esperar a volta do servidor', S.__getGame().rivalNameDefault === 'Silver');
gravacoes = [];
S.gravarRivalPadrao('Silver');
ok('o mesmo nome de novo nao gasta escrita', gravacoes.length === 0);
gravacoes = [];
S.gravarRivalPadrao('   ');
ok('nome vazio nao grava', gravacoes.length === 0);
gravacoes = [];
g.authUser = null; S.__setGame(g);
S.gravarRivalPadrao('Blue');
ok('sem conta logada nao grava', gravacoes.length === 0);

console.log('\nA TELA DE LOGIN E OS TRES MODOS');
g.authUser = null; g.authBusy = false; g.authError = null; g.authNotice = null; g.authEmail = '';
g.authMode = 'login'; S.__setGame(g);
const login = S.renderAuth();
ok('o login oferece recuperar a senha', login.includes("switchAuthMode('reset')") && login.includes('Esqueci minha senha'));
ok('e continua oferecendo criar conta', login.includes("switchAuthMode('register')"));
g.authMode = 'reset'; g.authEmail = 'treinador@exemplo.com'; S.__setGame(g);
const reset = S.renderAuth();
/* Pedir senha na tela de "esqueci a senha" faz a pessoa achar que clicou no botao errado. */
ok('a tela de recuperar nao pede senha', !reset.includes('auth-password-input'));
ok('e leva o e-mail ja digitado', reset.includes('value="treinador@exemplo.com"'));
ok('com o botao de mandar o link', reset.includes('sendPasswordReset()'));
g.authNotice = 'link enviado'; S.__setGame(g);
ok('o recado bom sai em azul, nao em vermelho',
   S.renderAuth().includes('<p class="hint-text">link enviado</p>'));
g.authNotice = null; g.authMode = 'login'; S.__setGame(g);

console.log('\nRECUPERAR SENHA NAO PODE VIRAR ORACULO');
let enviados = [];
S.auth.sendPasswordResetEmail = (email, cfg) => { enviados.push({email, cfg}); return Promise.resolve(); };
campoComValor('treinador@exemplo.com');
g.authMode = 'reset'; S.__setGame(g);
await S.sendPasswordReset();
let est = S.__getGame();
ok('manda o link pro e-mail digitado', enviados.length === 1 && enviados[0].email === 'treinador@exemplo.com');
ok('volta pro login com o recado', est.authMode === 'login' && !!est.authNotice && !est.authError);
const recadoBom = est.authNotice;

enviados = [];
S.auth.sendPasswordResetEmail = () => Promise.reject({ code:'auth/user-not-found' });
campoComValor('ninguem@exemplo.com');
g.authMode = 'reset'; g.authNotice = null; g.authError = null; S.__setGame(g);
await S.sendPasswordReset();
est = S.__getGame();
ok('e-mail SEM conta responde igual ao e-mail com conta',
   !est.authError && est.authNotice === recadoBom && est.authMode === 'login');

S.auth.sendPasswordResetEmail = () => Promise.reject({ code:'auth/too-many-requests' });
campoComValor('treinador@exemplo.com');
g.authMode = 'reset'; g.authNotice = null; g.authError = null; S.__setGame(g);
await S.sendPasswordReset();
est = S.__getGame();
ok('mas erro de verdade aparece e a tela espera', !!est.authError && est.authMode === 'reset', est.authError);

/* O continue URL so e aceito se o dominio estiver na lista de autorizados do Firebase Auth, e o
   SDK recusa a chamada INTEIRA quando nao esta -- melhor um e-mail sem link de volta do que
   e-mail nenhum. */
let tentativas = 0;
S.auth.sendPasswordResetEmail = (email, cfg) => {
  tentativas++;
  return cfg ? Promise.reject({ code:'auth/unauthorized-continue-uri' }) : Promise.resolve();
};
campoComValor('treinador@exemplo.com');
g.authMode = 'reset'; g.authNotice = null; g.authError = null; S.__setGame(g);
await S.sendPasswordReset();
est = S.__getGame();
ok('dominio recusado: tenta de novo sem o link de volta', tentativas === 2, tentativas + ' tentativas');
ok('e o e-mail sai assim mesmo', !est.authError && est.authMode === 'login');

campoComValor('');
g.authMode = 'reset'; g.authNotice = null; g.authError = null; S.__setGame(g);
await S.sendPasswordReset();
ok('campo vazio pede o e-mail em vez de chamar o servidor', !!S.__getGame().authError);

console.log('\n=== NENHUMA JORNADA COMECA SEM NOME DE TREINADOR ===');
{
  /* Reportado em 13/09/2026: *"tem alguns usuarios que estao sem nome de treinador mesmo depois de
     se cadastrar, ai nao sei se deu algum bug pra eles ou eles que nao quiseram colocar mesmo"*.
     ERA BUG. A tela de nome era um remendo DEPOIS do carregamento da home
     (`if(screen==='saveSelect' && !trainerName)`), disparado no fim de um Promise.all que carrega
     saves, pokedex, especialidades, ranking, notificacoes e uma callable -- e a home JA ESTAVA na
     tela e clicavel esse tempo todo. Quem clicasse num slot nessa janela criava a jornada sem nunca
     ver a pergunta.
     MEDIDO EM PRODUCAO: 5 contas de 48 (10,4%) sem nome, e DUAS com rivalNameDefault,
     startersSorteados e pokedexCaught gravados -- ou seja, jogaram. */
  const g = S.__getGame();

  /* 1) CONTA SEM NOME, JA CARREGADA: os tres caminhos de jogar mandam pra tela de nome. */
  const tenta = (fn) => { const gg = S.__getGame(); gg.screen = 'saveSelect'; S.__setGame(gg); fn(); return S.__getGame().screen; };
  g.trainerName = ''; g.contaCarregada = true; g.authUser = { uid:'u1' };
  g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
  S.__setGame(g);
  ok('comecar um save novo pede o nome antes', tenta(() => S.startNewSave(0)) === 'accountSetup',
     tenta(() => S.startNewSave(0)));
  ok('continuar um save tambem', tenta(() => S.continueSave(0)) === 'accountSetup');
  ok('e o save campeao tambem', tenta(() => S.continueCompleteSave(0)) === 'accountSetup');

  /* 2) COM NOME, a porta nao atrapalha. */
  { const gg = S.__getGame(); gg.trainerName = 'Buzzo'; S.__setGame(gg); }
  ok('com nome, comecar um save segue o fluxo normal',
     tenta(() => S.startNewSave(0)) === 'newSaveMode', tenta(() => S.startNewSave(0)));

  /* ⚠️ 3) ENQUANTO A CONTA NAO FOI LIDA, a guarda NAO manda pra tela de nome -- ela nao tem como
     afirmar que a conta esta sem nome, e mandar quem JA TEM seria trocar um defeito por outro. */
  { const gg = S.__getGame(); gg.trainerName = ''; gg.contaCarregada = false; S.__setGame(gg); }
  ok('conta ainda carregando NAO e mandada pra tela de nome',
     tenta(() => S.startNewSave(0)) === 'saveSelect', tenta(() => S.startNewSave(0)));

  /* ⚠️ 4) E A GUARDA MORA NA PORTA DA JORNADA, nao na home. O teste le o CODIGO porque os casos
     acima chamam as funcoes direto e passariam com a guarda movida pra um render. */
  {
    const txt = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
    const chamadas = (txt.match(/if\(!exigeNomeDeTreinador\(\)\) return;/g) || []).length;
    ok('os tres caminhos chamam a guarda', chamadas === 3, chamadas + ' chamadas');
    /* E A ESCRITA DO NOME E CONFIRMADA antes de navegar: `set()` resolvendo nao quer dizer que
       salvou -- sem rede ele vai pra uma fila em memoria que morre com a aba, e o nome e escrito
       UMA vez na vida da conta. */
    const bloco = (txt.match(/async function confirmAccountSetup\(\)[\s\S]*?\n\}/) || [''])[0];
    ok('a escrita do nome espera a confirmacao do servidor',
       /waitForPendingWrites/.test(bloco) && bloco.indexOf('waitForPendingWrites') < bloco.indexOf("screen = 'saveSelect'"),
       bloco.length + ' chars');
    ok('e sem confirmacao ela NAO navega, e diz o que houve',
       /accountNameError = 'N\u00e3o deu pra salvar/.test(bloco));
  }
}
console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);

})();
