const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

/* ---------------------------------------------------
   DADOS DO JOGO (gerados a partir do pokemon-ginasio.html —
   se adicionar pokémons/tipos novos no jogo, gere de novo esse trecho)
--------------------------------------------------- */
const SPECIES = {
  bulbasaur:{name:'Bulbasaur', types:['Grass','Poison'], bst:318},
  charmander:{name:'Charmander', types:['Fire'], bst:309},
  squirtle:{name:'Squirtle', types:['Water'], bst:314},
  weedle:{name:'Weedle', types:['Bug','Poison'], bst:195},
  caterpie:{name:'Caterpie', types:['Bug'], bst:195},
  ratata:{name:'Ratata', types:['Normal'], bst:275},
  pidgey:{name:'Pidgey', types:['Normal','Flying'], bst:270},
  mankey:{name:'Mankey', types:['Fighting'], bst:305},
  spearow:{name:'Spearow', types:['Normal','Flying'], bst:285},
  nidoranm:{name:'Nidoran (M)', types:['Poison'], bst:273},
  oddish:{name:'Oddish', types:['Grass','Poison'], bst:320},
  geodude:{name:'Geodude', types:['Rock','Ground'], bst:300},
  onix:{name:'Onix', types:['Rock','Ground'], bst:385},
  ivysaur:{name:'Ivysaur', types:['Grass','Poison'], bst:405},
  venusaur:{name:'Venusaur', types:['Grass','Poison'], bst:525},
  charmeleon:{name:'Charmeleon', types:['Fire'], bst:405},
  charizard:{name:'Charizard', types:['Fire','Flying'], bst:534},
  wartortle:{name:'Wartortle', types:['Water'], bst:405},
  blastoise:{name:'Blastoise', types:['Water'], bst:530},
  kakuna:{name:'Kakuna', types:['Bug','Poison'], bst:205},
  beedrill:{name:'Beedrill', types:['Bug','Poison'], bst:395},
  metapod:{name:'Metapod', types:['Bug'], bst:205},
  butterfree:{name:'Butterfree', types:['Bug','Flying'], bst:395},
  raticate:{name:'Raticate', types:['Normal'], bst:445},
  pidgeotto:{name:'Pidgeotto', types:['Normal','Flying'], bst:375},
  pidgeot:{name:'Pidgeot', types:['Normal','Flying'], bst:515},
  primeape:{name:'Primeape', types:['Fighting'], bst:455},
  fearow:{name:'Fearow', types:['Normal','Flying'], bst:475},
  nidorino:{name:'Nidorino', types:['Poison'], bst:335},
  gloom:{name:'Gloom', types:['Grass','Poison'], bst:395},
  sandshrew:{name:'Sandshrew', types:['Ground'], bst:300},
  sandslash:{name:'Sandslash', types:['Ground'], bst:450},
  clefairy:{name:'Clefairy', types:['Normal'], bst:350},
  jigglypuff:{name:'Jigglypuff', types:['Normal'], bst:290},
  zubat:{name:'Zubat', types:['Poison','Flying'], bst:245},
  golbat:{name:'Golbat', types:['Poison','Flying'], bst:455},
  paras:{name:'Paras', types:['Bug','Grass'], bst:285},
  parasect:{name:'Parasect', types:['Bug','Grass'], bst:405},
  meowth:{name:'Meowth', types:['Normal'], bst:315},
  persian:{name:'Persian', types:['Normal'], bst:475},
  bellsprout:{name:'Bellsprout', types:['Grass','Poison'], bst:300},
  weepinbell:{name:'Weepinbell', types:['Grass','Poison'], bst:390},
  abra:{name:'Abra', types:['Psychic'], bst:310},
  kadabra:{name:'Kadabra', types:['Psychic'], bst:400},
  staryu:{name:'Staryu', types:['Water'], bst:340},
  starmie:{name:'Starmie', types:['Water','Psychic'], bst:520},
  growlithe:{name:'Growlithe', types:['Fire'], bst:350},
  vulpix:{name:'Vulpix', types:['Fire'], bst:299},
  ekans:{name:'Ekans', types:['Poison'], bst:288},
  arbok:{name:'Arbok', types:['Poison'], bst:448},
  diglett:{name:'Diglett', types:['Ground'], bst:265},
  dugtrio:{name:'Dugtrio', types:['Ground'], bst:425},
  magnemite:{name:'Magnemite', types:['Electric'], bst:325},
  magneton:{name:'Magneton', types:['Electric'], bst:465},
  drowzee:{name:'Drowzee', types:['Psychic'], bst:328},
  hypno:{name:'Hypno', types:['Psychic'], bst:483},
  nidoranf:{name:'Nidoran (F)', types:['Poison'], bst:275},
  nidorina:{name:'Nidorina', types:['Poison'], bst:365},
  venonat:{name:'Venonat', types:['Bug','Poison'], bst:305},
  venomoth:{name:'Venomoth', types:['Bug','Poison'], bst:450},
  voltorb:{name:'Voltorb', types:['Electric'], bst:330},
  pikachu:{name:'Pikachu', types:['Electric'], bst:320},
  raichu:{name:'Raichu', types:['Electric'], bst:485},
  poliwag:{name:'Poliwag', types:['Water'], bst:300},
  poliwhirl:{name:'Poliwhirl', types:['Water'], bst:385},
  tentacool:{name:'Tentacool', types:['Water','Poison'], bst:335},
  tentacruel:{name:'Tentacruel', types:['Water','Poison'], bst:515},
  machop:{name:'Machop', types:['Fighting'], bst:305},
  machoke:{name:'Machoke', types:['Fighting'], bst:405},
  doduo:{name:'Doduo', types:['Normal','Flying'], bst:335},
  dodrio:{name:'Dodrio', types:['Normal','Flying'], bst:510},
  ponyta:{name:'Ponyta', types:['Fire'], bst:410},
  rapidash:{name:'Rapidash', types:['Fire'], bst:500},
  slowpoke:{name:'Slowpoke', types:['Water','Psychic'], bst:315},
  slowbro:{name:'Slowbro', types:['Water','Psychic'], bst:490},
  magikarp:{name:'Magikarp', types:['Water'], bst:200},
  gyarados:{name:'Gyarados', types:['Water','Flying'], bst:540},
  grimer:{name:'Grimer', types:['Poison'], bst:325},
  muk:{name:'Muk', types:['Poison'], bst:500},
  tauros:{name:'Tauros', types:['Normal'], bst:530},
  psyduck:{name:'Psyduck', types:['Water'], bst:320},
  golduck:{name:'Golduck', types:['Water'], bst:500},
  krabby:{name:'Krabby', types:['Water'], bst:325},
  kingler:{name:'Kingler', types:['Water'], bst:475},
  horsea:{name:'Horsea', types:['Water'], bst:295},
  seadra:{name:'Seadra', types:['Water'], bst:440},
  goldeen:{name:'Goldeen', types:['Water'], bst:320},
  seaking:{name:'Seaking', types:['Water'], bst:450},
  shellder:{name:'Shellder', types:['Water'], bst:305},
  exeggcute:{name:'Exeggcute', types:['Grass','Psychic'], bst:325},
  cubone:{name:'Cubone', types:['Ground'], bst:320},
  marowak:{name:'Marowak', types:['Ground'], bst:425},
  victreebel:{name:'Victreebel', types:['Grass','Poison'], bst:490},
  tangela:{name:'Tangela', types:['Grass'], bst:435},
  vileplume:{name:'Vileplume', types:['Grass','Poison'], bst:490},
  koffing:{name:'Koffing', types:['Poison'], bst:305},
  weezing:{name:'Weezing', types:['Poison'], bst:490},
  gastly:{name:'Gastly', types:['Ghost','Poison'], bst:310},
  haunter:{name:'Haunter', types:['Ghost','Poison'], bst:405},
  ditto:{name:'Ditto', types:['Normal'], bst:345},
  lickitung:{name:'Lickitung', types:['Normal'], bst:415},
  rhyhorn:{name:'Rhyhorn', types:['Ground','Rock'], bst:345},
  rhydon:{name:'Rhydon', types:['Ground','Rock'], bst:485},
  seel:{name:'Seel', types:['Water'], bst:325},
  dewgong:{name:'Dewgong', types:['Water'], bst:475},
  farfetchd:{name:"Farfetch'd", types:['Normal','Flying'], bst:450},
  kangaskhan:{name:'Kangaskhan', types:['Normal'], bst:530},
  scyther:{name:'Scyther', types:['Bug','Flying'], bst:470},
  omanyte:{name:'Omanyte', types:['Rock','Water'], bst:355},
  omastar:{name:'Omastar', types:['Rock','Water'], bst:495},
  kabuto:{name:'Kabuto', types:['Rock','Water'], bst:355},
  kabutops:{name:'Kabutops', types:['Rock','Water'], bst:495},
  electrode:{name:'Electrode', types:['Electric'], bst:480},
  magmar:{name:'Magmar', types:['Fire'], bst:495},
  lapras:{name:'Lapras', types:['Water'], bst:535},
  porygon:{name:'Porygon', types:['Normal'], bst:475},
  eevee:{name:'Eevee', types:['Normal'], bst:390},
  snorlax:{name:'Snorlax', types:['Normal'], bst:585},
  chansey:{name:'Chansey', types:['Normal'], bst:485},
  hitmonlee:{name:'Hitmonlee', types:['Fighting'], bst:455},
  hitmonchan:{name:'Hitmonchan', types:['Fighting'], bst:455},
  pinsir:{name:'Pinsir', types:['Bug'], bst:500},
  electabuzz:{name:'Electabuzz', types:['Electric'], bst:490},
  aerodactyl:{name:'Aerodactyl', types:['Rock','Flying'], bst:515},
  alakazam:{name:'Alakazam', types:['Psychic'], bst:500},
  mrmime:{name:'Mr. Mime', types:['Psychic'], bst:460},
  arcanine:{name:'Arcanine', types:['Fire'], bst:555},
  nidoqueen:{name:'Nidoqueen', types:['Poison','Ground'], bst:505},
  nidoking:{name:'Nidoking', types:['Poison','Ground'], bst:505},
  graveler:{name:'Graveler', types:['Rock','Ground'], bst:425},
  dratini:{name:'Dratini', types:['Dragon'], bst:300},
  dragonair:{name:'Dragonair', types:['Dragon'], bst:420},
  dragonite:{name:'Dragonite', types:['Dragon','Flying'], bst:600},
  jynx:{name:'Jynx', types:['Ice','Psychic'], bst:455},
  exeggutor:{name:'Exeggutor', types:['Grass','Psychic'], bst:520},
  clefable:{name:'Clefable', types:['Normal'], bst:520},
  wigglytuff:{name:'Wigglytuff', types:['Normal'], bst:470},
  ninetales:{name:'Ninetales', types:['Fire'], bst:505},
  poliwrath:{name:'Poliwrath', types:['Water','Fighting'], bst:510},
  cloyster:{name:'Cloyster', types:['Water','Ice'], bst:525},
  machamp:{name:'Machamp', types:['Fighting'], bst:505},
  golem:{name:'Golem', types:['Rock','Ground'], bst:495},
  gengar:{name:'Gengar', types:['Ghost','Poison'], bst:500},
  moltres:{name:'Moltres', types:['Fire','Flying'], bst:580},
  zapdos:{name:'Zapdos', types:['Electric','Flying'], bst:580},
  articuno:{name:'Articuno', types:['Ice','Flying'], bst:580},
  vaporeon:{name:'Vaporeon', types:['Water'], bst:525},
  jolteon:{name:'Jolteon', types:['Electric'], bst:525},
  flareon:{name:'Flareon', types:['Fire'], bst:525},
  mewtwo:{name:'Mewtwo', types:['Psychic'], bst:680}
};

const TYPE_CHART = {
  Normal:{Rock:0.5, Ghost:0},
  Fire:{Grass:2,Bug:2,Rock:0.5,Water:0.5,Fire:0.5,Ice:2},
  Water:{Fire:2,Rock:2,Ground:2,Water:0.5,Grass:0.5},
  Grass:{Water:2,Rock:2,Ground:2,Fire:0.5,Grass:0.5,Poison:0.5,Flying:0.5,Bug:0.5},
  Poison:{Grass:2,Bug:0.5,Rock:0.5,Ground:0.5,Poison:0.5},
  Flying:{Grass:2,Fighting:2,Bug:2,Rock:0.5,Electric:0.5},
  Bug:{Grass:2,Poison:0.5,Fighting:0.5,Flying:0.5,Fire:0.5,Psychic:2},
  Fighting:{Normal:2,Rock:2,Poison:0.5,Flying:0.5,Bug:0.5,Psychic:0.5,Ghost:0,Ice:2},
  Rock:{Fire:2,Flying:2,Bug:2,Fighting:0.5,Ground:0.5,Ice:2},
  Ground:{Fire:2,Rock:2,Poison:2,Grass:0.5,Bug:0.5,Electric:2},
  Psychic:{Fighting:2,Poison:2,Psychic:0.5},
  Electric:{Water:2,Flying:2,Grass:0.5,Electric:0.5,Ground:0},
  Ghost:{Ghost:2,Psychic:2},
  Dragon:{Dragon:2},
  Ice:{Grass:2,Ground:2,Flying:2,Dragon:2,Water:0.5,Ice:0.5,Fire:0.5}
};

/* ---------------------------------------------------
   MOTOR DE BATALHA (mesma lógica do jogo, portada pro servidor)
--------------------------------------------------- */
function typeVsType(atk, def){
  const chart = TYPE_CHART[atk];
  if(!chart) return 1;
  const val = chart[def];
  return (val === undefined) ? 1 : val;
}
function bestMultiplier(atkTypes, defTypes){
  let best = 0;
  atkTypes.forEach(a=>{
    let m = 1;
    defTypes.forEach(d=> m *= typeVsType(a,d));
    if(m > best) best = m;
  });
  return best;
}
function createInstance(speciesId, level){
  const sp = SPECIES[speciesId];
  if(!sp) return null;
  return { speciesId, name:sp.name, types:sp.types, bst:sp.bst, level, maxHp:0, hp:0 };
}
function calcMaxHp(p){ return Math.round(30 + p.level*5 + p.bst/5); }
function calcDamage(attacker, defender, rng){
  const mult = bestMultiplier(attacker.types, defender.types);
  const base = attacker.level*2.5 + attacker.bst/35;
  let defense = Math.pow(defender.bst/300, 0.7);
  const wins = defender.winsThisBattle||0;
  if(wins > 0){
    const defHpPct = defender.hp / defender.maxHp;
    const minDefenseFactor = Math.max(0.1, 1 - wins*0.35);
    defense = defense * (minDefenseFactor + (1-minDefenseFactor) * defHpPct);
  }
  let levelFactor = 1 + (attacker.level - defender.level) * 0.033;
  levelFactor = Math.max(0.45, Math.min(2.8, levelFactor));
  const dmg = Math.round((base * mult / defense) * levelFactor * (0.75 + rng()*0.5));
  return Math.max(1, dmg);
}
function doExchange(active, enemy, rng){
  const dmgToEnemy = calcDamage(active, enemy, rng);
  const dmgToActive = calcDamage(enemy, active, rng);
  enemy.hp = Math.max(0, enemy.hp - dmgToEnemy);
  active.hp = Math.max(0, active.hp - dmgToActive);
}
function simulateGymBattle(team, enemyTeam, rng){
  team.forEach(p=>{ p.maxHp=calcMaxHp(p); p.hp=p.maxHp; p.winsThisBattle=0; });
  enemyTeam.forEach(p=>{ p.maxHp=calcMaxHp(p); p.hp=p.maxHp; p.winsThisBattle=0; });

  const matchups = [];
  let enemyIndex = 0;
  while(enemyIndex < enemyTeam.length){
    const enemy = enemyTeam[enemyIndex];
    let enemyDefeated = false;
    while(!enemyDefeated){
      const alive = team.filter(p=>p.hp>0);
      if(alive.length===0){ return { win:false, matchups }; }
      const active = alive[0];
      const playerHpBefore = active.hp;
      const enemyHpBefore = enemy.hp;
      const playerAliveBefore = alive.length;
      const enemyAliveBefore = enemyTeam.length - enemyIndex;
      while(active.hp>0 && enemy.hp>0){ doExchange(active, enemy, rng); }
      let enemyFainted = enemy.hp<=0;
      let activeFainted = active.hp<=0;
      let suddenDeath = false;
      let suddenDeathMessage = null;
      if(playerAliveBefore===1 && enemyAliveBefore===1 && enemyFainted && activeFainted){
        suddenDeath = true;
        if(rng() < 0.5){
          active.hp = 1; enemy.hp = 0;
          suddenDeathMessage = `Troca de golpes fatais! ${active.name} mal ficou de pé, mas foi o suficiente pra decidir a batalha!`;
        } else {
          enemy.hp = 1; active.hp = 0;
          suddenDeathMessage = `Troca de golpes fatais! ${enemy.name} resistiu por um triz e virou o resultado no último suspiro!`;
        }
        enemyFainted = enemy.hp<=0;
        activeFainted = active.hp<=0;
      }
      const isTrade = enemyFainted && activeFainted;
      const playerWon = enemyFainted && !activeFainted;
      const playerAliveAfter = activeFainted ? playerAliveBefore - 1 : playerAliveBefore;
      const enemyAliveAfter = enemyFainted ? enemyAliveBefore - 1 : enemyAliveBefore;
      matchups.push({
        player:active.name, playerSpecies:active.speciesId, playerLevel:active.level,
        enemy:enemy.name, enemySpecies:enemy.speciesId, enemyLevel:enemy.level,
        winner: isTrade ? null : (playerWon ? active.name : enemy.name),
        isTrade,
        suddenDeath, suddenDeathMessage,
        playerWon,
        playerHpBefore, playerHpAfter: active.hp, playerMaxHp: active.maxHp,
        enemyHpBefore, enemyHpAfter: enemy.hp, enemyMaxHp: enemy.maxHp,
        playerAliveBefore, playerAliveAfter, playerTeamSize: team.length,
        enemyAliveBefore, enemyAliveAfter, enemyTeamSize: enemyTeam.length
      });
      if(enemyFainted){ enemyDefeated = true; active.winsThisBattle = (active.winsThisBattle||0) + 1; }
      else if(activeFainted){ enemy.winsThisBattle = (enemy.winsThisBattle||0) + 1; }
    }
    enemyIndex++;
  }
  const teamStillAlive = team.some(p=>p.hp>0);
  return { win: teamStillAlive, matchups };
}
function makeSeededRng(seedStr){
  let h = 1779033703 ^ seedStr.length;
  for(let i=0;i<seedStr.length;i++){
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
function encodeTeamCode(team){
  const payload = team.map(p=>`${p.speciesId}:${p.level}`).join(',');
  return Buffer.from(payload, 'utf8').toString('base64').replace(/=+$/,'');
}
function decodeTeamCode(code){
  if(!code) return null;
  let padded = code.trim();
  if(!padded) return null;
  while(padded.length % 4 !== 0) padded += '=';
  let payload;
  try{ payload = Buffer.from(padded, 'base64').toString('utf8'); } catch(e){ return null; }
  const parts = payload.split(',').filter(Boolean);
  if(parts.length===0 || parts.length>6) return null;
  const team = [];
  for(const part of parts){
    const bits = part.split(':');
    if(bits.length!==2) return null;
    const id = bits[0];
    const lvl = parseInt(bits[1],10);
    if(!SPECIES[id] || !Number.isFinite(lvl) || lvl<1 || lvl>200) return null;
    const inst = createInstance(id, lvl);
    if(!inst) return null;
    team.push(inst);
  }
  return team;
}

/* ---------------------------------------------------
   LÓGICA DA LIGA (mesma do jogo, portada pro servidor)
--------------------------------------------------- */
const CYCLE_INTERVAL_MS = 60 * 60 * 1000; // uma Liga nova por hora
const PHASE_MS = 5 * 60 * 1000;
const GRANDE_LIGA_SIZE = 16;
const REGULAR_LIGA_SIZE = 8;

function computeNextScheduledTime(){
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  if(target.getTime() <= now.getTime()){ target.setHours(target.getHours()+1); }
  return target.getTime();
}
function scheduleDocRef(){ return db.collection('leagues').doc('schedule'); }
function cycleDocRef(cycleId){ return db.collection('leagueCycles').doc(String(cycleId)); }
function registrantsCollRef(cycleId){ return cycleDocRef(cycleId).collection('registrants'); }
function makeCycleId(scheduledTime){ return String(scheduledTime); }
function buildRounds(players){
  const n = players.length; // 8 (Liga normal) ou 16 (Grande Liga)
  const numRounds = Math.round(Math.log2(n));
  const rounds = {};
  const firstRound = [];
  for(let i=0;i<n;i+=2){
    firstRound.push({ a:players[i], b:players[i+1], winner:null, matchups:null, resolved:false });
  }
  rounds['0'] = firstRound;
  let matchCount = firstRound.length;
  for(let r=1; r<numRounds; r++){
    matchCount = matchCount/2;
    const roundMatches = [];
    for(let i=0;i<matchCount;i++){ roundMatches.push({ a:null, b:null, winner:null, matchups:null, resolved:false }); }
    rounds[String(r)] = roundMatches;
  }
  return rounds;
}
function shuffleWithSeed(arr, seedStr){
  const rng = makeSeededRng(seedStr);
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
async function syncLeaguePlayerLevels(playerRef, leveledTeam){
  if(!playerRef.uid || playerRef.slot==null) return;
  try{
    const ref = db.collection('users').doc(playerRef.uid).collection('saves').doc(String(playerRef.slot));
    const snap = await ref.get();
    if(!snap.exists) return;
    const saveData = snap.data();
    const currentTeam = saveData.team || [];
    const updatedTeam = currentTeam.map((p,i)=>{
      const leveled = leveledTeam[i];
      if(leveled && leveled.speciesId===p.speciesId){ return { ...p, level: leveled.level }; }
      return p;
    });
    await ref.set({ ...saveData, team: updatedTeam });
  } catch(e){ logger.error('Erro ao sincronizar levels da Liga pro save:', e); }
}
async function recordLeagueChampionWin(name, uid, slot){
  try{
    await db.collection('leagues').doc('champions_alltime').set(
      { wins: { [name]: admin.firestore.FieldValue.increment(1) } },
      { merge: true }
    );
  } catch(e){ logger.error('Erro ao registrar campeão no ranking global:', e); }
  if(uid){
    try{
      await db.collection('users').doc(uid).set(
        {
          leagueWinsTotal: admin.firestore.FieldValue.increment(1),
          leagueWinsBySlot: slot!=null ? { [String(slot)]: admin.firestore.FieldValue.increment(1) } : {}
        },
        { merge: true }
      );
    } catch(e){ logger.error('Erro ao registrar campeão na conta:', e); }
  }
}
async function recordLeaguePlacement(uid, slot, record){
  if(!uid || slot==null) return;
  try{
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    const bySlot = (snap.exists && snap.data().leaguePlacementsBySlot) ? snap.data().leaguePlacementsBySlot : {};
    const slotKey = String(slot);
    const current = bySlot[slotKey] || [];
    if(current.some(p=>p.cycleId===record.cycleId && p.leagueId===record.leagueId)) return;
    const updated = [record, ...current].sort((a,b)=>b.cycleTime-a.cycleTime).slice(0, 12);
    await ref.set({ leaguePlacementsBySlot: { [slotKey]: updated } }, { merge: true });
  } catch(e){ logger.error('Erro ao gravar colocação na Liga:', e); }
}
function resolveLeagueMatch(match, seedStr, pendingSyncs){
  const rng = makeSeededRng(seedStr);
  const teamA = decodeTeamCode(match.a.code);
  const teamB = decodeTeamCode(match.b.code);
  if(!teamA || !teamB){
    match.winner = teamA ? match.a : match.b;
    match.resolved = true;
    match.matchups = [];
    return;
  }
  const result = simulateGymBattle(teamA, teamB, rng);
  // mesma mecânica dos ginásios: pokémon que desmaiou ganha +1 level, e isso acompanha o treinador pra próxima fase
  // (e é gravado de volta no save real do jogador, mesmo que ele seja eliminado — a Cloud Function usa o Admin SDK,
  // então consegue escrever no save de QUALQUER jogador, diferente do cliente que só escreve no próprio)
  teamA.forEach(p=>{ if(p.hp<=0) p.level += 1; });
  teamB.forEach(p=>{ if(p.hp<=0) p.level += 1; });
  const updatedA = { name: match.a.name, code: encodeTeamCode(teamA), uid: match.a.uid, slot: match.a.slot };
  const updatedB = { name: match.b.name, code: encodeTeamCode(teamB), uid: match.b.uid, slot: match.b.slot };
  match.a = updatedA;
  match.b = updatedB;
  match.matchups = result.matchups; // mantém o log completo, pro botão "Assistir batalha" funcionar mesmo quando quem resolve é a Cloud Function
  match.winner = result.win ? updatedA : updatedB;
  match.resolved = true;
  pendingSyncs.push({ playerRef: updatedA, leveledTeam: teamA });
  pendingSyncs.push({ playerRef: updatedB, leveledTeam: teamB });
}
const STUCK_CLAIM_THRESHOLD_MS = 3 * 60 * 1000;
async function claimCycleForProcessing(cycleId, fromStatus, toStatus){
  return await db.runTransaction(async (tx)=>{
    const snap = await tx.get(scheduleDocRef());
    if(!snap.exists) return false;
    const data = snap.data();
    const entry = data.cycles.find(c=>c.id===cycleId);
    if(!entry || entry.status!==fromStatus) return false;
    entry.status = toStatus;
    entry.claimedAt = (toStatus==='advancing' || toStatus==='drawing') ? Date.now() : null;
    data.updatedAt = Date.now();
    tx.set(scheduleDocRef(), data);
    return true;
  });
}
async function recoverStuckCycles(){
  try{
    await db.runTransaction(async (tx)=>{
      const snap = await tx.get(scheduleDocRef());
      if(!snap.exists) return;
      const data = snap.data();
      const now = Date.now();
      let changed = false;
      for(const entry of data.cycles){
        const isStuck = (entry.status==='advancing' || entry.status==='drawing') &&
          (!entry.claimedAt || (now - entry.claimedAt > STUCK_CLAIM_THRESHOLD_MS));
        if(isStuck){
          entry.status = entry.status==='advancing' ? 'drawn' : 'registering';
          entry.claimedAt = null;
          changed = true;
        }
      }
      if(changed){ data.updatedAt = Date.now(); tx.set(scheduleDocRef(), data); }
    });
  } catch(e){ logger.error('Erro ao recuperar ciclos travados:', e); }
}
async function drawCycle(cycleEntry){
  const claimed = await claimCycleForProcessing(cycleEntry.id, 'registering', 'drawing');
  if(!claimed) return false;
  try{
    const regSnap = await registrantsCollRef(cycleEntry.id).get();
    const registrants = regSnap.docs.map(d=>d.data());
    const shuffled = shuffleWithSeed(registrants, 'draw-'+cycleEntry.scheduledTime);
    const leagues = [];
    let cursor = 0;
    const grandeCount = Math.floor(shuffled.length / GRANDE_LIGA_SIZE);
    for(let i=0;i<grandeCount;i++){
      leagues.push({ id: leagues.length, size: GRANDE_LIGA_SIZE, rounds: buildRounds(shuffled.slice(cursor, cursor+GRANDE_LIGA_SIZE)), champion:null });
      cursor += GRANDE_LIGA_SIZE;
    }
    const remaining = shuffled.length - cursor;
    const regularCount = Math.floor(remaining / REGULAR_LIGA_SIZE);
    for(let i=0;i<regularCount;i++){
      leagues.push({ id: leagues.length, size: REGULAR_LIGA_SIZE, rounds: buildRounds(shuffled.slice(cursor, cursor+REGULAR_LIGA_SIZE)), champion:null });
      cursor += REGULAR_LIGA_SIZE;
    }
    const leftover = shuffled.slice(cursor);
    const detail = {
      scheduledTime: cycleEntry.scheduledTime,
      leagues, leftover,
      qfTime: cycleEntry.scheduledTime + PHASE_MS,
      sfTime: cycleEntry.scheduledTime + PHASE_MS*2,
      finalTime: cycleEntry.scheduledTime + PHASE_MS*3,
      phase4Time: cycleEntry.scheduledTime + PHASE_MS*4,
      updatedAt: Date.now()
    };
    await cycleDocRef(cycleEntry.id).set(detail);

    const nextScheduledTime = cycleEntry.scheduledTime + CYCLE_INTERVAL_MS;
    const nextCycleId = makeCycleId(nextScheduledTime);
    for(const p of leftover){
      await registrantsCollRef(nextCycleId).doc(p.name.trim().toLowerCase().replace(/[\/\s]+/g,'_').slice(0,200) || 'sememnome').set(p);
    }

    await db.runTransaction(async (tx)=>{
      const snap = await tx.get(scheduleDocRef());
      const data = snap.exists ? snap.data() : { cycles: [], updatedAt: Date.now() };
      const entry = data.cycles.find(c=>c.id===cycleEntry.id);
      if(entry){ entry.status = leagues.length>0 ? 'drawn' : 'complete'; }
      if(!data.cycles.some(c=>c.id===nextCycleId)){
        data.cycles.push({ id: nextCycleId, scheduledTime: nextScheduledTime, status:'registering' });
      }
      data.updatedAt = Date.now();
      tx.set(scheduleDocRef(), data);
    });
    return true;
  } catch(e){
    logger.error('Erro ao sortear ciclo:', e);
    await claimCycleForProcessing(cycleEntry.id, 'drawing', 'registering');
    return false;
  }
}
function computePlacement(league, playerName){
  if(!league.champion) return null;
  if(league.champion.name===playerName) return 'Campeão';
  const roundKeys = Object.keys(league.rounds).sort((a,b)=>Number(a)-Number(b));
  const lastRoundIdx = roundKeys.length - 1;
  const finalMatch = league.rounds[roundKeys[lastRoundIdx]][0];
  if(finalMatch.a && finalMatch.b && (finalMatch.a.name===playerName || finalMatch.b.name===playerName)){
    return 'Vice-campeão';
  }
  for(let ri=lastRoundIdx-1; ri>=0; ri--){
    const round = league.rounds[roundKeys[ri]];
    const wasHere = round.some(m=> m.a && m.b && (m.a.name===playerName || m.b.name===playerName));
    if(wasHere){
      const eliminatedInSize = round.length * 2;
      const nextSize = eliminatedInSize / 2;
      return `${nextSize+1}º–${eliminatedInSize}º Lugar`;
    }
  }
  return null;
}
async function advanceCyclePhases(cycleEntry){
  const claimed = await claimCycleForProcessing(cycleEntry.id, 'drawn', 'advancing');
  if(!claimed) return false;
  let pendingSyncs = [], pendingChampions = [], pendingPlacements = [], changed = false;
  try{
    const ref = cycleDocRef(cycleEntry.id);
    const snap = await ref.get();
    if(!snap.exists){ await claimCycleForProcessing(cycleEntry.id, 'advancing', 'drawn'); return false; }
    const detail = snap.data();
    const now = Date.now();
    const phaseTimes = [detail.qfTime, detail.sfTime, detail.finalTime, detail.phase4Time];
    for(const league of detail.leagues){
      const roundKeys = Object.keys(league.rounds).sort((a,b)=>Number(a)-Number(b));
      for(let ri=0; ri<roundKeys.length; ri++){
        if(now < phaseTimes[ri]) break;
        const round = league.rounds[roundKeys[ri]];
        for(let mi=0; mi<round.length; mi++){
          const match = round[mi];
          if(!match.resolved && match.a && match.b){
            resolveLeagueMatch(match, `${cycleEntry.scheduledTime}-L${league.id}-R${ri}-M${mi}`, pendingSyncs);
            changed = true;
            if(ri+1 < roundKeys.length){
              const nextRound = league.rounds[roundKeys[ri+1]];
              const nextMatch = nextRound[Math.floor(mi/2)];
              if(mi%2===0){ nextMatch.a = match.winner; } else { nextMatch.b = match.winner; }
            } else {
              league.champion = match.winner;
              pendingChampions.push({ name: match.winner.name, uid: match.winner.uid, slot: match.winner.slot });
              const participants = [];
              (league.rounds['0']||[]).forEach(m=>{ if(m.a) participants.push(m.a); if(m.b) participants.push(m.b); });
              for(const p of participants){
                const placement = computePlacement(league, p.name);
                if(placement && p.uid){
                  // mesmo fallback defensivo do cliente -- alguns ciclos antigos podem estar sem "scheduledTime"/
                  // "size" (de antes desses campos existirem, ou de uma migração), e o Firestore recusa gravar
                  // "undefined" -- sem isso um único registro velho malformado quebrava a gravação inteira
                  const cycleTime = cycleEntry.scheduledTime!=null ? cycleEntry.scheduledTime : Number(cycleEntry.id) || 0;
                  const leagueSize = league.size!=null ? league.size : ((league.rounds['0']||[]).length * 2 || REGULAR_LIGA_SIZE);
                  pendingPlacements.push({ uid: p.uid, slot: p.slot, record: { cycleId: cycleEntry.id, cycleTime, leagueId: league.id, leagueSize, placement } });
                }
              }
            }
          }
        }
      }
    }
    const allDone = detail.leagues.length>0 && detail.leagues.every(l=>l.champion);
    detail.updatedAt = Date.now();
    await ref.set(detail);
    await claimCycleForProcessing(cycleEntry.id, 'advancing', allDone ? 'complete' : 'drawn');
    for(const {playerRef, leveledTeam} of pendingSyncs){ await syncLeaguePlayerLevels(playerRef, leveledTeam); }
    for(const champ of pendingChampions){ await recordLeagueChampionWin(champ.name, champ.uid, champ.slot); }
    for(const p of pendingPlacements){ await recordLeaguePlacement(p.uid, p.slot, p.record); }
    return changed;
  } catch(e){
    logger.error('Erro ao avançar fases do ciclo:', e);
    await claimCycleForProcessing(cycleEntry.id, 'advancing', 'drawn');
    return false;
  }
}

/* ---------------------------------------------------
   FUNÇÃO AGENDADA — roda a cada minuto
--------------------------------------------------- */
exports.advanceLeague = onSchedule('every 1 minutes', async (event) => {
  let anyChanged = false;
  try{
    await recoverStuckCycles();
    const scheduleSnap = await scheduleDocRef().get();
    if(!scheduleSnap.exists){
      await scheduleDocRef().set({ cycles: [{ id: makeCycleId(computeNextScheduledTime()), scheduledTime: computeNextScheduledTime(), status:'registering' }], updatedAt: Date.now() });
      logger.info('Agenda da Liga criada do zero.');
      return;
    }
    const data = scheduleSnap.data();
    const now = Date.now();
    if(!data.cycles.some(c=>c.status==='registering')){
      await db.runTransaction(async (tx)=>{
        const snap = await tx.get(scheduleDocRef());
        const d = snap.exists ? snap.data() : { cycles: [], updatedAt: Date.now() };
        if(!d.cycles.some(c=>c.status==='registering')){
          d.cycles.push({ id: makeCycleId(computeNextScheduledTime()), scheduledTime: computeNextScheduledTime(), status:'registering' });
          d.updatedAt = Date.now();
          tx.set(scheduleDocRef(), d);
        }
      });
      anyChanged = true;
    }
    for(const entry of data.cycles.slice()){
      if(entry.status==='registering' && now >= entry.scheduledTime){
        const ok = await drawCycle(entry);
        if(ok) anyChanged = true;
      } else if(entry.status==='drawn'){
        const ok = await advanceCyclePhases(entry);
        if(ok) anyChanged = true;
      }
    }
    // limita o histórico aos 12 ciclos concluídos mais recentes
    const freshSnap = await scheduleDocRef().get();
    const freshData = freshSnap.data();
    const completed = freshData.cycles.filter(c=>c.status==='complete').sort((a,b)=>a.scheduledTime-b.scheduledTime);
    if(completed.length>12){
      const toRemoveIds = new Set(completed.slice(0, completed.length-12).map(c=>c.id));
      for(const id of toRemoveIds){ await cycleDocRef(id).delete(); }
      await db.runTransaction(async (tx)=>{
        const snap = await tx.get(scheduleDocRef());
        const d = snap.data();
        d.cycles = d.cycles.filter(c=>!toRemoveIds.has(c.id));
        d.updatedAt = Date.now();
        tx.set(scheduleDocRef(), d);
      });
      anyChanged = true;
    }
  } catch(e){
    logger.error('Erro ao avançar a Liga:', e);
    return;
  }
  if(anyChanged){ logger.info('Liga avançada pelo Cloud Function.'); }
  else { logger.info('Nada a avançar ainda.'); }
});
