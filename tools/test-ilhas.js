/**
 * ILHAS LARANJA -- o mapa que virou a porta dos minigames admin (21/09/2026).
 *
 * O que ele existe pra pegar, em ordem de importância:
 *   1. o ACESSO: a home mostra UM botão administrativo, e ele depende de `admin === true` --
 *      NADA MAIS autoriza, e enquanto a conta não carregou ele fica OCULTO (o contrário da porta
 *      dos modos de campeão, que erra pro lado de deixar entrar);
 *   2. a PORTA É A AÇÃO: `entrarNaIlha` recusa a ilha sem jogo e o índice forjado -- a ilha
 *      apagada na tela é apresentação, não trava;
 *   3. cada ilha leva ao jogo DELA, e o `abrir` é a FUNÇÃO e não o nome dela (handler que aponta
 *      pro nada é a família de defeito que este projeto mais paga);
 *   4. o PINO SAI DO CENTRO DA ILHA DESENHADA -- duas fontes à mão deixariam o botão boiando no
 *      mar no primeiro ajuste do mapa, e isso não aparece como erro;
 *   5. os DEFS do SVG são uma cópia só, dividida com a ilha da Pescaria;
 *   6. sair de um jogo volta PRA AS ILHAS, e não pra home.
 *
 *   node tools/test-ilhas.js
 */
const path = require('path');
const raiz = path.join(__dirname, '..');
const { createSandbox } = require(path.join(__dirname, 'game-sandbox.js'));
const S = createSandbox();
const src = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');

let falhas = 0;
function ok(titulo, cond, extra){
  if(cond){ console.log('  OK     ' + titulo + (extra ? '   ' + extra : '')); }
  else { falhas++; console.log('  FALHOU ' + titulo + (extra ? '   ' + extra : '')); }
}
const g = S.__getGame ? S.__getGame() : S.game;
const SP = S.SPECIES;
const mk = (id, lv) => ({ speciesId: id, level: lv, name: SP[id].name, types: SP[id].types,
                          id: 'm' + id, hp: 1, maxHp: 1 });
function contaAdmin(){
  g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
  g.saveSlots[0] = { team: [mk('blastoise', 70), mk('lapras', 55), mk('jolteon', 60),
                            mk('gyarados', 62), mk('starmie', 66), mk('slowbro', 51)],
                     badgeCount: 8, customName: 'Time A' };
  g.saveSlotsCarregados = true; g.contaCarregada = true; g.ehAdmin = true;
  g.trainerName = 'Matheus'; g.aposentados = []; g.specialties = [];
  g.screen = 'saveSelect';
}
const home = () => { g.screen = 'saveSelect'; return S.renderSaveSelect(); };

/* ============================================================================
   1) O ACESSO -- ⚠️ AS ILHAS ABRIRAM PRA TODO MUNDO em 21/09/2026, a pedido

   Este bloco cobrava o CONTRARIO ate hoje: o botao e as seis portas so existiam pra
   `admin === true`. Ele nao foi apagado quando a porta saiu -- ele VIROU a trava da regra nova,
   senao alguem reintroduz a porta e ninguem ve. E a mesma decisao das cinco travas que caíram
   quando o trecho da Corrida virou 150 m: trava que envelhece vira a trava do que a substituiu.

   ⚠️ O QUE NAO ABRIU foram as reguas de JOGO -- a Corrida individual, a Pescaria e o Resgate
   continuam pedindo um time com as 8 insignias, porque montam a partir dos saves. Elas sao
   cobradas nos testes de cada jogo.
   ============================================================================ */
console.log('\n=== AS ILHAS SAO DE TODO MUNDO ===');
{
  contaAdmin();
  ok('com admin=true o botão aparece', home().indexOf('abrirIlhas()') >= 0, 'sem o botão');
  ok('  e com o nome EXATO', /Ilhas Laranja</.test(home()), 'o nome mudou');
  /* ⚠️ ELE OCUPA A LINHA INTEIRA: a fileira de modos é de DUAS colunas, e com os quatro modos
     normais o das ilhas fica sozinho na quinta célula -- medido a 320px, um buraco de 137px do
     lado. Não é hierarquia: é a linha fechando, a mesma razão do Boss de Domingo. */
  ok('  e ocupa a linha inteira',
     /home-btn-largo[^>]*abrirIlhas\(\)|abrirIlhas\(\)[^>]*home-btn-largo/.test(home()),
     'sem o home-btn-largo');

  /* ⚠️ E ELE APARECE PRA QUALQUER CONTA -- os mesmos valores que ANTES eram recusados. Sem este
     laço, a porta voltaria num `if` e só quem não é admin descobriria. */
  [['ausente', undefined], ['false', false], ['a string "sim"', 'sim'], ['a string "true"', 'true'],
   ['o número 1', 1], ['null', null], ['o objeto {}', {}]].forEach(([nome, v]) => {
    contaAdmin(); g.ehAdmin = ({ admin: v }).admin === true;
    ok('  e com admin ' + nome + ' ele CONTINUA lá', home().indexOf('abrirIlhas()') >= 0);
  });

  /* ⚠️ E NEM O `contaCarregada` segura mais: ele fazia parte da guarda de admin, e não havia
     outra razão pra esconder o botão. */
  contaAdmin(); g.ehAdmin = false; g.contaCarregada = false;
  ok('  e nem enquanto a conta carrega ele some', home().indexOf('abrirIlhas()') >= 0);

  /* ⚠️ AS SEIS PORTAS ABREM, e o laço as cobre de uma vez: o mapa mais os cinco jogos. Cada uma
     tinha a guarda ESCRITA SEPARADAMENTE, então uma que ficasse pra trás não apareceria em teste
     nenhum dos outros arquivos -- só pra quem não é admin, em produção. */
  [['abrirIlhas', 'ilhas'], ['abrirCorrida', 'corrida'], ['abrirPescaria', 'pescaria'],
   ['abrirSelecao', 'selecao'], ['abrirResgate', 'resgate'], ['abrirQueimada', 'queimada']
  ].forEach(([fn, tela]) => {
    contaAdmin(); g.ehAdmin = false; g.contaCarregada = true; g.screen = 'saveSelect';
    S[fn]();
    ok('  ' + fn + ' abre pra quem NÃO é admin', g.screen === tela, 'tela: ' + g.screen);
  });

  /* ⚠️ E NENHUMA DELAS DEIXA O RECADO ANTIGO na tela: ele dizia "Este modo é administrativo." */
  contaAdmin(); g.ehAdmin = false; g.modoBloqueado = null;
  S.abrirIlhas();
  ok('  e nenhuma diz mais que o modo é administrativo', !g.modoBloqueado, String(g.modoBloqueado));

  /* ⚠️ O `admin` CONTINUA EXISTINDO e continua fora do alcance do cliente -- ele é a porta do
     PAINEL de treinadores, que é onde o monitor das ilhas se lê. O que saiu foi só o uso dele
     como porta das ilhas. */
  const regras = require('fs').readFileSync(path.join(raiz, 'firestore.rules'), 'utf8');
  ok('e o `admin` continua na trava de campos das regras', /'admin'/.test(regras));
  ok('  e nenhuma porta das ilhas pergunta por ele',
     !/function abrir(Ilhas|Corrida|Pescaria|Selecao|Resgate|Queimada)\(\)\{[\s\S]{0,400}?ehAdmin/.test(src),
     'sobrou uma guarda de admin numa das seis portas');
}

/* ============================================================================
   2) OS TRÊS BOTÕES VELHOS SAÍRAM -- a home tem UMA porta administrativa
   ============================================================================ */
console.log('\n=== UM BOTÃO NO LUGAR DOS TRÊS ===');
{
  contaAdmin();
  const h = home();
  ['abrirCorrida()', 'abrirPescaria()', 'abrirResgate()'].forEach(f => {
    ok('a home não chama mais o ' + f, h.indexOf(f) < 0, 'o botão velho voltou');
  });
  ok('  e ela chama o `abrirIlhas()` UMA vez', (h.match(/abrirIlhas\(\)/g) || []).length === 1,
     (h.match(/abrirIlhas\(\)/g) || []).length + ' vezes');
  /* o selo do modo existe e é o que o botão usa -- e ele é o sistema vivo (os emojis viraram
     desenho em 17/09), não um PNG base64 novo. */
  ok('o selo `ilhas` existe', !!S.DESENHOS.ilhas);
  ok('  e a home o usa no botão', /selo\('ilhas','selo-modo'\)/.test(src.replace(/\s/g, '')));
  ok('  e a tela do modo também', /selo\('ilhas'\)/.test(src));
}

/* ============================================================================
   3) A TABELA DAS CINCO ILHAS
   ============================================================================ */
console.log('\n=== AS CINCO ILHAS ===');
{
  const L = S.ILHAS_LARANJA;
  ok('são cinco', L.length === 5, L.length + ' ilhas');
  ok('  sem id repetido', new Set(L.map(i => i.id)).size === L.length);
  ok('  sem nome repetido', new Set(L.map(i => i.nome)).size === L.length);
  /* ⚠️ OS LÍDERES SÃO OS MESMOS CINCO QUE A CORRIDA JÁ USA nos adversários -- eles entraram no
     jogo em 21/09/2026, antes do mapa existir. Se as duas listas divergirem, o jogador corre
     contra um líder que não tem ilha. */
  ok('  e os líderes são os mesmos cinco da Corrida',
     L.map(i => i.lider).sort().join(',') === [...S.CORRIDA_NPC_NOMES].sort().join(','),
     L.map(i => i.lider).join(',') + ' x ' + S.CORRIDA_NPC_NOMES.join(','));

  /* ⚠️ A TRAVA CONTA A TABELA, e não um número escrito aqui: a lista cresce a cada jogo novo (ela
     já foi 3 e virou 4 no mesmo dia), e uma contagem fixa cairia sozinha no próximo -- sem nada
     estar errado. É a mesma lição das cinco travas que caíram quando o trecho da Corrida virou
     150 m. O que NÃO pode mudar é toda ilha com jogo ter uma porta, e o mapa bater com a tabela. */
  const comJogo = L.filter(i => i.abrir);
  ok('pelo menos três ilhas já têm jogo', comJogo.length >= 3, comJogo.length + ' de ' + L.length);
  ok('  e toda ilha com jogo tem nome de jogo', comJogo.every(i => !!i.jogo));
  ok('  e toda ilha SEM jogo não tem nome nenhum', L.filter(i => !i.abrir).every(i => !i.jogo));
  /* ⚠️ O `abrir` É A FUNÇÃO, nunca o NOME dela: um nome em texto viraria uma busca no `window`
     (que não existe no sandbox) ou um `onclick` montado com ele dentro -- e handler que aponta pro
     nada é a família do `moveTeam` da Montanha e do slot sem aspas do montador. */
  ok('  e o `abrir` é a FUNÇÃO, não o nome dela',
     comJogo.every(i => typeof i.abrir === 'function'),
     comJogo.map(i => typeof i.abrir).join(','));
  ok('  e a ilha sem jogo não tem `abrir` nenhum',
     L.filter(i => !i.jogo).every(i => i.abrir === null));
  /* cada uma leva ao SEU jogo -- e o par não é gosto: o Resgate JÁ acontecia na Enseada de Mikan */
  [['mikan', 'abrirResgate', 'resgate'], ['navel', 'abrirCorrida', 'corrida'],
   ['trovita', 'abrirPescaria', 'pescaria']].forEach(([id, fn, tela]) => {
    const ilha = L.find(i => i.id === id);
    ok('  a Ilha ' + ilha.nome + ' leva ao ' + ilha.jogo, ilha.abrir === S[fn]);
    contaAdmin(); g.screen = 'ilhas';
    S.entrarNaIlha(L.indexOf(ilha));
    ok('    e entrar nela abre a tela `' + tela + '`', g.screen === tela, 'tela: ' + g.screen);
  });
  /* e cada jogo tem UMA ilha só -- duas portas pro mesmo modo seriam a mesma coisa duas vezes */
  ok('  e nenhum jogo aparece em duas ilhas',
     new Set(comJogo.map(i => i.jogo)).size === comJogo.length);
}

/* ============================================================================
   4) QUEM RECUSA É A AÇÃO -- a ilha apagada na tela é apresentação
   ============================================================================ */
console.log('\n=== A ILHA SEM JOGO ===');
{
  const L = S.ILHAS_LARANJA;
  /* ⚠️ DESDE 21/09/2026 NÃO HÁ ILHA EM BRANCO -- a Queimada fechou o arquipélago --, e isso quase
     apagou esta trava em silêncio: o `findIndex` passou a devolver **-1**, o `entrarNaIlha(-1)`
     volta sem trocar de tela, e as cinco asserções abaixo passavam **medindo nada**.
     É a armadilha do "zero perfeito" que este projeto já registra três vezes. A regra continua
     valendo -- ela é o que segura a próxima ilha que nascer antes do jogo dela --, então ela é
     testada com uma ilha POSTIÇA, posta e tirada aqui mesmo. */
  const postica = { id:'zz', nome:'Postiça', lider:'—', jogo:null, selo:null, abrir:null,
                    cx:180, cy:180, r:20, giro:0 };
  L.push(postica);
  const semJogo = L.indexOf(postica);
  ok('(há uma ilha sem jogo pra medir)', semJogo >= 0 && !L[semJogo].abrir);
  contaAdmin(); g.screen = 'ilhas';
  S.entrarNaIlha(semJogo);
  ok('a ilha sem jogo não leva a lugar nenhum', g.screen === 'ilhas', 'tela: ' + g.screen);
  /* ⚠️ E ELA CONTINUA SENDO UM <span>, não um botão apagado: é a decisão que o mapa carrega, e
     ela precisa sobreviver ao dia em que a sexta ilha nascer. */
  const comPosticaa = S.renderIlhas();
  ok('  e ela é um SPAN no mapa', comPosticaa.indexOf('<span class="ilha-pino em-breve"') >= 0);
  ok('  e DIZ "Em breve"', comPosticaa.indexOf('>Em breve<') >= 0);
  ok('  e não tem onclick', !/em-breve[^>]*onclick/.test(comPosticaa));
  L.pop();
  ok('(a postiça saiu da tabela)', L.indexOf(postica) < 0 && L.every(i => typeof i.abrir === 'function'));
  /* ⚠️ E UM ÍNDICE FORJADO TAMBÉM NÃO: o toque pode vir do console. */
  [-1, 99, null, undefined, 'mikan'].forEach(v => {
    g.screen = 'ilhas';
    S.entrarNaIlha(v);
    ok('  e o índice ' + JSON.stringify(v) + ' também não', g.screen === 'ilhas', 'tela: ' + g.screen);
  });
}

/* ============================================================================
   5) O MAPA
   ============================================================================ */
console.log('\n=== O MAPA DO ARQUIPÉLAGO ===');
{
  contaAdmin(); S.abrirIlhas();
  const h = S.renderIlhas();
  const L = S.ILHAS_LARANJA;
  ok('a tela desenha o mapa', h.indexOf('ilhas-mapa') >= 0);
  ok('  e o arquipélago dentro dele', h.indexOf(S.ILHAS_SVG) >= 0);
  ok('  com os cinco pinos', (h.match(/ilha-pino/g) || []).length === L.length,
     (h.match(/ilha-pino/g) || []).length);
  ok('  e o nome de cada ilha', L.every(i => h.indexOf('>' + i.nome + '<') >= 0));
  ok('  e o jogo de cada uma', L.filter(i => i.jogo).every(i => h.indexOf('>' + i.jogo + '<') >= 0));
  /* ⚠️ A ILHA SEM JOGO É UM `<span>`, e não um botão apagado: um botão que não faz nada convida um
     toque que não responde. É a mesma decisão da ilha da Pescaria e da ilhota do Resgate no setup. */
  const comJogo = L.filter(i => i.abrir).length, semJogo = L.length - comJogo;
  ok('  as com jogo são BOTÃO', (h.match(/<button class="ilha-pino"/g) || []).length === comJogo,
     (h.match(/<button class="ilha-pino"/g) || []).length + ' de ' + comJogo);
  ok('  e as sem jogo são SPAN, não botão apagado',
     (h.match(/<span class="ilha-pino em-breve"/g) || []).length === semJogo,
     (h.match(/<span class="ilha-pino em-breve"/g) || []).length + ' de ' + semJogo);
  /* ⚠️ E O RÓTULO DIZ O QUE FALTA: uma ilha apagada sem motivo faz procurar defeito. */
  ok('  e elas DIZEM "Em breve"', (h.match(/>Em breve</g) || []).length === semJogo);
  ok('  e nenhuma delas tem onclick', !/em-breve[^>]*onclick/.test(h));
  /* o selo de cada jogo é o MESMO do resto do jogo -- reusar é o que faz o pino se ler */
  L.filter(i => i.selo).forEach(i => {
    ok('  o selo `' + i.selo + '` existe', !!S.DESENHOS[i.selo]);
  });
  ok('  e o pino usa o selo da ilha', /selo\(ilha\.selo,'selo-ilha'\)/.test(src.replace(/\s/g, '')));

  /* ⚠️ AS DUAS ETIQUETAS DO PINO, LIDAS DO CSS -- tamanho de fonte e posicao nao aparecem em
     asserçao de HTML nenhuma, que e a liçao do `[hidden]` que deixou o modal da contagem preso na
     tela e da `section-title` fantasma que saia em texto de corpo. */
  const rNome = (src.match(/\.ilhas-mapa \.ilha-nome\{([^}]*)\}/) || [])[1] || '';
  const rJogo = (src.match(/\.ilhas-mapa \.ilha-jogo\{([^}]*)\}/) || [])[1] || '';
  ok('  as duas etiquetas têm regra no CSS', !!rNome && !!rJogo);
  const numCss = (r, p) => parseFloat((r.match(new RegExp(p + ':([-\\d.]+)')) || [])[1]);
  const fNome = numCss(rNome, 'font-size'), fJogo = numCss(rJogo, 'font-size');
  /* ⚠️ É UM PISO, e não o valor exato: cravar `.9rem` aqui faria a trava envelhecer no próximo
     ajuste -- a família que já caiu cinco vezes na Corrida (a metragem do revezamento, o texto do
     botão de modalidade, o cache, a fileira da classificação). O que ela existe pra impedir é a
     REGRESSÃO pro tamanho de antes de 23/09/2026 (.62 e .5rem), que foi o que o jogador reclamou. */
  ok('  o nome é pelo menos .8rem', fNome >= .8, fNome + 'rem');
  ok('  e o jogo pelo menos .65rem', fJogo >= .65, fJogo + 'rem');
  /* ⚠️ E A HIERARQUIA: o nome da ilha é o que se procura, o jogo é a legenda dele. Iguais, o olho
     não sabe qual dos dois ler primeiro. */
  ok('  e o nome é MAIOR que o jogo', fNome > fJogo, fNome + ' x ' + fJogo);
  /* ⚠️ E O `top` DO JOGO NÃO É UMA POSIÇÃO SOLTA: ele é o fim da etiqueta de cima mais o respiro.
     O nome é `position:absolute` com `line-height` e uma borda de 1px de cada lado, então a altura
     dele é `line-height + 2`. Mexer na fonte do nome sem mexer aqui faz as duas SE ENCOSTAREM -- e
     encostar não aparece como erro, aparece como duas caixas grudadas. Medido a 320px com os
     valores de hoje: 3px entre elas. */
  const fimDoNome = numCss(rNome, 'top') + numCss(rNome, 'line-height') + 2;
  ok('  e o jogo começa DEPOIS do fim do nome', numCss(rJogo, 'top') >= fimDoNome,
     'jogo em ' + numCss(rJogo, 'top') + ', o nome acaba em ' + fimDoNome);
  ok('  com respiro, sem colar nele', numCss(rJogo, 'top') - fimDoNome >= 2,
     (numCss(rJogo, 'top') - fimDoNome) + 'px');
  /* ⚠️ E O MAPA CORTA O QUE PASSAR DELE (`overflow:hidden`), então o teto do tamanho não é o gosto:
     é a etiqueta de baixo da ilha mais baixa chegando na borda. Medido no navegador a 320px, que é
     a menor largura que a casa mira: sobram 21px embaixo, 28 à esquerda e 30 à direita, e nenhuma
     etiqueta encosta na de outra ilha. */
  ok('  e o mapa recorta o que passar dele',
     /\.ilhas-mapa\{[^}]*overflow:hidden/.test(src));
}

/* ============================================================================
   6) ⚠️ O PINO SAI DO CENTRO DA ILHA DESENHADA -- e essa é a trava que importa
   ============================================================================ */
console.log('\n=== O PINO E A ILHA SÃO A MESMA FONTE ===');
{
  const L = S.ILHAS_LARANJA;
  /* ⚠️ A GEOMETRIA (`cx`/`cy`/`r`) MORA NA TABELA, e é dela que saem as DUAS coisas: o desenho do
     arquipélago e a posição do pino. Escritas em separado, um ajuste no mapa deixaria o botão
     boiando no mar -- e isso não aparece como erro, aparece como um pino fora do lugar. */
  ok('toda ilha tem a geometria na tabela',
     L.every(i => isFinite(i.cx) && isFinite(i.cy) && isFinite(i.r) && isFinite(i.giro)));
  ok('  e o pino é DERIVADO dela', L.every(i =>
     S.ilhaPino(i) === 'left:' + (i.cx / S.ILHAS_W * 100).toFixed(2) + '%;top:' + (i.cy / S.ILHAS_H * 100).toFixed(2) + '%'));
  /* a prova de que ele é derivado e não coincidência: mexer no centro move o pino junto */
  {
    const falsa = { cx: 180, cy: 190, r: 40, giro: 0 };
    const antes = S.ilhaPino(falsa);
    falsa.cx = 90;
    ok('  (mexendo no centro, o pino acompanha)', S.ilhaPino(falsa) !== antes,
       antes + ' -> ' + S.ilhaPino(falsa));
  }
  /* ⚠️ E O `ilhasMapaHtml` USA O `ilhaPino`, não uma conta própria: o teste lê o código porque um
     caso de comportamento passaria com a segunda conta escrita ali dentro. */
  const fatia = src.slice(src.indexOf('function ilhasMapaHtml('),
                          src.indexOf('function renderIlhas('));
  ok('  (e a trava lê o mapa)', fatia.length > 300, fatia.length + ' chars');
  ok('  e o mapa chama o `ilhaPino`', fatia.indexOf('ilhaPino(ilha)') >= 0);
  ok('  e não monta a posição à mão', fatia.indexOf("'left:' + ilha.x") < 0);

  /* nenhuma ilha fica fora do mapa, e nenhuma encosta na outra */
  L.forEach(i => {
    ok('  a Ilha ' + i.nome + ' cabe no viewBox',
       i.cx - i.r - 14 >= 0 && i.cx + i.r + 14 <= S.ILHAS_W &&
       i.cy - i.r - 14 >= 0 && i.cy + i.r + 14 <= S.ILHAS_H,
       i.cx + ',' + i.cy + ' r' + i.r);
  });
  let encostam = 0;
  for(let a = 0; a < L.length; a++) for(let b = a + 1; b < L.length; b++){
    const d = Math.hypot(L[a].cx - L[b].cx, L[a].cy - L[b].cy);
    if(d < L[a].r + L[b].r + 14) encostam++;
  }
  ok('  e nenhuma encosta na outra', encostam === 0, encostam + ' pares perto demais');

  /* ⚠️ O DESENHO É O MESMO EM TODA ABERTURA: o raio varia por vértice com uma conta FIXA, não
     sorteada -- um mapa que muda de forma a cada render não é um mapa. */
  ok('  e o arquipélago é sempre o mesmo', S.ILHAS_SVG === S.ILHAS_SVG &&
     S.ilhaPoligono(L[0], L[0].r) === S.ilhaPoligono(L[0], L[0].r));
  /* e as cinco silhuetas são DIFERENTES: sem isso o `giro` seria enfeite */
  ok('  e as cinco silhuetas são diferentes',
     new Set(L.map(i => S.ilhaPoligono(i, 40))).size === L.length);
}

/* ============================================================================
   7) OS DEFS SÃO UMA CÓPIA SÓ
   ============================================================================ */
console.log('\n=== O MAR DAS DUAS TELAS É O MESMO ===');
{
  /* ⚠️ OS PADRÕES (mar, areia, grama) E AS ÁRVORES são os MESMOS da ilha da Pescaria. Duas cópias
     divergiriam no primeiro ajuste, e o mar de uma tela deixaria de ser o mar da outra. */
  ok('o `ILHA_DEFS` existe', typeof S.ILHA_DEFS === 'string' && S.ILHA_DEFS.length > 500,
     (S.ILHA_DEFS || '').length + ' bytes');
  ok('  e os dois SVG o usam', S.ILHAS_SVG.indexOf(S.ILHA_DEFS) >= 0 &&
     S.PESCARIA_ILHA_SVG.indexOf(S.ILHA_DEFS) >= 0);
  ok('  e nenhum dos dois escreve `<defs>` à mão',
     (S.ILHAS_SVG.match(/<defs>/g) || []).length === 1 &&
     (S.PESCARIA_ILHA_SVG.match(/<defs>/g) || []).length === 1);
  ['sea', 'sand', 'grass', 'tree', 'palm', 'rock'].forEach(id => {
    ok('  o `' + id + '` vem dos defs', S.ILHA_DEFS.indexOf('id="' + id + '"') >= 0);
  });
  /* ⚠️ E OS `id` DELES SÃO GLOBAIS NO DOCUMENTO: os dois SVG nunca podem estar na tela ao mesmo
     tempo. Não estão -- um é da tela `ilhas` e o outro da `pescaria` --, e é isso que a trava
     cobra: nenhuma tela desenha os dois. */
  contaAdmin(); S.abrirIlhas();
  const h = S.renderIlhas();
  ok('  e a tela das ilhas não desenha a ilha da Pescaria',
     h.indexOf(S.PESCARIA_ILHA_SVG) < 0);
}

/* ============================================================================
   8) SAIR DE UM JOGO VOLTA PRA AS ILHAS
   ============================================================================ */
console.log('\n=== A VOLTA ===');
{
  /* ⚠️ O JOGO MORA NUMA ILHA, e sair dele é voltar pro mapa -- quem quer a home aperta o Voltar
     de lá. Antes os três caíam direto na home, que é onde eles moravam. */
  [['sairDaCorrida', 'abrirCorrida'], ['sairDaPescaria', 'abrirPescaria'],
   ['sairDoResgate', 'abrirResgate']].forEach(([sair, abrir]) => {
    contaAdmin();
    S[abrir]();
    S[sair]();
    ok('o `' + sair + '` volta pra as ilhas', g.screen === 'ilhas', 'tela: ' + g.screen);
  });
  /* e o Voltar das ilhas leva pra home */
  contaAdmin(); S.abrirIlhas();
  S.sairDasIlhas();
  ok('e o Voltar das ilhas leva pra home', g.screen === 'saveSelect', 'tela: ' + g.screen);
  /* ⚠️ E O `sair*` CONTINUA ZERANDO O JOGO ANTES: sem isso o laço do minigame seguiria vivo na
     tela do mapa -- é a guarda que cada um deles já tem, e a volta não pode passar por cima. */
  const fatia = (nome) => src.slice(src.indexOf('function ' + nome + '('),
                                    src.indexOf('function ' + nome + '(') + 400);
  [['sairDaCorrida', 'corridaZerar'], ['sairDaPescaria', 'pescariaZerar'],
   ['sairDoResgate', 'resgateZerar']].forEach(([sair, zerar]) => {
    const f = fatia(sair);
    ok('  e o `' + sair + '` zera antes de sair',
       f.indexOf(zerar + '()') >= 0 && f.indexOf(zerar + '()') < f.indexOf('abrirIlhas()'));
  });
}

/* ============================================================================
   9) O ROTEADOR E O ESTADO
   ============================================================================ */
console.log('\n=== A TELA ===');
{
  ok('o roteador conhece a tela `ilhas`', /case 'ilhas': html = renderIlhas\(\); break;/.test(src));
  /* ⚠️ E NADA DISTO VAI PRO SAVE: o mapa é uma tela, não um estado de jornada. */
  contaAdmin(); S.abrirIlhas();
  const ser = JSON.stringify(S.serializeGame());
  ok('  e a tabela das ilhas não entra no save', ser.indexOf('ILHAS_LARANJA') < 0 &&
     ser.indexOf('Kumquat') < 0 && ser.indexOf('Pummelo') < 0);
  /* a tela tem saída -- a lição do Resgate, que nasceu sem nenhuma */
  const h = S.renderIlhas();
  ok('  e ela tem um Voltar', h.indexOf('sairDasIlhas()') >= 0);
}


/* ============================================================================
   O (i) DE CADA ILHA -- como o minijogo funciona (21/09/2026)
   ============================================================================ */
console.log('\n=== O (i) EXPLICA CADA MINIJOGO ===');
{
  S.abrirIlhas();
  const html = S.renderIlhas();
  /* ⚠️ A TRAVA CONTA A TABELA, nunca um número escrito aqui: ela envelheceria na próxima ilha que
     nascesse. É a mesma lição das duas que fixavam "3 com jogo e 2 em breve". */
  const comJogo = S.ILHAS_LARANJA.filter(i => i.abrir);
  ok('toda ilha com jogo tem um (i)',
     (html.match(/class="ilha-info"/g) || []).length === comJogo.length,
     (html.match(/class="ilha-info"/g) || []).length + ' de ' + comJogo.length);
  ok('  e todas elas têm texto', comJogo.every(i => !!S.ILHAS_COMO[i.id]),
     comJogo.filter(i => !S.ILHAS_COMO[i.id]).map(i => i.id).join(',') || '(todas)');
  ok('  e nenhum texto sobra sem ilha',
     Object.keys(S.ILHAS_COMO).every(id => S.ILHAS_LARANJA.some(i => i.id === id)));
  ok('  e cada um tem resumo e passos',
     Object.values(S.ILHAS_COMO).every(c => c.resumo && c.passos && c.passos.length >= 2));

  /* ⚠️ O (i) É IRMÃO DO PINO, nunca filho: `<button>` dentro de `<button>` é HTML inválido -- o
     navegador fecha o de fora e o clique de dentro se perde, com a tela continuando a PARECER
     certa. É a armadilha que a lupa do encontro selvagem e a do montador já custaram. */
  const pinoAberto = html.indexOf('<button class="ilha-pino"');
  const fimDoPino = html.indexOf('</button>', pinoAberto);
  const infoDepois = html.indexOf('class="ilha-info"', pinoAberto);
  ok('  e ele fica FORA do botão do pino', infoDepois > fimDoPino,
     'o pino fecha em ' + fimDoPino + ' e o (i) começa em ' + infoDepois);

  /* ⚠️ E ELE SAI DO MESMO left/top DO PINO: o deslocamento vem do transform, então mover uma ilha
     na tabela move os dois juntos. Com posição própria ele ficaria boiando no mar. */
  const pos = S.ilhaPino(comJogo[0]);
  ok('  e ele usa a mesma posição do pino', html.indexOf('class="ilha-info" style="' + pos + '"') >= 0
     || html.indexOf('ilha-info" style="' + pos + '"') >= 0, pos);
}

console.log('\n=== E A CAIXA ABRE, EXPLICA E FECHA ===');
{
  S.abrirIlhas();
  ok('ela nasce fechada', S.renderIlhas().indexOf('ilha-como') < 0);
  const i = S.ILHAS_LARANJA.findIndex(x => x.id === 'pummelo');
  S.abrirIlhaInfo(i);
  const aberta = S.renderIlhas();
  const como = S.ILHAS_COMO.pummelo;
  ok('  e abre com o nome do jogo', aberta.indexOf(S.ILHAS_LARANJA[i].jogo) >= 0);
  ok('  com o resumo', aberta.indexOf(como.resumo) >= 0);
  ok('  e com os ' + como.passos.length + ' passos',
     (aberta.match(/<li>/g) || []).length === como.passos.length);
  /* ⚠️ A CLASSE É A DA CASA (`modal-overlay`), e isso não é detalhe: a primeira versão usou um nome
     que NÃO EXISTE na folha, e classe que não existe não dá erro -- ela só não faz nada. A caixa
     renderizava no FLUXO, embaixo do botão de voltar, em vez de sobrepor. */
  ok('  e ela usa o overlay da casa', aberta.indexOf('modal-overlay') >= 0);
  ok('    e o CSS dele existe de verdade', /\.modal-overlay\s*\{/.test(src),
     'sem a regra ela renderiza no fluxo');
  S.fecharIlhaInfo();
  ok('  e fecha', S.renderIlhas().indexOf('ilha-como') < 0);

  /* ⚠️ E O ESTADO ZERA AO ENTRAR NO MAPA: ninguém volta amanhã querendo a caixa de uma ilha
     aberta, e ela é estado de TELA -- não vai pro save. */
  S.abrirIlhaInfo(i);
  S.abrirIlhas();
  ok('  e entrar no mapa zera a caixa', S.renderIlhas().indexOf('ilha-como') < 0);
  ok('  e ela não vai pro save', JSON.stringify(S.serializeGame() || {}).indexOf('ilhaAberta') < 0);

  /* ⚠️ ÍNDICE FORJADO NÃO ABRE NADA -- e a defesa está em DOIS lugares: a ação recusa e o render
     também. Por isso a trava tem duas metades: o comportamento prova o que o jogador vê, e a
     leitura do código prova a guarda da AÇÃO -- sem ela, a conferência de acusação passa em branco,
     porque o render sozinho já segura. Foi ela que mostrou isso. */
  S.abrirIlhaInfo(99);
  ok('  e um índice inventado não abre nada', S.renderIlhas().indexOf('ilha-como') < 0);
  ok('    e quem recusa é a AÇÃO, não só a tela', (() => {
    const i = src.indexOf('function abrirIlhaInfo');
    if(i < 0) return false;
    const corpo = src.slice(i, src.indexOf('function fecharIlhaInfo', i));
    return corpo.length > 20 && corpo.indexOf('ILHAS_COMO[') >= 0;
  })(), 'a guarda vive dentro do abrirIlhaInfo');
}

/* ============================================================================
   O ANUNCIO DAS NOVIDADES NA HOME (21/09/2026, a pedido)

   O que ele existe pra pegar, em ordem de importancia:
     1. o ACESSO: ele so nasce pra `admin === true`, e NAO nasce enquanto a conta carrega --
        anunciar as Ilhas Laranja a quem nao consegue abri-las manda o jogador procurar na home
        um botao que nao esta la;
     2. a MARCA E A VERSAO, e nao um "ja viu": e ela que deixa o PROXIMO anuncio reaparecer sem
        ninguem limpar campo de conta na mao;
     3. o RESUMO SAI DO `ILHAS_COMO`, nao de uma segunda lista -- que divergiria dela no dia em
        que uma ilha trocasse de jogo;
     4. ele e da CONTA e entra no CAMPOS_DA_CONTA: sem isso abrir um save o apagaria e o anuncio
        voltaria pra quem ja leu.
   ============================================================================ */
console.log('');
console.log('=== O ANUNCIO DAS NOVIDADES ===');
{
  function contaLimpa(){
    contaAdmin();
    g.novidadeVista = null;
    g.novidadesModal = false;
    g.authUser = { uid: 'u1' };
    S.__escritas.length = 0;
  }

  /* ---- 1) o acesso ---- */
  contaLimpa();
  ok('admin=true na home abre o anuncio', S.conferirNovidades() === true && g.novidadesModal === true);

  /* ⚠️ E ELE ABRE PRA TODA CONTA desde 21/09/2026, junto com as ilhas -- este laço cobrava o
     CONTRÁRIO (os oito valores que NÃO autorizavam) e virou a trava da regra nova: o anúncio fala
     de um modo que todo mundo abre, então esconde-lo de alguém seria esconder a novidade. */
  for(const v of [false, undefined, null, 'sim', 1, 'true', 0, '']){
    contaLimpa(); g.ehAdmin = v;
    ok('  e com admin ' + JSON.stringify(v) + ' ele CONTINUA abrindo',
       S.conferirNovidades() === true && g.novidadesModal === true);
  }
  /* ⚠️ ENQUANTO A CONTA NAO CARREGOU ele NAO nasce -- o contrario da porta dos modos de campeao,
     que erra pro lado de deixar entrar. Aqui o lado seguro e o outro. */
  contaLimpa(); g.contaCarregada = false;
  ok('  e nao abre enquanto a conta carrega', S.conferirNovidades() === false && !g.novidadesModal);

  /* ⚠️ E SO NA HOME: o loadPermanentUserData roda tambem na Pokedex e nas Conquistas, e um modal
     cobre a tela inteira. */
  for(const tela of ['pokedex', 'achievements', 'ilhas', 'battling']){
    contaLimpa(); g.screen = tela;
    ok('  e nao abre na tela ' + tela, S.conferirNovidades() === false && !g.novidadesModal);
  }

  /* ---- 2) a versao: quem leu nao rele, e um anuncio NOVO reaparece ---- */
  contaLimpa(); g.novidadeVista = S.NOVIDADES_VERSAO;
  ok('quem ja leu ESTA versao nao ve de novo', S.conferirNovidades() === false && !g.novidadesModal);

  contaLimpa(); g.novidadeVista = 'um-anuncio-velho';
  ok('  mas quem leu um anuncio ANTIGO ve o novo', S.conferirNovidades() === true && g.novidadesModal === true,
     'e isso que a VERSAO compra -- com um booleano de "ja viu" este seria o unico anuncio da vida do jogo');

  /* ---- 3) fechar marca, grava na conta, e nao reabre ---- */
  contaLimpa();
  S.conferirNovidades();
  S.fecharNovidades();
  ok('fechar marca como lido', g.novidadeVista === S.NOVIDADES_VERSAO && g.novidadesModal === false);
  ok('  e grava na CONTA, com merge',
     S.__escritas.some(e => e.dados && e.dados.novidadeVista === S.NOVIDADES_VERSAO && e.opcoes && e.opcoes.merge),
     JSON.stringify(S.__escritas.map(e => e.dados)));
  ok('  e nao reabre depois disso', S.conferirNovidades() === false);

  /* ⚠️ O BOTAO PRINCIPAL TAMBEM MARCA: o que marca e ter LIDO, nao o caminho tomado -- senao quem
     clica nele reencontra o anuncio na proxima vez que abrir a home.
     ⚠️ ELE ERA O "Ver as Ilhas" E VIROU O "Ver a Liga Pro" quando a versao girou (24/09/2026) -- e a
     funcao antiga SAIU do jogo no mesmo dia, porque ela ficou com ZERO chamadores. */
  contaLimpa();
  S.conferirNovidades();
  S.novidadesIrParaALigaPro();
  ok('o botao que leva a Liga Pro tambem marca', g.novidadeVista === S.NOVIDADES_VERSAO && !g.novidadesModal);
  ok('  e leva mesmo pra a Liga Pro', g.screen === 'league' && g.currentLeagueTypeId === 'pro',
     'tela: ' + g.screen + ' / liga: ' + g.currentLeagueTypeId);
  /* ⚠️ E A FUNCAO DO ANUNCIO ANTIGO NAO PODE VOLTAR: ela era letra morta, e letra morta e o tipo de
     coisa que fica anos no arquivo sem ninguem saber que esta morta. */
  ok('    e a do anuncio antigo nao existe mais', src.indexOf('function novidadesIrParaAsIlhas') < 0);

  /* ---- 4) o conteudo: a VERSAO GIROU pra a Liga Pro (24/09/2026) ----
     ⚠️ ESTE BLOCO MEDIA O ANUNCIO DAS ILHAS e ele NAO foi apagado: o anuncio trocou de assunto, e
     cada trava passou a cobrar a MESMA regra sobre o conteudo novo. A regra que importa e a de
     baixo -- os numeros sao DERIVADOS das constantes --, e ela e a razao de o bloco existir.
     ⚠️ E AS CONSTANTES SAO LIDAS DO FONTE, nao do sandbox: `const` nao vira propriedade global
     dele (a licao que a Queimada e a Arena ja custaram), e exportar uma de longe ja matou o
     servidor inteiro com um TDZ. E o padrao do test-liga-pro. */
  contaLimpa(); S.conferirNovidades();
  const modal = S.renderNovidadesModal();
  /* ⚠️ O TETO DA LISTA E UMA DECISAO DE TELA, medida a 320px -- nao ha constante no jogo pra
     derivar dele. Ele vale 2 porque numa caixa de 483px (85vh de 568) sobram 135px pra lista, e o
     item mede ~67: com quatro, os dois de baixo (os golpes e as 100 MOEDAS) ficavam escondidos. */
  const NOVIDADES_LINHAS_MAX = 2;
  /* a tela pra onde o botao leva -- e la que as faixas continuam sendo ditas */
  const gPro = S.__getGame();
  gPro.screen = 'league'; gPro.currentLeagueTypeId = S.PRO_LEAGUE_TYPE || 'pro';
  gPro.leagueScreenLoading = false;
  gPro.leagueData = { cycles: [{ id:'cp', status:'registering', scheduledTime: Date.now()+6e5,
                                 registrants: [], amIRegistered: false }] };
  S.__setGame(gPro);
  const telaPro = S.renderLeague();
  contaLimpa(); S.conferirNovidades();
  const numDo = n => ((new RegExp('const ' + n + ' = (\\d+);').exec(src) || [0, 0])[1]) | 0;
  const PRO_SORTEADOS = numDo('PRO_SORTEADOS');
  const PRO_ESCOLHE   = numDo('PRO_ESCOLHE');
  const MOEDAS_PRO    = numDo('MOEDAS_CAMPEAO_PRO');
  const MOEDAS_RIVAL  = numDo('MOEDAS_RIVAL');
  const PRO_FAIXAS    = JSON.parse(/const PRO_FAIXAS = (\[[^;]*\]);/.exec(src)[1]);
  /* ⚠️ A VERSAO NAO PODE SER A DE UM ANUNCIO ANTERIOR, e esta trava nasceu de um MUDO da
     conferencia de acusacao (24/09/2026): devolvendo a NOVIDADES_VERSAO pra a das Ilhas, quem JA
     leu aquele anuncio nunca veria este -- e nenhuma trava acusava, porque o teste inteiro usa o
     valor DERIVADO (S.NOVIDADES_VERSAO) em vez de crava-lo.
     ⚠️ E ELA E UMA LISTA DO QUE JA FOI USADO, nunca o valor de hoje cravado: cravado, ela
     envelheceria no PROXIMO anuncio -- e a regra que importa e a de nunca REUSAR. */
  const VERSOES_JA_USADAS = ['ilhas-laranja'];
  ok('a versao do anuncio nao reusa nenhuma anterior',
     VERSOES_JA_USADAS.indexOf(S.NOVIDADES_VERSAO) < 0, 'versao: ' + S.NOVIDADES_VERSAO);
  ok('o anuncio fala da Liga Pro', modal.indexOf('Liga Pro') >= 0);
  ok('  e diz que o time e SORTEADO', /sorteado/i.test(modal));
  ok('  com os ' + PRO_SORTEADOS + ' que aparecem e os ' + PRO_ESCOLHE + ' que entram',
     modal.indexOf(String(PRO_SORTEADOS)) >= 0 && modal.indexOf(String(PRO_ESCOLHE)) >= 0);
  /* ⚠️ AS FAIXAS SAIRAM DO ANUNCIO, e esta trava media o conteudo que saiu -- ela nao foi apagada:
     virou a trava da regra NOVA. A razao do corte esta medida (320px): com QUATRO linhas a lista
     mostrava 2 de 4, e os dois escondidos eram OS GOLPES e AS 100 MOEDAS -- o premio e uma das tres
     coisas que o pedido nomeia, e uma lista que rola por dentro esconde sem avisar.
     ⚠️ E A SEGUNDA METADE E A QUE FAZ O CORTE SER SEGURO: as faixas continuam na TELA DA LIGA PRO,
     que e pra onde o botao leva. Sem ela, alguem devolve as tres ao anuncio e a lista volta a
     esconder o premio -- e so quem abrisse numa tela de 568 descobriria. */
  ok('  e a lista cabe em ' + NOVIDADES_LINHAS_MAX + ' linhas (medido a 320px)',
     (modal.match(/<li>/g) || []).length <= NOVIDADES_LINHAS_MAX,
     (modal.match(/<li>/g) || []).length + ' linhas');
  ok('  e as faixas NAO estao no anuncio (elas tem quadro proprio na tela da Liga Pro)',
     PRO_FAIXAS.every(f => modal.indexOf(S.proRotuloDaFaixa(f)) < 0));
  /* ⚠️ O SELO DA LINHA DO TIME E O DE TIME DA CASA, e nao a bandeira quadriculada -- aquela e a
     LINHA DE CHEGADA da Corrida, e num anuncio de liga ela se le como outro modo (foi a captura de
     tela a 320px que pegou). A comparacao e DERIVADA do botao "Seu time" do jogo: cravado o nome do
     selo aqui, a trava envelheceria no dia em que a casa trocasse o dela. */
  const seloDeTime = (S.botaoSeuTimeHtml() .match(/#s-[a-z_0-9]+/) || [''])[0];
  ok('  e a linha do time leva o selo de TIME da casa (' + seloDeTime + ')',
     seloDeTime.length > 4 && (function(){
       const i = modal.indexOf(String(PRO_SORTEADOS) + ' aparecem');
       if(i <= 0) return false;
       const li = modal.lastIndexOf('<li>', i);
       return modal.lastIndexOf(seloDeTime, i) > li;
     })());
  ok('  e o premio do campeao (' + MOEDAS_PRO + ')', modal.indexOf(String(MOEDAS_PRO)) >= 0);
  ok('  e a aposta com o rival (' + MOEDAS_RIVAL + ')',
     /rival/i.test(modal) && modal.indexOf(String(MOEDAS_RIVAL)) >= 0);
  ok('  e os golpes escolhidos, ate ' + S.MAX_GOLPES, modal.indexOf(String(S.MAX_GOLPES)) >= 0);

  /* ⚠️ E ELES SAO DERIVADOS, nao escritos na frase -- a trava LE O CODIGO porque hoje os numeros
     coincidem: uma frase com "12" passaria em todos os casos de cima. E a mesma tecnica que a
     descricao da Liga Pro e a conta da Pokedex precisaram. */
  const fnModal = src.slice(src.indexOf('function renderNovidadesModal()'),
                            src.indexOf('const PESCARIA_ILHA_SVG'));
  ok('a fatia do modal tem o que ler', fnModal.length > 800 && fnModal.length < 6000, String(fnModal.length));
  ok('  e os numeros sao DERIVADOS das constantes',
     /\$\{PRO_SORTEADOS\}/.test(fnModal) && /\$\{PRO_ESCOLHE\}/.test(fnModal) &&
     /\$\{MOEDAS_CAMPEAO_PRO\}/.test(fnModal) && /\$\{MOEDAS_RIVAL\}/.test(fnModal) &&
     /\$\{MAX_GOLPES\}/.test(fnModal));
  ok('    e nenhum deles esta escrito a mao',
     fnModal.indexOf('>' + PRO_SORTEADOS + ' ') < 0 && !new RegExp('🪙 ' + MOEDAS_PRO).test(fnModal));
  /* ⚠️ E O QUE O ANUNCIO DEIXOU DE DIZER, A TELA DA LIGA PRO CONTINUA DIZENDO -- e a metade que
     prova que o corte nao perdeu nada. */
  ok('    e as faixas continuam na TELA da Liga Pro, com o rotulo da casa',
     PRO_FAIXAS.every(f => telaPro.indexOf(S.proRotuloDaFaixa(f)) >= 0),
     PRO_FAIXAS.map(f => S.proRotuloDaFaixa(f)).join(' / '));

  /* ---- 5) a tela ---- */
  ok('o anuncio tem os dois botoes',
     modal.indexOf('novidadesIrParaALigaPro()') >= 0 && modal.indexOf('fecharNovidades()') >= 0);
  ok('  e usa o modal-overlay da casa -- classe que nao existe nao da erro, so nao faz nada',
     modal.indexOf('modal-overlay') >= 0 && modal.indexOf('novidades-box') >= 0);

  /* ⚠️ TRES ANDARES: quem rola e a LISTA, nao a caixa -- senao os dois botoes caem fora da tela
     (medido a 320px). Isso nao aparece em asserção de HTML nenhuma, entao a trava le o CSS. */
  const css = (src.match(/\.novidades-box\{[^}]*\}/) || [''])[0];
  const cssLista = (src.match(/\.novidades-lista\{[^}]*\}/) || [''])[0];
  ok('  e a CAIXA e uma coluna com teto, nao um bloco que rola',
     /max-height:85vh/.test(css) && /flex-direction:column/.test(css) && !/overflow-y:auto/.test(css), css);
  ok('    e quem rola e a LISTA, com min-height:0',
     /overflow-y:auto/.test(cssLista) && /min-height:0/.test(cssLista), cssLista);

  /* ---- 6) o que o codigo tem que dizer (os casos chamam as funcoes na mao e passariam sem isso) ---- */
  ok('os dois campos estao no CAMPOS_DA_CONTA',
     S.CAMPOS_DA_CONTA.indexOf('novidadeVista') >= 0 && S.CAMPOS_DA_CONTA.indexOf('novidadesModal') >= 0,
     'sem isso abrir um save apaga a marca e o anuncio volta');
  ok('  e o carregamento da conta CONFERE o anuncio',
     /conferirHM03\(\);[\s\S]{0,600}conferirNovidades\(\);/.test(src),
     'a chamada ficou orfa');
  ok('  e o render principal ANEXA o modal',
     /if\(game\.novidadesModal\)\{ html \+= renderNovidadesModal\(\); \}/.test(src));
  ok('  e a marca NAO vai pro save (e da conta, nao do save)',
     JSON.stringify(S.serializeGame() || {}).indexOf('novidadeVista') < 0);
}

/* ============================================================================
   A CARA DO ANUNCIO (21/09/2026, a pedido: "adicione o mesmo icone que esta no botao, no titulo
   dessa mensagem, e tambem adicione algum elemento da cor laranja")
   ============================================================================ */
console.log('');
console.log('=== O ICONE NO TITULO E O LARANJA ===');
{
  contaAdmin(); g.novidadeVista = null; g.novidadesModal = false;
  S.conferirNovidades();
  const m = S.renderNovidadesModal();

  /* ⚠️ O MESMO SELO DO CARD DA LIGA PRO -- e a trava le o selo DO CARD em vez de escrever o nome
     aqui: se ele trocar um dia, e o anuncio que tem que acompanhar. Ela media o selo do botao das
     ILHAS na home e VIROU esta quando a versao girou (24/09/2026), porque o anuncio trocou de
     assunto -- a REGRA e a mesma: o simbolo do anuncio e o do lugar que ele manda procurar. */
  const seloDoCard = (S.renderLeagueTypesList().match(/#s-([a-z0-9_-]+)"\/><\/svg> Liga Pro/) || [])[1];
  ok('o titulo leva o MESMO selo do card da Liga Pro',
     !!seloDoCard && new RegExp('<h2>[^<]*<svg[^>]*><use href="#s-' + seloDoCard + '"').test(m),
     'selo do card: ' + seloDoCard);
  ok('  e o icone nao aparece DUAS vezes na caixa', m.indexOf('modal-icon') < 0,
     'ele foi pro titulo, entao o modal-icon saiu -- e isso devolveu 45px de lista');

  /* ⚠️ A CAIXA NAO TEM COR PROPRIA, e isso e decisao: a das Ilhas tinha porque o laranja E a
     identidade delas, e a Liga Pro nao tem cor no jogo -- inventar uma seria inventar identidade
     que ninguem pediu. A moldura e a padrao do modal.
     ⚠️ MAS A REGRA DO "UM DONO" CONTINUA COBRADA no botao da home das Ilhas, que existe e le a
     constante: e ela que impede o valor de ser escrito a mao num segundo lugar. */
  ok('a caixa usa a moldura padrao do modal', m.indexOf('border-color:') < 0, m.slice(0, 160));
  ok('  e o botao da HOME le a MESMA constante',
     S.renderSaveSelect().indexOf('background:' + S.COR_ILHAS) >= 0, 'a cor tem UM dono');
  ok('    e o valor nao esta escrito a mao em lugar nenhum',
     (src.match(/#e07a1e/g) || []).length === 1,
     'so a declaracao da constante pode carregar o valor');

  /* ⚠️ O TEXTO BRANCO SOBRE O LARANJA DA 3,01:1 -- medido no navegador, e e o MESMO numero que o
     botao da home ja pratica desde 21/09. A sombra melhora a leitura sem mexer na identidade. */
  ok('  e o texto do botao tem sombra (o laranja da 3,01:1 com branco)',
     /\.novidades-box \.btn\.primary\{text-shadow:/.test(src));
}

/* ============================================================================
   O MONITOR, DO LADO DO CLIENTE (21/09/2026)

   ⚠️ A TRAVA QUE IMPORTA E A DAS CINCO CHAMADAS. Cinco `httpsCallable` escritos a mao garantiriam
   que o proximo jogo nascesse sem contar -- e ele sumiria do monitor EM SILENCIO, que e a pior
   forma de uma metrica falhar. Por isso ela varre os CINCO e cobra que todos passem pela MESMA
   funcao, e que ela seja chamada onde a partida LARGA (nao onde a tela abre).
   ============================================================================ */
console.log('');
console.log('=== O MONITOR CONTA AS CINCO ILHAS ===');
{
  /* espiona o que o cliente manda pro servidor */
  const mandadas = [];
  const originalFC = S.functionsClient;
  S.functionsClient = { httpsCallable(nome){
    return (dados) => { mandadas.push({ nome, dados }); return Promise.resolve({ data: {} }); };
  } };

  contaAdmin(); g.authUser = { uid: 'u1' };
  S.registrarPartidaDaIlha('mikan');
  ok('a chamada vai pro registerIslandPlay',
     mandadas.length === 1 && mandadas[0].nome === 'registerIslandPlay',
     JSON.stringify(mandadas));
  ok('  com o id da ilha', mandadas[0] && mandadas[0].dados && mandadas[0].dados.ilha === 'mikan');

  /* ⚠️ SEM LOGIN ELA NEM TENTA: a callable recusaria, e uma ida ao servidor que nunca pode dar
     certo e desperdicio -- a mesma razao pela qual o cliente nao escreve no ciclo da Trainers. */
  mandadas.length = 0;
  g.authUser = null;
  S.registrarPartidaDaIlha('mikan');
  ok('  e sem login ela nem tenta', mandadas.length === 0, JSON.stringify(mandadas));

  /* ⚠️ E ELA E BEST-EFFORT: se o servidor recusar, a partida NAO pode parar. */
  g.authUser = { uid: 'u1' };
  S.functionsClient = { httpsCallable(){ return () => Promise.reject(new Error('caiu')); } };
  let explodiu = false;
  try { S.registrarPartidaDaIlha('mikan'); } catch(e){ explodiu = true; }
  ok('  e um erro do servidor nao derruba a partida', !explodiu);

  S.functionsClient = originalFC;

  /* ⚠️ AS CINCO CHAMADAS EXISTEM, uma por ilha -- lido do CODIGO, porque cada jogo larga por um
     caminho proprio e um caso de comportamento por jogo nao provaria que nenhuma FALTA. */
  const chamadas = (src.match(/registrarPartidaDaIlha\('[a-z]+'\)/g) || []);
  const ilhasContadas = [...new Set(chamadas.map(c => c.match(/'([a-z]+)'/)[1]))].sort();
  const ilhasDoMapa = S.ILHAS_LARANJA.map(i => i.id).sort();
  ok('as CINCO ilhas contam partida', ilhasContadas.join(',') === ilhasDoMapa.join(','),
     'contam: ' + ilhasContadas.join(',') + ' | mapa: ' + ilhasDoMapa.join(','));
  ok('  e nenhuma conta duas vezes', chamadas.length === ilhasDoMapa.length,
     chamadas.length + ' chamadas pra ' + ilhasDoMapa.length + ' ilhas');

  /* ⚠️ E CADA UMA FICA ONDE A PARTIDA LARGA, nao onde a tela abre: abrir e fechar o setup nao e
     "jogou", e o que o monitor mede e partida jogada. */
  [['navel', "corrida.fase = 'contagem';"], ['trovita', "pescaria.fase = 'jogando';"],
   ['kumquat', "selecao.fase = 'draft';"], ['mikan', "resgate.fase = 'correndo';"],
   ['pummelo', "queimada.fase = 'jogando';"]
  ].forEach(([ilha, largada]) => {
    const i = src.indexOf(largada);
    ok('  ' + ilha + ' conta na LARGADA',
       i >= 0 && src.slice(i, i + 220).indexOf("registrarPartidaDaIlha('" + ilha + "')") >= 0,
       i < 0 ? 'a largada mudou de forma' : 'na largada da fase');
  });

  /* ⚠️ E A LISTA DO SERVIDOR BATE COM A DO MAPA: uma ilha que nasca so no cliente seria recusada
     com 'invalid-argument' e sumiria do monitor em silencio. */
  const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
  const noServidor = (srv.match(/const ILHAS_DO_ARQUIPELAGO = \[([^\]]*)\]/) || [])[1] || '';
  const idsSrv = (noServidor.match(/'([a-z]+)'/g) || []).map(x => x.replace(/'/g, '')).sort();
  ok('  e a lista do SERVIDOR bate com a do mapa', idsSrv.join(',') === ilhasDoMapa.join(','),
     'servidor: ' + idsSrv.join(',') + ' | mapa: ' + ilhasDoMapa.join(','));
}

/* ============================================================================
   ⚠️ E ELE APARECE UMA VEZ SO -- a releitura da conta NAO pode rebaixar a marca (21/09/2026)

   Pedido assim: "apos o usuario ver a mensagem de novidades e clicar em Ok, esse modal nao deve
   mais aparecer, deve aparecer somente 1x". A marca ja existia; o que faltava era ela SOBREVIVER
   a releitura: a gravacao do `fecharNovidades` e best-effort (sem await) e o
   `loadPermanentUserData` roda de novo toda vez que se volta pra HOME e ao abrir a Pokedex ou as
   Conquistas. Quem voltasse antes de a gravacao propagar tinha a marca ZERADA, e o anuncio
   reabria. Reproduzido antes do conserto.

   ⚠️ ELE E O ULTIMO BLOCO DO ARQUIVO porque e o unico ASYNC: o rodape (a contagem e o exit) vive
   DENTRO dele, senao o process.exit sincrono correria antes do await e este caso nao contaria.
   ============================================================================ */

/* ============================================================================
   O CACHE DO RANKING TEM IDADE (21/09/2026, reportado: *"os rankings que existem nos jogos das
   ilhas laranja nao estao sendo atualizados em tempo real, ta precisando fechar o jogo e abrir de
   novo pra atualizar"*)

   ⚠️ ELE VALIA PRA SEMPRE DENTRO DA SESSAO. A guarda era `if(lista) return`, e a unica coisa que
   a invalidava era EU bater MEU recorde -- entao um recorde de OUTRO jogador so chegava depois de
   recarregar a pagina, que e o que zera o modulo. Reproduzido nos TRES antes do conserto.

   ⚠️ E A TRAVA COBRE OS QUATRO NUM LACO SO: a regra e a mesma, e escrita em cada teste de jogo
   uma ficaria pra tras no primeiro ajuste -- que e como o defeito nasceu (caches iguais, cada um
   com a sua invalidacao).
   ============================================================================ */
async function blocoDoRanking(){
  console.log('');
  console.log('=== O RANKING NAO FICA CONGELADO NA SESSAO ===');

  const RANKS = [
    { nome: 'pescaria', rank: () => S.pescariaRank, ler: (f) => S.pescariaCarregarRank(f),
      abrir: () => S.abrirPescaria(), tela: 'pescaria', temLista: (r) => !!r.lista },
    { nome: 'corrida',  rank: () => S.corridaRank,  ler: (f) => S.corridaCarregarRank(f),
      abrir: () => S.abrirCorrida(),  tela: 'corrida',  temLista: (r) => !!r.single },
    { nome: 'resgate',  rank: () => S.resgateRank,  ler: (f) => S.resgateCarregarRank(f),
      abrir: () => S.abrirResgate(),  tela: 'resgate',  temLista: (r) => !!r.lista },
    { nome: 'selecao',  rank: () => S.selecaoRank,  ler: () => S.selecaoCarregarRank(),
      abrir: () => S.abrirSelecao(),  tela: 'selecao',  temLista: (r) => !!r.lista },
  ];

  /* um servidor de mentira que conta os pedidos e muda de resposta quando mandarem */
  let pedidos = 0, topo = 'Ana';
  const originalFC = S.functionsClient;
  S.functionsClient = { httpsCallable(){ return () => {
    pedidos++;
    const l = { nome: topo, pontos: 9, tempo: 1.5, partidas: 1, vitorias: 1, aproveitamento: 1 };
    return Promise.resolve({ data: { lista: [l], meu: null, top: [l],
      single: { lista: [l], meu: null }, relay: { lista: [], meu: null } } });
  }; } };
  const esperar = () => new Promise(r => setImmediate(() => setImmediate(r)));
  /* o relogio anda na mao: e o que faz a validade de 30s ser medivel */
  const relogioReal = Date.now;
  let agora = relogioReal();
  Date.now = () => agora;

  ok('a validade mora numa constante', typeof S.RANK_VALIDADE_MS === 'number' && S.RANK_VALIDADE_MS > 0,
     String(S.RANK_VALIDADE_MS));

  for(const r of RANKS){
    contaAdmin(); g.authUser = { uid: 'u1' };
    pedidos = 0; topo = 'Ana';
    const est = r.rank();
    est.lidoEm = 0; est.lista = null; est.single = null; est.relay = null;

    /* 1) a primeira leitura pede */
    g.screen = r.tela;
    r.ler(false); await esperar();
    ok(r.nome + ': a primeira leitura pede ao servidor', pedidos === 1, pedidos + ' pedido(s)');
    ok('  e a idade fica carimbada', !!est.lidoEm, String(est.lidoEm));

    /* 2) DENTRO do prazo, nao pede de novo -- senao cada toque na tela custa uma chamada */
    r.ler(false); await esperar();
    r.ler(false); await esperar();
    ok('  e dentro do prazo ele NAO repete', pedidos === 1, pedidos + ' pedido(s)');

    /* 3) PASSADO o prazo, ele rele sozinho */
    agora += S.RANK_VALIDADE_MS + 1000;
    r.ler(false); await esperar();
    ok('  e passado o prazo ele rele', pedidos === 2, pedidos + ' pedido(s)');

    /* 4) ⚠️ O CASO DO RELATO: outro jogador bate o recorde e o jogador SAI E VOLTA ao modo -- sem
       fechar o app. Antes do conserto a tela seguia no dado velho. */
    topo = 'Bruno';
    g.screen = 'saveSelect';
    r.abrir();
    g.screen = r.tela;
    r.ler(false); await esperar();
    const visto = JSON.stringify(est.lista || est.single || {});
    ok('  e ENTRAR NO MODO rele (o caso do relato)', visto.indexOf('Bruno') >= 0, visto.slice(0, 60));

    /* 5) ⚠️ INVALIDAR ZERA A IDADE, NAO A LISTA: apagando a lista, a caixa pisca vazia a cada
       abertura enquanto o novo nao chega. */
    S.rankInvalidar(est);
    ok('  e invalidar nao apaga o que esta na tela', r.temLista(est), 'a lista sumiu');
    ok('    mas marca como vencido', S.rankVencido(est));
  }

  Date.now = relogioReal;
  S.functionsClient = originalFC;

  /* ⚠️ E TODA PARTIDA INVALIDA, nao so a que bate recorde: minha POSICAO muda quando outro joga,
     mesmo sem eu melhorar nada. Lido do codigo, porque o caminho passa por uma callable de envio
     que o caso de comportamento teria que dublar inteira. */
  const envios = [
    ['pescaria', 'async function pescariaEnviarRank', 'function pescariaZerar'],
    ['corrida',  'async function corridaEnviarRank',  'const corridaTempoTxt'],
    ['resgate',  'async function resgateEnviarRank',  'function resgateRankHtml'],
    ['selecao',  'function selecaoEnviarResultado',   'function selecaoLinhaRankHtml'],
  ];
  for(const [nome, de, ate] of envios){
    const i = src.indexOf(de), j = src.indexOf(ate, i);
    const corpo = (i >= 0 && j > i) ? src.slice(i, j) : '';
    ok(nome + ': o envio invalida o ranking', corpo.length > 40 && /rankInvalidar\(/.test(corpo),
       corpo.length ? 'sem o rankInvalidar' : 'nao achei o corpo do envio');
    ok('  e NAO so quando bate recorde',
       corpo.length > 40 && !/if\s*\(\w+Rank\.recorde\)\s*\w+Rank\.(lista|single)\s*=\s*null/.test(corpo),
       'a invalidacao voltou a depender do recorde');
  }
}

console.log('');
console.log('=== O ANUNCIO APARECE UMA VEZ SO ===');

/* ============================================================================
   A TRAVESSIA PELAS ILHAS LARANJA, A PARTIR DA JORNADA (21/09/2026)

   ⚠️ O QUE ESTE BLOCO EXISTE PRA PEGAR, em ordem:
     1. **fora da visita nada muda** -- é a promessa que justifica o contexto ter sido escolhido em
        vez de copiar os 6.363 linhas dos cinco jogos. As quatro portas de time respondem
        exatamente o que respondiam;
     2. a PORTA: sem `admin`, sem time cheio ou sem surfista ela não existe -- e quem recusa é a
        AÇÃO, não o card apagado;
     3. as QUATRO restrições, uma por jogo, cada uma com a sua regra;
     4. as 2 chances e o prêmio pago UMA vez.
   ============================================================================ */
function blocoDaTravessia(){
  console.log('\n=== A TRAVESSIA PELA JORNADA ===');
  /* ⚠️ O TIME SAI DO `createInstance`, e não de um objeto montado à mão: a tela de FIM da jornada
     desenha os TIPOS de cada um (`typesHtml(p.types)`), e um fixture sem `types` estoura ali --
     ou seja a trava morreria em vez de falhar, que é pior. */
  const timeDe = (n, comSurf) => Array.from({ length: n }, (_, i) => {
    const p = S.createInstance(['venusaur','jolteon','snorlax','lapras','gengar','onix'][i], 40 + i);
    p.id = 'm' + i;
    p.ataques = (comSurf && i === 3) ? ['surf','icebeam'] : ['tackle'];
    return p;
  });
  /* ⚠️ O FIXTURE PRECISA DE SAVES CAMPEÕES, senão o `towerEligiblePokemon` devolve ZERO e as
     quatro travas de restrição não distinguem nada -- foi assim que três delas passaram em branco
     na conferência de acusação. Com dois saves de 6, fora da visita são 12 e dentro são 6. */
  const saveDe = (nome, n) => ({ team: Array.from({length:n}, (_,i) => ({
      id: nome + i, speciesId: ['pidgeot','machamp','alakazam','golem','blastoise','arcanine'][i],
      level: 60 + i, ataques: ['tackle'] })), badgeCount: 8, customName: nome });
  const zerar = () => {
    g.saveSlots = [saveDe('A', 6), saveDe('B', 6)];
    g.aposentados = [];
    g.ilhasJornada = null; g.ilhasResultado = null;
    g.ehAdmin = true; g.currentSaveSlot = 0; g.saveGen = 0; g.gymIndex = 3;
    g.team = timeDe(6, true);
  };

  /* ---------------------------------------------------------------- 1) FORA DA VISITA NADA MUDA */
  zerar();
  const antesCorrida = S.corridaElegiveis().length;
  const antesArena   = S.queimadaElegiveis().length;
  const antesResgate = S.resgateElegiveis().length;
  const antesPesca   = S.pescariaElegiveis().length;
  ok('(a trava tem o que comparar)', antesCorrida + antesArena >= 0, 'corrida=' + antesCorrida);
  ok('fora da visita o contexto é nulo', !S.naJornadaDasIlhas());

  /* ---------------------------------------------------------------- 2) A PORTA */
  /* ⚠️ A TRAVESSIA SAIU DA JORNADA EM 23/09/2026 (a pedido: *"tire o acesso a ilhas laranjas
     durante a jornada, como opção de terceira rota. Faça com que ela apareça sempre na mesma tela
     que aparece para enfrentar a Elite 4, no fim da jornada"*).

     ⚠️ E ESTAS TRAVAS NÃO FORAM APAGADAS: elas viraram a trava da regra NOVA. Sem elas, alguém
     reintroduz a carta no `cartasDeRota` e a rota volta ao meio da jornada SEM NINGUÉM VER -- é a
     mesma decisão das que viraram do avesso quando as Ilhas abriram pra todo mundo. */
  const varreCarta = () => { let n = 0;
    for(let slot = 0; slot < 20; slot++) for(let gen = 0; gen < 20; gen++){
      g.currentSaveSlot = slot; g.saveGen = gen; g.ilhasTrecho = null;
      for(let l = 0; l < 8; l++) if(S.cartasDeRota(l).indexOf(S.ROTA_DAS_ILHAS.id) >= 0) n++; }
    g.currentSaveSlot = 0; g.saveGen = 0; g.ilhasTrecho = null; return n; };
  /* ⚠️ VARRENDO, e não um trecho de um save: a primeira versão desta família testava só o trecho 3
     do slot 0, cujo dado JÁ dava não -- ela passava em branco com a guarda removida. É a terceira
     vez que a amostra única engana nesta feature. */
  g.team = timeDe(6, true);
  ok('a carta das Ilhas não sai em trecho NENHUM', varreCarta() === 0,
     '1.280 trechos varridos (20 slots x 20 gerações x 8)');
  /* ⚠️ E AS OUTRAS DUAS CONTINUAM SAINDO: sem este caso, uma guarda que matasse as TRÊS passaria
     na linha acima -- zero é zero, e a mata e a montanha não foram tocadas. */
  let outras = 0;
  for(let slot = 0; slot < 20; slot++) for(let gen = 0; gen < 20; gen++){
    g.currentSaveSlot = slot; g.saveGen = gen;
    for(let l = 0; l < 8; l++) if(S.temRotaDoCorte(l) || S.montanhaSaiNoTrecho(l)) outras++;
  }
  g.currentSaveSlot = 0; g.saveGen = 0;
  ok('  e a mata e a montanha continuam saindo', outras > 100, outras + ' trechos');
  /* ⚠️ E O SORTEIO MORREU DE VEZ: a função, a chance e o mínimo de time saíram junto. Letra morta
     que fica é o que faz alguém achar que a regra ainda existe. */
  ok('  e o sorteio da carta não existe mais',
     typeof S.ilhasSaemNoTrecho === 'undefined' && typeof S.CHANCE_ILHAS === 'undefined',
     typeof S.ilhasSaemNoTrecho + ' / ' + typeof S.CHANCE_ILHAS);
  /* ⚠️ MAS A ROTA E A CHAVE FICAM DE PÉ: save parado na tela de escolha COM a carta na mão
     continua com ela funcionando. Tirar as duas deixaria aquele card clicável levando a lugar
     nenhum -- e é a mesma razão pela qual log velho nunca some deste jogo. */
  ok('  mas a rota e a chave do Surf continuam existindo (save antigo com a carta na mão)',
     !!S.ROTA_DAS_ILHAS && !!S.ROTAS_DE_CHAVE.surf, JSON.stringify(Object.keys(S.ROTAS_DE_CHAVE)));

  /* --------- A PORTA NOVA: a tela de fim da jornada --------- */
  const semIlhas = () => { g.ilhasFeita = false; g.ilhasAviso = null; g.ilhasJornada = null; };
  g.badgesEarned = ['Pedra','Cascata','Trovão','Arco-Íris','Alma','Pântano','Vulcão','Terra'];
  g.team = timeDe(6, true); semIlhas();
  const telaFim = () => { g.screen = 'journeyEnd'; return S.renderJourneyEnd(); };
  ok('a caixa das Ilhas está na tela de fim da jornada', /Ilhas Laranja/.test(telaFim()));
  ok('  com o botão de atravessar', /pedirIlhasDaJornada\(\)/.test(telaFim()));
  /* ⚠️ ELA FICA AO LADO DA CAIXA DA ELITE, que é o que o pedido diz (*"na mesma tela que aparece
     para enfrentar a Elite 4"*) -- e por isso ela depende das 8 insígnias, como a de lá. */
  const antesB = g.badgesEarned;
  g.badgesEarned = ['Pedra'];
  ok('  e NÃO aparece sem as 8 insígnias', !/pedirIlhasDaJornada/.test(telaFim()));
  g.badgesEarned = antesB;

  /* --------- ⚠️ ELA NÃO DEPENDE DA ELITE 4, E ISSO É PEDIDO --------- */
  /* ⚠️ A CONDIÇÃO É *AS 8 INSÍGNIAS*, nunca o `eliteStatus`: o jogador atravessa a qualquer momento
     depois de fechar os ginásios -- antes de enfrentar a Elite, no meio dela, campeão ou derrotado.
     A caixa das Ilhas divide a tela com a da Elite, e as duas são coisas independentes.
     ⚠️ E O CONTROLE É A CAIXA DE APOSENTAR, que fica na MESMA tela e SÓ aparece com a Elite
     resolvida: sem ele, um fixture em que os quatro estados não mudassem nada passaria aqui e a
     trava não estaria medindo nada -- é a lição do fixture que não distingue os dois lados. */
  {
    const antesE = g.eliteStatus;
    const ESTADOS = [null, 'inProgress', 'champion', 'defeated'];
    let comCaixa = 0, comBotao = 0, comAposentar = 0, entrou = 0;
    ESTADOS.forEach(st => {
      g.eliteStatus = st; semIlhas();
      const h = telaFim();
      if(/Ilhas Laranja/.test(h)) comCaixa++;
      if(h.indexOf('pedirIlhasDaJornada()') >= 0) comBotao++;
      if(/[Aa]posentar/.test(h)) comAposentar++;
      /* e a AÇÃO também: o botão é apresentação, e quem entra de verdade é ela */
      g.team = timeDe(6, true); semIlhas();
      S.pedirIlhasDaJornada();
      if(g.screen === 'ilhas' && !!g.ilhasJornada) entrou++;
      g.screen = 'journeyEnd';
    });
    ok('a caixa das Ilhas vale nos QUATRO estados da Elite', comCaixa === 4,
       comCaixa + ' de 4 (' + ESTADOS.map(String).join(', ') + ')');
    ok('  com o botão nos quatro', comBotao === 4, comBotao + ' de 4');
    ok('  e a AÇÃO entra nos quatro', entrou === 4, entrou + ' de 4');
    /* ⚠️ O CONTROLE: o APOSENTAR é da MESMA tela e SÓ vale com a Elite resolvida (2 de 4). Se ele
       der 4 ou 0, o fixture parou de distinguir os estados e as três travas acima viram enfeite. */
    ok('  e o controle distingue: o APOSENTAR só vale com a Elite resolvida', comAposentar === 2,
       comAposentar + ' de 4 (champion e defeated)');
    /* ⚠️ E O ÚNICO BLOQUEIO É O `ilhasFeita`, nunca a Elite -- é a matriz dos dois campos, e ela
       responde o caso que foi perguntado duas vezes: *"mesmo se ele tiver vencido a elite 4 mas não
       tenha jogado o desafio da ilha laranja, ele pode"*. Sem o segundo eixo, uma guarda que
       amarrasse a travessia à Elite E outra que a amarrasse ao `ilhasFeita` se confundiriam. */
    let pode = 0, bloqueou = 0;
    ESTADOS.forEach(st => {
      g.eliteStatus = st;
      semIlhas();
      if(telaFim().indexOf('pedirIlhasDaJornada()') >= 0) pode++;
      semIlhas(); g.ilhasFeita = true;
      if(telaFim().indexOf('pedirIlhasDaJornada()') < 0) bloqueou++;
    });
    ok('  quem NÃO atravessou pode, nos quatro (o campeão inclusive)', pode === 4, pode + ' de 4');
    ok('  e quem JÁ atravessou não, nos quatro', bloqueou === 4, bloqueou + ' de 4');
    /* ⚠️ E TERMINAR A ELITE VOLTA PRO `journeyEnd`, que é onde a caixa está: campeão e derrotado
       caem lá (só quem está NO MEIO dela vai pro `eliteHeal`). Sem isso o campeão nunca
       reencontraria a tela -- a caixa existiria e seria inalcançável. */
    ok('  e terminar a Elite volta pro journeyEnd (campeão e derrotado)',
       /game\.screen = \(game\.eliteStatus==='inProgress'\) \? 'eliteHeal' : 'journeyEnd'/.test(src));
    g.eliteStatus = antesE; semIlhas();
    g.team = timeDe(6, true);
  }


  /* --------- OS TRÊS CAMINHOS DA AÇÃO --------- */
  /* ⚠️ QUEM VALIDA É A AÇÃO: o botão é apresentação, e um toque forjado no console não pode
     atravessar sem ninguém que nade. */
  g.team = timeDe(6, false); g.hms = []; semIlhas();
  S.pedirIlhasDaJornada();
  ok('sem Surf e sem o HM03, a ação NÃO entra', g.screen !== 'ilhas' && !g.ilhasJornada, g.screen);
  ok('  e o aviso é o de como CONSEGUIR o HM03', g.ilhasAviso === 'semHm', String(g.ilhasAviso));
  /* ⚠️ AS DUAS FRASES SÃO AS PEDIDAS, palavra por palavra: elas foram ditadas no pedido, e é a
     mesma razão pela qual as frases dos golpes especiais são trancadas assim. */
  ok('  com a frase pedida',
     S.ilhasAvisoHtml().indexOf('É necessário que algum Pokemon do seu time saiba o movimento Surf(HM03). Para obte-lo, tenha todos os pokemons da Zona Safári na Pokedex.') > 0,
     (S.ilhasAvisoHtml().match(/<p>([^<]*)/) || [])[1]);
  ok('  e ela NÃO oferece ensinar (ele não tem a Máquina)',
     !/ensinarSurfDaJornada/.test(S.ilhasAvisoHtml()));

  g.hms = ['hm03']; semIlhas();
  S.pedirIlhasDaJornada();
  ok('com o HM03 e sem Surf, a ação NÃO entra', g.screen !== 'ilhas' && !g.ilhasJornada, g.screen);
  ok('  e o aviso é o de ENSINAR', g.ilhasAviso === 'ensinar', String(g.ilhasAviso));
  ok('  com a frase pedida',
     S.ilhasAvisoHtml().indexOf('É necessário que algum Pokemon do seu time saiba o movimento Surf(HM03). Ensinar o Surf para seu time atual?') > 0,
     (S.ilhasAvisoHtml().match(/<p>([^<]*)/) || [])[1]);
  ok('  e ela oferece ensinar', /ensinarSurfDaJornada\(\)/.test(S.ilhasAvisoHtml()));
  /* ⚠️ E QUEM TEM A MÁQUINA MAS NENHUM CANDIDATO NO TIME não recebe a pergunta: o HM03 na conta
     não garante que ALGUM dos seis aprende Surf, e um botão que abre uma lista vazia é pior que
     botão nenhum. É o único ramo desta tela que a medição no navegador não alcançou. */
  {
    /* ⚠️ E O SAVE ORIGINAL É GUARDADO, nunca reconstruído: a primeira versão o remontava com o
       time da jornada dentro, e isso derrubou a trava do RESGATE lá embaixo -- que conta os
       surfistas dos SAVES. Trava que deixa rastro derruba a vizinha. */
    const antes = g.team, antesSv = g.saveSlots[0];
    g.team = [S.createInstance('gengar', 50), S.createInstance('onix', 50)];
    g.saveSlots[0] = { team: g.team, badgeCount: 8, customName: 'A' };
    ok('    mas sem ninguém que APRENDA, ela não oferece',
       S.ilhasAvisoHtml().indexOf('ensinarSurfDaJornada') < 0 && S.ilhasAvisoHtml().indexOf('Nenhum dos seis aprende Surf') > 0);
    g.team = antes; g.saveSlots[0] = antesSv;
  }
  /* ⚠️ E O ATALHO É O `ensinarMaquinaNesteTime`, que já fixa o time ABERTO: o pedido diz *"ensinar
     o Surf para seu time atual"*, e o `abrirEnsinarHm` cru cairia na lista de TIMES -- uma
     pergunta cuja resposta já está na tela. */
  ok('    pelo atalho do time ABERTO, não pela lista de times',
     /function ensinarSurfDaJornada\(\)\{[\s\S]{0,600}ensinarMaquinaNesteTime\('hm03'\)/.test(src));

  g.team = timeDe(6, true); semIlhas();
  S.pedirIlhasDaJornada();
  ok('COM Surf no time, ela entra', g.screen === 'ilhas' && !!g.ilhasJornada, g.screen);
  /* ⚠️ E A VOLTA É GRAVADA: pela porta nova o jogador volta pro `journeyEnd`, e pela CARTA (que
     save antigo ainda pode ter) ele segue pro encontro selvagem. Sem o campo, quem entra pelo fim
     cairia num encontro selvagem que aquela tela não tem. */
  ok('  e ela guarda pra onde voltar', (g.ilhasJornada || {}).volta === 'journeyEnd',
     String((g.ilhasJornada || {}).volta));

  /* --------- UMA VEZ POR JORNADA --------- */
  /* ⚠️ PELA CARTA a regra vinha de graça (a carta sumia do trecho); no FIM da jornada a tela fica
     lá pra sempre, e sem a marca o prêmio de +3 níveis sairia de novo a cada visita, sem teto. */
  S.sairDasIlhas();
  ok('sair da travessia marca a jornada', g.ilhasFeita === true);
  g.screen = 'journeyEnd';
  ok('  e a caixa passa a dizer que já foi', /não abre duas vezes/.test(telaFim()));
  ok('  e o botão some', !/pedirIlhasDaJornada/.test(telaFim()));
  S.pedirIlhasDaJornada();
  ok('  e a AÇÃO recusa a segunda vez', g.screen !== 'ilhas' && !g.ilhasJornada, g.screen);
  /* ⚠️ A MARCA FAZ A IDA E A VOLTA DO SAVE: o `applySavedState` é explícito campo a campo, e um
     campo que sai e não volta se perde num F5 -- foi o que aconteceu com o `ilhasJornada` até
     22/09, e ali o custo era a travessia inteira. Aqui seria o prêmio saindo de novo. */
  {
    const doc = S.serializeGame();
    ok('  e ela vai pro save', doc.ilhasFeita === true, JSON.stringify(doc.ilhasFeita));
    g.ilhasFeita = false;
    S.applySavedState(doc);
    ok('    e VOLTA dele', S.__getGame().ilhasFeita === true);
  }
  semIlhas();
  /* ⚠️ O MODAL É ANEXADO PELO RENDER PRINCIPAL, e isso se prova LENDO O CÓDIGO: os casos acima
     chamam o `ilhasAvisoHtml` direto, e passariam com a chamada órfã -- foi exatamente o que a
     conferência de acusação mostrou. É a mesma trava que a caixa do especial e o `hmGanhoModal`
     já têm, e ela existe porque um modal que nunca é desenhado não dá erro nenhum. */
  ok('  e o modal é anexado pelo render principal',
     src.indexOf('if(game.ilhasAviso){ html += ilhasAvisoHtml(); }') > 0);

  /* ---------------------------------------------------------------- 3) A CHAVE */
  g.currentSaveSlot = 0; g.saveGen = 0;
  ok('o surfista do time é quem tem o Surf', (S.surfistaDoTime() || {}).speciesId === 'lapras');
  g.team = timeDe(6, false);
  ok('  e sem ninguém que surfe não há chave', !S.podeSurfar());
  /* ⚠️ QUEM RECUSA É A AÇÃO: um clique forjado no console não pode abrir a rota */
  S.entrarNasIlhasDaJornada();
  ok('  a AÇÃO recusa a entrada sem surfista', !S.naJornadaDasIlhas());
  g.team = timeDe(6, true);

  /* a tabela das três chaves -- e as duas antigas não podem ter mudado de Máquina */
  ok('a mata continua pedindo o HM01', S.chaveDaRota(S.routeById('mata_fechada')).hm === 'HM01');
  ok('  a montanha o HM02', S.chaveDaRota(S.routeById('montanha_sagrada')).hm === 'HM02');
  ok('  e as ilhas o HM03', S.chaveDaRota(S.routeById('ilhas_laranja')).hm === 'HM03');
  ok('  e rota comum não tem chave', S.chaveDaRota({ id: 'x' }) === null);

  /* ---------------------------------------------------------------- 4) A VISITA */
  S.entrarNasIlhasDaJornada();
  ok('entrar marca a visita', S.naJornadaDasIlhas() && g.screen === 'ilhas');
  /* ⚠️ O SURFISTA É GUARDADO porque o Resgate vai EXIGI-LO do outro lado */
  ok('  e guarda QUEM abriu o caminho', g.ilhasJornada.surfista.speciesId === 'lapras'
     && g.ilhasJornada.surfista.idx === 3);
  ok('  o checklist começa vazio', S.ilhasVencidas() === 0 && !S.ilhasFechouTudo());
  S.ILHAS_LARANJA.forEach(i => ok('  ' + i.id + ' começa aberta', S.estadoDaIlha(i.id) === 'aberto'));

  /* ---------------------------------------------------------------- 5) AS QUATRO RESTRIÇÕES */
  /* ⚠️ A TRAVA SÓ DISTINGUE OS DOIS LADOS SE ELES DIFEREM: com o save de teste devolvendo os
     mesmos 6 do time da jornada, ela passava em branco com a restrição removida. Aqui o
     `towerEligiblePokemon` tem que ter MAIS gente que o time. */
  ok('(o fixture tem mais pokémon fora da jornada que dentro)',
     antesCorrida > 6, antesCorrida + ' elegíveis fora contra 6 no time');
  const naVisita = { corrida: S.corridaElegiveis(), arena: S.queimadaElegiveis(),
                     resgate: S.resgateElegiveis(), pesca: S.pescariaElegiveis() };
  ok('a Corrida passa a ver só o time da jornada', naVisita.corrida.length === 6,
     naVisita.corrida.length + ' (fora da visita eram ' + antesCorrida + ')');
  ok('  e a Arena também', naVisita.arena.length === 6, naVisita.arena.length + '');
  /* ⚠️ O RESGATE É UM SÓ, e não a lista de surfistas: quem abriu o caminho foi UM pokémon */
  ok('o Resgate é obrigado a levar QUEM ABRIU o caminho', naVisita.resgate.length === 1,
     naVisita.resgate.length + ' candidatos');
  ok('  e ele é o surfista', (naVisita.resgate[0] || {}).speciesId === 'lapras');
  ok('a Pescaria fica no save da jornada', naVisita.pesca.length <= 1, naVisita.pesca.length + ' saves');

  /* ⚠️ E DOIS SURFISTAS NO TIME NÃO DÃO ESCOLHA: o Resgate continua sendo um só */
  const doisQueSurfam = timeDe(6, true);
  doisQueSurfam[0].ataques = ['surf'];
  g.team = doisQueSurfam;
  ok('  mesmo com DOIS surfistas no time', S.resgateElegiveis().length === 1,
     'quem abriu o caminho foi um, e é ele que atravessa');
  g.team = timeDe(6, true);

  /* ---------------------------------------------------------------- 6) AS 2 CHANCES */
  ok('a ilha nasce com ' + S.ILHAS_CHANCES + ' chances', S.tentativasDaIlha('navel') === 0);
  S.registrarResultadoDaIlha('navel', false);
  ok('  perder gasta uma', S.tentativasDaIlha('navel') === 1 && S.estadoDaIlha('navel') === 'aberto');
  S.registrarResultadoDaIlha('navel', false);
  ok('  perder as duas fecha a ilha', S.estadoDaIlha('navel') === 'perdeu');
  S.registrarResultadoDaIlha('navel', true);
  ok('  e depois disso nem vencer conta', S.estadoDaIlha('navel') === 'perdeu' && S.ilhasVencidas() === 0,
     'um toque forjado não pode dar uma terceira tentativa');
  /* ⚠️ E A AÇÃO RECUSA A ILHA SEM CHANCES -- o card apagado é apresentação */
  const telaAntes = g.screen;
  S.entrarNaIlha(1);   /* navel */
  ok('  e a AÇÃO recusa entrar nela', g.screen === telaAntes, 'tela: ' + g.screen);

  /* vencer não gasta a segunda chance, e não conta duas vezes */
  S.registrarResultadoDaIlha('trovita', true);
  ok('vencer credita a ilha', S.estadoDaIlha('trovita') === 'venceu' && S.ilhasVencidas() === 1);
  S.registrarResultadoDaIlha('trovita', true);
  ok('  e vencer de novo não conta duas', S.ilhasVencidas() === 1);

  /* ---------------------------------------------------------------- 7) O PRÊMIO */
  ['mikan','kumquat','pummelo'].forEach(id => S.registrarResultadoDaIlha(id, true));
  ok('quatro de cinco ainda não fecha', !S.ilhasFechouTudo(), S.ilhasVencidas() + ' de ' + S.ilhasComJogo().length);
  /* a navel foi perdida: refaço a visita pra fechar as cinco */
  g.ilhasJornada = null;
  S.entrarNasIlhasDaJornada();
  S.ILHAS_LARANJA.forEach(i => S.registrarResultadoDaIlha(i.id, true));
  ok('as cinco fecham a travessia', S.ilhasFechouTudo());

  const niveisAntes = g.team.map(p => p.level);
  S.sairDasIlhas();
  ok('  e sair paga o prêmio', g.team.every((p, i) => p.level === niveisAntes[i] + S.ILHAS_PREMIO_NIVEIS),
     'de [' + niveisAntes.join(',') + '] para [' + g.team.map(p => p.level).join(',') + ']');
  ok('  a tela de fecho anuncia', g.screen === 'ilhasFim' && g.ilhasResultado.niveis === S.ILHAS_PREMIO_NIVEIS,
     '+3 no time inteiro é a maior recompensa da jornada fora do Bônus de Kanto -- pagá-la em '
   + 'silêncio seria o erro da especialidade que valia 1% e não tinha selo');
  ok('  e a visita ENCERRA', !S.naJornadaDasIlhas());

  /* ⚠️ O PRÊMIO NÃO REPETE, e quem impede é o CONTEXTO ter sido anulado -- a trava mede o
     MECANISMO: com a visita de pé de novo (o caso em que um `sairDasIlhas` extra poderia
     pagar), ele só paga se as cinco estiverem vencidas ALI. */
  const depoisDoPremio = g.team.map(p => p.level);
  S.sairDasIlhas();
  ok('  e ele não é pago duas vezes', g.team.every((p, i) => p.level === depoisDoPremio[i]),
     'a visita foi encerrada: não há o que pagar');
  /* e uma visita NOVA, sem vencer nada, tampouco paga */
  S.entrarNasIlhasDaJornada();
  S.sairDasIlhas();
  ok('  nem numa visita nova sem vitórias', g.team.every((p, i) => p.level === depoisDoPremio[i]));

  /* perder tudo não paga nada */
  g.team = timeDe(6, true);
  S.entrarNasIlhasDaJornada();
  S.ILHAS_LARANJA.forEach(i => { S.registrarResultadoDaIlha(i.id, false); S.registrarResultadoDaIlha(i.id, false); });
  const antesDeFalhar = g.team.map(p => p.level);
  S.sairDasIlhas();
  ok('perder tudo não paga nível nenhum', g.team.every((p, i) => p.level === antesDeFalhar[i])
     && g.ilhasResultado.niveis === 0);

  /* ---------------------------------------------------------------- 8) VOLTOU AO NORMAL */
  g.ilhasJornada = null;
  ok('fora da visita a Corrida volta ao que era', S.corridaElegiveis().length === antesCorrida);
  ok('  a Arena também', S.queimadaElegiveis().length === antesArena);
  ok('  o Resgate também', S.resgateElegiveis().length === antesResgate);
  ok('  e a Pescaria também', S.pescariaElegiveis().length === antesPesca);
  /* ⚠️ E O REGISTRO É INOFENSIVO FORA DA VISITA -- os cinco jogos abertos pela HOME passam por ele */
  S.registrarResultadoDaIlha('navel', true);
  ok('  e o registro não faz nada fora dela', !S.naJornadaDasIlhas());

  /* ---------------------------------------------------------------- 9) O CHECKLIST NA TELA */
  ok('pela home não há checklist', S.ilhasChecklistHtml() === '');
  g.team = timeDe(6, true);
  S.entrarNasIlhasDaJornada();
  S.registrarResultadoDaIlha('mikan', true);
  S.registrarResultadoDaIlha('navel', false);
  const chk = S.ilhasChecklistHtml();
  ok('na visita ele existe', chk.indexOf('ilhas-chk') >= 0);
  S.ilhasComJogo().forEach(i => ok('  com a ' + i.nome, chk.indexOf(i.nome) >= 0));
  ok('  a vencida sai marcada', /ilhas-chk-linha venceu/.test(chk));
  ok('  e a que perdeu uma diz quantas sobram', chk.indexOf('resta 1 chance') >= 0, 'sobra 1 de ' + S.ILHAS_CHANCES);
  ok('  e ele anuncia o prêmio ANTES', chk.indexOf('+' + S.ILHAS_PREMIO_NIVEIS + ' níveis') >= 0,
     'sem saber dele o jogador não tem por que insistir numa ilha difícil');
  const tela = S.renderIlhas();
  ok('  e a tela das ilhas o desenha', tela.indexOf('ilhas-chk') >= 0);
  ok('  com o Voltar dizendo que ENCERRA', tela.indexOf('Encerrar a travessia') >= 0,
     'um "Voltar" seco pareceria que dá pra sair e voltar depois');
  g.ilhasJornada = null;
  ok('  e pela home ele volta a ser "Voltar"', S.renderIlhas().indexOf('⬅ Voltar') >= 0);

  /* ---------------------------------------------------------------- 10) O SAVE */
  g.team = timeDe(6, true);
  S.entrarNasIlhasDaJornada();
  S.registrarResultadoDaIlha('mikan', true);
  const salvo = S.serializeGame();
  ok('a visita vai pro SAVE', !!salvo.ilhasJornada && (salvo.ilhasJornada.vencidas || []).indexOf('mikan') >= 0,
     'ela tem cinco partidas dentro e um prêmio no fim -- fechar a aba no meio não pode perder isso');
  ok('  e as duas telas são ponto seguro de gravação',
     S.SAFE_SAVE_SCREENS.has('ilhas') && S.SAFE_SAVE_SCREENS.has('ilhasFim'));

  /* ⚠️ E ELA VOLTA DO SAVE -- a metade que faltava, e ela pegou um defeito de verdade: o
     `ilhasJornada` era GRAVADO e nunca LIDO DE VOLTA, porque o `applySavedState` é explícito campo
     a campo e não um `Object.assign`. Um F5 no meio da travessia apagava a visita, e as quatro
     portas de time voltavam a responder como se o jogador estivesse na HOME.
     A trava anterior olhava só o `serializeGame`: ela provava que o campo SAI, nunca que ele VOLTA.
     **Trava de save tem que fazer a IDA E A VOLTA.** */
  g.ilhasJornada = null; g.ilhasTrecho = null;
  S.applySavedState(JSON.parse(JSON.stringify(salvo)));
  ok('  e ela VOLTA do save', S.naJornadaDasIlhas() &&
     (S.ilhasDaJornada().vencidas || []).indexOf('mikan') >= 0,
     'um F5 no meio da travessia não pode devolver o jogador ao modo da home');
  ok('  com o surfista intacto', (S.ilhasSurfistaDaVisita() || {}).speciesId === 'lapras');

  /* ⚠️ E O TRECHO 0 SOBREVIVE, que é a armadilha do `|| null`: `0 || null` dá NULL, e a travessia
     voltaria a aparecer pra quem a viu no PRIMEIRO trecho. */
  g.ilhasTrecho = 0;
  const s0 = S.serializeGame();
  ok('o trecho 0 sobrevive ao save', s0.ilhasTrecho === 0, String(s0.ilhasTrecho));
  g.ilhasTrecho = null;
  S.applySavedState(JSON.parse(JSON.stringify(s0)));
  ok('  e volta do save como 0', g.ilhasTrecho === 0, String(g.ilhasTrecho));
  ok('  então a travessia não reaparece nos outros trechos',
     [1,2,3,4,5,6,7].every(l => S.cartasDeRota(l).indexOf(S.ROTA_DAS_ILHAS.id) < 0));

  /* save ANTIGO (sem o campo) se comporta como antes: o dado decide */
  const velho = JSON.parse(JSON.stringify(salvo)); delete velho.ilhasTrecho;
  S.applySavedState(velho);
  ok('  e save anterior à regra nasce sem marca', g.ilhasTrecho === null, String(g.ilhasTrecho));


  /* ---------------------------------------------------------------- 11) ⚠️ A TELA GRAVADA
     O DEFEITO DO RELATO (22/09/2026): *"o último save, quando eu clico nele, está entrando
     diretamente nas ilhas laranjas, sendo que nem tinha aparecido pra mim a rota"*.

     Ir pra HOME **não descarrega o save**: o `currentSaveSlot` continua preenchido, então abrir as
     Ilhas pelo botão da home punha `screen:'ilhas'` e o `render()` do `abrirIlhas` disparava o
     autosave -- o save era gravado apontando pra lá, e ao reabri-lo o jogador caía direto nas
     ilhas. Medido no banco: 2 saves t11Presos assim em 177 contas, com o time e as insígnias
     INTACTOS -- o que corrompe é só a tela.

     ⚠️ E A TRAVA COBRA OS DOIS LADOS, porque eles são a mesma pergunta: fechando só a torneira os
     saves já t11Presos continuariam t11Presos; consertando só a leitura, o save continuaria sendo
     gravado errado toda vez que o jogador passasse pelas ilhas. */
  zerar();

  /* o caminho do relato, de ponta a ponta: save carregado -> home -> botão das Ilhas */
  /* ⚠️ MEDIDO PELO AUTOSAVE DE VERDADE, e não pela guarda: a primeira versão desta trava chamava
     o `podeGravarNaTela()` direto -- e religando o `maybeAutoSave` pro `SAFE_SAVE_SCREENS` cru a
     função continuava certa e ela passava EM BRANCO. Trava que pergunta à função que ela mede não
     é trava. O observável é o TIMER: a guarda de entrada é síncrona, então barrada ela não chega
     a armar o debounce. */
  g.authUser = { uid:'u1' }; g.currentSaveSlot = 0;
  const armados = () => S.__timers.length;
  g.screen = 'saveSelect';
  S.abrirIlhas();
  const t0 = armados(); S.maybeAutoSave();
  ok('pela HOME o autosave NÃO grava a tela das ilhas',
     g.screen === 'ilhas' && armados() === t0,
     'era assim que o save era gravado apontando pra cá -- e reabri-lo caía direto nas ilhas');

  /* e pela JORNADA ela é: a visita tem cinco partidas dentro e fechar a aba não pode perdê-las */
  zerar();
  S.entrarNasIlhasDaJornada();
  const t1 = armados(); S.maybeAutoSave();
  ok('  mas pela JORNADA ele grava', g.screen === 'ilhas' && armados() > t1,
     'a travessia tem cinco partidas dentro -- um F5 no meio não pode zerá-las');

  /* ⚠️ E O `ilhasFim` PERGUNTA PELO RESULTADO, nunca pela visita: ele acontece DEPOIS de o
     `sairDasIlhas` zerar o `ilhasJornada`, e é exatamente ali que os +3 níveis do prêmio acabaram
     de entrar no time. Pela visita, a guarda barraria a gravação da maior recompensa da jornada
     fora do Bônus de Kanto -- este caso é o que separa as duas leituras. */
  zerar();
  S.entrarNasIlhasDaJornada();
  S.ilhasComJogo().forEach(i => S.registrarResultadoDaIlha(i.id, true));
  const t11Niveis = g.team.map(p => p.level);
  S.sairDasIlhas();
  ok('o prêmio das cinco ilhas entra no time',
     g.team.every((p, i) => p.level === t11Niveis[i] + S.ILHAS_PREMIO_NIVEIS),
     JSON.stringify(g.team.map(p => p.level)));
  const t2 = armados(); S.maybeAutoSave();
  ok('  e a tela do prêmio É gravada',
     g.screen === 'ilhasFim' && !S.naJornadaDasIlhas() && armados() > t2,
     'a visita já foi zerada aqui -- perguntar por ela engoliria os +3 níveis');

  /* e sem resultado nenhum ela não vale: é o mesmo save preso, pela outra tela */
  g.ilhasResultado = null;
  const t3 = armados(); S.maybeAutoSave();
  ok('  e sem resultado ela não é', armados() === t3);

  /* ⚠️ NENHUMA OUTRA TELA MUDOU -- a guarda é das duas das ilhas e de mais nenhuma. Sem esta
     varredura, "barrar tudo" passaria nos casos acima e quebraria a jornada inteira em silêncio. */
  const t11Outras = [...S.SAFE_SAVE_SCREENS].filter(t => t !== 'ilhas' && t !== 'ilhasFim');
  const t11Quebrou = t11Outras.filter(t => { g.screen = t; const n = armados();
                                             S.maybeAutoSave(); return armados() === n; });
  ok('as outras ' + t11Outras.length + ' telas seguras continuam seguras',
     t11Quebrou.length === 0, t11Quebrou.join(','));
  g.screen = 'naoExiste';
  const t4 = armados(); S.maybeAutoSave();
  ok('  e tela desconhecida continua recusada', armados() === t4);

  /* ---- a LEITURA: é ela que solta os dois saves que já estão t11Presos no banco ---- */
  /* ⚠️ O DOCUMENTO É O DO RELATO, campo por campo: `screen:'ilhas'` com a visita NULA e o
     `ilhasTrecho` nulo -- os dois nulos são a prova de que a travessia nunca foi oferecida. */
  /* ⚠️ PELO `applySavedState` DE VERDADE, pelo mesmo motivo do autosave acima: medindo o
     `telaDeVolta` direto, religar a leitura pro `SAFE_SAVE_SCREENS` cru passava em branco. */
  const abrir = doc => { S.applySavedState(JSON.parse(JSON.stringify(doc))); return g.screen; };
  const t11Preso = { screen:'ilhas', ilhasJornada:null, ilhasTrecho:null, gymIndex:5, team:[] };
  ok('o save PRESO cai no fallback ao abrir', abrir(t11Preso) === 'preBattle',
     'devolveu ' + g.screen + ' -- ele se conserta sozinho na primeira abertura');
  /* save anterior à feature nem tem o campo, e é o mesmo caso */
  ok('  e o save sem o campo também', abrir({ screen:'ilhasFim' }) === 'preBattle');
  /* mas quem está MESMO no meio da travessia volta pra lá */
  ok('  e quem está na travessia volta pra ela',
     abrir({ screen:'ilhas', ilhasJornada:{ vencidas:[], tentativas:{} } }) === 'ilhas');
  ok('  e quem parou na tela do prêmio também',
     abrir({ screen:'ilhasFim', ilhasResultado:{ tudo:true, niveis:3 } }) === 'ilhasFim');

  /* ⚠️ E O `ilhasResultado` TINHA O MESMO DEFEITO DO VIZINHO, achado ao escrever esta trava: ele
     era GRAVADO e NUNCA LIDO DE VOLTA -- o `applySavedState` é explícito campo a campo, e quando o
     `ilhasJornada` foi consertado o vizinho ficou pra trás. Quem reabria o save na tela do prêmio
     via o fallback dela (`0 de 5`, nenhum nível) mesmo tendo vencido as cinco.
     **Trava de save tem que fazer a IDA E A VOLTA** -- olhar só o `serializeGame` prova que o
     campo SAI, nunca que ele VOLTA. */
  zerar();
  S.entrarNasIlhasDaJornada();
  S.ilhasComJogo().forEach(i => S.registrarResultadoDaIlha(i.id, true));
  S.sairDasIlhas();
  const t11Premio = JSON.parse(JSON.stringify(S.serializeGame()));
  ok('o resultado do prêmio vai pro save', !!t11Premio.ilhasResultado &&
     t11Premio.ilhasResultado.niveis === S.ILHAS_PREMIO_NIVEIS);
  g.ilhasResultado = null;
  S.applySavedState(t11Premio);
  ok('  e VOLTA do save', !!g.ilhasResultado &&
     g.ilhasResultado.niveis === S.ILHAS_PREMIO_NIVEIS && g.ilhasResultado.tudo === true,
     'sem isso um F5 na tela do prêmio mostrava "0 de ' + S.ilhasComJogo().length + '"');
  ok('  então a tela do prêmio não cai no fallback dela',
     S.renderIlhasFim().indexOf('+' + S.ILHAS_PREMIO_NIVEIS + ' níveis') >= 0);

  g.ilhasJornada = null; g.ilhasResultado = null; g.ilhasTrecho = null;

  /* ---------------------------------------------------------------- 12) ⚠️ O TIME DA TRAVESSIA
     Reportado com print em 22/09/2026: o picker da Pescaria mostrava **`Time [object Object]1`**
     com a estrela em `0`. A causa é que o `pescariaElegiveis` mudava de TIPO -- devolvia o OBJETO
     do save na visita e um SLOT fora dela --, e a lista tem que ter um tipo só.

     ⚠️ E O SINTOMA ERA O MENOR DOS DOIS PROBLEMAS: a AÇÃO fazia `indexOf(Number(slot))` sobre
     objetos, e `Number({})` é NaN -- ou seja **escolher o time era impossível** e a Pescaria estava
     TRAVADA na travessia. O revezamento da Corrida estava travado por outra porta: ele validava
     com `savesCampeoes()`, e o save da jornada pode não ter as 8 insígnias (o do relato tinha 5).

     ⚠️ A TRAVA ANTERIOR NÃO PEGAVA NENHUM DOS DOIS porque ela media a CONTAGEM (`length <= 1`), e
     tanto `[objeto]` quanto `[slot]` têm tamanho 1. Aqui ela mede o TIPO e a USABILIDADE. */
  {
    /* ⚠️ O ESTADO DO RANKING É GUARDADO E REPOSTO: este bloco desenha a tela da Pescaria, e o
       `renderPescaria` PEDE o ranking -- sem repor, o bloco do ranking (que roda depois) via a
       lista já carregada e as travas dele de "a primeira leitura pede ao servidor" caíam sem
       nada estar errado. Trava que deixa rastro derruba a vizinha. */
    const rankAntes = JSON.parse(JSON.stringify(S.pescariaRank));
    /* o save ABERTO é o do relato: no meio da jornada, SEM as 8 insígnias */
    const saveDaJornada = { team: saveDe('A', 6).team, badgeCount: 5, customName: 'Time da jornada' };
    const montar = () => {
      g.saveSlots = [saveDaJornada, saveDe('B', 6)];
      g.aposentados = []; g.ehAdmin = true;
      g.currentSaveSlot = 0; g.saveGen = 0; g.gymIndex = 3;
      g.team = timeDe(6, true);           /* o time VIVO -- espécies diferentes das do saveSlots */
      g.ilhasJornada = null; g.ilhasResultado = null;
      S.pescariaZerar(); S.corridaZerar();
    };

    /* ---- o TIPO: a lista é de SLOTS nos dois modos ---- */
    montar();
    const foraDaVisita = S.pescariaElegiveis();
    ok('fora da visita a lista de times é de NÚMEROS',
       foraDaVisita.length > 0 && foraDaVisita.every(x => typeof x === 'number'),
       JSON.stringify(foraDaVisita));
    S.entrarNasIlhasDaJornada();
    const naVisita = S.pescariaElegiveis();
    ok('  e na travessia TAMBÉM (era o objeto do save)',
       naVisita.length === 1 && typeof naVisita[0] === 'number' && naVisita[0] === 0,
       JSON.stringify(naVisita));

    /* ---- o SINTOMA DO PRINT: o card não pode sair com o objeto no nome nem com média 0 ---- */
    const card = S.pescariaCardDoTime(naVisita[0], false, null);
    ok('  então o card não mostra "[object Object]"', card.indexOf('[object Object]') < 0,
       'era o nome que o jogador viu no print');
    const media = (card.match(/team-avg-star-num">(\d+)</) || [])[1];
    ok('  e a média do time não é zero', Number(media) > 0, 'média no card: ' + media);

    /* ---- e a AÇÃO aceita o slot da jornada: era ela que travava o modo ---- */
    S.pescariaEscolher(naVisita[0]);
    ok('a AÇÃO aceita o time da jornada', S.pescaria.escolhido === 0,
       'escolhido=' + JSON.stringify(S.pescaria.escolhido) + ' -- com a lista de objetos ela recusava');

    /* ⚠️ ---- e o time que vai pescar é o VIVO, não a cópia do `saveSlots` ---- */
    const vivos = S.pescariaTimeDoSlot(0).map(p => p.speciesId);
    ok('  e ele pesca com o time VIVO da jornada',
       vivos[0] === g.team[0].speciesId && vivos.length === g.team.length,
       vivos.join(',') + ' (o saveSlots tem ' + saveDaJornada.team.map(p => p.speciesId).join(',') + ')');

    /* ---- O PEDIDO: pela jornada o time já entra escolhido, e não há o que trocar ---- */
    montar();
    S.entrarNasIlhasDaJornada();
    S.abrirPescaria();
    ok('pela JORNADA o time já entra escolhido', S.pescaria.escolhido === 0,
       'uma tela de uma resposta só é pior que tela nenhuma');
    S.pescaria.picker = false;
    S.pescariaAbrirPicker();
    ok('  e a AÇÃO recusa abrir o picker', S.pescaria.picker === false);
    const telaPesca = S.renderPescaria();
    ok('  e a tela não oferece "Trocar de time"', telaPesca.indexOf('Trocar de time') < 0);
    ok('  mas mostra o card do time', telaPesca.indexOf('save-slot-card') >= 0);

    /* ---- e pela HOME nada muda: ele escolhe, como sempre ---- */
    montar();
    S.abrirPescaria();
    ok('pela HOME ele continua escolhendo', S.pescaria.escolhido === null);
    S.pescariaAbrirPicker();
    ok('  e o picker abre', S.pescaria.picker === true);
    S.pescaria.picker = false;
    S.pescaria.escolhido = 0;
    ok('  e o "Trocar de time" continua lá', S.renderPescaria().indexOf('Trocar de time') >= 0);

    /* ================= A CORRIDA: o revezamento ================= */
    /* ⚠️ O SAVE DA JORNADA NÃO É CAMPEÃO, e era isso que travava o relay: a régua das 8 insígnias
       é pra quem entra pela HOME escolher um time que terminou uma jornada. */
    montar();
    S.entrarNasIlhasDaJornada();
    ok('(o save da jornada NÃO tem as 8 insígnias)', S.savesCampeoes().indexOf(0) < 0,
       'é o caso do relato -- sem isso esta trava não mede nada');

    S.abrirCorrida();
    S.corridaTrocarFormato('relay');
    ok('pela JORNADA a equipe do revezamento já entra montada',
       S.corrida.escolhidos.length === S.CORRIDA_TRECHOS,
       S.corrida.escolhidos.length + ' de ' + S.CORRIDA_TRECHOS);
    ok('  e ela é o time da jornada, na ordem dele',
       S.corrida.escolhidos.every((p, i) => p.speciesId === g.team[i].speciesId),
       S.corrida.escolhidos.map(p => p.speciesId).join(','));
    S.corrida.picker = false;
    S.corridaAbrirPicker();
    ok('  e a AÇÃO recusa abrir o picker de times', S.corrida.picker === false);
    ok('  e a tela não oferece "Escolher equipe"',
       S.renderCorrida().indexOf('corridaAbrirPicker()') < 0);
    /* ⚠️ E A LISTA DO PICKER DE TIMES TAMBÉM É A DA TRAVESSIA, mesmo ele sendo INALCANÇÁVEL ali
       hoje (a ação recusa abrir). Sem esta trava o `corridaPickerDeTimes` podia voltar ao
       `savesCampeoes()` sem nada acusar -- conferido: o defeito religado passava em branco --, e
       ele viraria uma bomba-relógio pro dia em que a guarda do picker mudasse. É a mesma decisão
       da guarda do `registrarSketch`, que vale pro caminho que ainda não existe. */
    S.corrida.picker = true;
    const pickerNaVisita = S.corridaPickerDeTimes();
    ok('  e o picker de times, se aberto, lista SÓ o da jornada',
       (pickerNaVisita.match(/save-slot-card/g) || []).length === 1
       && pickerNaVisita.indexOf('corridaEscolherTime(0)') >= 0,
       (pickerNaVisita.match(/save-slot-card/g) || []).length + ' cards');
    S.corrida.picker = false;

    /* ⚠️ e a AÇÃO aceita o save da jornada -- ela recusava com o `savesCampeoes()` cru */
    S.corrida.escolhidos = [];
    S.corridaEscolherTime(0);
    ok('  e a AÇÃO aceita o time da jornada', S.corrida.escolhidos.length === S.CORRIDA_TRECHOS,
       'com a régua das 8 insígnias ela recusava em silêncio');

    /* ---- a INDIVIDUAL continua pedindo escolha: lá ela existe (qual dos seis corre) ---- */
    S.corridaTrocarFormato('single');
    ok('mas a INDIVIDUAL continua escolhendo', S.corrida.escolhidos.length === 0);
    ok('  e o botão dela continua na tela',
       S.renderCorrida().indexOf('corridaAbrirPicker()') >= 0);
    S.corridaAbrirPicker();
    ok('  e o picker dela abre', S.corrida.picker === true);
    S.corrida.picker = false;

    /* ⚠️ ---- e voltar pro relay NÃO desfaz a reordenação que o jogador fez com as setas ---- */
    S.corridaTrocarFormato('relay');
    const ordemTrocada = S.corrida.escolhidos.slice().reverse();
    S.corrida.escolhidos = ordemTrocada;
    S.corridaTrocarFormato('single');
    S.corridaTrocarFormato('relay');
    ok('a reordenação do revezamento sobrevive à ida e volta',
       S.corrida.escolhidos.map(p => p.speciesId).join(',') === ordemTrocada.map(p => p.speciesId).join(','),
       S.corrida.escolhidos.map(p => p.speciesId).join(','));

    /* ---- e pela HOME nada muda ---- */
    montar();
    S.abrirCorrida();
    S.corridaTrocarFormato('relay');
    ok('pela HOME o revezamento continua escolhendo', S.corrida.escolhidos.length === 0);
    ok('  e o botão continua lá', S.renderCorrida().indexOf('corridaAbrirPicker()') >= 0);
    S.corridaAbrirPicker();
    ok('  e o picker abre', S.corrida.picker === true);
    S.corrida.picker = false;
    /* e ali a régua das 8 insígnias CONTINUA valendo: o save 0 não é campeão */
    S.corridaEscolherTime(0);
    ok('  e a régua das 8 insígnias continua valendo fora da travessia',
       S.corrida.escolhidos.length === 0, 'a porta da home não pode aceitar time sem as 8');

    montar();
    S.corridaZerar(); S.pescariaZerar();
    Object.assign(S.pescariaRank, rankAntes);
  }

  g.ilhasJornada = null; g.ilhasTrecho = null;
}

(async () => {
  contaAdmin();
  g.authUser = { uid: 'u1' };
  g.team = []; g.equipados = {};
  g.novidadeVista = null; g.novidadesModal = false;
  g.screen = 'saveSelect';

  /* ⚠️ DE PONTA A PONTA, com o `loadPermanentUserData` DE VERDADE: a primeira versao deste caso
     simulava a linha a mao e media uma COPIA da regra escrita no proprio teste -- ela continuaria
     "acusando" com o conserto aplicado. Trava que pergunta a si mesma nao e trava. */
  const abriu = S.conferirNovidades();
  S.fecharNovidades();
  const marcado = g.novidadeVista;

  await S.loadPermanentUserData();
  /* o stub do Firestore devolve um documento VAZIO -- que e exatamente a janela de quem voltou
     antes de a gravacao propagar. Na vida real o `admin` vem do documento; aqui ele nao vem,
     entao repo-lo e o que faz este caso medir a MARCA, e nao a porta. */
  g.ehAdmin = true; g.screen = 'saveSelect';

  ok('o anuncio abre na primeira home', abriu === true && marcado === S.NOVIDADES_VERSAO);
  ok('  e a releitura da conta NAO apaga a marca', g.novidadeVista === S.NOVIDADES_VERSAO,
     'marca depois da releitura: ' + JSON.stringify(g.novidadeVista));
  ok('  entao ele NAO reabre depois de lido',
     S.conferirNovidades() === false && !g.novidadesModal);

  blocoDaTravessia();
  await blocoDoRanking();

  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
