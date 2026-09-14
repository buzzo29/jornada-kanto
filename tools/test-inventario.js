#!/usr/bin/env node
/**
 * MOCHILA (INVENTÁRIO) E LOJA
 *
 * O estoque da mochila NÃO é uma lista gravada: é uma leitura do que a conta já tem -- o contador
 * `rareCandies` do documento da conta e os cupons de Bônus Shiny ainda não ativados (o do save que
 * venceu a Elite e o da notificação de campeão de liga).
 *
 * O que este teste tranca, e por quê:
 *   - a PILHA: cinco doces são UM slot com "5x", não cinco slots.
 *   - o cupom sai das DUAS origens, e some assim que é ativado -- clicar de novo num cupom já
 *     gasto era o defeito mais fácil de introduzir aqui.
 *   - o Doce Raro NÃO pode ser excluído, e a tela diz por quê. Um botão que falha é pior que um
 *     botão desabilitado com o motivo do lado.
 *   - a tela de gastar o doce lê `game.rareCandies` e não `game.tower`: aberta pela mochila, sem
 *     nunca ter passado pela Torre, `game.tower` é null.
 *   - a home mostra as moedas e os cinco cards.
 *
 *   node tools/test-inventario.js
 */
const path = require('path');
const raiz = path.join(__dirname, '..');
const { createSandbox } = require('./game-sandbox');
const S = createSandbox();

let falhas = 0;
function ok(titulo, cond, extra){
  if(cond){ console.log('  OK     ' + titulo + (extra ? '   ' + extra : '')); }
  else { falhas++; console.log('  FALHOU ' + titulo + (extra ? '   ' + extra : '')); }
}
const contaEm = (t, re) => (t.match(re)||[]).length;
/* ⚠️ A MOCHILA VIROU UMA LISTA como a loja (14/09/2026): a grade de quadradinhos (.item-slot)
   morreu, e o que se conta agora e a LINHA. */
const linhas = (t) => contaEm(t, /class="loja-linha/g);

function conta({ doces = 0, saves = [], notificacoes = [] } = {}){
  const g = S.__getGame();
  g.authUser = { uid:'u1' };
  g.trainerName = 'Buzzo';
  g.rareCandies = doces;
  g.moedas = 0;
  g.saveSlots = saves;
  g.inventarioNotificacoes = notificacoes;
  g.inventarioSel = null; g.inventarioErro = null; g.inventarioUsando = false;
  g.inventarioCarregando = false; g.inventarioExcluir = null;
  g.tower = null;
  S.__setGame(g);
}
const SAVE_CAMPEAO = { customName:'Kanto', badgeCount:8, eliteShinyGranted:true, eliteShinyUsed:false, team:[] };
const CUPOM_LIGA = { id:'n1', type:'league_champion', meta:{} };

console.log('\n=== AS PILHAS: O QUE A CONTA TEM ===');
{
  conta({ doces: 5 });
  const p = S.pilhasDoInventario();
  /* Cinco doces sao UM slot com "5x". Cinco slots iguais fariam a mochila parecer cheia de coisas
     diferentes, e e justamente o oposto do que ela tem. */
  ok('cinco doces viram UMA pilha de cinco', p.length === 1 && p[0].item === 'doce_raro' && p[0].quantidade === 5,
     JSON.stringify(p.map(x=>x.item+':'+x.quantidade)));
  S.escolherItem('doce_raro');
  const t = S.renderInventario();
  ok('e a lista mostra o 5x', /loja-preco">5x/.test(t), (t.match(/loja-preco">\d+x/g)||[]).join(' '));
  ok('numa linha so', linhas(t) === 1, linhas(t) + ' linhas');

  conta();
  ok('conta sem nada nao tem pilha nenhuma', S.pilhasDoInventario().length === 0);
  const vazio = S.renderInventario();
  /* ⚠️ A PRATELEIRA VAZIA CONTINUA DIZENDO DE ONDE VEM O QUE FALTA -- era o que a mochila vazia
     dizia antes das prateleiras, e uma tela que so diz 'vazio' faz a pessoa procurar no jogo
     inteiro. A das MAQUINAS e a unica que ficou muda, e foi o que se pediu. */
  S.escolherPrateleiraDaMochila('especiais');
  const vazio2 = S.renderInventario();
  ok('e a prateleira vazia explica de onde vem cada coisa',
     /Torre dos Treinadores/.test(vazio2) && /Elite dos 4/.test(vazio2));
  ok('sem nada, a lista nao desenha linha nenhuma', linhas(vazio2) === 0, linhas(vazio2) + ' linhas');
  ok('e o quadro de cima fica EM BRANCO (mas continua la)',
     /class="box item-detalhe loja-fixa"><\/div>/.test(vazio2),
     (vazio2.match(/loja-fixa">[\s\S]{0,20}/) || [''])[0].replace(/\s+/g, ' '));
}

console.log('\n=== O CUPOM DE BONUS SHINY VEM DAS DUAS ORIGENS ===');
{
  conta({ saves: [SAVE_CAMPEAO] });
  ok('o save campeao vale um cupom', S.cuponsDeBonusShiny().length === 1,
     JSON.stringify(S.cuponsDeBonusShiny()));
  ok('e ele sabe de que save veio', S.cuponsDeBonusShiny()[0].origem === 'save' && S.cuponsDeBonusShiny()[0].slot === 0);

  conta({ notificacoes: [CUPOM_LIGA] });
  ok('a notificacao de campeao de liga tambem', S.cuponsDeBonusShiny().length === 1 &&
     S.cuponsDeBonusShiny()[0].origem === 'notificacao');

  /* Cupom JA ATIVADO nao conta -- e o que impede clicar de novo em algo que ja foi. */
  conta({ notificacoes: [{ id:'n1', type:'league_champion', meta:{ activated:true } }] });
  ok('cupom ja ativado nao aparece', S.cuponsDeBonusShiny().length === 0);
  conta({ saves: [{ ...SAVE_CAMPEAO, eliteShinyUsed:true }] });
  ok('nem o save que ja gastou o dele', S.cuponsDeBonusShiny().length === 0);
  /* Save campeao que ainda NAO recebeu o premio tambem nao: quem entrega e o claimEliteShiny, na
     tela de campeao. */
  conta({ saves: [{ ...SAVE_CAMPEAO, eliteShinyGranted:false }] });
  ok('nem o save que ainda nao reclamou o premio', S.cuponsDeBonusShiny().length === 0);

  /* As duas origens juntas empilham. */
  conta({ saves: [SAVE_CAMPEAO], notificacoes: [CUPOM_LIGA] });
  const p = S.pilhasDoInventario();
  ok('dois cupons viram uma pilha de dois', p.length === 1 && p[0].item === 'bonus_shiny' && p[0].quantidade === 2,
     JSON.stringify(p.map(x=>x.item+':'+x.quantidade)));
}

console.log('\n=== O QUADRO DE CIMA: USAR E EXCLUIR ===');
{
  conta({ doces: 2, saves: [SAVE_CAMPEAO] });
  S.escolherItem('doce_raro');
  const t = S.renderInventario();
  ok('o quadro descreve o item escolhido', t.includes('Doce Raro') && t.includes('2 na mochila'),
     (t.match(/\d+ na mochila/g)||[]).join(' '));
  ok('com o botao de usar', /class="btn success" [^>]*onclick="usarItem\('doce_raro'\)"/.test(t) ||
     /onclick="usarItem\('doce_raro'\)"/.test(t));
  /* O DOCE NAO PODE SER EXCLUIDO: ele e um contador que so o servidor mexe, e nao existe funcao
     pra devolver um. Botao desabilitado com o motivo do lado e melhor que um botao que falha. */
  ok('e o de excluir DESABILITADO', /disabled[^>]*onclick="pedirExclusaoDeItem/.test(t),
     (t.match(/onclick="pedirExclusaoDeItem[^"]*"/g)||[]).join(' '));
  ok('dizendo por que', !S.podeExcluir('doce_raro') && /não pode ser jogado fora/.test(t),
     S.motivoDeNaoExcluir('doce_raro'));

  /* O cupom de LIGA da pra jogar fora, porque ele e uma notificacao -- e apagar a notificacao ja
     era apagar o cupom, com o mesmo aviso, na tela de notificacoes. */
  conta({ notificacoes: [CUPOM_LIGA] });
  ok('o cupom de liga pode ser excluido', S.podeExcluir('bonus_shiny'));
  /* O da Elite nao: ele mora no save e nao ha o que apagar. */
  conta({ saves: [SAVE_CAMPEAO] });
  ok('mas o da Elite nao', !S.podeExcluir('bonus_shiny'), S.motivoDeNaoExcluir('bonus_shiny'));

  /* Excluir pede confirmacao: e perda definitiva. */
  conta({ notificacoes: [CUPOM_LIGA] });
  S.escolherItem('bonus_shiny');
  S.pedirExclusaoDeItem('bonus_shiny');
  ok('excluir pede confirmacao', /não tem volta/.test(S.renderInventario()));
}

console.log('\n=== A TELA DO DOCE LE A CONTA, NAO A TORRE ===');
{
  /* Aberta pela mochila, `game.tower` e null: quem tinha a contagem era a Torre, e a tela do doce
     lia dali. Aberta assim, ela nao abriria nunca. */
  conta({ doces: 1, saves: [{ customName:'Kanto', badgeCount:8,
    team:[{ id:'a0', speciesId:'charizard', level:70, shiny:false }] }] });
  S.openCandyPicker();
  ok('a tela do doce abre sem a Torre ter sido aberta', !!S.__getGame().candyPicker,
     'tower: ' + JSON.stringify(S.__getGame().tower));
  ok('e ela diz quantos restam', /Você tem <strong>1<\/strong> doce/.test(S.renderCandyPickerModal()),
     (S.renderCandyPickerModal().match(/Você tem <strong>\d+<\/strong> doces?/g)||[]).join(' '));
  conta({ doces: 0 });
  S.__setGame(Object.assign(S.__getGame(), { candyPicker:null }));
  S.openCandyPicker();
  ok('sem doce ela nao abre', !S.__getGame().candyPicker);
}

console.log('\n=== A PORTA DOS MODOS DE CAMPEAO (as 8 insignias) ===');
{
  /* Pedida em 12/09/2026: *"caso a conta nao tenha nenhum time vencedor das 8 insignias, coloque
     uma mensagem de erro quando o treinador clicar para entrar no ginasio da cidade, ligas
     classicas e batalhas onlines ... e nao deixe entrar"*. */
  const TIME = [{ speciesId:'venusaur', level:70 }];
  const monta = (slots, carregado) => {
    const g = S.__getGame();
    g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
    slots.forEach((sv, i) => { g.saveSlots[i] = sv; });
    g.saveSlotsCarregados = carregado !== false;
    g.modoBloqueado = null;
    g.screen = 'saveSelect';
    S.__setGame(g);
  };
  /* Cada modo e testado pela SUA porta: abrir e ver se a tela mudou. */
  const tenta = (abrir) => {
    S.__getGame().screen = 'saveSelect';
    S.__getGame().modoBloqueado = null;
    abrir();
    return { tela: S.__getGame().screen, msg: S.__getGame().modoBloqueado };
  };
  const MODOS = [
    ['Ligas', () => S.openLeagueTypesList(), 'leagueTypesList'],
    ['Ginásio da Cidade', () => S.openNeighborhoodGymScreen(), 'neighborhoodGym'],
    ['Batalha Online', () => S.openOnlineBattle(), 'onlineBattle']
  ];

  /* 1) CONTA SEM NENHUM CAMPEAO: os tres recusam, com a frase pedida. */
  monta([]);
  MODOS.forEach(([nome, abrir, tela]) => {
    const r = tenta(abrir);
    ok(nome + ': sem campeao NAO entra', r.tela !== tela, 'ficou em ' + r.tela);
    ok(nome + ': e diz por que', r.msg === S.AVISO_SEM_CAMPEAO, String(r.msg));
  });
  ok('e a frase e a pedida',
     S.AVISO_SEM_CAMPEAO === 'É necessário vencer as 8 insígnias para entrar nesse modo de jogo.',
     S.AVISO_SEM_CAMPEAO);

  /* 2) SAVE SEM AS 8 tambem nao abre porta. */
  monta([{ team:TIME, badgeCount:3 }]);
  MODOS.forEach(([nome, abrir, tela]) => {
    ok(nome + ': com 3 insignias tambem nao entra', tenta(abrir).tela !== tela);
  });

  /* ⚠️ 3) SAVE COM AS 8 E SEM TIME tambem nao. Era a copia divergente: a tela do ginasio nao pedia
     o `team` e deixava passar, as outras nao. */
  monta([{ badgeCount:8 }]);
  ok('save com as 8 e SEM time nao conta', S.savesCampeoes().length === 0, S.savesCampeoes().join(','));
  MODOS.forEach(([nome, abrir, tela]) => {
    ok(nome + ': save sem time nao entra', tenta(abrir).tela !== tela);
  });

  /* 4) COM UM CAMPEAO, os tres abrem normalmente -- e a mensagem nao aparece. */
  monta([{ team:TIME, badgeCount:8 }]);
  MODOS.forEach(([nome, abrir, tela]) => {
    const r = tenta(abrir);
    ok(nome + ': com o time campeao ENTRA', r.tela === tela, r.tela);
    ok(nome + ': e sem mensagem nenhuma', !r.msg, String(r.msg));
  });

  /* ⚠️ 5) SAVES AINDA NAO CARREGADOS: a porta DEIXA PASSAR. O game.saveSlots nasce com 20 nulos e
     e preenchido por uma chamada assincrona -- bloquear ali trancaria a porta na cara de quem TEM
     o time. Errar pro lado de deixar entrar e o certo: os tres continuam recusando la dentro. */
  monta([], false);
  MODOS.forEach(([nome, abrir, tela]) => {
    ok(nome + ': saves nao carregados NAO bloqueiam', tenta(abrir).tela === tela);
  });

  /* 6) NA HOME a mensagem aparece, colada nos botoes, e some ao voltar. */
  monta([]);
  S.openLeagueTypesList();
  {
    const g = S.__getGame(); g.screen = 'saveSelect'; S.__setGame(g);
    const home = S.renderSaveSelect();
    ok('a home mostra a recusa', home.indexOf(S.AVISO_SEM_CAMPEAO) >= 0,
       (home.match(/error-text[^>]*>[^<]*/) || ['(nada)'])[0]);
    ok('e ela vem ANTES dos botoes de modo', home.indexOf('error-text') < home.indexOf('home-modes-row'));
    ok('e os quatro botoes continuam la', (home.match(/leagues-big-btn/g) || []).length === 4,
       (home.match(/leagues-big-btn/g) || []).length + ' botoes');
  }
  S.openSaveSelect();
  ok('e voltando pra home ela some', !S.__getGame().modoBloqueado, String(S.__getGame().modoBloqueado));

  /* ⚠️ 7) A TORRE NAO FOI GATEADA -- so os tres que o pedido nomeia. Fica FIXADO aqui pra o dia em
     que alguem quiser a mesma porta la ser uma DECISAO, e nao um descuido. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const porta = /if\(!exigeTimeCampeao\(\)\) return;/g;
    ok('a porta esta em exatamente tres lugares', (txt.match(porta) || []).length === 3,
       (txt.match(porta) || []).length + ' chamadas');
    const torre = txt.slice(txt.indexOf('function openTrainerTower('), txt.indexOf('function openTrainerTower(') + 400);
    ok('e a Torre continua FORA dela (so os tres pedidos)', torre.indexOf('exigeTimeCampeao') < 0);
  }
}

console.log('\n=== AS TRES PRATELEIRAS DA LOJA ===');
{
  /* Pedidas em 12/09/2026: *"na parte que exibe a lista dos itens, diminua ela pela metade na
     horizontal e adicione do lado esquerdo 3 botoes: o primeiro e 'Para as batalhas', e adicione
     nessa secao todos os itens que sao usados equipando um pokemon; no segundo botao coloque
     'Especiais', e adicione o Rare Candy; e o terceiro botao coloque TMs, ainda sem nada"*. */
  conta({ doces: 0 });
  S.openLoja();
  ok('sao tres, na ordem pedida',
     S.LOJA_PRATELEIRAS.map(p => p.nome).join(' | ') === 'Para as batalhas | Especiais | TMs/HMs',
     S.LOJA_PRATELEIRAS.map(p => p.nome).join(' | '));
  ok('e a loja abre na primeira', S.__getGame().lojaAba === 'batalha', String(S.__getGame().lojaAba));

  /* ⚠️ TODO ITEM A VENDA CAI EM EXATAMENTE UMA PRATELEIRA. E o que impede um item novo de sumir da
     loja sem ninguem ver -- a prateleira sai do proprio item (`equipável`), nao de uma lista
     escrita na tela, justamente pra nenhuma lista envelhecer calada. */
  {
    const aVenda = Object.keys(S.ITENS).filter(id => S.ITENS[id].comprável);
    const somadas = S.LOJA_PRATELEIRAS.reduce((a, p) => a.concat(S.itensDaPrateleira(p.id)), []);
    ok('todo item a venda esta em exatamente uma prateleira',
       somadas.length === aVenda.length && aVenda.every(id => somadas.filter(x => x === id).length === 1),
       somadas.length + ' de ' + aVenda.length);
  }
  /* "Para as batalhas" E exatamente o `equipável` -- a marca que ja dizia que o item vai num
     pokemon pelo + da tela de ordem. Casar as duas coisas e o que mantem a prateleira honesta. */
  ok('"Para as batalhas" e exatamente quem se EQUIPA num pokemon',
     S.itensDaPrateleira('batalha').join(',') === Object.keys(S.ITENS).filter(id => S.ITENS[id].comprável && S.ITENS[id].equipável).join(','),
     S.itensDaPrateleira('batalha').join(', '));
  ok('e sao os nove', S.itensDaPrateleira('batalha').length === 9, S.itensDaPrateleira('batalha').length + ' itens');
  ok('"Especiais" tem o Doce Raro', S.itensDaPrateleira('especiais').indexOf('doce_raro') >= 0,
     S.itensDaPrateleira('especiais').join(', '));
  ok('e as TMs estao vazias, como pedido', S.itensDaPrateleira('tms').length === 0,
     S.itensDaPrateleira('tms').join(', ') || '(vazia)');

  /* NA TELA: os tres botoes aparecem, e a lista mostra so a prateleira aberta. */
  {
    const t = S.renderLoja();
    ok('os tres botoes estao na tela', (t.match(/class="loja-aba /g)||[]).length === 3,
       (t.match(/class="loja-aba /g)||[]).length + ' botoes');
    ok('com os nomes por extenso', S.LOJA_PRATELEIRAS.every(p => t.indexOf(p.nome) >= 0));
    ok('a lista fica ao lado deles', t.indexOf('loja-corpo') >= 0 && t.indexOf('loja-abas') < t.indexOf('loja-lista'));
    /* O Doce Raro NAO pode aparecer na prateleira das batalhas. */
    ok('e a lista mostra so a prateleira aberta', t.indexOf('>Doce Raro') < 0,
       (t.match(/loja-nome[^>]*>[^<]*/g)||[]).length + ' linhas');
  }

  /* ⚠️ TROCAR DE PRATELEIRA MOVE A SELECAO. Sem isso o quadro de cima continuava mostrando um item
     que a lista ao lado nem lista mais -- e na prateleira VAZIA ele mostraria o da anterior, com
     botao de comprar e tudo. */
  S.escolherPrateleira('especiais');
  ok('trocar de prateleira move a selecao junto', S.__getGame().lojaSel === 'doce_raro',
     String(S.__getGame().lojaSel));

  /* ⚠️ O VENDER ESTA SEMPRE NA TELA, e DESABILITADO quando nao ha o que vender (13/09/2026, a
     pedido). Ele ja apareceu e sumiu conforme o estoque, por dois dias -- e um botao que vai e vem
     MUDA A ALTURA do rodape, entao o Comprar dancava de lugar conforme o item. Presente e cinza, a
     mao encontra os dois sempre no mesmo lugar. */
  {
    const g2 = S.__getGame();
    g2.inventario = { potion: 2 };   // tem Pocao pra vender, e mais nada
    S.escolherPrateleira('batalha');
    S.escolherItemDaLoja('potion'); S.__setGame(g2);
    const comEstoque = S.renderLoja();
    ok('com estoque, o Vender esta la e ativo',
       comEstoque.indexOf('abrirVenda') >= 0 && !/abrirVenda[^>]*>\s*Você não tem/.test(comEstoque));
    S.escolherItemDaLoja('faixa_foco');
    const semEstoque = S.renderLoja();
    ok('SEM estoque o Vender continua na tela', semEstoque.indexOf('abrirVenda') >= 0);
    /* desabilitado: o `.btn.danger:disabled` da casa e o cinza, o mesmo do Excluir sem o que apagar */
    const botao = (semEstoque.match(/<button class="btn danger"[^>]*>[^<]*<\/button>/) || [''])[0];
    ok('e vem desabilitado', /disabled/.test(botao), botao.replace(/\s+/g, ' '));
    ok('dizendo por que', /não tem/.test(botao), botao.replace(/\s+/g, ' ').slice(0, 120));
  }

  /* A LINHA DA LISTA: preco a DIREITA do nome (irmao dele, nao filho) e sem o "voce tem N". */
  {
    const t = S.renderLoja();
    ok('o preco e irmao do nome, na mesma linha',
       /<span class="loja-nome">[^<]*<\/span>\s*<span class="loja-preco">/.test(t),
       (t.match(/<span class="loja-nome">[\s\S]{0,80}/) || [''])[0].replace(/\s+/g, ' '));
    ok('e o "voce tem N" saiu da lista', t.indexOf('loja-tem') < 0 && t.indexOf('você tem') < 0);
  }
  /* ⚠️ E O QUADRO E O MESMO EM TODAS AS PRATELEIRAS -- foi assim que o pedido veio ("ser o mesmo
     quadro para todos os botoes"). Sem este caso, so a prateleira vazia estaria coberta. */
  {
    const semQuadro = S.LOJA_PRATELEIRAS.filter(pr => {
      S.escolherPrateleira(pr.id);
      return S.renderLoja().indexOf('loja-fixa') < 0;
    });
    ok('o quadro de cima existe nas TRES prateleiras', semQuadro.length === 0,
       semQuadro.map(pr => pr.id).join(',') || 'todas ok');
    S.escolherPrateleira('especiais');
  }
  {
    const t = S.renderLoja();
    ok('e a lista passa a ser a dela', (t.match(/class="loja-linha/g)||[]).length === 1 && t.indexOf('>Doce Raro') >= 0);
  }
  S.escolherPrateleira('tms');
  ok('e na prateleira vazia nao sobra item selecionado', S.__getGame().lojaSel === null,
     String(S.__getGame().lojaSel));
  {
    const t = S.renderLoja();
    ok('ela nao mostra linha nenhuma', (t.match(/class="loja-linha/g)||[]).length === 0);
    /* ⚠️ O QUADRO DE CIMA FICA, E VAZIO (13/09/2026, a pedido). Ele chegou a SUMIR na prateleira
       vazia, por um dia, pra a tela nao dizer a mesma coisa duas vezes -- so que com ele indo e
       vindo (e crescendo e encolhendo conforme o item) a tela inteira dancava a cada clique:
       *"hoje ele ta dinamico e ta ficando feio quando fica trocando de item"*.
       Hoje ele existe sempre, com altura FIXA no CSS, e aqui ele fica sem nada dentro. */
    ok('o quadro de detalhe CONTINUA na prateleira vazia', t.indexOf('loja-fixa') >= 0);
    ok('e ele fica sem nada dentro', t.indexOf('item-detalhe-topo') < 0 && t.indexOf('abrirCompra') < 0);
    /* A ALTURA E FIXA NO CSS -- o teste le a folha, porque isso nao aparece em asserção de HTML
       nenhuma. 375px e o maior quadro medido a 320px (o Despertar, o unico com o botao de Vender E
       a linha de "Faltam"); o `overflow-y` e o que faz a altura ser promessa e nao torcida. */
    const css = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const bloco = (css.match(/\.loja-fixa\{[\s\S]*?\}/) || [''])[0];
    ok('a altura do quadro e fixa no CSS', /height:\s*\d+px/.test(bloco),
       bloco.replace(/\s+/g, ' ').slice(0, 120));
    /* ⚠️ O QUADRO E UMA COLUNA DE TRES ANDARES (13/09/2026, a pedido: "dependendo do tamanho do
       texto eles sobem ou descem"). A altura fixa ja tinha parado o QUADRO de pular entre um item e
       outro; o que ainda dancava eram os BOTOES dentro dele, porque a descricao muda de tamanho.
       Quem cede e o MIOLO -- e por isso o `overflow` saiu do quadro e foi pra ele: no quadro
       inteiro, o rodape rolava junto e os botoes voltavam a sair do lugar. */
    ok('e ele e uma coluna, com o rodape colado embaixo',
       /display:flex/.test(bloco) && /flex-direction:column/.test(bloco), bloco.replace(/\s+/g, ' ').slice(0, 160));
    const miolo = (css.match(/\.loja-miolo\{[^}]*\}/) || [''])[0];
    ok('quem rola e o miolo, nao o quadro', /flex:\s*1/.test(miolo) && /overflow-y:\s*auto/.test(miolo), miolo);
    /* E A LISTA MOSTRA 6 E ROLA (a pedido). A linha mede 36px a 320px desde que o preco foi pro
       lado do nome -- era 63 com ele embaixo, e o teto velho de 390 deixava os 9 itens caberem: o
       limite de 6 tinha virado letra morta. Numero de tela envelhece junto com a tela. */
    const blocoLista = (css.match(/\.loja-lista\{[^}]*max-height[^}]*\}/) || [''])[0];
    ok('a lista tem teto de 6 itens e rola', /max-height:\s*228px/.test(blocoLista) && /overflow-y:\s*auto/.test(blocoLista),
       blocoLista.replace(/\s+/g, ' '));

    /* ⚠️ OS BOTOES FICAM NO RODAPE, e o rodape e irmao do miolo -- nao filho dele. Dentro do miolo
       eles rolariam com a descricao, que e exatamente o que se pediu pra parar. */
    /* ⚠️ O QUADRO DA LOJA, e nao o primeiro do arquivo: desde 14/09/2026 a MOCHILA usa a mesma
       marcacao (.loja-fixa) e ela vem ANTES no index.html -- sem recortar a partir do renderLoja,
       esta trava passou a medir o quadro da outra tela. */
    const soALoja = css.slice(css.indexOf('function renderLoja(){'));
    const quadroHtml = (soALoja.match(/<div class="box item-detalhe loja-fixa">[\s\S]*?\n  <\/div>/) || [''])[0];
    const iMiolo = quadroHtml.indexOf('loja-miolo');
    const iRodape = quadroHtml.indexOf('loja-rodape');
    const iAcoes = quadroHtml.indexOf('item-acoes');
    ok('os botoes estao no rodape, depois do miolo',
       iMiolo > 0 && iRodape > iMiolo && iAcoes > iRodape,
       'miolo em ' + iMiolo + ', rodape em ' + iRodape + ', botoes em ' + iAcoes);
    ok('deixando um recado so, que nomeia a prateleira', /Ainda não há TMs\/HMs à venda/.test(t),
       (t.match(/loja-vazia[^>]*>[^<]*/g)||[]).join(' | '));
    ok('e o saldo continua na tela', /Você tem <strong>🪙/.test(t));
    /* E O BOTAO DE COMPRAR NAO PODE ESTAR LA: nao ha o que comprar. */
    ok('e nao ha botao de comprar', t.indexOf('abrirCompra') < 0);
  }
  S.escolherPrateleira('batalha');
}

console.log('\n=== A LOJA ===');
{
  conta({ doces: 0 });
  S.openLoja();
  const t = S.renderLoja();
  ok('a loja abre com um item ja escolhido', !!S.__getGame().lojaSel, String(S.__getGame().lojaSel));
  /* E TEM QUE SER UM QUE ELA VENDE. O Doce Raro e o Bonus Shiny estao no catalogo mas vem de
     JOGAR -- abrir escolhendo um deles deixava o quadro de cima vazio, porque ele so desenha o
     que esta na lista a venda. Defeito pego por este teste quando a loja passou a vender. */
  ok('e e um item que ela realmente vende', !!S.ITENS[S.__getGame().lojaSel].comprável,
     String(S.__getGame().lojaSel));
  /* A LOJA VIROU LISTA em 04/09/2026. A grade de quadradinhos mostrava so o icone, e com 11 itens
     metade deles sao emojis parecidos -- nao dava pra escolher sem clicar em cada um. */
  ok('a loja e uma LISTA, nao a grade de quadradinhos',
     t.includes('loja-lista') && !t.includes('item-grade'));
  /* O NUMERO SAI DO CATALOGO, e nao escrito a mao: ele ja envelheceu uma vez (estava 11 quando o
     Bonus Shiny saiu da loja, em 12/09/2026) e o teste acusou a tela por uma mudanca que era do
     catalogo. O que a regra quer e "uma linha por item a venda", nao "onze linhas".
     ⚠️ E DESDE 12/09/2026 A LISTA E DA PRATELEIRA ABERTA, nao do catalogo inteiro -- a loja ganhou
     tres (Para as batalhas / Especiais / TMs). */
  {
    const daAba = S.itensDaPrateleira(S.__getGame().lojaAba).length;
    ok('com uma linha por item da prateleira aberta', (t.match(/class="loja-linha/g)||[]).length === daAba,
       (t.match(/class="loja-linha/g)||[]).length + ' linhas pra ' + daAba + ' itens em ' + S.__getGame().lojaAba);
  }
  /* Cada linha traz o que a grade nao trazia: NOME e PRECO, sem precisar clicar. */
  ok('e cada linha tem icone, nome e preco',
     t.includes('loja-icone') && t.includes('loja-nome') && t.includes('loja-preco') &&
     /loja-nome[^>]*>Faixa de Foco/.test(t), (t.match(/loja-nome[^>]*>[^<]*/g)||[]).slice(0,3).join(' | '));
  /* O QUADRO DE CIMA E FIXO: so a lista rola. Com 11 itens a lista passa da tela a 320px, e sem
     isso o jogador rolava ate o item, clicava, e voltava pra cima pra ler e comprar. */
  ok('e o quadro de cima fica fixo (sticky)', t.includes('loja-fixa'));
  ok('com o saldo dentro dele', /loja-saldo/.test(t));
  ok('e a Faixa de Foco custa 50', S.ITENS.faixa_foco.preco === 50, String(S.ITENS.faixa_foco.preco));
  /* Os cinco de atributo custam 30 cada, e o preco da tela tem que ser o que o servidor cobra. */
  ok('e os cinco de atributo custam 30',
     ['hp_up','atk_up','def_up','spatk_up','spdef_up'].every(id => S.ITENS[id].preco === 30),
     ['hp_up','atk_up','def_up','spatk_up','spdef_up'].map(id => id + ':' + S.ITENS[id].preco).join(' '));
  /* ⚠️ O CATALOGO NAO E MAIS SO A LOJA. O Bonus Shiny continua no ITENS -- e de la que a MOCHILA
     tira o nome, o icone e a descricao dele --, mas nao esta a venda desde 12/09/2026: ele so vem
     de vencer a Elite 4 (ou uma liga online).
     A lista de fora da loja e FIXADA aqui de proposito: o proximo item que perder o `comprável`
     tem que ser uma decisao, nao um descuido. */
  ok('o unico item do catalogo fora da loja e o Bonus Shiny',
     Object.keys(S.ITENS).filter(id => !S.ITENS[id].comprável).join(',') === 'bonus_shiny',
     Object.keys(S.ITENS).filter(id => !S.ITENS[id].comprável).join(', ') || '(nenhum)');
  ok('e ele nao tem preco nenhum, dos dois lados',
     S.ITENS.bonus_shiny.preco === undefined && S.precoDeVenda('bonus_shiny') === 0 &&
     S.quantoPossoVender('bonus_shiny') === 0);
  ok('o quadro de cima traz preco e descricao', /🪙 \d+/.test(t) && t.includes('item-detalhe-texto'));
  /* SEM MOEDA o botao ja NASCE desabilitado -- um botao que so recusa depois do toque e pior. */
  ok('sem moeda o Comprar nasce desabilitado',
     /<button class="btn success" disabled[\s\S]{0,80}onclick="abrirCompra/.test(t),
     (t.match(/<button class="btn success"[^>]*/g)||[]).join(' | '));
  ok('e a tela diz quanto falta', /Faltam 🪙 \d+/.test(t), (t.match(/Faltam[^<]*/g)||[]).join(' | '));
  /* COM MOEDA ele acende. */
  const g = S.__getGame(); g.moedas = 999; S.__setGame(g);
  const rico = S.renderLoja();
  ok('com moeda ele acende', /onclick="abrirCompra/.test(rico) && !/disabled[\s\S]{0,80}onclick="abrirCompra/.test(rico));
  ok('e mostrando quantas moedas voce tem', /Você tem <strong>🪙 999<\/strong>/.test(rico));
  /* OS PRECOS da tela tem que ser os mesmos que o servidor cobra -- se divergirem, a tela promete
     um preco que a cobranca nao pratica. */
  /* Precos revisados em 04/09/2026: Super Pocao 30 -> 50 e Pocao 15 -> 30. */
  ok('os precos sao os pedidos', S.ITENS.awakening.preco === 50 && S.ITENS.hyperpotion.preco === 50 && S.ITENS.potion.preco === 30,
     [S.ITENS.awakening.preco, S.ITENS.hyperpotion.preco, S.ITENS.potion.preco].join('/'));
  /* O DOCE RARO continua a venda (300); o Bonus Shiny saiu em 12/09/2026 -- ver o caso acima. */
  ok('e o Doce Raro, que vem de jogar, tambem tem preco', S.ITENS.doce_raro.preco === 300,
     String(S.ITENS.doce_raro.preco));
}

console.log('\n=== O POPUP DE QUANTIDADE ===');
{
  /* O TETO E O QUE O DINHEIRO COMPRA. Ele e so conveniencia da tela: quem manda e o servidor, que
     refaz a conta contra o saldo lido na transacao -- o saldo pode ter mudado em outra aba entre
     abrir o popup e confirmar. */
  conta({ doces: 0 });
  const g = S.__getGame(); g.moedas = 100; S.__setGame(g);
  ok('o maximo sai do saldo', S.maximoQueCabe('potion') === 3, String(S.maximoQueCabe('potion')));   // 100/30
  ok('e arredonda pra baixo', S.maximoQueCabe('awakening') === 2, String(S.maximoQueCabe('awakening'))); // 100/50
  ok('sem dinheiro pra um, o maximo e zero', S.maximoQueCabe('doce_raro') === 0, String(S.maximoQueCabe('doce_raro')));

  /* Abrir com saldo insuficiente nao pode montar um popup de "compre 0". */
  S.abrirCompra('doce_raro');
  ok('e nem abre o popup', !S.__getGame().compraItem, String(S.__getGame().compraItem));

  S.abrirCompra('potion');
  ok('o popup abre em 1', S.__getGame().compraQtd === 1, String(S.__getGame().compraQtd));
  const m = S.renderCompraModal();
  ok('e diz o teto', /até <strong>3<\/strong>/.test(m), (m.match(/até[^<]*<strong>[^<]*/g)||[]).join(' | '));
  ok('e o total de 1', /Total: <strong>🪙 30<\/strong>/.test(m), (m.match(/Total:[^<]*<strong>[^<]*/g)||[]).join(' | '));
  ok('o menos nasce travado em 1', /disabled[^>]*onclick="mudarQtdCompra\(-1\)"/.test(m),
     (m.match(/<button[^>]*mudarQtdCompra\(-1\)[^>]*/g)||[]).join(' | '));

  S.mudarQtdCompra(1);
  ok('o + sobe', S.__getGame().compraQtd === 2, String(S.__getGame().compraQtd));
  ok('e o total acompanha', /Total: <strong>🪙 60<\/strong>/.test(S.renderCompraModal()));
  /* NAO PASSA DO TETO, nem apertando muito: o + para no maximo. */
  for(let i = 0; i < 20; i++) S.mudarQtdCompra(1);
  ok('o + nunca passa do que o dinheiro compra', S.__getGame().compraQtd === 3, String(S.__getGame().compraQtd));
  ok('e ai ele trava', /disabled[^>]*onclick="mudarQtdCompra\(1\)"/.test(S.renderCompraModal()));
  /* E nao desce abaixo de 1: comprar zero nao e uma compra. */
  for(let i = 0; i < 20; i++) S.mudarQtdCompra(-1);
  ok('e o - nunca desce abaixo de 1', S.__getGame().compraQtd === 1, String(S.__getGame().compraQtd));

  /* O MAX e o caminho de verdade num toque -- ninguem aperta o + vinte vezes. */
  S.qtdCompraMax();
  ok('o Max vai direto ao teto', S.__getGame().compraQtd === 3, String(S.__getGame().compraQtd));
  ok('e o botao de comprar diz quantos', /Comprar 3 unidades/.test(S.renderCompraModal()),
     (S.renderCompraModal().match(/Comprar [^<]*/g)||[]).join(' | '));
  S.fecharCompra();
  ok('fechar limpa o popup', S.renderCompraModal() === '');
}

console.log('\n=== A MOCHILA LE CADA ITEM DA FONTE DELE ===');
{
  /* Nao da pra derivar de um campo so: o Doce Raro e um CONTADOR da conta, o Bonus Shiny e cupom
     (save campeao / notificacao) MAIS estoque comprado, e os tres de batalha sao armazem. */
  conta({ doces: 3 });
  const g = S.__getGame();
  g.inventario = { potion: 2, bonus_shiny: 1 };
  S.__setGame(g);
  ok('o Doce Raro vem do contador', S.quantoTenho('doce_raro') === 3, String(S.quantoTenho('doce_raro')));
  ok('a pocao vem do armazem', S.quantoTenho('potion') === 2, String(S.quantoTenho('potion')));
  ok('e o Bonus Shiny soma cupom com comprado',
     S.quantoTenho('bonus_shiny') === S.cuponsDeBonusShiny().length + 1,
     S.quantoTenho('bonus_shiny') + ' (cupons: ' + S.cuponsDeBonusShiny().length + ')');
  const p = S.pilhasDoInventario();
  ok('e a mochila mostra UMA pilha por item, nao duas',
     p.filter(x => x.item === 'bonus_shiny').length === 1,
     p.map(x => x.item + ':' + x.quantidade).join(', '));
  ok('sem nenhum, o item nao aparece', !p.some(x => x.item === 'awakening'),
     p.map(x => x.item).join(', '));
}

console.log('\n=== OS ITENS COMPRADOS NA MOCHILA ===');
{
  /* Estes tem ARMAZEM de verdade (o campo inventario da conta), diferente do Doce Raro e do Bonus
     Shiny, que sao uma leitura do que a conta ja tinha. */
  conta({ doces: 0 });
  const g = S.__getGame(); g.inventario = { awakening: 2, potion: 1 }; S.__setGame(g);
  const p = S.pilhasDoInventario();
  ok('o que foi comprado aparece na mochila', p.length === 2, JSON.stringify(p.map(x=>x.item+':'+x.quantidade)));
  ok('e empilhado', (p.find(x=>x.item==='awakening')||{}).quantidade === 2);
  S.escolherItem('awakening');
  const tela = S.renderInventario();
  ok('o quadro descreve o item', tela.includes('Despertar') && tela.includes('dormir'));
  /* O "Usar" SUMIU pros tres de equipar: ele existia pra ligar um efeito na CONTA, e nao ha mais
     efeito de conta pra ligar. Sumir em silencio deixaria a pessoa procurando -- por isso a linha
     dizendo onde o item se usa tem que estar ali no lugar dele. */
  ok('e o Usar NAO esta la (o item vai num pokemon)', !/onclick="usarItem\('awakening'\)"/.test(tela));
  ok('mas a tela diz onde ele se usa', /ordem de batalha/.test(tela) && /toque no \+/.test(tela));
  /* O Doce Raro nao e de equipar e continua com o botao. */
  const g0 = S.__getGame(); g0.rareCandies = 2; S.__setGame(g0);
  S.escolherItem('doce_raro');
  ok('e o que NAO e de equipar continua com o Usar', /onclick="usarItem\('doce_raro'\)"/.test(S.renderInventario()));
}

console.log('\n=== O + DA TELA DE ORDEM ===');
{
  /* O item e do POKEMON: o + fica na linha dele, a esquerda das setas de mover -- e ali que se
     decide quem entra primeiro, e decidir quem leva o que e a mesma conversa. */
  /* O ITEM E POR POKEMON *E POR SAVE*: a chave e "slot:linha". Era so a linha, e o item vazava
     entre saves -- um Venusaur no slot 11 e outro no slot 5 sao o mesmo "venusaur" pra conta.
     Reportado em 04/09/2026. */
  conta({ doces: 0 });
  const g = S.__getGame();
  g.currentSaveSlot = 3;
  g.inventario = { awakening: 1, potion: 2 };
  g.equipados = { '3:squirtle': 'awakening' };
  S.__setGame(g);
  const semItem = S.botaoDeItemHtml({ speciesId:'charizard' });
  ok('quem nao carrega nada mostra o +', />\+<\/button>/.test(semItem), semItem);
  ok('e abre a escolha pra AQUELE pokemon, com o slot',
     /abrirEscolhaDeItem\('3','charizard'\)/.test(semItem), semItem);
  const comItem = S.botaoDeItemHtml({ speciesId:'blastoise' });
  ok('quem carrega mostra o icone do item', comItem.includes('⏰') && !/>\+<\/button>/.test(comItem), comItem);
  ok('e fica destacado', /com-item/.test(comItem), comItem);

  /* O MESMO POKEMON EM OUTRO SAVE NAO HERDA O ITEM -- e o defeito reportado em 04/09/2026: um
     Venusaur no slot 11 e outro no slot 5 sao o mesmo "venusaur" pra conta, e equipar num fazia o
     item aparecer no outro. A chave passou a ser "slot:linha". */
  const outroSave = S.botaoDeItemHtml({ speciesId:'blastoise', slot:7 });
  ok('o mesmo pokemon em OUTRO save nao herda o item', />\+<\/button>/.test(outroSave), outroSave);
  ok('e o do save dele continua com ele',
     /com-item/.test(S.botaoDeItemHtml({ speciesId:'blastoise', slot:3 })));

  /* A CAIXA lista so o que a mochila TEM: oferecer o que a pessoa nao tem seria uma fileira de
     botoes que nao clicam. */
  S.abrirEscolhaDeItem('3', 'blastoise');
  const modal = S.renderEscolhaDeItemModal();
  ok('a caixa nomeia o pokemon', /Blastoise/.test(modal));
  ok('e lista os itens da mochila com a quantidade', /Despertar/.test(modal) && /Poção/.test(modal) && /2x/.test(modal), modal.slice(0,400));
  ok('mas nao o que nao esta na mochila', !/Super Poção/.test(modal));
  ok('nem o que nao e de batalha', !/Doce Raro/.test(modal));
  ok('marca o que ele ja carrega', /btn selected[\s\S]{0,120}awakening/.test(modal), (modal.match(/btn selected[^"]*/g)||[]).join(' | '));
  ok('e oferece tirar', /desequiparItem\('3','blastoise'\)/.test(modal));

  /* O QUE ELE CARREGA JA SAIU DO ARMAZEM (equipar tira de la), entao o caso mais comum de todos e
     ter 1, equipar e ficar com 0. Filtrando so por estoque, o item DELE sumia da lista: a caixa
     dizia "esta carregando Despertar" e o Despertar nao aparecia em lugar nenhum. */
  const g3 = S.__getGame(); g3.inventario = { potion: 1 }; g3.equipados = { blastoise:'awakening' }; S.__setGame(g3);
  const zerado = S.renderEscolhaDeItemModal();
  ok('o item equipado aparece mesmo com 0 no armazem', /Despertar/.test(zerado), zerado.slice(0,600));
  ok('e diz "equipado" no lugar da quantidade', /Despertar — equipado/.test(zerado));
  /* E nao da pra reequipar o que ele ja tem: gastaria uma ida ao servidor pra nao mudar nada, e
     com 0 no armazem o servidor recusaria com "voce nao tem esse item". */
  ok('e ele nao e clicavel de novo', /btn selected[^>]*disabled/.test(zerado), (zerado.match(/btn selected[^>]*/g)||[]).join(' | '));
  /* Sem nada na mochila, a caixa diz DE ONDE os itens vem -- tela que responde "nao da" tem que
     dizer o que fazer a respeito. */
  const g2 = S.__getGame(); g2.inventario = {}; g2.equipados = {}; S.__setGame(g2);
  const vazio = S.renderEscolhaDeItemModal();
  ok('mochila vazia diz de onde os itens vem', /vêm da Loja/.test(vazio), vazio.slice(0,400));
  ok('e nao oferece tirar nada', !/desequiparItem/.test(vazio));
  S.fecharEscolhaDeItem();
  ok('fechar limpa a escolha', S.renderEscolhaDeItemModal() === '');
}

console.log('\n=== A CAIXA DO + NOMEIA OS GOLPES QUE O ITEM FORTALECE ===');
{
  /* No motor da Gen 1 quem decide se o golpe usa Ataque ou Ataque Especial e o TIPO dele -- Fogo,
     Agua, Planta, Eletrico, Psiquico, Gelo e Dragao sao especiais, o resto e fisico. Isso decide
     QUAL dos dois itens de ataque serve num pokemon, e sem dizer na tela metade das compras nao
     fazia nada. Reportado em 04/09/2026: "to colocando aqui em alguns pokemons e nao vejo nada de
     diferente".
     A tela diz o NOME do golpe, nao a palavra "fisico"/"especial": a versao que falava em categoria
     durou um dia e foi recusada por ser dificil de compreender. */
  ok('o golpe fortalecido sai do tipo do golpe', S.golpesDoItem('spatk_up','venusaur').join() === 'Raio Solar' &&
     S.golpesDoItem('atk_up','venusaur').join() === 'Bomba de Lodo',
     JSON.stringify([S.golpesDoItem('atk_up','venusaur'), S.golpesDoItem('spatk_up','venusaur')]));
  /* Os SUBTIPOS entram, que e a mesma lista que o bestAttackType escolhe: o Raichu e Eletrico
     (especial) com subtipo Normal (fisico), pra alcancar os de Terra. */
  ok('e os subtipos entram na conta', S.golpesDoItem('atk_up','raichu').length === 1 &&
     S.golpesDoItem('spatk_up','raichu').length === 1, JSON.stringify(S.golpesDoItem('atk_up','raichu')));
  /* Quem so tem golpe de um lado nao ganha nada com o item do outro -- e isso e o aviso. */
  ok('quem so ataca especial nao tem golpe fisico', S.golpesDoItem('atk_up','alakazam').length === 0);
  ok('e quem so ataca fisico nao tem especial', S.golpesDoItem('spatk_up','machamp').length === 0);
  /* NULL = nao ha o que prometer: item que nao e de ataque (o HP Up sempre vale, e os de DEFESA
     dependem de quem esta ATACANDO, nao do dono) e o Ditto, que copia o tipo de quem esta na frente. */
  ok('item que nao e de ataque nao promete golpe', S.golpesDoItem('hp_up','venusaur') === null &&
     S.golpesDoItem('def_up','venusaur') === null);
  ok('e o Ditto nunca nomeia um golpe', S.golpesDoItem('atk_up','ditto') === null &&
     S.golpesDoItem('spatk_up','ditto') === null);
  /* TODA especie do jogo tem nome pra todo golpe que ela consegue usar -- senao a caixa diria
     "Fortalece o ataque " e pararia ali. E toda uma tem golpe de algum lado. */
  {
    let semNome = 0, semLado = 0;
    Object.keys(S.SPECIES).forEach(id => {
      if(id === 'ditto') return;
      const f = S.golpesDoItem('atk_up', id), e = S.golpesDoItem('spatk_up', id);
      const tipos = S.tiposDeAtaqueDaEspecie(id);
      if(f.length + e.length !== tipos.length) semNome++;
      if(!f.length && !e.length) semLado++;
    });
    ok('as 250 especies tem nome pra todo golpe que usam', semNome === 0, semNome + ' sem nome');
    ok('e nenhuma fica sem golpe dos dois lados', semLado === 0, semLado + ' sem lado');
  }
  ok('a lista vira frase', S.listaEmPortugues(['A']) === 'A' && S.listaEmPortugues(['A','B']) === 'A e B' &&
     S.listaEmPortugues(['A','B','C']) === 'A, B e C');

  ok('o Atk Up NAO serve num atacante especial', S.itemServeNoPokemon('atk_up','alakazam') === 'nao');
  ok('e o Atk Special Up nao serve num fisico', S.itemServeNoPokemon('spatk_up','machamp') === 'nao');
  ok('mas o HP Up vale em qualquer um', S.itemServeNoPokemon('hp_up','alakazam') === 'sim' &&
     S.itemServeNoPokemon('def_up','alakazam') === 'sim');

  /* A CAIXA nomeia, e o item que nao serve continua CLICAVEL: e o pokemon do jogador e a escolha e
     dele -- o que a tela deve e avisar, nao decidir. */
  conta({ doces: 0 });
  const gp = S.__getGame();
  gp.currentSaveSlot = 0; gp.inventario = { atk_up:1, spatk_up:1, hp_up:1 }; gp.equipados = {};
  S.__setGame(gp);
  S.abrirEscolhaDeItem('0', 'venusaur');
  const cv = S.renderEscolhaDeItemModal();
  ok('a caixa diz o golpe que o Atk Special Up fortalece', cv.includes('Fortalece o ataque Raio Solar.'),
     (cv.match(/Fortalece[^<]*/g)||[]).join(' | '));
  ok('e o do Atk Up, que e outro', cv.includes('Fortalece o ataque Bomba de Lodo.'));
  ok('e o HP Up nao promete golpe nenhum', !/de HP pela batalha inteira.<br>/.test(cv));

  S.abrirEscolhaDeItem('0', 'alakazam');
  const cx = S.renderEscolhaDeItemModal();
  ok('a caixa avisa que o Atk Up nao fortalece nada ali', cx.includes('Não fortalece nenhum ataque'),
     (cx.match(/Não fortalece[^<]*/g)||[]).join(' | '));
  ok('e marca a linha do item que nao serve', /item-nao-serve/.test(cx));
  ok('mas ele continua clicavel', !/item-nao-serve[^>]*disabled/.test(cx));
  ok('e o item que SERVE leva o nome do golpe, nao o aviso',
     cx.includes('Fortalece o ataque Psíquico.') && (cx.match(/Não fortalece/g)||[]).length === 1,
     (cx.match(/item-nota">[^<]*/g)||[]).join(' | '));

  /* Quem tem MAIS DE UM golpe do mesmo lado lista os dois -- o Gengar ataca de Fantasma e de
     Veneno, os dois fisicos. */
  S.abrirEscolhaDeItem('0', 'gengar');
  ok('e lista os dois quando sao dois', /Fortalece os ataques [^<]* e [^<]*\./.test(S.renderEscolhaDeItemModal()),
     (S.renderEscolhaDeItemModal().match(/Fortalece[^<]*/g)||[]).join(' | '));

  /* A FICHA DA POKEDEX nao fala mais de fisico/especial: e vocabulario de motor, e o jogador
     recusou. Quem responde isso e a caixa do +, pelo nome do golpe. */
  S.abrirPokedexFicha('alakazam');
  const ficha = S.renderPokedexFicha();
  ok('a ficha nao fala em golpe fisico nem especial', !/ESPECIAIS<|FÍSICOS<|dois jeitos/.test(ficha),
     (ficha.match(/Ataca[^<]*/g)||[]).slice(0,1).join(''));
  /* O que a ficha continua contando e o que os seis numeros nao contam: os golpes especiais. */
  ok('e continua dizendo os golpes especiais da especie', /Recuperar/.test(ficha),
     (ficha.match(/dex-especiais[\s\S]{0,120}/)||[''])[0]);
}

console.log('\n=== A HOME ===');
{
  conta({ doces: 3 });
  const g = S.__getGame(); g.moedas = 1250; S.__setGame(g);
  const home = S.renderSaveSelect();
  ok('o contador de moedas fica no card do nome', /moeda-conta[^>]*>🪙 1250/.test(home),
     (home.match(/moeda-conta[^>]*>[^<]*/g)||[]).join(' '));
  ok('cinco cards na mesma linha', contaEm(home, /class="home-menu-card /g) === 5,
     contaEm(home, /class="home-menu-card /g) + ' cards');
  ok('mochila e loja entre eles', home.includes('openInventario()') && home.includes('openLoja()'));
  /* OS CARDS FICARAM SO COM O NOME E OS NUMEROS (04/09/2026). As frases ("Desafie quem voce
     conhece", "Em breve") eram convites de quando os cards estavam nascendo -- num card de 43px a
     320px elas eram a parte mais longa e a que menos se lia. */
  const stats = (home.match(/home-menu-stat">[^<]*/g)||[]).map(s => s.replace('home-menu-stat">',''));
  ok('a Pokedex mostra so os numeros', stats.includes('0/250'), stats.join(' | '));
  ok('e nenhuma frase sobrou nos cards',
     stats.every(s => /^\d+\/\d+$/.test(s)), stats.join(' | '));
  ok('Amigos, Mochila e Loja ficam so com o nome',
     !/Desafie quem/.test(home) && !/Seus itens/.test(home) && !/Em breve/.test(home) &&
     home.includes('>Amigos<') && home.includes('>Mochila<') && home.includes('>Loja<'));
}

console.log('\n=== O PREMIO APONTA PRA MOCHILA, NAO ATIVA NO LUGAR ===');
{
  /* A notificacao e a tela de campeao continuam sendo ONDE A PESSOA DESCOBRE que ganhou -- o que
     mudou e que elas pararam de ser o cofre. Um premio guardado em tres telas diferentes era o
     motivo de ninguem achar o que tinha. */
  const cta = S.ctaDaNotificacao ? S.ctaDaNotificacao({ type:'league_champion', id:'n1', meta:{} }) : null;
  if(cta !== null){
    ok('a notificacao manda pra mochila', cta.includes('openInventario()'), cta);
    ok('e nao ativa mais ali', !cta.includes('activateShinyBonus'), cta);
  }
}

console.log('\n=== A MOCHILA VOLTA PRA ONDE VEIO ===');
{
  /* Ela e aberta de tres lugares, e dois deles estao DENTRO de um save carregado: a notificacao de
     campeao e a tela de campeao da jornada. Um Voltar fixo pra home tirava o jogador da jornada
     pra sempre que ele fosse buscar o premio -- que e justamente o que aqueles botoes mandam fazer. */
  conta({ doces: 1 });
  const g = S.__getGame(); g.screen = 'journeyEnd'; S.__setGame(g);
  S.openInventario();
  ok('a mochila lembra de onde veio', S.__getGame().inventarioVoltarPara === 'journeyEnd',
     String(S.__getGame().inventarioVoltarPara));
  S.sairDaMochila();
  ok('e volta pra la, nao pra home', S.__getGame().screen === 'journeyEnd', S.__getGame().screen);
  ok('e o marcador e consumido', !S.__getGame().inventarioVoltarPara);
  /* Vindo da home ela volta pela porta da home, que recarrega os dados da conta -- e o que faz o
     contador de moedas e o de doces chegarem atualizados depois de usar um item. */
  const g2 = S.__getGame(); g2.screen = 'saveSelect'; S.__setGame(g2);
  S.openInventario();
  S.sairDaMochila();
  ok('vindo da home, volta pra home', S.__getGame().screen === 'saveSelect', S.__getGame().screen);
}
console.log('\n=== O HM01: A PRIMEIRA MAQUINA OCULTA (11/09/2026) ===');
{
  /* Pedido assim: "o usuario so consegue o HM01 caso nas rotas dele ele tenha escolhido a rota do
     SS Ane e ter vencido o Surge em no maximo 1 tentativa. Ai aparece a mensagem depois da luta
     dizendo que ele obteve o HM01 e o HM01 vai para a mochila".
     POR ENQUANTO ELE SO EXISTE -- nao equipa, nao destrava rota, nao faz nada. E de proposito:
     primeiro a porta, depois o que tem atras dela. */
  const g = S.__getGame();
  const limpo = h => String(h).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  /* AS DUAS PECAS DA CONDICAO JA EXISTIAM no jogo, e e isso que faz ela encaixar: o ss_anne e uma
     das duas rotas do trecho 3, e o trecho 3 e justamente o do Surge. Se qualquer um dos dois
     mudar de lugar, o HM01 fica inalcancavel EM SILENCIO -- por isso os dois sao cobrados aqui. */
  ok('a rota do S.S. Anne existe, e no trecho do Surge',
     !!S.ROUTE_MAP[2].find(r => r.id === S.HM01_ROTA), S.HM01_ROTA);
  ok('e o ginasio daquele trecho e o Lt. Surge',
     S.KANTO_GYMS[2].id === S.HM01_GINASIO, S.KANTO_GYMS[2].leaderName);

  /* A CONDICAO, caso a caso. */
  g.currentSaveSlot = 0; g.gymPath = ['kanto','kanto','kanto']; g.gymIndex = 2;
  const cond = (rota, derrotas, trecho) => {
    g.gymIndex = (trecho == null) ? 2 : trecho;
    g.routeHistory = []; g.routeHistory[g.gymIndex] = rota;
    g.losses = derrotas;
    return S.conquistouHM01();
  };
  ok('S.S. Anne + zero derrotas: ganha', cond(S.HM01_ROTA, 0) === true);
  /* "EM NO MAXIMO 1 TENTATIVA" = venceu de primeira, ou seja, nenhuma derrota naquele ginasio. */
  ok('uma derrota ja tira o HM', cond(S.HM01_ROTA, 1) === false);
  ok('e quatro derrotas tambem', cond(S.HM01_ROTA, 4) === false);
  ok('a outra rota do trecho nao da o HM', cond('diglett_cave', 0) === false);
  ok('e outro ginasio nao da, nem pela rota certa', cond(S.HM01_ROTA, 0, 1) === false);

  /* DAR O HM e IDEMPOTENTE: quem ja tem nao ganha de novo, e e isso que impede a tela de vitoria
     de anunciar o mesmo HM em toda vitoria dali pra frente. */
  g.gymIndex = 2; g.hms = [];
  ok('a primeira vez entra e avisa', S.darHM('hm01') === true && S.temHM('hm01'));
  ok('e a segunda nao avisa de novo', S.darHM('hm01') === false);
  ok('e a lista nao duplica', S.hmsDaConta().length === 1, JSON.stringify(S.hmsDaConta()));
  ok('HM que nao existe nao entra', S.darHM('hm99') === false && S.hmsDaConta().length === 1);

  /* ⚠️ A ORDEM DENTRO DO finishBattle E O QUE SUSTENTA TUDO: o `game.losses` so zera DEPOIS, na
     distribuicao de niveis. Se a condicao fosse lida de la, ela acharia zero sempre e daria o HM a
     quem perdeu quatro vezes. Isto e lido do CODIGO porque os casos acima chamam a funcao direto e
     passariam com a ordem trocada. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const i = txt.indexOf('function finishBattle()');
    const fim = txt.indexOf('\nfunction ', i + 1);
    const corpo = txt.slice(i, fim);
    ok('o finishBattle decide o HM', corpo.indexOf('conquistouHM01()') > 0);
    ok('e NAO zera o losses antes disso', corpo.indexOf('game.losses = 0') < 0,
       'o zero do losses mora na distribuicao de niveis, e e por isso que a condicao cabe aqui');
    /* O zero existe, so nao e aqui -- se ele sumir do jogo, a condicao vira sempre-verdadeira.
       COM O PONTO E VIRGULA: sem ele a regex casa tambem com a MENCAO dentro do comentario que
       explica esta mesma regra, e o teste acusa 2 onde ha 1. Foi o que aconteceu ao escreve-lo. */
    ok('e o zero do losses continua existindo em outro lugar',
       (txt.match(/game\.losses = 0;/g) || []).length === 1,
       (txt.match(/game\.losses = 0;/g) || []).length + ' atribuicoes');
  }

  /* O ANUNCIO sai do `ganhouHmAgora`, nao de "tem HM na mochila": a tela e relida a cada render. */
  g.ganhouHmAgora = 'hm01';
  ok('a vitoria anuncia o HM', /HM01/.test(S.hmGanhoHtml()) && /mochila/.test(S.hmGanhoHtml()),
     limpo(S.hmGanhoHtml()));
  g.ganhouHmAgora = null;
  ok('e sem HM ganho a vitoria nao diz nada', S.hmGanhoHtml() === '');

  /* ⚠️ A TELA SEPARADA DE TMs E HMs MORREU EM 14/09/2026: ela virou a terceira PRATELEIRA da
     mochila, quando a mochila passou a ser uma lista como a loja (a pedido). O que era tela agora
     e uma aba, e e isso que estas travas cobram. */
  g.currentSaveSlot = 0; g.hms = ['hm01']; g.inventario = {}; g.rareCandies = 0;
  S.escolherPrateleiraDaMochila('tms');
  {
    const t = S.renderInventario();
    ok('a prateleira lista o HM da conta', /HM01/.test(t) && linhas(t) === 1, limpo(t).slice(0, 70));
    /* A MAQUINA NAO SE USA NEM SE EXCLUI: ela ENSINA, e ensina quantas vezes quiser. */
    ok('e o quadro traz o botao de Ensinar', /onclick="abrirEnsinarHm\('hm01'\)"/.test(t));
    ok('sem Usar e sem Excluir', !/usarItem\(/.test(t) && !/pedirExclusaoDeItem\(/.test(t));
    ok('e a tabela nao tem mais descricao', S.HMS.hm01.descricao === undefined);
  }
  /* ⚠️ SEM NENHUM: o quadro fica EM BRANCO e a lista diz "Nenhum TM/HM" -- os dois ao pe da letra
     do pedido de 14/09/2026 (*"caso nao possua nenhum TM/HM, deixar em branco"*). A frase que
     ensinava o caminho do HM01 (S.S. Anne, Lt. Surge de primeira) SAIU no mesmo pedido. */
  g.hms = []; S.escolherPrateleiraDaMochila('tms');
  {
    const t = S.renderInventario();
    ok('sem nenhum, a lista diz exatamente "Nenhum TM/HM"', /Nenhum TM\/HM/.test(t),
       (t.match(/loja-vazia[^>]*>[^<]*/g)||[]).join(' | '));
    ok('e NAO conta mais como ganhar o HM01', !/S\.S\. Anne/.test(t) && !/Surge/.test(t));
    ok('nem diz "Nenhuma Maquina ainda"', !/Nenhuma M.quina/.test(t));
    ok('e o quadro de cima fica em branco', /class="box item-detalhe loja-fixa"><\/div>/.test(t));
    ok('mas a prateleira continua na tela, marcada como vazia',
       /escolherPrateleiraDaMochila\('tms'\)/.test(t) && /TMs\/HMs/.test(t));
  }
  /* A mochila e aberta da HOME tambem, sem save nenhum -- e ali TEM o que mostrar, porque os HMs
     sao da CONTA e nao daquela jornada. */
  g.currentSaveSlot = null; g.hms = ['hm01']; S.escolherPrateleiraDaMochila('tms');
  ok('e sem save aberto ela mostra os mesmos, porque sao da conta',
     /HM01/.test(S.renderInventario()) && !/Abra um save/.test(S.renderInventario()));
  g.currentSaveSlot = 0;

  /* ⚠️ A PORTA VOLTOU A ABRIR em 13/09/2026, quando o HM01 passou a ENSINAR o Corte -- e em
     14/09/2026 ela deixou de ser um BOTAO e virou uma PRATELEIRA, sempre visivel.
     O `abrirTmHm` FICA, apontando pra ela: ele e o que o resto do jogo chama, e um atalho que leva
     ao lugar certo e melhor que um chamador quebrado. */
  {
    g.inventario = {}; g.rareCandies = 0; g.hms = ['hm01'];
    ok('a porta das Maquinas esta aberta', S.MOSTRAR_TM_HM === true, String(S.MOSTRAR_TM_HM));
    S.escolherPrateleiraDaMochila('batalha');
    S.abrirTmHm();
    ok('o abrirTmHm leva pra prateleira das Maquinas', S.__getGame().inventarioAba === 'tms',
       String(S.__getGame().inventarioAba));
    const comHm = S.renderInventario();
    ok('e quem tem o HM01 ve a contagem na prateleira', /1 item/.test(comHm));
    ok('e o Voltar continua la', /sairDaMochila\(\)/.test(comHm));
    ok('e o HM01 continua na conta', S.temHM('hm01') === true);
    /* O `game.screen` nao e salvo, mas nada impede um caminho em memoria de ter posto 'tmhm' ali. */
    ok('e o render ainda sabe desenhar a tela tmhm',
       require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8').indexOf("case 'tmhm':") >= 0);
    /* A GRADE DE QUADRADINHOS MORREU JUNTO -- e com ela o gradeDeItensHtml e o item-slot. */
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    ok('e a grade de quadradinhos nao existe mais',
       !/function gradeDeItensHtml/.test(cli) && !/class="item-slot/.test(cli));
    ok('nem a tela separada de TMs e HMs', !/function renderTmHm/.test(cli));
  }

  /* ⚠️ O HM E DA CONTA, NAO DO SAVE (11/09/2026, a pedido: "depois que qualquer save conseguiu ele,
     ele fica permanentemente na conta do usuario"). Ele nasceu por save, e o pedido inverteu isso --
     a consequencia aceita e que a condicao do HM01 virou um aro de UMA VEZ SO por conta.
     Ele mora em users/{uid}.hms, escrito pelo CLIENTE: nao esta na trava de campos do
     firestore.rules, que guarda os que dao poder de compra. E o mesmo nivel de confianca do
     badgesEarned, que tambem e conquista e tambem e livre pro dono. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    /* A FORMA DO serializeGame, e nao so "hms: game.hms": a gravacao na CONTA usa as mesmas
       palavras, e uma regex frouxa aqui falha em cima do proprio conserto. */
    ok('o hms NAO e mais serializado no save', !/hms: game\.hms \|\| \[\]/.test(txt));
    ok('nem lido do save', !/game\.hms = Array\.isArray\(data\.hms\)/.test(txt));
    ok('ele e lido do documento da CONTA', /game\.hms = Array\.isArray\(d\.hms\)/.test(txt));
    ok('e gravado no documento da CONTA', /set\(\{ hms: game\.hms \}/.test(txt));
    /* ⚠️ E ELE PRECISA ESTAR NO CAMPOS_DA_CONTA: o resetGame tira um instantaneo desses campos e
       restaura depois, entao um campo de conta que fique fora dele SOME ao abrir outro save --
       silenciosamente, e so pra quem tem mais de um. */
    ok('e esta no CAMPOS_DA_CONTA, senao sumiria ao trocar de save',
       /'hms'\s+\/\/ as Máquinas Ocultas/.test(txt));
    /* JORNADA NOVA NAO ZERA MAIS: era isso que o tornava por save. */
    ok('e jornada nova NAO zera mais os HMs', !/game\.hms = \[\];\s+\/\/ HM é conquista/.test(txt));
  }

  /* ⚠️ O GOLPE `cut` FOI CADASTRADO A MAO (13/09/2026) -- ele e o UNICO da tabela que nao veio do
     gerador, porque a base e aprendizado por NIVEL e HM ninguem aprende por nivel (mesmo caso do
     `surf`). Sem ele o HM01 nao teria o que ensinar.
     E O NOME BRIGAVA: o jogo ja chamava o `slash` de "Corte". O `slash` virou "Talho" -- que e o
     nome oficial dele em portugues -- e o "Corte" ficou com quem e o Corte. Dois golpes de nomes
     iguais no log, um de poder 70 com critico alto e outro de 50, seria indistinguivel de defeito. */
  ok('o golpe cut EXISTE na tabela de golpes', !!S.GOLPES['cut'], JSON.stringify(S.GOLPES['cut']));
  ok('ele e Normal, poder 50 (os valores da Gen 1/2/3)',
     S.GOLPES['cut'][0] === 'Normal' && S.GOLPES['cut'][1] === 50);
  ok('e ele se chama Corte', S.nomeDoAtaque('cut') === 'Corte');
  /* ⚠️ ELE NAO PODE ENTRAR NO GOLPES_IDS: aquele array e INDEXADO pelo APRENDIZADO (as entradas
     sao [nivel, indice]), entao um id a mais no meio trocaria o moveset das 250 especies em
     silencio. E ninguem o aprende por nivel, entao ele nao tem o que fazer la. */
  ok('e NAO esta no GOLPES_IDS, que e indexado pelo APRENDIZADO', S.GOLPES_IDS.indexOf('cut') < 0);
  ok('o slash virou Talho', S.nomeDoAtaque('slash') === 'Talho');
  ok('e ele continua sendo o de critico alto, nao o Corte',
     S.GOLPES_CRIT_ALTO.indexOf('slash') >= 0 && S.GOLPES_CRIT_ALTO.indexOf('cut') < 0);
  ok('o item carrega o prefixo HM01', /^HM01/.test(S.HMS.hm01.nome), S.HMS.hm01.nome);
  ok('e ele aponta pro golpe que ensina', S.HMS.hm01.golpe === 'cut');

  /* ===== A MAQUINA ENSINA (13/09/2026) ===== */
  {
    /* A LISTA DOS 72 saiu do learnsets.ts do Showdown pela tag de maquina da Gen 3 (`3M`), nao foi
       escrita de cabeca. O que se tranca aqui e o FORMATO dela e as tres surpresas que a intuicao
       erra -- uma lista que envelhecer calada e o defeito que este projeto mais evita. */
    ok('sao 72 especies que aprendem o Corte', S.CORTADORES.length === 72, String(S.CORTADORES.length));
    ok('todas existem no SPECIES', S.CORTADORES.every(id => !!S.SPECIES[id]),
       S.CORTADORES.filter(id => !S.SPECIES[id]).join(','));
    ok('nenhuma repetida', new Set(S.CORTADORES).size === S.CORTADORES.length);
    ok('cinco dos sete iniciais cortam',
       ['bulbasaur','charmander','chikorita','cyndaquil','totodile'].every(S.podeAprenderCorte));
    ok('e a linha do Squirtle e o Pichu NAO',
       !S.podeAprenderCorte('squirtle') && !S.podeAprenderCorte('blastoise') && !S.podeAprenderCorte('pichu'));
    /* Os quatro lendarios FICAM, porque e o que o dado diz -- a mesma decisao do Lugia no
       RECUPERACAO e no REMOINHO. O Celebi e INTOCAVEL, entao a entrada dele nao roda hoje. */
    ok('os lendarios que o dado traz ficam na lista',
       ['raikou','entei','suicune','celebi'].every(S.podeAprenderCorte));

    /* SABER CORTAR E DA INSTANCIA, nao da especie: dois Scyther do mesmo treinador podem estar um
       com e outro sem. */
    const semCorte = { speciesId:'scyther', ataques:['slash','wingattack'] };
    const comCorte = { speciesId:'scyther', ataques:['cut','wingattack'] };
    ok('sabeCortar le a instancia, nao a especie', !S.sabeCortar(semCorte) && S.sabeCortar(comCorte));
    ok('timeQueCorta acha um so no time', S.timeQueCorta([semCorte, comCorte]) && !S.timeQueCorta([semCorte]));

    /* A TELA: todos os pokemons de TODOS os saves, porque a Maquina e da CONTA. */
    const mk = (id, lv, ats) => ({ id:'m'+id, speciesId:id, name:S.SPECIES[id].name, level:lv, ataques:ats });
    g.currentSaveSlot = null; g.team = [];
    g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
    g.saveSlots[0] = { customName:'Kanto', team:[
      mk('venusaur', 60, ['solarbeam','sludgebomb','bodyslam']),
      mk('blastoise', 60, ['hydropump']),
      mk('scyther', 48, ['slash','wingattack','furycutter']) ] };
    g.saveSlots[3] = { team:[ mk('meganium', 55, ['bodyslam']), mk('alakazam', 55, ['psychic']) ] };
    g.hms = ['hm01'];
    S.abrirEnsinarHm('hm01');
    ok('a Maquina abre a tela de escolher o alvo', g.screen === 'hmAlvo', g.screen);
    const cands = S.candidatosDaMaquina('hm01');
    ok('ela atravessa os saves', cands.map(c => c.nome).join(',') === 'Venusaur,Scyther,Meganium',
       cands.map(c => c.nome + '@' + c.slot).join(' '));
    ok('e o Blastoise e o Alakazam ficam de fora, porque nao aprendem',
       !cands.some(c => c.nome === 'Blastoise' || c.nome === 'Alakazam'));

    /* ⚠️ A TELA E POR TIME, EM DOIS NIVEIS (13/09/2026, a pedido): *"nao exiba pokemon por pokemon,
       exiba time por time, assim como fica na tela home, porem so exiba no card do time os pokemons
       que podem aprender o HM01, e quando clicar no time, ai sim abre a lista"*.
       Com 20 slots, a lista corrida vira uma parede de dezenas de linhas onde a unica pista de onde
       cada um mora e uma legenda pequena. */
    const times = S.timesDaMaquina('hm01');
    ok('so os times que tem alguem pra ensinar viram card',
       times.map(t => t.slot).join(',') === '0,3', times.map(t => t.slot).join(','));
    const n1 = S.renderHmAlvo();
    ok('o card e o MESMO da home', (n1.match(/save-slot-card/g) || []).length === 2 &&
       /team-avg-star/.test(n1), (n1.match(/save-slot-card/g) || []).length + ' cards');
    ok('e ele NAO lista pokemon direto', !/hm-alvo/.test(n1));
    ok('a fileira do card traz SO quem pode aprender (2 de 3 no time Kanto)',
       (n1.match(/save-slot-mon-sprite/g) || []).length === 3,
       (n1.match(/save-slot-mon-sprite/g) || []).length + ' sprites (2 do Kanto + 1 do Time 4)');
    ok('e ela nomeia os times', /Kanto/.test(n1) && /Time 4/.test(n1));
    /* NIVEL 2: clicar no time abre a lista dele */
    S.abrirTimeDaMaquina(0);
    const n2 = S.renderHmAlvo();
    ok('o nivel 2 lista os pokemons daquele time', (n2.match(/hm-alvo"/g) || []).length === 2,
       (n2.match(/hm-alvo"/g) || []).length + ' linhas');
    ok('e so os DAQUELE time', /Venusaur/.test(n2) && /Scyther/.test(n2) && !/Meganium/.test(n2));
    ok('com volta pros times', /voltarAosTimesDaMaquina/.test(n2));
    S.voltarAosTimesDaMaquina();
    ok('e a volta desenha os times de novo', /Ensinar em qual time/.test(S.renderHmAlvo()));
    /* ⚠️ QUANDO O ULTIMO CANDIDATO DO TIME APRENDE, a tela volta sozinha pros times: uma lista
       vazia ali nao diria nada que o anuncio na tela de cima nao diga melhor. */
    S.abrirTimeDaMaquina(3);
    const soUm = S.candidatosDaMaquina('hm01', 3);
    S.escolherAlvoDaMaquina(3, soUm[0].idx);
    ok('o ultimo candidato do time faz a tela voltar pros times',
       /Ensinar em qual time/.test(S.renderHmAlvo()) && /aprendeu Corte/.test(S.renderHmAlvo()));
    /* e o Meganium desse teste ja aprendeu -- o bloco de baixo refaz o cenario */
    g.saveSlots[3].team[0].ataques = ['bodyslam'];

    /* QUEM TEM VAGA APRENDE SEM PERGUNTAR -- a mesma regra da fila de aprendizado por nivel. */
    const vaga = cands.find(c => c.nome === 'Meganium');
    S.abrirTimeDaMaquina(vaga.slot);
    S.escolherAlvoDaMaquina(vaga.slot, vaga.idx);
    ok('quem tem vaga aprende sem tela de troca', g.screen === 'hmAlvo', g.screen);
    ok('e o Corte entrou', g.saveSlots[3].team[0].ataques.join(',') === 'bodyslam,cut',
       g.saveSlots[3].team[0].ataques.join(','));
    ok('e a tela ANUNCIA quem aprendeu', /Meganium/.test(S.renderHmAlvo()) && /aprendeu Corte/.test(S.renderHmAlvo()));

    /* QUEM ESTA CHEIO ESCOLHE o que sai -- e o retirado e RECUSADO, senao ele voltava pela fila de
       aprendizado no proximo nivel e voltaria pra sempre (o carrossel infinito de 09/09/2026). */
    const cheio = S.candidatosDaMaquina('hm01').find(c => c.nome === 'Scyther');
    S.abrirTimeDaMaquina(cheio.slot);
    S.escolherAlvoDaMaquina(cheio.slot, cheio.idx);
    ok('quem tem 3 golpes cai na tela de troca', g.screen === 'hmTroca', g.screen);
    ok('ela mostra o Corte e os tres dele',
       /quer aprender Corte/.test(S.renderHmTroca()) && (S.renderHmTroca().match(/ensinarOGolpeDaMaquina/g) || []).length === 3);
    S.ensinarOGolpeDaMaquina('slash');
    const sc = g.saveSlots[0].team[2];
    ok('o Corte entrou no lugar do escolhido', sc.ataques.join(',') === 'cut,wingattack,furycutter', sc.ataques.join(','));
    ok('e o retirado ficou RECUSADO, senao ele volta pra sempre',
       (sc.ataquesRecusados || []).indexOf('slash') >= 0, (sc.ataquesRecusados || []).join(','));
    ok('quem ja sabe sai da lista', !S.candidatosDaMaquina('hm01').some(c => c.nome === 'Scyther'));

    /* A MAQUINA NAO SE GASTA: ela e da conta e ensina quantas vezes quiser, como no jogo original. */
    ok('a Maquina continua na conta depois de ensinar duas vezes', S.temHM('hm01') === true);

    /* ⚠️ O SLOT ABERTO LE O game.team, NAO a copia do saveSlots -- sem isso um pokemon capturado
       nesta sessao nao apareceria, e pior: os INDICES das duas listas deixariam de bater e o Corte
       iria parar no pokemon errado. */
    g.currentSaveSlot = 0;
    g.team = [ mk('charizard', 70, ['flamethrower']), mk('pidgeot', 66, ['fly']) ];
    ok('com o save aberto, a fonte e o game.team', S.timeDoSlot(0)[0].speciesId === 'charizard');
    const c2 = S.candidatosDaMaquina('hm01').filter(c => c.slot === 0);
    ok('e a lista mostra o time VIVO', c2.map(c => c.nome).join(',') === 'Charizard', c2.map(c => c.nome).join(','));
  }

  /* ===== O CORTE E UM GOLPE DE VERDADE, e e por isso que o desenho "ensinar" ganha do "equipar" ===== */
  {
    /* ELE SOBREVIVE A EVOLUCAO: o tryEvolve nao encosta no campo `ataques`, e o `ataquesEscolhiveis`
       inclui "o que ele ja carrega" -- a mesma correcao de 09/09/2026 que salvou o Raio de Bolhas da
       Staryu. Se um dia isso mudar, o Corte some do pokemon sem nada avisando. */
    const p = S.createInstance('charmeleon', 35);
    p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp;
    p.ataques = ['cut','flamethrower','slash'];
    p.nivelDosAtaques = 35; p.especieDosAtaques = 'charmeleon';
    g.team = [p];
    p.level = 36; S.tryEvolve(p);
    ok('o Corte sobrevive a evolucao', p.speciesId === 'charizard' && p.ataques.indexOf('cut') >= 0,
       p.name + ': ' + p.ataques.join(','));
    ok('e ele continua escolhivel na forma nova', S.ataquesEscolhiveis(p).indexOf('cut') >= 0);

    /* O NPC NUNCA TEM CORTE: o equiparNpc da o moveset da ESPECIE, que sai do APRENDIZADO -- e o
       `cut` nao esta la (ninguem o aprende por nivel). Ou seja, so o jogador corta. */
    const npc = [S.createInstance('scyther', 50)];
    S.equiparNpc(npc);
    ok('o NPC nunca tem o Corte', (npc[0].ataques || []).indexOf('cut') < 0, (npc[0].ataques||[]).join(','));

    /* ⚠️ O GERADOR DE TABELAS PRECISA SABER DO `cut`: sem o A_MAO, regenerar as tabelas o APAGA em
       silencio e o HM01 fica sem nada pra ensinar. A trava LE O CODIGO do gerador, porque os casos
       acima leem a tabela ja gerada e passariam com o gerador quebrado. */
    const ger = require('fs').readFileSync(path.join(raiz, 'tools', 'gerar-tabelas-golpes.js'), 'utf8');
    ok('o gerador emite o cut a mao', /const A_MAO = \{ cut: \{ tipo:'Normal', poder:50 \} \}/.test(ger));
    ok('e o nome PT dele esta no golpes-pt.json', require(path.join(raiz, 'tools', 'golpes-pt.json')).cut === 'Corte');
    ok('e o slash cedeu o nome', require(path.join(raiz, 'tools', 'golpes-pt.json')).slash === 'Talho');
  }

  /* ===== ⚠️ A GRAVACAO NAO PODE ENCOSTAR NA TELA (13/09/2026) =====
     Reportado: *"eu tava na tela que apareceu a nova rota ... fui no Mochila e ensinei para ele,
     quando voltei para o save ... ja tinha avancado o estagio do save ... pulou a etapa de eu
     escolher uma rota, capturar pokemons da rota, foi direto para enfrentar o ginasio"*.
     A causa: a mochila e aberta da HOME, e ir pra home NAO descarrega o save -- so o game.screen
     muda. O saveCurrentGame() gravava o serializeGame() INTEIRO, entao screen:"hmAlvo" ia por cima
     da tela em que a jornada estava. */
  {
    let escrito = null;
    const refVelha = S.saveDocRef;
    S.saveDocRef = () => ({ set: async (d) => { escrito = d; } });
    const mk2 = (id, lv, ats) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; p.ataques = ats; return p; };
    g.authUser = { uid:'u1' };
    g.currentSaveSlot = 2; g.gymIndex = 4; g.saveGen = 0;
    g.team = [ mk2('persian', 40, ['feintattack','payday','slash']) ];
    g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
    g.saveSlots[2] = { team: g.team, customName:'Jornada 3' };
    g.hms = ['hm01'];
    /* o jogador foi pra home e abriu a mochila -- o save continua carregado em memoria */
    g.screen = 'inventario';
    S.abrirEnsinarHm('hm01');
    S.abrirTimeDaMaquina(2);
    const alvo = S.candidatosDaMaquina('hm01', 2)[0];
    S.escolherAlvoDaMaquina(2, alvo.idx);
    S.ensinarOGolpeDaMaquina('slash');
    /* o ensinarOGolpeDaMaquina e async, mas o corpo roda sincrono ate a gravacao -- entao o
       stub ja recebeu o documento aqui, sem precisar ceder a volta do laco */
    ok('a gravacao escreve SO o team', escrito && Object.keys(escrito).join(',') === 'team',
       Object.keys(escrito || {}).join(','));
    ok('e NAO grava a tela, que era o que pulava a rota', !(escrito && 'screen' in escrito));
    ok('o golpe foi gravado', escrito.team[0].ataques.indexOf('cut') >= 0, escrito.team[0].ataques.join(','));
    ok('e o game.team em memoria tem o mesmo', g.team[0].ataques.indexOf('cut') >= 0);
    S.saveDocRef = refVelha;
  }

  /* ===== ⚠️ O GOLPE DE MAQUINA NAO SE DESAPRENDE (13/09/2026) =====
     Reportado: *"o HM01 nao pode ser desaprendido, acabei de ensinar para um Persian, e depois ele
     aprendeu Talho e eu consegui tirar o corte"*. E assim no jogo original, e aqui ele e mais que
     um golpe: e a CHAVE da Mata Fechada. */
  {
    const p = g.team[0];
    ok('a lista sai dos HMs, nao e o cut escrito a mao',
       S.ehGolpeDeMaquina('cut') && !S.ehGolpeDeMaquina('slash') && !S.ehGolpeDeMaquina('tackle'));
    g.aprenderAtaque = { id: p.id, golpe: 'hyperbeam' };
    const tela = S.renderAprenderAtaque();
    const ofertas = (tela.match(/responderAprendizado\('([a-z]+)'\)/g) || []).map(x => x.match(/'([a-z]+)'/)[1]);
    ok('a tela de troca por nivel NAO oferece o Corte', ofertas.indexOf('cut') < 0, ofertas.join(','));
    ok('e continua oferecendo os comuns', ofertas.length === 2, ofertas.join(','));
    ok('e ela explica por que ele nao esta la', /de M.quina e n.o pode ser esquecido/.test(tela));
    /* quem VALIDA e a ACAO: um clique forjado nao pode tirar o HM */
    S.responderAprendizado('cut');
    ok('forcar a acao com o Corte nao faz nada', p.ataques.indexOf('cut') >= 0, p.ataques.join(','));
    ok('e a fila nao anda (continua perguntando)', !!g.aprenderAtaque);
    /* ⚠️ E ELE NAO PODE TRAVAR A FILA. O bot do smoke le o ESTADO e nao a tela: ele escolhia o
       golpe mais fraco de p.ataques, caia no Corte (poder 50), a acao recusava em silencio e a
       jornada travava nesta tela ate o MAX_STEPS -- 72 falhas em 100 jornadas. A regra passou a
       viver numa funcao so (ataquesTrocaveis), lida pela TELA, pela ACAO e pelo BOT. */
    ok('ataquesTrocaveis e a mesma lista que a tela desenha',
       S.ataquesTrocaveis(p).join(',') === ofertas.join(','), S.ataquesTrocaveis(p).join(','));
    ok('e ela NUNCA fica vazia com um HM so e ' + S.MAX_GOLPES + ' slots',
       S.ataquesTrocaveis(p).length > 0);
    S.responderAprendizado('payday');
    ok('mas trocar um golpe COMUM continua funcionando',
       p.ataques.indexOf('hyperbeam') >= 0 && p.ataques.indexOf('cut') >= 0, p.ataques.join(','));
  }
}
console.log('\n=== O ! DO BOTAO DAS LIGAS ===');
{
  /* Pedido em 13/09/2026: *"coloque um sinal de ! (igual quando tem notificacao) no botao de ligas
     onlines, quando o treinador ainda nao esta inscrito em nenhuma liga"*. */
  const g = S.__getGame();
  g.trainerName = 'Buzzo';
  g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
  g.notificationsUnreadCount = 0; g.friendRequestCount = 0;
  const selosNoBotao = () => {
    const h = S.renderSaveSelect();
    /* conta o selo DENTRO do botao das ligas, e nao na home inteira -- o sino e o card de Amigos
       tambem usam o `.notif-badge`, e um teste que contasse todos daria verde por acaso. */
    const i = h.indexOf('openLeagueTypesList()');
    const fim = h.indexOf('</button>', i);
    return (h.slice(i, fim).match(/notif-badge/g) || []).length;
  };
  g.avisoLiga = null; S.__setGame(g);
  ok('sem liga aberta (ou ja inscrito), nao ha selo', selosNoBotao() === 0, selosNoBotao() + ' selo(s)');
  g.avisoLiga = { hora: Date.now() + 3600000 }; S.__setGame(g);
  ok('com liga aberta e ele de fora, o selo aparece', selosNoBotao() === 1, selosNoBotao() + ' selo(s)');
  {
    const h = S.renderSaveSelect();
    const i = h.indexOf('openLeagueTypesList()');
    ok('e ele e um ! (o mesmo selo do sino)', /notif-badge">!</.test(h.slice(i, h.indexOf('</button>', i))));
  }
  /* ⚠️ O SELO E `position:absolute`: sem um ancestral posicionado ele se pendura no canto da PAGINA
     em vez do canto do botao. Isso nao aparece em asserção de HTML nenhuma -- por isso o teste le o
     CSS. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const bloco = (txt.match(/\.leagues-big-btn\{[\s\S]*?\}/) || [''])[0];
    ok('o botao e a ancora do selo (position:relative)', /position:relative/.test(bloco));
  }
  /* ⚠️ E A HOME PRECISA CALCULAR O AVISO. Ele so rodava dentro do runBattle (pro botao de busca
     online das telas de batalha), entao na home o valor era o que tinha sobrado da ultima jornada --
     o `!` so apareceria depois de o jogador ter batalhado. O teste le o codigo porque os casos acima
     escrevem o `avisoLiga` na mao e passariam com a chamada ausente. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const bloco = (txt.match(/function openSaveSelect\(\)[\s\S]*?\n\}/) || [''])[0];
    ok('a home chama o atualizarAvisoDaLiga', /atualizarAvisoDaLiga\(\)/.test(bloco), bloco.length + ' chars');
  }
  g.avisoLiga = null; S.__setGame(g);
}
/* Este bloco pergunta a "rede" (trocada por um dublê) e por isso e o unico com await -- o arquivo e
   CommonJS, entao o fim do teste mora dentro dele. */
(async function(){
console.log('\n=== O AVISO DE VERSAO NOVA NA HOME ===');
{
  /* ⚠️ SANDBOX PROPRIO, e nao o do resto do arquivo. Este bloco e o unico que depende de estado de
     MODULO -- a impressao que ESTA aba carregou e a folga da pergunta --, e o resto do teste deixa
     promessas de openSaveSelect pendentes: quando o primeiro await cede, elas rodam, e uma delas
     tambem pergunta a versao e rouba a primeira resposta (a que define "a minha versao"). Com
     sandbox proprio nao ha o que atrapalhar, e a interferencia nao volta no dia em que alguem
     acrescentar um caso acima. */
  const S = createSandbox();
  /* Pedido em 13/09/2026: *"caso algum usuario esteja jogando em uma versao que nao e a mais atual,
     aparecer um botao de 'Atualizar para versao mais recente'"*.
     O `index.html` vai com no-cache, entao quem ABRE a pagina depois do deploy ja pega a versao
     nova. O buraco e a ABA QUE FICOU ABERTA -- o jogo e um arquivo so, e quem deixa o jogo aberto
     continua no codigo velho ate dar F5. Isso ja custou um relatorio de bug de um defeito que ja
     estava consertado. */
  const g = S.__getGame();
  g.trainerName = 'Buzzo';
  g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
  g.saveSlotsCarregados = true; g.versaoNova = false;
  S.__setGame(g);

  /* A impressao e o ETag do proprio index.html -- e por isso que nao existe numero de versao pra
     ninguem lembrar de subir. Aqui a rede e trocada por uma que devolve a impressao que o teste
     quiser. */
  let impressao = 'v-antiga';
  S.fetch = () => Promise.resolve({ ok:true, headers:{ get:(h)=> h === 'ETag' ? impressao : null } });
  /* Relogio que anda 10 min a cada olhada, pra cada pergunta cair fora da folga de 1 min. Ele e
     posto no Date DESTE sandbox (um objeto proprio), e nao no global: o `Date` que o sandbox recebe
     e o do processo, entao mexer no `now` dele mexeria no relogio do teste inteiro. */
  /* ⚠️ O RELOGIO FALSO COMECA ACIMA DO RELOGIO DE VERDADE. O script marca a primeira pergunta no
     CARREGAMENTO, com o Date.now() real -- um relogio de teste comecando em 5.000.000 fica bilhoes
     de milissegundos ATRAS dele, e ai toda pergunta cai dentro da folga e nenhuma vai a rede. */
  let t = Date.now() + 3600000;
  S.Date = Object.assign(Object.create(Date), { now: () => (t += 10*60*1000) });

  const temBotao = () => S.renderSaveSelect().indexOf('atualizarParaVersaoNova()') >= 0;
  ok('sem nada novo no ar, nao ha botao nenhum', !temBotao());

  /* A PRIMEIRA resposta E a versao desta aba -- ela nao avisa nada. */
  await S.conferirVersaoNoAr();
  ok('a primeira pergunta so guarda a versao desta aba, sem avisar',
     !S.__getGame().versaoNova && !temBotao());

  await S.conferirVersaoNoAr();
  ok('e enquanto a impressao for a mesma, nada aparece', !temBotao());

  /* ⚠️ O DEPLOY: a impressao muda. */
  impressao = 'v-nova';
  await S.conferirVersaoNoAr();
  ok('saiu versao nova -> o botao aparece', temBotao());
  ok('e com o texto pedido, palavra por palavra',
     S.renderSaveSelect().indexOf('Atualizar para versão mais recente') >= 0);

  /* ⚠️ ELE VEM ANTES DE TUDO: o que esta velho e o JOGO INTEIRO. */
  {
    const h = S.renderSaveSelect();
    ok('e ele vem antes do cabecalho da home',
       h.indexOf('atualizarParaVersaoNova()') < h.indexOf('home-header'),
       'aviso em ' + h.indexOf('atualizarParaVersaoNova()') + ', cabecalho em ' + h.indexOf('home-header'));
  }

  /* ⚠️ A MINHA VERSAO NUNCA E ATUALIZADA: senao a comparacao deixaria de significar "saiu coisa
     nova DESDE que eu carreguei", e o aviso sumiria sozinho na pergunta seguinte. */
  { const j = S.__getGame(); j.versaoNova = false; S.__setGame(j); }
  await S.conferirVersaoNoAr();
  ok('a versao desta aba nao se atualiza sozinha (o aviso volta)', temBotao());

  /* O BOTAO RECARREGA. O sandbox anota o reload em vez de executar. */
  const antes = (S.__recargas || []).length;
  S.atualizarParaVersaoNova();
  ok('o botao recarrega a pagina', (S.__recargas || []).length === antes + 1,
     (S.__recargas || []).length + ' recarga(s)');

  /* SEM REDE nao se afirma nada: um aviso falso mandaria o jogador recarregar a toa. */
  { const j = S.__getGame(); j.versaoNova = false; S.__setGame(j); }
  S.fetch = () => Promise.reject(new Error('sem rede'));
  await S.conferirVersaoNoAr();
  ok('sem rede, o aviso nao aparece', !temBotao());
  S.fetch = () => Promise.resolve({ ok:false, headers:{ get:()=>null } });
  await S.conferirVersaoNoAr();
  ok('e resposta ruim tambem nao', !temBotao());

  /* A FOLGA: ir e voltar na home nao vira uma pergunta por clique. */
  {
    let idas = 0;
    /* Relogio PARADO e bem a frente da ultima pergunta: a primeira chamada cai FORA da folga (e
       vai a rede) e as duas seguintes caem dentro (e nao vao). Parado num instante ANTERIOR, as tres
       ficariam dentro da folga e o caso passaria sem provar nada. */
    const parado = Date.now() + 10 * 3600000;
    S.Date = Object.assign(Object.create(Date), { now: () => parado });
    S.fetch = () => { idas++; return Promise.resolve({ ok:true, headers:{ get:()=>'v-nova' } }); };
    await S.conferirVersaoNoAr(); await S.conferirVersaoNoAr(); await S.conferirVersaoNoAr();
    ok('a pergunta tem folga de 1 minuto: 3 chamadas, 1 ida a rede', idas === 1 && S.CHECAGEM_DE_VERSAO_MS === 60000,
       idas + ' ida(s) a rede, folga de ' + S.CHECAGEM_DE_VERSAO_MS + 'ms');
  }

  /* ⚠️ E O AVISO SOBREVIVE A ABRIR UM SAVE: ele e da ABA, nao do save. Sem estar no CAMPOS_DA_CONTA
     o resetGame o apagaria e o botao sumiria ate a proxima pergunta. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const bloco = (txt.match(/const CAMPOS_DA_CONTA = \[[\s\S]*?\];/) || [''])[0];
    ok('o aviso esta na lista de campos da conta', /'versaoNova'/.test(bloco));
  }
  /* ⚠️ E A HOME E QUEM PERGUNTA -- os casos acima chamam a funcao na mao e passariam com a chamada
     orfa. O botao so existe na home porque so ali recarregar nao custa nada. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const bloco = (txt.match(/function openSaveSelect\(\)[\s\S]*?\n\}/) || [''])[0];
    ok('e a home pergunta de verdade', /conferirVersaoNoAr\(\)/.test(bloco), bloco.length + ' chars');

    /* ⚠️ A PERGUNTA DO CARREGAMENTO VEM DEPOIS DAS DECLARACOES. `let`/`const` sao zona morta
       temporal, e a funcao le o CHECAGEM_DE_VERSAO_MS: chamada antes, ela estoura "Cannot access
       ... before initialization" -- e como ela e `async`, isso nao aparece na cara: vira uma
       promessa rejeitada em silencio, e a versao desta aba nunca e capturada.
       E O MESMO DEFEITO QUE TRAVOU AS QUATRO TELAS DE REVELACAO em 09/09/2026, e eu o repeti aqui
       no mesmo dia em que o consertei. Nenhum teste de comportamento pega isso (os casos acima
       chamam a funcao na mao, ja com tudo declarado) -- so a ordem no arquivo. */
    const decl = txt.indexOf('const CHECAGEM_DE_VERSAO_MS');
    const carga = txt.indexOf('\nconferirVersaoNoAr();');
    ok('a pergunta do carregamento vem DEPOIS das declaracoes', decl > 0 && carga > decl,
       'declaracao em ' + decl + ', chamada em ' + carga);

    /* ⚠️ E A VERIFICACAO DE VERSAO VIVE NUM LUGAR SO (13/09/2026). Existia um segundo mecanismo,
       anterior a este, que BAIXAVA O ARQUIVO INTEIRO e tirava o SHA-256 a cada 5 minutos -- 1,45 MB
       por consulta, por aba aberta. Os dois faziam a mesma pergunta; o velho saiu e a FAIXA dele
       ficou, lendo a mesma marca. */
    ok('o mecanismo que baixava o arquivo inteiro nao existe mais',
       txt.indexOf('__initialPageHash') < 0 && txt.indexOf('__checkForNewVersion') < 0);
    ok('e a faixa do topo continua, com a MESMA acao do quadro da home',
       /id="version-banner"/.test(txt) && /atualizarParaVersaoNova\(\)"?>Atualizar agora/.test(txt));
    /* A ronda de fundo e quem acende a faixa pra quem nao passa pela home. */
    ok('a ronda de fundo existe e usa a pergunta barata',
       /setInterval\(conferirVersaoNoAr, RONDA_DE_VERSAO_MS\)/.test(txt));
    /* ⚠️ E O RENDER SO ACONTECE NA HOME: o aviso chega por um TIMER, e um render() no meio de uma
       animacao de batalha mata a transicao da barra de vida. */
    const mostrar = (txt.match(/function mostrarAvisoDeVersao\(\)[\s\S]*?\n\}/) || [''])[0];
    ok('o aviso so redesenha a tela na home', /screen === 'saveSelect'\) render\(\)/.test(mostrar),
       mostrar.replace(/\s+/g, ' ').slice(0, 140));
  }

  /* A FAIXA ACENDE JUNTO COM O QUADRO -- sao duas portas pro mesmo aviso, nao dois avisos. */
  {
    const j = S.__getGame(); j.versaoNova = false; j.screen = 'saveSelect'; S.__setGame(j);
    S.fetch = () => Promise.resolve({ ok:true, headers:{ get:()=>'v-outra-ainda' } });
    S.Date = Object.assign(Object.create(Date), { now: () => Date.now() + 20 * 3600000 });
    const faixa = S.document.getElementById('version-banner');
    faixa.style.display = 'none';
    await S.conferirVersaoNoAr();
    ok('o aviso acende a faixa do topo tambem', faixa.style.display === 'flex',
       'display: ' + faixa.style.display);
    ok('e marca o quadro da home junto', S.__getGame().versaoNova === true);
  }
}

console.log('\n=== O ITEM EQUIPADO NAO VAZA MAIS ENTRE SAVES (14/09/2026) ===');
{
  /* Reportado: *"se eu equipo um pikachu no slot 3 com uma pocao, esta exibindo que o pikachu do
     slot 7 tambem ta com pocao"*.
     ⚠️ A CAUSA ERA UM CARIMBO QUE GRUDAVA: o equiparItens escrevia `p.slotDaConta` so quando o
     campo era null, e a INSTANCIA vai pro save. Um Pikachu equipado no slot 3 gravava
     `slotDaConta:"3"` dentro do save dele, e dali em diante toda leitura daquele pokemon procurava
     o item do SLOT 3 -- inclusive a do Pikachu de outro save, porque a chave e "slot:linha". */
  const g = S.__getGame();
  const mk = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; return p; };

  g.equipados = { '3:pichu': 'potion' };
  /* O CASO DO RELATO, com o carimbo velho ja gravado no save do slot 7 */
  const visto = {};
  for(const slot of [3, 7]){
    g.currentSaveSlot = slot;
    const p = mk('pikachu', 30); p.slotDaConta = '3';   // o carimbo velho, gravado numa sessao antiga
    g.team = [p];
    S.equiparItens(g.team, g.equipados, g.currentSaveSlot);
    visto[slot] = /com-item/.test(S.botaoDeItemHtml(g.team[0]));
  }
  ok('o slot que equipou mostra o item', visto[3] === true);
  ok('e o MESMO pokemon em outro save nao mostra nada', visto[7] === false,
     'carimbo velho de slot 3 dentro do save do slot 7');

  /* ⚠️ E NENHUM DOS DOIS CAMPOS VAI PRO SAVE: os dois sao DERIVADOS do que a conta tem equipado,
     e quem os escreve e sempre o equiparItens. Gravados, eles so conseguiam ficar velhos. */
  {
    g.currentSaveSlot = 3;
    g.team = [mk('pikachu', 30)];
    S.equiparItens(g.team, g.equipados, 3);
    const bruto = S.serializeGame();
    ok('o equiparItens carimba os dois na instancia',
       bruto.team[0].slotDaConta === '3' && bruto.team[0].item === 'potion');
    const limpo = S.limparParaFirestore(bruto, '', []);
    ok('mas o slotDaConta NAO vai pro banco', !('slotDaConta' in limpo.team[0]));
    ok('e o item tambem nao', !('item' in limpo.team[0]));
  }

  /* ⚠️ O HP UP E LIDO PELO calcMaxHp, QUE RODA FORA DA BATALHA (distribuicao de niveis, Doce Raro).
     E por isso que o save RECARIMBA ao abrir: sem essa linha o campo nasceria vazio e a barra
     mudaria de tamanho sozinha ao entrar na primeira luta. */
  {
    const cru = mk('pikachu', 30);
    g.equipados = { '3:pichu': 'hp_up' };
    g.currentSaveSlot = 3;
    g.team = [mk('pikachu', 30)];
    S.equiparItens(g.team, g.equipados, 3);
    ok('o HP Up conta antes da primeira batalha', S.calcMaxHp(g.team[0]) === cru.maxHp + 15,
       cru.maxHp + ' -> ' + S.calcMaxHp(g.team[0]));
  }

  /* ⚠️ E O TIME MISTURADO CONTINUA VALENDO: Torre e Ginasio da Cidade carimbam o slot POR POKEMON e
     chamam o equiparItens SEM slotPadrao -- ali nao ha o que informar, e o carimbo e a verdade.
     Sem este degrau, a correcao teria apagado o item de quem mistura saves. */
  {
    g.equipados = { '3:pichu': 'potion', '9:pichu': 'awakening' };
    const a = mk('pikachu', 30); a.slotDaConta = '3';
    const b = mk('pikachu', 30); b.slotDaConta = '9';
    S.equiparItens([a, b], g.equipados);   // sem slotPadrao, como a Torre chama
    ok('time que mistura saves mantem o item de cada slot',
       a.item === 'potion' && b.item === 'awakening', a.item + ' / ' + b.item);
  }

  /* AS TRAVAS QUE LEEM O CODIGO: os casos acima chamam as funcoes na mao e passariam com a
     chamada orfa ou com o carimbo grudento de volta. */
  {
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    const grudento = 'if(p.slotDaConta == null)';
    ok('o carimbo nao gruda mais, nos dois motores',
       cli.indexOf(grudento) < 0 && srv.indexOf(grudento) < 0);
    const novo = /p\.slotDaConta = \(p\.slot != null\) \? String\(p\.slot\)/;
    ok('e os dois recarimbam pela mesma regra', novo.test(cli) && novo.test(srv));
    const j = cli.indexOf('game.team = hydrateTeam(data.team);');
    ok('e o save RECARIMBA ao abrir, logo depois de montar o time',
       j > 0 && /equiparItens\(game\.team, game\.equipados, game\.currentSaveSlot\)/.test(cli.slice(j, j + 900)));
  }
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
})();
