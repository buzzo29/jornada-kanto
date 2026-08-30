/**
 * Confere a base de dados de Johto (#152-251).
 *
 * Ela ainda não está ligada ao jogo (ver o comentário em SPECIES_JOHTO), então nenhum outro teste
 * passa por aqui. Este existe pra que a tabela não apodreça em silêncio até a hora de usar: se
 * alguém editar um número na mão e esquecer o outro arquivo, ou quebrar a relação entre o
 * `special` e o GEN2_SPECIAL, quem avisa é isto.
 *
 *   node tools/test-johto.js
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

function tabela(arquivo, nome){
  const t = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
  const i = t.indexOf('const ' + nome + ' = {');
  if(i < 0) throw new Error(nome + ' não existe em ' + arquivo);
  const corpo = t.slice(t.indexOf('{', i), t.indexOf('\n};', i) + 2);
  return { texto: t.slice(i, t.indexOf('\n};', i) + 3), valor: eval('(' + corpo + ')') };
}

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}

const NOMES = ['SPECIES_JOHTO', 'GEN2_SPECIAL_JOHTO', 'EVOLUTIONS_JOHTO'];
const cliente = {}, servidor = {};
NOMES.forEach(n=>{ cliente[n] = tabela('index.html', n); servidor[n] = tabela('functions/index.js', n); });

console.log('\nAS DUAS CÓPIAS');
NOMES.forEach(n=>ok(n + ' idêntica nos dois arquivos', cliente[n].texto === servidor[n].texto));

const J = cliente.SPECIES_JOHTO.valor;
const SPECIAL = cliente.GEN2_SPECIAL_JOHTO.valor;
const EVO = cliente.EVOLUTIONS_JOHTO.valor;
const KANTO = tabela('index.html', 'SPECIES').valor;
const ids = Object.keys(J);

console.log('\nCOBERTURA');
ok('100 espécies', ids.length === 100, ids.length + '');
const dexes = ids.map(id=>J[id].dex).sort((a,b)=>a-b);
const faltando = [];
for(let d=152; d<=251; d++) if(!dexes.includes(d)) faltando.push(d);
ok('a numeração vai de 152 a 251 sem buraco', faltando.length === 0, faltando.length ? 'faltam ' + faltando.join(',') : '');
ok('nenhum id colide com Kanto', !ids.some(id=>KANTO[id]), ids.filter(id=>KANTO[id]).join(',') || '');
ok('a ordem da tabela segue o número da Pokédex',
   ids.every((id,i)=> i === 0 || J[ids[i-1]].dex < J[id].dex));

console.log('\nCAMPOS');
const CAMPOS = ['dex','name','types','hp','attack','defense','speed','emoji'];
const molde = Object.keys(KANTO.bulbasaur);
ok('o formato é o mesmo do SPECIES de Kanto', JSON.stringify(molde) === JSON.stringify(CAMPOS),
   molde.join(','));
const incompletos = ids.filter(id=>CAMPOS.some(c=>J[id][c] === undefined));
ok('nenhum campo faltando', incompletos.length === 0, incompletos.join(',') || '');
const forasDeFaixa = ids.filter(id=>['hp','attack','defense','speed']
  .some(c=>!Number.isInteger(J[id][c]) || J[id][c] < 1 || J[id][c] > 255));
ok('todos os atributos são inteiros de 1 a 255', forasDeFaixa.length === 0, forasDeFaixa.join(',') || '');
ok('todo mundo tem 1 ou 2 tipos', ids.every(id=>J[id].types.length >= 1 && J[id].types.length <= 2));

console.log('\nSp.Atk / Sp.Def');
ok('toda espécie tem entrada no GEN2_SPECIAL_JOHTO',
   ids.every(id=>Array.isArray(SPECIAL[id]) && SPECIAL[id].length === 2),
   ids.filter(id=>!SPECIAL[id]).join(',') || '');
ok('não sobra entrada sem espécie', Object.keys(SPECIAL).every(id=>J[id]));
ok('os pares são inteiros de 1 a 255',
   ids.every(id=>SPECIAL[id].every(v=>Number.isInteger(v) && v >= 1 && v <= 255)));
// o `special` único da Gen 1 saiu do jogo: Sp.Atk e Sp.Def são a única fonte de atributo especial
ok('nenhuma espécie de Johto carrega o `special` da Gen 1', !ids.some(id=>'special' in J[id]));
ok('nenhuma espécie de Kanto carrega o `special` da Gen 1', !Object.keys(KANTO).some(id=>'special' in KANTO[id]));
/* Volta pelo TEXTO dos dois arquivos: as três formas que significariam o campo de volta. A
   variável local `special` (a classe físico/especial do golpe) é outra coisa e continua valendo. */
const VOLTOU = /\bsp\.special\b|\bp\.special\b|\bspecial:\s*\d/;
['index.html','functions/index.js'].forEach(arq=>{
  const t = fs.readFileSync(path.join(RAIZ, arq), 'utf8');
  const m = t.match(VOLTOU);
  ok('o campo não voltou em ' + arq, !m, m ? 'achei "' + m[0] + '"' : '');
});

console.log('\nEVOLUÇÕES');
const conhece = id => !!(J[id] || KANTO[id]);
const origemRuim = Object.keys(EVO).filter(id=>!conhece(id));
const destinoRuim = Object.keys(EVO).filter(id=>!conhece(EVO[id].into));
ok('toda origem existe', origemRuim.length === 0, origemRuim.join(',') || '');
ok('todo destino existe', destinoRuim.length === 0, destinoRuim.join(',') || '');
ok('todo destino é de Johto', Object.keys(EVO).every(id=>!!J[EVO[id].into]));
ok('nível entre 1 e 99', Object.keys(EVO).every(id=>EVO[id].level >= 1 && EVO[id].level <= 99));
ok('ninguém evolui pra si mesmo', Object.keys(EVO).every(id=>EVO[id].into !== id));

/* O JOGO CONTINUA SÓ KANTO. Estas duas checagens são o que garante que a base de Johto entrou
   como dado parado e não mudou nada em jogo. */
console.log('\nO JOGO CONTINUA SÓ KANTO');
const KANTO_EVO = tabela('index.html', 'EVOLUTIONS').valor;
const INTOCADAS = { gloom:'vileplume', poliwhirl:'poliwrath', slowpoke:'slowbro' };
const mexidas = Object.keys(INTOCADAS).filter(id=>!KANTO_EVO[id] || KANTO_EVO[id].into !== INTOCADAS[id]);
ok('Gloom, Poliwhirl e Slowpoke ainda evoluem pro destino de Kanto', mexidas.length === 0,
   mexidas.map(id=>id + ' -> ' + (KANTO_EVO[id] ? KANTO_EVO[id].into : 'sumiu')).join(', ') || '');
ok('nenhuma espécie de Johto entrou na tabela em uso', !Object.keys(KANTO).some(id=>J[id]));

console.log('\nO QUE VAI PRECISAR SER RESOLVIDO PRA LIGAR (esperado -- ver o comentário em SPECIES_JOHTO)');
const TIPOS_DO_MOTOR = Object.keys(tabela('index.html', 'TYPE_CHART').valor);
const semTipo = ids.filter(id=>J[id].types.some(t=>!TIPOS_DO_MOTOR.includes(t)));
console.log('  · ' + semTipo.length + ' espécies com tipo que o TYPE_CHART não conhece: ' +
            semTipo.map(id=>J[id].name).join(', '));
/* Não é disputa de número de Pokédex: Vileplume é #45 e Bellossom é #182, cada uma com a sua
   vaga. O que colidiria é a CHAVE da tabela -- quem evolui -- se as duas fossem fundidas. */
const doisDestinos = Object.keys(EVO).filter(id=>KANTO_EVO[id]);
console.log('  · ' + doisDestinos.length + ' pokémons de Kanto ganhariam um segundo destino de evolução: ' +
            doisDestinos.map(id=>KANTO[id].name + ' (hoje ' + KANTO_EVO[id].into + ', ou ' + EVO[id].into + ')').join(', '));
console.log('    a chave repetida seria ' + doisDestinos.join(', ') + ' -- em JS a última apaga a primeira, sem erro');

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
