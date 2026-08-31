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
S.limparSorteioDosIniciais(0);
ok('a 1ª insígnia libera o slot pro próximo sorteio',
   !g.startersSorteados['0:normal'] && !g.startersSorteados['0:hard']);
g.startersSorteados = {};
for(let s=0;s<3;s++) for(const m of ['normal','hard']) S.sorteioDosIniciais(s,m);
ok('sorteios disponíveis sem jogar nada ficam limitados', Object.keys(g.startersSorteados).length===6,
   Object.keys(g.startersSorteados).length+' (3 slots x 2 modos)');

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
