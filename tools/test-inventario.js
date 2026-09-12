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
/* Os slots de verdade -- `class="item-slot` também casa com item-slot-icone e item-slot-qtd. */
const slots = (t) => contaEm(t, /class="item-slot[ "]/g);

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
  ok('e a grade mostra o 5x', /item-slot-qtd">5x/.test(t), (t.match(/item-slot-qtd">\d+x/g)||[]).join(' '));
  ok('num slot so', contaEm(t, /item-slot-icone/g) === 1, contaEm(t, /item-slot-icone/g) + ' icones');

  conta();
  ok('conta sem nada nao tem pilha nenhuma', S.pilhasDoInventario().length === 0);
  const vazio = S.renderInventario();
  ok('e a tela explica de onde vem cada coisa', /Torre dos Treinadores/.test(vazio) && /Elite dos 4/.test(vazio));
  /* A grade continua desenhada mesmo vazia: uma mochila que encolhe ate caber no que voce tem nao
     parece uma mochila, parece uma lista. */
  ok('a grade continua la, com os slots vazios', slots(vazio) === S.INVENTARIO_SLOTS_MINIMOS,
     slots(vazio) + ' slots');
  /* Slot vazio e <div>, nao <button> desabilitado: nao ha nada pra fazer nele, e um botao vazio
     ainda recebe foco pelo teclado. */
  ok('e slot vazio nao e botao', !/<button class="item-slot vazio"/.test(vazio));
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
  ok('o quadro descreve o item escolhido', t.includes('Doce Raro') && t.includes('2 no inventário'),
     (t.match(/\d+ no inventário/g)||[]).join(' '));
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
     S.LOJA_PRATELEIRAS.map(p => p.nome).join(' | ') === 'Para as batalhas | Especiais | TMs',
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
    /* UM RECADO SO. O quadro de cima e o DETALHE do item selecionado, e ali nao ha item -- com ele
       a tela dizia a mesma coisa duas vezes (em cima e na lista). */
    ok('e o quadro de detalhe SOME', t.indexOf('loja-fixa') < 0);
    ok('deixando um recado so, que nomeia a prateleira', /Ainda não há TMs à venda/.test(t),
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

  /* A TELA DE TMs E HMs. Dois estados, e nenhum deles pode ser uma tela muda. */
  g.currentSaveSlot = 0; g.hms = ['hm01'];
  ok('a tela lista o HM da conta', /HM01/.test(S.renderTmHm()), limpo(S.renderTmHm()).slice(0, 60));
  /* SO O NOME E UMA LINHA CURTA (11/09/2026, a pedido): o paragrafo azul que dizia "ainda nao da
     pra usar em nada" saiu, e o resumo virou uma legenda pequena. Com um item so na lista, a
     explicacao ocupava mais espaco que a coisa explicada. */
  ok('e nao traz mais o paragrafo azul por baixo', !/tmhm-obs/.test(S.renderTmHm()));
  ok('o resumo fica na classe pequena', /tmhm-resumo/.test(S.renderTmHm()));
  ok('e a tabela nao tem mais descricao', S.HMS.hm01.descricao === undefined);
  g.hms = [];
  ok('sem nenhum, ela diz ONDE achar', /S\.S\. Anne/.test(S.renderTmHm()) && /Surge/.test(S.renderTmHm()),
     limpo(S.renderTmHm()).slice(0, 90));
  /* A mochila e aberta da HOME tambem, sem save nenhum -- e agora ali TEM o que mostrar, porque os
     HMs sao da CONTA e nao daquela jornada. */
  g.currentSaveSlot = null; g.hms = ['hm01'];
  ok('e sem save aberto ela mostra os mesmos, porque sao da conta',
     /HM01/.test(S.renderTmHm()) && !/Abra um save/.test(S.renderTmHm()), limpo(S.renderTmHm()));
  g.currentSaveSlot = 0;

  /* ⚠️ O BOTAO DA MOCHILA ESTA ESCONDIDO PRA TODO MUNDO (12/09/2026, a pedido). O que se cobra
     agora e o par: ele nao aparece pra NINGUEM -- nem pra quem ja tem o HM01, que era justamente
     quem via a contagem --, e o RESTO da feature continua de pe.
     A trava le a constante em vez de so procurar o botao: assim o dia em que ela voltar a ser true
     o teste acompanha sozinho, e ninguem precisa lembrar de mexer aqui. */
  {
    g.inventario = {}; g.rareCandies = 0; g.hms = [];
    ok('a porta da tela de TMs e HMs esta fechada', S.MOSTRAR_TM_HM === false, String(S.MOSTRAR_TM_HM));
    const semHm = S.renderInventario();
    g.hms = ['hm01'];
    const comHm = S.renderInventario();
    ok('a mochila NAO mostra o botao de TMs e HMs',
       (/abrirTmHm\(\)/.test(semHm) === S.MOSTRAR_TM_HM) && (/abrirTmHm\(\)/.test(comHm) === S.MOSTRAR_TM_HM),
       'sem HM: ' + /abrirTmHm\(\)/.test(semHm) + '   com HM01: ' + /abrirTmHm\(\)/.test(comHm));
    ok('nem pra quem ja tem o HM01 (a contagem some junto)',
       /TMs e HMs/.test(comHm) === S.MOSTRAR_TM_HM, /TMs e HMs \(1\)/.test(comHm) ? 'mostra (1)' : 'nao mostra');
    ok('e o Voltar continua la', /sairDaMochila\(\)/.test(comHm));
    /* O RESTO DA FEATURE CONTINUA DE PE -- o que sumiu e so a porta. */
    ok('a tela continua desenhavel', /HM01/.test(S.renderTmHm()), '(desenha)');
    ok('e o HM01 continua na conta', S.temHM('hm01') === true);
    ok('e o render ainda sabe desenhar a tela tmhm',
       require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8').indexOf("case 'tmhm':") >= 0);
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

  /* ⚠️ O GOLPE `cut` NAO EXISTE NA TABELA, e nao e esquecimento: a base e aprendizado por NIVEL da
     Gen 3, e HM ninguem aprende por nivel -- o gerador nunca o viu (mesmo caso do `surf`). E por
     isso que o HM aqui e ITEM e nao golpe.
     E ATENCAO AO NOME: o jogo JA tem um golpe chamado "Corte", o `slash`. Por isso o item se chama
     "HM01 — Corte" e nao so "Corte". */
  ok('o golpe cut NAO esta na tabela de golpes (a base e por nivel)', !S.GOLPES['cut']);
  ok('e o "Corte" que o jogo ja tem e o slash', S.nomeDoAtaque('slash') === 'Corte');
  ok('por isso o item carrega o prefixo HM01', /^HM01/.test(S.HMS.hm01.nome), S.HMS.hm01.nome);
}
console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
