/**
 * JOHTO DENTRO DO JOGO (#152-251).
 *
 * Ate 30/08/2026 Johto vivia em tabelas paralelas e este teste garantia que ele NAO encostava em
 * nada. Agora ele esta em uso, e o que precisa de trava mudou: as tabelas continuam duplicadas
 * entre cliente e servidor (a armadilha nº1 do projeto), as evolucoes de Kanto nao podem ter sido
 * sequestradas pelas de Johto, e os dois tipos novos precisam estar completos nos dois arquivos.
 *
 *   node tools/test-johto.js
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

function tabela(arquivo, nome, abre){
  const t = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
  const i = t.indexOf('const ' + nome + ' = ' + abre);
  if(i < 0) throw new Error(nome + ' não existe em ' + arquivo);
  const fecha = abre === '{' ? '\n};' : '\n];';
  const corpo = t.slice(t.indexOf(abre, i), t.indexOf(fecha, i) + 2);
  return { texto: t.slice(i, t.indexOf(fecha, i) + 3), valor: eval('(' + corpo + ')') };
}
let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const S  = tabela('index.html','SPECIES','{').valor;
const Ss = tabela('functions/index.js','SPECIES','{').valor;
const G  = tabela('index.html','GEN2_SPECIAL','{');
const Gs = tabela('functions/index.js','GEN2_SPECIAL','{');
const E  = tabela('index.html','EVOLUTIONS','{');
const Es = tabela('functions/index.js','EVOLUTIONS','{');
const T  = tabela('index.html','TYPE_CHART','{');
const Ts = tabela('functions/index.js','TYPE_CHART','{');
const johto = Object.keys(S).filter(id=>S[id].dex >= 152 && S[id].dex <= 251);

console.log('\nJOHTO ESTA NA TABELA EM USO');
ok('100 especies de Johto no SPECIES', johto.length === 100, String(johto.length));
ok('a Pokedex tem 250 (o #151 Mew fica de fora -- e o chefe da raide)',
   Object.keys(S).length === 250, String(Object.keys(S).length));
const faltando = [];
for(let d=152; d<=251; d++) if(!johto.some(id=>S[id].dex===d)) faltando.push(d);
ok('a numeracao vai de 152 a 251 sem buraco', faltando.length === 0, faltando.join(','));
ok('Kanto continua inteiro', Object.keys(S).filter(id=>S[id].dex<=150).length === 150);

console.log('\nAS DUAS COPIAS (armadilha nº1 do projeto)');
/* Compara o VALOR, não o texto: os dois arquivos têm comentários próprios em algumas linhas
   (o servidor carrega o registro de uma divergência antiga do Voltorb, por exemplo), e comparar
   caractere a caractere acusaria diferença onde a tabela é a mesma. O que não pode divergir é o
   dado -- é ele que faz a mesma batalha ter dois vencedores. */
/* Ordena as chaves antes de comparar. Um JSON.stringify direto é sensível à ORDEM, e as duas
   tabelas legitimamente listam as espécies em ordens diferentes -- acusava divergência onde os
   dados são idênticos. O que importa é o conteúdo. */
const ordenado = o => JSON.stringify(Object.keys(o).sort().map(k=>[k, o[k]]));
const mesmoValor = (a,b)=>ordenado(a)===ordenado(b);
ok('GEN2_SPECIAL igual nos dois arquivos', mesmoValor(G.valor, Gs.valor));
ok('EVOLUTIONS igual nos dois arquivos', mesmoValor(E.valor, Es.valor));
ok('TYPE_CHART igual nos dois arquivos', mesmoValor(T.valor, Ts.valor));
const dif = [];
Object.keys(S).forEach(id=>{ const a=S[id], b=Ss[id];
  if(!b){ dif.push(id+' falta no servidor'); return; }
  ['hp','attack','defense','speed'].forEach(k=>{ if(a[k]!==b[k]) dif.push(id+'.'+k); });
  if(JSON.stringify(a.types)!==JSON.stringify(b.types)) dif.push(id+'.types');
});
ok('os atributos batem entre cliente e servidor', dif.length === 0, dif.slice(0,5).join(', '));
ok('nenhuma especie sem Sp.Atk/Sp.Def', Object.keys(S).every(id=>Array.isArray(G.valor[id])),
   Object.keys(S).filter(id=>!G.valor[id]).join(','));

console.log('\nOS DOIS TIPOS NOVOS');
['Dark','Steel'].forEach(t=>{
  ok(t + ' ataca (linha propria no TYPE_CHART)', !!T.valor[t]);
  const defendem = Object.keys(T.valor).filter(a=>T.valor[a][t] !== undefined).length;
  ok(t + ' defende (aparece na linha dos outros tipos)', defendem >= 5, defendem + ' tipos o afetam');
});
ok('Aço ainda resiste a Fantasma e Sombrio (regra da Gen 2, mudou na Gen 6)',
   T.valor.Ghost.Steel === 0.5 && T.valor.Dark.Steel === 0.5);
ok('Psiquico nao afeta Sombrio', T.valor.Psychic.Dark === 0);
ok('Veneno nao afeta Aço', T.valor.Poison.Steel === 0);
const tiposUsados = new Set(Object.values(S).flatMap(s=>s.types));
const semChart = [...tiposUsados].filter(t=>!T.valor[t]);
ok('todo tipo usado por alguma especie existe no TYPE_CHART', semChart.length === 0, semChart.join(','));

console.log('\nAS EVOLUCOES DE KANTO NAO FORAM SEQUESTRADAS');
const INTOCADAS = { gloom:'vileplume', poliwhirl:'poliwrath', slowpoke:'slowbro', eevee:undefined };
ok('Gloom continua virando Vileplume', E.valor.gloom.into === 'vileplume', E.valor.gloom.into);
ok('Poliwhirl continua virando Poliwrath', E.valor.poliwhirl.into === 'poliwrath', E.valor.poliwhirl.into);
ok('Slowpoke continua virando Slowbro', E.valor.slowpoke.into === 'slowbro', E.valor.slowpoke.into);
ok('Bellossom, Politoed e Slowking ficaram de fora (sem tela de escolha ainda)',
   !Object.values(E.valor).some(e=>['bellossom','politoed','slowking'].includes(e.into)));
ok('o Eevee continua fora do EVOLUTIONS (tem tela propria)', !E.valor.eevee);
const destinoRuim = Object.keys(E.valor).filter(id=>!S[E.valor[id].into]);
ok('toda evolucao aponta pra especie existente', destinoRuim.length === 0, destinoRuim.join(','));
const origemRuim = Object.keys(E.valor).filter(id=>!S[id]);
ok('toda origem existe', origemRuim.length === 0, origemRuim.join(','));


console.log('\n=== EVOLUTION_CHOICES: A QUINTA TABELA DUPLICADA ===');
/* Ela entrou no servidor em 03/09/2026 porque o raizDaLinha precisa dela pra chegar na MESMA
   raiz que o cliente -- e a raiz e a chave dos itens equipados. Divergindo, um lado procura o
   item numa chave e o outro noutra, e o pokemon perde o item ao evoluir. Compara por VALOR: os
   dois arquivos tem comentarios proprios. */
(function(){
  const pega = (texto) => {
    const m = texto.match(/const EVOLUTION_CHOICES = \{[\s\S]*?\n\};/);
    if(!m) return null;
    const fn = new Function(m[0] + '; return EVOLUTION_CHOICES;');
    return fn();
  };
  const fs2 = require('fs');
  const cli = pega(fs2.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'));
  const srv = pega(fs2.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8'));
  ok('o servidor tem a tabela', !!srv);
  ok('e ela e IDENTICA a do cliente (por valor)',
     !!cli && !!srv && JSON.stringify(cli) === JSON.stringify(srv),
     JSON.stringify(cli) + '  x  ' + JSON.stringify(srv));
})();
console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
