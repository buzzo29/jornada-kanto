#!/usr/bin/env node
/**
 * Transforma data/golpes.json nas TABELAS que os dois motores usam, e escreve os trechos prontos
 * em tools/_tabelas-golpes.txt pra colar no index.html e no functions/index.js.
 *
 * Três tabelas, e cada uma vai pra um lugar diferente de propósito:
 *   GOLPES        (id -> [tipo, poder])  -> OS DOIS motores. É o mínimo que o cálculo de dano
 *                                           precisa, e por isso é a sexta tabela duplicada.
 *   GOLPES_PT     (id -> nome)           -> só o CLIENTE. Nome é apresentação: o motor manda o id,
 *                                           o cliente escolhe a palavra -- a mesma regra do
 *                                           MOVE_BY_TYPE.
 *   APRENDIZADO   (espécie -> [[nível, i]]) -> só o CLIENTE. O servidor nunca precisa saber QUEM
 *                                           aprende o quê: os golpes escolhidos viajam na
 *                                           instância. Índices em vez de ids porque os mesmos
 *                                           golpes se repetem em centenas de espécies.
 *
 * FICAM DE FORA: Self-Destruct e Explosion. Eles JÁ SÃO a mecânica de autodestruição do jogo
 * (CHANCE_AUTODESTRUICAO, e as mesmas 9 espécies) -- como golpe comum de 200 e 250 de poder, sem o
 * custo de cair junto, eles seriam a escolha óbvia de todo mundo que os tem e ainda modelariam a
 * mesma coisa duas vezes.
 *
 *   node tools/gerar-tabelas-golpes.js
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const D = require(path.join(RAIZ, 'data', 'golpes.json'));
const PT = require(path.join(__dirname, 'golpes-pt.json'));

const FORA = ['selfdestruct', 'explosion'];
const ehDano = id => D.golpes[id] && D.golpes[id].poder > 0 && FORA.indexOf(id) < 0;

/* ---- quem aprende o quê, só dano ---- */
const aprendizado = {};
const usados = new Set();
Object.entries(D.porEspecie).forEach(([esp, lista]) => {
  const so = lista.filter(x => ehDano(x.g));
  if(!so.length) return;                 // as 8 sem golpe de dano ficam FORA da tabela de propósito
  aprendizado[esp] = so;
  so.forEach(x => usados.add(x.g));
});
const ids = [...usados].sort();
const idx = {}; ids.forEach((id, i) => idx[id] = i);

const semPt = ids.filter(id => !PT[id]);
if(semPt.length) throw new Error('golpe sem nome em português: ' + semPt.join(', '));

/* ---- os trechos ---- */
const linha = (obj, largura) => {
  const partes = Object.entries(obj).map(([k, v]) => k + ':' + v);
  const out = []; let atual = '';
  partes.forEach(p => {
    /* A VÍRGULA FICA NO FIM DA LINHA, não na emenda: quebrar sem ela colava dois pares num só
       (`...:['Rock',60]\n  aurorabeam:...`) e o objeto nem parseava. */
    if(atual.length + p.length + 1 > largura){ out.push(atual + ','); atual = ''; }
    atual += (atual ? ',' : '') + p;
  });
  if(atual) out.push(atual);
  return out.map(l => '  ' + l).join('\n');
};

const golpesObj = {};
ids.forEach(id => { const g = D.golpes[id]; golpesObj[id] = "['" + g.tipo + "'," + g.poder + "]"; });
const ptObj = {};
ids.forEach(id => { ptObj[id] = "'" + PT[id].replace(/'/g, "\\'") + "'"; });
const aprObj = {};
Object.entries(aprendizado).forEach(([esp, l]) => {
  aprObj[esp] = '[' + l.map(x => '[' + x.n + ',' + idx[x.g] + ']').join(',') + ']';
});

const cab = (t) => '\n/* ================= ' + t + ' ================= */\n';
const saida =
cab('1. GOLPES -- vai nos DOIS motores (index.html e functions/index.js)') +
'const GOLPES = {\n' + linha(golpesObj, 96) + '\n};\n' +
"const GOLPES_IDS = ['" + ids.join("','") + "'];\n" +

cab('2. GOLPES_PT -- só no index.html') +
'const GOLPES_PT = {\n' + linha(ptObj, 96) + '\n};\n' +

cab('3. APRENDIZADO -- só no index.html (índices do GOLPES_IDS)') +
'const APRENDIZADO = {\n' + linha(aprObj, 110) + '\n};\n';

fs.writeFileSync(path.join(__dirname, '_tabelas-golpes.txt'), saida);

const kb = s => Math.round(s.length / 1024) + ' KB';
console.log('golpes de dano na tabela: ' + ids.length + '  (fora: ' + FORA.join(', ') + ')');
console.log('espécies com pelo menos um golpe de dano: ' + Object.keys(aprendizado).length + ' de 250');
console.log('entradas de aprendizado: ' + Object.values(aprendizado).reduce((s, l) => s + l.length, 0));
console.log('');
console.log('tamanho dos trechos:');
console.log('  GOLPES + GOLPES_IDS (os dois motores): ' + kb('const GOLPES = {\n' + linha(golpesObj, 96) + '\n};\nconst GOLPES_IDS=[]'));
console.log('  GOLPES_PT (só cliente):                ' + kb(linha(ptObj, 96)));
console.log('  APRENDIZADO (só cliente):              ' + kb(linha(aprObj, 110)));
console.log('  total no index.html:                   ' + kb(saida));
console.log('');
console.log('escrito em tools/_tabelas-golpes.txt');
