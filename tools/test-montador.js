#!/usr/bin/env node
/**
 * O MONTADOR DE TIME EM LISTA
 *
 * A tela onde se escolhe pokémon de QUALQUER save pra montar um time -- Torre dos Treinadores,
 * desafio do Ginásio da Cidade e defesa do Ginásio da Cidade. Era uma grade de quadradinhos por
 * save; virou lista com ordenação, filtro por tipo e uma linha por pokémon (02/09/2026).
 *
 * O que este teste tranca, e por quê:
 *   - a LUPA é IRMÃ do card, nunca filha. <button> dentro de <button> é HTML inválido: o navegador
 *     "conserta" fechando o de fora, e o clique de dentro se perde. Isso já aconteceu no encontro
 *     selvagem e o defeito não aparece em teste que só procura a lupa na string.
 *   - a lupa continua clicável com o card DESABILITADO -- descendente de button desabilitado não
 *     recebe clique nenhum, e é justamente com o time cheio que dá vontade de ver a ficha de quem
 *     ficou de fora.
 *   - o FILTRO nunca esconde um escolhido: desmarcar é clicar nele de novo, então escondê-lo
 *     deixaria um pokémon preso no time.
 *   - a regra de não repetir espécie continua valendo ENTRE SAVES.
 *
 *   node tools/test-montador.js
 */
const { createSandbox } = require('./game-sandbox');
const S = createSandbox();

let falhas = 0;
function ok(titulo, cond, extra){
  if(cond){ console.log('  OK     ' + titulo + (extra ? '   ' + extra : '')); }
  else { falhas++; console.log('  FALHOU ' + titulo + (extra ? '   ' + extra : '')); }
}

/* DOIS SAVES com as 8 insígnias. O Alakazam está nos dois de propósito: a regra de "sem repetir
   espécie" vale na CONTA inteira, não dentro de um save. */
const KANTO = [
  ['charizard', 70], ['gyarados', 68], ['alakazam', 72],
  ['onix', 60], ['arcanine', 65], ['snorlax', 71]
];
const JOHTO = [
  ['typhlosion', 66], ['feraligatr', 69], ['ampharos', 64],
  ['umbreon', 63], ['steelix', 67], ['alakazam', 55]
];
function montaSaves(){
  const g = S.__getGame();
  g.authUser = { uid:'u1' };
  g.saveSlots = [
    { customName:'Kanto', badgeCount:8, team: KANTO.map(([e,l],i)=>({ id:'a'+i, speciesId:e, level:l, shiny: e==='gyarados' })) },
    { customName:'Johto', badgeCount:8, team: JOHTO.map(([e,l],i)=>({ id:'b'+i, speciesId:e, level:l, shiny:false })) }
  ];
  g.towerPick = [];
  S.__setGame(g);
  S.abrirMontador();
}
montaSaves();
const html = () => S.montadorDeTimeHtml(S.__getGame().towerPick, 'towerTogglePick', 6);
const nomesNaTela = (t) => (t.match(/class="mont-nome">([^<]*)/g)||[]).map(x => x.replace(/class="mont-nome">/, '').replace(/&nbsp;/g,' ').trim());

console.log('\n=== UMA LINHA POR POKEMON, COM TUDO QUE SE PRECISA PRA ESCOLHER ===');
{
  const t = html();
  ok('doze linhas -- uma por pokemon dos dois saves', (t.match(/class="mont-linha"/g)||[]).length === 12,
     (t.match(/class="mont-linha"/g)||[]).length + ' linhas');
  ok('cada linha traz o sprite', (t.match(/sprite-sm/g)||[]).length === 12);
  ok('o nome de cada um', nomesNaTela(t).length === 12, nomesNaTela(t).slice(0,3).join(', '));
  ok('o nivel', (t.match(/mont-lv">— Lv\.\d+/g)||[]).length === 12,
     (t.match(/mont-lv">— Lv\.(\d+)/g)||[]).slice(0,3).join(', '));
  ok('os tipos', (t.match(/type-pill/g)||[]).length >= 12, (t.match(/type-pill/g)||[]).length + ' selos');
  /* De QUE TIME o bicho e: sem isso a lista de 12 vira um monte indistinto, e a pessoa nao sabe
     de onde tirou o Alakazam que escolheu. */
  ok('e de que time ele e', (t.match(/mont-time">Kanto/g)||[]).length === 6 && (t.match(/mont-time">Johto/g)||[]).length === 6,
     (t.match(/mont-time">Kanto/g)||[]).length + ' Kanto, ' + (t.match(/mont-time">Johto/g)||[]).length + ' Johto');
  ok('o shiny aparece com a estrela', (t.match(/🌟/g)||[]).length === 1);
  /* A GRADE POR SAVE SAIU: se o agrupamento voltar sem querer, esta linha acusa. */
  ok('e a grade antiga por save nao existe mais', !t.includes('tower-pick-group'));
}

console.log('\n=== A LUPA: IRMA DO CARD, NUNCA FILHA ===');
{
  const t = html();
  ok('uma lupa por linha', (t.match(/class="wild-dex"/g)||[]).length === 12,
     (t.match(/class="wild-dex"/g)||[]).length + ' lupas');
  ok('e ela abre a ficha da Pokedex', (t.match(/onclick="abrirPokedexFicha\(/g)||[]).length === 12);
  /* O QUE DE VERDADE IMPORTA: nenhum <button> dentro do <button> do card. O navegador fecha o de
     fora sozinho e o clique de dentro some -- e a tela continua PARECENDO certa. */
  const dentro = t.split('<button class="mont-card').slice(1)
    .map(p => p.slice(0, p.indexOf('</button>')))
    .filter(p => p.includes('<button'));
  ok('nenhuma lupa dentro do botao do card', dentro.length === 0, dentro.length + ' aninhadas');
  /* E a ficha abre de verdade a partir da lista -- ela e anexada pelo render principal, entao
     serve em qualquer tela. */
  S.abrirPokedexFicha('charizard', false);
  ok('e a ficha abre a partir dessa tela', /Charizard/.test(S.renderPokedexFicha()));
  S.__setGame(Object.assign(S.__getGame(), { pokedexFicha: null }));
}

console.log('\n=== ORDENAR: NIVEL, A-Z E POR TIME ===');
{
  S.montadorOrdenar('nivel');
  const niveis = (html().match(/Lv\.(\d+)/g)||[]).map(x => Number(x.slice(3)));
  ok('nivel comeca decrescente (o mais forte primeiro)',
     niveis.every((n,i) => i===0 || niveis[i-1] >= n), niveis.join(' '));
  ok('e o topo e o Alakazam 72', niveis[0] === 72, String(niveis[0]));

  S.montadorOrdenar('az');
  const nomes = nomesNaTela(html()).map(n => n.replace(/ 🌟$/,''));
  const ordenados = nomes.slice().sort((a,b)=>a.localeCompare(b));
  ok('A-Z ordena pelo nome', JSON.stringify(nomes) === JSON.stringify(ordenados), nomes.join(', '));

  S.montadorOrdenar('time');
  const times = (html().match(/mont-time">(Kanto|Johto)/g)||[]).map(x => x.split('>')[1]);
  ok('por time volta ao agrupamento antigo (os 6 de um, os 6 do outro)',
     times.slice(0,6).every(x=>x==='Kanto') && times.slice(6).every(x=>x==='Johto'), times.join(','));
  /* Os dois Alakazam tem niveis diferentes, mas o desempate explicito e o que impede a lista de
     trocar de ordem entre um render e outro -- piscando debaixo do dedo de quem vai clicar. */
  S.montadorOrdenar('nivel');
  ok('e a mesma ordenacao roda igual duas vezes', html() === html());
}

console.log('\n=== FILTRO POR TIPO ===');
{
  S.montadorOrdenar('nivel');
  const t = html();
  /* So os tipos que EXISTEM: um combo com os 17 ofereceria filtros que devolvem lista vazia. */
  const tipos = S.montadorTiposDisponiveis(S.towerEligiblePokemon());
  ok('o combo traz so os tipos que existem nos times', tipos.length > 0 && tipos.length < 17,
     tipos.map(x=>x.tipo+':'+x.quantos).join(' '));
  ok('sem tipo que ninguem tem', !tipos.some(x => x.tipo === 'Ghost'), tipos.map(x=>x.tipo).join(','));
  ok('com a contagem de cada um -- Fogo sao tres', (tipos.find(x=>x.tipo==='Fire')||{}).quantos === 3,
     JSON.stringify(tipos.find(x=>x.tipo==='Fire')));
  ok('e o combo esta na tela como <select>', t.includes('<select class="mont-tipo"') && t.includes('Todos os tipos (12)'));

  S.montadorFiltrarTipo('Fire');
  const fogo = html();
  ok('filtrando por Fogo sobram tres', (fogo.match(/class="mont-linha"/g)||[]).length === 3,
     nomesNaTela(fogo).join(', '));
  ok('e sao os certos', ['Charizard','Arcanine','Typhlosion'].every(n => fogo.includes('>'+n)), nomesNaTela(fogo).join(', '));
  ok('o filtro fica marcado no combo', /<option value="Fire" selected>/.test(fogo));

  /* O FILTRO NUNCA ESCONDE UM ESCOLHIDO. Marcar o Gyarados (Agua) e filtrar por Fogo o tiraria da
     tela -- e como desmarcar e clicar nele de novo, ele ficaria preso no time. */
  S.montadorFiltrarTipo(null);
  const gy = S.towerEligiblePokemon().find(p => p.speciesId === 'gyarados');
  S.towerTogglePick(gy.slot, gy.idx);
  S.montadorFiltrarTipo('Fire');
  const comEscolhido = html();
  ok('o escolhido continua na tela mesmo fora do filtro', comEscolhido.includes('>Gyarados'),
     nomesNaTela(comEscolhido).join(', '));
  ok('e da pra desmarcar', (()=>{ S.towerTogglePick(gy.slot, gy.idx); return (S.__getGame().towerPick||[]).length === 0; })());

  /* NAO EXISTE estado de "nenhum resultado", e isso e de propósito: o combo so oferece tipo que
     ALGUEM tem, entao tipo escolhido nele sempre devolve alguem. O que pode acontecer e um filtro
     VELHO sobrar de outra tela -- e ai a lista volta INTEIRA, porque mostrar tudo e melhor que
     mostrar nada. */
  S.montadorFiltrarTipo('Dragon');
  const sobra = html();
  ok('filtro de um tipo que ninguem tem e ignorado, nao esvazia a tela',
     (sobra.match(/class="mont-linha"/g)||[]).length === 12,
     (sobra.match(/class="mont-linha"/g)||[]).length + ' linhas');
  ok('e o combo volta pra "Todos os tipos"', /<option value="" selected>/.test(sobra));
  S.montadorFiltrarTipo(null);
}

console.log('\n=== A ESCOLHA: SEM REPETIR ESPECIE, E A ORDEM E A DA BATALHA ===');
{
  montaSaves();
  const todos = S.towerEligiblePokemon();
  const alaKanto = todos.find(p => p.speciesId==='alakazam' && p.slot===0);
  const alaJohto = todos.find(p => p.speciesId==='alakazam' && p.slot===1);
  S.towerTogglePick(alaKanto.slot, alaKanto.idx);
  ok('escolher um marca', (S.__getGame().towerPick||[]).length === 1);
  S.towerTogglePick(alaJohto.slot, alaJohto.idx);
  ok('e o xara do OUTRO save nao entra -- a especie ja esta no time',
     (S.__getGame().towerPick||[]).length === 1, JSON.stringify(S.__getGame().towerPick.map(p=>p.slot+':'+p.speciesId)));
  const t = html();
  ok('e a linha dele fica desabilitada, dizendo por que',
     /especie ja escolhida|espécie já escolhida/.test(t), (t.match(/title="Alakazam[^"]*"/g)||[]).join(' | '));
  /* A LUPA SOBREVIVE AO CARD DESABILITADO: ela e irma, entao o disabled do card nao a alcanca.
     E com o time cheio que da vontade de ver a ficha de quem ficou de fora. */
  const linhaBloqueada = t.split('<div class="mont-linha">').find(p => p.includes('disabled'));
  ok('mas a lupa dela continua clicavel', linhaBloqueada && linhaBloqueada.includes('class="wild-dex"')
     && !/class="wild-dex"[^>]*disabled/.test(linhaBloqueada));

  /* A ORDEM DA ESCOLHA E A ORDEM DE BATALHA -- por isso ela aparece na linha. */
  const gy = todos.find(p => p.speciesId==='gyarados');
  S.towerTogglePick(gy.slot, gy.idx);
  const t2 = html();
  ok('a ordem de escolha aparece na linha', t2.includes('mont-num">1º') && t2.includes('mont-num">2º'),
     (t2.match(/mont-num">\d+º/g)||[]).join(' '));
  ok('e o segundo escolhido e mesmo o Gyarados',
     (S.__getGame().towerPick||[])[1].speciesId === 'gyarados');

  /* Teto de 6: o setimo nao entra, e a tela mostra os outros apagados. */
  montaSaves();
  S.towerEligiblePokemon().slice(0, 7).forEach(p => S.towerTogglePick(p.slot, p.idx));
  ok('o teto de 6 vale', (S.__getGame().towerPick||[]).length === 6, (S.__getGame().towerPick||[]).length + ' escolhidos');
  const cheio = html();
  ok('e com o time cheio o resto fica desabilitado',
     (cheio.match(/class="mont-card[^"]*off/g)||[]).length === 6,
     (cheio.match(/class="mont-card[^"]*off/g)||[]).length + ' apagados');
}

console.log('\n=== ORDENACAO E FILTRO ZERAM A CADA ENTRADA ===');
{
  /* Um filtro ligado na Torre chegaria no ginasio parecendo que metade do bicharedo sumiu. */
  S.montadorOrdenar('az');
  S.montadorFiltrarTipo('Fire');
  S.abrirMontador();
  const g = S.__getGame();
  ok('a ordenacao volta pro nivel', g.montadorOrdem === 'nivel', String(g.montadorOrdem));
  ok('e o filtro sai', g.montadorTipo === null, String(g.montadorTipo));
  /* E eles nao vao pro save: sao estado de tela. */
  const salvo = S.serializeGame ? S.serializeGame() : null;
  if(salvo) ok('e nao entram no save', !('montadorOrdem' in salvo) && !('montadorTipo' in salvo),
     Object.keys(salvo).filter(k=>k.startsWith('montador')).join(',') || 'nenhum');
}

console.log('\n=== AS TRES TELAS USAM A MESMA LISTA ===');
{
  /* Tres copias divergiriam na regra de "nao repetir especie", que e a parte que o jogador ve. */
  montaSaves();
  const g = S.__getGame();
  g.neighborhoodGymDefensePick = [];
  g.neighborhoodGymLocation = { city:'Sorocaba', countryCode:'BR' };
  g.neighborhoodGymDetail = { hasLeader:false, leaderTeamPreview:[], leaderTerrain:null };
  S.__setGame(g);
  const defesa = S.renderNeighborhoodGymTeamPicker();
  ok('a defesa do ginasio desenha a lista', (defesa.match(/class="mont-linha"/g)||[]).length === 12,
     (defesa.match(/class="mont-linha"/g)||[]).length + ' linhas');
  ok('com os controles de ordenacao', defesa.includes('class="mont-ord') && defesa.includes('<select class="mont-tipo"'));
  ok('e as lupas', (defesa.match(/class="wild-dex"/g)||[]).length === 12);

  /* A TORRE -- a terceira tela, e a que deu origem ao montador. */
  const gt = S.__getGame();
  gt.tower = { floors:[], run:{ floor:1, cleared:false, team:null }, rareCandies:0 };
  gt.towerPick = []; gt.towerTrocandoTime = false;
  S.__setGame(gt);
  const torre = S.renderTrainerTower();
  ok('a Torre desenha a mesma lista', (torre.match(/class="mont-linha"/g)||[]).length === 12,
     (torre.match(/class="mont-linha"/g)||[]).length + ' linhas');
  ok('com controles e lupas', torre.includes('class="mont-ord') && torre.includes('<select class="mont-tipo"')
     && (torre.match(/class="wild-dex"/g)||[]).length === 12);
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
