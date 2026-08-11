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
  bulbasaur:{name:'Bulbasaur', types:['Grass','Poison'], hp:45, attack:49, defense:49, speed:45},
  charmander:{name:'Charmander', types:['Fire'], hp:39, attack:52, defense:43, speed:65},
  squirtle:{name:'Squirtle', types:['Water'], hp:44, attack:48, defense:65, speed:43},
  weedle:{name:'Weedle', types:['Bug','Poison'], hp:40, attack:35, defense:30, speed:50},
  caterpie:{name:'Caterpie', types:['Bug'], hp:45, attack:30, defense:35, speed:45},
  ratata:{name:'Ratata', types:['Normal'], hp:30, attack:56, defense:35, speed:72},
  pidgey:{name:'Pidgey', types:['Normal','Flying'], hp:40, attack:45, defense:40, speed:56},
  mankey:{name:'Mankey', types:['Fighting'], hp:40, attack:80, defense:35, speed:70},
  spearow:{name:'Spearow', types:['Normal','Flying'], hp:40, attack:60, defense:30, speed:70},
  nidoranm:{name:'Nidoran (M)', types:['Poison'], hp:46, attack:57, defense:40, speed:50},
  oddish:{name:'Oddish', types:['Grass','Poison'], hp:45, attack:50, defense:55, speed:30},
  geodude:{name:'Geodude', types:['Rock','Ground'], hp:40, attack:80, defense:100, speed:20},
  onix:{name:'Onix', types:['Rock','Ground'], hp:35, attack:45, defense:160, speed:70},
  ivysaur:{name:'Ivysaur', types:['Grass','Poison'], hp:60, attack:62, defense:63, speed:60},
  venusaur:{name:'Venusaur', types:['Grass','Poison'], hp:80, attack:82, defense:83, speed:80},
  charmeleon:{name:'Charmeleon', types:['Fire'], hp:58, attack:64, defense:58, speed:80},
  charizard:{name:'Charizard', types:['Fire','Flying'], hp:78, attack:84, defense:78, speed:100},
  wartortle:{name:'Wartortle', types:['Water'], hp:59, attack:63, defense:80, speed:58},
  blastoise:{name:'Blastoise', types:['Water'], hp:79, attack:83, defense:100, speed:78},
  kakuna:{name:'Kakuna', types:['Bug','Poison'], hp:45, attack:25, defense:50, speed:35},
  beedrill:{name:'Beedrill', types:['Bug','Poison'], hp:65, attack:80, defense:40, speed:75},
  metapod:{name:'Metapod', types:['Bug'], hp:50, attack:20, defense:55, speed:30},
  butterfree:{name:'Butterfree', types:['Bug','Flying'], hp:60, attack:45, defense:50, speed:70},
  raticate:{name:'Raticate', types:['Normal'], hp:55, attack:81, defense:60, speed:97},
  pidgeotto:{name:'Pidgeotto', types:['Normal','Flying'], hp:63, attack:60, defense:55, speed:71},
  pidgeot:{name:'Pidgeot', types:['Normal','Flying'], hp:83, attack:80, defense:75, speed:91},
  primeape:{name:'Primeape', types:['Fighting'], hp:65, attack:105, defense:60, speed:95},
  fearow:{name:'Fearow', types:['Normal','Flying'], hp:65, attack:90, defense:65, speed:100},
  nidorino:{name:'Nidorino', types:['Poison'], hp:61, attack:72, defense:57, speed:65},
  gloom:{name:'Gloom', types:['Grass','Poison'], hp:60, attack:65, defense:70, speed:50},
  sandshrew:{name:'Sandshrew', types:['Ground'], hp:50, attack:75, defense:85, speed:40},
  sandslash:{name:'Sandslash', types:['Ground'], hp:75, attack:100, defense:110, speed:65},
  clefairy:{name:'Clefairy', types:['Normal'], hp:70, attack:45, defense:48, speed:35},
  jigglypuff:{name:'Jigglypuff', types:['Normal'], hp:115, attack:45, defense:20, speed:20},
  zubat:{name:'Zubat', types:['Poison','Flying'], hp:40, attack:45, defense:35, speed:55},
  golbat:{name:'Golbat', types:['Poison','Flying'], hp:75, attack:80, defense:70, speed:90},
  paras:{name:'Paras', types:['Bug','Grass'], hp:35, attack:70, defense:55, speed:25},
  parasect:{name:'Parasect', types:['Bug','Grass'], hp:60, attack:95, defense:80, speed:30},
  meowth:{name:'Meowth', types:['Normal'], hp:40, attack:45, defense:35, speed:90},
  persian:{name:'Persian', types:['Normal'], hp:65, attack:70, defense:60, speed:115},
  bellsprout:{name:'Bellsprout', types:['Grass','Poison'], hp:50, attack:75, defense:35, speed:40},
  weepinbell:{name:'Weepinbell', types:['Grass','Poison'], hp:65, attack:90, defense:50, speed:55},
  abra:{name:'Abra', types:['Psychic'], hp:25, attack:20, defense:15, speed:105},
  kadabra:{name:'Kadabra', types:['Psychic'], hp:40, attack:35, defense:30, speed:105},
  staryu:{name:'Staryu', types:['Water'], hp:30, attack:45, defense:55, speed:85},
  starmie:{name:'Starmie', types:['Water','Psychic'], hp:60, attack:75, defense:85, speed:115},
  growlithe:{name:'Growlithe', types:['Fire'], hp:55, attack:70, defense:45, speed:60},
  vulpix:{name:'Vulpix', types:['Fire'], hp:38, attack:41, defense:40, speed:65},
  ekans:{name:'Ekans', types:['Poison'], hp:35, attack:60, defense:44, speed:55},
  arbok:{name:'Arbok', types:['Poison'], hp:60, attack:85, defense:69, speed:80},
  diglett:{name:'Diglett', types:['Ground'], hp:10, attack:55, defense:25, speed:95},
  dugtrio:{name:'Dugtrio', types:['Ground'], hp:35, attack:80, defense:50, speed:120},
  magnemite:{name:'Magnemite', types:['Electric'], hp:25, attack:35, defense:70, speed:45},
  magneton:{name:'Magneton', types:['Electric'], hp:50, attack:60, defense:95, speed:70},
  drowzee:{name:'Drowzee', types:['Psychic'], hp:60, attack:48, defense:45, speed:42},
  hypno:{name:'Hypno', types:['Psychic'], hp:85, attack:73, defense:70, speed:67},
  nidoranf:{name:'Nidoran (F)', types:['Poison'], hp:55, attack:47, defense:52, speed:41},
  nidorina:{name:'Nidorina', types:['Poison'], hp:70, attack:62, defense:67, speed:56},
  venonat:{name:'Venonat', types:['Bug','Poison'], hp:60, attack:55, defense:50, speed:45},
  venomoth:{name:'Venomoth', types:['Bug','Poison'], hp:70, attack:65, defense:60, speed:90},
  voltorb:{name:'Voltorb', types:['Electric'], hp:40, attack:30, defense:50, speed:100},
  pikachu:{name:'Pikachu', types:['Electric'], hp:35, attack:55, defense:30, speed:90},
  raichu:{name:'Raichu', types:['Electric'], hp:60, attack:90, defense:55, speed:100},
  poliwag:{name:'Poliwag', types:['Water'], hp:40, attack:50, defense:40, speed:90},
  poliwhirl:{name:'Poliwhirl', types:['Water'], hp:65, attack:65, defense:65, speed:90},
  tentacool:{name:'Tentacool', types:['Water','Poison'], hp:40, attack:40, defense:35, speed:70},
  tentacruel:{name:'Tentacruel', types:['Water','Poison'], hp:80, attack:70, defense:65, speed:100},
  machop:{name:'Machop', types:['Fighting'], hp:70, attack:80, defense:50, speed:35},
  machoke:{name:'Machoke', types:['Fighting'], hp:80, attack:100, defense:70, speed:45},
  doduo:{name:'Doduo', types:['Normal','Flying'], hp:35, attack:85, defense:45, speed:75},
  dodrio:{name:'Dodrio', types:['Normal','Flying'], hp:60, attack:110, defense:70, speed:100},
  ponyta:{name:'Ponyta', types:['Fire'], hp:50, attack:85, defense:55, speed:90},
  rapidash:{name:'Rapidash', types:['Fire'], hp:65, attack:100, defense:70, speed:105},
  slowpoke:{name:'Slowpoke', types:['Water','Psychic'], hp:90, attack:65, defense:65, speed:15},
  slowbro:{name:'Slowbro', types:['Water','Psychic'], hp:95, attack:75, defense:110, speed:30},
  magikarp:{name:'Magikarp', types:['Water'], hp:20, attack:10, defense:55, speed:80},
  gyarados:{name:'Gyarados', types:['Water','Flying'], hp:95, attack:125, defense:79, speed:81},
  grimer:{name:'Grimer', types:['Poison'], hp:80, attack:80, defense:50, speed:25},
  muk:{name:'Muk', types:['Poison'], hp:105, attack:105, defense:75, speed:50},
  tauros:{name:'Tauros', types:['Normal'], hp:75, attack:100, defense:95, speed:110},
  psyduck:{name:'Psyduck', types:['Water'], hp:50, attack:52, defense:48, speed:55},
  golduck:{name:'Golduck', types:['Water'], hp:80, attack:82, defense:78, speed:85},
  krabby:{name:'Krabby', types:['Water'], hp:30, attack:105, defense:90, speed:50},
  kingler:{name:'Kingler', types:['Water'], hp:55, attack:130, defense:115, speed:75},
  horsea:{name:'Horsea', types:['Water'], hp:30, attack:40, defense:70, speed:60},
  seadra:{name:'Seadra', types:['Water'], hp:55, attack:65, defense:95, speed:85},
  goldeen:{name:'Goldeen', types:['Water'], hp:45, attack:67, defense:60, speed:63},
  seaking:{name:'Seaking', types:['Water'], hp:80, attack:92, defense:65, speed:68},
  shellder:{name:'Shellder', types:['Water'], hp:30, attack:65, defense:100, speed:40},
  exeggcute:{name:'Exeggcute', types:['Grass','Psychic'], hp:60, attack:40, defense:80, speed:40},
  cubone:{name:'Cubone', types:['Ground'], hp:50, attack:50, defense:95, speed:35},
  marowak:{name:'Marowak', types:['Ground'], hp:60, attack:80, defense:110, speed:45},
  victreebel:{name:'Victreebel', types:['Grass','Poison'], hp:80, attack:105, defense:65, speed:70},
  tangela:{name:'Tangela', types:['Grass'], hp:65, attack:55, defense:115, speed:40},
  vileplume:{name:'Vileplume', types:['Grass','Poison'], hp:75, attack:80, defense:85, speed:50},
  koffing:{name:'Koffing', types:['Poison'], hp:40, attack:65, defense:95, speed:35},
  weezing:{name:'Weezing', types:['Poison'], hp:65, attack:90, defense:120, speed:60},
  gastly:{name:'Gastly', types:['Ghost','Poison'], hp:30, attack:35, defense:30, speed:80},
  haunter:{name:'Haunter', types:['Ghost','Poison'], hp:45, attack:50, defense:45, speed:95},
  ditto:{name:'Ditto', types:['Normal'], hp:48, attack:48, defense:48, speed:48},
  lickitung:{name:'Lickitung', types:['Normal'], hp:90, attack:55, defense:75, speed:30},
  rhyhorn:{name:'Rhyhorn', types:['Ground','Rock'], hp:80, attack:85, defense:95, speed:25},
  rhydon:{name:'Rhydon', types:['Ground','Rock'], hp:105, attack:130, defense:120, speed:40},
  seel:{name:'Seel', types:['Water'], hp:65, attack:45, defense:55, speed:45},
  dewgong:{name:'Dewgong', types:['Water','Ice'], hp:90, attack:70, defense:80, speed:70},
  farfetchd:{name:"Farfetch'd", types:['Normal','Flying'], hp:52, attack:65, defense:55, speed:60},
  kangaskhan:{name:'Kangaskhan', types:['Normal'], hp:105, attack:95, defense:80, speed:90},
  scyther:{name:'Scyther', types:['Bug','Flying'], hp:70, attack:110, defense:80, speed:105},
  omanyte:{name:'Omanyte', types:['Rock','Water'], hp:35, attack:40, defense:100, speed:35},
  omastar:{name:'Omastar', types:['Rock','Water'], hp:70, attack:60, defense:125, speed:55},
  kabuto:{name:'Kabuto', types:['Rock','Water'], hp:30, attack:80, defense:90, speed:55},
  kabutops:{name:'Kabutops', types:['Rock','Water'], hp:60, attack:115, defense:105, speed:80},
  electrode:{name:'Electrode', types:['Electric'], hp:60, attack:50, defense:70, speed:140},
  magmar:{name:'Magmar', types:['Fire'], hp:65, attack:95, defense:57, speed:93},
  lapras:{name:'Lapras', types:['Water','Ice'], hp:130, attack:85, defense:80, speed:60},
  porygon:{name:'Porygon', types:['Normal'], hp:65, attack:60, defense:70, speed:40},
  eevee:{name:'Eevee', types:['Normal'], hp:55, attack:55, defense:50, speed:55},
  snorlax:{name:'Snorlax', types:['Normal'], hp:160, attack:110, defense:65, speed:30},
  chansey:{name:'Chansey', types:['Normal'], hp:250, attack:5, defense:5, speed:50},
  hitmonlee:{name:'Hitmonlee', types:['Fighting'], hp:50, attack:120, defense:53, speed:87},
  hitmonchan:{name:'Hitmonchan', types:['Fighting'], hp:50, attack:105, defense:79, speed:76},
  pinsir:{name:'Pinsir', types:['Bug'], hp:65, attack:125, defense:100, speed:85},
  electabuzz:{name:'Electabuzz', types:['Electric'], hp:65, attack:83, defense:57, speed:105},
  aerodactyl:{name:'Aerodactyl', types:['Rock','Flying'], hp:80, attack:105, defense:65, speed:130},
  alakazam:{name:'Alakazam', types:['Psychic'], hp:55, attack:50, defense:45, speed:120},
  mrmime:{name:'Mr. Mime', types:['Psychic'], hp:40, attack:45, defense:65, speed:90},
  arcanine:{name:'Arcanine', types:['Fire'], hp:90, attack:110, defense:80, speed:95},
  nidoqueen:{name:'Nidoqueen', types:['Poison','Ground'], hp:90, attack:82, defense:87, speed:76},
  nidoking:{name:'Nidoking', types:['Poison','Ground'], hp:81, attack:92, defense:77, speed:85},
  graveler:{name:'Graveler', types:['Rock','Ground'], hp:55, attack:95, defense:115, speed:35},
  dratini:{name:'Dratini', types:['Dragon'], hp:41, attack:64, defense:45, speed:50},
  dragonair:{name:'Dragonair', types:['Dragon'], hp:61, attack:84, defense:65, speed:70},
  dragonite:{name:'Dragonite', types:['Dragon','Flying'], hp:91, attack:134, defense:95, speed:80},
  jynx:{name:'Jynx', types:['Ice','Psychic'], hp:65, attack:50, defense:35, speed:95},
  exeggutor:{name:'Exeggutor', types:['Grass','Psychic'], hp:95, attack:95, defense:85, speed:55},
  clefable:{name:'Clefable', types:['Normal'], hp:95, attack:70, defense:73, speed:60},
  wigglytuff:{name:'Wigglytuff', types:['Normal'], hp:140, attack:70, defense:45, speed:45},
  ninetales:{name:'Ninetales', types:['Fire'], hp:73, attack:76, defense:75, speed:100},
  poliwrath:{name:'Poliwrath', types:['Water','Fighting'], hp:90, attack:85, defense:95, speed:70},
  cloyster:{name:'Cloyster', types:['Water','Ice'], hp:50, attack:95, defense:180, speed:70},
  machamp:{name:'Machamp', types:['Fighting'], hp:90, attack:130, defense:80, speed:55},
  golem:{name:'Golem', types:['Rock','Ground'], hp:80, attack:110, defense:130, speed:45},
  gengar:{name:'Gengar', types:['Ghost','Poison'], hp:60, attack:65, defense:60, speed:110},
  moltres:{name:'Moltres', types:['Fire','Flying'], hp:90, attack:100, defense:90, speed:90},
  zapdos:{name:'Zapdos', types:['Electric','Flying'], hp:90, attack:90, defense:85, speed:100},
  articuno:{name:'Articuno', types:['Ice','Flying'], hp:90, attack:85, defense:100, speed:85},
  vaporeon:{name:'Vaporeon', types:['Water'], hp:130, attack:65, defense:60, speed:65},
  jolteon:{name:'Jolteon', types:['Electric'], hp:65, attack:65, defense:60, speed:130},
  flareon:{name:'Flareon', types:['Fire'], hp:65, attack:130, defense:60, speed:65},
  mewtwo:{name:'Mewtwo', types:['Psychic'], hp:106, attack:110, defense:90, speed:130}
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
  return { speciesId, name:sp.name, types:sp.types, baseHp:sp.hp, attack:sp.attack, defense:sp.defense, speed:sp.speed, level, maxHp:0, hp:0, dmgBonus:1 };
}
function calcMaxHp(p){ return Math.round(30 + p.level*5 + p.baseHp); }
// ⚠️ ESTE TRECHO É UMA CÓPIA DO MOTOR DE public/index.html.
// Qualquer ajuste de balanceamento tem que ir NOS DOIS LUGARES, senão cliente e servidor
// simulam a mesma batalha e chegam a resultados diferentes.
const DUAL_TYPE_BEST_CHANCE = 0.70;
function multiplierForType(atkType, defTypes){
  let m = 1;
  defTypes.forEach(d=> m *= typeVsType(atkType, d));
  return m;
}
function rolledMultiplier(atkTypes, defTypes, rng){
  if(atkTypes.length < 2) return multiplierForType(atkTypes[0], defTypes);
  const mults = atkTypes.map(t=>multiplierForType(t, defTypes));
  const bestIdx = mults[0] >= mults[1] ? 0 : 1;
  const otherIdx = 1 - bestIdx;
  return (rng() < DUAL_TYPE_BEST_CHANCE) ? mults[bestIdx] : mults[otherIdx];
}
function badgeDamageBonus(badgeCount){ return Math.min(8, badgeCount||0) * 0.01; }
function diversityDamageBonus(team){
  const types = new Set();
  team.forEach(p=> (p.types||[]).forEach(t=>types.add(t)));
  return Math.min(6, types.size) * 0.02;
}
function applyTeamBonuses(team, badgeCount){
  const bonus = 1 + badgeDamageBonus(badgeCount) + diversityDamageBonus(team);
  team.forEach(p=>{ p.dmgBonus = bonus; });
  return bonus;
}
function firstStrikeChance(a, b){
  const sa = a.speed || 50, sb = b.speed || 50;
  return 0.5 + 0.5 * ((sa - sb) / (sa + sb));
}
function calcDamage(attacker, defender, rng){
  const mult = rolledMultiplier(attacker.types, defender.types, rng);
  const base = (attacker.level*2.5 + attacker.attack/6) * (attacker.dmgBonus || 1);
  let defense = Math.pow(defender.defense/70, 0.7);
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
  const activeFirst = rng() < firstStrikeChance(active, enemy);
  const first = activeFirst ? active : enemy;
  const second = activeFirst ? enemy : active;
  const dmgFromFirst = calcDamage(first, second, rng);
  second.hp = Math.max(0, second.hp - dmgFromFirst);
  if(second.hp <= 0){ return; }
  const dmgFromSecond = calcDamage(second, first, rng);
  first.hp = Math.max(0, first.hp - dmgFromSecond);
}
function simulateGymBattle(team, enemyTeam, rng){
  team.forEach(p=>{ p.maxHp=calcMaxHp(p); p.hp=p.maxHp; p.winsThisBattle=0; if(p.dmgBonus==null) p.dmgBonus=1; });
  enemyTeam.forEach(p=>{ p.maxHp=calcMaxHp(p); p.hp=p.maxHp; p.winsThisBattle=0; if(p.dmgBonus==null) p.dmgBonus=1; });

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
/* ===================================================================
   VALIDAÇÃO DE INTEGRIDADE DO TIME (doc 02 §4.5 e doc 04)

   Isto NÃO é um limite novo de jogo: é a régua que separa um time possível de
   um time forjado no console do navegador. Antes daqui, a função aceitava
   qualquer nível até 200 -- ou seja, 6 Mewtwo Lv.200 passavam batido.

   O teto honesto sai da própria economia: o jogo já não deixa distribuir pontos
   acima do nível 55, o doce raro e a creche também param em 55, e o bônus de
   desmaio (que só existe em vitória) também. Logo, o máximo alcançável por
   jogador legítimo é 55 por pokémon. Os valores abaixo têm folga de propósito,
   pra não punir saves antigos criados antes do teto de desmaio existir.
   =================================================================== */
const MAX_LEVEL_PER_MON = 60;      // teto honesto é 55; 60 é a folga pra saves antigos
const MAX_TEAM_LEVEL_SUM = 6 * 60; // 360 -- um time de 6 no teto absoluto
const MAX_TEAM_SIZE = 6;
function validateTeamForLeague(team){
  if(!team || team.length === 0) return { ok:false, reason:'time vazio' };
  if(team.length > MAX_TEAM_SIZE) return { ok:false, reason:`time com ${team.length} pokémons` };
  const overLevel = team.find(p=>p.level > MAX_LEVEL_PER_MON);
  if(overLevel) return { ok:false, reason:`${overLevel.name} no nível ${overLevel.level} (máximo alcançável: ${MAX_LEVEL_PER_MON})` };
  const sum = team.reduce((a,p)=>a+p.level, 0);
  if(sum > MAX_TEAM_LEVEL_SUM) return { ok:false, reason:`soma de níveis ${sum} acima do teto teórico ${MAX_TEAM_LEVEL_SUM}` };
  return { ok:true, levelSum:sum };
}
function teamLevelSum(code){
  const team = decodeTeamCode(code);
  return team ? team.reduce((a,p)=>a+p.level, 0) : 0;
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
    if(!SPECIES[id] || !Number.isFinite(lvl) || lvl<1 || lvl>MAX_LEVEL_PER_MON) return null;
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
function resolveLeagueMatch(match, seedStr){
  const rng = makeSeededRng(seedStr);
  const rawA = decodeTeamCode(match.a.code);
  const rawB = decodeTeamCode(match.b.code);
  const okA = rawA && validateTeamForLeague(rawA).ok;
  const okB = rawB && validateTeamForLeague(rawB).ok;
  // time inválido (forjado ou corrompido) perde por W.O. -- nunca decide a partida por sorte
  if(!okA || !okB){
    if(!okA && !okB){ logger.warn('Ambos os times inválidos em', seedStr); }
    match.winner = okA ? match.a : match.b;
    match.resolved = true;
    match.matchups = [];
    match.invalidTeam = !okA ? (match.a && match.a.name) : (match.b && match.b.name);
    return;
  }
  const teamA = rawA, teamB = rawB;
  // todo mundo na Liga tem as 8 insígnias, então o bônus de insígnia é igual pros dois --
  // o que realmente diferencia é a diversidade de tipos do time (doc 02 §4.5)
  applyTeamBonuses(teamA, 8);
  applyTeamBonuses(teamB, 8);
  const result = simulateGymBattle(teamA, teamB, rng);
  // diferente dos ginásios, os níveis ficam CONGELADOS na Liga -- depois da 8ª insígnia, o time do
  // treinador não sobe mais de nível, então nem precisa re-codificar/sincronizar nada aqui
  match.matchups = result.matchups; // mantém o log completo, pro botão "Assistir batalha" funcionar mesmo quando quem resolve é a Cloud Function
  match.winner = result.win ? match.a : match.b;
  match.resolved = true;
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
/* ===================================================================
   CHAVEAMENTO POR FORÇA + FANTASMAS DO RIVAL (doc 02 §4.5 e §2.5)

   Antes: sorteio puro. Um novato recém-classificado podia cair contra um time
   de 6 Dragonite na primeira rodada, e quem sobrava do múltiplo de 8/16
   simplesmente esperava o ciclo seguinte.

   Agora: os inscritos são ordenados por força (soma de níveis + BST/10) e
   fatiados em divisões — cada Liga junta gente de força parecida. Dentro da
   Liga o sorteio continua aleatório e determinístico pela seed.
   E as sobras deixam de esperar: o "fantasma" do rival de cada jogador (time
   montado com os Pokémons que ele recusou na jornada) entra como bot para
   fechar o chaveamento.
   =================================================================== */
function teamStrength(code){
  const team = decodeTeamCode(code);
  if(!team) return 0;
  return team.reduce((acc,p)=>{
    const sp = SPECIES[p.speciesId];
    const bst = sp ? (sp.hp + sp.attack + sp.defense + sp.speed) : 300;
    return acc + p.level + bst/10;
  }, 0);
}
function makeRivalGhost(registrant, index){
  // usa o rival real do jogador quando o cliente enviou; senão devolve null e a vaga fica vazia
  if(!registrant || !registrant.rivalCode) return null;
  const team = decodeTeamCode(registrant.rivalCode);
  if(!team || !validateTeamForLeague(team).ok) return null;
  const baseName = (registrant.rivalName || 'Rival').trim() || 'Rival';
  return {
    name: `👻 ${baseName} (fantasma de ${registrant.name})`.slice(0, 90),
    code: registrant.rivalCode,
    uid: null,
    slot: null,
    isBot: true,
    ghostOf: registrant.name
  };
}
// completa o grupo até `size` com fantasmas dos próprios jogadores que sobraram
function fillWithGhosts(players, size){
  const filled = players.slice();
  let i = 0;
  while(filled.length < size && i < players.length * 4){
    const ghost = makeRivalGhost(players[i % players.length], i);
    i++;
    if(ghost && !filled.some(p=>p.name===ghost.name)) filled.push(ghost);
  }
  return filled.length === size ? filled : null;
}
const MIN_REAL_PLAYERS_FOR_GHOST_LEAGUE = 3;

async function drawCycle(cycleEntry){
  const claimed = await claimCycleForProcessing(cycleEntry.id, 'registering', 'drawing');
  if(!claimed) return false;
  try{
    const regSnap = await registrantsCollRef(cycleEntry.id).get();
    const registrants = regSnap.docs.map(d=>d.data());
    // rejeita na porta quem chegou com time impossível (doc 04: validação por teto teórico)
    const valid = [], rejected = [];
    for(const r of registrants){
      const team = decodeTeamCode(r.code);
      const check = team ? validateTeamForLeague(team) : { ok:false, reason:'código de time ilegível' };
      if(check.ok){ valid.push({ ...r, levelSum: check.levelSum }); }
      else { rejected.push({ name:r.name, reason:check.reason }); }
    }
    if(rejected.length){
      logger.warn('Inscrições recusadas por time inválido:', JSON.stringify(rejected));
    }
    // divisões por força: os mais fortes se enfrentam entre si, novatos entre novatos
    const byStrength = valid.slice().sort((a,b)=>teamStrength(b.code) - teamStrength(a.code));
    const leagues = [];
    let cursor = 0;
    const grandeCount = Math.floor(byStrength.length / GRANDE_LIGA_SIZE);
    for(let i=0;i<grandeCount;i++){
      const band = byStrength.slice(cursor, cursor+GRANDE_LIGA_SIZE);
      leagues.push({ id: leagues.length, size: GRANDE_LIGA_SIZE, division:'Grande Liga', rounds: buildRounds(shuffleWithSeed(band, `draw-${cycleEntry.scheduledTime}-G${i}`)), champion:null });
      cursor += GRANDE_LIGA_SIZE;
    }
    const remaining = byStrength.length - cursor;
    const regularCount = Math.floor(remaining / REGULAR_LIGA_SIZE);
    for(let i=0;i<regularCount;i++){
      const band = byStrength.slice(cursor, cursor+REGULAR_LIGA_SIZE);
      leagues.push({ id: leagues.length, size: REGULAR_LIGA_SIZE, division:'Liga', rounds: buildRounds(shuffleWithSeed(band, `draw-${cycleEntry.scheduledTime}-R${i}`)), champion:null });
      cursor += REGULAR_LIGA_SIZE;
    }
    let leftover = byStrength.slice(cursor);
    // as sobras não esperam mais o próximo ciclo: os fantasmas dos rivais fecham o chaveamento
    if(leftover.length >= MIN_REAL_PLAYERS_FOR_GHOST_LEAGUE){
      const filled = fillWithGhosts(leftover, REGULAR_LIGA_SIZE);
      if(filled){
        leagues.push({ id: leagues.length, size: REGULAR_LIGA_SIZE, division:'Liga (com fantasmas)', withGhosts:true,
          rounds: buildRounds(shuffleWithSeed(filled, `draw-${cycleEntry.scheduledTime}-Gh`)), champion:null });
        leftover = [];
      }
    }
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
  let pendingChampions = [], pendingPlacements = [], changed = false;
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
            resolveLeagueMatch(match, `${cycleEntry.scheduledTime}-L${league.id}-R${ri}-M${mi}`);
            changed = true;
            if(ri+1 < roundKeys.length){
              const nextRound = league.rounds[roundKeys[ri+1]];
              const nextMatch = nextRound[Math.floor(mi/2)];
              if(mi%2===0){ nextMatch.a = match.winner; } else { nextMatch.b = match.winner; }
            } else {
              league.champion = match.winner;
              // um fantasma do rival pode até vencer a Liga (e é engraçado), mas não entra
              // no ranking global de campeões nem na conta de ninguém
              if(!match.winner.isBot){
                pendingChampions.push({ name: match.winner.name, uid: match.winner.uid, slot: match.winner.slot });
              }
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
