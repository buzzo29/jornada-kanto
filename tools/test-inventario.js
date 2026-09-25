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
/* ⚠️ a moeda virou DESENHO nosso (17/09/2026): a trava procura o <symbol>, que e a identidade
   dele, em vez do caractere -- assim o desenho pode ser reajustado sem derrubar a trava. */
const RE_MOEDA = '<svg[^>]*><use href="#s-moeda"\/><\/svg>';

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
    /* ⚠️ ELA NOMEIA OS QUATRO em vez de contar: a contagem era === 4 e caiu no dia em que as
       Ilhas Laranja abriram pra todo mundo (21/09/2026) e a fileira ganhou um quinto botao --
       sem nada estar errado. O que esta trava quer provar e que a RECUSA nao esconde os modos,
       e isso se cobra pelo nome. E a licao das cinco travas que caíram com o trecho de 150 m. */
    ['openLeagueTypesList', 'openNeighborhoodGymScreen', 'openTrainerTower', 'openOnlineBattle']
      .forEach(fn => ok('  e o botao ' + fn + ' continua la', home.indexOf(fn + '()') >= 0));
  }
  S.openSaveSelect();
  ok('e voltando pra home ela some', !S.__getGame().modoBloqueado, String(S.__getGame().modoBloqueado));

  /* ⚠️ 7) A TORRE NAO FOI GATEADA -- so os tres que o pedido nomeia. Fica FIXADO aqui pra o dia em
     que alguem quiser a mesma porta la ser uma DECISAO, e nao um descuido. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const porta = /if\(!exigeTimeCampeao\([^)]*\)\) return;/g;
    ok('a porta esta em exatamente tres lugares', (txt.match(porta) || []).length === 3,
       (txt.match(porta) || []).length + ' chamadas');
    /* ⚠️ E DAS TRES, SO O GINASIO DA CIDADE PASSA O 'true' (o modo em que o time APOSENTADO ainda
       vale -- ver a secao da aposentadoria). As ligas e o online tem que continuar recusando. */
    const comTrue = txt.match(/if\(!exigeTimeCampeao\(true\)\) return;/g) || [];
    ok('e so o Ginasio da Cidade inclui o aposentado', comTrue.length === 1,
       comTrue.length + ' com true');
    {
      const gc = txt.slice(txt.indexOf('async function openNeighborhoodGymScreen('),
                           txt.indexOf('async function openNeighborhoodGymScreen(') + 200);
      ok('e o true e o DELE', gc.indexOf('exigeTimeCampeao(true)') >= 0);
    }
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
  /* ⚠️ ELA DEIXOU DE SER VAZIA em 17/09/2026: os 23 TMs entraram. A trava trocou de pergunta --
     de "esta vazia, como pedido" pra "tem exatamente os TMs da tabela" --, e ela e DERIVADA: um TM
     novo no TMS ja nasce coberto, e um que suma daqui e barulhento. */
  ok('"TMs/HMs" tem exatamente os 23 TMs da tabela',
     S.itensDaPrateleira('tms').slice().sort().join(',') === Object.keys(S.TMS).slice().sort().join(','),
     S.itensDaPrateleira('tms').join(', ') || '(vazia)');

  /* NA TELA: os tres botoes aparecem, e a lista mostra so a prateleira aberta. */
  {
    const t = S.renderLoja();
    ok('os tres botoes estao na tela', (t.match(/class="loja-aba /g)||[]).length === 3,
       (t.match(/class="loja-aba /g)||[]).length + ' botoes');
    /* ⚠️ O ROTULO E O DA TELA: a LOJA usa o 'nomeLoja' quando ele existe (a prateleira das
       Maquinas se chama 'TMs' la, porque HM ninguem compra) e a MOCHILA usa o 'nome'. Esta trava
       cobrava o 'nome' nas duas e comecou a falhar no dia em que elas passaram a divergir --
       ela media a tabela, e o que importa e o que a TELA mostra. */
    ok('com os nomes por extenso',
       S.LOJA_PRATELEIRAS.every(p => t.indexOf(p.nomeLoja || p.nome) >= 0),
       S.LOJA_PRATELEIRAS.map(p => p.nomeLoja || p.nome).join(' | '));
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
  /* ⚠️ NENHUMA PRATELEIRA ESTA VAZIA DESDE 17/09/2026 (os TMs entraram na terceira), entao o teste
     ESVAZIA uma na mao. O desenho que se cobra aqui e o de 13/09 -- o quadro fica, e fica vazio --
     e ele tem que continuar valendo pra a PROXIMA prateleira que nasca sem nada, que e exatamente
     como a das TMs nasceu. */
  const tmsReais = Object.keys(S.TMS).map(id => [id, S.ITENS[id]]);
  tmsReais.forEach(([id]) => { delete S.ITENS[id]; });
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
    /* ⚠️ O COMPRAR E O VENDER FICAM LADO A LADO (17/09/2026, a pedido) -- e isso REVERTE o
       empilhamento de 13/09. Os dois sao a mesma decisao ("o que eu faco com este item?"), entao
       dividem a linha como o Usar e o Excluir da mochila sempre dividiram.
       ⚠️ A TRAVA LE O CSS porque isso nao aparece em assercao de HTML nenhuma: a marcacao e a mesma
       nos dois casos, o que muda e a DIRECAO do flex. E ela cobra o valor por extenso -- um
       'column' de volta aqui e o pedido desfeito.
       ⚠️ E O LIMITE E [^}]*: sem ele o quantificador atravessa o arquivo e casa o 'column' de outra
       regra centenas de linhas abaixo. Essa armadilha ja custou duas travas neste projeto. */
    const acoes = (css.match(/\.loja-acoes\{[^}]*\}/) || [''])[0];
    ok('o Comprar e o Vender dividem a LINHA (nao empilham)',
       /flex-direction:\s*row/.test(acoes) && !/column/.test(acoes), acoes || '(regra nao achada)');
    /* e o par continua sendo uma .item-acoes, que e quem da o display:flex e o flex:1 dos dois */
    const itemAcoes = (css.match(/\.item-acoes\{[^}]*\}/) || [''])[0];
    ok('e o par sai da .item-acoes (o mesmo da mochila)',
       /display:\s*flex/.test(itemAcoes), itemAcoes || '(regra nao achada)');
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
    ok('e o saldo continua na tela', new RegExp('Você tem <strong>' + RE_MOEDA).test(t));
    /* E O BOTAO DE COMPRAR NAO PODE ESTAR LA: nao ha o que comprar. */
    ok('e nao ha botao de comprar', t.indexOf('abrirCompra') < 0);
    /* devolve os 23 -- o resto do arquivo conta com a loja inteira */
    tmsReais.forEach(([id, it]) => { S.ITENS[id] = it; });
  }
  S.escolherPrateleira('batalha');
    /* ⚠️ E O TERCEIRO BOTAO (o "Quem pode aprender" dos TMs) NAO entra nesta linha: com tres na
       mesma linha cada um fica com 76px a 320px, e "Vender por 100" nao cabe nisso. Ele tem linha
       PROPRIA, em largura cheia. */
    {
      S.openLoja(); S.escolherPrateleira('tms'); S.escolherItemDaLoja('tm26');
      const t = S.renderLoja();
      ok('e o botao de aptos fica FORA do par, em linha propria',
         /loja-acao-larga[^>]*><button[^>]*abrirAptosDaMaquina/.test(t.replace(/\s+/g, ' ')),
         (t.match(/loja-acao-larga[\s\S]{0,80}/) || ['(nao achado)'])[0]);
      /* e o par do TM continua com DOIS botoes, nao tres */
      const rod = (t.match(/<div class="item-acoes loja-acoes">[\s\S]*?<\/div>/) || [''])[0];
      ok('e o par tem exatamente Comprar e Vender',
         (rod.match(/<button/g) || []).length === 2, (rod.match(/<button/g) || []).length + ' botoes');
      ok('e eles sao o Comprar e o Vender',
         /abrirCompra/.test(rod) && /abrirVenda/.test(rod) && !/abrirAptosDaMaquina/.test(rod));
      S.escolherPrateleira('batalha'); S.escolherItemDaLoja('potion');
      ok('e no item comum nao ha linha larga nenhuma',
         S.renderLoja().indexOf('loja-acao-larga') < 0);
    }
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
  ok('o quadro de cima traz preco e descricao', new RegExp(RE_MOEDA + ' \\d+').test(t) && t.includes('item-detalhe-texto'));
  /* SEM MOEDA o botao ja NASCE desabilitado -- um botao que so recusa depois do toque e pior. */
  ok('sem moeda o Comprar nasce desabilitado',
     /<button class="btn success" disabled[\s\S]{0,80}onclick="abrirCompra/.test(t),
     (t.match(/<button class="btn success"[^>]*/g)||[]).join(' | '));
  ok('e a tela diz quanto falta', new RegExp('Faltam ' + RE_MOEDA + ' \\d+').test(t), (t.match(/Faltam[^<]*/g)||[]).join(' | '));
  /* COM MOEDA ele acende. */
  const g = S.__getGame(); g.moedas = 999; S.__setGame(g);
  const rico = S.renderLoja();
  ok('com moeda ele acende', /onclick="abrirCompra/.test(rico) && !/disabled[\s\S]{0,80}onclick="abrirCompra/.test(rico));
  ok('e mostrando quantas moedas voce tem', new RegExp('Você tem <strong>' + RE_MOEDA + ' 999<\\/strong>').test(rico));
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
  ok('e o total de 1', new RegExp('Total: <strong>' + RE_MOEDA + ' 30<\\/strong>').test(m), (m.match(/Total:[^<]*<strong>[^<]*/g)||[]).join(' | '));
  ok('o menos nasce travado em 1', /disabled[^>]*onclick="mudarQtdCompra\(-1\)"/.test(m),
     (m.match(/<button[^>]*mudarQtdCompra\(-1\)[^>]*/g)||[]).join(' | '));

  S.mudarQtdCompra(1);
  ok('o + sobe', S.__getGame().compraQtd === 2, String(S.__getGame().compraQtd));
  ok('e o total acompanha', new RegExp('Total: <strong>' + RE_MOEDA + ' 60<\\/strong>').test(S.renderCompraModal()));
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
  /* ⚠️ o icone do item virou DESENHO nosso (17/09/2026): a trava procura o <symbol>, que e a
     identidade dele, em vez do caractere. */
  ok('quem carrega mostra o icone do item', comItem.includes('#s-despertador') && !/>\+<\/button>/.test(comItem), comItem);
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
  ok('o contador de moedas fica no card do nome', new RegExp('moeda-conta[^>]*>' + RE_MOEDA + ' 1250').test(home),
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
    /* ⚠️ E ELE DECIDE OS HMs POR UMA TABELA desde 16/09/2026, quando o HM02 entrou -- o comentario
       do codigo ja previa que "o proximo HM vai passar por esta mesma linha". A trava cobra o
       GANCHO, e nao o nome de uma condicao: assim o HM04 entra numa linha sem mexer nela. */
    ok('o finishBattle decide os HMs da vitoria', corpo.indexOf('hmDaVitoria()') > 0);
    /* ⚠️ O REGEX VAI ATE O `];`, e nao `[^\]]*`: as entradas da tabela sao arrays, entao aquele
       para na PRIMEIRA delas e a trava acusa a tabela certa como incompleta. */
    const tabelaHm = (txt.match(/const HM_DA_VITORIA = \[[\s\S]*?\];/) || [''])[0];
    ok('  e a tabela tem as duas condicoes',
       /conquistouHM01/.test(tabelaHm) && /conquistouHM02/.test(tabelaHm),
       tabelaHm.replace(/\s+/g, ' '));
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
    /* ⚠️ SAO TRES LINHAS desde 17/09/2026: os HMs aparecem todos, tendo ou nao (ver o bloco
       "OS TRES HMs NA MOCHILA"). Antes so os conquistados entravam. */
    ok('a prateleira lista os TRES HMs', /HM01/.test(t) && linhas(t) === Object.keys(S.HMS).length,
       linhas(t) + ' linhas');
    /* A MAQUINA NAO SE USA NEM SE EXCLUI: ela ENSINA, e ensina quantas vezes quiser. */
    ok('e o quadro traz o botao de Ensinar', /onclick="abrirEnsinarHm\('hm01'\)"/.test(t));
    ok('sem Usar e sem Excluir', !/usarItem\(/.test(t) && !/pedirExclusaoDeItem\(/.test(t));
    ok('e a tabela nao tem mais descricao', S.HMS.hm01.descricao === undefined);
    /* ⚠️ O CARTAO DO GOLPE QUE A MAQUINA ENSINA (16/09/2026, a pedido) -- o resumo diz o que ela
       FAZ, o cartao diz se ela vale a vaga. Ele preenche o vazio que sobrava no quadro. */
    ok('o quadro traz o cartao do golpe', /golpe-cartao/.test(t), limpo(t).slice(0, 110));
    ok('  com o nome, o TIPO e o PODER', /CORTE/i.test(limpo(t)) && /NORMAL/i.test(limpo(t)) && /50/.test(limpo(t)),
       (limpo(t).match(/CORTE[^]{0,40}/i) || [''])[0]);
    /* ⚠️ E E O MESMO cartaoDeGolpe das tres telas de golpe e da tela de ensinar -- e ser o MESMO e
       o ponto: o jogador compara o golpe daqui com os que o pokemon ja tem LA, e um formato
       proprio obrigaria a reaprender a ler no meio da decisao. O teste compara o HTML dos dois. */
    ok('  e e o MESMO cartao da tela de ensinar', t.indexOf(S.cartaoDeGolpe('cut', true, true)) >= 0);
    /* cada HM mostra O GOLPE DELE, e nao um escrito a mao.
       ⚠️ A CONTA PRECISA TER AS DUAS: este bloco roda com `hms=['hm01']`, e um HM que a conta nao
       tem nao entra na prateleira -- o quadro sai VAZIO e a trava media a ausencia, nao o golpe. */
    S.__getGame().hms = ['hm01','hm03'];
    S.escolherItem('hm03');
    /* ⚠️ OLHA SO O CARTAO, e nao a tela: a LISTA la embaixo mostra o nome das duas Maquinas, entao
       procurar 'Corte' na tela inteira acusa sempre -- foi assim que esta trava nasceu falhando. */
    const cartao3 = (S.renderInventario().match(new RegExp(String.raw`<div class="golpe-cartao[^]*?PODER[^]*?</b>`)) || [''])[0];
    ok('  e cada Maquina mostra o golpe DELA',
       /SURF/i.test(limpo(cartao3)) && /95/.test(limpo(cartao3)) && !/CORTE/i.test(limpo(cartao3)),
       limpo(cartao3));
    /* ⚠️ ITEM COMUM NAO GANHA CARTAO: ele nao ensina golpe nenhum, e um cartao vazio ali seria
       um quadro prometendo o que nao existe. */
    S.escolherPrateleiraDaMochila('especiais'); S.escolherItem('rare_candy');
    ok('  e item comum NAO ganha cartao', !/golpe-cartao/.test(S.renderInventario()));
    S.escolherPrateleiraDaMochila('tms'); S.escolherItem('hm01');
    S.__getGame().hms = ['hm01'];   // devolve o estado que o resto do bloco espera
  }
  /* ⚠️ A PRATELEIRA NUNCA MAIS FICA VAZIA (17/09/2026): os tres HMs aparecem sempre, e os que
     faltam vem apagados com o caminho pra consegui-los. Com isso caem TRES travas de 14/09 --
     o "Nenhum TM/HM", o quadro em branco e o "nao conta como ganhar o HM01" --, e a ultima e uma
     REVERSAO de pedido, nao um descuido:
       14/09: *"nao precisa dizer como ganhar o HM01"* (a tela nao entrega o achado de graca)
       17/09: *"escreva o que e necessario fazer para obter o HM"*
     O de hoje e mais recente e explicito, e ele vale. O que o de 14/09 protegia -- nao entregar o
     caminho de graca -- deixou de fazer sentido quando a linha passou a existir mesmo pra quem nao
     tem o HM: sem o caminho ela seria uma promessa muda.
     ⚠️ O "Nenhum TM/HM" CONTINUA NO CODIGO e continua sendo o certo pra uma prateleira sem nada --
     ele so nao e mais alcancavel nesta, porque ela sempre tem os tres. */
  g.hms = []; S.escolherPrateleiraDaMochila('tms');
  {
    const t = S.renderInventario();
    ok('sem NENHUM conquistado, os tres continuam na lista',
       /HM01/.test(t) && /HM02/.test(t) && /HM03/.test(t));
    ok('e o quadro conta o caminho do que falta', /Como conseguir/.test(t));
    ok('e o caminho do HM01 e o dele', /S\.S\. Anne/.test(t) || /Surge/.test(t));
    ok('nem diz "Nenhuma Maquina ainda"', !/Nenhuma M.quina/.test(t));
    ok('mas a prateleira continua na tela', /escolherPrateleiraDaMochila\('tms'\)/.test(t) && /TMs\/HMs/.test(t));
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
    /* a contagem e a da LISTA, e a lista tem os tres HMs agora (tendo ou nao) */
    ok('e a prateleira mostra a contagem', new RegExp(Object.keys(S.HMS).length + ' it').test(comHm),
       (comHm.match(/\d+ it\w+/) || ['(sem contagem)'])[0]);
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
       /'hms'/.test((txt.match(/const CAMPOS_DA_CONTA = \[[\s\S]*?\];/) || [''])[0]));
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
       ['bulbasaur','charmander','chikorita','cyndaquil','totodile'].every(id => S.podeAprenderHM('hm01', id)));
    ok('e a linha do Squirtle e o Pichu NAO',
       !S.podeAprenderHM('hm01','squirtle') && !S.podeAprenderHM('hm01','blastoise') && !S.podeAprenderHM('hm01','pichu'));
    /* Os quatro lendarios FICAM, porque e o que o dado diz -- a mesma decisao do Lugia no
       RECUPERACAO e no REMOINHO. O Celebi e INTOCAVEL, entao a entrada dele nao roda hoje. */
    ok('os lendarios que o dado traz ficam na lista',
       ['raikou','entei','suicune','celebi'].every(id => S.podeAprenderHM('hm01', id)));

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
    /* ⚠️ A FILEIRA TRAZ O TIME INTEIRO desde 16/09/2026 (a pedido), e quem nao aprende sai APAGADO.
       Ate aqui ela trazia so os candidatos, e a razao registrada era boa -- "um card com seis
       sprites em que dois servem faria o jogador clicar pra descobrir quais". O que mudou e que
       agora a tela DIZ quais: o apagado resolve o mesmo problema sem esconder metade do time.
       Kanto tem 3 (Venusaur, Blastoise, Scyther) e o Time 4 tem 2 (Meganium, Alakazam) = 5. */
    ok('a fileira do card traz o TIME INTEIRO',
       (n1.match(/save-slot-mon-sprite/g) || []).length === 5,
       (n1.match(/save-slot-mon-sprite/g) || []).length + ' sprites (3 do Kanto + 2 do Time 4)');
    /* ⚠️ E O APAGADO E O .caiu QUE JA EXISTE -- o mesmo do pokemon desmaiado na fileira do time e no
       log de batalha, que foi o que se pediu. Uma segunda classe com as mesmas duas regras
       divergiria no primeiro ajuste. */
    ok('  e quem NAO aprende sai apagado, com o .caiu do desmaiado',
       (n1.match(/save-slot-mon caiu/g) || []).length === 2,
       (n1.match(/save-slot-mon caiu/g) || []).length + ' apagados (Blastoise e Alakazam)');
    /* ⚠️ "essa Maquina" virou "esse golpe" em 17/09/2026 (a pedido: *"nao use a palavra maquina
       para descrever TM ou HM, ninguem entende isso"*). */
    ok('  e o titulo diz por que', /Blastoise não aprende esse golpe/.test(n1),
       (n1.match(/title="[^"]*não aprende[^"]*"/) || [''])[0]);
    /* ⚠️ QUEM JA SABE O GOLPE tambem sai apagado -- ele nao pode aprender de novo --, mas por outro
       MOTIVO, e o titulo separa os dois: sem isso, quem acabou de ensinar veria o pokemon apagado
       sem entender por que. */
    {
      const antesAtq = (g.saveSlots[0].team[0].ataques || []).slice();
      g.saveSlots[0].team[0].ataques = ['cut'];
      const comCut = S.renderHmAlvo();
      ok('  quem JA SABE o golpe tambem sai apagado',
         (comCut.match(/save-slot-mon caiu/g) || []).length === 3,
         (comCut.match(/save-slot-mon caiu/g) || []).length + ' apagados');
      ok('  e o titulo dele diz OUTRA coisa', /Já sabe o Corte/.test(comCut),
         (comCut.match(/title="Já sabe[^"]*"/) || [''])[0]);
      g.saveSlots[0].team[0].ataques = antesAtq;
    }
    /* SAVE SEM NENHUM CANDIDATO continua NAO virando card: um time inteiro apagado na lista diria
       menos que nao estar la. */
    ok('  e save sem nenhum candidato continua fora da lista',
       S.timesDaMaquina('hm01').map(t => t.slot).join(',') === '0,3');
    ok('e ela nomeia os times', /Kanto/.test(n1) && /Time 4/.test(n1));
    /* ⚠️ A FRASE ENCURTOU no mesmo pedido, palavra por palavra: a antiga descrevia a tela ("cada
       card mostra so quem pode aprender"), e essa metade deixou de ser verdade. */
    ok('a frase da tela e a pedida, palavra por palavra',
       n1.indexOf('Ensine quantas vezes quiser. O ataque fica para sempre no Pokémon.') >= 0);
    ok('  e a antiga saiu', !/não se gasta/.test(n1) && !/só quem pode aprender/.test(n1));
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
    /* ⚠️ SAO DOIS A MAO desde 15/09/2026 (o `surf` do HM03 entrou junto). A trava VARRE o HMS em
       vez de nomear os dois: HM novo sem linha no A_MAO passa a ser barulhento sozinho -- e sem
       ela o gerador APAGA o golpe do HM em silencio na proxima regeneracao. */
    Object.keys(S.HMS).forEach(id => {
      const g = S.HMS[id].golpe;
      ok('  o gerador emite o ' + g + ' a mao', new RegExp('\\b' + g + ': \\{ tipo:').test(ger),
         (ger.match(/const A_MAO = .*/) || [''])[0]);
    });
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
console.log('\n=== O HM02: O VOAR, E O PRIMEIRO QUE COBRA COMO O TIME FOI MONTADO (16/09/2026) ===');
{
  /* Pedido assim: *"implemente o HM02, Fly, para um treinador obter ele, ele tem que vencer a
     oitava insignia usando os 6 pokemons sendo voadores, pode ter mais tipo alem do voador, como
     por exemplo o Charizard que e Fogo e Voador, porem todos os 6 devem ter o selo de voador"*. */
  const g = S.__getGame();
  const mk = id => S.createInstance(id, 60);
  const SEIS = ['charizard','pidgeot','fearow','dodrio','crobat','aerodactyl'];

  /* ===== O GOLPE ===== */
  ok('o fly esta na tabela de golpes', !!S.GOLPES.fly, JSON.stringify(S.GOLPES.fly));
  /* ⚠️ 70 E O PODER DA GEN 3 -- conferido pela cadeia de mods 8->3, o mesmo caminho do cut (50) e
     do surf (95). */
  ok('e ele e Voador, poder 70 (Gen 3)', S.GOLPES.fly[0] === 'Flying' && S.GOLPES.fly[1] === 70,
     S.GOLPES.fly.join('/'));
  ok('e tem nome em portugues', S.nomeDoAtaque('fly') === 'Voar', S.nomeDoAtaque('fly'));
  /* fora do GOLPES_IDS pelo mesmo motivo dos outros dois: aquele array e INDEXADO pelo APRENDIZADO */
  ok('e fica FORA do GOLPES_IDS', (S.GOLPES_IDS || []).indexOf('fly') < 0);
  ok('e nao se desaprende', S.ehGolpeDeMaquina('fly') === true);

  /* ===== QUEM APRENDE ===== */
  ok('sao 24 especies que aprendem o Voar', S.VOADORES.length === 24, String(S.VOADORES.length));
  ok('todas existem no SPECIES', S.VOADORES.every(id => !!S.SPECIES[id]),
     S.VOADORES.filter(id => !S.SPECIES[id]).join(','));
  ok('nenhuma repetida', new Set(S.VOADORES).size === S.VOADORES.length);
  /* ⚠️ TODO MUNDO QUE APRENDE VOAR E VOADOR -- mas o contrario NAO vale, e e a parte que surpreende:
     14 voadores nao aprendem. Isso quer dizer que da pra GANHAR o HM02 com um time em que metade
     nao consegue usa-lo, e esta certo: a CONDICAO e sobre o time, a lista e sobre a especie. */
  ok('todo mundo que aprende o Voar e do tipo Voador',
     S.VOADORES.every(id => S.SPECIES[id].types.indexOf('Flying') >= 0),
     S.VOADORES.filter(id => S.SPECIES[id].types.indexOf('Flying') < 0).join(','));
  {
    const voa = id => S.SPECIES[id].types.indexOf('Flying') >= 0;
    const semFly = Object.keys(S.SPECIES).filter(id => voa(id) && S.VOADORES.indexOf(id) < 0);
    ok('  mas nem todo Voador aprende (o Gyarados e o Zubat nao)',
       semFly.indexOf('gyarados') >= 0 && semFly.indexOf('zubat') >= 0 && semFly.length === 14,
       semFly.length + ' voadores sem o Voar');
    /* o Crobat aprende e o Golbat nao -- o tipo de detalhe que so o dado sabe */
    ok('  e o Crobat aprende enquanto o Golbat nao',
       S.podeAprenderHM('hm02','crobat') && !S.podeAprenderHM('hm02','golbat'));
  }
  ok('a lista vive DENTRO do item', S.HMS.hm02.aprendem === S.VOADORES);

  /* ===== A CONDICAO ===== */
  const antes = { gymIndex:g.gymIndex, team:g.team, hms:g.hms };
  g.hms = []; g.authUser = null;
  g.gymIndex = S.HM02_GINASIO_IDX;
  g.team = SEIS.map(mk);
  ok('os SEIS voadores no 8o ginasio ganham', S.conquistouHM02() === true);
  /* ⚠️ O SEGUNDO TIPO E LIVRE -- o Charizard e Fogo/Voador e entra, que e o pedido ao pe da letra */
  ok('  e o segundo tipo e livre (o Charizard e Fogo/Voador)',
     S.SPECIES.charizard.types.join('/') === 'Fire/Flying' && S.conquistouHM02() === true);
  g.team = ['charizard','pidgeot','machamp','dodrio','crobat','aerodactyl'].map(mk);
  ok('um nao-voador no meio derruba a condicao', S.conquistouHM02() === false);
  /* ⚠️ SEIS, e nao "todos os que tiver": levar tres voadores nao e a mesma proeza */
  g.team = SEIS.slice(0, 5).map(mk);
  ok('cinco voadores nao bastam', S.conquistouHM02() === false);
  g.team = SEIS.slice(0, 3).map(mk);
  ok('e tres muito menos', S.conquistouHM02() === false);
  /* e SO no 8o */
  g.team = SEIS.map(mk);
  for(const i of [0, 2, 5, 6]){
    g.gymIndex = i;
    ok('  e so vale no 8o ginasio (testado o ' + (i+1) + 'o)', S.conquistouHM02() === false);
  }
  g.gymIndex = S.HM02_GINASIO_IDX;
  /* ⚠️ O TIPO SAI DA INSTANCIA, que e o que o `tryEvolve` atualiza e o que a tela DESENHA no selo.
     Lido da especie, um save antigo com o campo velho discordaria da tela -- e a regra e "todos com
     o selo de Voador". */
  {
    const t = SEIS.map(mk);
    t[0].types = ['Fire'];              // um save cujo campo ficou pra tras
    g.team = t;
    ok('o tipo vem da INSTANCIA, nao da especie', S.conquistouHM02() === false);
    delete t[0].types;                  // sem o campo, cai na especie
    ok('  e sem o campo ele cai na especie', S.conquistouHM02() === true);
  }

  /* ⚠️ A CONDICAO NAO OLHA A LISTA DE QUEM APRENDE, e isso foi confirmado a pedido (16/09/2026):
     *"a condicao para ganhar o Fly e que os 6 pokemons que vencem a oitava insignia sejam voadores,
     independente se essas 6 podem aprender o Fly ou nao"*.
     Sao duas perguntas DIFERENTES e elas nao se encostam: a CONDICAO pergunta o TIPO do time, a
     lista pergunta o que a ESPECIE aprende. Seis voadores em que NENHUM aprende o Voar ganham o HM
     do mesmo jeito -- e aí ele fica na mochila esperando um pokemon que saiba usa-lo.
     Este caso e o extremo, e existe de verdade: os seis abaixo voam e nenhum aprende. */
  {
    const SEM_FLY = ['gyarados','scyther','butterfree','gligar','mantine','golbat'];
    ok('  os seis do caso extremo voam', SEM_FLY.every(id => S.SPECIES[id].types.indexOf('Flying') >= 0));
    ok('  e NENHUM deles aprende o Voar', SEM_FLY.every(id => !S.podeAprenderHM('hm02', id)));
    g.hms = []; g.gymIndex = S.HM02_GINASIO_IDX; g.team = SEM_FLY.map(mk);
    ok('e mesmo assim eles GANHAM o HM02', S.conquistouHM02() === true);
    ok('  e a vitoria entrega', S.hmDaVitoria() === 'hm02' && S.temHM('hm02'));
  }

  /* ===== O GANCHO DA VITORIA ===== */
  g.hms = []; g.team = SEIS.map(mk); g.gymIndex = S.HM02_GINASIO_IDX;
  ok('a vitoria entrega o HM02', S.hmDaVitoria() === 'hm02');
  ok('  e nao entrega de novo', S.hmDaVitoria() === null && S.temHM('hm02'));
  /* o HM01 continua saindo pelo MESMO gancho */
  g.hms = []; g.gymIndex = 2; g.losses = 0; g.routeHistory = []; g.routeHistory[2] = S.HM01_ROTA;
  g.gymPath = ['kanto','kanto','kanto'];
  ok('e o HM01 continua saindo pelo mesmo gancho', S.hmDaVitoria() === 'hm01');
  /* ⚠️ SO UM E ANUNCIADO POR VITORIA, e isso e seguro porque as duas condicoes NUNCA valem juntas:
     o HM01 se decide no 3o ginasio e o HM02 no 8o. Se um dia dois coincidirem, e aqui que grita. */
  {
    g.hms = [];
    let cruza = 0;
    for(let i = 0; i < 8; i++){
      g.gymIndex = i; g.losses = 0; g.routeHistory = []; g.routeHistory[i] = S.HM01_ROTA;
      g.team = SEIS.map(mk);
      if(S.conquistouHM01() && S.conquistouHM02()) cruza++;
    }
    ok('as duas condicoes nunca valem no MESMO ginasio', cruza === 0, cruza + ' ginasio(s)');
  }

  /* ===== E ELE E ALCANCAVEL -- HM impossivel e o pior defeito que existe ===== */
  /* Medido a parte (600 jornadas): quem caca voador chega aos seis em 76,3% das vezes, e um time
     desses vence o 8o em 72,8% contra o Giovanni e 67,2% contra a Clair. A trava aqui cobra o que
     torna isso possivel: que exista voador pra capturar em QUANTIDADE, espalhado pelos trechos. */
  {
    const voa = id => (S.SPECIES[id].types || []).indexOf('Flying') >= 0;
    const linhas = new Set();
    let trechosComVoador = 0;
    for(let leg = 0; leg < 8; leg++){
      let achou = false;
      for(const r of (S.ROUTE_MAP[leg] || [])){
        S.formasDaRota(r.id, leg).forEach(x => { if(voa(x.id)){ achou = true; linhas.add(S.raizDaLinha(x.id)); } });
      }
      if(achou) trechosComVoador++;
    }
    ok('ha voador pra capturar em TODOS os 8 trechos', trechosComVoador === 8, trechosComVoador + ' de 8');
    ok('  e em linhas evolutivas distintas o bastante pra seis', linhas.size >= 6, linhas.size + ' linhas');
  }

  g.gymIndex = antes.gymIndex; g.team = antes.team; g.hms = antes.hms;
}

console.log('\n=== O HM03: O SURF, E O PRIMEIRO HM QUE NAO VEM DE BATALHA (15/09/2026) ===');
{
  /* Pedido assim: *"quando um usuario conseguir capturar TODOS os pokemons da rota da Zona Safari,
     ele vai ganhar o HM03, o Surf. Mesmo coisa que o HM01, ele fica na conta, e nao no save, e ao
     ensinar para algum pokemon, esse movimento nao pode mais ser retirado"*. */
  const g = S.__getGame();

  /* ===== O GOLPE ===== */
  ok('o surf esta na tabela de golpes', !!S.GOLPES.surf, JSON.stringify(S.GOLPES.surf));
  /* ⚠️ 95 E O PODER DA GEN 3, que e a geracao da base deste jogo -- o moderno e 90, e e o mod gen5
     do Showdown que devolve o 95. Fixado aqui pelo mesmo motivo que o Tackle 35/95 e fixado no
     test-golpes: se um dia alguem regerar a tabela com a cadeia de mods errada, isto grita. */
  ok('e ele e Agua, poder 95 (Gen 3)', S.GOLPES.surf[0] === 'Water' && S.GOLPES.surf[1] === 95,
     S.GOLPES.surf.join('/'));
  ok('e ele tem nome em portugues', S.nomeDoAtaque('surf') === 'Surf', S.nomeDoAtaque('surf'));
  /* ⚠️ O `surf` NAO PODE ENTRAR NO GOLPES_IDS: aquele array e INDEXADO pelo APRENDIZADO, entao um
     id no meio dele deslocaria o moveset das 250 especies EM SILENCIO. E o mesmo motivo do `cut`. */
  ok('e ele fica FORA do GOLPES_IDS (que e indexado pelo APRENDIZADO)',
     (S.GOLPES_IDS || []).indexOf('surf') < 0);

  /* ===== QUEM APRENDE ===== */
  /* A lista saiu do learnsets.ts do Showdown pela tag de MAQUINA da Gen 3 (`3M`), o MESMO caminho
     dos 72 cortadores -- e o metodo foi conferido reproduzindo os 72 sem uma divergencia. */
  ok('sao 65 especies que aprendem o Surf', S.SURFISTAS.length === 65, String(S.SURFISTAS.length));
  ok('todas existem no SPECIES', S.SURFISTAS.every(id => !!S.SPECIES[id]),
     S.SURFISTAS.filter(id => !S.SPECIES[id]).join(','));
  ok('nenhuma repetida', new Set(S.SURFISTAS).size === S.SURFISTAS.length);
  /* ⚠️ A INTUICAO ERRA, e erra ao contrario do HM01: o Squirtle e justamente o inicial que NAO
     corta, e e ele que surfa. O Totodile faz as duas. */
  ok('a linha do Squirtle surfa (e ela e a que NAO corta)',
     ['squirtle','wartortle','blastoise'].every(id => S.podeAprenderHM('hm03', id)) &&
     !S.podeAprenderHM('hm01','squirtle'));
  ok('o Totodile faz as duas',
     S.podeAprenderHM('hm03','totodile') && S.podeAprenderHM('hm01','totodile'));
  ok('e o Bulbasaur e o Charmander NAO surfam',
     !S.podeAprenderHM('hm03','bulbasaur') && !S.podeAprenderHM('hm03','charmander'));
  /* Surpreendem: nenhum dos tres e de Agua. */
  ok('o Snorlax, o Tauros e o Lickitung surfam',
     ['snorlax','tauros','lickitung'].every(id => S.podeAprenderHM('hm03', id)));
  /* Os lendarios FICAM, porque e o que o dado diz -- a mesma decisao do Lugia no RECUPERACAO e no
     REMOINHO, e dos quatro do CORTADORES. O Lugia e INTOCAVEL, entao a entrada dele nao roda hoje. */
  ok('o Lugia e o Suicune ficam na lista (e o que o dado diz)',
     S.podeAprenderHM('hm03','lugia') && S.podeAprenderHM('hm03','suicune'));

  /* ⚠️ QUEM APRENDE SAI DO PROPRIO HM, e nao de um `if` com o id escrito a mao. As tres portas da
     tela de ensinar chamavam o `podeAprenderCorte` direto -- ou seja, o HM03 teria oferecido o SURF
     aos 72 cortadores. Sem esta trava o proximo HM nasce com o mesmo defeito. */
  ok('a lista vive DENTRO do item', S.HMS.hm03.aprendem === S.SURFISTAS &&
     S.HMS.hm01.aprendem === S.CORTADORES);
  ok('e o podeAprenderHM le o item, nao uma lista fixa',
     S.podeAprenderHM('hm03','squirtle') && !S.podeAprenderHM('hm01','squirtle') &&
     S.podeAprenderHM('hm01','scyther') && !S.podeAprenderHM('hm03','scyther'));
  ok('HM que nao existe nao ensina a ninguem', !S.podeAprenderHM('hm99','squirtle'));

  /* ===== A CONDICAO: TODOS OS DA ZONA DE SAFARI ===== */
  /* ⚠️ A CONDICAO USA AS FORMAS PROPRIAS DA ROTA, sem o evento de pre-evolucao de inicial -- e a
     diferenca entre 17 e 24. As sete pre-evolucoes caem em QUALQUER rota do trecho 5 e o sorteio
     nunca da a do PROPRIO inicial: exigi-las faria a condicao depender de ter jogado com outro
     inicial, que ninguem adivinharia lendo "todos os pokemon da rota". */
  const formas = S.formasDoHM03();
  ok('a condicao sao 17 formas', formas.length === 17, formas.length + ': ' + formas.join(','));
  const naTela = S.formasDaRota(S.HM03_ROTA, S.HM03_LEG).map(x => x.id);
  ok('e a TELA continua mostrando as 24', naTela.length === 24, String(naTela.length));
  {
    const fora = naTela.filter(id => formas.indexOf(id) < 0);
    ok('as 7 que a condicao dispensa sao as pre-evolucoes de inicial',
       fora.length === 7 && fora.every(id => Object.values(S.STARTER_EVOLUTIONS).indexOf(id) >= 0),
       fora.join(','));
  }
  ok('e toda forma da condicao esta na tela', formas.every(id => naTela.indexOf(id) >= 0));
  /* ⚠️ A ROTA E O TRECHO TEM QUE EXISTIR: se qualquer um dos dois mudar de lugar, a condicao para
     de fechar EM SILENCIO e o HM03 fica inalcancavel -- o mesmo par que o HM01 ja cobra. */
  ok('a Zona de Safari existe no trecho declarado',
     !!(S.ROUTE_MAP[S.HM03_LEG] || []).find(r => r.id === S.HM03_ROTA),
     S.HM03_ROTA + ' no trecho ' + (S.HM03_LEG + 1));

  /* ===== O HM E DA CONTA, NAO DO SAVE ===== */
  {
    g.hms = []; g.hmGanhoModal = null; g.authUser = null;
    g.permanentPokedex = []; g.caughtSpecies = [];
    ok('sem nenhum capturado, nao ganha', S.conquistouHM03() === false);
    /* faltando UMA, nao ganha -- e a trava que separa "todos" de "quase todos" */
    g.permanentPokedex = formas.slice(0, formas.length - 1);
    ok('faltando uma, nao ganha', S.conquistouHM03() === false, 'falta ' + formas[formas.length-1]);
    ok('e o conferir nao da o HM', S.conferirHM03() === false && !S.temHM('hm03'));
    g.permanentPokedex = formas.slice();
    ok('com as 17, ganha', S.conquistouHM03() === true);
    ok('e o conferir da o HM UMA vez', S.conferirHM03() === true && S.temHM('hm03'));
    ok('e nao da de novo', S.conferirHM03() === false);
  }
  /* ⚠️ ELA LE A POKEDEX DA CONTA, nao o save: da pra juntar as 17 em VARIAS jornadas, que e o que o
     texto do `comoGanhar` promete. O `caughtSpecies` (o save aberto) tambem conta, porque ele e o
     que ainda nao sincronizou. */
  {
    g.hms = []; g.hmGanhoModal = null;
    g.permanentPokedex = formas.slice(0, 10);
    g.caughtSpecies = formas.slice(10);
    ok('dez da conta mais sete do save aberto fecham a conta', S.conquistouHM03() === true);
    g.caughtSpecies = [];
    ok('e so as dez da conta nao fecham', S.conquistouHM03() === false);
  }

  /* ===== O AVISO: UM HM QUE NAO VEM DE BATALHA PRECISA DE TELA PROPRIA ===== */
  /* O do HM01 e o `ganhouHmAgora`, lido pela tela de VITORIA -- e ele funciona porque o HM01 sai de
     uma vitoria. Este sai de uma CAPTURA (e ate do carregamento da conta), entao nao tem uma tela
     pra pegar carona: o modal e anexado ao RENDER PRINCIPAL. */
  {
    g.hms = []; g.hmGanhoModal = null;
    g.permanentPokedex = formas.slice(); g.caughtSpecies = [];
    S.conferirHM03();
    ok('ganhar abre o modal', g.hmGanhoModal === 'hm03', String(g.hmGanhoModal));
    const m = S.renderHmGanhoModal();
    ok('e ele NOMEIA o HM', /HM03/.test(m) && /Surf/.test(m), m.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80));
    ok('e diz onde ele foi parar', /TMs\/HMs/.test(m) && /[Mm]ochila/.test(m));
    S.fecharHmGanho();
    ok('fechar tira o modal', !g.hmGanhoModal);
    ok('e o HM continua na conta', S.temHM('hm03') === true);
    ok('modal sem HM nao desenha nada', S.renderHmGanhoModal() === '');
  }
  /* ⚠️ O MODAL E ANEXADO AO RENDER PRINCIPAL, e nao a uma tela: o teste LE O CODIGO porque os casos
     acima chamam a funcao na mao e passariam com a chamada orfa. E ele vem ANTES do convite online,
     que tem 15 segundos de prazo e precisa ficar por cima. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const i = txt.indexOf('renderHmGanhoModal();');
    const j = txt.indexOf('renderConviteModal();');
    ok('o render principal anexa o modal', i > 0 && /if\(game\.hmGanhoModal\)/.test(txt.slice(i - 60, i)));
    ok('e o convite online fica POR CIMA dele', i > 0 && j > i);
    /* ⚠️ E ELE PRECISA SOBREVIVER AO resetGame: o HM03 pode ser dado no CARREGAMENTO DA CONTA, com o
       jogador na home -- sem o campo no CAMPOS_DA_CONTA, abrir um save apagaria a marca e o aviso
       nao voltaria NUNCA, porque o conferirHM03 ve o temHM e vai embora. */
    const campos = (txt.match(/const CAMPOS_DA_CONTA = \[[\s\S]*?\];/) || [''])[0];
    ok('hmGanhoModal esta no CAMPOS_DA_CONTA', /'hmGanhoModal'/.test(campos));
    /* mas ele NAO vai pro banco: o serializeGame e uma lista de permissao */
    const ser = (txt.match(/function serializeGame\(\)[\s\S]*?\n\}/) || [''])[0];
    ok('e NAO entra no serializeGame (e estado de tela)', !/hmGanhoModal/.test(ser), ser.length + ' chars');
  }
  /* ⚠️ OS DOIS PONTOS DE CONFERENCIA, e os dois sao necessarios: depois de uma CAPTURA (que e quando
     a condicao pode virar verdadeira) e no CARREGAMENTO da conta (pra quem ja tinha as 17 antes
     desta feature). O teste le o codigo -- os casos chamam a funcao direto. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const cw = (txt.match(/function confirmWild\(\)[\s\S]*?\n\}/) || [''])[0];
    ok('a captura confere o HM03', /conferirHM03\(\)/.test(cw), cw.length + ' chars');
    /* ⚠️ E DEPOIS DO LACO, nao dentro: quem fecha a Zona de Safari pode fechar com os DOIS pokemon
       da mesma oferta, e conferir por captura anunciaria no meio da leva. */
    ok('e DEPOIS do laco de capturas', cw.indexOf('conferirHM03()') > cw.indexOf('markCaught('));
    const lp = (txt.match(/async function loadPermanentUserData\([\s\S]*?\n\}/) || [''])[0];
    ok('o carregamento da conta tambem confere', /conferirHM03\(\)/.test(lp), lp.length + ' chars');
    /* ⚠️ E DEPOIS de a Pokedex e os HMs serem escritos, senao ele leria uma Pokedex vazia e o temHM
       nao saberia que o HM ja foi dado. */
    ok('e DEPOIS de a Pokedex e os HMs entrarem',
       lp.indexOf('conferirHM03()') > lp.indexOf('permanentPokedex') &&
       lp.indexOf('conferirHM03()') > lp.indexOf('game.hms'));
  }

  /* ===== ENSINAR, E NAO PODER TIRAR ===== */
  {
    g.hms = ['hm03']; g.currentSaveSlot = 0;
    g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
    /* um que surfa e um que nao: a lista da tela tem que separar os dois */
    g.team = [S.createInstance('blastoise', 60), S.createInstance('venusaur', 60)];
    g.team.forEach(p => { p.ataques = ['tackle','watergun','bite'].slice(0, S.MAX_GOLPES); });
    g.saveSlots[0] = { team: g.team, badgeCount: 8, name: 'Kanto' };
    S.abrirEnsinarHm('hm03');
    const cands = S.candidatosDaMaquina('hm03');
    ok('a Maquina oferece so quem surfa', cands.length === 1 && cands[0].nome === 'Blastoise',
       cands.map(c => c.nome).join(','));
    S.escolherAlvoDaMaquina(0, 0);
    /* com os tres slots cheios ele cai na tela de TROCA -- e a troca precisa dizer quem sai */
    S.ensinarOGolpeDaMaquina('tackle');
    ok('o Blastoise aprendeu o Surf', g.team[0].ataques.indexOf('surf') >= 0, g.team[0].ataques.join(','));
    /* A MAQUINA NAO SE GASTA: ela e da conta e ensina quantas vezes quiser, como no original. */
    ok('e a Maquina continua na conta', S.temHM('hm03') === true);
    /* ⚠️ E O SURF NAO SE DESAPRENDE, pela MESMA regra do Corte -- e ela varre os HMs em vez de
       nomear o `cut`, entao o HM novo nasceu protegido sozinho. */
    ok('o Surf e golpe de Maquina', S.ehGolpeDeMaquina('surf') === true);
    g.aprenderAtaque = { id: g.team[0].id, golpe: 'hyperbeam' };
    const tela = S.renderAprenderAtaque();
    const ofertas = (tela.match(/responderAprendizado\('([a-z]+)'\)/g) || []).map(x => x.match(/'([a-z]+)'/)[1]);
    ok('a tela de troca por nivel NAO oferece o Surf', ofertas.indexOf('surf') < 0, ofertas.join(','));
    /* quem VALIDA e a ACAO: um clique forjado nao pode tirar o HM */
    S.responderAprendizado('surf');
    ok('forcar a acao com o Surf nao faz nada', g.team[0].ataques.indexOf('surf') >= 0,
       g.team[0].ataques.join(','));
    /* ⚠️ E O NPC NUNCA GANHA GOLPE DE HM: o equiparNpc da o moveset por NIVEL, e HM ninguem aprende
       por nivel. Um Blastoise de lider batendo de Surf seria golpe que ele nao tem. */
    const npc = [S.createInstance('blastoise', 60)];
    S.equiparNpc(npc);
    ok('o NPC nunca tem o Surf', (npc[0].ataques || []).indexOf('surf') < 0, (npc[0].ataques||[]).join(','));
    g.aprenderAtaque = null; S.sairDoEnsinarHm();
  }
  g.hms = []; g.hmGanhoModal = null; g.permanentPokedex = []; g.caughtSpecies = [];
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

/* O mesmo limpador de HTML do bloco do HM01 -- ele e local la, e estes blocos tambem comparam
   TEXTO e nao marcacao. */
const limpo = h => String(h).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log('\n=== O AVISO DA LIGA VIROU UMA CONTAGEM (14/09/2026) ===');
{
  /* Pedido: *"aumente e deixe mais visivel aquele texto para quem ainda nao ta inscrito na Liga
     Classica, coloque assim: Liga Classica comeca em 38 minutos! Inscreva seu time e concorra ao
     premio!"*. Ele dizia a HORA do ciclo ("das 14:00"), e hora e um numero que o jogador tem que
     subtrair de cabeca. */
  const g = S.__getGame();
  const daqui = min => { g.avisoLiga = { hora: S.agoraServidor() + min }; return S.avisoLigaHtml(); };

  /* ⚠️ O limpador troca cada TAG por um espaco, entao ele deixa " !" onde o <strong> fecha antes
     do ponto de exclamacao -- no navegador (innerText) o texto sai colado, conferido. A trava
     normaliza isso em vez de afrouxar a frase: o que se cobra continua sendo palavra por palavra. */
  const frase = h => limpo(h).replace(/\s+([!?.,])/g, '$1');
  const t = frase(daqui(38*60000 + 5000));
  ok('a frase e a pedida, palavra por palavra',
     t === '🏆 Liga Clássica começa em 38 minutos! Inscreva seu time e concorra ao prêmio!', t);

  /* ⚠️ ARREDONDA, nao sobe: 38min05s e 38, nao 39. O Math.ceil dizia 39 -- ele sobe com qualquer
     sobra de segundos, e o numero na tela ficava sempre um a mais do que o relogio. */
  ok('38min05s le 38 minutos, nao 39', /38 minutos/.test(t) && !/39 minutos/.test(t));
  ok('e o singular existe', /em 1 minuto!/.test(frase(daqui(61000))), frase(daqui(61000)));
  ok('1min30s arredonda pra 2', /em 2 minutos!/.test(frase(daqui(90000))));

  /* ⚠️ ZERO OU MENOS NAO VIRA "em -3 minutos": a copia em memoria tem folga de 5 min (ela custa
     duas leituras), entao ela PODE estar velha -- e anunciar inscricao que ja fechou e pior que
     nao anunciar. */
  ok('faltando 25 segundos ele some', S.avisoLigaHtml() !== undefined && daqui(25000) === '');
  ok('e ja passado tambem', daqui(-60000) === '');
  g.avisoLiga = null;
  ok('sem ciclo aberto, nada', S.avisoLigaHtml() === '');

  /* ⚠️ O RELOGIO E O DO SERVIDOR: o scheduledTime e carimbo dele, e relogio de celular quase nunca
     bate. A trava le o CODIGO porque o caso acima passaria com Date.now(). */
  {
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const fn = cli.slice(cli.indexOf('function minutosParaALiga()'), cli.indexOf('function avisoLigaHtml()'));
    ok('a conta usa o relogio do servidor', /agoraServidor\(\)/.test(fn) && !/Date\.now\(\)/.test(fn));
    /* ⚠️ E ELA E FEITA NO DESENHO, nao guardada: o atualizarAvisoDaLiga so roda a cada 5 minutos, e
       um numero congelado la erraria por ate 5 minutos. */
    /* ⚠️ A FATIA IA ATE 1200 CARACTERES FIXOS e caiu com o codigo certo em 24/09/2026: um
       comentario novo dentro da funcao empurrou a linha pra fora da janela. E a QUARTA vez desta
       familia no projeto -- hoje ela vai ate o fim da FUNCAO, com um ok cobrando que a fatia tem o
       que ler (uma fatia vazia passa em branco, que e o outro lado da mesma armadilha). */
    const i0 = cli.indexOf('async function atualizarAvisoDaLiga()');
    const upd = cli.slice(i0, cli.indexOf('\nfunction ', i0 + 10));
    ok('a fatia do aviso tem o que ler', upd.length > 400 && upd.length < 4000, String(upd.length));
    ok('e o aviso guarda a HORA, nao os minutos',
       /avisoLiga = jaEstaNaLiga \? null : \{ hora: ciclo\.scheduledTime \}/.test(upd));
    /* MAIS VISIVEL: fonte de TEXTO (a de pixel come largura demais numa frase de duas oracoes) e
       moldura. O teste le o CSS -- nada disso aparece em asserção de HTML. */
    const css = (cli.match(/\.aviso-liga-jornada\{[^}]*\}/) || [''])[0];
    ok('ele cresceu e ganhou moldura', /font-size:\.8rem/.test(css) && /border:2px solid var\(--yellow\)/.test(css),
       css.replace(/\s+/g, ' '));
    ok('e saiu da fonte de pixel', /font-family:var\(--font-ui\)/.test(css));
    ok('mas o pulso continua', /shiny-bonus-pulse/.test(css));
    /* ⚠️ O <strong> DAQUI E BRANCO (14/09/2026, reportado: *"troque a cor azul de Liga Classica e 20
       minutos pela cor branca, pois nao esta dando para ler"*). A regra global do reset
       (strong{color:var(--blue-dark)}) GANHA da cor do container -- a cor nao e herdada quando o
       proprio elemento declara a dele --, entao as duas partes em NEGRITO (o nome da liga e a
       contagem, que e a informacao que expira) saiam em azul escuro sobre o fundo escuro da pagina.
       A trava le o CSS: cor de texto nao aparece em asserção de HTML nenhuma. */
    ok('e o negrito dele e BRANCO, nao o azul do reset',
       /.aviso-liga-jornada strong{ color:#fff; }/.test(cli),
       (cli.match(/.aviso-liga-jornada strong{[^}]*}/) || ['(sem regra)'])[0]);
    /* e a frase continua tendo os dois pedacos em negrito -- sem eles a regra acima nao teria alvo */
    ok('e a frase marca os dois em negrito', (daqui(20*60000).match(/<strong/g) || []).length === 2,
       (daqui(20*60000).match(/<strong[^>]*>[^<]*/g) || []).join(' | '));
  }
}

console.log('\n=== TMs/HMs DENTRO DO "SEU TIME" (14/09/2026) ===');
{
  /* Pedido: *"quando o usuario clicar no Seu Time, adicione o botao TMs/HMs, e quando clicar, mostre
     a lista TMs e HMs que o usuario possui na mochila, e quando ele clicar em algum para usar, ja
     mostra diretamente os pokemons desse time, sem ele precisar indicar qual time"*. */
  const g = S.__getGame();
  const mk = (id, lv, atks) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; if(atks) p.ataques = atks; return p; };
  const monta = () => {
    g.currentSaveSlot = 0;
    g.hms = ['hm01'];
    g.team = [ mk('persian', 50, ['slash','bite','scratch']), mk('bulbasaur', 30, ['tackle']), mk('gastly', 30) ];
    g.saveSlots = [{ customName:'Kanto', team: g.team },
                   { customName:'Johto', team: [ mk('meganium', 60, ['tackle']) ] }];
    g.screen = 'wild'; g.hmEnsino = null; g.hmTimeAberto = null; g.hmVoltarPara = null;
  };
  monta();

  S.abrirTimeModal();
  ok('o modal abre na aba do time', g.timeModalAba === 'time', String(g.timeModalAba));
  ok('e traz o botao de TMs/HMs com a contagem', /TMs\/HMs \(1\)/.test(S.renderTimeModal()));

  S.trocarAbaDoTimeModal('tmhm');
  {
    const t = S.renderTimeModal();
    ok('a aba lista a Maquina da conta', /HM01/.test(t), limpo(t).slice(0, 80));
    /* A contagem e do TIME ABERTO, nao da conta: o Persian e o Bulbasaur cortam, o Gastly nao. */
    ok('e diz quantos DESTE time aprendem', /2 podem aprender/.test(t), limpo(t));
    ok('e da pra voltar pra lista do time', /trocarAbaDoTimeModal\('time'\)/.test(t));
  }

  /* ⚠️ O ATALHO: clicar na Maquina cai DIRETO nos pokemon DESTE time. */
  S.ensinarMaquinaNesteTime('hm01');
  ok('o modal fecha', !g.timeModal);
  ok('e vai pra tela da Maquina com o time JA fixado', g.screen === 'hmAlvo' && g.hmTimeAberto === 0,
     g.screen + ' / time ' + g.hmTimeAberto);
  ok('e ela guarda pra onde voltar (a tela da jornada)', g.hmVoltarPara === 'wild', String(g.hmVoltarPara));
  {
    const t = S.renderHmAlvo();
    ok('a tela mostra os pokemon, nao a escolha de time',
       /Persian/.test(t) && /Bulbasaur/.test(t) && !/Johto/.test(t), limpo(t).slice(0, 110));
    /* ⚠️ "OUTRO TIME" SOME: oferecer a lista de times aqui seria devolver o jogador exatamente a
       tela que o atalho existe pra pular. */
    ok('e o botao de baixo e Voltar, nao Outro time', /sairDoEnsinarHm\(\)/.test(t) && !/voltarAosTimesDaMaquina/.test(t));
  }

  /* A ida e a volta pela tela de troca mantem o time fixado. */
  S.escolherAlvoDaMaquina(0, 0);
  ok('quem tem os 3 golpes cai na tela de troca', g.screen === 'hmTroca', g.screen);
  S.voltarDaTrocaDaMaquina();
  ok('e voltar da troca devolve pra lista do MESMO time', g.screen === 'hmAlvo' && g.hmTimeAberto === 0);
  S.sairDoEnsinarHm();
  ok('e o Voltar final devolve pra JORNADA, nao pra mochila', g.screen === 'wild', g.screen);
  ok('e o destino de volta e limpo', !g.hmVoltarPara);

  /* ⚠️ ABERTA PELA MOCHILA ela continua como era: escolhe o time, e o Voltar leva pra mochila.
     O destino ZERA na entrada -- sem isso, um sobrando de uma passada anterior levaria quem abriu
     pela mochila pra uma tela de jornada, no pior caso de um save que nem esta aberto. */
  g.hmVoltarPara = 'wild';
  S.abrirEnsinarHm('hm01');
  ok('abrir pela mochila zera o destino de volta', !g.hmVoltarPara, String(g.hmVoltarPara));
  ok('e ela volta a pedir o time', g.hmTimeAberto == null && /Johto/.test(S.renderHmAlvo()));
  S.sairDoEnsinarHm();
  ok('e o Voltar dela leva pra mochila', g.screen === 'tmhm', g.screen);

  /* ⚠️ MAQUINA QUE NINGUEM DESTE TIME APRENDE FICA APAGADA, COM O MOTIVO -- e nao escondida.
     Clicavel, ela cairia no fallback do telaDoTimeDaMaquina, que e a lista de TIMES: o atalho
     viraria justamente a tela que ele pula. */
  monta();
  g.team = [ mk('gastly', 30), mk('haunter', 40) ];   // nenhum dos dois corta
  g.saveSlots[0].team = g.team;
  S.abrirTimeModal();
  S.trocarAbaDoTimeModal('tmhm');
  {
    const t = S.renderTimeModal();
    ok('a Maquina continua na lista', /HM01/.test(t));
    ok('mas desabilitada, dizendo por que', /disabled/.test(t) && /ningu.m deste time aprende/.test(t),
       limpo(t).slice(0, 100));
  }
  const antes = g.screen;
  S.ensinarMaquinaNesteTime('hm01');
  ok('e a acao RECUSA (nao e so a tela)', g.screen === antes, g.screen);

  /* Sem Maquina nenhuma: a mesma frase da mochila. */
  g.hms = [];
  ok('sem nenhuma, a aba diz Nenhum TM/HM', /Nenhum TM\/HM/.test(S.timeModalMaquinasHtml()));
  S.fecharTimeModal();
}

console.log('\n=== CRASE DENTRO DE COMENTARIO HTML (a armadilha da casa) ===');
{
  /* ⚠️ ESTA TRAVA NASCEU DE UM DEFEITO MEU, no mesmo dia (14/09/2026): escrevi o nome de uma classe
     entre crases num comentario <!-- --> que vive DENTRO de um template literal. A crase FECHA a
     string, e o que vem depois vira template TAGUEADO -- o `node --check` passa (continua JS valido)
     e a tela morre so no navegador, com "(...).btn is not a function".
     O CLAUDE.md ja avisava disso num comentario da loja; agora a regra e cobrada. */
  const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const crase = String.fromCharCode(96);
  const comEles = (cli.match(/<!--[\s\S]*?-->/g) || []).filter(c => c.indexOf(crase) >= 0);
  ok('nenhum comentario HTML tem crase', comEles.length === 0,
     comEles.map(c => c.replace(/\s+/g, ' ').slice(0, 70)).join(' | ') || 'nenhum');
}

console.log('\n=== A INSCRICAO RAPIDA PELO AVISO DA LIGA (14/09/2026) ===');
{
  /* Pedido: *"teria como adicionar um botao na mensagem de aviso para se inscrever na liga classica...
     e automaticamente ja abre um modal da mesma tela quando clica no Escolher time dentro da liga
     classica, mostrando os times que estao aptos, e entao ele escolhe e ja inscreve automaticamente,
     sem precisar entrar na tela de liga"*. */
  const g = S.__getGame();
  const mk5 = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; return p; };
  const timeA = ['venusaur','gyarados','alakazam'].map(id => mk5(id, 62));
  const timeB = ['typhlosion','ampharos'].map(id => mk5(id, 58));
  const monta = () => {
    g.authUser = { uid:'u1' }; g.trainerName = 'Buzzo'; g.currentSaveSlot = 0;
    g.saveSlots = [{ customName:'Kanto', badgeCount:8, team: timeA },
                   { customName:'Johto', badgeCount:8, team: timeB },
                   { customName:'Novo',  badgeCount:3, team: [mk5('pidgey', 12)] }];
    g.team = timeA; g.screen = 'preBattle';
    g.avisoLiga = { hora: S.agoraServidor() + 20*60000 };
    g.inscricaoLiga = null; g.leagueError = null; g.leagueSubmitting = false;
  };
  monta();

  ok('o aviso traz o botao, com o texto pedido', /Clique aqui para se inscrever/.test(S.avisoLigaHtml()),
     limpo(S.avisoLigaHtml()));
  /* ⚠️ SEM TIME CAMPEAO ELE NAO APARECE: um botao que abre um modal vazio e pior que botao nenhum.
     O aviso nasce pra quem PODE se inscrever, mas o `timeElegiveisOnline` (que decide se o bloco
     inteiro sai) e o `savesCampeoes` nao sao a mesma pergunta. */
  g.saveSlots = [{ customName:'Novo', badgeCount:3, team: [mk5('pidgey', 12)] }];
  ok('sem time campeao, o botao some', !/Clique aqui/.test(S.avisoLigaHtml()));
  ok('mas o aviso continua', /Liga Cl.ssica/.test(S.avisoLigaHtml()));
  monta();

  /* O MODAL: os mesmos cards da tela da Liga, e SO os times de 8 insignias. */
  S.abrirInscricaoRapida();
  {
    const t = S.renderInscricaoLigaModal();
    ok('o modal abre com a mesma pergunta da tela da Liga', /Qual time vai representar voc.\?/.test(t));
    ok('e com um card por time CAMPEAO, nao por save',
       (t.match(/save-slot-card/g) || []).length === 2, (t.match(/save-slot-card/g) || []).length + ' cards');
    ok('o time de 3 insignias fica de fora', !/Novo/.test(t), limpo(t).slice(0, 90));
    /* ⚠️ E O CARD E O MESMO DA HOME (a estrela com a media), pelo mesmo motivo de sempre: e por ele
       que o jogador reconhece um time. */
    ok('com a estrela da media', /team-avg-star/.test(t));
    /* ⚠️ O TERCEIRO ARGUMENTO E O QUE FAZ ELE NAO SAIR DA TELA. */
    ok('e o clique inscreve SEM trocar de tela', /registerForLeague\(CLASSIC_LEAGUE_TYPE, \d+, true\)/.test(t),
       (t.match(/registerForLeague\([^)]*\)/) || ['(nao achei)'])[0]);
  }

  /* A TELA DE TRAS NAO MUDA -- e o "sem precisar entrar na tela de liga" ao pe da letra. */
  ok('abrir o modal nao troca a tela', g.screen === 'preBattle', g.screen);

  /* A CONFIRMACAO: sem ela, a unica pista de que deu certo era o aviso sumir -- que e o mesmo que
     acontece quando ele EXPIRA. */
  g.inscricaoLiga = { feito: true, slot: 1 };
  {
    const t = S.renderInscricaoLigaModal();
    ok('inscrito, o modal confirma e NOMEIA o time', /Inscrito!/.test(t) && /Johto/.test(t), limpo(t).slice(0, 80));
    ok('e a tela de tras continua a mesma', g.screen === 'preBattle');
  }

  /* O ERRO APARECE NO MODAL: com ele aberto, deixar o erro so na tela da Liga e falhar em silencio
     na cara de quem clicou. */
  g.inscricaoLiga = { feito: false, slot: null };
  g.leagueError = 'Sua conta já está inscrita nessa Liga em outra rodada.';
  ok('o erro sai dentro do modal', /j. est. inscrita/.test(S.renderInscricaoLigaModal()));

  S.fecharInscricaoRapida();
  ok('fechar tira o modal e nao mexe na tela', !g.inscricaoLiga && g.screen === 'preBattle');

  /* ⚠️ AS TRAVAS QUE LEEM O CODIGO: os casos acima chamam as funcoes na mao. */
  {
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    /* A INSCRICAO E A MESMA da tela da Liga -- ali moram a checagem das 8 insignias, o
       ensureRegisteringCycle, a trava de "ja inscrito em outra rodada" e a transacao que impede
       inscricao dupla. Uma segunda escrita aqui divergiria dela no primeiro ajuste. */
    ok('a inscricao rapida REUSA o registerForLeague',
       (cli.match(/registerForLeague\(/g) || []).length >= 3 &&
       cli.indexOf('async function registerForLeague(typeId, slot, ficarNaTela)') >= 0);
    ok('e o ficarNaTela e o que segura a troca de tela',
       cli.indexOf('if(ficarNaTela){ game.inscricaoLiga = { feito: true, slot }; }') >= 0);
    /* o modal precisa ser ANEXADO pelo render, senao ele nunca chega na tela */
    ok('o render anexa o modal', /if\(game\.inscricaoLiga\)\{ html \+= renderInscricaoLigaModal\(\); \}/.test(cli));
    /* ⚠️ O BOTAO NAO PISCA JUNTO com o aviso: o `animation` e do container e o botao e filho, entao
       ele herda o piscar -- e um alvo de toque que pisca e mais dificil de acertar. */
    const css = (cli.match(/\.aviso-liga-jornada \.aviso-liga-botao\{[^}]*\}/) || [''])[0];
    ok('e ele nao herda o pulso do aviso', /animation:none/.test(css), css.replace(/\s+/g, ' ').slice(0, 80));

    /* ⚠️ O CONJUNTO DE TELAS, e nao cada uma solta (14/09/2026, reportado: *"nao apareceu a mensagem
       para se inscrever na liga classica naquela tela, porem ela exibe em outras"*).
       O aviso estava em TRES renders -- preBattle, battling e battleResult --, e a batalha do RIVAL,
       da ROCKET, da ELITE e da VIGILIA tem renders PROPRIOS: os mesmos tres momentos, em outra
       funcao. E faltava tambem no FIM DA JORNADA, que e onde nasce o campeao -- exatamente quem a
       Liga aceita.
       ⚠️ A TRAVA E SOBRE O CONJUNTO porque o defeito e de OMISSAO: uma lista espalhada por varios
       renders e onde a proxima se esconde. E a mesma licao dos banners de intro, do mesmo dia. */
    const corpoDe = nome => {
      const l = cli.split('\n');
      const i = l.findIndex(x => new RegExp('^function ' + nome + '\\s*\\(').test(x));
      if(i < 0) return '';
      let j = i + 1;
      while(j < l.length && !/^function /.test(l[j])) j++;
      return l.slice(i, j).join('\n');
    };
    const COM_AVISO = ['renderPreBattle','renderBattling','renderBattleResult',
                       'renderSpecialIntro','renderSpecialBattling','renderSpecialResult','renderJourneyEnd'];
    /* ⚠️ E ONDE ELE NAO PODE ESTAR: na Torre e nas ligas o jogador JA esta numa disputa organizada,
       e chamar pra outra no meio dela nao faz sentido. Sem esta metade, "acrescentar em todo lugar"
       passaria no teste. */
    const SEM_AVISO = ['renderTrainerBattling','renderTrainerTower','renderLeague','renderOnlineBattle'];
    const faltando = COM_AVISO.filter(n => !/botaoBuscaOnlineHtml/.test(corpoDe(n)));
    const sobrando = SEM_AVISO.filter(n => /botaoBuscaOnlineHtml/.test(corpoDe(n)));
    ok('o aviso esta nas SETE telas da jornada', faltando.length === 0,
       faltando.join(', ') || COM_AVISO.length + ' telas');
    ok('e NAO esta na Torre nem nas ligas', sobrando.length === 0,
       sobrando.join(', ') || 'nenhuma');
    /* a lista do teste tem que bater com o arquivo: se alguem renomear um render, a trava acima
       passaria lendo string vazia */
    ok('e as duas listas apontam pra funcoes que existem',
       COM_AVISO.concat(SEM_AVISO).every(n => corpoDe(n).length > 0),
       COM_AVISO.concat(SEM_AVISO).filter(n => !corpoDe(n).length).join(', ') || 'todas existem');
  }
}


console.log('\n=== APOSENTAR O TIME (o Prof. Carvalho) ===');
{
  /* Pedido em 17/09/2026: *"quando um save ja nao tem mais o que fazer apos vencer as 8 insignias,
     por exemplo, ele ja venceu a elite 4, ou perdeu para a elite 4, deve aparecer a opcao de
     aposentar o time ... nao vai mais ser possivel utilizar esse time em ligas onlines e batalhas
     onlines, porem podem ser utilizados na torre dos treinadores e no ginasio da cidade"*. */
  const TIME = [{ speciesId:'venusaur', level:70, name:'Venusaur', types:['Grass','Poison'] }];
  const monta = (slots) => {
    const g = S.__getGame();
    g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
    slots.forEach((sv, i) => { g.saveSlots[i] = sv; });
    g.saveSlotsCarregados = true;
    g.modoBloqueado = null;
    g.screen = 'saveSelect';
    S.__setGame(g);
  };
  const tenta = (abrir) => {
    S.__getGame().screen = 'saveSelect';
    S.__getGame().modoBloqueado = null;
    abrir();
    return S.__getGame().screen;
  };

  /* ⚠️ 1) AS DUAS LISTAS SAO DIFERENTES, e e nisso que a feature inteira se apoia. */
  monta([{ team:TIME, badgeCount:8 }, { team:TIME, badgeCount:8, aposentado:true }]);
  ok('savesComOitoInsignias conta os DOIS', S.savesComOitoInsignias().length === 2,
     S.savesComOitoInsignias().join(','));
  ok('savesCampeoes conta so o ATIVO', S.savesCampeoes().length === 1 && S.savesCampeoes()[0] === 0,
     S.savesCampeoes().join(','));
  ok('saveAposentado le a marca', S.saveAposentado({ aposentado:true }) === true
     && S.saveAposentado({}) === false && S.saveAposentado(null) === false);

  /* ⚠️ 2) SO APOSENTADO: a Torre e o Ginasio da Cidade continuam abrindo, as Ligas e o Online nao.
     E o pedido ao pe da letra, e e o unico caso em que as duas listas discordam na PORTA. */
  monta([{ team:TIME, badgeCount:8, aposentado:true }]);
  ok('Ginasio da Cidade: so com aposentado ENTRA',
     tenta(() => S.openNeighborhoodGymScreen()) === 'neighborhoodGym', S.__getGame().screen);
  ok('Ligas: so com aposentado NAO entra',
     tenta(() => S.openLeagueTypesList()) !== 'leagueTypesList', S.__getGame().screen);
  ok('Batalha Online: so com aposentado NAO entra',
     tenta(() => S.openOnlineBattle()) !== 'onlineBattle', S.__getGame().screen);
  ok('e a recusa das ligas diz por que', S.__getGame().modoBloqueado === S.AVISO_SEM_CAMPEAO,
     String(S.__getGame().modoBloqueado));

  /* ⚠️ 3) A TORRE TEM LACO PROPRIO e nunca leu a lista -- ela enxerga o aposentado de graca.
     A trava existe pra o dia em que alguem unificar as duas e fechar a Torre sem querer. */
  {
    const g = S.__getGame();
    g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
    g.saveSlots[0] = { team:TIME, badgeCount:8, aposentado:true };
    S.__setGame(g);
    const eleg = S.towerEligiblePokemon();
    ok('a Torre enxerga o pokemon do time aposentado', eleg.length === 1, eleg.length + ' elegiveis');
  }

  /* ⚠️ 4) E O MONTADOR DO DESAFIO TAMBEM -- entrar na tela nao basta: o time tem que APARECER na
     lista de escolha. Ele le o mesmo towerEligiblePokemon do item 3, entao o que se cobra aqui e
     que o caminho inteiro chegue na tela. */
  {
    const g = S.__getGame();
    g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
    g.saveSlots[0] = { team:TIME, badgeCount:8, aposentado:true, name:'Buzzo' };
    g.neighborhoodGymCooldowns = { mons:{} };
    g.neighborhoodGymChallengePick = [];
    g.neighborhoodGymDetail = { leaderTerrain:null };
    S.__setGame(g);
    const html = S.renderNeighborhoodGymChallengeTeamPicker();
    ok('o montador do desafio lista o pokemon do aposentado', html.indexOf('Venusaur') >= 0,
       'nao achou o Venusaur na lista');
  }

  /* 5) O BOTAO SO APARECE COM A JORNADA RESOLVIDA. */
  const jornada = (eliteStatus, aposentado) => {
    const g = S.__getGame();
    g.screen = 'journeyEnd';
    g.badgesEarned = ['Rocha','Cascata','Trovao','Arco-Iris','Pantano','Alma','Vulcao','Terra'];
    g.team = TIME.slice();
    g.eliteStatus = eliteStatus;
    g.aposentado = !!aposentado;
    g.aposentarPergunta = false;
    g.kantoBonusSeen = true;
    S.__setGame(g);
  };
  jornada('champion');
  ok('campeao da Elite PODE aposentar', S.podeAposentar() === true);
  ok('e o botao esta na tela', S.renderJourneyEnd().indexOf('pedirAposentadoria()') >= 0);
  jornada('defeated');
  ok('quem PERDEU pra Elite tambem pode', S.podeAposentar() === true);
  jornada('inProgress');
  ok('com a Elite EM ANDAMENTO nao pode', S.podeAposentar() === false);
  ok('e o botao NAO aparece', S.renderJourneyEnd().indexOf('pedirAposentadoria()') < 0);
  jornada(null);
  ok('sem ter chegado na Elite tambem nao', S.podeAposentar() === false);
  {
    const g = S.__getGame(); g.eliteStatus = 'champion'; g.badgesEarned = ['Rocha']; S.__setGame(g);
    ok('e sem as 8 insignias tampouco', S.podeAposentar() === false);
  }

  /* 6) APOSENTADO: some o botao, entra a caixa que explica onde ele ainda vale. */
  jornada('champion', true);
  ok('ja aposentado nao oferece de novo', S.podeAposentar() === false);
  {
    const h = S.renderJourneyEnd();
    ok('e a tela conta o estado', h.indexOf('Time aposentado') >= 0);
    ok('e diz onde ele ainda vale', h.indexOf('Torre dos Treinadores') >= 0
       && h.indexOf('Ginásio da Cidade') >= 0);
    ok('e nao oferece aposentar de novo', h.indexOf('pedirAposentadoria()') < 0);
  }

  /* ⚠️ 7) A PERGUNTA ANTES: e um caminho so de ida, entao nao pode acontecer num clique. */
  jornada('champion');
  S.pedirAposentadoria();
  ok('pedir abre a pergunta', S.__getGame().aposentarPergunta === true);
  ok('e NAO aposenta ainda', S.__getGame().aposentado === false);
  {
    const m = S.renderAposentadoriaModal();
    ok('o modal nomeia o time', m.indexOf('Venusaur') >= 0);
    ok('e avisa que nao tem volta', /não tem volta/.test(m), m.slice(0, 120));
    /* ⚠️ ESTA TRAVA JA MEDIU AS DUAS COISAS OPOSTAS NO MESMO DIA, e vale saber por que: de manha
       aposentar passou a APAGAR o save, e eu li isso como "o time sai da Torre e do Ginasio" --
       a trava passou a cobrar essa frase. A tarde o pedido corrigiu: *"podem sim ser utilizados
       na torre de treinadores e ginasio da cidade, so nao pode mais participar de ligas e
       batalhas online"*.
       Hoje ela cobra as DUAS metades, que puxam pra lados opostos: a jornada morre E o time
       continua jogavel. Dizer so a primeira faria o jogador achar que perde os pokemon; so a
       segunda esconderia que a jornada acabou. */
    ok('avisa que a jornada sera apagada', m.indexOf('jornada será apagada') >= 0, 'sem o aviso');
    ok('e que o time CONTINUA valendo na Torre e no Ginasio',
       m.indexOf('continua valendo') >= 0 && m.indexOf('Torre dos') >= 0 && m.indexOf('Ginásio da Cidade') >= 0,
       'sem o que continua');
    ok('e que ele NAO faz mais liga nem batalha online',
       m.indexOf('liga') >= 0 && m.indexOf('batalha online') >= 0, 'sem o que acaba');
    /* ⚠️ e ele NAO pode voltar a dizer que o time sai dos dois modos -- foi a leitura errada */
    ok('e NAO diz mais que o time sai dos dois modos',
       m.indexOf('sai da Torre') < 0, 'ainda diz que sai');
    ok('e aponta pra tela do Prof. Carvalho na Pokedex',
       m.indexOf('Pokédex') >= 0 && m.indexOf('Prof. Carvalho') >= 0, 'sem o destino');
  }
  S.fecharAposentadoria();
  ok('cancelar fecha sem aposentar',
     S.__getGame().aposentarPergunta === false && S.__getGame().aposentado === false);

  /* 8) O CAMPO ATRAVESSA O SAVE. */
  jornada('champion');
  S.__getGame().aposentado = true;
  ok('serializeGame leva a marca', S.serializeGame().aposentado === true);
  S.__getGame().aposentado = false;
  ok('e serializa false quando nao', S.serializeGame().aposentado === false);
  S.applySavedState(Object.assign(S.serializeGame(), { aposentado:true }));
  ok('applySavedState le a marca', S.__getGame().aposentado === true);
  S.applySavedState(Object.assign(S.serializeGame(), { aposentado:undefined }));
  ok('e save ANTIGO (sem o campo) nasce ATIVO', S.__getGame().aposentado === false);

  /* ⚠️ 9) O MODAL ESTA NO render(): sem isso a pergunta e feita e nunca chega na tela. */
  {
    const src = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    ok('o render anexa o modal da aposentadoria',
       /if\(game\.aposentarPergunta\)\{ html \+= renderAposentadoriaModal\(\); \}/.test(src));
    /* e ele vem ANTES do convite online, que tem 15s de prazo e fica por cima de tudo */
    ok('e antes do convite online',
       src.indexOf('renderAposentadoriaModal()') < src.indexOf('renderConviteModal()'));
  }

  /* ⚠️ 10) O SERVIDOR TAMBEM: a Trainers League e a UNICA liga que monta a lista sozinha, lendo os
     saves. Sem a guarda la, o time aposentado voltaria pro sorteio por conta propria. */
  {
    const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    ok('a Trainers League do servidor exclui o aposentado',
       /badgeCount\|\|0\) >= 8 && !s\.aposentado/.test(srv));
    /* ⚠️ E O RESOLVER (Torre + Ginasio da Cidade) NAO EXCLUI -- la o aposentado VALE, e desde
       18/09/2026 ele ate LE o arquivo da conta. A trava procura o PADRAO DE EXCLUSAO, nunca a
       palavra: com `indexOf('aposentado')` ela se acusava no proprio comentario do codigo -- a
       QUINTA vez dessa armadilha neste projeto. */
    const resolver = srv.slice(srv.indexOf('async function resolverTimeDosSaves'),
                               srv.indexOf('async function resolverTimeDosSaves') + 3000);
    ok('e o resolverTimeDosSaves NAO exclui (Torre e Ginasio)',
       resolver.length > 100 && !/!\s*s\.aposentado|\.aposentado\s*\)\s*return/.test(resolver),
       'ele esta excluindo o aposentado');
    /* ⚠️ E O ARQUIVO DA CONTA ENTRA NO `disponiveis`: e isso que mantem o aposentado jogavel
       depois de o save morrer. Sem esta linha a Torre e o Ginasio ficariam vazios pra quem
       aposentou tudo -- que e exatamente o que o pedido de 18/09 recusa. */
    ok('e o arquivo da conta entra nos disponiveis',
       /data\(\)\.aposentados/.test(resolver) && /disponiveis\.push\(\{ slot: 'ap:/.test(resolver),
       'o arquivo nao entra -- o aposentado some dos dois modos');
  }
}



/* ============================================================================
   O APOSENTADO CONTINUA VALENDO NA TORRE E NO GINASIO DA CIDADE (18/09/2026)
   ----------------------------------------------------------------------------
   Pedido: *"os pokemons que sao aposentados, podem sim ser utilizados na torre de treinadores e
   ginasio da cidade, so nao pode mais participar de ligas e batalhas online"*.

   ⚠️ ISSO CORRIGE A LEITURA DE MAIS CEDO NO MESMO DIA, quando aposentar passou a APAGAR o save e
   eu li isso como "o time sai dos dois modos". O save continua sendo apagado -- o que muda e que
   o ARQUIVO DA CONTA virou a origem de onde os dois modos montam.
   ============================================================================ */
{
  console.log('\n=== O APOSENTADO NA TORRE E NO GINASIO DA CIDADE ===');
  const g = S.__getGame();
  const vazios = () => new Array(20).fill(null);

  /* 1) O MONTADOR LISTA OS APOSENTADOS, mesmo sem save nenhum */
  g.saveSlots = vazios();
  g.aposentados = [
    { speciesId:'venusaur', level:62, shiny:true, ataques:['solarbeam'], slot:'3', em:2000 },
    { speciesId:'alakazam', level:55, slot:'1', em:1000 },
  ];
  let el = S.towerEligiblePokemon();
  ok('sem save nenhum, o montador lista os aposentados', el.length === 2, el.length + ' elegiveis');
  /* ⚠️ O `|| {}` NAO E DEFENSIVA A TOA: sem ele, a trava de cima falhando mata a bateria INTEIRA
     com um TypeError -- e um teste que morre esconde todos os seguintes. Conferido: com o
     arquivo tirado do montador, ela passava a matar 400 casos depois deste. */
  const p0 = el[0] || {};
  ok('com a especie, o nivel e o shiny de cada um',
     p0.speciesId === 'venusaur' && p0.level === 62 && p0.shiny === true,
     JSON.stringify(p0));
  ok('e a origem deles aparece na tela', String(p0.teamName).indexOf('Carvalho') >= 0, String(p0.teamName));

  /* ⚠️ 2) O SLOT E SINTETICO, e ele nao pode colidir com um save VIVO do mesmo numero -- o
     jogador pode ter comecado uma jornada nova naquele slot. Sem isso o servidor casaria o
     pedido com o pokemon errado, que e o defeito de 01/09/2026 por outra porta. */
  {
    const time = [];
    for(let i = 0; i < 6; i++){ const p = S.createInstance('pidgey', 50); p.hp = p.maxHp = S.calcMaxHp(p); time.push(p); }
    g.saveSlots = vazios();
    g.saveSlots[3] = { team: time, badgeCount: 8, customName: 'Time novo' };
    el = S.towerEligiblePokemon();
    const doSave = el.filter(p => p.slot === 3);
    const doArquivo = el.filter(p => String(p.slot).indexOf('ap:') === 0);
    ok('save vivo e aposentado do MESMO slot convivem',
       doSave.length === 6 && doArquivo.length === 2,
       doSave.length + ' vivos, ' + doArquivo.length + ' do arquivo');
    const chaves = new Set(el.map(p => String(p.slot) + '#' + p.idx));
    ok('e nenhuma identidade (slot+idx) colide', chaves.size === el.length,
       chaves.size + ' de ' + el.length);
    /* ⚠️ mas a ORIGEM viaja junto: o item equipado e por SAVE, e sem ela o Venusaur do slot 3
       perderia o item que ele carregava */
    ok('o slot sintetico carrega a origem', String((doArquivo[0]||{}).slot) === 'ap:3',
       String((doArquivo[0]||{}).slot));
  }

  /* 3) A PORTA DOS MODOS: quem so tem aposentado ENTRA na Torre e no Ginasio */
  {
    g.saveSlots = vazios(); g.saveSlotsCarregados = true; g.modoBloqueado = null;
    ok('quem so tem aposentado entra no Ginasio da Cidade', S.exigeTimeCampeao(true) === true,
       'a porta fechou pra quem o pedido quer deixar entrar');
    ok('e a porta nao deixa recado', !g.modoBloqueado, String(g.modoBloqueado));
    /* ⚠️ E ELE CONTINUA FORA DAS LIGAS E DO ONLINE -- e esse o ponto inteiro da aposentadoria */
    g.modoBloqueado = null;
    ok('mas NAO entra nas ligas nem no online', S.exigeTimeCampeao() === false,
       'o aposentado vazou pra liga');
    ok('e ali ele leva o recado', !!g.modoBloqueado, 'sem recado');
    /* conta vazia de verdade continua fechada dos dois lados */
    g.aposentados = []; g.modoBloqueado = null;
    ok('conta sem nada continua fechada', S.exigeTimeCampeao(true) === false, 'entrou vazia');
  }

  /* ⚠️ 4) O ONCLICK DO MONTADOR: O SLOT VAI ENTRE ASPAS.
     Ele sempre foi um NUMERO, e com o aposentado ele pode ser `ap:3` -- sem as aspas o atributo
     vira `towerTogglePick(ap:3,0)`, que e SINTAXE INVALIDA: o clique nao faz nada e nao ha erro
     no console. E a mesma familia do JSON.stringify que matou o botao da notificacao da liga em
     17/09, e ela passa em qualquer assercao de estado -- so o navegador (ou esta trava) pega. */
  {
    g.saveSlots = vazios();
    g.saveSlots[3] = { team: Array.from({length:2}, () => {
      const p = S.createInstance('pidgey', 50); p.hp = p.maxHp = S.calcMaxHp(p); return p;
    }), badgeCount: 8, customName: 'Time vivo' };
    g.aposentados = [{ speciesId:'venusaur', level:62, shiny:true, slot:'3', em:2000 }];
    g.montOrdem = 'nivel'; g.montTipo = ''; g.montPagina = 0;
    const html = S.montadorDeTimeHtml([], 'towerTogglePick', 6);
    const chamadas = (html.match(/towerTogglePick\([^)]*\)/g) || []);
    ok('todo onclick do montador manda o slot entre aspas',
       chamadas.length > 0 && chamadas.every(c => /^towerTogglePick\('[^']*',\d+\)$/.test(c)),
       chamadas.slice(0, 3).join(' | '));
    ok('e o do aposentado carrega o slot sintetico',
       chamadas.some(c => c.indexOf("('ap:3'") >= 0), chamadas.join(' | '));

    /* e o toggle TEM que aceitar o slot como texto -- e ele e chamado sempre assim */
    let lista = S.alternarEscolhaDeTime([], 'ap:3', 0, 6);
    ok('escolher um aposentado funciona', lista.length === 1 && lista[0].speciesId === 'venusaur',
       JSON.stringify(lista.map(p => p.speciesId)));
    ok('e ele entra com o shiny', lista[0].shiny === true, 'perdeu o shiny');
    lista = S.alternarEscolhaDeTime(lista, '3', 0, 6);
    ok('e um do save vivo entra junto', lista.length === 2, String(lista.length));
    lista = S.alternarEscolhaDeTime(lista, 'ap:3', 0, 6);
    ok('e clicar de novo desmarca', lista.length === 1 && lista[0].speciesId !== 'venusaur',
       JSON.stringify(lista.map(p => p.speciesId)));
  }

  /* ⚠️ 5) A CHAVE DA ESPERA TEM QUE BATER NOS DOIS MOTORES.
     O CLAUDE.md ja avisa: "se as duas divergirem, a tela libera quem o desafio recusa -- ou apaga
     quem podia lutar". Com o aposentado ela quase divergiu: o cliente monta do `p.slot` (o
     sintetico) e o servidor tinha passado a usar a ORIGEM.
     ⚠️ E ela usa o SINTETICO de proposito -- com a origem, um Venusaur aposentado do slot 3
     dividiria a espera de 10 min com um Venusaur de uma jornada NOVA no mesmo slot. */
  {
    const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    /* ⚠️ A FATIA VAI ATE O FIM DA FUNCAO, e nao um numero de caracteres: a primeira versao
       cortava em 5000 e o `chave:` esta no 6579 -- as duas travas falhavam com o codigo CERTO.
       E a mesma armadilha da fatia vazia do `tentarGolpeEspecial`, que fez o teste passar sem
       ler nada. O `ok` do tamanho existe pra ela nao voltar a medir o vazio. */
    const iRes = srv.indexOf('async function resolverTimeDosSaves');
    const resolver = srv.slice(iRes, srv.indexOf('\nasync function', iRes + 10));
    ok('(a fatia do resolver tem tamanho)', resolver.length > 3000, resolver.length + ' chars');
    ok('o servidor monta a chave da espera do slot SINTETICO',
       /chave: chaveDoPokemonNaConta\(achado\.slot, real\)/.test(resolver),
       'ele esta usando a origem -- a chave vai divergir do cliente');
    /* ⚠️ mas o ITEM usa a ORIGEM, e sao coisas diferentes: o `equipados` da conta guarda
       `slot:raiz` e sobrevive ao save morrer, entao o aposentado continua com o item dele */
    ok('mas o slotDaConta (o item) usa a ORIGEM',
       /slotDaConta: String\(achado\.slotOrigem != null \? achado\.slotOrigem : achado\.slot\)/.test(resolver),
       'o aposentado vai perder o item que carregava');
    /* e o cliente chega na MESMA chave */
    const alvo = { slot:'ap:3', speciesId:'venusaur' };
    ok('e o cliente monta a mesma chave', S.chaveDoPokemon(alvo) === 'g_ap:3_venusaur',
       S.chaveDoPokemon(alvo));
  }
  g.aposentados = []; g.saveSlots = vazios();
}


console.log('\n=== AS MAQUINAS DE TECNICA (TMs) ===');
{
  /* Pedidas em 17/09/2026: *"implemente os TMs e coloque eles para vender, no minimo 100 cada,
     conforme o poder for maior, mais caro fica, e os TMs devem ser de uso unico"*. */
  const PEDIDOS = ['tm02','tm03','tm09','tm13','tm14','tm15','tm19','tm22','tm23','tm24','tm25',
                   'tm26','tm29','tm30','tm35','tm36','tm38','tm39','tm42','tm43','tm46','tm47','tm50'];

  /* 1) OS 23 QUE FORAM PEDIDOS, nem um a mais nem um a menos. */
  ok('sao exatamente os 23 pedidos',
     Object.keys(S.TMS).slice().sort().join(',') === PEDIDOS.slice().sort().join(','),
     Object.keys(S.TMS).join(','));
  /* ⚠️ E TODO GOLPE DE TM EXISTE NA TABELA DE GOLPES -- a licao da Lamina Solar: cadastrar uma
     Maquina pra golpe que o jogo nao tem e vender ar. */
  ok('e todos ensinam um golpe que EXISTE',
     Object.values(S.TMS).every(t => !!S.GOLPES[t.golpe]),
     Object.entries(S.TMS).filter(([k,t]) => !S.GOLPES[t.golpe]).map(([k])=>k).join(',') || 'todos');
  ok('e todos tem nome em portugues',
     Object.values(S.TMS).every(t => !!S.GOLPES_PT[t.golpe]),
     Object.values(S.TMS).filter(t => !S.GOLPES_PT[t.golpe]).map(t=>t.golpe).join(',') || 'todos');

  /* ⚠️ 2) OS SEIS GOLPES NOVOS SAO DA GEN 3, e a geracao importa em tres deles: lidos do arquivo
     moderno sairiam Rock Tomb 60 (era 50), Thief 60 (era 40) e Overheat 130 (era 140). */
  const GEN3 = { dragonclaw:['Dragon',80], rocktomb:['Rock',50], facade:['Normal',70],
                 secretpower:['Normal',70], thief:['Dark',40], overheat:['Fire',140] };
  Object.entries(GEN3).forEach(([id, ficha]) => {
    ok('  ' + id + ' e ' + ficha[0] + '/' + ficha[1] + ' (Gen 3)',
       S.GOLPES[id] && S.GOLPES[id][0] === ficha[0] && S.GOLPES[id][1] === ficha[1],
       JSON.stringify(S.GOLPES[id]));
  });
  /* ⚠️ E ELES FICAM FORA DO GOLPES_IDS, que e INDEXADO pelo APRENDIZADO: inserir um id no meio
     deslocaria os indices e trocaria o moveset das 250 especies EM SILENCIO. E a mesma regra que
     o cut, o surf e o fly ja seguem. */
  ok('e os seis ficam FORA do GOLPES_IDS (que e indexado)',
     Object.keys(GEN3).every(id => S.GOLPES_IDS.indexOf(id) < 0),
     Object.keys(GEN3).filter(id => S.GOLPES_IDS.indexOf(id) >= 0).join(',') || 'todos fora');

  /* ⚠️ 3) O PRECO E DERIVADO, nunca um numero solto: max(100, poder efetivo x 2). */
  ok('o piso e 100, como pedido', S.TM_PISO === 100, String(S.TM_PISO));
  ok('nenhum TM custa menos que o piso',
     Object.values(S.TMS).every(t => t.preco >= S.TM_PISO),
     Object.entries(S.TMS).filter(([k,t]) => t.preco < S.TM_PISO).map(([k,t])=>k+':'+t.preco).join(',') || 'todos');
  ok('e a tabela bate com a REGRA nos 23',
     Object.keys(S.TMS).every(id => S.TMS[id].preco === S.precoDoTM(id)),
     Object.keys(S.TMS).filter(id => S.TMS[id].preco !== S.precoDoTM(id))
       .map(id => id + ': tabela ' + S.TMS[id].preco + ' vs regra ' + S.precoDoTM(id)).join(', ') || 'os 23');
  /* ⚠️ E ELE USA O PODER EFETIVO, nao o cru: a Semente-Bala e poder 10 e bate de 2 a 5 vezes --
     pelo cru ela seria o golpe mais barato do jogo por um numero que nao descreve o que ela tira. */
  ok('e ele usa o poder EFETIVO (a Semente-Bala vale 30, nao 10)',
     S.poderEfetivo('bulletseed') === 30, String(S.poderEfetivo('bulletseed')));
  /* "conforme o poder for maior, mais caro fica" -- a ordem tem que ser monotona */
  {
    const pares = Object.values(S.TMS).map(t => [S.poderEfetivo(t.golpe), t.preco]);
    const furos = pares.filter(([po, pr]) => pares.some(([po2, pr2]) => po2 > po && pr2 < pr));
    ok('e mais poder nunca custa MENOS', furos.length === 0, furos.length + ' inversoes');
  }

  /* 4) NA LOJA: prateleira propria, cartao do golpe e o botao de aptos. */
  S.openLoja();
  S.escolherPrateleira('tms');
  S.escolherItemDaLoja('tm26');
  {
    const t = S.renderLoja();
    ok('a loja desenha o cartao do golpe do TM', t.indexOf('golpe-cartao') >= 0);
    /* ⚠️ E ELE E O MESMO cartaoDeGolpe das tres telas de golpe -- ser o mesmo e o ponto: o jogador
       compara o Terremoto daqui com os golpes que o pokemon ja tem la. */
    ok('e ele e o MESMO cartao das telas de golpe',
       t.indexOf(S.cartaoDeGolpe('earthquake', true, true)) >= 0);
    ok('e ha o botao de quem pode aprender', /abrirAptosDaMaquina\('tm26'\)/.test(t));
    ok('e o preco na tela e o da tabela', t.indexOf(S.selo('moeda') + ' ' + S.TMS.tm26.preco) >= 0,
       S.TMS.tm26.preco + '');
  }
  /* ⚠️ O ITEM COMUM NAO GANHA CARTAO: ele nao ensina golpe nenhum. */
  S.escolherPrateleira('batalha');
  S.escolherItemDaLoja('potion');
  ok('e item comum NAO ganha cartao de golpe', S.renderLoja().indexOf('golpe-cartao') < 0);

  /* 5) A LISTA DE APTOS -- o item 6 do pedido. */
  {
    const g = S.__getGame();
    g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
    g.saveSlots[0] = { team: [{ speciesId:'snorlax', level:70, name:'Snorlax' },
                              { speciesId:'caterpie', level:70, name:'Caterpie' }],
                       badgeCount: 8, name: 'Buzzo' };
    g.currentSaveSlot = 9;   // NAO e o slot 0: a lista tem que varrer TODOS os saves
    /* e o time ABERTO fica vazio: o timeDoSlot do slot corrente le o game.team, e um time
       sobrando de outro bloco entraria na conta sem estar em save nenhum */
    g.team = [];
    S.__setGame(g);
    S.abrirAptosDaMaquina('tm26');
    const meus = S.meusQueAprendem('tm26');
    ok('a lista varre TODOS os saves, nao o time aberto', meus.length === 1 && meus[0].mon.speciesId === 'snorlax',
       meus.map(x => x.mon.speciesId).join(',') || 'nenhum');
    const m = S.renderAptosModal();
    ok('e o modal nomeia o golpe', m.indexOf('Terremoto') >= 0);
    ok('e diz quantos SEUS aprendem', /<strong>1<\/strong>/.test(m), m.slice(0, 200));
    ok('e mostra a grade das que aprendem',
       (m.match(/pokedex-cell/g) || []).length === S.TMS.tm26.aprendem.length,
       (m.match(/pokedex-cell/g) || []).length + ' celulas de ' + S.TMS.tm26.aprendem.length);
    /* ⚠️ E QUANDO NENHUM DOS SEUS APRENDE ele DIZ isso -- e a informacao que decide a compra: um TM
       de 300 que ninguem seu aprende e dinheiro fora, e sem esta tela o jogador so descobre DEPOIS
       de pagar. */
    S.abrirAptosDaMaquina('tm02');   // Garra do Dragao: 7 especies, nenhuma no time
    ok('e avisa quando NENHUM seu aprende', /Nenhum pokémon seu/.test(S.renderAptosModal()));
    S.fecharAptosDaMaquina();
    ok('e fechar limpa', !S.__getGame().maquinaAptos);
  }

  /* ⚠️ 6) A TELA DE ENSINAR SERVE OS DOIS (HM e TM) PELA MESMA INTERFACE -- e isso e a decisao:
     'golpe' + 'aprendem' nos dois, entao a tela nao tem uma linha de excecao. */
  ok('maquinaPorId acha HM e TM',
     S.maquinaPorId('hm01').golpe === 'cut' && S.maquinaPorId('tm26').golpe === 'earthquake');
  ok('e podeAprenderMaquina vale pros dois',
     S.podeAprenderMaquina('hm01','venusaur') === true &&
     S.podeAprenderMaquina('tm26','snorlax') === true &&
     S.podeAprenderMaquina('tm26','caterpie') === false);
  /* ⚠️ 7) O GOLPE DE TM SE DESAPRENDE, e o de HM NAO. E a diferenca que mais separa os dois: o de
     HM e a CHAVE de uma rota e perde-lo numa tela de troca a fecharia de novo. */
  ok('o golpe de HM nao se desaprende', S.ehGolpeDeMaquina('cut') === true);
  ok('e o de TM SE desaprende (e um golpe comum)',
     Object.values(S.TMS).every(t => S.ehGolpeDeMaquina(t.golpe) === false),
     Object.values(S.TMS).filter(t => S.ehGolpeDeMaquina(t.golpe)).map(t=>t.golpe).join(',') || 'todos');

  /* 8) USO UNICO: a porta so abre com estoque, e o servidor e quem gasta. */
  {
    const g = S.__getGame();
    g.inventario = {};
    S.__setGame(g);
    S.abrirEnsinarHm('tm26');
    ok('sem estoque a tela NAO abre', S.__getGame().screen !== 'hmAlvo', S.__getGame().screen);
    g.inventario = { tm26: 1 };
    S.__setGame(g);
    S.abrirEnsinarHm('tm26');
    ok('com estoque ela abre', S.__getGame().screen === 'hmAlvo', S.__getGame().screen);
    ok('e quantosTMs le o inventario', S.quantosTMs('tm26') === 1 && S.quantosTMs('tm15') === 0);
    ok('e temMaquina vale pros dois tipos',
       S.temMaquina('tm26') === true && S.temMaquina('tm15') === false);
  }
  /* ⚠️ QUEM GASTA E O SERVIDOR, e o cliente chama DEPOIS de gravar o time -- se a chamada se
     perder, o jogador aprendeu e FICOU com a Maquina. O contrario seria pagar e nao aprender. */
  {
    const src = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const i = src.indexOf('async function ensinarOGolpeDaMaquina');
    const bloco = src.slice(i, i + 2600);
    ok('o cliente chama o usarTM do servidor', /httpsCallable\('usarTM'\)/.test(bloco));
    ok('e SO pra TM (o HM nao se gasta)', /if\(!ehTM\(e\.hm\)\) return;/.test(bloco));
    ok('e DEPOIS de gravar o time',
       bloco.indexOf('team: limparParaFirestore') < bloco.indexOf("httpsCallable('usarTM')"));
    const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    ok('e o servidor tem a callable', /exports\.usarTM = onCall/.test(srv));
    ok('e ela roda em TRANSACAO (duas abas nao gastam um TM duas vezes)',
       /exports\.usarTM[\s\S]{0,900}db\.runTransaction/.test(srv));
    ok('e o catalogo do servidor tem os 23, derivados do TMS',
       /Object\.entries\(TMS\)\.map\(\[?\(?\[id, tm\]\)? => \[id, \{ preco: tm\.preco/.test(srv)
       || /Object\.fromEntries\(Object\.entries\(TMS\)/.test(srv), 'derivado');
  }

  /* 9) OS EFEITOS NOVOS. */
  /* ⚠️ A FACHADA dobra com status -- e ela entra na ESCOLHA tambem, senao o motor deixaria de
     escolhe-la justamente quando ela vale o dobro. */
  {
    const mk = (id, g2) => { const q = S.createInstance(id, 50); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; q.ataques = [g2]; return q; };
    const a = mk('snorlax', 'facade'), b = mk('machoke', 'tackle');
    const limpo = S.calcDamage(a, b, S.makeSeededRng('f'), {});
    a._queimado = 'flamethrower';
    const queimado = S.calcDamage(a, b, S.makeSeededRng('f'), {});
    /* o x2 do golpe cancela o /2 da queimadura: o dano fica IGUAL, que e o que a Fachada e */
    ok('a Fachada anula a queimadura (o x2 cancela o /2)',
       Math.abs(queimado / limpo - 1) < 0.15, limpo + ' -> ' + queimado);
    ok('e o multiplicador e ' + S.FACHADA_MULT + 'x', S.multDaFachada('facade', a) === S.FACHADA_MULT);
    ok('e so pra QUEM tem status', S.multDaFachada('facade', mk('snorlax','facade')) === 1);
    ok('e so pra a FACHADA', S.multDaFachada('tackle', a) === 1);
    ok('e os tres status contam',
       ['_queimado','_envenenado','_paralisado'].every(m => {
         const q = mk('snorlax','facade'); q[m] = 'x'; return S.multDaFachada('facade', q) === 2; }));
    /* ⚠️ E O DOBRO ENTRA UMA VEZ SO: ele ja vem no 'poder' do melhorAtaque, e o calcDamage le esse
       campo -- multiplicar la de novo daria 4x (a armadilha do poder efetivo, 09/09/2026). */
    const c = mk('snorlax','facade'); c._queimado = 'x';
    ok('e o poder do melhorAtaque ja vem dobrado (e o dano NAO dobra de novo)',
       S.melhorAtaque(c, b).poder === S.GOLPES.facade[1] * 2,
       String(S.melhorAtaque(c, b).poder));
    /* a ESCOLHA muda: queimado, a Fachada passa a ganhar do golpe mais forte */
    const d = S.createInstance('snorlax', 50); d.maxHp = S.calcMaxHp(d); d.hp = d.maxHp;
    d.ataques = ['facade','bodyslam'];
    ok('e a escolha muda com status',
       S.melhorAtaque(d, b).golpe === 'bodyslam' && (d._queimado = 'x') && S.melhorAtaque(d, b).golpe === 'facade');
  }
  /* ⚠️ O PODER SECRETO depende do TERRENO, e o terreno vem da INSTANCIA (nunca de estado de
     modulo): uma variavel de modulo seria uma quarta porta de vazamento no servidor. */
  {
    const mk = (id, g2) => { const q = S.createInstance(id, 50); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; q.ataques = [g2]; q.lastMove = g2; return q; };
    const vulcao = S.TERRAINS.find(t => t.id === 'vulcao');
    const a = mk('snorlax','secretpower');
    ok('sem terreno ele NAO faz nada', S.tentarPoderSecreto(a, mk('machoke','tackle'), () => 0.01) === null);
    /* e NAO le o rng -- senao deslocaria a semente de toda batalha sem o TM43 */
    { let n = 0; S.tentarPoderSecreto(a, mk('machoke','tackle'), () => { n++; return 0.01; });
      ok('e nem le o rng (a semente nao se move)', n === 0, n + ' leituras'); }
    { let n = 0; const z = mk('snorlax','tackle');
      S.applyTerrainBuff([z], vulcao);
      S.tentarPoderSecreto(z, mk('machoke','tackle'), () => { n++; return 0.01; });
      ok('e outro golpe tambem nao le o rng', n === 0, n + ' leituras'); }
    S.applyTerrainBuff([a], vulcao);
    ok('o terreno fica na INSTANCIA, com prefixo de sublinhado (nao vai pro Firestore)',
       Array.isArray(a._terreno) && a._terreno.indexOf('Fire') >= 0, JSON.stringify(a._terreno));
    const alvo = mk('machoke','tackle');
    ok('e no Vulcao ele QUEIMA', S.tentarPoderSecreto(a, alvo, () => 0.01) === '_queimado');
    ok('e a marca fica no alvo', alvo._queimado === 'secretpower', String(alvo._queimado));
    /* a chance e a declarada */
    { let n = 0; for(let i = 0; i < 3000; i++){ const c = mk('machoke','tackle');
        if(S.tentarPoderSecreto(a, c, S.makeSeededRng('ps' + i))) n++; }
      ok('e a chance e ' + Math.round(S.CHANCE_PODER_SECRETO * 100) + '%',
         Math.abs(n / 3000 - S.CHANCE_PODER_SECRETO) < 0.03, (100 * n / 3000).toFixed(1) + '%'); }
    /* ⚠️ A IMUNIDADE DE CADA STATUS VALE: sem isso o TM43 seria a porta dos fundos das quatro */
    const charizard = mk('charizard','tackle');
    ok('e o Fogo continua imune a queimadura (pelo TM43 tambem)',
       S.tentarPoderSecreto(a, charizard, () => 0.01) === null);
    /* os quatro terrenos que dao efeito */
    ok('sao QUATRO tipos de terreno com efeito',
       Object.keys(S.EFEITO_DO_TERRENO).slice().sort().join(',') === 'Electric,Fire,Ice,Poison',
       Object.keys(S.EFEITO_DO_TERRENO).join(','));
  }
  /* ⚠️ O TM03 (Pulso de Agua): a "PASSIVA PELO GOLPE" de 17/09 VIROU A MECANICA em 24/09/2026.
     Ate aquela data a confusao era passiva da ESPECIE e carregar um golpe que confunde DAVA a
     passiva a quem nao estava na lista; hoje quem confunde e o GOLPE, com a chance dele -- ou seja
     o que o pedido do TM03 queria virou o comportamento normal, sem caminho proprio.
     ⚠️ ESTA TRAVA NAO FOI APAGADA: ela virou a trava da regra NOVA. Sem ela, alguem devolve a
     passiva da especie e o TM03 volta a precisar de excecao **sem ninguem ver**. */
  {
    /* ⚠️ o createInstance devolve hp 0 -- quem enche a barra e o calcMaxHp (a armadilha da casa) */
    const mkc = (id, lv, ats) => { const q = S.createInstance(id, lv || 50); q.maxHp = S.calcMaxHp(q);
                                   q.hp = q.maxHp; if(ats){ q.ataques = ats; q.lastMove = ats[0]; } return q; };
    const alvoDe = () => mkc('snorlax', 50);
    const semGolpe = mkc('blastoise', 50, ['surf']);
    ok('sem o golpe, o Blastoise nao confunde ninguem',
       S.tentarConfundir(semGolpe, alvoDe(), () => 0.001) === null);
    const comGolpe = mkc('blastoise', 50, ['waterpulse','surf']);
    const alvo2 = alvoDe();
    ok('com o Pulso de Agua ele confunde',
       S.tentarConfundir(comGolpe, alvo2, () => 0.001) === 'waterpulse');
    /* ⚠️ AS CONSTANTES SAO LIDAS DO FONTE: `const` NAO vira propriedade global do sandbox, entao
       `S.CONFUSAO_TURNOS_MIN` volta undefined e a comparacao daria FALSO com o valor CERTO -- a
       licao que a Queimada e a Arena 1x1 ja custaram. */
    const konstC = (n2) => { const m = require('fs')
        .readFileSync(path.join(raiz, 'index.html'), 'utf8')
        .match(new RegExp('const ' + n2 + ' = ([0-9.]+)')); return m ? Number(m[1]) : null; };
    const tMin = konstC('CONFUSAO_TURNOS_MIN'), tMax = konstC('CONFUSAO_TURNOS_MAX');
    ok('e a marca fica no ALVO, com ' + tMin + ' a ' + tMax + ' turnos',
       tMin === 2 && tMax === 5 && alvo2._confuso >= tMin && alvo2._confuso <= tMax,
       String(alvo2._confuso));
    /* ⚠️ A ESPECIE NAO CONFUNDE MAIS -- a passiva acabou, e e isso que o pedido de 24/09 pede.
       O Zubat era o dono declarado dela (o Supersom), e o Supersom e golpe de STATUS: ele nem
       esta na base, ou seja ninguem o carrega. */
    const zubat = mkc('zubat', 30, ['wingattack']);
    ok('e a ESPECIE nao confunde mais (o Zubat era o dono do Supersom)',
       S.tentarConfundir(zubat, alvoDe(), () => 0.001) === null);
    /* ⚠️ E ESTA PERGUNTA E FEITA AO ARQUIVO, nunca ao sandbox: `const CONFUSAO = {...}` NAO vira
       propriedade global, entao `typeof S.CONFUSAO === 'undefined'` seria VERDADE mesmo com a
       tabela de volta -- a trava passaria em branco sobre a volta da passiva. */
    ok('e a tabela da passiva nao existe mais (no FONTE, nos dois motores)',
       !/const CONFUSAO = /.test(require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8')) &&
       !/const CONFUSAO = /.test(require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8')));
    ok('e o Supersom nao esta entre os seis (golpe de STATUS)',
       !S.GOLPES_QUE_CONFUNDEM.supersonic && !S.GOLPES.supersonic);
    /* ⚠️ E VALE PRA QUALQUER GOLPE QUE CONFUNDA, nao so pro TM03 */
    ok('e vale pros seis golpes que confundem',
       Object.keys(S.GOLPES_QUE_CONFUNDEM).every(g => {
         const q = mkc('snorlax', 50, [g]);
         return S.tentarConfundir(q, alvoDe(), () => 0.001) === g; }),
       Object.keys(S.GOLPES_QUE_CONFUNDEM).join(','));
    ok('e todos eles existem na tabela de golpes',
       Object.keys(S.GOLPES_QUE_CONFUNDEM).every(g => !!S.GOLPES[g]));
  }

  /* ⚠️ 10) O AVISO NO CARTAO -- o pedido diz *"coloque essas informacoes no card"*. */
  {
    /* ⚠️ A CONTA E DERIVADA, nao um numero solto: quem avisa e exatamente quem TEM efeito no
       motor, e um numero escrito aqui envelheceria no proximo golpe que ganhar um -- a licao do
       "59 especies" da ficha da Pokedex. */
    const temEfeito = g2 => !!(S.MULTI_GOLPE[g2] || S.GOLPES_DRENO[g2] || S.GOLPES_SO_DORMINDO[g2] ||
      S.GOLPES_QUE_QUEIMAM[g2] || S.GOLPES_QUE_CONGELAM[g2] || S.GOLPES_QUE_ENVENENAM[g2] ||
      S.GOLPES_QUE_PARALISAM[g2] || S.GOLPES_QUE_MUDAM_ESTAGIO[g2] || S.GOLPES_QUE_CONFUNDEM[g2] ||
      g2 === S.GOLPE_FACHADA || g2 === S.GOLPE_PODER_SECRETO || g2 === S.GOLPE_ROLAMENTO);
    const comEfeito = Object.entries(S.TMS).filter(([id, t]) => S.obsDoGolpe(t.golpe).length);
    ok('todo TM com efeito no motor AVISA no cartao',
       Object.entries(S.TMS).every(([id, t]) => !temEfeito(t.golpe) || S.obsDoGolpe(t.golpe).length),
       Object.entries(S.TMS).filter(([id, t]) => temEfeito(t.golpe) && !S.obsDoGolpe(t.golpe).length)
         .map(([id]) => id).join(',') || comEfeito.length + ' avisam');
    /* e o contrario: quem avisa TEM efeito -- senao o cartao prometeria o que o motor nao faz */
    ok('e todo TM que avisa TEM efeito no motor',
       comEfeito.every(([id, t]) => temEfeito(t.golpe)),
       comEfeito.filter(([id, t]) => !temEfeito(t.golpe)).map(([id]) => id).join(',') || 'todos');
    /* os dois que o pedido NOMEIA */
    ok('  o TM50 (Overheat) avisa o -2 no PROPRIO',
       /de quem usa/.test(S.obsDoGolpe('overheat').join(' ')), S.obsDoGolpe('overheat').join(' | '));
    ok('  o TM43 (Poder Secreto) avisa o terreno',
       /terreno/.test(S.obsDoGolpe('secretpower').join(' ')), S.obsDoGolpe('secretpower').join(' | '));
    ok('  o TM03 (Pulso de Agua) avisa a passiva',
       /confus/.test(S.obsDoGolpe('waterpulse').join(' ')), S.obsDoGolpe('waterpulse').join(' | '));
    ok('  e o TM42 (Fachada) avisa o dobro',
       S.obsDoGolpe('facade').join(' ').indexOf(String(S.FACHADA_MULT) + 'x') >= 0,
       S.obsDoGolpe('facade').join(' | '));
    /* ⚠️ E A CHANCE/ O MULTIPLICADOR SAEM DAS CONSTANTES, nunca de um texto fixo: mexer no
       balanceamento sem a frase acompanhar e o defeito que a especialidade teve. */
    ok('e a chance do TM43 sai da CONSTANTE',
       S.obsDoGolpe('secretpower').join(' ').indexOf(Math.round(S.CHANCE_PODER_SECRETO * 100) + '%') >= 0);
  }

  /* ⚠️ 11) OS DOIS MOTORES: a tabela TMS tem que ser identica, senao o golpe some na liga. */
  {
    const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const tab = t => { const i = t.indexOf('const TMS = {'); const f = t.indexOf('\n};', i);
                       return t.slice(i, f); };
    ok('a tabela TMS e a MESMA nos dois motores', tab(cli) === tab(srv) && tab(cli).length > 1000,
       'cliente ' + tab(cli).length + ' / servidor ' + tab(srv).length);
    /* e os seis golpes novos tambem */
    ok('e os seis golpes novos estao nos DOIS',
       Object.keys(GEN3).every(id => srv.indexOf(id + ": ['") >= 0 || srv.indexOf(id + ':[') >= 0),
       Object.keys(GEN3).filter(id => srv.indexOf(id) < 0).join(',') || 'todos');
  }
}


console.log('\n=== O TM COMPRADO CHEGA NA MOCHILA (17/09/2026) ===');
{
  /* Reportado assim: *"ao comprar um TM, ele nao foi para a Mochila, ele simplesmente sumiu"*.
     ⚠️ A CAUSA: o 'pilhasDaPrateleira' devolvia SO OS HMs na prateleira 'tms' -- ela foi escrita
     quando era so deles, e o 'return' dos HMs saia antes de o filtro do inventario ser alcancado.
     O TM estava no armazem o tempo todo (o quantoTenho o via, o servidor tinha gravado); o que
     faltava era a mochila LISTA-LO.
     ⚠️ E A TRAVA QUE EXISTIA NAO PEGOU porque ela media a LOJA ("a prateleira tem os 23 TMs"), e a
     loja estava certa. O caminho que ninguem cobria era o de DEPOIS da compra. Esta e de ponta a
     ponta: comprar -> aparecer na mochila -> abrir a tela de ensinar. */
  const g5 = S.__getGame();
  g5.moedas = 5000;
  g5.inventario = {};
  g5.hms = ['hm01'];
  g5.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
  g5.saveSlots[0] = { team:[{ speciesId:'snorlax', level:70, name:'Snorlax' }], badgeCount:8, name:'Buzzo' };
  g5.currentSaveSlot = 0;
  g5.team = [];
  S.__setGame(g5);

  /* 1) SEM TER COMPRADO: so o HM esta la. */
  /* os tres HMs aparecem sempre: sem TM, a prateleira tem exatamente eles */
  ok('sem TM, a prateleira tem so os HMs',
     S.pilhasDaPrateleira('tms').map(x => x.item).join(',') === Object.keys(S.HMS).join(','),
     S.pilhasDaPrateleira('tms').map(x => x.item).join(',') || '(vazia)');

  /* 2) DEPOIS DA COMPRA (o servidor grava no inventario -- aqui simulamos a resposta dele). */
  S.__getGame().inventario = { tm26: 1 };
  const pilhas = S.pilhasDaPrateleira('tms');
  ok('comprou um TM e ele APARECE na mochila',
     pilhas.some(x => x.item === 'tm26'), pilhas.map(x => x.item).join(',') || '(vazia)');
  /* e o HM continua la -- as duas fontes convivem */
  ok('e o HM continua junto', pilhas.some(x => x.item === 'hm01'),
     pilhas.map(x => x.item).join(','));
  /* ⚠️ E OS HMs VEM PRIMEIRO: eles sao permanentes, e o TM some quando ensina -- uma lista que muda
     de ordem conforme o estoque e pior que uma que nao muda. */
  ok('e os HMs vem primeiro', pilhas[0].item === 'hm01', pilhas.map(x => x.item).join(','));
  /* a quantidade e a do inventario, nao 1 */
  S.__getGame().inventario = { tm26: 3 };
  ok('e a quantidade e a do armazem',
     S.pilhasDaPrateleira('tms').find(x => x.item === 'tm26').quantidade === 3,
     JSON.stringify(S.pilhasDaPrateleira('tms')));

  /* 3) E ELE CHEGA NA TELA, com o botao de ensinar. */
  S.openInventario();
  S.escolherPrateleiraDaMochila('tms');
  S.escolherItem('tm26');
  {
    const t = S.renderInventario();
    ok('a mochila desenha a linha do TM', t.indexOf('TM26') >= 0);
    ok('e o quadro traz o botao de Ensinar', /abrirEnsinarHm\('tm26'\)/.test(t));
    ok('e ele avisa que some depois', /some depois/.test(t), '(o TM e de uso unico)');
    /* e a tela de ensinar abre de verdade */
    S.abrirEnsinarHm('tm26');
    ok('e a tela de ensinar ABRE', S.__getGame().screen === 'hmAlvo', S.__getGame().screen);
  }

  /* ⚠️ 4) O ROTULO DA PRATELEIRA DEPENDE DA TELA (a pedido): a LOJA vende TM e so TM (HM ninguem
     compra), e a MOCHILA tem HM de verdade dentro. Um rotulo unico mentiria numa das duas. */
  {
    const g6 = S.__getGame();
    g6.screen = 'loja'; S.__setGame(g6);
    S.openLoja();
    const naLoja = (S.renderLoja().match(/loja-aba-nome">([^<]*)/g) || []).map(x => x.split('>')[1]);
    ok('na LOJA a prateleira se chama "TMs"', naLoja.indexOf('TMs') >= 0, naLoja.join(' | '));
    ok('e nao diz HMs (nenhum HM esta a venda)', naLoja.indexOf('TMs/HMs') < 0, naLoja.join(' | '));
    S.openInventario();
    const naMochila = (S.renderInventario().match(/loja-aba-nome">([^<]*)/g) || []).map(x => x.split('>')[1]);
    ok('e na MOCHILA continua "TMs/HMs"', naMochila.indexOf('TMs/HMs') >= 0, naMochila.join(' | '));
    /* ⚠️ E A LISTA CONTINUA SENDO UMA -- o que varia e a palavra. Duas listas divergiriam no
       proximo item, que e a licao das tres telas de golpe. */
    ok('e a lista de prateleiras e UMA so',
       S.LOJA_PRATELEIRAS.length === 3 && S.LOJA_PRATELEIRAS[2].id === 'tms',
       S.LOJA_PRATELEIRAS.map(x => x.id).join(','));
  }
}

console.log('\n=== OS TRES HMs NA MOCHILA, E A PALAVRA QUE SAIU (17/09/2026) ===');
{
  /* Pedido assim: *"na mochila, no botão de TMs/HMs, adcione os 3 HMs existentes no jogo, porém se
     o jogador não tiver, deixar desativado o botão de usar, e escreva o que é necessário fazer para
     obter o HM. Não use a palavra máquina para descrever TM ou HM, ninguem entende isso"*. */
  const g = S.__getGame();
  g.authUser = { uid:'t' };
  g.inventario = {}; g.rareCandies = 0;
  g.hms = ['hm01'];                 // tem UM dos tres
  g.inventarioAba = 'tms';
  g.inventarioSel = null;
  g.inventarioErro = null;
  S.__setGame(g);

  const pilhas = S.pilhasDaPrateleira('tms');
  const ids = pilhas.filter(p => p.hm).map(p => p.item);
  ok('os TRES HMs aparecem, tendo ou nao', ids.length === Object.keys(S.HMS).length,
     ids.join(', '));
  ok('e o que ele TEM nao e marcado como faltando',
     pilhas.find(p => p.item === 'hm01').falta === false);
  ok('e os que faltam sao marcados',
     pilhas.filter(p => p.hm && p.falta).map(p => p.item).join(',') === 'hm02,hm03',
     pilhas.filter(p => p.hm && p.falta).map(p => p.item).join(','));

  /* ---------- o quadro de quem FALTA ---------- */
  g.inventarioSel = 'hm02'; S.__setGame(g);
  const falta = S.renderInventario();
  ok('o HM que falta diz COMO conseguir', /Como conseguir/.test(falta));
  ok('e o texto e o `comoGanhar` daquele HM',
     falta.indexOf(S.HMS.hm02.comoGanhar.slice(0, 40)) >= 0,
     S.HMS.hm02.comoGanhar.slice(0, 50) + '...');
  /* ⚠️ DESABILITADO, e nao ESCONDIDO: sumir com o botao faria a linha nao explicar o que ela e. */
  ok('e o botao de ensinar fica DESABILITADO',
     /<button class="btn success"\s+disabled/.test(falta));

  /* ---------- o quadro de quem TEM ---------- */
  g.inventarioSel = 'hm01'; S.__setGame(g);
  const tem = S.renderInventario();
  ok('o HM que ele TEM nao mostra o caminho', !/Como conseguir/.test(tem));
  ok('e o botao dele funciona',
     /<button class="btn success"\s+onclick="abrirEnsinarHm\('hm01'\)"/.test(tem));

  /* ---------- ⚠️ A PALAVRA, varrida em TODAS as telas que falam de TM/HM ---------- */
  /* Ela vive numa varredura e nao num `indexOf` solto porque comentario HTML VAI PRO DOM -- foi
     exatamente assim que a primeira versao desta trava acusou o proprio comentario que eu tinha
     acabado de escrever. A regra e sobre o que o JOGADOR le. */
  const PROIBIDA = /[Mm]áquina|[Mm]aquina/;
  const telas = [];
  ['hm01','hm02','hm03'].forEach(id => {
    g.inventarioSel = id; S.__setGame(g);
    telas.push(['mochila/' + id, S.renderInventario()]);
  });
  g.hms = ['hm01','hm02','hm03']; g.inventarioSel = 'hm01'; S.__setGame(g);
  telas.push(['mochila/com-os-tres', S.renderInventario()]);
  /* a tela de ensinar, os dois niveis */
  S.abrirEnsinarHm('hm01');
  telas.push(['ensinar/times', S.renderHmAlvo()]);
  const sujas = telas.filter(([, html]) => PROIBIDA.test(html)).map(([nome]) => nome);
  ok('a palavra nao aparece em tela nenhuma', sujas.length === 0,
     sujas.length ? sujas.join(', ') : telas.length + ' telas varridas');
}


/* ============================================================================
   O DISCO DO TM SAI NA COR DO TIPO (17/09/2026)
   ----------------------------------------------------------------------------
   Pedido assim: *"para os TMs, deixe o disco da cor do tipo do ataque que ele ensina"*.

   ⚠️ O DESENHO E UM SO, e e isso que a trava protege: o `selo('tm')` usa `currentColor` no corpo
   e branco/preto TRANSLUCIDOS no volume, entao a cor entra no USO e nao no simbolo. Sem isso
   seriam 23 simbolos identicos de cor diferente -- e o proximo TM nasceria sem cor.
   ============================================================================ */
{
  console.log('\n=== O DISCO DO TM NA COR DO TIPO ===');
  const corDe = (html) => (String(html).match(/color:\s*([^";]+)/) || [])[1] || null;

  /* 1) OS 23 TMs: cada um na cor do tipo do golpe que ele ensina */
  const ids = Object.keys(S.TMS);
  const semCor = [], corErrada = [];
  ids.forEach(id => {
    const it = S.ITENS[id];
    const tipo = (S.GOLPES[S.TMS[id].golpe] || [])[0];
    const c = corDe(it && it.icone);
    if(!c) { semCor.push(id); return; }
    if(c !== S.TYPE_COLORS[tipo]) corErrada.push(id + ' (' + tipo + ': ' + c + ' != ' + S.TYPE_COLORS[tipo] + ')');
  });
  ok('os ' + ids.length + ' TMs usam o disco', ids.every(id => String(S.ITENS[id].icone).indexOf('#s-tm') >= 0),
     ids.filter(id => String(S.ITENS[id].icone).indexOf('#s-tm') < 0).join(', '));
  ok('e cada um na cor do TIPO do golpe que ensina', !semCor.length && !corErrada.length,
     semCor.concat(corErrada).slice(0, 4).join(' | '));
  /* ⚠️ a cor tem que VARIAR de verdade: um bug que pintasse todos de Normal passaria na trava de
     cima se o TYPE_COLORS fosse lido do mesmo lugar errado */
  const cores = new Set(ids.map(id => corDe(S.ITENS[id].icone)));
  ok('e as cores variam mesmo (nao e uma so)', cores.size >= 8, cores.size + ' cores distintas em ' + ids.length + ' TMs');

  /* 2) OS 3 HMs: mesma regra, e o desenho e o do HM (com o risco) */
  Object.entries(S.HMS).forEach(([id, hm]) => {
    const tipo = (S.GOLPES[hm.golpe] || [])[0];
    ok('  ' + id + ' usa o disco de HM na cor de ' + tipo,
       String(hm.icone).indexOf('#s-hm') >= 0 && corDe(hm.icone) === S.TYPE_COLORS[tipo],
       String(hm.icone).slice(0, 90));
  });

  /* 3) O DESENHO E UM SO -- o que separa TM de HM e o risco, nao 23 simbolos */
  ok('o disco e UM desenho, nao um por tipo',
     !!S.DESENHOS.tm && !Object.keys(S.DESENHOS).some(n => /^tm[0-9]/.test(n)),
     Object.keys(S.DESENHOS).filter(n => /^tm/.test(n)).join(' '));
  /* ⚠️ o corpo e currentColor: sem isso a cor do <use> nao pintaria nada */
  ok('e o corpo dele e currentColor', S.DESENHOS.tm.some(l => l.indexOf('*') >= 0) &&
     S.PALETA_SELO['*'] === 'currentColor');
  ok('com o volume em branco e preto TRANSLUCIDOS (funciona sobre qualquer cor)',
     S.DESENHOS.tm.some(l => l.indexOf('+') >= 0) && S.DESENHOS.tm.some(l => l.indexOf('-') >= 0) &&
     /^#[0-9a-f]{8}$/i.test(S.PALETA_SELO['+']) && /^#[0-9a-f]{8}$/i.test(S.PALETA_SELO['-']),
     S.PALETA_SELO['+'] + ' / ' + S.PALETA_SELO['-']);
  /* e o SVG gerado repassa isso */
  ok('e o <symbol> sai com fill="currentColor"', S.svgDosSelos().indexOf('fill="currentColor"') >= 0);
  ok('e o selo com cor poe o style, sem cor nao poe',
     corDe(S.selo('tm', '', '#F08030')) === '#F08030' && corDe(S.selo('tm')) === null,
     S.selo('tm').slice(0, 70));

  /* 4) OS 11 ITENS COMUNS tambem sao desenho -- nenhum sobrou com emoji */
  const comuns = Object.entries(S.ITENS).filter(([id, i]) => !i.tm);
  const comEmoji = comuns.filter(([id, i]) => String(i.icone).indexOf('#s-') < 0);
  ok('os ' + comuns.length + ' itens comuns usam selo', comEmoji.length === 0,
     comEmoji.map(([id, i]) => id + '=' + i.icone).join(' '));
  /* ⚠️ a POCAO e a SUPER POCAO sao o MESMO frasco em cores diferentes: elas sao o mesmo item em
     duas forcas, e dois desenhos fariam procurar duas coisas */
  ok('e a Pocao e a Super Pocao dividem o frasco, com liquidos diferentes',
     String(S.ITENS.potion.icone).indexOf('#s-pocao') >= 0 &&
     String(S.ITENS.hyperpotion.icone).indexOf('#s-pocao') >= 0 &&
     corDe(S.ITENS.potion.icone) !== corDe(S.ITENS.hyperpotion.icone),
     corDe(S.ITENS.potion.icone) + ' x ' + corDe(S.ITENS.hyperpotion.icone));
  /* e o Atk/Def Up reusam a espada e o escudo da BATALHA: mesma ideia, mesmo icone */
  ok('e o Atk/Def Up reusam a espada e o escudo da batalha',
     String(S.ITENS.atk_up.icone).indexOf('#s-espada') >= 0 &&
     String(S.ITENS.def_up.icone).indexOf('#s-escudo') >= 0);
}

/* ============================================================================
   A LISTA FICA ONDE ESTAVA (18/09/2026)
   ----------------------------------------------------------------------------
   Reportado: *"quando eu clico em um TM na lista de TMs na loja, se eu clicar no ultimo da
   lista, a lista volta para o topo automaticamente"*.

   ⚠️ O "render" ja preservava a rolagem da PAGINA desde sempre -- o que faltava era a rolagem
   de DENTRO. Dez listas do jogo rolam por dentro ("overflow-y:auto"), e o 'innerHTML' novo
   zerava todas.

   ⚠️ E A TRAVA NAO NOMEIA NENHUMA DAS DEZ, de proposito: o mecanismo tambem nao tem lista de
   classes, e e isso que faz ele cobrir a proxima que nascer rolavel. O que se cobra e o
   INVARIANTE -- quem tem scrollTop > 0 e reposto --, e o caso de uma classe NOVA, que nunca
   foi cadastrada em lugar nenhum, prova a cobertura inteira de uma vez.
   ============================================================================ */
{
  console.log('\n=== A LISTA FICA ONDE ESTAVA ===');

  /* um DOM de mentira: so o que os dois ajudantes usam (className, scrollTop, querySelectorAll) */
  const elem = (cls, filhos) => ({
    className: cls, scrollTop: 0, _filhos: filhos || [],
    querySelectorAll(){ const fora = []; const anda = (n) => n._filhos.forEach(f => { fora.push(f); anda(f); }); anda(this); return fora; },
  });
  elem.prototype = null;
  const arvore = () => {
    const lista  = elem('loja-lista');
    const miolo  = elem('loja-miolo');
    const outra  = elem('loja-lista');          /* DUAS listas de mesma classe na mesma tela */
    const raiz   = elem('app', [elem('loja-fixa', [miolo]), lista, outra]);
    return { raiz, lista, miolo, outra };
  };

  {
    const a = arvore();
    a.lista.scrollTop = 906; a.miolo.scrollTop = 40;
    const g = S.guardarRolagens(a.raiz);
    const b = arvore();                          /* o redesenho: elementos NOVOS, HTML igual */
    S.reporRolagens(b.raiz, g);
    ok('a lista volta pra onde estava', b.lista.scrollTop === 906, b.lista.scrollTop + ' (esperado 906)');
    ok('e cada conteiner volta pro SEU valor', b.miolo.scrollTop === 40, b.miolo.scrollTop + ' (esperado 40)');
  }

  /* ⚠️ DUAS LISTAS DE MESMA CLASSE NA MESMA TELA nao podem trocar de rolagem entre si -- e por
     isso a chave leva a POSICAO entre os irmaos de mesma classe, e nao so a classe. */
  {
    const a = arvore();
    a.lista.scrollTop = 100; a.outra.scrollTop = 700;
    const g = S.guardarRolagens(a.raiz);
    const b = arvore();
    S.reporRolagens(b.raiz, g);
    ok('duas listas de mesma classe nao trocam de rolagem',
       b.lista.scrollTop === 100 && b.outra.scrollTop === 700,
       b.lista.scrollTop + ' e ' + b.outra.scrollTop + ' (esperado 100 e 700)');
  }

  /* ⚠️ A PROVA DA COBERTURA: uma classe que nunca foi cadastrada em lugar nenhum. Se um dia
     alguem trocar o mecanismo por uma lista de classes escritas a mao, ESTE caso cai -- e ele
     e o unico que cai, porque os outros nomeiam classes que a lista teria. */
  {
    const nova = elem('lista-que-ninguem-cadastrou');
    const raiz = elem('app', [nova]);
    nova.scrollTop = 333;
    const g = S.guardarRolagens(raiz);
    const nova2 = elem('lista-que-ninguem-cadastrou');
    /* g pode vir null se alguem trocar o mecanismo por uma lista de classes -- e e justamente
       esse o retrocesso que este caso existe pra pegar, entao ele falha explicando em vez de
       estourar no reporRolagens */
    if(g) S.reporRolagens(elem('app', [nova2]), g);
    ok('uma classe NOVA, nunca cadastrada, e preservada', nova2.scrollTop === 333,
       g ? nova2.scrollTop + ' (esperado 333)' : 'nem foi guardada -- o mecanismo virou lista de classes?');
  }

  /* quem NAO rolou nao entra: guardar tudo faria o repor escrever scrollTop em 185 elementos */
  {
    const a = arvore();
    ok('quem nao rolou nao e guardado', S.guardarRolagens(a.raiz) === null, 'guardou algo');
    a.lista.scrollTop = 5;
    ok('e so quem rolou entra', Object.keys(S.guardarRolagens(a.raiz)).length === 1, 'entrou mais de um');
  }

  /* elemento sem classe nao tem chave: ele seria indistinguivel de qualquer outro sem classe */
  {
    const sem = elem('');
    sem.scrollTop = 50;
    ok('elemento sem classe e ignorado', S.guardarRolagens(elem('app', [sem])) === null, 'guardou um sem classe');
  }

  /* ⚠️ A TROCA DE PRATELEIRA VOLTA AO TOPO: ali a lista e OUTRA, e manter a rolagem largaria o
     jogador no meio de uma que ele nunca rolou. O teste LE O CODIGO porque o efeito so aparece
     no navegador (o zerar marca, e quem zera e o render ao nao achar a chave). */
  const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const script = cli.slice(cli.indexOf('<script>'), cli.lastIndexOf('</script>'));
  ['escolherPrateleira(p){', 'escolherPrateleiraDaMochila(p){'].forEach(nome => {
    const i = script.indexOf('function ' + nome);
    const corpo = i < 0 ? '' : script.slice(i, i + 420);
    ok('trocar de prateleira zera a lista (' + nome.replace('(p){','') + ')',
       corpo.indexOf("zerarRolagemDaLista('loja-lista')") >= 0, 'sem o zerar');
  });

  /* ⚠️ E A PRESERVACAO SO VALE NA MESMA TELA: trocar de tela tem que comecar do topo, senao o
     jogador cai no meio de uma tela que ele acabou de abrir. Quem responde e o "mesmaTela", que
     ja guardava a rolagem da PAGINA -- os dois passaram a andar juntos. */
  {
    const i = script.indexOf('const rolagensInternas');
    const trecho = i < 0 ? '' : script.slice(i, i + 200);
    ok('a rolagem de dentro so e guardada na MESMA tela',
       trecho.indexOf('mesmaTela ? guardarRolagens(app) : null') >= 0, 'sem o mesmaTela');
    const j = script.indexOf('if(rolagensInternas) reporRolagens');
    ok('e o repor vem DEPOIS do innerHTML', j > script.indexOf('app.innerHTML = html;') && j > 0,
       'o repor nao vem depois do innerHTML');
  }

  /* ⚠️ NENHUMA LISTA DE CLASSES NO MECANISMO -- e a linha que garante as dez de uma vez. */
  {
    const i = script.indexOf('function guardarRolagens(');
    const corpo = script.slice(i, script.indexOf('function reporRolagens('));
    const nomeia = ['loja-lista','notif-lista','tower-rank-box','rota-mons-box','unown-box',
                    'dex-golpes-lista','aptos-box','loja-miolo','notif-corpo-miolo','dex-modal-conteudo']
                   .filter(c => corpo.indexOf(c) >= 0);
    ok('o mecanismo nao nomeia nenhuma lista', nomeia.length === 0, 'nomeia: ' + nomeia.join(', '));
  }

  /* e as dez continuam existindo: se alguma parar de rolar por dentro, a trava avisa em vez de
     a cobertura encolher em silencio */
  {
    const css = cli.slice(0, cli.indexOf('<script>'));
    const rolam = (css.match(/overflow-y\s*:\s*auto/g) || []).length;
    ok('o jogo tem listas que rolam por dentro (>= 8)', rolam >= 8, rolam + ' conteineres');
  }
}

/* ============================================================================
   APOSENTAR APAGA O SAVE, E O TIME VAI PRO PROF. CARVALHO (18/09/2026)
   ----------------------------------------------------------------------------
   Pedido: *"apos aposentar um time, o save deve ser deletado automaticamente, entao quando o
   usuario clicar para se aposentar, ele deve saber disso e clicar em confirmar"* e *"adicione um
   botao dentro da pokedex chamado (Pokemons com o Prof. Carvalho) ... exibindo nome, tipos,
   level, e ataques"*.

   ⚠️ O SAVE MORRE, MAS O TIME NAO: o pedido do mesmo dia corrigiu a leitura -- eles continuam
   valendo na Torre e no Ginasio da Cidade (montados do ARQUIVO da conta) e so perdem a liga e a
   batalha online. O bloco que cobra isso e o "O APOSENTADO NA TORRE E NO GINASIO", logo abaixo.
   ============================================================================ */
{
  console.log('\n=== APOSENTAR APAGA O SAVE ===');
  const mk = (id, lv, ex) => { const p = S.createInstance(id, lv); p.hp = p.maxHp = S.calcMaxHp(p); return Object.assign(p, ex||{}); };

  /* 1) O RESUMO que vai pro arquivo: o minimo que a tela precisa, e NADA de estado de batalha */
  {
    const r = S.paraOArquivo(mk('venusaur', 62, { shiny:true, ataques:['solarbeam','sludgebomb'] }));
    ok('o arquivo guarda especie, nivel, shiny e golpes',
       r.speciesId === 'venusaur' && r.level === 62 && r.shiny === true && (r.ataques||[]).length === 2,
       JSON.stringify(r));
    ok('e NAO leva estado de batalha', r.hp === undefined && r.maxHp === undefined && r._furia === undefined,
       'levou estado');
    const semNada = S.paraOArquivo(mk('rattata' in S.SPECIES ? 'rattata' : 'ratata', 10));
    ok('quem nao tem shiny nem golpe sai enxuto', semNada.shiny === undefined && semNada.ataques === undefined,
       JSON.stringify(semNada));
  }

  /* 2) PONTA A PONTA: grava o arquivo, garante a Pokedex e SO ENTAO apaga o save */
  {
    const g = S.__getGame();
    const escrito = [], apagado = [], chamadas = [];
    const userAntes = S.userDocRef, saveAntes = S.saveDocRef, fnAntes = S.functionsClient;
    const loadAntes = S.loadSaveSlots, openAntes = S.openSaveSelect;
    S.userDocRef = () => ({ set: async (p) => { escrito.push(p); } });
    S.saveDocRef = () => ({ delete: async () => { apagado.push(1); } });
    S.functionsClient = { httpsCallable: (n) => async () => { chamadas.push(n); return { data:{ defending:false } }; } };
    S.loadSaveSlots = async () => {};
    S.openSaveSelect = () => { g.screen = 'saveSelect'; };

    g.authUser = { uid:'u1' }; g.currentSaveSlot = 3;
    g.team = [mk('venusaur', 62, { ataques:['solarbeam'] }), mk('gyarados', 58, { shiny:true })];
    g.caughtSpecies = ['venusaur','gyarados']; g.permanentPokedex = []; g.aposentados = [];
    g.aposentarPergunta = true;

    await S.aposentarOTime();
      ok('o save e APAGADO', apagado.length === 1, apagado.length + ' deletes');
      ok('e o time vai pro arquivo da CONTA', escrito.length === 1 && !!escrito[0].aposentados,
         'nao gravou o arquivo');
      ok('com a Pokedex garantida junto', !!escrito[0].pokedexCaught, 'sem a Pokedex');
      ok('as duas gravacoes sao arrayUnion (so CRESCEM)',
         escrito[0].aposentados.__op === 'arrayUnion' && escrito[0].pokedexCaught.__op === 'arrayUnion',
         'nao sao arrayUnion -- uma lista pode ENCOLHER');
      ok('o arquivo local recebe os dois', (g.aposentados||[]).length === 2, String((g.aposentados||[]).length));
      ok('com o slot e a data de cada um', g.aposentados[0].slot === '3' && !!g.aposentados[0].em,
         JSON.stringify(g.aposentados[0]));
      /* ⚠️ o ginasio e conferido ANTES: doc de ginasio e escrita exclusiva do servidor, e um save
         apagado nao pode deixar um ginasio com lider fantasma */
      ok('o ginasio e conferido antes de apagar',
         chamadas.indexOf('checkNeighborhoodGymDefenseForSlot') >= 0, chamadas.join(','));
      ok('e o jogador volta pra home', g.screen === 'saveSelect', g.screen);

      /* 3) ⚠️ SE A GRAVACAO FALHAR, O SAVE NAO MORRE. Perder a jornada E nao guardar o time
         seria o pior dos dois mundos -- e o mesmo lado pra que o `usarTM` erra. */
      const apagado2 = [];
      S.userDocRef = () => ({ set: async () => { throw new Error('rede'); } });
      S.saveDocRef = () => ({ delete: async () => { apagado2.push(1); } });
      g.currentSaveSlot = 5; g.aposentarPergunta = true; g.aposentarErro = null;
      g.team = [mk('alakazam', 55)];
      await S.aposentarOTime();
        ok('gravacao que falha NAO apaga o save', apagado2.length === 0, apagado2.length + ' deletes');
        ok('e o jogador e avisado', !!g.aposentarErro, 'sem aviso');
    S.userDocRef = userAntes; S.saveDocRef = saveAntes; S.functionsClient = fnAntes;
    S.loadSaveSlots = loadAntes; S.openSaveSelect = openAntes;
  }
}

/* ============================================================================
   A TELA DO PROF. CARVALHO, A NOTIFICACAO DA LIGA E A FAIXA DE UPDATE (18/09/2026)
   ============================================================================ */
{
  console.log('\n=== A TELA DO PROF. CARVALHO ===');
  const g = S.__getGame();
  g.aposentados = [
    { speciesId:'venusaur', level:62, shiny:true, ataques:['solarbeam','sludgebomb'], slot:'3', em:2000 },
    { speciesId:'gyarados', level:58, ataques:['hydropump'], slot:'3', em:2000 },
    { speciesId:'alakazam', level:55, slot:'1', em:1000 },
  ];
  const h = S.renderAposentados();
  const tem = (t) => h.indexOf(t) >= 0;
  ok('nomeia os tres', tem('Venusaur') && tem('Gyarados') && tem('Alakazam'));
  ok('e mostra o NIVEL de cada um', tem('Lv.62') && tem('Lv.58') && tem('Lv.55'));
  ok('e os TIPOS', tem('>Planta<') && tem('>Veneno<') && tem('>Psíquico<'));
  /* ⚠️ O GOLPE VEM DO `ataques` GRAVADO -- e o argumento importa: o `golpeSeloHtml` e
     (especie, tipo, golpeId), e passar o golpe no PRIMEIRO lugar faz o selo nomear outro golpe
     em silencio. Foi o defeito da primeira versao desta tela (saia "Chicote de Cipo" no lugar
     de "Raio Solar"). */
  ok('e os GOLPES que ele tinha quando se aposentou',
     tem('Raio Solar') && tem('Bomba de Lodo') && tem('Hidro Bomba'),
     'nomeou outro golpe -- confira a ordem dos argumentos do golpeSeloHtml');
  ok('o shiny ganha selo', tem('#s-shiny'));
  ok('quem NAO tem golpe sai sem a linha', h.split('carvalho-golpes').length - 1 === 2,
     String(h.split('carvalho-golpes').length - 1));
  ok('e o mais RECENTE vem primeiro', h.indexOf('Venusaur') < h.indexOf('Alakazam'));

  /* o botao na Pokedex */
  g.screen = 'pokedex'; g.pokedexView = 'normal';
  g.permanentPokedex = ['venusaur']; g.saveSlots = new Array(20).fill(null);
  const dex = S.renderPokedex();
  ok('a Pokedex mostra o botao', dex.indexOf('abrirAposentados') >= 0, 'sem o botao');
  ok('e conta quantos estao la', dex.indexOf('Carvalho (3)') >= 0, 'sem a contagem');
  /* ⚠️ SEM NINGUEM O BOTAO SOME: uma tela que so diz "ninguem ainda" e pior que botao nenhum,
     e a aposentadoria e rara -- a maioria das contas nunca vai ter um. */
  g.aposentados = [];
  ok('e SEM ninguem ele nao aparece', S.renderPokedex().indexOf('abrirAposentados') < 0, 'aparece vazio');

  console.log('\n=== A NOTIFICACAO LEVA AO CHAVEAMENTO ===');
  {
    const comEnd = { meta:{ leagueTypeId:'classic', cycleId:'c123', leagueId:2, cycleTime:1700000 } };
    const semEnd = { meta:{ leagueTypeId:'classic' } };
    const trainers = { meta:{ leagueTypeId:'trainers' } };
    const bCom = S.botaoDaLigaHtml(comEnd), bSem = S.botaoDaLigaHtml(semEnd), bTr = S.botaoDaLigaHtml(trainers);
    ok('com o endereco, leva ao chaveamento', bCom.indexOf('viewLeagueHistory') >= 0, bCom.slice(0, 80));
    ok('e passa os QUATRO na ordem certa',
       /viewLeagueHistory\('classic','c123',2,1700000\)/.test(bCom), bCom.slice(0, 110));
    /* ⚠️ E EM ASPAS SIMPLES dentro das duplas -- a licao de 17/09: um JSON.stringify ali fecharia
       o atributo onclick e o clique nao faria nada, em silencio. */
    ok('com aspas simples dentro do onclick', bCom.indexOf('onclick="viewLeagueHistory(\'') >= 0, bCom.slice(0, 60));
    /* notificacao ANTIGA nao tem o endereco: ela cai na tela da liga, como sempre caiu */
    ok('SEM o endereco, abre a tela da liga',
       bSem.indexOf('irParaALiga') >= 0 && bSem.indexOf('viewLeagueHistory') < 0, bSem.slice(0, 80));
    /* ⚠️ A TRAINERS FICA DE FORA, e nao e esquecimento: ela e um round-robin de um grupo so e nao
       tem leagueId por partida -- o historico dela e outro. */
    ok('e a Trainers League continua abrindo a liga', bTr.indexOf('irParaALiga') >= 0, bTr.slice(0, 80));
  }

  console.log('\n=== A ORDEM DOS SLOTS NA HOME (24/09/2026) ===');
  {
    /* Pedida assim: *"no home, de para ordernar os slots que tem um time, pela média de level do
       time"*. Sao DUAS ordens -- a de sempre (por slot) e a nova.
       ⚠️ O QUE ESTA TRAVA EXISTE PRA PEGAR e a ordem ficar "errada" sem nada estar errado: a media
       do CARD e a da ORDEM tem que sair da MESMA conta, senao o card mostra um numero e a lista
       ordena por outro -- e o jogador nao tem como saber qual dos dois esta certo. */
    const time = (lv) => ({ team: [{ speciesId:'pikachu', level: lv }, { speciesId:'gyarados', level: lv }],
                            badgeCount: 8, gameMode: 'normal' });
    /* a ordem que a home DESENHA: o `openSaveCard(N)`/`startNewSave(N)` de cada card, na ordem do HTML */
    const ordemDesenhada = (h) => (h.match(/(?:openSaveCard|startNewSave)\((\d+)\)/g) || [])
      .map(s => Number(s.replace(/\D/g, '')));

    function home({ ordem = 'slot', slots = {} } = {}){
      conta({ doces: 0 });
      const g = S.__getGame();
      g.saveSlots = [];
      Object.keys(slots).forEach(k => { g.saveSlots[Number(k)] = slots[k]; });
      g.homeOrdem = ordem;
      g.saveSlotsCarregados = true; g.contaCarregada = true;
      S.__setGame(g);
      return S.renderSaveSelect();
    }

    /* ---- a media e a MESMA conta do card ---- */
    ok('a media do time e a media dos niveis', S.mediaDoTime(time(42)) === 42, String(S.mediaDoTime(time(42))));
    ok('e ela arredonda', S.mediaDoTime({ team:[{level:40},{level:41},{level:42},{level:44}] }) === 42,
       String(S.mediaDoTime({ team:[{level:40},{level:41},{level:42},{level:44}] })));
    ok('save sem time da zero', S.mediaDoTime({ team: [] }) === 0 && S.mediaDoTime(null) === 0);
    /* ⚠️ E O CARD LE A FUNCAO, nao refaz a conta -- e isso so se prova LENDO O CODIGO: hoje os dois
       dao o mesmo numero, entao comparar a estrela com a `mediaDoTime` passaria com a conta
       duplicada. E a mesma tecnica que a conta da Pokedex e o asterisco do cartao de golpe precisam. */
    {
      const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
      /* ⚠️ A FATIA VAI ATE O FIM DA FUNCAO, nunca um offset fixo: um `slice(i, i+N)` envelhece
         quando a funcao cresce e passa a medir MENOS do que ela diz medir -- e ai ela da verde
         sobre o defeito que existe pra pegar. */
      const i = cli.indexOf('function renderSaveSelect(');
      const corpo = i < 0 ? '' : cli.slice(i, cli.indexOf('\nfunction ', i + 10));
      ok('a fatia do render tem o que ler', corpo.length > 5000 && corpo.indexOf('save-slot-card') > 0,
         corpo.length + ' chars');
      ok('a estrela do card LE a mediaDoTime', /const avgLevel = mediaDoTime\(s\)/.test(corpo),
         (corpo.match(/const avgLevel = [^;]*/) || ['(sumiu)'])[0].slice(0, 70));
      ok('e ela nao refaz a conta no render', !/avgLevel\s*=\s*team\.length \?/.test(corpo));
    }

    /* ---- POR SLOT: a ordem de sempre, byte a byte ---- */
    const slots = { 0: time(42), 2: time(71), 4: time(58), 9: time(63) };
    const hSlot = home({ ordem: 'slot', slots });
    const oSlot = ordemDesenhada(hSlot);
    ok('POR SLOT desenha os 20 na ordem de sempre',
       oSlot.length === S.MAX_SAVE_SLOTS && oSlot.every((v, i) => v === i), oSlot.slice(0, 12).join(','));
    /* ⚠️ A NAO-REGRESSAO E ESTA: sem a ordem nova ligada, a home sai IDENTICA a de antes. */
    const hSem = home({ ordem: undefined, slots });
    ok('e sem campo nenhum ela e a mesma coisa', hSem.replace(/home-ordem-btn[\s\S]*?<\/button>/, '')
       === hSlot.replace(/home-ordem-btn[\s\S]*?<\/button>/, ''));

    /* ---- POR MEDIA: decrescente, com os vazios no fim ---- */
    const hMedia = home({ ordem: 'media', slots });
    const oMedia = ordemDesenhada(hMedia);
    ok('POR MEDIA poe os times na frente, do maior pro menor',
       oMedia.slice(0, 4).join(',') === '2,9,4,0', oMedia.slice(0, 6).join(','));
    /* ⚠️ QUEM TEM TIME VEM PRIMEIRO: o pedido e sobre "os slots que TEM um time", e deixar os vazios
       no meio faria os cards cheios pularem por cima deles. */
    ok('e os vazios vao pro fim, na ordem de slot',
       oMedia.slice(4).join(',') === [1,3,5,6,7,8,10,11,12,13,14,15,16,17,18,19].join(','),
       oMedia.slice(4).join(','));
    ok('ninguem some nem repete', oMedia.length === S.MAX_SAVE_SLOTS &&
       new Set(oMedia).size === S.MAX_SAVE_SLOTS, oMedia.length + ' cards');
    /* ⚠️ O DESEMPATE E EXPLICITO: dois times de mesma media trocariam de lugar entre um render e
       outro, e a lista piscaria debaixo do dedo de quem vai clicar. */
    const hEmp = home({ ordem: 'media', slots: { 5: time(50), 1: time(50), 8: time(50) } });
    ok('empate desempata pelo SLOT, sempre igual',
       ordemDesenhada(hEmp).slice(0, 3).join(',') === '1,5,8', ordemDesenhada(hEmp).slice(0, 3).join(','));
    /* save com o campo `team` vazio conta como vazio, e nao como media zero no meio da lista */
    const hVaz = home({ ordem: 'media', slots: { 3: { team: [], badgeCount: 0 }, 7: time(20) } });
    ok('save sem time fica atras de quem tem', ordemDesenhada(hVaz)[0] === 7, ordemDesenhada(hVaz).slice(0,3).join(','));
    /* ⚠️ E ESTA E A TRAVA QUE SEPARA "a ordem esta certa" de "a ordem esta certa POR ACASO": o
       comparador tem que ser ANTISSIMETRICO -- `cmp(a,b)` e `cmp(b,a)` com sinais opostos, pra
       TODO par.
       O comparador nasceu com uma guarda de "quem tem time primeiro" em cima da media, e ela era
       letra morta (os 20 slots saem na mesma ordem sem ela). O PERIGO e tira-la PELA METADE:
       deixar o `if(!ca) return a - b` sem o `if(ca !== cb)` faz 30 dos 190 pares dizerem a MESMA
       coisa nos dois sentidos -- e o resultado continua saindo certo, porque o TimSort do V8
       compara numa ordem que mascara isso. Comparador contraditorio nao da erro: ele da uma ordem
       que depende do motor. */
    {
      home({ ordem: 'media', slots: { 1: time(60), 6: time(45), 12: time(70), 17: time(30) } });
      const N = S.MAX_SAVE_SLOTS; let contra = 0, ex = '';
      for(let i = 0; i < N; i++) for(let j = i + 1; j < N; j++){
        const x = S.ordemPorMedia(i, j), y = S.ordemPorMedia(j, i);
        if(x !== 0 && Math.sign(x) === Math.sign(y)){ contra++; if(!ex) ex = i + 'x' + j + ' -> ' + x + ' e ' + y; }
      }
      ok('e o comparador NUNCA se contradiz', contra === 0, contra + ' pares  ' + ex);
      /* e ele e TOTAL: so empata consigo mesmo -- sem isso dois slots trocariam de lugar entre um
         render e outro, e a lista piscaria debaixo do dedo de quem vai clicar */
      let empates = 0;
      for(let i = 0; i < N; i++) for(let j = i + 1; j < N; j++) if(S.ordemPorMedia(i, j) === 0) empates++;
      ok('  e so empata consigo mesmo', empates === 0, empates + ' empates entre slots diferentes');
    }

    /* ---- o botao ---- */
    const bt = (h) => (h.match(/home-ordem-btn[^>]*>[\s\S]*?<\/button>/) || [''])[0];
    ok('o botao existe e diz em que ordem esta', /Por slot/.test(bt(hSlot)) && /Por média/.test(bt(hMedia)),
       bt(hSlot).replace(/<[^>]*>/g, '').trim() + ' | ' + bt(hMedia).replace(/<[^>]*>/g, '').trim());
    /* ligado ele ACENDE: sem isso as duas ordens se leem iguais e o jogador nao sabe em qual esta */
    ok('e ele acende quando a ordem e a media',
       !/home-ordem-btn ativo/.test(hSlot) && /home-ordem-btn ativo/.test(hMedia));
    ok('com a estrela da media, que e o que ele ordena', bt(hMedia).indexOf('<svg') >= 0);
    /* ⚠️ COM UM TIME SO ORDENAR NAO ORDENA NADA -- a mesma regra que esconde a paginacao do montador
       quando ha uma pagina so. */
    ok('com UM time o botao nem aparece', bt(home({ ordem: 'slot', slots: { 3: time(30) } })) === '');
    ok('com nenhum time idem', bt(home({ ordem: 'slot', slots: {} })) === '');
    ok('com DOIS ele aparece', bt(home({ ordem: 'slot', slots: { 3: time(30), 8: time(40) } })) !== '');
    /* e alternar troca de verdade, nos dois sentidos */
    {
      const g = S.__getGame(); g.homeOrdem = 'slot'; S.__setGame(g);
      S.alternarOrdemDaHome(); ok('alternar liga a media', S.__getGame().homeOrdem === 'media');
      S.alternarOrdemDaHome(); ok('e alternar de novo volta', S.__getGame().homeOrdem === 'slot');
    }

    /* ---- o campo atravessa a abertura de um save, e NAO vai pro banco ---- */
    {
      const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
      const i = cli.indexOf('const CAMPOS_DA_CONTA');
      const lista = i < 0 ? '' : cli.slice(i, cli.indexOf('];', i));
      ok('a lista do CAMPOS_DA_CONTA tem o que ler', lista.length > 100, lista.length + ' chars');
      /* ⚠️ SEM ELE AQUI, abrir um time e voltar pra home desfaria a ordenacao -- e ir e voltar de um
         save e justamente o que mais se faz nessa tela. */
      ok('homeOrdem atravessa o resetGame', lista.indexOf("'homeOrdem'") >= 0, lista.slice(-160));
      const j = cli.indexOf('function serializeGame(');
      const ser = j < 0 ? '' : cli.slice(j, cli.indexOf('\n}', j));
      ok('e ele NAO vai pro banco', ser.length > 500 && ser.indexOf('homeOrdem') < 0, ser.length + ' chars');
    }
  }

  console.log('\n=== A FAIXA DE UPDATE ===');
  {
    /* ⚠️ A FAIXA VIVE NO `<body>` ESTATICO, fora de qualquer template literal -- um ${selo(...)}
       ali NAO interpola, e o jogador ve o codigo escrito na tela. Foi o que aconteceu quando os
       emojis viraram selo (18/09/2026).
       ⚠️ E A TRAVA DO ${selo( NAO PEGA ISSO porque ela varre o SCRIPT e nao o body. */
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const iBody = cli.indexOf('<body');
    const iScript = cli.indexOf('<script', iBody);
    const body = cli.slice(iBody, iScript);
    const sobrou = body.match(/\$\{[^}]*\}/g) || [];
    ok('nenhum ${...} sobra no body estatico', sobrou.length === 0, sobrou.join(' | '));
    /* e o selo entra pelo JS, na hora de acender */
    const i = cli.indexOf('function mostrarAvisoDeVersao(');
    const corpo = i < 0 ? '' : cli.slice(i, cli.indexOf('\n}', i));
    ok('e o selo da faixa e posto pelo JS', corpo.indexOf("selo('recarregar')") >= 0, 'sem o selo');
  }
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
})();
