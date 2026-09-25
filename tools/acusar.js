/**
 * CONFERÊNCIA DE ACUSAÇÃO: religa cada defeito, um por vez, e confere que alguma trava cai.
 *
 *   node tools/acusar.js <casos.js>
 *   node tools/acusar.js <casos.js> --caso 3      (só o caso 3, pra investigar um mudo)
 *
 * Os casos são um ARQUIVO JS (o mesmo formato da receita do tools/patch.js, mais o campo `testes`):
 *
 *   module.exports = [
 *     { titulo:'a guarda do laço volta a ignorar a tela', arquivo:'index.html',
 *       de:   "if(fase !== 'jogando' || game.screen !== 'pescaria') return;",
 *       para: "if(fase !== 'jogando') return;",
 *       testes:['test-pescaria'] },
 *   ];
 *
 * ⚠️ POR QUE ELA EXISTE: uma trava que passa com o defeito religado não é uma trava -- ela é
 * decoração que fica verde. Só esta conferência separa "a trava mede a regra" de "a trava mede a si
 * mesma", e ela já pegou, neste projeto, travas que perguntavam à própria função que mediam, travas
 * que mediam a PRESENÇA (e presença sobrevive a `= []`), e travas que casavam com ZERO ocorrências.
 *
 * CADA GARANTIA ABAIXO NASCEU DE UM ERRO REAL, e todas custaram uma rodada inteira:
 *
 *  1. ⚠️ CONFERE QUE O ARQUIVO MUDOU. "A âncora não casou" se lê IGUAL a "a trava passou em branco"
 *     -- e um defeito real quase passou por aí. Aqui a âncora que não casa é reportada como ANCORA,
 *     nunca como MUDO.
 *  2. ⚠️ CONTA `FALHOU` **E** `FALHA`. Metade dos testes da casa imprime um, metade o outro; e o
 *     sumário imprime `N FALHA(S)`, então contar só ele dá "1 falha" em TODO caso -- um "1" idêntico
 *     em treze casos diferentes foi o que denunciou. Quarta vez desta armadilha.
 *  3. ⚠️ MORTE E TIMEOUT CONTAM COMO ACUSAÇÃO, mas são MARCADAS. Uma trava que estoura acusa, só
 *     acusa pior: "acusa morrendo" não distingue uma trava que mede a regra de uma que só não roda.
 *     ⚠️ E "MORREU" É NÃO TER IMPRESSO O SUMÁRIO, nunca o stderr ter a palavra "Error": há teste
 *     daqui que escreve 1,4 KB de `console.error` passando, e o detector disparava em todos.
 *  4. ⚠️ CONFERE QUE O DEFEITO COMPILA. Um `}` comido por um recorte faz o teste morrer com
 *     SyntaxError, e isso se lê como acusação quando não é -- o defeito nunca chegou a rodar.
 *  5. ⚠️ RESTAURA NO `finally`. Um script que estoura no meio deixa o DEFEITO INJETADO no arquivo --
 *     aconteceu em 24/09/2026 e só o teste seguinte pegou (a versão do anúncio tinha voltado).
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const RAIZ = path.join(__dirname, '..');
const arg = process.argv[2];
const soOCaso = (() => { const i = process.argv.indexOf('--caso'); return i > 0 ? +process.argv[i + 1] : 0; })();

if(!arg){ console.log('  uso: node tools/acusar.js <casos.js> [--caso N]'); process.exit(1); }
const CASOS = require(path.resolve(arg));
if(!Array.isArray(CASOS) || !CASOS.length){
  console.log('  X o arquivo tem que exportar uma LISTA de casos'); process.exit(1);
}

/* ---- guarda o original de TODO arquivo tocado, e restaura sempre ---- */
const arquivos = [...new Set(CASOS.map(c => c.arquivo))];
const orig = {};
arquivos.forEach(a => { orig[a] = fs.readFileSync(path.join(RAIZ, a), 'utf8'); });
const restaura = () => arquivos.forEach(a => fs.writeFileSync(path.join(RAIZ, a), orig[a]));

/* ⚠️ A REDE DO `finally` NÃO BASTA SOZINHA: um Ctrl+C ou um kill não passam por ele. Estes dois
   ganchos são o que garante que o defeito nunca fica no arquivo. */
process.on('SIGINT',  () => { restaura(); console.log('\n  (interrompido -- arquivos restaurados)'); process.exit(130); });
process.on('uncaughtException', e => { restaura(); console.log('\n  X ' + e.message + '  (arquivos restaurados)'); process.exit(1); });

function compila(arquivo, texto){
  try{
    if(/\.js$/.test(arquivo)) new (require('vm').Script)(texto, { filename: arquivo });
    else if(/\.html$/.test(arquivo)){
      const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
      let m; while((m = re.exec(texto))) new Function(m[1]);
    }
    return null;
  } catch(e){ return e.message; }
}

function roda(testes){
  const out = [];
  for(const t of testes){
    let s = '', morreu = false, matou = false;
    try{
      s = cp.execFileSync('node', [path.join(RAIZ, 'tools', t + '.js')],
                          { encoding:'utf8', timeout: 300000, stdio:['ignore','pipe','pipe'] });
    } catch(e){
      s = (e.stdout || '') + (e.stderr || '');
      matou = !!e.killed;
    }
    /* ⚠️ O CRITÉRIO DE "MORREU" É NÃO TER TERMINADO, e nunca o stderr ter a palavra "Error": há
       teste da casa que escreve 1,4 KB de `console.error` MESMO PASSANDO (ele exercita o caminho
       de erro de propósito), então o detector disparava sempre -- e um detector que dispara sempre
       não é detector. Todo teste daqui fecha com "Tudo certo." ou "N FALHA(S)"; não imprimir nenhum
       dos dois é o que "morreu antes do fim" quer dizer. */
    const terminou = /Tudo certo\.|FALHA\(S\)/.test(s);
    morreu = matou || !terminou;
    const n = (s.match(/FALHOU|FALHA\b/g) || []).length;
    if(n > 0) out.push(t + ':' + n + (morreu ? (matou ? '(e ESTOUROU O PRAZO)' : '(e morreu no meio)') : ''));
    else if(morreu) out.push(t + (matou ? '(SO ESTOUROU O PRAZO)' : '(SO MORREU -- nao chegou ao fim)'));
  }
  return out;
}

let mudos = 0, acusam = 0, i = 0;
try{
  for(const c of CASOS){
    i++;
    if(soOCaso && i !== soOCaso) continue;
    const rotulo = '[' + i + '] ' + (c.titulo || 'caso ' + i);
    const p = path.join(RAIZ, c.arquivo);
    const antes = fs.readFileSync(p, 'utf8');

    let depois, n;
    if(c.de instanceof RegExp){
      const re = new RegExp(c.de.source, c.de.flags.indexOf('g') >= 0 ? c.de.flags : c.de.flags + 'g');
      n = (antes.match(re) || []).length;
      depois = antes.replace(re, c.para);
    } else {
      n = antes.split(c.de).length - 1;
      depois = antes.split(c.de).join(c.para);
    }

    /* garantia 1: a âncora casou? */
    const vezes = c.vezes == null ? 1 : c.vezes;
    if(n !== vezes){
      console.log('  ANCORA  ' + rotulo + '   (achou ' + n + ', esperava ' + vezes + ')');
      mudos++; continue;
    }
    if(depois === antes){
      console.log('  NAO MUDOU  ' + rotulo + '   (o `para` e igual ao `de`?)');
      mudos++; continue;
    }

    fs.writeFileSync(p, depois);

    /* garantia 4: o defeito compila? */
    const erroSintaxe = compila(c.arquivo, depois);
    if(erroSintaxe){
      console.log('  NAO COMPILA  ' + rotulo + '   ' + erroSintaxe.slice(0, 60));
      console.log('             (o teste morreria por SINTAXE, nao pela regra -- ajuste o recorte)');
      mudos++; restaura(); continue;
    }

    const r = roda(c.testes || []);
    if(r.length){ console.log('  acusa   ' + rotulo + '   ' + r.join(' ')); acusam++; }
    else { console.log('  MUDO    ' + rotulo); mudos++; }
    restaura();
  }
} finally {
  /* ⚠️ garantia 5 */
  restaura();
}

const total = soOCaso ? 1 : CASOS.length;
console.log('\n  ' + acusam + ' de ' + total + ' defeitos acusam' + (mudos ? '  -- ' + mudos + ' MUDO(S)/ANCORA' : ''));
process.exit(mudos ? 1 : 0);
