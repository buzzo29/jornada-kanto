/**
 * TERRENOS -- a contagem por tipo.
 *
 * O terreno da partida e sorteado da lista, e quem for do tipo dele ganha 1,15x em TODOS os
 * atributos (~15 niveis de vantagem, ver CLAUDE.md). Entao a quantidade de terrenos de cada tipo
 * E balanceamento: um tipo com mais terrenos que os outros ganha o buff com mais frequencia.
 *
 * Isso ja falhou de um jeito silencioso: quando Sombrio e Aco entraram no jogo com Johto, eles
 * ficaram com ZERO terrenos -- um Umbreon ou um Steelix nunca ganhava o bonus, em partida nenhuma,
 * e nada no jogo indicava isso.
 *
 *   node tools/test-terrenos.js
 */
const path = require('path');
const fs = require('fs');
const { createSandbox } = require('./game-sandbox');
const S = createSandbox(path.join(__dirname, '..', 'index.html'));

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const T = S.TERRAINS;
const TIPOS = Object.keys(S.TYPE_CHART);
const conta = {};
TIPOS.forEach(t => conta[t] = 0);
T.forEach(ter => ter.types.forEach(t => { conta[t] = (conta[t] || 0) + 1; }));

console.log('\nCOBERTURA');
ok('todo tipo do TYPE_CHART tem terreno', TIPOS.every(t => conta[t] > 0),
   TIPOS.filter(t => !conta[t]).join(',') || '');
const tipoDesconhecido = [...new Set(T.flatMap(t => t.types))].filter(t => !S.TYPE_CHART[t]);
ok('nenhum terreno usa tipo que nao existe', tipoDesconhecido.length === 0, tipoDesconhecido.join(','));

console.log('\nEQUILIBRIO (o buff de terreno vale ~15 niveis -- ninguem pode ter mais chance)');
const valores = [...new Set(TIPOS.map(t => conta[t]))];
ok('todos os tipos tem a MESMA quantidade de terrenos', valores.length === 1,
   valores.length === 1 ? valores[0] + ' cada' :
   TIPOS.map(t => t + '=' + conta[t]).join(' '));
TIPOS.sort().forEach(t => console.log('         ' + t.padEnd(10) + conta[t]));

console.log('\nAS TRES TABELAS DE TIPO ANDAM JUNTAS');
/* TYPE_CHART decide a batalha; TYPE_NAMES_PT e TYPE_COLORS decidem o selo na tela. Quando Sombrio
   e Aço entraram no chart e não nas outras duas, o selo de um Umbreon saía escrito "Dark", em
   inglês, num cinza genérico -- e nada quebrava. */
const semNome = TIPOS.filter(t => !S.TYPE_NAMES_PT[t]);
const semCor  = TIPOS.filter(t => !S.TYPE_COLORS[t]);
ok('todo tipo tem nome em portugues', semNome.length === 0, semNome.join(','));
ok('todo tipo tem cor', semCor.length === 0, semCor.join(','));
const sobrandoNome = Object.keys(S.TYPE_NAMES_PT).filter(t => !S.TYPE_CHART[t]);
ok('nenhum nome sobrando de tipo que nao existe', sobrandoNome.length === 0, sobrandoNome.join(','));
/* pickGymTerrain traduz o nome do ginasio (em portugues) de volta pro ingles pra achar o terreno.
   Sem o tipo no TYPE_NAMES_PT ele devolve null e o terreno cai no sorteio geral -- o ginasio da
   Jasmine ficava com um terreno qualquer entre os 51, em vez de um do dominio dele. */
const semTraducao = S.KANTO_GYMS.concat(S.JOHTO_GYMS)
  .filter(g => !S.englishTypeFromPortuguese(g.gymTypeName));
ok('o tipo de todo ginasio volta do portugues pro ingles', semTraducao.length === 0,
   semTraducao.map(g => g.leaderName + ' (' + g.gymTypeName + ')').join(', '));
const semTerrenoProprio = S.KANTO_GYMS.concat(S.JOHTO_GYMS).filter(g => {
  const en = S.englishTypeFromPortuguese(g.gymTypeName);
  return !en || !T.some(t => t.types.includes(en));
});
ok('todo ginasio tem terreno do dominio dele', semTerrenoProprio.length === 0,
   semTerrenoProprio.map(g => g.leaderName).join(', '));

console.log('\nIDENTIDADE');
ok('nenhum id de terreno repetido', new Set(T.map(t => t.id)).size === T.length, String(T.length));
ok('nenhum nome de terreno repetido', new Set(T.map(t => t.name)).size === T.length);
ok('todo terreno tem nome, icone e ao menos um tipo',
   T.every(t => t.id && t.name && t.icon && Array.isArray(t.types) && t.types.length >= 1));

console.log('\nAS DUAS COPIAS (a tabela e duplicada no servidor)');
const bloco = arq => {
  const t = fs.readFileSync(path.join(__dirname, '..', arq), 'utf8');
  const i = t.indexOf('const TERRAINS = [');
  return t.slice(i, t.indexOf('\n];', i) + 3);
};
ok('TERRAINS identica em index.html e functions/index.js',
   bloco('index.html') === bloco('functions/index.js'));

console.log('\nTODA ESPECIE PODE PEGAR TERRENO');
const semTerreno = Object.keys(S.SPECIES).filter(id =>
  !S.SPECIES[id].types.some(t => conta[t] > 0));
ok('nenhuma especie fica sem terreno possivel', semTerreno.length === 0,
   semTerreno.slice(0,8).join(','));


/* ============================================================================
   A CENA DE BATALHA: o fundo de cada terreno e onde cada lutador poe o pe.

   ⚠️ O QUE ESTE BLOCO EXISTE PRA PEGAR E O DEFEITO QUE NAO DA ERRO: o fundo da cena sai de um
   SELETOR DE ATRIBUTO (`[style*="--battle-atlas:0;"]`), entao um espaco a mais depois dos
   dois-pontos, um ponto-e-virgula que sumiu ou um arquivo com o nome trocado fazem o cenario sair
   VAZIO -- sem erro no console, sem quebrar teste nenhum, e a tela continua desenhando os dois
   lutadores sobre a cor de espera. E o mesmo tipo de armadilha da classe fantasma e do
   `[hidden]` que nao vence o display.
   ============================================================================ */
console.log('\nCENA DE BATALHA -- o fundo');
const htmlCena = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const dirAssets = path.join(__dirname, '..', 'assets', 'batalha');

/* toda imagem que o CSS pede, com o seletor que a pede */
const regrasImg = [];
htmlCena.replace(/\.battle-vs\.battle-scene([^{]*)\{([^}]*background-image:url\("([^"]+)"\)[^}]*)\}/g,
  (t, sel, corpo, url) => { regrasImg.push({ sel: sel.trim(), corpo, url, pos: htmlCena.indexOf(t) }); return t; });

ok('o CSS pede imagem de fundo pra cena', regrasImg.length >= 7, regrasImg.length + ' regras');
const semArquivo = regrasImg.filter(r => !fs.existsSync(path.join(__dirname, '..', r.url)));
ok('toda imagem pedida pelo CSS existe em disco', semArquivo.length === 0,
   semArquivo.map(r => r.url).join(', '));

/* ⚠️ AS TRES CENAS DEDICADAS sao a cena INTEIRA, nao um slot da folha 3x3 -- elas PRECISAM
   sobrescrever o background-size, senao sairiam recortadas em 1/9. E elas tem que vir DEPOIS das
   do atlas: as duas alcancam a mesma cena com a mesma especificidade, entao quem vence e a
   ultima. */
const dedicadas = regrasImg.filter(r => r.sel.indexOf('--battle-scene-id:') >= 0);
const doAtlas   = regrasImg.filter(r => r.sel.indexOf('--battle-atlas:') >= 0);
ok('ha regra de atlas e regra de cena dedicada', doAtlas.length >= 6 && dedicadas.length >= 1,
   doAtlas.length + ' atlas / ' + dedicadas.length + ' dedicadas');
ok('toda cena dedicada sobrescreve o background-size',
   dedicadas.every(r => /background-size:100% 100%/.test(r.corpo)),
   dedicadas.filter(r => !/background-size:100% 100%/.test(r.corpo)).map(r => r.url).join(', '));
ok('as dedicadas vem DEPOIS das do atlas no arquivo',
   dedicadas.length === 0 || Math.min.apply(null, dedicadas.map(r => r.pos)) >
                             Math.max.apply(null, doAtlas.map(r => r.pos)));

/* ⚠️ O FORMATO DA VARIAVEL E O QUE O SELETOR LE. Um `--battle-atlas: 3;` (com espaco) nao casa
   com `[style*="--battle-atlas:3;"]`, e o fundo some. */
console.log('\nCENA DE BATALHA -- o estilo inline casa com o seletor');
const estilos = T.map(t => ({ id: t.id, st: S.terrainBattleSceneStyle(t) }));
ok('todo terreno declara --battle-scene-id no formato do seletor',
   estilos.every(e => e.st.indexOf('--battle-scene-id:' + e.id + ';') >= 0),
   estilos.filter(e => e.st.indexOf('--battle-scene-id:' + e.id + ';') < 0).map(e => e.id).slice(0,5).join(', '));
ok('todo terreno declara --battle-atlas no formato do seletor',
   estilos.every(e => /--battle-atlas:\d+;/.test(e.st)));

/* ⚠️ A TRAVA QUE IMPORTA: cada um dos 51 casa com EXATAMENTE UMA regra de imagem. Zero = cenario
   vazio; duas do mesmo tipo = a arte de um terreno aparecendo noutro. */
/* ⚠️ O `:not(...)` TEM QUE SAIR ANTES, e foi ele que derrubou a primeira versao desta trava: a
   regra do atlas 1 e DUPLA -- ela vale pra quem tem `--battle-atlas:1;` E pra quem NAO tem a
   variavel nenhuma (a cena desenhada sem o estilo). Lido cru, o `[style*="--battle-atlas:"]` de
   dentro do `:not` e substring de TODOS os 51, e a trava acusava os 42 de uma vez. */
function casa(sel, st){
  const limpo = sel.replace(/:not\([^)]*\)/g, '');
  const m = limpo.match(/\[style\*="([^"]+)"\]/g) || [];
  return m.some(p => st.indexOf(p.slice(9, -3)) >= 0);
}
const semFundo = [], comDois = [];
estilos.forEach(e => {
  const ded = dedicadas.filter(r => casa(r.sel, e.st));
  const atl = doAtlas.filter(r => casa(r.sel, e.st));
  if(ded.length + atl.length === 0) semFundo.push(e.id);
  if(ded.length > 1 || atl.length > 1) comDois.push(e.id);
});
ok('nenhum terreno fica sem regra de fundo', semFundo.length === 0, semFundo.join(', '));
ok('nenhum terreno casa com duas regras do mesmo tipo', comDois.length === 0, comDois.join(', '));

/* ============================================================================
   ONDE CADA UM POE O PE.

   ⚠️ ATE 22/09/2026 AS DUAS POSICOES ERAM FIXAS pros 51 -- (22%,84%) e (78%,64%) --, e o CENARIO
   e que tinha de ter chao ali. O SUBMARINO AFUNDADO nao tinha: o piso dele so comeca em 68% da
   altura, e o adversario nascia dentro da parede. Hoje a posicao e POR CENARIO.
   ============================================================================ */
console.log('\nCENA DE BATALHA -- o pe de cada lutador');
const iTab = htmlCena.indexOf('const TERRAIN_BATTLE_FOOTING = {');
const tabela = htmlCena.slice(iTab, htmlCena.indexOf('\n};', iTab));
ok('a tabela do pe existe no arquivo', iTab > 0, String(tabela.length) + ' chars');
const semPe = T.filter(t => tabela.indexOf('"' + t.id + '"') < 0 && tabela.indexOf('\n  ' + t.id + ':') < 0);
ok('todo terreno tem posicao PROPRIA na tabela (nenhum cai no padrao)',
   semPe.length === 0, semPe.map(t => t.id).slice(0,8).join(', '));

function pes(st){
  const n = k => parseFloat((st.match(new RegExp('--battle-' + k + ':([\\d.]+)%')) || [])[1]);
  return { px: n('player-x'), py: n('player-y'), ex: n('enemy-x'), ey: n('enemy-y') };
}
const fora = estilos.filter(e => {
  const p = pes(e.st);
  return ![p.px, p.py, p.ex, p.ey].every(v => v > 0 && v < 100);
});
ok('as quatro posicoes de todo terreno sao porcentagens dentro da cena', fora.length === 0,
   fora.map(e => e.id).join(', '));

/* ⚠️ O ADVERSARIO FICA MAIS LONGE -- e a camera e frontal, entao o pe dele e sempre MAIS ALTO na
   tela que o do jogador. Invertido, os dois trocam de profundidade e o de tras desenha na frente. */
const invertidos = estilos.filter(e => { const p = pes(e.st); return p.ey >= p.py; });
ok('o pe do adversario fica ACIMA do pe do jogador nos 51', invertidos.length === 0,
   invertidos.map(e => e.id).join(', '));

/* ⚠️ E O SUBMARINO E O CASO QUE TROUXE A TABELA: ele nao pode voltar pro 64% fixo de antes, que
   era o que o punha dentro da parede. */
const sub = estilos.find(e => e.id === 'submarino_afundado');
ok('o submarino tem cena dedicada',
   dedicadas.some(r => r.sel.indexOf('submarino_afundado') >= 0));
/* ⚠️ ELA MEDIA O NUMERO ATE 23/09/2026 ("desceu do 64% fixo de antes") e caiu quando a tabela
   INTEIRA subiu 4 pontos -- sem nada estar errado. Hoje ela mede a REGRA: o submarino foi AFINADO
   a parte, e e isso que o protege de alguem normalizar a tabela e devolve-lo pra dentro da parede. */
const generico = estilos.find(e => e.id === 'campo_aberto');
ok('o submarino tem posicao propria, diferente da generica',
   !!sub && !!generico && pes(sub.st).ey !== pes(generico.st).ey,
   sub && generico ? 'submarino ' + pes(sub.st).ey + '% x campo_aberto ' + pes(generico.st).ey + '%' : '-');

/* ⚠️ E O CSS LE AS QUATRO COMO VARIAVEL COM PADRAO: terreno que saia da tabela um dia volta ao
   comportamento antigo em vez de ficar sem chao. */
const leituras = htmlCena.match(/var\(--battle-(?:player|enemy)-[xy][^)]*\)/g) || [];
const semPadrao = leituras.filter(v => !/,\s*[\d.]+%/.test(v));
ok('TODA leitura das quatro posicoes no CSS tem valor padrao',
   leituras.length >= 4 && semPadrao.length === 0,
   leituras.length + ' leituras' + (semPadrao.length ? ' -- sem padrao: ' + semPadrao.join(', ') : ''));


/* ============================================================================
   TODO ADVERSARIO NA MESMA ALTURA (23/09/2026).

   ⚠️ REPORTADO: *"o gyarados tava mais pra cima, ele morreu e entrou um raichu, e ai o raichu
   ficou mais pra baixo"*. O estilo da cena era IDENTICO nos 11 confrontos -- quem mudava era a
   ESPECIE: quem VOA leva `padding-bottom:10px` no wrap, e como o sprite do adversario e ampliado
   1,55x esses 10px viram 15,5px. Sao 37 das 250 que voam, entao a diferenca ia e vinha de
   confronto pra confronto sem nada na tela explicando.

   Estas travas leem o CSS porque o defeito e de CSS: o HTML das duas especies e legitimamente
   diferente (a classe do ground-base muda, e ela decide a FORMA da sombra) -- o que nao pode
   diferir e a ALTURA.
   ============================================================================ */
console.log('\nCENA DE BATALHA -- todo adversario na mesma altura');
/* ⚠️ A REGRA GENERICA E ANCORADA NO COMECO DA LINHA: sem isso o padrao casa tambem com a do
   ADVERSARIO (que a CONTEM por inteiro), e a trava passa a medir a regra errada -- ela reportou
   "padding-bottom:0" como se fosse o levantamento. E a familia do padrao largo demais. */
const regraAr = htmlCena.match(/\n\s*\.battle-ground-base\.air \+ \.battle-sprite-stage \.battle-sprite-wrap\{([^}]*)\}/);
ok('a regra que levanta quem voa existe', !!regraAr, regraAr ? regraAr[1] : '-');
const zeraAr = htmlCena.match(/\.battle-fighter\.enemy[^{]*\.battle-sprite-wrap\{padding-bottom:0;?\}/);
ok('no lado do ADVERSARIO ela e zerada', !!zeraAr,
   zeraAr ? zeraAr[0].slice(0, 70) : 'quem voa voltaria a ficar 15px acima de quem nao voa');
/* ⚠️ E A COMPENSACAO DA SOMBRA TEM QUE TER SAIDO JUNTO: ela existia SO por causa do levantamento
   (a sombra subia 15px pra alcancar o pe). Com o levantamento fora, ela poria a sombra 15px ACIMA
   do pe -- ou seja, os dois andam juntos nos dois sentidos. */
ok('a compensacao de 15px da sombra saiu junto',
   htmlCena.indexOf('.battle-fighter.enemy .battle-ground-base.air{margin-top:') < 0);
/* o levantamento continua valendo do lado do JOGADOR -- ali ele nunca foi reportado, e e o que
   faz quem voa parecer que voa */
ok('do lado do JOGADOR o levantamento continua',
   !/\.battle-fighter\.player[^{]*\.battle-sprite-wrap\{padding-bottom:0/.test(htmlCena));

/* ============================================================================
   A SOMBRA CRESCE COM O POKEMON (23/09/2026).

   ⚠️ ATE AQUI ELA TINHA TAMANHO FIXO -- 42px pra todo mundo --, e o sprite DESENHADO varia 1,8x
   (medido em 20 especies a 320px: 56px no Caterpie, 100px no Onix). A razao sombra/sprite ia de
   0,75 a 0,42.

   ⚠️ ESTAS TRAVAS LEEM O CSS porque o defeito e de CSS -- e porque o que sustenta a mecanica nao
   aparece em asserção de HTML nenhuma: a sombra so e proporcional se ela morar DENTRO do sprite.
   ============================================================================ */
console.log('\nCENA DE BATALHA -- a sombra cresce com o pokemon');

/* ⚠️ A REGRA TEM QUE SER DO `.battle-sprite-wrap`, e nao do palco nem do ground-base: o wrap e o
   UNICO elemento da cena que tem a largura do POKEMON (o palco e 40% fixo da cena e o ground-base
   e irmao dele). Movida pra qualquer um dos dois, a sombra volta a ter tamanho fixo -- e continua
   aparecendo na tela, que e o que faz isso passar despercebido. */
const regraSombra = htmlCena.match(/\.battle-scene \.battle-sprite-wrap::after\{([^}]*)\}/);
ok('a sombra e um ::after do .battle-sprite-wrap (onde existe a largura do pokemon)',
   !!regraSombra, regraSombra ? regraSombra[1].replace(/\s+/g, ' ').slice(0, 90) : 'nao achei a regra');
const corpoSombra = regraSombra ? regraSombra[1] : '';

/* ⚠️ A LARGURA E EM %, nunca em px: em px ela volta a ser a mesma pra todo bicho, que e o defeito. */
ok('a largura sai de left/right em % (nao de um px fixo)',
   /left:calc\(\s*[\d.]+%/.test(corpoSombra) && /right:calc\(\s*[\d.]+%/.test(corpoSombra)
   && !/width:\s*\d+px/.test(corpoSombra),
   corpoSombra.replace(/\s+/g, ' ').slice(0, 70));

/* ⚠️ E A ALTURA SAI DO `aspect-ratio`: uma altura em % resolveria contra a ALTURA do wrap, e ai um
   sprite alto e fino ganharia uma sombra alta. Uma em px nao cresceria com o bicho. */
ok('a altura sai do aspect-ratio (nao de px nem de %)',
   /aspect-ratio:/.test(corpoSombra) && !/height:\s*[\d.]+(px|%)/.test(corpoSombra),
   (corpoSombra.match(/aspect-ratio:[^;]*/) || ['-'])[0]);

/* ⚠️ E O `translateY(50%)` CENTRA ELA NA LINHA DO PE -- e onde as tres variantes antigas ficavam
   (todas tinham margin-top de metade da propria altura). Sem ele a sombra fica inteira ACIMA. */
ok('ela e centrada na linha do pe (translateY 50%)', /transform:translateY\(50%\)/.test(corpoSombra));

/* ⚠️ E ELA E ESCOPADA NA CENA: o `battleAnimatedSpriteHtml` e exclusivo dela hoje, mas ele e uma
   FUNCAO -- reusado noutra tela, um ::after sem escopo poria uma sombra la sem ninguem ver. */
ok('a regra e escopada na .battle-scene',
   htmlCena.indexOf('.battle-scene .battle-sprite-wrap::after') >= 0
   && !/\n\s*\.battle-sprite-wrap::after\{/.test(htmlCena));

/* ⚠️ E AS TRES VARIANTES DESENHADAS TEM QUE TER SAIDO DO `.battle-ground-base`: elas tinham
   tamanho fixo (18% e 24% da CENA), entao uma que sobrasse desenharia uma segunda sombra --
   daquelas que nao crescem -- por cima da nova. Ele hoje e so o portador da classe. */
ok('o .battle-ground-base nao desenha mais nada',
   /\.battle-ground-base\{display:none;\}/.test(htmlCena)
   && !/\.battle-ground-base\.(air|water)\{[^}]*border-radius/.test(htmlCena));
/* ⚠️ MAS ELE CONTINUA NO HTML: e ele que diz, pelo combinador `+`, se a especie voa ou nada. */
ok('mas ele continua sendo emitido (as regras de + dependem dele)',
   htmlCena.indexOf('class="battle-ground-base ${battleGroundBaseClass(') >= 0);

/* ⚠️ E A SOMBRA DE CONTATO TEM QUE TER SAIDO DO PALCO pelo mesmo motivo: `left:28%;right:28%` dele
   e 42px pra todo bicho, e duas sombras empilhadas nao se leem como defeito -- se leem como uma
   sombra que nao cresce. */
ok('a sombra de contato saiu do palco',
   !/\.battle-sprite-stage::after\{[^}]*border-radius/.test(htmlCena));

/* ⚠️ A ONDINHA DE QUEM NADA REUSA A MESMA CAIXA -- se ela voltar a ter largura propria, ela volta a
   ser fixa. O que ela pode ter de proprio e a PINTURA e a razao (ela sempre foi mais gorda). */
const regraAgua = htmlCena.match(/\.battle-ground-base\.water \+ \.battle-sprite-stage \.battle-sprite-wrap::after\{([^}]*)\}/);
ok('a ondinha da agua reusa a caixa da sombra (so troca a pintura)',
   !!regraAgua && !/(left|right|width):/.test(regraAgua[1]),
   regraAgua ? regraAgua[1].replace(/\s+/g, ' ').slice(0, 70) : 'nao achei a regra');

/* ⚠️ E O EMPURRAO PRA ESQUERDA DO ADVERSARIO E EM % DO SPRITE, que e a unidade em que ele foi
   MEDIDO (o pe desvia -4,6% da largura do QUADRO, e ele e metade disso). Em % da cena, cada
   tamanho de sprite recebia um empurrao diferente do que a medicao diz. */
const dx = htmlCena.match(/\.battle-scene \.battle-fighter\.enemy \.battle-sprite-wrap\{--sombra-dx:(-[\d.]+)%;\}/);
ok('o empurrao do adversario e uma variavel em % do SPRITE', !!dx, dx ? dx[1] + '%' : '-');
ok('e a sombra LE essa variavel com padrao 0 (o jogador nao anda)',
   /var\(--sombra-dx,\s*0%\)/.test(corpoSombra));

/* ============================================================================
   AS ESPADINHAS NAO APARECEM NA CENA (23/09/2026).
   ⚠️ Reportado: *"no fundo dos cenarios ainda esta exibindo aquele simbolos de espadinhas que
   exibia no modo antigo"*. Elas vinham do arquivo de referencia como marca d agua no centro.
   ============================================================================ */
console.log('\nCENA DE BATALHA -- as espadinhas');
ok('a cena esconde as espadinhas',
   /\.battle-vs\.battle-scene \.vs-swords\{display:none;\}/.test(htmlCena));
/* ⚠️ E A REGRA E ESCOPADA NA CENA: no caminho ANTIGO o `.vs-swords` e o **x entre os dois
   lutadores** (e e nele que o 🌧️ da chuva se pendura), e o Boss, a Selecao, o desafio por codigo e
   o online seguem naquele desenho. Escondido sem escopo, quatro telas perdem o x. */
ok('e ela NAO alcanca o caminho antigo',
   !/\n\s*\.vs-swords\{[^}]*display:none/.test(htmlCena)
   && htmlCena.indexOf('.vs-swords{font-size:1.4rem;display:inline-block;}') >= 0);

/* ============================================================================
   A CHUVA CAINDO NA CENA (24/09/2026, a pedido).
   ⚠️ O QUE ELAS EXISTEM PRA PEGAR nao e o desenho -- e a ARITMETICA que faz o desenho funcionar,
   e ela nao aparece em print nenhum:
     1) o passo tem que ser um numero INTEIRO de ladrilhos em TODA camada, senao o recomeco da
        animacao (o render() recria o innerHTML e toda animacao de CSS reinicia junto) da um PULO;
     2) e NENHUM sub-passo pode repetir o padrao, senao a chuva desliza sobre si mesma e parece
        PARADA -- a armadilha da linha infinita, o primeiro desenho a ser descartado.
   Um padrao ladrilhado (w,h) so e invariante pelas translacoes da rede {(a*w, b*h)}, entao as duas
   coisas sao uma CONTA e nao uma opiniao. ⚠️ E ela ja pegou um defeito real: a 2a camada da FRENTE
   tinha ladrilho 56x42 com passo (-28,84) -- 28/56 nao e inteiro, e so ELA pularia.
   ⚠️ E OS NUMEROS SAO LIDOS DO index.html: escritos aqui, a trava mediria a si mesma. */
console.log('\nCENA DE BATALHA -- a chuva');
{
  const blocoChuva = (cls) => {
    const i = htmlCena.indexOf('.battle-chuva.' + cls + '{');
    return i < 0 ? '' : htmlCena.slice(i, htmlCena.indexOf('}', i));
  };
  const passoDe = (nome) => {
    const m = htmlCena.match(new RegExp('@keyframes battle-chuva-' + nome +
      '\\{ to\\{ transform:translate3d\\((-?\\d+)px,(-?\\d+)px,0\\); \\} \\}'));
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const ladrilhosDe = (b) => {
    const m = b.match(/background-size:([^;]+);/);
    return m ? m[1].split(',').map(s => s.trim().split(/\s+/)
                                    .map(v => Number(v.replace('px', '')))) : [];
  };
  ok('as duas camadas existem (a de tras e a da frente)',
     !!blocoChuva('atras') && !!blocoChuva('frente'));
  [['atras', 2], ['frente', 7]].forEach(([cls, zEsperado]) => {
    const b = blocoChuva(cls), passo = passoDe(cls), tiles = ladrilhosDe(b);
    ok('  ' + cls + ': tem passo e ladrilhos pra ler', !!passo && tiles.length >= 1);
    if(!passo || !tiles.length) return;
    const [dx, dy] = passo;
    ok('  ' + cls + ': o passo e um numero INTEIRO de ladrilhos em TODA camada',
       tiles.every(([w, h]) => Math.abs(dx) % w === 0 && dy % h === 0),
       tiles.map(([w, h]) => (Math.abs(dx) / w) + 'x' + (dy / h)).join(' e '));
    /* ⚠️ A CONTA DO SUB-PASSO, e ela nao e sobre fracoes 1/k: um sub-passo t*(dx,dy) cai na rede
       quando t*n_i e t*m_i sao INTEIROS em toda camada (n_i = |dx|/w_i, m_i = dy/h_i). O menor
       t>0 assim e 1/G, com G = mdc de TODOS os n_i e m_i -- ou seja existe sub-passo invariante
       exatamente quando G > 1. Testar so t = 1/k perderia os t = j/G com j > 1. */
    const mdc = (a2, b2) => b2 ? mdc(b2, a2 % b2) : a2;
    const G = tiles.reduce((g, [w, h]) => mdc(mdc(g, Math.abs(dx) / w), dy / h), 0);
    ok('  ' + cls + ': e NENHUM sub-passo repete o padrao (ela nao parece parada)',
       G === 1, 'o menor passo que repete e 1/' + G + ' do ciclo');
    /* ⚠️ a faixa de cor sai PERPENDICULAR a direcao do gradiente, entao pra ela ficar paralela ao
       caminho da gota a conta e tan A = dy/dx -- e A e A+180 desenham a MESMA faixa. */
    const a = Number((b.match(/linear-gradient\((\d+)deg/) || [])[1]);
    const aEsperado = ((Math.atan2(dy, dx) * 180 / Math.PI) + 180) % 180;
    ok('  ' + cls + ': a faixa sai PARALELA ao caminho da gota',
       Math.abs((a % 180) - aEsperado) <= 1.5, a + 'deg (a conta pede ' + aEsperado.toFixed(1) + ')');
    /* a folga do inset cobre o caminho de um ciclo, senao a borda de cima fica VAZIA no fim dele */
    const ins = (b.match(/inset:(-?\d+)px (-?\d+)px/) || []).slice(1).map(Number);
    ok('  ' + cls + ': a folga do inset cobre o ciclo inteiro',
       ins.length === 2 && -ins[0] >= dy && -ins[1] >= Math.abs(dx),
       'topo ' + (-ins[0]) + '>=' + dy + ', direita ' + (-ins[1]) + '>=' + Math.abs(dx));
    ok('  ' + cls + ': fica no z-index ' + zEsperado + ' (' +
       (zEsperado < 5 ? 'atras do pokemon' : 'na frente dele, e atras do dano e do painel') + ')',
       new RegExp('z-index:' + zEsperado + ';').test(b));
  });
  /* ⚠️ E O MOVIMENTO E `transform`, nunca `background-position`: aquele e composto na GPU e este
     REPINTA a camada inteira a 60fps, num celular, do tamanho da cena. */
  ok('o movimento e transform (composto na GPU), nao background-position',
     /@keyframes battle-chuva-atras\{ to\{ transform:/.test(htmlCena)
     && !/@keyframes battle-chuva-\w+\{ to\{ background-position:/.test(htmlCena));
  /* as duas caem com o MESMO vento, e a de tras mais devagar -- e a que esta longe */
  const pa = passoDe('atras'), pf = passoDe('frente');
  ok('as duas caem com a MESMA inclinacao (e o mesmo vento)',
     !!pa && !!pf && Math.abs((pa[1] / Math.abs(pa[0])) - (pf[1] / Math.abs(pf[0]))) < 0.01,
     pa && pf ? (pa[1] / Math.abs(pa[0])).toFixed(2) + ' e ' + (pf[1] / Math.abs(pf[0])).toFixed(2) : '');
  const durDe = (cls) => Number((blocoChuva(cls).match(/animation:battle-chuva-\w+ ([\d.]+)s/) || [])[1]);
  ok('e a de TRAS cai mais devagar que a da FRENTE (paralaxe)',
     !!pa && !!pf && (pa[1] / durDe('atras')) < (pf[1] / durDe('frente')),
     pa && pf ? Math.round(pa[1] / durDe('atras')) + ' px/s contra ' + Math.round(pf[1] / durDe('frente')) : '');
  ok('e ela nao recebe toque (pointer-events:none)',
     /\.battle-chuva\{[^}]*pointer-events:none/.test(htmlCena));

  /* ⚠️ ELA VEM DO MATCHUP, nunca de estado global: o log e relido dias depois e ali o
     `chuvaRestante` ja nao existe. Confronto gravado antes do campo sai SEM chuva. */
  ok('so chove quando o CONFRONTO diz que choveu',
     S.chuvaDaCenaHtml({ chuva: true }).length > 0
     && S.chuvaDaCenaHtml({ chuva: false }) === ''
     && S.chuvaDaCenaHtml({}) === '' && S.chuvaDaCenaHtml(null) === '');
  ok('e ela desenha as DUAS camadas',
     (S.chuvaDaCenaHtml({ chuva: true }).match(/class="battle-chuva /g) || []).length === 2,
     S.chuvaDaCenaHtml({ chuva: true }));
  /* ⚠️ TODA TELA QUE DESENHA A CENA TEM QUE CHAMAR: escrita em cada uma, a que ficasse pra tras
     nao teria chuva nenhuma -- e a que ninguem olha e a do log relido. A conta e contra o NUMERO
     de cenas, e nao um 5 escrito aqui, que envelheceria na sexta. */
  const cenas = (htmlCena.match(/battle-scene-grid"><\/div>/g) || []).length;
  const chamadas = (htmlCena.match(/chuvaDaCenaHtml\(m\)/g) || []).length - 1; /* menos a declaracao */
  ok('TODA tela que desenha a cena chama a chuva', cenas > 0 && chamadas === cenas,
     cenas + ' cenas, ' + chamadas + ' chamadas');
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
