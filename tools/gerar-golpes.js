#!/usr/bin/env node
/**
 * GERA A BASE DE GOLPES POR NÍVEL (data/golpes.json).
 *
 * De onde vem o dado: do Pokémon Showdown, a MESMA fonte que o projeto já usou pra reconstruir o
 * GEN2_SPECIAL de Johto -- e pelo mesmo método, aplicando os mods gen8→gen2 sobre os valores
 * atuais. Duas peças:
 *   - data/mods/gen2/learnsets.ts  -> quem aprende o quê e em que nível (tags "2L<n>" e "1L<n>")
 *   - data/moves.json + os mods    -> tipo, poder, PP e precisão de cada golpe NA GEN 2
 *
 * POR QUE OS MODS IMPORTAM: vários golpes mudaram de geração pra geração. Bite e Karate Chop eram
 * NORMAL na Gen 1; na Gen 2 viraram Sombrio e Lutador. Ler o arquivo moderno direto daria o valor
 * da Gen 9. A cadeia é aplicada 8→2, na ordem, exatamente como o CLAUDE.md descreve pro
 * GEN2_SPECIAL.
 *
 * A CATEGORIA (físico/especial) NÃO é gravada de propósito: neste motor quem decide isso é o TIPO
 * do golpe (regra da Gen 1, ver isSpecialType), não o golpe. Gravar a categoria moderna do Showdown
 * (que é por golpe, da Gen 4 em diante) criaria uma segunda fonte de verdade discordando do motor.
 * O que fica é `poder: 0`, que é como um golpe de status se identifica.
 *
 * Os fontes ficam no TEMP; baixar é assim:
 *   curl -o $TEMP/moves.json https://play.pokemonshowdown.com/data/moves.json
 *   curl -o $TEMP/gen2-learnsets.ts https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen2/learnsets.ts
 *   for g in 8 7 6 5 4 3 2; do curl -o $TEMP/moves-gen$g.ts https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen$g/moves.ts; done
 *
 *   node tools/gerar-golpes.js
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const TEMP = process.env.TEMP || '/tmp';
const S = require('./game-sandbox').createSandbox();

/* O learnsets.ts é um literal de objeto puro -- nenhuma chamada de função. Recortar do primeiro {
   ao último } e avaliar é o caminho mais curto, e isto é um script de BUILD que roda aqui, não
   código que vai pro ar. */
function lerLiteral(arquivo){
  const src = fs.readFileSync(path.join(TEMP, arquivo), 'utf8');
  const i = src.indexOf('{'), j = src.lastIndexOf('}');
  if(i < 0 || j < 0) throw new Error('não achei o literal em ' + arquivo);
  return Function('return ' + src.slice(i, j + 1))();
}

/* Os mods de GOLPE não dão pra avaliar: são TypeScript de verdade, com `!` de non-null e corpos de
   função. Como só preciso de quatro campos, e todos aparecem no PRIMEIRO nível do bloco (dois tabs
   de indentação), um recorte por bloco resolve -- e ignora tudo que está dentro de onHit e afins. */
function overridesDeGolpe(arquivo){
  const src = fs.readFileSync(path.join(TEMP, arquivo), 'utf8');
  const out = {};
  const re = /\n\t([a-z0-9]+): \{\n([\s\S]*?)\n\t\},/g;
  let m;
  while((m = re.exec(src))){
    const id = m[1], corpo = m[2];
    const campo = (nome) => {
      const r = new RegExp('^\\t\\t' + nome + ': (.+?),?$', 'm');
      const x = corpo.match(r);
      return x ? x[1].trim().replace(/,$/, '') : undefined;
    };
    const o = {};
    const tipo = campo('type');       if(tipo !== undefined) o.tipo = tipo.replace(/^"|"$/g, '');
    const poder = campo('basePower'); if(poder !== undefined && /^\d+$/.test(poder)) o.poder = Number(poder);
    const pp = campo('pp');           if(pp !== undefined && /^\d+$/.test(pp)) o.pp = Number(pp);
    const acc = campo('accuracy');
    if(acc !== undefined){
      if(acc === 'true') o.precisao = 100;
      else if(/^\d+$/.test(acc)) o.precisao = Number(acc);
    }
    if(Object.keys(o).length) out[id] = o;
  }
  return out;
}

/* ---- 1. Os golpes COMO ERAM NA GEN 2 ---- */
const modernos = JSON.parse(fs.readFileSync(path.join(TEMP, 'moves.json'), 'utf8'));
const golpes = {};
Object.entries(modernos).forEach(([id, m]) => {
  golpes[id] = { nome: m.name, tipo: m.type, poder: m.basePower || 0,
                 pp: m.pp || 0, precisao: (m.accuracy === true) ? 100 : (m.accuracy || 0),
                 num: m.num };
});
for(const g of [8, 7, 6, 5, 4, 3, 2]){
  const mod = overridesDeGolpe('moves-gen' + g + '.ts');
  Object.entries(mod).forEach(([id, over]) => {
    if(!golpes[id]) return;
    if(over.tipo !== undefined) golpes[id].tipo = over.tipo;
    if(over.poder !== undefined) golpes[id].poder = over.poder;
    if(over.pp !== undefined) golpes[id].pp = over.pp;
    if(over.precisao !== undefined) golpes[id].precisao = over.precisao;
  });
}

/* ---- 2. Quem aprende o quê ---- */
const learnsets = lerLiteral('gen2-learnsets.ts');
/* O id da espécie é o mesmo dos dois lados, com UMA exceção: o jogo escreve Ratata com um T só
   desde sempre, e o Showdown usa a grafia oficial. */
const NOSSO_PRA_SHOWDOWN = { ratata: 'rattata' };

const base = {}, semGolpe = [], soGen1 = [];
Object.keys(S.SPECIES).forEach(id => {
  const e = learnsets[NOSSO_PRA_SHOWDOWN[id] || id];
  if(!e || !e.learnset){ semGolpe.push(id); return; }
  const pega = (marca) => {
    const lista = [];
    Object.entries(e.learnset).forEach(([golpe, tags]) => {
      tags.forEach(t => {
        const m = new RegExp('^' + marca + 'L(\\d+)$').exec(t);
        if(m) lista.push({ n: Number(m[1]), g: golpe });
      });
    });
    return lista;
  };
  /* 2L é o aprendizado por NÍVEL da Gen 2. Se a espécie não tiver nenhum (não deveria acontecer
     nas 250, mas o dado é de terceiro), cai pro 1L e isso é NOMEADO na saída do script -- uma
     lacuna silenciosa aqui viraria um pokémon sem golpe nenhum na tela, meses depois. */
  let lista = pega('2');
  if(!lista.length){ lista = pega('1'); if(lista.length) soGen1.push(id); }
  if(!lista.length){ semGolpe.push(id); return; }
  /* Mesmo golpe em dois níveis existe (o jogo original repete alguns): fica o MENOR, que é quando
     ele de fato aparece pra quem está subindo de nível. */
  const menor = new Map();
  lista.forEach(x => { if(!menor.has(x.g) || menor.get(x.g) > x.n) menor.set(x.g, x.n); });
  base[id] = [...menor.entries()].map(([g, n]) => ({ n, g }))
    .sort((a, b) => a.n - b.n || a.g.localeCompare(b.g));
});

/* ---- 3. Só os golpes que alguém aprende ---- */
const usados = new Set();
Object.values(base).forEach(l => l.forEach(x => usados.add(x.g)));
const dicionario = {}, semFicha = [];
[...usados].sort().forEach(id => {
  const g = golpes[id];
  if(!g){ semFicha.push(id); return; }
  dicionario[id] = { nome: g.nome, tipo: g.tipo, poder: g.poder, pp: g.pp, precisao: g.precisao };
});

/* ---- 4. Grava ---- */
const saida = {
  _fonte: 'Pokémon Showdown: data/moves.json com os mods gen8→gen2 aplicados, e data/mods/gen2/learnsets.ts',
  _gerado_por: 'tools/gerar-golpes.js',
  _nota: 'Aprendizado por NÍVEL da Gen 2 (tag 2L). A categoria físico/especial NÃO está aqui: neste motor quem decide é o TIPO do golpe (isSpecialType). poder 0 = golpe de status.',
  golpes: dicionario,
  porEspecie: base
};
const destino = path.join(RAIZ, 'data', 'golpes.json');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, JSON.stringify(saida, null, 1));

const total = Object.values(base).reduce((s, l) => s + l.length, 0);
console.log('espécies com aprendizado: ' + Object.keys(base).length + ' de ' + Object.keys(S.SPECIES).length);
if(semGolpe.length) console.log('SEM NENHUM GOLPE: ' + semGolpe.join(', '));
if(soGen1.length)   console.log('só com aprendizado da Gen 1: ' + soGen1.join(', '));
if(semFicha.length) console.log('golpe sem ficha no moves.json: ' + semFicha.join(', '));
console.log('entradas (espécie × nível): ' + total);
console.log('golpes distintos: ' + Object.keys(dicionario).length);
console.log('gravado: data/golpes.json (' + Math.round(fs.statSync(destino).size / 1024) + ' KB)');
