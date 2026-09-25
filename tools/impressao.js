/**
 * A IMPRESSÃO DO MOTOR E DO DIÁRIO: 900 batalhas semeadas, dois hashes.
 *
 *   node tools/impressao.js                      (o index.html do repo)
 *   node tools/impressao.js <a.html> <b.html>    (compara duas cópias, é o uso que importa)
 *   node tools/impressao.js ... --equipa         (painel que dá moveset aos dois lados)
 *   node tools/impressao.js ... --terreno        (painel com terreno marcado)
 *
 * MOTOR  = quem ganhou e quantos confrontos. DIARIO = cada golpe, lado a lado.
 * Os dois juntos separam "mudou a MECÂNICA" de "mudou só a APRESENTAÇÃO": um conserto de log muda o
 * DIARIO e deixa o MOTOR intacto; um ajuste de dano muda os dois.
 *
 * ⚠️ UM HASH IMÓVEL SÓ PROVA ALGUMA COISA QUANDO O PAINEL EXERCITA O CAMINHO QUE A MUDANÇA TOCA.
 * O painel padrão monta os times com `createInstance` e NÃO EQUIPA NINGUÉM -- sem `ataques` o motor
 * cai no de tipo, e a tabela de aprendizado não é lida uma vez sequer. Em 24/09/2026 isso quase fez
 * uma mudança de moveset ser reportada como "não mexeu no motor": com `--equipa` ela muda os dois
 * hashes, como tem que mudar. Mesma coisa com o terreno, que o painel comum nunca liga.
 *
 * ⚠️ E O INSTRUMENTO TEM QUE SER PROVADO SENSÍVEL antes de se confiar num hash que não mudou --
 * é pra isso que serve o `--sensivel`: ele mexe numa constante do motor e mostra os hashes andando.
 * Sem essa prova, "o hash está igual" e "o painel não alcança o código" são indistinguíveis.
 */
const path = require('path');
const crypto = require('crypto');
const { createSandbox } = require(path.join(__dirname, 'game-sandbox.js'));

const args = process.argv.slice(2);
const EQUIPA   = args.indexOf('--equipa') >= 0;
const TERRENO  = args.indexOf('--terreno') >= 0;
const SENSIVEL = args.indexOf('--sensivel') >= 0;
const htmls = args.filter(a => !a.startsWith('--'));

function imprime(html, mexeNoMotor){
  const S = createSandbox(html || undefined);
  /* ⚠️ O RNG É SEMEADO E SÓ DAQUI: duas rodadas do mesmo build têm que dar o mesmo hash, senão a
     comparação não mede nada. O `Math.random` do sandbox nunca entra nesta conta. */
  let seed = 12345;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const ids = Object.keys(S.SPECIES);

  const mk = (id, lv) => {
    const p = S.createInstance(id, lv);
    if(EQUIPA && S.ataquesPadrao) p.ataques = S.ataquesPadrao(p);
    if(TERRENO) p.terrainBuffed = true;
    return p;
  };

  let motor = '', diario = '';
  for(let b = 0; b < 900; b++){
    const A = [], B = [];
    for(let i = 0; i < 3; i++) A.push(mk(ids[Math.floor(rng() * ids.length)], 20 + Math.floor(rng() * 60)));
    for(let i = 0; i < 3; i++) B.push(mk(ids[Math.floor(rng() * ids.length)], 20 + Math.floor(rng() * 60)));
    const r = S.simulateGymBattle(A, B, rng);
    motor += (r.win ? 1 : 0) + ':' + (r.matchups || []).length + ';';
    (r.matchups || []).forEach(m => {
      diario += (m.golpes || []).map(x => (x.q || '') + (x.x || '') + (x.d || 0)).join(',') + '|';
    });
  }
  const h = t => crypto.createHash('sha1').update(t).digest('hex').slice(0, 12);
  return { motor: h(motor), diario: h(diario) };
}

const painel = 'painel: ' + (EQUIPA ? 'COM moveset' : 'sem moveset') + (TERRENO ? ' + terreno' : '');

if(htmls.length >= 2){
  /* ⚠️ O USO QUE IMPORTA: o MESMO script contra duas cópias. O valor ABSOLUTO de um hash só vale
     comparado com o dele mesmo -- ele muda quando o PAINEL muda, sem o motor ter mudado. */
  const a = imprime(htmls[0]);
  const b = imprime(htmls[1]);
  console.log('  ' + painel);
  console.log('  A  ' + htmls[0] + '\n     MOTOR ' + a.motor + ' / DIARIO ' + a.diario);
  console.log('  B  ' + htmls[1] + '\n     MOTOR ' + b.motor + ' / DIARIO ' + b.diario);
  const mM = a.motor !== b.motor, mD = a.diario !== b.diario;
  console.log('\n  ' + (!mM && !mD ? 'IDENTICOS -- nem mecanica nem apresentacao mudaram'
              : mM && mD ? 'OS DOIS MUDARAM -- e mudanca de MECANICA'
              : mM ? 'so o MOTOR mudou (estranho: mexe no resultado sem mexer nos golpes?)'
              : 'so o DIARIO mudou -- e APRESENTACAO, o motor esta intacto'));
  if(!mM && !mD) console.log('  ⚠ confirme o instrumento com --sensivel antes de confiar neste "identicos"');
  process.exit(0);
}

const r = imprime(htmls[0]);
console.log('  ' + painel);
console.log('  MOTOR ' + r.motor + ' / DIARIO ' + r.diario);

if(SENSIVEL){
  /* mexe numa constante do motor e mostra os dois hashes andando -- a prova de que o painel alcança
     o código. A constante é o crítico base, que entra em TODA troca de golpes. */
  const fs = require('fs');
  const src = fs.readFileSync(htmls[0] || path.join(__dirname, '..', 'index.html'), 'utf8');
  const de = /const CRIT_BASE = [\d./]+;/;
  if(!de.test(src)){ console.log('  ⚠ nao achei o CRIT_BASE pra a prova de sensibilidade'); process.exit(0); }
  const tmp = path.join(require('os').tmpdir(), 'impressao-sensivel.html');
  fs.writeFileSync(tmp, src.replace(de, 'const CRIT_BASE = 1/8;'));
  const s = imprime(tmp);
  const mudou = s.motor !== r.motor || s.diario !== r.diario;
  console.log('  com o CRIT_BASE mexido: MOTOR ' + s.motor + ' / DIARIO ' + s.diario);
  console.log('  -> o instrumento ' + (mudou ? 'E SENSIVEL: um hash imovel prova alguma coisa'
                                              : 'NAO ESTA MEDINDO NADA -- o painel nao alcanca o motor'));
  fs.unlinkSync(tmp);
}
