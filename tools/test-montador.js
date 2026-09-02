#!/usr/bin/env node
/**
 * O MONTADOR DE TIME EM LISTA PAGINADA
 *
 * A tela onde se escolhe pokémon de QUALQUER save pra montar um time -- Torre dos Treinadores,
 * desafio do Ginásio da Cidade e defesa do Ginásio da Cidade. Era uma grade de quadradinhos por
 * save; virou lista com ordenação, filtro por tipo e uma linha por pokémon, paginada de 10 em 10
 * (02/09/2026).
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
 *   - a regra de não repetir espécie continua valendo ENTRE SAVES, inclusive entre PÁGINAS.
 *   - ordenar ou filtrar volta pra primeira página, e a página guardada é sempre clampada na hora
 *     de desenhar: as duas coisas evitam a mesma falha, que é a tela ficar vazia numa página que
 *     não existe mais.
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

/* DOIS SAVES com as 8 insígnias -- doze pokémon, ou seja, duas páginas de dez. O Alakazam está nos
   dois de propósito: a regra de "sem repetir espécie" vale na CONTA inteira, não dentro de um save,
   e com a paginação ela passou a valer TAMBÉM entre páginas. */
const KANTO = [
  ['charizard', 70], ['gyarados', 68], ['alakazam', 72],
  ['onix', 60], ['arcanine', 65], ['snorlax', 71]
];
const JOHTO = [
  ['typhlosion', 66], ['feraligatr', 69], ['ampharos', 64],
  ['umbreon', 63], ['steelix', 67], ['alakazam', 55]
];
function saveComTime(nome, lista, pref){
  return { customName:nome, badgeCount:8,
    team: lista.map(([e,l],i)=>({ id:pref+i, speciesId:e, level:l, shiny: e==='gyarados' })) };
}
function montaSaves(quantos){
  const g = S.__getGame();
  g.authUser = { uid:'u1' };
  g.saveSlots = [saveComTime('Kanto', KANTO, 'a')];
  if(quantos !== 1) g.saveSlots.push(saveComTime('Johto', JOHTO, 'b'));
  g.towerPick = [];
  S.__setGame(g);
  S.abrirMontador();
}
montaSaves();
const html = () => S.montadorDeTimeHtml(S.__getGame().towerPick, 'towerTogglePick', 6);
const contaEm = (t, re) => (t.match(re)||[]).length;
const linhas = (t) => contaEm(t, /class="mont-linha"/g);
const nomesNaTela = (t) => (t.match(/class="mont-nome">([^<]*)/g)||[]).map(x => x.replace(/class="mont-nome">/, '').trim());
/* A lista inteira, atravessando as páginas -- pro que se afirma sobre "os doze". Volta pra página
   em que estava, senão cada leitura mexeria no estado que o teste seguinte vai olhar. */
function todasAsPaginas(){
  const antes = S.__getGame().montadorPagina || 0;
  const vistas = [];
  for(let i=0; i<20; i++){
    S.montadorIrPara(i);
    const t = html();
    vistas.push(t);
    if(!t.includes('montadorIrPara(' + (i+1) + ')')) break;   // não há próxima
  }
  S.montadorIrPara(antes);
  return vistas.join('');
}

console.log('\n=== PAGINA DE DEZ ===');
{
  const p1 = html();
  ok('a primeira pagina traz dez dos doze', linhas(p1) === 10, linhas(p1) + ' linhas');
  ok('e diz onde voce esta', p1.includes('1–10 de 12'), (p1.match(/\d+–\d+ de \d+/g)||[]).join(' '));
  ok('com um botao por pagina', contaEm(p1, /class="mont-pag /g) === 2, contaEm(p1, /class="mont-pag /g) + ' botoes');
  ok('e o da pagina atual marcado', /class="mont-pag ativa"[^>]*montadorIrPara\(0\)/.test(p1));

  S.montadorIrPara(1);
  const p2 = html();
  ok('a segunda traz os dois que sobraram', linhas(p2) === 2, linhas(p2) + ' linhas');
  ok('e a conta acompanha', p2.includes('11–12 de 12'), (p2.match(/\d+–\d+ de \d+/g)||[]).join(' '));
  ok('agora o marcado e o 2', /class="mont-pag ativa"[^>]*montadorIrPara\(1\)/.test(p2));
  S.montadorIrPara(0);

  const tudo = todasAsPaginas();
  ok('somando as paginas, os doze estao la', linhas(tudo) === 12, linhas(tudo) + ' linhas');
  /* Ninguem aparece em duas paginas. A conta e por SLOT+IDX e nao por nome: o Alakazam esta nos
     dois saves de proposito, entao doze linhas dao onze nomes -- e uma checagem por nome acusaria
     um defeito que nao existe. */
  const identidades = (tudo.match(/towerTogglePick\(\d+,\d+\)/g)||[]);
  ok('sem repetir ninguem entre as paginas', new Set(identidades).size === 12,
     new Set(identidades).size + ' de ' + identidades.length);
}

console.log('\n=== COM UMA PAGINA SO, OS BOTOES NAO APARECEM ===');
{
  /* Quem tem um save tem seis pokemon, e um "1 de 1" embaixo da lista e um controle que nao
     controla nada. */
  montaSaves(1);
  const t = html();
  ok('seis pokemon cabem numa pagina', linhas(t) === 6, linhas(t) + ' linhas');
  ok('e nao ha navegacao nenhuma', !t.includes('mont-paginas') && !t.includes('mont-pag'),
     t.includes('mont-paginas') ? 'apareceu' : 'limpo');
  montaSaves();
}

console.log('\n=== UMA LINHA POR POKEMON, COM TUDO QUE SE PRECISA PRA ESCOLHER ===');
{
  const t = html();
  ok('cada linha traz o sprite', contaEm(t, /sprite-sm/g) === 10, contaEm(t, /sprite-sm/g) + ' sprites');
  ok('o nome de cada um', nomesNaTela(t).length === 10, nomesNaTela(t).slice(0,3).join(', '));
  ok('o nivel', contaEm(t, /mont-lv">— Lv\.\d+/g) === 10, (t.match(/mont-lv">— Lv\.\d+/g)||[]).slice(0,3).join(', '));
  ok('os tipos', contaEm(t, /type-pill/g) >= 10, contaEm(t, /type-pill/g) + ' selos');
  /* De QUE TIME o bicho e: sem isso a lista vira um monte indistinto, e a pessoa nao sabe de onde
     tirou o Alakazam que escolheu -- ainda mais agora que os dois xaras caem em paginas diferentes. */
  const tudo = todasAsPaginas();
  ok('e de que time ele e', contaEm(tudo, /mont-time">Kanto/g) === 6 && contaEm(tudo, /mont-time">Johto/g) === 6,
     contaEm(tudo, /mont-time">Kanto/g) + ' Kanto, ' + contaEm(tudo, /mont-time">Johto/g) + ' Johto');
  ok('o shiny aparece com a estrela', contaEm(tudo, /🌟/g) === 1);
  /* A GRADE POR SAVE SAIU: se o agrupamento voltar sem querer, esta linha acusa. */
  ok('e a grade antiga por save nao existe mais', !tudo.includes('tower-pick-group'));
}

console.log('\n=== A LUPA: IRMA DO CARD, NUNCA FILHA ===');
{
  const t = html();
  ok('uma lupa por linha', contaEm(t, /class="wild-dex"/g) === 10, contaEm(t, /class="wild-dex"/g) + ' lupas');
  ok('e ela abre a ficha da Pokedex', contaEm(t, /onclick="abrirPokedexFicha\(/g) === 10);
  /* O QUE DE VERDADE IMPORTA: nenhum <button> dentro do <button> do card. O navegador fecha o de
     fora sozinho e o clique de dentro some -- e a tela continua PARECENDO certa. */
  const dentro = todasAsPaginas().split('<button class="mont-card').slice(1)
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
  const niveis = (todasAsPaginas().match(/mont-lv">— Lv\.(\d+)/g)||[]).map(x => Number(x.match(/\d+/)[0]));
  ok('nivel comeca decrescente (o mais forte primeiro)',
     niveis.every((n,i) => i===0 || niveis[i-1] >= n), niveis.join(' '));
  ok('e o topo e o Alakazam 72', niveis[0] === 72, String(niveis[0]));
  ok('a ordem atravessa a virada de pagina', niveis.length === 12 && niveis[niveis.length-1] === 55,
     'ultimo: ' + niveis[niveis.length-1]);

  S.montadorOrdenar('az');
  const nomes = nomesNaTela(todasAsPaginas()).map(n => n.replace(/ 🌟$/,''));
  const ordenados = nomes.slice().sort((a,b)=>a.localeCompare(b));
  ok('A-Z ordena pelo nome', JSON.stringify(nomes) === JSON.stringify(ordenados), nomes.join(', '));

  S.montadorOrdenar('time');
  const times = (todasAsPaginas().match(/mont-time">(Kanto|Johto)/g)||[]).map(x => x.split('>')[1]);
  ok('por time volta ao agrupamento antigo (os 6 de um, os 6 do outro)',
     times.slice(0,6).every(x=>x==='Kanto') && times.slice(6).every(x=>x==='Johto'), times.join(','));
  /* Desempate explicito: sem ele, dois pokemon de mesmo nivel trocam de lugar entre um render e
     outro -- e a lista pisca debaixo do dedo de quem vai clicar. */
  S.montadorOrdenar('nivel');
  ok('e a mesma ordenacao roda igual duas vezes', html() === html());
}

console.log('\n=== ORDENAR OU FILTRAR VOLTA PRA PRIMEIRA PAGINA ===');
{
  /* Filtrar por Fogo estando na pagina 2 deixaria a tela VAZIA: a lista encolheu pra tres e a
     pagina 2 nao existe mais. */
  S.montadorIrPara(1);
  S.montadorOrdenar('az');
  ok('ordenar volta pra pagina 1', (S.__getGame().montadorPagina||0) === 0, String(S.__getGame().montadorPagina));
  S.montadorIrPara(1);
  S.montadorFiltrarTipo('Fire');
  ok('filtrar tambem', (S.__getGame().montadorPagina||0) === 0, String(S.__getGame().montadorPagina));
  ok('e a tela nao fica vazia', linhas(html()) === 3, linhas(html()) + ' linhas');
  S.montadorFiltrarTipo(null);
  S.montadorOrdenar('nivel');

  /* E MESMO ASSIM a pagina guardada e clampada na hora de desenhar. Ela pode ficar velha sem passar
     por ordenar nem filtrar: desmarcar um escolhido que estava fora do filtro encolhe a lista, e
     isso e capaz de apagar a ultima pagina debaixo de quem esta nela. */
  S.montadorIrPara(9);
  const longe = html();
  ok('pagina que nao existe cai na ultima que existe', linhas(longe) === 2, linhas(longe) + ' linhas');
  ok('e o clamp devolve a pagina certa', S.montadorPaginaValida(12) === 1, String(S.montadorPaginaValida(12)));
  /* E GRAVA a correcao: deixar o guardado velho faria a pagina ressurgir sozinha quando a lista
     voltasse a crescer -- o jogador desmarca um, fica na pagina 1, marca outro e a tela pula pra
     pagina 2 sem ele ter pedido. O que esta guardado tem que ser o que esta na tela. */
  ok('e o guardado passa a ser o que esta na tela', (S.__getGame().montadorPagina||0) === 1,
     String(S.__getGame().montadorPagina));
  S.montadorPaginaValida(3);   // lista encolheu pra uma pagina
  ok('lista encolhida devolve pra primeira pagina, e grava', (S.__getGame().montadorPagina||0) === 0,
     String(S.__getGame().montadorPagina));
  ok('dez por pagina', S.MONT_POR_PAGINA === 10, String(S.MONT_POR_PAGINA));
  S.montadorIrPara(0);
}

console.log('\n=== FILTRO POR TIPO ===');
{
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
  ok('filtrando por Fogo sobram tres', linhas(fogo) === 3, nomesNaTela(fogo).join(', '));
  ok('e sao os certos', ['Charizard','Arcanine','Typhlosion'].every(n => fogo.includes('>'+n)), nomesNaTela(fogo).join(', '));
  ok('o filtro fica marcado no combo', /<option value="Fire" selected>/.test(fogo));
  ok('e com tres nao ha paginacao', !fogo.includes('mont-paginas'));

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
  ok('filtro de um tipo que ninguem tem e ignorado, nao esvazia a tela', linhas(sobra) === 10,
     linhas(sobra) + ' linhas');
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
  /* O xara e o de nivel 55: por nivel decrescente ele cai na PAGINA 2. A regra vale igual la. */
  const tudo = todasAsPaginas();
  ok('e a linha dele fica desabilitada, dizendo por que -- mesmo noutra pagina',
     /espécie já escolhida/.test(tudo), (tudo.match(/title="Alakazam[^"]*"/g)||[]).join(' | '));
  /* A LUPA SOBREVIVE AO CARD DESABILITADO: ela e irma, entao o disabled do card nao a alcanca. */
  const linhaBloqueada = tudo.split('<div class="mont-linha">').find(p => p.includes('disabled'));
  ok('mas a lupa dela continua clicavel', !!linhaBloqueada && linhaBloqueada.includes('class="wild-dex"')
     && !/class="wild-dex"[^>]*disabled/.test(linhaBloqueada));

  /* A ORDEM DA ESCOLHA E A ORDEM DE BATALHA -- e ela conta a escolha, nao a posicao na pagina. */
  const gy = todos.find(p => p.speciesId==='gyarados');
  S.towerTogglePick(gy.slot, gy.idx);
  const t2 = html();
  ok('a ordem de escolha aparece na linha', t2.includes('mont-num">1º') && t2.includes('mont-num">2º'),
     (t2.match(/mont-num">\d+º/g)||[]).join(' '));
  ok('e o segundo escolhido e mesmo o Gyarados',
     (S.__getGame().towerPick||[])[1].speciesId === 'gyarados');

  /* Escolher NAO pode mexer na pagina: a lista nao muda de ordem, entao a linha tocada fica onde
     estava -- se a tela pulasse pro topo a cada toque, montar seis viraria um exercicio. */
  S.montadorIrPara(1);
  const antes = S.__getGame().montadorPagina;
  const naSegunda = S.towerEligiblePokemon().find(p => p.speciesId==='onix');
  S.towerTogglePick(naSegunda.slot, naSegunda.idx);
  ok('escolher nao troca de pagina', S.__getGame().montadorPagina === antes,
     'era ' + antes + ', ficou ' + S.__getGame().montadorPagina);
  S.montadorIrPara(0);

  /* Teto de 6: o setimo nao entra, e a tela mostra os outros apagados. */
  montaSaves();
  S.towerEligiblePokemon().slice(0, 7).forEach(p => S.towerTogglePick(p.slot, p.idx));
  ok('o teto de 6 vale', (S.__getGame().towerPick||[]).length === 6, (S.__getGame().towerPick||[]).length + ' escolhidos');
  const cheio = todasAsPaginas();
  ok('e com o time cheio o resto fica desabilitado', contaEm(cheio, /class="mont-card[^"]*off/g) === 6,
     contaEm(cheio, /class="mont-card[^"]*off/g) + ' apagados');
}

console.log('\n=== ORDENACAO, FILTRO E PAGINA ZERAM A CADA ENTRADA ===');
{
  /* Um filtro ligado na Torre chegaria no ginasio parecendo que metade do bicharedo sumiu -- e uma
     pagina 2 herdada mostraria a tela pelo meio. */
  S.montadorOrdenar('az');
  S.montadorFiltrarTipo('Fire');
  S.montadorIrPara(1);
  S.abrirMontador();
  const g = S.__getGame();
  ok('a ordenacao volta pro nivel', g.montadorOrdem === 'nivel', String(g.montadorOrdem));
  ok('o filtro sai', g.montadorTipo === null, String(g.montadorTipo));
  ok('e a pagina volta pra primeira', (g.montadorPagina||0) === 0, String(g.montadorPagina));
  /* E nada disso vai pro save: e estado de tela. */
  const salvo = S.serializeGame ? S.serializeGame() : null;
  if(salvo) ok('e nao entram no save', !Object.keys(salvo).some(k => k.startsWith('montador')),
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
  ok('a defesa do ginasio desenha a lista paginada', linhas(defesa) === 10 && defesa.includes('1–10 de 12'),
     linhas(defesa) + ' linhas');
  ok('com os controles de ordenacao', defesa.includes('class="mont-ord') && defesa.includes('<select class="mont-tipo"'));
  ok('e as lupas', contaEm(defesa, /class="wild-dex"/g) === 10);

  const gt = S.__getGame();
  gt.tower = { floors:[], run:{ floor:1, cleared:false, team:null }, rareCandies:0 };
  gt.towerPick = []; gt.towerTrocandoTime = false;
  S.__setGame(gt);
  const torre = S.renderTrainerTower();
  ok('a Torre desenha a mesma lista', linhas(torre) === 10 && torre.includes('1–10 de 12'),
     linhas(torre) + ' linhas');
  ok('com controles, lupas e paginacao', torre.includes('class="mont-ord') && torre.includes('<select class="mont-tipo"')
     && contaEm(torre, /class="wild-dex"/g) === 10 && torre.includes('mont-paginas'));
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
