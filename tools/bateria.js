#!/usr/bin/env node
/* A BATERIA, COM O CRITERIO CERTO DE "PASSOU".
 *
 * ⚠️ ELA NASCEU DE UM DEFEITO QUE FOI PRO AR (24/09/2026): a Liga Pro quebrou em producao com um
 * `if(ativo)` orfao, e a bateria que eu rodava na mao -- um laco de shell que procurava
 * "FALHA|FALHOU" na saida -- disse 43 de 43. A causa e que um teste que MORRE nao imprime nenhuma
 * das duas palavras: ele imprime um stack trace. O laco contava isso como OK, e foi esse elo que
 * deixou tres defeitos meus chegarem no ar de uma vez.
 *
 * ⚠️ O CRITERIO E O EXIT CODE, e ele e o unico universal: node sai != 0 quando o script estoura,
 * quando o timeout dispara e quando o teste faz process.exit(1).
 *
 * ⚠️ O SUMARIO NAO SERVE DE CRITERIO, e a primeira versao desta ferramenta provou: os testes da
 * casa tem CINCO formatos dele -- "Tudo certo." (35 deles), "N/N casos passaram." (5),
 * "Tudo certo. (N casos)", "Tudo certo.  (N assercoes)" e "tudo certo" em minuscula. Conhecendo so
 * o primeiro, ela reportou 6 testes CERTOS como mortos. Ele entra aqui so pra dizer POR QUE falhou.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const alvo = process.argv[2];                 /* opcional: roda so os que casam com o texto */
const testes = fs.readdirSync(path.join(RAIZ, 'tools'))
  .filter(n => /^test-.*\.js$/.test(n))
  .filter(n => !alvo || n.indexOf(alvo) >= 0)
  .sort();

if (!testes.length) { console.log('  nenhum teste casou com "' + alvo + '"'); process.exit(1); }

const ini = Date.now();
let ok = 0;
const ruins = [];

for (const t of testes) {
  let saida = '', morreu = false;
  try {
    saida = execFileSync('node', [path.join('tools', t)], {
      cwd: RAIZ, encoding: 'utf8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    saida = (e.stdout || '') + (e.stderr || '');
    morreu = true;                            /* exit != 0, ou o timeout disparou */
  }
  const acusou = /FALHOU|FALHA\(S\)/.test(saida);
  const temSumario = /Tudo certo|tudo certo|casos passaram/.test(saida);

  if (acusou) ruins.push([t, (saida.match(/(\d+) FALHA/) || [, '?'])[1] + ' falha(s)']);
  else if (morreu) ruins.push([t, temSumario ? 'terminou mas saiu com erro' : 'MORREU (estourou ou travou)']);
  else ok++;
}

const seg = Math.round((Date.now() - ini) / 1000);
console.log('  ' + ok + ' de ' + testes.length + ' em ' + seg + 's');
ruins.forEach(([t, por]) => console.log('    X ' + t + '  -- ' + por));
process.exit(ruins.length ? 1 : 0);
