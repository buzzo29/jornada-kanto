/**
 * APLICA UMA RECEITA DE TROCAS DE TEXTO, tudo-ou-nada.
 *
 *   node tools/patch.js <receita.js>
 *   node tools/patch.js <receita.js> --seco     (só confere, não escreve)
 *
 * A receita é um ARQUIVO JS que exporta uma lista de trocas:
 *
 *   module.exports = [
 *     { arquivo:'index.html', rotulo:'a guarda nova',
 *       de:   'if(x) return;',
 *       para: 'if(x || y) return;' },
 *     { arquivo:'functions/index.js', rotulo:'o mesmo no servidor', vezes:2, de:..., para:... },
 *     { arquivo:'index.html', rotulo:'por regex', de:/const X = \d+/, para:'const X = 9' },
 *   ];
 *
 * ⚠️ POR QUE ELA É UM ARQUIVO, E NUNCA UM `node -e` OU UM HEREDOC: o shell come escape. Um `\\d`
 * escrito num heredoc chega no node como `d`, um `${` vira `bad substitution` e uma crase EXECUTA
 * como comando -- e nenhum dos três dá erro: o patch "roda", imprime ok, e o arquivo fica errado ou
 * intocado. Isso custou cinco voltas numa sessão só (ver o CLAUDE.md, 24/09/2026), e uma delas
 * apagou duas palavras de um comentário. Escrita com a ferramenta de edição, a receita não passa
 * pelo shell e não há o que escapar.
 *
 * O QUE ELE GARANTE, e cada garantia nasceu de um defeito real deste projeto:
 *
 *  1. ⚠️ A CONTAGEM. Cada `de` tem que aparecer EXATAMENTE `vezes` (1 por padrão). Âncora que não
 *     casa se lê igual a "deu certo" -- foi assim que uma troca do selo não foi aplicada e o "ok
 *     sintaxe" logo abaixo disse que estava tudo bem.
 *  2. ⚠️ TUDO-OU-NADA. Todos os arquivos são preparados EM MEMÓRIA e só então escritos. Um script
 *     que escreve o primeiro e estoura no segundo deixa os DOIS MOTORES divergindo no disco -- e
 *     essa divergência não dá erro: ela faz a mesma batalha terminar diferente no cliente e no
 *     servidor.
 *  3. ⚠️ O DELTA DE TAMANHO, impresso sempre. Um `process.argv[1]` no lugar do `[2]` já escreveu o
 *     próprio script por cima da tabela de desenhos: 55.642 caracteres viraram 472, e o
 *     `node --check` PASSOU (o que sobrou era JS válido). Verificação de sintaxe não é verificação
 *     de conteúdo -- o número é o que denuncia.
 *  4. ⚠️ A SINTAXE, nos dois formatos. `.js` pelo `node --check`; no `index.html` cada `<script>` é
 *     compilado à parte, que é o único jeito de pegar a crase que fecha um template literal (com um
 *     número PAR de crases o arquivo continua "válido" e a tela só morre no navegador).
 *  5. BACKUP em `.patch-bak/`, pra desfazer sem depender do git.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const receitaArg = process.argv[2];
const SECO = process.argv.indexOf('--seco') > 0;

if(!receitaArg){
  console.log('  uso: node tools/patch.js <receita.js> [--seco]');
  process.exit(1);
}
/* ⚠️ O ARGUMENTO É O [2], NUNCA O [1] -- o [1] é o PRÓPRIO SCRIPT. Ver a garantia 3 acima.
   E com o script vindo do stdin (`node - <<EOF`) o [1] vale "-", o que já custou um ENOENT. */
const receitaPath = path.resolve(receitaArg);
const trocas = require(receitaPath);
if(!Array.isArray(trocas) || !trocas.length){
  console.log('  X a receita tem que exportar uma LISTA de trocas');
  process.exit(1);
}

/* ---- 1) lê cada arquivo UMA vez ---- */
const conteudo = {};
const original = {};
for(const t of trocas){
  if(!t.arquivo){ console.log('  X uma troca sem `arquivo`'); process.exit(1); }
  if(conteudo[t.arquivo] === undefined){
    const p = path.join(RAIZ, t.arquivo);
    if(!fs.existsSync(p)){ console.log('  X nao existe: ' + t.arquivo); process.exit(1); }
    conteudo[t.arquivo] = original[t.arquivo] = fs.readFileSync(p, 'utf8');
  }
}

/* ---- 2) aplica TODAS em memória, conferindo a contagem ---- */
let erro = 0;
trocas.forEach((t, i) => {
  const rotulo = t.rotulo || ('troca ' + (i + 1));
  const vezes = t.vezes == null ? 1 : t.vezes;
  let n;
  if(t.de instanceof RegExp){
    /* ⚠️ O `g` é obrigatório pra CONTAR -- sem ele o match devolve 1 ocorrência e a conferência
       de contagem vira uma pergunta que sempre responde "1". */
    const re = new RegExp(t.de.source, t.de.flags.indexOf('g') >= 0 ? t.de.flags : t.de.flags + 'g');
    n = (conteudo[t.arquivo].match(re) || []).length;
    if(n === vezes) conteudo[t.arquivo] = conteudo[t.arquivo].replace(re, t.para);
  } else {
    n = conteudo[t.arquivo].split(t.de).length - 1;
    if(n === vezes) conteudo[t.arquivo] = conteudo[t.arquivo].split(t.de).join(t.para);
  }
  if(n !== vezes){
    console.log('  X ' + rotulo + '   (' + t.arquivo + ': achou ' + n + ', esperava ' + vezes + ')');
    erro++;
  } else {
    console.log('  ok ' + rotulo + (vezes > 1 ? '   (' + vezes + 'x)' : ''));
  }
});

if(erro){
  console.log('\n  ' + erro + ' TROCA(S) FALHARAM -- nada foi escrito');
  process.exit(1);
}

/* ---- 3) a sintaxe, ANTES de escrever ---- */
function conferaSintaxe(arquivo, texto){
  if(/\.js$/.test(arquivo)){
    try{ new (require('vm').Script)(texto, { filename: arquivo }); return null; }
    catch(e){ return e.message; }
  }
  if(/\.html$/.test(arquivo)){
    /* cada <script> sem src, compilado à parte */
    const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
    let m, i = 0;
    while((m = re.exec(texto))){
      i++;
      try{ new Function(m[1]); }
      catch(e){ return '<script> #' + i + ': ' + e.message; }
    }
  }
  return null;
}

console.log('');
for(const arquivo of Object.keys(conteudo)){
  const msg = conferaSintaxe(arquivo, conteudo[arquivo]);
  if(msg){ console.log('  X SINTAXE  ' + arquivo + '   ' + msg); erro++; }
}
if(erro){
  console.log('\n  SINTAXE QUEBRADA -- nada foi escrito');
  process.exit(1);
}

/* ---- 4) o delta de tamanho, sempre impresso ---- */
for(const arquivo of Object.keys(conteudo)){
  const a = original[arquivo].length, d = conteudo[arquivo].length;
  const sinal = d >= a ? '+' : '';
  console.log('  ' + arquivo + ': ' + a + ' -> ' + d + ' (' + sinal + (d - a) + ')');
  /* ⚠️ UMA QUEDA GRANDE É SUSPEITA e vale um aviso: foi assim que a tabela de desenhos foi
     apagada por um patch que imprimiu "ok" em todas as trocas. */
  if(d < a * 0.9) console.log('    ⚠ o arquivo encolheu mais de 10% -- confira se era isso mesmo');
}

if(SECO){ console.log('\n  --seco: nada escrito'); process.exit(0); }

/* ---- 5) backup e escrita ---- */
const bak = path.join(RAIZ, '.patch-bak');
if(!fs.existsSync(bak)) fs.mkdirSync(bak);
for(const arquivo of Object.keys(conteudo)){
  fs.writeFileSync(path.join(bak, arquivo.replace(/[\\/]/g, '__')), original[arquivo]);
  fs.writeFileSync(path.join(RAIZ, arquivo), conteudo[arquivo]);
}
console.log('\n  escrito  (backup em .patch-bak/)');
