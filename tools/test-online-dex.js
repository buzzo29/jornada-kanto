/**
 * A TELA DA BATALHA ONLINE E O QUADRO #151 DA POKEDEX.
 *
 * Duas coisas que nao tem como um teste de motor pegar: elas moram na TELA, e o defeito de cada
 * uma era ficar parada dizendo a coisa errada -- que e o tipo de falha que ninguem consegue
 * reportar direito ("nao carrega") e que nenhum log acusa.
 *
 *   node tools/test-online-dex.js
 */
const path = require('path');
const { createSandbox } = require('./game-sandbox');
const S = createSandbox(path.join(__dirname, '..', 'index.html'));

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
/* Troca a chamada de rede por uma espia. Devolve a lista do que foi chamado. */
function espiaChamadas(resposta){
  const chamadas = [];
  S.functionsClient.httpsCallable = (nome) => async () => {
    chamadas.push(nome);
    if(resposta instanceof Error) throw resposta;
    return { data: resposta };
  };
  return chamadas;
}
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const HISTORICO = { wins:6, losses:4, favorito:'gengar', history:[
  { battleId:'ob_1', oponente:'Sica', venceu:false, quando: Date.now(), meusVivos:0, delesVivos:2, confrontos:10 }
]};

(async () => {

console.log('\nO HISTORICO CARREGA MESMO COM UMA BUSCA RODANDO');
/* O defeito: o carregamento ficava DEPOIS do return da busca. Quem tinha uma busca em segundo
   plano (o botao das telas de batalha da jornada deixou isso comum) abria a Batalha Online, via
   "Procurando oponente", cancelava -- e a tela dizia "Carregando seu historico..." pra sempre,
   porque ninguem mais ia buscar. Reportado em 01/09/2026. */
let g = S.__getGame();
g.onlineHistorico = null; g.onlineSearching = true; S.__setGame(g);
let chamadas = espiaChamadas(HISTORICO);
S.openOnlineBattle();
await espera(50);
ok('com busca em andamento, ele busca do mesmo jeito', chamadas.includes('getMyBattleHistory'),
   chamadas.join(', ') || 'nao chamou nada');
ok('e o historico chega na memoria', !!S.__getGame().onlineHistorico);
/* Cancelada a busca, a tela do historico aparece -- e agora tem o que mostrar. */
g = S.__getGame(); g.onlineSearching = false; S.__setGame(g);
let tela = S.renderOnlineBattle();
ok('cancelando a busca, a tela mostra o placar', tela.includes('COMBATES') && !tela.includes('Carregando seu histórico'));

console.log('\nA TELA NUNCA FICA "CARREGANDO" PRA SEMPRE');
/* Um erro aqui era so um console.error: o jogador ficava olhando a frase sem saber se era a
   internet dele, se era o jogo, nem o que fazer. */
g = S.__getGame();
g.onlineHistorico = null; g.onlineHistoricoErro = null; g.onlineSearching = false; g.screen = 'onlineBattle';
S.__setGame(g);
chamadas = espiaChamadas(new Error('internal'));
await S.carregarHistoricoOnline();
ok('falhou: tenta de novo uma vez antes de desistir', chamadas.length === 2, chamadas.length + ' tentativa(s)');
ok('e a tela DIZ o que houve', !!S.__getGame().onlineHistoricoErro, S.__getGame().onlineHistoricoErro);
tela = S.renderOnlineBattle();
ok('com botao pra tentar de novo', tela.includes('Tentar de novo') && !tela.includes('Carregando seu histórico'));
/* E clicar no botao limpa o erro e busca outra vez -- senao o botao mentiria. */
chamadas = espiaChamadas(HISTORICO);
await S.carregarHistoricoOnline();
ok('e o botao realmente busca de novo', chamadas.includes('getMyBattleHistory') && !S.__getGame().onlineHistoricoErro);
ok('e ai a tela volta ao normal', S.renderOnlineBattle().includes('COMBATES'));

console.log('\nO PRAZO PROPRIO SOLTA UMA CHAMADA PENDURADA');
/* O SDK espera 70 segundos antes de desistir, e 70 segundos de "Carregando..." e indistinguivel
   de travado. Aqui so se confere que o prazo EXISTE e e curto -- esperar 24s num teste seria
   trocar uma espera ruim por outra. */
ok('o prazo e proprio e curto', S.PRAZO_HISTORICO_MS > 0 && S.PRAZO_HISTORICO_MS <= 15000,
   S.PRAZO_HISTORICO_MS + 'ms por tentativa');

console.log('\nO QUADRO #151 (MEW) NA POKEDEX');
/* Ele entra na GRADE pra numeracao nao pular do #150 pro #152, mas NAO entra na CONTA: o desafio
   do Mewtwo e a conquista "Mestre Pokemon" cobram "capturou todo o resto", e uma vaga que ninguem
   consegue preencher deixaria os dois impossiveis pra sempre -- que ja aconteceu neste jogo, com
   o Celebi, e ficou dias sem ninguem notar. */
ok('o Mew continua FORA do SPECIES', !S.SPECIES['mew'] && !!S.SPECIES_FORA_DA_DEX['mew']);
ok('e o total da Pokedex nao mudou', Object.keys(S.SPECIES).length === 250, Object.keys(S.SPECIES).length + '');
g = S.__getGame(); g.screen = 'pokedex'; g.pokedexView = 'normal'; g.pokedexModal = false; S.__setGame(g);
const grade = S.renderPokedex();
const celulas = (grade.match(/class="pokedex-cell/g) || []).length;
ok('a grade tem uma celula a mais que o SPECIES', celulas === 251, celulas + ' células');
ok('e a conta na tela continua dizendo 250', /de 250 espécies/.test(grade));
ok('o #151 esta la, com estilo proprio', /pokedex-cell raide/.test(grade) && grade.includes('#151'));
/* Ordem: ele tem que cair ENTRE o #150 e o #152, senao a numeracao continua pulando. */
const ordem = (grade.match(/#1(4[89]|5[0-2])/g) || []);
ok('e cai entre o #150 e o #152', ordem.join(',').includes('#150,#151,#152'), ordem.join(','));
/* A visao shiny mostra a mesma grade -- um buraco la seria o mesmo defeito. */
g = S.__getGame(); g.pokedexView = 'shiny'; S.__setGame(g);
ok('a visao shiny tambem tem o #151', /pokedex-cell raide/.test(S.renderPokedex()));
g = S.__getGame(); g.pokedexView = 'normal'; S.__setGame(g);
/* E a ficha dele abre, com os atributos oficiais da Gen 2 e dizendo por que ele esta ali. */
S.abrirPokedexFicha('mew', false);
const ficha = S.renderPokedexFicha();
ok('a ficha do #151 abre', ficha.includes('Mew') && ficha.includes('#151'));
ok('com os 100 da Gen 2 e total 600', ficha.includes('600'));
ok('e explicando que ninguem o captura', ficha.includes('raide') && ficha.includes('não conta no total'));

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);

})();
