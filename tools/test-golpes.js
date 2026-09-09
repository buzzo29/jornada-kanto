#!/usr/bin/env node
/**
 * A BASE DE GOLPES POR NÍVEL (data/golpes.json)
 *
 * Ela ainda NÃO é usada pelo motor -- foi cadastrada pra uma feature futura, em que o treinador
 * escolhe quais golpes o pokémon leva. O que este teste tranca é o DADO, que é de terceiro (o
 * Pokémon Showdown) e passou por uma cadeia de mods gen8→gen2: se a fonte mudar de formato ou o
 * gerador quebrar, o arquivo pode sair pela metade sem ninguém notar.
 *
 * O mais valioso aqui é o CRUZAMENTO com as listas que o jogo já tinha à mão (autodestruição,
 * sono, Disable, Recuperar, drenagem, metrônomo): elas foram conferidas move a move no Bulbapedia
 * numa auditoria de 04/09/2026, e agora existe uma segunda fonte pra confrontar. Onde as duas
 * concordam, as duas estão certas. Onde discordam, a divergência fica NOMEADA aqui -- e o teste
 * falha se a lista de divergências mudar, pra ninguém consertar um lado e esquecer o outro.
 *
 *   node tools/test-golpes.js
 */
const path = require('path');
const S = require('./game-sandbox').createSandbox();
const D = require(path.join(__dirname, '..', 'data', 'golpes.json'));

let falhas = 0;
function ok(titulo, cond, extra){
  if(cond){ console.log('  OK     ' + titulo + (extra ? '   ' + extra : '')); }
  else { falhas++; console.log('  FALHOU ' + titulo + (extra ? '   ' + extra : '')); }
}
const tem = (esp, golpe) => (D.porEspecie[esp] || []).some(x => x.g === golpe);
const seq = (esp) => (D.porEspecie[esp] || []).map(x => x.n + ':' + D.golpes[x.g].nome).join(' ');

console.log('\n=== A BASE ESTÁ INTEIRA ===');
{
  const especies = Object.keys(S.SPECIES);
  const semNada = especies.filter(id => !(D.porEspecie[id] || []).length);
  ok('as 250 espécies têm aprendizado por nível', semNada.length === 0,
     semNada.length ? semNada.join(', ') : especies.length + ' espécies');
  /* Espécie a mais no arquivo é tão ruim quanto a menos: seria uma chave que o jogo não conhece. */
  const sobrando = Object.keys(D.porEspecie).filter(id => !S.SPECIES[id]);
  ok('e não sobra nenhuma que o jogo não conhece', sobrando.length === 0, sobrando.join(', '));

  let semFicha = 0, nivelRuim = 0, tipoRuim = 0;
  const tiposValidos = new Set(Object.keys(S.TYPE_CHART));
  Object.values(D.porEspecie).forEach(l => l.forEach(x => {
    if(!D.golpes[x.g]) semFicha++;
    if(!(x.n >= 1 && x.n <= 100)) nivelRuim++;
  }));
  const foraDaTabela = [];
  Object.entries(D.golpes).forEach(([id, g]) => { if(!tiposValidos.has(g.tipo)){ tipoRuim++; foraDaTabela.push(id); } });
  ok('todo golpe citado tem ficha', semFicha === 0, semFicha + ' sem ficha');
  ok('todo nível está entre 1 e 100', nivelRuim === 0, nivelRuim + ' fora da faixa');
  /* O TIPO tem que ser um dos 17 do jogo: é dele que o motor tira físico/especial e o
     multiplicador. A ÚNICA exceção legítima é o Curse, que na Gen 2 era mesmo SEM TIPO ("???") --
     ele só virou Fantasma na Gen 5. Seis espécies o aprendem (Slowpoke, Slowbro, Slowking e a
     linha do Gastly). Quem for usar esta base pra montar golpe precisa decidir o que fazer com
     ele; o que não pode é aparecer um SEGUNDO tipo estranho sem ninguém ver. */
  ok('só o Curse fica fora do TYPE_CHART, e é assim na Gen 2 mesmo',
     foraDaTabela.length === 1 && foraDaTabela[0] === 'curse' && D.golpes.curse.tipo === '???',
     foraDaTabela.join(', '));

  const entradas = Object.values(D.porEspecie).reduce((s, l) => s + l.length, 0);
  ok('o volume é o esperado', entradas > 1900 && Object.keys(D.golpes).length > 200,
     entradas + ' entradas, ' + Object.keys(D.golpes).length + ' golpes distintos');
  /* Ninguém pode ter o mesmo golpe duas vezes: o gerador fica com o menor nível. */
  const dup = Object.entries(D.porEspecie).filter(([, l]) => new Set(l.map(x => x.g)).size !== l.length);
  ok('e ninguém repete o mesmo golpe em dois níveis', dup.length === 0, dup.map(x => x[0]).join(', '));
}

console.log('\n=== É MESMO A GEN 2, NÃO A GERAÇÃO DE HOJE ===');
{
  /* Estes quatro provam que a cadeia de mods gen8→gen2 rodou. Sem ela o arquivo sairia com os
     valores da Gen 9, e o jogo passaria a ter um Bite NORMAL e um Tackle de 40. */
  const g = id => D.golpes[id] || {};
  ok('o Bite é SOMBRIO (era Normal na Gen 1)', g('bite').tipo === 'Dark', g('bite').tipo);
  ok('o Karate Chop é LUTADOR (era Normal na Gen 1)', g('karatechop').tipo === 'Fighting', g('karatechop').tipo);
  ok('o Gust é VOADOR (era Normal na Gen 1)', g('gust').tipo === 'Flying', g('gust').tipo);
  ok('o Tackle tem 35 de poder e 95 de precisão (hoje é 40/100)',
     g('tackle').poder === 35 && g('tackle').precisao === 95, g('tackle').poder + '/' + g('tackle').precisao);
  ok('o Crabhammer tem 90 (hoje é 100)', g('crabhammer').poder === 90, String(g('crabhammer').poder));
  ok('a Autodestruição tem 200 (era 130 na Gen 1)', g('selfdestruct').poder === 200, String(g('selfdestruct').poder));
  ok('e a Hipnose acerta 60% (hoje é 60 tambem, mas o campo existe)', g('hypnosis').precisao === 60, String(g('hypnosis').precisao));
  /* Golpe de status é `poder: 0` -- a categoria física/especial NÃO está no arquivo de propósito:
     neste motor quem decide é o TIPO (isSpecialType), e uma segunda fonte discordaria dele. */
  ok('golpe de status vem com poder 0', g('recover').poder === 0 && g('growl').poder === 0);
  ok('e a categoria NÃO está no arquivo', D.golpes.tackle.categoria === undefined &&
     D.golpes.tackle.category === undefined);
}

console.log('\n=== OS APRENDIZADOS FAMOSOS, CONFERIDOS UM A UM ===');
{
  /* O BULBASAUR carrega DUAS coisas de uma vez, e é por isso que ele é a primeira linha aqui:
     o aprendizado da Gen 3 (Pó Venenoso e Sonífero no 15, Sweet Scent no 25) e a Bomba de Lodo no
     46, que NÃO vem do aprendizado por nível -- ela foi acrescentada pela regra de cobertura de
     tipo (ver o passo 3 do gerador). Ele é Grama/Veneno e não aprendia um só golpe de dano de
     Veneno por nível em geração nenhuma; no FireRed isso se resolve pela TM36, e é dela que a
     Bomba de Lodo saiu. Se esta linha cair, ou a fonte mudou ou a regra de cobertura parou. */
  ok('Bulbasaur', seq('bulbasaur') === '1:Tackle 4:Growl 7:Leech Seed 10:Vine Whip 15:Poison Powder 15:Sleep Powder 20:Razor Leaf 25:Sweet Scent 32:Growth 39:Synthesis 46:Sludge Bomb 46:Solar Beam', seq('bulbasaur'));
  /* O CHARMANDER é a prova de que a fonte é a GEN 3 e não a Gen 2: Garra de Metal no 13 não existe
     antes da Gen 3 (o golpe é da Gen 2, mas o Charmander só passa a aprendê-lo no FireRed). */
  ok('Charmander', seq('charmander') === '1:Growl 1:Scratch 7:Ember 13:Metal Claw 13:Smokescreen 19:Rage 25:Scary Face 31:Flamethrower 37:Slash 43:Dragon Rage 49:Fire Spin', seq('charmander'));
  ok('Squirtle', seq('squirtle') === '1:Tackle 4:Tail Whip 7:Bubble 10:Withdraw 13:Water Gun 18:Bite 23:Rapid Spin 28:Protect 33:Rain Dance 40:Skull Bash 47:Hydro Pump', seq('squirtle'));
  ok('Pikachu', seq('pikachu') === '1:Growl 1:Thunder Shock 6:Tail Whip 8:Thunder Wave 11:Quick Attack 15:Double Team 20:Slam 26:Thunderbolt 33:Agility 41:Thunder 50:Light Screen', seq('pikachu'));
  /* O RATATA é o único id que não bate com o do Showdown (o jogo escreve com um T só). Se o mapa
     do gerador se perder, ele é o primeiro a sair vazio. */
  ok('e o Ratata veio (o id diverge da fonte)', (D.porEspecie.ratata || []).length > 0, seq('ratata'));
}

console.log('\n=== CRUZAMENTO COM AS LISTAS QUE O JOGO JÁ TINHA ===');
{
  const confere = (nome, especies, aceitos) => {
    const faltam = especies.filter(id => !aceitos.some(g => tem(id, g)));
    return { nome, total: especies.length, faltam };
  };
  const r = [
    confere('autodestruição', S.AUTODESTRUICAO, ['selfdestruct', 'explosion']),
    confere('recuperar', S.RECUPERACAO, ['recover']),
    confere('disable', S.DISABLE, ['disable']),
    confere('drenagem', Object.keys(S.ABSORCAO), ['absorb', 'megadrain', 'leechlife', 'gigadrain']),
    confere('metrônomo', S.METRONOMO, ['metronome'])
  ];
  r.forEach(x => {
    if(!x.faltam.length) ok('a lista de ' + x.nome + ' bate 100%', true, x.total + '/' + x.total);
  });
  /* O SONO guarda QUAL golpe cada espécie usa -- então dá pra conferir o par, não só a presença. */
  const doSono = { 'Hipnose':'hypnosis', 'Pó do Sono':'sleeppowder', 'Esporo':'spore',
                   'Canto':'sing', 'Beijo Adorável':'lovelykiss' };
  const sonoRuim = Object.entries(S.SONIFEROS).filter(([esp, nome]) => !tem(esp, doSono[nome]));
  ok('o sono bate em ' + (Object.keys(S.SONIFEROS).length - sonoRuim.length) + '/' + Object.keys(S.SONIFEROS).length +
     ' -- e o par espécie→golpe também', sonoRuim.length <= 4, sonoRuim.map(x => x[0]).join(', '));

  /* AS DIVERGÊNCIAS CONHECIDAS, FIXADAS. Elas não são "erro do teste": são pontos em que a lista
     à mão do jogo e o aprendizado por nível da Gen 2 discordam, e cada uma tem um motivo diferente.
     Ficam aqui pra que MUDAR qualquer um dos dois lados seja barulhento. */
  /* ERAM NOVE NA GEN 2 E VIRARAM SETE. As duas que sumiram valem por motivos DIFERENTES, e a
     diferença importa:
       - sono:yanma  -- resolvida pela FONTE. O comentário antigo aqui dizia "Hipnose só a partir
         da Gen 3", e agora a base É a Gen 3: o Yanma aprende Hipnose no nível 23. A lista à mão
         estava certa o tempo todo; quem estava atrás era o dado.
       - drenagem:exeggutor -- resolvida por ACRÉSCIMO NOSSO, não pela Gen 3. O Exeggutor é
         Grama/Psíquico e não tinha golpe de dano de Grama; a regra de cobertura de tipo lhe deu
         Giga Dreno no 30, que por acaso é um golpe de drenagem. O Exeggcute continua divergindo,
         porque ele é Grama/Psíquico também mas já tinha Grama coberto. */
  const divergencias = [
    'disable:igglybuff',        // o Jigglypuff aprende Disable no 14; o bebê não aprende nenhum
    'drenagem:exeggcute',       // o que ele tem é Leech Seed -- a mesma razão que já tirou o Bulbasaur
    'metronomo:cleffa',         // os 4 do metrônomo foram PEDIDOS, não tirados do aprendizado
    'metronomo:snubbull',
    'sono:misdreavus',
    'sono:vileplume',           // herdam o Pó do Sono do Gloom; como Vileplume não aprendem nada
    'sono:bellossom'
  ].sort();
  const achadas = []
    .concat(r.flatMap(x => x.faltam.map(id => x.nome.replace('ô','o').replace('ç','c').replace('ã','a') + ':' + id)))
    .concat(sonoRuim.map(x => 'sono:' + x[0]))
    .sort();
  ok('as divergências são EXATAMENTE as sete conhecidas', achadas.join(' ') === divergencias.join(' '),
     achadas.length === divergencias.length ? achadas.length + ' divergências' : ('achei: ' + achadas.join(' ')));
}

console.log('');
console.log(falhas ? falhas + ' FALHA(S).' : 'Tudo certo.');
process.exit(falhas ? 1 : 0);
