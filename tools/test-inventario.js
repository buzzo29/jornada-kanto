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
  ok('mesma grade de quadradinhos da mochila', t.includes('class="item-grade"') && slots(t) >= S.INVENTARIO_SLOTS_MINIMOS,
     slots(t) + ' slots');
  /* A LOJA VENDE OS CINCO. O Doce Raro e o Bonus Shiny voltaram a ser vendidos em 03/09/2026 --
     eles continuam vindo de jogar tambem, e e por isso que a mochila le cada um de uma fonte
     propria (contador / cupom+estoque) em vez de derivar tudo do inventario. */
  ok('a grade mostra os cinco a venda', (t.match(/item-slot-icone/g)||[]).length === 5,
     (t.match(/item-slot-icone/g)||[]).length + ' itens');
  ok('e todo item do catalogo esta a venda',
     Object.keys(S.ITENS).every(id => S.ITENS[id].comprável),
     Object.keys(S.ITENS).filter(id => !S.ITENS[id].comprável).join(', ') || 'todos');
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
  ok('os precos sao os pedidos', S.ITENS.awakening.preco === 50 && S.ITENS.hyperpotion.preco === 30 && S.ITENS.potion.preco === 15,
     [S.ITENS.awakening.preco, S.ITENS.hyperpotion.preco, S.ITENS.potion.preco].join('/'));
  ok('e os dois de jogar tambem tem preco', S.ITENS.doce_raro.preco === 300 && S.ITENS.bonus_shiny.preco === 800,
     S.ITENS.doce_raro.preco + '/' + S.ITENS.bonus_shiny.preco);
}

console.log('\n=== O POPUP DE QUANTIDADE ===');
{
  /* O TETO E O QUE O DINHEIRO COMPRA. Ele e so conveniencia da tela: quem manda e o servidor, que
     refaz a conta contra o saldo lido na transacao -- o saldo pode ter mudado em outra aba entre
     abrir o popup e confirmar. */
  conta({ doces: 0 });
  const g = S.__getGame(); g.moedas = 100; S.__setGame(g);
  ok('o maximo sai do saldo', S.maximoQueCabe('potion') === 6, String(S.maximoQueCabe('potion')));   // 100/15
  ok('e arredonda pra baixo', S.maximoQueCabe('awakening') === 2, String(S.maximoQueCabe('awakening'))); // 100/50
  ok('sem dinheiro pra um, o maximo e zero', S.maximoQueCabe('doce_raro') === 0, String(S.maximoQueCabe('doce_raro')));

  /* Abrir com saldo insuficiente nao pode montar um popup de "compre 0". */
  S.abrirCompra('doce_raro');
  ok('e nem abre o popup', !S.__getGame().compraItem, String(S.__getGame().compraItem));

  S.abrirCompra('potion');
  ok('o popup abre em 1', S.__getGame().compraQtd === 1, String(S.__getGame().compraQtd));
  const m = S.renderCompraModal();
  ok('e diz o teto', /até <strong>6<\/strong>/.test(m), (m.match(/até[^<]*<strong>[^<]*/g)||[]).join(' | '));
  ok('e o total de 1', /Total: <strong>🪙 15<\/strong>/.test(m), (m.match(/Total:[^<]*<strong>[^<]*/g)||[]).join(' | '));
  ok('o menos nasce travado em 1', /disabled[^>]*onclick="mudarQtdCompra\(-1\)"/.test(m),
     (m.match(/<button[^>]*mudarQtdCompra\(-1\)[^>]*/g)||[]).join(' | '));

  S.mudarQtdCompra(1); S.mudarQtdCompra(1);
  ok('o + sobe', S.__getGame().compraQtd === 3, String(S.__getGame().compraQtd));
  ok('e o total acompanha', /Total: <strong>🪙 45<\/strong>/.test(S.renderCompraModal()));
  /* NAO PASSA DO TETO, nem apertando muito: o + para no maximo. */
  for(let i = 0; i < 20; i++) S.mudarQtdCompra(1);
  ok('o + nunca passa do que o dinheiro compra', S.__getGame().compraQtd === 6, String(S.__getGame().compraQtd));
  ok('e ai ele trava', /disabled[^>]*onclick="mudarQtdCompra\(1\)"/.test(S.renderCompraModal()));
  /* E nao desce abaixo de 1: comprar zero nao e uma compra. */
  for(let i = 0; i < 20; i++) S.mudarQtdCompra(-1);
  ok('e o - nunca desce abaixo de 1', S.__getGame().compraQtd === 1, String(S.__getGame().compraQtd));

  /* O MAX e o caminho de verdade num toque -- ninguem aperta o + vinte vezes. */
  S.qtdCompraMax();
  ok('o Max vai direto ao teto', S.__getGame().compraQtd === 6, String(S.__getGame().compraQtd));
  ok('e o botao de comprar diz quantos', /Comprar 6 unidades/.test(S.renderCompraModal()),
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
  conta({ doces: 0 });
  const g = S.__getGame();
  g.inventario = { awakening: 1, potion: 2 };
  g.equipados = { blastoise: 'awakening' };
  S.__setGame(g);
  const semItem = S.botaoDeItemHtml('charizard');
  ok('quem nao carrega nada mostra o +', />\+<\/button>/.test(semItem), semItem);
  ok('e abre a escolha pra AQUELE pokemon', /abrirEscolhaDeItem\('charizard'\)/.test(semItem), semItem);
  const comItem = S.botaoDeItemHtml('blastoise');
  ok('quem carrega mostra o icone do item', comItem.includes('⏰') && !/>\+<\/button>/.test(comItem), comItem);
  ok('e fica destacado', /com-item/.test(comItem), comItem);

  /* A CAIXA lista so o que a mochila TEM: oferecer o que a pessoa nao tem seria uma fileira de
     botoes que nao clicam. */
  S.abrirEscolhaDeItem('blastoise');
  const modal = S.renderEscolhaDeItemModal();
  ok('a caixa nomeia o pokemon', /Blastoise/.test(modal));
  ok('e lista os itens da mochila com a quantidade', /Despertar/.test(modal) && /Poção/.test(modal) && /2x/.test(modal), modal.slice(0,400));
  ok('mas nao o que nao esta na mochila', !/Super Poção/.test(modal));
  ok('nem o que nao e de batalha', !/Doce Raro/.test(modal));
  ok('marca o que ele ja carrega', /btn selected[\s\S]{0,120}awakening/.test(modal), (modal.match(/btn selected[^"]*/g)||[]).join(' | '));
  ok('e oferece tirar', /desequiparItem\('blastoise'\)/.test(modal));

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
  ok('e a mochila conta os doces', /3 Doces Raros/.test(home), (home.match(/home-menu-stat">[^<]*/g)||[]).join(' | '));
  conta({ doces: 0 });
  ok('sem doce ela nao inventa numero', /home-menu-stat">Seus itens/.test(S.renderSaveSelect()));
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
console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
