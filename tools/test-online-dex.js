/**
 * TELAS: a Batalha Online, o quadro #151 da Pokedex e a espera do Ginasio da Cidade.
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
/* Celula COMUM de nao-descoberto: nada nela promete que da pra conseguir, e nada nela chama
   atencao -- e a mesma coisa que o jogador ve em qualquer espécie que ele ainda nao capturou. */
ok('o #151 esta la, como um quadro comum de nao-descoberto', grade.includes('#151'));
ok('e sem estilo proprio nem clique', !/pokedex-cell raide/.test(grade) && !/<div class="pokedex-cell[^"]*"[^>]*onclick[^>]*>\s*<span class="pokedex-number">#151/.test(grade));
/* Ordem: ele tem que cair ENTRE o #150 e o #152, senao a numeracao continua pulando. */
const ordem = (grade.match(/#1(4[89]|5[0-2])/g) || []);
ok('e cai entre o #150 e o #152', ordem.join(',').includes('#150,#151,#152'), ordem.join(','));
/* A visao shiny mostra a mesma grade -- um buraco la seria o mesmo defeito. */
g = S.__getGame(); g.pokedexView = 'shiny'; S.__setGame(g);
const gradeShiny = S.renderPokedex();
ok('a visao shiny tambem tem o #151', gradeShiny.includes('#151') &&
   (gradeShiny.match(/class="pokedex-cell/g)||[]).length === 251);
g = S.__getGame(); g.pokedexView = 'normal'; S.__setGame(g);
/* E ele NAO abre ficha: nao ha ficha pra um pokemon que ninguem descobriu. */
S.abrirPokedexFicha('mew', false);
ok('e o #151 nao abre ficha nenhuma', S.renderPokedexFicha() === '');


console.log('\nA ESPERA DO GINASIO CHEGA ATE A TELA');
/* POR QUE ESTE TESTE EXISTE: a espera por pokemon foi implementada e conferida NA TELA, com o
   campo escrito a mao no formato final -- e o carregador guardava so `result.data.cooldowns` (o
   campo da espera por TIME, que ficou vazio), jogando fora o `mons`. Resultado: nenhum pokemon
   aparecia apagado e ninguem tinha como saber quem podia usar. A conferencia do desenho passou; o
   caminho do dado ate ele e que estava quebrado.
   Por isso aqui se roda o CARREGADOR de verdade, com so a chamada de rede trocada. */
{
  let g = S.__getGame();
  const time = (pref, esp) => esp.map((e,i)=>({ id:pref+i, speciesId:e, level:70+i, shiny:false }));
  g.authUser = { uid:'u1' };
  g.saveSlots = [
    { customName:'Kanto', badgeCount:8, team: time('a', ['gyarados','alakazam','snorlax','arcanine','gengar','lapras']) },
    { customName:'Johto', badgeCount:8, team: time('b', ['typhlosion','ampharos','steelix','umbreon','kingdra','tyranitar']) }
  ];
  g.neighborhoodGymLocation = { city:'Sorocaba', countryCode:'BR' };
  g.neighborhoodGymDetail = { hasLeader:true, leaderTeamPreview:[{speciesId:'onix',level:70}], leaderTerrain:null };
  S.__setGame(g);
  /* A RESPOSTA DO SERVIDOR, na forma exata em que ele responde -- e ela que o carregador tem que
     saber guardar. Os tres primeiros do save Kanto acabaram de lutar. */
  const resposta = { mons: { 'm_a0': 8*60*1000, 'm_a1': 8*60*1000, 'm_a2': 8*60*1000 }, cooldowns: {} };
  espiaChamadas(resposta);
  await S.startNeighborhoodGymChallenge();
  await espera(60);

  const esperas = S.esperaDosPokemon();
  ok('o carregador guarda quem esta descansando', Object.keys(esperas).length === 3,
     JSON.stringify(S.__getGame().neighborhoodGymCooldowns));
  const tela = S.renderNeighborhoodGymChallengeTeamPicker();
  ok('e a tela apaga os tres', (tela.match(/tower-pick[^"]*descansando/g)||[]).length === 3,
     (tela.match(/tower-pick[^"]*descansando/g)||[]).length + ' apagados');
  ok('com o TEMPO em minutos em cima de cada um', (tela.match(/⏳8min/g)||[]).length === 3,
     (tela.match(/⏳\d+min/g)||[]).join(', '));
  ok('e desabilitados de verdade', (tela.match(/descansando"[^>]*\n?[^>]*disabled/g)||[]).length > 0 ||
     tela.split('descansando').slice(1).every(t => t.slice(0, 200).includes('disabled')));
  ok('e a tela avisa quantos estao descansando', /3 pokémon estão descansando/.test(tela));
  /* Os OUTROS NOVE continuam livres -- e o ponto da regra: so quem lutou descansa. */
  const livres = S.towerEligiblePokemon().filter(p => !esperas[S.chaveDoPokemon(p)]).length;
  ok('e os outros nove continuam livres', livres === 9, livres + ' livres');
  /* A CHAVE tem que ser a mesma dos dois lados: se o cliente calculasse outra, a tela liberaria
     justamente quem o servidor recusa. */
  const doPrimeiro = S.chaveDoPokemon(S.towerEligiblePokemon()[0]);
  ok('e a chave do cliente bate com a do servidor', doPrimeiro === 'm_a0', doPrimeiro);
  /* Clicar num que esta descansando nao pode marcar. */
  S.gymChallengeTogglePick(0, 0);
  ok('clicar num descansando nao marca nada', (S.__getGame().neighborhoodGymChallengePick||[]).length === 0);
  S.gymChallengeTogglePick(0, 4);
  ok('e num livre marca', (S.__getGame().neighborhoodGymChallengePick||[]).length === 1);
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);

})();
