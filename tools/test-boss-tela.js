/**
 * A TELA do Boss de Domingo, fora do navegador.
 *
 * Ela nao consulta o servidor de tempos em tempos: ESCUTA dois documentos do Firestore e reage.
 * Isso e barato e instantaneo, mas e invisivel num teste de servidor -- e foi justamente onde os
 * dois bugs desta feature apareceram (um botao chamando funcao inexistente, e a tela congelada
 * porque nada a atualizava). Aqui os callbacks do onSnapshot sao disparados na mao.
 *
 *   node tools/test-boss-tela.js
 */
const path = require('path');
const { createSandbox } = require('./game-sandbox');
const S = createSandbox(path.join(__dirname, '..', 'index.html'));

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const TIME = [{speciesId:'venusaur',level:70},{speciesId:'gengar',level:70,shiny:true}];
function telaAberta(){
  const g = S.freshGameDefaults();
  g.authUser = {uid:'eu'}; g.userTest = true; g.trainerName = 'Buzzo';
  g.bossState = { boss:{hp:5125,maxHp:5125,level:999,batalhas:0}, meu:{dano:0,batalhas:0},
                  ranking:[], times:[{slot:'0',nome:'Time 1',team:TIME}] };
  g.screen = 'sundayBoss'; g.bossEscolhendoTime = false;
  S.__setGame(g);
  return g;
}
const mew = () => S.__escutas['mew'];
const rank = () => S.__escutas['mewRank'];
const snap = (dados) => ({ exists: dados !== null, data(){ return dados; } });

console.log('\nA TELA ESCUTA OS DOIS DOCUMENTOS');
let g = telaAberta();
S.ligarEscutaDoBoss();
ok('assina o documento do Mew', !!mew() && mew().ativo);
ok('assina o documento do ranking', !!rank() && rank().ativo);

console.log('\nOUTRO TREINADOR BATE -- A TELA ANDA SOZINHA');
mew().ok(snap({ hp:4900, maxHp:5125, level:999, batalhas:1 }));
ok('a vida do Mew acompanha', S.__getGame().bossState.boss.hp === 4900,
   String(S.__getGame().bossState.boss.hp));
rank().ok(snap({ lista:[{uid:'outro',name:'Fausto',dano:225,batalhas:1}] }));
ok('o ranking acompanha', S.__getGame().bossState.ranking.length === 1);
const html = S.renderSundayBoss();
ok('a tela desenha a vida nova', html.includes('4900/5125'));
ok('a tela desenha o ranking novo', html.includes('Fausto') && html.includes('225 HP'));

console.log('\nA MINHA CONTRIBUICAO SAI DE GRACA DO RANKING');
rank().ok(snap({ lista:[{uid:'outro',name:'Fausto',dano:225,batalhas:1},
                        {uid:'eu',name:'Buzzo',dano:140,batalhas:1}] }));
ok('sem leitura extra, o meu dano se atualiza', S.__getGame().bossState.meu.dano === 140,
   String(S.__getGame().bossState.meu.dano));

console.log('\nSAIR DA TELA CANCELA TUDO');
S.sairDoBoss();
ok('a assinatura do Mew e cancelada', !mew().ativo);
ok('a assinatura do ranking e cancelada', !rank().ativo);
ok('o Voltar leva pra home', S.__getGame().screen === 'saveSelect', S.__getGame().screen);
const hpAntes = S.__getGame().bossState ? null : null;
mew().ok(snap({ hp:1, maxHp:5125, level:999, batalhas:99 }));   // aviso atrasado, fora da tela
ok('aviso que chega depois de sair nao mexe em nada', S.__getGame().screen === 'saveSelect');

console.log('\nSE A ESCUTA NAO SUBIR, CAI PRO POLLING');
g = telaAberta();
S.ligarEscutaDoBoss();
rank().err(new Error('permission-denied'));
ok('as assinaturas sao desfeitas', !mew().ativo && !rank().ativo);
ok('o laco de 5s assume', S.BOSS_POLL_MS === 5000);
S.pararAcompanhamentoDoBoss();

console.log('\nSEM LOGIN NEM ESCUTA -- NAO PODE EXPLODIR');
g = telaAberta(); g.authUser = null; S.__setGame(g);
let explodiu = false;
try{ S.ligarEscutaDoBoss(); }catch(e){ explodiu = true; }
ok('sem authUser nao lanca', !explodiu);
S.pararAcompanhamentoDoBoss();

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
