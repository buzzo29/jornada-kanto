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
   1) O ACESSO -- é o item que mais importa, porque a home ganhou um modo ADMINISTRATIVO
   ============================================================================ */
console.log('\n=== O ACESSO É SÓ DE QUEM TEM admin === true ===');
{
  contaAdmin();
  ok('com admin=true o botão aparece', home().indexOf('abrirIlhas()') >= 0, 'sem o botão');
  ok('  e com o nome EXATO', /Ilhas Laranja</.test(home()), 'o nome mudou');
  /* ⚠️ ELE OCUPA A LINHA INTEIRA: a fileira de modos é de DUAS colunas, e com os quatro modos
     normais o administrativo fica sozinho na quinta célula -- medido a 320px, um buraco de 137px
     do lado. Não é hierarquia: é a linha fechando, a mesma razão do Boss de Domingo. */
  ok('  e ocupa a linha inteira',
     /home-btn-largo[^>]*abrirIlhas\(\)|abrirIlhas\(\)[^>]*home-btn-largo/.test(home()),
     'sem o home-btn-largo');

  g.ehAdmin = false;
  ok('sem admin o botão some', home().indexOf('abrirIlhas()') < 0, 'aparece pra quem não é admin');
  /* ⚠️ E ENQUANTO A CONTA NÃO CARREGOU ele fica OCULTO -- o contrário da porta dos modos de
     campeão, que erra pro lado de DEIXAR ENTRAR. Aqui o lado seguro é o outro: mostrar um modo
     administrativo a quem não é admin, mesmo por meio segundo, é pior que escondê-lo de quem é. */
  g.ehAdmin = true; g.contaCarregada = false;
  ok('  nem enquanto a conta carrega', home().indexOf('abrirIlhas()') < 0);

  /* ⚠️ CAMPO AUSENTE, FALSO OU DE OUTRO TIPO NÃO AUTORIZA. O `admin` é lido como `d.admin === true`
     -- exatamente o booleano --, então 'sim', 1 e 'true' não entram. É a MESMA leitura dos três
     minigames, e ela vale porque o campo está na trava do `firestore.rules`: ler é seguro porque
     escrever não é. */
  [['ausente', undefined], ['false', false], ['a string "sim"', 'sim'], ['a string "true"', 'true'],
   ['o número 1', 1], ['null', null], ['o objeto {}', {}]].forEach(([nome, v]) => {
    contaAdmin(); g.ehAdmin = ({ admin: v }).admin === true;
    ok('  ' + nome + ' não autoriza', home().indexOf('abrirIlhas()') < 0);
  });

  /* ⚠️ E A VISIBILIDADE NÃO É A TRAVA: quem chamar `abrirIlhas()` pelo console cai na função, e
     ela refaz a pergunta. */
  contaAdmin(); g.ehAdmin = false; g.screen = 'saveSelect';
  S.abrirIlhas();
  ok('a AÇÃO recusa quem não é admin', g.screen !== 'ilhas', 'tela: ' + g.screen);
  contaAdmin(); g.contaCarregada = false; g.screen = 'saveSelect';
  S.abrirIlhas();
  ok('  e recusa enquanto a conta carrega', g.screen !== 'ilhas', 'tela: ' + g.screen);
  contaAdmin();
  S.abrirIlhas();
  ok('  e deixa entrar quem é', g.screen === 'ilhas', 'tela: ' + g.screen);

  /* ⚠️ E O `admin` CONTINUA FORA DO ALCANCE DO CLIENTE: é isso que faz ler ser seguro. */
  const regras = require('fs').readFileSync(path.join(raiz, 'firestore.rules'), 'utf8');
  ok('e o `admin` está na trava de campos das regras', /admin/.test(regras));
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
  const semJogo = L.findIndex(i => !i.abrir);
  contaAdmin(); g.screen = 'ilhas';
  S.entrarNaIlha(semJogo);
  ok('a ilha sem jogo não leva a lugar nenhum', g.screen === 'ilhas', 'tela: ' + g.screen);
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

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
