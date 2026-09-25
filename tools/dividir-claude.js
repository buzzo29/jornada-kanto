/**
 * DIVIDE O CLAUDE.md EM CAPÍTULOS, sem perder uma linha.
 *
 * ⚠️ POR QUE ELE EXISTE (25/09/2026). O CLAUDE.md chegou a **1.360 KB — ~544 mil tokens**, e ele é
 * carregado INTEIRO em toda sessão: sobrava menos da metade da janela pro trabalho, e a sessão
 * passou a comprimir no meio -- que é o retrabalho de verdade (eu perco detalhe e releio).
 *
 * ⚠️ O QUE TORNA A DIVISÃO SEGURA NÃO É O CORTE, É O GATILHO. O precedente é o
 * `docs/motor-de-batalha.md` (24/09), e o que fez ele funcionar foi a linha que ficou pra trás:
 * *"LEIA ESSE ARQUIVO ANTES DE MEXER EM DANO, GOLPE, STATUS, PASSIVA OU NO LOG"*. Sem ela, a
 * divisão vira perda -- eu não leio o que não sei que existe.
 *
 * ⚠️ E AQUI O GATILHO GANHOU UMA SEGUNDA METADE: a lista de SÍMBOLOS que o capítulo toca. Um
 * gatilho por ASSUNTO falha quando o assunto não é óbvio (mexer no `SAFE_SAVE_SCREENS` não parece
 * "Ilhas Laranja", e há uma lição sobre ele lá). Com os símbolos, um grep no CLAUDE.md sempre
 * aponta pro capítulo certo.
 *
 * ⚠️ E A CONFERÊNCIA É DE CONTEÚDO, NUNCA DE TAMANHO -- a lição que a divisão do motor já registra:
 * *"um recorte pode levar a metade de uma subseção e a conta continua fechando"*. Aqui ela é
 * BYTE A BYTE: o que sai do CLAUDE.md tem que ser exatamente o que entra no capítulo, e a
 * remontagem (capítulo + o que sobrou) tem que dar o arquivo original menos o índice.
 *
 *   node tools/dividir-claude.js <receita.js>          confere e mostra
 *   node tools/dividir-claude.js <receita.js> --gravar grava
 */
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');

const receita = require(path.resolve(process.argv[2]));
const gravar = process.argv.includes('--gravar');

const CLAUDE = path.join(raiz, 'CLAUDE.md');
const src = fs.readFileSync(CLAUDE, 'utf8');

/* ---- 1. parte o arquivo em secoes de nivel 2, preservando os bytes ---- */
const linhas = src.split('\n');
const secoes = [];   /* { titulo, ini, fim, texto } */
let atual = null;
linhas.forEach((l, i) => {
  if(/^## /.test(l)){
    if(atual){ atual.fim = i; secoes.push(atual); }
    atual = { titulo: l.slice(3).trim(), ini: i };
  }
});
if(atual){ atual.fim = linhas.length; secoes.push(atual); }
secoes.forEach(s => { s.texto = linhas.slice(s.ini, s.fim).join('\n'); });
const cabecalho = linhas.slice(0, secoes.length ? secoes[0].ini : linhas.length).join('\n');

/* ---- 2. acha as secoes pedidas (por prefixo do titulo, que e como a receita as nomeia) ---- */
const erros = [];
const escolhidas = [];
receita.secoes.forEach(prefixo => {
  const achadas = secoes.filter(s => s.titulo.indexOf(prefixo) === 0);
  if(achadas.length === 0) erros.push('NAO ACHEI: "' + prefixo + '"');
  else if(achadas.length > 1) erros.push('AMBIGUO (' + achadas.length + '): "' + prefixo + '"');
  else escolhidas.push(achadas[0]);
});
if(erros.length){ erros.forEach(e => console.log('  X ' + e)); process.exit(1); }

/* ---- 3. os SIMBOLOS que o capitulo toca: os `identificadores` em crase ---- */
function simbolosDe(txt){
  const c = {};
  [...txt.matchAll(/`([A-Za-z_$][A-Za-z0-9_$.]{3,})`/g)].forEach(m => {
    const s = m[1];
    /* so identificador de codigo: tem maiuscula no meio, ou _ , ou . -- nao palavra comum */
    if(!/[A-Z_.]/.test(s.slice(1))) return;
    c[s] = (c[s] || 0) + 1;
  });
  return Object.entries(c).sort((a,b) => b[1]-a[1]).map(([s]) => s);
}

/* ---- 4. monta o capitulo e o indice ---- */
const corpo = escolhidas.map(s => s.texto).join('\n');
const capitulo = receita.cabecalho.trimEnd() + '\n\n' + corpo.replace(/^\n+/, '') + '\n';

const simbolos = simbolosDe(corpo).slice(0, receita.maxSimbolos || 34);
const subsecoes = (corpo.match(/^#{3,4} /gm) || []).length;

const indice = [
  '## ⚠️ ' + receita.indiceTitulo,
  '',
  receita.gatilho.trim(),
  '',
  '**O que está lá:** ' + receita.oQueEsta.trim(),
  '',
  '**⚠️ E ESTES SÍMBOLOS SÓ SÃO EXPLICADOS LÁ** — um `grep` que caia aqui e não ache nada tem que',
  'ir pro capítulo, e é essa lista que faz o gatilho valer quando o assunto não é óbvio:',
  '',
  simbolos.map(s => '`' + s + '`').join(' · '),
  '',
  '*(' + escolhidas.length + ' seções, ' + subsecoes + ' subseções, ' +
    Math.round(corpo.length/1024) + ' KB — saíram daqui em 25/09/2026 porque o CLAUDE.md é lido',
  'INTEIRO em toda sessão, e ele tinha chegado a 1.360 KB.)*',
  '',
].join('\n');

/* ---- 5. o CLAUDE.md novo: as secoes que ficam, com o indice no lugar da PRIMEIRA que saiu ---- */
const iPrimeira = secoes.indexOf(escolhidas[0]);
const restantes = [];
secoes.forEach((s, i) => {
  if(escolhidas.indexOf(s) >= 0){ if(i === iPrimeira) restantes.push(indice); return; }
  restantes.push(s.texto);
});
/* ⚠️ O CABECALHO PRECISA TERMINAR COM QUEBRA DE LINHA -- sem ela ele COLA no `## ` da primeira
   secao que fica, e o titulo dela deixa de ser um titulo. Aconteceu de verdade em 25/09/2026 com a
   `## Regras de trabalho`: ela virou `---## Regras de trabalho`, e a partir dai as rodadas SEGUINTES
   nao a enxergavam mais como secao -- ela virou parte do cabecalho, em silencio.
   ⚠️ A CONFERENCIA PEGOU (ela e byte a byte), mas so no fim das QUATRO rodadas: numa ferramenta que
   roda em cadeia, o erro da primeira volta se propaga antes de alguem olhar. */
const novo = cabecalho.replace(/\n*$/, '\n') + restantes.join('\n');

/* ---- 6. A CONFERENCIA, e ela e de CONTEUDO ---- */
let ok = true;
const diz = (bom, txt, det) => { if(!bom) ok = false;
  console.log('  ' + (bom ? 'ok  ' : 'X   ') + txt + (det ? '   ' + det : '')); };

/* (a) byte a byte: o capitulo contem exatamente as secoes escolhidas */
diz(escolhidas.every(s => capitulo.indexOf(s.texto) >= 0),
    'as ' + escolhidas.length + ' secoes entraram no capitulo BYTE A BYTE');

/* (b) nenhuma delas sobrou no CLAUDE.md */
const sobrou = escolhidas.filter(s => novo.indexOf(s.texto) >= 0);
diz(sobrou.length === 0, 'nenhuma sobrou no CLAUDE.md',
    sobrou.length ? sobrou.map(s => s.titulo.slice(0,40)).join(' | ') : '');

/* (c) as que FICAM continuam byte a byte */
const ficam = secoes.filter(s => escolhidas.indexOf(s) < 0);
const perdidas = ficam.filter(s => novo.indexOf(s.texto) < 0);
diz(perdidas.length === 0, 'as ' + ficam.length + ' secoes que ficam estao INTACTAS',
    perdidas.length ? perdidas.map(s => s.titulo.slice(0,40)).join(' | ') : '');

/* (d) a soma fecha: original = novo + capitulo - indice - cabecalho do capitulo */
const contaOk = src.length === novo.length + corpo.length - indice.length + (corpo.length ? 0 : 0) - 0
  || Math.abs(src.length - (novo.length - indice.length + corpo.length)) <= 1;
diz(contaOk, 'a soma de bytes fecha',
    src.length + ' = ' + (novo.length - indice.length) + ' + ' + corpo.length);

/* (e) TODA subsecao do capitulo esta nele */
const subsOrig = [...src.matchAll(/^#{3,4} (.+)$/gm)].map(m => m[1]);
const subsNovo = [...novo.matchAll(/^#{3,4} (.+)$/gm)].map(m => m[1]);
const subsCap  = [...capitulo.matchAll(/^#{3,4} (.+)$/gm)].map(m => m[1]);
const faltando = subsOrig.filter(t => subsNovo.indexOf(t) < 0 && subsCap.indexOf(t) < 0);
diz(faltando.length === 0, 'as ' + subsOrig.length + ' subsecoes estao num dos dois',
    faltando.length ? faltando.slice(0,3).join(' | ') : subsNovo.length + ' ficam, ' + subsCap.length + ' saem');

/* (f) o indice tem o gatilho e os simbolos */
diz(indice.indexOf('LEIA') >= 0 || receita.gatilho.indexOf('LEIA') >= 0, 'o indice tem o GATILHO');
diz(simbolos.length >= 8, 'o indice lista os simbolos', simbolos.length + ' simbolos');

console.log('');
console.log('  CLAUDE.md:  ' + Math.round(src.length/1024) + ' KB -> ' + Math.round(novo.length/1024) + ' KB'
  + '   (-' + Math.round((src.length - novo.length)/1024) + ' KB)');
console.log('  ' + receita.arquivo + ':  ' + Math.round(capitulo.length/1024) + ' KB');

if(!ok){ console.log('\n  A CONFERENCIA FALHOU -- nada foi escrito'); process.exit(1); }
if(!gravar){ console.log('\n  (em seco -- use --gravar)'); process.exit(0); }

fs.writeFileSync(path.join(raiz, receita.arquivo), capitulo);
fs.writeFileSync(CLAUDE, novo);
console.log('\n  escrito');
