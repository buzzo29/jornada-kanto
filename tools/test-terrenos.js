/**
 * TERRENOS -- a contagem por tipo.
 *
 * O terreno da partida e sorteado da lista, e quem for do tipo dele ganha 1,15x em TODOS os
 * atributos (~15 niveis de vantagem, ver CLAUDE.md). Entao a quantidade de terrenos de cada tipo
 * E balanceamento: um tipo com mais terrenos que os outros ganha o buff com mais frequencia.
 *
 * Isso ja falhou de um jeito silencioso: quando Sombrio e Aco entraram no jogo com Johto, eles
 * ficaram com ZERO terrenos -- um Umbreon ou um Steelix nunca ganhava o bonus, em partida nenhuma,
 * e nada no jogo indicava isso.
 *
 *   node tools/test-terrenos.js
 */
const path = require('path');
const fs = require('fs');
const { createSandbox } = require('./game-sandbox');
const S = createSandbox(path.join(__dirname, '..', 'index.html'));

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const T = S.TERRAINS;
const TIPOS = Object.keys(S.TYPE_CHART);
const conta = {};
TIPOS.forEach(t => conta[t] = 0);
T.forEach(ter => ter.types.forEach(t => { conta[t] = (conta[t] || 0) + 1; }));

console.log('\nCOBERTURA');
ok('todo tipo do TYPE_CHART tem terreno', TIPOS.every(t => conta[t] > 0),
   TIPOS.filter(t => !conta[t]).join(',') || '');
const tipoDesconhecido = [...new Set(T.flatMap(t => t.types))].filter(t => !S.TYPE_CHART[t]);
ok('nenhum terreno usa tipo que nao existe', tipoDesconhecido.length === 0, tipoDesconhecido.join(','));

console.log('\nEQUILIBRIO (o buff de terreno vale ~15 niveis -- ninguem pode ter mais chance)');
const valores = [...new Set(TIPOS.map(t => conta[t]))];
ok('todos os tipos tem a MESMA quantidade de terrenos', valores.length === 1,
   valores.length === 1 ? valores[0] + ' cada' :
   TIPOS.map(t => t + '=' + conta[t]).join(' '));
TIPOS.sort().forEach(t => console.log('         ' + t.padEnd(10) + conta[t]));

console.log('\nAS TRES TABELAS DE TIPO ANDAM JUNTAS');
/* TYPE_CHART decide a batalha; TYPE_NAMES_PT e TYPE_COLORS decidem o selo na tela. Quando Sombrio
   e Aço entraram no chart e não nas outras duas, o selo de um Umbreon saía escrito "Dark", em
   inglês, num cinza genérico -- e nada quebrava. */
const semNome = TIPOS.filter(t => !S.TYPE_NAMES_PT[t]);
const semCor  = TIPOS.filter(t => !S.TYPE_COLORS[t]);
ok('todo tipo tem nome em portugues', semNome.length === 0, semNome.join(','));
ok('todo tipo tem cor', semCor.length === 0, semCor.join(','));
const sobrandoNome = Object.keys(S.TYPE_NAMES_PT).filter(t => !S.TYPE_CHART[t]);
ok('nenhum nome sobrando de tipo que nao existe', sobrandoNome.length === 0, sobrandoNome.join(','));
/* pickGymTerrain traduz o nome do ginasio (em portugues) de volta pro ingles pra achar o terreno.
   Sem o tipo no TYPE_NAMES_PT ele devolve null e o terreno cai no sorteio geral -- o ginasio da
   Jasmine ficava com um terreno qualquer entre os 51, em vez de um do dominio dele. */
const semTraducao = S.KANTO_GYMS.concat(S.JOHTO_GYMS)
  .filter(g => !S.englishTypeFromPortuguese(g.gymTypeName));
ok('o tipo de todo ginasio volta do portugues pro ingles', semTraducao.length === 0,
   semTraducao.map(g => g.leaderName + ' (' + g.gymTypeName + ')').join(', '));
const semTerrenoProprio = S.KANTO_GYMS.concat(S.JOHTO_GYMS).filter(g => {
  const en = S.englishTypeFromPortuguese(g.gymTypeName);
  return !en || !T.some(t => t.types.includes(en));
});
ok('todo ginasio tem terreno do dominio dele', semTerrenoProprio.length === 0,
   semTerrenoProprio.map(g => g.leaderName).join(', '));

console.log('\nIDENTIDADE');
ok('nenhum id de terreno repetido', new Set(T.map(t => t.id)).size === T.length, String(T.length));
ok('nenhum nome de terreno repetido', new Set(T.map(t => t.name)).size === T.length);
ok('todo terreno tem nome, icone e ao menos um tipo',
   T.every(t => t.id && t.name && t.icon && Array.isArray(t.types) && t.types.length >= 1));

console.log('\nAS DUAS COPIAS (a tabela e duplicada no servidor)');
const bloco = arq => {
  const t = fs.readFileSync(path.join(__dirname, '..', arq), 'utf8');
  const i = t.indexOf('const TERRAINS = [');
  return t.slice(i, t.indexOf('\n];', i) + 3);
};
ok('TERRAINS identica em index.html e functions/index.js',
   bloco('index.html') === bloco('functions/index.js'));

console.log('\nTODA ESPECIE PODE PEGAR TERRENO');
const semTerreno = Object.keys(S.SPECIES).filter(id =>
  !S.SPECIES[id].types.some(t => conta[t] > 0));
ok('nenhuma especie fica sem terreno possivel', semTerreno.length === 0,
   semTerreno.slice(0,8).join(','));


/* ============================================================================
   A CENA DE BATALHA: o fundo de cada terreno e onde cada lutador poe o pe.

   ⚠️ O QUE ESTE BLOCO EXISTE PRA PEGAR E O DEFEITO QUE NAO DA ERRO: o fundo da cena sai de um
   SELETOR DE ATRIBUTO (`[style*="--battle-atlas:0;"]`), entao um espaco a mais depois dos
   dois-pontos, um ponto-e-virgula que sumiu ou um arquivo com o nome trocado fazem o cenario sair
   VAZIO -- sem erro no console, sem quebrar teste nenhum, e a tela continua desenhando os dois
   lutadores sobre a cor de espera. E o mesmo tipo de armadilha da classe fantasma e do
   `[hidden]` que nao vence o display.
   ============================================================================ */
console.log('\nCENA DE BATALHA -- o fundo');
const htmlCena = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const dirAssets = path.join(__dirname, '..', 'assets', 'batalha');

/* toda imagem que o CSS pede, com o seletor que a pede */
const regrasImg = [];
htmlCena.replace(/\.battle-vs\.battle-scene([^{]*)\{([^}]*background-image:url\("([^"]+)"\)[^}]*)\}/g,
  (t, sel, corpo, url) => { regrasImg.push({ sel: sel.trim(), corpo, url, pos: htmlCena.indexOf(t) }); return t; });

ok('o CSS pede imagem de fundo pra cena', regrasImg.length >= 7, regrasImg.length + ' regras');
const semArquivo = regrasImg.filter(r => !fs.existsSync(path.join(__dirname, '..', r.url)));
ok('toda imagem pedida pelo CSS existe em disco', semArquivo.length === 0,
   semArquivo.map(r => r.url).join(', '));

/* ⚠️ AS TRES CENAS DEDICADAS sao a cena INTEIRA, nao um slot da folha 3x3 -- elas PRECISAM
   sobrescrever o background-size, senao sairiam recortadas em 1/9. E elas tem que vir DEPOIS das
   do atlas: as duas alcancam a mesma cena com a mesma especificidade, entao quem vence e a
   ultima. */
const dedicadas = regrasImg.filter(r => r.sel.indexOf('--battle-scene-id:') >= 0);
const doAtlas   = regrasImg.filter(r => r.sel.indexOf('--battle-atlas:') >= 0);
ok('ha regra de atlas e regra de cena dedicada', doAtlas.length >= 6 && dedicadas.length >= 1,
   doAtlas.length + ' atlas / ' + dedicadas.length + ' dedicadas');
ok('toda cena dedicada sobrescreve o background-size',
   dedicadas.every(r => /background-size:100% 100%/.test(r.corpo)),
   dedicadas.filter(r => !/background-size:100% 100%/.test(r.corpo)).map(r => r.url).join(', '));
ok('as dedicadas vem DEPOIS das do atlas no arquivo',
   dedicadas.length === 0 || Math.min.apply(null, dedicadas.map(r => r.pos)) >
                             Math.max.apply(null, doAtlas.map(r => r.pos)));

/* ⚠️ O FORMATO DA VARIAVEL E O QUE O SELETOR LE. Um `--battle-atlas: 3;` (com espaco) nao casa
   com `[style*="--battle-atlas:3;"]`, e o fundo some. */
console.log('\nCENA DE BATALHA -- o estilo inline casa com o seletor');
const estilos = T.map(t => ({ id: t.id, st: S.terrainBattleSceneStyle(t) }));
ok('todo terreno declara --battle-scene-id no formato do seletor',
   estilos.every(e => e.st.indexOf('--battle-scene-id:' + e.id + ';') >= 0),
   estilos.filter(e => e.st.indexOf('--battle-scene-id:' + e.id + ';') < 0).map(e => e.id).slice(0,5).join(', '));
ok('todo terreno declara --battle-atlas no formato do seletor',
   estilos.every(e => /--battle-atlas:\d+;/.test(e.st)));

/* ⚠️ A TRAVA QUE IMPORTA: cada um dos 51 casa com EXATAMENTE UMA regra de imagem. Zero = cenario
   vazio; duas do mesmo tipo = a arte de um terreno aparecendo noutro. */
/* ⚠️ O `:not(...)` TEM QUE SAIR ANTES, e foi ele que derrubou a primeira versao desta trava: a
   regra do atlas 1 e DUPLA -- ela vale pra quem tem `--battle-atlas:1;` E pra quem NAO tem a
   variavel nenhuma (a cena desenhada sem o estilo). Lido cru, o `[style*="--battle-atlas:"]` de
   dentro do `:not` e substring de TODOS os 51, e a trava acusava os 42 de uma vez. */
function casa(sel, st){
  const limpo = sel.replace(/:not\([^)]*\)/g, '');
  const m = limpo.match(/\[style\*="([^"]+)"\]/g) || [];
  return m.some(p => st.indexOf(p.slice(9, -3)) >= 0);
}
const semFundo = [], comDois = [];
estilos.forEach(e => {
  const ded = dedicadas.filter(r => casa(r.sel, e.st));
  const atl = doAtlas.filter(r => casa(r.sel, e.st));
  if(ded.length + atl.length === 0) semFundo.push(e.id);
  if(ded.length > 1 || atl.length > 1) comDois.push(e.id);
});
ok('nenhum terreno fica sem regra de fundo', semFundo.length === 0, semFundo.join(', '));
ok('nenhum terreno casa com duas regras do mesmo tipo', comDois.length === 0, comDois.join(', '));

/* ============================================================================
   ONDE CADA UM POE O PE.

   ⚠️ ATE 22/09/2026 AS DUAS POSICOES ERAM FIXAS pros 51 -- (22%,84%) e (78%,64%) --, e o CENARIO
   e que tinha de ter chao ali. O SUBMARINO AFUNDADO nao tinha: o piso dele so comeca em 68% da
   altura, e o adversario nascia dentro da parede. Hoje a posicao e POR CENARIO.
   ============================================================================ */
console.log('\nCENA DE BATALHA -- o pe de cada lutador');
const iTab = htmlCena.indexOf('const TERRAIN_BATTLE_FOOTING = {');
const tabela = htmlCena.slice(iTab, htmlCena.indexOf('\n};', iTab));
ok('a tabela do pe existe no arquivo', iTab > 0, String(tabela.length) + ' chars');
const semPe = T.filter(t => tabela.indexOf('"' + t.id + '"') < 0 && tabela.indexOf('\n  ' + t.id + ':') < 0);
ok('todo terreno tem posicao PROPRIA na tabela (nenhum cai no padrao)',
   semPe.length === 0, semPe.map(t => t.id).slice(0,8).join(', '));

function pes(st){
  const n = k => parseFloat((st.match(new RegExp('--battle-' + k + ':([\\d.]+)%')) || [])[1]);
  return { px: n('player-x'), py: n('player-y'), ex: n('enemy-x'), ey: n('enemy-y') };
}
const fora = estilos.filter(e => {
  const p = pes(e.st);
  return ![p.px, p.py, p.ex, p.ey].every(v => v > 0 && v < 100);
});
ok('as quatro posicoes de todo terreno sao porcentagens dentro da cena', fora.length === 0,
   fora.map(e => e.id).join(', '));

/* ⚠️ O ADVERSARIO FICA MAIS LONGE -- e a camera e frontal, entao o pe dele e sempre MAIS ALTO na
   tela que o do jogador. Invertido, os dois trocam de profundidade e o de tras desenha na frente. */
const invertidos = estilos.filter(e => { const p = pes(e.st); return p.ey >= p.py; });
ok('o pe do adversario fica ACIMA do pe do jogador nos 51', invertidos.length === 0,
   invertidos.map(e => e.id).join(', '));

/* ⚠️ E O SUBMARINO E O CASO QUE TROUXE A TABELA: ele nao pode voltar pro 64% fixo de antes, que
   era o que o punha dentro da parede. */
const sub = estilos.find(e => e.id === 'submarino_afundado');
ok('o submarino tem cena dedicada',
   dedicadas.some(r => r.sel.indexOf('submarino_afundado') >= 0));
ok('o pe do adversario no submarino desceu do 64% fixo de antes',
   !!sub && pes(sub.st).ey > 64, sub ? pes(sub.st).ey + '%' : '-');

/* ⚠️ E O CSS LE AS QUATRO COMO VARIAVEL COM PADRAO: terreno que saia da tabela um dia volta ao
   comportamento antigo em vez de ficar sem chao. */
const leituras = htmlCena.match(/var\(--battle-(?:player|enemy)-[xy][^)]*\)/g) || [];
const semPadrao = leituras.filter(v => !/,\s*[\d.]+%/.test(v));
ok('TODA leitura das quatro posicoes no CSS tem valor padrao',
   leituras.length >= 4 && semPadrao.length === 0,
   leituras.length + ' leituras' + (semPadrao.length ? ' -- sem padrao: ' + semPadrao.join(', ') : ''));

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
