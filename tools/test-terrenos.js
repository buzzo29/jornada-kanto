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
   O CHAO DA CENA DE BATALHA (22/09/2026)

   A cena poe o pe do jogador em 84% da altura e o do adversario em 64%, iguais nos 51 -- e o
   cenario tem que ter CHAO nessas duas alturas. Reportado com print: no Submarino Afundado o
   Gengar nascia DENTRO da parede, em cima da escotilha.

   ⚠️ MEDIDO NOS ATLAS, na coluna do adversario, a folga entre o pe e a linha do horizonte:
   campo_aberto +9, hangar_gelado +9, tundra +9, dojo +14, vulcao +15, arena_suspensa +15,
   deserto +1, mina_subterranea +6 -- e o submarino_afundado **-8**, o UNICO negativo dos 51.
   ============================================================================ */
console.log('\nO CHAO DA CENA DE BATALHA');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  /* ⚠️ LIDA DO ARQUIVO, e nao do sandbox: `const` nao vira propriedade global la -- a versao
     anterior desta trava pegava `undefined` e o teste ESTOURAVA no `Object.keys`, em vez de
     falhar. Uma trava que estoura e pior que uma que falha: ela derruba o resto do arquivo. */
  const bruta = (src.match(/const CENARIO_CHAO_ADVERSARIO = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const EXC = {};
  bruta.split('\n').forEach(l => {
    const g = l.match(/^\s*([a-z_]+)\s*:\s*(\d+)/);
    if(g) EXC[g[1]] = Number(g[2]);
  });
  const PADRAO = 36;                    /* o bottom de sempre: o pe em 64% */

  ok('a tabela de excecoes existe no arquivo', bruta.length > 0);

  /* ⚠️ SO AS EXCECOES ENTRAM NELA: 50 dos 51 usam o padrao, e uma tabela com os 51 seria 50
     linhas esperando pra divergir do CSS no primeiro ajuste. */
  const nomes = Object.keys(EXC);
  ok('  e ela so tem excecao: ' + nomes.length + ' de ' + S.TERRAINS.length,
     nomes.length < S.TERRAINS.length / 2, nomes.join(','));

  /* ⚠️ E TODO NOME NELA TEM QUE SER UM TERRENO DE VERDADE: um id errado nao da erro nenhum --
     ele so nunca casa, e o cenario continua com o defeito. E a familia do selo fantasma. */
  const fantasma = nomes.filter(id => !S.TERRAINS.some(t => t.id === id));
  ok('  e todo nome dela e um terreno que existe', fantasma.length === 0, fantasma.join(','));

  /* o caso do relato: o piso do submarino comeca em 68% (medido no atlas, na coluna 78%), e a
     linha de maior variacao fica em 72% -- o pe TEM que cair abaixo disso. */
  const PISO_DO_SUBMARINO = 68;
  ok('o submarino declara um chao proprio', EXC.submarino_afundado != null,
     String(EXC.submarino_afundado));
  ok('  e o pe do adversario cai ABAIXO do piso dele (' + PISO_DO_SUBMARINO + '%)',
     (100 - EXC.submarino_afundado) > PISO_DO_SUBMARINO,
     'pe em ' + (100 - EXC.submarino_afundado) + '% -- com o padrao ele ficava em '
     + (100 - PADRAO) + '%, DENTRO da parede');
  /* ⚠️ E NAO PODE DESCER DEMAIS: abaixo de ~75% ele comeca a cobrir o cartao do pokemon do
     jogador (medido na cena real, comparando 36/30/27/25/23), e em 84% ele encostaria nele. */
  ok('  e nao desce a ponto de cobrir o cartao do jogador',
     (100 - EXC.submarino_afundado) <= 75, 'pe em ' + (100 - EXC.submarino_afundado) + '%');

  /* ---- o estilo emite a variavel, e SO pras excecoes ---- */
  const estiloDe = id => S.terrainBattleSceneStyle(S.TERRAINS.find(t => t.id === id));
  ok('o estilo do submarino carrega a variavel',
     /--battle-enemy-bottom:\s*27%/.test(estiloDe('submarino_afundado')),
     estiloDe('submarino_afundado').slice(-40));
  const semVar = S.TERRAINS.filter(t => EXC[t.id] == null)
                           .filter(t => /--battle-enemy-bottom/.test(estiloDe(t.id)));
  ok('  e nenhum dos outros ' + (S.TERRAINS.length - nomes.length) + ' carrega',
     semVar.length === 0, semVar.map(t => t.id).join(','));

  /* ---- o CSS: a variavel com o padrao de sempre, nos DOIS lugares ---- */
  /* ⚠️ LIDO DO CSS, porque posicao nao aparece em asserção de HTML nenhuma -- e a regra que
     falhasse em silencio aqui poria o sprite no lugar errado sem nada acusar. */
  const cssStage = (src.match(/\.battle-fighter\.enemy \.battle-sprite-stage\{[^}]*\}/) || [''])[0];
  const cssBase  = (src.match(/\.battle-fighter\.enemy \.battle-ground-base\{[^}]*\}/) || [''])[0];
  ok('(a trava achou as duas regras no CSS)', cssStage.length > 10 && cssBase.length > 10);
  ok('o sprite do adversario usa a variavel, com o padrao ' + PADRAO + '%',
     cssStage.indexOf('var(--battle-enemy-bottom,' + PADRAO + '%)') >= 0, cssStage);
  /* ⚠️ E A BASE E DERIVADA DELA, nunca um segundo numero: duas fontes pro mesmo valor
     divergiriam no primeiro ajuste, e o sintoma seria a base de agua/ar separada do sprite. */
  ok('  e a base de agua/ar e DERIVADA dele (nao um segundo numero)',
     /calc\(100% - var\(--battle-enemy-bottom,\s*36%\)\)/.test(cssBase), cssBase);
  ok('  entao o CSS nao tem mais o 64% cravado', cssBase.indexOf('top:64%') < 0, cssBase);

  /* ---- e o JOGADOR nao foi tocado: o defeito era do adversario ---- */
  const cssJog = (src.match(/\.battle-fighter\.player \.battle-sprite-stage\{[^}]*\}/) || [''])[0];
  ok('o lado do JOGADOR continua em 16% (pe em 84%)',
     cssJog.indexOf('bottom:16%') >= 0, cssJog);
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
