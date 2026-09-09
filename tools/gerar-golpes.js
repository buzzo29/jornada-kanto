#!/usr/bin/env node
/**
 * GERA A BASE DE GOLPES POR NÍVEL (data/golpes.json).
 *
 * De onde vem o dado: do Pokémon Showdown, a MESMA fonte que o projeto já usou pra reconstruir o
 * GEN2_SPECIAL de Johto -- e pelo mesmo método, só que parando na GEN 3 (FireRed/LeafGreen), que é
 * o que se pediu em 09/09/2026. Duas peças:
 *   - data/learnsets.ts         -> quem aprende o quê e em que nível (tag "3L<n>")
 *   - data/moves.json + os mods -> tipo, poder, PP e precisão de cada golpe NA GEN 3
 *
 * ATENÇÃO À FONTE DO APRENDIZADO: NÃO existe data/mods/gen3/learnsets.ts no Showdown (o mod gen3
 * só traz moves/abilities/items). O aprendizado da Gen 3 vive no arquivo PRINCIPAL, marcado com a
 * tag "3L<n>" -- é o mesmo arquivo que o gerador da Gen 2 dizia não servir, e ele não servia
 * porque foi podado da Gen 3 pra frente. Agora é exatamente a faixa que interessa.
 * O "3L" do Showdown é o conjunto da GERAÇÃO 3 inteira: ele não separa FireRed/LeafGreen de
 * Ruby/Sapphire/Emerald. Pras 250 espécies daqui os dois batem na quase totalidade dos casos, mas
 * onde divergirem o que está aqui é a união da geração, não o FRLG puro.
 *
 * POR QUE OS MODS IMPORTAM: vários golpes mudaram de geração pra geração. Ler o arquivo moderno
 * direto daria o valor da Gen 9 -- o Tackle sairia com 40/100 em vez dos 35/95 da Gen 3, e o
 * Crabhammer com 100 em vez de 90. A cadeia é aplicada 8→3, na ordem.
 *
 * A CATEGORIA (físico/especial) NÃO é gravada de propósito: neste motor quem decide isso é o TIPO
 * do golpe (regra da Gen 1, ver isSpecialType), não o golpe. Gravar a categoria moderna do Showdown
 * (que é por golpe, da Gen 4 em diante) criaria uma segunda fonte de verdade discordando do motor.
 * O que fica é `poder: 0`, que é como um golpe de status se identifica.
 *
 * Os fontes ficam no TEMP; baixar é assim:
 *   curl -o $TEMP/moves.json https://play.pokemonshowdown.com/data/moves.json
 *   curl -o $TEMP/learnsets.ts https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/learnsets.ts
 *   for g in 8 7 6 5 4 3; do curl -o $TEMP/moves-gen$g.ts https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen$g/moves.ts; done
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

/* ---- 1. Os golpes COMO ERAM NA GEN 3 ---- */
const modernos = JSON.parse(fs.readFileSync(path.join(TEMP, 'moves.json'), 'utf8'));
const golpes = {};
Object.entries(modernos).forEach(([id, m]) => {
  golpes[id] = { nome: m.name, tipo: m.type, poder: m.basePower || 0,
                 pp: m.pp || 0, precisao: (m.accuracy === true) ? 100 : (m.accuracy || 0),
                 num: m.num, categoria: m.category };
});
for(const g of [8, 7, 6, 5, 4, 3]){
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
const learnsets = lerLiteral('learnsets.ts');
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
  /* 3L é o aprendizado por NÍVEL da Gen 3. Se a espécie não tiver nenhum (não deveria acontecer
     nas 250, mas o dado é de terceiro), cai pro 4L e isso é NOMEADO na saída do script -- uma
     lacuna silenciosa aqui viraria um pokémon sem golpe nenhum na tela, meses depois. */
  let lista = pega('3');
  if(!lista.length){ lista = pega('4'); if(lista.length) soGen1.push(id); }
  if(!lista.length){ semGolpe.push(id); return; }
  /* Mesmo golpe em dois níveis existe (o jogo original repete alguns): fica o MENOR, que é quando
     ele de fato aparece pra quem está subindo de nível. */
  const menor = new Map();
  lista.forEach(x => { if(!menor.has(x.g) || menor.get(x.g) > x.n) menor.set(x.g, x.n); });
  base[id] = [...menor.entries()].map(([g, n]) => ({ n, g }))
    .sort((a, b) => a.n - b.n || a.g.localeCompare(b.g));
});

/* ---- 3. TODO POKÉMON PRECISA BATER COM O PRÓPRIO TIPO ----
   Pedido em 09/09/2026: "o Bulbasaur é Grama e Veneno, porém no moveset dele não tem nenhum ataque
   que causa dano de veneno". É verdade, e não é um caso isolado: medido na base da Gen 3, são
   51 espécies e 58 lacunas -- Veneno 12, Inseto 11, Voador 9, Terra 7, Água 6, Psíquico 5.
   A causa é que o jogo original resolve isso com TM: o Bulbasaur aprende Bomba de Lodo pela TM36
   do FireRed, e o aprendizado por NÍVEL (que é a base desta feature) nunca lhe dá um golpe de
   Veneno. Sem cobertura do próprio tipo o pokémon perde o STAB de 1,5 justamente onde ele deveria
   ser mais forte.

   A REGRA, e ela é uma só -- nada foi escolhido à mão:
   1. O candidato sai do que a espécie REALMENTE aprende na Gen 3 por qualquer via (nível, TM,
      tutor ou reprodução). Isso cobre 44 das 58 lacunas com dado de verdade, não com invenção.
   2. Entre os candidatos, ganha o de poder mais PRÓXIMO DA MEDIANA da própria espécie -- não o
      mais forte. Sem isso o Nidoking ganharia Terremoto (100) em vez de Tapa de Lama (20), e a
      "cobertura de tipo" viraria um upgrade de força disfarçado.
   3. O NÍVEL é o do golpe que a espécie já aprende com poder mais parecido; se o novo for mais
      forte que tudo que ela tem, ele vai pro nível MAIS ALTO dela. É o que impede uma Bomba de
      Lodo de 90 aparecer num Bulbasaur nível 5.
   4. Quando a Gen 3 não oferece NADA daquele tipo (14 casos: Caterpie/Metapod e Weedle/Kakuna sem
      golpe de Inseto, Magikarp sem Água, Gyarados sem Voador...), aí sim é invenção: o candidato
      passa a ser a tabela inteira, com os mesmos critérios 2 e 3.

   O DITTO FICA DE FORA, e é a única exceção. Ele ataca com o tipo de quem copiou
   (tiposProprios/ehDittoTransformado), e essa mecânica vive no bestAttackType -- que só roda
   quando melhorAtaque devolve null, ou seja, quando ele NÃO tem golpe escolhido. Dar um golpe
   Normal ao Ditto desligaria a transformação em silêncio, e ela está medida no CLAUDE.md
   (16,8% -> 22,1% de vitória, 15 confrontos impossíveis a menos). */
/* O UNIVERSO DA GEN 3, e ele precisa ser explícito: a tabela de golpes é a MODERNA com os
   overrides da Gen 3 aplicados por cima -- os mods sobrescrevem valores, não apagam golpes que
   ainda não existiam. Sem este filtro a invenção do passo 4 puxava Ferrão Mortal (Gen 6), Marretada
   Colossal (Gen 8) e Feixe Duplo (Gen 9) pro FireRed. O critério é empírico e não uma faixa de
   número decorada: é golpe da Gen 3 o que ALGUMA espécie aprende com uma tag "3" no learnsets. */
const EXISTE_NA_GEN3 = new Set();
Object.values(learnsets).forEach(e => {
  if(!e || !e.learnset) return;
  Object.entries(e.learnset).forEach(([g, tags]) => { if(tags.some(t => /^3/.test(t))) EXISTE_NA_GEN3.add(g); });
});

const TIPOS_DA_ESPECIE = id => (S.SPECIES[id] && S.SPECIES[id].types) || [];
const SEM_COMPLETAR = ['ditto'];   // ver acima: a transformação depende de ele não ter golpe
const ehDano = id => golpes[id] && golpes[id].poder > 0 && golpes[id].categoria !== 'Status';
const completados = [];

Object.keys(base).forEach(sp => {
  if(SEM_COMPLETAR.includes(sp)) return;
  const meus = base[sp].filter(x => ehDano(x.g));
  const cobertos = new Set(meus.map(x => golpes[x.g].tipo));
  const faltando = TIPOS_DA_ESPECIE(sp).filter(t => !cobertos.has(t));
  if(!faltando.length) return;

  const poderes = meus.map(x => golpes[x.g].poder).sort((a, b) => a - b);
  const mediana = poderes.length ? poderes[Math.floor(poderes.length / 2)] : 40;
  const maiorNivel = base[sp].reduce((m, x) => Math.max(m, x.n), 1);
  const e = learnsets[NOSSO_PRA_SHOWDOWN[sp] || sp];
  const podeAprender = (e && e.learnset) || {};

  faltando.forEach(tipo => {
    let candidatos = Object.keys(podeAprender)
      .filter(g => podeAprender[g].some(t => /^3/.test(t)))
      .filter(g => ehDano(g) && golpes[g].tipo === tipo);
    let inventado = false;
    if(!candidatos.length){
      candidatos = [...EXISTE_NA_GEN3].filter(g => ehDano(g) && golpes[g].tipo === tipo);
      inventado = true;
    }
    if(!candidatos.length) return;
    candidatos.sort((a, b) => Math.abs(golpes[a].poder - mediana) - Math.abs(golpes[b].poder - mediana)
                           || golpes[a].poder - golpes[b].poder || a.localeCompare(b));
    const esc = candidatos[0], poder = golpes[esc].poder;
    /* O nível: o do golpe de poder mais parecido que ela já tem. Mais forte que tudo -> o topo. */
    let nivel = maiorNivel;
    if(meus.length && poder <= Math.max(...meus.map(x => golpes[x.g].poder))){
      const perto = meus.slice().sort((a, b) => Math.abs(golpes[a.g].poder - poder) - Math.abs(golpes[b.g].poder - poder) || b.n - a.n)[0];
      nivel = perto.n;
    }
    /* PISO PELO PODER, e ele existe por um caso concreto: o Abra não aprende UM golpe de dano por
       nível na Gen 3, então "o nível mais alto dele" é 1 -- e a regra entregava um Psíquico de 90
       a um Abra nível 1, que é capturável cedo. Meio poder vira nível (90 -> 45), com teto de 50
       pra nada nascer acima da faixa em que o jogo distribui nível. Quem já tinha um nível mais
       alto pela regra de cima não é tocado. */
    nivel = Math.max(nivel, Math.min(50, Math.round(poder / 2)));
    if(base[sp].some(x => x.g === esc)) return;   // já tem o golpe (status no aprendizado, p.ex.)
    base[sp].push({ n: nivel, g: esc });
    base[sp].sort((a, b) => a.n - b.n || a.g.localeCompare(b.g));
    completados.push({ especie: sp, tipo, golpe: esc, nome: golpes[esc].nome, poder, nivel, inventado });
  });
});

/* ---- 4. Só os golpes que alguém aprende ---- */
const usados = new Set();
Object.values(base).forEach(l => l.forEach(x => usados.add(x.g)));
const dicionario = {}, semFicha = [];
[...usados].sort().forEach(id => {
  const g = golpes[id];
  if(!g){ semFicha.push(id); return; }
  dicionario[id] = { nome: g.nome, tipo: g.tipo, poder: g.poder, pp: g.pp, precisao: g.precisao };
});

/* ---- 5. Grava ---- */
const saida = {
  _fonte: 'Pokémon Showdown: data/moves.json com os mods gen8→gen3 aplicados, e o data/learnsets.ts principal (tag 3L)',
  _gerado_por: 'tools/gerar-golpes.js',
  _nota: 'Aprendizado por NÍVEL da Gen 3 / FireRed (tag 3L -- o Showdown não separa FRLG de RSE). A categoria físico/especial NÃO está aqui: neste motor quem decide é o TIPO do golpe (isSpecialType). poder 0 = golpe de status.',
  _completados: 'Golpes acrescentados pela regra "todo pokémon bate com o próprio tipo" (ver o passo 3 do gerador). ' +
                completados.length + ' ao todo, ' + completados.filter(c => c.inventado).length + ' deles sem opção real na Gen 3.',
  golpes: dicionario,
  porEspecie: base,
  completados
};
const destino = path.join(RAIZ, 'data', 'golpes.json');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, JSON.stringify(saida, null, 1));

const total = Object.values(base).reduce((s, l) => s + l.length, 0);
console.log('espécies com aprendizado: ' + Object.keys(base).length + ' de ' + Object.keys(S.SPECIES).length);
if(semGolpe.length) console.log('SEM NENHUM GOLPE: ' + semGolpe.join(', '));
if(soGen1.length)   console.log('sem 3L, caiu no 4L: ' + soGen1.join(', '));
if(semFicha.length) console.log('golpe sem ficha no moves.json: ' + semFicha.join(', '));
console.log('entradas (espécie × nível): ' + total);
console.log('golpes distintos: ' + Object.keys(dicionario).length);
console.log('cobertura de tipo: ' + completados.length + ' golpes acrescentados em ' +
            new Set(completados.map(c => c.especie)).size + ' espécies (' +
            completados.filter(c => c.inventado).length + ' sem opção real na Gen 3)');
completados.forEach(c => console.log('   ' + c.especie.padEnd(12) + c.tipo.padEnd(9) +
  c.nome + '(' + c.poder + ') no nível ' + c.nivel + (c.inventado ? '   [INVENTADO]' : '')));
console.log('gravado: data/golpes.json (' + Math.round(fs.statSync(destino).size / 1024) + ' KB)');
