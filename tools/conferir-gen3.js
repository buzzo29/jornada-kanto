/**
 * CONFERE O MOTOR CONTRA A GEN 3 -- as 289 relações de tipo e as 250 tipagens (27/09/2026).
 *
 * ⚠️ POR QUE ELA NÃO ESTÁ NA BATERIA: ela precisa de REDE. A referência é baixada do Pokémon
 * Showdown na hora, e é isso que a torna uma conferência de verdade -- uma cópia da tabela
 * escrita aqui seria só uma segunda opinião minha. O `tools/test-terrenos.js` tranca as 289
 * relações contra uma referência ESCRITA (derivada desta varredura) e roda na bateria; esta aqui
 * é pra quando alguém quiser conferir de novo contra a fonte.
 *
 * ⚠️ E ELA EXISTE PORQUE VARRER ACHOU O QUE APONTAR NÃO ACHOU: uma auditoria externa nomeou os
 * quatro pares de tipo errados e NÃO achou duas tipagens de espécie. Conferir "o que alguém
 * apontou" não prova que é só aquilo.
 *
 * A FONTE: a Gen 3 não tem mod de pokédex nem de typechart no Showdown (404 -- a mesma armadilha
 * que o `gerar-golpes.js` registra pro learnsets). Então a referência é a tabela MODERNA mais o
 * mod da GEN 5, que é o último antes de a Fada existir: entre a Gen 3 e a Gen 5 nem a tabela nem
 * a tipagem das 250 daqui mudaram.
 *
 *   node tools/conferir-gen3.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { createSandbox } = require('./game-sandbox');

const FONTES = {
  'pokedex.json': 'https://play.pokemonshowdown.com/data/pokedex.json',
  'typechart.ts': 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/typechart.ts',
  'tc-gen5.ts':   'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen5/typechart.ts',
  'dex-gen5.ts':  'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen5/pokedex.ts',
};

/* ⚠️ AS ESPÉCIES QUE DIVERGEM DE PROPÓSITO. Sem esta lista a varredura acusaria uma decisão de
   design como defeito toda vez que rodasse -- e é justamente o que faria alguém "consertá-la".
   O Psyduck/Golduck Psíquico é invenção do projeto: ele foi corrigido em 27/09/2026 e DEVOLVIDO
   no mesmo dia, a pedido, porque a correção custava -1,50 ponto de conclusão de jornada. */
const EXCECOES = {
  psyduck: 'o Psíquico é invenção do projeto -- devolvido a pedido em 27/09/2026 (vale -1,50 ponto)',
  golduck: 'idem',
};

function baixar(url, destino){
  return new Promise((ok, erro) => {
    const pega = (u, n) => https.get(u, r => {
      if(r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && n < 5){
        r.resume(); return pega(r.headers.location, n + 1);
      }
      if(r.statusCode !== 200){ r.resume(); return erro(new Error(u + ' -> HTTP ' + r.statusCode)); }
      const p = []; r.on('data', d => p.push(d));
      r.on('end', () => { fs.writeFileSync(destino, Buffer.concat(p)); ok(); });
    }).on('error', erro);
    pega(url, 0);
  });
}

/* o .ts do Showdown é objeto JS com uma entrada por tipo/espécie */
function blocos(txt){
  const out = {};
  const re = /^\t(\w+):\s*\{([\s\S]*?)^\t\},/gm;
  let m; while((m = re.exec(txt))) out[m[1]] = m[2];
  return out;
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen3-'));
  process.stdout.write('  baixando a referência... ');
  for(const [arq, url] of Object.entries(FONTES)) await baixar(url, path.join(dir, arq));
  console.log('ok (' + dir + ')');

  const ler = a => fs.readFileSync(path.join(dir, a), 'utf8');

  /* ---------- a tabela: `damageTaken` é indexado pelo tipo ATACANTE ---------- */
  const COD = { 0: 1, 1: 2, 2: 0.5, 3: 0 };
  const mapa = (txt) => {
    const o = {};
    for(const [tipo, corpo] of Object.entries(blocos(txt))){
      const dt = corpo.match(/damageTaken:\s*\{([\s\S]*?)\}/);
      if(!dt) continue;
      o[tipo] = {};
      for(const par of dt[1].split(',')){
        const [k, v] = par.split(':');
        if(k && v && /^\d+$/.test(v.trim())) o[tipo][k.trim()] = Number(v.trim());
      }
    }
    return o;
  };
  const base = mapa(ler('typechart.ts')), g5 = mapa(ler('tc-gen5.ts'));
  for(const d of Object.keys(g5)) base[d] = Object.assign({}, base[d], g5[d]);
  const gen3 = (a, d) => {
    const l = base[d.toLowerCase()];
    return (l && l[a] !== undefined) ? COD[l[a]] : 1;
  };

  const S = createSandbox();
  const TIPOS = ['Normal','Fire','Water','Grass','Electric','Ice','Fighting','Poison','Ground',
                 'Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel'];
  const jogo = (a, d) => (S.TYPE_CHART[a] && S.TYPE_CHART[a][d] !== undefined) ? S.TYPE_CHART[a][d] : 1;

  let ruim = 0;
  console.log('\n=== AS 289 RELAÇÕES DE TIPO ===');
  for(const a of TIPOS) for(const d of TIPOS){
    if(jogo(a, d) === gen3(a, d)) continue;
    ruim++; console.log('  DIVERGE  ' + (a + ' -> ' + d).padEnd(20) + 'jogo ' + jogo(a, d) + '   gen3 ' + gen3(a, d));
  }
  console.log('  ' + (TIPOS.length * TIPOS.length) + ' varridas, ' + ruim + ' divergem');

  /* ---------- as tipagens ---------- */
  const dex = JSON.parse(ler('pokedex.json'));
  const modDex = {};
  for(const [sp, corpo] of Object.entries(blocos(ler('dex-gen5.ts')))){
    const t = corpo.match(/types:\s*\[([^\]]*)\]/);
    if(t) modDex[sp] = t[1].split(',').map(x => x.trim().replace(/['"]/g, '')).filter(Boolean);
  }
  console.log('\n=== AS 250 TIPAGENS ===');
  let ruim2 = 0, excecoes = 0;
  for(const sp of Object.keys(S.SPECIES)){
    const id = sp === 'ratata' ? 'rattata' : sp;   // o único id que o jogo escreve diferente
    const esperado = modDex[id] || (dex[id] ? dex[id].types : null);
    if(!esperado){ console.log('  ?  ' + sp + ' não está na fonte'); continue; }
    if(JSON.stringify(S.SPECIES[sp].types) === JSON.stringify(esperado)) continue;
    if(EXCECOES[sp]){ excecoes++;
      console.log('  (exceção) ' + sp.padEnd(12) + JSON.stringify(S.SPECIES[sp].types)
        + '  gen3 ' + JSON.stringify(esperado) + '  -- ' + EXCECOES[sp]);
      continue; }
    ruim2++;
    console.log('  DIVERGE  ' + sp.padEnd(12) + 'jogo ' + JSON.stringify(S.SPECIES[sp].types)
      + '   gen3 ' + JSON.stringify(esperado));
  }
  console.log('  ' + Object.keys(S.SPECIES).length + ' varridas, ' + ruim2 + ' divergem ('
    + excecoes + ' exceção(ões) declarada(s))');

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('\n' + ((ruim + ruim2) ? (ruim + ruim2) + ' DIVERGÊNCIA(S)' : 'Tudo bate com a Gen 3.'));
  process.exit((ruim + ruim2) ? 1 : 0);
})().catch(e => { console.error('ESTOUROU: ' + e.message); process.exit(1); });
