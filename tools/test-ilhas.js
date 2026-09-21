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

  /* ⚠️ EXATAMENTE O BOOLEANO, como a porta das ilhas: 'sim', 1 e 'true' nao autorizam */
  for(const v of [false, undefined, null, 'sim', 1, 'true', 0, '']){
    contaLimpa(); g.ehAdmin = v;
    ok('  e ' + JSON.stringify(v) + ' nao abre', S.conferirNovidades() === false && !g.novidadesModal);
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
     clica em "Ver as Ilhas" reencontra o anuncio na proxima vez que abrir a home. */
  contaLimpa();
  S.conferirNovidades();
  S.novidadesIrParaAsIlhas();
  ok('o botao que leva as ilhas tambem marca', g.novidadeVista === S.NOVIDADES_VERSAO && !g.novidadesModal);
  ok('  e leva mesmo pras ilhas', g.screen === 'ilhas', 'tela: ' + g.screen);

  /* ---- 4) o conteudo sai do ILHAS_COMO ---- */
  contaLimpa(); S.conferirNovidades();
  const modal = S.renderNovidadesModal();
  ok('o anuncio lista as ' + S.ILHAS_LARANJA.length + ' ilhas',
     S.ILHAS_LARANJA.every(i => modal.indexOf(i.nome) >= 0));
  ok('  com o lider de cada uma', S.ILHAS_LARANJA.every(i => modal.indexOf(i.lider) >= 0));
  ok('  e o jogo de cada uma', S.ILHAS_LARANJA.every(i => modal.indexOf(i.jogo) >= 0));
  ok('  e o RESUMO de cada uma, palavra por palavra',
     S.ILHAS_LARANJA.every(i => !S.ILHAS_COMO[i.id] || modal.indexOf(S.ILHAS_COMO[i.id].resumo) >= 0));

  /* ⚠️ E ELE E DERIVADO: mexendo na TABELA o anuncio acompanha. Sem este caso, uma segunda lista
     escrita a mao passaria em todos os de cima -- e divergiria no dia em que uma ilha trocasse
     de jogo. E a mesma prova que a trava do asterisco dos status usa. */
  const guardado = S.ILHAS_COMO.mikan.resumo;
  S.ILHAS_COMO.mikan.resumo = 'Um resumo trocado so pra este caso.';
  ok('  e o texto vem da TABELA, nao de uma copia',
     S.renderNovidadesModal().indexOf('Um resumo trocado so pra este caso.') >= 0);
  S.ILHAS_COMO.mikan.resumo = guardado;

  /* ⚠️ ILHA SEM ENTRADA NO ILHAS_COMO NAO ENTRA: ali nao ha o que resumir. E a mesma regra que
     faz o (i) do mapa nao aparecer nela. */
  const semComo = S.ILHAS_COMO.pummelo;
  delete S.ILHAS_COMO.pummelo;
  const sem = S.renderNovidadesModal();
  ok('  e a ilha sem resumo fica de fora', sem.indexOf('Pummelo') < 0);
  ok('    e as outras continuam', sem.indexOf('Mikan') >= 0);
  S.ILHAS_COMO.pummelo = semComo;

  /* ---- 5) a tela ---- */
  ok('o anuncio tem os dois botoes',
     modal.indexOf('novidadesIrParaAsIlhas()') >= 0 && modal.indexOf('fecharNovidades()') >= 0);
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

  /* ⚠️ O MESMO SELO DO BOTAO DA HOME -- e a trava le o selo DA HOME em vez de escrever 'ilhas'
     aqui: se o botao trocar de selo um dia, e o anuncio que tem que acompanhar. */
  const seloDaHome = (S.renderSaveSelect().match(/#s-([a-z0-9-]+)"\/><\/svg><\/span><span>Ilhas Laranja/) || [])[1];
  ok('o titulo leva o MESMO selo do botao da home',
     !!seloDaHome && new RegExp('<h2>[^<]*<svg[^>]*><use href="#s-' + seloDaHome + '"').test(m),
     'selo da home: ' + seloDaHome);
  ok('  e o icone nao aparece DUAS vezes na caixa', m.indexOf('modal-icon') < 0,
     'ele foi pro titulo, entao o modal-icon saiu -- e isso devolveu 45px de lista');

  /* ⚠️ A COR SAI DA CONSTANTE, e o BOTAO DA HOME le a mesma: escrita a mao nos dois, a segunda
     divergiria no primeiro ajuste e o anuncio deixaria de casar com o botao que manda procurar. */
  ok('a caixa tem a borda na cor das ilhas', m.indexOf('border-color:' + S.COR_ILHAS) >= 0);
  ok('  e o botao principal tambem', m.indexOf('background:' + S.COR_ILHAS) >= 0);
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
console.log('');
console.log('=== O ANUNCIO APARECE UMA VEZ SO ===');
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

  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
