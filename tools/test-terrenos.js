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

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
