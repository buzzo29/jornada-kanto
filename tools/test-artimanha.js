/**
 * Teste das duas travas contra "save scumming" (reiniciar até vir shiny):
 *
 *   1. ENCONTRO SELVAGEM -- jogadores saíam do save na tela do encontro e voltavam até aparecer
 *      um shiny. A oferta agora sai de uma semente presa ao CONTADOR de encontros do save, então
 *      sair e voltar (ou matar o app antes da gravação chegar) devolve a MESMA oferta.
 *   2. INICIAIS -- jogadores apagavam o save e criavam de novo até um dos três vir shiny. O
 *      resultado agora fica gravado na conta, por slot E por modo, e só é liberado quando aquele
 *      slot conquista a 1ª insígnia.
 *
 *   node tools/test-artimanha.js
 */
const path = require('path');
const { createSandbox } = require('./game-sandbox');
const S = createSandbox(path.join(__dirname, '..', 'index.html'));

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}

function novoJogo(seq){
  const g = S.freshGameDefaults();
  g.currentSaveSlot = 0;
  g.rivalName = 'Gary';
  g.starterId = 'charmander';
  g.gymIndex = 2;
  g.currentRoute = (S.ROUTE_MAP && S.ROUTE_MAP[2] && S.ROUTE_MAP[2][0]) ? S.ROUTE_MAP[2][0].id : null;
  g.team = [];
  g.wildEncounterSeq = seq;
  S.__setGame(g);
  return g;
}
const resumo = o => JSON.stringify((o||[]).map(x=>x.speciesId+':'+x.level+(x.shiny?'*':'')+(x.disguise||'')));

console.log('\n1) ENCONTRO SELVAGEM');

// sair do save e voltar = recarregar o save no contador anterior e entrar na rota de novo
novoJogo(7); S.goToWildEncounter();
const oferta = resumo(S.__getGame().wildOffer);
const seqDepois = S.__getGame().wildEncounterSeq;
let iguais = 0;
for(let i=0;i<100;i++){ novoJogo(7); S.goToWildEncounter(); if(resumo(S.__getGame().wildOffer)===oferta) iguais++; }
ok('100 saídas e voltas devolvem a MESMA oferta', iguais===100, iguais+'/100');
ok('o contador do save avança 1 por encontro', seqDepois===8, 'seq 7 -> '+seqDepois);

// jogar de verdade (consumir o encontro) precisa dar oferta nova
novoJogo(8); S.goToWildEncounter();
ok('consumir o encontro muda a oferta', resumo(S.__getGame().wildOffer)!==oferta);

// rotas diferentes têm o seu próprio encontro, e cada um é estável
const rotas = (S.ROUTE_MAP && S.ROUTE_MAP[2]) ? S.ROUTE_MAP[2].map(r=>r.id) : [];
if(rotas.length > 1){
  const porRota = {};
  rotas.forEach(id=>{ const g=novoJogo(7); g.currentRoute=id; S.goToWildEncounter(); porRota[id]=resumo(S.__getGame().wildOffer); });
  let estaveis = 0;
  rotas.forEach(id=>{ const g=novoJogo(7); g.currentRoute=id; S.goToWildEncounter(); if(resumo(S.__getGame().wildOffer)===porRota[id]) estaveis++; });
  ok('cada rota tem seu encontro fixo', estaveis===rotas.length, estaveis+'/'+rotas.length+' rotas');
  ok('rotas diferentes dão ofertas diferentes', new Set(Object.values(porRota)).size===rotas.length);
}

// a distribuição não pode ter mudado: a semente troca o sorteio, não as chances
let shinys = 0, total = 0;
for(let i=1;i<=20000;i++){ novoJogo(i); S.goToWildEncounter();
  (S.__getGame().wildOffer||[]).forEach(o=>{ total++; if(o.shiny) shinys++; }); }
const taxa = shinys/total, esperado = S.SHINY_CHANCE;
ok('taxa de shiny continua ~1/128', Math.abs(taxa-esperado) < esperado*0.35,
   (100*taxa).toFixed(3)+'% em '+total+' encontros (esperado '+(100*esperado).toFixed(3)+'%)');

console.log('\n2) INICIAIS');
const g = novoJogo(0);
g.authUser = null;              // sem servidor: exercita só a parte de memória
g.startersSorteados = {};
const primeiro = JSON.stringify(S.sorteioDosIniciais(0,'normal'));
let mesmo = 0;
for(let i=0;i<100;i++){ if(JSON.stringify(S.sorteioDosIniciais(0,'normal'))===primeiro) mesmo++; }
ok('recriar o save no mesmo slot traz os mesmos iniciais', mesmo===100, mesmo+'/100');
S.sorteioDosIniciais(0,'hard');
ok('normal e difícil são sorteios separados (fecha o pulo pro 4x)',
   !!g.startersSorteados['0:normal'] && !!g.startersSorteados['0:hard']);
ok('o sorteio cobre TODOS os iniciais de hoje', S.STARTERS.every(id=>typeof JSON.parse(primeiro)[id] === 'boolean'),
   Object.keys(JSON.parse(primeiro)).length + ' de ' + S.STARTERS.length);
/* MIGRAÇÃO: conta que sorteou quando existiam só 3 iniciais tem 3 chaves gravadas. Ao entrar os
   de Johto, os que faltam precisam ser sorteados na hora e gravados -- sem apagar os antigos, que
   é justamente o que a trava anti save-scumming protege. */
g.startersSorteados = { '0:normal': { bulbasaur:true, charmander:false, squirtle:false } };
const migrado = S.sorteioDosIniciais(0,'normal');
ok('sorteio antigo de 3 chaves e completado, nao descartado',
   migrado.bulbasaur === true && S.STARTERS.every(id=>typeof migrado[id] === 'boolean'),
   JSON.stringify(migrado));
ok('e o resultado completado fica gravado (nao re-sorteia toda vez)',
   JSON.stringify(S.sorteioDosIniciais(0,'normal')) === JSON.stringify(migrado));
/* VAZAMENTO ENTRE SAVES -- a brecha que furava a trava inteira.
   `game.startersShiny` é escrito só na criação do save e não é serializado; o applySavedState não
   o toca. Sem recompor ao trocar de save, o sorteio de um slot atravessava pro outro: criar no
   slot 0 em DIFÍCIL (4x a chance), ver o shiny, ir pra home e abrir um save parado na tela 'start'
   do slot 1 dava um inicial shiny num save NORMAL -- e o sorteio do slot 1 continuava intacto pra
   ser usado depois. É o que a linha nova do continueSave conserta. */
g.startersSorteados = {
  '0:hard':   { bulbasaur:false, charmander:false, squirtle:false, chikorita:false, cyndaquil:false, totodile:true },
  '1:normal': { bulbasaur:false, charmander:false, squirtle:false, chikorita:false, cyndaquil:false, totodile:false }
};
g.startersShiny = S.sorteioDosIniciais(0,'hard');
ok('o sorteio do dificil traz o shiny dele', g.startersShiny.totodile === true);
// o que o continueSave faz ao abrir OUTRO save parado na escolha do inicial
g.startersShiny = S.sorteioDosIniciais(1,'normal');
ok('abrir outro save NAO carrega o shiny do slot anterior',
   !Object.keys(g.startersShiny).some(k=>g.startersShiny[k]),
   Object.keys(g.startersShiny).filter(k=>g.startersShiny[k]).join(',') || 'nenhum shiny');
g.startersSorteados['1:normal'].chikorita = true;
ok('e o save legitimo recupera o shiny que era dele',
   S.sorteioDosIniciais(1,'normal').chikorita === true);

g.startersSorteados = {};
S.sorteioDosIniciais(0,'normal'); S.sorteioDosIniciais(0,'hard');
S.encerrarTentativaDoSlot(0);
ok('a 1ª insígnia libera o slot pro próximo sorteio',
   !g.startersSorteados['0:normal'] && !g.startersSorteados['0:hard']);
g.startersSorteados = {};
for(let s=0;s<3;s++) for(const m of ['normal','hard']) S.sorteioDosIniciais(s,m);
ok('sorteios disponíveis sem jogar nada ficam limitados', Object.keys(g.startersSorteados).length===6,
   Object.keys(g.startersSorteados).length+' (3 slots x 2 modos)');


console.log('\n3) O GAME OVER ENCERRA A TENTATIVA');
/* A trava prende DUAS coisas ao slot: o sorteio de shiny dos iniciais e a semente dos encontros.
   Isso e o que faz apagar-e-recriar nao valer nada. Mas quem toma game over antes do primeiro
   ginasio NAO estava apagando pra trapacear -- a jornada dele acabou --, e recriar trazia os mesmos
   iniciais e os MESMOS selvagens em cada rota, jornada por jornada. */
const g0 = S.freshGameDefaults();
g0.authUser = null; g0.startersSorteados = {}; g0.geracaoDosSlots = {};
S.__setGame(g0);
const antesDoSorteio = JSON.stringify(S.sorteioDosIniciais(0, 'normal'));
const geracaoAntes = (S.__getGame().geracaoDosSlots||{})['0'] || 0;
S.encerrarTentativaDoSlot(0);
const est = S.__getGame();
ok('encerrar a tentativa libera o sorteio dos iniciais',
   !(est.startersSorteados||{})[S.chaveDoSorteio(0,'normal')]);
ok('e avanca a geracao do slot', ((est.geracaoDosSlots||{})['0']||0) === geracaoAntes + 1,
   geracaoAntes + ' -> ' + ((est.geracaoDosSlots||{})['0']||0));
ok('o slot vizinho nao e tocado', ((est.geracaoDosSlots||{})['1']||0) === 0);

/* O encontro de uma geracao nova tem que ser OUTRO -- e o da mesma geracao, o MESMO. */
function ofertaCom(geracao){
  const g = S.freshGameDefaults();
  g.currentSaveSlot = 0; g.rivalName = 'Gary'; g.starterId = 'charmander';
  g.gymIndex = 2; g.currentRoute = S.ROUTE_MAP[2][0].id; g.team = [];
  g.wildEncounterSeq = 3; g.saveGen = geracao;
  S.__setGame(g);
  S.goToWildEncounter();
  return resumo(S.__getGame().wildOffer);
}
const g1a = ofertaCom(0), g1b = ofertaCom(0), g2 = ofertaCom(1), g3 = ofertaCom(2);
ok('mesma geracao, mesma oferta (a trava continua de pe)', g1a === g1b);
ok('geracao nova traz encontro novo', g1a !== g2 && g2 !== g3, [g1a, g2, g3].join('  |  '));

/* O save nasce com a geracao CONGELADA: o proximo save daquele slot e que pega a seguinte. */
const gConta = S.freshGameDefaults();
gConta.geracaoDosSlots = { '0': 4 };
gConta.authUser = null;
S.__setGame(gConta);
ok('a geracao guardada na conta e a que o proximo save vai usar',
   ((S.__getGame().geracaoDosSlots||{})['0']) === 4);


/* Ponta a ponta, pelo caminho de verdade: uma batalha PERDIDA com o contador em 4 tem que
   terminar em game over E encerrar a tentativa do slot. E a checagem que pega alguem mexer no
   fluxo de derrota sem lembrar da trava. */
const gFim = S.freshGameDefaults();
gFim.currentSaveSlot = 0; gFim.authUser = null; gFim.gymIndex = 0; gFim.badgesEarned = [];
gFim.losses = 4;                                  // a próxima derrota é o game over
gFim.startersSorteados = { '0:normal': { charmander:false } };
gFim.geracaoDosSlots = {};
gFim.gameMode = 'normal'; gFim.starterId = 'charmander'; gFim.rivalName = 'Gary';
gFim.team = [S.createInstance('magikarp', 1)];    // nível 1 contra o 1º ginásio: derrota garantida
S.__setGame(gFim);
S.runBattle();
for(let i=0; i<80 && S.__getGame().screen==='battling'; i++){ S.advanceReveal(); }
const fim = S.__getGame();
ok('perder a 5ª leva ao game over', fim.screen==='gameover', 'tela: ' + fim.screen);
ok('e o game over libera o sorteio dos iniciais', !(fim.startersSorteados||{})['0:normal']);
ok('e troca os encontros do slot', ((fim.geracaoDosSlots||{})['0']||0) === 1,
   'geração: ' + ((fim.geracaoDosSlots||{})['0']||0));

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
