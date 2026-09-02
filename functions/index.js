const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
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
  gloom:{name:'Gloom', types:['Grass','Poison'], hp:60, attack:65, defense:70, speed:40},
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
  abra:{name:'Abra', types:['Psychic'], hp:25, attack:20, defense:15, speed:90},
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
  // Água/Psíquico pra bater com o pokemon-ginasio.html. ATENÇÃO: no jogo original Psyduck e Golduck
  // são Água PURO -- o tipo Psíquico aqui é uma divergência antiga do cliente. Alinhado ao cliente
  // porque é o que os jogadores conhecem; se um dia for corrigido, tem que ser nos DOIS arquivos
  psyduck:{name:'Psyduck', types:['Water','Psychic'], hp:50, attack:52, defense:48, speed:55},
  golduck:{name:'Golduck', types:['Water','Psychic'], hp:80, attack:82, defense:78, speed:85},
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
  tangela:{name:'Tangela', types:['Grass'], hp:65, attack:55, defense:115, speed:60},
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
  mewtwo:{name:'Mewtwo', types:['Psychic'], hp:106, attack:110, defense:90, speed:130},

  /* ---- JOHTO (#152-251) ----------------------------------------------------------------
     Entraram na tabela em uso em 30/08/2026, quando a jornada passou a poder seguir por Johto.
     Ate ali viviam numa tabela paralela (SPECIES_JOHTO), justamente pra NAO contar pro total da
     Pokedex nem pro pool da Torre antes da hora. Agora contam: a Pokedex vai a 250 (o #151, Mew,
     continua de fora -- e o chefe da raide, ninguem captura). */
  chikorita:{name:'Chikorita', types:['Grass'], hp:45, attack:49, defense:65, speed:45},
  bayleef:{name:'Bayleef', types:['Grass'], hp:60, attack:62, defense:80, speed:60},
  meganium:{name:'Meganium', types:['Grass'], hp:80, attack:82, defense:100, speed:80},
  cyndaquil:{name:'Cyndaquil', types:['Fire'], hp:39, attack:52, defense:43, speed:65},
  quilava:{name:'Quilava', types:['Fire'], hp:58, attack:64, defense:58, speed:80},
  typhlosion:{name:'Typhlosion', types:['Fire'], hp:78, attack:84, defense:78, speed:100},
  totodile:{name:'Totodile', types:['Water'], hp:50, attack:65, defense:64, speed:43},
  croconaw:{name:'Croconaw', types:['Water'], hp:65, attack:80, defense:80, speed:58},
  feraligatr:{name:'Feraligatr', types:['Water'], hp:85, attack:105, defense:100, speed:78},
  sentret:{name:'Sentret', types:['Normal'], hp:35, attack:46, defense:34, speed:20},
  furret:{name:'Furret', types:['Normal'], hp:85, attack:76, defense:64, speed:90},
  hoothoot:{name:'Hoothoot', types:['Normal','Flying'], hp:60, attack:30, defense:30, speed:50},
  noctowl:{name:'Noctowl', types:['Normal','Flying'], hp:100, attack:50, defense:50, speed:70},
  ledyba:{name:'Ledyba', types:['Bug','Flying'], hp:40, attack:20, defense:30, speed:55},
  ledian:{name:'Ledian', types:['Bug','Flying'], hp:55, attack:35, defense:50, speed:85},
  spinarak:{name:'Spinarak', types:['Bug','Poison'], hp:40, attack:60, defense:40, speed:30},
  ariados:{name:'Ariados', types:['Bug','Poison'], hp:70, attack:90, defense:70, speed:40},
  crobat:{name:'Crobat', types:['Poison','Flying'], hp:85, attack:90, defense:80, speed:130},
  chinchou:{name:'Chinchou', types:['Water','Electric'], hp:75, attack:38, defense:38, speed:67},
  lanturn:{name:'Lanturn', types:['Water','Electric'], hp:125, attack:58, defense:58, speed:67},
  pichu:{name:'Pichu', types:['Electric'], hp:20, attack:40, defense:15, speed:60},
  cleffa:{name:'Cleffa', types:['Normal'], hp:50, attack:25, defense:28, speed:15},
  igglybuff:{name:'Igglybuff', types:['Normal'], hp:90, attack:30, defense:15, speed:15},
  togepi:{name:'Togepi', types:['Normal'], hp:35, attack:20, defense:65, speed:20},
  togetic:{name:'Togetic', types:['Normal','Flying'], hp:55, attack:40, defense:85, speed:40},
  natu:{name:'Natu', types:['Psychic','Flying'], hp:40, attack:50, defense:45, speed:70},
  xatu:{name:'Xatu', types:['Psychic','Flying'], hp:65, attack:75, defense:70, speed:95},
  mareep:{name:'Mareep', types:['Electric'], hp:55, attack:40, defense:40, speed:35},
  flaaffy:{name:'Flaaffy', types:['Electric'], hp:70, attack:55, defense:55, speed:45},
  ampharos:{name:'Ampharos', types:['Electric'], hp:90, attack:75, defense:75, speed:55},
  bellossom:{name:'Bellossom', types:['Grass'], hp:75, attack:80, defense:85, speed:50},
  marill:{name:'Marill', types:['Water'], hp:70, attack:20, defense:50, speed:40},
  azumarill:{name:'Azumarill', types:['Water'], hp:100, attack:50, defense:80, speed:50},
  sudowoodo:{name:'Sudowoodo', types:['Rock'], hp:70, attack:100, defense:115, speed:30},
  politoed:{name:'Politoed', types:['Water'], hp:90, attack:75, defense:75, speed:70},
  hoppip:{name:'Hoppip', types:['Grass','Flying'], hp:35, attack:35, defense:40, speed:50},
  skiploom:{name:'Skiploom', types:['Grass','Flying'], hp:55, attack:45, defense:50, speed:80},
  jumpluff:{name:'Jumpluff', types:['Grass','Flying'], hp:75, attack:55, defense:70, speed:110},
  aipom:{name:'Aipom', types:['Normal'], hp:55, attack:70, defense:55, speed:85},
  sunkern:{name:'Sunkern', types:['Grass'], hp:30, attack:30, defense:30, speed:30},
  sunflora:{name:'Sunflora', types:['Grass'], hp:75, attack:75, defense:55, speed:30},
  yanma:{name:'Yanma', types:['Bug','Flying'], hp:65, attack:65, defense:45, speed:95},
  wooper:{name:'Wooper', types:['Water','Ground'], hp:55, attack:45, defense:45, speed:15},
  quagsire:{name:'Quagsire', types:['Water','Ground'], hp:95, attack:85, defense:85, speed:35},
  espeon:{name:'Espeon', types:['Psychic'], hp:65, attack:65, defense:60, speed:110},
  umbreon:{name:'Umbreon', types:['Dark'], hp:95, attack:65, defense:110, speed:65},
  murkrow:{name:'Murkrow', types:['Dark','Flying'], hp:60, attack:85, defense:42, speed:91},
  slowking:{name:'Slowking', types:['Water','Psychic'], hp:95, attack:75, defense:80, speed:30},
  misdreavus:{name:'Misdreavus', types:['Ghost'], hp:60, attack:60, defense:60, speed:85},
  unown:{name:'Unown', types:['Psychic'], hp:48, attack:72, defense:48, speed:48},
  wobbuffet:{name:'Wobbuffet', types:['Psychic'], hp:190, attack:33, defense:58, speed:33},
  girafarig:{name:'Girafarig', types:['Normal','Psychic'], hp:70, attack:80, defense:65, speed:85},
  pineco:{name:'Pineco', types:['Bug'], hp:50, attack:65, defense:90, speed:15},
  forretress:{name:'Forretress', types:['Bug','Steel'], hp:75, attack:90, defense:140, speed:40},
  dunsparce:{name:'Dunsparce', types:['Normal'], hp:100, attack:70, defense:70, speed:45},
  gligar:{name:'Gligar', types:['Ground','Flying'], hp:65, attack:75, defense:105, speed:85},
  steelix:{name:'Steelix', types:['Steel','Ground'], hp:75, attack:85, defense:200, speed:30},
  snubbull:{name:'Snubbull', types:['Normal'], hp:60, attack:80, defense:50, speed:30},
  granbull:{name:'Granbull', types:['Normal'], hp:90, attack:120, defense:75, speed:45},
  qwilfish:{name:'Qwilfish', types:['Water','Poison'], hp:65, attack:95, defense:75, speed:85},
  scizor:{name:'Scizor', types:['Bug','Steel'], hp:70, attack:130, defense:100, speed:65},
  shuckle:{name:'Shuckle', types:['Bug','Rock'], hp:20, attack:10, defense:230, speed:5},
  heracross:{name:'Heracross', types:['Bug','Fighting'], hp:80, attack:125, defense:75, speed:85},
  sneasel:{name:'Sneasel', types:['Dark','Ice'], hp:55, attack:95, defense:55, speed:115},
  teddiursa:{name:'Teddiursa', types:['Normal'], hp:60, attack:80, defense:50, speed:40},
  ursaring:{name:'Ursaring', types:['Normal'], hp:90, attack:130, defense:75, speed:55},
  slugma:{name:'Slugma', types:['Fire'], hp:40, attack:40, defense:40, speed:20},
  magcargo:{name:'Magcargo', types:['Fire','Rock'], hp:50, attack:50, defense:120, speed:30},
  swinub:{name:'Swinub', types:['Ice','Ground'], hp:50, attack:50, defense:40, speed:50},
  piloswine:{name:'Piloswine', types:['Ice','Ground'], hp:100, attack:100, defense:80, speed:50},
  corsola:{name:'Corsola', types:['Water','Rock'], hp:55, attack:55, defense:85, speed:35},
  remoraid:{name:'Remoraid', types:['Water'], hp:35, attack:65, defense:35, speed:65},
  octillery:{name:'Octillery', types:['Water'], hp:75, attack:105, defense:75, speed:45},
  delibird:{name:'Delibird', types:['Ice','Flying'], hp:45, attack:55, defense:45, speed:75},
  mantine:{name:'Mantine', types:['Water','Flying'], hp:65, attack:40, defense:70, speed:70},
  skarmory:{name:'Skarmory', types:['Steel','Flying'], hp:65, attack:80, defense:140, speed:70},
  houndour:{name:'Houndour', types:['Dark','Fire'], hp:45, attack:60, defense:30, speed:65},
  houndoom:{name:'Houndoom', types:['Dark','Fire'], hp:75, attack:90, defense:50, speed:95},
  kingdra:{name:'Kingdra', types:['Water','Dragon'], hp:75, attack:95, defense:95, speed:85},
  phanpy:{name:'Phanpy', types:['Ground'], hp:90, attack:60, defense:60, speed:40},
  donphan:{name:'Donphan', types:['Ground'], hp:90, attack:120, defense:120, speed:50},
  porygon2:{name:'Porygon2', types:['Normal'], hp:85, attack:80, defense:90, speed:60},
  stantler:{name:'Stantler', types:['Normal'], hp:73, attack:95, defense:62, speed:85},
  smeargle:{name:'Smeargle', types:['Normal'], hp:55, attack:20, defense:35, speed:75},
  tyrogue:{name:'Tyrogue', types:['Fighting'], hp:35, attack:35, defense:35, speed:35},
  hitmontop:{name:'Hitmontop', types:['Fighting'], hp:50, attack:95, defense:95, speed:70},
  smoochum:{name:'Smoochum', types:['Ice','Psychic'], hp:45, attack:30, defense:15, speed:65},
  elekid:{name:'Elekid', types:['Electric'], hp:45, attack:63, defense:37, speed:95},
  magby:{name:'Magby', types:['Fire'], hp:45, attack:75, defense:37, speed:83},
  miltank:{name:'Miltank', types:['Normal'], hp:95, attack:80, defense:105, speed:100},
  blissey:{name:'Blissey', types:['Normal'], hp:255, attack:10, defense:10, speed:55},
  raikou:{name:'Raikou', types:['Electric'], hp:90, attack:85, defense:75, speed:115},
  entei:{name:'Entei', types:['Fire'], hp:115, attack:115, defense:85, speed:100},
  suicune:{name:'Suicune', types:['Water'], hp:100, attack:75, defense:115, speed:85},
  larvitar:{name:'Larvitar', types:['Rock','Ground'], hp:50, attack:64, defense:50, speed:41},
  pupitar:{name:'Pupitar', types:['Rock','Ground'], hp:70, attack:84, defense:70, speed:51},
  tyranitar:{name:'Tyranitar', types:['Rock','Dark'], hp:100, attack:134, defense:110, speed:61},
  lugia:{name:'Lugia', types:['Psychic','Flying'], hp:106, attack:90, defense:130, speed:110},
  hooh:{name:'Ho-Oh', types:['Fire','Flying'], hp:106, attack:130, defense:90, speed:90},
  celebi:{name:'Celebi', types:['Psychic','Grass'], hp:100, attack:100, defense:100, speed:100}
};

const TYPE_CHART = {
  // as 5 imunidades totais do Gen 1 (Normal/Lutador vs Fantasma, Fantasma vs Normal, Terra vs Voador,
  // Elétrico vs Terra) valem 0 de novo, como na Gen 1 de verdade. Elas valeram 0.25 por um tempo,
  // pra nada ser 100% imune -- ver a nota de imunidade no CLAUDE.md pro que essa volta custa.
  Normal:{Rock:0.5, Ghost:0, Steel:0.5},
  Fire:{Grass:2,Bug:2,Rock:0.5,Water:0.5,Fire:0.5,Ice:2,Dragon:0.5,Steel:2},
  Water:{Fire:2,Rock:2,Ground:2,Water:0.5,Grass:0.5,Dragon:0.5},
  Grass:{Water:2,Rock:2,Ground:2,Fire:0.5,Grass:0.5,Poison:0.5,Flying:0.5,Bug:0.5,Dragon:0.5,Steel:0.5},
  Poison:{Grass:2,Bug:2,Rock:0.5,Ground:0.5,Poison:0.5,Ghost:0.5,Steel:0},
  Flying:{Grass:2,Fighting:2,Bug:2,Rock:0.5,Electric:0.5,Steel:0.5},
  Bug:{Grass:2,Poison:2,Fighting:0.5,Flying:0.5,Fire:0.5,Psychic:2,Ghost:0.5,Dark:2,Steel:0.5},
  Fighting:{Normal:2,Rock:2,Poison:0.5,Flying:0.5,Bug:0.5,Psychic:0.5,Ghost:0,Ice:2,Dark:2,Steel:2},
  Rock:{Fire:2,Flying:2,Bug:2,Fighting:0.5,Ground:0.5,Ice:2,Steel:0.5},
  Ground:{Fire:2,Rock:2,Poison:2,Grass:0.5,Bug:0.5,Electric:2,Flying:0,Steel:2},
  Psychic:{Fighting:2,Poison:2,Psychic:0.5,Dark:0,Steel:0.5},
  Electric:{Water:2,Flying:2,Grass:0.5,Electric:0.5,Ground:0,Dragon:0.5,Steel:0.5},
  Ghost:{Ghost:2,Psychic:2,Normal:0,Dark:0.5,Steel:0.5},
  Dragon:{Dragon:2,Steel:0.5},
  Ice:{Grass:2,Ground:2,Flying:2,Dragon:2,Water:0.5,Ice:0.5,Steel:0.5},
  /* SOMBRIO e AÇO -- os dois tipos que a Gen 2 trouxe, e sem eles metade de Johto não funciona
     (Umbreon, Houndoom, Tyranitar, Scizor, Steelix, Skarmory, o ginásio da Jasmine...).
     Valores da Geração II, que diferem dos modernos em dois pontos: o Aço ainda resiste a
     Fantasma e a Sombrio (só perdeu isso na Gen 6), e o Sombrio ainda não é fraco contra Fada,
     que não existe aqui.
     Acrescentar tipo NOVO não mexe em nada do que já existia: nenhuma das 150 espécies de Kanto é
     Sombrio ou Aço (o jogo usa a tipagem da Gen 1, então Magnemite/Magneton continuam só
     Elétrico), então toda linha nova só entra em confronto que envolve um pokémon de Johto.
     Conferido: a impressão do motor não muda. */
  Dark:{Psychic:2,Ghost:2,Fighting:0.5,Dark:0.5,Steel:0.5},
  Steel:{Rock:2,Ice:2,Steel:0.5,Fire:0.5,Water:0.5,Electric:0.5}
};

/* -------------------------------------------------------------------
   TERRENOS -- sorteados por partida na Liga (espelha o cliente). O buff é só pra ESSA partida
   específica -- nunca persiste pra próxima fase (aplicado só numa cópia temporária dos pokémons).
------------------------------------------------------------------- */
const TERRAIN_BUFF_MULT = 1.15;
const TERRAINS = [
  { id:'vulcao', name:'Vulcão', icon:'🌋', types:['Fire','Ground'] },
  { id:'arena_suspensa', name:'Arena Suspensa', icon:'☁️', types:['Flying','Dragon'] },
  { id:'pantano', name:'Pântano', icon:'🐍', types:['Poison','Grass','Ghost'] },
  { id:'recifes_coral', name:'Recifes de Coral', icon:'🪸', types:['Water','Ice'] },
  { id:'caverna_cristais', name:'Caverna de Cristais', icon:'💎', types:['Rock','Psychic'] },
  { id:'usina_eletrica', name:'Usina Elétrica', icon:'⚡', types:['Electric'] },
  { id:'floresta_ancestral', name:'Floresta Ancestral', icon:'🌳', types:['Grass','Bug'] },
  { id:'deserto', name:'Deserto', icon:'🏜️', types:['Ground'] },
  { id:'montanha_nevada', name:'Montanha Nevada', icon:'🏔️', types:['Ice'] },
  { id:'dojo_tradicional', name:'Dojo Tradicional', icon:'🥋', types:['Fighting'] },
  { id:'campo_aberto', name:'Campo Aberto', icon:'🌾', types:['Normal','Dragon'] },
  { id:'mina_subterranea', name:'Mina Subterrânea', icon:'⛏️', types:['Rock','Ground'] },
  { id:'castelo_assombrado', name:'Castelo Assombrado', icon:'🏰', types:['Ghost','Poison'] },
  { id:'templo_mistico', name:'Templo Místico', icon:'🔮', types:['Psychic'] },
  { id:'jardim_venenoso', name:'Jardim Venenoso', icon:'☠️', types:['Grass','Poison'] },
  { id:'cachoeira_congelada', name:'Corredeiras Bravas', icon:'🌊', types:['Water','Fighting'] },
  { id:'pico_tempestade', name:'Pico da Tempestade', icon:'⛈️', types:['Electric','Flying'] },
  { id:'caverna_dragao', name:'Caverna do Dragão', icon:'🐉', types:['Dragon','Rock'] },
  { id:'tundra', name:'Tundra', icon:'❄️', types:['Ice','Normal'] },
  { id:'ilha_vulcanica', name:'Ilha Vulcânica', icon:'🌋', types:['Fire','Rock','Ground'] },
  { id:'navio_fantasma', name:'Navio Fantasma', icon:'👻', types:['Water','Ghost'] },
  { id:'mansao_incendiada', name:'Mansão Incendiada', icon:'🔥', types:['Ghost','Fire'] },
  { id:'arena_subterranea', name:'Arena Subterrânea', icon:'🕳️', types:['Fighting','Ground'] },
  { id:'jardim_zen', name:'Jardim Zen', icon:'🧘', types:['Psychic','Grass'] },
  { id:'colmeia_chamas', name:'Colmeia em Chamas', icon:'🐝', types:['Fire','Bug'] },
  { id:'torre_toxica', name:'Torre Tóxica', icon:'☣️', types:['Flying','Poison'] },
  { id:'cidade_iluminada', name:'Cidade Iluminada', icon:'🌆', types:['Normal','Electric'] },
  { id:'arena_campeoes', name:'Arena dos Campeões', icon:'🏆', types:['Normal','Fighting'] },
  { id:'falesias_glaciais', name:'Falésias Glaciais', icon:'🧊', types:['Ice','Flying'] },
  { id:'santuario_draconico', name:'Santuário Dracônico', icon:'🐲', types:['Dragon','Psychic'] },
  { id:'termas_vulcanicas', name:'Termas Vulcânicas', icon:'♨️', types:['Fire','Water'] },
  { id:'canion_rochoso', name:'Desfiladeiro Gelado', icon:'🏔️', types:['Rock','Ice'] },
  { id:'reserva_natural', name:'Reserva Natural', icon:'🌲', types:['Normal','Grass'] },
  { id:'porto_abandonado', name:'Manguezal', icon:'🦀', types:['Water','Bug'] },
  { id:'jardim_borboletas', name:'Jardim das Borboletas', icon:'🦋', types:['Bug','Flying'] },
  { id:'templo_monges', name:'Templo dos Monges', icon:'🙏', types:['Fighting','Psychic'] },
  { id:'pantano_radioativo', name:'Pântano Radioativo', icon:'☢️', types:['Poison','Electric'] },
  { id:'ninho_ancestral', name:'Cripta do Dragão', icon:'⚰️', types:['Dragon','Ghost'] },
  { id:'floresta_eletrificada', name:'Floresta Eletrificada', icon:'🌩️', types:['Electric','Bug'] },
  /* ---- SOMBRIO e AÇO, e o acerto de contas dos outros 15 ----------------------------------
     Os dois tipos que Johto trouxe não tinham terreno nenhum, o que significa: um Umbreon, um
     Houndoom ou um Steelix NUNCA ganhavam o bônus de terreno, em nenhuma partida. Como o buff
     vale 1,15× em TODOS os atributos (ver CLAUDE.md), isso era uma desvantagem permanente e
     invisível pra 10 espécies.
     A tabela tinha 5 terrenos por tipo, exatos. Os 12 daqui levam os DEZESSETE tipos a 6 cada --
     os seis primeiros trazem o Sombrio e de quebra dão o sexto a nove tipos antigos; os seis
     últimos fazem o mesmo pelo Aço com os seis tipos que sobraram. `tools/test-terrenos.js`
     confere a contagem, que é o que garante que ninguém foi favorecido no sorteio. */
  { id:'beco_sombrio', name:'Beco Sombrio', icon:'🌑', types:['Dark','Poison'] },
  { id:'torre_queimada', name:'Torre Queimada', icon:'🕯️', types:['Dark','Ghost','Fire'] },
  { id:'mata_fechada', name:'Mata Fechada', icon:'🌲', types:['Dark','Bug','Grass'] },
  { id:'gruta_sem_luz', name:'Gruta Sem Luz', icon:'🦇', types:['Dark','Rock'] },
  { id:'noite_lua_cheia', name:'Noite de Lua Cheia', icon:'🌕', types:['Dark','Psychic'] },
  { id:'covil_dos_lobos', name:'Covil dos Lobos', icon:'🐺', types:['Dark','Fighting','Normal'] },
  { id:'ferro_velho', name:'Ferro-Velho', icon:'⚙️', types:['Steel','Electric'] },
  { id:'fortaleza_ferro', name:'Fortaleza de Ferro', icon:'🏯', types:['Steel','Ground'] },
  { id:'submarino_afundado', name:'Submarino Afundado', icon:'🛳️', types:['Steel','Water'] },
  { id:'hangar_gelado', name:'Hangar Gelado', icon:'🧊', types:['Steel','Ice'] },
  { id:'torre_de_radio', name:'Torre de Rádio', icon:'📡', types:['Steel','Flying'] },
  { id:'ninho_blindado', name:'Ninho Blindado', icon:'🐲', types:['Steel','Dragon'] }
];
function pickTerrain(rng, allowedIds){
  const pool = (allowedIds && allowedIds.length>0) ? TERRAINS.filter(t=>allowedIds.includes(t.id)) : TERRAINS;
  const usable = pool.length>0 ? pool : TERRAINS;
  return usable[Math.floor(rng()*usable.length)];
}
/* Só MARCA a flag. Quem multiplica é withBuffs, chamada por todas as effective* -- ver o bloco
   dos atributos mais abaixo. Idêntica à do cliente, inclusive em atribuir false a quem não casa.

   Esta função mutava os atributos direto (baseHp/attack/defense/special/speed x1.15) E marcava a
   flag, enquanto effectiveAttack/effectiveSpAtk JÁ multiplicavam de novo por causa da flag. O
   resultado era 1.15 x 1.15 = 1.32x em ataque e especial, contra 1.15x no resto -- ou seja, o
   terreno valia mais no ataque do que devia, e a MESMA partida com a MESMA seed dava vencedor
   diferente aqui e no cliente em 12,6% dos casos (medido em 30 mil batalhas).

   Mutar era perigoso por si só: as instâncias vêm de decodeTeamCode e são descartadas, mas bastava
   alguém reaproveitar uma pra o bônus se acumular a cada batalha. Marcar a flag e multiplicar só na
   hora de LER o atributo não tem esse risco. */
function applyTerrainBuff(team, terrain){
  team.forEach(p=>{
    p.terrainBuffed = p.types.some(t=>terrain.types.includes(t));
  });
}

/* ---------------------------------------------------
   MOTOR DE BATALHA (mesma lógica do jogo, portada pro servidor)
--------------------------------------------------- */
function typeVsType(atk, def){
  const chart = TYPE_CHART[atk];
  if(!chart) return 1;
  const val = chart[def];
  return (val === undefined) ? 1 : val;
}
const SPECIAL_TYPES = new Set(['Fire','Water','Grass','Electric','Psychic','Ice','Dragon']);
function isSpecialType(type){ return SPECIAL_TYPES.has(type); }
/* ============================================================================
   SUBTIPOS DE ATAQUE  (espelho do pokemon-ginasio.html)
   ----------------------------------------------------------------------------
   Alguns pokémon aprendem, na Gen 1, golpes de um tipo que não é o deles: o Porygon
   é Normal mas tem Psybeam. Aqui isso vira "subtipo" -- um tipo alternativo que o
   motor usa quando ele render mais dano que o tipo próprio.

   ESTA TABELA PRECISA SER IDÊNTICA À DO CLIENTE. Se as duas divergirem, a mesma
   batalha dá resultados diferentes na jornada e na liga -- que é exatamente o tipo de
   bug que ninguém reporta direito porque parece "azar".

   Regras (iguais às do cliente):
   - subtipo NÃO recebe STAB
   - subtipo ainda leva SUBTYPE_PENALTY, pra só vencer com folga real
   - Normal só é subtipo de quem tem TODOS os tipos especiais (Fogo, Água, Planta,
     Elétrico, Psíquico, Gelo, Dragão) -- nesses o lado físico ficaria inacessível
   ============================================================================ */
const USE_SUBTYPES = true;
/* 0,25 e não 0,10 porque o EXPOENTE_TIPO passou a ser 1.0: com o expoente em 0,6, a constante
   0,10 virava 0,25 depois da compressão -- que é a força escolhida (Hitmonlee tira ~15% da vida
   do Gengar). Deixar 0,10 com o expoente em 1.0 cortaria isso pela metade em silêncio. */
const IMUNIDADE_TEIMOSA = 0.25;   // ver GOLPE TEIMOSO em bestAttackType
/* EXPOENTE DO MULTIPLICADOR DE TIPO -- o parâmetro mais sensível do motor.
   1.0 = tabela oficial (2x é 2x). Abaixo de 1 comprime: em 0.6, um 2x virava 1,52x.
   Ele define o quanto o jogo é "sobre tipo" e o quanto é "sobre atributo", e entra em DOIS
   lugares: no dano e na escolha do golpe. Os dois têm que usar o mesmo valor -- quando a
   escolha usava o cru e o dano o comprimido, o motor escolhia um tipo e aplicava outro, e
   cliente e servidor discordavam do melhor golpe em 4% dos confrontos. */
const EXPOENTE_TIPO = 1.0;
const SUBTYPE_PENALTY = 0.85;
const SUBTYPES = {"charmander":["Normal"],"charmeleon":["Normal"],"squirtle":["Normal"],"wartortle":["Normal"],"blastoise":["Normal"],"butterfree":["Psychic"],"pikachu":["Normal"],"raichu":["Normal"],"sandshrew":["Poison"],"sandslash":["Poison"],"nidoranf":["Fighting"],"nidorina":["Fighting"],"nidoqueen":["Fighting"],"nidoranm":["Fighting"],"nidorino":["Fighting"],"nidoking":["Fighting"],"vulpix":["Normal"],"ninetales":["Normal"],"zubat":["Bug"],"golbat":["Bug"],"venonat":["Psychic"],"venomoth":["Psychic"],"psyduck":["Normal","Psychic"],"golduck":["Normal","Psychic"],"growlithe":["Normal"],"arcanine":["Normal"],"poliwag":["Normal"],"poliwhirl":["Normal"],"ponyta":["Normal"],"rapidash":["Normal"],"slowpoke":["Normal"],"slowbro":["Normal"],"magnemite":["Normal"],"magneton":["Normal"],"seel":["Ice","Normal"],"dewgong":["Normal"],"shellder":["Ice","Normal"],"cloyster":["Normal"],"gastly":["Psychic"],"haunter":["Psychic"],"gengar":["Psychic"],"drowzee":["Normal"],"hypno":["Normal"],"krabby":["Normal"],"kingler":["Normal"],"voltorb":["Normal"],"electrode":["Normal"],"exeggcute":["Normal"],"exeggutor":["Normal"],"hitmonchan":["Electric","Fire","Ice"],"tangela":["Normal"],"goldeen":["Flying","Normal"],"seaking":["Flying","Normal"],"staryu":["Normal"],"starmie":["Normal"],"mrmime":["Normal"],"jynx":["Ghost","Normal"],"electabuzz":["Normal"],"magmar":["Poison"],"magikarp":["Normal"],"lapras":["Normal"],"vaporeon":["Ice","Normal"],"jolteon":["Bug","Fighting","Normal"],"flareon":["Normal","Poison"],"porygon":["Psychic"],"kabuto":["Grass"],"kabutops":["Grass"],"dratini":["Normal"],"dragonair":["Normal"],"mewtwo":["Normal"]};
function subtiposDe(p){
  if(!USE_SUBTYPES) return [];
  return SUBTYPES[p.speciesId] || [];
}
/* O Metrônomo não escolhe: chama um golpe qualquer. Aqui isso é o TIPO saindo no sorteio, e
   não da conta de qual rende mais -- é o que faz dele uma aposta, e não um upgrade. Todo o resto
   do jogo continua escolhendo o melhor golpe disponível. */
function tipoDoGolpe(attacker, defender, rng){
  if(!METRONOMO.includes(attacker.speciesId)) return bestAttackType(attacker, defender);
  const tipos = Object.keys(TYPE_CHART);
  const t = tipos[Math.floor((rng || Math.random)() * tipos.length)];
  let mult = 1;
  (defender.types || []).forEach(d => { mult *= typeVsType(t, d); });
  // imunidade continua valendo 0, com o mesmo piso de 1 de dano e a mesma marca do log
  return { mult, type: t, stab: (attacker.types||[]).includes(t), nulo: mult === 0 };
}
/* Os tipos que o pokémon consegue usar pra atacar: os próprios (com STAB) mais o subtipo.
   Vive numa função porque o Disable precisa da MESMA lista pra saber se sobra um segundo golpe --
   se as duas divergirem, ele anula um tipo que a escolha nem considerava. */
/* DITTO USA TRANSFORMAR -- e agora o GOLPE acompanha o disfarce.
   A tela já mostrava o sprite do adversário desde sempre (ver battleSpriteHtml); o que faltava era
   o ataque: virou cópia de um Charizard, ataca com fogo. Copia SÓ isso -- os atributos, a defesa e
   os tipos que ele APRESENTA continuam sendo os dele. Copiar os atributos faria dele um segundo
   Charizard, e não é o que ele é: é um Ditto de 48 em tudo brigando com a arma do outro.
   Os tipos copiados valem como PRÓPRIOS (STAB, sem o redutor de subtipo): ele É a cópia, e cobrar
   dele o redutor de "tipo alternativo" seria tratar a transformação como um improviso.
   E ISSO NÃO É SEMPRE UM UPGRADE -- ele luta com a arma do dono dela, e no espelho Fogo contra
   Fogo é 0,5x, Água contra Água é 0,5x, Aço contra Aço é 0,5x. Contra Fantasma e Dragão, aí sim,
   é 2x. Antes ele batia sempre de Normal, que é 1x em quase tudo e 0 em Fantasma. */
function ehDittoTransformado(p, alvo){
  return !!(p && p.speciesId === 'ditto' && alvo && (alvo.types || []).length);
}
function tiposProprios(p, alvo){
  const meus = p.types || [];
  if(!ehDittoTransformado(p, alvo)) return meus;
  /* SOMA, não troca. Trocar foi medido e sai pela culatra: o Normal do Ditto é 1x em quase tudo,
     e no ESPELHO um monte de tipo resiste a si mesmo (Fogo contra Fogo é 0,5x, Água contra Água
     também). Só com o tipo copiado ele passava de 151 pra 163 espécies contra as quais nunca
     ganha -- a mudança pioraria justamente o pokémon mais fraco do jogo. Somando, ele escolhe o
     que render mais e nunca fica pior do que era.
     Os copiados valem como PRÓPRIOS (STAB, sem o redutor de subtipo): ele É a cópia.
     OS COPIADOS VÊM PRIMEIRO porque o bestAttackType guarda o PRIMEIRO de nota máxima: no empate,
     ganha a cópia. Sem isso, contra um Charizard ele atacava de Investida -- Voador e Normal dão
     exatamente o mesmo dano ali, e o jogador via a transformação não fazer nada. Não custa um
     ponto de dano: só desempata a favor do que a tela está mostrando. */
  return alvo.types.concat(meus.filter(t => !alvo.types.includes(t)));
}
function tiposDeAtaque(p, alvo){
  const proprios = tiposProprios(p, alvo);
  return proprios.concat(subtiposDe(p).filter(t => !proprios.includes(t)));
}
function bestAttackType(attacker, defender){
  const proprios = tiposProprios(attacker, defender);
  let candidatos = tiposDeAtaque(attacker, defender);
  /* DISABLE: o melhor golpe deste atacante contra ESTE adversário saiu de cena, e ele cai no
     segundo melhor. Vale só contra quem anulou -- adversário novo, confronto novo. O golpe
     teimoso lá embaixo reusa esta mesma lista, então já sai filtrado também. */
  if(attacker._anulado && attacker._anulado.contra === defender && candidatos.length > 1){
    candidatos = candidatos.filter(t => t !== attacker._anulado.tipo);
  }
  let melhor = null;
  for(const t of candidatos){
    let mult = 1;
    (defender.types || []).forEach(d => { mult *= typeVsType(t, d); });
    const especial = isSpecialType(t);
    const proprio = proprios.includes(t);
    const atk = especial ? effectiveSpAtk(attacker) : effectiveAttack(attacker);
    const def = especial ? effectiveSpDef(defender) : effectiveDefense(defender);
    // ^0.6 igual ao dano: se a escolha usasse o multiplicador cru e o dano o comprimido, o motor
    // escolheria um tipo e aplicaria outro -- foi essa diferença que fez cliente e servidor
    // discordarem do melhor golpe em 4% dos confrontos
    const nota = Math.pow(mult, EXPOENTE_TIPO) * (proprio ? 1.5 : SUBTYPE_PENALTY) * (atk / Math.max(1, def));
    if(!melhor || nota > melhor.nota) melhor = { mult, type: t, stab: proprio, nota };
  }
  /* GOLPE TEIMOSO -- quando NADA que o atacante tem machuca o alvo.
     Imunidade vale 0, e isso é o certo enquanto sobra alternativa: o Raichu simplesmente troca o
     Raio pelo golpe Normal contra um pokémon de Terra. Mas quem só tem o tipo imune (Hitmonlee
     Lutador puro contra Fantasma, Dugtrio Terra puro contra Voador) ficava com o piso de 1 de
     dano por golpe -- ou seja, perdia o confronto sem jogada possível, e aqui não dá pra trocar
     de pokémon no meio. Nesses casos o melhor golpe sai com multiplicador reduzido.
     A escolha é refeita aqui porque com tudo zerado todas as notas empatam em 0 e o laço acima
     ficaria com o primeiro candidato, não com o que rende mais. */
  if(melhor && melhor.mult === 0){
    let teimoso = null;
    for(const t of candidatos){
      const especial = isSpecialType(t);
      const proprio = proprios.includes(t);
      const atk = especial ? effectiveSpAtk(attacker) : effectiveAttack(attacker);
      const def = especial ? effectiveSpDef(defender) : effectiveDefense(defender);
      const nota = Math.pow(IMUNIDADE_TEIMOSA, EXPOENTE_TIPO) * (proprio ? 1.5 : SUBTYPE_PENALTY) * (atk / Math.max(1, def));
      if(!teimoso || nota > teimoso.nota){
        teimoso = { mult: IMUNIDADE_TEIMOSA, type: t, stab: proprio, nota, nulo: true };
      }
    }
    if(teimoso) return teimoso;
  }
  return melhor || { mult: 1, type: proprios[0], stab: true, nota: 0 };
}

function bestMultiplier(atkTypes, defTypes){
  let best = 0;
  let bestType = atkTypes[0];
  atkTypes.forEach(a=>{
    let m = 1;
    defTypes.forEach(d=> m *= typeVsType(a,d));
    if(m > best){ best = m; bestType = a; }
  });
  return { mult: best, type: bestType };
}
/* ---- Sp.Atk / Sp.Def separados (Gen 2) ----------------------------------------------------
   O jogo ja teve UM atributo 'special', como na Gen 1: o mesmo numero era o poder do golpe
   especial E a resistencia contra ele. A Gen 2 separou os dois, e desde entao esta tabela e a
   UNICA fonte de atributo especial no jogo -- o campo unico foi removido de vez.
   Valores oficiais da Geracao II.

   Nao da pra deduzir um campo a partir do outro. Medido nas 150 de Kanto: o Special da Gen 1 e
   sempre EXATAMENTE um dos dois novos valores, nunca um meio-termo -- em 39 especies os dois sao
   iguais, em 68 ele virou o Sp.Atk e em 43 o Sp.Def. Por isso os dois entram na tabela.

   Fica em bloco separado, e nao dentro do SPECIES, de proposito: o SPECIES e duplicado entre
   index.html e functions/index.js, e este bloco e IDENTICO nos dois arquivos -- conferir que
   nao divergiram vira um diff de um bloco so. Divergir aqui = a mesma batalha com resultado
   diferente no cliente e no servidor. */
const GEN2_SPECIAL = {
  bulbasaur:[65,65], ivysaur:[80,80], venusaur:[100,100], charmander:[60,50], charmeleon:[80,65],
  charizard:[109,85], squirtle:[50,64], wartortle:[65,80], blastoise:[85,105], caterpie:[20,20],
  metapod:[25,25], butterfree:[80,80], weedle:[20,20], kakuna:[25,25], beedrill:[45,80],
  pidgey:[35,35], pidgeotto:[50,50], pidgeot:[70,70], ratata:[25,35], raticate:[50,70],
  spearow:[31,31], fearow:[61,61], ekans:[40,54], arbok:[65,79], pikachu:[50,40], raichu:[90,80],
  sandshrew:[20,30], sandslash:[45,55], nidoranf:[40,40], nidorina:[55,55], nidoqueen:[75,85],
  nidoranm:[40,40], nidorino:[55,55], nidoking:[85,75], clefairy:[60,65], clefable:[85,90],
  vulpix:[50,65], ninetales:[81,100], jigglypuff:[45,25], wigglytuff:[75,50], zubat:[30,40],
  golbat:[65,75], oddish:[75,65], gloom:[85,75], vileplume:[100,90], paras:[45,55],
  parasect:[60,80], venonat:[40,55], venomoth:[90,75], diglett:[35,45], dugtrio:[50,70],
  meowth:[40,40], persian:[65,65], psyduck:[65,50], golduck:[95,80], mankey:[35,45],
  primeape:[60,70], growlithe:[70,50], arcanine:[100,80], poliwag:[40,40], poliwhirl:[50,50],
  poliwrath:[70,90], abra:[105,55], kadabra:[120,70], alakazam:[135,85], machop:[35,35],
  machoke:[50,60], machamp:[65,85], bellsprout:[70,30], weepinbell:[85,45], victreebel:[100,60],
  tentacool:[50,100], tentacruel:[80,120], geodude:[30,30], graveler:[45,45], golem:[55,65],
  ponyta:[65,65], rapidash:[80,80], slowpoke:[40,40], slowbro:[100,80], magnemite:[95,55],
  magneton:[120,70], farfetchd:[58,62], doduo:[35,35], dodrio:[60,60], seel:[45,70],
  dewgong:[70,95], grimer:[40,50], muk:[65,100], shellder:[45,25], cloyster:[85,45],
  gastly:[100,35], haunter:[115,55], gengar:[130,75], onix:[30,45], drowzee:[43,90],
  hypno:[73,115], krabby:[25,25], kingler:[50,50], voltorb:[55,55], electrode:[80,80],
  exeggcute:[60,45], exeggutor:[125,65], cubone:[40,50], marowak:[50,80], hitmonlee:[35,110],
  hitmonchan:[35,110], lickitung:[60,75], koffing:[60,45], weezing:[85,70], rhyhorn:[30,30],
  rhydon:[45,45], chansey:[35,105], tangela:[100,40], kangaskhan:[40,80], horsea:[70,25],
  seadra:[95,45], goldeen:[35,50], seaking:[65,80], staryu:[70,55], starmie:[100,85],
  mrmime:[100,120], scyther:[55,80], jynx:[115,95], electabuzz:[95,85], magmar:[100,85],
  pinsir:[55,70], tauros:[40,70], magikarp:[15,20], gyarados:[60,100], lapras:[85,95],
  ditto:[48,48], eevee:[45,65], vaporeon:[110,95], jolteon:[110,95], flareon:[95,110],
  porygon:[85,75], omanyte:[90,55], omastar:[115,70], kabuto:[55,45], kabutops:[65,70],
  aerodactyl:[60,75], snorlax:[65,110], articuno:[95,125], zapdos:[125,90], moltres:[125,85],
  dratini:[50,50], dragonair:[70,70], dragonite:[100,100], mewtwo:[154,90],
  // ---- Johto (#152-251) ----
  chikorita:[49,65], bayleef:[63,80], meganium:[83,100], cyndaquil:[60,50], quilava:[80,65],
  typhlosion:[109,85], totodile:[44,48], croconaw:[59,63], feraligatr:[79,83], sentret:[35,45],
  furret:[45,55], hoothoot:[36,56], noctowl:[76,96], ledyba:[40,80], ledian:[55,110],
  spinarak:[40,40], ariados:[60,60], crobat:[70,80], chinchou:[56,56], lanturn:[76,76],
  pichu:[35,35], cleffa:[45,55], igglybuff:[40,20], togepi:[40,65], togetic:[80,105],
  natu:[70,45], xatu:[95,70], mareep:[65,45], flaaffy:[80,60], ampharos:[115,90],
  bellossom:[90,100], marill:[20,50], azumarill:[50,80], sudowoodo:[30,65], politoed:[90,100],
  hoppip:[35,55], skiploom:[45,65], jumpluff:[55,85], aipom:[40,55], sunkern:[30,30],
  sunflora:[105,85], yanma:[75,45], wooper:[25,25], quagsire:[65,65], espeon:[130,95],
  umbreon:[60,130], murkrow:[85,42], slowking:[100,110], misdreavus:[85,85], unown:[72,48],
  wobbuffet:[33,58], girafarig:[90,65], pineco:[35,35], forretress:[60,60], dunsparce:[65,65],
  gligar:[35,65], steelix:[55,65], snubbull:[40,40], granbull:[60,60], qwilfish:[55,55],
  scizor:[55,80], shuckle:[10,230], heracross:[40,95], sneasel:[35,75], teddiursa:[50,50],
  ursaring:[75,75], slugma:[70,40], magcargo:[80,80], swinub:[30,30], piloswine:[60,60],
  corsola:[65,85], remoraid:[65,35], octillery:[105,75], delibird:[65,45], mantine:[80,140],
  skarmory:[40,70], houndour:[80,50], houndoom:[110,80], kingdra:[95,95], phanpy:[40,40],
  donphan:[60,60], porygon2:[105,95], stantler:[85,65], smeargle:[20,45], tyrogue:[35,35],
  hitmontop:[35,110], smoochum:[85,65], elekid:[65,55], magby:[70,55], miltank:[40,70],
  blissey:[75,135], raikou:[115,100], entei:[90,75], suicune:[90,115], larvitar:[45,50],
  pupitar:[65,70], tyranitar:[95,100], lugia:[90,154], hooh:[110,154], celebi:[100,100]
};
(function aplicaSplitEspecial(){
  for(const id in GEN2_SPECIAL){
    const sp = SPECIES[id];
    if(!sp) continue;
    sp.spAtk = GEN2_SPECIAL[id][0];
    sp.spDef = GEN2_SPECIAL[id][1];
  }
})();
function createInstance(speciesId, level){
  const sp = SPECIES[speciesId];
  if(!sp) return null;
  return { speciesId, name:sp.name, types:sp.types, baseHp:sp.hp, attack:sp.attack, defense:sp.defense, spAtk:sp.spAtk, spDef:sp.spDef, speed:sp.speed, level, maxHp:0, hp:0 };
}
/* MOTOR ALINHADO COM O CLIENTE
   Até aqui o servidor usava o motor LEGADO e o cliente o motor Gen 1 novo. Isso fazia a mesma
   batalha dar resultados diferentes na jornada e na liga -- e como a escolha de tipo depende da
   fórmula, os dois discordavam do melhor golpe em 4% dos confrontos.
   Este bloco é o espelho do index.html (era pokemon-ginasio.html quando isto foi escrito).
   Qualquer mudança aqui precisa ir pra lá também.

   Diferenças do legado que valem registrar:
   - sumiu a vulnerabilidade por sequência de vitórias (quem vencia ficava mais frágil a cada luta,
     causando a "morte súbita" que os jogadores relatavam)
   - dano tem teto de 65% do HP (70% em crítico): one-shot não existe mais

   SOBRE OS BUFFS -- houve uma fase intermediária em que shiny e terreno foram reduzidos a SÓ
   OFENSIVOS (shiny 1.15, terreno 1.10), pra derrubar o "penhasco" de um pokémon buffado de nível
   baixo ganhar de um bem maior. Essa fase acabou: por decisão de design, os dois voltaram a valer
   em TODOS os atributos, com shiny 1.20 e terreno 1.15, multiplicando entre si (1.38x em tudo).
   O penhasco voltou junto, e foi medido: 1 contra 1 da MESMA espécie, um shiny no terreno dele em
   nível 60 ganha de um normal de nível 70 em 90% das vezes, e de um de nível 75 em 59%. O buff
   vale mais ou menos +15 níveis. Isso é intencional -- não "conserte" mexendo nas constantes sem
   falar com o dono do jogo. */
const SHINY_BUFF_MULT = 1.20;   // +20% em TODOS os atributos (TERRAIN_BUFF_MULT = 1.15 fica lá em cima, junto de TERRAINS)
/* ---- ESPECIALIDADE DE TIPO ----------------------------------------------------------------
   Treinador que já levou SPECIALTY_THRESHOLD pokémon de um tipo ao nível SPECIALTY_LEVEL ganha
   especialidade naquele tipo, e todos os pokémon dele daquele tipo ficam SPECIALTY_BUFF mais fortes.
   Vale nas ligas e no Ginásio da Cidade, por isso mora aqui também.

   O bônus NÃO acumula em tipo duplo: um Charizard (Fogo/Voador) de um treinador especialista nos dois
   ganha 1%, não 2%. Por isso o buff é um BOOLEANO na instância, não um multiplicador acumulado --
   assim é impossível somar duas vezes por engano, mesmo que alguém chame a função repetido.

   Estes três valores precisam bater com os do pokemon-ginasio.html. */
const SPECIALTY_LEVEL = 65;      // nível a partir do qual um pokémon conta pro tipo dele
const SPECIALTY_THRESHOLD = 50;  // quantos pokémon do tipo pra virar especialista
const SPECIALTY_BUFF = 1.01;     // +1% em todos os atributos
function applySpecialtyBuff(team, specialties){
  const set = new Set(specialties || []);
  if(set.size === 0) return;
  for(const p of (team||[])){
    if(!p) continue;
    const tipos = p.types || (SPECIES[p.speciesId] && SPECIES[p.speciesId].types) || [];
    p.specialtyBuffed = tipos.some(t => set.has(t));
  }
}
function withSpecialty(v, p){ return p.specialtyBuffed ? Math.round(v * SPECIALTY_BUFF) : v; }
/* ESPELHO EXATO do bloco de atributos do index.html -- qualquer mudança aqui vai pra lá também.
   Shiny e terreno entram em TODOS os atributos e multiplicam entre si: um shiny no terreno do tipo
   dele fica 1.20 x 1.15 = 1.38x em tudo. O arredondamento é por buff, na ordem shiny -> terreno;
   inverter a ordem num dos arquivos faz os dois divergirem por 1 ponto em alguns pokémon. */
function withBuffs(v, p){
  if(p.shiny){ v = Math.round(v * SHINY_BUFF_MULT); }
  if(p.terrainBuffed){ v = Math.round(v * TERRAIN_BUFF_MULT); }
  return v;
}
function effectiveBaseHp(p){
  const v = (typeof p.baseHp==='number') ? p.baseHp : ((SPECIES[p.speciesId]&&SPECIES[p.speciesId].hp)||50);
  return withSpecialty(withBuffs(v, p), p);
}
function effectiveAttack(p){
  const v = (typeof p.attack==='number') ? p.attack : ((SPECIES[p.speciesId]&&SPECIES[p.speciesId].attack)||50);
  return withSpecialty(withBuffs(v, p), p);
}
function effectiveDefense(p){
  const v = (typeof p.defense==='number') ? p.defense : ((SPECIES[p.speciesId]&&SPECIES[p.speciesId].defense)||50);
  return withSpecialty(withBuffs(v, p), p);
}
/* Sp.Atk e Sp.Def, oficiais da Gen 2. Instancia gravada ANTES do split nao tem os campos -- cai no
   valor da especie, mesma migracao ja usada pela velocidade. O 50 no fim so pega instancia de
   especie desconhecida; nenhuma das especies da tabela chega la.
   Existiu aqui um terceiro degrau, o campo `special` da Gen 1 (um numero so pra ataque E defesa
   especial). Saiu junto com o campo: o jogo nao usa mais nada da Gen 1 em atributo. */
function effectiveSpAtk(p){
  const sp = SPECIES[p.speciesId];
  const v = (typeof p.spAtk === 'number') ? p.spAtk
          : (sp && typeof sp.spAtk === 'number') ? sp.spAtk : 50;
  return withSpecialty(withBuffs(v, p), p);
}
function effectiveSpDef(p){
  const sp = SPECIES[p.speciesId];
  const v = (typeof p.spDef === 'number') ? p.spDef
          : (sp && typeof sp.spDef === 'number') ? sp.spDef : 50;
  return withSpecialty(withBuffs(v, p), p);
}
function effectiveSpeed(p){
  // a velocidade buffada entra também na chance de crítico (rng < speed/512, regra da Gen 1):
  // quem está no terreno do tipo dele critica mais, além de bater mais forte
  const v = (typeof p.speed === 'number') ? p.speed : ((SPECIES[p.speciesId] && SPECIES[p.speciesId].speed) || 50);
  return withSpecialty(withBuffs(v, p), p);
}
function calcMaxHp(p){ return Math.round(30 + p.level*5 + effectiveBaseHp(p)); }
// HP na escala Gen 1 -- usado só internamente, pra converter o dano em fração da vida
function gen1MaxHp(p){ return Math.floor(2 * effectiveBaseHp(p) * p.level / 100) + p.level + 10; }
const MOVE_POWER = 60;
const DMG_CAP_PCT = 0.65;
const DMG_CAP_PCT_CRIT = 0.70;
function statAtLevel(base, level){ return Math.floor(2*base*level/100) + 5; }
/* MOTOR ÚNICO -- é ESTA a fórmula que roda em tudo: ligas, Ginásio da Cidade e, espelhada no
   index.html, também as batalhas locais do cliente.
   Este cabeçalho já dizia "MOTOR LEGADO -- o servidor usa só ele" e que o motor Gen 1 existia
   "apenas no cliente". Era falso, e contradizia o bloco MOTOR ALINHADO COM O CLIENTE logo acima:
   o corpo aqui embaixo É o motor novo. Conferido numericamente -- 6556 golpes com as mesmas
   seeds nos dois arquivos, zero divergências. Mantenha assim: um lado só mudado = a mesma
   batalha com dois vencedores. */
function calcDamage(attacker, defender, rng){
  rng = rng || Math.random;   // as ligas passam um rng com seed; fora delas cai no padrão
  // considera tipos próprios E subtipos, igual ao cliente (ver SUBTYPES).
  // Com USE_SUBTYPES=false volta a ser o bestMultiplier de antes, que segue ali intacto
  const best = tipoDoGolpe(attacker, defender, rng);
  /* Registro pro LOG: qual tipo este golpe usou. É só leitura -- nada daqui volta pra conta.
     O tipo escolhido não depende de HP (só de atributos e tipos, que não mudam durante o
     confronto), então na prática ele é o mesmo do começo ao fim da luta entre esses dois. */
  attacker.lastMoveType = best.type;
  const mult = best.mult;
  const special = isSpecialType(best.type);
  // STAB só pro tipo próprio; subtipo perde o bônus e ainda leva o redutor
  const STAB = best.stab ? 1.5 : SUBTYPE_PENALTY;
  // ---- fórmula oficial da Gen 1, idêntica ao calcDamageNew do cliente ----
  const atkBase = special ? effectiveSpAtk(attacker) : effectiveAttack(attacker);   // COM buffs (ofensivo)
  const defBase = special ? effectiveSpDef(defender) : effectiveDefense(defender);  // Gen 2: defesa especial propria
  const A = statAtLevel(atkBase, attacker.level);
  const D = statAtLevel(defBase, defender.level);
  const isCrit = rng() < (effectiveSpeed(attacker) / 512);  // crítico oficial da Gen 1
  attacker.lastCrit = isCrit;   // registro pro log, como o lastMoveType acima
  /* Imunidade: o multiplicador é 0, mas o dano tem piso de 1 -- dano 0 dos dois lados travaria
     o laço da luta pra sempre. O log precisa saber a diferença entre "tirou 1" e "não teve
     efeito", senão o jogador vê um -1 sem explicação. */
  attacker.lastMoveNulo = !!best.nulo;
  const Leff = isCrit ? attacker.level*2 : attacker.level;  // crítico dobra o nível na fórmula
  const core = Math.floor(Math.floor(2*Leff/5 + 2) * MOVE_POWER * A / D / 50) + 2;
  // multiplicador de tipo COMPRIMIDO (^0.6): 2x vira ~1.5x. Aqui não se troca de pokémon no meio
  // do confronto, então tipo não pode ser sentença de morte
  const typeMult = Math.pow(mult, EXPOENTE_TIPO);
  const dmgGen1 = Math.round(core * STAB * typeMult * (0.85 + rng()*0.15));
  // converte pra fração da vida na escala Gen 1, aplica o teto por golpe, e projeta na escala de HP
  // do jogo -- sem vulnerabilidade por sequência de vitórias, que era a origem da "morte súbita"
  let pct = dmgGen1 / gen1MaxHp(defender);
  pct = Math.min(pct, isCrit ? DMG_CAP_PCT_CRIT : DMG_CAP_PCT);
  const defMaxHp = defender.maxHp || calcMaxHp(defender);
  return Math.max(1, Math.round(pct * defMaxHp));
}
/* Golpe moribundo: quem cai ainda conecta o contra-golpe -- e desde 30/08/2026 ele vale CHEIO.
   Valeu metade por um tempo, e o efeito colateral era ilegível: o jogador via seu pokémon com
   vantagem de tipo tirando 112 em vez de 223 e procurava bug no multiplicador.
   Medido na mudança: 11,2% das batalhas trocam de vencedor, a taxa de vitória geral não se move
   (51,3% → 51,0%), e os confrontos que terminam no desempate sobem de 6,5% pra 14,6% -- mais
   gente cai junto, e o desempate (sobrevivente com 1-10% da vida) passa a decidir mais confronto. */
const DYING_BLOW_FACTOR = 1.0;
/* O 4º parâmetro é o DIÁRIO da luta: um registro por golpe, na ordem em que aconteceram, pro log
   conseguir contar o passo a passo. É só escrita -- nada aqui é lido de volta pelo motor, e passar
   ou não passar o array não muda um ponto de dano.
   Chaves curtas porque isso é gravado no Firestore junto com a batalha:
   q = quem bateu ('p' = o lado do jogador no confronto, 'e' = o outro), d = dano,
   hp = como o alvo ficou, c = foi crítico, m = foi golpe moribundo (o contra-golpe de quem caiu). */
/* ===== GOLPES ESPECIAIS: AUTODESTRUIÇÃO, SONO E METRÔNOMO =====
   Três efeitos que não são dano. São resolvidos UMA VEZ POR CONFRONTO -- não por troca -- antes do
   primeiro golpe, e quando acontecem o confronto acaba ali.

   AS LISTAS SAEM DO APRENDIZADO POR NÍVEL da Gen 1/2 (pesquisado em 01/09/2026 no PokémonDB), e não
   das TMs: por TM meia Pokédex aprendia autodestruição, e a graça é que o golpe seja característica
   da espécie -- o jogador reconhece "ih, é um Geodude" e pesa o risco.

   POR QUE FICA DENTRO DO doExchange, e não nos laços de batalha: são QUATRO laços (jornada no
   cliente, jornada no servidor, batalha online e raide do Mew) e eles teriam que combinar entre si.
   O marcador é o próprio adversário: quando o oponente muda, é outro confronto e as chances valem
   de novo. Assim a regra vale nos quatro sem tocar em nenhum.

   MEW E MEWTWO SÃO IMUNES. Sem isso um Geodude nível 20 derrubaria o Mew de 25.125 de HP da raide
   com 15% de chance, e o desafio final da Pokédex viraria uma aposta de moeda. Os dois são os
   chefes do jogo -- não caem por um golpe só. */
const CHANCE_AUTODESTRUICAO = 0.15;
/* A autodestruição só sai contra alvo com MAIS da metade da vida. Explodir num adversário já
   machucado é trocar o pokémon inteiro por um abate que a troca de golpes ia entregar de graça --
   e no laço de batalha o inimigo carrega o HP de um confronto pro outro, então isso acontecia de
   verdade. Com a trava ela vira o que devia ser: o recurso de quem está diante de um alvo cheio. */
const BOOM_MINIMO_DO_ALVO = 0.5;
const CHANCE_SONO = 0.05;
const CHANCE_METRONOMO_EFEITO = 0.10;   // por efeito: 10% cada um dos três, 70% golpe comum
const CHANCE_DISABLE = 0.10;
const CHANCE_RECUPERAR = 0.10;
const IMUNES_A_ESPECIAL = ['mew','mewtwo'];
/* Aprendem Autodestruição por nível na Gen 1/2. */
const AUTODESTRUICAO = ['geodude','graveler','golem','voltorb','electrode','koffing','weezing','pineco','forretress'];
/* Aprendem um golpe de SONO por nível na Gen 1/2 -- o valor é o nome que aparece no log. */
const SONIFEROS = {
  bulbasaur:'Pó do Sono', ivysaur:'Pó do Sono', venusaur:'Pó do Sono', butterfree:'Pó do Sono',
  oddish:'Pó do Sono', gloom:'Pó do Sono', vileplume:'Pó do Sono', bellossom:'Pó do Sono',
  venonat:'Pó do Sono', venomoth:'Pó do Sono',
  bellsprout:'Pó do Sono', weepinbell:'Pó do Sono', victreebel:'Pó do Sono',
  hoppip:'Pó do Sono', skiploom:'Pó do Sono', jumpluff:'Pó do Sono',
  paras:'Esporo', parasect:'Esporo',
  poliwag:'Hipnose', poliwhirl:'Hipnose', poliwrath:'Hipnose',
  gastly:'Hipnose', haunter:'Hipnose', gengar:'Hipnose',
  drowzee:'Hipnose', hypno:'Hipnose', exeggcute:'Hipnose', exeggutor:'Hipnose',
  clefairy:'Canto', jigglypuff:'Canto', wigglytuff:'Canto', chansey:'Canto', blissey:'Canto',
  lapras:'Canto', cleffa:'Canto', igglybuff:'Canto',
  jynx:'Beijo Adorável'
};
/* Metrônomo: chama um golpe qualquer. Aqui isso quer dizer que o TIPO do ataque sai no sorteio
   (ver tipoDoGolpe) e que os dois efeitos especiais podem sair também. */
const METRONOMO = ['togepi','togetic','cleffa','snubbull'];
/* Aprendem Disable por nível na Gen 1/2. Vulpix, Ninetales, a linha do Nidoran, Seel, Kangaskhan,
   Horsea, Spinarak e Stantler aprendem só por REPRODUÇÃO e ficaram de fora -- a regra das listas
   deste bloco é aprendizado por nível, sempre.
   O Mewtwo aprende Disable nas duas gerações e mesmo assim não está aqui: ele e o Mew são imunes
   ao bloco INTEIRO (IMUNES_A_ESPECIAL corta antes de sortear), então a entrada seria letra morta. */
const DISABLE = ['psyduck','golduck','kadabra','alakazam','slowpoke','slowbro','slowking',
                 'grimer','muk','lickitung','jigglypuff','wigglytuff','venonat','venomoth',
                 'drowzee','hypno'];
/* Aprendem Recuperar por nível na Gen 1/2. Recover não é TM em geração nenhuma das duas e não sai
   por reprodução -- então esta lista é a lista inteira, sem recorte.
   Lugia, Ho-Oh e Celebi estão aqui por serem o que os dados dizem, mesmo sendo os INTOCÁVEIS: hoje
   ninguém os tem e nenhum NPC os usa, então a entrada não roda -- mas ela é VERDADE, e no dia em
   que algum modo puser um deles em campo já estará certa.
   O Mewtwo aprende e mesmo assim ficou de fora: ele e o Mew são imunes ao bloco INTEIRO
   (IMUNES_A_ESPECIAL corta antes de sortear), então ali a entrada seria letra morta de verdade. */
const RECUPERACAO = ['kadabra','alakazam','staryu','starmie','porygon','porygon2','corsola',
                     'lugia','hooh','celebi'];
/* Quem explodiu no confronto que está sendo resolvido: true = foi o primeiro argumento do
   doExchange (o "nosso" lado em todos os laços), false = o segundo, null = ninguém.
   É o que deixa os laços decidirem "os dois últimos caíram, quem ganha?" sem mudar assinatura.
   Módulo-level dá certo porque uma batalha é síncrona do começo ao fim: não existem duas rodando
   ao mesmo tempo nem no navegador nem numa invocação da função. */
let explosaoDoAtivo = null;
function ehImuneAEspecial(p){ return IMUNES_A_ESPECIAL.includes(p.speciesId); }
function sorteiaGolpeEspecial(p, rng){
  if(METRONOMO.includes(p.speciesId)){
    const r = rng();
    if(r < CHANCE_METRONOMO_EFEITO) return { efeito:'explosao', golpe:'Metrônomo (auto-destruição)' };
    if(r < CHANCE_METRONOMO_EFEITO*2) return { efeito:'sono', golpe:'Metrônomo (sonífero)' };
    if(r < CHANCE_METRONOMO_EFEITO*3) return { efeito:'anula', golpe:'Metrônomo (anulação)' };
    return null;   // o resto é ataque comum -- com o tipo sorteado (ver tipoDoGolpe)
  }
  if(AUTODESTRUICAO.includes(p.speciesId) && rng() < CHANCE_AUTODESTRUICAO){
    return { efeito:'explosao', golpe:'auto-destruição' };
  }
  if(SONIFEROS[p.speciesId] && rng() < CHANCE_SONO){
    return { efeito:'sono', golpe: SONIFEROS[p.speciesId] };
  }
  if(DISABLE.includes(p.speciesId) && rng() < CHANCE_DISABLE){
    return { efeito:'anula', golpe:'Anulação' };
  }
  return null;
}
/* Devolve true quando o confronto foi RESOLVIDO aqui (e o doExchange não deve nem começar). */
function tentarGolpeEspecial(active, enemy, rng, diario){
  explosaoDoAtivo = null;
  if(ehImuneAEspecial(active) || ehImuneAEspecial(enemy)) return false;
  // o mais rápido tenta primeiro -- mesma regra que decide quem conecta antes numa troca normal
  const spdA = effectiveSpeed(active), spdE = effectiveSpeed(enemy);
  const ativoPrimeiro = spdA > spdE || (spdA === spdE && rng() < 0.5);
  const ordem = ativoPrimeiro ? [[active, enemy, true], [enemy, active, false]]
                              : [[enemy, active, false], [active, enemy, true]];
  for(const [quem, alvo, ehAtivo] of ordem){
    const especial = sorteiaGolpeEspecial(quem, rng);
    if(!especial) continue;
    const marca = ehAtivo ? 'p' : 'e';
    if(especial.efeito === 'explosao'){
      /* Alvo já machucado: não vale o preço. Sai sem golpe especial nenhum -- e sem consumir a
         chance, porque quem decide isso é a SITUAÇÃO do alvo, não o sorteio. */
      if(alvo.hp <= alvo.maxHp * BOOM_MINIMO_DO_ALVO) continue;
      /* Os dois caem na hora -- e é o único caminho do jogo em que isso acontece: o doExchange
         normal sempre deixa um de pé (ver o desempate lá embaixo). */
      const danoNoAlvo = alvo.hp, danoEmSi = quem.hp;
      alvo.hp = 0; quem.hp = 0;
      explosaoDoAtivo = ehAtivo;
      if(diario){
        diario.push({ q: marca, d: danoNoAlvo, hp: 0, c:0, m:0, z:0, x:'boom', g: especial.golpe });
        diario.push({ q: marca === 'p' ? 'e' : 'p', d: danoEmSi, hp: 0, c:0, m:0, z:0, x:'boomself' });
      }
      return true;
    }
    if(especial.efeito === 'anula'){
      /* DISABLE: o melhor golpe do alvo contra QUEM anulou sai de cena e ele passa a atacar pelo
         segundo melhor -- que é o pedido ("desconsidera o que tira mais dano, usa o outro").
         Duas diferenças em relação aos outros dois especiais:
         1) NÃO resolve o confronto. A luta acontece inteira, com o alvo mais fraco -- por isso
            aqui é 'continue' e não 'return true', e por isso o outro lado ainda pode explodir.
         2) SÓ sai quando o alvo TEM um segundo golpe. Quem é de um tipo só e sem subtipo (um
            Onix, um Hitmonlee) não tem o que anular, e inventar uma punição pra ele seria
            outra regra, não esta. O sorteio simplesmente não vale contra ele. */
      if(tiposDeAtaque(alvo, quem).length < 2) continue;
      const tipoAnulado = bestAttackType(alvo, quem).type;
      alvo._anulado = { tipo: tipoAnulado, contra: quem };
      if(diario){
        /* Grava o TIPO anulado (`a`) porque é ele que deixa o log dizer QUAL golpe se perdeu --
           "teve o ataque Nevasca anulado" em vez de "teve seu melhor ataque anulado". O nome sai
           do tipo no cliente, como em todo o resto do log: o motor manda o tipo, o cliente escolhe
           a palavra (ver nomeDoGolpe). */
        diario.push({ q: marca, d: 0, hp: alvo.hp, c:0, m:0, z:0, x:'disable', g: especial.golpe, a: tipoAnulado });
      }
      continue;
    }
    /* SONO: o alvo dorme e não revida. Quem usou ataca até derrubar, sem tomar nada -- é isso que
       o pedido descreve, e é o que torna 5% um número alto de propósito. */
    const danoNoAlvo = alvo.hp;
    alvo.hp = 0;
    if(diario){
      diario.push({ q: marca, d: danoNoAlvo, hp: 0, c:0, m:0, z:0, x:'sono', g: especial.golpe });
    }
    return true;
  }
  return false;
}
function doExchange(active, enemy, rng, diario){
  /* Golpe especial: só na PRIMEIRA troca de cada confronto. O marcador é o próprio
     adversário -- oponente novo, confronto novo, e as chances valem de novo. */
  if(active._especialContra !== enemy){
    active._especialContra = enemy;
    if(tentarGolpeEspecial(active, enemy, rng || Math.random, diario)) return;
  }
  // Os DOIS sempre atacam em toda troca -- a velocidade (Gen 1 real) só decide QUEM conecta primeiro.
  // Se o primeiro golpe nocauteia, o caído ainda responde com o "golpe moribundo" (reduzido, nunca
  // cancelado). Isso impede que um pokémon raspando de HP varra uma fila inteira só por ser mais rápido.
  const dmgToEnemy = calcDamage(active, enemy, rng);
  const dmgToActive = calcDamage(enemy, active, rng);
  const spdActive = effectiveSpeed(active);
  const spdEnemy = effectiveSpeed(enemy);
  // empate de velocidade: sorteio -- rng com seed fixa nas Ligas, então continua determinístico
  const activeFirst = spdActive > spdEnemy || (spdActive === spdEnemy && rng() < 0.5);
  const first  = activeFirst ? active : enemy;
  const second = activeFirst ? enemy : active;
  const dmgByFirst  = activeFirst ? dmgToEnemy : dmgToActive;
  const dmgBySecond = activeFirst ? dmgToActive : dmgToEnemy;
  const firstHpBefore = first.hp, secondHpBefore = second.hp;
  second.hp = Math.max(0, second.hp - dmgByFirst);
  /* A marca sai da SITUAÇÃO (o segundo caiu e mesmo assim revidou), não de o dano ter sido
     reduzido. Enquanto ela era deduzida do dano, subir o DYING_BLOW_FACTOR pra 1.0 fazia a marca
     sumir junto -- e sem ela o log volta a mostrar pokémon atacando depois de cair, porque é ela
     que manda o revide vir ANTES do golpe que derrubou. */
  const segundoCaiu = second.hp <= 0;
  let counter = dmgBySecond;
  if(segundoCaiu && counter > 0){ // counter sempre > 0 agora (não existe mais imunidade total 0x)
    counter = Math.max(1, Math.round(counter * DYING_BLOW_FACTOR));
  }
  first.hp = Math.max(0, first.hp - counter);
  if(diario){
    /* O dano registrado é o que SAIU DE VERDADE da vida do alvo, não o número que a fórmula
       sorteou: um golpe de 101 num pokémon com 54 de HP tira 54. Gravar o valor cru fazia o log
       não fechar -- somando as linhas dava mais dano do que o pokémon tinha de vida. */
    diario.push({ q: activeFirst?'p':'e', d: secondHpBefore - second.hp, hp: second.hp, c: first.lastCrit?1:0, m:0, z: first.lastMoveNulo?1:0 });
    diario.push({ q: activeFirst?'e':'p', d: firstHpBefore  - first.hp,  hp: first.hp,  c: second.lastCrit?1:0, m: segundoCaiu?1:0, z: second.lastMoveNulo?1:0 });
  }
  // EMPATE NÃO EXISTE: se o golpe moribundo também derrubaria o primeiro, fica de pé quem tinha o
  // MAIOR percentual de HP entrando na troca, com 1%-10% do HP máximo (sorteado). Percentual igual
  // (ex: os dois cheios na primeira troca) favorece quem conectou primeiro.
  // A faixa já foi 1%-3% e depois 1%-10%; hoje é 5%-15%. Em 1%-3%, no nível 50, davam 3 a 10 HP:
  // o sobrevivente saía praticamente morto e caía no confronto seguinte quase de graça. Ele
  // continua saindo machucado de propósito (é um empate que ele venceu no desempate, não uma
  // vitória), mas com chance real de continuar. Medido na subida pra 5%-15%: 0,5% das batalhas
  // mudam de vencedor, e ele vence o confronto seguinte em 0,6% das vezes (era 0,2%).
  if(first.hp <= 0 && second.hp <= 0){
    const pctFirst = firstHpBefore / first.maxHp;
    const pctSecond = secondHpBefore / second.maxHp;
    const survivor = pctSecond > pctFirst ? second : first;
    const survivorHpBefore = (survivor === first) ? firstHpBefore : secondHpBefore;
    const pct = 0.05 + rng()*0.10;
    survivor.hp = Math.max(1, Math.min(survivorHpBefore, Math.round(survivor.maxHp * pct)));
    /* O desempate ressuscita quem sobrou DEPOIS dos dois golpes. Sem corrigir o diário, a última
       linha do log diria 0 de HP e a barra do mesmo cartão mostraria outro número. */
    if(diario){
      const linha = (survivor === second) ? diario[diario.length-2] : diario[diario.length-1];
      const antes = (survivor === second) ? secondHpBefore : firstHpBefore;
      if(linha){ linha.hp = survivor.hp; linha.d = antes - survivor.hp; linha.dz = 1; }
    }
  }
  /* RECUPERAR -- o único especial que acontece DEPOIS da luta, e não antes dela.
     Vive aqui, no fim do doExchange, pelo mesmo motivo de todos os outros: são QUATRO laços de
     batalha (jornada no cliente, jornada no servidor, online e raide do Mew) e eles teriam que
     combinar entre si. O laço chama o doExchange até alguém cair, então "um caiu e o outro está de
     pé" é exatamente o fim do confronto, visto de dentro daqui.
     Só sorteia se ele TOMOU dano: com a vida cheia não há o que recuperar, e a frase apareceria
     anunciando um efeito que não aconteceu.
     Vale também pra quem sobrou do desempate (aquele bloco acima ressuscita um dos dois): ele
     venceu o confronto, e a regra é sobre vencer. É raro e é o que a mecânica diz. */
  const venceuOConfronto = (first.hp > 0 && second.hp <= 0) ? first
                         : ((second.hp > 0 && first.hp <= 0) ? second : null);
  if(venceuOConfronto && venceuOConfronto.hp < venceuOConfronto.maxHp &&
     !ehImuneAEspecial(venceuOConfronto) && RECUPERACAO.includes(venceuOConfronto.speciesId) &&
     rng() < CHANCE_RECUPERAR){
    venceuOConfronto.hp = venceuOConfronto.maxHp;
    if(diario){
      diario.push({ q: (venceuOConfronto === active) ? 'p' : 'e', d: 0, hp: venceuOConfronto.hp,
                    c:0, m:0, z:0, x:'recover', g:'Recuperar' });
    }
  }
}
function simulateGymBattle(team, enemyTeam, rng){
  team.forEach(p=>{ p.maxHp=calcMaxHp(p); p.hp=p.maxHp; });
  explosaoDoAtivo = null;   // o marcador da autodestruição é por BATALHA (ver tentarGolpeEspecial)
  enemyTeam.forEach(p=>{ p.maxHp=calcMaxHp(p); p.hp=p.maxHp; });

  const matchups = [];
  let enemyIndex = 0;
  let playerStreak = 0, enemyStreak = 0;
  while(enemyIndex < enemyTeam.length){
    const enemy = enemyTeam[enemyIndex];
    let enemyDefeated = false;
    while(!enemyDefeated){
      const alive = team.filter(p=>p.hp>0);
      if(alive.length===0){ return { win:false, matchups }; }
      const active = alive[0];
      active.winsThisBattle = playerStreak;
      enemy.winsThisBattle = enemyStreak;
      const playerHpBefore = active.hp;
      const enemyHpBefore = enemy.hp;
      const playerAliveBefore = alive.length;
      const enemyAliveBefore = enemyTeam.length - enemyIndex;
      const diario = [];
      while(active.hp>0 && enemy.hp>0){ doExchange(active, enemy, rng, diario); }
      const enemyFainted = enemy.hp<=0;
      const activeFainted = active.hp<=0;
      // doExchange garante um único sobrevivente por troca -- empate/morte súbita não existem mais
      const suddenDeath = false, suddenDeathMessage = null;
      const isTrade = enemyFainted && activeFainted;
      const playerWon = enemyFainted && !activeFainted;
      const playerAliveAfter = activeFainted ? playerAliveBefore - 1 : playerAliveBefore;
      const enemyAliveAfter = enemyFainted ? enemyAliveBefore - 1 : enemyAliveBefore;
      matchups.push({
        player:active.name, playerSpecies:active.speciesId, playerLevel:active.level, playerShiny: !!active.shiny, playerBuffed: !!active.terrainBuffed,
        enemy:enemy.name, enemySpecies:enemy.speciesId, enemyLevel:enemy.level, enemyShiny: !!enemy.shiny, enemyBuffed: !!enemy.terrainBuffed,
        playerTrainerStreak: playerStreak, enemyTrainerStreak: enemyStreak,
        winner: isTrade ? null : (playerWon ? active.name : enemy.name),
        isTrade,
        suddenDeath, suddenDeathMessage,
        playerWon,
        // tipo do golpe de cada lado -- o cliente traduz em nome de golpe no log
        playerMove: active.lastMoveType || null, enemyMove: enemy.lastMoveType || null,
        golpes: diario,   // passo a passo do confronto, na ordem em que aconteceu
        playerHpBefore, playerHpAfter: active.hp, playerMaxHp: active.maxHp,
        enemyHpBefore, enemyHpAfter: enemy.hp, enemyMaxHp: enemy.maxHp,
        playerAliveBefore, playerAliveAfter, playerTeamSize: team.length,
        enemyAliveBefore, enemyAliveAfter, enemyTeamSize: enemyTeam.length
      });
      if(isTrade){ enemyDefeated = true; playerStreak = 0; enemyStreak = 0; } // ninguém venceu: zera os dois
      else if(enemyFainted){ enemyDefeated = true; playerStreak++; enemyStreak = 0; }
      else if(activeFainted){ enemyStreak++; playerStreak = 0; }
    }
    enemyIndex++;
  }
  /* AUTODESTRUIÇÃO NO ÚLTIMO DE CADA LADO: quem explodiu leva a batalha. É o único jeito de os
     dois times zerarem no mesmo instante (o doExchange normal sempre deixa um de pé), e sem esta
     linha o jogador perderia justamente a batalha que ele decidiu explodindo. */
  const teamStillAlive = team.some(p=>p.hp>0) || explosaoDoAtivo === true;
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
const EVOLUTIONS = {
  bulbasaur:{level:16, into:'ivysaur'},
  ivysaur:{level:32, into:'venusaur'},
  charmander:{level:16, into:'charmeleon'},
  charmeleon:{level:36, into:'charizard'},
  squirtle:{level:16, into:'wartortle'},
  wartortle:{level:36, into:'blastoise'},
  weedle:{level:7, into:'kakuna'},
  kakuna:{level:10, into:'beedrill'},
  caterpie:{level:7, into:'metapod'},
  metapod:{level:10, into:'butterfree'},
  ratata:{level:20, into:'raticate'},
  pidgey:{level:18, into:'pidgeotto'},
  pidgeotto:{level:36, into:'pidgeot'},
  mankey:{level:28, into:'primeape'},
  spearow:{level:20, into:'fearow'},
  nidoranm:{level:16, into:'nidorino'},
  oddish:{level:21, into:'gloom'},

  sandshrew:{level:22, into:'sandslash'},
  zubat:{level:22, into:'golbat'},
  paras:{level:24, into:'parasect'},
  meowth:{level:28, into:'persian'},
  bellsprout:{level:21, into:'weepinbell'},
  abra:{level:16, into:'kadabra'},

  ekans:{level:22, into:'arbok'},
  diglett:{level:26, into:'dugtrio'},
  magnemite:{level:30, into:'magneton'},
  voltorb:{level:40, into:'electrode'},   // faltava aqui e existe no cliente -- divergência antiga, corrigida
  drowzee:{level:26, into:'hypno'},
  nidoranf:{level:16, into:'nidorina'},
  venonat:{level:31, into:'venomoth'},

  poliwag:{level:25, into:'poliwhirl'},
  tentacool:{level:30, into:'tentacruel'},
  machop:{level:28, into:'machoke'},
  doduo:{level:31, into:'dodrio'},
  ponyta:{level:40, into:'rapidash'},
  slowpoke:{level:37, into:'slowbro'},
  magikarp:{level:20, into:'gyarados'},
  grimer:{level:38, into:'muk'},

  psyduck:{level:33, into:'golduck'},
  krabby:{level:28, into:'kingler'},
  horsea:{level:32, into:'seadra'},
  goldeen:{level:33, into:'seaking'},
  cubone:{level:28, into:'marowak'},

  gastly:{level:25, into:'haunter'},
  rhyhorn:{level:42, into:'rhydon'},
  seel:{level:34, into:'dewgong'},
  omanyte:{level:40, into:'omastar'},
  kabuto:{level:40, into:'kabutops'},

  geodude:{level:25, into:'graveler'},
  dratini:{level:30, into:'dragonair'},
  dragonair:{level:50, into:'dragonite'},

  exeggcute:{level:40, into:'exeggutor'},
  clefairy:{level:40, into:'clefable'},
  jigglypuff:{level:40, into:'wigglytuff'},
  vulpix:{level:40, into:'ninetales'},
  growlithe:{level:40, into:'arcanine'},
  poliwhirl:{level:40, into:'poliwrath'},
  weepinbell:{level:40, into:'victreebel'},
  gloom:{level:40, into:'vileplume'},
  shellder:{level:40, into:'cloyster'},
  kadabra:{level:40, into:'alakazam'},
  machoke:{level:40, into:'machamp'},
  graveler:{level:40, into:'golem'},
  haunter:{level:40, into:'gengar'},
  koffing:{level:40, into:'weezing'},
  nidorina:{level:40, into:'nidoqueen'},
  nidorino:{level:40, into:'nidoking'},
  pikachu:{level:40, into:'raichu'},
  staryu:{level:40, into:'starmie'},
  /* ---- Johto. Gloom, Poliwhirl e Slowpoke NAO entram: em Kanto eles ja evoluem pra
     Vileplume, Poliwrath e Slowbro, e a tabela mapeia um destino so. Bellossom, Politoed e
     Slowking ficam de fora ate existir uma tela de escolha, como a do Eevee. ---- */
  golbat:{level:40, into:'crobat'},
  onix:{level:40, into:'steelix'},
  chansey:{level:40, into:'blissey'},
  seadra:{level:40, into:'kingdra'},
  scyther:{level:40, into:'scizor'},
  porygon:{level:40, into:'porygon2'},
  chikorita:{level:16, into:'bayleef'},
  bayleef:{level:32, into:'meganium'},
  cyndaquil:{level:14, into:'quilava'},
  quilava:{level:36, into:'typhlosion'},
  totodile:{level:18, into:'croconaw'},
  croconaw:{level:30, into:'feraligatr'},
  sentret:{level:15, into:'furret'},
  hoothoot:{level:20, into:'noctowl'},
  ledyba:{level:18, into:'ledian'},
  spinarak:{level:22, into:'ariados'},
  chinchou:{level:27, into:'lanturn'},
  togepi:{level:40, into:'togetic'},
  natu:{level:25, into:'xatu'},
  mareep:{level:15, into:'flaaffy'},
  flaaffy:{level:30, into:'ampharos'},
  marill:{level:18, into:'azumarill'},
  hoppip:{level:18, into:'skiploom'},
  skiploom:{level:27, into:'jumpluff'},
  sunkern:{level:40, into:'sunflora'},
  wooper:{level:20, into:'quagsire'},
  pineco:{level:31, into:'forretress'},
  snubbull:{level:23, into:'granbull'},
  teddiursa:{level:30, into:'ursaring'},
  slugma:{level:38, into:'magcargo'},
  swinub:{level:33, into:'piloswine'},
  remoraid:{level:25, into:'octillery'},
  houndour:{level:24, into:'houndoom'},
  phanpy:{level:25, into:'donphan'},
  tyrogue:{level:20, into:'hitmontop'},
  larvitar:{level:30, into:'pupitar'},
  pupitar:{level:55, into:'tyranitar'},
  /* bebes da Gen 2 que evoluem pra um adulto de Kanto -- ver a nota no CLAUDE.md */
  pichu:{level:20, into:'pikachu'},
  cleffa:{level:20, into:'clefairy'},
  igglybuff:{level:20, into:'jigglypuff'},
  smoochum:{level:20, into:'jynx'},
  elekid:{level:20, into:'electabuzz'},
  magby:{level:20, into:'magmar'}
};





function encodeTeamCode(team){
  const payload = team.map(p=>`${p.speciesId}:${p.level}${p.shiny?':1':''}`).join(',');
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
    if(bits.length<2 || bits.length>3) return null;
    const id = bits[0];
    const lvl = parseInt(bits[1],10);
    if(!SPECIES[id] || !Number.isFinite(lvl) || lvl<1 || lvl>200) return null;
    const inst = createInstance(id, lvl);
    if(!inst) return null;
    if(bits[2]==='1'){ inst.shiny = true; }
    team.push(inst);
  }
  return team;
}

/* ---------------------------------------------------
   LÓGICA DA LIGA (mesma do jogo, portada pro servidor)
--------------------------------------------------- */
const CYCLE_INTERVAL_MS = 60 * 60 * 1000; // uma Liga nova por hora
const PHASE_MS = 5 * 60 * 1000;
// espelha EXATAMENTE roundLabelsFor do cliente (pokemon-ginasio.html) -- usado nas notificações pra
// dizer em que fase o treinador foi eliminado, ou qual é a próxima. Precisa ficar sincronizado com o
// cliente à mão -- os dois calculam o nome da fase a partir do número de rodadas do chaveamento
function roundLabelsFor(numRounds){
  if(numRounds===4) return ['Oitavas de Final','Quartas de Final','Semifinal','Final'];
  return ['Quartas de Final','Semifinal','Final'];
}
const GRANDE_LIGA_SIZE = 16;
const REGULAR_LIGA_SIZE = 8;
const BOT_LEVEL = 45;
function gatherFinalEvolutionSpecies(allowedTypes){
  return Object.keys(SPECIES).filter(id=>{
    if(EVOLUTIONS[id]) return false;
    if(allowedTypes && allowedTypes.length>0){
      return SPECIES[id].types.some(t=>allowedTypes.includes(t));
    }
    return true;
  });
}
function createBotRegistrant(index, allowedTypes, seedBase){
  const pool = gatherFinalEvolutionSpecies(allowedTypes);
  const shuffled = shuffleWithSeed(pool, `bot-${seedBase}-${index}`);
  const chosen = shuffled.slice(0, 6);
  const team = chosen.map(sid=>({ speciesId: sid, level: BOT_LEVEL }));
  return {
    name: `Bot ${index}`,
    code: encodeTeamCode(team),
    uid: `bot-${seedBase}-${index}`,
    slot: 'bot',
    registeredAt: 0,
    isBot: true
  };
}

function computeNextScheduledTime(){
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  if(target.getTime() <= now.getTime()){ target.setHours(target.getHours()+1); }
  return target.getTime();
}
const CLASSIC_LEAGUE_TYPE = 'classic';
function leagueTypesCollRef(){ return db.collection('leagueTypes'); }
function scheduleDocRef(typeId){ return db.collection('leagues').doc('schedule_'+(typeId||CLASSIC_LEAGUE_TYPE)); }
function cycleDocRef(typeId, cycleId){ return db.collection('leagueCycles').doc((typeId||CLASSIC_LEAGUE_TYPE)+'__'+cycleId); }
function registrantsCollRef(typeId, cycleId){ return cycleDocRef(typeId, cycleId).collection('registrants'); }
function registrantDocRef(typeId, cycleId, name){ return registrantsCollRef(typeId, cycleId).doc(sanitizeForDocId(name)); }
function sanitizeForDocId(str){
  const cleaned = String(str).trim().toLowerCase().replace(/[\/\s]+/g, '_').slice(0, 200);
  return cleaned || 'sememnome';
}
async function listActiveLeagueTypes(){
  const classicEntry = { id: CLASSIC_LEAGUE_TYPE, name: 'Liga Clássica', description: null, allowedTypes: null, allowedTerrains: null, botFillEnabled: false };
  const types = [classicEntry];
  try{
    const snap = await leagueTypesCollRef().get();
    snap.forEach(doc=>{
      const data = doc.data();
      if(doc.id === CLASSIC_LEAGUE_TYPE){
        classicEntry.botFillEnabled = !!data.botFillEnabled;
        return;
      }
      if(data.active){ types.push({ id: doc.id, ...data }); }
    });
  } catch(e){ logger.error('Erro ao carregar tipos de liga customizados:', e); }
  return types;
}
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
async function recordLeagueChampionWin(name, uid, typeId, isElite){
  try{
    // além da contagem de vitórias, registra (quando aplicável) que esse nome pertence a um campeão da
    // Elite dos 4 -- o Top 10 usa esse mapa pra exibir o 🏆 permanente na frente do nome, sem nunca
    // alterar o nome em si (que é a chave do ranking)
    const payload = { wins: { [name]: admin.firestore.FieldValue.increment(1) } };
    if(isElite){ payload.eliteNames = { [name]: true }; }
    await db.collection('leagues').doc('champions_alltime_'+(typeId||CLASSIC_LEAGUE_TYPE)).set(
      payload,
      { merge: true }
    );
  } catch(e){ logger.error('Erro ao registrar campeão no ranking global:', e); }
  if(uid){
    try{
      const extraFlags = typeId===TRAINERS_LEAGUE_TYPE ? { anyTrainersChampion: true, achievementFlagsMigrated: true } : {};
      await db.collection('users').doc(uid).set(
        { leagueWinsTotal: admin.firestore.FieldValue.increment(1), ...extraFlags },
        { merge: true }
      );
    } catch(e){ logger.error('Erro ao registrar campeão na conta:', e); }
  }
}
async function recordLeaguePlacement(uid, record){
  if(!uid) return;
  try{
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    const current = (snap.exists && snap.data().leaguePlacements) ? snap.data().leaguePlacements : [];
    // inclui leagueTypeId na checagem -- cycleId (um timestamp) e leagueId (um índice) podem coincidir
    // entre tipos de liga DIFERENTES rodando na mesma hora
    if(current.some(p=>p.cycleId===record.cycleId && p.leagueId===record.leagueId && p.leagueTypeId===record.leagueTypeId)) return;
    const updated = [record, ...current].sort((a,b)=>b.cycleTime-a.cycleTime).slice(0, 12);
    // flags permanentes de conquista, gravadas AGORA (no momento real do evento) em vez de precisar
    // vasculhar todo o histórico de ligas toda vez que alguém abre a home -- ver computeLeagueAchievementExtra
    // no cliente. Mesmo mapeamento placement->flag que o escaneamento antigo usava
    const flagUpdates = { anyRegistered: true, achievementFlagsMigrated: true };
    if(record.placement==='Campeão'){ flagUpdates.anyChampion = true; flagUpdates.anyRunnerUp = true; flagUpdates.anySemifinal = true; }
    else if(record.placement==='Vice-campeão'){ flagUpdates.anyRunnerUp = true; flagUpdates.anySemifinal = true; }
    else if(record.placement==='3º–4º Lugar'){ flagUpdates.anySemifinal = true; }
    await ref.set({ leaguePlacements: updated, ...flagUpdates }, { merge: true });
  } catch(e){ logger.error('Erro ao gravar colocação na Liga:', e); }
}
async function updateTrainerStreakForUid(uid, won){
  if(!uid) return;
  try{
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    const d = snap.exists ? snap.data() : {};
    const currentLast = d.trainerLastStreak || 0;
    const currentBest = d.trainerBestStreak || 0;
    const newLast = won ? currentLast + 1 : 0;
    const newBest = Math.max(currentBest, newLast);
    await ref.set({ trainerLastStreak: newLast, trainerBestStreak: newBest }, { merge:true });
  } catch(e){ logger.error('Erro ao atualizar sequência do treinador:', e); }
}
function assignMatchTerrain(match, seedStr, allowedTerrainIds){
  if(match.terrain || !match.a || !match.b) return;
  const rng = makeSeededRng('terrain-'+seedStr);
  const terrain = pickTerrain(rng, allowedTerrainIds);
  match.terrain = { id: terrain.id, name: terrain.name, icon: terrain.icon, types: terrain.types };
}
// tira o log de batalha (matchups) de dentro da partida e grava num documento próprio da subcoleção
// matchLogs -- os logs eram ~95% do tamanho do documento do ciclo, e com muitas ligas estouravam o
// limite rígido de 1MB por documento do Firestore (medido: ~160 inscritos já batiam no teto).
// SEGURANÇA: só esvazia o campo embutido DEPOIS da gravação do log confirmar -- se a gravação falhar,
// o log fica embutido como sempre foi (formato antigo), e nada se perde. O cliente entende os dois
// formatos: embutido (partidas antigas) e logStored (novas, busca sob demanda no "Assistir batalha")
async function storeMatchLogAndStrip(logCollRef, logId, match){
  if(!match.matchups || match.matchups.length===0) return; // walkover/bye não tem log pra extrair
  try{
    await logCollRef.doc(logId).set({ matchups: match.matchups, updatedAt: Date.now() });
    match.matchups = null;
    match.logStored = true;
  } catch(e){ logger.error('Erro ao gravar log de batalha (mantendo embutido):', e); }
}
function resolveLeagueMatch(match, seedStr, allowedTerrainIds){
  const rng = makeSeededRng(seedStr);
  const teamA = decodeTeamCode(match.a.code);
  const teamB = decodeTeamCode(match.b.code);
  if(!teamA || !teamB){
    match.winner = teamA ? match.a : match.b;
    match.resolved = true;
    match.matchups = [];
    return;
  }
  if(!match.terrain){ assignMatchTerrain(match, seedStr, allowedTerrainIds); }
  const terrain = TERRAINS.find(t=>t.id===match.terrain.id);
  applyTerrainBuff(teamA, terrain);
  applyTerrainBuff(teamB, terrain);
  // especialidades vêm CONGELADAS no registro do jogador (snapshot da inscrição), não lidas do
  // documento dele agora -- assim uma partida da rodada 1 e uma da rodada 8 usam os mesmos números,
  // e o cron que resolve rodadas não precisa ler o perfil de todo mundo a cada partida
  applySpecialtyBuff(teamA, match.a && match.a.specialties);
  applySpecialtyBuff(teamB, match.b && match.b.specialties);
  const result = simulateGymBattle(teamA, teamB, rng);
  // diferente dos ginásios, os níveis ficam CONGELADOS na Liga -- depois da 8ª insígnia, o time do
  // treinador não sobe mais de nível, então nem precisa re-codificar/sincronizar nada aqui
  match.matchups = result.matchups; // mantém o log completo, pro botão "Assistir batalha" funcionar mesmo quando quem resolve é a Cloud Function
  match.winner = result.win ? match.a : match.b;
  match.resolved = true;
}
const STUCK_CLAIM_THRESHOLD_MS = 3 * 60 * 1000;
async function claimCycleForProcessing(typeId, cycleId, fromStatus, toStatus){
  try{
    return await db.runTransaction(async (tx)=>{
      const snap = await tx.get(scheduleDocRef(typeId));
      if(!snap.exists) return false;
      const data = snap.data();
      const entry = data.cycles.find(c=>c.id===cycleId);
      if(!entry || entry.status!==fromStatus) return false;
      entry.status = toStatus;
      entry.claimedAt = (toStatus==='advancing' || toStatus==='drawing') ? Date.now() : null;
      data.updatedAt = Date.now();
      tx.set(scheduleDocRef(typeId), data);
      return true;
    });
  } catch(e){
    // sob contenção pesada (vários navegadores + essa própria Cloud Function competindo pelo mesmo
    // ciclo ao mesmo tempo), a transação pode falhar mesmo após as tentativas automáticas do Firestore --
    // trata igual a "perdeu a corrida", que já é esperado e inofensivo aqui
    logger.warn('Não conseguiu reivindicar o ciclo pra processar agora:', e.message);
    return false;
  }
}
async function recoverStuckCycles(typeId){
  try{
    await db.runTransaction(async (tx)=>{
      const snap = await tx.get(scheduleDocRef(typeId));
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
      if(changed){ data.updatedAt = Date.now(); tx.set(scheduleDocRef(typeId), data); }
    });
  } catch(e){ logger.error('Erro ao recuperar ciclos travados:', e); }
}
async function drawCycle(typeId, cycleEntry, leagueTypeConfig){
  const claimed = await claimCycleForProcessing(typeId, cycleEntry.id, 'registering', 'drawing');
  if(!claimed) return false;
  try{
    const regSnap = await registrantsCollRef(typeId, cycleEntry.id).get();
    const registrants = regSnap.docs.map(d=>d.data());
    // prioriza por ordem de inscrição -- quem chegou primeiro tem prioridade de entrar no sorteio dessa
    // rodada; quem sobrar (por ter chegado por último) é quem fica de fora e vai pra próxima Liga
    const ordered = registrants.slice().sort((a,b)=>(a.registeredAt||0)-(b.registeredAt||0));
    const leagues = [];
    let cursor = 0;
    let workingList = ordered;
    let leftover = [];
    const botFillEnabled = leagueTypeConfig && leagueTypeConfig.botFillEnabled;
    if(botFillEnabled && ordered.length > 0){
      const grandeGroupsFromReal = Math.floor(ordered.length / GRANDE_LIGA_SIZE);
      const remainder = ordered.length - grandeGroupsFromReal*GRANDE_LIGA_SIZE;
      workingList = ordered.slice(0, grandeGroupsFromReal*GRANDE_LIGA_SIZE);
      if(remainder > 0){
        const targetSize = remainder <= REGULAR_LIGA_SIZE ? REGULAR_LIGA_SIZE : GRANDE_LIGA_SIZE;
        const botsNeeded = targetSize - remainder;
        const realRemainder = ordered.slice(grandeGroupsFromReal*GRANDE_LIGA_SIZE);
        const bots = [];
        for(let i=1;i<=botsNeeded;i++){
          bots.push(createBotRegistrant(i, leagueTypeConfig.allowedTypes, cycleEntry.scheduledTime));
        }
        workingList = workingList.concat(realRemainder, bots);
      }
    }
    const grandeCount = Math.floor(workingList.length / GRANDE_LIGA_SIZE);
    for(let i=0;i<grandeCount;i++){
      const group = shuffleWithSeed(workingList.slice(cursor, cursor+GRANDE_LIGA_SIZE), `draw-${cycleEntry.scheduledTime}-g${leagues.length}`);
      leagues.push({ id: leagues.length, size: GRANDE_LIGA_SIZE, rounds: buildRounds(group), champion:null });
      cursor += GRANDE_LIGA_SIZE;
    }
    const remaining = workingList.length - cursor;
    const regularCount = Math.floor(remaining / REGULAR_LIGA_SIZE);
    for(let i=0;i<regularCount;i++){
      const group = shuffleWithSeed(workingList.slice(cursor, cursor+REGULAR_LIGA_SIZE), `draw-${cycleEntry.scheduledTime}-g${leagues.length}`);
      leagues.push({ id: leagues.length, size: REGULAR_LIGA_SIZE, rounds: buildRounds(group), champion:null });
      cursor += REGULAR_LIGA_SIZE;
    }
    if(!botFillEnabled){ leftover = ordered.slice(cursor); }
    const allowedTerrainIds = leagueTypeConfig ? leagueTypeConfig.allowedTerrains : null;
    for(const league of leagues){
      const labels = roundLabelsFor(Object.keys(league.rounds).length);
      (league.rounds['0']||[]).forEach((match, mi)=>{
        assignMatchTerrain(match, `${cycleEntry.scheduledTime}-L${league.id}-R0-M${mi}`, allowedTerrainIds);
        // avisa os dois lados reais (não bot) que a liga deles começou, já dizendo horário e
        // adversário da primeira fase (fire-and-forget, não atrasa o sorteio)
        for(const side of ['a','b']){
          const p = match[side];
          if(p && !p.isBot){
            const opponent = match[side==='a'?'b':'a'];
            const phaseLabel = labels[0] || 'primeira fase';
            const timeLabel = new Date(cycleEntry.scheduledTime).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
            createNotification(p.uid, 'league_started',
              `🏆 Sua liga começou!`,
              `A ${(leagueTypeConfig && leagueTypeConfig.name) || 'Liga Pokémon'} que você se inscreveu começou agora. Sua ${phaseLabel} é às ${timeLabel}, contra ${opponent?opponent.name:'a definir'}. Boa sorte!`,
              { leagueTypeId: typeId, cycleId: cycleEntry.id });
          }
        }
      });
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
    await cycleDocRef(typeId, cycleEntry.id).set(detail);

    const nextScheduledTime = cycleEntry.scheduledTime + CYCLE_INTERVAL_MS;
    const nextCycleId = makeCycleId(nextScheduledTime);
    for(const p of leftover){
      await registrantDocRef(typeId, nextCycleId, p.uid).set(p);
    }

    await db.runTransaction(async (tx)=>{
      const snap = await tx.get(scheduleDocRef(typeId));
      const data = snap.exists ? snap.data() : { cycles: [], updatedAt: Date.now() };
      const entry = data.cycles.find(c=>c.id===cycleEntry.id);
      if(entry){ entry.status = leagues.length>0 ? 'drawn' : 'complete'; }
      if(!data.cycles.some(c=>c.id===nextCycleId)){
        data.cycles.push({ id: nextCycleId, scheduledTime: nextScheduledTime, status:'registering' });
      }
      data.updatedAt = Date.now();
      tx.set(scheduleDocRef(typeId), data);
    });
    return true;
  } catch(e){
    logger.error('Erro ao sortear ciclo:', e);
    await claimCycleForProcessing(typeId, cycleEntry.id, 'drawing', 'registering');
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
// checagem BARATA (só leitura, sem transação) se tem alguma partida pronta pra resolver nesse ciclo
// agora -- evita disputar a trava de processamento quando não há trabalho nenhum. Usa continue em vez
// do break que o corpo da função original usa (aquele break assume fases em ordem -- mais seguro não
// assumir isso aqui, já que é só leitura em memória, custo irrelevante)
function leagueCycleHasPendingWork(detail){
  if(!detail || !detail.leagues) return false;
  const now = Date.now();
  const phaseTimes = [detail.qfTime, detail.sfTime, detail.finalTime, detail.phase4Time];
  for(const league of detail.leagues){
    const roundKeys = Object.keys(league.rounds||{}).sort((a,b)=>Number(a)-Number(b));
    for(let ri=0; ri<roundKeys.length; ri++){
      if(phaseTimes[ri]==null || now < phaseTimes[ri]) continue;
      const round = league.rounds[roundKeys[ri]];
      for(const match of round){
        if(!match.resolved && match.a && match.b) return true;
      }
    }
  }
  return false;
}
async function advanceCyclePhases(typeId, cycleEntry, leagueTypeConfig, leagueTypeName){
  // evita disputar a trava (transação de ESCRITA) no agendamento compartilhado quando não há nenhuma
  // partida pronta pra resolver ainda -- é o caso da grande maioria das chamadas de polling do cliente,
  // no meio do intervalo (às vezes horas) entre uma fase e a próxima
  try{
    const precheckSnap = await cycleDocRef(typeId, cycleEntry.id).get();
    if(!precheckSnap.exists) return false;
    if(!leagueCycleHasPendingWork(precheckSnap.data())) return false;
  } catch(e){ logger.error('Erro na checagem prévia do ciclo da Liga:', e); }
  const claimed = await claimCycleForProcessing(typeId, cycleEntry.id, 'drawn', 'advancing');
  if(!claimed) return false;
  let pendingChampions = [], pendingPlacements = [], pendingStreakUpdates = [], changed = false;
  try{
    const ref = cycleDocRef(typeId, cycleEntry.id);
    const snap = await ref.get();
    if(!snap.exists){ await claimCycleForProcessing(typeId, cycleEntry.id, 'advancing', 'drawn'); return false; }
    const detail = snap.data();
    const now = Date.now();
    const phaseTimes = [detail.qfTime, detail.sfTime, detail.finalTime, detail.phase4Time];
    const allowedTerrainIds = leagueTypeConfig ? leagueTypeConfig.allowedTerrains : null;
    for(const league of detail.leagues){
      const roundKeys = Object.keys(league.rounds).sort((a,b)=>Number(a)-Number(b));
      for(let ri=0; ri<roundKeys.length; ri++){
        if(now < phaseTimes[ri]) break;
        const round = league.rounds[roundKeys[ri]];
        for(let mi=0; mi<round.length; mi++){
          const match = round[mi];
          if(!match.resolved && match.a && match.b){
            resolveLeagueMatch(match, `${cycleEntry.scheduledTime}-L${league.id}-R${ri}-M${mi}`, allowedTerrainIds);
            await storeMatchLogAndStrip(ref.collection('matchLogs'), `L${league.id}_R${ri}_M${mi}`, match);
            changed = true;
            const labels = roundLabelsFor(roundKeys.length);
            const eliminatedPhaseLabel = labels[ri] || `fase ${ri+1}`;
            // avança o vencedor pro próximo confronto ANTES de montar as notificações -- só assim dá
            // pra saber o adversário da próxima fase (se o OUTRO lado desse confronto já estiver
            // definido, por uma partida irmã já ter sido resolvida nessa mesma passada)
            let nextPhaseInfo = null;
            if(ri+1 < roundKeys.length){
              const nextRound = league.rounds[roundKeys[ri+1]];
              const nextMi = Math.floor(mi/2);
              const nextMatch = nextRound[nextMi];
              if(mi%2===0){ nextMatch.a = match.winner; } else { nextMatch.b = match.winner; }
              assignMatchTerrain(nextMatch, `${cycleEntry.scheduledTime}-L${league.id}-R${ri+1}-M${nextMi}`, allowedTerrainIds);
              const nextOpponent = mi%2===0 ? nextMatch.b : nextMatch.a;
              const nextTimeLabel = phaseTimes[ri+1] ? new Date(phaseTimes[ri+1]).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}) : null;
              nextPhaseInfo = { label: labels[ri+1] || `fase ${ri+2}`, time: nextTimeLabel, opponentName: nextOpponent ? nextOpponent.name : null };
            } else {
              league.champion = match.winner;
              if(!match.winner.isBot){
                pendingChampions.push({ name: match.winner.name, uid: match.winner.uid, slot: match.winner.slot });
              }
              const participants = [];
              (league.rounds['0']||[]).forEach(m=>{ if(m.a) participants.push(m.a); if(m.b) participants.push(m.b); });
              for(const p of participants){
                if(p.isBot) continue;
                const placement = computePlacement(league, p.name);
                if(placement && p.uid){
                  // mesmo fallback defensivo do cliente -- alguns ciclos antigos podem estar sem "scheduledTime"/
                  // "size" (de antes desses campos existirem, ou de uma migração), e o Firestore recusa gravar
                  // "undefined" -- sem isso um único registro velho malformado quebrava a gravação inteira
                  const cycleTime = cycleEntry.scheduledTime!=null ? cycleEntry.scheduledTime : Number(cycleEntry.id) || 0;
                  const leagueSize = league.size!=null ? league.size : ((league.rounds['0']||[]).length * 2 || REGULAR_LIGA_SIZE);
                  pendingPlacements.push({ uid: p.uid, record: { cycleId: cycleEntry.id, cycleTime, leagueId: league.id, leagueSize, placement, slot: p.slot, leagueTypeId: typeId, leagueTypeName: leagueTypeName||'Liga Clássica' } });
                }
              }
            }
            // "próxima fase" só entra na notificação de quem venceu e AINDA vai jogar de novo -- pra
            // quem vence a FINAL, a notificação separada de campeão (com o botão do bônus shiny) já
            // cobre isso, então não duplica a mensagem aqui
            if(!match.a.isBot){
              const aWon = match.winner.uid === match.a.uid;
              pendingStreakUpdates.push({ uid: match.a.uid, won: aWon });
              // não usa await de propósito -- notificação não pode atrasar o avanço da liga (que já
              // processa vários confrontos numa passada só). createNotification já trata os próprios
              // erros internamente, sem lançar
              createNotification(match.a.uid, 'match_played',
                aWon ? '🏆 Você venceu na Liga Pokémon!' : '💥 Você perdeu na Liga Pokémon',
                aWon
                  ? `Seu confronto contra ${match.b.name} terminou: vitória!${nextPhaseInfo ? ` Sua ${nextPhaseInfo.label} é${nextPhaseInfo.time?` às ${nextPhaseInfo.time}`:''}, contra ${nextPhaseInfo.opponentName||'a definir'}.` : ''}`
                  : `Seu confronto contra ${match.b.name} terminou: derrota. Você foi eliminado na ${eliminatedPhaseLabel}.`,
                { leagueTypeId: typeId, opponentName: match.b.name, won: aWon, eliminatedPhase: aWon?null:eliminatedPhaseLabel });
            }
            if(!match.b.isBot){
              const bWon = match.winner.uid === match.b.uid;
              pendingStreakUpdates.push({ uid: match.b.uid, won: bWon });
              createNotification(match.b.uid, 'match_played',
                bWon ? '🏆 Você venceu na Liga Pokémon!' : '💥 Você perdeu na Liga Pokémon',
                bWon
                  ? `Seu confronto contra ${match.a.name} terminou: vitória!${nextPhaseInfo ? ` Sua ${nextPhaseInfo.label} é${nextPhaseInfo.time?` às ${nextPhaseInfo.time}`:''}, contra ${nextPhaseInfo.opponentName||'a definir'}.` : ''}`
                  : `Seu confronto contra ${match.a.name} terminou: derrota. Você foi eliminado na ${eliminatedPhaseLabel}.`,
                { leagueTypeId: typeId, opponentName: match.a.name, won: bWon, eliminatedPhase: bWon?null:eliminatedPhaseLabel });
            }
          }
        }
      }
    }
    const allDone = detail.leagues.length>0 && detail.leagues.every(l=>l.champion);
    if(changed){
      // só regrava se essa passada realmente resolveu algo -- evita sobrescrever, com uma versão antiga,
      // uma troca de ordem de time (ou qualquer outra escrita legítima) feita entre a leitura e a gravação
      detail.updatedAt = Date.now();
      await ref.set(detail);
    }
    await claimCycleForProcessing(typeId, cycleEntry.id, 'advancing', allDone ? 'complete' : 'drawn');
    for(const champ of pendingChampions){
      await recordLeagueChampionWin(champ.name, champ.uid, typeId, !!champ.elite);
      if(champ.uid){
        // só a Liga Clássica dá esse bônus -- a Trainers League tem seu próprio ponto de registro de
        // campeão (linha ~1646), separado deste loop, e não passa por aqui
        await createNotification(champ.uid, 'league_champion',
          '🏆 Você é o campeão!',
          `Você venceu a ${leagueTypeName||'Liga Pokémon'}! Ative o bônus e, na próxima hora, seus encontros selvagens terão chance bem maior de ser shiny.`,
          { leagueTypeId: typeId, activated: false }
        );
      }
    }
    for(const p of pendingPlacements){ await recordLeaguePlacement(p.uid, p.record); }
    for(const su of pendingStreakUpdates){ await updateTrainerStreakForUid(su.uid, su.won); }
    return changed;
  } catch(e){
    logger.error('Erro ao avançar fases do ciclo:', e);
    await claimCycleForProcessing(typeId, cycleEntry.id, 'advancing', 'drawn');
    return false;
  }
}

/* ---------------------------------------------------
   FUNÇÃO AGENDADA — roda a cada minuto
--------------------------------------------------- */
async function advanceLeagueOnceForType(typeId, typeConfig){
  let anyChanged = false;
  try{
    await recoverStuckCycles(typeId);
    const scheduleSnap = await scheduleDocRef(typeId).get();
    if(!scheduleSnap.exists){
      await scheduleDocRef(typeId).set({ cycles: [{ id: makeCycleId(computeNextScheduledTime()), scheduledTime: computeNextScheduledTime(), status:'registering' }], updatedAt: Date.now() });
      logger.info(`Agenda da Liga (${typeId}) criada do zero.`);
      return true;
    }
    const data = scheduleSnap.data();
    const now = Date.now();
    if(!data.cycles.some(c=>c.status==='registering')){
      await db.runTransaction(async (tx)=>{
        const snap = await tx.get(scheduleDocRef(typeId));
        const d = snap.exists ? snap.data() : { cycles: [], updatedAt: Date.now() };
        if(!d.cycles.some(c=>c.status==='registering')){
          d.cycles.push({ id: makeCycleId(computeNextScheduledTime()), scheduledTime: computeNextScheduledTime(), status:'registering' });
          d.updatedAt = Date.now();
          tx.set(scheduleDocRef(typeId), d);
        }
      });
      anyChanged = true;
    }
    for(const entry of data.cycles.slice()){
      if(entry.status==='registering' && now >= entry.scheduledTime){
        const ok = await drawCycle(typeId, entry, typeConfig);
        if(ok) anyChanged = true;
      } else if(entry.status==='drawn'){
        const ok = await advanceCyclePhases(typeId, entry, typeConfig, typeConfig.name);
        if(ok) anyChanged = true;
      }
    }
    // limita o histórico aos ciclos concluídos mais recentes -- precisa ficar em sintonia com
    // LEAGUE_HISTORY_RETENTION no cliente, senão a lista pessoal "Suas últimas Ligas" de alguém pode
    // apontar pra um chaveamento que já foi apagado, e o botão "Rever" falha silenciosamente
    const LEAGUE_HISTORY_RETENTION = 48;
    const freshSnap = await scheduleDocRef(typeId).get();
    const freshData = freshSnap.data();
    const completed = freshData.cycles.filter(c=>c.status==='complete').sort((a,b)=>a.scheduledTime-b.scheduledTime);
    if(completed.length>LEAGUE_HISTORY_RETENTION){
      const toRemoveIds = new Set(completed.slice(0, completed.length-LEAGUE_HISTORY_RETENTION).map(c=>c.id));
      for(const id of toRemoveIds){ await cycleDocRef(typeId, id).delete(); }
      await db.runTransaction(async (tx)=>{
        const snap = await tx.get(scheduleDocRef(typeId));
        const d = snap.data();
        d.cycles = d.cycles.filter(c=>!toRemoveIds.has(c.id));
        d.updatedAt = Date.now();
        tx.set(scheduleDocRef(typeId), d);
      });
      anyChanged = true;
    }
  } catch(e){
    logger.error(`Erro ao avançar a Liga (${typeId}):`, e);
  }
  return anyChanged;
}
exports.advanceLeague = onSchedule('every 1 minutes', async (event) => {
  let anyChanged = false;
  try{
    const types = await listActiveLeagueTypes();
    // processa cada tipo de liga em sequência (nunca em paralelo) -- assim não corre risco de misturar
    // dados de ligas diferentes no meio do caminho
    for(const type of types){
      const changed = await advanceLeagueOnceForType(type.id, type);
      if(changed) anyChanged = true;
    }
  } catch(e){
    logger.error('Erro ao avançar a Liga:', e);
    return;
  }
  if(anyChanged){ logger.info('Liga avançada pelo Cloud Function.'); }
  else { logger.info('Nada a avançar ainda.'); }
});

/* -------------------------------------------------------------------
   TRAINERS LEAGUE -- liga diária de pontos corridos, porta server-side
   do que existe no cliente (pokemon-ginasio.html). Roda sozinha mesmo
   sem nenhum navegador aberto no horário certo
------------------------------------------------------------------- */
const TRAINERS_LEAGUE_TZ_OFFSET = '-03:00';
const TRAINERS_LEAGUE_TYPE = 'trainers_league'; // chave do documento de ranking global (mesma função reaproveitada da Liga Clássica)
// não existe mais horário fixo de abertura de inscrições -- elas abrem assim que a liga do dia
// ANTERIOR termina (regra em trainersLeaguePrevDayDone), e fecham na trava das 11h
const TRAINERS_LEAGUE_LOCK_HOUR = 11, TRAINERS_LEAGUE_LOCK_MIN = 0;
const TRAINERS_LEAGUE_START_HOUR = 11, TRAINERS_LEAGUE_START_MIN = 30;
const TRAINERS_LEAGUE_ROUND_MS = 30 * 60 * 1000;
const TRAINERS_LEAGUE_MAX_PLAYERS = 16;
// um resto de 4 pessoas ou menos, depois de tirar o máximo de grupos de 16 possível, NÃO forma uma
// liga -- fica pra amanhã com prioridade (o próprio registeredAt de hoje já garante isso, já que a
// ordenação de amanhã também é por esse campo -- quem sobrou de hoje sempre entra na frente de quem
// se inscrever fresco amanhã)
const TRAINERS_LEAGUE_MIN_TO_FORM = 4;

function trainersLeagueCycleRef(dateId){ return db.collection('trainersLeagueCycles').doc(dateId); }
function trainersLeagueRegistrantsRef(dateId){ return trainersLeagueCycleRef(dateId).collection('registrants'); }
function trainersLeagueRegistrantRef(dateId, uid){ return trainersLeagueRegistrantsRef(dateId).doc(uid); }
// escolha de terreno (só o mandante grava) e troca de time por rodada (cada jogador grava a própria) --
// em sub-coleções separadas, uma por jogador, em vez de campos dentro do scheduleRounds: o Firestore não
// permite atualizar um elemento específico de um array aninhado sem reescrever o documento inteiro, o
// que criaria corrida entre dois jogadores mexendo ao mesmo tempo. Cada jogador só grava o próprio doc.
function trainersLeagueTerrainPicksRef(dateId){ return trainersLeagueCycleRef(dateId).collection('terrainPicks'); }
function trainersLeagueTerrainPickRef(dateId, uid){ return trainersLeagueTerrainPicksRef(dateId).doc(uid); }
function trainersLeagueTeamPicksRef(dateId){ return trainersLeagueCycleRef(dateId).collection('teamPicks'); }
function trainersLeagueTeamPickRef(dateId, uid){ return trainersLeagueTeamPicksRef(dateId).doc(uid); }
const TRAINERS_LEAGUE_TEAM_SWAP_DEADLINE_MS = 5 * 60 * 1000;
const TRAINERS_LEAGUE_MAX_SAVE_SLOTS = 10; // espelha MAX_SAVE_SLOTS do cliente -- servidor não carrega esse arquivo, só o valor
const TRAINERS_LEAGUE_MAX_LEVEL = 99; // maior nível legítimo do jogo (Mewtwo do desafio) -- acima disso é save/código forjado
// reconstrói um código de time do zero a partir só de espécie+nível+shiny, com o nível LIMITADO ao
// teto legítimo -- qualquer stat forjado morre aqui (decodeTeamCode já recria os stats da espécie),
// e um nível 150/200 vira 99 em vez de entrar na liga. Retorna null se o código for inválido
function sanitizeTeamCode(code){
  const team = decodeTeamCode(code);
  if(!team || team.length===0) return null;
  const rebuilt = team.map(p=>{
    const inst = createInstance(p.speciesId, Math.min(p.level, TRAINERS_LEAGUE_MAX_LEVEL));
    if(p.shiny){ inst.shiny = true; }
    return inst;
  });
  return encodeTeamCode(rebuilt);
}
// assinatura INDEPENDENTE DE ORDEM de um código de time -- usada pra comparar "é o mesmo conjunto de
// pokémon?" sem se importar com a ordem escolhida (a ordem é estratégia legítima do jogador; o CONJUNTO
// é o que precisa bater com um time que ele realmente possui)
function teamCodeSignature(code){
  const team = decodeTeamCode(code);
  if(!team) return null;
  return team.map(p=>`${p.speciesId}:${Math.min(p.level, TRAINERS_LEAGUE_MAX_LEVEL)}:${p.shiny?1:0}`).sort().join('|');
}
// lê os saves de UM jogador (privilégio de admin -- o cliente só pode ler os próprios) e monta a lista
// de times elegíveis (8 insígnias) exatamente com o mesmo critério do registerForTrainersLeague no cliente
async function trainersLeagueGatherEligibleCodesForUid(uid){
  const slotRefs = Array.from({length:TRAINERS_LEAGUE_MAX_SAVE_SLOTS}, (_,i)=> db.collection('users').doc(uid).collection('saves').doc(String(i)));
  const snaps = await Promise.all(slotRefs.map(ref=> ref.get().catch(()=>({exists:false}))));
  const codes = [];
  for(const snap of snaps){
    if(!snap.exists) continue;
    const s = snap.data();
    if(s && s.team && (s.badgeCount||0) >= 8){
      // sanitiza na origem: reconstrói do zero (espécie+nível+shiny), nível limitado ao teto -- um save
      // adulterado com stats/níveis impossíveis entra na liga como um time normalizado, não como monstro
      const clean = sanitizeTeamCode(encodeTeamCode(s.team));
      if(clean){ codes.push(clean); }
    }
  }
  return codes;
}
// atualiza os times elegíveis de TODO MUNDO inscrito, automaticamente, sem precisar de nenhum clique --
// dispara uma vez por rodada, no mesmo instante em que o prazo de troca manual (5min antes) fecha, pra
// garantir que quem não trocou manualmente entra no sorteio com a lista mais atual possível (por exemplo,
// alguém que zerou um save novo com 8 insígnias durante o dia, depois de já ter se inscrito de manhã)
async function trainersLeagueRefreshEligibleCodes(dateId){
  try{
    const ref = trainersLeagueCycleRef(dateId);
    const snap = await ref.get();
    if(!snap.exists) return;
    const data = snap.data();
    if(!['locked','active','advancing'].includes(data.status) || !data.roundTimes) return;
    const alreadyDone = data.eligibleRefreshedThroughRound!=null ? data.eligibleRefreshedThroughRound : -1;
    const nextRound = alreadyDone + 1;
    if(nextRound >= data.roundTimes.length) return; // já cobriu todas as rodadas do dia
    const now = Date.now();
    if(now < data.roundTimes[nextRound] - TRAINERS_LEAGUE_TEAM_SWAP_DEADLINE_MS) return; // ainda não chegou a hora dessa rodada
    const regsSnap = await trainersLeagueRegistrantsRef(dateId).get();
    // o título de campeão da Elite pode ter sido conquistado DEPOIS da trava do dia -- data.players e
    // as partidas já travam esse dado na hora do sorteio e nunca mais reconferem sozinhos. Só reflete
    // em partidas AINDA NÃO resolvidas (as já resolvidas são histórico fixo, não faz sentido reescrever)
    let eliteChanged = false;
    for(const regDoc of regsSnap.docs){
      const reg = regDoc.data();
      if(!reg.uid) continue;
      try{
        const eligibleCodes = await trainersLeagueGatherEligibleCodesForUid(reg.uid);
        if(eligibleCodes.length > 0){
          await trainersLeagueRegistrantRef(dateId, reg.uid).set({ eligibleCodes }, { merge:true });
        }
        const userSnap = await db.collection('users').doc(reg.uid).get();
        const isElite = !!(userSnap.exists && userSnap.data().eliteChampion);
        const playerEntry = (data.players||[]).find(p=>p.uid===reg.uid);
        if(playerEntry && !!playerEntry.elite !== isElite){
          playerEntry.elite = isElite;
          eliteChanged = true;
          for(const round of (data.scheduleRounds||[])){
            for(const match of round.matches){
              if(match.resolved) continue;
              if(match.a && match.a.uid===reg.uid){ match.a.elite = isElite; }
              if(match.b && match.b.uid===reg.uid){ match.b.elite = isElite; }
            }
          }
        }
      } catch(e){ logger.error('Erro ao atualizar times elegíveis de '+reg.uid+':', e); }
    }
    const payload = { eligibleRefreshedThroughRound: nextRound };
    if(eliteChanged){ payload.players = data.players; payload.scheduleRounds = data.scheduleRounds; }
    await ref.set(payload, { merge:true });
  } catch(e){ logger.error('Erro ao atualizar times elegíveis do Trainers League:', e); }
}
const TRAINERS_LEAGUE_TERRAIN_PICK_DEADLINE_MS = 10 * 60 * 1000;
const TRAINERS_LEAGUE_CLAIM_LEASE_MS = 2 * 60 * 1000; // prazo de validade da trava de processamento -- ver trainersLeagueClaim
// junta as duas formas possíveis do mapa por rodada: o formato CERTO (mapa aninhado, ex:
// overrides: {"5": code}) e o formato acidental antigo (campo com nome literal "overrides.5" no topo
// do documento). O acidente: set() com merge NÃO interpreta ponto como caminho aninhado -- isso é
// exclusivo do update(). As primeiras gravações usavam set com chave pontuada e criaram campos
// literais; esse normalizador resgata essas escolhas já feitas em vez de descartá-las
function extractRoundKeyedMap(docData, mapField){
  const out = {};
  if(docData && docData[mapField] && typeof docData[mapField] === 'object'){ Object.assign(out, docData[mapField]); }
  if(docData){
    for(const k of Object.keys(docData)){
      if(k.startsWith(mapField + '.')){ out[k.slice(mapField.length + 1)] = docData[k]; }
    }
  }
  return out;
}


function trainersLeagueTimeOnDate(dateStr, hour, minute){
  const hh = String(hour).padStart(2,'0');
  const mm = String(minute||0).padStart(2,'0');
  return new Date(`${dateStr}T${hh}:${mm}:00${TRAINERS_LEAGUE_TZ_OFFSET}`).getTime();
}
function trainersLeagueDateStrFromTime(timeMs){
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' });
  return fmt.format(new Date(timeMs));
}
function trainersLeagueTodayDateStr(){ return trainersLeagueDateStrFromTime(Date.now()); }
function trainersLeagueDateStrPlusDays(dateStr, days){
  const t = trainersLeagueTimeOnDate(dateStr, 12, 0);
  return trainersLeagueDateStrFromTime(t + days*24*60*60*1000);
}

function buildRoundRobinSchedule(players){
  const list = players.slice();
  if(list.length % 2 !== 0) list.push(null);
  const n = list.length;
  if(n < 2) return [];
  const numRounds = n - 1;
  // 1) gera os CONFRONTOS (quem joga com quem) pelo método do círculo -- só decide os pares, ainda
  // sem mandante/visitante definido
  const roundsPairs = [];
  let arr = list.slice();
  for(let r=0; r<numRounds; r++){
    const roundPairs = [];
    for(let i=0; i<n/2; i++){
      const p1 = arr[i], p2 = arr[n-1-i];
      if(p1 && p2){ roundPairs.push([p1, p2]); }
    }
    roundsPairs.push(roundPairs);
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr = [fixed, ...rest];
  }
  // 2) decide quem é mandante em cada confronto -- guloso: em cada partida, vira mandante quem tiver
  // MENOS jogos como mandante até agora (desempate: quem tiver MAIS jogos como visitante até agora).
  // O método do círculo puro deixa um jogador ("fixo") mandante em 100% dos jogos dele -- esse passo
  // evita isso, sem mudar quem joga contra quem
  const homeCount = {}, awayCount = {};
  players.forEach(p=>{ homeCount[p.uid]=0; awayCount[p.uid]=0; });
  const rounds = roundsPairs.map(roundPairs => ({
    matches: roundPairs.map(([p1,p2])=>{
      let home, away;
      if(homeCount[p1.uid] < homeCount[p2.uid]) { home=p1; away=p2; }
      else if(homeCount[p2.uid] < homeCount[p1.uid]) { home=p2; away=p1; }
      else if(awayCount[p1.uid] > awayCount[p2.uid]) { home=p1; away=p2; }
      else if(awayCount[p2.uid] > awayCount[p1.uid]) { home=p2; away=p1; }
      else { home=p1; away=p2; }
      homeCount[home.uid]++; awayCount[away.uid]++;
      return { a:home, b:away, winner:null, matchups:null, resolved:false, terrain:null };
    })
  }));
  // 3) polimento: passa de novo trocando mandante/visitante de uma partida sempre que isso reduz o
  // desbalanço total dos dois jogadores envolvidos -- o guloso sozinho já ajuda bastante, mas essa
  // passada extra (poucas iterações, sempre convergindo) deixa a diferença em no máximo ~1-2 jogos
  let improved = true, iterations = 0;
  while(improved && iterations < 200){
    improved = false; iterations++;
    for(const round of rounds){
      for(const m of round.matches){
        const beforeA = Math.abs(homeCount[m.a.uid]-awayCount[m.a.uid]);
        const beforeB = Math.abs(homeCount[m.b.uid]-awayCount[m.b.uid]);
        homeCount[m.a.uid]--; awayCount[m.b.uid]--;
        homeCount[m.b.uid]++; awayCount[m.a.uid]++;
        const afterA = Math.abs(homeCount[m.a.uid]-awayCount[m.a.uid]);
        const afterB = Math.abs(homeCount[m.b.uid]-awayCount[m.b.uid]);
        if((afterA+afterB) < (beforeA+beforeB)){
          const tmp = m.a; m.a = m.b; m.b = tmp;
          improved = true;
        } else {
          homeCount[m.a.uid]++; awayCount[m.b.uid]++;
          homeCount[m.b.uid]--; awayCount[m.a.uid]--;
        }
      }
    }
  }
  return rounds;
}

function resolveTrainersLeagueMatch(match, seedStr){
  const rng = makeSeededRng(seedStr);
  const teamA = decodeTeamCode(match.a.code);
  const teamB = decodeTeamCode(match.b.code);
  if(!teamA || !teamB){
    match.winner = teamA ? match.a : match.b;
    match.resolved = true;
    match.matchups = [];
    return;
  }
  if(match.terrain){
    const terrain = TERRAINS.find(t=>t.id===match.terrain.id);
    if(terrain){ applyTerrainBuff(teamA, terrain); applyTerrainBuff(teamB, terrain); }
  }
  applySpecialtyBuff(teamA, match.a && match.a.specialties); // idem: snapshot, ver resolveLeagueMatch
  applySpecialtyBuff(teamB, match.b && match.b.specialties);
  const result = simulateGymBattle(teamA, teamB, rng);
  match.matchups = result.matchups;
  match.winner = result.win ? match.a : match.b;
  match.resolved = true;
}

// classificação: vitórias primeiro; empate em vitórias é desempatado por confronto direto (se um dos
// empatados venceu o outro); se ainda empatado, dividem a mesma posição -- espelha exatamente a versão
// do cliente (pokemon-ginasio.html), precisa pra saber quem foi campeão do dia e registrar no ranking
function computeTrainersLeagueStandings(players, scheduleRounds){
  const stats = {};
  players.forEach(p=>{ stats[p.uid] = { uid:p.uid, name:p.name, slot:p.slot, elite: !!p.elite, wins:0, losses:0, played:0, headToHead:{} }; });
  (scheduleRounds||[]).forEach(round=>{
    round.matches.forEach(match=>{
      if(!match.resolved || !match.a || !match.b || !match.winner) return;
      const winnerUid = match.winner.uid;
      const loserUid = (match.a.uid===winnerUid) ? match.b.uid : match.a.uid;
      if(stats[winnerUid]){ stats[winnerUid].wins++; stats[winnerUid].played++; stats[winnerUid].headToHead[loserUid]='W'; }
      if(stats[loserUid]){ stats[loserUid].losses++; stats[loserUid].played++; stats[loserUid].headToHead[winnerUid]='L'; }
    });
  });
  const list = Object.values(stats);
  list.sort((x,y)=>{
    if(y.wins !== x.wins) return y.wins - x.wins;
    if(x.headToHead[y.uid]==='W') return -1;
    if(y.headToHead[x.uid]==='W') return 1;
    return x.name.localeCompare(y.name);
  });
  let rank = 1;
  list.forEach((entry, idx)=>{
    if(idx>0){
      const prev = list[idx-1];
      const trulyTied = prev.wins===entry.wins && prev.headToHead[entry.uid]!=='W' && entry.headToHead[prev.uid]!=='W';
      if(!trulyTied){ rank = idx+1; }
    }
    entry.rank = rank;
  });
  return list;
}

// DESEMPATE NO TOPO: quando o dia acaba com 2+ treinadores empatados em 1º (mesmas vitórias, sem
// confronto direto que resolva), monta um mini-campeonato SÓ entre os empatados -- cada par joga uma
// vez, terreno sorteado por partida -- e usa o resultado desse mini-campeonato pra decidir quem fica
// com o rank 1 sozinho. Quem "perde" o desempate sobe pros ranks seguintes na ordem que ficou lá.
function buildTrainersLeagueTiebreak(dateId, players, standings){
  // empate de verdade = MESMO número de vitórias no topo -- não usa s.rank aqui de propósito: como
  // todo mundo joga contra todo mundo, o desempate por confronto direto (já usado pra ordenar a
  // classificação) sempre decide o rank entre 2 jogadores específicos que se enfrentaram, então nunca
  // haveria empate de rank de verdade pra detectar. Quem "empatou" pra fins de campeonato é quem tem
  // o mesmo total de vitórias do líder, ignorando o que o confronto direto já decidiu silenciosamente
  if(!standings.length) return null;
  const topWins = standings[0].wins;
  const topTied = standings.filter(s=>s.wins === topWins);
  if(topTied.length <= 1) return null;
  const tiedPlayers = topTied.map(t=>{
    // sorteia um time elegível pra decidir o desempate -- não existe mais time "padrão" da inscrição,
    // então quem empatou joga o desempate com um dos times prontos dele, sorteado de forma determinística
    const p = players.find(pp=>pp.uid===t.uid);
    const eligible = (p && p.eligibleCodes) ? p.eligibleCodes : [];
    const rng = makeSeededRng(`trainers-tiebreak-team-${dateId}-${t.uid}`);
    const code = eligible.length>0 ? eligible[Math.floor(rng()*eligible.length)] : null;
    return { uid:t.uid, name:t.name, code };
  });
  const miniRounds = buildRoundRobinSchedule(tiedPlayers);
  miniRounds.forEach((round, ri)=>{
    round.matches.forEach((match, mi)=>{
      const rng = makeSeededRng(`trainers-tiebreak-${dateId}-R${ri}-M${mi}`);
      const terrain = pickTerrain(rng, null);
      match.terrain = { id: terrain.id, name: terrain.name, icon: terrain.icon, types: terrain.types };
      if(match.a.code && match.b.code){
        resolveTrainersLeagueMatch(match, `trainers-tiebreak-match-${dateId}-R${ri}-${match.a.uid}-${match.b.uid}`);
      } else {
        // sem time válido pra decidir -- não deveria acontecer (quem chega no topo já jogou a
        // temporada inteira com time válido), mas não trava o encerramento da liga por segurança
        match.winner = match.a.code ? match.a : match.b;
        match.resolved = true; match.matchups = [];
      }
    });
  });
  return { players: tiedPlayers, scheduleRounds: miniRounds };
}
// aplica um desempate JÁ CALCULADO (vindo do documento salvo) sobre a classificação atual -- usado toda
// vez que a tela precisa mostrar a colocação final, sem precisar rejogar o desempate de novo
function applyTrainersLeagueTiebreak(standings, tiebreak){
  if(!tiebreak || !tiebreak.scheduleRounds) return standings;
  const miniStandings = computeTrainersLeagueStandings(tiebreak.players, tiebreak.scheduleRounds);
  const order = {};
  miniStandings.forEach((s, idx)=>{ order[s.uid] = idx; });
  standings.forEach(s=>{ if(order[s.uid] !== undefined){ s.rank = 1 + order[s.uid]; } });
  standings.sort((a,b)=>a.rank-b.rank);
  return standings;
}
// classificação final pronta pra exibir/gravar -- já com o desempate aplicado, se tiver acontecido
function computeTrainersLeagueStandingsFinal(data){
  const standings = computeTrainersLeagueStandings(data.players, data.scheduleRounds);
  return applyTrainersLeagueTiebreak(standings, data.tiebreak);
}

async function trainersLeagueEnsureCycleDoc(dateId){
  try{
    const ref = trainersLeagueCycleRef(dateId);
    const snap = await ref.get();
    if(!snap.exists){ await ref.set({ dateId, status:'registering', createdAt: Date.now() }, { merge:true }); }
  } catch(e){ logger.error('Erro ao preparar o ciclo do Trainers League:', e); }
}

async function trainersLeagueClaim(dateId, fromStatus, toStatus){
  try{
    return await db.runTransaction(async (tx)=>{
      const ref = trainersLeagueCycleRef(dateId);
      const snap = await tx.get(ref);
      if(!snap.exists) return false;
      const data = snap.data();
      // trava com prazo de validade: se o status já está no estado transitório que essa operação
      // criaria (ex: 'advancing' quando alguém tenta avançar) mas a trava é VELHA (mais de 2min),
      // quem segurava morreu no meio (aba fechada, rede caiu) -- pode roubar e refazer. Sem isso, uma
      // aba que morre no meio do avanço deixa a liga presa em 'advancing' PRA SEMPRE, porque todo
      // mundo só consegue pegar a trava a partir de 'locked'/'active'. Roubo só do MESMO estado
      // transitório de propósito -- um avanço nunca rouba um 'locking' morto (pularia a trava de
      // inscrições com o chaveamento ainda não montado)
      const staleClaim = data.status === toStatus &&
        (!data.claimedAt || (Date.now() - data.claimedAt) > TRAINERS_LEAGUE_CLAIM_LEASE_MS);
      if(data.status !== fromStatus && !staleClaim) return false;
      tx.set(ref, { status: toStatus, claimedAt: Date.now() }, { merge:true });
      return true;
    });
  } catch(e){ logger.warn('trainersLeagueClaim falhou (provavelmente outro processo já pegou):', e.message); return false; }
}

// monta e grava o payload de UM ciclo travado (jogadores + calendário de rodadas) -- usado tanto pro
// ciclo principal do dia (cycleId===dateId) quanto pra qualquer ciclo-irmão extra (cycleId com sufixo
// __L2, __L3...), quando mais de 16 pessoas se inscrevem e precisa dividir em várias ligas simultâneas
// no mesmo dia. startTime sempre usa o dateId REAL (não o cycleId, que pode ter sufixo) -- é dele que
// vem o horário oficial de início do dia
async function trainersLeagueLockGroupInto(cycleId, group, dateId){
  const players = group.map(r=>({ uid:r.uid, name:r.name, elite: !!r.elite, eligibleCodes:r.eligibleCodes||[], specialties:r.specialties||[], mewtwoTeamCode:r.mewtwoTeamCode||null }));
  const shuffled = shuffleWithSeed(players, `trainers-${cycleId}`);
  const scheduleRounds = buildRoundRobinSchedule(shuffled);
  const numRounds = scheduleRounds.length;
  const normalStartTime = trainersLeagueTimeOnDate(dateId, TRAINERS_LEAGUE_START_HOUR, TRAINERS_LEAGUE_START_MIN);
  const startTime = Math.max(normalStartTime, Date.now());
  const roundTimes = [];
  for(let i=0;i<numRounds;i++){ roundTimes.push(startTime + i*TRAINERS_LEAGUE_ROUND_MS); }
  await trainersLeagueCycleRef(cycleId).set({
    dateId: cycleId, status: numRounds>0 ? 'locked' : 'complete',
    players, scheduleRounds, roundTimes, currentRound: 0,
    lockedAt: Date.now(), updatedAt: Date.now()
  }, { merge:true });
  if(numRounds>0){
    for(const p of players){
      createNotification(p.uid, 'league_started', '🏆 Sua Trainers League começou!',
        `A Trainers League de hoje travou com ${players.length} treinadores e ${numRounds} rodada${numRounds===1?'':'s'}. Boa sorte!`,
        { leagueTypeId: TRAINERS_LEAGUE_TYPE, dateId: cycleId });
    }
  }
}

/* Divide os inscritos do dia nas ligas do dia. PURA de propósito: foi um erro aqui que derrubou a
   liga de 31/08/2026, e separada ela dá pra testar sem relógio e sem Firestore (ver
   tools/test-liga-treinadores.js).

   Regra: grupos de até 16, na ordem de inscrição. O último grupo -- o "resto" -- só é dissolvido
   pro dia seguinte quando OUTRA liga já se formou. Ex: 34 inscritos -> 2 ligas de 16 e 2 pessoas
   pra amanhã; 30 -> uma de 16 e uma de 14.

   O QUE DEU ERRADO EM 31/08/2026: a condição era `groups.length>0`, então um dia com 4 inscritos
   dissolvia o ÚNICO grupo e não formava liga nenhuma. Pior que perder o dia: como nenhum grupo é
   gravado, ninguém chama o trainersLeagueLockGroupInto (é ele quem grava 'locked'), e o ciclo ficou
   parado em 'locking'. A tela anunciava "Chaveamento sorteado" sem chaveamento, o agendador
   re-travava a cada 2 minutos (trava vencida é roubável) e cada volta mandava outra notificação de
   adiamento pros mesmos 4 -- e no dia seguinte repetiria, pra sempre.
   Com um grupo só, o mínimo não vale: 2 pessoas já são uma liga. */
function trainersLeagueSplitGroups(ordered){
  const groups = [];
  let idx = 0;
  while(idx < ordered.length){
    groups.push(ordered.slice(idx, idx+TRAINERS_LEAGUE_MAX_PLAYERS));
    idx += TRAINERS_LEAGUE_MAX_PLAYERS;
  }
  let leftover = [];
  if(groups.length>1 && groups[groups.length-1].length <= TRAINERS_LEAGUE_MIN_TO_FORM){
    leftover = groups.pop();
  }
  // um grupo de 1 não é liga: o round-robin sai com 0 rodadas. Esse fica pra amanhã de verdade.
  if(groups.length===1 && groups[0].length < 2){
    leftover = groups.pop();
  }
  return { groups, leftover };
}
async function trainersLeagueDoLock(dateId){
  const claimed = await trainersLeagueClaim(dateId, 'registering', 'locking');
  if(!claimed) return false;
  try{
    const regSnap = await trainersLeagueRegistrantsRef(dateId).get();
    const registrants = regSnap.docs.map(d=>d.data());
    const ordered = registrants.slice().sort((a,b)=>(a.registeredAt||0)-(b.registeredAt||0));

    const { groups, leftover } = trainersLeagueSplitGroups(ordered);

    // o PRIMEIRO grupo sempre usa o ciclo principal do dia (dateId) -- mantém 100% de compatibilidade
    // com tudo que já assume "o ciclo de hoje é só esse documento". Cada grupo ADICIONAL vira um
    // ciclo-irmão com ID próprio, usando a MESMA função de trava -- o ciclo principal guarda a lista
    // desses irmãos (siblingCycleIds), pra quem for procurar (avanço de rodadas, o cliente) conseguir achar
    const siblingIds = [];
    for(let g=0; g<groups.length; g++){
      const cycleId = g===0 ? dateId : `${dateId}__L${g+1}`;
      if(g>0){ siblingIds.push(cycleId); }
      await trainersLeagueLockGroupInto(cycleId, groups[g], dateId);
    }
    await trainersLeagueCycleRef(dateId).set({ siblingCycleIds: siblingIds }, { merge:true });
    /* SEM NENHUM GRUPO o ciclo tem que ir pra um estado FINAL aqui mesmo. Quem grava 'locked' é o
       trainersLeagueLockGroupInto, que nesse caso não roda -- e um ciclo parado em 'locking' faz o
       agendador voltar aqui a cada 2 minutos pra sempre, mandando notificação nova a cada volta.
       O noLeagueReason é o que deixa a tela dizer a verdade em vez de "chaveamento sorteado". */
    if(groups.length===0){
      await trainersLeagueCycleRef(dateId).set({
        status: 'complete', players: [], scheduleRounds: [], roundTimes: [], currentRound: 0,
        noLeagueReason: 'poucos-inscritos', noLeagueCount: leftover.length, updatedAt: Date.now()
      }, { merge:true });
    }

    const nextDateId = trainersLeagueDateStrPlusDays(dateId, 1);
    await trainersLeagueEnsureCycleDoc(nextDateId);
    for(const p of leftover){
      await trainersLeagueRegistrantRef(nextDateId, p.uid).set(p, { merge:true });
    }
    if(leftover.length>0){
      for(const p of leftover){
        createNotification(p.uid, 'league_delayed', '⏳ Sua Trainers League foi adiada',
          `Hoje não deu pra formar mais uma liga com quem sobrou (só ${leftover.length} treinador${leftover.length===1?'':'es'} de fora das ligas já formadas). Você já está inscrito com prioridade pra próxima Trainers League.`,
          { leagueTypeId: TRAINERS_LEAGUE_TYPE, dateId: nextDateId });
      }
    }

    logger.info(`Trainers League ${dateId} travado e sorteado: ${groups.length} liga(s) (${groups.map(g=>g.length).join('+')} jogadores), ${leftover.length} adiado(s) pra amanhã.`);
    return true;
  } catch(e){
    logger.error('Erro ao travar/sortear o Trainers League:', e);
    await trainersLeagueClaim(dateId, 'locking', 'registering');
    return false;
  }
}

// checagem BARATA (só leitura, sem transação) se tem trabalho de verdade pra fazer agora -- terreno
// pra finalizar, partida pra resolver, ou o dia inteiro pronto pra fechar mas ainda não marcado como
// 'complete'. Usa continue em vez de break de propósito (mais seguro que a otimização por ordem que o
// corpo da função usa) -- é só leitura em memória, custo irrelevante, e nunca arrisca falso negativo
function trainersLeagueHasPendingWork(data){
  if(!data || !data.scheduleRounds || !data.roundTimes) return false;
  const now = Date.now();
  let anyUnresolved = false;
  for(let ri=0; ri<data.scheduleRounds.length; ri++){
    const round = data.scheduleRounds[ri];
    const roundTime = data.roundTimes[ri];
    if(roundTime==null || !round || !round.matches) continue;
    for(const match of round.matches){
      if(!match.resolved){
        anyUnresolved = true;
        if(now >= roundTime) return true;
      }
      if(!match.terrain && now >= roundTime - TRAINERS_LEAGUE_TERRAIN_PICK_DEADLINE_MS) return true;
    }
  }
  if(!anyUnresolved && data.status !== 'complete') return true; // tudo resolvido, só falta fechar o dia
  return false;
}
async function trainersLeagueAdvanceRounds(dateId){
  // evita disputar a trava (que é uma transação de ESCRITA) no documento compartilhado quando não há
  // nada pra fazer -- sem isso, cada cliente com a tela aberta tentava uma transação a cada 5s mesmo
  // no meio do intervalo entre rodadas, quando não existe trabalho nenhum
  try{
    const precheckSnap = await trainersLeagueCycleRef(dateId).get();
    if(!precheckSnap.exists) return false;
    if(!trainersLeagueHasPendingWork(precheckSnap.data())) return false;
  } catch(e){ logger.error('Erro na checagem prévia do Trainers League:', e); }
  let claimed = await trainersLeagueClaim(dateId, 'locked', 'advancing');
  if(!claimed) claimed = await trainersLeagueClaim(dateId, 'active', 'advancing');
  if(!claimed) return false;
  try{
    const ref = trainersLeagueCycleRef(dateId);
    const snap = await ref.get();
    if(!snap.exists) return false;
    const data = snap.data();
    const now = Date.now();
    let anyResolved = false;

    // 1) finaliza o terreno de toda partida cujo prazo do mandante (10min antes) já passou e ainda não
    // tem terreno definido -- usa a escolha dele se ele fez uma a tempo, senão sorteia (como sempre foi)
    for(let ri=0; ri<(data.scheduleRounds||[]).length; ri++){
      if(now < data.roundTimes[ri] - TRAINERS_LEAGUE_TERRAIN_PICK_DEADLINE_MS) break;
      const round = data.scheduleRounds[ri];
      for(let mi=0; mi<round.matches.length; mi++){
        const match = round.matches[mi];
        if(match.terrain) continue;
        let chosen = null;
        try{
          const pickSnap = await trainersLeagueTerrainPickRef(dateId, match.a.uid).get();
          const picks = extractRoundKeyedMap(pickSnap.exists ? pickSnap.data() : null, 'picks');
          const terrainId = picks[String(ri)];
          if(terrainId){ chosen = TERRAINS.find(t=>t.id===terrainId) || null; }
        } catch(e){ logger.error('Erro ao ler escolha de terreno do mandante:', e); }
        if(!chosen){
          const rng = makeSeededRng(`trainers-terrain-${dateId}-R${ri}-M${mi}`);
          chosen = pickTerrain(rng, null);
        }
        match.terrain = { id: chosen.id, name: chosen.name, icon: chosen.icon, types: chosen.types };
        anyResolved = true;
      }
    }

    // 2) resolve as partidas cujo horário já chegou. Pra cada lado:
    //    - lê o documento FRESCO do inscrito (não a cópia congelada da trava em data.players -- essa
    //      cópia nunca recebia as atualizações automáticas de times elegíveis, que gravam no doc do
    //      inscrito; era um bug: um save novo zerado durante o dia nunca entrava de verdade no sorteio)
    //    - se o jogador trocou de time pra rodada (override), SÓ aceita se o conjunto de pokémon bater
    //      com algum time que ele realmente possui (assinatura independente de ordem contra os elegíveis)
    //      -- a ordem escolhida é respeitada, mas um código forjado de time que ele nunca teve é ignorado
    //    - tudo passa por sanitizeTeamCode: stats reconstruídos da espécie, nível limitado ao teto
    for(let ri=0; ri<(data.scheduleRounds||[]).length; ri++){
      if(now < data.roundTimes[ri]) break;
      const round = data.scheduleRounds[ri];
      for(const match of round.matches){
        if(!match.resolved){
          for(const side of ['a','b']){
            const uid = match[side].uid;
            // monta a lista de elegíveis a partir do doc fresco do inscrito (server-derived após o
            // refresh automático de 5min antes) -- com fallback pra cópia da trava se a leitura falhar
            let eligible = [];
            let mewtwoCode = null;
            try{
              const regSnap = await trainersLeagueRegistrantRef(dateId, uid).get();
              if(regSnap.exists){
                const reg = regSnap.data();
                eligible = (reg.eligibleCodes||[]).map(sanitizeTeamCode).filter(Boolean);
                if(reg.mewtwoTeamCode){ mewtwoCode = sanitizeTeamCode(reg.mewtwoTeamCode); }
              }
            } catch(e){ logger.error('Erro ao ler inscrito na resolução:', e); }
            if(eligible.length===0){
              const playerInfo = (data.players||[]).find(p=>p.uid===uid);
              eligible = ((playerInfo && playerInfo.eligibleCodes) || []).map(sanitizeTeamCode).filter(Boolean);
              if(playerInfo && playerInfo.mewtwoTeamCode && !mewtwoCode){ mewtwoCode = sanitizeTeamCode(playerInfo.mewtwoTeamCode); }
            }
            if(mewtwoCode){ eligible.push(mewtwoCode); }

            let code = null;
            try{
              const pickSnap = await trainersLeagueTeamPickRef(dateId, uid).get();
              const overrides = extractRoundKeyedMap(pickSnap.exists ? pickSnap.data() : null, 'overrides');
              const overrideRaw = overrides[String(ri)] || null;
              if(overrideRaw){
                const overrideClean = sanitizeTeamCode(overrideRaw);
                const overrideSig = overrideClean ? teamCodeSignature(overrideClean) : null;
                const eligibleSigs = new Set(eligible.map(teamCodeSignature).filter(Boolean));
                if(overrideSig && eligibleSigs.has(overrideSig)){
                  code = overrideClean; // conjunto confere com um time real do jogador -- ordem escolhida respeitada
                } else {
                  logger.warn(`Override de time rejeitado (não bate com nenhum time do jogador) -- uid=${uid} rodada=${ri}`);
                }
              }
            } catch(e){ logger.error('Erro ao ler troca de time da rodada:', e); }
            if(!code){
              // sem troca válida -- sorteia entre os elegíveis (o time do Mewtwo, se ativado, entra no
              // mesmo sorteio: "disponível o dia todo")
              if(eligible.length>0){
                const rng = makeSeededRng(`trainers-randomteam-${dateId}-R${ri}-${uid}`);
                code = eligible[Math.floor(rng()*eligible.length)];
              }
            }
            if(code){ match[side].code = code; }
          }
          resolveTrainersLeagueMatch(match, `trainers-match-${dateId}-R${ri}-${match.a.uid}-${match.b.uid}`);
          await storeMatchLogAndStrip(trainersLeagueCycleRef(dateId).collection('matchLogs'), `R${ri}_M${round.matches.indexOf(match)}`, match);
          anyResolved = true;
          if(match.matchups && match.matchups.length > 0){ // pula W.O./bye -- não é uma partida de verdade
            const aWon = match.winner.uid === match.a.uid;
            createNotification(match.a.uid, 'match_played',
              aWon ? '🏆 Você venceu na Trainers League!' : '💥 Você perdeu na Trainers League',
              `Seu confronto contra ${match.b.name} terminou: ${aWon?'vitória':'derrota'}.`,
              { leagueTypeId: TRAINERS_LEAGUE_TYPE, opponentName: match.b.name, won: aWon });
            createNotification(match.b.uid, 'match_played',
              !aWon ? '🏆 Você venceu na Trainers League!' : '💥 Você perdeu na Trainers League',
              `Seu confronto contra ${match.a.name} terminou: ${!aWon?'vitória':'derrota'}.`,
              { leagueTypeId: TRAINERS_LEAGUE_TYPE, opponentName: match.a.name, won: !aWon });
          }
        }
      }
    }
    const allDone = (data.scheduleRounds||[]).every(round => round.matches.every(m=>m.resolved));
    data.status = allDone ? 'complete' : 'active';
    data.updatedAt = Date.now();
    let finalStandings = null;
    if(allDone){
      // acabou o dia -- se tiver empate no topo, resolve com uma batalha de desempate ANTES de gravar,
      // pra já sair do banco com o campeão único definido (não fica um segundo write separado)
      let standings = computeTrainersLeagueStandings(data.players, data.scheduleRounds);
      const tiebreak = buildTrainersLeagueTiebreak(dateId, data.players, standings);
      if(tiebreak){
        data.tiebreak = tiebreak;
        standings = applyTrainersLeagueTiebreak(standings, tiebreak);
        logger.info(`Trainers League ${dateId}: empate no topo resolvido por desempate.`);
      }
      finalStandings = standings;
    }
    await ref.set(data, { merge:false });
    if(allDone && finalStandings){
      // registra quem terminou em 1º no ranking global de vencedores (já com o desempate aplicado,
      // então só sobra 1 campeão aqui, a não ser no caso raríssimo do próprio desempate empatar de novo)
      for(const champ of finalStandings.filter(s=>s.rank===1)){
        await recordLeagueChampionWin(champ.name, champ.uid, TRAINERS_LEAGUE_TYPE, !!champ.elite);
      }
      // avisa TODO MUNDO que participou -- não só quem venceu -- com a colocação final de cada um e
      // quem foi o campeão do dia
      const championName = finalStandings.filter(s=>s.rank===1).map(s=>s.name).join(' e ');
      for(const entry of finalStandings){
        if(!entry.uid) continue;
        const isChampion = entry.rank===1;
        createNotification(entry.uid, 'league_ended',
          isChampion ? '🏆 Você foi o campeão da Trainers League!' : '🏁 A Trainers League de hoje acabou',
          isChampion
            ? `Você terminou em 1º lugar com ${entry.wins} vitória${entry.wins===1?'':'s'} e ${entry.losses} derrota${entry.losses===1?'':'s'}!`
            : `O campeão foi ${championName}. Você terminou com ${entry.wins} vitória${entry.wins===1?'':'s'} e ${entry.losses} derrota${entry.losses===1?'':'s'}.`,
          { leagueTypeId: TRAINERS_LEAGUE_TYPE, dateId, wins: entry.wins, losses: entry.losses, rank: entry.rank, championName }
        );
      }
      logger.info(`Trainers League ${dateId} encerrado. Campeão(ões): ${finalStandings.filter(s=>s.rank===1).map(s=>s.name).join(', ')}`);
    }
    return anyResolved || allDone;
  } catch(e){
    logger.error('Erro ao avançar rodadas do Trainers League:', e);
    await trainersLeagueClaim(dateId, 'advancing', 'locked');
    return false;
  }
}

async function checkAndAdvanceTrainersLeague(dateId){
  await trainersLeagueEnsureCycleDoc(dateId);
  const snap = await trainersLeagueCycleRef(dateId).get();
  if(!snap.exists) return false;
  const data = snap.data();
  const now = Date.now();
  const lockTime = trainersLeagueTimeOnDate(dateId, TRAINERS_LEAGUE_LOCK_HOUR, TRAINERS_LEAGUE_LOCK_MIN);
  // estados transitórios ('locking'/'advancing') TAMBÉM chamam a operação correspondente -- é dentro
  // dela (no trainersLeagueClaim) que mora a decisão de roubar ou não uma trava vencida. Sem isso,
  // uma liga presa em 'advancing' (processo morto no meio) ficava presa PRA SEMPRE: o porteiro aqui
  // via o status transitório, não chamava nada, e o código de recuperação nunca era alcançado
  if((data.status==='registering' || data.status==='locking') && now >= lockTime){
    return await trainersLeagueDoLock(dateId);
  }
  if(data.status==='locked' || data.status==='active' || data.status==='advancing'){
    return await trainersLeagueAdvanceRounds(dateId);
  }
  return false;
}

// exportado só pro teste: é a regra que decide se o dia tem liga (ver tools/test-liga-treinadores.js)
/* exportados só pro teste que compara os DOIS motores golpe a golpe (ver
   scratchpad/confere-motores.js e tools/test-especiais.js): cliente e servidor precisam dar o
   mesmo resultado com a mesma semente, senão a liga decide uma coisa e a animação mostra outra. */
exports._simulateGymBattle = simulateGymBattle;
exports._createInstance = createInstance;
exports._makeSeededRng = makeSeededRng;
exports._golpesEspeciais = { AUTODESTRUICAO, SONIFEROS, METRONOMO, CHANCE_AUTODESTRUICAO, CHANCE_SONO };
exports._trainersLeagueSplitGroups = trainersLeagueSplitGroups;
exports.advanceTrainersLeague = onSchedule('every 1 minutes', async (event) => {
  try{
    const todayStr = trainersLeagueTodayDateStr();
    const tomorrowStr = trainersLeagueDateStrPlusDays(todayStr, 1);
    // confere hoje (pode estar em qualquer fase: inscrevendo, travando, avançando rodadas) e amanhã
    // (pode já existir por causa do overflow de inscritos excedentes de hoje, mas nunca precisa de
    // avanço de fase antes da própria janela dele abrir)
    const changedToday = await checkAndAdvanceTrainersLeague(todayStr);
    const changedTomorrow = await checkAndAdvanceTrainersLeague(tomorrowStr);
    // processa também qualquer ciclo-irmão (ligas extras, quando mais de 16 pessoas se inscreveram num
    // mesmo dia e precisou dividir em várias ligas simultâneas) -- eles não aparecem em nenhum lugar
    // fixo, só na lista guardada no ciclo principal do dia que os originou
    let changedSiblings = false;
    const siblingIdsByParent = {};
    for(const parentId of [todayStr, tomorrowStr]){
      const parentSnap = await trainersLeagueCycleRef(parentId).get();
      const siblingIds = (parentSnap.exists && parentSnap.data().siblingCycleIds) || [];
      siblingIdsByParent[parentId] = siblingIds;
      for(const sid of siblingIds){
        const c = await checkAndAdvanceTrainersLeague(sid);
        if(c){ changedSiblings = true; }
      }
    }
    if(changedToday || changedTomorrow || changedSiblings){ logger.info('Trainers League avançado pelo Cloud Function.'); }
    await trainersLeagueRefreshEligibleCodes(todayStr); // só hoje -- amanhã ainda não tem rodadas travadas
    for(const sid of (siblingIdsByParent[todayStr]||[])){ await trainersLeagueRefreshEligibleCodes(sid); }
  } catch(e){ logger.error('Erro ao avançar o Trainers League:', e); }
});

/* =====================================================================
   GINÁSIO DA CIDADE -- localiza a cidade via geocodificação reversa (Nominatim/
   OSM) e usa ela sozinha como escopo do ginásio (era por bairro antes; ficou
   concentrado em cidade pra ter gente suficiente disputando o mesmo posto
   enquanto o número de jogadores em teste ainda é pequeno -- bairro fica pra
   um segundo nível quando isso crescer)
   ===================================================================== */
function normalizeNeighborhoodName(s){
  return String(s||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,''); // remove acento pra comparar sem depender de escrita exata
}
function neighborhoodGymId(city, countryCode){
  return normalizeNeighborhoodName(city).replace(/\s+/g,'_') + (countryCode ? '__'+countryCode.toLowerCase() : '');
}
function neighborhoodGymRef(city, countryCode){
  return db.collection('neighborhoodGyms').doc(neighborhoodGymId(city, countryCode));
}
// índice reverso: uid+slot -> qual ginásio esse time defende AGORA (no máximo um). É isso que impede
// o mesmo time de liderar 2 ginásios ao mesmo tempo -- sem esse índice, não teria como checar "esse
// time já está em uso em outro lugar" sem varrer TODOS os ginásios do mundo a cada atribuição
function neighborhoodGymDefenseIndexRef(uid, slot){
  return db.collection('neighborhoodGymActiveDefenses').doc(`${uid}_${slot}`);
}
// trava de "só um desafio por vez, POR GINÁSIO" -- não impede corrida nenhuma sozinha (checar e gravar
// em passos separados teria o MESMO problema que ela tenta resolver), mas o CHECK-E-GRAVA dela roda
// dentro de uma transação pequena e rápida (só esse documento, nada de simular batalha), então o
// próprio Firestore serializa quem consegue a trava -- só um vence, os outros descobrem isso na hora,
// sem precisar entrar na transação PESADA (a que resolve a luta de verdade) pra descobrir que perderam
function neighborhoodGymChallengeLockRef(gymRef){
  return gymRef.collection('meta').doc('challengeLock');
}
const NEIGHBORHOOD_GYM_CHALLENGE_LOCK_TIMEOUT_MS = 15000; // se travar e nunca liberar (erro/queda), libera sozinho depois disso
// melhor marca HISTÓRICA de um treinador como líder DESSE ginásio específico -- guarda o pico de
// vitórias em sequência e de dias como líder já alcançados por ele, mesmo depois de ser destronado
// (se não fosse por isso, os números do líder anterior se perderiam pra sempre na hora da troca)
function neighborhoodGymLeaderRecordRef(gymRef, uid){
  return gymRef.collection('leaderRecords').doc(uid);
}

// chamado pelo cliente quando a localização salva está desatualizada (comparação de distância feita
// no PRÓPRIO cliente, pra nem chamar essa função à toa quando a pessoa não se moveu). Só o servidor
// fala com o Nominatim -- centraliza e limita o ritmo de chamadas pro serviço gratuito deles
exports.resolveNeighborhood = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const { lat, lon } = request.data || {};
  if(typeof lat !== 'number' || typeof lon !== 'number'){
    throw new HttpsError('invalid-argument', 'Coordenadas inválidas.');
  }
  try{
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'JornadaKanto-FanGame/1.0 (contato via app)' } // exigido pela política de uso do Nominatim
    });
    if(!resp.ok){ throw new HttpsError('unavailable', 'Serviço de localização indisponível no momento.'); }
    const data = await resp.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.municipality || null;
    const countryCode = addr.country_code || null;
    // extrai a sigla do estado do campo ISO3166-2-lvl4 (formato "BR-SP") -- pega só a parte depois
    // do hífen. Nem toda localidade do mundo tem esse campo preenchido, então fica null se não tiver
    const isoState = addr['ISO3166-2-lvl4'];
    const stateAbbr = (isoState && isoState.includes('-')) ? isoState.split('-')[1] : null;
    return { city, countryCode, stateAbbr, hasGym: !!city, lat, lon };
  } catch(e){
    if(e instanceof HttpsError) throw e;
    logger.error('Erro ao geocodificar localização:', e);
    throw new HttpsError('internal', 'Não foi possível identificar sua cidade agora.');
  }
});

// detalhe completo do ginásio de UMA cidade específica -- líder, prévia do time dele (só o necessário
// pra desenhar sprite+nível, não os stats todos) e o terreno escolhido. É chamado toda vez que a tela
// abre, mesmo quando a localização em si veio do cache -- a liderança pode ter mudado sem a pessoa
// ter se movido nadinha
exports.getNeighborhoodGymDetail = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const { city, countryCode } = request.data || {};
  if(!city){ throw new HttpsError('invalid-argument', 'Cidade não informada.'); }
  const gymSnap = await neighborhoodGymRef(city, countryCode).get();
  if(!gymSnap.exists || !gymSnap.data().leaderUid){
    return { city, hasLeader: false };
  }
  const d = gymSnap.data();
  const team = decodeTeamCode(d.leaderTeamCode) || [];
  const terrain = TERRAINS.find(t=>t.id===d.leaderTerrain) || null;
  // dias seguidos como líder -- calculado aqui, não guardado, pra nunca ficar desatualizado. Reseta
  // sozinho porque becameLeaderAt também reseta toda vez que alguém novo assume o posto (seja
  // reivindicando um ginásio vago, seja vencendo o líder anterior)
  const daysAsLeader = d.becameLeaderAt ? Math.floor((Date.now() - d.becameLeaderAt) / (24*60*60*1000)) : 0;
  return {
    city, hasLeader: true,
    leaderUid: d.leaderUid, leaderName: d.leaderName,
    leaderTeamPreview: team.map(p=>({ speciesId:p.speciesId, level:p.level, shiny:!!p.shiny })),
    leaderTerrain: terrain, becameLeaderAt: d.becameLeaderAt, defenseCount: d.defenseCount||0,
    daysAsLeader, needsDefenseSetup: !d.leaderTeamCode || !d.leaderTerrain
  };
});

// reivindica um ginásio VAGO ou atualiza a defesa de um ginásio que a própria pessoa já lidera --
// escolher time+terreno de defesa nunca precisa de batalha (não tem quem desafiar num ginásio vago,
// e trocar sua PRÓPRIA defesa também não é uma disputa contra ninguém). Só falha se já existir um
// líder DIFERENTE -- nesse caso é preciso desafiar de verdade (challengeNeighborhoodGym)
exports.setNeighborhoodGymDefense = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { city, countryCode, team, terrainId } = request.data || {};
  // time e terreno agora são independentes: dá pra mandar só um dos dois. Reivindicar um ginásio vago
  // pela primeira vez exige pelo menos o time (checado mais abaixo, depois de saber se já tem líder)
  if(!city || (!Array.isArray(team) && !terrainId)){
    throw new HttpsError('invalid-argument', 'Informe pelo menos o time ou o terreno.');
  }
  if(terrainId && !TERRAINS.some(t=>t.id===terrainId)){ throw new HttpsError('invalid-argument', 'Terreno inválido.'); }
  const userSnap = await db.collection('users').doc(uid).get();

  /* O TIME É MONTADO, não é mais um save inteiro (01/09/2026). O jogador escolhe entre TODOS os
     pokémon dos saves dele com 8 insígnias, sem repetir espécie -- a mesma regra da Torre.
     O que fica guardado no ginásio continua sendo um CÓDIGO congelado: depois de montada, a defesa
     não depende mais dos saves, então mexer no save (ou apagá-lo) não muda quem defende. */
  let newTeamCode = null;
  if(Array.isArray(team)){
    const resolvido = await resolverTimeDosSaves(uid, team, NEIGHBORHOOD_GYM_TEAM_SIZE, 'time de defesa', 1);
    newTeamCode = sanitizeTeamCode(encodeTeamCode(resolvido));
    if(!newTeamCode){ throw new HttpsError('failed-precondition', 'Time inválido.'); }
  }
  const leaderName = (userSnap.exists && userSnap.data().trainerName) || 'Treinador';
  const leaderSpecialties = (userSnap.exists && userSnap.data().specialties) || []; // snapshot ao assumir/reconfigurar

  const gymRef = neighborhoodGymRef(city, countryCode);
  const thisGymId = neighborhoodGymId(city, countryCode);
  /* A EXCLUSIVIDADE POR TIME ACABOU e não foi esquecimento: ela dizia "um time (uid+slot) só
     defende UM ginásio", e com a defesa montada à mão não existe mais "o time do slot N" pra
     travar. Ficou o índice antigo, que continua sendo LIMPO abaixo, pra não deixar lixo apontando
     pra ginásio nenhum. Se um dia incomodar alguém liderar vários ginásios, o lugar de resolver é
     aqui, e a regra que cabe é "um ginásio por líder". */
  return await db.runTransaction(async (tx) => {
    // TODAS as leituras da transação vêm antes de qualquer escrita (regra do Firestore) -- por isso lê
    // o índice do time novo aqui em cima, mesmo só indo usar o resultado mais abaixo
    const gymSnap = await tx.get(gymRef);
    const gymData = gymSnap.exists ? gymSnap.data() : null;

    const hasOtherLeader = gymData && gymData.leaderUid && gymData.leaderUid !== uid;
    if(hasOtherLeader){
      throw new HttpsError('failed-precondition', 'Esse ginásio já tem líder -- desafie em vez de reivindicar.');
    }
    const isNewClaim = !gymData || !gymData.leaderUid;
    if(isNewClaim && newTeamCode===null){
      throw new HttpsError('failed-precondition', 'Escolha um time pra se tornar líder desse ginásio.');
    }
    // defesa antiga, presa a um save: ao montar time à mão o índice dela some (senão ficaria pra
    // sempre marcando "esse save defende alguma coisa", e é ele que faz a tela avisar antes de
    // apagar um save)
    if(newTeamCode !== null && gymData && gymData.leaderTeamSlot != null){
      tx.delete(neighborhoodGymDefenseIndexRef(uid, gymData.leaderTeamSlot));
    }

    tx.set(gymRef, {
      city, countryCode: countryCode||null,
      leaderUid: uid, leaderName, leaderSpecialties,
      // o que não foi mandado nessa chamada mantém o valor que já existia (ou null, se for reivindicação nova).
      // "!= null" (não "?") de propósito: documentos antigos, de antes desses campos existirem, têm
      // gymData.leaderTeamSlot/leaderTeamCode/leaderTerrain literalmente undefined (não null) --
      // e o Firestore de verdade REJEITA escrever undefined (só aceita null), quebrando a transação
      // inteira com "Cannot use undefined as a Firestore value" se isso vazar pro payload
      leaderTeamCode: newTeamCode!==null ? newTeamCode : ((gymData && gymData.leaderTeamCode!=null) ? gymData.leaderTeamCode : null),
      // null quando a defesa foi MONTADA (não vem de um save); documento antigo mantém o que tinha
      leaderTeamSlot: newTeamCode!==null ? null : ((gymData && gymData.leaderTeamSlot!=null) ? gymData.leaderTeamSlot : null),
      leaderTerrain: terrainId ? terrainId : ((gymData && gymData.leaderTerrain!=null) ? gymData.leaderTerrain : null),
      becameLeaderAt: isNewClaim ? Date.now() : (gymData.becameLeaderAt||Date.now()),
      defenseCount: isNewClaim ? 0 : (gymData.defenseCount||0)
    });
    return { ok:true, isNewClaim };
  });
});

// desafio de um ginásio de bairro COM líder -- resolvido inteiramente aqui (o cliente nunca calcula
// nem reporta um resultado; só manda QUEM está desafiando e QUAL bairro). O terreno usado é sempre o
// que o LÍDER escolheu como defesa -- vantagem de mandante, igual às ligas
const NEIGHBORHOOD_GYM_TEAM_SIZE = 6;
const NEIGHBORHOOD_GYM_CHALLENGE_COOLDOWN_MS = 10 * 60 * 1000; // 10min -- por time (uid+slot), por ginásio
/* Reordenar o time de defesa. Fica FORA do setNeighborhoodGymDefense de propósito: aquele resolve
   reivindicação de ginásio vago, exclusividade do time entre ginásios e troca de terreno, e nada
   disso vale aqui -- reordenar é só permutar o código que já está guardado.
   Permuta o CÓDIGO, e não o time do save: o save pode ter mudado de ordem (ou de nível) desde que
   a defesa foi montada, e o líder está reordenando o que ele vê defendendo. */
exports.reorderNeighborhoodGymDefense = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { city, countryCode } = request.data || {};
  const ordem = Array.isArray(request.data?.order) ? request.data.order : null;
  if(!city || !ordem){ throw new HttpsError('invalid-argument', 'Ordem não informada.'); }
  const gymRef = neighborhoodGymRef(city, countryCode);
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(gymRef);
    const d = snap.exists ? snap.data() : null;
    if(!d || !d.leaderUid){ throw new HttpsError('failed-precondition', 'Esse ginásio não tem líder.'); }
    if(d.leaderUid !== uid){ throw new HttpsError('permission-denied', 'Você não é o líder desse ginásio.'); }
    const time = decodeTeamCode(d.leaderTeamCode) || [];
    if(!time.length){ throw new HttpsError('failed-precondition', 'Esse ginásio ainda não tem time de defesa.'); }
    // permutação dos MESMOS índices -- sem repetir, sem faltar, sem inventar posição
    if(ordem.length !== time.length){ throw new HttpsError('invalid-argument', 'Ordem inválida.'); }
    const vistos = new Set();
    for(const i of ordem){
      if(!Number.isInteger(i) || i < 0 || i >= time.length || vistos.has(i)){
        throw new HttpsError('invalid-argument', 'Ordem inválida.');
      }
      vistos.add(i);
    }
    const novoTime = ordem.map(i => time[i]);
    const code = sanitizeTeamCode(encodeTeamCode(novoTime));
    if(!code){ throw new HttpsError('failed-precondition', 'Time inválido.'); }
    tx.set(gymRef, { leaderTeamCode: code }, { merge: true });
    return { team: novoTime.map(p => ({ speciesId:p.speciesId, level:p.level, shiny:!!p.shiny })) };
  });
});

/* A ESPERA É POR POKÉMON. Quem desafia e perde fica 10 minutos sem poder usar AQUELES pokémon
   nesse ginásio -- o resto do bicharedo dele continua livre pra montar outro time e tentar de novo.
   Já foi por time (uid+slot) e por jogador; por time não segurava nada (quem tinha 3 saves
   desafiava 3 vezes seguidas, uma com cada) e por jogador segurava demais -- travava a conta
   inteira por causa de um time que perdeu.
   Os documentos das duas versões antigas ficam órfãos e inofensivos: ninguém mais lê eles. */
function neighborhoodGymMonCooldownRef(gymRef, uid, chave){
  return gymRef.collection('challengeCooldowns').doc(String(uid) + '__' + String(chave));
}
exports.challengeNeighborhoodGym = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { city, countryCode, team } = request.data || {};
  if(!city || !Array.isArray(team)){
    throw new HttpsError('invalid-argument', 'Dados do desafio incompletos.');
  }
  const userSnap = await db.collection('users').doc(uid).get();
  const gymRef = neighborhoodGymRef(city, countryCode);

  // trava de "um desafio por vez nesse ginásio" -- resolve ANTES de fazer qualquer trabalho pesado
  // (ler saves, calcular time automático, simular a luta). Se muita gente desafiar ao mesmo tempo,
  // só quem vence essa disputa rápida segue adiante; o resto recebe um aviso claro na hora, em vez de
  // entrar numa cascata de tentativas silenciosas contra o documento principal do ginásio
  const lockRef = neighborhoodGymChallengeLockRef(gymRef);
  const lockAcquired = await db.runTransaction(async (tx) => {
    const lockSnap = await tx.get(lockRef);
    const lockData = lockSnap.exists ? lockSnap.data() : null;
    const now = Date.now();
    if(lockData && (now - (lockData.acquiredAt||0)) < NEIGHBORHOOD_GYM_CHALLENGE_LOCK_TIMEOUT_MS){
      return false; // já tem outro desafio em andamento nesse ginásio agora mesmo
    }
    tx.set(lockRef, { acquiredAt: now, uid });
    return true;
  });
  if(!lockAcquired){
    throw new HttpsError('resource-exhausted', 'Esse ginásio está com outro desafio em andamento agora. Aguarde sua vez e tente de novo em instantes.');
  }
  try{

  // cooldown de 10min por time (uid+slot) NESSE ginásio -- evita spam de desafio repetido com o mesmo
  // time. Checado ANTES da transação principal (não precisa ser atômico com a troca de liderança)

  /* O time do desafiante é MONTADO com pokémon de qualquer save dele com 8 insígnias, sem repetir
     espécie -- a mesma regra da Torre e a mesma do líder. A ORDEM é a que ele escolheu.
     Some o antigo orderedTeamCode (o código alternativo conferido por assinatura): não existe mais
     um "time real do slot" pra comparar, e o resolvedor já recusa pokémon que ele não tem -- que é
     a mesma proteção, feita antes em vez de depois. */
  const timeDoDesafiante = await resolverTimeDosSaves(uid, team, NEIGHBORHOOD_GYM_TEAM_SIZE, 'time do desafio', 1);
  const realTeamCode = sanitizeTeamCode(encodeTeamCode(timeDoDesafiante));
  if(!realTeamCode){ throw new HttpsError('failed-precondition', 'Time inválido.'); }

  /* A ESPERA, POKÉMON A POKÉMON. Checada DEPOIS de resolver o time porque a chave sai do pokémon
     que o servidor achou, não do que o cliente mandou. Recusa nomeando quem está de castigo: um
     "espere 7 minutos" sem dizer por causa de quem faria a pessoa remontar o time no escuro. */
  const refsDeEspera = timeDoDesafiante.map(p => neighborhoodGymMonCooldownRef(gymRef, uid, p.chave));
  const snapsDeEspera = await db.getAll(...refsDeEspera);
  const emEspera = [];
  snapsDeEspera.forEach((snap, i) => {
    if(!snap.exists) return;
    const passou = Date.now() - (snap.data().lastChallengeAt||0);
    if(passou < NEIGHBORHOOD_GYM_CHALLENGE_COOLDOWN_MS){
      emEspera.push({ p: timeDoDesafiante[i], falta: NEIGHBORHOOD_GYM_CHALLENGE_COOLDOWN_MS - passou });
    }
  });
  if(emEspera.length){
    const maior = Math.max(...emEspera.map(e => e.falta));
    const nomes = emEspera.map(e => (SPECIES[e.p.speciesId] && SPECIES[e.p.speciesId].name) || e.p.speciesId).join(', ');
    throw new HttpsError('resource-exhausted',
      `${nomes} ${emEspera.length===1?'acabou':'acabaram'} de desafiar esse ginásio. ${emEspera.length===1?'Ele precisa':'Eles precisam'} de mais ${Math.ceil(maior/60000)}min de descanso -- monte um time com outros pokémon.`);
  }
  // especialidades do desafiante, lidas FORA da transação de propósito: transação do Firestore exige
  // todas as leituras antes de qualquer escrita, e essa é pesada (simula a batalha inteira dentro).
  // Buscar aqui deixa a transação enxuta. As do LÍDER ficam gravadas no próprio ginásio (snapshot de
  // quando ele assumiu) -- ver leaderSpecialties abaixo
  const challengerUserSnap = await db.collection('users').doc(uid).get();
  const challengerSpecialties = (challengerUserSnap.exists && challengerUserSnap.data().specialties) || [];
  // se o jogador escolheu uma ORDEM diferente antes de desafiar, só aceita se o CONJUNTO de pokémon
  // bater com o time que ele realmente possui (mesmo padrão anti-forja da Trainers League) -- a ordem
  // escolhida é respeitada, mas não dá pra mandar um time que ele nunca teve
  const challengerCode = realTeamCode;
  const challengerName = (userSnap.exists && userSnap.data().trainerName) || 'Treinador';
  const thisGymId = neighborhoodGymId(city, countryCode);
  // descoberto ANTES da transação (precisa ler saves + índice de vários times) -- só é de fato usado
  // se o desafiante vencer, mas calcular aqui evita ter que fazer leitura no meio da transação depois
  // de já ter começado a escrever nela
  /* Vencendo, o desafiante assume defendendo com o MESMO time que acabou de vencer. Antes um
     sorteio escolhia um save livre dele -- fazia sentido quando a defesa era um save inteiro, e
     não faz mais nenhum: ele montou um time, ganhou com ele, e é com ele que fica. */

  const result = await db.runTransaction(async (tx) => {
    const gymSnap = await tx.get(gymRef);
    const gymData = gymSnap.exists ? gymSnap.data() : null;
    // lê o registro histórico do líder atual JÁ AQUI (antes de qualquer escrita) -- o Firestore exige
    // que toda leitura de uma transação venha antes de qualquer escrita dela. Só é usado de fato lá
    // embaixo, se o desafiante vencer, mas precisa ser lido nesse ponto de qualquer forma
    const currentLeaderRecordSnap = (gymData && gymData.leaderUid) ? await tx.get(neighborhoodGymLeaderRecordRef(gymRef, gymData.leaderUid)) : null;
    if(!gymData || !gymData.leaderUid){
      throw new HttpsError('failed-precondition', 'Esse ginásio está sem líder -- reivindique em vez de desafiar.');
    }
    if(gymData.leaderUid === uid){
      throw new HttpsError('failed-precondition', 'Você já é o líder desse ginásio.');
    }
    if(!gymData.leaderTeamCode || !gymData.leaderTerrain){
      // ganhou a liderança mas ainda não configurou o terreno de defesa -- não deixa ninguém "ganhar
      // de graça" nesse intervalo (resolveLeagueMatch daria vitória automática pra quem desafiasse
      // um time nulo, derrubando o líder sem batalha nenhuma). O TIME em si nunca fica nulo agora
      // (é atribuído automaticamente ao vencer), só o terreno ainda pode estar pendente
      throw new HttpsError('failed-precondition', 'O líder atual ainda não configurou a defesa desse ginásio. Tente de novo mais tarde.');
    }
    const terrain = TERRAINS.find(t=>t.id===gymData.leaderTerrain) || null;
    const match = {
      a: { uid, name: challengerName, code: challengerCode, specialties: challengerSpecialties },
      b: { uid: gymData.leaderUid, name: gymData.leaderName, code: gymData.leaderTeamCode, specialties: gymData.leaderSpecialties || [] },
      winner:null, matchups:null, resolved:false, terrain // terreno do líder = vantagem de mandante
    };
    resolveLeagueMatch(match, `cidade-${city}-${uid}-${Date.now()}`, null);
    const challengerWon = match.winner === match.a;

    const logId = `${Date.now()}_${uid}`;
    tx.set(gymRef.collection('challengeLogs').doc(logId), {
      challengerUid: uid, challengerName, defenderName: gymData.leaderName,
      matchups: match.matchups, challengerWon, at: Date.now()
    });
    /* Marca CADA pokémon que entrou na luta. Vencendo ou perdendo: na prática só pesa quando
       perde (vencendo ele vira líder e não desafia mais), mas marcar sempre evita o vai-e-vem de
       retomar o ginásio no mesmo minuto com o mesmo time. */
    const agoraDaEspera = Date.now();
    timeDoDesafiante.forEach(p => {
      tx.set(neighborhoodGymMonCooldownRef(gymRef, uid, p.chave),
             { lastChallengeAt: agoraDaEspera, speciesId: p.speciesId });
    });

    // calculado ANTES do if/else pra ficar disponível tanto ali dentro quanto no return mais embaixo
    // (só faz sentido de verdade quando challengerWon, mas não custa nada calcular sempre)
    const dethronedDays = gymData.becameLeaderAt ? Math.floor((Date.now() - gymData.becameLeaderAt) / (24*60*60*1000)) : 0;
    if(challengerWon){
      // reinado do líder DERROTADO termina aqui -- compara com o recorde histórico dele NESSE ginásio
      // e guarda o maior dos dois em cada métrica (vitórias e dias), pra não perder o desempenho dele
      // só porque foi destronado. As duas métricas são independentes -- o pico de uma pode ter vindo
      // de um reinado diferente do pico da outra, e tudo bem
      const prevRecord = (currentLeaderRecordSnap && currentLeaderRecordSnap.exists) ? currentLeaderRecordSnap.data() : null;
      tx.set(neighborhoodGymLeaderRecordRef(gymRef, gymData.leaderUid), {
        // uid e city são redundantes AQUI (o uid é o id do documento, a cidade está no ginásio pai),
        // mas existem pro perfil público: sem eles, listar "todos os ginásios que esse treinador já
        // liderou" obriga a varrer todos os ginásios do mundo. Com o campo uid dá pra fazer uma
        // consulta collectionGroup indexada quando o número de ginásios crescer
        uid: gymData.leaderUid,
        city,
        name: gymData.leaderName,
        bestWins: Math.max(gymData.defenseCount||0, (prevRecord && prevRecord.bestWins) || 0),
        bestDays: Math.max(dethronedDays, (prevRecord && prevRecord.bestDays) || 0)
      });
      // o time do líder DERROTADO não defende mais nada -- libera o índice dele
      if(gymData.leaderTeamSlot != null){
        tx.delete(neighborhoodGymDefenseIndexRef(gymData.leaderUid, gymData.leaderTeamSlot));
      }
      // time SEMPRE atribuído na hora (nunca fica "sem time" esperando escolha manual) -- só o
      // terreno continua pendente até o novo líder escolher, via setNeighborhoodGymDefense
      tx.set(gymRef, {
        city, countryCode: countryCode||null,
        leaderUid: uid, leaderName: challengerName,
        leaderSpecialties: challengerSpecialties, // congelado ao assumir: quem defende o ginásio defende com o que tinha
        leaderTeamCode: challengerCode,
        leaderTeamSlot: null,   // defesa montada à mão não vem de save nenhum
        leaderTerrain: null,
        becameLeaderAt: Date.now(), defenseCount: 0
      });
    } else {
      tx.set(gymRef, { defenseCount: (gymData.defenseCount||0) + 1 }, { merge:true });
    }
    return {
      win: challengerWon, matchups: match.matchups, opponentName: gymData.leaderName,
      // só preenchido quando alguém É destronado -- usado logo abaixo pra notificar ele, DEPOIS que a
      // transação já confirmou de verdade (notificação não precisa ser atômica com a troca de líder)
      dethronedInfo: challengerWon ? { uid: gymData.leaderUid, name: gymData.leaderName, wins: gymData.defenseCount||0, days: dethronedDays } : null
    };
  });
  if(result.dethronedInfo){
    const d = result.dethronedInfo;
    await createNotification(d.uid, 'gym_leadership_lost',
      `Você perdeu a liderança do Ginásio ${city}`,
      `${challengerName} te derrotou. Seu reinado durou ${d.days} dia${d.days===1?'':'s'}, com ${d.wins} vitória${d.wins===1?'':'s'} em sequência.`,
      { city, countryCode: countryCode||null, days: d.days, wins: d.wins, defeatedBy: challengerName }
    );
  }
  return result;
  } finally {
    // libera SEMPRE, sucesso ou erro -- senão o próximo desafiante ficaria esperando até o timeout
    // mesmo com o ginásio já livre de verdade
    await lockRef.delete().catch(()=>{});
  }
});

// devolve, pra cada save elegível (8 insígnias) da conta, quanto tempo falta de cooldown NESSE
// ginásio específico -- o cliente usa isso pra mostrar a contagem regressiva de 10min por time
/* OS GINÁSIOS QUE EU LIDERO, onde quer que eles fiquem.
   Liderar vale à distância -- só CONQUISTAR um ginásio novo exige estar no bairro (ver
   openNeighborhoodGymRemote no cliente). Sem esta lista, quem virou líder em São Paulo e voltou
   pra São José não tinha como abrir aquele ginásio de novo: a tela só sabia mostrar o ginásio de
   onde a pessoa está.
   A consulta é por `leaderUid`, que o Firestore indexa sozinho (índice de campo único) -- não
   precisa de índice composto porque não há ordenação junto. Ordenar aqui em memória é barato: um
   jogador lidera poucos ginásios, e o teto abaixo garante isso. */
const MAX_GINASIOS_LIDERADOS = 50;
exports.listMyNeighborhoodGyms = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const snap = await db.collection('neighborhoodGyms').where('leaderUid', '==', uid).limit(MAX_GINASIOS_LIDERADOS).get();
  const gyms = [];
  snap.forEach(doc => {
    const d = doc.data() || {};
    gyms.push({
      city: d.city || doc.id,
      countryCode: d.countryCode || null,
      defenseCount: d.defenseCount || 0,
      becameLeaderAt: d.becameLeaderAt || null,
      // a tela usa isso pra avisar "falta escolher o terreno" -- um ginásio sem terreno não aceita
      // desafio, então o líder precisa saber que ele está parado
      hasTerrain: !!d.leaderTerrain,
      hasTeam: !!d.leaderTeamCode
    });
  });
  gyms.sort((a,b) => (b.becameLeaderAt||0) - (a.becameLeaderAt||0));
  return { gyms };
});
exports.getNeighborhoodGymChallengeCooldowns = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { city, countryCode } = request.data || {};
  if(!city){ throw new HttpsError('invalid-argument', 'Cidade não informada.'); }
  const gymRef = neighborhoodGymRef(city, countryCode);
  /* Devolve QUAIS POKÉMON estão de castigo nesse ginásio, com quanto falta pra cada um. É isso que
     deixa a tela de montar time mostrar o bicho apagado com o tempo em cima, em vez de deixar o
     jogador montar o time inteiro e só descobrir no clique do desafio.
     A chave sai da MESMA função que o desafio usa (chaveDoPokemonNaConta) -- duas contas diferentes
     da mesma coisa foi exatamente o defeito de 01/09/2026. */
  const savesSnap = await db.collection('users').doc(uid).collection('saves').get();
  const chaves = [];
  savesSnap.forEach(doc => {
    const s = doc.data() || {};
    const badges = (typeof s.badgeCount === 'number') ? s.badgeCount : ((s.badgesEarned||[]).length);
    if(badges < 8) return;
    (s.team || []).forEach(p => chaves.push(chaveDoPokemonNaConta(doc.id, p)));
  });
  const mons = {};
  if(chaves.length){
    const snaps = await db.getAll(...chaves.map(c => neighborhoodGymMonCooldownRef(gymRef, uid, c)));
    snaps.forEach((snap, i) => {
      if(!snap.exists) return;
      const falta = NEIGHBORHOOD_GYM_CHALLENGE_COOLDOWN_MS - (Date.now() - (snap.data().lastChallengeAt||0));
      if(falta > 0) mons[chaves[i]] = falta;
    });
  }
  // `cooldowns` continua no retorno, vazio, só pra não quebrar quem estiver com a página velha em cache
  return { mons, cooldowns: {} };
});
// checa se um save específico está defendendo ALGUM ginásio agora -- usado pelo cliente antes de
// confirmar a exclusão de um save, pra avisar "esse ginásio vai ficar sem líder" em vez da pessoa
// descobrir isso só depois, sem querer
exports.checkNeighborhoodGymDefenseForSlot = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { slot } = request.data || {};
  if(typeof slot !== 'number'){ throw new HttpsError('invalid-argument', 'Slot não informado.'); }
  const snap = await neighborhoodGymDefenseIndexRef(uid, slot).get();
  if(!snap.exists){ return { defending: null }; }
  const d = snap.data();
  return { defending: { city: d.city } };
});

// chamado pelo cliente ANTES de apagar de verdade um save que estava defendendo um ginásio -- limpa
// a liderança (o ginásio fica vago, pronto pra qualquer um reivindicar) e remove o índice. Os docs de
// ginásio são escrita exclusiva do servidor, então isso não dá pra fazer direto do cliente
exports.vacateNeighborhoodGymForDeletedSave = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { slot } = request.data || {};
  if(typeof slot !== 'number'){ throw new HttpsError('invalid-argument', 'Slot não informado.'); }
  const indexRef = neighborhoodGymDefenseIndexRef(uid, slot);
  const indexSnap = await indexRef.get();
  if(!indexSnap.exists){ return { vacated: false }; }
  const { city, countryCode } = indexSnap.data();
  const gymRef = neighborhoodGymRef(city, countryCode);
  await db.runTransaction(async (tx) => {
    const gymSnap = await tx.get(gymRef);
    if(gymSnap.exists && gymSnap.data().leaderUid===uid && gymSnap.data().leaderTeamSlot===slot){
      // só vaga se ainda for de fato esse mesmo save liderando -- se algo mudou nesse meio tempo
      // (ele já tinha trocado de defesa, por exemplo), não mexe em nada
      tx.set(gymRef, { leaderUid: null, leaderName: null, leaderTeamCode: null, leaderTeamSlot: null, leaderTerrain: null }, { merge:true });
    }
    tx.delete(indexRef);
  });
  return { vacated: true, city };
});

// top 10 de vitórias em sequência + top 10 de dias como líder, pra UM ginásio específico. Mescla o
// histórico persistido (leaderRecords, atualizado sempre que alguém é destronado) com o líder ATUAL
// em tempo real -- assim quem está liderando agora aparece com o número mais recente, sem precisar
// esperar ser destronado pra "valer". Se o mesmo treinador aparece em mais de um lugar (foi líder
// várias vezes), só entra UMA vez no ranking, com o maior valor de cada métrica já alcançado por ele
exports.getNeighborhoodGymLeaderboard = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const { city, countryCode } = request.data || {};
  if(!city){ throw new HttpsError('invalid-argument', 'Cidade não informada.'); }
  const gymRef = neighborhoodGymRef(city, countryCode);
  const [gymSnap, recordsSnap] = await Promise.all([
    gymRef.get(),
    gymRef.collection('leaderRecords').get()
  ]);
  const gymData = gymSnap.exists ? gymSnap.data() : null;
  // uid -> {name, bestWins, bestDays} -- começa com o histórico persistido
  const byUid = {};
  for(const doc of recordsSnap.docs){
    const d = doc.data();
    byUid[doc.id] = { name: d.name, bestWins: d.bestWins||0, bestDays: d.bestDays||0 };
  }
  // mescla o líder ATUAL (se tiver) com o número dele AO VIVO, sem esperar ser destronado
  if(gymData && gymData.leaderUid){
    const liveWins = gymData.defenseCount||0;
    const liveDays = gymData.becameLeaderAt ? Math.floor((Date.now() - gymData.becameLeaderAt) / (24*60*60*1000)) : 0;
    const prev = byUid[gymData.leaderUid] || { name: gymData.leaderName, bestWins:0, bestDays:0 };
    byUid[gymData.leaderUid] = {
      name: gymData.leaderName, // nome mais recente sempre vence, caso o treinador tenha trocado de nome
      bestWins: Math.max(prev.bestWins, liveWins),
      bestDays: Math.max(prev.bestDays, liveDays)
    };
  }
  const entries = Object.entries(byUid).map(([uid, v]) => ({ uid, name: v.name, wins: v.bestWins, days: v.bestDays }));
  const byWins = entries.slice().sort((a,b)=> b.wins - a.wins).slice(0, 10);
  const byDays = entries.slice().sort((a,b)=> b.days - a.days).slice(0, 10);
  return { byWins, byDays };
});

// todos os times DESSE usuário que estão defendendo algum ginásio agora, de uma vez só -- usado na
// home pra mostrar o botão "Ver ginásio" nos cards de save que estão defendendo. Uma chamada só, em
// vez de checar slot por slot (o que a checkNeighborhoodGymDefenseForSlot já faz, mas um de cada vez)
exports.getMyActiveGymDefenses = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  // NÃO usa where('uid','==',uid) sozinho -- documentos de ANTES desse campo existir (a exclusividade
  // por time é recente) não têm "uid" gravado, e ficariam invisíveis pra essa consulta -- mesma classe
  // de bug já vista com campos novos em documentos antigos (leaderTeamSlot). O ID do documento, por
  // outro lado, sempre foi "uid_slot" desde o primeiro dia dessa feature -- filtrar por ele funciona
  // pra qualquer documento, novo ou antigo, sem depender de nenhum campo específico existir
  const snap = await db.collection('neighborhoodGymActiveDefenses').get();
  const bySlot = {};
  const prefix = `${uid}_`;
  for(const doc of snap.docs){
    if(!doc.id.startsWith(prefix)) continue;
    const slot = parseInt(doc.id.slice(prefix.length), 10);
    if(!Number.isFinite(slot)) continue;
    const d = doc.data();
    bySlot[slot] = { city: d.city, countryCode: d.countryCode||null };
  }
  return { bySlot };
});

// líder abandona VOLUNTARIAMENTE o posto -- o ginásio fica vago (pronto pra qualquer um reivindicar)
// e o time dele é liberado do índice de exclusividade (pode passar a liderar outro ginásio, se quiser)
exports.leaveNeighborhoodGymLeadership = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { city, countryCode } = request.data || {};
  if(!city){ throw new HttpsError('invalid-argument', 'Cidade não informada.'); }
  const gymRef = neighborhoodGymRef(city, countryCode);
  await db.runTransaction(async (tx) => {
    const gymSnap = await tx.get(gymRef);
    // leitura do recorde histórico ANTES de qualquer escrita (regra do Firestore) -- mesma lógica
    // usada quando alguém é destronado numa disputa: compara o reinado que está terminando agora com
    // o melhor já registrado, guarda o maior dos dois. Sem isso, sair por vontade própria de um bom
    // reinado faria a pessoa perder esse crédito no ranking -- só valeria ser destronado à força
    const recordSnap = (gymSnap.exists && gymSnap.data().leaderUid===uid) ? await tx.get(neighborhoodGymLeaderRecordRef(gymRef, uid)) : null;
    if(!gymSnap.exists || gymSnap.data().leaderUid !== uid){
      throw new HttpsError('failed-precondition', 'Você não é o líder desse ginásio.');
    }
    const gymData = gymSnap.data();
    const finalDays = gymData.becameLeaderAt ? Math.floor((Date.now() - gymData.becameLeaderAt) / (24*60*60*1000)) : 0;
    const prevRecord = (recordSnap && recordSnap.exists) ? recordSnap.data() : null;
    tx.set(neighborhoodGymLeaderRecordRef(gymRef, uid), {
      uid, // idem: usado pelo perfil público pra achar o histórico sem varrer tudo (ver comentário acima)
      city: gymData.city || city,
      name: gymData.leaderName,
      bestWins: Math.max(gymData.defenseCount||0, (prevRecord && prevRecord.bestWins) || 0),
      bestDays: Math.max(finalDays, (prevRecord && prevRecord.bestDays) || 0)
    });
    if(gymData.leaderTeamSlot != null){
      tx.delete(neighborhoodGymDefenseIndexRef(uid, gymData.leaderTeamSlot));
    }
    tx.set(gymRef, { leaderUid: null, leaderName: null, leaderTeamCode: null, leaderTeamSlot: null, leaderTerrain: null }, { merge:true });
  });
  return { ok: true };
});

/* =====================================================================
   NOTIFICAÇÕES -- avisos assíncronos pro jogador: liga começou, seu time
   jogou (com resultado), perdeu liderança de um Ginásio da Cidade.
   Guardadas em users/{uid}/notifications/{notifId}, mais recente primeiro.
   Um documento por notificação, ID único (uid não precisa saber o formato,
   só usa o que vier de volta pra marcar como lida depois)
   ===================================================================== */
let notificationIdCounter = 0; // só pra desempatar 2 notificações no MESMO milissegundo
function newNotificationId(){
  notificationIdCounter = (notificationIdCounter + 1) % 100000;
  return `${Date.now()}_${notificationIdCounter}`;
}
// devolve o id da notificação criada (ou null se falhar) -- quem precisa referenciar o
// "cupom" depois, como o prêmio da Elite, usa esse retorno
async function createNotification(uid, type, title, body, meta){
  try{
    const id = newNotificationId();
    await db.collection('users').doc(uid).collection('notifications').doc(id).set({
      type, title, body, meta: meta||null, read: false, createdAt: Date.now()
    });
    return id;
  } catch(e){ logger.error('Erro ao criar notificação para '+uid+':', e); return null; }
}

exports.getMyNotifications = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const snap = await db.collection('users').doc(uid).collection('notifications').get();
  const notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt||0) - (a.createdAt||0))
    .slice(0, 50);
  const unreadCount = notifications.filter(n=>!n.read).length;
  /* O selo de pedidos de amizade e o carimbo de presença pegam carona aqui porque esta chamada já
     acontece toda vez que a home abre. Um endpoint próprio pra cada um seriam duas chamadas a mais
     por abertura de tela, pra dois números que cabem nesta resposta. */
  let friendRequests = 0;
  try{ friendRequests = (await friendRequestsColl(uid).get()).size; }
  catch(e){ logger.error('Erro ao contar pedidos de amizade:', e); }
  try{
    const u = await db.collection('users').doc(uid).get();
    await touchLastSeen(uid, u.exists ? u.data() : null);
  } catch(e){ logger.error('Erro ao carimbar presença:', e); }
  return { notifications, unreadCount, friendRequests };
});

exports.markNotificationsRead = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { ids } = request.data || {};
  if(!Array.isArray(ids) || ids.length===0){ return { ok: true }; }
  for(const id of ids){
    await db.collection('users').doc(uid).collection('notifications').doc(String(id)).set({ read: true }, { merge: true });
  }
  return { ok: true };
});

// histórico dos últimos desafios de UM ginásio -- data, hora, quem desafiou, quem defendia, e o
// resultado. Os dados já existiam (challengeLogs, gravados desde o início dessa feature); essa função
// só resume o que interessa pra uma lista (sem o log de confrontos detalhado, que é pesado demais
// pra uma lista de histórico -- só faz sentido na tela de resultado da própria luta)
exports.getNeighborhoodGymChallengeHistory = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const { city, countryCode } = request.data || {};
  if(!city){ throw new HttpsError('invalid-argument', 'Cidade não informada.'); }
  const gymRef = neighborhoodGymRef(city, countryCode);
  const snap = await gymRef.collection('challengeLogs').get();
  /* Os confrontos vão junto: já eram gravados desde o início, mas a consulta os descartava.
     São eles que permitem rever a batalha. Só entram nos 10 mais recentes -- mandar os matchups
     de 30 desafios engordaria a resposta à toa, e ninguém revê o 25º desafio da lista. */
  const history = snap.docs.map(d => {
    const v = d.data();
    return { id: d.id, challengerName: v.challengerName, defenderName: v.defenderName,
             challengerWon: !!v.challengerWon, at: v.at||0, matchups: v.matchups || null };
  }).sort((a,b) => b.at - a.at).slice(0, 30)
    .map((h, i) => i < 10 ? h : Object.assign({}, h, { matchups: null }));
  return { history };
});

// ativa o bônus de shiny por 1h a partir do clique -- só pode ser ativado a partir de uma notificação
// de campeão da Liga Clássica genuína e ainda não usada (evita clicar 2x na mesma notificação e ficar
// "renovando" o bônus à toa; uma vitória nova sempre gera uma notificação nova, essa sim pode ativar de novo)
const SHINY_BONUS_DURATION_MS = 60 * 60 * 1000; // 1 hora
/* Ativa o bônus shiny da Elite DIRETO pelo save, sem depender de notificação.

   A primeira versão amarrava o prêmio a um "cupom" (a notificação), reaproveitando o mecanismo do
   campeão de liga. Foi over-engineering: criou três pontos de falha em algo simples -- o id podia
   não voltar, se perder entre sessões, ou apontar pra uma notificação que não existe. Foi
   exatamente isso que quebrou ("Notificação inválida").

   Aqui a fonte da verdade é o SAVE: se ele venceu a Elite e ainda não usou o prêmio, o bônus é
   concedido e o save marcado. Um campo, uma checagem, idempotente por natureza.
   A notificação continua existindo, mas só como aviso -- não é mais requisito pra nada. */
exports.activateEliteShinyBonus = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const slot = String(request.data?.slot ?? '');
  if(!slot) throw new HttpsError('invalid-argument', 'Save não informado.');

  const saveRef = db.collection('users').doc(uid).collection('saves').doc(slot);
  const saveSnap = await saveRef.get();
  if(!saveSnap.exists) throw new HttpsError('failed-precondition', 'Save não encontrado.');
  const save = saveSnap.data() || {};
  if(save.eliteStatus !== 'champion'){
    throw new HttpsError('failed-precondition', 'Esse save ainda não venceu a Elite dos 4.');
  }
  if(save.eliteShinyUsed){
    throw new HttpsError('failed-precondition', 'O bônus desta jornada já foi ativado.');
  }
  const expiresAt = Date.now() + SHINY_BONUS_DURATION_MS;
  await db.collection('users').doc(uid).set({ shinyBonusExpiresAt: expiresAt }, { merge:true });
  await saveRef.set({ eliteShinyUsed: true, eliteShinyGranted: true }, { merge:true });
  return { expiresAt };
});

/* Prêmio por vencer a Elite dos 4: 1 hora de bônus shiny, entregue como notificação-cupom.
   Idempotente por SAVE: o campo eliteShinyGranted no save marca que aquele save já rendeu o prêmio.
   Sem essa marca, abrir a tela de campeão várias vezes daria um cupom novo a cada vez. */
exports.claimEliteShinyBonus = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const slot = String(request.data?.slot ?? '');
  if(!slot) throw new HttpsError('invalid-argument', 'Save não informado.');

  const saveRef = db.collection('users').doc(uid).collection('saves').doc(slot);
  const saveSnap = await saveRef.get();
  if(!saveSnap.exists) throw new HttpsError('failed-precondition', 'Save não encontrado.');
  const save = saveSnap.data() || {};
  if(save.eliteStatus !== 'champion'){
    throw new HttpsError('failed-precondition', 'Esse save ainda não venceu a Elite dos 4.');
  }
  if(save.eliteShinyGranted){
    /* Já concedido antes. Devolve o cupom EXISTENTE em vez de só dizer "já foi": sem isso, quem
       recebeu numa sessão anterior ficava com o botão na tela mas sem id pra ativar -- e a
       chamada falhava com "Notificação inválida", que foi exatamente o erro reportado. */
    const notifs = await db.collection('users').doc(uid).collection('notifications')
      .where('type','==','elite_champion').get();
    const pendente = notifs.docs.find(d => !(d.data().meta && d.data().meta.activated));
    return { alreadyGranted: true, notificationId: pendente ? pendente.id : null,
             allActivated: !pendente };
  }
  await saveRef.set({ eliteShinyGranted: true }, { merge: true });
  const notifId = await createNotification(uid, 'elite_champion', '🏆 Campeão da Elite dos 4!',
    'Sua vitória sobre a Elite dos 4 rendeu 1 hora de bônus shiny. Ative quando quiser sair caçando.');
  return { granted: true, notificationId: notifId };
});

exports.activateShinyBonus = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { notificationId } = request.data || {};
  if(!notificationId){ throw new HttpsError('invalid-argument', 'Notificação não informada.'); }
  const notifRef = db.collection('users').doc(uid).collection('notifications').doc(String(notificationId));
  const notifSnap = await notifRef.get();
  // aceita os dois prêmios que dão bônus shiny: campeão de liga e campeão da Elite 4.
  // O mecanismo é o mesmo -- a notificação é o "cupom", e o campo activated impede usar duas vezes
  const tipoNotif = notifSnap.exists ? notifSnap.data().type : null;
  if(!notifSnap.exists || (tipoNotif !== 'league_champion' && tipoNotif !== 'elite_champion')){
    throw new HttpsError('failed-precondition', 'Notificação inválida.');
  }
  const meta = notifSnap.data().meta || {};
  if(meta.activated){
    throw new HttpsError('failed-precondition', 'Esse bônus já foi ativado.');
  }
  const expiresAt = Date.now() + SHINY_BONUS_DURATION_MS;
  await db.collection('users').doc(uid).set({ shinyBonusExpiresAt: expiresAt }, { merge:true });
  await notifRef.set({ meta: { ...meta, activated: true } }, { merge:true });
  return { expiresAt };
});

// apaga UMA notificação específica -- a pessoa só pode apagar as próprias (o UID vem do token de
// autenticação, não do que o cliente manda, então não dá pra apagar notificação de outra conta)
exports.deleteNotification = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { notificationId } = request.data || {};
  if(!notificationId){ throw new HttpsError('invalid-argument', 'Notificação não informada.'); }
  await db.collection('users').doc(uid).collection('notifications').doc(String(notificationId)).delete();
  return { ok: true };
});

/* Apagar em LOTE. Dava pra chamar o deleteNotification N vezes do cliente, mas o caso que fez
   isso existir é justamente o de 21 notificações iguais (o defeito da Trainers League de
   31/08/2026): N chamadas de rede pra uma ação que é uma só. Um batch do Firestore resolve numa
   ida. Teto de 400 porque o batch do Firestore vai até 500 operações -- e a tela nunca lista mais
   que 50 de qualquer jeito. */
exports.deleteNotifications = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { ids } = request.data || {};
  if(!Array.isArray(ids) || ids.length===0){ throw new HttpsError('invalid-argument', 'Nenhuma notificação informada.'); }
  if(ids.length > 400){ throw new HttpsError('invalid-argument', 'Notificações demais de uma vez.'); }
  const coll = db.collection('users').doc(uid).collection('notifications');
  const batch = db.batch();
  for(const id of ids){ batch.delete(coll.doc(String(id))); }
  await batch.commit();
  return { ok: true, deleted: ids.length };
});

/* =====================================================================
   EMPRÉSTIMO DE MEWTWO -- diferente do prêmio de 1 uso já existente
   (mewtwoReward, usado só numa inscrição de Liga). Esse aqui é um Mewtwo
   emprestado que entra DE VERDADE no time salvo por 24h, com um cooldown de 7
   dias depois -- reutilizável indefinidamente, não é gasto só 1 vez.
   Elegibilidade: mesma exigência de sempre (Pokédex completa + venceu o
   Mewtwo) -- reaproveita o campo mewtwoReward.earned que esse combate já
   grava, em vez de duplicar a lógica de detectar a vitória
   ===================================================================== */
// nível do Mewtwo EMPRESTADO (o que entra no time salvo por 24h) -- diferente do Lv.99 do desafio.
// Precisa bater com o MEWTWO_LOAN_LEVEL do pokemon-ginasio.html: o cliente usa o mesmo valor pra
// montar o código de time das ligas e pros textos da interface. Mudar num só lugar deixa o Mewtwo
// das ligas com nível diferente do Mewtwo do time salvo
const MEWTWO_LOAN_LEVEL = 70;
const MEWTWO_LOAN_DURATION_MS = 24 * 60 * 60 * 1000; // 24h ativo no time
const MEWTWO_LOAN_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias de cooldown depois

// idempotente e serve pros DOIS casos: chamada logo após vencer o Mewtwo (detecta na hora), e chamada
// preventivamente em qualquer outro momento (ex: abrir a Pokédex) -- pra quem já tinha vencido antes
// dessa feature existir e nunca foi avisado. Só notifica na PRIMEIRA vez que detecta a elegibilidade
exports.checkMewtwoLoanUnlock = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if(userSnap.exists && userSnap.data().mewtwoLoanUnlocked){
    return { unlocked: true, justUnlocked: false };
  }
  const savesSnap = await userRef.collection('saves').get();
  const earnedIt = savesSnap.docs.some(d => d.data().mewtwoReward && d.data().mewtwoReward.earned);
  if(!earnedIt){ return { unlocked: false, justUnlocked: false }; }
  // desbloqueio retroativo (venceu antes dessa mecânica existir) já libera reivindicar de imediato --
  // igual uma vitória nova faria, via reportMewtwoBattleResult. Nunca rolou pra shiny nessa vitória
  // antiga, então entra como normal mesmo
  await userRef.set({ mewtwoLoanUnlocked: true, mewtwoLoanReadyToClaim: true, mewtwoLoanPendingShiny: false }, { merge:true });
  await createNotification(uid, 'mewtwo_loan_unlocked',
    '🧬 O Mewtwo está pronto pra ajudar!',
    'Você completou a Pokédex e derrotou o Mewtwo! Toque aqui pra colocá-lo em um dos seus times por 24h.',
    {}
  );
  return { unlocked: true, justUnlocked: true };
});

// chamado pelo cliente depois de UMA batalha contra o Mewtwo Lv.99 -- tanto a primeira vitória (que
// desbloqueia o mecanismo inteiro) quanto qualquer reencontro depois de um cooldown passam por aqui.
// Vencer libera reivindicar (mewtwoLoanReadyToClaim), guardando também se ESSE Mewtwo específico saiu
// shiny (1/128, sorteado no cliente na hora da batalha) -- é esse valor que activateMewtwoLoan usa
// depois pra decidir se o Mewtwo que entra no time vem shiny ou não
exports.reportMewtwoBattleResult = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { win, shiny } = request.data || {};
  if(!win){ return { ok:true }; } // perdeu -- nada muda, pode tentar de novo quando quiser, sem penalidade
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : {};
  if(!userData.mewtwoLoanUnlocked){
    // primeira vitória de todas -- desbloqueia e já libera reivindicar na hora
    await userRef.set({ mewtwoLoanUnlocked:true, mewtwoLoanReadyToClaim:true, mewtwoLoanPendingShiny: !!shiny }, { merge:true });
    await createNotification(uid, 'mewtwo_loan_unlocked',
      '🧬 O Mewtwo está pronto pra ajudar!',
      `Você completou a Pokédex e derrotou o Mewtwo${shiny?' ✨SHINY✨':''}! Toque aqui pra colocá-lo em um dos seus times por 24h.`,
      {}
    );
    return { ok:true, firstUnlock:true };
  }
  // reencontro depois de um cooldown -- só libera reivindicar de novo se não tiver um empréstimo ativo
  // agora E o cooldown já tiver passado. Evita reportar vitórias repetidas só pra tentar "furar" o
  // cooldown chamando essa função direto
  if(userData.mewtwoLoanActive){
    throw new HttpsError('failed-precondition', 'Você já tem um Mewtwo emprestado em algum time agora.');
  }
  if(userData.mewtwoLoanCooldownUntil && Date.now() < userData.mewtwoLoanCooldownUntil){
    throw new HttpsError('failed-precondition', 'Ainda em cooldown.');
  }
  await userRef.set({ mewtwoLoanReadyToClaim:true, mewtwoLoanPendingShiny: !!shiny }, { merge:true });
  return { ok:true, firstUnlock:false };
});

// coloca o Mewtwo emprestado DE VERDADE no time escolhido -- diferente do antigo prêmio de 1 uso (removido),
// esse entra no save de verdade, por 24h, e pode disputar quantas vezes o treinador quiser nesse
// período, como qualquer outro pokémon do time. Só pode ter UM emprestado por vez (checagem no nível
// da conta, não do save -- não dá pra "clonar" pegando em vários saves ao mesmo tempo). Só é permitido
// depois de VENCER o Mewtwo numa batalha (reportMewtwoBattleResult, que é quem libera essa flag)
exports.activateMewtwoLoan = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const { slot, benchIndex } = request.data || {};
  if(typeof slot !== 'number'){ throw new HttpsError('invalid-argument', 'Slot não informado.'); }
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if(!userSnap.exists || !userSnap.data().mewtwoLoanReadyToClaim){
    throw new HttpsError('failed-precondition', 'Você precisa vencer o Mewtwo numa batalha antes de poder usá-lo.');
  }
  const userData = userSnap.data();
  if(userData.mewtwoLoanActive){
    throw new HttpsError('failed-precondition', 'Você já tem um Mewtwo emprestado em algum time agora.');
  }
  const saveRef = userRef.collection('saves').doc(String(slot));
  const saveSnap = await saveRef.get();
  if(!saveSnap.exists || !saveSnap.data().team || saveSnap.data().team.length===0){
    throw new HttpsError('failed-precondition', 'Esse save não tem um time válido.');
  }
  const team = saveSnap.data().team;
  const isShiny = !!userData.mewtwoLoanPendingShiny;
  const mewtwoEntry = { speciesId:'mewtwo', level:MEWTWO_LOAN_LEVEL, shiny:isShiny };
  let newTeam, benchedPokemon = null;
  if(team.length >= 6){
    if(typeof benchIndex !== 'number' || benchIndex<0 || benchIndex>=team.length){
      throw new HttpsError('invalid-argument', 'Escolha um pokémon pra mandar pro Prof. Carvalho.');
    }
    benchedPokemon = team[benchIndex];
    newTeam = team.map((p,i) => i===benchIndex ? mewtwoEntry : p);
  } else {
    newTeam = [...team, mewtwoEntry];
  }
  const now = Date.now();
  const expiresAt = now + MEWTWO_LOAN_DURATION_MS;
  await saveRef.set({ team: newTeam, mewtwoLoan: { active:true, startedAt:now, expiresAt, benchedPokemon } }, { merge:true });
  await userRef.set({ mewtwoLoanActive:true, mewtwoLoanSlot:slot, mewtwoLoanExpiresAt:expiresAt, mewtwoLoanReadyToClaim:false, mewtwoLoanPendingShiny:false }, { merge:true });
  return { ok:true, expiresAt, shiny:isShiny };
});

// roda a cada 15min -- procura empréstimos de Mewtwo ativos que já passaram das 24h, tira o Mewtwo do
// time (procurando pelo speciesId, não por índice fixo -- o jogador pode ter reordenado o time nesse
// meio tempo), devolve o pokémon que foi mandado pro Prof. Carvalho (se algum foi), e começa o
// cooldown de 7 dias. Usa where('mewtwoLoanActive','==',true) (poucos resultados esperados, o número
// de empréstimos ativos ao mesmo tempo é sempre pequeno) e filtra o prazo em JS -- evita precisar de
// índice composto só pra isso
exports.expireMewtwoLoans = onSchedule('every 15 minutes', async (event) => {
  const now = Date.now();
  const snap = await db.collection('users').where('mewtwoLoanActive','==',true).get();
  for(const doc of snap.docs){
    const userData = doc.data();
    if(!userData.mewtwoLoanExpiresAt || userData.mewtwoLoanExpiresAt > now) continue;
    const uid = doc.id;
    const slot = userData.mewtwoLoanSlot;
    if(typeof slot === 'number'){
      const saveRef = doc.ref.collection('saves').doc(String(slot));
      const saveSnap = await saveRef.get();
      if(saveSnap.exists && saveSnap.data().mewtwoLoan && saveSnap.data().mewtwoLoan.active){
        const loan = saveSnap.data().mewtwoLoan;
        const team = saveSnap.data().team || [];
        const mewtwoIdx = team.findIndex(p=>p.speciesId==='mewtwo');
        let newTeam = team;
        if(mewtwoIdx !== -1){
          newTeam = loan.benchedPokemon
            ? team.map((p,i) => i===mewtwoIdx ? loan.benchedPokemon : p)
            : team.filter((p,i) => i!==mewtwoIdx);
        }
        await saveRef.set({ team:newTeam, mewtwoLoan:{ active:false } }, { merge:true });
        const benchedName = loan.benchedPokemon && SPECIES[loan.benchedPokemon.speciesId] ? SPECIES[loan.benchedPokemon.speciesId].name : null;
        await createNotification(uid, 'mewtwo_loan_ended',
          '🧬 O Mewtwo voltou pro Prof. Carvalho',
          benchedName
            ? `As 24h acabaram -- seu ${benchedName} voltou pro time. Você pode usar o Mewtwo de novo em 7 dias.`
            : 'As 24h acabaram e o Mewtwo saiu do time. Você pode usar ele de novo em 7 dias.',
          {}
        );
      }
    }
    await doc.ref.set({ mewtwoLoanActive:false, mewtwoLoanCooldownUntil: now + MEWTWO_LOAN_COOLDOWN_MS }, { merge:true });
  }
});

/* ============================================================================
   PERFIL PÚBLICO DE TREINADOR
   ----------------------------------------------------------------------------
   Um jogador clica no nome de outro (classificação, ranking, partidas, ginásio)
   e vê um cartão com as conquistas dele. Precisa ser Cloud Function porque as
   regras do Firestore trancam users/{uid} no próprio dono -- o cliente não tem
   como ler o perfil alheio direto, e afrouxar a regra abriria o save inteiro
   (time, progresso, tudo) pra qualquer um. Aqui o servidor lê e devolve SÓ o
   resumo de conquistas, nada que dê vantagem competitiva: nenhum código de time,
   nenhuma composição de time defensivo, nenhum dado de conta.

   Aceita uid OU nome. Nome existe porque o ranking histórico de campeões é
   indexado por NOME (é o que sobrevive quando um save é apagado), então nas
   telas de Top 10 é só isso que temos em mãos.
   ============================================================================ */

// títulos por tipo de liga -- lê todos os documentos champions_alltime_* de uma vez.
// A chave é o NOME do treinador (não o uid): quem trocou de nome tem os títulos antigos
// no nome antigo, e isso é intencional -- o ranking histórico sempre funcionou assim
async function trainerTitlesByName(name){
  if(!name) return { classic:0, trainers:0, custom:0, total:0 };
  const out = { classic:0, trainers:0, custom:0, total:0 };
  try{
    const snap = await db.collection('leagues').get();
    for(const doc of snap.docs){
      if(!doc.id.startsWith('champions_alltime_')) continue;
      const typeId = doc.id.slice('champions_alltime_'.length);
      const wins = (doc.data() || {}).wins || {};
      const n = wins[name] || 0;
      if(!n) continue;
      out.total += n;
      if(typeId === CLASSIC_LEAGUE_TYPE) out.classic += n;
      else if(typeId === TRAINERS_LEAGUE_TYPE) out.trainers += n;
      else out.custom += n; // ligas customizadas criadas no console
    }
  } catch(e){ logger.error('Erro ao somar títulos do treinador:', e); }
  return out;
}

// TODOS os ginásios que esse treinador já liderou algum dia -- não só os de agora. São duas fontes,
// porque o histórico só é gravado quando um reinado TERMINA:
//   1. leaderRecords (subcoleção de cada ginásio): reinados encerrados, por destronamento ou abdicação
//   2. o próprio documento do ginásio: o reinado em ANDAMENTO, que ainda não virou registro
// A varredura filtra por ID do documento (que sempre foi o uid) em vez de where('uid','==') porque
// o campo uid só passou a ser gravado agora -- registros antigos não o têm, e a consulta indexada
// os deixaria invisíveis. Quando o número de ginásios crescer a ponto de doer, o caminho é rodar um
// backfill do campo uid e trocar essa varredura por uma consulta collectionGroup indexada
async function gymLeadershipHistory(uid){
  try{
    const [gymsSnap, recordsSnap] = await Promise.all([
      db.collection('neighborhoodGyms').get(),
      db.collectionGroup('leaderRecords').get()
    ]);
    const cidadePorGinasio = {};
    const liderandoAgora = new Set();
    for(const doc of gymsSnap.docs){
      const g = doc.data() || {};
      if(g.city){ cidadePorGinasio[doc.id] = g.city; }
      if(g.leaderUid === uid){ liderandoAgora.add(doc.id); }
    }
    const porGinasio = new Map();
    for(const gymId of liderandoAgora){
      porGinasio.set(gymId, { city: cidadePorGinasio[gymId] || gymId, current: true });
    }
    for(const doc of recordsSnap.docs){
      if(doc.id !== uid) continue;
      const gymId = doc.ref.parent.parent ? doc.ref.parent.parent.id : null;
      if(!gymId || porGinasio.has(gymId)) continue;
      const d = doc.data() || {};
      porGinasio.set(gymId, { city: d.city || cidadePorGinasio[gymId] || gymId, current: false });
    }
    // lidera agora primeiro, depois alfabético -- a lista é curta, então ordem previsível vale mais
    // que ordem cronológica (que nem temos: leaderRecords não guarda quando o reinado começou)
    const lista = Array.from(porGinasio.values())
      .sort((a,b)=> (b.current?1:0)-(a.current?1:0) || String(a.city).localeCompare(String(b.city),'pt-BR'));
    return lista;
  } catch(e){ logger.error('Erro ao montar histórico de ginásios:', e); return []; }
}

/* O corpo do perfil vive numa função à parte porque MAIS DE UMA chamada precisa dele: a
   getTrainerProfile (cartão de um treinador) e a compareTrainers (dois cartões lado a lado, da
   lista de amigos). Duplicar essa varredura de saves seria duas implementações do mesmo número
   divergindo com o tempo -- o erro que o CLAUDE.md já aponta no motor de batalha. */
async function buildTrainerProfile(askedUid, askedName){
  let uid = askedUid;
  let userData = null;

  if(uid){
    const snap = await db.collection('users').doc(uid).get();
    if(snap.exists){ userData = snap.data(); }
  } else {
    // busca por nome. Nomes NÃO são únicos (nada no jogo impede dois treinadores homônimos), então
    // pega a conta com mais títulos -- é a que o ranking está exibindo, que é de onde o clique veio
    const q = await db.collection('users').where('trainerName', '==', askedName).limit(5).get();
    if(!q.empty){
      const escolhido = q.docs.sort((a,b)=> ((b.data().leagueWinsTotal||0) - (a.data().leagueWinsTotal||0)))[0];
      uid = escolhido.id;
      userData = escolhido.data();
    }
  }

  const nome = (userData && userData.trainerName) || askedName || 'Treinador';
  const titulos = await trainerTitlesByName(nome);

  // conta não encontrada (nome só existe no ranking histórico, save apagado): devolve o que dá,
  // marcado como parcial, em vez de erro -- ver um cartão com os títulos é melhor que ver nada
  if(!userData){
    return {
      found: false, name: nome, titles: titulos,
      pokedex: null, shinyDex: null, eliteWins: 0,
      topPokemon: null, towerClears: 0, specialties: [], specialtyCounts: {}, specialtyThreshold: SPECIALTY_THRESHOLD, specialtyLevel: SPECIALTY_LEVEL,
      bestStreak: 0, gymsLed: 0, gymsList: [], mewtwoUnlocked: false
    };
  }

  // varre os saves pra montar as estatísticas de jornada
  let eliteWins = 0;
  let topPokemon = null;
  try{
    const savesSnap = await db.collection('users').doc(uid).collection('saves').get();
    for(const doc of savesSnap.docs){
      const s = doc.data() || {};
      if(!s.team && !s.badgesEarned) continue; // slot vazio/lixo
      if(s.eliteStatus === 'champion') eliteWins++;
      for(const p of (s.team || [])){
        if(!p || typeof p.level !== 'number') continue;
        if(!topPokemon || p.level > topPokemon.level){
          topPokemon = { speciesId: p.speciesId, level: p.level, shiny: !!p.shiny };
        }
      }
    }
  } catch(e){ logger.error('Erro ao ler saves pro perfil:', e); }

  const gymsHistory = await gymLeadershipHistory(uid);
  // torres vencidas: o ranking da Torre é indexado por uid, então é uma leitura direta
  let towerClears = 0;
  try{
    const tSnap = await db.collection('trainerTowerRanking').doc(uid).get();
    if(tSnap.exists) towerClears = tSnap.data().clears || 0;
  } catch(e){ logger.error('Erro ao ler torres vencidas:', e); }

  return {
    found: true,
    name: nome,
    titles: titulos,
    pokedex: (userData.pokedexCaught || []).length,
    shinyDex: (userData.pokedexShinyCaught || []).length,
    eliteWins,
    eliteChampion: !!userData.eliteChampion,
    topPokemon,
    towerClears,
    specialties: userData.specialties || [],
    specialtyCounts: userData.specialtyCounts || {},
    specialtyThreshold: SPECIALTY_THRESHOLD,
    specialtyLevel: SPECIALTY_LEVEL,
    bestStreak: userData.trainerBestStreak || 0,
    gymsLed: gymsHistory.length,
    gymsList: gymsHistory,
    mewtwoUnlocked: !!userData.mewtwoLoanUnlocked
  };
}

exports.getTrainerProfile = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const askedUid = typeof request.data?.uid === 'string' ? request.data.uid.trim() : '';
  const askedName = typeof request.data?.name === 'string' ? request.data.name.trim().slice(0, 60) : '';
  if(!askedUid && !askedName){
    throw new HttpsError('invalid-argument', 'Informe o treinador.');
  }
  return await buildTrainerProfile(askedUid, askedName);
});

/* ============================================================================
   ESPECIALIDADES DE TIPO — contagem
   ----------------------------------------------------------------------------
   A contagem roda no SERVIDOR e não aceita nada do cliente. Isso não é zelo
   excessivo: as regras do Firestore deixam o dono escrever livremente em
   users/{uid}, e o buff de especialidade vale nas ligas -- se o cliente pudesse
   mandar "sou especialista em tudo", seria uma linha no console pra ganhar +1%
   em todo confronto. Aqui o servidor lê os SAVES da pessoa e conta sozinho.

   A contagem é CUMULATIVA e permanente: um pokémon que chegou ao nível 60 conta
   pra sempre, mesmo que depois seja solto ou o save apagado. Por isso existe o
   mapa specialtyCounted -- ele guarda quais pokémon já foram contados, pra não
   contar o mesmo duas vezes a cada sincronização.

   A chave de cada pokémon é slot_id_especie. Os ids (mon1, mon2...) são únicos
   DENTRO de um save, nunca entre saves -- o reconcileInstanceIdCounter do cliente
   só varre o save carregado. Usar só o id faria o mon5 do slot 2 ser confundido
   com o mon5 do slot 0. Slot resolve quase tudo; a espécie entra como desempate
   pro caso de um save ser apagado e outro criado no mesmo slot reusando ids.
   ============================================================================ */
function specialtyKeyFor(slot, p){
  return `${slot}_${p.id || 'x'}_${p.speciesId}`;
}
// tipos em que o treinador é especialista, a partir do mapa de contagens
function specialtiesFromCounts(counts){
  const out = [];
  for(const [tipo, n] of Object.entries(counts || {})){
    if(n >= SPECIALTY_THRESHOLD) out.push(tipo);
  }
  return out.sort();
}
// varre os saves e devolve o estado novo. Separado da Cloud Function pra poder ser testado sozinho
function recomputeSpecialties(saves, countsAtuais, contadosAtuais){
  const counts = Object.assign({}, countsAtuais || {});
  const contados = Object.assign({}, contadosAtuais || {});
  let novos = 0;
  for(const { slot, data } of saves){
    for(const p of ((data && data.team) || [])){
      if(!p || typeof p.level !== 'number' || p.level < SPECIALTY_LEVEL) continue;
      const chave = specialtyKeyFor(slot, p);
      if(contados[chave]) continue;
      const tipos = (SPECIES[p.speciesId] && SPECIES[p.speciesId].types) || p.types || [];
      if(tipos.length === 0) continue;
      contados[chave] = true;
      novos++;
      // tipo duplo conta +1 pra CADA tipo -- é só na hora de aplicar o buff que não acumula
      for(const t of tipos){ counts[t] = (counts[t] || 0) + 1; }
    }
  }
  return { counts, contados, novos, specialties: specialtiesFromCounts(counts) };
}

exports.syncTrainerSpecialties = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const userRef = db.collection('users').doc(uid);
  const [userSnap, savesSnap] = await Promise.all([
    userRef.get(),
    userRef.collection('saves').get()
  ]);
  const d = userSnap.exists ? userSnap.data() : {};
  const saves = savesSnap.docs.map(doc => ({ slot: doc.id, data: doc.data() }));
  const r = recomputeSpecialties(saves, d.specialtyCounts, d.specialtyCounted);
  // só escreve quando algo mudou de verdade -- essa função é chamada com frequência (a cada
  // carregamento e depois de batalhas), e gravar à toa seria escrita paga por nada
  if(r.novos > 0 || !userSnap.exists){
    await userRef.set({
      specialtyCounts: r.counts,
      specialtyCounted: r.contados,
      specialties: r.specialties
    }, { merge: true });
  }
  return { specialties: r.specialties, counts: r.counts, threshold: SPECIALTY_THRESHOLD, level: SPECIALTY_LEVEL };
});

/* ============================================================================
   TORRE DOS TREINADORES
   ----------------------------------------------------------------------------
   Referência: a Trainer Tower de FireRed/LeafGreen. 10 andares, um treinador por
   andar, times cada vez mais fortes. Todo dia, depois da meia-noite, um cron gera
   10 treinadores novos -- mesmos 10 pra todo mundo, pra a disputa ser justa e o
   ranking fazer sentido.

   Regras da subida:
   - o jogador monta um time de 6 pokémon vindos de saves com as 8 insígnias
   - não pode repetir espécie (nada de 2 Charizard)
   - o time escolhido vale a subida inteira: vencer um andar cura e revive tudo,
     perder reseta e joga de volta pro andar 1 com time novo a escolher
   - venceu os 10, a subida do dia acabou

   Tudo resolvido no SERVIDOR. As regras do Firestore deixam o dono escrever no
   próprio documento, então uma torre calculada no cliente seria um ranking que
   qualquer um forja pelo console.
   ============================================================================ */

// média de nível do time de cada andar (índice 0 = andar 1)
// médias por andar. Subiram 2 em relação à primeira versão (era 56..69): com o time do jogador
// crescendo pelo Doce Raro e pelo Bônus de Kanto, a torre precisava acompanhar
/* Escala linear: o 10º andar tem média 85 e cada andar abaixo cai 3 níveis, até 58 no primeiro.
   As versões anteriores começavam alto e subiam pouco (67 -> 83), o que fechava a porta de
   entrada: o andar 1 já exigia mais do que a jornada inteira entrega (~67 com o Bônus de Kanto e
   a Elite vencida). Agora um campeão recém-formado vence os primeiros andares e sente o aperto
   subindo -- que é o que uma torre deveria fazer. */
/* VINTE andares, média começando em 65 e subindo de 3 em 3 -- do 65 ao 122. Os últimos passam do
   nível 99 (o teto do JOGADOR) de propósito: a torre deixou de ser algo pra zerar e virou uma
   medida de até ONDE cada um chega. Ninguém precisa chegar no fim, e é isso que faz o prêmio do dia
   ter sentido -- ele vai pra quem foi mais longe, não pra quem terminou.
   Já foram 10 andares (58 a 85, calibrados pra a torre ser vencível todo dia) e 20 (65 a 122). Foi
   pra 30 em 02/09/2026, quando gente começou a chegar no 20 no mesmo dia -- o teto tem que ficar
   sempre longe o bastante pra ninguém encostar nele. Mudar este número é seguro: a torre do dia se
   refaz sozinha e quem tinha zerado a menor continua do andar seguinte (ver towerGetToday e
   towerGetRun). */
const TOWER_FLOOR_LEVELS = Array.from({ length: 30 }, (_, i) => 65 + i * 3);
const TOWER_FLOORS = TOWER_FLOOR_LEVELS.length;
const TOWER_TEAM_SIZE = 6;

/* Classes de treinador da Gen 1 (mais Enfermeira Joy e Policial Jenny, que são da série).
   Nomes próprios genéricos não diziam nada -- "Kaique" podia ser qualquer um. Uma classe já
   sugere o tipo de time que vem pela frente: Pescador puxa Água, Faixa Preta puxa Lutador.
   Líderes de ginásio ficam de fora de propósito: eles já têm o lugar deles na jornada. */
const TOWER_NPC_NAMES = [
  'Caçador de Insetos','Pokemaníaco','Pescador','Marinheiro','Motoqueiro','Campista','Picnista',
  'Montanhista','Nadador','Faixa Preta','Domador','Criador de Aves','Malabarista','Roqueiro',
  'Médium','Cientista','Engenheiro','Super Nerd','Cavalheiro','Beldade','Jogador','Ladrão',
  'Garotinho','Garotinha','Treinador Jr.','Aprendiz de Elite','Recruta Rocket','Vidente',
  'Enfermeira Joy','Policial Jenny',
  /* A partir daqui os nomes existem pra dar FOLGA ao sorteio. Com 30 nomes e 30 andares, todo dia
     usaria todos e só a ordem mudaria -- a torre pareceria a mesma torre reembaralhada. Com folga,
     cada dia traz um elenco diferente. */
  'Treinador Ás','Brigão','Sábio','Ancião','Colegial','Gêmeos','Casal','Guitarrista',
  'Executivo Rocket','Colecionador','Mestre Kimono','Fã de Pokémon','Esquiador','Cavalheira','Veterano'
];

/* Espécies de evolução final: as que não evoluem em mais nada. Inclui tanto o fim de uma linha
   (Charizard) quanto quem nunca evolui (Tauros, Lapras).
   Ao montar isso descobri que o EVOLUTIONS daqui não tinha o Voltorb, que o cliente tem -- sem a
   correção, um Voltorb nível 60 apareceria nos times da torre como se fosse evolução final. */
// Eevee evolui por PEDRA, e o jogo não modela isso -- ele não aparece no EVOLUTIONS e passaria
// como "final" no filtro. Como Vaporeon, Jolteon e Flareon já estão no pool, ele fica de fora
// Mewtwo fica de fora: ele é o desafio de fim de jogo do save, e encontrar um num andar comum
// da torre esvazia esse momento. Eevee sai porque evolui por PEDRA -- o jogo não modela isso, então
// ele não aparece no EVOLUTIONS e passaria como "final"; Vaporeon, Jolteon e Flareon já estão no pool
/* Os quatro que ninguém captura (Mewtwo, Lugia, Ho-Oh e Celebi) também não aparecem no time dos
   NPCs: encontrar num andar comum da torre um bicho que o jogador nunca vai poder ter esvazia o
   que eles são. O Eevee sai por outro motivo -- evolui por PEDRA, o jogo não modela isso, então
   ele não aparece no EVOLUTIONS e passaria como "final"; Vaporeon, Jolteon e Flareon já estão. */
const TOWER_EXCLUDED = new Set(['eevee', 'mewtwo', 'lugia', 'hooh', 'celebi']);
function towerFinalEvolutions(){
  return Object.keys(SPECIES).filter(k => !EVOLUTIONS[k] && !TOWER_EXCLUDED.has(k));
}

// sorteio com semente: o mesmo dateId sempre gera a MESMA torre, então regerar por engano
// (retry do cron, execução duplicada) não muda os adversários de quem já está subindo
function towerRng(seedStr){
  let h = 2166136261;
  for(let i=0;i<seedStr.length;i++){ h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return function(){ h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t>>>15, t|1); t ^= t + Math.imul(t ^ t>>>7, t|61); return ((t ^ t>>>14)>>>0) / 4294967296; };
}
function towerPick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }

/* Monta um time de 6 com a MÉDIA de nível pedida.
   Os níveis variam +-2 em torno da média e o resto é corrigido no último pokémon, pra a média
   bater exata -- um time todo no mesmo nível fica com cara de gerado por script. */
function towerBuildTeam(rng, mediaNivel, pool){
  const escolhidas = [];
  const usadas = new Set();
  while(escolhidas.length < TOWER_TEAM_SIZE){
    const sp = towerPick(rng, pool);
    if(usadas.has(sp)) continue;    // NPC também não repete espécie
    usadas.add(sp);
    escolhidas.push(sp);
  }
  /* Níveis espalhados em ±3 em torno da média, com os DOIS EXTREMOS garantidos: pra média 56, o time
     tem um Lv.53 e um Lv.59. Sortear livre no intervalo quase nunca produz os extremos, e o time
     acabava todo colado na média -- sem a variedade que faz um andar parecer um time de verdade.
     Os 4 do meio são sorteados e o último é ajustado pra a média fechar exata. */
  const espalhamento = 3;
  const niveis = [mediaNivel - espalhamento, mediaNivel + espalhamento]; // extremos garantidos
  for(let i=0;i<TOWER_TEAM_SIZE-3;i++){
    niveis.push(mediaNivel + Math.floor(rng()*(espalhamento*2+1)) - espalhamento);
  }
  const soma = niveis.reduce((a,b)=>a+b,0);
  let ultimo = mediaNivel*TOWER_TEAM_SIZE - soma;   // fecha a média exata
  // se o ajuste estourar o intervalo, corrige tirando a diferença dos outros -- a média continua
  // exata e ninguém sai da faixa de ±3
  if(ultimo < mediaNivel - espalhamento || ultimo > mediaNivel + espalhamento){
    const alvo = Math.max(mediaNivel - espalhamento, Math.min(mediaNivel + espalhamento, ultimo));
    let sobra = ultimo - alvo;
    ultimo = alvo;
    for(let i=2; i<niveis.length && sobra !== 0; i++){
      const limite = sobra > 0 ? (mediaNivel + espalhamento - niveis[i]) : (mediaNivel - espalhamento - niveis[i]);
      const passo = sobra > 0 ? Math.min(sobra, limite) : Math.max(sobra, limite);
      niveis[i] += passo; sobra -= passo;
    }
  }
  niveis.push(Math.max(2, ultimo));
  // embaralha pra os extremos não caírem sempre nas mesmas posições
  for(let i=niveis.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [niveis[i],niveis[j]]=[niveis[j],niveis[i]]; }
  return escolhidas.map((sp, i) => ({ speciesId: sp, level: niveis[i], shiny: false }));
}

// exportado só pro teste: é o sorteio dos times dos NPCs (ver tools/test-torre.js)
exports._towerGenerate = (dateId)=>towerGenerate(dateId);
function towerDocRef(dateId){ return db.collection('trainerTower').doc(dateId); }
function towerRunRef(uid){ return db.collection('trainerTowerRuns').doc(uid); }

function towerGenerate(dateId){
  const rng = towerRng('torre-' + dateId);
  const pool = towerFinalEvolutions();
  const nomes = TOWER_NPC_NAMES.slice();
  // embaralha e pega 10 -- sem repetir nome no mesmo dia
  for(let i=nomes.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [nomes[i],nomes[j]]=[nomes[j],nomes[i]]; }
  const floors = TOWER_FLOOR_LEVELS.map((media, idx) => ({
    floor: idx+1,
    name: nomes[idx],
    avgLevel: media,
    team: towerBuildTeam(rng, media, pool)
  }));
  return { dateId, floors, createdAt: Date.now() };
}

// cron: gera a torre do dia. Roda de hora em hora e só cria se ainda não existir --
// assim uma execução perdida na virada do dia é recuperada na hora seguinte, em vez de
// deixar o dia inteiro sem torre
exports.generateTrainerTower = onSchedule('every 60 minutes', async () => {
  const dateId = trainersLeagueTodayDateStr();
  const ref = towerDocRef(dateId);
  const snap = await ref.get();
  if(snap.exists) return null;
  await ref.set(towerGenerate(dateId));
  logger.info('Torre dos Treinadores gerada para ' + dateId);
  /* Torre nova = dia anterior acabou. Fecha ele aqui em vez de criar outra função agendada: é o
     único instante em que dá pra ter certeza da virada, e o awarded garante que rodar de novo
     não paga ninguém duas vezes. */
  await towerFecharDia(trainersLeagueDateStrPlusDays(dateId, -1)).catch(e => logger.error('Falha ao fechar a torre do dia anterior', e));
  return null;
});

/* A Torre está em avaliação e só vale pra contas com userTest=true.
   Esconder o botão no cliente não basta: as Cloud Functions são chamáveis direto pelo console, e
   quem chamasse na mão entraria no RANKING -- que é público e compartilhado. A porta tem que ser
   fechada aqui, não só na interface.
   Quando a Torre abrir pra todos, é só apagar as chamadas desta função. */
// A Torre saiu do período de testes e está aberta pra todos. A função fica aqui, agora sem efeito,
// porque é o gancho pronto caso algum modo futuro precise de acesso restrito de novo
async function towerRequireTester(uid){ return; }

// devolve a torre do dia, criando na hora se o cron ainda não passou (primeiro acesso do dia)
async function towerGetToday(){
  const dateId = trainersLeagueTodayDateStr();
  const ref = towerDocRef(dateId);
  const snap = await ref.get();
  const guardada = snap.exists ? snap.data() : null;
  /* TORRE DE OUTRA VERSÃO DO MODO É REFEITA NA HORA. Sem isso, mudar o número de andares só valia
     no dia seguinte -- a torre de hoje já estava gravada com o formato antigo. E era pior que
     esperar: quem tinha ZERADO a torre de 10 andares ficava travado no "você já venceu hoje", sem
     poder subir os andares novos. Reportado em 02/09/2026, na subida de 10 pra 20.
     A semente é a mesma (torre-<data>), então a torre refeita é a MESMA torre ampliada -- os
     adversários dos andares que já existiam continuam sendo os mesmos treinadores, com o nível da
     escala nova. */
  if(guardada && (guardada.floors || []).length === TOWER_FLOORS) return guardada;
  const gerada = towerGenerate(dateId);
  await ref.set(gerada);
  if(guardada) logger.info('Torre de ' + dateId + ' refeita: ' + (guardada.floors||[]).length + ' -> ' + TOWER_FLOORS + ' andares.');
  return gerada;
}

/* Estado da subida de um jogador, sempre do DIA DE HOJE.
   Uma subida de ontem é descartada: a torre trocou de adversários, continuar de onde parou
   não faria sentido. */
function towerFreshRun(dateId){
  // bestFloor guarda o andar mais alto alcançado HOJE. Ele existe separado do 'floor' porque a
  // derrota devolve o jogador ao andar 1 -- e sem isso os times que ele já tinha visto voltavam
  // a ficar escondidos, como se ele nunca tivesse subido
  return { dateId, floor: 1, bestFloor: 1, team: null, cleared: false, startedAt: null, lastAt: null };
}
async function towerGetRun(uid, dateId){
  const snap = await towerRunRef(uid).get();
  const d = snap.exists ? snap.data() : null;
  if(!d || d.dateId !== dateId) return towerFreshRun(dateId);
  /* SUBIDA ZERADA NUMA TORRE MENOR QUE A DE HOJE volta a ficar ativa, no andar seguinte ao último
     que ele venceu. Quem zerou os 10 andares antes da torre virar 20 travava no "você já venceu a
     torre hoje" e não conseguia jogar mais nada no dia. Ele não perde nada: os 10 que venceu
     continuam vencidos, ele só passa a ter pra onde ir. */
  if(d.cleared && (d.floor || 1) < TOWER_FLOORS){
    return Object.assign({}, d, { cleared: false, floor: Math.min(TOWER_FLOORS, (d.floor || 1) + 1) });
  }
  return d;
}

/* Andares como o jogador deve vê-los: revelados até o mais alto que ele já ALCANÇOU hoje --
   incluindo o atual, que é o próximo adversário e ele precisa ver pra montar a estratégia.
   Os de cima ficam ocultos: saber de antemão o time do andar 9 permitiria montar um time sob
   medida, e a graça é a subida às cegas.
   Uma função só, usada pela abertura da tela E pelo retorno da batalha -- quando eram duas, a
   tela ficava desatualizada depois de cada luta. */
function towerVisibleFloors(torre, run){
  const visto = Math.max(run.floor || 1, run.bestFloor || 1);
  return torre.floors.map(f => ({
    floor: f.floor, name: f.name, avgLevel: f.avgLevel,
    team: (f.floor <= visto || run.cleared) ? f.team : null
  }));
}

exports.getTrainerTower = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  await towerRequireTester(request.auth.uid);
  const torre = await towerGetToday();
  const run = await towerGetRun(request.auth.uid, torre.dateId);
  /* Rede de recuperação do Doce Raro.
     A recompensa foi adicionada DEPOIS que a Torre já estava no ar, então quem zerou antes disso
     tem a subida marcada como concluída e nunca mais passa pelo trecho que credita o doce -- ficaria
     sem, sem nenhuma forma de recuperar.
     Aqui, ao abrir a tela, uma vitória de hoje ainda não paga é quitada na hora. A marca
     candyGranted torna isso idempotente: abrir a tela dez vezes credita uma vez só. */
  let runAtual = run;
  if(run.cleared && !run.candyGranted){
    runAtual = Object.assign({}, run, { candyGranted: true });
    await towerRunRef(request.auth.uid).set(runAtual);
    await db.collection('users').doc(request.auth.uid).set({
      rareCandies: admin.firestore.FieldValue.increment(1)
    }, { merge: true });
    await createNotification(request.auth.uid, 'tower_cleared', '🍬 Doce Raro creditado!',
      'A recompensa da Torre entrou depois da sua vitória de hoje — o Doce Raro que faltava foi creditado agora.');
  }
  const uSnap = await db.collection('users').doc(request.auth.uid).get();
  const rareCandies = (uSnap.exists && uSnap.data().rareCandies) || 0;
  return { dateId: torre.dateId, floors: towerVisibleFloors(torre, runAtual), run: runAtual, rareCandies };
});

/* Começa (ou recomeça) a subida com um time montado pelo jogador.
   Validações, todas no servidor:
   - exatamente 6 pokémon
   - sem espécie repetida
   - cada um tem que EXISTIR num save da conta com as 8 insígnias, na espécie e nível informados
   O último ponto é o que impede alguém de mandar 6 Mewtwo nível 99 pelo console. */
/* MONTAR UM TIME COM POKÉMON DE QUALQUER SAVE.
   Nasceu na Torre dos Treinadores e virou função à parte quando o Ginásio da Cidade passou a montar
   time do mesmo jeito (01/09/2026): duas cópias disso divergiriam na regra de identidade, que é
   justamente a parte que já deu defeito uma vez.
   ACHA O POKÉMON ESCOLHIDO, NÃO UM XARÁ. A busca por espécie+nível pegava o PRIMEIRO que casasse:
   quem tinha o mesmo pokémon no mesmo nível em dois saves, um shiny e um normal, escolhia o shiny e
   entrava com o normal -- o shiny sumia na hora da batalha. Vai do mais específico pro mais
   genérico, e os dois últimos níveis existem só pra não quebrar cliente antigo em cache (ele manda
   só espécie e nível).
   O time volta na ORDEM ESCOLHIDA: no ginásio e na torre a ordem é do jogador, e reordenar depois é
   outra tela. */
/* SAVE + ESPÉCIE, e NÃO o id do bicho. O id (`mon7`, `mon12`...) vem de um contador que recomeça
   do 1 a cada carregamento de página e só é reconciliado com o save CARREGADO -- então dois saves
   diferentes têm `mon7` cada um. Usando o id como chave, a espera de um pokémon caía em cima do
   xará de outro save: o jogador desafiou com 6 e viu 8 apagados, um Golem e uma Meganium que ele
   nem tinha usado. Reportado em 01/09/2026.
   Save+espécie é único na conta porque um save não tem duas da mesma espécie (o encontro selvagem
   nunca oferece uma linha que o time já tem, e o montador de time recusa espécie repetida), e é
   melhor que save+POSIÇÃO por sobreviver ao jogador reordenar o próprio time.
   O cliente calcula esta MESMA chave (`chaveDoPokemon`). Se as duas divergirem, a tela libera
   quem o desafio recusa -- ou apaga quem podia lutar, que foi o defeito relatado. */
function chaveDoPokemonNaConta(slot, mon){ return 'g_' + slot + '_' + mon.speciesId; }
async function resolverTimeDosSaves(uid, escolhidos, tamanho, ondeErro, minimo){
  const onde = ondeErro || 'time';
  const min = (typeof minimo === 'number') ? minimo : tamanho;
  if(!Array.isArray(escolhidos) || escolhidos.length > tamanho || escolhidos.length < min){
    throw new HttpsError('invalid-argument', min === tamanho
      ? `O ${onde} precisa de ${tamanho} pokémon.`
      : `O ${onde} precisa de 1 a ${tamanho} pokémon.`);
  }
  const especies = new Set(escolhidos.map(p => p && p.speciesId));
  if(especies.size !== escolhidos.length){
    throw new HttpsError('invalid-argument', `Não pode repetir espécie no ${onde}.`);
  }
  const savesSnap = await db.collection('users').doc(uid).collection('saves').get();
  const disponiveis = [];
  savesSnap.forEach(doc => {
    const s = doc.data() || {};
    const badges = (typeof s.badgeCount === 'number') ? s.badgeCount : ((s.badgesEarned||[]).length);
    if(badges < 8) return;                       // só time que terminou a jornada
    // guarda DE ONDE veio: é isso que separa dois xarás de mesmo nível em saves diferentes
    (s.team || []).forEach((p, i) => disponiveis.push({ slot: doc.id, idx: i, mon: p }));
  });
  if(!disponiveis.length){
    throw new HttpsError('failed-precondition', 'Você precisa de pelo menos um save com as 8 insígnias.');
  }
  const time = [];
  const jaUsados = new Set();
  const procurar = (teste) => disponiveis.findIndex((d, i) => !jaUsados.has(i) && d.mon && teste(d));
  for(const pedido of escolhidos){
    const mesmaEspecie = (d) => d.mon.speciesId === pedido.speciesId && d.mon.level === pedido.level;
    let idx = -1;
    /* SAVE + POSIÇÃO + ESPÉCIE primeiro. O id do bicho vinha antes, e era um erro grave: ele
       (`mon7`, `mon12`...) sai de um contador que recomeça do 1 a cada carregamento de página e só
       é reconciliado com o save CARREGADO -- então dois saves têm `mon7` cada um. Procurando o id
       na conta INTEIRA, o primeiro save vencia sempre, e o jogador entrava na luta com o xará do
       outro save no lugar do pokémon que ele escolheu. Reportado em 01/09/2026: escolheu 6 de um
       save e viu um Golem e uma Meganium de outro entrarem na conta.
       A posição no save é a identidade que o cliente sabe e que não confunde xará nenhum. */
    if(pedido.slot != null && Number.isInteger(pedido.idx)){
      idx = procurar(d => String(d.slot) === String(pedido.slot) && d.idx === pedido.idx && mesmaEspecie(d));
    }
    /* O time pode ter sido reordenado desde que a tela carregou -- aí a posição não bate mais. O
       id resolve isso, mas SÓ DENTRO DO MESMO SAVE, que é onde ele é confiável. */
    if(idx < 0 && pedido.monId && pedido.slot != null){
      idx = procurar(d => String(d.slot) === String(pedido.slot) && d.mon.id === pedido.monId);
    }
    /* Os dois últimos níveis existem só pra não quebrar cliente antigo em cache, que manda apenas
       espécie e nível. Ali xará é xará mesmo: sem save nem posição, não há como distinguir --
       o shiny pelo menos separa os dois casos que mais doem. */
    if(idx < 0 && typeof pedido.shiny === 'boolean'){
      idx = procurar(d => mesmaEspecie(d) && !!d.mon.shiny === pedido.shiny);
    }
    if(idx < 0) idx = procurar(mesmaEspecie);
    if(idx < 0){
      throw new HttpsError('failed-precondition', 'Um dos pokémon escolhidos não está em nenhum time seu com 8 insígnias.');
    }
    jaUsados.add(idx);
    const achado = disponiveis[idx];
    const real = achado.mon;
    /* A CHAVE identifica ESTE pokémon na conta, e sai do que o servidor achou -- nunca do que o
       cliente mandou, senão daria pra fugir da espera do ginásio inventando um id. */
    time.push({ speciesId: real.speciesId, level: real.level, shiny: !!real.shiny,
                chave: chaveDoPokemonNaConta(achado.slot, real) });
  }
  return time;
}
exports.startTrainerTowerRun = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  await towerRequireTester(uid);
  const time = await resolverTimeDosSaves(uid, request.data?.team, TOWER_TEAM_SIZE, 'time da torre');

  const torre = await towerGetToday();
  const run = await towerGetRun(uid, torre.dateId);
  if(run.cleared){
    throw new HttpsError('failed-precondition', 'Você já venceu a torre hoje. Volte amanhã.');
  }
  /* MANTEM O ANDAR. Esta funcao passou a ser tambem o 'trocar de time' -- e mandar o jogador de
     volta pro andar 1 ao trocar anularia a regra de que perder nao volta pro comeco. Ela zerava o
     andar porque, no modelo antigo, so era chamada no comeco da subida. */
  const novo = { dateId: torre.dateId, floor: run.floor || 1, bestFloor: Math.max(run.floor || 1, run.bestFloor || 1),
                 team: time, cleared: false, startedAt: run.startedAt || Date.now(), lastAt: Date.now() };
  await towerRunRef(uid).set(novo);
  return { run: novo };
});

/* Enfrenta o andar atual. Vencer sobe um andar e CURA o time (o proximo andar comeca cheio);
   perder deixa o jogador NO MESMO ANDAR, com o time intacto -- ele tenta de novo, com o mesmo
   time ou com outro. */
exports.fightTrainerTowerFloor = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  await towerRequireTester(uid);
  const torre = await towerGetToday();
  const run = await towerGetRun(uid, torre.dateId);
  if(run.cleared) throw new HttpsError('failed-precondition', 'Você já venceu a torre hoje.');
  if(!run.team || !run.team.length) throw new HttpsError('failed-precondition', 'Monte um time antes de subir.');

  const andar = torre.floors[run.floor - 1];
  if(!andar) throw new HttpsError('internal', 'Andar inválido.');

  const meuTime = run.team.map(p => {
    const inst = createInstance(p.speciesId, p.level);
    inst.shiny = !!p.shiny;   // createInstance não traz a flag, e sem ela o buff de shiny sumiria
    return inst;
  });
  const timeNpc = andar.team.map(p => createInstance(p.speciesId, p.level));

  // especialidade de tipo do jogador vale aqui também, como em qualquer batalha
  const userSnap = await db.collection('users').doc(uid).get();
  applySpecialtyBuff(meuTime, (userSnap.exists && userSnap.data().specialties) || []);

  const resultado = simulateGymBattle(meuTime, timeNpc, Math.random);
  const venceu = !!resultado.win;

  let novo;
  if(venceu){
    const proximo = run.floor + 1;
    const zerou = proximo > TOWER_FLOORS;
    novo = {
      dateId: torre.dateId,
      floor: zerou ? TOWER_FLOORS : proximo,
      bestFloor: Math.max(run.bestFloor||1, zerou ? TOWER_FLOORS : proximo),
      team: run.team,          // o time segue o mesmo; a cura é implícita (cada andar recria as instâncias)
      cleared: zerou,
      candyGranted: zerou ? true : !!run.candyGranted,  // marca que o doce dessa vitória já foi pago

      startedAt: run.startedAt,
      lastAt: Date.now()
    };
    if(zerou){
      await towerRegisterClear(uid, torre.dateId);
    }
  } else {
    /* PERDER NÃO VOLTA PRO COMEÇO. Antes a derrota zerava a subida, e o jogador refazia oito
       andares que ele já tinha vencido pra chegar de novo onde parou -- refazer o caminho não mede
       nada, e o que a torre mede é ATÉ ONDE ele vai. Ele fica no mesmo andar e tenta de novo.
       O time NÃO é apagado: quem quiser repetir não precisa remontar 6 pokémon a cada derrota, e
       quem quiser trocar tem o botão na tela. */
    novo = { dateId: torre.dateId, floor: run.floor, bestFloor: Math.max(run.floor, run.bestFloor||1),
             team: run.team, cleared: false, startedAt: run.startedAt, lastAt: Date.now() };
  }
  await towerRunRef(uid).set(novo);
  /* Registra ATE ONDE ele chegou hoje, ganhando ou perdendo -- e este documento que o fechamento
     do dia le pra saber quem foi mais longe. O da subida (trainerTowerRuns) e sobrescrito na
     virada do dia, entao ele nao serve pra isso. */
  await towerRegistrarDia(uid, torre.dateId, novo.bestFloor);
  // devolve a lista INTEIRA de andares já com a máscara nova. Antes eu mandava só o time do andar
  // enfrentado, e o andar SEGUINTE continuava como "time desconhecido" até a pessoa sair e voltar --
  // era o mesmo bug, um andar adiante. Mandando a lista toda, a tela nunca fica atrasada
  // devolve a contagem de doces junto: o crédito acontece aqui no servidor (towerRegisterClear),
  // e sem mandar o número novo a tela seguia mostrando o que carregou ao ABRIR -- ou seja, quem
  // zerava a torre não via o doce até sair e voltar
  const uSnap = await db.collection('users').doc(uid).get();
  const rareCandies = (uSnap.exists && uSnap.data().rareCandies) || 0;
  return { win: venceu, matchups: resultado.matchups, floor: andar.floor, npcName: andar.name,
           floors: towerVisibleFloors(torre, novo), run: novo, rareCandies };
});

/* Ranking: quantas vezes cada treinador já zerou a torre. Como só dá pra zerar uma vez por dia,
   isso é o mesmo que "em quantos dias diferentes ele venceu os 10 andares".
   Indexado por UID (e não por nome, como os rankings de liga) justamente pra não repetir o
   problema de nome preso que a troca de apelido causou lá. */
/* Teto de nível. O jogo nunca teve um: a distribuição para no 55 e os desmaios empurram além disso
   sem limite. Com o doce entrando como fonte diária e permanente, um teto explícito passa a ser
   necessário -- senão, em algumas centenas de dias, existiriam pokémon de nível 300.
   99 é o nível do Mewtwo do desafio, o mais forte que o jogo já mostra. */
const MAX_POKEMON_LEVEL = 99;

/* ATÉ ONDE VOCÊ FOI HOJE, guardado por DIA e por jogador.
   Precisa ser um documento à parte porque o da subida (trainerTowerRuns/{uid}) é sobrescrito no dia
   seguinte -- sem esta cópia, fechar o dia depois da virada não teria o que ler.
   Grava em toda mudança de andar: são no máximo 20 escritas por jogador por dia. */
async function towerRegistrarDia(uid, dateId, bestFloor){
  const userSnap = await db.collection('users').doc(uid).get();
  const nome = (userSnap.exists && userSnap.data().trainerName) || 'Treinador';
  await db.collection('trainerTowerDays').doc(dateId).collection('players').doc(uid)
    .set({ uid, name: nome, bestFloor, updatedAt: Date.now() }, { merge: true });
}
/* FECHA O DIA: quem foi MAIS LONGE leva o Doce Raro e o ponto no ranking.
   EMPATE PREMIA TODOS -- se dois pararam no andar 14 e ninguém passou disso, os dois ganham. É o
   que o modo pede: a torre não tem que ser vencida, tem que ser subida mais que os outros.
   Roda junto com a geração da torre do dia seguinte: é o instante em que se sabe que o dia anterior
   acabou, e evita mais uma função agendada. Idempotente pelo campo awarded -- o cron roda de hora
   em hora e não pode pagar duas vezes. */
async function towerFecharDia(dateId){
  const diaRef = db.collection('trainerTowerDays').doc(dateId);
  const diaSnap = await diaRef.get();
  if(diaSnap.exists && diaSnap.data().awarded) return null;
  const jogadores = await diaRef.collection('players').get();
  if(jogadores.empty){
    await diaRef.set({ awarded: true, topFloor: 0, winners: [], closedAt: Date.now() }, { merge: true });
    return { topFloor: 0, vencedores: 0 };
  }
  let topFloor = 0;
  jogadores.forEach(d => { topFloor = Math.max(topFloor, d.data().bestFloor || 0); });
  const vencedores = jogadores.docs.map(d => d.data()).filter(x => (x.bestFloor || 0) === topFloor);
  await diaRef.set({ awarded: true, topFloor,
                     winners: vencedores.map(v => ({ uid: v.uid, name: v.name })),
                     closedAt: Date.now() }, { merge: true });
  for(const v of vencedores){ await towerPremiarTopo(v.uid, v.name, dateId, topFloor, vencedores.length); }
  logger.info('Torre ' + dateId + ' fechada: andar ' + topFloor + ', ' + vencedores.length + ' premiado(s).');
  return { topFloor, vencedores: vencedores.length };
}
/* O prêmio: um Doce Raro e um ponto no ranking. O ranking passou a contar EM QUANTOS DIAS o
   treinador ficou no andar mais alto -- é o que o modo mede agora. O campo antigo (clears, dias
   em que ele zerou os 10 andares) fica no documento como história, mas não ordena mais nada:
   com 20 andares e média 122 no topo, zerar deixou de ser o objetivo. */
async function towerPremiarTopo(uid, nome, dateId, topFloor, quantos){
  const ref = db.collection('trainerTowerRanking').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : {};
    if(d.lastTopDate === dateId) return;   // trava dupla contra pagar o mesmo dia 2x
    tx.set(ref, { uid, name: nome || d.name || 'Treinador',
                  topDays: (d.topDays || 0) + 1,
                  lastTopDate: dateId, bestFloorEver: Math.max(d.bestFloorEver || 0, topFloor),
                  updatedAt: Date.now() }, { merge: true });
  });
  await db.collection('users').doc(uid).set({
    rareCandies: admin.firestore.FieldValue.increment(1)
  }, { merge: true });
  const dividido = quantos > 1 ? ` Você dividiu o topo com mais ${quantos-1} treinador${quantos-1===1?'':'es'}.` : '';
  await createNotification(uid, 'tower_top', '🗼 Você foi o mais longe na Torre!',
    `Ninguém passou do andar ${topFloor} na torre de ontem, e você chegou lá.${dividido} Ganhou um 🍬 Doce Raro e mais um ponto no ranking da Torre.`);
}
async function towerRegisterClear(uid, dateId){
  const userSnap = await db.collection('users').doc(uid).get();
  const nome = (userSnap.exists && userSnap.data().trainerName) || 'Treinador';
  const ref = db.collection('trainerTowerRanking').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : { clears: 0 };
    if(d.lastClearDate === dateId) return;   // trava dupla contra registrar o mesmo dia 2x
    tx.set(ref, {
      uid, name: nome,
      clears: (d.clears || 0) + 1,
      lastClearDate: dateId,
      updatedAt: Date.now()
    }, { merge: true });
  });
  /* O DOCE NÃO É PAGO AQUI. Ele virou o prêmio de quem foi MAIS LONGE no dia (towerFecharDia), e
     quem zera os 20 andares certamente está no topo -- pagar aqui também seria pagar duas vezes.
     A notificação fica: zerar 20 andares com média 122 no último merece ser dito na hora. */
  await createNotification(uid, 'tower_cleared', '🗼 Você chegou ao TOPO da Torre!',
    'Você subiu a torre inteira de hoje. Ninguém vai passar disso: o prêmio de quem foi mais longe sai na virada do dia. Volte amanhã, a torre é outra.');
}

/* Reordena o time da subida em andamento. A ordem importa: o primeiro da lista enfrenta o
   primeiro do adversário, e como o HP carrega dentro do confronto, quem abre a luta muda o
   resultado. Fica no servidor porque o time da subida mora lá -- o cliente só manda a nova ordem.
   Aceita apenas uma PERMUTAÇÃO do time atual: não dá pra trocar pokémon nem nível por aqui. */
exports.setTrainerTowerOrder = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  await towerRequireTester(uid);
  const ordem = Array.isArray(request.data?.order) ? request.data.order : null;
  const torre = await towerGetToday();
  const run = await towerGetRun(uid, torre.dateId);
  if(!run.team || !run.team.length) throw new HttpsError('failed-precondition', 'Não há subida em andamento.');
  if(!ordem || ordem.length !== run.team.length) throw new HttpsError('invalid-argument', 'Ordem inválida.');
  // valida que é permutação dos MESMOS índices, sem repetir nem faltar
  const vistos = new Set();
  for(const i of ordem){
    if(!Number.isInteger(i) || i < 0 || i >= run.team.length || vistos.has(i)){
      throw new HttpsError('invalid-argument', 'Ordem inválida.');
    }
    vistos.add(i);
  }
  const novo = Object.assign({}, run, { team: ordem.map(i => run.team[i]), lastAt: Date.now() });
  await towerRunRef(uid).set(novo);
  return { run: novo };
});

/* Repropaga o time pras inscrições de liga ATIVAS daquele save.
   A inscrição guarda um "código do time" congelado no momento em que foi feita -- isso é proposital
   pra ninguém trocar de time no meio de uma competição. Mas subir um nível com o Doce Raro não é
   trocar de time: é o MESMO time, mais forte. Sem esta função, o jogador precisava cancelar e se
   inscrever de novo pra a mudança valer, o que é confuso e fácil de esquecer.
   Só mexe em inscrições de ciclos que ainda não começaram a valer; ciclos em andamento ficam como
   estão, senão o nível mudaria no meio de uma disputa já em curso. */
async function atualizarInscricoesComTime(uid, slot, team){
  const novoCodigo = encodeTeamCode(team);
  let atualizadas = 0;
  try{
    /* Ligas Clássica e customizadas. Os ciclos ficam listados num doc de agenda por tipo de liga
       (schedule_<tipo>), e só os de status 'registering' interessam: um ciclo já sorteado está com
       partidas em andamento, e mudar o nível no meio de uma disputa seria pior que não atualizar. */
    const tipos = [CLASSIC_LEAGUE_TYPE];
    const tiposSnap = await leagueTypesCollRef().get();
    tiposSnap.forEach(d => { if(d.id !== CLASSIC_LEAGUE_TYPE) tipos.push(d.id); });
    for(const typeId of tipos){
      const agenda = await scheduleDocRef(typeId).get();
      if(!agenda.exists) continue;
      const ciclos = (agenda.data().cycles || []).filter(c => c.status === 'registering');
      for(const c of ciclos){
        const regs = await registrantsCollRef(typeId, c.id).where('uid','==',uid).get();
        for(const reg of regs.docs){
          const d = reg.data() || {};
          if(String(d.slot) !== String(slot)) continue;   // outro save: não mexe
          if(d.code === novoCodigo) continue;
          await reg.ref.set({ code: novoCodigo }, { merge: true });
          atualizadas++;
        }
      }
    }
    /* Trainers League: a inscrição guarda eligibleCodes (a lista de times aptos daquela conta), e
       não um código só. Recalcular a lista inteira é mais simples e seguro que tentar achar e
       trocar um código específico dentro dela. */
    const hojeTL = trainersLeagueTodayDateStr();
    const regTL = await trainersLeagueRegistrantRef(hojeTL, uid).get();
    if(regTL.exists){
      const codes = await trainersLeagueGatherEligibleCodesForUid(uid);
      if(codes.length){
        await trainersLeagueRegistrantRef(hojeTL, uid).set({ eligibleCodes: codes }, { merge:true });
        atualizadas++;
      }
    }
  } catch(e){ logger.error('Erro ao repropagar time nas inscrições:', e); }
  return atualizadas;
}

/* Gasta um Doce Raro: +1 nível num pokémon específico de um save específico.
   Tudo validado no servidor -- as regras do Firestore deixam o dono escrever no próprio documento,
   então um doce contado no cliente seria níveis de graça pra quem abrisse o console. */
exports.useRareCandy = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const slot = String(request.data?.slot ?? '');
  const monId = String(request.data?.monId ?? '');
  if(!slot || !monId) throw new HttpsError('invalid-argument', 'Escolha um pokémon.');

  const userRef = db.collection('users').doc(uid);
  const saveRef = userRef.collection('saves').doc(slot);
  const [userSnap, saveSnap] = await Promise.all([userRef.get(), saveRef.get()]);
  const doces = (userSnap.exists && userSnap.data().rareCandies) || 0;
  if(doces <= 0) throw new HttpsError('failed-precondition', 'Você não tem Doce Raro.');
  if(!saveSnap.exists) throw new HttpsError('failed-precondition', 'Save não encontrado.');

  const save = saveSnap.data() || {};
  const time = (save.team || []).slice();
  const idx = time.findIndex(p => p && p.id === monId);
  if(idx < 0) throw new HttpsError('failed-precondition', 'Esse pokémon não está nesse time.');
  if((time[idx].level || 0) >= MAX_POKEMON_LEVEL){
    throw new HttpsError('failed-precondition', `Esse pokémon já está no nível máximo (${MAX_POKEMON_LEVEL}).`);
  }

  time[idx] = Object.assign({}, time[idx], { level: (time[idx].level || 0) + 1 });
  await saveRef.set({ team: time }, { merge: true });
  await userRef.set({ rareCandies: admin.firestore.FieldValue.increment(-1) }, { merge: true });
  // sem isso, um time já inscrito numa liga continuaria competindo com o nível ANTIGO: a inscrição
  // guarda um código do time tirado no momento em que ela é feita, e ele não se atualiza sozinho
  const ligasAtualizadas = await atualizarInscricoesComTime(uid, slot, time);
  return { rareCandies: doces - 1, leaguesUpdated: ligasAtualizadas,
           mon: { id: monId, level: time[idx].level, speciesId: time[idx].speciesId } };
});

exports.getTrainerTowerRanking = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  await towerRequireTester(request.auth.uid);
  /* Ordena por DIAS NO TOPO -- quantas vezes o treinador chegou no andar mais alto do dia. O
     clears antigo (dias em que ele zerou os 10 andares) continua no documento como história, mas
     não ordena mais: com 20 andares e média 122 no último, zerar deixou de ser o objetivo. */
  const snap = await db.collection('trainerTowerRanking').orderBy('topDays', 'desc').limit(10).get();
  /* O RANKING DE HOJE vem junto, na MESMA chamada. São duas coisas diferentes e as duas importam:
     o geral diz quem é bom nisso há tempo, e o de hoje diz quem está na frente AGORA -- que é o que
     faz o jogador voltar antes da virada do dia pra tentar passar alguém.
     Sai do mesmo documento que o fechamento do dia lê (trainerTowerDays), então não custa uma
     estrutura nova; é só ordenar por bestFloor. */
  const dateId = trainersLeagueTodayDateStr();
  const hojeSnap = await db.collection('trainerTowerDays').doc(dateId).collection('players')
    .orderBy('bestFloor', 'desc').limit(10).get();
  return {
    top: snap.docs.map(d => {
      const x = d.data();
      return { uid: x.uid, name: x.name, topDays: x.topDays || 0, bestFloorEver: x.bestFloorEver || 0,
               clears: x.clears || 0 };
    }),
    hoje: hojeSnap.docs.map(d => {
      const x = d.data();
      return { uid: x.uid, name: x.name, bestFloor: x.bestFloor || 0 };
    })
  };
});


/* ============================================================================
   BATALHA ONLINE -- confronto a confronto, em tempo real
   ----------------------------------------------------------------------------
   Diferente de todas as outras batalhas do jogo, esta NÃO é resolvida de uma vez.
   Ela para a cada desmaio e dá 5 segundos pros dois treinadores escolherem quem
   entra. Quem não escolher a tempo manda o próximo da ordem.

   Como o tempo passa sem ninguém rodando código: não há cron nem servidor
   segurando a partida. O estado guarda um PRAZO, e quem consultar depois dele
   dispara a resolução do confronto. Os dois clientes consultam a cada segundo,
   então na prática a batalha anda sozinha -- e se os dois fecharem a aba, ela
   simplesmente congela até alguém voltar, em vez de gastar recursos esperando.

   Toda mudança de estado acontece em transação: os dois lados escrevem no mesmo
   documento ao escolher, e sem isso duas escolhas simultâneas se perderiam.
   ============================================================================ */
const BATTLE_QUEUE_TTL_MS = 90 * 1000;   // entrada na fila expira: aba fechada não deixa fantasma
const BATTLE_PICK_MS = 5000;             // janela pra trocar de pokémon no meio da batalha
/* A escolha do INICIAL tem janela maior: é a única decisão feita com os dois times inteiros de
   pé, olhando 6 contra 6. As trocas do meio da batalha são mais simples -- sobram poucos vivos e
   a urgência faz parte -- então continuam com 5s. */
const BATTLE_FIRST_PICK_MS = 10000;
const GRACA_REDE_MS = 600;   // folga pra escolhas em trânsito (ver battleAdvance)
/* Tempo reservado pra ANIMAÇÃO do confronto antes da janela de escolha começar a valer.
   Sem isso o prazo começava a correr no instante em que o servidor resolvia a luta -- e como o
   cliente leva ~2s mostrando as barras de HP descendo, sobravam 3 segundos pra escolher, não 5. */
/* Tempo reservado pra animação, antes de a janela de escolha começar a contar.
   São até 3 golpes, cada um com transição de até 1,4s mais 260ms de respiro -- no pior caso a
   animação leva ~5s. Reservar menos que isso fazia a contagem de 5 segundos começar durante a
   animação, e o jogador via o cronômetro já em 2 ou 1 quando o painel abria. */
const BATTLE_ANIM_MS = 5200;
const BATTLE_INTRO_MS = 10000;      // apresentação dos dois treinadores
const BATTLE_COUNTDOWN_MS = 3000;   // 3, 2, 1, COMEÇAR!
const BATTLE_IDLE_MS = 3 * 60 * 1000;    // batalha parada sem ninguém consultar: encerrada

/* Janela pra aceitar a partida. Quem estiver jogando um save recebe um aviso e tem esse tempo
   pra voltar; quem não voltar sai da busca e o outro volta pra fila automaticamente.
   É o que permite buscar oponente sem ficar preso na tela: ninguém é jogado numa batalha sem
   confirmar, e ninguém fica esperando indefinidamente por alguém que sumiu. */
const BATTLE_ACCEPT_MS = 15000;

/* Janela pra ESCOLHER O TIME -- com os dois treinadores JÁ conectados.
   Antes o time era escolhido antes de entrar na fila, e a pessoa ficava presa àquele time por
   minutos esperando um oponente que talvez nem aparecesse. Agora o cliente manda TODOS os times
   elegíveis ao entrar na fila (ou no lobby) e escolhe UM POR ÍNDICE quando a partida já existe.
   Mandar a lista inteira lá atrás é o que permite ter um padrão: se o jogador não escolher (ou
   fechar a aba), o servidor entra com o primeiro da lista sozinho -- ele não tem os times salvos,
   só o que o cliente enviou. */
const BATTLE_TEAM_PICK_MS = 15000;
const MAX_BATTLE_CODES = 10;   // mesmo teto de saves do cliente (MAX_SAVE_SLOTS)

function battleQueueColl(){ return db.collection('onlineBattleQueue'); }
function pendingMatchRef(id){ return db.collection('onlinePendingMatch').doc(id); }
function matchPointerRef(uid){ return db.collection('onlineMatchPointer').doc(uid); }
function onlineBattleRef(id){ return db.collection('onlineBattles').doc(id); }

/* Estatísticas de batalha online do jogador. Ficam no documento dele:
   onlineWins, onlineLosses e onlineSpecies (mapa espécie -> quantas vezes entrou numa batalha).
   O "pokémon favorito" sai do mapa: o mais usado. */
function battleStatsFrom(userData){
  const usos = userData.onlineSpecies || {};
  let favorito = null, max = 0;
  for(const [sp, n] of Object.entries(usos)){ if(n > max){ max = n; favorito = sp; } }
  /* Sequência atual (vitórias ou derrotas seguidas) sai do histórico que já guardamos.
     Entra na apresentação porque diz mais sobre o adversário que você vai encarar do que o
     placar total: 10 vitórias com 8 derrotas recentes é um jogador diferente de 10 seguidas. */
  const hist = userData.onlineHistory || [];
  let seq = 0, seqVitoria = null;
  if(hist.length){
    seqVitoria = !!hist[0].venceu;
    for(const p of hist){ if(!!p.venceu !== seqVitoria) break; seq++; }
  }
  return {
    wins: userData.onlineWins || 0,
    losses: userData.onlineLosses || 0,
    favorito, favoritoUsos: max,
    seq, seqVitoria,
    elite: !!userData.eliteChampion
  };
}

// A Batalha Online saiu do período de testes e está aberta pra todos. A função fica aqui, agora
// sem efeito, como gancho pronto caso algum modo futuro precise de acesso restrito
async function battleRequireTester(uid){ return; }

// instância "crua" pra guardar no documento: só o que muda de confronto pra confronto
function battleInstances(code){
  const time = decodeTeamCode(code);
  if(!time) return null;
  return time.map(p=>{
    const inst = createInstance(p.speciesId, p.level);
    inst.shiny = !!p.shiny;
    inst.maxHp = calcMaxHp(inst);
    inst.hp = inst.maxHp;
    return { speciesId: inst.speciesId, name: inst.name, level: inst.level,
             shiny: !!inst.shiny, hp: inst.hp, maxHp: inst.maxHp };
  });
}
/* Times elegíveis que o cliente mandou, todos de uma vez e na MESMA ORDEM da tela dele --
   a escolha depois é só um índice nessa lista. Validar aqui é o que impede um código forjado
   de virar time no meio da batalha. */
function battleCodes(data){
  const bruto = Array.isArray(data?.codes) ? data.codes : (data?.code ? [data.code] : []);
  const codes = [];
  for(const c of bruto.slice(0, MAX_BATTLE_CODES)){
    const s = String(c || '');
    if(!s) continue;
    const time = decodeTeamCode(s);
    if(!time || !time.length) continue;
    codes.push(s);
  }
  return codes;
}
/* Faixa de nível dos times de um jogador, pro lobby. Com vários times não existe mais "a média
   dele" -- mostrar a faixa diz o que dá pra esperar sem entregar qual time ele vai escolher. */
function battleMediaRange(codes){
  const medias = (codes||[]).map(c=>{
    const t = decodeTeamCode(c) || [];
    return t.length ? t.reduce((a,p)=>a+(p.level||0),0)/t.length : 0;
  }).filter(m=>m>0);
  if(!medias.length) return null;
  return { min: Math.round(Math.min(...medias)), max: Math.round(Math.max(...medias)) };
}
function battleHydrate(guardado){
  const inst = createInstance(guardado.speciesId, guardado.level);
  inst.shiny = !!guardado.shiny;
  inst.maxHp = guardado.maxHp;
  inst.hp = guardado.hp;
  return inst;
}
function battlePrimeiroVivo(time, atual){
  if(time[atual] && time[atual].hp > 0) return atual;
  for(let i=0;i<time.length;i++){ if(time[i].hp>0) return i; }
  return -1;
}

/* Resolve UM confronto: os dois ativos trocam golpes até alguém cair.
   É o miolo do simulateGymBattle, extraído -- lá ele roda em laço até o time acabar; aqui
   precisa parar depois de um confronto pra abrir a janela de escolha. */
function battleResolveMatchup(estado, rng){
  const a = battleHydrate(estado.aTeam[estado.aCurrent]);
  const b = battleHydrate(estado.bTeam[estado.bCurrent]);
  applySpecialtyBuff([a], estado.aSpecialties);
  applySpecialtyBuff([b], estado.bSpecialties);
  const aHpAntes = a.hp, bHpAntes = b.hp;
  const aVivosAntes = estado.aTeam.filter(p=>p.hp>0).length;
  const bVivosAntes = estado.bTeam.filter(p=>p.hp>0).length;
  const diario = [];
  while(a.hp>0 && b.hp>0){ doExchange(a, b, rng, diario); }
  // grava o HP de volta no estado
  estado.aTeam[estado.aCurrent].hp = Math.max(0, a.hp);
  estado.bTeam[estado.bCurrent].hp = Math.max(0, b.hp);
  const aCaiu = a.hp<=0, bCaiu = b.hp<=0;
  return {
    player:a.name, playerSpecies:a.speciesId, playerLevel:a.level, playerShiny:!!a.shiny, playerBuffed:false,
    enemy:b.name, enemySpecies:b.speciesId, enemyLevel:b.level, enemyShiny:!!b.shiny, enemyBuffed:false,
    winner: (aCaiu && bCaiu) ? null : (bCaiu ? a.name : b.name),
    isTrade: aCaiu && bCaiu,
    suddenDeath:false, suddenDeathMessage:null,
    playerWon: bCaiu && !aCaiu,
    playerHpBefore:aHpAntes, playerHpAfter:Math.max(0,a.hp), playerMaxHp:a.maxHp,
    enemyHpBefore:bHpAntes, enemyHpAfter:Math.max(0,b.hp), enemyMaxHp:b.maxHp,
    playerAliveBefore:aVivosAntes, playerAliveAfter: aCaiu?aVivosAntes-1:aVivosAntes, playerTeamSize:estado.aTeam.length,
    enemyAliveBefore:bVivosAntes, enemyAliveAfter: bCaiu?bVivosAntes-1:bVivosAntes, enemyTeamSize:estado.bTeam.length,
    playerMove: a.lastMoveType || null, enemyMove: b.lastMoveType || null,
    golpes: diario   // passo a passo do confronto, na ordem em que aconteceu
  };
}

/* Avança a partida até onde der: resolve confrontos vencidos pelo relógio e para quando
   precisar de escolha (com prazo em aberto) ou quando a batalha acabar.
   Chamada por QUALQUER consulta -- é o que faz o tempo "andar" sem cron. */
function battleAdvance(estado){
  let voltas = 0;
  /* ESCOLHA DO TIME -- 15s, agora que os dois já estão conectados.
     Diferente da janela de escolha do POKÉMON (que vale inteira, sempre, porque é o ritmo da
     batalha), esta acaba assim que os dois escolhem: aqui não há nada acontecendo na tela, e
     segurar quinze segundos com os dois prontos é só tempo morto antes de a partida começar. */
  if(estado.phase === 'teamPick'){
    const doisEscolheram = Number.isInteger(estado.aTeamChoice) && Number.isInteger(estado.bTeamChoice);
    if(!doisEscolheram && Date.now() < (estado.teamUntil || 0) + GRACA_REDE_MS) return estado;
    // quem não escolheu a tempo entra com o primeiro time da lista dele
    const montar = (codes, idx) => {
      const lista = codes || [];
      const i = (Number.isInteger(idx) && idx >= 0 && idx < lista.length) ? idx : 0;
      return battleInstances(lista[i]) || [];
    };
    estado.aTeam = montar(estado.aCodes, estado.aTeamChoice);
    estado.bTeam = montar(estado.bCodes, estado.bTeamChoice);
    // sem time válido de algum lado não existe batalha: encerra sem vencedor em vez de travar
    if(!estado.aTeam.length || !estado.bTeam.length){
      estado.phase = 'done'; estado.winnerUid = null; estado.updatedAt = Date.now();
      return estado;
    }
    estado.aCurrent = 0; estado.bCurrent = 0;
    estado.phase = 'intro';
    estado.introUntil = Date.now() + BATTLE_INTRO_MS;
    estado.updatedAt = Date.now();
    return estado;   // daqui pra frente a sequência é a de sempre: apresentação, inicial, 3-2-1
  }
  /* Sequência de abertura: apresentação (10s) -> escolha do inicial (5s) -> 3,2,1 (3s) -> luta.
     A escolha do inicial usa a MESMA fase 'choosing' das trocas do meio da batalha: o jogador
     escolhe quem entra, e quem não escolher manda o primeiro da ordem. A única diferença é que
     depois dela vem a contagem regressiva, e não o confronto direto. */
  if(estado.phase === 'intro'){
    if(Date.now() < (estado.introUntil || 0)) return estado;
    estado.phase = 'choosing';
    estado.aChoice = null; estado.bChoice = null;   // ninguém escolheu ainda: o padrão é o 1º
    estado.deadline = Date.now() + BATTLE_FIRST_PICK_MS;
  }
  // fim da escolha do inicial: entra a contagem regressiva antes do 1º golpe
  if(estado.phase === 'choosing' && estado.matchups.length === 0 && !estado.countdownDone
     && Date.now() >= (estado.deadline + GRACA_REDE_MS)){
    // congela as escolhas agora; sem isso o padrão seria recalculado depois da contagem
    if(typeof estado.aChoice !== 'number') estado.aChoice = battlePrimeiroVivo(estado.aTeam, 0);
    if(typeof estado.bChoice !== 'number') estado.bChoice = battlePrimeiroVivo(estado.bTeam, 0);
    estado.aCurrent = estado.aChoice; estado.bCurrent = estado.bChoice;
    estado.phase = 'countdown';
    estado.countdownUntil = Date.now() + BATTLE_COUNTDOWN_MS;
    estado.updatedAt = Date.now();
    return estado;
  }
  if(estado.phase === 'countdown'){
    if(Date.now() < (estado.countdownUntil || 0)) return estado;
    estado.countdownDone = true;
    estado.phase = 'choosing';
    estado.deadline = Date.now();   // vencido: o 1º confronto resolve já, com os iniciais escolhidos
  }
  /* GRACA_REDE: o confronto só é resolvido um instante DEPOIS do prazo. É a folga pra escolhas
     que saíram a tempo mas ainda estavam viajando -- sem ela, quem clica faltando 1 segundo tem
     a escolha ignorada por causa da latência, e o pokémon que entra não é o que ele mandou. */
  while(estado.phase === 'choosing' && Date.now() >= (estado.deadline + GRACA_REDE_MS) && voltas++ < 12){
    // quem não escolheu a tempo segue com quem já estava (ou o próximo vivo)
    const aEscolha = (typeof estado.aChoice === 'number') ? estado.aChoice : battlePrimeiroVivo(estado.aTeam, estado.aCurrent);
    const bEscolha = (typeof estado.bChoice === 'number') ? estado.bChoice : battlePrimeiroVivo(estado.bTeam, estado.bCurrent);
    if(aEscolha < 0 || bEscolha < 0){ estado.phase = 'done'; break; }
    estado.aCurrent = aEscolha; estado.bCurrent = bEscolha;
    estado.aChoice = null; estado.bChoice = null;

    const rng = makeSeededRng(estado.id + ':' + estado.matchups.length);
    const m = battleResolveMatchup(estado, rng);
    estado.matchups.push(m);

    const aVivos = estado.aTeam.filter(p=>p.hp>0).length;
    const bVivos = estado.bTeam.filter(p=>p.hp>0).length;
    if(aVivos===0 || bVivos===0){
      estado.phase = 'done';
      /* Os DOIS zerados só acontece por autodestruição, e aí quem explodiu leva a partida --
         mesma regra da jornada. Fora isso continua sem vencedor (não deveria acontecer). */
      const zeraramJuntos = aVivos===0 && bVivos===0;
      estado.winnerUid = (bVivos===0 && aVivos>0) ? estado.a.uid
        : ((aVivos===0 && bVivos>0) ? estado.b.uid
        : (zeraramJuntos && explosaoDoAtivo === true ? estado.a.uid
        : (zeraramJuntos && explosaoDoAtivo === false ? estado.b.uid : null)));
    } else {
      estado.phase = 'choosing';
      // a animação roda primeiro; só depois dela os 5 segundos de escolha começam
      estado.animUntil = Date.now() + BATTLE_ANIM_MS;
      estado.deadline = estado.animUntil + BATTLE_PICK_MS;
    }
  }
  estado.updatedAt = Date.now();
  return estado;
}
// o que o jogador pode ver: o time do adversário sem HP oculto (ele já viu na batalha)
function battleView(estado, uid){
  const souA = estado.a.uid === uid;
  // na fase de escolha de time os dois ainda estão vazios -- o || [] evita quebrar a tela ali
  const meu = (souA ? estado.aTeam : estado.bTeam) || [];
  const dele = (souA ? estado.bTeam : estado.aTeam) || [];
  return {
    id: estado.id,
    /* A hora do SERVIDOR viaja em toda resposta. O cliente usa ela pra calcular a diferença pro
       relógio dele e corrigir a contagem: sem isso, um celular 2s adiantado mostra a janela de
       escolha inteira deslocada, e a pessoa vê "5" quando já restam 3. */
    serverNow: Date.now(),
    phase: estado.phase,
    deadline: estado.deadline || null,
    animUntil: estado.animUntil || null,
    introUntil: estado.introUntil || null,
    teamUntil: estado.teamUntil || null,
    /* Os códigos de time que EU mandei -- e só os meus. Mandar os do adversário entregaria os
       times dele antes de a batalha começar, que é justamente o que a escolha às cegas evita.
       Vão de volta pro cliente pra a lista da tela bater com os índices que o servidor tem,
       mesmo que a lista local dele tenha mudado enquanto ele esperava na fila. */
    meusTimes: estado.phase === 'teamPick' ? ((souA ? estado.aCodes : estado.bCodes) || []) : null,
    escolhiTime: Number.isInteger(souA ? estado.aTeamChoice : estado.bTeamChoice),
    timeIdx: (souA ? estado.aTeamChoice : estado.bTeamChoice),
    oponenteEscolheuTime: Number.isInteger(souA ? estado.bTeamChoice : estado.aTeamChoice),
    countdownUntil: estado.countdownUntil || null,
    primeiraEscolha: estado.matchups.length === 0 && !estado.countdownDone,
    // estatísticas congeladas na criação da batalha -- a tela de apresentação lê daqui, sem
    // precisar de leitura extra a cada consulta
    euStats: (estado.a.uid === uid) ? (estado.aStats||null) : (estado.bStats||null),
    oponenteStats: (estado.a.uid === uid) ? (estado.bStats||null) : (estado.aStats||null),
    souA,
    eu: { nome: souA ? estado.a.name : estado.b.name, time: meu, atual: souA ? estado.aCurrent : estado.bCurrent },
    oponente: { nome: souA ? estado.b.name : estado.a.name, time: dele, atual: souA ? estado.bCurrent : estado.aCurrent },
    matchups: estado.matchups,
    escolhi: (souA ? estado.aChoice : estado.bChoice) !== null && (souA ? estado.aChoice : estado.bChoice) !== undefined,
    // o índice escolhido, pra a tela marcar QUAL pokémon vai entrar
    escolhaIdx: (souA ? estado.aChoice : estado.bChoice),
    winnerUid: estado.winnerUid || null,
    venci: estado.phase==='done' && estado.winnerUid === uid
  };
}

exports.joinBattleQueue = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  await battleRequireTester(uid);
  // entra na fila com TODOS os times elegíveis: qual deles vai jogar só é decidido depois,
  // quando o oponente aparecer (fase 'teamPick' da batalha)
  const codes = battleCodes(request.data);
  if(!codes.length){ throw new HttpsError('invalid-argument', 'Time inválido.'); }

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  await touchLastSeen(uid, userData);
  const eu = { uid, name: userData.trainerName || 'Treinador', codes,
               specialties: userData.specialties || [],
               stats: battleStatsFrom(userData),
               joinedAt: Date.now() };

  return await db.runTransaction(async (tx) => {
    const agora = Date.now();
    const fila = await tx.get(battleQueueColl().orderBy('joinedAt').limit(10));
    let oponente = null; const expirados = [];
    for(const doc of fila.docs){
      const d = doc.data();
      if(d.uid === uid){ expirados.push(doc.ref); continue; }
      if(agora - (d.joinedAt||0) > BATTLE_QUEUE_TTL_MS){ expirados.push(doc.ref); continue; }
      oponente = { ref: doc.ref, data: d }; break;
    }
    expirados.forEach(ref => tx.delete(ref));
    if(!oponente){
      tx.set(battleQueueColl().doc(uid), eu);
      return { matched: false };
    }
    tx.delete(oponente.ref);
    // entrada antiga na fila (sem lista de times): descarta e continua procurando
    if(!(oponente.data.codes || []).length){ tx.set(battleQueueColl().doc(uid), eu); return { matched:false }; }
    // achou oponente: cria uma PENDÊNCIA e avisa os dois. A batalha só nasce quando ambos aceitarem
    const matchId = 'pm_' + agora + '_' + Math.random().toString(36).slice(2,8);
    const pend = {
      id: matchId, players: [oponente.data.uid, uid],
      a: oponente.data, b: eu,
      accepted: {}, deadline: agora + BATTLE_ACCEPT_MS, createdAt: agora
    };
    tx.set(pendingMatchRef(matchId), pend);
    tx.set(matchPointerRef(oponente.data.uid), { matchId, createdAt: agora });
    tx.set(matchPointerRef(uid), { matchId, createdAt: agora });
    return { pending: true, matchId, deadline: pend.deadline, oponente: oponente.data.name };
  });
});

/* Monta o estado inicial de uma batalha online a partir dos dois lados. Cada lado é o mesmo
   objeto que a fila e o lobby já gravam: { uid, name, codes, specialties, stats }.
   Extraído porque agora existem DOIS caminhos que criam batalha -- o aceite do pareamento/lobby
   e o aceite de um desafio de amigo. Duas cópias desse objeto divergiriam num campo qualquer
   (foi o que aconteceu com specialties no desafio do lobby) e a batalha sairia diferente
   dependendo de por onde os dois se encontraram. */
function montarBatalhaOnline(aSide, bSide){
  const agora = Date.now();
  const battleId = 'ob_' + agora + '_' + Math.random().toString(36).slice(2,8);
  return {
    id: battleId, players: [aSide.uid, bSide.uid],
    a: { uid: aSide.uid, name: aSide.name }, b: { uid: bSide.uid, name: bSide.name },
    /* Os times ainda NÃO existem: a batalha nasce na escolha de time. aCodes/bCodes são as
       opções que cada um mandou ao entrar na fila (ou no lobby); aTeam/bTeam são montados
       quando a janela fecha, em battleAdvance. */
    aCodes: aSide.codes || [], bCodes: bSide.codes || [],
    aTeam: [], bTeam: [], aTeamChoice: null, bTeamChoice: null,
    aSpecialties: aSide.specialties || [], bSpecialties: bSide.specialties || [],
    aStats: aSide.stats || { wins:0, losses:0, favorito:null },
    bStats: bSide.stats || { wins:0, losses:0, favorito:null },
    aCurrent: 0, bCurrent: 0, aChoice: null, bChoice: null,
    matchups: [], phase: 'teamPick',
    teamUntil: agora + BATTLE_TEAM_PICK_MS,   // depois dela: apresentação, inicial e contagem
    introUntil: 0,
    countdownDone: false,
    deadline: agora, winnerUid: null, createdAt: agora, updatedAt: agora
  };
}

/* Aceita a partida. Quando os DOIS aceitam, a batalha é criada aqui mesmo, na transação. */
exports.acceptOnlineMatch = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const matchId = String(request.data?.matchId || '');
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(pendingMatchRef(matchId));
    if(!snap.exists) throw new HttpsError('not-found', 'Essa partida não existe mais.');
    const pend = snap.data();
    if(!pend.players.includes(uid)) throw new HttpsError('permission-denied', 'Partida não é sua.');
    if(Date.now() > pend.deadline) throw new HttpsError('deadline-exceeded', 'O tempo pra aceitar acabou.');
    pend.accepted = Object.assign({}, pend.accepted, { [uid]: true });
    const dois = pend.players.every(p => pend.accepted[p]);
    if(!dois){
      tx.set(pendingMatchRef(matchId), pend);
      return { waiting: true };
    }
    const agora = Date.now();
    const estado = montarBatalhaOnline(pend.a, pend.b);
    const battleId = estado.id;
    tx.set(onlineBattleRef(battleId), estado);
    tx.delete(pendingMatchRef(matchId));
    pend.players.forEach(p => {
      tx.set(db.collection('onlineBattlePointer').doc(p), { battleId, createdAt: agora });
      tx.delete(matchPointerRef(p));
    });
    return { battleId };
  });
});

/* Descarta uma pendência vencida: quem aceitou volta pra fila, quem não aceitou sai da busca.
   Chamado pelo poll de quem estiver esperando -- sem cron, como o resto da batalha online. */
async function battleExpirePending(matchId){
  try{
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(pendingMatchRef(matchId));
      if(!snap.exists) return;
      const pend = snap.data();
      if(Date.now() <= pend.deadline) return;
      tx.delete(pendingMatchRef(matchId));
      for(const lado of [pend.a, pend.b]){
        tx.delete(matchPointerRef(lado.uid));
        // quem aceitou volta pra fila (com o tempo renovado); quem não aceitou simplesmente sai
        if(pend.accepted && pend.accepted[lado.uid]){
          tx.set(battleQueueColl().doc(lado.uid), Object.assign({}, lado, { joinedAt: Date.now() }));
        }
      }
    });
  } catch(e){ logger.error('Erro ao expirar pendência:', e); }
}

exports.pollBattleQueue = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  await battleRequireTester(uid);
  const desde = Number(request.data?.since) || 0;
  // 1) já existe batalha criada? (os dois aceitaram)
  const ponteiro = await db.collection('onlineBattlePointer').doc(uid).get();
  if(ponteiro.exists && (ponteiro.data().createdAt || 0) > desde){
    return { matched: true, battleId: ponteiro.data().battleId };
  }
  /* Sinal de vida: cada consulta renova o carimbo da MINHA entrada na fila.
     Sem isso, a expiração dependia só do horário em que a pessoa entrou -- e qualquer caminho que
     recriasse a entrada (como o cancelamento fazia) deixava um fantasma disponível pra sempre.
     Agora só continua na fila quem tem uma aba consultando de verdade. */
  // update (não set/merge): se a entrada não existe, a chamada falha e o catch ignora.
  // Com set/merge eu CRIARIA um documento pela metade -- sem uid nem código de time -- e ele
  // entraria na fila como um oponente fantasma, exatamente o problema que quero evitar
  await battleQueueColl().doc(uid).update({ joinedAt: Date.now() }).catch(()=>{});

  // 2) oponente encontrado, esperando aceite
  const pm = await matchPointerRef(uid).get();
  if(pm.exists){
    const pendSnap = await pendingMatchRef(pm.data().matchId).get();
    if(pendSnap.exists){
      const pend = pendSnap.data();
      if(Date.now() > pend.deadline){
        await battleExpirePending(pend.id);   // vencida: limpa e recoloca quem aceitou na fila
      } else {
        const souA = pend.a.uid === uid;
        return { pending: true, matchId: pend.id, deadline: pend.deadline,
                 oponente: souA ? pend.b.name : pend.a.name,
                 aceitei: !!(pend.accepted && pend.accepted[uid]) };
      }
    } else {
      await matchPointerRef(uid).delete().catch(()=>{});
    }
  }
  const meu = await battleQueueColl().doc(uid).get();
  return { matched: false, inQueue: meu.exists };
});

/* Histórico e placar do jogador, pra tela da Batalha Online. */
exports.getMyBattleHistory = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const snap = await db.collection('users').doc(request.auth.uid).get();
  const d = snap.exists ? snap.data() : {};
  return {
    wins: d.onlineWins || 0,
    losses: d.onlineLosses || 0,
    history: d.onlineHistory || [],
    favorito: battleStatsFrom(d).favorito
  };
});

/* Devolve uma batalha encerrada pra reprise. Só quem participou pode ver -- o documento guarda
   os times dos dois, e sem essa checagem qualquer um leria o time de qualquer jogador. */
exports.getOnlineBattleReplay = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const battleId = String(request.data?.battleId || '');
  const snap = await onlineBattleRef(battleId).get();
  if(!snap.exists) throw new HttpsError('not-found', 'Essa batalha não está mais disponível.');
  const estado = snap.data();
  if(!estado.players.includes(uid)) throw new HttpsError('permission-denied', 'Essa batalha não é sua.');
  const souA = estado.a.uid === uid;
  return {
    souA,
    eu: souA ? estado.a.name : estado.b.name,
    oponente: souA ? estado.b.name : estado.a.name,
    venci: estado.winnerUid === uid,
    matchups: estado.matchups
  };
});

exports.leaveBattleQueue = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  await battleQueueColl().doc(uid).delete().catch(()=>{});
  // cancelar no meio de uma pendência: o outro lado volta pra fila em vez de ficar preso esperando
  const pm = await matchPointerRef(uid).get();
  if(pm.exists){
    const pendSnap = await pendingMatchRef(pm.data().matchId).get();
    if(pendSnap.exists){
      const pend = pendSnap.data();
      const outro = pend.a.uid === uid ? pend.b : pend.a;
      /* O outro lado só volta pra fila se ELE tinha aceitado -- ou seja, se está de fato esperando
         na frente da tela. Antes eu recolocava sempre, e com o tempo renovado: isso criava um laço
         em que uma conta que nunca aceitou (e nem estava mais logada) era ressuscitada na fila a
         cada cancelamento, aparecendo como oponente disponível pra sempre. */
      if(pend.accepted && pend.accepted[outro.uid]){
        await battleQueueColl().doc(outro.uid).set(Object.assign({}, outro, { joinedAt: Date.now() })).catch(()=>{});
      } else {
        await battleQueueColl().doc(outro.uid).delete().catch(()=>{});
      }
      await matchPointerRef(outro.uid).delete().catch(()=>{});
      await pendingMatchRef(pend.id).delete().catch(()=>{});
    }
    await matchPointerRef(uid).delete().catch(()=>{});
  }
  return { ok: true };
});

/* Consulta o estado da batalha. É AQUI que o tempo anda: se o prazo de escolha venceu,
   a transação resolve o confronto antes de responder. Os dois clientes chamam a cada
   segundo, então qualquer um dos dois faz a partida avançar. */
exports.getOnlineBattle = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const battleId = String(request.data?.battleId || '');
  if(!battleId) throw new HttpsError('invalid-argument', 'Batalha não informada.');

  const view = await db.runTransaction(async (tx) => {
    const snap = await tx.get(onlineBattleRef(battleId));
    if(!snap.exists) throw new HttpsError('not-found', 'Batalha não encontrada.');
    const estado = snap.data();
    if(!estado.players.includes(uid)) throw new HttpsError('permission-denied', 'Essa batalha não é sua.');
    // abandonada: ninguém consultou por minutos. Encerra em vez de deixar pendurada pra sempre
    if(estado.phase !== 'done' && Date.now() - (estado.updatedAt||0) > BATTLE_IDLE_MS){
      estado.phase = 'done'; estado.winnerUid = null;
      tx.set(onlineBattleRef(battleId), estado);
      // no MESMO formato do retorno normal: devolvendo a view crua aqui, o cliente recebia
      // undefined (a chamada lê .view) e ficava consultando pra sempre uma batalha já encerrada
      return { view: battleView(estado, uid), aplicarStats: null };
    }
    const antes = JSON.stringify([estado.phase, estado.matchups.length, estado.deadline]);
    battleAdvance(estado);
    // acabou agora: marca DENTRO da transação pra ninguém contar duas vezes, e devolve o sinal
    // pra aplicar as estatísticas depois (escrever nos dois usuários aqui exigiria lê-los antes)
    let aplicarStats = null;
    if(estado.phase === 'done' && !estado.statsApplied){
      estado.statsApplied = true;
      aplicarStats = { estado };
    }
    if(JSON.stringify([estado.phase, estado.matchups.length, estado.deadline]) !== antes || aplicarStats){
      tx.set(onlineBattleRef(battleId), estado);
    }
    return { view: battleView(estado, uid), aplicarStats };
  });
  if(view.aplicarStats){ await battleApplyStats(view.aplicarStats.estado); }
  return view.view;
});

/* Soma vitória/derrota e conta as espécies usadas. Roda FORA da transação: usa increment,
   que não precisa ler o valor antes, então não há risco de perder contagem concorrente. */
async function battleApplyStats(estado){
  try{
    const venceuA = estado.winnerUid === estado.a.uid;
    const venceuB = estado.winnerUid === estado.b.uid;
    // batalha encerrada antes de os times existirem (abandonada na escolha) não tem o que contar
    const contarEspecies = async (uid, time) => {
      const m = {};
      (time||[]).forEach(p => { m['onlineSpecies.' + p.speciesId] = admin.firestore.FieldValue.increment(1); });
      if(Object.keys(m).length) await db.collection('users').doc(uid).update(m);
    };
    await db.collection('users').doc(estado.a.uid).set(Object.assign({
      onlineWins: admin.firestore.FieldValue.increment(venceuA ? 1 : 0),
      onlineLosses: admin.firestore.FieldValue.increment(venceuB ? 1 : 0)
    }), { merge:true });
    await contarEspecies(estado.a.uid, estado.aTeam);
    await db.collection('users').doc(estado.b.uid).set(Object.assign({
      onlineWins: admin.firestore.FieldValue.increment(venceuB ? 1 : 0),
      onlineLosses: admin.firestore.FieldValue.increment(venceuA ? 1 : 0)
    }), { merge:true });
    await contarEspecies(estado.b.uid, estado.bTeam);
    /* Histórico das últimas 10 partidas. Guardo o array inteiro reescrito em vez de usar
       arrayUnion: preciso CORTAR nas 10 mais recentes, e arrayUnion só sabe adicionar. */
    /* Placar em pokémon de pé no fim, como "3 x 0". É o que resume a partida pra quem olha o
       histórico depois -- diferente do número de confrontos, que é detalhe interno do motor e
       não diz se foi passeio ou luta apertada. */
    const vivos = (time) => (time||[]).filter(p => p.hp > 0).length;
    const registro = (meuTime, deleTime, dele, venceu) => ({
      battleId: estado.id,          // sem isso não dá pra rever a partida depois
      oponente: dele.name, venceu, quando: Date.now(),
      meusVivos: vivos(meuTime), delesVivos: vivos(deleTime),
      confrontos: estado.matchups.length
    });
    for(const [lado, outro, meuTime, deleTime, venceu] of [
      [estado.a, estado.b, estado.aTeam, estado.bTeam, venceuA],
      [estado.b, estado.a, estado.bTeam, estado.aTeam, venceuB]
    ]){
      const ref = db.collection('users').doc(lado.uid);
      const snap = await ref.get();
      const atual = (snap.exists && snap.data().onlineHistory) || [];
      const novo = [registro(meuTime, deleTime, outro, venceu), ...atual].slice(0, 10);
      await ref.set({ onlineHistory: novo }, { merge:true });
    }
    /* Retrospecto do par (o "placar entre vocês" da lista de amigos). Gravado para TODA batalha
       online, não só entre amigos: quem vira amigo depois quer ver os confrontos que já teve, e
       reconstruir isso mais tarde seria impossível -- o histórico pessoal guarda só 10 partidas.
       Um documento por par, id com os dois uids ordenados, então a mesma dupla sempre cai no
       mesmo lugar independente de quem foi o A da batalha. Empate (winnerUid null, abandono)
       conta no total e não move o placar. */
    await rivalryRef(estado.a.uid, estado.b.uid).set({
      players: [estado.a.uid, estado.b.uid].sort(),
      total: admin.firestore.FieldValue.increment(1),
      ['wins_' + estado.a.uid]: admin.firestore.FieldValue.increment(venceuA ? 1 : 0),
      ['wins_' + estado.b.uid]: admin.firestore.FieldValue.increment(venceuB ? 1 : 0),
      lastAt: Date.now(),
      lastWinnerUid: estado.winnerUid || null,
      lastBattleId: estado.id
    }, { merge:true });
    /* Ponteiros da batalha: some com eles agora que ela acabou. Enquanto ficavam gravados, uma
       consulta com "since" pequeno recebia o battleId de uma partida já encerrada e o cliente
       entrava nela de novo -- o bug da tela de amigos. */
    for(const lado of [estado.a, estado.b]){
      await db.collection('onlineBattlePointer').doc(lado.uid).delete().catch(()=>{});
    }
  } catch(e){ logger.error('Erro ao aplicar estatísticas da batalha online:', e); }
}

/* Escolhe COM QUAL TIME jogar, já dentro da batalha e com o oponente do outro lado.
   O cliente manda um ÍNDICE na lista que ele mesmo enviou ao entrar na fila (ou no lobby) --
   nunca um código novo. Aceitar um código aqui deixaria montar o time depois de ver o adversário,
   que é exatamente o que a escolha às cegas existe pra impedir. */
exports.pickOnlineBattleTeam = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const battleId = String(request.data?.battleId || '');
  const idx = Number(request.data?.index);
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(onlineBattleRef(battleId));
    if(!snap.exists) throw new HttpsError('not-found', 'Batalha não encontrada.');
    const estado = snap.data();
    if(!estado.players.includes(uid)) throw new HttpsError('permission-denied', 'Essa batalha não é sua.');
    if(estado.phase !== 'teamPick') throw new HttpsError('failed-precondition', 'O tempo de escolher o time acabou.');
    const souA = estado.a.uid === uid;
    const codes = (souA ? estado.aCodes : estado.bCodes) || [];
    if(!Number.isInteger(idx) || idx < 0 || idx >= codes.length){
      throw new HttpsError('invalid-argument', 'Esse time não existe.');
    }
    if(souA) estado.aTeamChoice = idx; else estado.bTeamChoice = idx;
    // se o outro já tinha escolhido, isto aqui já monta os times e manda pra apresentação
    battleAdvance(estado);
    tx.set(onlineBattleRef(battleId), estado);
    return battleView(estado, uid);
  });
});

/* Escolhe quem entra no próximo confronto. Se os DOIS já escolheram, a espera acaba na hora --
   não faz sentido segurar os 5 segundos se ninguém mais precisa deles. */
exports.pickOnlineBattlePokemon = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const battleId = String(request.data?.battleId || '');
  const idx = Number(request.data?.index);
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(onlineBattleRef(battleId));
    if(!snap.exists) throw new HttpsError('not-found', 'Batalha não encontrada.');
    const estado = snap.data();
    if(!estado.players.includes(uid)) throw new HttpsError('permission-denied', 'Essa batalha não é sua.');
    /* Tolerância pra viagem da rede. A escolha leva uns 200ms pra chegar aqui; recusar tudo que
       passa do prazo por milissegundos pune o jogador por uma latência que não é dele.
       Enquanto o confronto NÃO foi resolvido (fase ainda 'choosing'), a escolha vale -- passado
       esse ponto a fase já mudou e a checagem abaixo recusa naturalmente. */
    if(estado.phase !== 'choosing') throw new HttpsError('failed-precondition', 'O confronto já começou.');
    const souA = estado.a.uid === uid;
    const meuTime = souA ? estado.aTeam : estado.bTeam;
    if(!Number.isInteger(idx) || idx<0 || idx>=meuTime.length || meuTime[idx].hp<=0){
      throw new HttpsError('invalid-argument', 'Esse pokémon não pode entrar.');
    }
    if(souA) estado.aChoice = idx; else estado.bChoice = idx;
    /* O prazo NÃO é encurtado quando os dois escolhem cedo.
       Antes eu dispensava o resto do tempo achando que agilizava, mas o efeito era o oposto: a
       batalha disparava no meio da contagem, com os dois ainda olhando o cronômetro. Os 5 segundos
       são o ritmo da partida -- valem inteiros, sempre. */
    battleAdvance(estado);
    tx.set(onlineBattleRef(battleId), estado);
    return battleView(estado, uid);
  });
});

/* ============================================================================
   LOBBY DE BATALHA -- desafio direto entre treinadores
   ----------------------------------------------------------------------------
   Diferente da fila (que sorteia um oponente qualquer), aqui os dois se veem numa
   lista e alguém escolhe contra quem quer lutar.

   Presença sem servidor dedicado: cada jogador na tela grava um carimbo de tempo a
   cada poucos segundos, e quem parou de carimbar some da lista. Sem "logout" pra dar
   errado -- fechar a aba já basta pra sair.

   O desafio reaproveita a mesma pendência (onlinePendingMatch) do pareamento
   aleatório, com o desafiante já marcado como aceito. Assim o convite, o prazo de 15
   segundos, a criação da batalha e a expiração são exatamente o mesmo código.
   ============================================================================ */
const LOBBY_TTL_MS = 20 * 1000;   // sem carimbo por esse tempo = saiu da lista

function lobbyColl(){ return db.collection('battleLobby'); }

exports.joinBattleLobby = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const codes = battleCodes(request.data);
  if((request.data?.codes || request.data?.code) && !codes.length){
    throw new HttpsError('invalid-argument', 'Time inválido.');
  }
  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  await touchLastSeen(uid, userData);
  const stats = battleStatsFrom(userData);
  const agora = Date.now();
  /* As especialidades entram AQUI, no documento do lobby, porque é dele que challengeLobbyPlayer
     monta a pendência. Sem isso o desafio do lobby criava batalha com specialties [] e o buff de
     tipo simplesmente não valia -- só as partidas da fila (joinBattleQueue) o aplicavam.
     Buff que existe num caminho e não no outro é a pior versão possível: a mesma batalha dava
     resultado diferente dependendo de por onde os dois se encontraram. */
  // sem códigos = só renovando presença; com códigos = entrando no lobby
  const dados = { uid, name: userData.trainerName || 'Treinador', stats,
                  specialties: userData.specialties || [], lastSeen: agora };
  if(codes.length) dados.codes = codes;
  await lobbyColl().doc(uid).set(dados, { merge: true });

  const snap = await lobbyColl().where('lastSeen', '>', agora - LOBBY_TTL_MS).get();
  const jogadores = snap.docs.map(d=>d.data()).filter(d => d.uid !== uid && (d.codes||[]).length)
    .map(d => {
      // faixa de nível dos times dele: qual vai entrar em campo nem ele decidiu ainda
      const faixa = battleMediaRange(d.codes) || { min:0, max:0 };
      return { uid:d.uid, name:d.name, stats:d.stats||null, times:(d.codes||[]).length,
               media: faixa.max, mediaMin: faixa.min, mediaMax: faixa.max };
    });
  jogadores.sort((a,b)=> (b.stats?.wins||0) - (a.stats?.wins||0));

  // desafio pendente pra mim? (o cliente mostra o mesmo convite do pareamento aleatório)
  let convite = null;
  const pm = await matchPointerRef(uid).get();
  if(pm.exists){
    const pendSnap = await pendingMatchRef(pm.data().matchId).get();
    if(pendSnap.exists){
      const pend = pendSnap.data();
      if(Date.now() > pend.deadline){ await battleExpirePending(pend.id); }
      else {
        const souA = pend.a.uid === uid;
        convite = { matchId: pend.id, deadline: pend.deadline,
                    oponente: souA ? pend.b.name : pend.a.name,
                    aceitei: !!(pend.accepted && pend.accepted[uid]),
                    desafio: !!pend.desafio };
      }
    }
  }
  // batalha já criada (o outro aceitou meu desafio)
  let battleId = null;
  const bp = await db.collection('onlineBattlePointer').doc(uid).get();
  const desde = Number(request.data?.since) || 0;
  if(bp.exists && (bp.data().createdAt||0) > desde) battleId = bp.data().battleId;

  return { jogadores, convite, battleId };
});

exports.leaveBattleLobby = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  await lobbyColl().doc(request.auth.uid).delete().catch(()=>{});
  return { ok: true };
});

/* Desafia alguém do lobby. O desafiante já entra como "aceito": ele acabou de clicar,
   não faz sentido pedir confirmação de novo. */
exports.challengeLobbyPlayer = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const alvo = String(request.data?.targetUid || '');
  if(!alvo || alvo === uid) throw new HttpsError('invalid-argument', 'Alvo inválido.');

  const [meuSnap, alvoSnap] = await Promise.all([lobbyColl().doc(uid).get(), lobbyColl().doc(alvo).get()]);
  if(!meuSnap.exists || !(meuSnap.data().codes||[]).length) throw new HttpsError('failed-precondition', 'Entre no lobby antes de desafiar.');
  if(!alvoSnap.exists) throw new HttpsError('failed-precondition', 'Esse treinador saiu do lobby.');
  const alvoDados = alvoSnap.data();
  if(!(alvoDados.codes||[]).length) throw new HttpsError('failed-precondition', 'Esse treinador saiu do lobby.');
  if(Date.now() - (alvoDados.lastSeen||0) > LOBBY_TTL_MS) throw new HttpsError('failed-precondition', 'Esse treinador saiu do lobby.');

  return await db.runTransaction(async (tx) => {
    // já existe pendência de algum dos dois? evita dois desafios cruzados virando duas batalhas
    const [pmA, pmB] = await Promise.all([tx.get(matchPointerRef(uid)), tx.get(matchPointerRef(alvo))]);
    if(pmA.exists || pmB.exists) throw new HttpsError('failed-precondition', 'Um dos treinadores já tem um convite em aberto.');

    const agora = Date.now();
    const matchId = 'pm_' + agora + '_' + Math.random().toString(36).slice(2,8);
    const eu = meuSnap.data();
    const pend = {
      id: matchId, players: [uid, alvo],
      a: { uid, name: eu.name, codes: eu.codes||[], specialties: eu.specialties||[], stats: eu.stats||null },
      b: { uid: alvo, name: alvoDados.name, codes: alvoDados.codes||[], specialties: alvoDados.specialties||[], stats: alvoDados.stats||null },
      accepted: { [uid]: true },      // quem desafia já está dentro
      desafio: true,
      deadline: agora + BATTLE_ACCEPT_MS, createdAt: agora
    };
    tx.set(pendingMatchRef(matchId), pend);
    tx.set(matchPointerRef(uid), { matchId, createdAt: agora });
    tx.set(matchPointerRef(alvo), { matchId, createdAt: agora });
    return { matchId, deadline: pend.deadline, oponente: alvoDados.name, aceitei: true, desafio: true };
  });
});

/* ============================================================================
   LISTA DE AMIGOS
   ----------------------------------------------------------------------------
   Amizade é MÚTUA e por aceite: quem pede não entra na lista de ninguém até o
   outro aceitar. O pedido vive em users/{alvo}/friendRequests/{quemPediu} --
   documento com o id de quem pediu, então dois pedidos da mesma pessoa são o
   mesmo documento e não existe fila de pedidos repetidos pra limpar depois.

   A amizade em si é gravada NOS DOIS lados (users/{a}/friends/{b} e o espelho).
   Duplicar assim é de propósito: ler "meus amigos" vira uma consulta só, sem
   varrer uma coleção global de pares. O preço é que remover exige apagar dois
   documentos -- e é por isso que removeFriend apaga os dois mesmo que um deles
   já não exista.

   O que NÃO fica aqui: o retrospecto de batalhas. Ele mora em rivalries/{par},
   escrito por battleApplyStats pra toda batalha online. Se ficasse no documento
   de amizade, desfazer e refazer a amizade zeraria o histórico dos dois, e quem
   vira amigo depois de já ter batalhado começaria em 0x0 -- que é mentira.
   ============================================================================ */
const MAX_FRIENDS = 50;
const MAX_PEDIDOS_ENVIADOS = 20;
const FRIEND_CHALLENGE_MS = 3 * 60 * 1000;      // janela pra aceitar um desafio de amigo
const FRIEND_CHALLENGE_ALIVE_MS = 35 * 1000;    // sem sinal do desafiante nesse tempo, o desafio morre
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

function friendsColl(uid){ return db.collection('users').doc(uid).collection('friends'); }
function friendRequestsColl(uid){ return db.collection('users').doc(uid).collection('friendRequests'); }
function friendChallengeRef(id){ return db.collection('friendChallenges').doc(id); }
function friendChallengePointerRef(uid){ return db.collection('friendChallengePointer').doc(uid); }
function rivalryRef(a, b){ return db.collection('rivalries').doc([a,b].sort().join('__')); }

/* Carimbo de presença. Não existe batimento próprio: o carimbo pega carona nas chamadas que a
   pessoa já faz de qualquer jeito (abrir a home, entrar no lobby, entrar na fila). Isso dá um
   "visto por último" com granularidade de minutos sem UMA escrita a mais por jogador ativo --
   um batimento a cada 4s, como o do lobby, custaria 21 mil escritas por jogador por dia.
   A gravação é jogada fora quando o carimbo é recente: quem abre 6 telas em 2 minutos escreve
   uma vez só.
   O trainerNameLower vai junto porque é o índice da busca de treinadores (searchTrainers) e não
   existe backfill: cada conta ganha o campo na primeira vez que aparecer online depois do deploy. */
async function touchLastSeen(uid, userData){
  try{
    const agora = Date.now();
    const d = userData || {};
    const nomeLower = (d.trainerName || '').toLowerCase();
    const precisaNome = nomeLower && d.trainerNameLower !== nomeLower;
    if(!precisaNome && agora - (d.lastSeenAt || 0) < LAST_SEEN_THROTTLE_MS) return;
    const patch = { lastSeenAt: agora };
    if(precisaNome) patch.trainerNameLower = nomeLower;
    await db.collection('users').doc(uid).set(patch, { merge: true });
  } catch(e){ logger.error('Erro ao carimbar presença de '+uid+':', e); }
}

// resumo de um treinador pra lista/busca -- o mínimo que a linha da lista precisa desenhar
function friendCardFrom(uid, userData){
  const d = userData || {};
  return {
    uid,
    name: d.trainerName || 'Treinador',
    lastSeenAt: d.lastSeenAt || 0,
    eliteChampion: !!d.eliteChampion,
    pokedex: (d.pokedexCaught || []).length,
    onlineWins: d.onlineWins || 0,
    onlineLosses: d.onlineLosses || 0,
    specialties: d.specialties || []
  };
}

/* Retrospecto entre duas pessoas, na perspectiva de quem perguntou. */
async function rivalryFor(meuUid, outroUid){
  try{
    const snap = await rivalryRef(meuUid, outroUid).get();
    if(!snap.exists) return { total:0, wins:0, losses:0, lastAt:0, lastWon:null, lastBattleId:null };
    const d = snap.data();
    const meus = d['wins_' + meuUid] || 0;
    const dele = d['wins_' + outroUid] || 0;
    return {
      total: d.total || 0, wins: meus, losses: dele,
      lastAt: d.lastAt || 0,
      // null = empate/abandono, e o cliente mostra "—" em vez de V ou D
      lastWon: d.lastWinnerUid ? (d.lastWinnerUid === meuUid) : null,
      lastBattleId: d.lastBattleId || null
    };
  } catch(e){ logger.error('Erro ao ler retrospecto:', e); return { total:0, wins:0, losses:0, lastAt:0, lastWon:null, lastBattleId:null }; }
}

/* --------------------------------------------------------------------------
   BUSCA DE TREINADORES
   Nomes NÃO são únicos no jogo (getTrainerProfile já convive com isso), então a
   busca devolve TODOS os homônimos e a lista mostra o que distingue um do outro:
   pokédex, vitórias online e quando foi visto. Escolher pelo nome só seria adivinhar.
   -------------------------------------------------------------------------- */
exports.searchTrainers = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const bruto = String(request.data?.q || '').trim().slice(0, 40);
  if(bruto.length < 2) throw new HttpsError('invalid-argument', 'Digite pelo menos 2 letras.');
  const q = bruto.toLowerCase();

  /* Duas consultas de propósito. A por trainerNameLower é a boa -- prefixo, sem diferenciar
     maiúscula. A por trainerName é a rede de segurança pras contas que ainda não passaram pelo
     touchLastSeen depois do deploy e portanto não têm o campo minúsculo: sem ela, um jogador
     antigo simplesmente não seria encontrável até abrir o jogo uma vez. */
  const [porLower, porExato] = await Promise.all([
    // \uf8ff é o maior caractere da faixa privada do Unicode: o intervalo [q, q+\uf8ff] pega tudo
    // que COMEÇA com q. É como se faz busca por prefixo no Firestore, que não tem LIKE
    db.collection('users').where('trainerNameLower', '>=', q).where('trainerNameLower', '<=', q + '').limit(20).get(),
    db.collection('users').where('trainerName', '==', bruto).limit(10).get()
  ]);

  const vistos = new Set([uid]);
  const achados = [];
  for(const doc of [...porLower.docs, ...porExato.docs]){
    if(vistos.has(doc.id)) continue;
    vistos.add(doc.id);
    const d = doc.data() || {};
    if(!d.trainerName) continue;   // conta sem nome ainda: não existe pra busca
    achados.push(friendCardFrom(doc.id, d));
  }

  // marca o estado de cada um em relação a mim, senão a tela ofereceria "adicionar" pra quem já é amigo
  const [amigosSnap, pedidosRecebidos] = await Promise.all([
    friendsColl(uid).get(),
    friendRequestsColl(uid).get()
  ]);
  const amigos = new Set(amigosSnap.docs.map(d=>d.id));
  const meRecebeu = new Set(pedidosRecebidos.docs.map(d=>d.id));
  const enviados = await Promise.all(achados.map(a => friendRequestsColl(a.uid).doc(uid).get()));

  achados.forEach((a, i) => {
    a.jaAmigo = amigos.has(a.uid);
    a.pedidoEnviado = enviados[i].exists;
    a.pedidoRecebido = meRecebeu.has(a.uid);
  });
  achados.sort((a,b)=> (b.lastSeenAt||0) - (a.lastSeenAt||0));
  return { trainers: achados.slice(0, 15) };
});

/* --------------------------------------------------------------------------
   PEDIDO DE AMIZADE
   -------------------------------------------------------------------------- */
exports.sendFriendRequest = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const alvo = String(request.data?.targetUid || '').trim();
  if(!alvo) throw new HttpsError('invalid-argument', 'Treinador não informado.');
  if(alvo === uid) throw new HttpsError('invalid-argument', 'Você já é seu melhor amigo.');

  const [meuSnap, alvoSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('users').doc(alvo).get()
  ]);
  if(!alvoSnap.exists) throw new HttpsError('not-found', 'Esse treinador não existe mais.');
  const meuDados = meuSnap.exists ? meuSnap.data() : {};
  const alvoDados = alvoSnap.data();
  const meuNome = meuDados.trainerName || 'Treinador';

  const jaAmigo = await friendsColl(uid).doc(alvo).get();
  if(jaAmigo.exists) throw new HttpsError('already-exists', 'Vocês já são amigos.');

  /* Ele já tinha me mandado pedido? Então isso aqui é um aceite, não um pedido novo. Sem esse
     atalho, dois amigos que se adicionam ao mesmo tempo ficariam cada um esperando o aceite do
     outro, com dois pedidos abertos e nenhuma amizade -- e nada na tela explicaria por quê. */
  const cruzado = await friendRequestsColl(uid).doc(alvo).get();
  if(cruzado.exists){
    await firmarAmizade(uid, meuDados, alvo, alvoDados);
    return { ok:true, aceitoDireto:true, friend: friendCardFrom(alvo, alvoDados) };
  }

  // lista inteira em vez de count(): o teto é 50 documentos de 3 campos, e ler os dois caminhos
  // (agregado com fallback) seria mais código que a leitura direta economiza
  const nAmigos = (await friendsColl(uid).get()).size;
  if(nAmigos >= MAX_FRIENDS) throw new HttpsError('resource-exhausted', `Sua lista já tem ${MAX_FRIENDS} amigos.`);
  if((meuDados.friendRequestsSent || 0) >= MAX_PEDIDOS_ENVIADOS){
    throw new HttpsError('resource-exhausted', 'Você tem pedidos demais esperando resposta.');
  }

  const jaPedi = await friendRequestsColl(alvo).doc(uid).get();
  if(jaPedi.exists) return { ok:true, jaPedido:true };

  await friendRequestsColl(alvo).doc(uid).set({ uid, name: meuNome, createdAt: Date.now() });
  await db.collection('users').doc(uid).set(
    { friendRequestsSent: admin.firestore.FieldValue.increment(1) }, { merge:true });
  await createNotification(alvo, 'friend_request',
    'Pedido de amizade',
    `${meuNome} quer entrar na sua lista de amigos.`,
    { fromUid: uid, fromName: meuNome });
  return { ok:true };
});

/* Grava a amizade dos dois lados e limpa os pedidos pendentes entre eles.
   Em lote: metade de uma amizade (um lado vê o outro, o outro não vê ninguém) é pior que
   nenhuma -- daria uma lista onde desafiar funciona só numa direção. */
async function firmarAmizade(uidA, dadosA, uidB, dadosB){
  const agora = Date.now();
  const lote = db.batch();
  lote.set(friendsColl(uidA).doc(uidB), { uid: uidB, name: dadosB.trainerName || 'Treinador', since: agora });
  lote.set(friendsColl(uidB).doc(uidA), { uid: uidA, name: dadosA.trainerName || 'Treinador', since: agora });
  lote.delete(friendRequestsColl(uidA).doc(uidB));
  lote.delete(friendRequestsColl(uidB).doc(uidA));
  await lote.commit();
  // o contador de pedidos em aberto é aproximado de propósito: nunca desce abaixo de zero e não
  // vale uma transação -- ele existe só pra travar o spam de pedidos
  await db.collection('users').doc(uidB).set(
    { friendRequestsSent: admin.firestore.FieldValue.increment(-1) }, { merge:true }).catch(()=>{});
}

exports.respondFriendRequest = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const de = String(request.data?.fromUid || '').trim();
  const aceitar = !!request.data?.accept;
  if(!de) throw new HttpsError('invalid-argument', 'Pedido não informado.');

  const pedido = await friendRequestsColl(uid).doc(de).get();
  if(!pedido.exists) throw new HttpsError('not-found', 'Esse pedido não existe mais.');

  if(!aceitar){
    await friendRequestsColl(uid).doc(de).delete();
    await db.collection('users').doc(de).set(
      { friendRequestsSent: admin.firestore.FieldValue.increment(-1) }, { merge:true }).catch(()=>{});
    // recusa NÃO notifica quem pediu, de propósito: "fulano recusou você" não melhora o jogo de
    // ninguém e transforma um não em um aviso
    return { ok:true, aceito:false };
  }

  const [meuSnap, deleSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('users').doc(de).get()
  ]);
  if(!deleSnap.exists) throw new HttpsError('not-found', 'Esse treinador não existe mais.');
  const meuDados = meuSnap.exists ? meuSnap.data() : {};
  const deleDados = deleSnap.data();

  const nAmigos = (await friendsColl(uid).get()).size;
  if(nAmigos >= MAX_FRIENDS) throw new HttpsError('resource-exhausted', `Sua lista já tem ${MAX_FRIENDS} amigos.`);

  await firmarAmizade(uid, meuDados, de, deleDados);
  await createNotification(de, 'friend_accepted',
    'Pedido aceito',
    `${meuDados.trainerName || 'Um treinador'} aceitou seu pedido de amizade.`,
    { fromUid: uid });
  return { ok:true, aceito:true, friend: friendCardFrom(de, deleDados) };
});

exports.removeFriend = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const alvo = String(request.data?.targetUid || '').trim();
  if(!alvo) throw new HttpsError('invalid-argument', 'Treinador não informado.');
  // apaga os DOIS lados mesmo que um já não exista -- é o que conserta uma amizade que ficou pela
  // metade por um commit interrompido
  const lote = db.batch();
  lote.delete(friendsColl(uid).doc(alvo));
  lote.delete(friendsColl(alvo).doc(uid));
  await lote.commit();
  return { ok:true };
});

/* --------------------------------------------------------------------------
   A LISTA
   Uma chamada só: amigos (com presença e retrospecto), pedidos recebidos, e o
   desafio em aberto -- se cada bloco fosse uma chamada, a tela abriria em três
   tempos e o contador do desafio começaria atrasado.
   -------------------------------------------------------------------------- */
exports.getMyFriends = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const meuSnap = await db.collection('users').doc(uid).get();
  await touchLastSeen(uid, meuSnap.exists ? meuSnap.data() : null);

  const [amigosSnap, pedidosSnap] = await Promise.all([
    friendsColl(uid).get(),
    friendRequestsColl(uid).get()
  ]);

  /* O documento de amizade guarda só uid/nome/desde. Tudo que muda -- nome trocado, pokédex,
     presença -- é lido do documento do usuário AGORA. Copiar esses campos pra dentro da amizade
     deixaria a lista mostrando o nome antigo de quem se renomeou, e não existe caminho que
     atualize as duas cópias. */
  const uids = amigosSnap.docs.map(d=>d.id);
  const [perfis, retrospectos] = await Promise.all([
    Promise.all(uids.map(u => db.collection('users').doc(u).get())),
    Promise.all(uids.map(u => rivalryFor(uid, u)))
  ]);

  const friends = uids.map((u, i) => {
    const d = perfis[i].exists ? perfis[i].data() : {};
    const card = friendCardFrom(u, d);
    card.since = (amigosSnap.docs[i].data() || {}).since || 0;
    card.rivalry = retrospectos[i];
    // conta apagada: o documento some, mas a amizade fica. Mostra o nome guardado e marca o card
    if(!perfis[i].exists){ card.name = (amigosSnap.docs[i].data() || {}).name || 'Treinador'; card.sumiu = true; }
    return card;
  });
  // quem foi visto mais recentemente primeiro: é a ordem que responde "com quem dá pra jogar agora"
  friends.sort((a,b)=> (b.lastSeenAt||0) - (a.lastSeenAt||0));

  const requests = pedidosSnap.docs.map(d => {
    const x = d.data() || {};
    return { uid: d.id, name: x.name || 'Treinador', createdAt: x.createdAt || 0 };
  }).sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));

  return { friends, requests, max: MAX_FRIENDS, serverNow: Date.now(),
           challenge: await meuDesafioAtual(uid) };
});

/* Só a contagem de pedidos, pro selo do botão na home -- a tela inteira é cara demais pra isso. */
exports.getFriendRequestCount = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const snap = await friendRequestsColl(request.auth.uid).get();
  return { count: snap.size };
});

/* --------------------------------------------------------------------------
   COMPARAR CONQUISTAS
   Os dois cartões numa chamada só. Poderia ser o cliente pedindo getTrainerProfile
   duas vezes, mas aí a tela abriria com metade da tabela preenchida enquanto a
   outra metade carrega -- e comparação com um lado vazio não compara nada.
   -------------------------------------------------------------------------- */
exports.compareTrainers = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const alvo = String(request.data?.uid || '').trim();
  if(!alvo) throw new HttpsError('invalid-argument', 'Treinador não informado.');
  const [eu, ele, retro] = await Promise.all([
    buildTrainerProfile(uid, ''),
    buildTrainerProfile(alvo, ''),
    rivalryFor(uid, alvo)
  ]);
  return { me: eu, them: ele, rivalry: retro };
});

/* --------------------------------------------------------------------------
   DESAFIO DIRETO A UM AMIGO
   ----------------------------------------------------------------------------
   O desafio do LOBBY dura 15 segundos porque os dois estão olhando a mesma tela
   naquele instante. Aqui não: o amigo pode estar na Torre, numa jornada, ou com
   o jogo fechado. Por isso o desafio de amigo é assíncrono -- vale 3 minutos,
   chega como notificação, e quem aceita é que dispara a batalha.

   O que impede o desafio de virar uma batalha contra uma aba fechada: o
   desafiante renova um carimbo (aliveAt) enquanto a tela dele está aberta. Sem
   sinal por FRIEND_CHALLENGE_ALIVE_MS o desafio é dado como abandonado no
   momento do aceite -- melhor recusar na hora do que criar uma batalha que vai
   morrer sozinha por inatividade dali a alguns minutos.
   -------------------------------------------------------------------------- */
function desafioView(d, uid){
  if(!d) return null;
  const souEu = d.from.uid === uid;
  return {
    id: d.id,
    sou: souEu ? 'desafiante' : 'desafiado',
    oponente: souEu ? d.to.name : d.from.name,
    oponenteUid: souEu ? d.to.uid : d.from.uid,
    expiresAt: d.expiresAt,
    createdAt: d.createdAt
  };
}

async function meuDesafioAtual(uid){
  try{
    const ptr = await friendChallengePointerRef(uid).get();
    if(!ptr.exists) return null;
    const snap = await friendChallengeRef(ptr.data().challengeId).get();
    if(!snap.exists){ await friendChallengePointerRef(uid).delete().catch(()=>{}); return null; }
    const d = snap.data();
    if(Date.now() > d.expiresAt){ await encerrarDesafio(d); return null; }
    return desafioView(d, uid);
  } catch(e){ logger.error('Erro ao ler desafio de amigo:', e); return null; }
}

async function encerrarDesafio(d){
  const lote = db.batch();
  lote.delete(friendChallengeRef(d.id));
  lote.delete(friendChallengePointerRef(d.from.uid));
  lote.delete(friendChallengePointerRef(d.to.uid));
  await lote.commit().catch(e=>logger.error('Erro ao encerrar desafio:', e));
}

exports.challengeFriend = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const alvo = String(request.data?.targetUid || '').trim();
  const codes = battleCodes(request.data);
  if(!alvo || alvo === uid) throw new HttpsError('invalid-argument', 'Treinador inválido.');

  /* A amizade é conferida ANTES do time, e a ordem é o que a pessoa lê na tela: quem tenta
     desafiar alguém que não está na lista precisa ouvir isso, não "você precisa de um time com
     as 8 insígnias" -- que manda conferir a coisa errada. */
  const amizade = await friendsColl(uid).doc(alvo).get();
  if(!amizade.exists) throw new HttpsError('permission-denied', 'Só dá pra desafiar quem está na sua lista.');
  if(!codes.length) throw new HttpsError('failed-precondition', 'Você precisa de um time com as 8 insígnias.');

  const [meuSnap, alvoSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('users').doc(alvo).get()
  ]);
  if(!alvoSnap.exists) throw new HttpsError('not-found', 'Esse treinador não existe mais.');
  const meuDados = meuSnap.exists ? meuSnap.data() : {};
  const alvoDados = alvoSnap.data();

  // um desafio por vez de cada lado: dois desafios abertos entre as mesmas pessoas viram duas
  // batalhas, e a segunda nasce órfã porque o cliente só sabe entrar numa
  const [ptrMeu, ptrAlvo] = await Promise.all([
    friendChallengePointerRef(uid).get(), friendChallengePointerRef(alvo).get()
  ]);
  for(const [ptr, msg] of [[ptrMeu, 'Você já tem um desafio em aberto.'], [ptrAlvo, 'Esse treinador já tem um desafio em aberto.']]){
    if(!ptr.exists) continue;
    const s = await friendChallengeRef(ptr.data().challengeId).get();
    if(s.exists && Date.now() <= s.data().expiresAt) throw new HttpsError('failed-precondition', msg);
    if(s.exists) await encerrarDesafio(s.data());   // vencido: limpa e segue
    else await friendChallengePointerRef(ptr.id).delete().catch(()=>{});
  }

  const agora = Date.now();
  const id = 'fc_' + agora + '_' + Math.random().toString(36).slice(2,8);
  const meuNome = meuDados.trainerName || 'Treinador';
  const desafio = {
    id, players: [uid, alvo],
    from: { uid, name: meuNome, codes, specialties: meuDados.specialties || [], stats: battleStatsFrom(meuDados) },
    to:   { uid: alvo, name: alvoDados.trainerName || 'Treinador' },
    createdAt: agora, expiresAt: agora + FRIEND_CHALLENGE_MS, aliveAt: agora
  };
  const lote = db.batch();
  lote.set(friendChallengeRef(id), desafio);
  lote.set(friendChallengePointerRef(uid), { challengeId: id, createdAt: agora });
  lote.set(friendChallengePointerRef(alvo), { challengeId: id, createdAt: agora });
  await lote.commit();

  await createNotification(alvo, 'friend_challenge',
    'Desafio de batalha',
    `${meuNome} está te chamando pra uma batalha online. Você tem 3 minutos pra responder.`,
    { fromUid: uid, fromName: meuNome, challengeId: id, expiresAt: desafio.expiresAt });

  return { challenge: desafioView(desafio, uid) };
});

/* Sinal de vida do desafiante + porta de entrada da batalha quando o outro aceita.
   Mesmo desenho do pollBattleQueue: sem cron, quem está esperando é quem faz o trabalho. */
/* Ponteiro de batalha velho não pode arrastar ninguém pra dentro de uma partida.
   O ponteiro fica gravado depois que a batalha acaba (agora é apagado em battleApplyStats, mas
   os que já existem em produção continuam lá), e quem consultasse com um "since" pequeno recebia
   o battleId da ÚLTIMA partida jogada. Foi assim que a tela de amigos passou a abrir sozinha uma
   batalha da noite anterior. Ninguém deveria entrar numa batalha criada minutos atrás: se ela
   fosse sua e estivesse viva, você já estaria nela. */
const PONTEIRO_BATALHA_TTL_MS = 5 * 60 * 1000;

exports.pollFriendChallenge = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const desde = Number(request.data?.since) || 0;

  const ponteiro = await db.collection('onlineBattlePointer').doc(uid).get();
  const criadoEm = ponteiro.exists ? (ponteiro.data().createdAt || 0) : 0;
  if(criadoEm > desde && Date.now() - criadoEm < PONTEIRO_BATALHA_TTL_MS){
    return { battleId: ponteiro.data().battleId };
  }
  const ptr = await friendChallengePointerRef(uid).get();
  if(!ptr.exists) return { challenge: null };
  const snap = await friendChallengeRef(ptr.data().challengeId).get();
  if(!snap.exists){ await friendChallengePointerRef(uid).delete().catch(()=>{}); return { challenge: null }; }
  const d = snap.data();
  if(Date.now() > d.expiresAt){ await encerrarDesafio(d); return { challenge: null, expirou: true }; }
  /* Só o desafiante renova o carimbo -- é a presença DELE que o aceite vai conferir.
     E só a partir da TELA DE AMIGOS: a consulta de fundo (o aviso que aparece em qualquer tela)
     manda passivo:true justamente pra não renovar nada. Sem isso, quem desafiasse e saísse da
     tela manteria o desafio vivo pelo próprio aviso, que é o oposto do que ele existe pra fazer. */
  if(d.from.uid === uid && !request.data?.passivo){
    await friendChallengeRef(d.id).set({ aliveAt: Date.now() }, { merge:true }).catch(()=>{});
  }
  return { challenge: desafioView(d, uid) };
});

exports.cancelFriendChallenge = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const ptr = await friendChallengePointerRef(uid).get();
  if(!ptr.exists) return { ok:true };
  const snap = await friendChallengeRef(ptr.data().challengeId).get();
  if(snap.exists) await encerrarDesafio(snap.data());
  else await friendChallengePointerRef(uid).delete().catch(()=>{});
  return { ok:true };
});

/* Aceite: é AQUI que a batalha nasce. Quem aceita manda os próprios times -- o desafiante já
   mandou os dele na hora de desafiar, e o servidor nunca aceita códigos novos depois disso
   (mesma regra do lobby: montar time depois de ver o adversário é o que a escolha às cegas
   existe pra impedir). */
exports.respondFriendChallenge = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const id = String(request.data?.challengeId || '').trim();
  const aceitar = !!request.data?.accept;
  if(!id) throw new HttpsError('invalid-argument', 'Desafio não informado.');

  const snap = await friendChallengeRef(id).get();
  if(!snap.exists) throw new HttpsError('not-found', 'Esse desafio não existe mais.');
  const d = snap.data();
  if(d.to.uid !== uid) throw new HttpsError('permission-denied', 'Esse desafio não é seu.');
  if(Date.now() > d.expiresAt){ await encerrarDesafio(d); throw new HttpsError('deadline-exceeded', 'O desafio expirou.'); }

  if(!aceitar){
    await encerrarDesafio(d);
    await createNotification(d.from.uid, 'friend_challenge_declined',
      'Desafio recusado', `${d.to.name} não pode batalhar agora.`, { fromUid: uid });
    return { ok:true, aceito:false };
  }

  // o desafiante ainda está na tela? Ver comentário do bloco: batalha contra aba fechada morre
  // por inatividade minutos depois, e o placar dela não conta pra ninguém
  if(Date.now() - (d.aliveAt || d.createdAt) > FRIEND_CHALLENGE_ALIVE_MS){
    await encerrarDesafio(d);
    throw new HttpsError('failed-precondition', `${d.from.name} saiu da tela do desafio.`);
  }

  const codes = battleCodes(request.data);
  if(!codes.length) throw new HttpsError('failed-precondition', 'Você precisa de um time com as 8 insígnias.');
  const meuSnap = await db.collection('users').doc(uid).get();
  const meuDados = meuSnap.exists ? meuSnap.data() : {};

  const estado = montarBatalhaOnline(d.from, {
    uid, name: meuDados.trainerName || d.to.name,
    codes, specialties: meuDados.specialties || [], stats: battleStatsFrom(meuDados)
  });
  const agora = Date.now();
  const lote = db.batch();
  lote.set(onlineBattleRef(estado.id), estado);
  lote.delete(friendChallengeRef(d.id));
  lote.delete(friendChallengePointerRef(d.from.uid));
  lote.delete(friendChallengePointerRef(d.to.uid));
  estado.players.forEach(p => lote.set(db.collection('onlineBattlePointer').doc(p), { battleId: estado.id, createdAt: agora }));
  await lote.commit();

  return { ok:true, aceito:true, battleId: estado.id };
});

/* =====================================================================
   BOSS DE DOMINGO -- raide GLOBAL contra um Mew nivel 999
   ---------------------------------------------------------------------
   Um Mew so pro jogo inteiro. Todo mundo ve a MESMA barra de vida, e ela nunca regenera: o que
   um jogador tirou fica tirado pro proximo. E uma luta coletiva -- ninguem derruba sozinho.

   ABERTA PRA TODO MUNDO desde 30/08/2026. Nasceu restrita a userTest -- a funcao bossRequireTester
   continua aqui, agora sem efeito, como gancho pronto caso algum modo futuro precise fechar de
   novo. Quem controla QUANDO ela aparece e o cliente: o botao so existe aos domingos.

   O SERVIDOR NUNCA ACEITA UM TIME DO CLIENTE. O cliente manda so o SLOT; o time sai do save
   gravado no Firestore. Aceitar um time montado na hora seria aceitar um time de nivel 99
   inventado no console -- e aqui o estrago e global, nao fica no save de quem trapaceou.

   O DIMENSIONAMENTO NAO VEM DO HP. Contra-intuitivo e importante: o motor calcula dano como
   FRACAO da vida do alvo (`pct = dmgGen1 / gen1MaxHp(alvo)`) e so no fim projeta na escala de HP
   (`pct * maxHp`). Ou seja, dobrar BOSS_MAX_HP dobra tambem o dano por golpe -- o numero de
   GOLPES ate derrubar nao muda em nada. Quem controla a duracao da raide e o NIVEL e a defesa do
   Mew (entram no divisor); o HP so decide a escala dos numeros que aparecem na tela.
   ===================================================================== */
const BOSS_ID = 'mew';
/* Nivel 4999. Medido na subida (time nivel 70): 999 dava 5.125 de vida e ~41 ataques pra
   derrubar; 4999 da 25.125 e ~399. O nivel entra no divisor do dano, entao ele -- e nao o HP --
   e quem dimensiona a raide.
   Efeito colateral medido e aceito: com a defesa tao alta, o dano de quase todo mundo desce pro
   piso, e a forca do time quase nao importa mais (time nivel 50 leva 411 ataques, nivel 99 leva
   340 -- 1,2x de diferenca, contra 2x que havia no nivel 999). A raide vira uma conta de QUANTA
   GENTE bate, nao de quao forte cada um e -- que e o que se quer de uma luta coletiva. */
const BOSS_LEVEL = 4999;
/* Mew: 100 em TODOS os atributos, oficial da Gen 2 (hp, ataque, defesa, Sp.Atk, Sp.Def, velocidade).
   Ele NAO entra em SPECIES de proposito -- `Object.keys(SPECIES)` e o que define o total da Pokedex
   e o "capturou tudo" que libera o desafio do Mewtwo, e um Mew que ninguem captura nao pode contar
   pra isso (mesma razao do DISGUISE_DISPLAY no cliente).
   Como a instancia carrega TODOS os atributos, nenhuma effective* precisa consultar SPECIES. */
const BOSS_BASE = { baseHp:100, attack:100, defense:100, spAtk:100, spDef:100, speed:100 };
/* O HP e o que a FORMULA DO JOGO da pra um Mew nivel 999, nao um numero escolhido:
   calcMaxHp = round(30 + nivel*5 + baseHp) = 30 + 4995 + 100 = 5125.
   Trocar este numero NAO muda a duracao da raide -- o dano e fracao da vida do alvo, entao a
   barra sempre cai ~2,44% por ataque (medido com 10 mil, 20 mil e 100 mil). Quem controla a
   duracao e o BOSS_LEVEL. Mas trocar EXIGE apagar globalBoss/mew: o maxHp fica gravado no
   documento, e o doc antigo continuaria valendo o valor velho. */
const BOSS_MAX_HP = calcMaxHp({ level: BOSS_LEVEL, baseHp: BOSS_BASE.baseHp });
function bossInstance(hpAtual){
  return Object.assign({ id:'boss-mew', speciesId:BOSS_ID, name:'Mew', types:['Psychic'],
                         level:BOSS_LEVEL, maxHp:BOSS_MAX_HP, hp:hpAtual, shiny:false },
                       BOSS_BASE);
}
function bossDocRef(){ return db.collection('globalBoss').doc(BOSS_ID); }
function bossPlayerRef(uid){ return bossDocRef().collection('players').doc(uid); }
function bossEstadoInicial(){
  return { hp: BOSS_MAX_HP, maxHp: BOSS_MAX_HP, level: BOSS_LEVEL, golpes: 0, batalhas: 0,
           danoTotal: 0, derrotadoEm: null, criadoEm: Date.now() };
}
/* Devolve os dados da conta -- o nome vem junto porque o ranking precisa dele, e ler o documento
   duas vezes na mesma chamada seria desperdicio. */
async function bossRequireTester(uid){
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? snap.data() : {};
}
/* TOP 10 de dano. O nome do treinador fica GRAVADO no documento do jogador (denormalizado) e e
   atualizado a cada ataque: sem isso o ranking precisaria de 10 leituras extras em users/ toda
   vez que alguem abrisse a tela. O preco e que quem troca de nome so aparece com o nome novo
   depois do proximo ataque -- barato perto de 10 leituras por abertura de tela.

   O RESULTADO FICA GUARDADO PRONTO em globalBoss/mewRank, e e de la que a tela le. Assim:
   - a consulta da tela custa 1 leitura em vez de 10, e
   - o cliente pode ESCUTAR esse documento em tempo real (as regras liberam leitura de
     globalBoss/{id} pra qualquer logado), o que dispensa consultar de tempos em tempos.
   Ele mora num documento SEPARADO, e nao dentro do documento do Mew, de proposito: o do Mew ja e
   disputado por todo ataque, e o Firestore sustenta ~1 gravacao por segundo por documento --
   somar mais uma gravacao ali pioraria justamente o ponto mais quente da raide. */
function bossRankDocRef(){ return db.collection('globalBoss').doc(BOSS_ID + 'Rank'); }
async function bossCalcularRanking(){
  const snap = await bossDocRef().collection('players').orderBy('dano','desc').limit(10).get();
  const lista = [];
  snap.forEach(doc => {
    const d = doc.data() || {};
    if(!(d.dano > 0)) return;                  // quem ainda nao tirou nada nao entra no ranking
    lista.push({ uid: doc.id, name: d.trainerName || 'Treinador',
                 dano: d.dano || 0, batalhas: d.batalhas || 0 });
  });
  return lista;
}
async function bossRanking(){
  const snap = await bossRankDocRef().get();
  if(snap.exists && Array.isArray(snap.data().lista)) return snap.data().lista;
  return await bossCalcularRanking();          // ainda nao existe: cai na consulta viva
}
/* Recalcula e grava o top 10. Best-effort de proposito: e so apresentacao, e falhar aqui nao pode
   derrubar um ataque que ja foi contabilizado. Fica FORA da transacao -- dentro dela a consulta
   de 10 documentos entraria no caminho critico de toda luta. */
async function bossAtualizarRanking(){
  try{
    await bossRankDocRef().set({ lista: await bossCalcularRanking(), em: Date.now() });
  }catch(e){ logger.error('Boss: falha ao atualizar o ranking', e); }
}
/* O Mew caiu: os 10 que mais machucaram ganham 1 hora de chance de shiny aumentada, e as duas
   conquistas da raide ficam marcadas na conta.
   Roda UMA vez, no ataque que derrubou -- quem derruba e exatamente um (o hpDepois so passa de
   >0 pra 0 uma vez, dentro da transacao). O bonus e gravado direto, sem passar por notificacao-
   cupom como o da Elite: aqui nao ha o que escolher, todo mundo do top 10 ganha igual, e um cupom
   que precisa ser ativado so criaria um jeito de perder o premio.
   As gravacoes vao em lote -- sao ate 10 contas de uma vez. */
async function bossPremiarTop10(uidQueDerrubou){
  try{
    const top = await bossCalcularRanking();
    const expiraEm = Date.now() + SHINY_BONUS_DURATION_MS;
    const lote = db.batch();
    top.forEach(e => {
      lote.set(db.collection('users').doc(e.uid),
               { shinyBonusExpiresAt: expiraEm, bossTop10: true }, { merge:true });
    });
    /* Quem deu o GOLPE FINAL nao e necessariamente do top 10 -- pode ter chegado no fim e tirado
       os ultimos 20 de HP. Marca a parte, e sem `undefined` no meio de um set do top 10: o
       Firestore recusa o documento inteiro se um campo vier undefined. */
    if(uidQueDerrubou){
      lote.set(db.collection('users').doc(uidQueDerrubou), { bossKiller: true }, { merge:true });
    }
    await lote.commit();
    await Promise.all(top.map((e, i) => createNotification(e.uid, 'boss_top10',
      '✨ Mew derrotado!',
      `Você terminou em ${i+1}º lugar com ${e.dano} de dano no Mew. Sua chance de encontrar shiny ` +
      `está aumentada pela próxima 1 hora!`,
      { rank: i+1, dano: e.dano })));
  }catch(e){ logger.error('Boss: falha ao premiar o top 10', e); }
}
async function bossGetEstado(){
  const snap = await bossDocRef().get();
  if(snap.exists) return snap.data();
  const inicial = bossEstadoInicial();
  await bossDocRef().set(inicial);
  return inicial;
}

/* Time contra UM alvo que nao recupera vida entre confrontos.
   Nao da pra usar o simulateGymBattle: a primeira coisa que ele faz e devolver vida cheia aos dois
   lados, e o Mew tem que entrar com a vida que sobrou da ultima batalha de OUTRO jogador. O resto
   do laco e o mesmo -- inclusive o doExchange, que e quem escreve o diario do log. */
function simulateBossFight(team, boss){
  team.forEach(p => { p.maxHp = calcMaxHp(p); p.hp = p.maxHp; });
  const matchups = [];
  let playerStreak = 0, enemyStreak = 0;
  const hpInicialDoBoss = boss.hp;
  while(boss.hp > 0){
    const vivos = team.filter(p => p.hp > 0);
    if(!vivos.length) break;                     // time acabou: o Mew fica com a vida que sobrou
    const active = vivos[0];
    active.winsThisBattle = playerStreak;
    boss.winsThisBattle = enemyStreak;
    const playerHpBefore = active.hp, enemyHpBefore = boss.hp;
    const playerAliveBefore = vivos.length;
    const diario = [];
    while(active.hp > 0 && boss.hp > 0){ doExchange(active, boss, Math.random, diario); }
    const bossCaiu = boss.hp <= 0, activeCaiu = active.hp <= 0;
    matchups.push({
      player:active.name, playerSpecies:active.speciesId, playerLevel:active.level,
      playerShiny: !!active.shiny, playerBuffed:false,
      enemy:boss.name, enemySpecies:boss.speciesId, enemyLevel:boss.level,
      enemyShiny:false, enemyBuffed:false,
      playerTrainerStreak: playerStreak, enemyTrainerStreak: enemyStreak,
      winner: (bossCaiu && activeCaiu) ? null : (bossCaiu ? active.name : boss.name),
      isTrade: bossCaiu && activeCaiu, suddenDeath:false, suddenDeathMessage:null,
      playerWon: bossCaiu && !activeCaiu,
      playerMove: active.lastMoveType || null, enemyMove: boss.lastMoveType || null,
      golpes: diario,
      playerHpBefore, playerHpAfter: active.hp, playerMaxHp: active.maxHp,
      enemyHpBefore, enemyHpAfter: Math.max(0, boss.hp), enemyMaxHp: boss.maxHp,
      playerAliveBefore, playerAliveAfter: activeCaiu ? playerAliveBefore-1 : playerAliveBefore,
      playerTeamSize: team.length,
      enemyAliveBefore:1, enemyAliveAfter: bossCaiu ? 0 : 1, enemyTeamSize:1
    });
    if(bossCaiu && activeCaiu){ playerStreak = 0; enemyStreak = 0; }
    else if(bossCaiu){ playerStreak++; enemyStreak = 0; }
    else { enemyStreak++; playerStreak = 0; }
  }
  return { matchups, dano: Math.max(0, hpInicialDoBoss - Math.max(0, boss.hp)),
           derrubou: boss.hp <= 0, hpDepois: Math.max(0, boss.hp) };
}

/* Estado da raide + o que ESTE jogador já tirou. Também devolve os times elegíveis (todos os
   saves da conta), pra tela não precisar de uma segunda ida ao servidor. */
exports.getSundayBoss = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  await bossRequireTester(uid);
  const estado = await bossGetEstado();
  const ranking = await bossRanking();
  const meuSnap = await bossPlayerRef(uid).get();
  const meu = meuSnap.exists ? meuSnap.data() : { dano:0, batalhas:0 };
  /* A tela normalmente ESCUTA os dois documentos em tempo real e nao chama mais nada. Este resumo
     e a rede de seguranca: se a escuta nao subir (regra, rede, navegador), o cliente volta a
     consultar de 5 em 5 segundos. Corta a lista de times, que nao muda com a tela aberta. */
  if(request.data && request.data.resumo){
    return { boss: { hp:estado.hp, maxHp:estado.maxHp, level:estado.level, golpes:estado.golpes||0,
                     batalhas:estado.batalhas||0, derrotadoEm:estado.derrotadoEm || null },
             meu: { dano: meu.dano||0, batalhas: meu.batalhas||0 },
             ranking, serverNow: Date.now() };
  }
  const savesSnap = await db.collection('users').doc(uid).collection('saves').get();
  const times = [];
  savesSnap.forEach(doc => {
    const s = doc.data() || {};
    const team = (s.team || []).filter(p => p && p.speciesId);
    if(!team.length) return;
    // `customName` e o mesmo campo que a home usa. Estava lendo `saveName`, que nao existe --
    // por isso todo time aparecia como "Time 1", "Time 2", ignorando o nome que o jogador deu
    times.push({ slot: doc.id, nome: s.customName || ('Time ' + (Number(doc.id)+1)),
                 team: team.map(p => ({ speciesId:p.speciesId, level:p.level, shiny: !!p.shiny })) });
  });
  times.sort((a,b) => Number(a.slot) - Number(b.slot));
  return { boss: { hp:estado.hp, maxHp:estado.maxHp, level:estado.level, golpes:estado.golpes||0,
                   batalhas:estado.batalhas||0, derrotadoEm:estado.derrotadoEm || null },
           meu: { dano: meu.dano||0, batalhas: meu.batalhas||0 },
           ranking, times, serverNow: Date.now() };
});

/* Um ataque. O cliente manda só o SLOT -- o time sai do save gravado, nunca do que ele diz
   ter. O desconto no Mew vai numa TRANSAÇÃO: a raide é global e vários ataques chegam ao mesmo
   tempo; sem transação duas leituras do mesmo HP gravariam o dano por cima uma da outra e parte
   do estrago sumiria. */
exports.fightSundayBoss = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const conta = await bossRequireTester(uid);
  const slot = String(request.data?.slot ?? '');
  if(!slot){ throw new HttpsError('invalid-argument', 'Escolha um time.'); }

  const saveSnap = await db.collection('users').doc(uid).collection('saves').doc(slot).get();
  if(!saveSnap.exists){ throw new HttpsError('failed-precondition', 'Esse time não existe na sua conta.'); }
  const guardado = (saveSnap.data().team || []).filter(p => p && p.speciesId);
  if(!guardado.length){ throw new HttpsError('failed-precondition', 'Esse time está vazio.'); }

  const estado = await bossGetEstado();
  if(estado.hp <= 0){ throw new HttpsError('failed-precondition', 'O Mew já foi derrotado.'); }

  /* Monta as instâncias a partir do que está GRAVADO. hydrateTeam não existe aqui; os campos que
     faltarem caem no SPECIES pelas effective*, que é a mesma migração de save de sempre. */
  const time = guardado.map((p, i) => ({
    id: 'boss-p' + i, speciesId: p.speciesId, name: (SPECIES[p.speciesId] || {}).name || p.speciesId,
    types: (SPECIES[p.speciesId] || {}).types || ['Normal'],
    level: Math.max(1, Math.min(MAX_POKEMON_LEVEL, p.level || 1)), shiny: !!p.shiny,
    maxHp: 0, hp: 0
  }));

  const antes = estado.hp;
  const boss = bossInstance(antes);
  const luta = simulateBossFight(time, boss);

  /* O dano foi calculado sobre o HP que a leitura viu. Se outro jogador bateu no meio do caminho,
     o que vale é o dano -- ele é descontado do HP atual, não do que foi lido. */
  const resultado = await db.runTransaction(async (tx) => {
    const ref = bossDocRef(), meuRef = bossPlayerRef(uid);
    /* AS DUAS LEITURAS PRIMEIRO. O Firestore recusa a transação inteira se um get vier depois de
       um set ("all reads to be executed before all writes"), e o erro só aparece em produção --
       chega no cliente como um INTERNAL seco. Foi assim que esta função nasceu quebrada. */
    const [snap, meuSnap] = await Promise.all([tx.get(ref), tx.get(meuRef)]);
    const atual = snap.exists ? snap.data() : bossEstadoInicial();
    const meu = meuSnap.exists ? meuSnap.data() : { dano:0, batalhas:0 };
    /* O dano SIMULADO pode ser maior que a vida que sobrou: a luta foi calculada sobre o HP lido
       ANTES da transação, e nesse meio-tempo outros treinadores podem ter batido. Descontar o
       simulado deixava o HP certo (o Math.max segura), mas creditava ao jogador um dano que nunca
       existiu -- medido com 10 contas simultâneas num Mew com 251 de vida: as contribuições
       somaram 6322 de uma barra de 5125. O que vale é o que REALMENTE saiu da barra. */
    const aplicado = Math.min(luta.dano, atual.hp || 0);
    const hpDepois = Math.max(0, (atual.hp || 0) - aplicado);
    const derrubou = hpDepois === 0 && (atual.hp || 0) > 0;
    tx.set(ref, { hp: hpDepois, maxHp: atual.maxHp || BOSS_MAX_HP, level: atual.level || BOSS_LEVEL,
                  golpes: (atual.golpes || 0) + luta.matchups.reduce((s,m)=>s+(m.golpes||[]).length, 0),
                  batalhas: (atual.batalhas || 0) + 1,
                  danoTotal: (atual.danoTotal || 0) + aplicado,
                  derrotadoEm: hpDepois === 0 ? (atual.derrotadoEm || Date.now()) : null,
                  criadoEm: atual.criadoEm || Date.now() }, { merge:true });
    tx.set(meuRef, { dano: (meu.dano||0) + aplicado, batalhas: (meu.batalhas||0) + 1,
                     // nome gravado junto: e o que faz o ranking sair numa consulta so (ver bossRanking)
                     trainerName: conta.trainerName || 'Treinador',
                     ultimaEm: Date.now() }, { merge:true });
    return { hpDepois, derrubou, aplicado, hpNaHora: (atual.hp || 0),
             meuDano: (meu.dano||0) + aplicado, meusAtaques: (meu.batalhas||0) + 1 };
  });

  await bossAtualizarRanking();   // o top 10 fica pronto pra tela ler numa leitura so
  if(resultado.derrubou) await bossPremiarTop10(uid);
  return { matchups: luta.matchups, win: luta.derrubou,
           dano: resultado.aplicado,          // o que saiu da barra de verdade
           danoSimulado: luta.dano,           // o que a luta deu; maior quando outro chegou antes
           chegouTarde: resultado.aplicado < luta.dano,
           hpAntes: resultado.hpNaHora, hpDepois: resultado.hpDepois,
           maxHp: BOSS_MAX_HP, derrubou: resultado.derrubou,
           meu: { dano: resultado.meuDano, batalhas: resultado.meusAtaques } };
});

exports._TERRAINS = TERRAINS;   // so pro teste do ginasio escolher um terreno valido


exports._towerFecharDia = towerFecharDia;   // o fechamento do dia e testado direto: no ar ele roda dentro do cron
