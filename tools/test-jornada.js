/**
 * A BIFURCACAO KANTO/JOHTO -- as regras que a jornada tem que manter.
 *
 * A escolha de caminho e o unico ponto do jogo onde duas tabelas paralelas precisam ficar
 * equivalentes: se um lado for mais facil, a escolha deixa de ser de TIPO e vira de dificuldade.
 * Este teste tranca o que da pra trancar sem simular (quantidade, media de nivel, pools, ids) --
 * a taxa de vitoria em si e medida pelo smoke com --regiao.
 *
 *   node tools/test-jornada.js
 */
const path = require('path');
const { createSandbox } = require('./game-sandbox');
const S = createSandbox(path.join(__dirname, '..', 'index.html'));

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const K = S.KANTO_GYMS, J = S.JOHTO_GYMS;
const media = g => g.team.reduce((s,p)=>s+p.level,0) / g.team.length;

console.log('\nOS DOIS CAMINHOS SAO EQUIVALENTES');
ok('8 ginasios de cada lado', K.length === 8 && J.length === 8, K.length+' e '+J.length);
const nDif = K.map((k,i)=>[k,J[i]]).filter(([k,j])=>k.team.length!==j.team.length);
ok('mesmo numero de pokemon em cada etapa', nDif.length === 0,
   nDif.map(([k,j])=>k.leaderName+' '+k.team.length+' x '+j.team.length+' '+j.leaderName).join(', '));
const mDif = K.map((k,i)=>[k,J[i]]).filter(([k,j])=>Math.abs(media(k)-media(j)) > 0.06);
ok('mesma media de nivel em cada etapa', mDif.length === 0,
   mDif.map(([k,j])=>k.leaderName+' '+media(k).toFixed(1)+' x '+media(j).toFixed(1)+' '+j.leaderName).join(', '));
K.forEach((k,i)=>console.log('         etapa '+(i+1)+': '+k.leaderName.padEnd(10)+' x '+J[i].leaderName.padEnd(10)+
  '  '+k.team.length+' pokemon, media '+media(k).toFixed(1)));

console.log('\nIDENTIDADE');
const todos = K.concat(J);
ok('nenhum id de ginasio repetido', new Set(todos.map(g=>g.id)).size === 16);
ok('nenhuma insignia repetida', new Set(todos.map(g=>g.badge)).size === 16);
const semSelo = todos.filter(g=>!S.GYM_BADGE_VISUALS || !S.GYM_BADGE_VISUALS[g.id]);
ok('todo ginasio tem selo', semSelo.length === 0, semSelo.map(g=>g.id).join(','));
const semEspecie = todos.flatMap(g=>g.team.map(p=>p.species)).filter(id=>!S.SPECIES[id]);
ok('todo pokemon de ginasio existe', semEspecie.length === 0, [...new Set(semEspecie)].join(','));

console.log('\nAS ROTAS');
const RK = S.ROUTE_MAP, RJ = S.JOHTO_ROUTE_MAP;
ok('8 etapas de rota em Johto', RJ.length === 8, String(RJ.length));
ok('2 caminhos por etapa nos dois lados',
   RK.every(p=>p.length===2) && RJ.every(p=>p.length===2));
const todasRotas = RK.flat().concat(RJ.flat());
ok('nenhum id de rota repetido', new Set(todasRotas.map(r=>r.id)).size === todasRotas.length,
   String(todasRotas.length)+' rotas');
const poolCurto = todasRotas.filter(r=>r.pool.length < 6);
ok('toda rota tem pelo menos 6 no pool', poolCurto.length === 0,
   poolCurto.map(r=>r.id+'='+r.pool.length).join(','));
const bicho = todasRotas.flatMap(r=>r.pool.concat((r.rare||[]).map(x=>typeof x==='object'?x.species:x)))
                        .filter(id=>!S.SPECIES[id]);
ok('todo pokemon de rota existe', bicho.length === 0, [...new Set(bicho)].join(','));
ok('routeById acha rota dos DOIS lados',
   !!S.routeById('viridian_forest') && !!S.routeById('dragons_den'));

console.log('\nO CAMINHO ESCOLHIDO MANDA');
const g = S.freshGameDefaults(); g.gymIndex = 0; S.__setGame(g);
ok('save sem gymPath cai em Kanto (jornada antiga intacta)', S.gymOf(0).id === 'brock');
g.gymPath = ['johto']; S.__setGame(g);
ok('escolher Johto troca o ginasio', S.gymOf(0).id === 'falkner');
ok('e troca as rotas oferecidas', S.routesForLeg(0).map(r=>r.id).join(',') === 'route_29_30,dark_cave',
   S.routesForLeg(0).map(r=>r.id).join(','));
g.gymPath = ['kanto']; S.__setGame(g);
ok('e volta pras de Kanto quando escolhe Kanto', S.routesForLeg(0).map(r=>r.id).join(',') === 'viridian_forest,route_22');
g.gymPath = ['johto','kanto','johto']; g.gymIndex = 2; S.__setGame(g);
ok('cada etapa guarda a SUA escolha',
   S.gymOf(0).id==='falkner' && S.gymOf(1).id==='misty' && S.gymOf(2).id==='whitney',
   [0,1,2].map(i=>S.gymOf(i).id).join(','));

console.log('\nA TELA DE ESCOLHA');
g.gymIndex = 3; g.gymPath = []; g.starterId='charmander'; S.__setGame(g);
const html = S.renderGymChoice();
ok('mostra os dois ginasios da etapa', html.includes('Erika') && html.includes('Morty'));
ok('mostra as rotas de cada lado', html.includes('Túnel de Pedra') && html.includes('Parque Nacional'));
ok('os dois botoes escolhem regioes diferentes',
   html.includes("escolherGinasio('kanto')") && html.includes("escolherGinasio('johto')"));

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
