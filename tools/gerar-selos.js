#!/usr/bin/env node
/* ============================================================================
   O GERADOR DOS SELOS DO JOGO (17/09/2026)
   ----------------------------------------------------------------------------
   `node tools/gerar-selos.js` cospe o bloco `DESENHOS` pronto pra colar no index.html.

   ⚠️ POR QUE ELE EXISTE, e essa é a lição da primeira versão: os 23 selos nasceram desenhados
   À MÃO numa grade de 16x16, e o resultado foi reportado como "não ficou muito bom". A causa
   não era só a resolução -- era que pixel a pixel NÃO SE FAZ um círculo redondo nem uma estrela
   simétrica, e sem sombreado tudo fica chapado.

   Aqui o selo é descrito por FORMAS (círculo, polígono, estrela, traço) e o gerador cuida das
   três coisas que dão qualidade:
     1. a forma sai PERFEITA (o círculo é redondo, a estrela é simétrica);
     2. o SOMBREADO é automático e consistente -- luz em cima à esquerda, sombra embaixo à
        direita, na mesma direção nos 30 selos;
     3. o CONTORNO é fechado, de um pixel, em volta de tudo.

   É o mesmo desenho do `tools/gerar-golpes.js`: a ferramenta é a fonte, o que vai pro jogo é a
   TABELA -- que continua legível no index, e continua sendo onde se ajusta um pixel na mão.
   ============================================================================ */

const N = 24;                    /* a grade. 16 nao dava pra sombrear: sobrava 1px por tom. */
const VAZIO = '.';

/* ---------------------------------------------------------------------------
   A PALETA: cada cor tem TRES tons (claro/medio/escuro). A maiuscula e o tom claro.
   O sombreado so funciona porque eles existem -- com uma cor por material, o gerador nao
   teria com o que pintar a luz e a sombra.
   --------------------------------------------------------------------------- */
/* ⚠️ AS TRES CORES DE BAIXO SAO O QUE PERMITE UM SELO DE COR VARIAVEL (o disco do TM, pedido
   assim: *"deixe o disco da cor do tipo do ataque que ele ensina"*). Com 23 TMs e 17 tipos, gerar
   um simbolo por cor seria 23 desenhos iguais; aqui o desenho e UM e a cor entra no USO.
     `*` -> currentColor, que o <use> herda do `style="color:..."` do <svg> de fora;
     `+` e `-` -> branco e preto TRANSLUCIDOS, que e como se sombreia uma cor que ainda nao se
                  conhece: eles clareiam e escurecem o que estiver embaixo, seja qual for. */
const PALETA = {
  '*': 'currentColor', '+': '#ffffff55', '-': '#00000038',
  k: '#241f1c',  K: '#4a423c',                 /* contorno e contorno claro */
  w: '#ffffff',  W: '#e6e1d6',  v: '#b8b2a4',  /* branco */
  Y: '#ffe89a',  y: '#f2c744',  o: '#c98b16',  /* amarelo/ouro */
  R: '#ff9b86',  r: '#d64541',  q: '#8f2b28',  /* vermelho */
  C: '#d5f2ff',  c: '#8fd3f4',  b: '#3a86d8',  B: '#22508f',  /* azul/gelo */
  E: '#b9e86e',  e: '#7ec850',  g: '#4f9226',  /* verde */
  P: '#dc9bee',  p: '#a855c9',  n: '#6d2d87',  /* roxo */
  S: '#eef2f7',  s: '#c3ccd8',  z: '#8b95a8',  Z: '#5a6375',  /* cinza/metal */
  F: '#e8a860',  f: '#c9832f',  h: '#8a5518',  /* marrom/couro */
};
/* pra cada cor MEDIA, qual e o claro e qual e o escuro */
const TONS = {
  w: ['w', 'W', 'v'], y: ['Y', 'y', 'o'], r: ['R', 'r', 'q'], c: ['C', 'c', 'b'],
  b: ['c', 'b', 'B'], e: ['E', 'e', 'g'], g: ['E', 'g', 'g'], p: ['P', 'p', 'n'],
  s: ['S', 's', 'z'], z: ['s', 'z', 'Z'], f: ['F', 'f', 'h'], o: ['y', 'o', 'h'],
};

/* ---------------------------------------------------------------------------
   AS FORMAS -- cada uma devolve uma funcao (x,y) => dentro?
   Elas trabalham em coordenadas de PIXEL com meio pixel de folga (x+0.5), senao a forma
   sai torta de um lado: um circulo de raio 5 em (12,12) pega 5 pixels de um lado e 6 do outro.
   --------------------------------------------------------------------------- */
const circulo = (cx, cy, r) => (x, y) => {
  const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
  return dx * dx + dy * dy <= r * r;
};
const elipse = (cx, cy, rx, ry) => (x, y) => {
  const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
};
const retangulo = (x0, y0, w, h) => (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
/* poligono por raycast -- serve pra qualquer silhueta */
const poligono = (pts) => (x, y) => {
  const px = x + 0.5, py = y + 0.5;
  let dentro = false;
  for(let i = 0, j = pts.length - 1; i < pts.length; j = i++){
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};
/* ESTRELA de n pontas -- a de cinco a mao nunca ficava simetrica */
const estrela = (cx, cy, rExt, rInt, pontas, giro) => {
  const pts = [];
  for(let i = 0; i < pontas * 2; i++){
    const a = (i * Math.PI / pontas) - Math.PI / 2 + (giro || 0);
    const r = i % 2 ? rInt : rExt;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poligono(pts);
};
/* TRACO grosso entre dois pontos -- espadas, raio, hastes */
const traco = (x1, y1, x2, y2, esp) => (x, y) => {
  const px = x + 0.5, py = y + 0.5;
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)));
  const qx = x1 + dx * t, qy = y1 + dy * t;
  return (px - qx) ** 2 + (py - qy) ** 2 <= (esp / 2) ** 2;
};
const uniao = (...fs) => (x, y) => fs.some(f => f(x, y));
const menos = (a, b) => (x, y) => a(x, y) && !b(x, y);

/* ---------------------------------------------------------------------------
   O PINTOR
   --------------------------------------------------------------------------- */
function novaTela(){ return Array.from({ length: N }, () => new Array(N).fill(VAZIO)); }

/* ⚠️ O SOMBREADO E O QUE SEPARA "desenho" de "mancha colorida", e ele e DIRECIONAL: a luz vem
   de cima a esquerda nos 30 selos. Sem uma direcao so, cada selo pareceria de um jogo diferente.
   A conta e simples e funciona: se o pixel ACIMA-ESQUERDA esta fora da forma, ele e borda de luz;
   se o ABAIXO-DIREITA esta fora, e borda de sombra; no meio fica o tom medio. */
function pintar(tela, forma, cor, opts){
  const o = opts || {};
  const [claro, medio, escuro] = TONS[cor] || [cor, cor, cor];
  const dentro = (x, y) => x >= 0 && y >= 0 && x < N && y < N && forma(x, y);
  for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
    if(!forma(x, y)) continue;
    let t = medio;
    if(o.liso) t = cor;
    else {
      const luz   = !dentro(x - 1, y - 1) || !dentro(x - 1, y) || !dentro(x, y - 1);
      const sombra = !dentro(x + 1, y + 1) || !dentro(x + 1, y) || !dentro(x, y + 1);
      if(luz && !sombra) t = claro;
      else if(sombra && !luz) t = escuro;
      /* um pixel que e borda dos dois lados (forma fina) fica no medio */
    }
    tela[y][x] = t;
  }
}

/* CONTORNO: todo vazio encostado em cor vira preto. Fechado e de um pixel, sempre. */
/* ⚠️ O CONTORNO TEM 2px NA GRADE, e isso é medição e não gosto (18/09/2026). Reportado com
   print a zoom 100%: *"o desenho da estrela e muitos outros ficam feios o contorno quando ta
   assim, da onde eu to vendo não parece uma estrela"*.
   A grade é 24×24 e o selo sai a **16px** na fileira do time -- **0,67 pixel de tela por pixel de
   grade**. Um contorno de 1px vira 0,67px, e aí ele **não cabe**: com `crispEdges` o navegador o
   pinta em alguns lugares e descarta em outros (as pontas da estrela viraram perninhas pretas), e
   sem `crispEdges` ele vira um cinza esfumado (a estrela borra).
   Com 2px ele vira **1,33px** -- sempre sobra pelo menos um pixel inteiro, em qualquer posição.
   ⚠️ Medidas as QUATRO combinações no navegador (1px/2px × crisp/suave): só **2px + crisp** dá
   uma estrela com silhueta, contorno contínuo e moeda redonda. As outras três ou quebram ou
   borram. É a lição de sempre aqui: ASCII não se julga, e 16px também não se adivinha. */
function contornar(tela, cor){
  const c = cor || 'k';
  for(let volta = 0; volta < 2; volta++){
    const orig = tela.map(l => l.slice());
    const cheio = (x, y) => x >= 0 && y >= 0 && x < N && y < N && orig[y][x] !== VAZIO;
    for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
      if(orig[y][x] !== VAZIO) continue;
      if(cheio(x-1,y) || cheio(x+1,y) || cheio(x,y-1) || cheio(x,y+1)) tela[y][x] = c;
    }
  }
}

/* ---------------------------------------------------------------------------
   OS SELOS
   --------------------------------------------------------------------------- */
const C = N / 2;   /* 12 -- o centro */
const SELOS = {};
const selo = (nome, fn) => { SELOS[nome] = fn; };

/* ---- BATALHA ---- */

selo('shiny', t => {
  /* ⚠️ A ESTRELA É CHEIA (raio interno 6,0 de 10,5), e isso é medição: com o interno em 4,4 as
     pontas ficavam FINAS, e num contorno de 2px de cada lado elas viravam quase só contorno -- em
     16px as duas de baixo saíam como "perninhas pretas". Foi o que o print mostrou.
     ⚠️ E O BRILHO BRANCO SAIU junto: ele é um detalhe de 2px que em 56px enfeita e em 16px vira
     uma MANCHA CINZA na ponta esquerda -- dava pra ver nas duas variantes que o mantinham.
     Comparadas quatro razões no navegador; 6,0 é a que se lê como estrela a 16px. */
  pintar(t, estrela(C, C - 0.5, 10.5, 5.4, 5), 'y');
});

selo('terreno', t => {
  /* ⚠️ UM GALÃO SÓ, e a escolha foi MEDIDA no navegador, não no gosto: o selo sai a 1em
     (~13px) na fileira do time, e ali só uma forma Única e sólida se lê -- é por isso que a
     estrela do shiny funciona. Desenhadas SEIS variantes e comparadas a 13px:
       hexágono e losango viram um pontinho; tudo que tem CHÃO (dois galões + base, seta + base)
       vira mancha, porque três elementos empilhados não cabem em 13 pixels; o triângulo lê bem
       mas é o 🔺 do emoji, que "não dizia nada"; o GALÃO sozinho lê nos três tamanhos.
     Ele substituiu uma MONTANHA com neve no pico, cujo recorte branco sumia em 13px.
     ⚠️ E ele não é a seta que saiu da fúria: aquela era CHEIA (triângulo + haste) e esta é
     vazada -- as duas nunca aparecem juntas no mesmo quadro por acaso, mas a forma separa. */
  /* ⚠️ A COR VEM DE FORA (18/09/2026, a pedido: *"deixe a cor da setinha que indica que ele ta
     buffado pelo terreno, da mesma cor que a cor do selo do terreno"*). O corpo é      e o volume é branco e preto TRANSLÚCIDOS -- a mesma técnica do disco do TM, e ela existe
     porque o sombreado normal precisa de três tons de uma cor CONHECIDA, e aqui a cor só se sabe
     na hora de desenhar. Branco e preto com alpha clareiam e escurecem o que estiver embaixo,
     seja qual for. */
  /* ⚠️ SEM VOLUME, e isso foi pedido: *"as setas estão metade de uma cor e metade branca, ela
     deve ser inteira da mesma cor"*. O disco do TM leva brilho e sombra translúcidos porque ele
     é um círculo GRANDE -- num galão fino a mesma técnica pinta metade do desenho de branco, que
     é o que apareceu na tela. Aqui a cor é chapada e quem define a forma é o contorno preto. */
  pintar(t, poligono([[2,15],[12,3],[22,15],[22,20],[12,8],[2,20]]), '*', { liso: true });
});

selo('fogo', t => {   /* chama: gota de fora, nucleo claro dentro */
  pintar(t, poligono([[12,1],[17,8],[19,13],[17.5,19],[12,22],[6.5,19],[5,13],[8,7]]), 'r');
  pintar(t, poligono([[12,8],[15,13],[14,19],[12,21],[10,19],[9,13]]), 'y');
});

selo('raio', t => {   /* o zigue-zague do raio */
  pintar(t, poligono([[14,1],[6,13],[11,13],[9,23],[19,10],[13.5,10],[16,1]]), 'y');
});

selo('gelo', t => {   /* floco de seis pontas com o miolo claro */
  for(let i = 0; i < 3; i++){
    const a = i * Math.PI / 3;
    pintar(t, traco(C - Math.cos(a)*10, C - Math.sin(a)*10, C + Math.cos(a)*10, C + Math.sin(a)*10, 2.6), 'c');
  }
  pintar(t, circulo(C, C, 2.6), 'c');
});

selo('veneno', t => {   /* gota de veneno com bolha de luz */
  pintar(t, uniao(circulo(12, 15, 6.5), poligono([[12,2],[17,14],[7,14]])), 'p');
  pintar(t, circulo(9.5, 13, 1.8), 'P', { liso: true });
});

selo('sono', t => {
  /* os dois Z -- um grande e um pequeno, como no quadrinho.
     ⚠️ ELES PRECISAM DE 5px DE FOLGA ENTRE SI, e não menos: o contorno cresce 2px pra fora de
     CADA um, então dois desenhos a 4px de distância encostam pelo contorno e viram um borrão só.
     Era o que acontecia -- eles se sobrepunham em x=8..9 e saíam colados. */
  const z = (x0, y0, w, esp) => uniao(
    traco(x0, y0, x0 + w, y0, esp),
    traco(x0 + w, y0, x0, y0 + w, esp),
    traco(x0, y0 + w, x0 + w, y0 + w, esp));
  pintar(t, z(12.5, 12.5, 9, 2.6), 'c');   /* o grande, embaixo à direita */
  pintar(t, z(2.5, 2.5, 4.5, 1.9), 'c');   /* o pequeno, em cima à esquerda */
});

selo('confusao', t => {   /* a espiral da confusao */
  const pts = [];
  for(let i = 0; i <= 44; i++){
    const a = i * 0.36, r = 1.2 + i * 0.235;
    pts.push([C + Math.cos(a) * r, C + Math.sin(a) * r]);
  }
  const linha = (x, y) => pts.some((p, i) => i && traco(pts[i-1][0], pts[i-1][1], p[0], p[1], 2.4)(x, y));
  pintar(t, linha, 'p');
});

selo('explosao', t => {   /* estouro de 10 pontas, nucleo amarelo */
  pintar(t, estrela(C, C, 11.5, 5, 10, 0.3), 'r');
  pintar(t, estrela(C, C, 6, 2.6, 8, 0.1), 'y');
});

selo('furia', t => {
  /* ⚠️ A VEIA SALTADA -- o simbolo de raiva do anime, e literalmente a marca que o PRIMEAPE
     tem sobre o olho. Pedido assim: *"no desenho do Primeape, ele possui em cima de um dos olhos
     na diagonal, uma especie de 4 V onde as pontas estao juntos, simbolizando que ele e furioso"*.
     Foi desenhada olhando o SPRITE de verdade, ampliado pixel a pixel: sao QUATRO CANTOS em L,
     um por quadrante, com as quinas apontando pro centro e os bracos indo pra fora, deixando um
     vazio em cruz no meio.
     Ela substituiu uma SETA PRA CIMA, que dizia o que a furia FAZ (+10 em tudo) e nao o que ela
     E -- e seta é o vocabulario de BUFF, nao de raiva. */
  const T = 3.2;                     /* a espessura do traco */
  const D = 2.0;                     /* o vazio, do centro ate a quina */
  const q = (sx, sy) => {            /* um canto em L: sx/sy dizem pra que lado ele abre */
    const qx = sx < 0 ? C - D - T : C + D;      /* a quina, no eixo x */
    const qy = sy < 0 ? C - D - T : C + D;
    const vert = sy < 0 ? retangulo(qx, 2, T, qy - 2 + T) : retangulo(qx, qy, T, 22 - qy);
    const horz = sx < 0 ? retangulo(2, qy, qx - 2 + T, T) : retangulo(qx, qy, 22 - qx, T);
    return uniao(vert, horz);
  };
  pintar(t, uniao(q(-1,-1), q(1,-1), q(-1,1), q(1,1)), 'r');
});

selo('espada', t => {   /* espada apontada pra cima */
  pintar(t, poligono([[12,1],[15,6],[15,15],[9,15],[9,6]]), 's');
  pintar(t, retangulo(5, 15, 14, 2.5), 'f');
  pintar(t, retangulo(10.5, 17, 3, 5), 'f');
});

selo('pluma', t => {   /* pena inclinada, com a haste */
  pintar(t, poligono([[19,3],[21,9],[15,18],[6,21],[4,15],[10,7]]), 'c');
  pintar(t, traco(19, 4, 5, 20, 1.6), 'W', { liso: true });
});

selo('chuva', t => {   /* nuvem com tres gotas */
  pintar(t, uniao(circulo(8.5, 9, 4.6), circulo(15, 8.5, 5.2), elipse(12, 12, 9, 3.6)), 's');
  [5.5, 11.5, 17.5].forEach((x, i) => pintar(t, poligono([[x,17+(i%2)],[x+2,21+(i%2)],[x-2,21+(i%2)]]), 'c'));
});

selo('sol', t => {   /* disco com oito raios */
  for(let i = 0; i < 8; i++){
    const a = i * Math.PI / 4;
    pintar(t, traco(C + Math.cos(a)*7, C + Math.sin(a)*7, C + Math.cos(a)*11.5, C + Math.sin(a)*11.5, 2.6), 'y');
  }
  pintar(t, circulo(C, C, 6.4), 'y');
});

/* ⚠️ O REMOINHO em faixas RETAS empilhadas virava um funil de laboratorio. Em elipses que vao
   encolhendo E se deslocando de lado, ele vira o cone de vento que gira. */
selo('remoinho', t => {
  pintar(t, elipse(12, 4, 10.5, 3.2), 's');
  pintar(t, elipse(10.5, 9, 8, 2.5), 's');
  pintar(t, elipse(13, 13.5, 5.6, 2), 's');
  pintar(t, elipse(10.8, 17.5, 3.4, 1.6), 's');
  pintar(t, elipse(12.5, 21, 1.8, 1.2), 's');
});

/* ⚠️ A GARRA de tres dedos GROSSOS saia como uma mao (ou uma coroa verde). O que se le como
   garra sao tres RISCOS diagonais que afinam -- o rasgo, nao a pata. */
selo('dragao', t => {
  [-6.8, 0, 6.8].forEach(d => pintar(t, poligono([[3+d,1],[7.5+d,2.5],[15+d,21.5],[12.5+d,23]]), 'e'));
});

selo('vs', t => {   /* as duas espadas cruzadas -- o `vs` do meio da batalha */
  pintar(t, traco(3, 3, 17, 17, 3.4), 's');
  pintar(t, traco(21, 3, 7, 17, 3.4), 's');
  pintar(t, traco(2, 20, 7, 15, 3), 'f');
  pintar(t, traco(22, 20, 17, 15, 3), 'f');
});

/* ---- INTERFACE ---- */

selo('moeda', t => {   /* moeda de perfil com um vinco */
  pintar(t, circulo(C, C, 10.2), 'y');
  pintar(t, menos(circulo(C, C, 6.6), circulo(C, C, 4.8)), 'o', { liso: true });
});

selo('trofeu', t => {   /* taca com alcas, haste e base */
  pintar(t, uniao(retangulo(6, 3, 12, 7), elipse(12, 10, 6, 5)), 'y');
  pintar(t, uniao(menos(circulo(5.5, 7.5, 3.6), circulo(5.5, 7.5, 1.9)),
                  menos(circulo(18.5, 7.5, 3.6), circulo(18.5, 7.5, 1.9))), 'y');
  pintar(t, retangulo(10.5, 14, 3, 4), 'o');
  pintar(t, uniao(retangulo(7, 18, 10, 2), retangulo(5, 20, 14, 2.5)), 'y');
});

selo('coroa', t => {   /* coroa de tres pontas com as joias */
  pintar(t, poligono([[2,6],[6.5,13],[12,4],[17.5,13],[22,6],[22,19],[2,19]]), 'y');
  [6.5, 12, 17.5].forEach(x => pintar(t, circulo(x, 16, 1.7), 'r'));
});

selo('cadeado', t => {   /* corpo com a argola e a fechadura */
  pintar(t, menos(circulo(12, 9, 6.4), circulo(12, 9, 3.6)), 's');
  pintar(t, retangulo(5.5, 10, 13, 2), VAZIO, { liso: true });   /* corta a metade de baixo */
  pintar(t, retangulo(4, 11, 16, 11), 'y');
  pintar(t, uniao(circulo(12, 15, 2.1), poligono([[11,15],[13,15],[13.5,20],[10.5,20]])), 'o', { liso: true });
});

selo('brilho', t => {   /* tres faiscas de quatro pontas */
  pintar(t, estrela(9, 8, 8, 1.7, 4), 'y');
  pintar(t, estrela(18, 16, 5, 1.1, 4), 'Y', { liso: true });
  pintar(t, estrela(4.5, 19, 3.4, 0.8, 4), 'Y', { liso: true });
});

/* ---- OS QUATRO DA HOME (e mais tres que sobravam la) ---- */

selo('amigos', t => {   /* duas pessoas -- o quadro Amigos */
  pintar(t, circulo(8, 7.5, 4.2), 'c');
  pintar(t, poligono([[2,22],[3,15],[13,15],[14,22]]), 'c');
  pintar(t, circulo(17, 9, 3.6), 'e');
  pintar(t, poligono([[12,22],[13,16.5],[21,16.5],[22,22]]), 'e');
});

selo('mochila', t => {   /* mochila com alca e bolso -- o quadro Mochila */
  pintar(t, menos(elipse(12, 6, 5, 4.5), elipse(12, 7.5, 2.6, 3.6)), 'h', { liso: true });
  pintar(t, uniao(retangulo(3, 8, 18, 14), elipse(12, 9, 9, 4)), 'r');
  pintar(t, retangulo(7.5, 14, 9, 8), 'q', { liso: true });
  pintar(t, retangulo(9.5, 16.5, 5, 2), 'Y', { liso: true });
});

selo('loja', t => {   /* carrinho de compras -- o quadro Loja */
  pintar(t, traco(2, 4, 5.5, 4, 2.2), 'z');
  pintar(t, poligono([[5.5,5],[22,5],[19,15],[9,15]]), 'e');
  pintar(t, traco(5.5, 4, 9, 16, 2.2), 'z');
  pintar(t, circulo(10, 19.5, 2.4), 'z');
  pintar(t, circulo(18, 19.5, 2.4), 'z');
});

/* ⚠️ O SINO saiu PINHEIRO na primeira versao, e a causa foi a silhueta: um triangulo de lados
   RETOS com a base arredondada e uma arvore de natal. O sino tem a CUPULA redonda em cima e a
   saia abrindo embaixo -- e e a cupula que o identifica. */
selo('sino', t => {
  pintar(t, retangulo(11, 1, 2, 3.5), 'o');
  pintar(t, uniao(circulo(12, 11, 6.6),
                  poligono([[5.6,11],[18.4,11],[20.5,17],[3.5,17]])), 'y');
  pintar(t, retangulo(2.5, 17, 19, 2.6), 'o');
  pintar(t, circulo(12, 21.5, 2), 'y');
});

selo('mais', t => {   /* o + do "Novo Jogo" */
  pintar(t, uniao(retangulo(9.5, 3, 5, 18), retangulo(3, 9.5, 18, 5)), 'e');
});

selo('disco', t => {   /* disquete -- "SEUS TIMES" */
  pintar(t, retangulo(2, 2, 20, 20), 'b');
  pintar(t, retangulo(7, 2, 10, 8), 'S', { liso: true });
  pintar(t, retangulo(11.5, 3, 3, 5), 'Z', { liso: true });
  pintar(t, retangulo(5, 13, 14, 9), 'S', { liso: true });
});

selo('casa', t => {   /* o botao Home, que aparece em quase toda tela */
  pintar(t, poligono([[12,2],[23,11],[1,11]]), 'r');
  pintar(t, retangulo(3.5, 11, 17, 11), 'F');
  pintar(t, retangulo(9.5, 14, 5, 8), 'h', { liso: true });
  pintar(t, retangulo(16, 5, 2.5, 4), 'q', { liso: true });
});

/* ⚠️ AS TRES MEDALHAS sao o MESMO desenho em tres cores -- e de proposito: elas sao a mesma coisa
   em tres niveis, e formas diferentes fariam procurar tres mecanicas onde ha uma escada. */
const medalhaDe = (cor) => (t) => {
  pintar(t, poligono([[6,1],[10,1],[13,9],[9,10]]), 'r');
  pintar(t, poligono([[14,1],[18,1],[15,10],[11,9]]), 'b');
  pintar(t, circulo(12, 15.5, 7.4), cor);
  pintar(t, menos(circulo(12, 15.5, 4.6), circulo(12, 15.5, 3.2)), cor === 'y' ? 'o' : (cor === 's' ? 'z' : 'h'), { liso: true });
};
selo('ouro',   medalhaDe('y'));
selo('prata',  medalhaDe('s'));
selo('bronze', medalhaDe('f'));

selo('diamante', t => {   /* o nivel LENDARIA das conquistas */
  pintar(t, poligono([[7,3],[17,3],[21,9],[12,21],[3,9]]), 'c');
  pintar(t, poligono([[7,3],[12,9],[3,9]]), 'C', { liso: true });
  pintar(t, poligono([[17,3],[21,9],[12,9]]), 'b', { liso: true });
});

selo('mapa', t => {   /* o botao de terreno e o "Ver o mapa" */
  pintar(t, poligono([[1,4],[8,2],[16,5],[23,3],[23,20],[16,22],[8,19],[1,21]]), 'E');
  pintar(t, uniao(traco(8, 2, 8, 19, 1.4), traco(16, 5, 16, 22, 1.4)), 'g', { liso: true });
  pintar(t, circulo(12, 12, 2.4), 'r');
});

selo('escudo', t => {   /* a defesa do ginasio */
  pintar(t, poligono([[12,1],[21,4],[21,12],[12,22],[3,12],[3,4]]), 'b');
  pintar(t, poligono([[12,5],[17,7],[17,12],[12,18],[7,12],[7,7]]), 'C', { liso: true });
});

selo('lista', t => {   /* a ordem de batalha e o "copiar codigo" */
  pintar(t, retangulo(3, 3, 18, 19), 'W');
  pintar(t, retangulo(8, 1, 8, 4), 's');
  [8, 12, 16].forEach(y => { pintar(t, retangulo(6, y, 2.5, 2), 'b', { liso: true });
                             pintar(t, retangulo(10, y + 0.5, 8, 1.2), 'z', { liso: true }); });
});

selo('torre', t => {   /* a Torre dos Treinadores */
  pintar(t, poligono([[12,1],[16,5],[16,7],[8,7],[8,5]]), 'r');
  pintar(t, poligono([[9,7],[15,7],[17,22],[7,22]]), 'S');
  [10, 14].forEach(y => pintar(t, retangulo(10.5, y, 3, 3), 'b', { liso: true }));
});

selo('estadio', t => {   /* o Ginasio da Cidade */
  pintar(t, elipse(12, 11, 11, 7.5), 's');
  pintar(t, elipse(12, 12.5, 7, 4.6), 'e', { liso: true });
  pintar(t, retangulo(1, 11, 22, 7), 's');
  pintar(t, elipse(12, 18, 11, 4), 's');
});

selo('cidade', t => {   /* o resultado do ginasio da cidade */
  pintar(t, retangulo(2, 8, 7, 14), 's');
  pintar(t, retangulo(9.5, 3, 6, 19), 'b');
  pintar(t, retangulo(16, 11, 6, 11), 's');
  [5, 11, 17.5].forEach((x, i) => [11, 15, 19].forEach(y => {
    if(i === 1 && y === 19) return;
    pintar(t, retangulo(x - 0.5, y, 2, 2), 'Y', { liso: true });
  }));
});

selo('recarregar', t => {   /* o "tentar de novo" e o aviso de versao nova */
  pintar(t, menos(menos(circulo(12, 12, 9.5), circulo(12, 12, 5.8)),
                  poligono([[12,12],[24,4],[24,14]])), 'e');
  pintar(t, poligono([[13,1],[22,6],[13,11]]), 'e');
});

selo('calendario', t => {   /* os "dias na lideranca" */
  pintar(t, retangulo(2, 4, 20, 18), 'W');
  pintar(t, retangulo(2, 4, 20, 5), 'r');
  [6, 16].forEach(x => pintar(t, retangulo(x, 1, 2.5, 5), 'z'));
  [11, 15, 19].forEach(y => [5, 9.5, 14, 18].forEach(x =>
    pintar(t, retangulo(x, y, 2, 2), 'z', { liso: true })));
});

selo('bandeira', t => {   /* a Trainers League */
  pintar(t, retangulo(3, 2, 2.2, 21), 'z');
  for(let i = 0; i < 4; i++) for(let j = 0; j < 3; j++)
    pintar(t, retangulo(5.2 + i * 4.2, 3 + j * 4, 4.2, 4), (i + j) % 2 ? 'w' : 'k', { liso: true });
});

selo('balao', t => {   /* o rumor da rota */
  pintar(t, uniao(elipse(12, 10, 10.5, 7.5), poligono([[6,15],[12,15],[7,22]])), 'Y');
  [7.5, 12, 16.5].forEach(x => pintar(t, circulo(x, 10, 1.5), 'o', { liso: true }));
});

/* ---- A LOJA E A MOCHILA ---- */

/* ⚠️ O DISCO DO TM É DE COR VARIAVEL -- pedido: *"deixe o disco da cor do tipo do ataque que ele
   ensina"*. O corpo e `*` (currentColor) e o volume vem do branco e do preto translucidos, que
   funcionam por cima de QUALQUER cor: assim os 23 TMs (17 tipos) saem de UM desenho so.
   Quem passa a cor e o `selo(nome, cls, cor)`, com a cor do TYPE_COLORS. */
selo('tm', t => {
  pintar(t, circulo(12, 12, 11), '*', { liso: true });
  pintar(t, menos(circulo(12, 12, 11), circulo(12, 12, 8.6)), '+', { liso: true });
  pintar(t, poligono([[12,23],[23,12],[23,16],[16,23]]), '-', { liso: true });
  pintar(t, circulo(12, 12, 3.4), 'S');
  pintar(t, circulo(12, 12, 1.3), 'k', { liso: true });
});

/* o HM tem a MESMA forma -- ele tambem ensina um golpe, e o golpe tambem tem tipo. O que o separa
   e o risco branco: HM nao se gasta. */
selo('hm', t => {
  pintar(t, circulo(12, 12, 11), '*', { liso: true });
  pintar(t, menos(circulo(12, 12, 11), circulo(12, 12, 8.6)), '+', { liso: true });
  pintar(t, poligono([[12,23],[23,12],[23,16],[16,23]]), '-', { liso: true });
  pintar(t, traco(5, 19, 19, 5, 2.2), 'w', { liso: true });
  pintar(t, circulo(12, 12, 3.4), 'S');
  pintar(t, circulo(12, 12, 1.3), 'k', { liso: true });
});

selo('doce', t => {   /* o Doce Raro */
  pintar(t, elipse(12, 12, 6.4, 5.2), 'R');
  pintar(t, elipse(10, 10, 2.4, 1.6), 'w', { liso: true });
  [[1,5],[1,19],[23,5],[23,19]].forEach(([x, y]) =>
    pintar(t, poligono([[x, y], [x < 12 ? 6.2 : 17.8, 12], [x, 24 - y]]), 'R'));
});

/* ⚠️ A POCAO E A SUPER POCAO SAO O MESMO FRASCO, com o liquido de cor variavel -- a mesma tecnica
   do disco. Elas sao o mesmo item em duas forcas, e formas diferentes fariam procurar duas coisas. */
selo('pocao', t => {
  pintar(t, retangulo(9.5, 1, 5, 4), 's');
  pintar(t, uniao(elipse(12, 15, 7.6, 7.4), poligono([[8,6],[16,6],[17,13],[7,13]])), 'S');
  pintar(t, uniao(elipse(12, 16, 6.2, 5.8), retangulo(6.4, 12, 11.2, 5)), '*', { liso: true });
  pintar(t, elipse(9.5, 13.5, 1.6, 2.4), '+', { liso: true });
});

selo('despertador', t => {   /* o Despertar */
  pintar(t, circulo(12, 13.5, 9), 'S');
  pintar(t, circulo(12, 13.5, 7), 'W', { liso: true });
  [[5.5,5.5],[18.5,5.5]].forEach(([x, y]) => pintar(t, circulo(x, y, 3), 's'));
  pintar(t, traco(12, 13.5, 12, 8.5, 1.6), 'k', { liso: true });
  pintar(t, traco(12, 13.5, 16, 15.5, 1.6), 'k', { liso: true });
});

selo('coracao', t => {   /* o HP Up */
  pintar(t, uniao(circulo(7.6, 8.5, 5.4), circulo(16.4, 8.5, 5.4),
                  poligono([[2.2,10],[21.8,10],[12,22]])), 'r');
  pintar(t, elipse(7.5, 6.5, 2, 2.6), 'R', { liso: true });
});

selo('orbe', t => {   /* o Atk Special Up */
  pintar(t, circulo(12, 12, 9.4), 'p');
  pintar(t, elipse(8.8, 8.4, 2.6, 3.4), 'P', { liso: true });
  pintar(t, retangulo(6, 20, 12, 3), 'f');
});

selo('barreira', t => {   /* o Def Special Up */
  const hex = poligono([[12,1],[21,6.5],[21,17.5],[12,23],[3,17.5],[3,6.5]]);
  pintar(t, hex, 'c');
  pintar(t, menos(hex, poligono([[12,5],[17.5,8.5],[17.5,15.5],[12,19],[6.5,15.5],[6.5,8.5]])), 'C', { liso: true });
});

selo('faixa', t => {   /* a Faixa de Foco */
  pintar(t, traco(12, 9, 5, 22, 3.4), 'r');
  pintar(t, traco(12, 9, 19, 22, 3.4), 'q', { liso: true });
  pintar(t, menos(circulo(12, 7, 6.2), circulo(12, 7, 3.2)), 'r');
});

selo('aviso', t => {   /* a tela que nao deu certo (sem localizacao, sem suporte) */
  pintar(t, poligono([[12,1],[23,21],[1,21]]), 'y');
  pintar(t, retangulo(10.5, 7, 3, 8), 'k', { liso: true });
  pintar(t, retangulo(10.5, 16.5, 3, 3), 'k', { liso: true });
});

selo('porta', t => {   /* porta aberta -- o Logout */
  pintar(t, retangulo(3, 2, 13, 20), 'f');
  pintar(t, retangulo(5.5, 4.5, 8, 15), 'h', { liso: true });
  pintar(t, circulo(12.5, 12, 1.4), 'Y', { liso: true });
  pintar(t, uniao(traco(17, 12, 22, 12, 2.4), poligono([[18.5,7.5],[23,12],[18.5,16.5]])), 'e');
});

/* ---------------------------------------------------------------------------
   A SAIDA
   --------------------------------------------------------------------------- */
function gerar(nome){
  const t = novaTela();
  SELOS[nome](t);
  contornar(t);
  return t.map(l => l.join(''));
}

const ordem = Object.keys(SELOS);
const usadas = new Set();
const linhas = [];
ordem.forEach(nome => {
  const g = gerar(nome);
  g.forEach(l => { for(const c of l) if(c !== VAZIO) usadas.add(c); });
  linhas.push('  ' + nome + ': [');
  for(let i = 0; i < N; i += 3) linhas.push("    '" + g.slice(i, i + 3).join("','") + "',");
  linhas[linhas.length - 1] = linhas[linhas.length - 1].replace(/,$/, '],');
});

/* ⚠️ A PREVIA EXISTE PORQUE ASCII NAO SE JULGA: a primeira leva de selos foi desenhada lendo a
   grade e reportada como "nao ficou muito bom". `node tools/gerar-selos.js --html > /tmp/p.html`
   abre os 30 nos tres tamanhos em que eles saem no jogo. */
if(process.argv.indexOf('--html') >= 0){
  const svg = '<svg style="position:absolute;width:0;height:0">' + ordem.map(nome => {
    const g = gerar(nome);
    let rs = '';
    g.forEach((linha, y) => { for(let x = 0; x < N; x++){ const c = linha[x];
      if(c !== VAZIO) rs += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + PALETA[c] + '"/>'; } });
    return '<symbol id="s-' + nome + '" viewBox="0 0 ' + N + ' ' + N + '">' + rs + '</symbol>';
  }).join('') + '</svg>';
  const uso = (n, px, cor) => '<svg width="' + px + '" height="' + px + '" shape-rendering="crispEdges"' +
    (cor ? ' style="color:' + cor + '"' : '') + '><use href="#s-' + n + '"/></svg>';
  /* ⚠️ quem usa `*` e de COR VARIAVEL: a previa mostra em tres cores, senao ele sai preto e parece
     quebrado -- foi assim que o disco do TM pareceu errado na primeira olhada. */
  const variavel = (n) => gerar(n).some(l => l.indexOf('*') >= 0);
  const CORES = ['#F08030', '#6890F0', '#78C850'];
  console.log('<meta charset="utf-8"><body style="background:#f0ece2;font:12px system-ui;margin:10px">' + svg +
    '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
    ordem.map(n => '<div style="width:104px;text-align:center;background:#fff;border:1px solid #ccc;padding:4px">' +
      (variavel(n)
        ? CORES.map(c => uso(n, 46, c)).join('') + '<br>' + CORES.map(c => uso(n, 16, c)).join(' ')
        : uso(n, 72) + '<br>' + uso(n, 24) + ' ' + uso(n, 16) + ' ' + uso(n, 12)) +
      '<div style="font-size:10px;color:' + (variavel(n) ? '#c22' : '#555') + '">' + n +
      (variavel(n) ? ' (cor)' : '') + '</div></div>').join('') + '</div>');
} else if(process.argv.indexOf('--paleta') >= 0){
  console.log('const PALETA_SELO = {');
  /* ⚠️ `*`, `+` e `-` NAO sao identificadores: sem aspas a tabela nao compila. */
  const chave = (k) => /^[A-Za-z_$][\w$]*$/.test(k) ? k : "'" + k + "'";
  Object.entries(PALETA).forEach(([k, v]) => { if(usadas.has(k)) console.log("  " + chave(k) + ": '" + v + "',"); });
  console.log('};');
  const sobrando = Object.keys(PALETA).filter(k => !usadas.has(k));
  if(sobrando.length) console.error('// cores sem uso: ' + sobrando.join(' '));
} else if(process.argv.indexOf('--ver') >= 0){
  ordem.forEach(nome => { console.log('\n== ' + nome + ' =='); gerar(nome).forEach(l => console.log(l)); });
} else {
  console.log('const DESENHOS = {');
  linhas.forEach(l => console.log(l));
  console.log('};');
  console.error('// ' + ordem.length + ' selos, grade ' + N + 'x' + N + ', ' + usadas.size + ' cores em uso');
}
