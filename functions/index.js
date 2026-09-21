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
  bulbasaur:{dex:1, name:'Bulbasaur', types:['Grass','Poison'], hp:45, attack:49, defense:49, speed:45},
  charmander:{dex:4, name:'Charmander', types:['Fire'], hp:39, attack:52, defense:43, speed:65},
  squirtle:{dex:7, name:'Squirtle', types:['Water'], hp:44, attack:48, defense:65, speed:43},
  weedle:{dex:13, name:'Weedle', types:['Bug','Poison'], hp:40, attack:35, defense:30, speed:50},
  caterpie:{dex:10, name:'Caterpie', types:['Bug'], hp:45, attack:30, defense:35, speed:45},
  ratata:{dex:19, name:'Ratata', types:['Normal'], hp:30, attack:56, defense:35, speed:72},
  pidgey:{dex:16, name:'Pidgey', types:['Normal','Flying'], hp:40, attack:45, defense:40, speed:56},
  mankey:{dex:56, name:'Mankey', types:['Fighting'], hp:40, attack:80, defense:35, speed:70},
  spearow:{dex:21, name:'Spearow', types:['Normal','Flying'], hp:40, attack:60, defense:30, speed:70},
  nidoranm:{dex:32, name:'Nidoran (M)', types:['Poison'], hp:46, attack:57, defense:40, speed:50},
  oddish:{dex:43, name:'Oddish', types:['Grass','Poison'], hp:45, attack:50, defense:55, speed:30},
  geodude:{dex:74, name:'Geodude', types:['Rock','Ground'], hp:40, attack:80, defense:100, speed:20},
  onix:{dex:95, name:'Onix', types:['Rock','Ground'], hp:35, attack:45, defense:160, speed:70},
  ivysaur:{dex:2, name:'Ivysaur', types:['Grass','Poison'], hp:60, attack:62, defense:63, speed:60},
  venusaur:{dex:3, name:'Venusaur', types:['Grass','Poison'], hp:80, attack:82, defense:83, speed:80},
  charmeleon:{dex:5, name:'Charmeleon', types:['Fire'], hp:58, attack:64, defense:58, speed:80},
  charizard:{dex:6, name:'Charizard', types:['Fire','Flying'], hp:78, attack:84, defense:78, speed:100},
  wartortle:{dex:8, name:'Wartortle', types:['Water'], hp:59, attack:63, defense:80, speed:58},
  blastoise:{dex:9, name:'Blastoise', types:['Water'], hp:79, attack:83, defense:100, speed:78},
  kakuna:{dex:14, name:'Kakuna', types:['Bug','Poison'], hp:45, attack:25, defense:50, speed:35},
  beedrill:{dex:15, name:'Beedrill', types:['Bug','Poison'], hp:65, attack:80, defense:40, speed:75},
  metapod:{dex:11, name:'Metapod', types:['Bug'], hp:50, attack:20, defense:55, speed:30},
  butterfree:{dex:12, name:'Butterfree', types:['Bug','Flying'], hp:60, attack:45, defense:50, speed:70},
  raticate:{dex:20, name:'Raticate', types:['Normal'], hp:55, attack:81, defense:60, speed:97},
  pidgeotto:{dex:17, name:'Pidgeotto', types:['Normal','Flying'], hp:63, attack:60, defense:55, speed:71},
  pidgeot:{dex:18, name:'Pidgeot', types:['Normal','Flying'], hp:83, attack:80, defense:75, speed:91},
  primeape:{dex:57, name:'Primeape', types:['Fighting'], hp:65, attack:105, defense:60, speed:95},
  fearow:{dex:22, name:'Fearow', types:['Normal','Flying'], hp:65, attack:90, defense:65, speed:100},
  nidorino:{dex:33, name:'Nidorino', types:['Poison'], hp:61, attack:72, defense:57, speed:65},
  gloom:{dex:44, name:'Gloom', types:['Grass','Poison'], hp:60, attack:65, defense:70, speed:40},
  sandshrew:{dex:27, name:'Sandshrew', types:['Ground'], hp:50, attack:75, defense:85, speed:40},
  sandslash:{dex:28, name:'Sandslash', types:['Ground'], hp:75, attack:100, defense:110, speed:65},
  clefairy:{dex:35, name:'Clefairy', types:['Normal'], hp:70, attack:45, defense:48, speed:35},
  jigglypuff:{dex:39, name:'Jigglypuff', types:['Normal'], hp:115, attack:45, defense:20, speed:20},
  zubat:{dex:41, name:'Zubat', types:['Poison','Flying'], hp:40, attack:45, defense:35, speed:55},
  golbat:{dex:42, name:'Golbat', types:['Poison','Flying'], hp:75, attack:80, defense:70, speed:90},
  paras:{dex:46, name:'Paras', types:['Bug','Grass'], hp:35, attack:70, defense:55, speed:25},
  parasect:{dex:47, name:'Parasect', types:['Bug','Grass'], hp:60, attack:95, defense:80, speed:30},
  meowth:{dex:52, name:'Meowth', types:['Normal'], hp:40, attack:45, defense:35, speed:90},
  persian:{dex:53, name:'Persian', types:['Normal'], hp:65, attack:70, defense:60, speed:115},
  bellsprout:{dex:69, name:'Bellsprout', types:['Grass','Poison'], hp:50, attack:75, defense:35, speed:40},
  weepinbell:{dex:70, name:'Weepinbell', types:['Grass','Poison'], hp:65, attack:90, defense:50, speed:55},
  abra:{dex:63, name:'Abra', types:['Psychic'], hp:25, attack:20, defense:15, speed:90},
  kadabra:{dex:64, name:'Kadabra', types:['Psychic'], hp:40, attack:35, defense:30, speed:105},
  staryu:{dex:120, name:'Staryu', types:['Water'], hp:30, attack:45, defense:55, speed:85},
  starmie:{dex:121, name:'Starmie', types:['Water','Psychic'], hp:60, attack:75, defense:85, speed:115},
  growlithe:{dex:58, name:'Growlithe', types:['Fire'], hp:55, attack:70, defense:45, speed:60},
  vulpix:{dex:37, name:'Vulpix', types:['Fire'], hp:38, attack:41, defense:40, speed:65},
  ekans:{dex:23, name:'Ekans', types:['Poison'], hp:35, attack:60, defense:44, speed:55},
  arbok:{dex:24, name:'Arbok', types:['Poison'], hp:60, attack:85, defense:69, speed:80},
  diglett:{dex:50, name:'Diglett', types:['Ground'], hp:10, attack:55, defense:25, speed:95},
  dugtrio:{dex:51, name:'Dugtrio', types:['Ground'], hp:35, attack:80, defense:50, speed:120},
  magnemite:{dex:81, name:'Magnemite', types:['Electric'], hp:25, attack:35, defense:70, speed:45},
  magneton:{dex:82, name:'Magneton', types:['Electric'], hp:50, attack:60, defense:95, speed:70},
  drowzee:{dex:96, name:'Drowzee', types:['Psychic'], hp:60, attack:48, defense:45, speed:42},
  hypno:{dex:97, name:'Hypno', types:['Psychic'], hp:85, attack:73, defense:70, speed:67},
  nidoranf:{dex:29, name:'Nidoran (F)', types:['Poison'], hp:55, attack:47, defense:52, speed:41},
  nidorina:{dex:30, name:'Nidorina', types:['Poison'], hp:70, attack:62, defense:67, speed:56},
  venonat:{dex:48, name:'Venonat', types:['Bug','Poison'], hp:60, attack:55, defense:50, speed:45},
  venomoth:{dex:49, name:'Venomoth', types:['Bug','Poison'], hp:70, attack:65, defense:60, speed:90},
  voltorb:{dex:100, name:'Voltorb', types:['Electric'], hp:40, attack:30, defense:50, speed:100},
  pikachu:{dex:25, name:'Pikachu', types:['Electric'], hp:35, attack:55, defense:30, speed:90},
  raichu:{dex:26, name:'Raichu', types:['Electric'], hp:60, attack:90, defense:55, speed:100},
  poliwag:{dex:60, name:'Poliwag', types:['Water'], hp:40, attack:50, defense:40, speed:90},
  poliwhirl:{dex:61, name:'Poliwhirl', types:['Water'], hp:65, attack:65, defense:65, speed:90},
  tentacool:{dex:72, name:'Tentacool', types:['Water','Poison'], hp:40, attack:40, defense:35, speed:70},
  tentacruel:{dex:73, name:'Tentacruel', types:['Water','Poison'], hp:80, attack:70, defense:65, speed:100},
  machop:{dex:66, name:'Machop', types:['Fighting'], hp:70, attack:80, defense:50, speed:35},
  machoke:{dex:67, name:'Machoke', types:['Fighting'], hp:80, attack:100, defense:70, speed:45},
  doduo:{dex:84, name:'Doduo', types:['Normal','Flying'], hp:35, attack:85, defense:45, speed:75},
  dodrio:{dex:85, name:'Dodrio', types:['Normal','Flying'], hp:60, attack:110, defense:70, speed:100},
  ponyta:{dex:77, name:'Ponyta', types:['Fire'], hp:50, attack:85, defense:55, speed:90},
  rapidash:{dex:78, name:'Rapidash', types:['Fire'], hp:65, attack:100, defense:70, speed:105},
  slowpoke:{dex:79, name:'Slowpoke', types:['Water','Psychic'], hp:90, attack:65, defense:65, speed:15},
  slowbro:{dex:80, name:'Slowbro', types:['Water','Psychic'], hp:95, attack:75, defense:110, speed:30},
  magikarp:{dex:129, name:'Magikarp', types:['Water'], hp:20, attack:10, defense:55, speed:80},
  gyarados:{dex:130, name:'Gyarados', types:['Water','Flying'], hp:95, attack:125, defense:79, speed:81},
  grimer:{dex:88, name:'Grimer', types:['Poison'], hp:80, attack:80, defense:50, speed:25},
  muk:{dex:89, name:'Muk', types:['Poison'], hp:105, attack:105, defense:75, speed:50},
  tauros:{dex:128, name:'Tauros', types:['Normal'], hp:75, attack:100, defense:95, speed:110},
  // Água/Psíquico pra bater com o pokemon-ginasio.html. ATENÇÃO: no jogo original Psyduck e Golduck
  // são Água PURO -- o tipo Psíquico aqui é uma divergência antiga do cliente. Alinhado ao cliente
  // porque é o que os jogadores conhecem; se um dia for corrigido, tem que ser nos DOIS arquivos
  psyduck:{dex:54, name:'Psyduck', types:['Water','Psychic'], hp:50, attack:52, defense:48, speed:55},
  golduck:{dex:55, name:'Golduck', types:['Water','Psychic'], hp:80, attack:82, defense:78, speed:85},
  krabby:{dex:98, name:'Krabby', types:['Water'], hp:30, attack:105, defense:90, speed:50},
  kingler:{dex:99, name:'Kingler', types:['Water'], hp:55, attack:130, defense:115, speed:75},
  horsea:{dex:116, name:'Horsea', types:['Water'], hp:30, attack:40, defense:70, speed:60},
  seadra:{dex:117, name:'Seadra', types:['Water'], hp:55, attack:65, defense:95, speed:85},
  goldeen:{dex:118, name:'Goldeen', types:['Water'], hp:45, attack:67, defense:60, speed:63},
  seaking:{dex:119, name:'Seaking', types:['Water'], hp:80, attack:92, defense:65, speed:68},
  shellder:{dex:90, name:'Shellder', types:['Water'], hp:30, attack:65, defense:100, speed:40},
  exeggcute:{dex:102, name:'Exeggcute', types:['Grass','Psychic'], hp:60, attack:40, defense:80, speed:40},
  cubone:{dex:104, name:'Cubone', types:['Ground'], hp:50, attack:50, defense:95, speed:35},
  marowak:{dex:105, name:'Marowak', types:['Ground'], hp:60, attack:80, defense:110, speed:45},
  victreebel:{dex:71, name:'Victreebel', types:['Grass','Poison'], hp:80, attack:105, defense:65, speed:70},
  tangela:{dex:114, name:'Tangela', types:['Grass'], hp:65, attack:55, defense:115, speed:60},
  vileplume:{dex:45, name:'Vileplume', types:['Grass','Poison'], hp:75, attack:80, defense:85, speed:50},
  koffing:{dex:109, name:'Koffing', types:['Poison'], hp:40, attack:65, defense:95, speed:35},
  weezing:{dex:110, name:'Weezing', types:['Poison'], hp:65, attack:90, defense:120, speed:60},
  gastly:{dex:92, name:'Gastly', types:['Ghost','Poison'], hp:30, attack:35, defense:30, speed:80},
  haunter:{dex:93, name:'Haunter', types:['Ghost','Poison'], hp:45, attack:50, defense:45, speed:95},
  ditto:{dex:132, name:'Ditto', types:['Normal'], hp:48, attack:48, defense:48, speed:48},
  lickitung:{dex:108, name:'Lickitung', types:['Normal'], hp:90, attack:55, defense:75, speed:30},
  rhyhorn:{dex:111, name:'Rhyhorn', types:['Ground','Rock'], hp:80, attack:85, defense:95, speed:25},
  rhydon:{dex:112, name:'Rhydon', types:['Ground','Rock'], hp:105, attack:130, defense:120, speed:40},
  seel:{dex:86, name:'Seel', types:['Water'], hp:65, attack:45, defense:55, speed:45},
  dewgong:{dex:87, name:'Dewgong', types:['Water','Ice'], hp:90, attack:70, defense:80, speed:70},
  farfetchd:{dex:83, name:"Farfetch'd", types:['Normal','Flying'], hp:52, attack:65, defense:55, speed:60},
  kangaskhan:{dex:115, name:'Kangaskhan', types:['Normal'], hp:105, attack:95, defense:80, speed:90},
  scyther:{dex:123, name:'Scyther', types:['Bug','Flying'], hp:70, attack:110, defense:80, speed:105},
  omanyte:{dex:138, name:'Omanyte', types:['Rock','Water'], hp:35, attack:40, defense:100, speed:35},
  omastar:{dex:139, name:'Omastar', types:['Rock','Water'], hp:70, attack:60, defense:125, speed:55},
  kabuto:{dex:140, name:'Kabuto', types:['Rock','Water'], hp:30, attack:80, defense:90, speed:55},
  kabutops:{dex:141, name:'Kabutops', types:['Rock','Water'], hp:60, attack:115, defense:105, speed:80},
  electrode:{dex:101, name:'Electrode', types:['Electric'], hp:60, attack:50, defense:70, speed:140},
  magmar:{dex:126, name:'Magmar', types:['Fire'], hp:65, attack:95, defense:57, speed:93},
  lapras:{dex:131, name:'Lapras', types:['Water','Ice'], hp:130, attack:85, defense:80, speed:60},
  porygon:{dex:137, name:'Porygon', types:['Normal'], hp:65, attack:60, defense:70, speed:40},
  eevee:{dex:133, name:'Eevee', types:['Normal'], hp:55, attack:55, defense:50, speed:55},
  snorlax:{dex:143, name:'Snorlax', types:['Normal'], hp:160, attack:110, defense:65, speed:30},
  chansey:{dex:113, name:'Chansey', types:['Normal'], hp:250, attack:5, defense:5, speed:50},
  hitmonlee:{dex:106, name:'Hitmonlee', types:['Fighting'], hp:50, attack:120, defense:53, speed:87},
  hitmonchan:{dex:107, name:'Hitmonchan', types:['Fighting'], hp:50, attack:105, defense:79, speed:76},
  pinsir:{dex:127, name:'Pinsir', types:['Bug'], hp:65, attack:125, defense:100, speed:85},
  electabuzz:{dex:125, name:'Electabuzz', types:['Electric'], hp:65, attack:83, defense:57, speed:105},
  aerodactyl:{dex:142, name:'Aerodactyl', types:['Rock','Flying'], hp:80, attack:105, defense:65, speed:130},
  alakazam:{dex:65, name:'Alakazam', types:['Psychic'], hp:55, attack:50, defense:45, speed:120},
  mrmime:{dex:122, name:'Mr. Mime', types:['Psychic'], hp:40, attack:45, defense:65, speed:90},
  arcanine:{dex:59, name:'Arcanine', types:['Fire'], hp:90, attack:110, defense:80, speed:95},
  nidoqueen:{dex:31, name:'Nidoqueen', types:['Poison','Ground'], hp:90, attack:82, defense:87, speed:76},
  nidoking:{dex:34, name:'Nidoking', types:['Poison','Ground'], hp:81, attack:92, defense:77, speed:85},
  graveler:{dex:75, name:'Graveler', types:['Rock','Ground'], hp:55, attack:95, defense:115, speed:35},
  dratini:{dex:147, name:'Dratini', types:['Dragon'], hp:41, attack:64, defense:45, speed:50},
  dragonair:{dex:148, name:'Dragonair', types:['Dragon'], hp:61, attack:84, defense:65, speed:70},
  dragonite:{dex:149, name:'Dragonite', types:['Dragon','Flying'], hp:91, attack:134, defense:95, speed:80},
  jynx:{dex:124, name:'Jynx', types:['Ice','Psychic'], hp:65, attack:50, defense:35, speed:95},
  exeggutor:{dex:103, name:'Exeggutor', types:['Grass','Psychic'], hp:95, attack:95, defense:85, speed:55},
  clefable:{dex:36, name:'Clefable', types:['Normal'], hp:95, attack:70, defense:73, speed:60},
  wigglytuff:{dex:40, name:'Wigglytuff', types:['Normal'], hp:140, attack:70, defense:45, speed:45},
  ninetales:{dex:38, name:'Ninetales', types:['Fire'], hp:73, attack:76, defense:75, speed:100},
  poliwrath:{dex:62, name:'Poliwrath', types:['Water','Fighting'], hp:90, attack:85, defense:95, speed:70},
  cloyster:{dex:91, name:'Cloyster', types:['Water','Ice'], hp:50, attack:95, defense:180, speed:70},
  machamp:{dex:68, name:'Machamp', types:['Fighting'], hp:90, attack:130, defense:80, speed:55},
  golem:{dex:76, name:'Golem', types:['Rock','Ground'], hp:80, attack:110, defense:130, speed:45},
  gengar:{dex:94, name:'Gengar', types:['Ghost','Poison'], hp:60, attack:65, defense:60, speed:110},
  moltres:{dex:146, name:'Moltres', types:['Fire','Flying'], hp:90, attack:100, defense:90, speed:90},
  zapdos:{dex:145, name:'Zapdos', types:['Electric','Flying'], hp:90, attack:90, defense:85, speed:100},
  articuno:{dex:144, name:'Articuno', types:['Ice','Flying'], hp:90, attack:85, defense:100, speed:85},
  vaporeon:{dex:134, name:'Vaporeon', types:['Water'], hp:130, attack:65, defense:60, speed:65},
  jolteon:{dex:135, name:'Jolteon', types:['Electric'], hp:65, attack:65, defense:60, speed:130},
  flareon:{dex:136, name:'Flareon', types:['Fire'], hp:65, attack:130, defense:60, speed:65},
  mewtwo:{dex:150, name:'Mewtwo', types:['Psychic'], hp:106, attack:110, defense:90, speed:130},

  /* ---- JOHTO (#152-251) ----------------------------------------------------------------
     Entraram na tabela em uso em 30/08/2026, quando a jornada passou a poder seguir por Johto.
     Ate ali viviam numa tabela paralela (SPECIES_JOHTO), justamente pra NAO contar pro total da
     Pokedex nem pro pool da Torre antes da hora. Agora contam: a Pokedex vai a 250 (o #151, Mew,
     continua de fora -- e o chefe da raide, ninguem captura). */
  chikorita:{dex:152, name:'Chikorita', types:['Grass'], hp:45, attack:49, defense:65, speed:45},
  bayleef:{dex:153, name:'Bayleef', types:['Grass'], hp:60, attack:62, defense:80, speed:60},
  meganium:{dex:154, name:'Meganium', types:['Grass'], hp:80, attack:82, defense:100, speed:80},
  cyndaquil:{dex:155, name:'Cyndaquil', types:['Fire'], hp:39, attack:52, defense:43, speed:65},
  quilava:{dex:156, name:'Quilava', types:['Fire'], hp:58, attack:64, defense:58, speed:80},
  typhlosion:{dex:157, name:'Typhlosion', types:['Fire'], hp:78, attack:84, defense:78, speed:100},
  totodile:{dex:158, name:'Totodile', types:['Water'], hp:50, attack:65, defense:64, speed:43},
  croconaw:{dex:159, name:'Croconaw', types:['Water'], hp:65, attack:80, defense:80, speed:58},
  feraligatr:{dex:160, name:'Feraligatr', types:['Water'], hp:85, attack:105, defense:100, speed:78},
  sentret:{dex:161, name:'Sentret', types:['Normal'], hp:35, attack:46, defense:34, speed:20},
  furret:{dex:162, name:'Furret', types:['Normal'], hp:85, attack:76, defense:64, speed:90},
  hoothoot:{dex:163, name:'Hoothoot', types:['Normal','Flying'], hp:60, attack:30, defense:30, speed:50},
  noctowl:{dex:164, name:'Noctowl', types:['Normal','Flying'], hp:100, attack:50, defense:50, speed:70},
  ledyba:{dex:165, name:'Ledyba', types:['Bug','Flying'], hp:40, attack:20, defense:30, speed:55},
  ledian:{dex:166, name:'Ledian', types:['Bug','Flying'], hp:55, attack:35, defense:50, speed:85},
  spinarak:{dex:167, name:'Spinarak', types:['Bug','Poison'], hp:40, attack:60, defense:40, speed:30},
  ariados:{dex:168, name:'Ariados', types:['Bug','Poison'], hp:70, attack:90, defense:70, speed:40},
  crobat:{dex:169, name:'Crobat', types:['Poison','Flying'], hp:85, attack:90, defense:80, speed:130},
  chinchou:{dex:170, name:'Chinchou', types:['Water','Electric'], hp:75, attack:38, defense:38, speed:67},
  lanturn:{dex:171, name:'Lanturn', types:['Water','Electric'], hp:125, attack:58, defense:58, speed:67},
  pichu:{dex:172, name:'Pichu', types:['Electric'], hp:20, attack:40, defense:15, speed:60},
  cleffa:{dex:173, name:'Cleffa', types:['Normal'], hp:50, attack:25, defense:28, speed:15},
  igglybuff:{dex:174, name:'Igglybuff', types:['Normal'], hp:90, attack:30, defense:15, speed:15},
  togepi:{dex:175, name:'Togepi', types:['Normal'], hp:35, attack:20, defense:65, speed:20},
  togetic:{dex:176, name:'Togetic', types:['Normal','Flying'], hp:55, attack:40, defense:85, speed:40},
  natu:{dex:177, name:'Natu', types:['Psychic','Flying'], hp:40, attack:50, defense:45, speed:70},
  xatu:{dex:178, name:'Xatu', types:['Psychic','Flying'], hp:65, attack:75, defense:70, speed:95},
  mareep:{dex:179, name:'Mareep', types:['Electric'], hp:55, attack:40, defense:40, speed:35},
  flaaffy:{dex:180, name:'Flaaffy', types:['Electric'], hp:70, attack:55, defense:55, speed:45},
  ampharos:{dex:181, name:'Ampharos', types:['Electric'], hp:90, attack:75, defense:75, speed:55},
  bellossom:{dex:182, name:'Bellossom', types:['Grass'], hp:75, attack:80, defense:85, speed:50},
  marill:{dex:183, name:'Marill', types:['Water'], hp:70, attack:20, defense:50, speed:40},
  azumarill:{dex:184, name:'Azumarill', types:['Water'], hp:100, attack:50, defense:80, speed:50},
  sudowoodo:{dex:185, name:'Sudowoodo', types:['Rock'], hp:70, attack:100, defense:115, speed:30},
  politoed:{dex:186, name:'Politoed', types:['Water'], hp:90, attack:75, defense:75, speed:70},
  hoppip:{dex:187, name:'Hoppip', types:['Grass','Flying'], hp:35, attack:35, defense:40, speed:50},
  skiploom:{dex:188, name:'Skiploom', types:['Grass','Flying'], hp:55, attack:45, defense:50, speed:80},
  jumpluff:{dex:189, name:'Jumpluff', types:['Grass','Flying'], hp:75, attack:55, defense:70, speed:110},
  aipom:{dex:190, name:'Aipom', types:['Normal'], hp:55, attack:70, defense:55, speed:85},
  sunkern:{dex:191, name:'Sunkern', types:['Grass'], hp:30, attack:30, defense:30, speed:30},
  sunflora:{dex:192, name:'Sunflora', types:['Grass'], hp:75, attack:75, defense:55, speed:30},
  yanma:{dex:193, name:'Yanma', types:['Bug','Flying'], hp:65, attack:65, defense:45, speed:95},
  wooper:{dex:194, name:'Wooper', types:['Water','Ground'], hp:55, attack:45, defense:45, speed:15},
  quagsire:{dex:195, name:'Quagsire', types:['Water','Ground'], hp:95, attack:85, defense:85, speed:35},
  espeon:{dex:196, name:'Espeon', types:['Psychic'], hp:65, attack:65, defense:60, speed:110},
  umbreon:{dex:197, name:'Umbreon', types:['Dark'], hp:95, attack:65, defense:110, speed:65},
  murkrow:{dex:198, name:'Murkrow', types:['Dark','Flying'], hp:60, attack:85, defense:42, speed:91},
  slowking:{dex:199, name:'Slowking', types:['Water','Psychic'], hp:95, attack:75, defense:80, speed:30},
  misdreavus:{dex:200, name:'Misdreavus', types:['Ghost'], hp:60, attack:60, defense:60, speed:85},
  unown:{dex:201, name:'Unown', types:['Psychic'], hp:48, attack:72, defense:48, speed:48},
  wobbuffet:{dex:202, name:'Wobbuffet', types:['Psychic'], hp:190, attack:33, defense:58, speed:33},
  girafarig:{dex:203, name:'Girafarig', types:['Normal','Psychic'], hp:70, attack:80, defense:65, speed:85},
  pineco:{dex:204, name:'Pineco', types:['Bug'], hp:50, attack:65, defense:90, speed:15},
  forretress:{dex:205, name:'Forretress', types:['Bug','Steel'], hp:75, attack:90, defense:140, speed:40},
  dunsparce:{dex:206, name:'Dunsparce', types:['Normal'], hp:100, attack:70, defense:70, speed:45},
  gligar:{dex:207, name:'Gligar', types:['Ground','Flying'], hp:65, attack:75, defense:105, speed:85},
  steelix:{dex:208, name:'Steelix', types:['Steel','Ground'], hp:75, attack:85, defense:200, speed:30},
  snubbull:{dex:209, name:'Snubbull', types:['Normal'], hp:60, attack:80, defense:50, speed:30},
  granbull:{dex:210, name:'Granbull', types:['Normal'], hp:90, attack:120, defense:75, speed:45},
  qwilfish:{dex:211, name:'Qwilfish', types:['Water','Poison'], hp:65, attack:95, defense:75, speed:85},
  scizor:{dex:212, name:'Scizor', types:['Bug','Steel'], hp:70, attack:130, defense:100, speed:65},
  shuckle:{dex:213, name:'Shuckle', types:['Bug','Rock'], hp:20, attack:10, defense:230, speed:5},
  heracross:{dex:214, name:'Heracross', types:['Bug','Fighting'], hp:80, attack:125, defense:75, speed:85},
  sneasel:{dex:215, name:'Sneasel', types:['Dark','Ice'], hp:55, attack:95, defense:55, speed:115},
  teddiursa:{dex:216, name:'Teddiursa', types:['Normal'], hp:60, attack:80, defense:50, speed:40},
  ursaring:{dex:217, name:'Ursaring', types:['Normal'], hp:90, attack:130, defense:75, speed:55},
  slugma:{dex:218, name:'Slugma', types:['Fire'], hp:40, attack:40, defense:40, speed:20},
  magcargo:{dex:219, name:'Magcargo', types:['Fire','Rock'], hp:50, attack:50, defense:120, speed:30},
  swinub:{dex:220, name:'Swinub', types:['Ice','Ground'], hp:50, attack:50, defense:40, speed:50},
  piloswine:{dex:221, name:'Piloswine', types:['Ice','Ground'], hp:100, attack:100, defense:80, speed:50},
  corsola:{dex:222, name:'Corsola', types:['Water','Rock'], hp:55, attack:55, defense:85, speed:35},
  remoraid:{dex:223, name:'Remoraid', types:['Water'], hp:35, attack:65, defense:35, speed:65},
  octillery:{dex:224, name:'Octillery', types:['Water'], hp:75, attack:105, defense:75, speed:45},
  delibird:{dex:225, name:'Delibird', types:['Ice','Flying'], hp:45, attack:55, defense:45, speed:75},
  mantine:{dex:226, name:'Mantine', types:['Water','Flying'], hp:65, attack:40, defense:70, speed:70},
  skarmory:{dex:227, name:'Skarmory', types:['Steel','Flying'], hp:65, attack:80, defense:140, speed:70},
  houndour:{dex:228, name:'Houndour', types:['Dark','Fire'], hp:45, attack:60, defense:30, speed:65},
  houndoom:{dex:229, name:'Houndoom', types:['Dark','Fire'], hp:75, attack:90, defense:50, speed:95},
  kingdra:{dex:230, name:'Kingdra', types:['Water','Dragon'], hp:75, attack:95, defense:95, speed:85},
  phanpy:{dex:231, name:'Phanpy', types:['Ground'], hp:90, attack:60, defense:60, speed:40},
  donphan:{dex:232, name:'Donphan', types:['Ground'], hp:90, attack:120, defense:120, speed:50},
  porygon2:{dex:233, name:'Porygon2', types:['Normal'], hp:85, attack:80, defense:90, speed:60},
  stantler:{dex:234, name:'Stantler', types:['Normal'], hp:73, attack:95, defense:62, speed:85},
  smeargle:{dex:235, name:'Smeargle', types:['Normal'], hp:55, attack:20, defense:35, speed:75},
  tyrogue:{dex:236, name:'Tyrogue', types:['Fighting'], hp:35, attack:35, defense:35, speed:35},
  hitmontop:{dex:237, name:'Hitmontop', types:['Fighting'], hp:50, attack:95, defense:95, speed:70},
  smoochum:{dex:238, name:'Smoochum', types:['Ice','Psychic'], hp:45, attack:30, defense:15, speed:65},
  elekid:{dex:239, name:'Elekid', types:['Electric'], hp:45, attack:63, defense:37, speed:95},
  magby:{dex:240, name:'Magby', types:['Fire'], hp:45, attack:75, defense:37, speed:83},
  miltank:{dex:241, name:'Miltank', types:['Normal'], hp:95, attack:80, defense:105, speed:100},
  blissey:{dex:242, name:'Blissey', types:['Normal'], hp:255, attack:10, defense:10, speed:55},
  raikou:{dex:243, name:'Raikou', types:['Electric'], hp:90, attack:85, defense:75, speed:115},
  entei:{dex:244, name:'Entei', types:['Fire'], hp:115, attack:115, defense:85, speed:100},
  suicune:{dex:245, name:'Suicune', types:['Water'], hp:100, attack:75, defense:115, speed:85},
  larvitar:{dex:246, name:'Larvitar', types:['Rock','Ground'], hp:50, attack:64, defense:50, speed:41},
  pupitar:{dex:247, name:'Pupitar', types:['Rock','Ground'], hp:70, attack:84, defense:70, speed:51},
  tyranitar:{dex:248, name:'Tyranitar', types:['Rock','Dark'], hp:100, attack:134, defense:110, speed:61},
  lugia:{dex:249, name:'Lugia', types:['Psychic','Flying'], hp:106, attack:90, defense:130, speed:110},
  hooh:{dex:250, name:'Ho-Oh', types:['Fire','Flying'], hp:106, attack:130, defense:90, speed:90},
  celebi:{dex:251, name:'Celebi', types:['Psychic','Grass'], hp:100, attack:100, defense:100, speed:100}
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
    /* ⚠️ E OS TIPOS DO TERRENO FICAM NA INSTÂNCIA (17/09/2026), em TODO MUNDO -- não só em quem
       ganha o bônus. É o Poder Secreto (TM43) que os lê: o efeito dele depende do terreno, e esta
       é a única porta por onde um terreno entra numa batalha, nos dois motores.
       ⚠️ NA INSTÂNCIA E NÃO EM ESTADO DE MÓDULO, de propósito: uma variável de módulo seria uma
       QUARTA porta de vazamento no servidor (onde a instância é reaproveitada entre invocações),
       e o vazamento do clima foi REAL. Aqui o campo morre com o pokémon.
       ⚠️ E COMEÇA COM `_`: é estado de batalha e não pode ir pro Firestore (o time do save é
       serializado inteiro -- ver limparParaFirestore). */
    p._terreno = terrain.types || [];
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
/* O METRÔNOMO SORTEIA E DEPOIS ESCOLHE (10/09/2026, a pedido). Ele tira um golpe qualquer da
   tabela e o joga na MESMA disputa dos golpes escolhidos do pokémon -- vence o que tira mais dano
   contra quem está na frente. Antes o sorteio era de TIPO e ele saía sempre, o que deixava o
   Poder Ancestral do Togepi (nível 21) sem valer um ponto de dano.
   REUSA O `melhorAtaque` em vez de repetir a conta: é ele que sabe do STAB, do subtipo, do golpe
   de vários tapas, da anulação e do golpe teimoso. Duas contas em paralelo divergiriam no primeiro
   ajuste -- foi o que já aconteceu entre a escolha e o dano quando o EXPOENTE_TIPO era outro em
   cada lugar. A cópia rasa do atacante existe só pra não escrever no `ataques` da instância. */
function tipoDoGolpe(attacker, defender, rng){
  if(!METRONOMO.includes(attacker.speciesId)) return bestAttackType(attacker, defender);
  const sorteado = sorteiaGolpeDoMetronomo(rng);
  const meus = Array.isArray(attacker.ataques) ? attacker.ataques.filter(id => GOLPES[id]) : [];
  const lista = meus.concat(GOLPES[sorteado] ? [sorteado] : []);
  if(lista.length){
    const best = melhorAtaque(Object.assign({}, attacker, { ataques: lista }), defender);
    /* ⚠️ MARCA SE QUEM GANHOU FOI O SORTEADO -- e daqui sai o `mt` do diario, que faz a tela dizer
       "usou Metronomo e atacou com X". So conta quando o sorteado NAO e um dos proprios: caindo no
       mesmo golpe, ele teria sido usado de qualquer jeito. */
    if(best){ best.metronomo = (best.golpe === sorteado && meus.indexOf(sorteado) < 0); return best; }
  }
  /* Rede: sem golpe nenhum (tabela vazia), ele cai no motor de tipo como qualquer outra espécie. */
  return bestAttackType(attacker, defender);
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

/* ===================== OS GOLPES DO POKÉMON =====================
   Cada pokémon carrega até DOIS golpes escolhidos pelo jogador (p.ataques). Quem tem golpe usa a
   escolha; quem NÃO tem cai no motor de sempre -- e isso não é migração preguiçosa, é o desenho:
     - save antigo (todo pokémon que já existe hoje) continua lutando exatamente como lutava, e
     - OITO espécies não aprendem UM ÚNICO golpe de dano por nível em nível nenhum (Kakuna,
       Metapod, Abra, Ditto, Unown, Wobbuffet, Delibird, Smeargle -- o que elas têm é Harden,
       Teleport, Transform, Sketch...). Sem a queda pro motor antigo elas ficariam sem atacar.
   A diferença que o golpe traz é o PODER: hoje todo golpe vale 60 (MOVE_POWER). Com golpe
   escolhido, vale o poder dele -- de 10 (Constrição) a 150 (Hiper Raio). */
function melhorAtaque(attacker, defender){
  const meus = attacker.ataques;
  if(!Array.isArray(meus) || !meus.length) return null;
  let candidatos = meus.filter(id => GOLPES[id]);
  if(!candidatos.length) return null;
  const proprios = tiposProprios(attacker, defender);
  /* DISABLE tira o TIPO, não o golpe -- é como ele já funciona no resto do motor. Quem levou os
     dois golpes do mesmo tipo perde os dois, e aí a anulação simplesmente não vale: a regra da
     casa é que ela só morde quem TEM alternativa. */
  if(attacker._anulado && attacker._anulado.contra === defender){
    const sobra = candidatos.filter(id => GOLPES[id][0] !== attacker._anulado.tipo);
    if(sobra.length) candidatos = sobra;
  }
  /* ⚠️ O COMEDOR DE SONHOS SÓ ENTRA NA LISTA SE O ALVO ESTIVER DORMINDO (ver GOLPES_SO_DORMINDO).
     Quem responde isso é o `_dormeAgora`, marcado pelo doExchange na troca em que o alvo perde o
     turno -- e NÃO o `_dormindoPor`, que é decrementado no COMEÇO da troca: na troca livre ele já
     está em 0 enquanto o pokémon ainda nem atacou, e ler dali faria o golpe nunca sair.
     O FILTRO É INCONDICIONAL, ao contrário do da anulação logo acima: medido, o Comedor de Sonhos
     nunca é o único golpe de dano de ninguém. */
  if(!defender._dormeAgora) candidatos = candidatos.filter(id => !GOLPES_SO_DORMINDO[id]);
  if(!candidatos.length) return null;
  const avalia = (id, multForcado) => {
    /* O `poder` DAQUI VIRA O DANO -- o calcDamageNew lê `best.poder`. Então ele tem que ser o poder
       REAL do golpe, sempre. Quem usa o poder EFETIVO (poder × média de tapas) é só a NOTA, que é a
       comparação entre golpes.
       ISSO JÁ FOI UM DEFEITO, e caro: enquanto o `poder` era o efetivo, cada tapa do Tapa Duplo saía
       com 45 em vez de 15 E ainda batia de 2 a 5 vezes -- ~9× o dano pretendido. Apareceu num log
       de Clefable Lv.42 que matou um Dunsparce de 270 de HP com 3 tapas e um Eevee de 235 com 2,
       enquanto a Folha Mágica dela (poder 60) tirava 88. Reportado em 09/09/2026. */
    /* ⚠️ O ROLAMENTO entra pelos DOIS lados: o `poder` (que vira o dano) e a `nota` (que decide a
       escolha). Só no dano, o motor escolheria um Rolamento de 30 e aplicaria um de 480. */
    const escala = escalaDoRolamento(attacker, id);
    /* ⚠️ A FACHADA entra pelo MESMO lado que o Rolamento: o `poder` (que vira o dano, lá no
       calcDamage) e a `nota` (que decide a escolha). Só no dano, um pokémon queimado deixaria de
       escolher justamente o golpe que a queimadura torna o melhor dele. */
    const tipo = GOLPES[id][0];
    const poder = GOLPES[id][1] * escala * multDaFachada(id, attacker);
    let mult = 1;
    (defender.types || []).forEach(d => { mult *= typeVsType(tipo, d); });
    if(multForcado != null) mult = multForcado;
    const especial = isSpecialType(tipo);
    const proprio = proprios.indexOf(tipo) >= 0;
    const atk = especial ? effectiveSpAtk(attacker) : effectiveAttack(attacker);
    const def = especial ? effectiveSpDef(defender) : effectiveDefense(defender);
    /* A NOTA é o dano relativo: poder × tipo × STAB × (ataque/defesa). É a mesma conta do
       bestAttackType com o poder acrescentado -- e é ela que faz "o que tira mais dano" ser
       escolhido de verdade, e não "o melhor tipo". */
    return { golpe:id, type:tipo, poder:poder, mult:mult, stab:proprio,
             /* A CHUVA ENTRA NA NOTA, e não só no dano: se ela mudasse só o dano, o motor
                escolheria o golpe por uma regra e aplicaria outra -- e sob chuva o Raio Solar
                continuaria sendo escolhido como se valesse 120. É a lição do EXPOENTE_TIPO. */
             /* ⚠️ A NOTA USA O `poderEfetivo(id)`, e não a variável `poder` -- por isso o dobro da
                Fachada tem que ser repetido AQUI. Sem ele a nota ficaria de fora e o motor
                deixaria de escolher a Fachada justamente quando ela vale o dobro. */
             nota: poderEfetivo(id) * escala * multDaFachada(id, attacker) * multDaChuva(tipo, id) * Math.pow(mult, EXPOENTE_TIPO) * (proprio ? 1.5 : SUBTYPE_PENALTY)
                   * (atk / Math.max(1, def)) };
  };
  let melhor = null;
  for(const id of candidatos){ const n = avalia(id); if(!melhor || n.nota > melhor.nota) melhor = n; }
  /* GOLPE TEIMOSO: quando NENHUM golpe dele machuca o alvo, o melhor sai com o multiplicador
     reduzido em vez do piso de 1 de dano. Com tudo zerado as notas empatam em 0, então a escolha
     é refeita -- exatamente como o bestAttackType já fazia pros tipos. */
  if(melhor && melhor.mult === 0){
    let teimoso = null;
    for(const id of candidatos){ const n = avalia(id, IMUNIDADE_TEIMOSA); if(!teimoso || n.nota > teimoso.nota) teimoso = n; }
    if(teimoso){ teimoso.nulo = true; return teimoso; }
  }
  return melhor;
}
/* OS NPCs LUTAM COM O MOVESET DELES (09/09/2026, a pedido).
   ANTES eles caíam no motor de TIPO: atacavam com QUALQUER tipo da espécie e poder implícito de
   60, então um Onix batia com o nome genérico do tipo Pedra -- um golpe que ele não aprende em
   nível nenhum. Foi assim que o jogador viu "ataques que não estão no moveset do pokémon".
   AGORA cada NPC leva TUDO que a espécie aprende por nível até o nível dele, e o motor escolhe o
   que tira mais dano contra quem está na frente -- que é o que o `melhorAtaque` já faz.
   NÃO TEM TETO DE 2 GOLPES, e isso é de propósito: os dois são a regra do JOGADOR, que ESCOLHE.
   O NPC não escolhe nada -- ele tem o que a espécie tem, e é isso que o pedido descreve.
   NUNCA SOBRESCREVE quem já tem golpe: se esta função for chamada por engano sobre um time de
   jogador, ela passa batido. É a mesma guarda do equiparItens.
   ONDE NÃO VALE: batalha online, ligas e ginásio da cidade. Lá o time do outro lado é de um
   JOGADOR (vem de um código, sem golpe), não de um NPC -- e o pedido separou os dois. */
function equiparNpc(time){
  (time || []).forEach(p => {
    if(!p || (Array.isArray(p.ataques) && p.ataques.length)) return;
    const lista = ataquesDisponiveis(p.speciesId, p.level);
    if(lista.length) p.ataques = lista;
  });
  return time;
}
function bestAttackType(attacker, defender){
  /* Tem golpe escolhido? A escolha é entre ELES. Senão, o motor de tipo de sempre, logo abaixo. */
  const doJogador = melhorAtaque(attacker, defender);
  if(doJogador) return doJogador;
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
    /* A CHUVA entra aqui pelo MESMO motivo da nota do melhorAtaque. Sem golpe escolhido não há
       id, então só o tipo conta -- e é o que basta: os dois golpes que ela apaga por nome são de
       Planta, que este caminho nunca escolhe por nome. */
    const nota = multDaChuva(t, null) * Math.pow(mult, EXPOENTE_TIPO) * (proprio ? 1.5 : SUBTYPE_PENALTY) * (atk / Math.max(1, def));
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
/* 1,05. Era 1,01, e a conta não fechava com o preço: 50 pokémon levados ao nível 65 são meses de
   jogo, e o retorno era +1 ponto de ataque num Nidoking nível 60 (92 -> 93). Medido antes da
   mudança, quem conquistava a especialidade ganhava 0,2 ponto de vitória num time misto -- ou seja,
   nada, e os jogadores reclamaram com razão de "não mudou nada".
   Fica ABAIXO do terreno (1,15) e do shiny (1,20) de propósito: a especialidade cobre um TIPO
   inteiro do time, não um pokémon. */
const SPECIALTY_BUFF = 1.05;     // +1% em todos os atributos
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
/* OS ITENS DE ATRIBUTO (+15 num atributo, o confronto inteiro).
   O bônus é FLAT e entra POR ÚLTIMO, depois de shiny, terreno e especialidade -- que são
   multiplicadores. Entrando antes, os multiplicadores o inflariam: +15 num shiny em terreno viraria
   +21, e "+15 de atributo" deixaria de ser 15. Depois, ele é exatamente 15 pra todo mundo.
   Consequência conhecida e aceita: ele vale PROPORCIONALMENTE MAIS pra quem tem o atributo baixo --
   +15 num ataque de 60 é +25%, num de 120 é +12,5%.
   O do HP entra no effectiveBaseHp, então mexe no TETO de vida (calcMaxHp) e também no gen1MaxHp,
   que é o divisor do dano: mais vida também significa tomar uma fração menor por golpe, que é o
   que mais vida tem que significar.
   NÃO tem Velocidade, e ⚠️ a RAZÃO que estava escrita aqui venceu: ela dizia que a velocidade
   alimenta a taxa de crítico, o que deixou de ser verdade em 10/09/2026 (o crítico virou estágio
   da Gen 3 e não olha velocidade). A razão de hoje é outra e é maior: desde 20/09/2026 a
   velocidade decide QUEM ABRE O CONFRONTO e escala com o nível, então um item que a mexesse
   mudaria a ORDEM da troca -- a coisa mais sensível do motor. Não foi pedido. */
const BONUS_DE_ATRIBUTO = 15;
const ITENS_DE_ATRIBUTO = {
  hp_up:    'baseHp',
  atk_up:   'attack',
  def_up:   'defense',
  spatk_up: 'spAtk',
  spdef_up: 'spDef'
};
function withItemStat(v, p, qual){
  return (p.item && ITENS_DE_ATRIBUTO[p.item] === qual) ? v + BONUS_DE_ATRIBUTO : v;
}
/* O ITEM DE ATRIBUTO SOME NO FIM DA BATALHA -- se o pokémon tiver lutado. Ele vale a batalha
   INTEIRA (não é um efeito de um confronto só), então o p.item continua posto até o fim e o que se
   anota aqui é só o RECADO pra quem chamou a batalha tirar da conta.
   Só conta quem ENTROU: um pokémon que ficou no banco e nunca lutou mantém o item, que é o que o
   pedido diz. É a mesma regra da poção -- o item sai quando trabalha.
   A marca evita anotar de novo a cada confronto do mesmo pokémon; ela é zerada pelo equiparItens,
   que roda antes de toda batalha. */
function anotarItemDeAtributo(p, marca){
  if(!p || !p.item || !ITENS_DE_ATRIBUTO[p.item] || p._itemGastoAnotado) return;
  p._itemGastoAnotado = true;
  itensGastos.push({ dono: marca, especie: p.speciesId, slot: p.slotDaConta, item: p.item });
}
function withBuffs(v, p){
  if(p.shiny){ v = Math.round(v * SHINY_BUFF_MULT); }
  if(p.terrainBuffed){ v = Math.round(v * TERRAIN_BUFF_MULT); }
  return v;
}
function effectiveBaseHp(p){
  const v = (typeof p.baseHp==='number') ? p.baseHp : ((SPECIES[p.speciesId]&&SPECIES[p.speciesId].hp)||50);
  return withFuria(withItemStat(withSpecialty(withBuffs(v, p), p), p, 'baseHp'), p);
}
function effectiveAttack(p){
  const v = (typeof p.attack==='number') ? p.attack : ((SPECIES[p.speciesId]&&SPECIES[p.speciesId].attack)||50);
  return withEstagio(withQueimadura(withDanca(withFuria(withItemStat(withSpecialty(withBuffs(v, p), p), p, 'attack'), p), p), p), p, 'atk');
}
function effectiveDefense(p){
  const v = (typeof p.defense==='number') ? p.defense : ((SPECIES[p.speciesId]&&SPECIES[p.speciesId].defense)||50);
  return withEstagio(withFuria(withItemStat(withSpecialty(withBuffs(v, p), p), p, 'defense'), p), p, 'def');
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
  return withEstagio(withFuria(withItemStat(withSpecialty(withBuffs(v, p), p), p, 'spAtk'), p), p, 'spAtk');
}
function effectiveSpDef(p){
  const sp = SPECIES[p.speciesId];
  const v = (typeof p.spDef === 'number') ? p.spDef
          : (sp && typeof sp.spDef === 'number') ? sp.spDef : 50;
  return withEstagio(withFuria(withItemStat(withSpecialty(withBuffs(v, p), p), p, 'spDef'), p), p, 'spDef');
}
/* A FÓRMULA DA GEN 3 -- a cópia do cliente tem a nota inteira; as duas TÊM que ser idênticas. */
function effectiveSpeed(p){
  // instâncias salvas ANTES da velocidade existir não têm o campo -- cai pro valor da espécie
  const base = (typeof p.speed === 'number') ? p.speed : ((SPECIES[p.speciesId] && SPECIES[p.speciesId].speed) || 50);
  /* ⚠️ É O MESMO `statAtLevel` QUE OS OUTROS CINCO ATRIBUTOS JÁ USAVAM no cálculo de dano, e isso
     não é economia de linha: escrita à mão aqui, a fórmula divergiria da deles no primeiro ajuste.
     ⚠️ E É ELE QUE MOSTRA QUE ISTO ERA UMA LACUNA, não uma decisão: o cabeçalho do motor sempre
     disse "o nível entra pelos ATRIBUTOS (2*base*L/100+5, como no jogo real)" -- a velocidade era a
     ÚNICA que nunca passava por ele, porque é a única que não entra numa fórmula de dano. */
  const v = statAtLevel(base, p.level || 1);
  return withEstagio(withParalisia(withFuria(withSpecialty(withBuffs(v, p), p), p), p), p, 'speed');
}
function calcMaxHp(p){ return Math.round(30 + p.level*5 + effectiveBaseHp(p)); }
// HP na escala Gen 1 -- usado só internamente, pra converter o dano em fração da vida
function gen1MaxHp(p){ return Math.floor(2 * effectiveBaseHp(p) * p.level / 100) + p.level + 10; }
/* GOLPES (id -> [tipo, poder]) -- a SEXTA tabela duplicada. A cópia do index.html tem que ser
   IDÊNTICA a esta: o dano roda dos dois lados, e divergir aqui é a mesma batalha com resultado
   diferente no cliente e no servidor. tools/test-golpes.js compara as duas.
   O nome em português e o aprendizado por nível NÃO vêm pra cá: nome é apresentação, e o servidor
   nunca precisa saber quem aprende o quê -- os golpes escolhidos viajam na instância. */
/* ⚠️ O `cut` (o HM01) NASCE AQUI, escrito à mão, e é o único da tabela que não veio do gerador: a
   base é aprendizado por NÍVEL e HM ninguém aprende por nível (isso já estava previsto por escrito
   na seção da base de golpes). Poder 50, Normal -- os valores reais da Gen 1/2/3.
   ⚠️ ELE NÃO ENTRA NO `GOLPES_IDS`, e isso é de propósito: aquele array é indexado pelo
   `APRENDIZADO` (as entradas são `[nivel, indice]`), então inserir um id no meio deslocaria TODOS
   os índices seguintes e trocaria o moveset das 250 espécies em silêncio. O `cut` não precisa dele:
   ninguém o aprende por nível, e o campo `ataques` de um pokémon guarda o id em TEXTO.
   ⚠️ MAS ELES ENTRAM NO BOLO DO METRÔNOMO (`POOL_METRONOMO` é derivado do `GOLPES`), que foi de
   155 pra 156 com o `cut` e pra 157 com o `surf`. Isso desloca a semente do sorteio -- esperado,
   e é o preço de o Metrônomo sortear "qualquer poder existente no jogo", que é o que ele promete.
   ⚠️ SÃO DOIS À MÃO DESDE 15/09/2026, e o segundo é o `surf` (HM03). Os valores saem do MESMO
   caminho do resto da base -- o `moves.json` do Showdown com a cadeia de mods 8→3 -- e ela importa:
   o Surf moderno é poder 90, e o mod da **gen5** devolve os **95** que valiam na Gen 3. Lido do
   arquivo moderno ele entraria 5 pontos fraco.
   (Conferido pelo mesmo método: o `cut` sai Normal 50, exatamente o que já estava aqui.) */
/* ⚠️ OS GOLPES DE TM (17/09/2026): os SEIS que a base por NÍVEL nunca viu, porque ninguém os
   aprende por nível -- eles vêm de MÁQUINA, exatamente como o `cut`, o `surf` e o `fly`. Os outros
   17 TMs do jogo já estavam na tabela (alguém os aprende por nível também).
   ⚠️ A GERAÇÃO IMPORTA EM TRÊS DELES, e lida do arquivo moderno a tabela sairia errada:
   Rock Tomb é 60 hoje e era **50** na Gen 3; Thief é 60 hoje e era **40**; Overheat é 130 hoje e
   era **140**. O caminho é o mesmo do resto da base -- o moves.json do Showdown com a cadeia de
   mods 8→3 -- e ele devolve os valores da Gen 3.
   ⚠️ E ELES DESLOCAM A SEMENTE DO METRÔNOMO (`POOL_METRONOMO` é derivado do `GOLPES`): 158 → 164.
   É o preço conhecido de ele sortear "qualquer poder existente no jogo". */
const GOLPES = {
  dragonclaw: ['Dragon', 80],
  rocktomb: ['Rock', 50],
  facade: ['Normal', 70],
  secretpower: ['Normal', 70],
  thief: ['Dark', 40],
  overheat: ['Fire', 140],
  cut: ['Normal', 50],
  surf: ['Water', 95],
  fly: ['Flying', 70],
  absorb:['Grass',20],acid:['Poison',40],aerialace:['Flying',60],aeroblast:['Flying',100],
  aircutter:['Flying',55],ancientpower:['Rock',60],astonish:['Ghost',30],aurorabeam:['Ice',65],
  barrage:['Normal',15],beatup:['Dark',10],bind:['Normal',15],bite:['Dark',60],
  blizzard:['Ice',120],bodyslam:['Normal',85],boneclub:['Ground',65],bonemerang:['Ground',50],
  bonerush:['Ground',25],bounce:['Flying',85],brickbreak:['Fighting',75],bubble:['Water',20],
  bubblebeam:['Water',65],bulletseed:['Grass',10],clamp:['Water',35],cometpunch:['Normal',18],
  confusion:['Psychic',50],constrict:['Normal',10],covet:['Normal',40],crabhammer:['Water',90],
  crosschop:['Fighting',100],crunch:['Dark',80],dig:['Ground',60],dive:['Water',60],
  dizzypunch:['Normal',70],doubleedge:['Normal',120],doublekick:['Fighting',30],
  doubleslap:['Normal',15],dragonbreath:['Dragon',60],dreameater:['Psychic',100],
  drillpeck:['Flying',80],dynamicpunch:['Fighting',100],earthquake:['Ground',100],
  eggbomb:['Normal',100],ember:['Fire',40],extremespeed:['Normal',80],fakeout:['Normal',40],
  falseswipe:['Normal',40],feintattack:['Dark',60],fireblast:['Fire',120],firepunch:['Fire',75],
  firespin:['Fire',15],flamethrower:['Fire',95],flamewheel:['Fire',60],furyattack:['Normal',15],
  furycutter:['Bug',10],furyswipes:['Normal',18],futuresight:['Psychic',80],gigadrain:['Grass',60],
  gust:['Flying',40],headbutt:['Normal',70],heatwave:['Fire',100],highjumpkick:['Fighting',85],
  hornattack:['Normal',65],hydropump:['Water',120],hyperbeam:['Normal',150],
  hyperfang:['Normal',80],hypervoice:['Normal',90],iceball:['Ice',30],icebeam:['Ice',95],
  icepunch:['Ice',75],iciclespear:['Ice',10],icywind:['Ice',55],irontail:['Steel',100],
  jumpkick:['Fighting',70],karatechop:['Fighting',50],knockoff:['Dark',20],leechlife:['Bug',20],
  lick:['Ghost',20],machpunch:['Fighting',40],magicalleaf:['Grass',60],megadrain:['Grass',40],
  megahorn:['Bug',120],megakick:['Normal',120],megapunch:['Normal',80],metalclaw:['Steel',50],
  meteormash:['Steel',100],mudshot:['Ground',55],mudslap:['Ground',20],octazooka:['Water',65],
  outrage:['Dragon',90],payday:['Normal',40],peck:['Flying',35],petaldance:['Grass',70],
  pinmissile:['Bug',14],poisonfang:['Poison',50],poisonsting:['Poison',15],pound:['Normal',40],
  powdersnow:['Ice',40],psybeam:['Psychic',65],psychic:['Psychic',90],pursuit:['Dark',40],
  quickattack:['Normal',40],rage:['Normal',20],rapidspin:['Normal',20],razorleaf:['Grass',55],
  revenge:['Fighting',60],rockblast:['Rock',25],rockslide:['Rock',75],rockthrow:['Rock',50],
  rollingkick:['Fighting',60],rollout:['Rock',30],sacredfire:['Fire',100],sandtomb:['Ground',15],
  scratch:['Normal',40],shadowball:['Ghost',80],shadowpunch:['Ghost',60],signalbeam:['Bug',75],
  silverwind:['Bug',60],skullbash:['Normal',100],skyattack:['Flying',140],
  skyuppercut:['Fighting',85],slam:['Normal',80],slash:['Normal',70],sludge:['Poison',65],
  sludgebomb:['Poison',90],smog:['Poison',20],snore:['Normal',40],solarbeam:['Grass',120],
  spark:['Electric',65],spikecannon:['Normal',20],steelwing:['Steel',70],stomp:['Normal',65],
  submission:['Fighting',80],superpower:['Fighting',120],swift:['Normal',60],tackle:['Normal',35],
  takedown:['Normal',90],thrash:['Normal',90],thunder:['Electric',120],thunderbolt:['Electric',95],
  thunderpunch:['Electric',75],thundershock:['Electric',40],triattack:['Normal',80],
  triplekick:['Fighting',10],twineedle:['Bug',25],twister:['Dragon',40],uproar:['Normal',50],
  vinewhip:['Grass',35],visegrip:['Normal',55],vitalthrow:['Fighting',70],waterfall:['Water',80],
  watergun:['Water',40],waterpulse:['Water',60],wingattack:['Flying',60],wrap:['Normal',15],
  zapcannon:['Electric',100]
};
/* GOLPES_IDS e APRENDIZADO CHEGARAM AO SERVIDOR em 09/09/2026, e este arquivo dizia que eles
   nunca precisariam vir: "o servidor nunca precisa saber quem aprende o quê, porque os golpes
   escolhidos viajam na instância". Isso valia enquanto só o JOGADOR tinha golpe.
   Mudou quando os NPCs passaram a lutar com o moveset deles (ver equiparNpc): o time do treinador
   da Torre é montado AQUI, do zero, e sem a tabela ele não teria como saber o que a espécie
   aprende. São 15,5 KB num arquivo de 430 -- barato, e é o preço de a Torre não ser a única
   batalha em que o NPC ataca com golpe que ele não tem.
   AS DUAS SÃO GERADAS por tools/gerar-tabelas-golpes.js e agora são DUPLICADAS: mexer numa e
   esquecer a outra faz a mesma batalha sair diferente no cliente e no servidor. O teste compara. */
const GOLPES_IDS = ['absorb','acid','aerialace','aeroblast','aircutter','ancientpower','astonish','aurorabeam','barrage','beatup','bind','bite','blizzard','bodyslam','boneclub','bonemerang','bonerush','bounce','brickbreak','bubble','bubblebeam','bulletseed','clamp','cometpunch','confusion','constrict','covet','crabhammer','crosschop','crunch','dig','dive','dizzypunch','doubleedge','doublekick','doubleslap','dragonbreath','dreameater','drillpeck','dynamicpunch','earthquake','eggbomb','ember','extremespeed','fakeout','falseswipe','feintattack','fireblast','firepunch','firespin','flamethrower','flamewheel','furyattack','furycutter','furyswipes','futuresight','gigadrain','gust','headbutt','heatwave','highjumpkick','hornattack','hydropump','hyperbeam','hyperfang','hypervoice','iceball','icebeam','icepunch','iciclespear','icywind','irontail','jumpkick','karatechop','knockoff','leechlife','lick','machpunch','magicalleaf','megadrain','megahorn','megakick','megapunch','metalclaw','meteormash','mudshot','mudslap','octazooka','outrage','payday','peck','petaldance','pinmissile','poisonfang','poisonsting','pound','powdersnow','psybeam','psychic','pursuit','quickattack','rage','rapidspin','razorleaf','revenge','rockblast','rockslide','rockthrow','rollingkick','rollout','sacredfire','sandtomb','scratch','shadowball','shadowpunch','signalbeam','silverwind','skullbash','skyattack','skyuppercut','slam','slash','sludge','sludgebomb','smog','snore','solarbeam','spark','spikecannon','steelwing','stomp','submission','superpower','swift','tackle','takedown','thrash','thunder','thunderbolt','thunderpunch','thundershock','triattack','triplekick','twineedle','twister','uproar','vinewhip','visegrip','vitalthrow','waterfall','watergun','waterpulse','wingattack','wrap','zapcannon'];
const GOLPES_PT = {
  absorb:'Absorver',acid:'Ácido',aerialace:'Ás Aéreo',aeroblast:'Aerojato',aircutter:'Corte de Ar',
  ancientpower:'Poder Ancestral',astonish:'Espanto',aurorabeam:'Raio Aurora',barrage:'Barragem',
  beatup:'Surra',bind:'Amarrar',bite:'Mordida',blizzard:'Nevasca',bodyslam:'Golpe de Corpo',
  boneclub:'Clava de Osso',bonemerang:'Ossomerangue',bonerush:'Investida de Ossos',bounce:'Salto',
  brickbreak:'Quebra-Telha',bubble:'Bolha',bubblebeam:'Raio de Bolhas',bulletseed:'Semente-Bala',
  clamp:'Mordaça',cometpunch:'Soco Cometa',confusion:'Confusão',constrict:'Constrição',
  covet:'Cobiça',crabhammer:'Martelo de Caranguejo',crosschop:'Golpe Cruzado',crunch:'Triturar',
  dig:'Escavar',dive:'Mergulho',dizzypunch:'Soco Tonto',doubleedge:'Investida Dupla',
  doublekick:'Chute Duplo',doubleslap:'Tapa Duplo',dragonbreath:'Sopro do Dragão',
  dreameater:'Comedor de Sonhos',drillpeck:'Bicada Broca',dynamicpunch:'Soco Dinâmico',
  earthquake:'Terremoto',eggbomb:'Bomba de Ovo',ember:'Brasa',extremespeed:'Velocidade Extrema',
  fakeout:'Finta',falseswipe:'Golpe Falso',feintattack:'Ataque Fingido',
  fireblast:'Explosão de Fogo',firepunch:'Soco de Fogo',firespin:'Redemoinho de Fogo',
  flamethrower:'Lança-Chamas',flamewheel:'Roda de Fogo',furyattack:'Ataque Fúria',
  furycutter:'Cortador Furioso',furyswipes:'Arranhões Furiosos',futuresight:'Visão do Futuro',
  gigadrain:'Giga Dreno',gust:'Rajada de Vento',headbutt:'Cabeçada',heatwave:'Onda de Calor',
  highjumpkick:'Joelhaço Voador',hornattack:'Chifrada',hydropump:'Hidro Bomba',
  hyperbeam:'Hiper Raio',hyperfang:'Presa Hiper',hypervoice:'Hipervoz',iceball:'Bola de Gelo',
  icebeam:'Raio Congelante',icepunch:'Soco de Gelo',iciclespear:'Lança de Gelo',
  icywind:'Vento Gélido',irontail:'Cauda de Ferro',jumpkick:'Chute Voador',
  karatechop:'Golpe de Karatê',knockoff:'Nocaute',leechlife:'Sanguessuga',lick:'Lambida',
  machpunch:'Soco Veloz',magicalleaf:'Folha Mágica',megadrain:'Mega Dreno',megahorn:'Megachifre',
  megakick:'Mega Chute',megapunch:'Mega Soco',metalclaw:'Garra de Metal',
  meteormash:'Golpe Meteoro',mudshot:'Tiro de Lama',mudslap:'Tapa de Lama',octazooka:'Octabazuca',
  outrage:'Ultraje',payday:'Dia de Pagamento',peck:'Bicada',petaldance:'Dança das Pétalas',
  pinmissile:'Míssil Agulha',poisonfang:'Presa Venenosa',poisonsting:'Ferrão Venenoso',
  pound:'Pancada',powdersnow:'Pó de Neve',psybeam:'Psicoraio',psychic:'Psíquico',
  pursuit:'Perseguição',quickattack:'Ataque Rápido',rage:'Fúria',rapidspin:'Giro Rápido',
  razorleaf:'Folha Navalha',revenge:'Vingança',rockblast:'Rajada de Rochas',
  rockslide:'Deslizamento de Rochas',rockthrow:'Lançar Pedra',rollingkick:'Chute Giratório',
  rollout:'Rolamento',sacredfire:'Fogo Sagrado',sandtomb:'Tumba de Areia',scratch:'Arranhão',
  shadowball:'Bola Sombria',shadowpunch:'Soco Sombrio',signalbeam:'Feixe de Sinal',
  silverwind:'Vento Prateado',skullbash:'Quebra-Crânio',skyattack:'Ataque Celeste',
  dragonclaw:'Garra do Dragão',rocktomb:'Tumba de Rochas',facade:'Fachada',secretpower:'Poder Secreto',thief:'Ladrão',overheat:'Superaquecer',skyuppercut:'Cruzado Celeste',slam:'Batida',slash:'Talho',cut:'Corte',surf:'Surf',fly:'Voar',sludge:'Lodo',
  sludgebomb:'Bomba de Lodo',smog:'Fumaça Tóxica',snore:'Ronco',solarbeam:'Raio Solar',
  spark:'Faísca',spikecannon:'Canhão de Espinhos',steelwing:'Asa de Aço',stomp:'Pisão',
  submission:'Submissão',superpower:'Superpoder',swift:'Rapidez',tackle:'Investida',
  takedown:'Derrubada',thrash:'Pancadaria',thunder:'Trovão',thunderbolt:'Raio',
  thunderpunch:'Soco Trovão',thundershock:'Choque do Trovão',triattack:'Triataque',
  triplekick:'Chute Triplo',twineedle:'Agulha Dupla',twister:'Tornado',uproar:'Alvoroço',
  vinewhip:'Chicote de Cipó',visegrip:'Torno',vitalthrow:'Arremesso Vital',waterfall:'Cachoeira',
  watergun:'Jato d\'Água',waterpulse:'Pulso de Água',wingattack:'Ataque de Asa',wrap:'Enrolar',
  zapcannon:'Canhão de Choque'
};
const APRENDIZADO = {
  bulbasaur:[[1,134],[10,146],[20,103],[46,123],[46,126]],
  charmander:[[1,112],[7,42],[13,83],[19,101],[31,50],[37,121],[49,49]],
  squirtle:[[1,134],[7,19],[13,150],[18,11],[23,102],[40,117],[47,62]],weedle:[[1,94],[7,92]],
  caterpie:[[1,134],[13,143]],ratata:[[1,134],[7,100],[13,64],[27,99]],pidgey:[[1,134],[9,57],[13,100],[25,152]],
  mankey:[[1,112],[11,73],[16,54],[31,28],[46,136]],spearow:[[1,90],[13,52],[19,99],[25,2],[37,38]],
  nidoranm:[[1,90],[12,34],[17,94],[20,61],[30,52]],oddish:[[1,0],[23,1],[39,91]],
  geodude:[[1,134],[11,107],[26,109],[31,105],[36,40],[46,33]],
  onix:[[1,134],[8,10],[12,107],[23,101],[30,36],[37,120],[45,71],[49,111],[56,33]],
  ivysaur:[[1,134],[10,146],[22,103],[56,123],[56,126]],venusaur:[[1,134],[1,146],[22,103],[65,123],[65,126]],
  charmeleon:[[1,42],[1,112],[13,83],[20,101],[34,50],[41,121],[55,49]],
  charizard:[[1,42],[1,59],[1,83],[1,112],[20,101],[34,50],[36,152],[44,121],[64,49]],
  wartortle:[[1,19],[1,134],[13,150],[19,11],[25,102],[45,117],[53,62]],
  blastoise:[[1,19],[1,134],[13,150],[19,11],[25,102],[55,117],[68,62]],kakuna:[[13,143],[20,1]],
  beedrill:[[1,52],[20,143],[25,101],[30,99],[35,92],[45,123]],metapod:[[13,143]],
  butterfree:[[1,24],[28,57],[34,97],[47,116]],raticate:[[1,100],[1,134],[13,64],[30,99]],
  pidgeotto:[[1,57],[1,134],[13,100],[27,152]],pidgeot:[[1,57],[1,100],[1,134],[27,152]],
  primeape:[[1,101],[1,112],[11,73],[16,54],[35,28],[62,136]],fearow:[[1,52],[1,90],[26,99],[40,38]],
  nidorino:[[1,90],[12,34],[18,94],[22,61],[34,52]],gloom:[[1,0],[24,1],[44,91]],
  sandshrew:[[1,112],[17,94],[23,121],[30,133],[37,54],[45,111]],
  sandslash:[[1,112],[17,94],[24,121],[33,133],[42,54],[52,111]],clefairy:[[1,95],[13,35],[45,84]],
  jigglypuff:[[9,95],[19,109],[24,35],[34,13],[44,65],[49,33]],
  zubat:[[1,75],[6,6],[16,11],[21,152],[31,4],[41,93]],golbat:[[1,6],[1,75],[16,11],[21,152],[35,4],[49,93]],
  paras:[[1,112],[19,75],[31,121],[43,56]],parasect:[[1,112],[19,75],[35,121],[51,56]],
  meowth:[[1,112],[10,11],[18,89],[25,46],[36,54],[40,121],[43,44]],
  persian:[[1,11],[1,112],[18,89],[25,46],[42,54],[49,121],[55,44]],
  bellsprout:[[1,146],[11,153],[23,1],[37,103],[45,120]],weepinbell:[[1,146],[1,153],[24,1],[42,103],[54,120]],
  abra:[[45,98]],kadabra:[[1,24],[21,97],[30,55],[36,98]],
  staryu:[[1,134],[6,150],[10,102],[24,133],[28,20],[46,62]],starmie:[[1,102],[1,133],[1,150],[45,98]],
  growlithe:[[1,11],[7,42],[25,135],[31,51],[49,50]],vulpix:[[1,42],[13,100],[29,50],[41,49]],
  ekans:[[1,153],[8,94],[13,11],[32,1]],arbok:[[1,11],[1,94],[1,153],[38,1]],
  diglett:[[1,112],[17,30],[21,54],[25,86],[33,121],[41,40]],
  dugtrio:[[1,112],[1,141],[17,30],[21,54],[25,86],[26,111],[38,121],[51,40]],
  magnemite:[[1,134],[6,140],[26,127],[38,133],[50,154]],magneton:[[1,134],[1,140],[26,127],[44,141],[62,154]],
  drowzee:[[1,95],[11,24],[17,58],[31,98],[45,55]],hypno:[[1,24],[1,95],[17,58],[35,98],[57,55]],
  nidoranf:[[1,112],[12,34],[17,94],[20,11],[30,54],[47,29]],
  nidorina:[[1,112],[12,34],[18,94],[22,11],[34,54],[53,29]],
  venonat:[[1,134],[17,24],[25,75],[33,97],[41,98],[45,123]],
  venomoth:[[1,116],[1,134],[17,24],[25,75],[31,57],[36,97],[52,98],[52,123]],
  voltorb:[[1,134],[21,127],[32,109],[42,133]],pikachu:[[1,140],[11,100],[20,120],[26,138],[41,137]],
  raichu:[[1,100],[1,138],[1,140]],poliwag:[[1,19],[13,150],[19,35],[31,13],[43,62]],
  poliwhirl:[[1,19],[1,150],[19,35],[35,13],[51,62]],tentacool:[[1,94],[12,25],[19,1],[25,20],[30,153],[49,62]],
  tentacruel:[[1,25],[1,94],[19,1],[25,20],[30,153],[55,62]],
  machop:[[13,73],[25,104],[31,148],[37,131],[40,28],[49,39]],
  machoke:[[13,73],[25,104],[33,148],[41,131],[46,28],[59,39]],
  doduo:[[1,90],[9,99],[13,52],[21,141],[25,101],[33,145],[37,38]],
  dodrio:[[1,52],[1,90],[1,99],[21,141],[25,101],[38,145],[47,38]],
  ponyta:[[1,100],[1,134],[14,42],[19,130],[25,49],[31,135],[45,17],[53,47]],
  rapidash:[[1,42],[1,100],[1,134],[19,130],[25,49],[31,135],[40,52],[50,17],[63,47]],
  slowpoke:[[1,134],[13,150],[17,24],[29,58],[40,98]],slowbro:[[1,134],[13,150],[17,24],[29,58],[44,98]],
  magikarp:[[15,134],[18,22]],gyarados:[[1,136],[20,11],[35,144],[40,62],[43,17],[55,63]],
  grimer:[[1,95],[13,122],[43,123]],muk:[[1,95],[13,122],[47,123]],
  tauros:[[1,134],[4,101],[8,61],[19,99],[43,136],[53,135]],psyduck:[[1,112],[16,24],[40,54],[50,62]],
  golduck:[[1,112],[16,24],[44,54],[58,62]],krabby:[[1,19],[12,147],[23,85],[27,130],[45,27]],
  kingler:[[1,19],[1,83],[1,147],[23,85],[27,130],[57,27]],horsea:[[1,19],[22,150],[29,144],[43,62]],
  seadra:[[1,19],[1,150],[29,144],[51,62]],goldeen:[[1,90],[15,61],[29,52],[38,149],[57,80]],
  seaking:[[1,90],[15,61],[29,52],[41,149],[69,80]],shellder:[[1,134],[8,69],[17,7],[41,22],[49,67]],
  exeggcute:[[1,8],[1,145],[19,24],[43,126]],
  cubone:[[9,14],[13,58],[25,15],[29,101],[33,45],[37,136],[41,16],[45,33]],
  marowak:[[1,14],[1,58],[25,15],[32,101],[39,45],[46,136],[53,16],[61,33]],
  victreebel:[[1,103],[1,146],[45,123]],tangela:[[1,25],[10,0],[22,146],[28,10],[31,79],[40,120]],
  vileplume:[[1,0],[1,79],[44,91],[45,123]],koffing:[[1,134],[9,124],[21,122]],
  weezing:[[1,124],[1,134],[21,122]],gastly:[[1,76],[28,37],[36,113],[45,123]],
  haunter:[[1,76],[25,114],[31,37],[45,113],[45,123]],lickitung:[[1,76],[18,74],[23,130],[29,153],[40,120]],
  rhyhorn:[[1,61],[10,130],[15,52],[29,105],[43,135],[52,40],[57,80]],
  rhydon:[[1,52],[1,61],[1,130],[29,105],[46,135],[58,40],[66,80]],
  seel:[[1,58],[17,70],[21,7],[30,31],[37,135],[41,67]],
  dewgong:[[1,7],[1,58],[1,70],[1,115],[40,149],[42,135],[51,67]],
  farfetchd:[[1,90],[16,52],[21,74],[26,53],[41,121],[46,45]],
  kangaskhan:[[1,23],[7,11],[19,44],[25,82],[31,101],[43,32]],
  scyther:[[1,100],[11,99],[16,45],[26,152],[31,121],[46,53]],
  omanyte:[[1,25],[13,11],[19,150],[25,85],[49,5],[55,62]],
  omastar:[[1,11],[1,25],[1,150],[25,85],[40,128],[55,5],[65,62]],
  kabuto:[[1,112],[13,0],[25,85],[49,79],[55,5],[55,151]],
  kabutops:[[1,0],[1,53],[1,112],[25,85],[40,121],[55,79],[65,5],[65,31]],
  electrode:[[1,134],[21,127],[34,109],[48,133]],magmar:[[1,42],[1,48],[1,124],[41,50],[57,47]],
  lapras:[[1,150],[13,13],[31,67],[49,62]],porygon:[[1,134],[12,97],[36,141],[48,154]],
  eevee:[[1,134],[23,100],[30,11],[42,135]],snorlax:[[1,134],[17,58],[28,125],[33,13],[42,26],[46,109],[51,63]],
  chansey:[[1,95],[17,35],[35,41],[57,33]],hitmonlee:[[1,34],[1,104],[11,108],[16,72],[20,18],[26,60],[46,81]],
  hitmonchan:[[1,23],[1,104],[13,99],[20,77],[26,48],[26,68],[26,139],[32,119],[38,82]],
  pinsir:[[1,147],[7,10],[7,53],[25,104],[31,18],[43,131]],
  electabuzz:[[1,100],[1,139],[25,133],[47,138],[58,137]],aerodactyl:[[1,152],[15,11],[29,5],[43,135],[50,63]],
  alakazam:[[1,24],[21,97],[30,55],[36,98]],mrmime:[[5,24],[15,35],[22,78],[29,97],[43,98]],
  arcanine:[[1,11],[1,42],[49,43]],nidoqueen:[[1,34],[1,94],[1,112],[10,86],[22,13],[43,132]],
  nidoking:[[1,34],[1,90],[1,94],[10,86],[22,136],[43,80]],
  graveler:[[1,107],[1,134],[29,109],[37,105],[45,40],[62,33]],
  dratini:[[1,153],[15,144],[29,120],[50,88],[57,63]],dragonair:[[1,144],[1,153],[29,120],[56,88],[65,63]],
  dragonite:[[1,144],[1,153],[29,120],[55,152],[61,88],[75,63]],
  jynx:[[1,76],[1,95],[1,96],[21,35],[25,68],[51,13],[51,98],[67,12]],
  exeggutor:[[1,8],[1,24],[19,130],[30,56],[31,41]],clefable:[[1,35]],wigglytuff:[[1,35]],
  ninetales:[[1,42],[1,100],[45,49]],poliwrath:[[1,35],[1,131],[1,150]],cloyster:[[1,7],[30,31],[41,128]],
  machamp:[[13,73],[25,104],[33,148],[41,131],[46,28],[59,39]],
  golem:[[1,107],[1,134],[29,109],[37,105],[45,40],[62,33]],gengar:[[1,76],[25,114],[31,37],[45,113],[45,123]],
  moltres:[[1,42],[1,152],[13,49],[49,50],[73,59],[85,118]],zapdos:[[1,90],[1,140],[49,38],[85,137]],
  articuno:[[1,57],[1,96],[49,67],[73,12]],vaporeon:[[1,134],[16,150],[23,100],[30,11],[36,7],[52,62]],
  jolteon:[[1,134],[16,140],[23,100],[30,34],[36,92],[52,137]],
  flareon:[[1,134],[16,42],[23,100],[30,11],[36,49],[42,124],[52,50]],mewtwo:[[1,24],[22,133],[44,55],[66,98]],
  chikorita:[[1,134],[8,103],[29,13],[50,126]],bayleef:[[1,103],[1,134],[31,13],[55,126]],
  meganium:[[1,103],[1,134],[31,13],[61,126]],cyndaquil:[[1,134],[12,42],[19,100],[27,51],[36,133],[46,50]],
  quilava:[[1,134],[12,42],[21,100],[31,51],[42,133],[54,50]],
  typhlosion:[[1,42],[1,134],[21,100],[31,51],[45,133],[60,50]],
  totodile:[[1,112],[7,101],[13,150],[20,11],[35,121],[52,62]],
  croconaw:[[1,101],[1,112],[13,150],[21,11],[37,121],[55,62]],
  feraligatr:[[1,101],[1,112],[1,150],[21,11],[38,121],[58,62]],sentret:[[1,112],[7,100],[12,54],[24,120]],
  furret:[[1,100],[1,112],[12,54],[28,120]],hoothoot:[[1,134],[11,90],[28,135],[34,24],[48,37]],
  noctowl:[[1,90],[1,134],[33,135],[41,24],[57,37]],ledyba:[[1,134],[15,23],[36,2],[36,116],[36,133],[50,33]],
  ledian:[[1,134],[15,23],[42,2],[42,116],[42,133],[60,33]],spinarak:[[1,94],[11,25],[23,75],[30,54],[53,98]],
  ariados:[[1,25],[1,94],[25,75],[34,54],[63,98]],crobat:[[1,6],[1,75],[16,11],[21,152],[35,4],[49,93]],
  chinchou:[[1,19],[17,150],[25,127],[37,135],[41,62]],lanturn:[[1,19],[17,150],[25,127],[43,135],[50,62]],
  pichu:[[1,140]],cleffa:[[1,95],[17,78]],igglybuff:[[9,95]],togepi:[[21,5],[37,33]],
  togetic:[[1,78],[21,5],[30,2],[37,33]],natu:[[1,90],[30,55],[50,98]],xatu:[[1,90],[35,55],[65,98]],
  mareep:[[1,134],[9,140],[37,137]],flaaffy:[[1,134],[1,140],[45,137]],
  ampharos:[[1,134],[1,140],[30,139],[57,137]],bellossom:[[1,0],[1,78],[44,91],[55,126]],
  marill:[[1,134],[10,150],[15,109],[21,20],[28,33],[45,62]],
  azumarill:[[1,134],[1,150],[15,109],[24,20],[34,33],[57,62]],
  sudowoodo:[[1,107],[25,106],[41,46],[49,120],[57,33]],politoed:[[1,35],[1,150]],
  hoppip:[[10,134],[30,2],[30,79]],skiploom:[[1,134],[36,2],[36,79]],jumpluff:[[1,134],[44,2],[44,79]],
  aipom:[[1,112],[13,6],[31,54],[38,133]],sunkern:[[1,0],[13,79],[42,56]],
  sunflora:[[1,0],[1,95],[13,103],[25,21],[37,91],[42,126]],yanma:[[1,134],[6,100],[34,145],[39,116],[39,152]],
  wooper:[[1,150],[11,120],[16,85],[36,40]],quagsire:[[1,150],[11,120],[16,85],[42,40]],
  espeon:[[1,134],[16,24],[23,100],[30,133],[36,97],[47,98]],umbreon:[[1,134],[16,99],[23,100],[36,46]],
  murkrow:[[1,90],[9,6],[14,99],[35,46]],slowking:[[1,134],[13,150],[17,24],[29,58],[40,98]],
  misdreavus:[[11,6],[30,97]],unown:[[25,24]],wobbuffet:[[25,24]],
  girafarig:[[1,134],[7,6],[13,24],[19,130],[43,97],[49,29]],pineco:[[1,134],[15,135],[22,92],[22,102],[50,33]],
  forretress:[[1,134],[15,135],[22,102],[31,154],[50,71],[59,33],[59,80]],
  dunsparce:[[1,101],[21,109],[24,99],[34,135]],gligar:[[1,94],[20,100],[28,46],[30,2],[30,30],[36,121]],
  steelix:[[1,134],[8,10],[12,107],[23,101],[30,30],[30,36],[37,120],[45,71],[49,29],[56,33]],
  snubbull:[[1,134],[13,11],[19,76],[34,101],[43,135],[53,29]],
  granbull:[[1,134],[13,11],[19,76],[38,101],[49,135],[61,29]],
  qwilfish:[[1,94],[1,134],[13,150],[21,92],[25,104],[33,135],[37,62]],
  scizor:[[1,100],[11,99],[16,45],[26,83],[31,121],[46,53]],shuckle:[[1,25],[9,92],[9,153],[37,109]],
  heracross:[[1,134],[6,61],[17,52],[23,18],[37,135],[53,80]],
  sneasel:[[1,112],[8,100],[22,46],[29,54],[43,70],[50,121],[57,9],[64,83]],
  teddiursa:[[1,112],[7,76],[13,54],[25,46],[37,121],[43,125],[49,136]],
  ursaring:[[1,54],[1,76],[1,112],[25,46],[37,121],[43,125],[49,136]],
  slugma:[[1,124],[8,42],[15,107],[36,50],[43,106],[50,13]],
  magcargo:[[1,42],[1,107],[1,124],[36,50],[48,106],[60,13]],swinub:[[1,134],[10,96],[28,135],[46,12],[50,40]],
  piloswine:[[1,61],[1,96],[28,135],[30,30],[33,52],[56,12]],
  corsola:[[1,134],[12,19],[23,20],[28,128],[34,105],[45,5]],
  remoraid:[[1,150],[22,7],[22,20],[22,97],[44,67],[55,63]],
  octillery:[[1,150],[11,25],[22,7],[22,20],[22,97],[25,87],[54,67],[70,63]],delibird:[[15,66],[30,2]],
  mantine:[[1,19],[1,134],[15,20],[22,135],[36,152],[43,151]],skarmory:[[1,90],[13,133],[26,52],[29,4],[32,129]],
  houndour:[[1,42],[13,124],[25,11],[37,46],[43,50],[49,29]],
  houndoom:[[1,42],[13,124],[27,11],[43,46],[51,50],[59,29]],kingdra:[[1,19],[1,150],[29,144],[51,62]],
  phanpy:[[1,134],[25,135],[33,109],[49,33],[50,40]],donphan:[[1,61],[25,52],[33,109],[41,102],[49,40]],
  porygon2:[[1,134],[12,97],[36,141],[48,154]],stantler:[[1,134],[11,6],[21,130],[37,135]],smeargle:[[8,35]],
  tyrogue:[[1,134],[20,77]],hitmontop:[[1,104],[1,108],[13,99],[19,100],[20,142],[25,102]],
  smoochum:[[1,76],[1,95],[13,96],[21,24],[45,98],[57,12]],elekid:[[1,100],[9,139],[25,133],[41,138],[49,137]],
  magby:[[1,42],[13,124],[19,48],[37,50],[49,47]],miltank:[[1,134],[13,130],[34,109],[43,13]],
  blissey:[[1,95],[13,35],[28,41],[47,33]],raikou:[[1,11],[11,140],[31,100],[41,127],[61,29],[71,137]],
  entei:[[1,11],[11,42],[31,49],[41,130],[51,50],[71,47]],suicune:[[1,11],[11,20],[31,57],[41,7],[71,62]],
  larvitar:[[1,11],[22,106],[29,136],[43,29],[50,40],[57,63]],
  pupitar:[[1,11],[22,106],[29,136],[47,29],[56,40],[65,63]],
  tyranitar:[[1,11],[22,106],[29,136],[47,29],[61,40],[75,63]],
  lugia:[[22,57],[44,62],[66,133],[77,3],[88,5],[99,55]],hooh:[[22,57],[44,47],[66,133],[77,110],[88,5],[99,55]],
  celebi:[[1,24],[20,5],[30,55],[30,56]]
};
/* TODA ESPÉCIE ESCOLHE GOLPE. O `usaGolpesEscolhidos` existia pra devolver lista VAZIA às espécies
   do Metrônomo -- elas nunca chegavam no melhorAtaque, então uma tela pedindo escolha teria sido
   uma tela mentindo. Isso acabou em 10/09/2026: o Metrônomo agora DISPUTA com os golpes próprios,
   e o Poder Ancestral do Togepi vale de verdade a partir do nível 21. */
/* O que a espécie aprende por nível ATÉ aquele nível, do mais forte pro mais fraco. Cópia exata da
   do cliente -- as duas alimentam o equiparNpc, e divergir aqui é divergir a batalha. */
function ataquesDisponiveis(speciesId, nivel){
  const lista = APRENDIZADO[speciesId];
  if(!lista) return [];
  const ids = [];
  for(const par of lista){ if(par[0] <= nivel) ids.push(GOLPES_IDS[par[1]]); }
  return ids.sort((a, b) => GOLPES[b][1] - GOLPES[a][1] || a.localeCompare(b));
}

/* ⚠️ QUEM APRENDE CADA HM -- DUPLICADAS DO CLIENTE (16/09/2026), e elas vieram pra cá por um motivo
   só: **o servidor precisa VALIDAR o golpe que o cliente manda**. Os golpes escolhidos passaram a
   viajar ao lado do código de time (ver `carimbaDoMatch`), e código de time é dado de cliente --
   sem validação, uma linha no console poria Hiper Raio em tudo.
   O aprendizado por NÍVEL o servidor já sabia conferir (`ataquesDisponiveis`); o que faltava era o
   HM, que ninguém aprende por nível e por isso não está no `APRENDIZADO`.
   `tools/test-liga-treinadores.js` compara as duas cópias com as do cliente, por VALOR. */
const CORTADORES = [
  "bulbasaur","charmander","ratata","nidoranm","oddish","ivysaur","venusaur","charmeleon",
  "charizard","beedrill","raticate","nidorino","gloom","sandshrew","sandslash","paras",
  "parasect","meowth","persian","bellsprout","weepinbell","diglett","dugtrio","nidoranf",
  "nidorina","tentacool","tentacruel","krabby","kingler","victreebel","tangela","vileplume",
  "lickitung","rhydon","farfetchd","kangaskhan","scyther","kabutops","pinsir","nidoqueen",
  "nidoking","dragonite","chikorita","bayleef","meganium","cyndaquil","quilava","typhlosion",
  "totodile","croconaw","feraligatr","sentret","furret","bellossom","aipom","sunkern",
  "sunflora","espeon","umbreon","gligar","steelix","scizor","heracross","sneasel",
  "teddiursa","ursaring","skarmory","raikou","entei","suicune","tyranitar","celebi"
];
const VOADORES = [
  "charizard","pidgey","pidgeotto","pidgeot","spearow","fearow","crobat","farfetchd",
  "doduo","dodrio","aerodactyl","articuno","zapdos","moltres","dragonite","hoothoot",
  "noctowl","togetic","xatu","murkrow","delibird","skarmory","lugia","hooh"
];
const SURFISTAS = [
  "squirtle","wartortle","blastoise","staryu","starmie","poliwag","poliwhirl","tentacool",
  "tentacruel","slowpoke","slowbro","gyarados","tauros","psyduck","golduck","krabby",
  "kingler","horsea","seadra","goldeen","seaking","shellder","lickitung","rhydon",
  "seel","dewgong","kangaskhan","omanyte","omastar","kabuto","kabutops","lapras",
  "snorlax","nidoqueen","nidoking","dratini","dragonair","dragonite","poliwrath","cloyster",
  "vaporeon","totodile","croconaw","feraligatr","sentret","furret","chinchou","lanturn",
  "marill","azumarill","politoed","wooper","quagsire","slowking","qwilfish","sneasel",
  "corsola","remoraid","octillery","mantine","kingdra","miltank","suicune","tyranitar","lugia"
];
/* golpe de HM -> quem pode aprender. Uma tabela, e não um `if` por golpe: o próximo HM entra numa
   linha, e o validador não precisa saber que HM existe. */
/* ============================================================================
   AS MÁQUINAS DE TÉCNICA (TMs) -- 17/09/2026
   ----------------------------------------------------------------------------
   Pedidas assim: *"implemente os TMs e coloque eles para vender, no mínimo 100 cada, conforme o
   poder for maior, mais caro fica, e os TMs devem ser de uso único, usou uma vez, ele some e não
   dá para usar mais, precisa comprar novamente"*.

   ⚠️ ELAS SÃO O CONTRÁRIO DOS HMs EM TUDO QUE IMPORTA, e é por isso que não dava pra reusar o
   `HMS`:

     |                  | HM                          | TM                            |
     |------------------|-----------------------------|-------------------------------|
     | de onde vem      | conquista da jornada        | **compra na loja**            |
     | onde mora        | na CONTA (`hms`)            | no **inventário** (empilha)   |
     | quantas vezes    | infinitas                   | **UMA** (some ao ensinar)     |
     | dá pra esquecer  | não, nunca                  | **sim**, é golpe comum        |

   ⚠️ E A ÚLTIMA LINHA É A QUE MAIS SEPARA AS DUAS: o golpe de HM é a CHAVE de uma rota, então
   perdê-lo numa tela de troca fecharia o caminho de novo (ver `ehGolpeDeMaquina`). O de TM é só um
   golpe -- ele entra na fila de aprendizado como qualquer outro, e o jogador pode trocá-lo depois.
   Quem pagou 300 numa Hiper Raio e a trocou por engano **perdeu a Máquina**: é o preço do uso
   único, e é o que a tela avisa antes.

   ⚠️ A LISTA DE QUEM APRENDE SAIU DA TAG "3M" DO SHOWDOWN (Gen 3), o MESMO caminho dos 72
   cortadores, dos 65 surfistas e dos 24 voadores -- e o método foi conferido reproduzindo os três
   sem uma divergência. Atenção à fonte: as tags `1M` e `2M` dão ZERO nas 250 do jogo, porque o
   arquivo do Showdown é podado e só traz da Gen 3 pra frente.

   ⚠️ O PREÇO É DERIVADO, nunca escrito à mão: `max(100, poder efetivo × 2)`, arredondado à dezena.
   Ele usa o poder EFETIVO (`poderEfetivo`) e não o cru, que é a mesma régua que a escolha de golpe
   usa -- sem isso a Semente-Bala (poder 10, mas 2 a 5 tapas) sairia como o golpe mais barato do
   jogo por um número que não descreve o que ela tira. Vai de 🪙100 (Semente-Bala, Tumba de Rochas,
   Ladrão) a 🪙300 (Hiper Raio), ou seja de **1,4 a 4,3 jornadas** de renda -- a mais cara empata
   com o Doce Raro.

   ⚠️ ESTA TABELA É DUPLICADA no servidor, e não é opcional: é o `golpesValidos` que deixa um golpe
   sobreviver na liga e no online, e ele reconstrói o que a espécie pode ter a partir do
   `APRENDIZADO` (que é por NÍVEL) mais os HMs. Sem os TMs ali, quem ensinasse um perderia o golpe
   em TODA partida de liga, em silêncio -- foi exatamente o que quase aconteceu com o `fly`.
   ============================================================================ */
const TMS = {
  tm02: { golpe:'dragonclaw', preco:160, aprendem:['aerodactyl','charizard','charmander','charmeleon','dragonite','feraligatr','tyranitar'] },
  tm03: { golpe:'waterpulse', preco:120, aprendem:['aipom','articuno','azumarill','blastoise','blissey','celebi','chansey','chinchou','clefable','clefairy','cleffa','cloyster','corsola','croconaw','delibird','dewgong','dragonair','dragonite','dratini','dunsparce','feraligatr','furret','goldeen','golduck','granbull','gyarados','horsea','igglybuff','jigglypuff','jynx','kabuto','kabutops','kangaskhan','kingdra','kingler','krabby','lanturn','lapras','lickitung','lugia','mantine','marill','meowth','mewtwo','miltank','nidoking','nidoqueen','nidoranf','nidoranm','nidorina','nidorino','octillery','omanyte','omastar','persian','politoed','poliwag','poliwhirl','poliwrath','psyduck','quagsire','qwilfish','remoraid','seadra','seaking','seel','sentret','shellder','slowbro','slowking','slowpoke','smoochum','snorlax','snubbull','squirtle','starmie','staryu','suicune','tauros','tentacool','tentacruel','togepi','togetic','totodile','tyranitar','vaporeon','wartortle','wigglytuff','wooper'] },
  tm09: { golpe:'bulletseed', preco:100, aprendem:['bayleef','bellossom','bellsprout','bulbasaur','chikorita','exeggcute','exeggutor','gloom','hoppip','ivysaur','jumpluff','meganium','octillery','oddish','paras','parasect','skiploom','sunflora','sunkern','tangela','venusaur','victreebel','vileplume','weepinbell'] },
  tm13: { golpe:'icebeam', preco:190, aprendem:['articuno','azumarill','blastoise','blissey','chansey','chinchou','clefable','clefairy','cloyster','corsola','croconaw','cubone','delibird','dewgong','dragonair','dragonite','dratini','dunsparce','feraligatr','furret','goldeen','golduck','gyarados','horsea','jigglypuff','jynx','kabuto','kabutops','kangaskhan','kingdra','kingler','krabby','lanturn','lapras','lickitung','lugia','mantine','marill','marowak','mewtwo','miltank','nidoking','nidoqueen','nidoranf','nidoranm','nidorina','nidorino','octillery','omanyte','omastar','piloswine','politoed','poliwag','poliwhirl','poliwrath','porygon','porygon2','psyduck','quagsire','qwilfish','raticate','remoraid','rhydon','rhyhorn','seadra','seaking','seel','sentret','shellder','slowbro','slowking','slowpoke','smoochum','sneasel','snorlax','squirtle','starmie','staryu','suicune','swinub','tauros','tentacool','tentacruel','totodile','tyranitar','vaporeon','wartortle','wigglytuff','wooper'] },
  tm14: { golpe:'blizzard', preco:240, aprendem:['articuno','azumarill','blastoise','blissey','chansey','chinchou','clefable','clefairy','cloyster','corsola','croconaw','cubone','delibird','dewgong','dragonair','dragonite','dratini','dunsparce','feraligatr','furret','goldeen','golduck','gyarados','horsea','jigglypuff','jynx','kabuto','kabutops','kangaskhan','kingdra','kingler','krabby','lanturn','lapras','lickitung','lugia','mantine','marill','marowak','mewtwo','miltank','nidoking','nidoqueen','nidoranf','nidoranm','nidorina','nidorino','octillery','omanyte','omastar','piloswine','politoed','poliwag','poliwhirl','poliwrath','porygon','porygon2','psyduck','quagsire','qwilfish','raticate','remoraid','rhydon','rhyhorn','seadra','seaking','seel','shellder','slowbro','slowking','slowpoke','smoochum','sneasel','snorlax','squirtle','starmie','staryu','suicune','swinub','tauros','tentacool','tentacruel','totodile','tyranitar','vaporeon','wartortle','wigglytuff','wooper'] },
  tm15: { golpe:'hyperbeam', preco:300, aprendem:['aerodactyl','alakazam','ampharos','arbok','arcanine','ariados','articuno','azumarill','beedrill','bellossom','blastoise','blissey','butterfree','celebi','chansey','charizard','clefable','cloyster','crobat','dewgong','dodrio','donphan','dragonair','dragonite','dratini','dugtrio','electabuzz','electrode','entei','espeon','exeggutor','fearow','feraligatr','flareon','forretress','furret','gengar','golbat','golduck','golem','granbull','gyarados','heracross','hooh','houndoom','hypno','jolteon','jumpluff','jynx','kabutops','kangaskhan','kingdra','kingler','lanturn','lapras','larvitar','ledian','lickitung','lugia','machamp','magcargo','magmar','magneton','marowak','meganium','mewtwo','miltank','moltres','mrmime','muk','nidoking','nidoqueen','ninetales','noctowl','octillery','omastar','parasect','persian','pidgeot','piloswine','pinsir','politoed','poliwrath','porygon','porygon2','primeape','pupitar','quagsire','raichu','raikou','rapidash','raticate','remoraid','rhydon','sandslash','scizor','scyther','seadra','seaking','slowbro','slowking','snorlax','starmie','steelix','suicune','sunflora','tangela','tauros','tentacruel','togetic','typhlosion','tyranitar','umbreon','ursaring','vaporeon','venomoth','venusaur','victreebel','vileplume','weezing','wigglytuff','xatu','zapdos'] },
  tm19: { golpe:'gigadrain', preco:120, aprendem:['arbok','ariados','bayleef','beedrill','bellossom','bellsprout','bulbasaur','butterfree','celebi','chikorita','crobat','ekans','exeggcute','exeggutor','forretress','gastly','gengar','gloom','golbat','grimer','haunter','hooh','hoppip','ivysaur','jumpluff','kabuto','kabutops','ledian','ledyba','lugia','meganium','muk','natu','oddish','paras','parasect','pineco','skiploom','spinarak','sunflora','sunkern','tangela','tentacool','tentacruel','venomoth','venonat','venusaur','victreebel','vileplume','weepinbell','xatu','yanma','zubat'] },
  tm22: { golpe:'solarbeam', preco:240, aprendem:['aipom','ariados','bayleef','beedrill','bellossom','bellsprout','blissey','bulbasaur','butterfree','celebi','chansey','chikorita','clefable','clefairy','cleffa','dunsparce','entei','exeggcute','exeggutor','forretress','furret','gloom','granbull','hooh','hoppip','houndoom','houndour','igglybuff','ivysaur','jigglypuff','jumpluff','kangaskhan','ledian','ledyba','lickitung','meganium','mewtwo','miltank','mrmime','natu','oddish','paras','parasect','pineco','ponyta','porygon','porygon2','rapidash','sentret','skiploom','snorlax','snubbull','spinarak','stantler','sunflora','sunkern','tangela','tauros','togepi','togetic','venomoth','venonat','venusaur','victreebel','vileplume','weepinbell','wigglytuff','xatu','yanma'] },
  tm23: { golpe:'irontail', preco:200, aprendem:['abra','aerodactyl','aipom','alakazam','ampharos','arbok','arcanine','azumarill','bayleef','blastoise','blissey','chansey','charizard','charmander','charmeleon','chikorita','clefable','clefairy','cleffa','croconaw','cubone','donphan','dragonair','dragonite','dratini','dunsparce','eevee','ekans','electabuzz','entei','espeon','farfetchd','feraligatr','flaaffy','flareon','furret','girafarig','gligar','golduck','granbull','growlithe','houndoom','houndour','jolteon','kadabra','kangaskhan','lapras','lickitung','lugia','magby','magmar','mankey','mareep','marill','marowak','meganium','meowth','mewtwo','miltank','nidoking','nidoqueen','nidoranf','nidoranm','nidorina','nidorino','ninetales','onix','persian','phanpy','pichu','pikachu','ponyta','porygon','porygon2','primeape','psyduck','quagsire','raichu','raikou','rapidash','raticate','rhydon','rhyhorn','sandshrew','sandslash','sentret','slowbro','slowking','slowpoke','sneasel','squirtle','stantler','steelix','suicune','tauros','totodile','tyranitar','umbreon','vaporeon','vulpix','wartortle','wooper'] },
  tm24: { golpe:'thunderbolt', preco:190, aprendem:['aipom','ampharos','blissey','chansey','chinchou','clefable','clefairy','dragonair','dragonite','dratini','dunsparce','electabuzz','electrode','elekid','flaaffy','furret','gastly','gengar','girafarig','granbull','grimer','gyarados','haunter','hooh','jigglypuff','jolteon','kangaskhan','koffing','lanturn','lapras','lickitung','lugia','magnemite','magneton','mankey','mareep','meowth','mewtwo','miltank','misdreavus','mrmime','muk','nidoking','nidoqueen','nidoranf','nidoranm','nidorina','nidorino','persian','pichu','pikachu','porygon','porygon2','primeape','raichu','raikou','raticate','rhydon','rhyhorn','sentret','snorlax','snubbull','stantler','starmie','staryu','tauros','tyranitar','voltorb','weezing','wigglytuff','zapdos'] },
  tm25: { golpe:'thunder', preco:240, aprendem:['aipom','ampharos','blissey','chansey','chinchou','clefable','clefairy','dragonair','dragonite','dratini','dunsparce','electabuzz','electrode','elekid','flaaffy','furret','gengar','girafarig','granbull','grimer','gyarados','hooh','jigglypuff','jolteon','kangaskhan','koffing','lanturn','lapras','lickitung','lugia','magnemite','magneton','mankey','mareep','meowth','mewtwo','miltank','misdreavus','mrmime','muk','nidoking','nidoqueen','nidoranf','nidoranm','nidorina','nidorino','persian','pichu','pikachu','porygon','porygon2','primeape','raichu','raikou','raticate','rhydon','rhyhorn','snorlax','snubbull','stantler','starmie','staryu','tauros','tyranitar','voltorb','weezing','wigglytuff','zapdos'] },
  tm26: { golpe:'earthquake', preco:200, aprendem:['aerodactyl','arbok','blastoise','blissey','chansey','charizard','corsola','cubone','diglett','donphan','dragonite','dugtrio','dunsparce','ekans','feraligatr','forretress','geodude','girafarig','gligar','golem','granbull','graveler','gyarados','heracross','hitmonchan','hitmonlee','hitmontop','hooh','kangaskhan','larvitar','lickitung','lugia','machamp','machoke','machop','magcargo','mankey','mantine','marowak','meganium','mewtwo','miltank','nidoking','nidoqueen','onix','phanpy','piloswine','pineco','pinsir','politoed','poliwhirl','poliwrath','primeape','pupitar','quagsire','rhydon','rhyhorn','sandshrew','sandslash','shuckle','slowbro','slowking','slowpoke','snorlax','snubbull','stantler','steelix','sudowoodo','swinub','tauros','teddiursa','typhlosion','tyranitar','tyrogue','ursaring','venusaur','wooper'] },
  tm29: { golpe:'psychic', preco:180, aprendem:['abra','alakazam','ariados','blissey','butterfree','celebi','chansey','clefable','clefairy','cleffa','corsola','drowzee','electabuzz','elekid','espeon','exeggcute','exeggutor','gastly','gengar','girafarig','haunter','hooh','hoothoot','hypno','igglybuff','jigglypuff','jynx','kadabra','lapras','lugia','magby','magmar','mewtwo','misdreavus','mrmime','natu','noctowl','octillery','politoed','poliwag','poliwhirl','poliwrath','porygon','porygon2','remoraid','slowbro','slowking','slowpoke','smoochum','snorlax','spinarak','stantler','starmie','staryu','togepi','togetic','umbreon','venomoth','venonat','wigglytuff','xatu','yanma'] },
  tm30: { golpe:'shadowball', preco:160, aprendem:['abra','aipom','alakazam','blissey','butterfree','celebi','chansey','clefable','clefairy','cleffa','corsola','crobat','drowzee','dunsparce','eevee','espeon','flareon','furret','gastly','gengar','girafarig','golbat','granbull','haunter','hooh','hoothoot','houndoom','houndour','hypno','igglybuff','jigglypuff','jolteon','jynx','kadabra','kangaskhan','koffing','lickitung','lugia','meowth','mewtwo','miltank','misdreavus','mrmime','murkrow','natu','nidoking','nidoqueen','noctowl','persian','porygon','porygon2','qwilfish','raticate','sentret','slowbro','slowking','slowpoke','smoochum','sneasel','snorlax','snubbull','stantler','togepi','togetic','umbreon','vaporeon','weezing','wigglytuff','xatu','yanma','zubat'] },
  tm35: { golpe:'flamethrower', preco:190, aprendem:['aerodactyl','arcanine','blissey','chansey','charizard','charmander','charmeleon','clefable','clefairy','cleffa','cubone','cyndaquil','dragonair','dragonite','dratini','dunsparce','entei','flareon','furret','geodude','golem','granbull','graveler','grimer','growlithe','gyarados','hooh','houndoom','houndour','igglybuff','jigglypuff','kangaskhan','koffing','lickitung','machamp','machoke','machop','magby','magcargo','magmar','marowak','mewtwo','moltres','muk','nidoking','nidoqueen','ninetales','octillery','ponyta','quilava','rapidash','remoraid','rhydon','rhyhorn','sentret','slowbro','slowking','slowpoke','slugma','snorlax','snubbull','tauros','togepi','togetic','typhlosion','tyranitar','vulpix','weezing','wigglytuff'] },
  tm36: { golpe:'sludgebomb', preco:180, aprendem:['arbok','ariados','beedrill','bellossom','bellsprout','bulbasaur','crobat','diglett','dugtrio','ekans','exeggcute','exeggutor','gastly','gengar','gligar','gloom','golbat','granbull','grimer','haunter','houndoom','houndour','ivysaur','koffing','muk','nidoking','nidoqueen','nidoranf','nidoranm','nidorina','nidorino','octillery','oddish','paras','parasect','quagsire','qwilfish','shuckle','snubbull','spinarak','sunflora','sunkern','tangela','tentacool','tentacruel','venomoth','venonat','venusaur','victreebel','vileplume','weepinbell','weezing','wooper','zubat'] },
  tm38: { golpe:'fireblast', preco:240, aprendem:['aerodactyl','arcanine','blissey','chansey','charizard','charmander','charmeleon','clefable','clefairy','cleffa','cubone','cyndaquil','dragonair','dragonite','dratini','dunsparce','entei','flareon','geodude','golem','granbull','graveler','grimer','growlithe','gyarados','hooh','houndoom','houndour','igglybuff','jigglypuff','kangaskhan','koffing','lickitung','machamp','machoke','machop','magby','magcargo','magmar','marowak','mewtwo','moltres','muk','nidoking','nidoqueen','ninetales','octillery','ponyta','quilava','rapidash','remoraid','rhydon','rhyhorn','slowbro','slowking','slowpoke','slugma','snorlax','snubbull','tauros','togepi','togetic','typhlosion','tyranitar','vulpix','weezing','wigglytuff'] },
  tm39: { golpe:'rocktomb', preco:100, aprendem:['aerodactyl','blissey','chansey','corsola','cubone','diglett','donphan','dragonite','dugtrio','dunsparce','geodude','gligar','golem','granbull','graveler','grimer','heracross','hitmonchan','hitmonlee','kabuto','kabutops','kangaskhan','kingler','krabby','lickitung','machamp','machoke','machop','magcargo','mankey','marowak','mewtwo','miltank','muk','nidoking','nidoqueen','omanyte','omastar','onix','phanpy','piloswine','pinsir','poliwrath','primeape','quagsire','rhydon','rhyhorn','sandshrew','sandslash','shuckle','snorlax','steelix','sudowoodo','swinub','tauros','tyranitar','ursaring'] },
  tm42: { golpe:'facade', preco:140, aprendem:['abra','aerodactyl','aipom','alakazam','ampharos','arbok','arcanine','ariados','articuno','azumarill','bayleef','beedrill','bellossom','bellsprout','blastoise','blissey','bulbasaur','butterfree','celebi','chansey','charizard','charmander','charmeleon','chikorita','chinchou','clefable','clefairy','cleffa','cloyster','corsola','crobat','croconaw','cubone','cyndaquil','delibird','dewgong','diglett','dodrio','doduo','donphan','dragonair','dragonite','dratini','drowzee','dugtrio','dunsparce','eevee','ekans','electabuzz','electrode','elekid','entei','espeon','exeggcute','exeggutor','farfetchd','fearow','feraligatr','flaaffy','flareon','forretress','furret','gastly','gengar','geodude','girafarig','gligar','gloom','golbat','goldeen','golduck','golem','granbull','graveler','grimer','growlithe','gyarados','haunter','heracross','hitmonchan','hitmonlee','hitmontop','hooh','hoothoot','hoppip','horsea','houndoom','houndour','hypno','igglybuff','ivysaur','jigglypuff','jolteon','jumpluff','jynx','kabuto','kabutops','kadabra','kangaskhan','kingdra','kingler','koffing','krabby','lanturn','lapras','larvitar','ledian','ledyba','lickitung','lugia','machamp','machoke','machop','magby','magcargo','magmar','magnemite','magneton','mankey','mantine','mareep','marill','marowak','meganium','meowth','mewtwo','miltank','misdreavus','moltres','mrmime','muk','murkrow','natu','nidoking','nidoqueen','nidoranf','nidoranm','nidorina','nidorino','ninetales','noctowl','octillery','oddish','omanyte','omastar','onix','paras','parasect','persian','phanpy','pichu','pidgeot','pidgeotto','pidgey','pikachu','piloswine','pineco','pinsir','politoed','poliwag','poliwhirl','poliwrath','ponyta','porygon','porygon2','primeape','psyduck','pupitar','quagsire','quilava','qwilfish','raichu','raikou','rapidash','raticate','remoraid','rhydon','rhyhorn','sandshrew','sandslash','scizor','scyther','seadra','seaking','seel','sentret','shellder','shuckle','skarmory','skiploom','slowbro','slowking','slowpoke','slugma','smoochum','sneasel','snorlax','snubbull','spearow','spinarak','squirtle','stantler','starmie','staryu','steelix','sudowoodo','suicune','sunflora','sunkern','swinub','tangela','tauros','teddiursa','tentacool','tentacruel','togepi','togetic','totodile','typhlosion','tyranitar','tyrogue','umbreon','ursaring','vaporeon','venomoth','venonat','venusaur','victreebel','vileplume','voltorb','vulpix','wartortle','weepinbell','weezing','wigglytuff','wooper','xatu','yanma','zapdos','zubat'] },
  tm43: { golpe:'secretpower', preco:140, aprendem:['abra','aerodactyl','aipom','alakazam','ampharos','arbok','arcanine','ariados','articuno','azumarill','bayleef','beedrill','bellossom','bellsprout','blastoise','blissey','bulbasaur','butterfree','celebi','chansey','charizard','charmander','charmeleon','chikorita','chinchou','clefable','clefairy','cleffa','cloyster','corsola','crobat','croconaw','cubone','cyndaquil','delibird','dewgong','diglett','dodrio','doduo','donphan','dragonair','dragonite','dratini','drowzee','dugtrio','dunsparce','eevee','ekans','electabuzz','electrode','elekid','entei','espeon','exeggcute','exeggutor','farfetchd','fearow','feraligatr','flaaffy','flareon','forretress','furret','gastly','gengar','geodude','girafarig','gligar','gloom','golbat','goldeen','golduck','golem','granbull','graveler','grimer','growlithe','gyarados','haunter','heracross','hitmonchan','hitmonlee','hitmontop','hooh','hoothoot','hoppip','horsea','houndoom','houndour','hypno','igglybuff','ivysaur','jigglypuff','jolteon','jumpluff','jynx','kabuto','kabutops','kadabra','kangaskhan','kingdra','kingler','koffing','krabby','lanturn','lapras','larvitar','ledian','ledyba','lickitung','lugia','machamp','machoke','machop','magby','magcargo','magmar','magnemite','magneton','mankey','mantine','mareep','marill','marowak','meganium','meowth','mewtwo','miltank','misdreavus','moltres','mrmime','muk','murkrow','natu','nidoking','nidoqueen','nidoranf','nidoranm','nidorina','nidorino','ninetales','noctowl','octillery','oddish','omanyte','omastar','onix','paras','parasect','persian','phanpy','pichu','pidgeot','pidgeotto','pidgey','pikachu','piloswine','pineco','pinsir','politoed','poliwag','poliwhirl','poliwrath','ponyta','porygon','porygon2','primeape','psyduck','pupitar','quagsire','quilava','qwilfish','raichu','raikou','rapidash','raticate','remoraid','rhydon','rhyhorn','sandshrew','sandslash','scizor','scyther','seadra','seaking','seel','sentret','shellder','shuckle','skarmory','skiploom','slowbro','slowking','slowpoke','slugma','smoochum','sneasel','snorlax','snubbull','spearow','spinarak','squirtle','stantler','starmie','staryu','steelix','sudowoodo','suicune','sunflora','sunkern','swinub','tangela','tauros','teddiursa','tentacool','tentacruel','togepi','togetic','totodile','typhlosion','tyranitar','tyrogue','umbreon','ursaring','vaporeon','venomoth','venonat','venusaur','victreebel','vileplume','voltorb','vulpix','wartortle','weepinbell','weezing','wigglytuff','wooper','xatu','yanma','zapdos','zubat'] },
  tm46: { golpe:'thief', preco:100, aprendem:['abra','aerodactyl','aipom','alakazam','arbok','arcanine','ariados','beedrill','bellsprout','butterfree','crobat','cubone','delibird','dewgong','diglett','dodrio','doduo','drowzee','dugtrio','dunsparce','ekans','electabuzz','electrode','elekid','exeggcute','exeggutor','farfetchd','fearow','furret','gastly','gengar','girafarig','gligar','golbat','granbull','grimer','growlithe','haunter','heracross','hitmonchan','hitmonlee','hitmontop','hoothoot','houndoom','houndour','hypno','jynx','kabuto','kabutops','kadabra','kangaskhan','kingler','koffing','krabby','ledian','ledyba','lickitung','machamp','machoke','machop','magby','magmar','mankey','marowak','meowth','misdreavus','mrmime','muk','murkrow','natu','nidoking','nidoqueen','nidoranf','nidoranm','nidorina','nidorino','noctowl','octillery','omanyte','omastar','paras','parasect','persian','pidgeot','pidgeotto','pidgey','pinsir','politoed','poliwag','poliwhirl','poliwrath','porygon','porygon2','primeape','raichu','raticate','remoraid','rhydon','rhyhorn','sandshrew','sandslash','scizor','scyther','seel','sentret','skarmory','smoochum','sneasel','snubbull','spearow','spinarak','stantler','sudowoodo','tangela','teddiursa','tentacool','tentacruel','tyrogue','ursaring','venomoth','venonat','victreebel','voltorb','weepinbell','weezing','xatu','yanma','zubat'] },
  tm47: { golpe:'steelwing', preco:140, aprendem:['aerodactyl','articuno','charizard','crobat','dodrio','doduo','dragonite','farfetchd','fearow','gligar','golbat','hooh','hoothoot','lugia','moltres','murkrow','natu','noctowl','pidgeot','pidgeotto','pidgey','scizor','scyther','skarmory','spearow','togetic','xatu','yanma','zapdos','zubat'] },
  tm50: { golpe:'overheat', preco:280, aprendem:['arcanine','charizard','charmander','charmeleon','cyndaquil','flareon','granbull','growlithe','hooh','houndoom','houndour','magcargo','mankey','moltres','ninetales','ponyta','primeape','quilava','rapidash','slugma','snubbull','typhlosion','vulpix'] },
};
/* ⚠️ HM **E** TM: o `golpesValidos` reconstrói o que a espécie pode ter a partir do APRENDIZADO
   (que é por NÍVEL), e nem HM nem TM aparecem lá. Sem os dois aqui, o golpe some na liga e no
   online em silêncio -- foi o que quase aconteceu com o `fly`.
   Ela é DERIVADA do `TMS`, e não uma segunda lista: um TM novo já nasce coberto. */
const APRENDEM_HM = Object.assign(
  { cut: CORTADORES, surf: SURFISTAS, fly: VOADORES },
  Object.fromEntries(Object.values(TMS).map(tm => [tm.golpe, tm.aprendem]))
);
/* ⚠️ O QUE O SERVIDOR ACEITA DE GOLPE ESCOLHIDO. Ele não confia na lista que chegou: reconstrói o
   que aquela espécie NAQUELE nível pode ter e fica só com a interseção.
   O que sobra de um time forjado é o motor de tipo -- ou seja, exatamente o que a liga já fazia
   antes desta mudança. Errar pro lado de TIRAR o golpe é o certo aqui.
   O teto é o `MAX_GOLPES`, e ele é conferido aqui também: mandar seis golpes não dá seis. */
function golpesValidos(speciesId, nivel, lista){
  if(!Array.isArray(lista) || !lista.length) return [];
  const porNivel = new Set(ataquesDisponiveis(speciesId, nivel));
  const out = [];
  for(const id of lista){
    if(typeof id !== "string" || out.indexOf(id) >= 0) continue;
    if(!GOLPES[id]) continue;                                  // golpe que não existe
    const hm = APRENDEM_HM[id];
    if(hm ? hm.indexOf(speciesId) < 0 : !porNivel.has(id)) continue;
    out.push(id);
    if(out.length >= MAX_GOLPES) break;
  }
  return out;
}
/* ⚠️ UM CARIMBO SÓ PROS DOIS (16/09/2026). O `carimbaSlots` estava COPIADO no `resolveLeagueMatch`
   e no `resolveTrainersLeagueMatch`, palavra por palavra -- e os golpes seriam a terceira e a
   quarta cópia. Duas cópias já divergiriam no primeiro ajuste; quatro é garantia.
   O CÓDIGO DE TIME (`especie:nivel:shiny`) continua intocado: ele é a trava anti-falsificação, e
   o que viaja ao lado dele é o que o `decodeTeamCode` recusaria -- os slots desde sempre, e agora
   os golpes. Quem não mandar nada luta no motor de tipo, como a liga inteira fazia até hoje. */
/* a MESMA chave do cliente -- se as duas divergirem, o golpe é procurado numa chave que não existe
   e o time inteiro cai no motor de tipo, em silêncio */
function chaveDosGolpes(p){ return p.speciesId + ':' + p.level; }
function carimbaDoMatch(time, lado){
  if(!Array.isArray(time) || !lado) return;
  time.forEach((p, i) => {
    if(!p) return;
    if(Array.isArray(lado.slots) && lado.slots[i] != null) p.slotDaConta = String(lado.slots[i]);
    /* ⚠️ A CHAVE É ESPÉCIE:NÍVEL, não a posição -- ver chaveDosGolpes. E o `i` continua valendo
       pros SLOTS, que são por posição mesmo: eles dizem de que save veio aquele pokémon. */
    const crus = lado.ataques && lado.ataques[chaveDosGolpes(p)];
    if(crus){
      const bons = golpesValidos(p.speciesId, p.level, crus);
      if(bons.length) p.ataques = bons;
    }
  });
}
const MOVE_POWER = 60;   // o poder de quem NÃO tem golpe escolhido (save antigo, e as 8 espécies sem golpe de dano)
/* TETO DE DANO POR GOLPE, DESLIGADO desde 09/09/2026 -- e isso é decisão, não experimento
   esquecido: ele foi tirado pra um experimento e o resultado foi aprovado pro ar.
   Valeu 0.65 (0.70 no crítico) por quase toda a vida do jogo, e era ele que garantia que
   ONE-SHOT NÃO EXISTE: nenhum golpe derrubava de vida cheia, e todo pokémon respondia pelo menos
   uma vez. Sem ele isso acabou.
   MEDIDO na retirada: a jornada concluída sobe ~9 pontos e a dificuldade INVERTE de formato --
   os game overs no Brock caem de 799 pra 417 e os do Giovanni sobem de 171 pra 267. O começo
   afrouxa (o time inicial deixa de apanhar de graça) e o fim aperta (os líderes de nível alto
   passam a derrubar num golpe).
   Se um dia voltar, é aqui: 0.65 e 0.70. Os DOIS motores têm que voltar juntos. */
const DMG_CAP_PCT = Infinity;
const DMG_CAP_PCT_CRIT = Infinity;
function statAtLevel(base, level){ return Math.floor(2*base*level/100) + 5; }
/* MOTOR ÚNICO -- é ESTA a fórmula que roda em tudo: ligas, Ginásio da Cidade e, espelhada no
   index.html, também as batalhas locais do cliente.
   Este cabeçalho já dizia "MOTOR LEGADO -- o servidor usa só ele" e que o motor Gen 1 existia
   "apenas no cliente". Era falso, e contradizia o bloco MOTOR ALINHADO COM O CLIENTE logo acima:
   o corpo aqui embaixo É o motor novo. Conferido numericamente -- 6556 golpes com as mesmas
   seeds nos dois arquivos, zero divergências. Mantenha assim: um lado só mudado = a mesma
   batalha com dois vencedores. */
/* `op.semTipo` -- o dano sai SEM TIPO: nem multiplicador de tipo, nem STAB, nem o redutor de
   subtipo. Existe pra a CONFUSAO, que no jogo oficial bate com um golpe sem tipo nenhum. O resto
   da conta e a de sempre: nivel, poder do golpe, ataque contra defesa e a variacao de 85-100%.
   SEM ISSO o espelho da confusao aplicava a tabela contra ELE MESMO, e Fantasma contra Fantasma e
   2x: um Haunter tirava 299 dos proprios 300 de vida. Medido antes de mudar: 3% das confusoes
   deixavam o alvo em 1 de HP. */
/* O MESMO GOLPE DE NOVO, sem sortear: os tapas seguintes de um golpe de vários tapas. Ele reusa o
   `melhorAtaque` com uma lista de UM item, que é o que garante que o STAB, o subtipo, a anulação e
   a chuva entrem exatamente como entraram no primeiro tapa -- refazer essa conta à mão aqui seria
   uma segunda fonte de verdade pro dano. */
function golpeComoEscolhido(attacker, defender, golpeId, foiMetronomo){
  const best = melhorAtaque(Object.assign({}, attacker, { ataques: [golpeId], _anulado: null }), defender);
  if(best){ best.metronomo = !!foiMetronomo; return best; }
  return bestAttackType(attacker, defender);
}
function calcDamage(attacker, defender, rng, op){
  op = op || {};
  rng = rng || Math.random;   // as ligas passam um rng com seed; fora delas cai no padrão
  // considera tipos próprios E subtipos, igual ao cliente (ver SUBTYPES).
  // Com USE_SUBTYPES=false volta a ser o bestMultiplier de antes, que segue ali intacto
  /* ⚠️ `op.golpeFixo` -- os TAPAS SEGUINTES repetem o MESMO golpe do primeiro.
     Sem isso, quem sorteia golpe a cada ataque (o Metrônomo) trocava de golpe A CADA TAPA: um Tapa
     Duplo de 3 virava Tapa Duplo + Rapidez + Mega Dreno, cada tapa com o poder do que tinha sido
     sorteado, e o diário gravava o ÚLTIMO deles como o golpe da linha -- "Rapidez 3x", "Raio Solar
     3x", "Canhão de Choque 4x". Reportado com print em 13/09/2026 (Clefairy e Clefable).
     Não é só o log: o DANO também saía de um golpe que o pokémon não estava usando. O número de
     tapas é lido do PRIMEIRO golpe, e os outros tinham que ser o mesmo golpe. */
  const best = (op.golpeFixo && GOLPES[op.golpeFixo])
    ? golpeComoEscolhido(attacker, defender, op.golpeFixo, op.metronomoFixo)
    : tipoDoGolpe(attacker, defender, rng);
  /* Registro pro LOG: qual tipo este golpe usou. É só leitura -- nada daqui volta pra conta.
     O tipo escolhido não depende de HP (só de atributos e tipos, que não mudam durante o
     confronto), então na prática ele é o mesmo do começo ao fim da luta entre esses dois. */
  attacker.lastMoveType = best.type;
  attacker.lastMove = best.golpe || null;   // qual GOLPE saiu -- vai pro log
  attacker.lastMetronomo = !!best.metronomo;  // veio do sorteio do Metronomo? (ver tipoDoGolpe)
  const mult = best.mult;
  const special = isSpecialType(best.type);
  // STAB só pro tipo próprio; subtipo perde o bônus e ainda leva o redutor
  const STAB = op.semTipo ? 1 : (best.stab ? 1.5 : SUBTYPE_PENALTY);
  // ---- fórmula oficial da Gen 1, idêntica ao calcDamageNew do cliente ----
  const atkBase = special ? effectiveSpAtk(attacker) : effectiveAttack(attacker);   // COM buffs (ofensivo)
  const defBase = special ? effectiveSpDef(defender) : effectiveDefense(defender);  // Gen 2: defesa especial propria
  const A = statAtLevel(atkBase, attacker.level);
  const D = statAtLevel(defBase, defender.level);
  /* `op.semCritico` -- o golpe nao pode ser critico. Existe pra a CONFUSAO, que no jogo oficial
     tambem nao critica. O rng E CONSUMIDO do mesmo jeito: os dois motores tem que ler a mesma
     quantidade de numeros da mesma semente, senao a batalha diverge do 2o golpe em diante. */
  const isCrit = (rng() < chanceDeCritico(best.golpe)) && !op.semCritico;   // Gen 3: chance fixa, +1 estágio nos golpes de crítico alto
  attacker.lastCrit = isCrit;   // registro pro log, como o lastMoveType acima
  /* Imunidade: o multiplicador é 0, mas o dano tem piso de 1 -- dano 0 dos dois lados travaria
     o laço da luta pra sempre. O log precisa saber a diferença entre "tirou 1" e "não teve
     efeito", senão o jogador vê um -1 sem explicação. */
  attacker.lastMoveNulo = !!best.nulo;
  /* ⚠️ A ESCALA DO ROLAMENTO fica registrada aqui, junto do lastCrit -- e ela precisa ser a que
     ESTE golpe usou, não a do próximo. O contador anda no golpesDaTroca, que roda ANTES de o
     diário ser escrito; lido de lá, o log mostraria sempre a escala seguinte. */
  attacker.lastRolamento = escalaDoRolamento(attacker, best.golpe);
  const Leff = attacker.level;   // o crítico da Gen 3 dobra o DANO no fim, não o nível aqui
  /* ⚠️ O PODER JÁ VEM PRONTO DO melhorAtaque, com a escala do Rolamento E o dobro da Fachada --
     multiplicar de novo aqui dobraria duas vezes (a armadilha do poder efetivo, 09/09/2026). */
  const potencia = best.poder || MOVE_POWER;   // o poder do GOLPE escolhido, ou o implícito de sempre
  /* CONTA O USO DEPOIS de o poder deste golpe já ter sido lido: o primeiro uso sai nos 20 secos, e
     é o SEGUINTE que vem com +6. */
  const core = Math.floor(Math.floor(2*Leff/5 + 2) * potencia * A / D / 50) + 2;
  // multiplicador de tipo COMPRIMIDO (^0.6): 2x vira ~1.5x. Aqui não se troca de pokémon no meio
  // do confronto, então tipo não pode ser sentença de morte
  const typeMult = op.semTipo ? 1 : Math.pow(mult, EXPOENTE_TIPO);
  /* A CHUVA: +50% em Água, -50% em Fogo e no Raio Solar, +25% em Elétrico. É o MESMO multDaChuva
     que as duas escolhas de golpe leem -- um número só pros três, senão o motor escolhe por uma
     regra e aplica outra (a lição do EXPOENTE_TIPO).
     NÃO VALE COM `op.semTipo`: esse é o espelho da CONFUSÃO, que no jogo oficial bate sem tipo e
     por isso também não sente clima. Sem esta guarda a chuva mudaria o dano do espelho e as
     medições da confusão deixariam de valer.
     ⚠️ AQUI OS NOMES SÃO OUTROS: o servidor usa `mult` e `best.type`/`best.golpe` continuam
     valendo, mas a função se chama `calcDamage`, sem o `New`. É a lição do `brockTeam` x
     `enemyTeam` -- ao copiar entre os dois motores, conferir os NOMES. */
  const chuvaMult = op.semTipo ? 1 : multDaChuva(best.type, best.golpe);
  const dmgGen1 = Math.round(core * STAB * typeMult * chuvaMult * (0.85 + rng()*0.15) * (isCrit ? CRIT_MULT : 1)); // variação 85-100%, o clima e o ×2 do crítico
  // converte pra fração da vida na escala Gen 1, aplica o teto por golpe, e projeta na escala de HP
  // do jogo -- sem vulnerabilidade por sequência de vitórias, que era a origem da "morte súbita"
  let pct = dmgGen1 / gen1MaxHp(defender);
  pct = Math.min(pct, isCrit ? DMG_CAP_PCT_CRIT : DMG_CAP_PCT);
  const defMaxHp = defender.maxHp || calcMaxHp(defender);
  return Math.max(1, Math.round(pct * defMaxHp));
}
const MORIBUNDO_ABAIXO_DE = 0.10;   // "com menos de 10% de HP"
const MORIBUNDO_TETO_NO_CHEIO = 0.70;
/* =====================================================================
   VIDA CHEIA NÃO MORRE NUM GOLPE (17/09/2026)
   ---------------------------------------------------------------------
   Pedido assim: *"quando um pokemon esta de vida cheia, ele nunca morre com um só golpe, invente um
   calculo que dependendo da diferença de level entre os pokemons, o de vida cheia ao tomar um golpe
   que seria de 100% de hp, vai tomar no maximo 95% e no minimo 70%. Se a diferença entre o level
   dos pokemons for maior que 15, ai pode desconsiderar essa regra e matar de primeira"*.

   ⚠️ ELA É A GENERALIZAÇÃO DO `MORIBUNDO_TETO_NO_CHEIO`, que já fazia exatamente isto desde
   14/09/2026 -- só que apenas quando o ATACANTE estava raspando (abaixo de 10%). A mecânica de
   aparo é a mesma (o teto vale por TROCA, e é repartido entre os tapas); o que muda é QUANDO ela
   vale e QUANTO ela deixa passar.

   ⚠️ A CURVA É A VANTAGEM DE NÍVEL, e ela anda no sentido que o pedido descreve: quanto mais acima
   o atacante está, mais ele consegue tirar.
     diferença  0 (ou negativa) -> o alvo fica com 30% (teto de 70%)
     diferença 15               -> o alvo fica com  5% (teto de 95%)
     diferença > 15             -> SEM TRAVA: mata de primeira
   Entre 0 e 15 é linear. Atacante MAIS FRACO cai no piso: um pokémon de nível menor matando um
   alvo cheio num golpe é o caso mais absurdo dos dois, então ele cede o máximo.

   ⚠️ E ELA CONVIVE COM A DE 14/09 PELO MENOR TETO, não a substitui. As duas olham coisas
   diferentes -- aquela é sobre o ESTADO do atacante ("um pokémon muito ferido não deveria aguentar
   tanto numa luta", que foi o pedido dela) e esta é sobre a diferença de PODER. Um atacante
   raspando com 20 níveis de vantagem continua parando em 70%: a regra dele não tem nível nenhum na
   conta, e deixar a nova liberar o que a antiga proíbe desfaria um pedido com o outro.
   ===================================================================== */
const CHEIO_TETO_MIN = 0.70;        // diferença de nível 0 ou negativa
const CHEIO_TETO_MAX = 0.95;        // diferença de nível 15
const CHEIO_DIF_MAXIMA = 15;        // acima disso a trava não vale
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
/* O CRÍTICO É DA GEN 3 desde 10/09/2026. Era da Gen 1 (`velocidade/512`, e o crítico dobrava o
   NÍVEL na fórmula) -- o último desvio de Gen 1 que restava no motor, num jogo que já usa atributos
   da Gen 2 e golpes da Gen 3.
   A GEN 3 ABANDONOU A VELOCIDADE e usa ESTÁGIOS de chance fixa, iguais pra todo mundo:
     +0 = 1/16 (6,25%)   +1 = 1/8 (12,5%)   +2 = 1/4   +3 = 1/3   +4 = 1/2
   Aqui só existem os DOIS primeiros, e é decisão: nada no jogo sobe estágio -- não há Foco de
   Energia, Lente de Mira, habilidade nem item de crítico. Cadastrar os estágios 2 a 4 seria código
   que nunca roda, do tipo que fica anos no arquivo sem ninguém saber que está morto.
   O EFEITO É ×2 EXATO (Gen 2 a Gen 5), e não mais o nível dobrado -- que dava ~1,9× por causa do
   +2 e dos arredondamentos da fórmula.
   O QUE MUDA NA PRÁTICA: a taxa média cai de 12,8% pra ~6,6% e deixa de depender da espécie. O
   Electrode criticava 27,3% e o Shuckle 1,0%; agora os dois criticam 6,25%, e quem carrega um dos
   golpes de crítico alto vai a 12,5%.
   OS OITO GOLPES saíram do `critRatio` do dado do Showdown com o mod da Gen 3 -- o MESMO caminho
   que gerou a base de golpes, e não uma lista escrita de cabeça: o Bulbapedia não publica o
   conjunto da geração, só exemplos. Esta lista é DUPLICADA nos dois motores. */
/* FÚRIA: a passiva que faz o pokémon CRESCER no meio da batalha (10/09/2026).
   Ela nasceu como um golpe que ganhava poder a cada uso, e isso foi DESFEITO: medido, o motor nunca
   a escolhia (começa em poder 20 e perde pra qualquer alternativa -- 0,0% dos confrontos), e mesmo
   forçada ela custava 22,7 pontos de vitória. Virou passiva, no molde do sono e da anulação.
   COMO FUNCIONA: quem tem Fúria tem 30% por CONFRONTO de entrar em fúria, e cada vez que entra
   ganha +10 em TODOS os seis atributos -- ataque, defesa, os dois especiais, velocidade e o HP.
   ACUMULA: entrar em fúria em dois confrontos seguidos vale +20, e assim por diante. O acúmulo é
   POR BATALHA e zera no começo da próxima, como a marca da autodestruição.
   O HP CRESCE DE VERDADE: o +10 entra no teto de vida e a vida ATUAL sobe junto, então a barra
   sobe na tela em vez de o pokémon ficar com uma fatia menor da barra sem motivo.
   ELA VEM PRIMEIRO no sorteio, antes até do Metrônomo, e isso é decisão: é um efeito de ABERTURA
   que não resolve o confronto, e deixá-la pra depois faria o Snubbull -- o único dos 19 que tem
   outro especial -- nunca entrar em fúria, porque o Metrônomo corta o sorteio ali mesmo.
   A LISTA são as 19 espécies que aprendem Fúria por NÍVEL, a mesma regra das outras seis listas. */
const FURIA = ['beedrill','charizard','charmander','charmeleon','croconaw','cubone','dodrio','doduo','dunsparce','feraligatr','granbull','kangaskhan','marowak','onix','primeape','snubbull','steelix','tauros','totodile'];
const CHANCE_FURIA = 0.30;
const FURIA_BONUS = 10;   // em TODOS os seis atributos, por vez que ela entra
/* O bônus é FLAT e entra POR ÚLTIMO, depois de shiny, terreno, especialidade e item -- todos
   multiplicadores. Entrando antes, eles o inflariam, e "+10" deixaria de ser 10. É a mesma regra
   do item de atributo, que já está uma linha acima na cadeia. */
function withFuria(v, p){ return v + FURIA_BONUS * ((p && p._furia) || 0); }
const CRIT_BASE = 1/16;   // estágio +0 -- todo golpe comum
const CRIT_ALTO = 1/8;    // estágio +1 -- os golpes de crítico alto
const CRIT_MULT = 2;      // Gen 2 a Gen 5: o crítico dobra o dano
const GOLPES_CRIT_ALTO = ['aeroblast','aircutter','crabhammer','crosschop','karatechop','razorleaf','skyattack','slash'];
/* Sem golpe escolhido (liga, online, save antigo e as espécies sem golpe de dano) o motor ataca
   pelo TIPO e não há id pra consultar -- ali vale o estágio +0, que é o padrão da geração. */
function chanceDeCritico(golpeId){
  return (golpeId && GOLPES_CRIT_ALTO.indexOf(golpeId) >= 0) ? CRIT_ALTO : CRIT_BASE;
}
const CHANCE_SONO = 0.15;
/* Quantas TROCAS o alvo passa sem revidar. O sono já foi abate instantâneo -- o alvo ia a 0 de HP
   sem tocar em ninguém -- e os jogadores reclamaram, com razão: não era o número que pesava (medido,
   valia +1,4 ponto de vitória, contra +0,8 do Recuperar), era a FORMA. Perder um pokémon inteiro
   pra um sorteio de 5%, sem jogada possível e sem tomar um golpe, é ruim mesmo valendo pouco.
   Com trocas livres ele vira vantagem de tempo em vez de execução: o alvo apanha de graça e
   depois acorda. Medido na época: o ganho caiu de +1,4 pra +0,7 ponto, e quem aproveita bem
   (Gengar, rápido e forte) quase não perdeu poder -- o golpe passou a premiar quem capitaliza.
   PASSOU DE 2 PRA 1 EM 09/09/2026, a pedido: uma troca livre e a luta volta ao normal.
   Medido com o sono FORÇADO (chance 100%, 1x1, 16 soníferos × 8 adversários × 40 voltas), que é
   o jeito de isolar o efeito -- na chance real de 5% ele se dilui e some no ruído da amostra:
   sem sono 23,0% de vitória, com 2 trocas 52,8% (+29,8), com 1 troca 40,8% (+17,8).
   Ou seja, **uma troca livre entrega 60% do que duas entregavam**.
   NA JORNADA NÃO SE MOVE: 76,15% → 76,81% de conclusão (8.000 jornadas de cada lado, +0,66
   ponto, 1,0σ -- ruído). Faz sentido: os líderes também têm sonífero (Oddish, Paras, Venonat),
   então enfraquecer o golpe cai dos dois lados igual.
   O NÚMERO É DUPLICADO no index.html e no functions/index.js -- divergência aqui faz a mesma
   batalha terminar diferente no cliente e no servidor. `tools/test-especiais.js` tranca os dois. */
/* ⚠️ QUANTAS TROCAS O SONO COMPRA: 1, 2 ou 3, com 1/3 DE CHANCE CADA (15/09/2026, a pedido:
   *"coloque 1/3 de chance para ele tomar 1 ataque, 1/3 de chance para ele tomar 2 ataques e 1/3 de
   chance para ele tomar 3 ataques, assim como no jogo real"*).
   Era um número FIXO -- valeu 2 até 09/09/2026 e 1 daí em diante --, e a mudança de 2 pra 1 tinha
   sido feita justamente porque perder um pokémon inteiro num sorteio de 5% era ruim mesmo valendo
   pouco. Isto devolve parte do que aquela mudança tirou, mas de um jeito diferente: o pior caso
   volta a ser 3 trocas, só que ele sai em 1 vez em 3 em vez de sempre.
   ⚠️ O SORTEIO É POR USO, e ele é LIDO DO PRÓPRIO rng DA BATALHA -- não de Math.random. Cliente e
   servidor resolvem a MESMA batalha a partir da mesma semente (a Liga, o online, a comparação dos
   300 confrontos), então um dado a mais num dos dois lados desloca a semente inteira e a batalha
   passa a terminar diferente nos dois. É a mesma armadilha que o Remoinho quase trouxe.
   ⚠️ E ELE SÓ É LIDO QUANDO O SONO REALMENTE SAI, pelo mesmo motivo: lê-lo antes da checagem
   mudaria confronto que não tem sonífero nenhum.
   A TABELA é uma lista de durações com peso, no molde do MULTI_GOLPE: se um dia as chances
   deixarem de ser iguais, é ela que muda e mais nada. Ela é DUPLICADA nos dois motores, e
   `tools/test-especiais.js` compara as duas E cobra a distribuição. */
const SONO_EM_TROCAS = [[1, 1], [2, 1], [3, 1]];
function sorteiaTrocasDeSono(rng){
  const total = SONO_EM_TROCAS.reduce((a, x) => a + x[1], 0);
  let r = rng() * total;
  for(const [trocas, peso] of SONO_EM_TROCAS){ r -= peso; if(r < 0) return trocas; }
  return SONO_EM_TROCAS[SONO_EM_TROCAS.length - 1][0];
}
/* GOLPES DE VÁRIOS TAPAS. Batem de 2 a 5 vezes numa troca, cada tapa com o próprio sorteio de dano
   e de crítico -- é assim no jogo original, e é o que faz um golpe de poder baixo valer a pena: a
   média de 3,0 tapas exatos põe o Tapa Duplo (15) em 45 de poder efetivo e os Arranhões Furiosos
   (18) em 54.
   PESOS OFICIAIS, e os DOIS golpes têm os mesmos (fontes: pokemondb.net/move/double-slap e
   /fury-swipes): 2 tapas 3/8, 3 tapas 3/8, 4 tapas 1/8, 5 tapas 1/8. São os da Gen 2-4, que é a
   geração da base de golpes daqui (Gen 3/FireRed) -- a Gen 5 mudou pra 1/3, 1/3, 1/6, 1/6 e NÃO é
   a que vale aqui.
   É TABELA e não um teste solto, e ela já provou que valia a pena: os Arranhões Furiosos entraram
   como UMA LINHA daqui, sem tocar em mais nada. O jogo ainda tem outros (Soco Múltiplo, Ataque de
   Fúria, Míssil de Agulha, Pedra Afiada) e eles não foram pedidos.
   Ela é DUPLICADA nos dois motores, como a tabela GOLPES.
   ATENÇÃO: o dano de cada tapa passa pelo teto normalmente, e os tapas PARAM quando o alvo cai --
   tapa em cadáver não existe, e é isso que preserva o -todo pokémon responde pelo menos uma vez-. */
/* A distribuição é a MESMA nos nove, conferida na fonte golpe a golpe -- por isso ela é uma
   constante e não nove cópias: uma cópia divergiria no primeiro ajuste, e é exatamente o tipo de
   erro que ninguém vê. Se um dia entrar um golpe com distribuição própria (o Chute Triplo bate 3
   vezes com acerto crescente, por exemplo), ele ganha o array dele aqui e mais nada muda. */
const TAPAS_2A5 = [[2,3],[3,3],[4,1],[5,1]];
/* ⚠️ E TRÊS BATEM SEMPRE DUAS VEZES, nem mais nem menos (13/09/2026, a pedido). No jogo oficial o
   Chute Duplo, o Ossomerangue e a Agulha Dupla não sorteiam nada: são dois golpes, sempre. É
   exatamente o caso que o comentário acima previa ("se um dia entrar um golpe com distribuição
   própria, ele ganha o array dele aqui e mais nada muda") -- o motor, o log, a animação e o selo
   `2x` saem de graça, e o `poderEfetivo` já faz a média ponderada de qualquer tabela. */
const TAPAS_SEMPRE_2 = [[2,1]];
const MULTI_GOLPE = {
  doubleslap:  TAPAS_2A5,   // Tapa Duplo          poder 15  -- 13 espécies
  furyswipes:  TAPAS_2A5,   // Arranhões Furiosos  poder 18  -- 20
  furyattack:  TAPAS_2A5,   // Ataque Fúria        poder 15  -- 17
  cometpunch:  TAPAS_2A5,   // Soco Cometa         poder 18  -- 4
  spikecannon: TAPAS_2A5,   // Canhão de Espinhos  poder 20  -- 3
  barrage:     TAPAS_2A5,   // Barragem            poder 15  -- 2
  pinmissile:  TAPAS_2A5,   // Míssil Agulha       poder 14  -- 6
  iciclespear: TAPAS_2A5,   // Lança de Gelo       poder 10  -- 1 (Shellder)
  rockblast:   TAPAS_2A5,   // Rajada de Rochas    poder 25  -- 6
  /* ⚠️ ESTES DOIS SÃO DE "PRENDER", NÃO DE VÁRIOS TAPAS no jogo oficial (14/09/2026, a pedido:
     *"coloque que os moves fire spin e wrap, também ataquem de 2x a 5x igual outros ataques desse
     estilo que já existem"*). Lá eles prendem o alvo por 2 a 5 TURNOS, tirando uma fatia a cada um;
     aqui viram 2 a 5 tapas na mesma troca. O NÚMERO DE VEZES é o mesmo, e a distribuição também --
     o que muda é caberem num confronto só, que é como este motor resolve tudo.
     Os dois têm poder 15, igual ao Tapa Duplo e ao Ataque Fúria: o efetivo vai a 45. */
  firespin:    TAPAS_2A5,   // Redemoinho de Fogo  poder 15  -- 10 (a linha do Charmander, Vulpix/Ninetales, Ponyta/Rapidash, Moltres, Flareon, Entei)
  wrap:        TAPAS_2A5,   // Enrolar             poder 15  -- 11 (Bellsprout/Weepinbell, Ekans/Arbok, Tentacool/Tentacruel, Lickitung, a linha do Dratini, Shuckle)
  /* ⚠️ O SEMENTE-BALA ENTROU COM OS TMs (17/09/2026): ele é 2 a 5 tapas na Gen 3 e o golpe já
     estava na tabela (24 espécies o aprendem por máquina), mas como ninguém o aprende por NÍVEL
     ele nunca tinha passado por aqui. O poder efetivo dele vai de 10 pra 30, que é o que ele tira
     de verdade -- sem isso o motor nunca o escolheria e o TM09 seria dinheiro fora. */
  bulletseed:  TAPAS_2A5,   // Semente-Bala        poder 10  -- 24 espécies, todas por TM
  doublekick:  TAPAS_SEMPRE_2,   // Chute Duplo      poder 30  -- 8 espécies (a linha do Nidoran, Hitmonlee, Jolteon)
  bonemerang:  TAPAS_SEMPRE_2,   // Ossomerangue     poder 50  -- 2 (Cubone, Marowak)
  twineedle:   TAPAS_SEMPRE_2    // Agulha Dupla     poder 25  -- 4 (a linha do Caterpie e o Beedrill)
};
function tapasDoGolpe(golpeId, rng){
  const tabela = MULTI_GOLPE[golpeId];
  if(!tabela) return 1;
  let total = 0;
  for(const par of tabela) total += par[1];
  let r = (rng || Math.random)() * total;
  for(const par of tabela){ r -= par[1]; if(r < 0) return par[0]; }
  return tabela[tabela.length - 1][0];
}
/* O PODER QUE O MOTOR COMPARA na hora de escolher o golpe. Num golpe de vários tapas o número da
   tabela é o de UM tapa, e comparar 15 contra qualquer outra coisa faz o Tapa Duplo NUNCA ser
   escolhido -- a mecânica inteira viraria código morto em quem tem dois golpes.
   O que ele vale de verdade é poder × média de tapas: 15 × 3,0 = 45, que é o número certo pra
   comparação. Medido: sem isto o tapa saía em 0% dos confrontos de um Clefairy com dois golpes.
   ATENÇÃO: quem NÃO passa por aqui é a TELA DE ESCOLHA -- ela continua anunciando o poder cru (15)
   pro jogador. É a mesma ressalva que o CLAUDE.md já registra sobre STAB e subtipo ("Poder não é
   comparável entre dois golpes"), agora com um caso a mais. Não foi mexido porque não foi pedido. */
/* =====================================================================
   DRENAGEM NO GOLPE: tira do adversário e devolve pra si, NO MESMO INSTANTE (15/09/2026, a pedido).
   É o PRIMEIRO efeito do jogo colado num GOLPE COMUM. Os onze do `tentarGolpeEspecial` são
   sorteados na abertura e valem por CONFRONTO; este vale por GOLPE, toda vez que o golpe sai, sem
   sorteio nenhum -- quem decide se ele acontece é o motor ter escolhido aquele golpe.
   A FRAÇÃO É 50%, a do jogo oficial: os cinco drenantes devolvem metade do dano.
   ⚠️ ELA NÃO ENTRA NA NOTA do `melhorAtaque`, e isso é decisão: quem escolhe continua sendo o DANO.
   DUPLICADA no cliente, como todas as do motor -- o dano roda dos dois lados, e o teste compara. */
const GOLPES_DRENO = {
  absorb:     0.5,   // Absorver          poder 20
  megadrain:  0.5,   // Mega Dreno        poder 40
  gigadrain:  0.5,   // Giga Dreno        poder 60
  leechlife:  0.5,   // Sanguessuga       poder 20
  dreameater: 0.5    // Comedor de Sonhos poder 100 -- SÓ contra alvo dormindo, ver abaixo
};
/* ⚠️ O COMEDOR DE SONHOS SÓ VALE CONTRA ALVO DORMINDO (15/09/2026, a pedido), como no jogo oficial.
   A trava mora na ESCOLHA (`melhorAtaque` tira o golpe dos candidatos) e não no dano: barrado só no
   dano, o motor escolheria um golpe de 100 e aplicaria zero.
   Ver o comentário completo no index.html, que é onde a medição está registrada. */
const GOLPES_SO_DORMINDO = { dreameater: true };
/* =====================================================================
   O ROLAMENTO DOBRA A CADA USO SEGUIDO (14/09/2026, a pedido: *"dobrar o poder a cada uso, depois
   de 5x usados consecutivamente, reseta o poder para 30 novamente, caso use outro ataque sem ser o
   Rollout, reseta também"*).
   É o PRIMEIRO golpe do jogo cujo poder depende do que aconteceu nas trocas anteriores -- até aqui
   o poder era um número fixo da tabela, e o único que variava era o de vários tapas (que varia por
   sorteio, não por histórico).
   30 → 60 → 120 → 240 → 480, e o 6º uso volta pra 30. O contador vive na INSTÂNCIA e começa com
   `_`, então ele não vai pro Firestore (ver limparParaFirestore) e é solto no fim da batalha
   junto com os outros marcadores -- sem isso um Golem sairia da luta com o Rolamento carregado e a
   próxima batalha começaria com 480 de poder. */
/* ⚠️ A FACHADA (TM42) DOBRA COM STATUS, e ela é o PRIMEIRO golpe do jogo cujo poder depende do
   ESTADO de quem usa (17/09/2026). Até aqui só o Rolamento variava, e ele depende do HISTÓRICO
   (quantas vezes saiu seguido), não de uma condição.
   No jogo oficial ela dobra com queimadura, veneno ou paralisia. O que ela também faz lá -- ignorar
   o corte de ataque da queimadura -- fica de fora: ali seria um segundo caminho no effectiveAttack
   só pra um golpe, e o ×2 que já está aqui cobre o efeito prático. Fica registrado.
   ⚠️ E ELA ENTRA NA `nota` TAMBÉM, não só no dano: sem isso o motor deixaria de escolhê-la
   justamente quando ela é o melhor golpe do pokémon -- e é a lição do EXPOENTE_TIPO, que vale pra
   toda regra que mexe em poder. */
const GOLPE_FACHADA = "facade";
const FACHADA_MULT = 2;
function comStatus(p){
  return !!(p && (p._queimado || p._envenenado || p._paralisado));
}
function multDaFachada(golpeId, quemBate){
  return (golpeId === GOLPE_FACHADA && comStatus(quemBate)) ? FACHADA_MULT : 1;
}
const GOLPE_ROLAMENTO = "rollout";
const ROLAMENTO_USOS = 5;
/* A escala do golpe DESTE pokémon AGORA: 1, 2, 4, 8, 16. Ela multiplica o poder E a nota -- se
   entrasse só no dano, o motor escolheria por uma regra e aplicaria outra, que é a lição do
   EXPOENTE_TIPO e a da chuva. */
function escalaDoRolamento(p, golpeId){
  if(golpeId !== GOLPE_ROLAMENTO) return 1;
  return Math.pow(2, (p && p._rolamento) || 0);
}
/* Chamado UMA VEZ por ataque, depois de o golpe sair (ver golpesDaTroca). Golpe diferente zera --
   é o "caso use outro ataque, reseta também" do pedido, e ele vale para os dois lados: quem toma
   um Rolamento não carrega nada, quem dá só acumula enquanto insistir. */
function atualizarRolamento(p){
  if(!p) return;
  if(p.lastMove !== GOLPE_ROLAMENTO){ p._rolamento = 0; return; }
  p._rolamento = ((p._rolamento || 0) + 1) % ROLAMENTO_USOS;
}
function poderEfetivo(golpeId){
  const base = (GOLPES[golpeId] || [])[1] || 0;
  const tabela = MULTI_GOLPE[golpeId];
  if(!tabela) return base;
  let soma = 0, peso = 0;
  for(const par of tabela){ soma += par[0] * par[1]; peso += par[1]; }
  return base * (soma / peso);
}
const CHANCE_METRONOMO_EFEITO = 0.10;   // por efeito: 10% cada um dos três, 70% golpe comum
const CHANCE_DISABLE = 0.10;
const CHANCE_RECUPERAR = 0.10;
/* O SINO CURATIVO (Heal Bell) -- a MESMA mecânica do Recuperar, com outro nome e outro dono
   (14/09/2026, a pedido: *"adicionar a habilidade passiva Heal Bell da Miltank e Celebi, tendo a
   mesma mecânica que o RECOVER do Alakazam"*). Ele cai no mesmo ramo `'cura'`: abre o confronto,
   só vale abaixo de `CURA_MAXIMO_DO_HP`, e é `continue` -- a luta acontece inteira depois.
   ⚠️ O CELEBI JÁ ESTÁ NO `RECUPERACAO`, e o Recuperar vem ANTES na fila: ele cura com "Recuperar"
   em 10% e o Sino sai na chance composta (0,9 × 10% = 9%). Na prática isso não roda -- ele é
   INTOCÁVEL e ninguém o captura --, e a entrada fica porque é o que foi pedido e o que o jogo
   original diz. Quem aparece de verdade é a MILTANK, que não tem outro especial e cura nos 10%. */
const SINO_CURATIVO = ["miltank", "celebi"];
const CHANCE_SINO = 0.10;
/* ⚠️ A PASSIVA DE DRENAGEM ACABOU (15/09/2026, a pedido: *"retire a habilidade passiva Absorver
   que vários pokémons têm também, assim como o Zubat que tem o sanguessuga"*).
   Ela era a drenagem de ABERTURA: 10% por confronto, 23 espécies, tirava 10%-30% do teto do alvo e
   punha em si ANTES da luta. Existia porque o golpe drenante não fazia nada -- era a única forma de
   o Zubat "usar Sanguessuga".
   ⚠️ COM A DRENAGEM NO GOLPE (ver a seção dela) ela virou a MESMA coisa duas vezes, e pior: a
   passiva era sorteada e a do golpe acontece sempre, então o mesmo Oddish tinha duas drenagens com
   regras diferentes e o jogador não tinha como saber qual estava vendo.
   A APRESENTAÇÃO DELA FICA (as entradas 'absorb' e 'absorbdano' no log, na animação e na
   reconstrução): diário gravado antes de hoje tem as duas, e sem elas aquele log perde uma linha e
   a soma para de fechar. É a mesma decisão do 'desempate' e da marca 'm' do moribundo. O que não
   existe mais é GERAR um caso novo. */
/* A cura só sai com a vida ABAIXO disso. Com o pokémon quase cheio não há o que recuperar, e a
   frase anunciaria um efeito que mal se vê na barra. */
const CURA_MAXIMO_DO_HP = 0.7;
/* CONFUSÃO: o adversário se acerta, e a luta acontece inteira depois (10/09/2026, a pedido).
   Quem confunde tem 10% por CONFRONTO de deixar o outro confuso. O confuso leva UM golpe DELE
   MESMO -- um ESPELHO: mesma espécie, nível, atributos e golpe -- e só então a luta começa, do
   zero, "como se estivesse começando uma nova".
   É `continue`, não `return true`: como o Recuperar, a anulação, a drenagem e a fúria, ela é
   ABERTURA. Só a autodestruição e o sono resolvem o confronto. E NÃO MATA (piso de 1 de HP), a
   mesma regra da drenagem.
   O DANO É SEM TIPO E SEM CRÍTICO, como no jogo oficial -- ver a chamada do calcDamage lá embaixo.
   ONZE GOLPES CONFUNDEM, e não só a Confusão. Foi reportado assim: "alguns pokémons também
   possuem confusão que você não colocou, mas porque o nome é outro, como o Zubat, Tentacool,
   Magnemite, que possuem Supersonic". Os onze da Gen 3 que confundem o ALVO:
     status  -- Supersom, Raio Confuso, Beijo Doce, Bravata, Bajulação
     de dano -- Confusão, Psicoraio, Soco Tonto, Pulso de Água, Feixe de Sinal, Soco Dinâmico
   FICAM DE FORA o Outrage, o Petal Dance e o Thrash: eles confundem o PRÓPRIO USUÁRIO no fim da
   sequência, que é outro efeito. E o Teeter Dance não existe no aprendizado por nível da base.
   CADA ESPÉCIE GUARDA O NOME DO GOLPE DELA, como o SONIFEROS -- sem isso o Zubat confundiria com
   "Confusão", e quem conhece o jogo notaria na hora. Quando ela aprende mais de um, fica com o
   que aprende MAIS CEDO: é o que ela carrega pela maior parte da vida.
   A LISTA saiu da base por script, não foi escrita à mão: são as 82 espécies que aprendem algum
   dos onze por NÍVEL na Gen 3. O MEWTWO e o MEW não entram -- o tentarGolpeEspecial corta o bloco
   inteiro quando qualquer um dos dois está no confronto, e a entrada seria letra morta. */
/* ⚠️ OS GOLPES DE DANO QUE CONFUNDEM, com o nome que a frase mostra. Eles são os que estão na
   tabela GOLPES (os de status -- Supersom, Raio Confuso, Bravata, Beijo Doce, Bajulação -- não
   têm poder e por isso nunca entraram nela).
   Ela existe pro pedido dos TMs: quem CARREGA um deles ganha a passiva de confusão, mesmo que a
   espécie não esteja no CONFUSAO. Ver `golpeQueConfunde`.
   O nome sai do GOLPES_PT, então ele é o MESMO que o log e o cartão mostram -- escrito à mão aqui,
   a frase da confusão nomearia um golpe com uma palavra e o log com outra. */
const GOLPES_QUE_CONFUNDEM = {
  confusion: 1, psybeam: 1, signalbeam: 1, dynamicpunch: 1, waterpulse: 1, dizzypunch: 1
};
Object.keys(GOLPES_QUE_CONFUNDEM).forEach(id => { GOLPES_QUE_CONFUNDEM[id] = GOLPES_PT[id] || id; });
/* ⚠️ COM QUE GOLPE ESTE POKÉMON CONFUNDE -- e a resposta tem DUAS fontes desde 17/09/2026.
   A primeira é a de sempre: a espécie está no CONFUSAO, e o nome do golpe é o DELA (o Zubat
   confunde com Supersom e o Alakazam com Confusão -- sem isso os dois confundiriam com a mesma
   palavra, que foi o relato que criou a tabela).
   A segunda é o pedido dos TMs: *"os TMs que dão habilidade passiva, como o TM03 (Water Pulse), o
   pokemon também deve ganhar a habilidade passiva enquanto estiver com esse movimento"*. Ou seja,
   quem CARREGA um golpe que confunde ganha a passiva -- mesmo que a espécie não esteja na tabela.
   ⚠️ E ELA VALE PRA QUALQUER GOLPE QUE CONFUNDA, não só pro Water Pulse: a regra é "o golpe dá a
   passiva", e limitar ao TM03 seria a mesma exceção que este projeto passa a vida tirando. Hoje
   isso alcança os golpes de DANO que confundem (Confusão, Psicoraio, Feixe de Sinal, Soco
   Dinâmico, Pulso de Água, Soco Tonto) -- os de status (Supersom, Raio Confuso, Bravata, Beijo
   Doce, Bajulação) não entram na tabela de golpes e continuam vindo só pela espécie.
   ⚠️ O GOLPE CARREGADO VEM PRIMEIRO: um Kabuto que ensinou o TM03 já confundia com "Pulso de Água"
   pela espécie, e o resultado é o mesmo; mas um Blastoise que ensinou passa a confundir com o
   NOME do golpe que ele leva, e não com nada. */
function golpeQueConfunde(p){
  const leva = (p && p.ataques) || [];
  for(const id of leva){ if(GOLPES_QUE_CONFUNDEM[id]) return GOLPES_QUE_CONFUNDEM[id]; }
  return CONFUSAO[p && p.speciesId] || null;
}
const CONFUSAO = {
  aerodactyl:'Supersom', alakazam:'Confusão', butterfree:'Confusão', celebi:'Confusão',
  chinchou:'Supersom', cleffa:'Beijo Doce', cloyster:'Supersom', crobat:'Supersom',
  dewgong:'Feixe de Sinal', drowzee:'Confusão', entei:'Bravata', espeon:'Confusão',
  exeggcute:'Confusão', exeggutor:'Confusão', gastly:'Raio Confuso', gengar:'Raio Confuso',
  girafarig:'Confusão', golbat:'Supersom', goldeen:'Supersom', golduck:'Confusão',
  haunter:'Raio Confuso', hoothoot:'Confusão', hypno:'Confusão', igglybuff:'Beijo Doce',
  kabuto:'Pulso de Água', kadabra:'Confusão', kangaskhan:'Soco Tonto', lanturn:'Supersom',
  lapras:'Raio Confuso', ledian:'Supersom', ledyba:'Supersom', lickitung:'Supersom',
  machamp:'Soco Dinâmico', machoke:'Soco Dinâmico', machop:'Soco Dinâmico', magby:'Raio Confuso',
  magmar:'Raio Confuso', magnemite:'Supersom', magneton:'Supersom', mankey:'Bravata',
  mantine:'Supersom', meowth:'Bravata', misdreavus:'Raio Confuso',
  mrmime:'Confusão', natu:'Raio Confuso', nidoranf:'Bajulação', nidoranm:'Bajulação',
  nidorina:'Bajulação', nidorino:'Bajulação', ninetales:'Raio Confuso', noctowl:'Confusão',
  octillery:'Psicoraio', persian:'Bravata', pichu:'Beijo Doce', politoed:'Bravata',
  porygon:'Psicoraio', porygon2:'Psicoraio', primeape:'Bravata', psyduck:'Confusão',
  remoraid:'Psicoraio', seaking:'Supersom', shellder:'Supersom', slowbro:'Confusão',
  slowking:'Confusão', slowpoke:'Confusão', smoochum:'Beijo Doce', stantler:'Raio Confuso',
  starmie:'Raio Confuso', tauros:'Bravata', tentacool:'Supersom', tentacruel:'Supersom',
  togepi:'Beijo Doce', togetic:'Beijo Doce', umbreon:'Raio Confuso', unown:'Confusão',
  venomoth:'Supersom', venonat:'Supersom', vulpix:'Raio Confuso', wobbuffet:'Confusão',
  xatu:'Raio Confuso', yanma:'Supersom', zubat:'Supersom'
};
const CHANCE_CONFUSAO = 0.10;   // por confronto, como o Disable, o Recuperar e a drenagem
/* FÚRIA DO DRAGÃO: 40 de HP no adversário, na abertura do confronto (11/09/2026, a pedido).
   É o NONO golpe especial, ao lado do sono, da autodestruição, do Metrônomo, do Disable, do
   Recuperar, da drenagem, da fúria e da confusão -- e o mais simples de todos: não sorteia dano,
   não olha tipo, não olha atributo. São 40, sempre, como no jogo oficial.
   É ABERTURA e NÃO resolve o confronto ('continue', como o Recuperar, a anulação, a drenagem, a
   fúria e a confusão): o adversário começa a luta 40 de HP mais pobre e ela acontece INTEIRA
   depois -- que é o pedido ao pé da letra ("o motor deve calcular a batalha como se fosse uma
   nova batalha começando").
   NÃO MATA: piso de 1 de HP, a mesma regra da drenagem e da confusão. Um efeito de abertura que
   resolvesse o confronto sozinho seria um confronto sem um único golpe na tela.
   O DANO É FIXO E É ISSO QUE ELE É. No motor daqui todo golpe é uma fração da vida do alvo, então
   um número cru pesa MUITO diferente conforme o nível: 40 num Dratini Lv.22 (181 de teto) é 22%
   da barra, e num Dragonite Lv.70 (466) é 8,6%. É o mesmo desenho do jogo original, onde a Fúria
   do Dragão é forte cedo e vira lembrança depois -- e é por isso que ela não precisa de teto: o
   crescimento do jogo já a aposenta sozinha.
   A LISTA são as 7 espécies que aprendem Dragon Rage por NÍVEL na Gen 3, a mesma regra das outras
   sete listas, e ela saiu da base (data/golpes.json) por script -- não foi escrita à mão.
   A linha do Charmander aparece porque ela aprende MESMO (nível 43/48/54 no FireRed); a intuição
   de que seria só a dos dragões erra.
   ELA NÃO DISPUTA VAGA DE GOLPE, e isso é dado e não decisão: `dragonrage` tem poder VARIÁVEL, e
   os 22 golpes de poder variável ficaram fora da tabela GOLPES quando a base da Gen 3 entrou. Ou
   seja, ela nunca foi escolhível -- e sem esta passiva ela não existia no jogo.
   ELA VEM POR ÚLTIMO NO SORTEIO, depois até da confusão, e é a mesma decisão de sempre:
   acrescentar um efeito no FIM da fila não dilui nenhum dos que já estavam medidos. Quem cai na
   chance composta é ela -- a linha do Charmander, que já tem Fúria (30%), sai em 0,7 x 10% = 7%.
   O MEWTWO e o MEW não entram (nenhum dos dois aprende, e o tentarGolpeEspecial corta o bloco
   inteiro quando um deles está no confronto: a entrada seria letra morta). */
const FURIA_DRAGAO = ['charmander','charmeleon','charizard','gyarados','dratini','dragonair','dragonite'];
const CHANCE_FURIA_DRAGAO = 0.10;   // por confronto, como o Disable, o Recuperar, a drenagem e a confusão
const FURIA_DRAGAO_DANO = 40;       // fixo, como no jogo oficial -- não escala com nível nem com atributo
const IMUNES_A_ESPECIAL = ['mew','mewtwo'];
/* Aprendem Autodestruição por nível na Gen 1/2. */
const AUTODESTRUICAO = ['geodude','graveler','golem','voltorb','electrode','koffing','weezing','pineco','forretress'];
/* Aprendem um golpe de SONO por nível na Gen 1/2 -- o valor é o nome que aparece no log. */
const SONIFEROS = {
  /* Acrescentadas na auditoria de 04/09/2026 (o Politoed foi reportado por um jogador): a lista de
     Hipnose era só a da Gen 1, e faltavam o Tangela e a Smoochum. */
  politoed:'Hipnose', noctowl:'Hipnose', yanma:'Hipnose', misdreavus:'Hipnose',
  tangela:'Pó do Sono', smoochum:'Canto',
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
/* METRÔNOMO: quem sorteia um golpe a cada ataque -- e agora ESCOLHE entre ele e os próprios.
   COMO ERA ATÉ 10/09/2026: a espécie atacava com um TIPO sorteado, poder implícito de 60, e NUNCA
   chegava no melhorAtaque. Ou seja, ela não tinha golpe escolhido nenhum -- o Togepi lutava de
   Metrônomo até o fim da vida, mesmo depois de aprender Poder Ancestral no 21.
   COMO É AGORA (a pedido): a cada golpe o Metrônomo sorteia um ATAQUE DE VERDADE da tabela -- com
   tipo e poder próprios -- e ele entra na MESMA disputa dos golpes que o pokémon escolheu. Sai o
   que tirar mais dano contra quem está na frente. Quem ainda não tem golpe nenhum (o Togepi antes
   do 21) continua lutando só de Metrônomo, exatamente como antes.
   É ISSO QUE FAZ DELE UMA APOSTA E NÃO UM UPGRADE: o sorteio pode entregar um Hiper Raio ou uma
   Constrição de poder 10; o que muda é que agora ele nunca fica ABAIXO do que a espécie já tem.
   A LISTA são as espécies que aprendem Metrônomo por nível no original, mais o Mew. O Snubbull SAIU
   dela (ele não aprende Metrônomo por nível na Gen 3 -- ver a tabela de divergências do CLAUDE.md)
   e passou a lutar com o moveset dele, que é grande: Mordida, Talho, Derrubada.
   O SNORLAX SAIU EM 11/09/2026, a pedido, e ele era o lugar que este arquivo já apontava como a
   alavanca da lista ("tirar Snorlax, que é a mais comum em time de jogador"). Ele também não
   aprende Metrônomo por nível na Gen 3 -- estava aqui por pedido, como o Snubbull esteve --, e o
   moveset dele é o oposto do da Clefairy: Golpe de Corpo (85), Hiper Raio (150) e Cabeçada (70).
   Ou seja, ao contrário dela ele não dependia do sorteio pra ter o que bater.
   O MEW entra porque o Metrônomo é dele no original. Ele é o chefe da raide e continua IMUNE ao
   bloco de efeitos (IMUNES_A_ESPECIAL corta antes do sorteio), então o que ele ganha aqui é só o
   golpe sorteado -- nunca a explosão, que acabaria com a raide da semana num golpe. */
const METRONOMO = ['cleffa','clefairy','clefable','mew','togepi','togetic'];
/* O BOLO DO SORTEIO é todo golpe de DANO da tabela. Vai ORDENADO de propósito: os dois motores têm
   a tabela escrita em ordens diferentes, e sortear por índice numa lista não ordenada faria o
   cliente e o servidor tirarem golpes DIFERENTES com a mesma semente -- a mesma batalha terminando
   diferente dos dois lados, que é o defeito que este projeto mais evita.
   Autodestruição e Explosão não estão na tabela (nunca estiveram), e é o certo: elas JÁ SÃO o
   efeito de 10% logo abaixo, com o custo de cair junto. Como golpe comum de 200 elas seriam o
   sorteio dos sonhos, sem preço nenhum. */
const POOL_METRONOMO = Object.keys(GOLPES).filter(id => GOLPES[id][1] > 0).sort();
function sorteiaGolpeDoMetronomo(rng){
  return POOL_METRONOMO[Math.floor((rng || Math.random)() * POOL_METRONOMO.length)];
}
/* Aprendem Disable por nível na Gen 1/2. Vulpix, Ninetales, a linha do Nidoran, Seel, Kangaskhan,
   Horsea, Spinarak e Stantler aprendem só por REPRODUÇÃO e ficaram de fora -- a regra das listas
   deste bloco é aprendizado por nível, sempre.
   O Mewtwo aprende Disable nas duas gerações e mesmo assim não está aqui: ele e o Mew são imunes
   ao bloco INTEIRO (IMUNES_A_ESPECIAL corta antes de sortear), então a entrada seria letra morta. */
const DISABLE = ['psyduck','golduck','kadabra','alakazam','slowpoke','slowbro','slowking',
                 'grimer','muk','lickitung','jigglypuff','wigglytuff','venonat','venomoth',
                 'drowzee','hypno',
                 'igglybuff'];   // Gen 2, achada na auditoria de 04/09/2026
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
/* DANÇA DA CHUVA: o primeiro CLIMA do jogo (11/09/2026, a pedido).
   Ela é diferente de tudo que veio antes neste motor, e em duas coisas:
   1) É POR BATALHA, não por confronto. Todos os nove especiais anteriores são sorteados dentro do
      `tentarGolpeEspecial`, uma vez por confronto; esta é sorteada ANTES da batalha começar, no
      `simulateGymBattle`, e vale pelos CHUVA_EM_CONFRONTOS primeiros confrontos dela.
   2) VALE PROS DOIS LADOS. Clima é do CAMPO, não de quem o invocou -- é assim no jogo oficial, e o
      pedido não põe lado nenhum ("durante esses 3 confrontos, os ataques de tipo água vão ter um
      acréscimo"). Ou seja, quem chama a chuva também fortalece o Vaporeon do adversário. É a
      decisão que mais muda o número: medida, ela é o que segura o custo na jornada.
   O SORTEIO É UM SÓ POR BATALHA, e isso é o pedido ao pé da letra ("ela tem 10% de chance de
   acontecer na batalha"): basta UM pokémon com Dança da Chuva em qualquer um dos dois times pra
   haver sorteio, e ele sai 10%. NÃO é 10% por portador -- com seis deles isso viraria 47%, e o
   pedido diz 10%. Se um dia a intenção for a outra, é trocar o `algum` por um laço.
   A LISTA são as 13 espécies que aprendem Rain Dance por NÍVEL na Gen 3, a mesma regra das outras
   listas, e ela saiu da base por script. O Lugia está nela por ser o que o dado diz, como já
   acontece no RECUPERACAO -- ele é INTOCÁVEL e ninguém o tem, então a entrada não roda hoje, mas
   é verdade e já estará certa no dia em que algum modo o puser em campo. */
const CHUVA = ['squirtle','wartortle','blastoise','poliwag','poliwhirl','gyarados','lapras',
               'marill','azumarill','wooper','quagsire','suicune','lugia'];
const CHANCE_CHUVA = 0.10;        // por BATALHA, sorteada antes do primeiro confronto
const CHUVA_EM_CONFRONTOS = 3;    // quantos confrontos ela dura
/* O QUE A CHUVA FAZ COM CADA TIPO DE GOLPE. É pelo tipo do GOLPE, não pelo tipo de quem bate: um
   Charizard usando um golpe Normal não perde nada, e um Pikachu usando Raio ganha os 25%. */
const CHUVA_MULT = { Water: 1.5, Fire: 0.5, Electric: 1.25 };
/* GOLPES QUE A CHUVA APAGA por NOME, além do tipo -- eles são de Planta e não entrariam pela
   tabela acima. O pedido cita dois: Raio Solar e Lâmina Solar.
   ⚠️ SÓ O RAIO SOLAR EXISTE AQUI: a `solarblade` é da Gen 7 e NÃO está na base da Gen 3, então
   cadastrá-la seria letra morta -- o mesmo motivo que manteve os estágios 2 a 4 do crítico fora do
   jogo. Se um dia a base mudar de geração, é uma linha. `tools/test-especiais.js` NOMEIA a
   ausência, pra ninguém achar que foi esquecimento. */
const CHUVA_GOLPE_MULT = { solarbeam: 0.5 };
/* QUANTOS CONFRONTOS DE CHUVA SOBRAM nesta batalha. Módulo-level pelo mesmo motivo do
   `explosaoDoAtivo` e do `itensGastos`: as funções do motor são compartilhadas por vários laços de
   batalha, e enfiar mais um parâmetro em todas seria pior que um estado zerado no começo de cada
   batalha. Uma batalha é síncrona do começo ao fim, então não existem duas rodando ao mesmo tempo. */
let chuvaRestante = 0;
function estaChovendo(){ return chuvaRestante > 0; }
/* APAGA O CLIMA. Tem nome porque TRES caminhos precisam dele e pelo mesmo motivo: o
   `chuvaRestante` e modulo-level e uma batalha acaba com chuva SOBRANDO sempre que a luta termina
   antes dos CHUVA_EM_CONFRONTOS confrontos. No servidor a instancia e reaproveitada entre
   invocacoes, entao sobra vira chuva na batalha de outra pessoa.
   Escrito a mao nos tres, o quarto caminho nasceria sem -- e o vazamento nao aparece como erro,
   aparece como um golpe de Fogo tirando metade sem nada na tela dizendo por que. */
/* ============================================================================
   O PODER SECRETO (TM43) -- 17/09/2026
   ----------------------------------------------------------------------------
   Pedido junto com os TMs: *"muitos desses TMs possuem efeito adicional, como o TM43 (Secret
   Power), que tem chance de aplicar um efeito conforme o terreno da batalha"*.

   ⚠️ AQUI O TERRENO É DE UM TIPO (são 51, seis de cada um dos 17), então o mapa é por TIPO.
   ⚠️ E ELE SÓ USA OS QUATRO STATUS QUE ACONTECEM POR ATAQUE, que é onde este golpe vive:
     Gelo → congela · Fogo → queima · Veneno → envenena · Elétrico → paralisa
   O SONO e a CONFUSÃO ficaram de fora **de propósito**: no motor os dois são de ABERTURA (são
   sorteados uma vez por confronto, antes do primeiro golpe), e aplicá-los no MEIO da troca seria
   mecânica nova -- com linha de log, passo de animação e medição próprios. Não foi o que se pediu.
   ⚠️ NOS OUTROS 13 TERRENOS ele é um golpe Normal de 70 e mais nada, e isso é honesto: inventar
   efeito pra preencher a tabela seria pior que ter terreno em que ele é "só" um golpe.

   ⚠️ E ELE SÓ VALE ONDE HÁ TERRENO: a jornada, a Elite e as ligas com terreno escolhido. Na TORRE
   e no ONLINE não existe terreno -- é a mesma fronteira que o selo 🔺 já tem, e o `tipoDoTerreno()`
   devolvendo null é o que a diz.

   ⚠️ O TIPO DO TERRENO VIAJA PELA MESMA PORTA DA CHUVA (estado de módulo, definido pelo chamador e
   LIMPO pelo `limparClima`), e isso é decisão: uma quarta variável de módulo com limpeza própria
   seria uma quarta porta de vazamento -- e o vazamento do clima foi REAL no servidor, onde a
   instância é reaproveitada entre invocações. Uma porta só, limpa nos mesmos três pontos.
   ============================================================================ */
const CHANCE_PODER_SECRETO = 0.30;
const GOLPE_PODER_SECRETO = "secretpower";
/* o valor é o CAMPO da instância e a guarda de imunidade -- os mesmos que cada status já usa */
const EFEITO_DO_TERRENO = {
  Ice:      { marca: "_congelado",  pode: podeCongelar },
  Fire:     { marca: "_queimado",   pode: podeQueimar },
  Poison:   { marca: "_envenenado", pode: podeEnvenenar },
  Electric: { marca: "_paralisado", pode: podeParalisar }
};
/* OS TIPOS DO TERRENO DESTA BATALHA, lidos da INSTÂNCIA (ver applyTerrainBuff). Sem terreno --
   na Torre e no online -- devolve lista vazia, e o TM43 vira um golpe Normal de 70 e mais nada. */
function terrenoDe(p){ return (p && p._terreno) || []; }
/* ⚠️ SORTEIA DEPOIS DE O GOLPE CONECTAR, e lê o rng da BATALHA -- e SAI ANTES do rng() quando o
   golpe não é o Poder Secreto, quando não há terreno ou quando o alvo é imune. Lido sempre, ele
   deslocaria a semente de TODA batalha que não tem o TM43 em campo: é a mesma armadilha do
   congelamento e do Remoinho.
   ⚠️ E A IMUNIDADE É A DE CADA STATUS, reusada: o Fogo não queima, o Gelo não congela, o Aço e o
   Veneno não se envenenam. Sem isso o Poder Secreto seria a porta dos fundos das quatro.
   Devolve a MARCA aplicada (o campo da instância) ou null -- é o que a linha do log precisa. */
function tentarPoderSecreto(quemBate, alvo, rng){
  if(!quemBate || quemBate.hp <= 0 || !alvo || alvo.hp <= 0) return null;
  if(quemBate.lastMove !== GOLPE_PODER_SECRETO) return null;
  /* ⚠️ COM MAIS DE UM TIPO NO TERRENO (46 dos 51 têm), vale o PRIMEIRO que dá efeito -- e a ordem
     é a da tabela do TERRENO, não a do EFEITO_DO_TERRENO. Assim o Pântano (Veneno/Planta/Fantasma)
     envenena e o Vulcão (Fogo/Terra) queima, que é o que o nome deles promete. */
  const tipo = terrenoDe(quemBate).find(t => EFEITO_DO_TERRENO[t]);
  const e = tipo && EFEITO_DO_TERRENO[tipo];
  if(!e || !e.pode(alvo) || alvo[e.marca]) return null;
  if(rng() >= CHANCE_PODER_SECRETO) return null;
  alvo[e.marca] = GOLPE_PODER_SECRETO;
  return e.marca;
}
function limparClima(){ chuvaRestante = 0; }
/* PÕE o clima de volta. Existe pro ONLINE, que resolve UM confronto por invocação: sem um jeito de
   restaurar o contador, a chuva morria no fim de cada confronto e durava 1 em vez de 3.
   Ver `battleResolveMatchup`. */
function definirClima(n){ chuvaRestante = Math.max(0, n | 0); }
function climaRestante(){ return chuvaRestante; }
/* O MULTIPLICADOR DA CHUVA, num lugar só -- e ESSE é o ponto.
   Ele é lido pelo DANO (`calcDamage`) E pelas DUAS escolhas de golpe (a `nota` do `melhorAtaque` e
   a do `bestAttackType`). Os três TÊM que usar o mesmo valor: quando a escolha usa um número e o
   dano usa outro, o motor escolhe um golpe e aplica outro -- foi exatamente o que aconteceu com o
   EXPOENTE_TIPO, que ficou comprimido no dano e cru na escolha, e fez cliente e servidor
   discordarem do melhor golpe em 4% dos confrontos.
   SEM CHUVA ele devolve 1, então tudo que existia antes continua idêntico ao que era. */
function multDaChuva(tipo, golpeId){
  if(!estaChovendo()) return 1;
  if(golpeId && CHUVA_GOLPE_MULT[golpeId] != null) return CHUVA_GOLPE_MULT[golpeId];
  return CHUVA_MULT[tipo] != null ? CHUVA_MULT[tipo] : 1;
}
/* SORTEIA A CHUVA NA ABERTURA DO CONFRONTO -- quando o portador ENTRA nele.
   ⚠️ ELA NASCEU SORTEADA ANTES DA BATALHA e durou uma versão: "10% de chance de acontecer na
   batalha" foi lido como um dado só, rolado no `simulateGymBattle`. O pedido era outro, e foi
   esclarecido: *"ele é por batalha mas a chance é sorteada quando o pokémon que possui essa
   habilidade passiva entra no confronto que deve ser ativada ou não"*.
   O "POR BATALHA" É O EFEITO, NÃO O SORTEIO, e essa é a diferença que importa: o dado rola a cada
   confronto em que um dos 13 entra, como todo o resto deste bloco; o que é POR BATALHA é a DURAÇÃO
   -- começou, ela atravessa CHUVA_EM_CONFRONTOS confrontos, e é o único efeito do motor que passa
   do confronto em que nasceu.
   OS DOIS LADOS SORTEIAM, um dado cada, como o `tentarGolpeEspecial` já faz com os outros: num
   confronto em que os dois têm Dança da Chuva a chance daquele confronto é 19%, não 10%.
   ENQUANTO CHOVE NINGUÉM SORTEIA DE NOVO. Ela não se renova: no jogo oficial usar o golpe de novo
   reinicia o contador, mas isso não foi pedido e faria o clima virar permanente num time de Água.
   Se um dia for pedido, é trocar o `if(estaChovendo()) return false` por um `chuvaRestante =
   CHUVA_EM_CONFRONTOS`.
   ELA É INDEPENDENTE do `sorteiaGolpeEspecial`, e isso é decisão: aquele devolve UM efeito por
   pokémon por confronto, então pôr a chuva lá faria o Gyarados (que já tem Fúria do Dragão) cair
   na chance composta e sair em 9%. O pedido diz 10%, e clima não é um golpe usado CONTRA o
   adversário -- é uma condição do campo. Por isso ela tem dado próprio. */
/* AS DUAS DANÇAS DE ATAQUE (12/09/2026, a pedido): *"uma diminui em 50% o attack do oponente e a
   outra aumenta em 50% o attack do usuario. Tem 20% de ocorrer no inicio de cada confronto"*.
   DANÇA DAS ESPADAS  -- quem usa fica com ×1,5 de Ataque.
   DANÇA DA PLUMA     -- o ADVERSÁRIO fica com ×0,5 de Ataque.
   As listas são as espécies que aprendem cada golpe por NÍVEL na Gen 3, a mesma regra das outras
   treze listas deste bloco: a linha do Pidgey na Pluma, e Farfetch'd, Scyther, Pinsir e Scizor nas
   Espadas.
   ⚠️ É O `effectiveAttack` E SÓ ELE -- o Ataque FÍSICO. Neste motor quem decide se um golpe usa o
   Ataque ou o Ataque Especial é o TIPO dele (`isSpecialType`, regra da Gen 1), e no jogo oficial as
   duas danças mexem no Ataque físico e mais nada. A consequência está MEDIDA na seção do CLAUDE.md:
   contra um atacante especial (Psíquico, Fogo, Água, Planta, Elétrico, Gelo, Dragão) a Pluma não
   tira um ponto de dano, e é o mesmo efeito que os itens de atributo já têm.
   O MULTIPLICADOR ENTRA POR ÚLTIMO, depois dos flats (item e fúria): "50% do ataque" é 50% do que o
   pokémon TEM de verdade na hora do golpe. Entrando antes, ele multiplicaria só a parte base e o
   +15 do item ficaria de fora da conta.
   NÃO ACUMULA e não atravessa confronto: os dois marcadores são LIMPOS no começo de cada confronto
   e sorteados de novo, que é o "no início de cada confronto" do pedido ao pé da letra. */
const DANCA_ESPADAS = ['farfetchd', 'pinsir', 'scizor', 'scyther'];
const DANCA_PLUMA = ['pidgeot', 'pidgeotto', 'pidgey'];
const CHANCE_DANCA = 0.20;
const DANCA_ESPADAS_MULT = 1.5;   // no Ataque de QUEM USA
const DANCA_PLUMA_MULT = 0.5;     // no Ataque do ADVERSÁRIO
/* Os dois multiplicam o MESMO atributo e podem coexistir: um Pinsir que dançou as espadas contra um
   Pidgeot que dançou a pluma fica em 1,5 × 0,5 = 0,75. */
function withDanca(v, p){
  if(!p) return v;
  let r = v;
  if(p._espadas) r = r * DANCA_ESPADAS_MULT;
  if(p._pluma) r = r * DANCA_PLUMA_MULT;
  return Math.round(r);
}
/* ⚠️ A QUEIMADURA CORTA O ATAQUE FISICO PELA METADE, e ela entra pela MESMA porta da Danca da
   Pluma -- que ja e exatamente este efeito (x0,5 no Ataque) com outro gatilho. Sendo um degrau do
   effectiveAttack, ela vale de graca nos SEIS pontos do motor que leem ataque fisico, e nenhum
   caminho novo nasce sem ela.
   O ATAQUE ESPECIAL NAO E TOCADO, que e a regra: neste motor quem decide fisico x especial e o
   TIPO do golpe (isSpecialType, regra da Gen 1). Medido nas 250: 115 especies atacam SEMPRE pelo
   fisico (a queimadura morde inteiro), 91 sempre pelo especial (ela nao tira um ponto de dano) e
   44 variam conforme o alvo.
   ⚠️ ELA ENTRA DEPOIS DOS MULTIPLICADORES E DO FLAT, como a danca: "metade do ataque" e metade do
   que o pokemon TEM na hora do golpe, e nao metade so da parte base. */
function withQueimadura(v, p){
  return (p && p._queimado) ? Math.round(v * QUEIMADURA_FISICO) : v;
}
/* O SORTEIO TEM DADO PRÓPRIO e roda ANTES do sorteio de efeito, como a chuva: assim as duas danças
   não disputam a vaga única do `sorteiaGolpeEspecial` -- se disputassem, o Pidgey (que já tem
   Remoinho) veria a Pluma sair menos que os 20% pedidos.
   OS DOIS LADOS SORTEIAM, um dado cada. */
function tentarDancas(a, b, rng, diario){
  const r = rng || Math.random;
  /* LIMPA PRIMEIRO: o efeito é por CONFRONTO, então o que sobrou do anterior não vale mais. */
  [a, b].forEach(p => { if(p){ p._espadas = false; p._pluma = false; } });
  const lados = [[a, 'p', b], [b, 'e', a]];
  for(const [p, marca, alvo] of lados){
    if(!p) continue;
    /* ESPADAS: quem usa fica mais forte. */
    if(DANCA_ESPADAS.includes(p.speciesId) && r() < CHANCE_DANCA){
      p._espadas = true;
      if(diario) diario.push({ q: marca, d: 0, hp: null, c:0, m:0, z:0, x:'espadas', g:'Dança das Espadas' });
    }
    /* PLUMA: o ADVERSÁRIO fica mais fraco. O `q` continua sendo de QUEM USOU o golpe -- a convenção
       do diário, a mesma do sono e da confusão --, e é dela que a frase sai com os lados certos. */
    if(alvo && DANCA_PLUMA.includes(p.speciesId) && r() < CHANCE_DANCA){
      alvo._pluma = true;
      if(diario) diario.push({ q: marca, d: 0, hp: null, c:0, m:0, z:0, x:'pluma', g:'Dança da Pluma' });
    }
  }
}
function tentarChuva(a, b, rng, diario){
  if(estaChovendo()) return false;
  const r = rng || Math.random;
  /* O `q` do registro é de QUEM USOU o golpe -- a convenção do diário, a mesma do sono e da
     confusão. O `a` é sempre o lado 'p' do confronto e o `b` o 'e'. */
  const lados = [[a, 'p'], [b, 'e']];
  for(const [p, marca] of lados){
    if(!p || !CHUVA.includes(p.speciesId)) continue;
    if(r() < CHANCE_CHUVA){
      chuvaRestante = CHUVA_EM_CONFRONTOS;
      /* A LINHA SÓ SAI NO CONFRONTO EM QUE ELA COMEÇA, e é isso que foi pedido: "no log, você vai
         escrever somente na batalha que foi ativada a dança da chuva". Os confrontos seguintes,
         que só herdam a chuva, são marcados pelo 🌧️ em cima do × -- não por outra linha.
         Dano ZERO e `x` preenchido: ela É um passo da animação (barra parada), como o sono, e é
         por isso que ela ganha a pausa de 1s antes de a luta começar. */
      if(diario){
        diario.push({ q: marca, d: 0, hp: p.hp, c:0, m:0, z:0, x:'chuva', g:'Dança da Chuva' });
      }
      return true;
    }
  }
  return false;
}
let explosaoDoAtivo = null;
function ehImuneAEspecial(p){ return IMUNES_A_ESPECIAL.includes(p.speciesId); }
function sorteiaGolpeEspecial(p, rng){
  /* A FÚRIA VEM ANTES DE TUDO, inclusive do Metrônomo: ela é abertura e não resolve o confronto,
     e deixá-la pra depois faria o Snubbull (o único dos 19 com outro especial) nunca entrar em
     fúria, porque o Metrônomo corta o sorteio ali mesmo. O preço é o de sempre: quem tem dois cai
     na chance composta -- o Metrônomo do Snubbull sai 30% menos. */
  if(FURIA.includes(p.speciesId) && rng() < CHANCE_FURIA){
    return { efeito:'furia', golpe:'Fúria' };
  }
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
  if(RECUPERACAO.includes(p.speciesId) && rng() < CHANCE_RECUPERAR){
    return { efeito:'cura', golpe:'Recuperar' };
  }
  /* O SINO CURATIVO vem logo depois, e cai no MESMO ramo de efeito -- o que muda é o nome que a
     frase e o selo mostram. Ver SINO_CURATIVO. */
  if(SINO_CURATIVO.includes(p.speciesId) && rng() < CHANCE_SINO){
    return { efeito:'cura', golpe:'Sino Curativo' };
  }
  /* A drenagem vem por último. Quem tem dois especiais cai na chance composta, como o Kadabra
     (Disable + Recuperar): um Vileplume, que também é sonífero, absorve em 0,95 x 10% = 9,5%. */
  /* A CONFUSÃO VEM POR ÚLTIMO, e isso é de propósito: acrescentar um efeito no FIM da fila não
     dilui nenhum dos que já estavam medidos -- quem cai na chance composta é ela. Um Alakazam
     (Disable + Recuperar + Confusão) confunde em 0,9 × 0,9 × 10% = 8,1%. */
  const confundeCom = golpeQueConfunde(p);
  if(confundeCom && rng() < CHANCE_CONFUSAO){
    return { efeito:'confusao', golpe: confundeCom };
  }
  /* A FÚRIA DO DRAGÃO É A ÚLTIMA DA FILA, pelo mesmo motivo que a confusão foi um dia: o efeito que
     entra no FIM não dilui nenhum dos que já estavam medidos -- quem paga a chance composta é ele.
     A linha do Charmander, que já tem Fúria (30%), dispara esta em 0,7 x 10% = 7%; o Gyarados e a
     linha do Dratini, que não têm outro especial, ficam nos 10% cheios. */
  if(FURIA_DRAGAO.includes(p.speciesId) && rng() < CHANCE_FURIA_DRAGAO){
    return { efeito:'furiadragao', golpe:'Fúria do Dragão' };
  }
  return null;
}
/* Devolve true quando o confronto foi RESOLVIDO aqui (e o doExchange não deve nem começar). */
/* ITENS EQUIPADOS. O item vive NO POKÉMON (p.item), não na batalha: quem equipa escolhe em QUEM,
   na tela de ordem, e o efeito é só daquele bicho. Antes era um efeito da conta inteira -- um
   Despertar de 10 minutos protegia o time todo -- e virou item equipado em 03/09/2026, a pedido.
   Quem põe o campo nas instâncias é o equiparItens, chamado antes de cada batalha do mesmo jeito
   que o applySpecialtyBuff. Quem SÓ o servidor escreve é a lista de equipados da conta; o p.item da
   instância é uma cópia de trabalho.
   Ficam em variável de módulo pelo mesmo motivo do explosaoDoAtivo: as funções do motor são
   compartilhadas e enfiar mais um parâmetro em todas seria pior que um estado zerado no começo de
   cada batalha. */
/* Quanto cada poção cura, em fração do HP máximo. Vive aqui porque é o motor que aplica. */
const CURA_DA_POCAO = { potion: 0.55, hyperpotion: 0.80 };
/* O QUE FOI GASTO nesta batalha: [{ dono:'p'|'e', especie, item }]. Quem chamou a batalha usa isso
   pra tirar o item da conta -- o motor não fala com o banco. */
let itensGastos = [];
/* Quem chamou a batalha lê isto pra tirar da conta o que foi gasto. É função e não a variável
   direto porque ela é REATRIBUÍDA a cada batalha (itensGastos = []), e quem tivesse guardado a
   lista antiga ficaria olhando pra uma batalha que já acabou. */
function itensGastosDaBatalha(){ return itensGastos; }
/* Põe o item equipado em cada instância do time. equipados é o mapa da conta (espécie -> item),
   montado por quem chama a partir do que o servidor gravou. O parametro equipados e um mapa
   especie -> item. Fica junto do applySpecialtyBuff nas
   chamadas de batalha de propósito: são a mesma coisa -- estado da conta virando flag na instância. */
/* De qual SAVE cada pokémon veio. Na jornada o time é todo de um slot só (o slotPadrao); na Torre
   e no Ginásio da Cidade ele MISTURA saves, e cada bicho traz o slot de onde saiu -- por isso o
   slot é por POKÉMON e não por time. */
function equiparItens(team, equipados, slotPadrao){
  if(!team) return;
  /* O _itemGastoAnotado zera junto: ele é por BATALHA (o item de atributo vale a batalha inteira e
     só depois some), e uma marca sobrando de uma batalha anterior faria o gasto não ser anotado. */
  team.forEach(p => {
    if(!p) return;
    /* ⚠️ O CARIMBO É REFEITO A CADA CHAMADA, e isso mudou em 14/09/2026 (reportado). Ele era
       um carimbo de UMA VEZ SÓ (escrito só quando o campo estava vazio) -- ou seja, GRUDAVA na
       instância, e instância vai pro SAVE. Um
       Pikachu equipado no slot 3 gravava `slotDaConta:"3"` dentro do save dele; qualquer leitura
       posterior daquele pokémon procurava o item do SLOT 3, e o jogador via o Pikachu de outro
       save marcado com a poção que não é dele. Relatado exatamente assim.
       A PRECEDÊNCIA é: o slot do PRÓPRIO pokémon (`p.slot`, que só time misturado carrega) > o
       slot que QUEM CHAMOU informou > o carimbo que já estava lá. O terceiro degrau existe pros
       times misturados do servidor (Torre, Ginásio da Cidade), que carimbam o slot por pokémon e
       chamam esta função SEM slotPadrao -- ali não há o que informar e o carimbo é a verdade.
       Na jornada é o contrário: quem sabe de qual save o time é, é sempre quem chamou. */
    p.slotDaConta = (p.slot != null) ? String(p.slot)
                  : (slotPadrao != null ? String(slotPadrao)
                  : (p.slotDaConta != null ? String(p.slotDaConta) : null));
    p.item = itemEquipado(equipados, p.slotDaConta, p.speciesId);
    p._itemGastoAnotado = false;
  });
}
/* Abaixo disso (25%) a poção dispara. É "sobrou raspando", não "levou um arranhão". */
const POCAO_GATILHO_HP = 0.25;
/* ⚠️ WHIRLWIND (12/09/2026, a pedido): 20% de chance, quando o pokémon que tem entra no confronto,
   de SOPRAR PRA FORA o ativo do treinador adversário -- e entra no lugar um outro do time dele,
   sorteado. Pedida assim: *"20% de chance de sucesso, e quando acontecer, troca o pokemon ativo do
   treinador adversario por um outro aleatorio do time dele. Importante que se o pokemon do
   adversario ja tava em uma batalha e sofreu dano, quando ele voltar para a batalha, volte com o
   mesmo tanto de hp"*.
   ⚠️ ELE É O PRIMEIRO ESPECIAL QUE NÃO CABE NO `tentarGolpeEspecial`, e é por isso que mora aqui:
   os onze de lá recebem DOIS pokémon e mexem no que acontece entre eles; este muda QUEM está no
   confronto, e isso só o laço da batalha sabe fazer. É também por isso que ele não vale no ONLINE
   (lá quem escolhe o próximo pokémon é o jogador, entre confrontos) nem na raide (um alvo só).
   O HP VOLTA SOZINHO, e não foi preciso escrever nada pra isso: o laço trabalha sobre as MESMAS
   instâncias do time o tempo todo, então quem sai machucado e volta depois volta com o que tinha.
   O teste cobra isso assim mesmo -- é o ponto que o pedido faz questão de nomear.
   A LISTA são as 6 espécies que aprendem `whirlwind` por NÍVEL na Gen 3, a mesma regra das outras
   onze listas: a linha do Pidgey (19/20/20), o Butterfree (23) e os dois lendários no nível 1.
   Lugia e Ho-Oh ficam por ser o que o dado diz -- eles são INTOCÁVEIS e a entrada não roda hoje,
   exatamente como no `RECUPERACAO`. */
const REMOINHO = ['pidgey', 'pidgeotto', 'pidgeot', 'butterfree', 'lugia', 'hooh'];
const CHANCE_REMOINHO = 0.20;   // por confronto, como todo o resto do bloco
/* Devolve os índices NOVOS dos dois ativos quando o sopro acontece, ou null.
   Os dois lados sorteiam, em ordem de VELOCIDADE -- a mesma regra do tentarGolpeEspecial. */
function tentarRemoinho(team, brockTeam, iAtivo, iInimigo, rng, diario){
  const active = team[iAtivo], enemy = brockTeam[iInimigo];
  if(!active || !enemy) return null;
  /* Mew e Mewtwo são imunes ao bloco inteiro, e aqui vale igual: soprar o chefe da raide pra fora
     seria mexer na batalha deles sem ninguém ter pedido. */
  if(ehImuneAEspecial(active) || ehImuneAEspecial(enemy)) return null;
  /* ⚠️ NINGUÉM COM A PASSIVA = NENHUM NÚMERO LIDO DO RNG, e esta saída antecipada é obrigatória,
     não otimização. O desempate de velocidade abaixo consome um sorteio, e consumi-lo em TODO
     confronto deslocaria a sequência inteira da semente -- ou seja, este bloco mudaria o resultado
     de batalhas que não têm nada a ver com o Whirlwind. Conferido por impressão: com a lista vazia
     o build dá o MESMO hash de antes da feature, em 900 batalhas semeadas.
     É a mesma lição do `op.semCritico` da confusão: a opção anula o RESULTADO, não a CHAMADA --
     aqui vale ao contrário, e por isso a chamada não pode existir. */
  const temAtivo = REMOINHO.indexOf(active.speciesId) >= 0;
  const temInimigo = REMOINHO.indexOf(enemy.speciesId) >= 0;
  if(!temAtivo && !temInimigo) return null;
  const parA = [active, 'p', brockTeam, iInimigo], parE = [enemy, 'e', team, iAtivo];
  /* O DESEMPATE DE VELOCIDADE só é sorteado quando os DOIS têm -- é o único caso em que a ordem
     importa, e é o único em que o sorteio pode existir sem deslocar a semente de todo o resto. */
  let ordem;
  if(temAtivo && temInimigo){
    const spdA = effectiveSpeed(active), spdE = effectiveSpeed(enemy);
    ordem = (spdA > spdE || (spdA === spdE && rng() < 0.5)) ? [parA, parE] : [parE, parA];
  } else ordem = temAtivo ? [parA] : [parE];
  for(const [quem, marca, timeAlvo, iAlvo] of ordem){
    if(REMOINHO.indexOf(quem.speciesId) < 0) continue;
    /* UMA VEZ POR PAR, como o `_especialContra`: adversário novo, confronto novo. Sem o marcador,
       um sopro que traz um pokémon novo faria o mesmo Pidgeot sortear de novo na volta seguinte do
       laço, e a corrente não teria fim declarado. */
    if(quem._remoinhoContra === timeAlvo[iAlvo]) continue;
    quem._remoinhoContra = timeAlvo[iAlvo];
    /* SÓ VALE SE HOUVER PRA ONDE TROCAR -- quem decide isso é a SITUAÇÃO do time do outro, não o
       sorteio: com um pokémon vivo só, não há quem entre no lugar. É a mesma regra do
       BOOM_MINIMO_DO_ALVO, que também não consome a chance. */
    const candidatos = [];
    for(let i = 0; i < timeAlvo.length; i++){
      if(i !== iAlvo && timeAlvo[i] && timeAlvo[i].hp > 0) candidatos.push(i);
    }
    if(!candidatos.length) continue;
    if(rng() >= CHANCE_REMOINHO) continue;
    const novo = candidatos[Math.floor(rng() * candidatos.length)];
    /* ⚠️ QUEM SAI DE CAMPO PERDE OS ESTAGIOS (17/09/2026). E a regra do jogo original -- estagio
       zera ao trocar de pokemon --, e este e o UNICO ponto do motor onde alguem sai de campo VIVO.
       Sem isto, um pokemon com a Defesa em -3 seria soprado, voltaria depois e continuaria em -3:
       o sopro viraria um jeito de GUARDAR o debuff em vez de tira-lo de campo. */
    limparEstagios(timeAlvo[iAlvo]);
    /* A LINHA ENTRA NO DIÁRIO DO CONFRONTO QUE VEM -- o que a tela mostra é o pokémon NOVO, e a
       frase é o que explica por que ele está ali. Por isso ela carrega o nome e a espécie de QUEM
       SAIU: nenhum dos dois lados do matchup é ele. */
    if(diario){
      /* ⚠️ SEM `hp`, e de propósito: este passo não mexe barra nenhuma, e o campo `hp` quer dizer
         "a vida do ALVO depois do golpe" -- aqui não há alvo nem golpe. Gravando a vida de quem
         soprou, toda conta que lê o diário passava a achar que o OUTRO lado tinha aquela vida:
         foi assim que a trava do cadáver acusou 66 confrontos que estavam certos. */
      /* QUEM SAIU VIAJA INTEIRO NO DIÁRIO (12/09/2026), e não só o nome: a animação passou a MOSTRAR
         a troca -- o antigo sai, a vaga fica vazia, o novo entra -- e pra desenhar o quadro do que
         está saindo ela precisa do sprite, do nome, do nível e da BARRA dele. Nenhum dos dois lados
         do matchup é ele, então não há de onde tirar na hora de desenhar.
         `sh` é o shiny e `smx` o teto de vida: sem eles o quadro mostraria o nome do que sai com a
         estrela e a barra do que entra. Log gravado antes destes campos cai no quadro sem barra --
         log velho não pode sumir. */
      diario.push({ q: marca, d: 0, hp: null, c:0, m:0, z:0, x:'remoinho',
                    sai: timeAlvo[iAlvo].name, ss: timeAlvo[iAlvo].speciesId,
                    sl: timeAlvo[iAlvo].level, sh: !!timeAlvo[iAlvo].shiny,
                    shp: timeAlvo[iAlvo].hp, smx: timeAlvo[iAlvo].maxHp,
                    /* E QUEM ENTRA, pro quadro do fim e pra frase "X foi trocado por Y": o matchup
                       já sabe quem é, mas a linha do log é relida dias depois e a frase precisa
                       valer sozinha. */
                    entra: timeAlvo[novo] ? timeAlvo[novo].name : null });
    }
    return (marca === 'p') ? { iAtivo: iAtivo, iInimigo: novo } : { iAtivo: novo, iInimigo: iInimigo };
  }
  return null;
}
function tentarGolpeEspecial(active, enemy, rng, diario){
  explosaoDoAtivo = null;
  if(ehImuneAEspecial(active) || ehImuneAEspecial(enemy)) return false;
  /* A CHUVA E SORTEADA AQUI, na abertura do confronto -- e o lugar certo porque este bloco roda
     UMA VEZ por confronto (o marcador _especialContra, no doExchange), que e exatamente o
     "quando o pokemon entra no confronto" do pedido.
     VEM ANTES DO SORTEIO DE EFEITO e com dado PROPRIO: ela nao disputa a vaga unica do
     sorteiaGolpeEspecial, senao o Gyarados (que ja tem Furia do Dragao) cairia na chance composta
     e a chuva sairia em 9%. O pedido diz 10%.
     E RESPEITA A IMUNIDADE DOS CHEFES, que esta uma linha acima: o Mew e o Mewtwo sao imunes ao
     bloco INTEIRO, e abrir uma excecao pro clima faria a batalha deles se comportar diferente sem
     ninguem ter pedido. */
  tentarChuva(active, enemy, rng || Math.random, diario);
  /* AS DUAS DANÇAS vêm aqui pelo mesmo motivo da chuva: dado PRÓPRIO, na abertura do confronto, sem
     disputar a vaga única do sorteio de efeito. Elas limpam os marcadores do confronto anterior --
     o efeito é por confronto e não acumula. */
  tentarDancas(active, enemy, rng || Math.random, diario);
  // o mais rápido tenta primeiro -- mesma regra que decide quem conecta antes numa troca normal
  const spdA = effectiveSpeed(active), spdE = effectiveSpeed(enemy);
  const ativoPrimeiro = spdA > spdE || (spdA === spdE && rng() < 0.5);
  const ordem = ativoPrimeiro ? [[active, enemy, true], [enemy, active, false]]
                              : [[enemy, active, false], [active, enemy, true]];
  for(const [quem, alvo, ehAtivo] of ordem){
    /* ⚠️ QUEM ESTÁ DORMINDO NÃO USA GOLPE ESPECIAL. Os dois lados sorteiam nesta mesma volta, em
       ordem de velocidade -- então o mais rápido podia adormecer o outro e o adormecido usava o
       especial DELE logo em seguida, na mesma abertura.
       Reportado com print em 11/09/2026: num Smoochum x Magnemite lia-se "Smoochum fez Magnemite
       dormir com Canto" e, na linha de baixo, "Magnemite deixou Smoochum confuso com Supersom".
       É a mesma regra que o golpe comum já tinha ("quem está dormindo não ataca nesta troca"), que
       vale no doExchange e não alcançava este bloco -- ele roda ANTES da primeira troca.
       O `_dormindoPor` é solto no fim da batalha (ver encerrarBatalha), então um valor de um
       confronto antigo não trava o especial de ninguém. */
    if(quem._dormindoPor > 0) continue;
    const especial = sorteiaGolpeEspecial(quem, rng);
    if(!especial) continue;
    const marca = ehAtivo ? 'p' : 'e';
    if(especial.efeito === 'explosao'){
      /* Alvo já machucado: não vale o preço. Sai sem golpe especial nenhum -- e sem consumir a
         chance, porque quem decide isso é a SITUAÇÃO do alvo, não o sorteio. */
      if(alvo.hp <= alvo.maxHp * BOOM_MINIMO_DO_ALVO) continue;
      /* Os dois caem na hora -- e é o único caminho do jogo em que isso acontece: o doExchange
         normal sempre deixa um de pé (ver o desempate lá embaixo).
         A FAIXA DE FOCO SEGURA A EXPLOSÃO TAMBÉM. Foi o furo da primeira versão dela (03/09/2026,
         reportado): a Faixa vigiava os dois pontos do doExchange, e a explosão não passa por
         nenhum deles -- ela zera o HP aqui, direto. Um item que promete segurar "quando o pokémon
         for morrer" não pode ter exceção justamente no golpe mais fatal do jogo.
         SÓ O ALVO É SALVO, nunca quem explodiu: o dano que o explosor toma é dele mesmo, e salvá-lo
         faria da autodestruição um "mate o outro e sobreviva" -- ela deixaria de ter preço. */
      const marcaDoAlvo = marca === 'p' ? 'e' : 'p';
      const salvou = faixaDeFoco(alvo, marcaDoAlvo);
      const danoNoAlvo = salvou ? alvo.hp - 1 : alvo.hp, danoEmSi = quem.hp;
      alvo.hp = salvou ? 1 : 0;
      quem.hp = 0;
      /* Só conta como "explodiu e levou o outro junto" se o outro FOI junto: com a Faixa segurando,
         quem explodiu morreu sozinho, e o teamStillAlive não pode dar a batalha pra ele. */
      explosaoDoAtivo = salvou ? null : ehAtivo;
      if(diario){
        diario.push({ q: marca, d: danoNoAlvo, hp: alvo.hp, c:0, m:0, z:0, x:'boom', g: especial.golpe });
        if(salvou) diario.push(marcaDaFaixa(marcaDoAlvo, 0));   // depois do golpe que ela segurou
        diario.push({ q: marca === 'p' ? 'e' : 'p', d: danoEmSi, hp: 0, c:0, m:0, z:0, x:'boomself' });
      }
      return true;
    }
    if(especial.efeito === 'furia'){
      /* ENTRAR EM FÚRIA: +10 em todos os seis atributos, e ACUMULA se acontecer de novo no
         confronto seguinte. Como o Recuperar e a anulação, NÃO resolve o confronto: é 'continue' --
         a luta acontece inteira, com ele maior.
         O HP É O ÚNICO QUE PRECISA DE MÃO: os outros cinco atributos são lidos pelas effective* na
         hora do dano, mas o teto de vida é um número gravado na instância. Ele sobe, e a vida ATUAL
         sobe junto na mesma quantidade -- senão o pokémon ficaria com uma fatia menor da barra sem
         ter apanhado, que é o mesmo defeito que o buff de terreno já teve. */
      quem._furia = (quem._furia || 0) + 1;
      const tetoAntes = quem.maxHp;
      quem.maxHp = calcMaxHp(quem);
      const ganho = quem.maxHp - tetoAntes;
      quem.hp = Math.min(quem.maxHp, quem.hp + ganho);
      if(diario){
        /* `d` é o quanto a barra SOBE, como na cura -- a animação usa isso pra desenhar o
           crescimento. `n` é a que vez é esta, pra a frase dizer "fúria x2". */
        diario.push({ q: marca, d: ganho, hp: quem.hp, c:0, m:0, z:0, x:'furia',
                      g: especial.golpe, n: quem._furia });
      }
      continue;
    }
    if(especial.efeito === 'confusao'){
      /* O ALVO SE ACERTA. O dano sai de um ESPELHO dele -- uma cópia rasa, com os mesmos atributos
         e o mesmo golpe -- batendo NELE. A cópia não é firula: o `calcDamageNew` ESCREVE
         `lastMove`, `lastMoveType` e `lastCrit` no atacante, e sem ela o golpe que o pokémon usa na
         luta seguinte sairia trocado no log.
         Ele também não pode levar a anulação consigo: o `_anulado` é contra o OPONENTE, e o
         espelho é ele mesmo.
         NÃO MATA (piso de 1), e quem já está em 1 não gera linha nenhuma: um passo de dano 0 é o
         que este log evita em toda regra. */
      const espelho = Object.assign({}, alvo, { _anulado: null });
      /* O SERVIDOR CHAMA A FUNCAO DE OUTRO NOME (`calcDamage`, sem o `New`) -- ao copiar codigo
         entre os dois motores, conferir os NOMES e nao so a logica. E a mesma licao do `brockTeam`
         x `enemyTeam` que a furia ja tinha custado tres suites. */
      /* SEM TIPO, como no jogo oficial (a pedido, 10/09/2026) -- ver a nota do cliente. */
      const dano = calcDamage(espelho, alvo, rng, { semTipo: true, semCritico: true });
      const antes = alvo.hp;
      alvo.hp = Math.max(1, alvo.hp - dano);
      const saiu = antes - alvo.hp;
      if(saiu <= 0) continue;
      if(diario){
        /* `q` é quem CONFUNDIU, não quem apanhou -- é a convenção do diário (o `q` do sono também
           é quem usou o golpe), e é ela que faz a animação mover a barra do lado certo: o passo
           comum inverte `q` pra achar quem APANHA.
           `am` guarda o golpe que ele usou em si mesmo, pro selo da linha nomear o golpe certo. */
        const reg = { q: marca, d: saiu, hp: alvo.hp, c:0, m:0, z:0, x:'confusao', g: especial.golpe };
        if(espelho.lastMove) reg.am = espelho.lastMove;
        diario.push(reg);
      }
      continue;
    }
    if(especial.efeito === 'furiadragao'){
      /* 40 DE HP NO ADVERSÁRIO, e a luta acontece INTEIRA depois -- é 'continue', não
         'return true'. O pedido é literal: "o oponente começa a batalha perdendo 40 de hp e depois
         disso o motor deve calcular a batalha como se fosse uma nova batalha começando".
         NÃO MATA: piso de 1, a mesma regra da drenagem e da confusão. E quem já está em 1 não gera
         linha nenhuma -- um passo de dano 0 é o que este log evita em toda regra.
         O DANO GRAVADO É O EFETIVO, não os 40 crus: num alvo com 25 de HP a linha diz 24, que é o
         que a barra vai andar. É a regra do diário desde sempre -- com o valor cru a soma das
         linhas passava do HP que o pokémon tinha. */
      const antes = alvo.hp;
      alvo.hp = Math.max(1, alvo.hp - FURIA_DRAGAO_DANO);
      const saiu = antes - alvo.hp;
      if(saiu <= 0) continue;
      if(diario){
        /* `q` é quem USOU o golpe, não quem apanhou -- a convenção do diário, a mesma do sono, da
           confusão e do dano da drenagem. É ela que faz a animação mover a barra do lado certo: o
           passo comum inverte o `q` pra achar quem APANHA. Trocar isso não aparece como erro,
           aparece como o pokémon errado perdendo vida. */
        diario.push({ q: marca, d: saiu, hp: alvo.hp, c:0, m:0, z:0, x:'furiadragao', g: especial.golpe });
      }
      continue;
    }
    if(especial.efeito === 'cura'){
      /* RECUPERAR ACONTECE ANTES DA LUTA. O pokémon que sobreviveu ao confronto anterior entra
         machucado; se ele tem o golpe e está abaixo de 70% da vida, se cura ANTES de o novo
         adversário atacar -- e aí o confronto acontece inteiro, com ele cheio.
         Ficava no FIM do doExchange (o vencedor se curava depois de ganhar), e o efeito era o
         mesmo número com metade da graça: a cura chegava quando a luta já tinha sido decidida.
         Como o Disable, NÃO resolve o confronto: é 'continue', não 'return true'. */
      if(quem.hp >= quem.maxHp * CURA_MAXIMO_DO_HP) continue;
      const curado = quem.maxHp - quem.hp;
      quem.hp = quem.maxHp;
      if(diario){
        diario.push({ q: marca, d: curado, hp: quem.hp, c:0, m:0, z:0, x:'recover', g: especial.golpe });
      }
      continue;
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
      /* QUANTOS GOLPES DISTINTOS ELE TEM PRA PERDER. Com golpe escolhido -- o jogador, e desde
         09/09/2026 também os NPCs -- o que conta são os TIPOS dos golpes que ele LEVA, não os
         tipos da espécie: dois golpes do mesmo tipo caem juntos e a anulação fica sem segundo
         golpe pra oferecer, que é exatamente o caso que esta regra existe pra evitar.
         Sem golpe escolhido vale a lista de tipos da espécie, como sempre foi. */
      const golpesDele = Array.isArray(alvo.ataques) ? alvo.ataques.filter(id => GOLPES[id]) : [];
      if(golpesDele.length){
        const tiposDele = [];
        golpesDele.forEach(id => { if(tiposDele.indexOf(GOLPES[id][0]) < 0) tiposDele.push(GOLPES[id][0]); });
        if(tiposDele.length < 2) continue;
      } else if(tiposDeAtaque(alvo, quem).length < 2) continue;
      const escolhaAnulada = bestAttackType(alvo, quem);
      const tipoAnulado = escolhaAnulada.type;
      /* O GOLPE anulado, quando existe um de verdade. O log dizia o nome GENÉRICO do tipo, e com
         golpe escolhido isso nomeia um golpe que o pokémon não tem -- reportado em 09/09/2026
         ("ele tá pegando um qualquer aleatório"). O motor manda o id; a palavra é do cliente. */
      const golpeAnulado = escolhaAnulada.golpe || null;
      alvo._anulado = { tipo: tipoAnulado, contra: quem };
      if(diario){
        /* Grava o TIPO anulado (`a`) porque é ele que deixa o log dizer QUAL golpe se perdeu --
           "teve o ataque Nevasca anulado" em vez de "teve seu melhor ataque anulado". O nome sai
           do tipo no cliente, como em todo o resto do log: o motor manda o tipo, o cliente escolhe
           a palavra (ver nomeDoGolpe). */
        const reg = { q: marca, d: 0, hp: alvo.hp, c:0, m:0, z:0, x:'disable', g: especial.golpe, a: tipoAnulado };
        if(golpeAnulado) reg.am = golpeAnulado;   // o id do golpe perdido, quando ele existe
        diario.push(reg);
      }
      continue;
    }
    /* DESPERTAR: o sono do ADVERSÁRIO não pega no time do jogador. Protege quem usou o item, não
       desliga o golpe do jogo -- os pokémon do jogador continuam podendo dormir o adversário.
       A chance do adversário É CONSUMIDA: ele tentou e falhou, e é isso que a linha do log conta.
       Sem essa linha o jogador não teria como saber que as 50 moedas trabalharam. */
    if(alvo.item === 'awakening'){
      /* O DESPERTAR É DO ALVO: ele segura o sono que viria em cima DELE, venha de quem vier. Não
         importa de que lado o alvo está -- um Despertar equipado num pokémon do jogador segura a
         Jynx adversária, e é isso que foi pedido.
         O item é GASTO aqui: ele serviu. E vira linha no log, senão o jogador não teria como saber
         que ele trabalhou -- o erro da especialidade de novo. */
      alvo.item = null;
      itensGastos.push({ dono: marca === 'p' ? 'e' : 'p', especie: alvo.speciesId, slot: alvo.slotDaConta, item: 'awakening' });
      if(diario){
        diario.push({ q: marca, d: 0, hp: alvo.hp, c:0, m:0, z:0, x:'semSono', g: especial.golpe });
      }
      continue;
    }
    /* SONO: o alvo passa SONO_EM_TROCAS trocas sem revidar e depois acorda -- a luta segue normal.
       Como o Disable e a Recuperação, é 'continue' e não 'return true': o confronto acontece
       inteiro, só que com o adversário de mãos atadas no começo. */
    alvo._dormindoPor = sorteiaTrocasDeSono(rng);
    if(diario){
      diario.push({ q: marca, d: 0, hp: alvo.hp, c:0, m:0, z:0, x:'sono', g: especial.golpe });
    }
    continue;
  }
  return false;
}
/* FAIXA DE FOCO: o golpe que mataria deixa 1 de HP, o pokémon dá o revide dele e a LUTA CONTINUA.
   Ela entra nos dois pontos do doExchange em que alguém chega a zero -- quem apanha primeiro e quem
   apanha o revide --, porque o item vale nos dois.
   NÃO é o golpe moribundo com outro nome: no moribundo o pokémon revida E CAI, aqui ele fica de pé.
   Como a marca de moribundo sai da SITUAÇÃO ("o segundo caiu e revidou"), segurar em 1 já a desliga
   sozinho -- e é isso que se quer, porque ele não caiu.
   O item é UM: gasta ao segurar, e o segundo golpe fatal da mesma batalha leva o pokémon. */
function faixaDeFoco(p, marca){
  if(!p || p.item !== 'faixa_foco') return false;
  p.item = null;
  itensGastos.push({ dono: marca, especie: p.speciesId, slot: p.slotDaConta, item: 'faixa_foco' });
  return true;
}
/* A LINHA DA FAIXA VEM DEPOIS DO GOLPE QUE ELA SEGUROU, e é por isso que ela não é escrita dentro
   do faixaDeFoco: lá ela sairia ANTES, porque o motor segura o HP no instante do golpe mas só
   escreve a linha dele no fim do doExchange. O log ficava "a Faixa segurou com 1 de HP" e só então
   "Electabuzz atacou e tirou -182", que é a ordem invertida da cena.
   Quem chama empurra esta marca logo depois da linha do golpe. */
function marcaDaFaixa(marca, hpDoOutro){ return { q: marca, d: 0, hp: 1, ho: hpDoOutro, c:0, m:0, z:0, x:'faixa' }; }
/* OS GOLPES QUE UM LADO DÁ NUMA TROCA. Quase sempre é um só; nos golpes de vários tapas são de 2
   a 5, cada um com sorteio próprio de dano e de crítico. Devolve sempre LISTA -- o caso comum é
   uma lista de um item, e isso é o que evita dois caminhos no doExchange.
   O número de tapas é sorteado DEPOIS do primeiro calcDamage porque é ele quem escolhe o golpe e
   grava o lastMove; antes dele não há id pra consultar na tabela. */
function golpesDaTroca(atacante, alvo, rng){
  const lista = [calcDamage(atacante, alvo, rng)];
  /* O contador do Rolamento anda AQUI, e não no calcDamage: este é o único ponto que roda uma vez
     por ATAQUE. O calcDamage é chamado uma vez por TAPA, e um golpe de vários tapas contaria cinco
     usos num ataque só. */
  atualizarRolamento(atacante);
  const tapas = tapasDoGolpe(atacante.lastMove, rng);
  /* ⚠️ OS TAPAS SEGUINTES REPETEM O GOLPE DO PRIMEIRO (ver op.golpeFixo). O numero de tapas foi
     lido do golpe que saiu no primeiro calcDamage; deixar os outros sortearem de novo trocava de
     golpe no meio do mesmo ataque. */
  const golpe = atacante.lastMove, foiMetro = !!atacante.lastMetronomo;
  for(let i = 1; i < tapas; i++) lista.push(calcDamage(atacante, alvo, rng, { golpeFixo: golpe, metronomoFixo: foiMetro }));
  return lista;
}
/* ⚠️ QUANTOS GOLPES O POKÉMON DO JOGADOR LEVA. É o mesmo `MAX_GOLPES` do cliente, e ele precisou
   vir pra cá porque o servidor **truncava em 2** enquanto o cliente já escolhia 3 desde 09/09/2026:
   quem escolheu três golpes lutava a Torre e o Ginásio da Cidade com os DOIS PRIMEIROS, em
   silêncio. O número solto nos dois lugares era exatamente o que a constante existe pra evitar --
   ela nasceu no cliente porque o 2 estava espalhado por nove pontos, e aqui repetiu o mesmo erro.
   Se mudar de novo, tem que mudar nos DOIS arquivos. */
const MAX_GOLPES = 3;
/* os tipos de uma instância, com o campo da espécie como rede -- o `p.types` é o que o
   `tryEvolve` atualiza, e é ele que manda. Espelha o do cliente. */
function tiposDoPokemon(p){
  if(!p) return [];
  if(Array.isArray(p.types) && p.types.length) return p.types;
  const sp = SPECIES[p.speciesId];
  return (sp && sp.types) || [];
}
/* ⚠️ O CONGELAMENTO É O PRIMEIRO STATUS POR ATAQUE DO JOGO (16/09/2026, a pedido), e é isso que o
   separa das ONZE passivas do `tentarGolpeEspecial`: aquelas são sorteadas UMA VEZ na abertura do
   confronto (o marcador `_especialContra`) e valem pra ele inteiro. Esta rola **a cada ataque** --
   o pedido diz com todas as letras: *"a chance de congelar é por ataque dentro do confronto, e não
   somente no início ou no fim da batalha como as habilidades passivas"*.
   Por isso ela não mora lá: ela roda no `doExchange`, depois dos golpes daquela troca.
   OS QUATRO GOLPES saíram do dado do FireRed (Gen 3): são os ÚNICOS que congelam, e todos a 10%.
   Não existe golpe de STATUS que congele -- congelar é sempre efeito secundário, e é por isso que
   ele é o status mais raro do jogo original. */
const GOLPES_QUE_CONGELAM = { icepunch: 0.10, icebeam: 0.10, blizzard: 0.10, powdersnow: 0.10 };
/* 25% por turno, e a duração é GEOMÉTRICA: sem teto, média de 4 turnos, e 1 em 5 congelamentos
   passa de 5. É o número do ciclo que o pedido descreveu passo a passo. */
const CHANCE_DESCONGELAR = 0.25;
/* ⚠️ A QUEIMADURA (16/09/2026), a segunda mecanica POR ATAQUE do jogo. As regras sao as da GEN 3,
   que e a geracao da base de golpes daqui (Bulbapedia, Burn):
     - 1/16 do HP MAXIMO por turno, e ela PODE matar, como no original;
     - METADE do dano dos golpes FISICOS (neste motor quem decide fisico e o TIPO do golpe,
       regra da Gen 1 -- ver isSpecialType);
     - o tipo FOGO e imune;
     - e ela NAO PASSA SOZINHA. E essa a diferenca que a separa do congelamento: o gelo sorteia
       degelo a cada turno, e a queimadura dura o resto da BATALHA. Ela e um efeito que se ACUMULA
       no tempo em vez de um que se espera passar.
   OS SETE GOLPES sairam do dado (Showdown, mod da Gen 3), o mesmo caminho dos quatro do gelo. O
   Will-O-Wisp fica de fora por ser golpe de STATUS (poder 0, e a base so cadastra dano) e o Blaze
   Kick porque ninguem o aprende por nivel nas 250 -- cadastra-lo seria letra morta.
   O SACRED FIRE e 50%, que e o valor oficial dele; os outros seis sao 10%. Ele so existe no Ho-Oh,
   que e INTOCAVEL, entao a entrada nao roda hoje -- fica por ser o que o dado diz, a mesma decisao
   do Lugia no RECUPERACAO e no REMOINHO. */
const GOLPES_QUE_QUEIMAM = { firepunch: 0.10, ember: 0.10, flamethrower: 0.10, fireblast: 0.10,
                             flamewheel: 0.10, heatwave: 0.10, sacredfire: 0.50 };
const QUEIMADURA_DANO = 1/16;        // do HP MAXIMO, por turno
const QUEIMADURA_FISICO = 0.5;       // o que sobra do ataque fisico de quem esta queimado
/* ⚠️ O ENVENENAMENTO (16/09/2026), a terceira mecanica POR ATAQUE. Regras da GEN 3 (Bulbapedia,
   Poison), e ele e o mais simples dos tres -- so dano, sem cortar atributo nenhum:
     - 1/8 do HP MAXIMO por turno (o DOBRO da queimadura), e ele PODE matar;
     - dura ate o fim da BATALHA, como a queimadura -- nao passa sozinho;
     - ACO e VENENO sao imunes.
   ⚠️ O VENENO NA LISTA DE IMUNES FOI ACRESCENTADO POR MIM: o pedido dizia so *"pokemon de aço tem
   imunidade"*, mas a Bulbapedia (a fonte citada no proprio pedido) poe os dois, e e a mesma
   simetria dos outros dois status -- o Gelo nao congela e o Fogo nao queima. Sem ela, as 37
   especies de Veneno se envenenariam com os PROPRIOS golpes: quase todos os donos da lista abaixo
   sao de Veneno. Se um dia for pra valer so o Aço, e tirar um termo do `podeEnvenenar`.
   OS SEIS GOLPES sairam do dado (Showdown, mod da Gen 3), com as chances OFICIAIS de cada um --
   ao contrario do gelo (todos 10%), aqui elas variam de 10% a 50%.
   ⚠️ FICARAM DE FORA: Po Venenoso, Toxico e Gas Venenoso (golpes de STATUS, poder 0, e a base so
   cadastra dano) e a Cauda Venenosa (ninguem a aprende por nivel nas 250).
   ⚠️ E A PRESA VENENOSA E "GRAVE" NO ORIGINAL (o veneno que escala 1/16, 2/16, 3/16...). Aqui ela
   entra como veneno NORMAL: o pedido fixou 1/8, e o veneno grave e outra mecanica. Ter o golpe
   funcionando com 1/8 e mais proximo do jogo do que nao ter o efeito nenhum. */
const GOLPES_QUE_ENVENENAM = { poisonsting: 0.30, twineedle: 0.20, smog: 0.40,
                               sludge: 0.30, sludgebomb: 0.30, poisonfang: 0.50 };
const VENENO_DANO = 1/8;             // do HP MAXIMO, por turno -- o DOBRO da queimadura
/* ⚠️ POKÉMON DE GELO NÃO CONGELA, como no jogo original -- e aqui isso pesa mais que lá: quase
   todo dono de golpe de gelo É de Gelo (Articuno, Lapras, Dewgong, Jynx, Cloyster), então sem a
   imunidade o efeito mais comum seria dois pokémon de Gelo se congelando um ao outro. */
/* ⚠️ OS ESTÁGIOS DE ATRIBUTO (17/09/2026) -- o PRIMEIRO sistema de estágios do motor.
   Pedidos assim: *"Iron Tail: 30% de diminuir a Defesa do alvo em 1 estágio, Psychic: 10% de
   diminuir a Defesa Especial, Shadow Ball: 20% ..., Steel Wing: 10% de aumentar a Defesa do
   próprio usuário"*. As chances são as OFICIAIS, tiradas do dado (Showdown, mod da Gen 3) -- o
   mesmo caminho das quatro listas de status.

   ⚠️ ATÉ AQUI O MOTOR NÃO TINHA ESTÁGIO NENHUM. O que ele tinha eram MULTIPLICADORES fixos: a
   Dança das Espadas é ×1,5 de Ataque e a Dança da Pluma ×0,5 -- que por acaso são o +1 e o -1 da
   tabela oficial, mas não somam nem se acumulam. Estágio é outra coisa: ele ACUMULA, tem teto, e
   a mesma escada serve a qualquer atributo.

   A TABELA É A DA GEN 3, e ela não é linear: `+n` vale `(2+n)/2` e `-n` vale `2/(2+n)`. Ou seja
   +1 é ×1,5 mas -1 é ×0,667 (e não ×0,5) -- baixar dói MENOS que subir rende, e é assim desde a
   Gen 1. Escrever "-1 = ×0,5" é o erro mais comum aqui.

   ⚠️ O TETO DE ±6 É ALCANÇÁVEL DE VERDADE, ao contrário dos estágios de crítico (que ficaram de
   fora do jogo justamente por serem letra morta): a Cauda de Ferro usada seis vezes no mesmo
   confronto chega no -6. Por isso a escada inteira existe.

   ⚠️ E ELES DURAM A BATALHA, não o confronto -- o contrário das duas Danças. A diferença não é
   gosto: no jogo original o estágio zera quando o pokémon SAI DE CAMPO, e aqui quem vence um
   confronto CONTINUA em campo pro próximo (é por isso que o HP dele carrega). Quem sai de campo
   é quem cai... e quem é soprado pelo Remoinho -- e lá eles zeram, ver `limparEstagios`. */
const ESTAGIO_MIN = -6, ESTAGIO_MAX = 6;
function multDoEstagio(n){
  const e = Math.max(ESTAGIO_MIN, Math.min(ESTAGIO_MAX, n | 0));
  return e >= 0 ? (2 + e) / 2 : 2 / (2 - e);
}
function estagioDe(p, qual){ return (p && p._estagios && p._estagios[qual]) || 0; }
/* ⚠️ O MULTIPLICADOR ENTRA POR ÚLTIMO na cadeia, depois de shiny, terreno, especialidade, item e
   fúria: "metade da Defesa" é metade do que o pokémon TEM na hora do golpe. É a MESMA regra do
   corte da queimadura e das duas Danças, e o motivo é o mesmo -- entrando antes, ele multiplicaria
   só a parte base e o +15 do item ficaria de fora da conta. */
function withEstagio(v, p, qual){
  const e = estagioDe(p, qual);
  return e ? Math.round(v * multDoEstagio(e)) : v;
}
/* Move o estágio e devolve se ele REALMENTE mudou. No teto, nada muda -- e aí não sai linha: um
   aviso de "a Defesa caiu" com a barra parada é o mesmo defeito do "-0 de HP". */
function moverEstagio(p, qual, delta){
  if(!p) return false;
  if(!p._estagios) p._estagios = {};
  const antes = p._estagios[qual] || 0;
  const depois = Math.max(ESTAGIO_MIN, Math.min(ESTAGIO_MAX, antes + delta));
  if(depois === antes) return false;
  p._estagios[qual] = depois;
  return true;
}
function limparEstagios(p){ if(p) p._estagios = null; }
/* ⚠️ O `alvo` DIZ EM QUEM O EFEITO CAI, e o Asa de Aço é o único que cai em QUEM USA. Lido como se
   fossem todos no adversário, ele baixaria a Defesa de quem levou o golpe em vez de subir a de
   quem bateu -- e o defeito não apareceria como erro: apareceria como o golpe sendo bom demais. */
const GOLPES_QUE_MUDAM_ESTAGIO = {
  irontail:   { chance: 0.30, atributo: 'def',   delta: -1, noProprio: false },
  psychic:    { chance: 0.10, atributo: 'spDef', delta: -1, noProprio: false },
  shadowball: { chance: 0.20, atributo: 'spDef', delta: -1, noProprio: false },
  steelwing:  { chance: 0.10, atributo: 'def',   delta: +1, noProprio: true },
  /* ⚠️ OS DOIS DE TM (17/09/2026), e eles são os primeiros de chance **1**: no jogo oficial os dois
     acontecem SEMPRE que o golpe conecta, não são sorteio. O `rocktomb` já estava escrito aqui em
     13/09 e teve que sair no mesmo dia -- o golpe não existia na tabela, porque ninguém o aprende
     por nível. O TM39 é o que lhe deu casa.
     ⚠️ E O OVERHEAT É O PRIMEIRO QUE COBRA UM PREÇO DE QUEM USA: −2 estágios no PRÓPRIO Ataque
     Especial, o que faz o segundo uso valer metade do primeiro. É o que equilibra um golpe de 140. */
  rocktomb:   { chance: 1.00, atributo: 'speed', delta: -1, noProprio: false },
  overheat:   { chance: 1.00, atributo: 'spAtk', delta: -2, noProprio: true }
};
/* ⚠️ SORTEIA DEPOIS DE O GOLPE CONECTAR, e lê o rng da BATALHA -- nunca Math.random: um dado a
   mais num dos motores desloca a semente inteira. E SAI ANTES do rng() quando o golpe não está na
   tabela, senão ele mudaria toda batalha que não tem nenhum destes cinco.
   Devolve o que a linha do log precisa, ou null. */
function tentarEstagio(quemBate, alvo, rng){
  if(!quemBate || quemBate.hp <= 0) return null;
  const golpe = quemBate.lastMove;
  const efeito = GOLPES_QUE_MUDAM_ESTAGIO[golpe];
  if(!efeito) return null;
  const quem = efeito.noProprio ? quemBate : alvo;
  if(!quem || quem.hp <= 0) return null;
  if(rng() >= efeito.chance) return null;
  if(!moverEstagio(quem, efeito.atributo, efeito.delta)) return null;   // ja estava no teto
  return { golpe: golpe, atributo: efeito.atributo, delta: efeito.delta, noProprio: !!efeito.noProprio };
}
/* ⚠️ A PARALISIA (16/09/2026), a QUARTA mecanica POR ATAQUE. Regras da GEN 3:
     - a velocidade cai pra 25% (regra da Gen 1 a 6; so na Gen 7 virou 50%);
     - 25% de chance de NAO conseguir atacar no turno;
     - dura ate o fim da BATALHA, como a queimadura e o veneno.
   ⚠️ NAO EXISTE IMUNIDADE DE TIPO NA GEN 3: o Eletrico so ficou imune na GEN 6. O que existe e a
   imunidade do GOLPE -- Terra nao toma Eletrico, e golpe que nao afeta nao paralisa.
   ⚠️ O CANHAO DE CHOQUE E 100% e aqui nao existe errar (no original ele tem 50% de precisao, e e
   esse o preco dele). Ver o CLAUDE.md.
   ⚠️ ESTE BLOCO E COPIA DO CLIENTE, palavra por palavra na parte de MOTOR. */
const GOLPES_QUE_PARALISAM = { lick: 0.30, thundershock: 0.10, dragonbreath: 0.30, spark: 0.30,
                               thunderpunch: 0.10, bodyslam: 0.30, bounce: 0.30, thunderbolt: 0.10,
                               zapcannon: 1.00, thunder: 0.30 };
const PARALISIA_VELOCIDADE = 0.25;
const CHANCE_PARALISIA_TRAVA = 0.25;
function podeParalisar(p){
  return !!p && p.hp > 0 && !p._paralisado;
}
function golpeAfetaOAlvo(golpe, alvo){
  const g = GOLPES[golpe];
  if(!g) return true;
  return tiposDoPokemon(alvo).every(t => typeVsType(g[0], t) !== 0);
}
function tentarParalisar(quemBate, alvo, rng){
  if(!quemBate || quemBate.hp <= 0) return null;
  const golpe = quemBate.lastMove;
  const chance = GOLPES_QUE_PARALISAM[golpe];
  if(!chance || !podeParalisar(alvo) || !golpeAfetaOAlvo(golpe, alvo)) return null;
  if(rng() >= chance) return null;
  alvo._paralisado = golpe;
  return golpe;
}
function withParalisia(v, p){
  return (p && p._paralisado) ? Math.round(v * PARALISIA_VELOCIDADE) : v;
}
function podeCongelar(p){
  return !!p && p.hp > 0 && !p._congelado && (tiposDoPokemon(p).indexOf("Ice") < 0);
}
/* Sorteia o congelamento DEPOIS de o golpe conectar. Devolve o id do golpe que congelou (pra frase
   nomeá-lo) ou null. Só vale se o golpe REALMENTE saiu: um ataque que não conectou não congela. */
/* O TIPO FOGO E IMUNE, como no original. Quem ja caiu nao queima, e quem JA esta queimado tambem
   nao -- a marca seria reescrita e o log passaria a nomear o golpe errado. */
/* ACO e VENENO sao imunes (ver a nota da constante). Quem ja caiu nao envenena, e quem JA esta
   envenenado tambem nao -- a marca seria reescrita e o log passaria a nomear o golpe errado. */
function podeEnvenenar(p){
  if(!p || p.hp <= 0 || p._envenenado) return false;
  const t = tiposDoPokemon(p);
  return t.indexOf("Steel") < 0 && t.indexOf("Poison") < 0;
}
/* O sorteio roda DEPOIS de o golpe conectar e le o rng da BATALHA, saindo antes dele quando o
   golpe nao envenena ou o alvo e imune -- a mesma forma dos outros dois status. */
function tentarEnvenenar(quemBate, alvo, rng){
  if(!quemBate || quemBate.hp <= 0) return null;
  const golpe = quemBate.lastMove;
  const chance = GOLPES_QUE_ENVENENAM[golpe];
  if(!chance || !podeEnvenenar(alvo)) return null;
  if(rng() >= chance) return null;
  alvo._envenenado = golpe;
  return golpe;
}
function podeQueimar(p){
  return !!p && p.hp > 0 && !p._queimado && (tiposDoPokemon(p).indexOf("Fire") < 0);
}
/* ⚠️ O SORTEIO RODA DEPOIS DE O GOLPE CONECTAR, e le o rng da BATALHA -- nunca Math.random: um
   dado a mais num dos motores desloca a semente inteira e a mesma batalha termina diferente nos
   dois lados. E ele SAI ANTES do rng() quando o golpe nao queima ou o alvo e imune, senao ele
   mudaria toda batalha que nao tem golpe de fogo nenhum. */
function tentarQueimar(quemBate, alvo, rng){
  if(!quemBate || quemBate.hp <= 0) return null;
  const golpe = quemBate.lastMove;
  const chance = GOLPES_QUE_QUEIMAM[golpe];
  if(!chance || !podeQueimar(alvo)) return null;
  if(rng() >= chance) return null;
  alvo._queimado = golpe;
  return golpe;
}
function tentarCongelar(quemBate, alvo, rng){
  if(!quemBate || quemBate.hp <= 0) return null;
  const golpe = quemBate.lastMove;
  const chance = GOLPES_QUE_CONGELAM[golpe];
  if(!chance || !podeCongelar(alvo)) return null;
  if(rng() >= chance) return null;
  alvo._congelado = golpe;
  return golpe;
}
function doExchange(active, enemy, rng, diario){
  /* Golpe especial: só na PRIMEIRA troca de cada confronto. O marcador é o próprio
     adversário -- oponente novo, confronto novo, e as chances valem de novo. */
  if(active._especialContra !== enemy){
    active._especialContra = enemy;
    if(tentarGolpeEspecial(active, enemy, rng || Math.random, diario)) return;
  }
  // Os DOIS sempre atacam em toda troca -- a velocidade (Gen 1 real) só decide QUEM conecta primeiro.
  // ⚠️ QUEM CAI NÃO RESPONDE, desde 15/09/2026: o golpe moribundo acabou (ver o bloco do
  // saiuNoPrimeiro). Até então o caído ainda conectava o contra-golpe, e era isso que impedia um
  // pokémon rápido e forte de varrer a fila de graça -- hoje o abate é limpo.
  /* Quem está dormindo não ataca nesta troca, e o contador anda. O golpe dele não sai NEM no
     diário: uma linha de "-0 de HP" faria o log dizer que ele atacou e não machucou, quando o que
     aconteceu foi ele não ter atacado. O log tem que contar a mesma coisa que a tela mostra. */
  /* ⚠️ QUEM ACORDA ANUNCIA, e só DEPOIS de apanhar (14/09/2026, a pedido: *"quando um pokémon
     dormir, ele vai tomar um dano, e depois disso, exiba a mensagem Krabby acordou e voltou à
     luta"*). Aqui só se guarda QUEM acordou; o registro entra depois dos golpes desta troca --
     gravado no começo, o log dizia "fez dormir / acordou / atacou", de trás pra frente.
     O `q` é de QUEM ACORDOU, como o da fúria: a linha é sobre UM pokémon, não sobre um causador e
     um alvo (ao contrário do sono, cujo `q` é de quem USOU o golpe). */
  const acorda = (p) => { if(!(p._dormindoPor > 0)) return false; p._dormindoPor--; return true; };
  const activeDorme = acorda(active), enemyDorme = acorda(enemy);
  /* ⚠️ O CONGELADO TENTA DEGELAR NA VEZ DELE, e o pedido descreve o ciclo exato: ele NÃO ataca
     enquanto estiver preso, e no turno em que degela ele **ataca normalmente** -- *"ele consegue se
     descongelar e aparece a frase ... e então ele realiza o ataque normalmente"*.
     ⚠️ ISSO DIFERE DO JOGO ORIGINAL, onde degelar consome o turno. Foi pedido assim, e é o que
     mantém o ciclo legível: a frase do degelo e o golpe dele saem na mesma troca.
     O sorteio é lido na ENTRADA da troca, como o acorda do sono: quem está congelado já entra
     sabendo se joga ou não. */
  const degela = (p) => {
    if(!p._congelado) return null;
    if(rng() < CHANCE_DESCONGELAR){ p._congelado = null; return "degelou"; }
    return "preso";
  };
  const activeGelo = degela(active), enemyGelo = degela(enemy);
  const activeCongelado = activeGelo === "preso", enemyCongelado = enemyGelo === "preso";
  /* o rng SO e lido de quem esta paralisado: lido sempre, deslocaria a semente de toda batalha */
  const trava = (p) => !!p._paralisado && rng() < CHANCE_PARALISIA_TRAVA;
  const activeTravado = trava(active), enemyTravado = trava(enemy);

  const acordaram = [];
  if(activeDorme && active._dormindoPor <= 0) acordaram.push({ q:'p', nome: active.name, p: active });
  if(enemyDorme && enemy._dormindoPor <= 0) acordaram.push({ q:'e', nome: enemy.name, p: enemy });
  /* ⚠️ QUEM ESTÁ DORMINDO NESTA TROCA, pro Comedor de Sonhos saber contra quem ele vale (ver
     GOLPES_SO_DORMINDO). Tem que ser marcado AQUI, depois do `acorda` e antes dos golpes: o
     `_dormindoPor` já foi decrementado, então na troca livre ele está em 0 enquanto o pokémon
     ainda não atacou -- lido dali, o golpe nunca sairia.
     O campo começa com `_`, então não vai pro Firestore, e é LIMPO logo depois dos dois
     `golpesDaTroca`: ele vale pra ESTA troca e mais nada. */
  active._dormeAgora = activeDorme;
  enemy._dormeAgora = enemyDorme;
  const dmgToEnemy = (activeDorme || activeCongelado || activeTravado) ? [] : golpesDaTroca(active, enemy, rng);
  const dmgToActive = (enemyDorme || enemyCongelado || enemyTravado) ? [] : golpesDaTroca(enemy, active, rng);
  active._dormeAgora = false;
  enemy._dormeAgora = false;
  const spdActive = effectiveSpeed(active);
  const spdEnemy = effectiveSpeed(enemy);
  // empate de velocidade: sorteio -- rng com seed fixa nas Ligas, então continua determinístico
  const activeFirst = spdActive > spdEnemy || (spdActive === spdEnemy && rng() < 0.5);
  const first  = activeFirst ? active : enemy;
  const second = activeFirst ? enemy : active;
  const dmgByFirst  = activeFirst ? dmgToEnemy : dmgToActive;
  const dmgBySecond = activeFirst ? dmgToActive : dmgToEnemy;
  /* ⚠️ `firstHpBefore` É `let` POR CAUSA DA DRENAGEM: ele significa "a vida do first no instante em
     que o second vai bater nele", e a cura do first acontece ENTRE as duas coisas. Os três lugares
     que o leem (o `jaRaspando`, o clamp do piso do revide e o `ho` da marca da Faixa) querem esse
     valor, não o do começo da troca -- enquanto nada curava no meio, os dois eram o mesmo número. */
  let firstHpBefore = first.hp;
  const secondHpBefore = second.hp;
  const primeiroDormiu = (first === active) ? activeDorme : enemyDorme;
  const segundoDormiu  = (second === active) ? activeDorme : enemyDorme;
  /* ⚠️ QUEM NAO ATACOU NESTA TROCA NAO APLICA STATUS (18/09/2026). Reportado com print: o Dewgong
     estava DORMINDO e mesmo assim congelou o Gengar -- o log dizia *"Dewgong continua a dormir e
     nao pode atacar"* e a linha seguinte era *"Gengar ficou congelado com Raio Congelante"*.
     A CAUSA: os seis `tentar*` leem o `lastMove` do atacante, e ele fica gravado da troca ANTERIOR
     (ou ate de outro confronto -- a instancia atravessa a batalha). Quem dormiu nao chama o
     `golpesDaTroca`, entao o `lastMove` velho continua la e o sorteio rodava em cima dele.
     ⚠️ E NAO ERA SO O SONO NEM SO O GELO: medido, os TRES estados que zeram o golpe (sono, gelo e
     paralisia) vazavam nos QUATRO status, nas chances cheias de cada golpe -- 9,5% no Raio
     Congelante e 30% no Trovao.
     A GUARDA E O PROPRIO GOLPE TER SAIDO, e nao uma lista dos tres estados: `dmgByFirst` ja e `[]`
     quando ele nao ataca, seja por que for. Assim o proximo estado que impedir um ataque nasce
     coberto -- uma lista de estados aqui ficaria pra tras no primeiro que entrasse. */
  const primeiroAtacou = dmgByFirst.length > 0;
  const segundoAtacou  = dmgBySecond.length > 0;
  /* ⚠️ A DRENAGEM DEVOLVE METADE DO DANO EFETIVO, e ela roda em DOIS momentos diferentes -- um por
     lado --, porque ela é CRONOLÓGICA: quem bate primeiro cura primeiro, antes de o outro revidar.
     Rodando as duas juntas no fim, um Oddish CHEIO que matasse o Geodude com Absorver tomava o
     revide moribundo e só ENTÃO curava, terminando cheio de novo -- quando no jogo ele cura zero
     (já estava cheio) e termina machucado.
     A cura sai do dano EFETIVO (`saiu[].d`), que é o que a barra andou de verdade.
     ELA RODA FORA DO `if(diario)`: o diário é apresentação e é opcional.
     QUEM CAIU NÃO SE CURA, e ela NUNCA PASSA DO TETO.
     Ver o comentário completo no index.html. */
  const drenar = (saiu, quemBate, alvoDormia) => {
    const fr = GOLPES_DRENO[quemBate.lastMove];
    if(!fr) return 0;
    if(GOLPES_SO_DORMINDO[quemBate.lastMove] && !alvoDormia) return 0;
    if(quemBate.hp <= 0) return 0;
    const total = saiu.reduce((a, h) => a + h.d, 0);
    const cura = Math.min(Math.floor(total * fr), quemBate.maxHp - quemBate.hp);
    if(cura <= 0) return 0;
    quemBate.hp += cura;
    return cura;
  };
  /* APLICA OS GOLPES DE UMA TROCA, um a um, e PARA quando o alvo cai: o 4º tapa não sai num
     pokémon que caiu no 3º. Devolve o que saiu DE VERDADE de cada golpe mais a vida que sobrou --
     é desse par que saem a linha do diário e o passo da animação, uma barra por tapa. */
  /* ⚠️ O TETO DE QUEM ATACA UM ALVO DE VIDA CHEIA. São DUAS regras na mesma conta, e o teto que
     vale é o MENOR delas (ver o comentário de CHEIO_TETO_MIN):
       - a de 14/09: quem está RASPANDO (abaixo de 10% da barra dele) para em 70%, sempre;
       - a de 17/09: qualquer um para entre 70% e 95%, conforme a vantagem de NÍVEL -- e some de vez
         quando a diferença passa de 15.
     Devolve `null` quando nenhuma se aplica, e aí o golpe sai inteiro (e mata).
     ⚠️ Ela NÃO é "70% do dano": um golpe de 800 numa barra de 400 continuaria matando. O que se
     limita é onde o ALVO PARA, que é o que o pedido descreve. */
  const tetoNoAlvoCheio = (quemBate, alvo) => {
    if(!quemBate || !alvo) return null;
    if(alvo.hp < alvo.maxHp) return null;              // só vale contra quem está CHEIO
    const raspando = quemBate.hp <= quemBate.maxHp * MORIBUNDO_ABAIXO_DE;
    const dif = (quemBate.level || 0) - (alvo.level || 0);
    /* a diferença é do ATACANTE sobre o alvo; negativa cai no piso pelo clamp abaixo */
    let porNivel = null;
    if(dif <= CHEIO_DIF_MAXIMA){
      const t = Math.max(0, Math.min(CHEIO_DIF_MAXIMA, dif)) / CHEIO_DIF_MAXIMA;
      porNivel = CHEIO_TETO_MIN + (CHEIO_TETO_MAX - CHEIO_TETO_MIN) * t;
    }
    if(raspando && porNivel != null) return Math.min(MORIBUNDO_TETO_NO_CHEIO, porNivel);
    if(raspando) return MORIBUNDO_TETO_NO_CHEIO;
    return porNivel;
  };
  /* APARA A TROCA no teto devolvido acima. Ele vale por TROCA e não por golpe: um Tapa Duplo de 5
     tapas também "leva o outro num ataque só", e limitar só o primeiro tapa deixaria os outros
     quatro matarem do mesmo jeito. */
  const tetoDeQuemRaspa = (quemBate, alvo, golpes) => {
    if(!quemBate || !alvo) return golpes;
    const frac = tetoNoAlvoCheio(quemBate, alvo);
    if(frac == null) return golpes;
    const total = golpes.reduce((a, d) => a + d, 0);
    if(total < alvo.hp) return golpes;                    // não ia matar: nada a fazer
    const teto = Math.max(1, Math.round(alvo.maxHp * frac));
    if(teto >= alvo.hp) return golpes;                    // o teto não aperta nada
    /* reparte o teto entre os tapas na MESMA proporção, pra a linha do log continuar coerente
       com o selo `Nx` -- e o último leva a sobra do arredondamento */
    const fora = golpes.map(d => Math.max(1, Math.round(d * teto / total)));
    let soma = fora.reduce((a, d) => a + d, 0);
    for(let k = fora.length - 1; k >= 0 && soma > teto; k--){
      const tira = Math.min(soma - teto, fora[k] - 1);
      fora[k] -= tira; soma -= tira;
    }
    return fora;
  };
  const aplicarGolpes = (alvo, golpes) => {
    const saiu = [];
    for(const d of golpes){
      if(alvo.hp <= 0) break;
      const antes = alvo.hp;
      alvo.hp = Math.max(0, alvo.hp - d);
      /* `cap` = o corte comeu a DOBRA inteira, ou seja o numero que vai pra tela ficou abaixo
         do que um golpe COMUM daria. O dano gravado e sempre o efetivo, entao quase todo golpe
         que mata mostra menos do que a formula sorteou -- isso sozinho nao e problema, um
         critico que tira 300 de 350 continua mostrando um numero grande. O que interessa e
         quando sobra menos da metade: ai o selo de CRITICO passa a contradizer o proprio numero
         ao lado. Quem le esse campo e so o selo. */
      const efetivo = antes - alvo.hp;
      saiu.push({ d: efetivo, hp: alvo.hp, cap: efetivo * 2 < d });
    }
    return saiu;
  };
  /* A FAIXA APARA O ÚLTIMO GOLPE que saiu, seja ele o único ou o último tapa. Sem aparar, a soma
     das linhas do log passaria do que o pokémon perdeu de verdade -- ele foi a zero e voltou a 1. */
  const aparaAFaixa = (saiu) => { const u = saiu[saiu.length - 1]; if(u){ u.d = Math.max(0, u.d - 1); u.hp = 1; } };
  const saiuNoSegundo = aplicarGolpes(second, tetoDeQuemRaspa(first, second, dmgByFirst));
  /* A Faixa segura ANTES de o diário ser escrito: assim o dano gravado é o EFETIVO (o que saiu de
     verdade, parando em 1) e a barra da tela desce até 1, que é o que aconteceu. A LINHA dela é
     empurrada mais abaixo, depois da linha do golpe -- ver marcaDaFaixa. */
  const faixaDoSegundo = second.hp <= 0 && faixaDeFoco(second, (second === active) ? 'p' : 'e');
  if(faixaDoSegundo){ second.hp = 1; aparaAFaixa(saiuNoSegundo); }
  /* A CURA DE QUEM BATEU PRIMEIRO, no instante do golpe dele -- ANTES de o second revidar. Daqui
     pra baixo, `firstHpBefore` é a vida dele já curada. */
  const drenouOFirst = primeiroDormiu ? 0 : drenar(saiuNoSegundo, first, segundoDormiu);
  if(drenouOFirst) firstHpBefore = first.hp;
  /* ⚠️ O HP DA LINHA É CAPTURADO AQUI, NA HORA DA CURA -- e não lá embaixo, na hora de gravar. O
     campo `hp` quer dizer "a vida depois deste passo", e a linha do first é escrita DEPOIS de o
     second ter revidado: lida na gravação, ela registrava a vida pós-revide (um Oddish que curou
     77 gravava hp:0). Ver o comentário no index.html. */
  const hpDoFirstAposDreno = first.hp;
  const segundoCaiu = second.hp <= 0;
  /* =====================================================================================
     ⚠️ QUEM CAI NÃO REVIDA (15/09/2026, a pedido). O GOLPE MORIBUNDO ACABOU.
     Saíram junto o `DYING_BLOW_FACTOR`, o PISO de 1%-10%, o `apararRevide` que o piso obrigava,
     o `REVIDE_PISO_MIN/MAX` e o ramo de "quem já estava raspando não leva revide" -- os cinco eram
     remendos em cima do revide.
     FICA o teto de quem raspa (`MORIBUNDO_TETO_NO_CHEIO`), que é outra regra: ela é sobre o ATAQUE
     de quem tem pouca vida, não sobre o revide de quem caiu.
     A marca `m` do diário nunca mais é gerada; o reordenamento que ela comanda no cliente fica,
     porque diário antigo tem a marca. Ver o comentário completo no index.html. */
  /* ⚠️ O CONGELAMENTO DO GOLPE DESTA TROCA PEGA O SEGUNDO NA MESMA TROCA, e é o pedido ao pé da
     letra: no exemplo, o Articuno congela o Dragonite e *"agora o dragonite não conseguiu atacar
     porque tá congelado"* -- no mesmo turno, sem esperar o próximo.
     Ele só alcança quem ataca DEPOIS: se o congelado for o mais rápido, ele já bateu antes de o
     gelo chegar, e o efeito vale a partir da troca seguinte. É a mesma assimetria que o segundoCaiu
     já tem, e ela é a do jogo -- quem conecta primeiro leva vantagem.
     ⚠️ E ELE RODA DEPOIS DE O GOLPE CONECTAR (não antes): um ataque que não saiu não congela, e um
     alvo que CAIU também não -- o podeCongelar cobra hp > 0. */
  /* A QUEIMADURA sai pela mesma porta do gelo e na mesma hora: depois de o golpe conectar. Um
     golpe so pode fazer UM dos dois (nenhum golpe esta nas duas tabelas), entao nao ha ordem a
     decidir entre elas -- o que existe e a ordem entre os dois LADOS, e essa e a de velocidade. */
  const congelouOSegundo = (segundoCaiu || !primeiroAtacou) ? null : tentarCongelar(first, second, rng);
  const queimouOSegundo = (segundoCaiu || !primeiroAtacou) ? null : tentarQueimar(first, second, rng);
  const envenenouOSegundo = (segundoCaiu || !primeiroAtacou) ? null : tentarEnvenenar(first, second, rng);
  const paralisouOSegundo = (segundoCaiu || !primeiroAtacou) ? null : tentarParalisar(first, second, rng);
  const estagioDoSegundo = (segundoCaiu || !primeiroAtacou) ? null : tentarEstagio(first, second, rng);
  /* ⚠️ O PODER SECRETO (TM43) vem DEPOIS dos quatro, e ele é o único golpe que pode aplicar
     qualquer um deles -- qual, decide o TERRENO. Pondo-o antes, a marca dele bloquearia o
     `tentar*` da mesma marca nesta troca. Fora de terreno ele não faz nada (nem lê o rng). */
  const secretoNoSegundo = (segundoCaiu || !primeiroAtacou) ? null : tentarPoderSecreto(first, second, rng);
  const saiuNoPrimeiro = (segundoCaiu || congelouOSegundo) ? [] : aplicarGolpes(first, tetoDeQuemRaspa(second, first, dmgBySecond));
  /* O PISO DO REVIDE saiu junto com o revide -- sem revide não há o que limitar, e os dois nunca
     mais caem na mesma troca (por construção, não por aparo). A AUTODESTRUIÇÃO continua sendo o
     único jeito disso acontecer. */
  /* A FAIXA DO PRIMEIRO só tem o que segurar quando o second sobreviveu pra bater nele. */
  const faixaDoPrimeiro = first.hp <= 0 && faixaDeFoco(first, (first === active) ? 'p' : 'e');
  if(faixaDoPrimeiro){ first.hp = 1; aparaAFaixa(saiuNoPrimeiro); }
  /* A CURA DE QUEM BATEU POR ÚLTIMO. Com o second caído ela não acontece: `saiuNoPrimeiro` é
     vazio e o `drenar` devolve 0 sem escrever linha nenhuma. */
  const drenouOSecond = segundoDormiu ? 0 : drenar(saiuNoPrimeiro, second, primeiroDormiu);
  /* o golpe do SEGUNDO também pode congelar -- mas o primeiro já atacou nesta troca, então o efeito
     dele só aparece na próxima. Não há o que bloquear aqui: só a marca. */
  const pulaOSegundo = segundoCaiu || congelouOSegundo || !segundoAtacou;
  const congelouOPrimeiro = pulaOSegundo ? null : tentarCongelar(second, first, rng);
  const queimouOPrimeiro = pulaOSegundo ? null : tentarQueimar(second, first, rng);
  const envenenouOPrimeiro = pulaOSegundo ? null : tentarEnvenenar(second, first, rng);
  const paralisouOPrimeiro = pulaOSegundo ? null : tentarParalisar(second, first, rng);
  const estagioDoPrimeiro = pulaOSegundo ? null : tentarEstagio(second, first, rng);
  const secretoNoPrimeiro = pulaOSegundo ? null : tentarPoderSecreto(second, first, rng);
  const hpDoSecondAposDreno = second.hp;
  if(diario){
    /* O dano registrado é o que SAIU DE VERDADE da vida do alvo, não o número que a fórmula
       sorteou: um golpe de 101 num pokémon com 54 de HP tira 54. Gravar o valor cru fazia o log
       não fechar -- somando as linhas dava mais dano do que o pokémon tinha de vida. */
    /* UMA ENTRADA POR TAPA: a barra desce uma vez por tapa, e a animação lê o diário. No LOG elas
       viram uma linha só, somadas -- a mesma regra da drenagem, que tem duas entradas e uma linha.
       Os campos t (qual tapa) e tn (quantos ao todo) só existem quando há mais de um: assim o
       confronto comum grava exatamente o que gravava antes, e log velho continua se lendo igual. */
    /* UMA ENTRADA POR TAPA: a barra desce uma vez por tapa, e a animação lê o diário. No LOG
       elas viram uma linha só, somadas -- a mesma regra da drenagem. */
    const gravar = (q, saiu, quemBate, marcaM) => {
      saiu.forEach((h, i) => {
        /* ⚠️ O SELO DE CRITICO NAO SAI EM GOLPE LIMITADO (`cap`), e essa e a regra toda.
           Ele existe pra explicar uma barra que caiu o DOBRO -- foi pra isso que ele voltou em
           10/09/2026, depois de um Gyarados morrer de vida cheia sem nada na tela dizendo por
           que. Quando o numero foi limitado (pelo que o alvo tinha, pela Faixa ou pelo piso do
           revide), a barra NAO caiu o dobro: caiu o que sobrava. Ali o selo nao tem trabalho a
           fazer e vira o contrario do que ele e -- ele anuncia dobro ao lado de um numero
           pequeno, e o jogador le "o critico tirou menos que o golpe comum".
           Reportado em 12/09/2026 num Bulbasaur x Onix: -152 e depois "CRITICO -9", com o Onix
           tendo 9 de HP. O critico MATOU o Onix; o 9 e so o que ele tinha.
           NUM GOLPE DE VARIOS TAPAS so o tapa limitado perde o selo -- os outros seguem, e como
           o log soma os tapas numa linha so, a linha continua selada quando o total foi grande. */
        /* ⚠️ O GOLPE VIAJA POR LINHA (`mv`). O log nomeava TODA linha de um lado com o golpe do
           MATCHUP -- o ultimo usado --, e isso e falso pra quem sorteia golpe a cada ataque
           (reportado em 13/09/2026: Clefairy com "Raio Solar 3x"). Ver o comentario do cliente. */
        const reg = { q: q, d: h.d, hp: h.hp, c: (quemBate.lastCrit && !h.cap)?1:0, m: marcaM, z: quemBate.lastMoveNulo?1:0 };
        if(quemBate.lastMove) reg.mv = quemBate.lastMove;
        /* ⚠️ A ESCALA DO ROLAMENTO viaja por linha, e ela existe pro LOG NÃO ACHATAR o golpe.
           A suavização de 12/09/2026 reparte dois golpes do mesmo atacante quando a razão passa de
           1,176×, porque "o mesmo golpe contra o mesmo alvo só difere pelo sorteio da fórmula" --
           e o Rolamento é a PRIMEIRA exceção real a isso: ele dobra de verdade. Sem este campo o
           log mostrava 82 e depois 72 onde a barra tinha caído 30 e 60.
           Ele entra como PESO na suavização, exatamente como o crítico pesa 2 -- ver fatiaDoGolpe. */
        if(quemBate.lastRolamento > 1) reg.rl = quemBate.lastRolamento;
        if(quemBate.lastMetronomo) reg.mt = 1;
        if(saiu.length > 1){ reg.t = i + 1; reg.tn = saiu.length; }
        diario.push(reg);
      });
    };
    /* A LINHA DA DRENAGEM VEM COLADA NA DO GOLPE, e antes da marca da Faixa: ela é parte do MESMO
       lance, e é essa adjacência que a apresentação do cliente usa (o `passosVisiveis` move o par
       junto no reordenamento do moribundo, e o `passosHtml` anexa a cura à linha do golpe).
       O `q` É DE QUEM CUROU -- ao contrário do `absorbdano` da drenagem de abertura, cujo `q` é de
       quem causou e o HP some do outro lado. */
    const marcaDoDreno = (q, cura, hpApos, quem) =>
      ({ q: q, d: cura, hp: hpApos, c:0, m:0, z:0, x:'dreno', mv: quem.lastMove });
    /* ⚠️ AS LINHAS DO CONGELAMENTO VAO PRO SLOT DE QUEM ELAS DESCREVEM, em ordem de VELOCIDADE --
       e nao todas empilhadas no fim. Elas sao sobre a VEZ de um pokemon, entao tem que sair onde a
       vez dele acontece:
         - DEGELOU vem ANTES do golpe dele, porque o pedido diz que ele degela e ENTAO ataca
           (*"aparece a frase ... e entao ele realiza o ataque normalmente"*);
         - GELADO vem no lugar do golpe dele, que e o que a frase explica;
         - CONGELOU vem DEPOIS do golpe que congelou, porque e consequencia dele.
       Empilhadas no fim, o log dizia "Blissey ataca / Blissey degelou" -- a ordem invertida da cena,
       o mesmo defeito que a linha do acordou teve em 14/09/2026.
       O q e de QUEM ESTA CONGELADO (como o do acordou e o da furia): estas linhas sao sobre UM
       pokemon, nao sobre um causador e um alvo. */
    const qDoFirst = activeFirst ? "p" : "e", qDoSecond = activeFirst ? "e" : "p";
    const geloDe = (p, q) => {
      /* ⚠️ QUEM JA CAIU NAO PERDE TURNO -- ver a nota do dormeDe. Estas duas correm ANTES dos
         golpes, entao hoje o pokemon esta sempre vivo aqui; a guarda existe pra o dia em que
         alguem mover a chamada, que foi exatamente o que aconteceu com a do sono. */
      if(p.hp <= 0) return;
      const g = (p === active) ? activeGelo : enemyGelo;
      if(g === "degelou") diario.push({ q:q, d:0, hp:null, c:0, m:0, z:0, x:"degelou", g:p.name });
      if(g === "preso")   diario.push({ q:q, d:0, hp:null, c:0, m:0, z:0, x:"gelado",  g:p.name });
    };
    /* ⚠️ "CONTINUA A DORMIR" (16/09/2026, pedida com estas palavras: *"Caso o pokemon nao acorde no
       turno dele, deve exibir a mensagem: Onix continua a dormir e nao pode atacar, espera 1,5s e
       continua"*). Ela e o analogo EXATO do `gelado` do congelamento, e faltava: o sono tinha a
       linha de ADORMECER e a de ACORDAR, e nada nos turnos do meio -- o jogador via a barra dele
       parada sem nada explicando, que e a mesma razao do "mas nao teve efeito" da imunidade.
       ⚠️ ELA NAO SAI NA TROCA EM QUE ELE ACORDA: ali quem conta a historia e a linha do `acordou`,
       e as duas juntas se contradiriam ("continua a dormir" / "acordou" no mesmo turno). Quem
       separa os dois casos e o `_dormindoPor`, que o `acorda` ja decrementou na entrada da troca:
       maior que zero quer dizer que ainda ha sono depois desta.
       ⚠️ ELA SAI TAMBEM NA PRIMEIRA TROCA LIVRE, e isso e o pedido ao pe da letra (*"caso o pokemon
       nao acorde no turno dele"*). Uma versao anterior a pulava, pra nao repetir a informacao da
       frase "X fez Y dormir" -- e com isso ela so aparecia no sono de TRES trocas, ou seja em um
       terco dos sonos e uma vez so. As duas nao competem: o `sono` ocupa o passo DELE e esta e
       sobre a vez que o adormecido perdeu, num passo proprio.
       O q e de QUEM ESTA DORMINDO, como o do `gelado`, o do `acordou` e o da furia: estas linhas
       sao sobre UM pokemon, nao sobre um causador e um alvo. */
    const dormeDe = (p, q) => {
      const dormiu = (p === first) ? primeiroDormiu : segundoDormiu;
      if(!dormiu || p._dormindoPor <= 0) return;
      /* ⚠️ E QUEM JA CAIU NAO PERDE TURNO (18/09/2026). Reportado com print na Torre: a Jynx matou
         o Primeape e a linha *"Primeape continua a dormir e nao pode atacar"* saia LOGO DEPOIS --
         o cabecalho ja mostrava 0/435.
         A CAUSA E A POSICAO: esta chamada vem DEPOIS do golpe do first (e tem que vir -- a frase e
         sobre o turno DELE, que e depois do golpe de quem e mais rapido), e o golpe do first pode
         ter derrubado o second. Nao e defeito da Torre: ela chama o MESMO simulateGymBattle da
         jornada, e os dois motores tinham isto igual.
         Medido: saia em 47% dos confrontos em que o adormecido morre. */
      if(p.hp <= 0) return;
      diario.push({ q:q, d:0, hp:null, c:0, m:0, z:0, x:"dormindo", g:p.name });
    };
    const congelou = (p, q, mv) => { if(mv) diario.push({ q:q, d:0, hp:null, c:0, m:0, z:0, x:"congelou", g:p.name, mv:mv }); };
    /* A linha da queimadura tem a MESMA forma da do congelamento: dano 0, o q de QUEM FOI QUEIMADO
       e o golpe no mv -- e o golpe que a frase nomeia. */
    const queimou = (p, q, mv) => { if(mv) diario.push({ q:q, d:0, hp:null, c:0, m:0, z:0, x:"queimou", g:p.name, mv:mv }); };
    const envenenou = (p, q, mv) => { if(mv) diario.push({ q:q, d:0, hp:null, c:0, m:0, z:0, x:"envenenou", g:p.name, mv:mv }); };
    const paralisou = (p, q, mv) => { if(mv) diario.push({ q:q, d:0, hp:null, c:0, m:0, z:0, x:"paralisou", g:p.name, mv:mv }); };
    /* ⚠️ O PODER SECRETO REUSA A LINHA DO STATUS QUE ELE APLICOU: o jogador precisa ler "ficou
       queimado", e não "sofreu o efeito do terreno" -- a mecânica é a mesma, o que muda é de onde
       ela veio. O `mv` continua sendo o GOLPE, então a frase sai *"X ficou queimado com PODER
       SECRETO!"*, que é verdade nas duas pontas.
       A marca que o tentarPoderSecreto devolve É o campo da instância, e este mapa a traduz pro
       nome da linha -- os dois saem das MESMAS quatro entradas do EFEITO_DO_TERRENO, então um
       terreno novo lá já nasce com linha aqui. */
    const LINHA_DA_MARCA = { _congelado:congelou, _queimado:queimou, _envenenado:envenenou, _paralisado:paralisou };
    const secreto = (p, q, marca) => { if(marca && LINHA_DA_MARCA[marca]) LINHA_DA_MARCA[marca](p, q, GOLPE_PODER_SECRETO); };
    /* ⚠️ O `q` DA LINHA DE ESTAGIO E DE QUEM TEVE O ATRIBUTO MEXIDO, e nao de quem usou o golpe:
       no Asa de Aco os dois sao o MESMO pokemon, mas nos outros quatro sao lados opostos. Lido
       como "quem bateu", a frase nomearia o pokemon errado em quatro dos cinco. */
    const estagio = (quemBate, qBate, alvo, qAlvo, ef) => {
      if(!ef) return;
      const quem = ef.noProprio ? quemBate : alvo;
      const q = ef.noProprio ? qBate : qAlvo;
      diario.push({ q:q, d:0, hp:null, c:0, m:0, z:0, x:"estagio", g:quem.name, mv:ef.golpe,
                    st:ef.atributo, dl:ef.delta });
    };
    const travadoDe = (p, q) => {
      /* ⚠️ QUEM JA CAIU NAO PERDE TURNO -- ver a nota do dormeDe, logo abaixo. A do second corre
         depois do golpe do first, entao ela alcanca quem acabou de ser derrubado. */
      if(p.hp <= 0) return;
      const t = (p === active) ? activeTravado : enemyTravado;
      if(t) diario.push({ q:q, d:0, hp:null, c:0, m:0, z:0, x:"paralisado", g:p.name });
    };
    /* ⚠️ AS DUAS LINHAS DE ENTRADA (degelou / gelado) SAEM NO COMECO DA TROCA, antes de QUALQUER
       golpe -- dos dois lados. O sorteio do degelo acontece na entrada do doExchange, entao e ali
       que elas sao verdade; e e assim que o pedido descreve o ciclo: *"aparece a frase: Dragonite
       nao consegue atacar por estar congelado, E O ARTICUNO ATACA NOVAMENTE"*.
       ⚠️ POSTAS NO SLOT DE CADA UM elas saiam ao contrario no caso do RECONGELAMENTO: quem degelou
       e foi congelado de novo na mesma troca lia 'congelou / degelou', a ordem invertida da cena. */
    geloDe(first, qDoFirst);
    travadoDe(first, qDoFirst);
    dormeDe(first, qDoFirst);
    geloDe(second, qDoSecond);
    if(!primeiroDormiu){
      gravar(qDoFirst, saiuNoSegundo, first, 0);
      if(drenouOFirst) diario.push(marcaDoDreno(qDoFirst, drenouOFirst, hpDoFirstAposDreno, first));
      if(faixaDoSegundo) diario.push(marcaDaFaixa((second === active) ? 'p' : 'e', firstHpBefore));
    }
    /* o congelamento causado pelo golpe do FIRST vem colado nele, e ANTES da vez do second -- e ele
       que explica por que o second nao ataca nesta troca */
    congelou(second, qDoSecond, congelouOSegundo);
    queimou(second, qDoSecond, queimouOSegundo);
    envenenou(second, qDoSecond, envenenouOSegundo);
    paralisou(second, qDoSecond, paralisouOSegundo);
    estagio(first, qDoFirst, second, qDoSecond, estagioDoSegundo);
    secreto(second, qDoSecond, secretoNoSegundo);
    /* ⚠️ O "CONTINUA A DORMIR" DO SECOND VEM DEPOIS DO GOLPE DO FIRST, e nao junto do geloDe la
       em cima: a frase e sobre O TURNO DELE (*"caso o pokemon nao acorde no turno dele"*), e o
       turno dele e depois do golpe de quem e mais rapido. Junto do gelo, o log dizia "Onix
       continua a dormir / Gengar atacou" -- a ordem invertida da cena.
       As duas do GELO ficam juntas la em cima de proposito, e por um caso que o sono nao tem: o
       recongelamento na mesma troca (ver o comentario delas). */
    travadoDe(second, qDoSecond);
    dormeDe(second, qDoSecond);
    if(!segundoDormiu){
      gravar(qDoSecond, saiuNoPrimeiro, second, segundoCaiu?1:0);
      if(drenouOSecond) diario.push(marcaDoDreno(qDoSecond, drenouOSecond, hpDoSecondAposDreno, second));
      if(faixaDoPrimeiro) diario.push(marcaDaFaixa((first === active) ? 'p' : 'e', second.hp));
    }
    congelou(first, qDoFirst, congelouOPrimeiro);
    queimou(first, qDoFirst, queimouOPrimeiro);
    envenenou(first, qDoFirst, envenenouOPrimeiro);
    paralisou(first, qDoFirst, paralisouOPrimeiro);
    estagio(second, qDoSecond, first, qDoFirst, estagioDoPrimeiro);
    secreto(first, qDoFirst, secretoNoPrimeiro);
    // AGORA sim: ele apanhou nesta troca, e so entao acorda (ver o comentario do `acordaram`)
    /* ⚠️ QUEM MORREU DORMINDO NÃO ACORDA (14/09/2026, a pedido: *"quando um pokémon morre durante
       o sono, não precisa exibir que ele acordou e voltou para a luta, nem no log e nem na
       batalha"*). Reportado num Venusaur × Mr. Mime: o Mr. Mime levou o golpe dormindo, morreu, e a
       linha do despertar saiu logo abaixo do 0/331.
       O contador do sono anda no começo da troca e o pokémon leva o golpe no meio dela -- então só
       AQUI, depois dos golpes, dá pra saber se ele chegou vivo ao fim. */
    acordaram.forEach(a => { if(a.p && a.p.hp > 0) diario.push({ q:a.q, d:0, hp:null, c:0, m:0, z:0, x:'acordou', g:a.nome }); });

  }
  /* ⚠️ O DANO DA QUEIMADURA FECHA A TROCA: 1/16 do HP MAXIMO, nos DOIS lados, depois de todos os
     golpes. E o unico dano do motor que nao vem de um ataque, e por isso ele e o TERCEIRO membro da
     familia "HP que sumiu sem ser golpe do adversario" -- ao lado do absorbdano e da confusao. Toda
     conta de teste que soma "quanto ele perdeu de vida" precisa descontar os tres (ver danoSemGolpe
     no tools/test-especiais.js).
     ELA PODE MATAR, como no jogo original. Quem ja caiu na troca nao queima de novo -- o dano
     aconteceria depois da morte.
     ⚠️ E O q DA LINHA E DE QUEM ESTA QUEIMADO, nao de quem causou: a queimadura nao tem causador
     nesta troca (ela foi aplicada turnos atras). E a convencao do acordou, do gelado e da furia --
     linhas sobre UM pokemon. Por isso ela nao pode usar o passo comum da animacao, que INVERTE o q
     pra achar quem apanha: ela tem passo proprio (ver buildAnimatedHitSequence).
     O MINIMO E 1 de dano: com o arredondamento, um pokemon de menos de 16 de teto levaria ZERO e a
     queimadura viraria enfeite -- e uma linha de "-0 de HP" e o que este log evita em toda regra. */
  /* ⚠️ E ELA NUNCA DERRUBA OS DOIS NA MESMA TROCA. A regra e de 12/09/2026, pedida com estas
     palavras: *"nao existe de os 2 cairem juntos, somente na auto destruicao; fora isso, jamais os
     2 devem morrer juntos e um ficar de pe"*. Foi por ela que o revide moribundo deixou de matar, e
     a queimadura reabriria a porta pelo outro lado: o adversario cai no golpe, e no fim da mesma
     troca a queimadura leva quem o derrubou.
     Medido antes da trava: **95 dos 99 casos de morte dupla** passaram a ser dela -- ou seja, ela
     virou a causa dominante de algo que o jogo tinha acabado de eliminar.
     Quem chega ultimo cede: se o outro lado ja esta em 0, a queimadura para em 1 de HP. Ela mata
     normalmente em todo o resto, que e o que o jogo original faz.
     O `outro` e passado como FUNCAO porque o first pode cair na queima DELE -- lido antes, o
     second veria o estado velho e a trava nao valeria no caso que ela existe pra pegar. */
  /* ⚠️ OS DOIS STATUS DE DANO POR TURNO DIVIDEM ESTE BLOCO, e isso e o ponto: a trava do "os dois
     nunca caem juntos" tem que valer sobre os DOIS somados. Em blocos separados, a queimadura
     pararia em 1 olhando o adversario vivo e o veneno o mataria logo depois -- e a trava daria
     verde em cada metade enquanto o par quebrava a regra.
     A ORDEM e queimadura e depois veneno, e ela quase nao importa hoje: nenhum pokemon costuma ter
     os dois (o Fogo e imune a queimadura e quem envenena e quase todo de Veneno). Fica fixa pra o
     dia em que os dois se encontrarem. */
  const danoDeStatus = (p, q, outro, marca, fracao, x) => {
    if(!p || !p[marca] || p.hp <= 0) return;
    let d = Math.min(p.hp, Math.max(1, Math.round((p.maxHp || 0) * fracao)));
    const o = outro();
    if(d >= p.hp && o && o.hp <= 0) d = p.hp - 1;   // o outro ja caiu: este nao pode matar
    /* ⚠️ A FAIXA DE FOCO SEGURA O DANO DE STATUS TAMBEM (16/09/2026). No jogo original o Focus
       Sash so protege de dano DIRETO -- aqui ela protege dos dois, e a razao esta na promessa que
       a casa fez pro item: "quem carrega a Faixa nunca termina um confronto em 0 sem ela ter
       disparado antes". Foi essa a trava que pegou isto, e ela existe porque a AUTODESTRUICAO ja
       tinha furado a Faixa uma vez e o jogador reportou (*"equipei o charizard com Faixa de foco e
       ele morreu direto quando chegou com 0 de hp"*). Um item que promete segurar a morte e falha
       justamente na morte silenciosa e pior que nao ter o item.
       Ela e UMA: gasta aqui, e o proximo turno de queimadura leva o pokemon. */
    if(d >= p.hp && faixaDeFoco(p, q)){
      d = p.hp - 1;
      if(diario) diario.push(marcaDaFaixa(q, o ? o.hp : 0));
    }
    if(d <= 0) return;                               // ele ja esta em 1 e nao ha o que tirar
    p.hp -= d;
    /* ⚠️ ELA NAO GRAVA `hp`, e e a mesma razao do REMOINHO: o campo quer dizer "a vida do ALVO
       depois do golpe", e o alvo de uma linha comum e o lado OPOSTO ao `q`. Aqui o `q` e de quem
       PERDE, entao gravar a vida dele ali faz toda conta que le o diario atribui-la ao outro lado.
       Foi exatamente isso: a trava do "ninguem ataca depois de cair" acusou 1 em 3.645 por causa
       deste campo, e a queimadura era a unica no confronto. */
    if(diario) diario.push({ q:q, d:d, hp:null, c:0, m:0, z:0, x:x, g:p.name });
  };
  const qDoPrimeiro = activeFirst ? "p" : "e", qDoSegundo = activeFirst ? "e" : "p";
  danoDeStatus(first,  qDoPrimeiro, () => second, "_queimado",   QUEIMADURA_DANO, "queima");
  danoDeStatus(second, qDoSegundo,  () => first,  "_queimado",   QUEIMADURA_DANO, "queima");
  danoDeStatus(first,  qDoPrimeiro, () => second, "_envenenado", VENENO_DANO,     "veneno");
  danoDeStatus(second, qDoSegundo,  () => first,  "_envenenado", VENENO_DANO,     "veneno");
  /* ⚠️ A MORTE SÚBITA ACABOU EM 12/09/2026, a pedido, e o bloco inteiro saiu daqui.
     Ela existia porque o revide moribundo podia derrubar o primeiro: os dois ficavam em 0, e ela
     ressuscitava um com 5%-15% da vida (já foi 1%-3% e 1%-10%). Hoje o revide **não mata** (ver o
     piso lá em cima), então os dois nunca mais caem juntos e não há o que desempatar.
     O QUE SAIU JUNTO, e é o motivo de a remoção valer a pena: a ressurreição, o aparo da linha que
     ela obrigava, a linha ⚖️ do log, e as TRÊS voltas de ordenação que ela custou entre 09 e
     12/09/2026 -- o golpe que sumia, os dois golpes colados e o pokémon atacando com a barra em
     zero eram todos consequência dela.
     A AUTODESTRUIÇÃO continua sendo o único jeito de os dois caírem juntos: ela zera o HP dentro do
     `tentarGolpeEspecial` e devolve antes de chegar aqui, e é ela que o `explosaoDoAtivo` resolve.
     LOG VELHO (gravado quando ela existia) continua se lendo: a linha `x:'desempate'` segue
     desenhada pelo `passosHtml` e pelo `fraseDoEspecial`. O que não existe mais é gerar uma nova. */
}
/* O FIM DA BATALHA, e ele vale nos DOIS caminhos de saída -- a vitória E A DERROTA. Existir como
   função é o ponto: enquanto era um bloco solto antes do `return` da vitória, o `return` da
   derrota passava por cima dele e nada acusava.
   1) A FÚRIA DEVOLVE O QUE EMPRESTOU. Ela mexe no TETO de vida, e o teto é um número GRAVADO na
      instância -- não é lido de uma função como os outros cinco atributos. Sem devolver, um Tauros
      que entrou em fúria três vezes saía da luta com o teto +30, e a barra dele na tela de time
      mudava de tamanho sozinha. Pior: o `_furia` é zerado no COMEÇO da batalha seguinte, então o
      teto inflado deixava de ter de onde ser recalculado e ficava errado pra valer.
      Medido em 11/09/2026, quando a derrota ainda escapava: 983 pokémon de 3.000 saíam de uma
      derrota com o teto errado, contra ZERO nas vitórias.
      A devolução é EXATA: sai o mesmo número que entrou, do teto e da vida atual. Quem já caiu fica
      em 0 -- devolver vida a um pokémon desmaiado o ressuscitaria.
   2) OS MARCADORES DE CONFRONTO SÃO SOLTOS. `_especialContra` e `_anulado.contra` guardam uma
      REFERÊNCIA ao pokémon adversário: enquanto não eram soltos, cada membro do time segurava um
      time inimigo inteiro vivo na memória depois da luta -- e, quando o adversário apontava de
      volta, o par fechava um CICLO que estourava a pilha do salvamento (ver limparParaFirestore).
      Medido: os campos sobravam em 100% das batalhas e o ciclo se fechava em 3% delas. */
function encerrarBatalha(team, inimigos){
  (team || []).concat(inimigos || []).forEach(p => {
    if(!p) return;
    if(p._furia){
      const emprestado = FURIA_BONUS * p._furia;
      p._furia = 0;
      p.maxHp = calcMaxHp(p);
      p.hp = p.hp > 0 ? Math.max(1, Math.min(p.maxHp, p.hp - emprestado)) : 0;
    }
    p._especialContra = null;
    p._anulado = null;
    p._dormindoPor = 0;
    /* ⚠️ O DO REMOINHO ENTROU AQUI EM 12/09/2026, e a trava do ciclo o pegou no mesmo dia:
       ele guarda uma REFERENCIA ao adversario, igual ao _especialContra, e sem soltar ele
       a feature nova reabria exatamente o defeito que custou save de jogador. */
    p._remoinhoContra = null;
    /* ⚠️ O DO ROLAMENTO. Ele não guarda referência a ninguém (é só um contador), mas vaza do mesmo
       jeito: sem esta linha um Golem que rolou quatro vezes sai da luta com 480 de poder guardado e
       a batalha SEGUINTE começa com ele -- o mesmo tipo de vazamento que o teto de HP da Fúria teve. */
    p._rolamento = 0;
    /* ⚠️ A PARALISIA e solta aqui como no cliente: ela e um campo da instancia e dura a BATALHA.
       ⚠️ E VALE UMA NOTA: o cliente solta tambem _congelado, _queimado e _envenenado, e este lado
       NAO -- desde que os tres existem. Hoje isso e inofensivo porque as instancias do servidor
       nascem a cada batalha (o resolverTimeDosSaves e o battleHydrate montam do zero), ao
       contrario das do cliente, que vao pro SAVE. Fica registrado pro dia em que algum caminho do
       servidor passar a reusar instancia: ali os tres vazam junto. */
    p._paralisado = null;
    limparEstagios(p);   // os estagios duram a BATALHA (ver o cliente)
  });
}
function simulateGymBattle(team, enemyTeam, rng, opts){
  team.forEach(p=>{ p.maxHp=calcMaxHp(p); p.hp=p.maxHp; });
  explosaoDoAtivo = null;   // o marcador da autodestruição é por BATALHA (ver tentarGolpeEspecial)
  /* A FÚRIA ACUMULADA também é por BATALHA: ela cresce de confronto em confronto enquanto o pokémon
     estiver de pé, e some quando a batalha acaba. Zerar aqui, e não no fim, é o que faz um time
     carregado de uma batalha anterior não entrar na próxima já furioso. */
  /* O ROLAMENTO zera junto: ele é por BATALHA, como a Fúria. Zerar no começo E no fim não é
     redundância -- um time montado por fora (a Torre, o Ginásio da Cidade) pode chegar aqui sem ter
     passado por um encerrarBatalha. */
  (team || []).concat(enemyTeam || []).forEach(p => { if(p){ p._furia = 0; p._rolamento = 0; } });   // o servidor chama o outro lado de enemyTeam
  /* A LISTA DO QUE FOI GASTO zera a cada batalha: ela é o recado pra quem chamou tirar o item da
     conta, e um recado de uma batalha anterior faria gastar item que ninguém usou. */
  itensGastos = [];
  /* A CHUVA É POR BATALHA, e é sorteada AQUI -- antes do primeiro confronto, que é o pedido ao pé
     da letra ("é ativada antes da batalha começar"). Ela é o único efeito deste motor que não sai
     do `tentarGolpeEspecial`: os nove de lá são por confronto, este vale pelos três primeiros
     confrontos da batalha inteira e VALE PROS DOIS LADOS.
     Zerar aqui, e não no fim, é o que faz uma batalha não herdar a chuva da anterior -- a mesma
     razão do `_furia` e do `explosaoDoAtivo` logo acima. */
  limparClima();   // quem SORTEIA agora e a abertura de cada confronto (ver tentarChuva)
  enemyTeam.forEach(p=>{ p.maxHp=calcMaxHp(p); p.hp=p.maxHp; });

  const matchups = [];
  /* ⚠️ O ATIVO DE CADA LADO É UM ÍNDICE, e não "o primeiro vivo" -- foi assim que o WHIRLWIND
     (12/09/2026) coube sem inventar um segundo laço. Enquanto o inimigo era `enemyTeam[brockIndex]`
     com o índice só ANDANDO PRA FRENTE, não havia como um pokémon sair do confronto sem ter caído e
     voltar depois; hoje o índice é só "quem está em campo agora", e quem manda nele é o laço ou o
     sopro.
     ⚠️ E ISSO NÃO MUDA NADA sem o Whirlwind, por construção: o índice do inimigo só avançava quando
     ele CAÍA, então ele já era exatamente "o primeiro vivo" -- que é o que a linha abaixo calcula.
     O mesmo vale pro jogador, que era `alive[0]`. Conferido por impressão: o mesmo build com e sem
     esta reescrita dá o MESMO hash de resultado em 900 batalhas semeadas. */
  const primeiroVivo = (time) => time.findIndex(p => p && p.hp > 0);
  let iInimigo = 0, iAtivo = 0;
  // a sequência de vitórias agora é do TREINADOR (de cada lado da batalha), não de um pokémon
  // específico -- trocar de pokémon não zera a sequência, só uma derrota de verdade zera
  let playerStreak = 0, enemyStreak = 0;   // o maxPlayerStreak e do cliente: so a tela da jornada o mostra
  /* UM CONFRONTO POR VOLTA. Eram dois laços aninhados ("enquanto este inimigo não cai"), e o de
     fora deixou de fazer sentido quando o inimigo passou a poder TROCAR sem cair. */
  while(true){
    if(!enemyTeam[iInimigo] || enemyTeam[iInimigo].hp <= 0) iInimigo = primeiroVivo(enemyTeam);
    if(iInimigo < 0) break;                       // o time inimigo acabou
    if(!team[iAtivo] || team[iAtivo].hp <= 0) iAtivo = primeiroVivo(team);
    if(iAtivo < 0){ encerrarBatalha(team, enemyTeam); return { win:false, matchups }; }
    const diario = [];
    /* O SOPRO ROLA ANTES DE TUDO, e é por isso que ele vem antes de ler os dois ativos: o confronto
       que vai acontecer é o do pokémon que ENTROU, e a linha dele é o que explica a troca.
       Uma vez por volta do laço -- sem re-rolar depois da troca, senão a corrente não teria fim. */
    {
      const sopro = tentarRemoinho(team, enemyTeam, iAtivo, iInimigo, rng, diario);
      if(sopro){ iAtivo = sopro.iAtivo; iInimigo = sopro.iInimigo; }
    }
    const enemy = enemyTeam[iInimigo];
    const active = team[iAtivo];
    anotarItemDeAtributo(active, 'p');   // entrou em confronto: o item de atributo será gasto
    anotarItemDeAtributo(enemy, 'e');
    // reflete a sequência ATUAL do treinador em cada pokémon -- calcDamage usa esse campo pra
    // decidir a vulnerabilidade, sem precisar mudar a assinatura da função
    active.winsThisBattle = playerStreak;
    enemy.winsThisBattle = enemyStreak;
    const playerHpBefore = active.hp;
    const enemyHpBefore = enemy.hp;
    const playerAliveBefore = team.filter(p => p.hp > 0).length;
    /* QUANTOS INIMIGOS DE PÉ. Era `enemyTeam.length - brockIndex`, que valia porque o índice contava
       os que já tinham caído; com o índice virando "quem está em campo", a conta passou a ser o que
       ela sempre quis dizer. */
    const enemyAliveBefore = enemyTeam.filter(p => p.hp > 0).length;
      /* POÇÃO: MESMA MECÂNICA DO RECUPERAR -- acontece ANTES da luta, não depois.
         O pokémon entra machucado do confronto anterior; se está com 25% ou menos, se cura e só
         então o novo adversário ataca. Ficava no fim do confronto (curava quem tinha acabado de
         vencer), e dava uma cena sem sentido: o pokémon matava o adversário sem tomar um golpe e
         tomava a poção logo em seguida -- reportado em 03/09/2026 com um "ele nem tinha tomado hit
         ainda". A vida que ele carrega é do confronto ANTERIOR, e é isso que a tela não conta.
         Vem antes do doExchange de propósito, e isso resolve sozinho a ordem com o Recuperar: se a
         poção subiu o HP pra cima de 70%, o Recuperar não sai mais; se ela não disparou, ele sai
         normal. Nunca os dois.
         O playerHpBefore já foi lido lá em cima, então a barra começa no valor machucado e SOBE --
         é o que faz a cura aparecer na tela em vez de a vida surgir do nada. */
      if(active.item && CURA_DA_POCAO[active.item] && active.hp > 0 && active.hp <= active.maxHp * POCAO_GATILHO_HP){
        const item = active.item;
        const curado = Math.min(active.maxHp - active.hp, Math.round(active.maxHp * CURA_DA_POCAO[item]));
        if(curado > 0){
          active.hp += curado;
          active.item = null;   // gasta: o item é um só
          itensGastos.push({ dono:'p', especie: active.speciesId, slot: active.slotDaConta, item });
          diario.push({ q:'p', d: curado, hp: active.hp, c:0, m:0, z:0, x:'pocao', g: item });
        }
      }
      while(active.hp>0 && enemy.hp>0){ doExchange(active, enemy, rng, diario); }
      /* A CHUVA DESTE CONFRONTO é lida DEPOIS da luta, e isso mudou junto com o sorteio: ela pode
         COMEÇAR neste confronto (o dado rola na abertura, dentro do doExchange), então lida antes
         o matchup sairia sem o selo justamente no confronto em que a chuva nasceu.
         Vem antes do decremento, que é o que faz o último confronto de chuva ainda sair marcado. */
      const comChuva = estaChovendo();
      const enemyFainted = enemy.hp<=0;
      const activeFainted = active.hp<=0;
      // doExchange garante um único sobrevivente por troca -- empate/morte súbita não existem mais
      const suddenDeath = false, suddenDeathMessage = null;
      const isTrade = enemyFainted && activeFainted;
      const playerWon = enemyFainted && !activeFainted;
      const playerAliveAfter = activeFainted ? playerAliveBefore - 1 : playerAliveBefore;
      const enemyAliveAfter = enemyFainted ? enemyAliveBefore - 1 : enemyAliveBefore;
      matchups.push({
        /* O SÍMBOLO DA CHUVA sai daqui: o confronto carrega SE choveu nele. É um campo do matchup e
           não um estado global porque o log é relido depois, às vezes dias depois -- e ali o
           `chuvaRestante` já não existe mais. Confronto gravado antes do campo existir sai sem
           chuva, que é o que ele era.
           ⚠️ É `!!comChuva` E NUNCA `comChuva || undefined`, que foi como ele nasceu. No cliente o
           undefined é inofensivo (o JSON.stringify some com o campo); no SERVIDOR o log da liga vai
           pro Firestore, e o Admin SDK RECUSA undefined -- derruba a gravação inteira, não o campo.
           Isso matou as duas ligas de 11 a 13/09/2026 (ver a seção do log de batalha no CLAUDE.md).
           Os dois motores escrevem igual porque a comparação das 300 batalhas compara VALOR. */
        chuva: !!comChuva,
        /* ⚠️ A FÚRIA VIAJA NO MATCHUP, e não só como marca no diário (14/09/2026, a pedido: *"coloque
           um sinal também no pokémon que está com Fúria ativa"*). A marca do diário diz só o confronto
           em que ela ENTROU -- e ela ACUMULA por batalha, então um pokémon pode atravessar três
           confrontos furioso com a marca só no primeiro. Sem o campo, o selo sumiria justamente nos
           confrontos em que o bônus é maior.
           É o ACUMULADO (1, 2, 3...), não um booleano: ele vale +10 por vez, e o número é o que
           explica um Tauros com +30 de tudo. */
        playerFuria: active._furia || 0, enemyFuria: enemy._furia || 0,
        /* ⚠️ A QUEIMADURA SAI DE UM CAMPO, nao da marca do diario, e e o MESMO caso da furia: ela
           persiste entre confrontos, entao um pokemon pode atravessar tres deles queimado com a
           marca so no primeiro. Lida do diario, o selo sumiria justamente nos confrontos em que o
           jogador mais precisa saber que o ataque dele esta pela metade. */
        playerQueimado: !!active._queimado, enemyQueimado: !!enemy._queimado,
        playerEnvenenado: !!active._envenenado, enemyEnvenenado: !!enemy._envenenado,
        playerParalisado: !!active._paralisado, enemyParalisado: !!enemy._paralisado,
        player:active.name, playerSpecies:active.speciesId, playerLevel:active.level, playerShiny: !!active.shiny, playerBuffed: !!active.terrainBuffed, playerSpecialty: !!active.specialtyBuffed,
        enemy:enemy.name, enemySpecies:enemy.speciesId, enemyLevel:enemy.level, enemyShiny: !!enemy.shiny, enemyBuffed: !!enemy.terrainBuffed, enemySpecialty: !!enemy.specialtyBuffed,
        playerTrainerStreak: playerStreak, enemyTrainerStreak: enemyStreak,
        winner: isTrade ? null : (playerWon ? active.name : enemy.name),
        isTrade,
        suddenDeath, suddenDeathMessage,
        playerWon,
        // tipo do golpe de cada lado -- o cliente traduz em nome de golpe no log
        playerMove: active.lastMoveType || null, enemyMove: enemy.lastMoveType || null,
        /* O ID do golpe escolhido, quando existe. O tipo continua vindo junto e é ele que dá a COR
           do selo; o id só troca a PALAVRA -- e ela some sozinha em confronto de quem não tem golpe
           escolhido (save antigo, as 8 espécies sem golpe de dano), que aí cai no nomeDoGolpe de
           sempre. Log gravado antes deste campo não perde nada. */
        playerMoveId: active.lastMove || null, enemyMoveId: enemy.lastMove || null,
        golpes: diario,   // passo a passo do confronto, na ordem em que aconteceu
        playerHpBefore, playerHpAfter: active.hp, playerMaxHp: active.maxHp,
        enemyHpBefore, enemyHpAfter: enemy.hp, enemyMaxHp: enemy.maxHp,
        playerAliveBefore, playerAliveAfter, playerTeamSize: team.length,
        enemyAliveBefore, enemyAliveAfter, enemyTeamSize: enemyTeam.length
      });
      /* UM CONFRONTO DE CHUVA A MENOS. Cai AQUI, no fim do confronto, e não no começo do seguinte:
         assim o último confronto de chuva é o terceiro e não o quarto. Conta CONFRONTO e não troca
         de golpes -- é o que o pedido diz ("vai durar por 3 confrontos"). */
      if(chuvaRestante > 0){
        chuvaRestante--;
        /* A CHUVA ANUNCIA O PROPRIO FIM (14/09/2026, a pedido). A linha entra no diario do confronto
           que ACABOU de terminar -- ele foi o ultimo debaixo dela, e e nele que o jogador esta
           olhando quando ela para. No confronto seguinte a frase chegaria depois de o golpe de Fogo
           ja ter voltado ao normal sem explicacao -- e ele pode nem existir. */
        if(chuvaRestante === 0 && diario) diario.push({ q:'p', d:0, hp:null, c:0, m:0, z:0, x:'chuvafim' });
      }
    /* QUEM CAIU SAI DE CAMPO SOZINHO: a volta seguinte do laço vê o hp em 0 e pula pro primeiro
       vivo. Não há mais `enemyDefeated` -- ele existia pra fechar o laço interno, e com um laço só
       o que decide é a vida. */
    if(isTrade){ playerStreak = 0; enemyStreak = 0; } // ninguém venceu: zera os dois
    else if(enemyFainted){ playerStreak++; enemyStreak = 0; }
    else if(activeFainted){ enemyStreak++; playerStreak = 0; }
  }
  /* AUTODESTRUIÇÃO NO ÚLTIMO DE CADA LADO: quem explodiu leva a batalha. É o único jeito de os
     dois times zerarem no mesmo instante (o doExchange normal sempre deixa um de pé), e sem esta
     linha o jogador perderia justamente a batalha que ele decidiu explodindo. */
  const teamStillAlive = team.some(p=>p.hp>0) || explosaoDoAtivo === true;
  encerrarBatalha(team, enemyTeam);
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
/* Linhas que se DIVIDEM. No cliente é a tela evoChoice que pergunta; aqui a tabela existe só pra
   o raizDaLinha (abaixo) chegar na MESMA raiz que o cliente: sem ela, a raiz de um Slowking seria
   ele mesmo em vez de slowpoke, e os dois lados procurariam o item equipado em chaves diferentes.
   Tem que ficar idêntica à do index.html -- tools/test-johto.js compara por valor. */
const EVOLUTION_CHOICES = {
  gloom:     ['vileplume','bellossom'],
  poliwhirl: ['poliwrath','politoed'],
  slowpoke:  ['slowbro','slowking'],
  tyrogue:   ['hitmonlee','hitmonchan','hitmontop']
};
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
  /* ⚠️ ESTES DOIS ESTAVAM NO 40, e era erro de varredura (corrigido em 14/09/2026). O nível 40 é a
     regra da casa pro que NÃO evolui por nível no original (troca, amizade, pedra), e estes dois
     evoluem por NÍVEL mesmo -- o Voltorb no 30 e o Koffing no 35. Eles foram varridos pro balaio do
     40 junto com os de troca e ficaram anos lá.
     Achado contando quem sairia do 40 no dia em que as pedras entrarem: dos 30 degraus de lá, 14
     são pedra, 8 são troca, 3 são amizade -- e 5 são por nível, sendo que TRÊS já estavam certos
     (Ponyta, Kabuto e Omanyte são 40 no original) e estes dois não. */
  voltorb:{level:30, into:'electrode'},   // faltava aqui e existe no cliente -- divergência antiga, corrigida
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
  koffing:{level:35, into:'weezing'},   // ver a nota do Voltorb, acima
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
  /* ⚠️ O BOT GANHA O MOVESET DA ESPECIE (16/09/2026), pela MESMA regra de todo NPC do jogo (ver
     equiparNpc): ele nao ESCOLHE golpe, entao leva o que a especie aprende por nivel.
     Sem isto ele seria o unico time da liga sem golpe -- e a partir de hoje isso deixou de ser
     "todo mundo igual" e virou desvantagem so dele. */
  const ataques = {};
  for(const t of team){ const lista = ataquesDisponiveis(t.speciesId, t.level);
    if(lista.length) ataques[chaveDosGolpes(t)] = lista.slice(0, MAX_GOLPES); }
  return {
    name: `Bot ${index}`,
    code: encodeTeamCode(team),
    ataques,
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
/* ⚠️ APAGAR UM DOCUMENTO NO FIRESTORE NÃO APAGA AS SUBCOLEÇÕES DELE. Elas continuam existindo,
   invisíveis no console (o documento pai vira "missing"), e continuam ocupando espaço pra sempre.
   Medido em produção em 13/09/2026, um mês depois de a poda entrar: **687 ciclos órfãos** com
   ~3.200 documentos de inscritos parados dentro, do dia 13/08 em diante.
   O custo de LEITURA disso é zero -- nada varre o `leagueCycles`, todo acesso é por id --, e o de
   armazenamento eram alguns MB. Mas cresce pra sempre: no ritmo de hoje são ~8.000 órfãos por ano.
   É o tipo de coisa que só vira problema quando já é grande demais pra limpar sem susto.
   Ele apaga em LOTES de 300 porque um `batch` do Firestore aceita 500 operações, e devolve quantos
   apagou pra quem chama poder contar no log. */
async function apagarSubcolecoes(docRef, nomes){
  let apagados = 0;
  for(const nome of nomes){
    try{
      let snap = await docRef.collection(nome).limit(300).get();
      while(!snap.empty){
        const lote = db.batch();
        snap.docs.forEach(d => lote.delete(d.ref));
        await lote.commit();
        apagados += snap.docs.length;
        snap = await docRef.collection(nome).limit(300).get();
      }
    } catch(e){ logger.warn('Nao deu pra limpar a subcolecao ' + nome + ' de ' + docRef.path, e); }
  }
  return apagados;
}
/* As subcoleções que um ciclo de liga pendura. Ficam numa constante porque quem apaga o ciclo
   precisa saber a lista INTEIRA -- e o dia em que nascer uma terceira, ela entra aqui e os dois
   caminhos de poda (a Clássica e a Trainers) já limpam junto. */
const SUBCOLECOES_DO_CICLO = ['registrants', 'matchLogs', 'terrainPicks', 'teamPicks'];
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
  /* O CÓDIGO DO TIME é compacto: ele não carrega o slot nem os GOLPES ESCOLHIDOS. Os dois viajam
     ao lado, dentro do match, e o carimbo valida antes de aplicar -- ver carimbaDoMatch. */
  carimbaDoMatch(teamA, match.a); carimbaDoMatch(teamB, match.b);
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
  /* OS ITENS EQUIPADOS VIAJAM NO MATCH, como a especialidade -- e na prática só o lado A tem: este
     resolvedor é compartilhado pelas ligas e pelo ginásio da cidade, e lá o A é o DESAFIANTE, que é
     quem está jogando agora. O líder está dormindo do outro lado do mundo e não entra com item.
     AS LIGAS NÃO MANDAM NENHUM, de propósito: elas são resolvidas longe de quem jogou, às vezes
     horas depois da inscrição, e um item equipado agora não pode decidir uma partida sorteada
     ontem -- pior, ele sumiria da mochila sem a pessoa ver a luta. Passam pelo equiparItens do
     mesmo jeito, com a lista vazia: toda batalha do jogo passa por ele, e exceção em lista é onde a
     próxima omissão se esconde (foi assim que a raide do Mew ficou sem a especialidade). */
  equiparItens(teamA, (match.a && match.a.equipados) || null);
  equiparItens(teamB, (match.b && match.b.equipados) || null);
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
/* ⚠️ ELE DEVOLVE O QUE LEU (19/09/2026), e o chamador reusa em vez de reler. O documento da
   agenda tem **9,5 KB** e é o mais lido do jogo; esta função lia ele e o `advanceLeagueOnceForType`
   lia de novo **na linha seguinte** -- duas leituras do mesmo doc, por tipo de liga, a cada minuto,
   **mesmo quando não há nada a avançar** (que é o caso em 99% das execuções: os logs de produção
   mostram "Nada a avançar ainda" de minuto em minuto). Com dois tipos de liga são 2.880
   leituras/dia só nesta repetição.

   ⚠️ O VALOR É CAPTURADO NUMA VARIÁVEL DE FORA, e não devolvido de dentro da transação: o
   Firestore **re-executa** o corpo de uma transação em caso de contenção, então um `return` lá
   dentro poderia entregar o resultado de uma tentativa que foi abortada. Do lado de fora, o que
   sobra é sempre a última execução -- que é a que valeu.
   ⚠️ E ELE DEVOLVE `null` QUANDO FALHA, nunca um objeto vazio: o chamador tem que saber a
   diferença entre "li e a agenda está assim" e "não consegui ler" -- no segundo caso ele lê por
   conta própria, como sempre fez. */
async function recoverStuckCycles(typeId){
  let agenda = null;
  try{
    await db.runTransaction(async (tx)=>{
      agenda = null;
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
      /* já com as correções aplicadas, se houve: é este o estado que vale daqui pra frente */
      agenda = data;
    });
  } catch(e){ logger.error('Erro ao recuperar ciclos travados:', e); return null; }
  return agenda;
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
  /* Os "pending" existem porque NADA pode sair da função antes de a gravação do ciclo dar certo:
     se ela falhar, o catch devolve o ciclo pra 'drawn' e o agendador refaz a passada inteira.
     `pendingMatchNotices` entrou nessa lista em 13/09/2026, junto com o irmão dela na Trainers
     League -- ver o comentário de lá pro estrago que a ordem antiga causou. */
  let pendingChampions = [], pendingPlacements = [], pendingStreakUpdates = [], pendingMatchNotices = [], changed = false;
  /* ⚠️ A HORA DO CICLO, declarada AQUI e não lá dentro: ela alimenta o endereço do chaveamento que
     as notificações passaram a carregar (18/09/2026), e essas são criadas antes do laço de
     participantes -- onde ela morava. Deixada lá, seria zona morta temporal, o mesmo defeito que
     travou as quatro telas de revelação em 09/09/2026.
     O fallback é o mesmo de sempre: ciclo antigo pode estar sem `scheduledTime`, e o Firestore
     recusa gravar `undefined` -- um único registro velho malformado quebrava a gravação inteira. */
  const cycleTime = cycleEntry.scheduledTime != null ? cycleEntry.scheduledTime : Number(cycleEntry.id) || 0;
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
                /* o endereço do chaveamento viaja junto: o aviso do campeão é criado DEPOIS do
                   laço, onde `league` já saiu do escopo. */
                pendingChampions.push({ name: match.winner.name, uid: match.winner.uid, slot: match.winner.slot,
                                        cycleId: cycleEntry.id, leagueId: league.id, cycleTime });
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
              pendingMatchNotices.push({ uid: match.a.uid,
                titulo: aWon ? '🏆 Você venceu na Liga Pokémon!' : '💥 Você perdeu na Liga Pokémon',
                corpo: aWon
                  ? `Seu confronto contra ${match.b.name} terminou: vitória!${nextPhaseInfo ? ` Sua ${nextPhaseInfo.label} é${nextPhaseInfo.time?` às ${nextPhaseInfo.time}`:''}, contra ${nextPhaseInfo.opponentName||'a definir'}.` : ''}`
                  : `Seu confronto contra ${match.b.name} terminou: derrota. Você foi eliminado na ${eliminatedPhaseLabel}.`,
                /* ⚠️ O ENDEREÇO DO CHAVEAMENTO vai junto desde 18/09/2026 (a pedido: *"mude para
                   levar para a mesma tela é exibida quando clica no botão Rever"*). São os TRÊS
                   campos que o `viewLeagueHistory` pede -- ciclo, liga e a hora dela --, e é o
                   mesmo trio que o `pendingPlacements` já gravava logo acima.
                   Notificação ANTIGA não tem: ela cai na tela da liga, como sempre caiu. */
                meta: { leagueTypeId: typeId, opponentName: match.b.name, won: aWon, eliminatedPhase: aWon?null:eliminatedPhaseLabel,
                        cycleId: cycleEntry.id, leagueId: league.id, cycleTime } });
            }
            if(!match.b.isBot){
              const bWon = match.winner.uid === match.b.uid;
              pendingStreakUpdates.push({ uid: match.b.uid, won: bWon });
              pendingMatchNotices.push({ uid: match.b.uid,
                titulo: bWon ? '🏆 Você venceu na Liga Pokémon!' : '💥 Você perdeu na Liga Pokémon',
                corpo: bWon
                  ? `Seu confronto contra ${match.a.name} terminou: vitória!${nextPhaseInfo ? ` Sua ${nextPhaseInfo.label} é${nextPhaseInfo.time?` às ${nextPhaseInfo.time}`:''}, contra ${nextPhaseInfo.opponentName||'a definir'}.` : ''}`
                  : `Seu confronto contra ${match.a.name} terminou: derrota. Você foi eliminado na ${eliminatedPhaseLabel}.`,
                meta: { leagueTypeId: typeId, opponentName: match.a.name, won: bWon, eliminatedPhase: bWon?null:eliminatedPhaseLabel,
                        cycleId: cycleEntry.id, leagueId: league.id, cycleTime } });
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
    // o ciclo já está gravado -- daqui pra baixo nada será refeito, então dá pra anunciar
    for(const aviso of pendingMatchNotices){
      await createNotification(aviso.uid, 'match_played', aviso.titulo, aviso.corpo, aviso.meta);
    }
    for(const champ of pendingChampions){
      await recordLeagueChampionWin(champ.name, champ.uid, typeId, !!champ.elite);
      if(champ.uid){
        // só a Liga Clássica dá esse bônus -- a Trainers League tem seu próprio ponto de registro de
        // campeão (linha ~1646), separado deste loop, e não passa por aqui
        await createNotification(champ.uid, 'league_champion',
          '🏆 Você é o campeão!',
          `Você venceu a ${leagueTypeName||'Liga Pokémon'}! Ative o bônus e, na próxima hora, seus encontros selvagens terão chance bem maior de ser shiny.`,
          { leagueTypeId: typeId, activated: false, cycleId: champ.cycleId, leagueId: champ.leagueId, cycleTime: champ.cycleTime }
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
/* ⚠️ O CONTADOR DE INSCRITOS TEM DONO NO SERVIDOR, e isso não é zelo -- é o conserto de um defeito
   que foi pro ar em 19/09/2026 e foi reportado no dia seguinte: *"entrei para ver a liga clássica e
   estava com 4 treinadores inscritos, após eu me inscrever, o numero caiu para 1"*.

   O QUE ACONTECEU, lido dos dados de produção: o documento do ciclo tinha `registrantCount: 1` e a
   coleção `registrants` tinha **5 documentos**. Ninguém foi apagado -- só o número estava errado.
   E o `createTime` do documento entregou a causa: ele foi criado **no instante da 5ª inscrição**.

   ⚠️ A RAIZ É O `increment` SOBRE CAMPO QUE NÃO EXISTE: o Firestore o trata como ZERO. Os quatro
   primeiros inscritos estavam em ABAS ABERTAS de antes do deploy -- o `index.html` vai com
   `no-cache`, mas aba aberta continua com o código velho até o F5 --, então eles escreveram na
   subcoleção sem tocar no contador. O quinto, num carregamento novo, criou o documento em 1.

   ⚠️ E A LIÇÃO É MAIOR QUE O CASO: um contador mantido SÓ pelo cliente nunca é confiável, porque
   sempre existe cliente velho em cache. O mesmo vale pro `increment(-1)` do cancelamento.
   Por isso quem manda nele agora é o SERVIDOR: o cron roda de minuto em minuto e reconcilia o
   ciclo ABERTO, então qualquer desvio -- de cliente velho, de documento que nasceu tarde, do que
   vier -- se conserta sozinho em no máximo 60 segundos.

   ⚠️ E ELE CONTA PELO SERVIDOR (`.count()`), não varrendo a coleção: a agregação custa ~1 leitura
   em vez de uma por inscrito. É exatamente o `getCountFromServer` que o SDK compat do CLIENTE não
   tem (ver o `countRegistrants` do index.html) -- o Admin SDK tem desde a v11, e aqui é ele.
   Custo: 2 leituras por minuto (a contagem e o documento), ~2.900 por dia.
   ⚠️ Ele LÊ ANTES DE ESCREVER de propósito: escrita custa 3× mais que leitura no Firestore, e sem
   isso seriam 1.440 escritas por dia num documento que quase nunca muda. */
async function reconciliarContadorDeInscritos(typeId, entry){
  try{
    const agg = await registrantsCollRef(typeId, entry.id).count().get();
    const real = agg.data().count;
    const snap = await cycleDocRef(typeId, entry.id).get();
    const atual = snap.exists && typeof snap.data().registrantCount === 'number'
      ? snap.data().registrantCount : null;
    if(atual === real) return false;
    await cycleDocRef(typeId, entry.id).set({ registrantCount: real }, { merge: true });
    logger.info(`Contador de inscritos ajustado (${typeId}/${entry.id}): ${atual} -> ${real}`);
    return true;
  } catch(e){
    /* best-effort: um contador desatualizado é um número feio na tela, não uma liga quebrada --
       e o `countRegistrants` do cliente ainda cai na varredura quando o campo não existe. */
    logger.error(`Erro ao reconciliar o contador de inscritos (${typeId}):`, e);
    return false;
  }
}
async function advanceLeagueOnceForType(typeId, typeConfig){
  let anyChanged = false;
  try{
    /* ⚠️ REUSA O QUE O `recoverStuckCycles` ACABOU DE LER -- ele lê a mesma agenda de 9,5 KB uma
       linha acima. Quando ele não consegue ler (devolve null), aí sim vale a leitura própria. */
    const agendaJaLida = await recoverStuckCycles(typeId);
    const scheduleSnap = agendaJaLida
      ? { exists: true, data: () => agendaJaLida }
      : await scheduleDocRef(typeId).get();
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
      } else if(entry.status==='registering'){
        /* ⚠️ O CICLO AINDA ABERTO: é o único que aceita inscrição, e por isso o único cujo contador
           pode estar desviando agora. Ver o `reconciliarContadorDeInscritos`. Ele NÃO marca
           `anyChanged`: ajustar um número não é "avançar a liga", e conflar os dois faria o log do
           cron dizer que avançou quando ele só arrumou uma contagem. */
        await reconciliarContadorDeInscritos(typeId, entry);
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
      /* ⚠️ AS SUBCOLEÇÕES PRIMEIRO, o documento depois -- apagar o documento não leva as
         subcoleções junto (ver apagarSubcolecoes). Foi assim que 687 ciclos órfãos se acumularam
         entre 13/08 e 13/09/2026. */
      let dentro = 0;
      for(const id of toRemoveIds){
        dentro += await apagarSubcolecoes(cycleDocRef(typeId, id), SUBCOLECOES_DO_CICLO);
        await cycleDocRef(typeId, id).delete();
      }
      logger.info(`Liga (${typeId}): ${toRemoveIds.size} ciclo(s) antigo(s) apagado(s), com ${dentro} documento(s) dentro.`);
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
const TRAINERS_LEAGUE_MAX_SAVE_SLOTS = 20; // espelha MAX_SAVE_SLOTS do cliente -- servidor não carrega esse arquivo, só o valor
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
  /* LÊ SÓ OS SAVES QUE EXISTEM. Antes montava uma referência por slot e lia TODAS, existindo ou
     não: um jogador com 1 save custava o teto inteiro em leituras, e isso rodava uma vez por
     inscrito a cada travamento de liga (mais uma vez por Doce Raro usado). Com o teto em 20 isso
     dobraria de graça. O get da COLEÇÃO cobra por documento devolvido.

     A ORDEM TEM QUE SER A NUMÉRICA DO SLOT, e não a que o Firestore devolve: ele ordena por ID de
     documento em ordem de TEXTO, então com 20 slots o "10" vem entre o "1" e o "2". O time de cada
     rodada é sorteado por ÍNDICE nesta lista, com semente, e o CLIENTE refaz o mesmo sorteio pra
     mostrar quem vai lutar (ver resolveTrainersLeagueTeamCodeForRound) -- se as duas ordens
     divergirem, a tela mostra um time e a batalha usa outro. O cliente monta a lista em ordem de
     slot; aqui é a mesma ordem, na mão. */
  const snap = await db.collection('users').doc(uid).collection('saves').get();
  const porSlot = snap.docs
    .map(doc => ({ slot: parseInt(doc.id, 10), dados: doc.data() }))
    .filter(x => Number.isInteger(x.slot) && x.slot >= 0 && x.slot < TRAINERS_LEAGUE_MAX_SAVE_SLOTS)
    .sort((a, b) => a.slot - b.slot);
  const codes = [];
  /* ⚠️ OS GOLPES ESCOLHIDOS SAEM DAQUI, DO SAVE, e não do cliente (16/09/2026) -- e esta liga é a
     única que pode fazer isso, porque é a única em que o SERVIDOR já lê os saves.
     Isso a deixa de fora do problema de confiança que as outras têm: não há o que forjar, e por
     isso não há o que validar. O `golpesValidos` continua correndo em cima (ele é o caminho
     comum), e ali ele não tem o que descartar.
     UM MAPA SÓ pra conta inteira, e não um por time: a chave é espécie:nível, então dois times que
     compartilham o mesmo pokémon apontam pra mesma entrada -- e o sorteio de time da rodada, o
     override de ordem e o código do Mewtwo passam todos por ela sem índice nenhum pra desandar. */
  const golpes = {};
  for(const { dados: s } of porSlot){
    /* O TIME APOSENTADO FICA DE FORA (17/09/2026). Esta é a ÚNICA liga em que o SERVIDOR monta a
       lista sozinho, lendo os saves -- nas outras o time vem de uma inscrição que o jogador fez.
       Sem esta linha, um time aposentado voltaria pro sorteio de rodada por conta própria, o que é
       exatamente o que a aposentadoria promete que não acontece. */
    if(s && s.team && (s.badgeCount||0) >= 8 && !s.aposentado){
      // sanitiza na origem: reconstrói do zero (espécie+nível+shiny), nível limitado ao teto -- um save
      // adulterado com stats/níveis impossíveis entra na liga como um time normalizado, não como monstro
      const clean = sanitizeTeamCode(encodeTeamCode(s.team));
      if(clean){
        codes.push(clean);
        for(const mon of s.team){
          if(!mon || !mon.speciesId || !Array.isArray(mon.ataques) || !mon.ataques.length) continue;
          golpes[chaveDosGolpes(mon)] = mon.ataques.slice(0, MAX_GOLPES);
        }
      }
    }
  }
  codes.ataques = golpes;   // pendurado na lista: quem só quer os códigos não muda uma linha
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
          await trainersLeagueRegistrantRef(dateId, reg.uid).set(
            { eligibleCodes, eligibleAtaques: eligibleCodes.ataques || {} }, { merge:true });
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
  /* O CÓDIGO DO TIME é compacto: ele não carrega o slot nem os GOLPES ESCOLHIDOS. Os dois viajam
     ao lado, dentro do match, e o carimbo valida antes de aplicar -- ver carimbaDoMatch. */
  carimbaDoMatch(teamA, match.a); carimbaDoMatch(teamB, match.b);
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
  /* Passa pelo equiparItens como o outro resolvedor, ainda que a Trainers League nunca mande item
     nenhum (ver o porquê lá): com TODA chamada de batalha passando por ele, o teste que lê o código
     pode exigir isso sem exceção -- e exceção em lista é onde a próxima omissão se esconde. */
  equiparItens(teamA, (match.a && match.a.equipados) || null);
  equiparItens(teamB, (match.b && match.b.equipados) || null);
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
    /* o desempate luta com os mesmos golpes da temporada -- o mapa e da conta, entao ele serve
       pro time que o sorteio tirar */
    return { uid:t.uid, name:t.name, code, ataques: (p && p.eligibleAtaques) || null };
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
  const players = group.map(r=>({ uid:r.uid, name:r.name, elite: !!r.elite, eligibleCodes:r.eligibleCodes||[], eligibleAtaques:r.eligibleAtaques||null, specialties:r.specialties||[], mewtwoTeamCode:r.mewtwoTeamCode||null }));
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
    /* ⚠️ AS NOTIFICAÇÕES DE PARTIDA ESPERAM A GRAVAÇÃO. Elas eram criadas DENTRO do laço, antes do
       `ref.set` -- e quando a gravação falha, o catch devolve o ciclo pra 'locked' e o agendador
       (que roda de minuto em minuto) refaz tudo: resolve de novo, notifica de novo, falha de novo.
       Em 13/09/2026 isso mandou 285 mensagens iguais pra uma conta e 91 pra outra, uma por minuto,
       sem parar. A causa da falha era um `undefined` no log (ver a Dança da Chuva), mas a causa do
       DILÚVIO é esta ordem: nada pode ser anunciado antes de o estado que o justifica estar salvo. */
    const avisosDePartida = [];

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
            /* ⚠️ OS GOLPES VÃO NO LADO DO MATCH, e eles NÃO dependem de qual código foi sorteado:
               a chave é espécie:nível, então o mapa da conta serve pro time que sair -- inclusive
               pro override reordenado e pro código do Mewtwo. */
            try{
              const regSnap2 = await trainersLeagueRegistrantRef(dateId, uid).get();
              if(regSnap2.exists){ match[side].ataques = regSnap2.data().eligibleAtaques || null; }
            } catch(e){ logger.error('Erro ao ler os golpes do inscrito:', e); }

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
          /* ⚠️ "HOUVE LUTA?" SE PERGUNTA ANTES DO STRIP. O storeMatchLogAndStrip ZERA o
             `match.matchups` quando consegue gravar o log (é pra isso que ele existe) -- então a
             condição lida depois dele dava FALSO justamente no caminho que dá certo, e a
             notificação de partida da Trainers League não saía NUNCA. As únicas que chegaram até
             hoje foram as de 13/09/2026, e chegaram porque a gravação estava falhando. */
          const houveLuta = !!(match.matchups && match.matchups.length > 0); // W.O./bye não é partida
          await storeMatchLogAndStrip(trainersLeagueCycleRef(dateId).collection('matchLogs'), `R${ri}_M${round.matches.indexOf(match)}`, match);
          anyResolved = true;
          if(houveLuta){
            const aWon = match.winner.uid === match.a.uid;
            avisosDePartida.push({ uid: match.a.uid,
              titulo: aWon ? '🏆 Você venceu na Trainers League!' : '💥 Você perdeu na Trainers League',
              corpo: `Seu confronto contra ${match.b.name} terminou: ${aWon?'vitória':'derrota'}.`,
              meta: { leagueTypeId: TRAINERS_LEAGUE_TYPE, opponentName: match.b.name, won: aWon } });
            avisosDePartida.push({ uid: match.b.uid,
              titulo: !aWon ? '🏆 Você venceu na Trainers League!' : '💥 Você perdeu na Trainers League',
              corpo: `Seu confronto contra ${match.a.name} terminou: ${!aWon?'vitória':'derrota'}.`,
              meta: { leagueTypeId: TRAINERS_LEAGUE_TYPE, opponentName: match.a.name, won: !aWon } });
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
    /* DAQUI PRA BAIXO o estado já está salvo: a partida não vai ser resolvida de novo, então
       anunciá-la é seguro. E COM `await`: sem ele a Cloud Function podia ser encerrada no meio,
       e foi isso que fez um lado receber 285 mensagens e o outro 91 no mesmo laço -- a segunda
       chamada morria com a instância com mais frequência que a primeira. */
    for(const aviso of avisosDePartida){
      await createNotification(aviso.uid, 'match_played', aviso.titulo, aviso.corpo, aviso.meta);
    }
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
exports._equiparItens = equiparItens;   // o teste dos dois motores compara com item equipado
/* O raizDaLinha e a base da CHAVE do item equipado ("slot:linha"). Se os dois motores discordarem
   da raiz de uma especie, o cliente grava numa chave e o servidor procura noutra -- e o item some
   sem ninguem entender. O teste compara as 250. */
exports._raizDaLinha = raizDaLinha;
exports._chaveDoEquipado = chaveDoEquipado;
exports._createInstance = createInstance;
exports._makeSeededRng = makeSeededRng;
/* Gancho de teste do Boss de Domingo -- ver BOSS_ATIVO. */
/* =====================================================================
   O RANKING DA PESCARIA (20/09/2026, a pedido: *"na primeira tela, crie um ranking das maiores
   pontuações de pesca"*)
   =====================================================================
   ⚠️ QUEM GRAVA É O SERVIDOR, e isso não é zelo: pontuação é placar público, e o `firestore.rules`
   fecha a coleção pra escrita do cliente. Uma linha no console poria qualquer número lá.

   ⚠️ É UM DOCUMENTO POR JOGADOR, com o MELHOR resultado dele -- não um por partida. Assim a
   coleção não cresce sem limite (ela tem no máximo um documento por conta) e o ranking é "os
   melhores jogadores", não "as melhores partidas do mesmo jogador".

   ⚠️ E O NOME FICA GRAVADO JUNTO, como no ranking do Mew: sem isso, ler o top 10 custaria 10
   leituras a mais em `users/` toda vez que alguém abrisse a tela. O preço é o de lá -- quem troca
   de nome só aparece com o novo depois da próxima partida.
   ===================================================================== */
const PESCARIA_RANK_TOPO = 10;
function pescariaRankCollRef(){ return db.collection('fishingRanking'); }
function pescariaRankDocRef(uid){ return pescariaRankCollRef().doc(uid); }
/* ⚠️ SÓ SOBE, nunca desce: o recorde é o MELHOR resultado, e uma partida ruim depois de uma boa
   não pode apagar a boa. A transação é o que impede duas abas de gravarem por cima uma da outra. */
exports.submitFishingScore = onCall(async (request) => {
  const uid = request.auth && request.auth.uid;
  if(!uid) throw new HttpsError('unauthenticated', 'Faça login.');
  const pontos = Math.max(0, Math.floor(Number((request.data || {}).pontos) || 0));
  const venceu = !!(request.data || {}).venceu;
  const capturas = Math.max(0, Math.floor(Number((request.data || {}).capturas) || 0));
  /* ⚠️ ZERO NÃO ENTRA NO RANKING: um documento por jogador que nunca pontuou é linha morta na
     coleção e uma linha de "0 pontos" no top, que não diz nada. */
  if(pontos <= 0) return { gravado: false, motivo: "zero" };
  const conta = await db.collection('users').doc(uid).get();
  const nome = (conta.exists && conta.data().trainerName) || 'Treinador';
  let recorde = false;
  await db.runTransaction(async (tx) => {
    const ref = pescariaRankDocRef(uid);
    const snap = await tx.get(ref);
    const antes = snap.exists ? (Number(snap.data().pontos) || 0) : -1;
    if(pontos <= antes) return;
    recorde = true;
    tx.set(ref, { uid, nome, pontos, venceu, capturas, quando: Date.now() });
  });
  return { gravado: recorde, pontos };
});
/* O top 10. ⚠️ Ele NÃO tem cache num documento à parte (ao contrário do ranking do Mew): lá o
   documento do chefe é escrito a cada ataque e a consulta entraria no caminho crítico; aqui a
   tela é aberta raramente e a consulta custa 10 leituras, uma por linha. */
exports.getFishingRanking = onCall(async (request) => {
  const uid = request.auth && request.auth.uid;
  if(!uid) throw new HttpsError('unauthenticated', 'Faça login.');
  const snap = await pescariaRankCollRef().orderBy('pontos', 'desc').limit(PESCARIA_RANK_TOPO).get();
  const lista = snap.docs.map((d, i) => {
    const x = d.data() || {};
    return { pos: i + 1, uid: d.id, nome: x.nome || 'Treinador', pontos: x.pontos || 0,
             capturas: x.capturas || 0, venceu: !!x.venceu, eu: d.id === uid };
  });
  /* ⚠️ E O MEU RESULTADO VEM JUNTO mesmo fora do top: sem ele, quem está em 14º abre a tela e não
     vê nada seu -- e o próprio recorde é a informação que ele mais procura. */
  let meu = null;
  if(!lista.some(x => x.eu)){
    const m = await pescariaRankDocRef(uid).get();
    if(m.exists) meu = { nome: (m.data().nome || 'Você'), pontos: m.data().pontos || 0,
                         capturas: m.data().capturas || 0, eu: true };
  }
  return { lista, meu };
});
exports._pescariaRank = { topo: PESCARIA_RANK_TOPO };
/* =====================================================================
   RANKING DA CORRIDA (20/09/2026, a pedido) -- DOIS rankings: a individual de
   300 m e o revezamento.

   ⚠️ QUEM GRAVA É O SERVIDOR, e a coleção é FECHADA pra escrita do cliente nas regras: tempo é
   placar público, e uma linha no console poria 0,01 s no topo. É a mesma trava do `fishingRanking`
   e do `globalBoss`.

   ⚠️ E O TEMPO DO NPC NUNCA ENTRA -- isso é por CONSTRUÇÃO e não por filtro: o que chega é UM
   tempo, e ele é gravado no documento de quem CHAMOU. O adversário não tem conta e não tem como
   ter documento.

   ⚠️ É UM DOCUMENTO POR JOGADOR com as DUAS modalidades dentro, e o `merge` é obrigatório: um
   recorde no revezamento não pode apagar o da individual. Cada campo é ordenado por conta própria,
   e quem nunca correu uma modalidade simplesmente não tem o campo dela -- o Firestore já o exclui
   daquele ranking.
   ===================================================================== */
const CORRIDA_RANK_TOPO = 10;
const CORRIDA_MODALIDADES = ['single', 'relay'];
const CORRIDA_TEMPO_MAX = 3600;
/* o teto do time guardado -- o revezamento leva 6, e o resto seria lixo num documento público */
const CORRIDA_RANK_TIME_MAX = 6;          /* um tempo acima disso é dado corrompido, não recorde */
function corridaRankCollRef(){ return db.collection('raceRanking'); }
function corridaRankDocRef(uid){ return corridaRankCollRef().doc(uid); }
/* ⚠️ SÓ MELHORA, e aqui MELHOR É MENOR: o recorde é o tempo mais BAIXO, e uma corrida ruim depois
   de uma boa não pode apagar a boa. A transação é o que impede duas abas de gravarem por cima. */
/* ⚠️ O TIME QUE VEM DO CLIENTE É SANEADO, e não confiado: ele é só APRESENTAÇÃO (o modal do
   ranking), então não dá vantagem nenhuma -- mas sem teto ele seria um jeito de gravar lixo
   grande num documento público que todo mundo lê. Fica o mínimo pra desenhar um sprite: a
   espécie, o nível e o shiny.
   ⚠️ E ELE NUNCA JOGA FORA A CHAMADA INTEIRA: um time malformado vira lista vazia e o tempo é
   gravado do mesmo jeito -- o ranking é sobre o TEMPO, e perder um recorde por causa da legenda
   seria o lado errado pra errar. */
function corridaTimeSaneado(bruto){
  if(!Array.isArray(bruto)) return [];
  return bruto.slice(0, CORRIDA_RANK_TIME_MAX).map((p) => {
    const o = p && typeof p === 'object' ? p : {};
    const nivel = Math.max(1, Math.min(999, Math.round(Number(o.level) || 1)));
    return { speciesId: String(o.speciesId || '').slice(0, 40), level: nivel, shiny: !!o.shiny };
  }).filter(p => p.speciesId);
}
exports.submitRaceTime = onCall(async (request) => {
  const uid = request.auth && request.auth.uid;
  if(!uid) throw new HttpsError('unauthenticated', 'Faça login.');
  const d = request.data || {};
  const modalidade = CORRIDA_MODALIDADES.indexOf(d.modalidade) >= 0 ? d.modalidade : null;
  if(!modalidade) throw new HttpsError('invalid-argument', 'Modalidade desconhecida.');
  const tempo = Number(d.tempo);
  /* ⚠️ ZERO E LIXO NÃO ENTRAM: um documento de quem não completou é linha morta, e um tempo
     absurdo no topo trancaria o ranking pra sempre. */
  if(!(tempo > 0) || !isFinite(tempo) || tempo > CORRIDA_TEMPO_MAX) return { gravado: false, motivo: 'invalido' };
  const conta = await db.collection('users').doc(uid).get();
  const nome = (conta.exists && conta.data().trainerName) || 'Treinador';
  const especie = String(d.especie || '').slice(0, 40);
  const time = corridaTimeSaneado(d.time);
  const venceu = !!d.venceu;
  let recorde = false;
  await db.runTransaction(async (tx) => {
    const ref = corridaRankDocRef(uid);
    const snap = await tx.get(ref);
    const antes = snap.exists ? Number(snap.data()[modalidade]) : NaN;
    if(isFinite(antes) && antes > 0 && tempo >= antes) return;
    recorde = true;
    const dados = { uid, nome, quando: Date.now() };
    dados[modalidade] = tempo;
    dados[modalidade + 'Info'] = { especie, venceu, time, quando: Date.now() };
    /* ⚠️ `merge` -- sem ele o recorde de uma modalidade APAGA o da outra */
    tx.set(ref, dados, { merge: true });
  });
  return { gravado: recorde, tempo, modalidade };
});
/* Os dois tops numa chamada só: a tela mostra o da modalidade escolhida, e trocar de modalidade
   não pode custar outra ida ao servidor. */
exports.getRaceRanking = onCall(async (request) => {
  const uid = request.auth && request.auth.uid;
  if(!uid) throw new HttpsError('unauthenticated', 'Faça login.');
  const meuDoc = await corridaRankDocRef(uid).get();
  const meu = meuDoc.exists ? (meuDoc.data() || {}) : null;
  const saida = {};
  for(const m of CORRIDA_MODALIDADES){
    /* ⚠️ ASCENDENTE: no tempo, o MENOR é o primeiro. E quem não tem o campo fica de fora desta
       consulta por conta do Firestore, que é exatamente o certo. */
    const snap = await corridaRankCollRef().orderBy(m, 'asc').limit(CORRIDA_RANK_TOPO).get();
    const lista = snap.docs.map((doc, i) => {
      const x = doc.data() || {};
      const info = x[m + 'Info'] || {};
      return { pos: i + 1, uid: doc.id, nome: x.nome || 'Treinador', tempo: Number(x[m]) || 0,
               especie: info.especie || '', time: info.time || [],
               venceu: !!info.venceu, eu: doc.id === uid };
    });
    /* ⚠️ E O MEU TEMPO VEM JUNTO mesmo fora do top: quem está em 14º abre a tela e não vê nada
       seu, e o próprio recorde é o que ele mais procura. */
    let oMeu = null;
    if(meu && Number(meu[m]) > 0 && !lista.some(x => x.eu)){
      const info = meu[m + 'Info'] || {};
      oMeu = { nome: meu.nome || 'Você', tempo: Number(meu[m]), especie: info.especie || '',
               time: info.time || [], venceu: !!info.venceu, eu: true };
    }
    saida[m] = { lista, meu: oMeu };
  }
  return saida;
});
exports._corridaRank = { topo: CORRIDA_RANK_TOPO, modalidades: CORRIDA_MODALIDADES,
                         tempoMax: CORRIDA_TEMPO_MAX, timeMax: CORRIDA_RANK_TIME_MAX,
                         saneia: corridaTimeSaneado };
exports._boss = { ativo(v){ if(v !== undefined) BOSS_ATIVO = !!v; return BOSS_ATIVO; },
                  instancia: bossInstance, nivel: () => BOSS_LEVEL, maxHp: () => BOSS_MAX_HP };
exports._golpesEspeciais = { AUTODESTRUICAO, SONIFEROS, METRONOMO, CHANCE_AUTODESTRUICAO, CHANCE_SONO, SONO_EM_TROCAS, sorteiaTrocasDeSono, MULTI_GOLPE, ataquesDisponiveis, GOLPES_CRIT_ALTO, FURIA, CHANCE_FURIA, FURIA_BONUS, sorteiaGolpeDoMetronomo, POOL_METRONOMO, CONFUSAO, CHANCE_CONFUSAO, DANCA_ESPADAS, DANCA_PLUMA, CHANCE_DANCA, DANCA_ESPADAS_MULT, DANCA_PLUMA_MULT, FURIA_DRAGAO, CHANCE_FURIA_DRAGAO, FURIA_DRAGAO_DANO, CHUVA, CHANCE_CHUVA, CHUVA_EM_CONFRONTOS, CHUVA_MULT, CHUVA_GOLPE_MULT, multDaChuva, estaChovendo, tentarChuva, limparClima, GOLPES_DRENO, GOLPES_SO_DORMINDO };
exports._apagarSubcolecoes = apagarSubcolecoes;   // testado direto: no ar ele roda dentro da poda
exports._SUBCOLECOES_DO_CICLO = SUBCOLECOES_DO_CICLO;
exports._reconciliarContadorDeInscritos = reconciliarContadorDeInscritos;
exports._trainersLeagueSplitGroups = trainersLeagueSplitGroups;
exports._trainersLeagueGatherEligibleCodes = trainersLeagueGatherEligibleCodesForUid;
exports._decodeTeamCode = decodeTeamCode;
exports._carimbaDoMatch = carimbaDoMatch;         // o teste confere que o golpe chega na liga
exports._golpesValidos = golpesValidos;           // e que golpe forjado nao passa
exports._resolveLeagueMatch = resolveLeagueMatch; // a auditoria roda o caminho real da liga
exports._CORTADORES = CORTADORES; exports._SURFISTAS = SURFISTAS; exports._VOADORES = VOADORES;   // comparadas com as do cliente
exports._battleInstances = battleInstances; exports._battleHydrate = battleHydrate;   // o teste da liga confere a ORDEM da lista pela especie de cada time
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
  let newTeamAtaques = null;   // anda junto com o codigo: a defesa congela time E golpes
  if(Array.isArray(team)){
    const resolvido = await resolverTimeDosSaves(uid, team, NEIGHBORHOOD_GYM_TEAM_SIZE, 'time de defesa', 1);
    newTeamCode = sanitizeTeamCode(encodeTeamCode(resolvido));
    /* os golpes congelam junto com o código: a defesa é um retrato do time que assumiu o ginásio */
    newTeamAtaques = ataquesParaDoc(resolvido.map(p => p.ataques || null));
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
      leaderTeamAtaques: newTeamAtaques!==null ? newTeamAtaques : ((gymData && gymData.leaderTeamAtaques!=null) ? gymData.leaderTeamAtaques : null),
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
/* ⚠️ OS GOLPES DA DEFESA VIRAM STRING PRA IR PRO FIRESTORE (17/09/2026), e isso não é estética:
   o Firestore **RECUSA ARRAY DENTRO DE ARRAY** (`3 INVALID_ARGUMENT: Nested arrays are not
   allowed`) e derruba a GRAVAÇÃO INTEIRA. O campo nasceu em 16/09 como
   `time.map(p => p.ataques || null)` -- um array de arrays --, e com isso **todo desafio VENCIDO
   estourava na hora de gravar a nova liderança**, além de montar/alterar a defesa.
   Reportado em 17/09 como *"estou clicando para desafiar e nada acontece"*, e achado no log da
   function: `Unhandled error ... Nested arrays are not allowed`.
   ⚠️ E O TESTE PASSAVA 31/31 por DOIS motivos somados: o fake não recusava array aninhado (a mesma
   falha que custou as duas ligas com o `undefined`, em 13/09) E o fixture dele não tinha golpe
   escolhido nenhum -- `[null,null,...]` não é array aninhado. Os dois foram fechados.
   A LEITURA aceita os dois formatos: documento gravado antes disso não existe (a gravação sempre
   falhou), mas a regra da casa é que dado velho não pode sumir. */
function ataquesParaDoc(lista){
  return (lista || []).map(a => (Array.isArray(a) && a.length) ? a.join(",") : null);
}
function ataquesDoDoc(lista){
  return (lista || []).map(a => {
    if(Array.isArray(a)) return a.slice();          // formato antigo, se algum dia existir
    return (typeof a === "string" && a) ? a.split(",") : null;
  });
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
  const challengerEquipados = equipadosDaConta(challengerUserSnap.exists ? challengerUserSnap.data() : null);
  let gastosDoDesafio = [];   // preenchido dentro da transacao, gasto depois dela
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
      /* Os itens equipados do DESAFIANTE viajam aqui, como a especialidade: quem esta jogando
         agora e ele. O LIDER esta dormindo do outro lado do mundo e nao entra com item. */
      /* Os SLOTS viajam junto: o código do time não os carrega (ele é compacto de propósito), e o
         item equipado é por save -- sem eles o Venusaur do slot 11 usaria o item do slot 5. */
      /* ⚠️ OS GOLPES VIAJAM AO LADO DO CÓDIGO, como os slots (16/09/2026). O `resolverTimeDosSaves` já
         devolvia o campo `ataques` -- ele só era jogado fora uma linha depois, quando o time virava
         CÓDIGO. Era isso que fazia o desafio do Ginásio da Cidade lutar no motor de tipo enquanto a
         jornada lutava com os golpes escolhidos. */
      a: { uid, name: challengerName, code: challengerCode, specialties: challengerSpecialties,
           equipados: challengerEquipados, slots: timeDoDesafiante.map(p => p.slotDaConta || null),
           ataques: timeDoDesafiante.map(p => p.ataques || null) },
      /* a DEFESA é um código CONGELADO, e os golpes dela congelam junto: o líder montou aquele time
         e é com ele que ele defende, mesmo que o save mude depois. Ginásio anterior a esta data não
         tem o campo -- ali a defesa luta no motor de tipo, como lutava. */
      b: { uid: gymData.leaderUid, name: gymData.leaderName, code: gymData.leaderTeamCode,
           specialties: gymData.leaderSpecialties || [], ataques: ataquesDoDoc(gymData.leaderTeamAtaques) },
      winner:null, matchups:null, resolved:false, terrain // terreno do líder = vantagem de mandante
    };
    resolveLeagueMatch(match, `cidade-${city}-${uid}-${Date.now()}`, null);
    const challengerWon = match.winner === match.a;
    /* O que o motor gastou sai da conta. Fica pra depois da transacao (linha marcada abaixo):
       escrita de outro documento no meio dela seria leitura-depois-de-escrita. */
    gastosDoDesafio = itensGastosDaBatalha().slice();

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
        // e com os golpes que ele usou pra vencer -- o time é o mesmo, os golpes também
        leaderTeamAtaques: ataquesParaDoc(timeDoDesafiante.map(p => p.ataques || null)),
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
  /* O item que trabalhou sai da conta. Depois da transacao de proposito: escrever outro
     documento dentro dela seria leitura-depois-de-escrita, que o Firestore recusa inteira. */
  await gastarItensEquipados(uid, gastosDoDesafio);
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

/* APAGAR UMA MENSAGEM NÃO PODE CUSTAR UM ITEM. A notificação de campeão de liga É o cupom do bônus
   shiny -- ela é a única forma de ativá-lo --, então apagá-la apagava o item da mochila junto.
   Reportado em 10/09/2026: "deletei a notificação e o bônus shiny sumiu da mochila".
   Agora o prêmio é RESGATADO pro armazém (`inventario.bonus_shiny`) antes de a mensagem sumir, e
   o jogador ativa por lá -- o mesmo lugar de onde sai o bônus comprado na loja, então não houve
   caminho novo pra manter.
   SÓ O DA LIGA precisa disto: o prêmio da ELITE mora no SAVE (`eliteShinyGranted` sem
   `eliteShinyUsed`) e já sobrevivia a apagar a notificação; e o DOCE RARO nunca esteve em risco --
   ele é um contador no documento da conta, escrito pelo servidor, e notificação nenhuma o carrega.
   UMA CONSULTA SÓ, e não um get por id: o caso que fez o apagar em lote existir foi o de 21
   notificações iguais, e 21 leituras pra uma ação que é uma só seria trocar um custo por outro. */
async function resgatarPremiosDasNotificacoes(uid, ids){
  const alvo = new Set((ids || []).map(String));
  if(!alvo.size) return 0;
  const coll = db.collection('users').doc(uid).collection('notifications');
  const snap = await coll.where('type','==','league_champion').get();
  let cupons = 0;
  snap.docs.forEach(d => {
    if(!alvo.has(String(d.id))) return;
    const meta = (d.data() || {}).meta || {};
    if(!meta.activated) cupons++;
  });
  if(cupons > 0){
    await db.collection('users').doc(uid).set(
      { inventario: { bonus_shiny: admin.firestore.FieldValue.increment(cupons) } }, { merge:true });
  }
  return cupons;
}

// apaga UMA notificação específica -- a pessoa só pode apagar as próprias (o UID vem do token de
// autenticação, não do que o cliente manda, então não dá pra apagar notificação de outra conta)
exports.deleteNotification = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  /* `descartar` é o botão EXCLUIR da mochila: ali o jogador está jogando o item fora de propósito,
     e resgatá-lo pro armazém faria o botão não fazer nada. Apagar a MENSAGEM (o outro caminho)
     resgata; jogar o ITEM fora, não. */
  const { notificationId, descartar } = request.data || {};
  if(!notificationId){ throw new HttpsError('invalid-argument', 'Notificação não informada.'); }
  const resgatados = descartar ? 0 : await resgatarPremiosDasNotificacoes(uid, [notificationId]);
  await db.collection('users').doc(uid).collection('notifications').doc(String(notificationId)).delete();
  return { ok: true, resgatados };
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
  const resgatados = await resgatarPremiosDasNotificacoes(uid, ids);
  const coll = db.collection('users').doc(uid).collection('notifications');
  const batch = db.batch();
  for(const id of ids){ batch.delete(coll.doc(String(id))); }
  await batch.commit();
  return { ok: true, deleted: ids.length, resgatados };
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
  if(!snap.exists){
    await ref.set(towerGenerate(dateId));
    logger.info('Torre dos Treinadores gerada para ' + dateId);
  }
  /* O FECHAMENTO NÃO PODE DEPENDER DE QUEM CRIOU A TORRE DE HOJE, e é exatamente isso que ele
     dependia: a chamada ficava DEPOIS de um `if(snap.exists) return null`, então o dia anterior só
     fechava quando o CRON chegava primeiro. Só que quem cria a torre do dia também é o
     `towerGetToday`, no primeiro jogador que abre a tela -- o dia vira à meia-noite de São Paulo e
     o cron passa ~50 minutos depois. Quem abrisse a Torre nessa janela criava a torre de hoje, o
     cron saía pela porta de cima na volta seguinte, e o dia anterior NUNCA fechava.
     Medido nos dados: torre criada 00:20 em 02/09 e 00:03 em 04/09 (as duas fora do cron -- não há
     log de "Torre gerada" nesses dias), e os dois dias anteriores, 01/09 e 03/09, ficaram sem
     fechar. Os dois tinham vencedor, e o ranking geral inteiro tinha UM dia contabilizado.
     Reportado em 04/09/2026.
     Agora ele roda sempre. E varre os últimos dias em vez de só ontem, porque um dia que não fecha
     é um ponto que ninguém recebe e o único jeito de perceber é alguém reclamar: assim um dia que
     ficou pra trás se recupera sozinho na hora seguinte. Do mais VELHO pro mais novo, pra as
     notificações chegarem na ordem em que os dias aconteceram. */
  for(let i = TORRE_DIAS_A_FECHAR; i >= 1; i--){
    const dia = trainersLeagueDateStrPlusDays(dateId, -i);
    await towerFecharDia(dia).catch(e => logger.error('Falha ao fechar a torre de ' + dia, e));
  }
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
  /* ⚠️ OS APOSENTADOS ENTRAM AQUI, e é isso que os mantém valendo na Torre e no Ginásio da Cidade
     mesmo com o save apagado (18/09/2026: *"os pokemons que são aposentados, podem sim ser
     utilizados na torre de treinadores e ginasio da cidade, só nao pode mais participar de ligas
     e batalhas online"*). O arquivo da conta é o único lugar onde eles ainda existem.
     ⚠️ O SLOT DELES É SINTÉTICO (`ap:<slot de origem>`) pra não colidir com um save VIVO do mesmo
     número -- o jogador pode ter começado uma jornada nova naquele slot. Mas o `slotOrigem` viaja
     junto porque o ITEM EQUIPADO é por save: sem ele, o Venusaur aposentado do slot 11 perderia o
     item que ele carregava.
     ⚠️ E eles NÃO passam pelo filtro das 8 insígnias: só se aposenta quem já terminou a jornada,
     então a condição já foi cumprida quando o time entrou no arquivo. */
  /* ⚠️ A LEITURA SÓ ACONTECE QUANDO O PEDIDO TEM APOSENTADO. Ela é UMA leitura a mais por
     chamada, e a Torre chama uma vez POR ANDAR -- pagar isso em toda subida de quem nunca
     aposentou nada seria custo puro. Quem tem aposentado no time já mandou o slot `ap:`, então a
     pergunta se responde sem ir ao banco. */
  if((escolhidos || []).some(p => p && String(p.slot || '').indexOf('ap:') === 0)){
    try{
      const userSnap = await db.collection('users').doc(uid).get();
      const arquivo = (userSnap.exists && Array.isArray(userSnap.data().aposentados)) ? userSnap.data().aposentados : [];
      arquivo.forEach((p, i) => {
        if(!p || !p.speciesId) return;
        disponiveis.push({ slot: 'ap:' + (p.slot != null ? p.slot : '?'), slotOrigem: p.slot, idx: i, mon: p });
      });
    }catch(e){ logger.error('Erro ao ler os aposentados:', e); }
  }
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
    /* O slotDaConta viaja junto: o item equipado é por SAVE, e este time MISTURA saves -- sem ele
       o Venusaur do slot 11 usaria o item do Venusaur do slot 5. */
    time.push({ speciesId: real.speciesId, level: real.level, shiny: !!real.shiny,
                slotDaConta: String(achado.slotOrigem != null ? achado.slotOrigem : achado.slot),
                /* OS GOLPES viajam junto: eles são escolha do jogador e vivem na instância do
                   save. Sem esta linha, a Torre e o Ginásio da Cidade lutariam com o motor de
                   tipo enquanto a jornada luta com os golpes escolhidos -- o mesmo pokémon com
                   dois comportamentos. */
                ataques: Array.isArray(real.ataques) ? real.ataques.slice(0, MAX_GOLPES) : null,
                /* ⚠️ A CHAVE DA ESPERA USA O SLOT SINTETICO, ao contrario do `slotDaConta` logo
                   acima -- e os dois querem dizer coisas diferentes.
                   O ITEM e do SAVE de origem (o `equipados` da conta guarda `slot:raiz`, e ele
                   sobrevive ao save morrer), entao ele usa a ORIGEM.
                   A ESPERA de 10 min do ginasio e do POKEMON, e o aposentado tem que ter a dele:
                   com a origem, um Venusaur aposentado do slot 3 dividiria a espera com um
                   Venusaur de uma jornada NOVA naquele mesmo slot -- sao dois bichos diferentes.
                   ⚠️ E o CLIENTE calcula a mesma chave a partir do `p.slot`, que ja e o sintetico:
                   se as duas divergirem, a tela libera quem o desafio recusa. */
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
    /* Nem o slot: o time da torre MISTURA saves, e sem ele o item do Venusaur de um save valeria
       pro Venusaur de outro. Subida antiga (gravada antes do campo) fica sem -- aí o itemEquipado
       cai na chave velha, sem slot, que é como ela sempre funcionou. */
    inst.slotDaConta = (p.slotDaConta != null) ? String(p.slotDaConta) : null;
    /* Nem os golpes: o createInstance monta do zero. Subida gravada antes desta feature fica sem,
       e aí o motor cai no de tipo -- que é como ela sempre lutou. */
    if(Array.isArray(p.ataques)) inst.ataques = p.ataques.slice(0, MAX_GOLPES);
    return inst;
  });
  const timeNpc = equiparNpc(andar.team.map(p => createInstance(p.speciesId, p.level)));
  /* O treinador da Torre é NPC como o líder de ginásio, e é por causa DELE que o APRENDIZADO
     precisou vir pro servidor -- o time dele é montado aqui, do zero. */

  // especialidade de tipo do jogador vale aqui também, como em qualquer batalha
  const userSnap = await db.collection('users').doc(uid).get();
  applySpecialtyBuff(meuTime, (userSnap.exists && userSnap.data().specialties) || []);

  /* OS ITENS DA MOCHILA valem aqui como valem na jornada. O mesmo userSnap que já foi lido pra
     especialidade serve -- não custa leitura nova. */
  const equipadosDaConta_ = equipadosDaConta(userSnap.exists ? userSnap.data() : null);
  equiparItens(meuTime, equipadosDaConta_);
  const resultado = simulateGymBattle(meuTime, timeNpc, Math.random);
  /* A poção é UMA: se disparou, sai da conta agora. Aqui quem limpa é a própria batalha, sem
     depender de o cliente avisar. */
  await gastarItensEquipados(uid, itensGastosDaBatalha());
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
/* Quantos ANDARES DISTINTOS levam Doce Raro no fim do dia. São os 3 mais altos que alguém
   alcançou, não os 3 primeiros colocados: se cinco treinadores pararam no andar 20, os cinco estão
   no primeiro degrau do pódio e os degraus 2 e 3 são os dois andares seguintes que tiveram gente.
   É a mesma lógica de empate que a torre já usava, só que agora com três degraus. */
const TORRE_PODIO = 3;
/* QUANTOS DIAS PRA TRÁS o cron tenta fechar a cada volta. É idempotente -- o `awarded` corta na
   primeira leitura --, então o custo de um dia já fechado é UMA leitura por hora. Sete dias é o que
   faz o fechamento se recuperar sozinho de uma janela em que ele não rodou, sem depender de
   ninguém reclamar. */
const TORRE_DIAS_A_FECHAR = 7;

/* FECHA O DIA: os TRÊS ANDARES MAIS ALTOS levam Doce Raro; só o MAIS ALTO pontua no ranking geral.
   EMPATE PREMIA TODOS -- se dois pararam no andar 14 e ninguém passou disso, os dois ganham. É o
   que o modo pede: a torre não tem que ser vencida, tem que ser subida mais que os outros.
   O ranking geral continua contando UMA coisa só: em quantos dias o treinador ficou no andar mais
   alto. Dar ponto pro 2º e pro 3º misturaria "quem chegou mais longe" com "quem apareceu", que são
   perguntas diferentes -- o doce é o prêmio de participação, o ponto é o de vencer.
   Roda junto com a geração da torre do dia seguinte: é o instante em que se sabe que o dia anterior
   acabou, e evita mais uma função agendada. Idempotente pelo campo awarded -- o cron roda de hora
   em hora e não pode pagar duas vezes. */
async function towerFecharDia(dateId){
  const diaRef = db.collection('trainerTowerDays').doc(dateId);
  const diaSnap = await diaRef.get();
  if(diaSnap.exists && diaSnap.data().awarded) return null;
  const jogadores = await diaRef.collection('players').get();
  if(jogadores.empty){
    await diaRef.set({ awarded: true, topFloor: 0, winners: [], podium: [], closedAt: Date.now() }, { merge: true });
    return { topFloor: 0, vencedores: 0, premiados: 0 };
  }
  const todos = jogadores.docs.map(d => d.data());
  /* Os TRÊS andares distintos mais altos. Distintos porque o pódio é de ANDAR, não de pessoa: com
     dez treinadores empatados no 20, o segundo degrau ainda é o andar abaixo que teve alguém. */
  const degraus = Array.from(new Set(todos.map(x => x.bestFloor || 0)))
    .filter(f => f > 0).sort((a, b) => b - a).slice(0, TORRE_PODIO);
  const topFloor = degraus[0] || 0;
  const vencedores = todos.filter(x => (x.bestFloor || 0) === topFloor);
  const premiados = todos.filter(x => degraus.indexOf(x.bestFloor || 0) >= 0);
  /* O RESUMO vai primeiro, o AWARDED só no FIM. Marcar o dia como pago antes de pagar fazia um erro
     no meio do laço apagar o resto do pódio pra sempre: a volta seguinte do cron via o awarded e ia
     embora sem pagar ninguém. Pagar duas vezes não é o risco aqui -- quem trava isso é o
     lastPrizeDate de cada treinador, dentro da transação. */
  await diaRef.set({ topFloor,
                     winners: vencedores.map(v => ({ uid: v.uid, name: v.name })),
                     podium: degraus,
                     closedAt: Date.now() }, { merge: true });
  for(const p of premiados){
    const andar = p.bestFloor || 0;
    const posicao = degraus.indexOf(andar) + 1;                       // 1, 2 ou 3
    const juntos = todos.filter(x => (x.bestFloor || 0) === andar).length;
    await towerPremiarPodio(p.uid, p.name, dateId, andar, posicao, juntos, posicao === 1);
  }
  await diaRef.set({ awarded: true }, { merge: true });
  logger.info('Torre ' + dateId + ' fechada: andares ' + degraus.join('/') + ', ' +
              premiados.length + ' premiado(s), ' + vencedores.length + ' no topo.');
  return { topFloor, vencedores: vencedores.length, premiados: premiados.length, degraus };
}
/* O prêmio: um Doce Raro pros três degraus do pódio, e o ponto no ranking SÓ pro degrau de cima.
   O ranking geral conta EM QUANTOS DIAS o treinador ficou no andar mais alto -- é o que o modo
   mede. O campo antigo (clears, dias em que ele zerou os 10 andares) fica no documento como
   história, mas não ordena mais nada: com 30 andares, zerar deixou de ser o objetivo.
   As DUAS travas de dia são separadas de propósito: lastTopDate guarda o ponto e lastPrizeDate
   guarda o doce. Elas marcam dias diferentes -- quem sobe no pódio todo dia mas só às vezes chega
   ao topo tem uma avançando e a outra não; uma trava só confundiria as duas contas. */
async function towerPremiarPodio(uid, nome, dateId, andar, posicao, juntos, pontua){
  const ref = db.collection('trainerTowerRanking').doc(uid);
  let jaPago = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : {};
    if(d.lastPrizeDate === dateId){ jaPago = true; return; }   // trava dupla contra pagar o mesmo dia 2x
    const patch = { uid, name: nome || d.name || 'Treinador',
                    lastPrizeDate: dateId,
                    bestFloorEver: Math.max(d.bestFloorEver || 0, andar),
                    updatedAt: Date.now() };
    if(pontua && d.lastTopDate !== dateId){
      patch.topDays = (d.topDays || 0) + 1;
      patch.lastTopDate = dateId;
    }
    tx.set(ref, patch, { merge: true });
  });
  if(jaPago) return;
  await db.collection('users').doc(uid).set({
    rareCandies: admin.firestore.FieldValue.increment(1)
  }, { merge: true });
  const dividido = juntos > 1 ? ` Você dividiu esse andar com mais ${juntos-1} treinador${juntos-1===1?'':'es'}.` : '';
  /* "de ontem" SÓ quando é ontem mesmo. Com a varredura dos últimos dias, um dia que ficou pra trás
     pode fechar dois ou três dias depois -- e aí "ontem" seria mentira na cara de quem lê. */
  const quando = (dateId === trainersLeagueDateStrPlusDays(trainersLeagueTodayDateStr(), -1))
               ? 'de ontem' : 'de ' + dateId.slice(8, 10) + '/' + dateId.slice(5, 7);
  if(pontua){
    await createNotification(uid, 'tower_top', '🗼 Você foi o mais longe na Torre!',
      `Ninguém passou do andar ${andar} na torre ${quando}, e você chegou lá.${dividido} Ganhou um 🍬 Doce Raro e mais um ponto no ranking da Torre.`);
  } else {
    const medalha = posicao === 2 ? '🥈' : '🥉';
    await createNotification(uid, 'tower_top', medalha + ' Você ficou no pódio da Torre!',
      `O andar ${andar} foi o ${posicao}º mais alto na torre ${quando}, e você chegou lá.${dividido} Ganhou um 🍬 Doce Raro. O ponto no ranking geral é só de quem chega no andar mais alto do dia.`);
  }
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
/* ============================ A LOJA E A MOCHILA ============================
   Até aqui a mochila era uma LEITURA do que a conta já tinha (o contador de doces e os cupons de
   bônus shiny). Item comprável precisa de armazém de verdade, e ele tem que ser do SERVIDOR pelo
   mesmo motivo das moedas: uma linha no console viraria Despertar infinito.
   `inventario` é um mapa item -> quantos e `equipados` é um mapa espécie -> item; os dois estão na
   trava do firestore.rules junto de `moedas`. */
const LOJA = {
  awakening:   { preco: 50 },
  hyperpotion: { preco: 50 },
  potion:      { preco: 30 },
  /* Os cinco de atributo: +15 pela BATALHA inteira, e somem no fim dela se o pokémon tiver
     entrado. Quem ficou no banco continua com o dele -- o item sai quando TRABALHA, a mesma regra
     dos outros três. */
  hp_up:       { preco: 30 },
  atk_up:      { preco: 30 },
  def_up:      { preco: 30 },
  spatk_up:    { preco: 30 },
  spdef_up:    { preco: 30 },
  /* A Faixa age NO MEIO da luta (segura um golpe fatal), e não na abertura como os outros. */
  faixa_foco:  { preco: 50 },
  /* O DOCE RARO NÃO MORA NO INVENTÁRIO: ele é um CONTADOR da conta (rareCandies), escrito pela
     Torre e descontado pelo useRareCandy -- comprar é somar nele, e a mochila continua lendo de um
     lugar só. */
  doce_raro:   { preco: 300, contador: 'rareCandies' },
  /* ⚠️ AS 23 MÁQUINAS DE TÉCNICA (17/09/2026) ENTRAM POR DERIVAÇÃO, nunca escritas aqui uma a uma:
     o preço sai da MESMA regra do cliente (`max(100, poder efetivo × 2)`, já gravada no `TMS`), e
     uma segunda lista divergiria dela no primeiro TM novo -- a tela prometeria um preço que a
     cobrança não pratica, que é o defeito que este catálogo existe pra evitar.
     Elas moram no INVENTÁRIO como a Poção (empilham), e são de USO ÚNICO: quem gasta é o
     `usarTM`. */
  ...Object.fromEntries(Object.entries(TMS).map(([id, tm]) => [id, { preco: tm.preco, tm: true }]))
  /* ⚠️ O BÔNUS SHINY NÃO ESTÁ AQUI, e a ausência É a regra (12/09/2026, a pedido): ele não se
     compra nem se vende, e só vem de VENCER A ELITE 4 (ou uma liga online). O `buyItem` e o
     `sellItem` consultam este catálogo antes de qualquer outra coisa, então tirá-lo daqui fecha os
     dois -- inclusive pra um cliente velho em cache que ainda desenhe o botão.
     O `activateBoughtShinyBonus` continua existindo e NÃO olha pra cá: quem já comprou antes segue
     usando o estoque que tem. */
};
/* Quais itens se equipam num pokémon. Os outros dois do catálogo (Doce Raro, Bônus Shiny) não são
   de batalha -- vêm de jogar e se usam na mochila. */
const EQUIPAVEIS = ['awakening', 'hyperpotion', 'potion',
                    'hp_up', 'atk_up', 'def_up', 'spatk_up', 'spdef_up',
                    'faixa_foco'];

/* O QUE CADA POKÉMON DA CONTA ESTÁ CARREGANDO. É um mapa espécie -> item, e a chave é a ESPÉCIE
   porque um save não tem duas da mesma (o encontro selvagem nunca oferece uma linha que o time já
   tem, e o montador recusa repetida). O id da instância NÃO serve: ele vem de um contador que
   recomeça do 1 a cada carregamento de página, e dois saves têm `mon7` cada um -- foi assim que um
   jogador viu oito pokémon marcados por causa de seis. */
/* A RAIZ da linha evolutiva -- a chave que identifica "é o mesmo bicho" mesmo depois de evoluir.
   É a MESMA função do cliente, palavra por palavra, e pelo mesmo motivo: se as duas discordarem,
   um lado procura o item equipado numa chave e o outro noutra. */
/* AS CINCO EVOLUÇÕES DO EEVEE, e a lista mora AQUI porque o `raizDaLinha` (logo abaixo) precisa
   dela. Elas NÃO estão no `EVOLUTIONS` (não evoluem por nível) nem no `EVOLUTION_CHOICES` (a
   bifurcação do Eevee tem tela própria, a `chooseEeveeEvolution`, por causa do relógio do
   Espeon/Umbreon) -- então sem esta linha a raiz de um Jolteon é ele mesmo, e o item equipado se
   perde na evolução: é o defeito do Charmeleon->Charizard de 03/09/2026, que ficou aberto nesta
   linha. ⚠️ Ela tem as CINCO: a versão antiga listava só as três da pedra e deixava de fora
   justamente as duas que o nome dela promete.
   ⚠️ E ela é declarada ANTES do `raizDaLinha`: `const` tem zona morta temporal, e este projeto já
   pagou isso duas vezes (as quatro telas de revelação e o aviso de versão). */
const EEVEE_EVOLUTIONS = ['vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon'];
let _raizDaLinha = null;
function raizDaLinha(id){
  if(!_raizDaLinha){
    const pai = {};
    for(const de in EVOLUTIONS){ pai[EVOLUTIONS[de].into] = de; }
    for(const de in EVOLUTION_CHOICES){ EVOLUTION_CHOICES[de].forEach(dest=>{ pai[dest] = de; }); }
    EEVEE_EVOLUTIONS.forEach(dest=>{ pai[dest] = 'eevee'; });
    _raizDaLinha = {};
    Object.keys(SPECIES).forEach(sp=>{
      let cur = sp, guarda = 0;
      while(pai[cur] && guarda++ < 10) cur = pai[cur];
      _raizDaLinha[sp] = cur;
    });
  }
  return _raizDaLinha[id] || id;
}
/* A CHAVE DE UM ITEM EQUIPADO É A RAIZ DA LINHA, NÃO A ESPÉCIE (03/09/2026).
   Era a espécie, e um pokémon que EVOLUÍA perdia o item: a poção ficava presa em "charmeleon"
   enquanto o bicho passava a se chamar "charizard", e nem a tela nem a batalha achavam mais. Não
   sumia da conta -- ficava fora do armazém, invisível e sem como ser recuperada, porque a tela só
   sabe pedir pela espécie que está vendo. Reportado em 03/09/2026: "coloquei uma poção no
   charmeleon, ele nem entrou na luta, evoluiu, e a poção sumiu".
   A raiz é tão única quanto a espécie pra este fim (um save não tem duas do mesmo bicho, e a raiz
   junta os dois lados da bifurcação -- Slowbro e Slowking são o mesmo Slowpoke) e tem a
   propriedade que faltava: ela NÃO MUDA quando o pokémon evolui.
   A LEITURA aceita qualquer chave da mesma linha, e é isso que devolve o que já estava perdido:
   uma poção presa em "charmeleon" volta a ser achada pelo Charizard, sem migração de dados. */
/* A CHAVE É "SLOT:LINHA", NÃO SÓ A LINHA (04/09/2026).
   Era só a linha, e o item vazava entre saves: um Venusaur no slot 11 e outro no slot 5 são o mesmo
   "venusaur" pra conta, então equipar num fazia o item aparecer no outro. Reportado.
   O comentário que justificava a chave antiga dizia "espécie é única na conta pra este fim" -- ela
   é única dentro de UM SAVE (o encontro selvagem nunca oferece uma linha que o time já tem, e o
   montador recusa repetida), mas a conta tem até 20 saves e nada impede dois Venusaur.
   É a mesma correção que a espera do Ginásio da Cidade já tinha feito, e pelo mesmo motivo: lá a
   chave também virou save+espécie depois de um jogador ver oito pokémon marcados por causa de seis. */
function chaveDoEquipado(slot, speciesId){ return String(slot) + ':' + raizDaLinha(speciesId); }
/* A raiz de uma chave gravada. Chave NOVA é "slot:linha"; chave VELHA é só a linha, e ela tem que
   continuar valendo -- quem já tinha item equipado não pode perdê-lo no deploy. A velha casa com
   QUALQUER slot, que é como ela se comportava; a primeira vez que o jogador mexer naquele item ela
   é apagada e nasce a nova, então o dado se conserta sozinho. */
function linhaDaChave(k){ const i = String(k).indexOf(':'); return i < 0 ? String(k) : String(k).slice(i + 1); }
function slotDaChave(k){ const i = String(k).indexOf(':'); return i < 0 ? null : String(k).slice(0, i); }
function itemEquipado(equipados, slot, speciesId){
  if(!equipados || !speciesId) return null;
  const raiz = raizDaLinha(speciesId);
  const exata = chaveDoEquipado(slot, speciesId);
  if(equipados[exata]) return equipados[exata];
  /* Chave do MESMO slot, linha equivalente (dado gravado com a espécie do meio, antes de evoluir). */
  for(const k in equipados){
    if(slotDaChave(k) === String(slot) && raizDaLinha(linhaDaChave(k)) === raiz) return equipados[k];
  }
  /* Só então a chave VELHA, sem slot. */
  for(const k in equipados){
    if(slotDaChave(k) === null && raizDaLinha(k) === raiz) return equipados[k];
  }
  return null;
}
/* Toda chave da linha, pra APAGAR. Deveria haver uma só; pode haver duas enquanto sobrar dado
   gravado com a chave velha, e deixar a antiga pra trás faria o item ressuscitar na leitura. */
/* Toda chave que responde por ESTE pokémon: a do slot dele mais as velhas sem slot. Apagar as
   velhas junto é o que faz o dado antigo se consertar sozinho -- deixá-las para trás faria o item
   ressuscitar na leitura, que ainda as aceita. */
function chavesDaLinha(equipados, slot, speciesId){
  const raiz = raizDaLinha(speciesId);
  return Object.keys(equipados || {}).filter(k => {
    const s = slotDaChave(k);
    return (s === null || s === String(slot)) && raizDaLinha(linhaDaChave(k)) === raiz;
  });
}
function equipadosDaConta(d){ return (d && d.equipados) || {}; }

/* TIRA DA CONTA o que o motor gastou na batalha. O motor não fala com o banco: ele anota em
   `itensGastos` quem usou o quê, e quem chamou a batalha limpa. Só o lado do JOGADOR ('p'): o item
   do adversário, quando existir, é problema do dono dele. */
async function gastarItensEquipados(uid, gastos){
  const meus = (gastos || []).filter(g => g && g.dono === 'p' && g.especie);
  if(!meus.length) return;
  /* O motor anota a ESPÉCIE que estava lutando; a conta guarda pela RAIZ DA LINHA. Apaga toda
     chave da linha -- inclusive a velha, de quando a chave era a espécie. */
  const snap = await db.collection('users').doc(uid).get().catch(()=>null);
  const equipados = (snap && snap.exists && snap.data().equipados) || {};
  const patch = {};
  meus.forEach(g => { chavesDaLinha(equipados, g.slot, g.especie).forEach(k => { patch['equipados.' + k] = admin.firestore.FieldValue.delete(); }); });
  if(!Object.keys(patch).length) return;
  await db.collection('users').doc(uid).update(patch).catch(e => logger.error('Erro ao gastar item equipado:', e));
}


/* ============================================================================
   GASTAR UMA MÁQUINA DE TÉCNICA
   ----------------------------------------------------------------------------
   ⚠️ QUEM GASTA É O SERVIDOR, e não é opcional: o `inventario` está na trava de campos do
   `firestore.rules` junto de `moedas` e `rareCandies` -- e tem que estar, porque um TM escrito pelo
   cliente seria Hiper Raio infinito em todo mundo.
   ⚠️ E A TRANSAÇÃO NÃO É ENFEITE: sem ela, duas abas leem o mesmo estoque e as duas passam -- um
   TM ensinado DUAS vezes pelo preço de um. É o mesmo cuidado do buyItem e do sellItem.
   ⚠️ O QUE ELE NÃO FAZ: ele não escreve o golpe no pokémon. Quem faz isso é o cliente, que já é
   dono do save (o documento do save é livre pro dono) -- e ele grava o time ANTES de chamar aqui,
   pela mesma razão de sempre: **errar pro lado de o jogador FICAR com a Máquina**. Se a chamada se
   perder, ele aprendeu o golpe e não pagou; o contrário seria pagar e não aprender.
   ============================================================================ */
exports.usarTM = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const item = String(request.data?.tm ?? '');
  if(!TMS[item]) throw new HttpsError('invalid-argument', 'Máquina desconhecida.');
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx) => {
    const [snap] = await tx.getAll(userRef);
    const d = snap.exists ? (snap.data() || {}) : {};
    const tem = ((d.inventario || {})[item]) || 0;
    if(tem < 1){
      throw new HttpsError('failed-precondition', 'Você não tem essa Máquina.');
    }
    tx.set(userRef, { inventario: { [item]: admin.firestore.FieldValue.increment(-1) } }, { merge: true });
    const inv = Object.assign({}, d.inventario || {});
    inv[item] = tem - 1;
    return { inventario: inv, restam: tem - 1 };
  });
});
exports.buyItem = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const item = String(request.data?.item ?? '');
  const daLoja = LOJA[item];
  if(!daLoja) throw new HttpsError('invalid-argument', 'Item desconhecido.');
  /* QUANTIDADE. O cliente pergunta quantos e manda o número; quem valida é aqui, contra o SALDO
     LIDO NA TRANSAÇÃO -- o teto da tela é uma conveniência, não a regra. Não há teto artificial:
     o limite é o que o dinheiro compra, e um pedido absurdo é cortado pelo próprio saldo. */
  const pedido = Math.floor(Number(request.data?.quantidade ?? 1));
  if(!Number.isFinite(pedido) || pedido < 1){
    throw new HttpsError('invalid-argument', 'Quantidade inválida.');
  }
  const userRef = db.collection('users').doc(uid);
  /* Transação porque duas abas do mesmo jogador podem comprar ao mesmo tempo: sem ela, as duas leem
     o mesmo saldo e as duas passam -- dois itens pelo preço de um. Mesmo cuidado do re-sorteio. */
  return db.runTransaction(async (tx) => {
    const [snap] = await tx.getAll(userRef);
    const d = snap.exists ? (snap.data() || {}) : {};
    const moedas = d.moedas || 0;
    if(moedas < daLoja.preco){
      throw new HttpsError('failed-precondition',
        `Você tem ${moedas} moeda${moedas===1?'':'s'} — esse item custa ${daLoja.preco}.`);
    }
    /* COMPRA O QUE COUBER, não menos. Pedir 10 com dinheiro pra 4 leva 4: recusar a compra inteira
       porque o saldo mudou entre a tela e a transação (outra aba, um re-sorteio) seria pior que
       entregar o que dá -- e o jogador vê o que gastou na resposta. */
    const cabem = Math.floor(moedas / daLoja.preco);
    const qtd = Math.min(pedido, cabem);
    const custo = qtd * daLoja.preco;
    /* O DESTINO depende do item: contador da conta (Doce Raro) ou armazém (o resto). */
    const patch = { moedas: admin.firestore.FieldValue.increment(-custo) };
    if(daLoja.contador){ patch[daLoja.contador] = admin.firestore.FieldValue.increment(qtd); }
    else { patch.inventario = { [item]: admin.firestore.FieldValue.increment(qtd) }; }
    tx.set(userRef, patch, { merge: true });
    const inv = Object.assign({}, d.inventario || {});
    if(!daLoja.contador) inv[item] = (inv[item] || 0) + qtd;
    return {
      moedas: moedas - custo,
      inventario: inv,
      rareCandies: (d.rareCandies || 0) + (daLoja.contador === 'rareCandies' ? qtd : 0),
      comprou: qtd,
      gastou: custo
    };
  });
});

/* VENDER: 50% do preço de compra (11/09/2026, a pedido). O espelho do buyItem, e a metade é
   calculada AQUI a partir do mesmo `LOJA[item].preco` -- um segundo número escrito à mão divergiria
   no primeiro reajuste, que é o defeito que o preço no cliente já quase teve.
   `Math.floor` porque os onze preços são pares (800, 300, 50, 30) e todos dividem redondo hoje; o
   piso está aqui pra o dia em que um preço ímpar entrar, e ele erra a favor do JOGO, não do
   jogador -- moeda fracionada não existe.
   ⚠️ NÃO HÁ LOOP DE ARBITRAGEM, e isso é por construção: comprar por 300 e vender por 150 perde
   150. A metade é o que garante isso -- qualquer coisa acima de 100% viraria máquina de moeda.
   ⚠️ O QUE ELA CRIA É UMA TORNEIRA NOVA, e essa é a consequência real: o Doce Raro da Torre e o
   Bônus Shiny da Elite passam a virar moeda. Está medido no CLAUDE.md. */
function precoDeVenda(item){
  const daLoja = LOJA[item];
  return daLoja ? Math.floor(daLoja.preco / 2) : 0;
}
exports.sellItem = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const item = String(request.data?.item ?? '');
  const daLoja = LOJA[item];
  if(!daLoja) throw new HttpsError('invalid-argument', 'Item desconhecido.');
  const pedido = Math.floor(Number(request.data?.quantidade ?? 1));
  if(!Number.isFinite(pedido) || pedido < 1){
    throw new HttpsError('invalid-argument', 'Quantidade inválida.');
  }
  const userRef = db.collection('users').doc(uid);
  /* Transação pelo mesmo motivo da compra: duas abas leem o mesmo estoque e as duas passam --
     aqui isso seria pior que na compra, porque cria moeda do nada. */
  return db.runTransaction(async (tx) => {
    const [snap] = await tx.getAll(userRef);
    const d = snap.exists ? (snap.data() || {}) : {};
    /* ⚠️ O QUE DÁ PRA VENDER NÃO É O QUE A MOCHILA MOSTRA, e o Bônus Shiny é o caso:
       o `quantoTenho` do cliente soma os CUPONS (o save campeão e a notificação de liga) com o
       estoque comprado, porque pra USAR os dois valem igual. Pra VENDER não: cupom é uma marca de
       "você ganhou isso" dentro de um save ou de uma notificação, não uma linha de estoque -- não
       há de onde descontar. Só o ARMAZÉM (inventario) e o CONTADOR do Doce Raro se vendem.
       O cliente calcula a mesma coisa no `quantoPossoVender`; se os dois divergirem, a tela oferece
       um botão que a cobrança recusa. */
    const estoque = daLoja.contador ? (d[daLoja.contador] || 0)
                                    : ((d.inventario && d.inventario[item]) || 0);
    if(estoque < 1){
      throw new HttpsError('failed-precondition', 'Você não tem esse item pra vender.');
    }
    /* VENDE O QUE TEM, não menos: pedir 10 tendo 4 vende 4. Mesma regra da compra -- recusar tudo
       porque o estoque mudou entre a tela e a transação seria pior que fazer o que dá. */
    const qtd = Math.min(pedido, estoque);
    const ganho = qtd * precoDeVenda(item);
    const patch = { moedas: admin.firestore.FieldValue.increment(ganho) };
    if(daLoja.contador){ patch[daLoja.contador] = admin.firestore.FieldValue.increment(-qtd); }
    else { patch.inventario = { [item]: admin.firestore.FieldValue.increment(-qtd) }; }
    tx.set(userRef, patch, { merge: true });
    const inv = Object.assign({}, d.inventario || {});
    if(!daLoja.contador) inv[item] = estoque - qtd;
    return {
      moedas: (d.moedas || 0) + ganho,
      inventario: inv,
      rareCandies: (d.rareCandies || 0) - (daLoja.contador === 'rareCandies' ? qtd : 0),
      vendeu: qtd,
      recebeu: ganho
    };
  });
});
/* ATIVA UM BÔNUS SHINY COMPRADO. Os outros dois caminhos (activateEliteShinyBonus e
   activateShinyBonus) leem um CUPOM -- o save campeão e a notificação de liga --, que é uma marca
   de "você ganhou isso" e não um estoque. O comprado é estoque de verdade, no inventário, e por
   isso precisa da própria função: gastar um do armazém e ligar a mesma janela de 1 hora. */
exports.activateBoughtShinyBonus = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx) => {
    const [snap] = await tx.getAll(userRef);
    const d = snap.exists ? (snap.data() || {}) : {};
    const quantos = (d.inventario && d.inventario.bonus_shiny) || 0;
    if(quantos <= 0) throw new HttpsError('failed-precondition', 'Você não tem nenhum Bônus Shiny comprado.');
    /* SOMA no que já estiver valendo, em vez de reiniciar: ativar o segundo em cima do primeiro
       jogaria fora o tempo que sobrou, e o jogador não teria como saber que perdeu. */
    const agora = Date.now();
    const base = (d.shinyBonusExpiresAt && d.shinyBonusExpiresAt > agora) ? d.shinyBonusExpiresAt : agora;
    const expiresAt = base + SHINY_BONUS_DURATION_MS;
    tx.set(userRef, {
      shinyBonusExpiresAt: expiresAt,
      inventario: { bonus_shiny: admin.firestore.FieldValue.increment(-1) }
    }, { merge: true });
    const inv = Object.assign({}, d.inventario || {});
    inv.bonus_shiny = quantos - 1;
    return { expiresAt, inventario: inv };
  });
});

/* EQUIPAR: tira um do armazém e põe no pokémon. A conta guarda espécie -> item, e é ela que as
   batalhas leem -- o save também carrega uma cópia pra desenhar a tela, mas ela não decide nada.
   Tem que ser o servidor porque o save é escrito pelo cliente: se a batalha lesse o save, dar item
   a todo mundo seria uma linha no console. */
exports.equipItem = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const item = String(request.data?.item ?? '');
  const especie = String(request.data?.speciesId ?? '');
  /* O SLOT faz parte da identidade: dois saves podem ter o mesmo pokémon, e o item é de UM deles. */
  const slot = String(request.data?.slot ?? '');
  if(EQUIPAVEIS.indexOf(item) < 0) throw new HttpsError('invalid-argument', 'Esse item não se equipa.');
  if(!especie) throw new HttpsError('invalid-argument', 'Pokémon não informado.');
  if(!slot || slot === 'null' || slot === 'undefined') throw new HttpsError('invalid-argument', 'Save não informado.');
  const userRef = db.collection('users').doc(uid);
  /* Transação porque duas abas podem equipar ao mesmo tempo: sem ela as duas leem o mesmo estoque e
     as duas passam -- dois pokémon equipados com um item só. */
  return db.runTransaction(async (tx) => {
    const [snap] = await tx.getAll(userRef);
    const d = snap.exists ? (snap.data() || {}) : {};
    const quantos = (d.inventario && d.inventario[item]) || 0;
    if(quantos <= 0) throw new HttpsError('failed-precondition', 'Você não tem esse item.');
    const equipados = Object.assign({}, d.equipados || {});
    /* A chave é a RAIZ DA LINHA: assim o item continua no pokémon depois de ele evoluir. */
    const chave = chaveDoEquipado(slot, especie);
    const antigas = chavesDaLinha(equipados, slot, especie);
    /* UM ITEM POR POKÉMON. Trocar o que ele já carregava DEVOLVE o antigo pro armazém: perder um
       item porque se clicou no botão errado seria pior que a troca não acontecer. */
    const antigo = itemEquipado(equipados, slot, especie);
    const patch = { inventario: { [item]: admin.firestore.FieldValue.increment(-1) } };
    if(antigo) patch.inventario[antigo] = admin.firestore.FieldValue.increment(1);
    tx.set(userRef, patch, { merge: true });
    /* Apaga QUALQUER chave velha da linha antes de gravar a nova -- dado gravado com a chave antiga
       (a espécie) ressuscitaria na leitura, que aceita a linha inteira. */
    const upd = { ['equipados.' + chave]: item };
    antigas.forEach(k => { if(k !== chave) upd['equipados.' + k] = admin.firestore.FieldValue.delete(); });
    tx.update(userRef, upd);
    const inv = Object.assign({}, d.inventario || {});
    inv[item] = quantos - 1;
    if(antigo) inv[antigo] = (inv[antigo] || 0) + 1;
    antigas.forEach(k => { delete equipados[k]; });
    equipados[chave] = item;
    return { inventario: inv, equipados, devolvido: antigo };
  });
});

/* DESEQUIPAR devolve pro armazém. O item só se perde quando ele TRABALHA. */
exports.unequipItem = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const especie = String(request.data?.speciesId ?? '');
  const slot = String(request.data?.slot ?? '');
  if(!especie) throw new HttpsError('invalid-argument', 'Pokémon não informado.');
  if(!slot || slot === 'null' || slot === 'undefined') throw new HttpsError('invalid-argument', 'Save não informado.');
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx) => {
    const [snap] = await tx.getAll(userRef);
    const d = snap.exists ? (snap.data() || {}) : {};
    const equipados = Object.assign({}, d.equipados || {});
    const item = itemEquipado(equipados, slot, especie);
    if(!item) throw new HttpsError('failed-precondition', 'Esse pokémon não está com item nenhum.');
    /* Apaga TODA chave da linha: o pokémon pode ter evoluído, e o item estar guardado sob a espécie
       de antes. Procurar só pela espécie de agora devolveria "não tem item" pra quem tem. */
    const upd = { ['inventario.' + item]: admin.firestore.FieldValue.increment(1) };
    chavesDaLinha(equipados, slot, especie).forEach(k => { upd['equipados.' + k] = admin.firestore.FieldValue.delete(); });
    tx.update(userRef, upd);
    const inv = Object.assign({}, d.inventario || {});
    inv[item] = (inv[item] || 0) + 1;
    chavesDaLinha(equipados, slot, especie).forEach(k => { delete equipados[k]; });
    return { inventario: inv, equipados };
  });
});

/* O ITEM TRABALHOU NUMA BATALHA DO CLIENTE (a jornada e os desafios rodam lá). O servidor não viu a
   luta, então quem avisa é o cliente -- e o pior caso de a chamada se perder é o jogador FICAR com
   o item equipado, que é o lado certo pra errar. Nas batalhas do servidor (Torre, ginásio da
   cidade, raide) quem limpa é a própria função da batalha, sem depender de ninguém.
   Só aceita tirar item que a conta REALMENTE tinha equipado naquela espécie: o cliente diz o que
   gastou, mas não escolhe o que some. */
exports.consumeEquipped = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  /* Cada gasto vem com ESPÉCIE e SLOT: o item é de um pokémon de um save, e dois saves podem ter o
     mesmo bicho. O campo antigo (só as espécies) continua aceito pra não quebrar cliente em cache;
     sem slot, apaga a chave velha da linha, que é o que aquele cliente sabia gravar. */
  const brutos = Array.isArray(request.data?.gastos) ? request.data.gastos
               : (Array.isArray(request.data?.especies) ? request.data.especies.map(e => ({ especie: e })) : []);
  const gastos = brutos.slice(0, 12)
    .map(g => ({ especie: String((g && g.especie) || ''), slot: (g && g.slot != null) ? String(g.slot) : null }))
    .filter(g => g.especie);
  if(!gastos.length) return { ok: true };
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  const equipados = (snap.exists && snap.data().equipados) || {};
  /* Pela RAIZ DA LINHA, não pela espécie: o pokémon pode ter evoluído entre equipar e gastar. */
  const patch = {};
  gastos.forEach(g => { chavesDaLinha(equipados, g.slot, g.especie).forEach(k => { patch['equipados.' + k] = admin.firestore.FieldValue.delete(); }); });
  if(!Object.keys(patch).length) return { ok: true };
  await userRef.update(patch);
  return { ok: true };
});

/* ============================ MOEDAS ============================
   QUEM PAGA É O SERVIDOR, sempre. As regras do Firestore não deixam o cliente escrever `moedas`
   pelo mesmo motivo do `rareCandies`: moeda é poder de compra, e hoje ela compra re-sorteio do
   encontro selvagem -- uma linha no console viraria shiny à vontade, que é exatamente a artimanha
   que a semente do encontro existe pra fechar. */
const MOEDAS_POR_GINASIO = 5;
const MOEDAS_JORNADA_COMPLETA = 10;   // as 8 insígnias
const MOEDAS_ELITE = 20;
const MOEDAS_RESSORTEIO = 5;
/* TETO DE RE-SORTEIOS POR SAVE (11/09/2026, a pedido). Ele é a trava que o PREÇO não consegue ser:
   preço depende de quanto o jogador tem, e toda fonte de moeda nova (o pagamento da jornada, a
   venda de itens, o que vier depois) reabre a torneira. O teto não se importa com o saldo.
   ⚠️ ELE NÃO PODE MORAR NO SAVE, e essa é a diferença que importa. O documento do save é LIVRE pro
   dono (`allow read, write: if uid == userId`), e o `wildRerolls` se dá ao luxo disso porque mentir
   nele não paga: ele alimenta a SEMENTE da oferta, então um re-sorteio barato devolve a MESMA
   oferta. Mentir no TOTAL paga -- compra re-sorteio a mais. Por isso o contador vive no documento
   da CONTA, sob a mesma trava das moedas, e quem escreve é esta função.
   A CHAVE É `slot:saveGen`, e isso resolve o reuso de slot de graça: quando um save é apagado e
   outro nasce ali, a geração do slot avança (ver `saveGen`) e a chave muda -- o teto do save novo
   nasce zerado sem ninguém precisar limpar nada. É o mesmo mecanismo que já fecha o save-scumming
   dos iniciais. */
const MAX_RESSORTEIOS_POR_SAVE = 8;
function chaveDoTetoDeRessorteio(slot, saveGen){ return String(slot) + ':' + (saveGen || 0); }

/* O QUE UM SAVE JÁ RENDEU. Conta do zero toda vez, a partir do estado do save -- não é um contador
   que incrementa. Assim uma chamada perdida (rede caindo na hora da vitória) não custa moeda
   nenhuma: a próxima chamada vê a diferença e paga tudo. */
function moedasDevidasDoSave(save){
  const s = save || {};
  const insignias = (typeof s.badgeCount === 'number') ? s.badgeCount : ((s.badgesEarned || []).length);
  let total = insignias * MOEDAS_POR_GINASIO;
  if(insignias >= 8) total += MOEDAS_JORNADA_COMPLETA;
  if(s.eliteStatus === 'champion') total += MOEDAS_ELITE;
  return total;
}

/* PAGA O QUE O SAVE DEVE. Idempotente pelo campo `coinsPaid`, gravado no próprio save: ele guarda
   quanto aquele save JÁ rendeu, e o que se paga é a diferença.

   SAVE ANTIGO NÃO RECEBE RETROATIVO. Na primeira vez que um save passa por aqui sem `coinsPaid`,
   o campo nasce valendo o que ele já teria rendido -- e nada é pago. É a escolha reversível: quem
   estava com 8 insígnias e a Elite vencida receberia 70 moedas de uma vez, ou seja, 14 re-sorteios
   de encontro selvagem caídos do céu. Se um dia se decidir pagar retroativo, é trocar este ramo
   por um `jaPago = 0`; o contrário -- tirar moeda que já foi paga -- não tem volta. */
exports.claimJourneyCoins = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const slot = String(request.data?.slot ?? '');
  if(!slot) throw new HttpsError('invalid-argument', 'Save não informado.');

  const userRef = db.collection('users').doc(uid);
  const saveRef = userRef.collection('saves').doc(slot);
  /* Transação porque duas abas do mesmo jogador podem reivindicar a mesma vitória ao mesmo tempo:
     sem ela, as duas leem o mesmo `coinsPaid` e pagam duas vezes.
     TODAS as leituras antes de qualquer escrita -- o Firestore recusa a transação inteira se um get
     vier depois de um set, e esse erro só aparece em produção (ver o Boss de Domingo). */
  return db.runTransaction(async (tx) => {
    const [userSnap, saveSnap] = await tx.getAll(userRef, saveRef);
    if(!saveSnap.exists) throw new HttpsError('failed-precondition', 'Save não encontrado.');
    const save = saveSnap.data() || {};
    const conta = userSnap.exists ? (userSnap.data() || {}) : {};
    const moedasAgora = conta.moedas || 0;
    const devido = moedasDevidasDoSave(save);

    if(typeof save.coinsPaid !== 'number'){
      tx.set(saveRef, { coinsPaid: devido }, { merge: true });
      return { moedas: moedasAgora, ganhou: 0, base: devido };
    }
    const ganhou = Math.max(0, devido - save.coinsPaid);
    if(ganhou > 0){
      tx.set(userRef, { moedas: admin.firestore.FieldValue.increment(ganhou) }, { merge: true });
      tx.set(saveRef, { coinsPaid: devido }, { merge: true });
    }
    return { moedas: moedasAgora + ganhou, ganhou };
  });
});


/* ================= AS MOEDAS DAS CONQUISTAS (16/09/2026) =================
   Pedido assim: *"a cada conquista o treinador ganha moeda ... faça niveis de conquistas, as
   conquistas faceis dao menos dinheiro e as mais dificeis dao mais"*.

   ⚠️ POR QUE A TABELA INTEIRA VEIO PRA CÁ, e essa é a decisão cara desta feature: as regras do
   Firestore não deixam o cliente escrever `moedas` -- moeda é poder de compra, e é a mesma trava
   que existe pra o console não virar shiny à vontade. Então quem decide o que está ganho tem que
   ser o servidor, e pra isso ele precisa das 69 conquistas E do agregado que as alimenta.
   Confiar no que o cliente mandasse seria uma linha no console valendo o bolo inteiro.

   ⚠️ AS 69 CHECKS SÃO COPIADAS DO CLIENTE, não redigitadas (tools/, ver o CLAUDE.md): redigitar 69
   funções é garantir que uma divergisse. O que NÃO veio é o que o servidor não tem: ícone, nome e
   descrição -- ele não tem tela.
   O teste compara os dois lados por COMPORTAMENTO (agregados sorteados nos dois, o mesmo conjunto
   destravado), porque gerar uma vez não impede alguém de editar um lado depois.

   ⚠️ AS CINCO CONQUISTAS DE LIGA DEPENDEM DAS FLAGS MIGRADAS da conta (anyChampion e companhia,
   gravadas por recordLeaguePlacement). Conta ainda não migrada tem as cinco como FALSAS aqui -- e
   isso se resolve sozinho, porque quem migra é a própria tela de Conquistas (ver
   computeLeagueAchievementExtra), que é de onde o resgate é pedido. O erro é pro lado de NÃO pagar
   agora, nunca pro de pagar duas vezes. */
const ESPECIES_INTOCAVEIS = ['lugia','hooh','celebi'];
const NIVEL_DA_CONQUISTA = {
  facil:    { moedas: 10  },
  media:    { moedas: 25  },
  dificil:  { moedas: 60  },
  lendaria: { moedas: 150 }
};

/* O AGREGADO, espelho do getAchievementAggregate do cliente. A diferença é de ONDE vem cada coisa:
   lá é o `game` (a sessão aberta), aqui são os documentos -- os saves e a conta. */
function agregadoDasConquistas(saves, conta){
  const slots = (saves || []).filter(Boolean);
  const c = conta || {};
  /* a Pokédex da CONTA mais o que cada save registrou: a união é o que o cliente enxerga depois da
     reconciliação do loadPermanentUserData, e aqui ela é feita direto */
  const caught = new Set(c.pokedexCaught || []);
  slots.forEach(s => (s.caughtSpecies || []).forEach(id => caught.add(id)));
  const allTeams = slots.map(s => s.team || []);
  const maxBadges = slots.reduce((max, s) => Math.max(max, s.badgeCount != null ? s.badgeCount : ((s.badgesEarned || []).length)), 0);
  const eliteChamps = slots.filter(s => s.eliteStatus === 'champion');
  return {
    caughtCount: caught.size,
    totalSpecies: Object.keys(SPECIES).length,
    maxBadges,
    anyEvolution: slots.some(s => (s.evolutions || []).length > 0),
    anyEeveeEvo: ['vaporeon','jolteon','flareon'].some(id => caught.has(id)),
    anyLegendary: ['moltres','zapdos','articuno'].some(id => caught.has(id)),
    anyFullTeam: slots.some(s => (s.team || []).length >= 6),
    anyComeback: slots.some(s => s.everComeback || ((s.losses || 0) > 0 && (s.badgeCount || 0) > 0)),
    slotsUsed: slots.length,
    anyJourneyEnd: slots.some(s => (s.badgeCount || 0) >= 8),
    hasMewtwo: caught.has('mewtwo'),
    hasDitto: caught.has('ditto'),
    kantoCaught: [...caught].filter(id => SPECIES[id] && SPECIES[id].dex <= 151).length,
    kantoTotal: Object.keys(SPECIES).filter(id => SPECIES[id].dex <= 151).length,
    johtoCaught: [...caught].filter(id => SPECIES[id] && SPECIES[id].dex >= 152).length,
    johtoTotal: Object.keys(SPECIES).filter(id => SPECIES[id].dex >= 152 && ESPECIES_INTOCAVEIS.indexOf(id) < 0).length,
    totalCapturavel: Object.keys(SPECIES).filter(id => ESPECIES_INTOCAVEIS.indexOf(id) < 0).length,
    allBeasts: ['raikou','entei','suicune'].every(id => caught.has(id)),
    allTowerDuo: ['lugia','hooh'].every(id => caught.has(id)),
    bossTop10: !!c.bossTop10,
    bossKiller: !!c.bossKiller,
    hasDragonite: caught.has('dragonite'),
    allBirds: ['moltres','zapdos','articuno'].every(id => caught.has(id)),
    allEeveeEvos: ['vaporeon','jolteon','flareon'].every(id => caught.has(id)),
    allStartersFinal: ['venusaur','charizard','blastoise'].every(id => caught.has(id)),
    anyShinyTeam: allTeams.some(team => team.some(p => p && p.shiny)),
    maxTeamLevel: allTeams.reduce((max, team) => Math.max(max, ...team.map(p => (p && p.level) || 0), 0), 0),
    anyTeamAll50: allTeams.some(team => team.length >= 6 && team.every(p => ((p && p.level) || 0) >= 50)),
    savesWith8Badges: slots.filter(s => (s.badgeCount || 0) >= 8).length,
    totalBadges: slots.reduce((soma, s) => soma + (s.badgeCount || 0), 0),
    maxCaughtOneSave: slots.reduce((max, s) => Math.max(max, (s.caughtSpecies || []).length), 0),
    anyMewtwoReward: slots.some(s => s.mewtwoReward && s.mewtwoReward.earned),
    anyMewtwoUsed: slots.some(s => s.mewtwoReward && s.mewtwoReward.used)
      || !!c.mewtwoLoanActive || (c.mewtwoLoanCooldownUntil || 0) > 0,
    bestStreak: c.trainerBestStreak || 0,
    leagueWinsTotal: c.leagueWinsTotal || 0,
    eliteTeams: eliteChamps.map(s => (s.eliteWinTeam && s.eliteWinTeam.length) ? s.eliteWinTeam : (s.team || []).map(p => p && p.speciesId)),
    eliteGymPaths: eliteChamps.map(s => (s.gymPath && s.gymPath.length) ? s.gymPath : new Array(8).fill('kanto')),
    eliteFirstTry: eliteChamps.some(s => (s.eliteAttemptsUsed || 0) === 0),
    bestTeamAvg: allTeams.reduce((max, team) => {
      if(!team.length) return max;
      return Math.max(max, team.reduce((soma, p) => soma + ((p && p.level) || 0), 0) / team.length);
    }, 0),
    anyEliteChampion: eliteChamps.length > 0,
    anyEliteDittoWin: slots.some(s => s.eliteDittoWin),
    savesEliteChampion: eliteChamps.length,
    shinyCount: (c.pokedexShinyCaught || []).length,
    bestJourneyLosses: slots.filter(s => (s.badgeCount || 0) >= 8)
      .reduce((min, s) => Math.min(min, (typeof s.lossesTotal === 'number') ? s.lossesTotal : 99), 99)
  };
}

const CONQUISTAS = [
  { id:'first_step', nivel:'facil', check:a=>a.slotsUsed>=1 },
  { id:'first_badge', nivel:'facil', check:a=>a.maxBadges>=1 },
  { id:'halfway', nivel:'facil', check:a=>a.maxBadges>=4 },
  { id:'all_badges', nivel:'media', check:a=>a.maxBadges>=8 },
  { id:'catch_10', nivel:'facil', check:a=>a.caughtCount>=10 },
  { id:'catch_30', nivel:'facil', check:a=>a.caughtCount>=30 },
  { id:'catch_60', nivel:'media', check:a=>a.caughtCount>=60 },
  { id:'catch_100', nivel:'dificil', check:a=>a.caughtCount>=100 },
  { id:'catch_all', nivel:'lendaria', check:a=>a.caughtCount>=a.totalCapturavel },
  { id:'evolve_1', nivel:'facil', check:a=>a.anyEvolution },
  { id:'eevee_choice', nivel:'facil', check:a=>a.anyEeveeEvo },
  { id:'legendary', nivel:'media', check:a=>a.anyLegendary },
  { id:'full_team', nivel:'facil', check:a=>a.anyFullTeam },
  { id:'comeback', nivel:'facil', check:a=>a.anyComeback },
  { id:'three_saves', nivel:'facil', check:a=>a.slotsUsed>=3 },
  { id:'league_registered', nivel:'facil', check:(a,x)=>x.anyRegistered },
  { id:'league_semifinal', nivel:'media', check:(a,x)=>x.anySemifinal },
  { id:'league_runnerup', nivel:'dificil', check:(a,x)=>x.anyRunnerUp },
  { id:'league_champion', nivel:'dificil', check:(a,x)=>x.anyChampion },
  { id:'legend_of_kanto', nivel:'dificil', check:(a,x)=>a.anyJourneyEnd && x.anyChampion },
  { id:'boss_top10', nivel:'dificil', check:a=>a.bossTop10 },
  { id:'boss_killer', nivel:'lendaria', check:a=>a.bossKiller },
  { id:'elite_ditto', nivel:'dificil', check:a=>a.anyEliteDittoWin },
  { id:'catch_149', nivel:'dificil', check:a=>a.kantoCaught>=a.kantoTotal },
  { id:'mewtwo_caught', nivel:'lendaria', check:a=>a.hasMewtwo },
  { id:'mewtwo_reward', nivel:'dificil', check:a=>a.anyMewtwoUsed },
  { id:'all_birds', nivel:'dificil', check:a=>a.allBirds },
  { id:'shiny_team', nivel:'media', check:a=>a.anyShinyTeam },
  { id:'ditto_caught', nivel:'facil', check:a=>a.hasDitto },
  { id:'dragon_master', nivel:'media', check:a=>a.hasDragonite },
  { id:'eevee_all', nivel:'dificil', check:a=>a.allEeveeEvos },
  { id:'starters_final', nivel:'dificil', check:a=>a.allStartersFinal },
  { id:'level_60', nivel:'facil', check:a=>a.maxTeamLevel>=60 },
  { id:'level_70', nivel:'media', check:a=>a.maxTeamLevel>=70 },
  { id:'team_all_50', nivel:'media', check:a=>a.anyTeamAll50 },
  { id:'double_journey', nivel:'dificil', check:a=>a.savesWith8Badges>=2 },
  { id:'badges_20', nivel:'media', check:a=>a.totalBadges>=20 },
  { id:'catch_18_one_save', nivel:'media', check:a=>a.maxCaughtOneSave>=18 },
  { id:'streak_5', nivel:'media', check:a=>a.bestStreak>=5 },
  { id:'streak_10', nivel:'dificil', check:a=>a.bestStreak>=10 },
  { id:'classic_bi', nivel:'dificil', check:a=>a.leagueWinsTotal>=2 },
  { id:'classic_tri', nivel:'lendaria', check:a=>a.leagueWinsTotal>=3 },
  { id:'trainers_champion', nivel:'dificil', check:(a,x)=>x.anyTrainersChampion },
  { id:'elite_champion', nivel:'media', check:a=>a.anyEliteChampion },
  { id:'elite_venusaur', nivel:'dificil', check:a=>a.eliteTeams.some(t=>t.includes('venusaur')) },
  { id:'elite_charizard', nivel:'dificil', check:a=>a.eliteTeams.some(t=>t.includes('charizard')) },
  { id:'elite_blastoise', nivel:'dificil', check:a=>a.eliteTeams.some(t=>t.includes('blastoise')) },
  { id:'elite_all_starters', nivel:'lendaria', check:a=>['venusaur','charizard','blastoise'].every(sp=>a.eliteTeams.some(t=>t.includes(sp))) },
  { id:'elite_twice', nivel:'dificil', check:a=>a.savesEliteChampion>=2 },
  { id:'elite_legendary', nivel:'dificil', check:a=>a.eliteTeams.some(t=>['moltres','zapdos','articuno'].some(b=>t.includes(b))) },
  { id:'elite_no_legendary', nivel:'media', check:a=>a.eliteTeams.some(t=>!['moltres','zapdos','articuno','mewtwo'].some(b=>t.includes(b))) },
  { id:'elite_path_kanto', nivel:'dificil', check:a=>a.eliteGymPaths.some(p=>p.length>0 && p.every(r=>r!=='johto')) },
  { id:'elite_path_johto', nivel:'dificil', check:a=>a.eliteGymPaths.some(p=>p.length>0 && p.every(r=>r==='johto')) },
  { id:'elite_path_split', nivel:'media', check:a=>a.eliteGymPaths.some(p=>p.filter(r=>r==='johto').length===4 && p.filter(r=>r!=='johto').length===4) },
  { id:'elite_team_kanto', nivel:'dificil', check:a=>a.eliteTeams.some(t=>t.length>0 && t.every(id=>SPECIES[id] && SPECIES[id].dex<=151)) },
  { id:'elite_team_johto', nivel:'dificil', check:a=>a.eliteTeams.some(t=>t.length>0 && t.every(id=>SPECIES[id] && SPECIES[id].dex>=152)) },
  { id:'elite_monotype', nivel:'lendaria', check:a=>a.eliteTeams.some(t=>{ if(!t.length) return false; const tipos = t.map(id=> (SPECIES[id] && SPECIES[id].types) || []); return tipos[0].some(tipo => tipos.every(ts => ts.includes(tipo))); }) },
  { id:'elite_first_try', nivel:'dificil', check:a=>a.eliteFirstTry },
  { id:'catch_johto', nivel:'lendaria', check:a=>a.johtoCaught>=a.johtoTotal },
  { id:'all_beasts', nivel:'dificil', check:a=>a.allBeasts },
  { id:'team_avg_60', nivel:'media', check:a=>a.bestTeamAvg>=60 },
  { id:'team_avg_70', nivel:'dificil', check:a=>a.bestTeamAvg>=70 },
  { id:'team_avg_80', nivel:'lendaria', check:a=>a.bestTeamAvg>=80 },
  { id:'level_90', nivel:'dificil', check:a=>a.maxTeamLevel>=90 },
  { id:'shiny_5', nivel:'dificil', check:a=>a.shinyCount>=5 },
  { id:'shiny_25', nivel:'lendaria', check:a=>a.shinyCount>=25 },
  { id:'shiny_50', nivel:'lendaria', check:a=>a.shinyCount>=50 },
  { id:'flawless_journey', nivel:'lendaria', check:a=>a.bestJourneyLosses===0 },
  { id:'clean_journey', nivel:'dificil', check:a=>a.bestJourneyLosses<=5 },
];

/* O QUE A CONTA TEM GANHO AGORA. `extra` sai das flags migradas da conta -- ver a nota lá em cima. */
function conquistasGanhasDaConta(saves, conta){
  const c = conta || {};
  const agg = agregadoDasConquistas(saves, c);
  const extra = {
    anyRegistered: !!c.anyRegistered, anySemifinal: !!c.anySemifinal,
    anyRunnerUp: !!c.anyRunnerUp, anyChampion: !!c.anyChampion,
    anyTrainersChampion: !!c.anyTrainersChampion
  };
  return CONQUISTAS.filter(a => {
    try { return !!a.check(agg, extra); }
    catch(e){ console.error('conquista ' + a.id + ' quebrou:', e); return false; }
  }).map(a => a.id);
}
function moedasDasConquistas(ids){
  const porId = {};
  CONQUISTAS.forEach(a => { porId[a.id] = a.nivel; });
  return (ids || []).reduce((soma, id) => {
    const n = NIVEL_DA_CONQUISTA[porId[id]];
    return soma + (n ? n.moedas : 0);
  }, 0);
}

/* PAGA O QUE AINDA NÃO FOI PAGO. A lista do que já foi pago (`achievementsPaid`) mora na CONTA e
   está sob a MESMA trava das moedas no firestore.rules -- e a trava importa pelo lado que não é
   óbvio: escrever pra MAIS ali não paga nada, mas ZERAR a lista pelo console faria o bolo inteiro
   ficar resgatável de novo, quantas vezes quisessem.

   ⚠️ OS SAVES SÃO LIDOS FORA DA TRANSAÇÃO, de propósito: ler uma coleção dentro dela pra depois
   escrever só no documento da conta não compra nada, e conquista só CRESCE -- um save que mudou
   entre a leitura e a gravação no máximo adia uma conquista pro próximo resgate. O que a transação
   protege é o par (já pago, saldo), que é onde duas abas se atropelariam. */
/* ⚠️ O RESGATE É POR CONQUISTA desde 17/09/2026 (a pedido: *"para cada conquista o usuario tem que
   clicar no botão que tem na mesma linha"*). O `id` é OPCIONAL, e sem ele a função paga TUDO --
   que é como ela nasceu, e é o que um cliente antigo em cache continua mandando.
   ⚠️ O QUE NÃO MUDA É QUEM DECIDE: o servidor RECALCULA quais estão ganhas e ignora qualquer id
   que não esteja na lista. O que vem do cliente é o PEDIDO, nunca a resposta -- a mesma regra do
   `claimJourneyCoins`. */
exports.claimAchievementCoins = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const userRef = db.collection('users').doc(uid);
  const pedido = (request.data && typeof request.data.id === 'string') ? request.data.id : null;

  const [contaSnap, savesSnap] = await Promise.all([userRef.get(), userRef.collection('saves').get()]);
  const conta = contaSnap.exists ? (contaSnap.data() || {}) : {};
  const saves = savesSnap.docs.map(d => d.data() || {});
  const ganhas = conquistasGanhasDaConta(saves, conta);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const atual = snap.exists ? (snap.data() || {}) : {};
    const pagas = Array.isArray(atual.achievementsPaid) ? atual.achievementsPaid : [];
    const jaPagas = new Set(pagas);
    /* o pedido só filtra o que JÁ está ganho: um id inventado, uma conquista trancada ou uma já
       paga saem daqui como lista vazia, e a função devolve o saldo sem pagar nada */
    const novas = ganhas.filter(id => !jaPagas.has(id) && (!pedido || id === pedido));
    const moedasAgora = atual.moedas || 0;
    if(!novas.length){
      return { moedas: moedasAgora, ganhou: 0, pagas: pagas };
    }
    const ganhou = moedasDasConquistas(novas);
    tx.set(userRef, {
      moedas: admin.firestore.FieldValue.increment(ganhou),
      achievementsPaid: admin.firestore.FieldValue.arrayUnion(...novas)
    }, { merge: true });
    return { moedas: moedasAgora + ganhou, ganhou, pagas: pagas.concat(novas) };
  });
});

/* ⚠️ O EXPORT FICA AQUI, DEPOIS do bloco, e nao la em cima com os outros `_`: `const` tem zona
   morta temporal, e um export no topo do arquivo roda ANTES desta declaracao -- o modulo inteiro
   morre com "Cannot access CONQUISTAS before initialization". E o mesmo erro que derrubou quatro
   telas de revelacao em 13/09/2026, agora do lado do servidor.
   Ele sai pro teste que compara os DOIS lados por COMPORTAMENTO: cliente e servidor tem que
   destravar o MESMO conjunto pro mesmo agregado, senao a tela promete uma moeda que a cobranca
   nao paga (ou o contrario). */
exports._conquistas = { CONQUISTAS, NIVEL_DA_CONQUISTA, agregadoDasConquistas, conquistasGanhasDaConta, moedasDasConquistas, ESPECIES_INTOCAVEIS };

/* COBRA O RE-SORTEIO do encontro selvagem. Só desconta -- quem sorteia é o cliente, com a semente
   dele (ver goToWildEncounter): o servidor não conhece rota nem pool, e mandar a oferta daqui
   duplicaria as tabelas de encontro, que é justamente o que o projeto evita.
   O que o servidor garante é o que importa: que a moeda existia e saiu. */
/* O PREÇO DO RE-SORTEIO SOBE A CADA UM NA MESMA ROTA, MAS SÓ COM O BÔNUS SHINY LIGADO: 5, 10, 15...
   Sem o bônus são os 3 de sempre. A mesma conta vive no cliente (precoDoRessorteio), que precisa
   dela pra desenhar o botão -- mas quem cobra é aqui.
   O motivo é a matemática do bônus: a chance dele ESCALA +10 pontos por encontro sem shiny, então
   re-sortear sob o bônus é quase comprar um shiny. Preço fixo de 3 faria das 70 moedas de uma
   jornada um shiny garantido.
   O wildRerolls VEM DO SAVE, que o cliente escreve -- e isso é seguro por construção: ele entra na
   SEMENTE da oferta, então mentir que é zero devolve a MESMA oferta de antes. Quem falsifica o
   contador pra pagar menos não recebe pokémon novo nenhum. */
function precoDoRessorteio(jaFeitos, bonusAte){
  const comBonus = !!(bonusAte && bonusAte > Date.now());
  return comBonus ? MOEDAS_RESSORTEIO * (1 + Math.max(0, jaFeitos|0)) : MOEDAS_RESSORTEIO;
}
/* O MODO DIFÍCIL É PAGO (09/09/2026). Quem cobra é o servidor, pelo mesmo motivo de tudo que mexe
   em moeda: o campo está na trava do firestore.rules, e cliente escrevendo moeda é chance de shiny
   à vontade -- exatamente a artimanha que a semente do encontro existe pra fechar.
   O valor vive aqui E no cliente (MOEDA_MODO_DIFICIL): o cliente precisa dele pra desabilitar o
   botão, o servidor é quem cobra. Se os dois divergirem, a tela promete um preço que a cobrança
   não pratica.
   COBRA PRIMEIRO, CRIA DEPOIS -- a mesma ordem do re-sorteio. Criar o save antes de cobrar daria a
   jornada de graça pra quem fechasse a aba no meio.
   Efeito colateral bonito: apagar e recriar pra tentar um inicial shiny passou a CUSTAR. O sorteio
   já era congelado por slot+modo (ver startersSorteados), então recriar devolvia os mesmos
   iniciais; agora, além de não adiantar, sai 10 moedas. */
const MOEDA_MODO_DIFICIL = 10;
exports.payHardMode = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx) => {
    const [snap] = await tx.getAll(userRef);
    const d = (snap.exists && snap.data()) || {};
    const moedas = d.moedas || 0;
    if(moedas < MOEDA_MODO_DIFICIL){
      throw new HttpsError('failed-precondition',
        `Você tem ${moedas} moeda${moedas===1?'':'s'} — o modo difícil custa ${MOEDA_MODO_DIFICIL}.`);
    }
    tx.set(userRef, { moedas: admin.firestore.FieldValue.increment(-MOEDA_MODO_DIFICIL) }, { merge: true });
    return { moedas: moedas - MOEDA_MODO_DIFICIL, custo: MOEDA_MODO_DIFICIL };
  });
});
exports._MOEDA_MODO_DIFICIL = MOEDA_MODO_DIFICIL;   // o teste confere que o cliente cobra o mesmo
exports.rerollWildOffer = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const slot = String(request.data?.slot ?? '');
  const userRef = db.collection('users').doc(uid);
  /* Save opcional: cliente antigo em cache não manda o slot, e aí o preço é o de sempre. */
  const saveRef = slot ? db.collection('users').doc(uid).collection('saves').doc(slot) : null;
  return db.runTransaction(async (tx) => {
    const lidos = saveRef ? await tx.getAll(userRef, saveRef) : await tx.getAll(userRef);
    const userSnap = lidos[0], saveSnap = lidos[1];
    const d = (userSnap.exists && userSnap.data()) || {};
    const moedas = d.moedas || 0;
    const save = (saveSnap && saveSnap.exists && saveSnap.data()) || {};
    const jaFeitos = save.wildRerolls || 0;
    /* O TETO POR SAVE. A chave sai do slot MAIS a geração gravada no save: slot reaproveitado por
       um save novo tem geração nova, então o teto do save novo nasce zerado sozinho.
       SEM SLOT (cliente antigo em cache) NÃO HÁ COMO CONTAR, e aí ele é RECUSADO em vez de passar
       livre: deixar passar transformaria "não mandar o slot" no jeito de furar o teto, e um cliente
       adulterado faria exatamente isso. O index.html vai com no-cache e revalida a cada visita,
       então cliente velho de verdade dura um F5. */
    if(!saveRef){
      throw new HttpsError('failed-precondition',
        'Recarregue a página pra sortear de novo (versão antiga do jogo).');
    }
    const chave = chaveDoTetoDeRessorteio(slot, save.saveGen);
    const usados = ((d.rerollsPorSave || {})[chave]) || 0;
    if(usados >= MAX_RESSORTEIOS_POR_SAVE){
      throw new HttpsError('failed-precondition',
        `Esta jornada já usou os ${MAX_RESSORTEIOS_POR_SAVE} re-sorteios dela.`);
    }
    const custo = precoDoRessorteio(jaFeitos, d.shinyBonusExpiresAt);
    if(moedas < custo){
      throw new HttpsError('failed-precondition',
        `Você tem ${moedas} moeda${moedas===1?'':'s'} — o re-sorteio custa ${custo}.`);
    }
    /* O CONTADOR SOBE NA MESMA TRANSAÇÃO DA COBRANÇA: separados, duas abas passariam pelo teto
       juntas -- o mesmo motivo pelo qual a moeda já está aqui dentro. */
    tx.set(userRef, {
      moedas: admin.firestore.FieldValue.increment(-custo),
      rerollsPorSave: { [chave]: admin.firestore.FieldValue.increment(1) }
    }, { merge: true });
    return { moedas: moedas - custo, custo,
             /* QUANTOS SOBRAM vai na resposta pra a tela não precisar de uma segunda leitura --
                o mesmo desenho do inventário nas respostas da loja. */
             ressorteiosUsados: usados + 1,
             ressorteiosRestantes: MAX_RESSORTEIOS_POR_SAVE - (usados + 1) };
  });
});

/* Espelha o tryEvolve do cliente: sobe a linha enquanto o nível der, e PARA na bifurcação -- ali
   quem escolhe é o jogador (Gloom vira Vileplume ou Bellossom) e aqui não há ninguém pra perguntar.
   Ele fica preso até a próxima distribuição de níveis daquele save, que é onde a tela de escolha
   aparece.
   A VELOCIDADE entra junto com os outros cinco: ela é lida da instância, não da espécie, e esquecê-la
   deixava o pokémon evoluído correndo com a velocidade da forma anterior. */
function evoluirNoSave(mon){
  if(!mon || !mon.speciesId) return mon;
  let atual = mon.speciesId;
  while(EVOLUTIONS[atual] && (mon.level || 0) >= EVOLUTIONS[atual].level){
    if(EVOLUTION_CHOICES[atual]) break;
    atual = EVOLUTIONS[atual].into;
  }
  if(atual === mon.speciesId) return mon;
  const sp = SPECIES[atual];
  if(!sp) return mon;
  return Object.assign({}, mon, { speciesId: atual, name: sp.name, types: sp.types,
    baseHp: sp.hp, attack: sp.attack, defense: sp.defense,
    spAtk: sp.spAtk, spDef: sp.spDef, speed: sp.speed });
}
exports._evoluirNoSave = evoluirNoSave;   // testado direto: no ar ele roda dentro do useRareCandy
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
  /* O DOCE SOBE NÍVEL, E NÍVEL PODE SER O DA EVOLUÇÃO -- e ele não evoluía ninguém. O save é
     escrito aqui, no servidor, e pode nem ser o que está aberto no cliente, então quem tem que
     evoluir é o servidor. Não dá pra deixar pro cliente consertar depois: a repropagação das
     inscrições de liga acontece duas linhas abaixo, e ela levaria a espécie VELHA pra dentro do
     chaveamento. Reportado em 08/09/2026 junto com o mesmo defeito no desmaio e no Bônus de Kanto. */
  time[idx] = evoluirNoSave(time[idx]);
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

/* ⚠️ O HISTÓRICO É UMA CHAMADA SEPARADA, e não veio junto do ranking de propósito (15/09/2026, a
   pedido: *"do lado do titulo Hoje um botão chamado Histórico, quando clicado, exibir como foi o
   ranking do dia nos 5 últimos dias"*).
   O CUSTO É A RAZÃO: cada dia é uma consulta de até 10 documentos, então o histórico inteiro são
   ~50 leituras. Somado ao `getTrainerTowerRanking`, TODO jogador que abrisse a Torre pagaria isso
   -- e a maioria só quer ver o de hoje. Sob demanda, quem paga é quem clica.
   OS DIAS SÃO OS 5 ANTERIORES A HOJE, e não "os 5 últimos incluindo hoje": o de hoje já está na
   aba ao lado, e repeti-lo aqui gastaria uma das cinco linhas dizendo o que a tela já diz.
   A DATA sai do MESMO `trainersLeagueDateStrPlusDays` que o fechamento do dia usa -- uma segunda
   regra de data (a minha, em UTC) discordaria da do jogo em algum fuso, e aí o histórico mostraria
   um dia a mais ou a menos que o ranking. */
const TORRE_DIAS_NO_HISTORICO = 5;
exports.getTrainerTowerHistory = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  await towerRequireTester(request.auth.uid);
  const hoje = trainersLeagueTodayDateStr();
  const dias = [];
  for(let i = 1; i <= TORRE_DIAS_NO_HISTORICO; i++){
    const dateId = trainersLeagueDateStrPlusDays(hoje, -i);
    /* A MESMA consulta do ranking de hoje, no documento daquele dia. Um dia sem ninguém devolve
       lista vazia -- e ele FICA na resposta, com a lista vazia: sumir com o dia faria o histórico
       mostrar cinco datas que não são as cinco últimas, e o jogador leria isso como se tivesse
       havido torre em dias que não houve. */
    const snap = await db.collection('trainerTowerDays').doc(dateId).collection('players')
      .orderBy('bestFloor', 'desc').limit(10).get();
    dias.push({ dateId, linhas: snap.docs.map(d => {
      const x = d.data();
      return { uid: x.uid, name: x.name, bestFloor: x.bestFloor || 0 };
    }) });
  }
  return { dias };
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
/* ⚠️ TODAS AS JANELAS GANHARAM +5s EM 14/09/2026, a pedido ("aumenta 5s de espera para cada
   estágio que hoje já tem um timer"). São QUATRO: a de aceitar a partida, a de escolher o TIME, a
   do pokémon INICIAL e a das trocas do meio da batalha.
   ⚠️ E O BATTLE_ANIM_MS NÃO É UM DELES, de propósito: ele não é tempo de DECISÃO, é a reserva que
   o servidor dá pra a animação rodar antes de a janela começar a contar. Somar 5s ali só faria a
   partida ficar parada -- e o orçamento da animação (ORCAMENTO_ANIM_ONLINE_MS, no cliente) é que
   manda nele. */
const BATTLE_PICK_MS = 10000;            // janela pra trocar de pokémon no meio da batalha (era 5s)
/* A escolha do INICIAL tem janela maior: é a única decisão feita com os dois times inteiros de
   pé, olhando 6 contra 6. As trocas do meio da batalha são mais simples -- sobram poucos vivos e
   a urgência faz parte. */
const BATTLE_FIRST_PICK_MS = 15000;      // era 10s
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
const BATTLE_ACCEPT_MS = 20000;   // era 15s (ver o +5s de 14/09/2026)

/* Janela pra ESCOLHER O TIME -- com os dois treinadores JÁ conectados.
   Antes o time era escolhido antes de entrar na fila, e a pessoa ficava presa àquele time por
   minutos esperando um oponente que talvez nem aparecesse. Agora o cliente manda TODOS os times
   elegíveis ao entrar na fila (ou no lobby) e escolhe UM POR ÍNDICE quando a partida já existe.
   Mandar a lista inteira lá atrás é o que permite ter um padrão: se o jogador não escolher (ou
   fechar a aba), o servidor entra com o primeiro da lista sozinho -- ele não tem os times salvos,
   só o que o cliente enviou. */
const BATTLE_TEAM_PICK_MS = 20000;   // era 15s (ver o +5s de 14/09/2026)
/* MESMO TETO DE SAVES DO CLIENTE (MAX_SAVE_SLOTS). Tem que acompanhar: o cliente manda todos os
   times elegíveis e depois escolhe por ÍNDICE nessa lista -- se o servidor cortar em 10, quem tem
   time no slot 12 nunca consegue escolhê-lo, e a lista que a tela desenha (que vem daqui) some com
   ele sem explicação. */
const MAX_BATTLE_CODES = 20;

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
function battleInstances(code, ataques){
  const time = decodeTeamCode(code);
  if(!time) return null;
  return time.map((p, i)=>{
    const inst = createInstance(p.speciesId, p.level);
    inst.shiny = !!p.shiny;
    inst.maxHp = calcMaxHp(inst);
    inst.hp = inst.maxHp;
    /* ⚠️ VALIDADO AQUI, UMA VEZ, e guardado já limpo no estado -- não a cada confronto. O estado da
       batalha é reescrito a cada resolução; validar na entrada é o que impede um golpe forjado de
       ser re-aceito de graça na volta seguinte. */
    const bons = golpesValidos(inst.speciesId, inst.level, ataques && ataques[chaveDosGolpes(inst)]);
    return { speciesId: inst.speciesId, name: inst.name, level: inst.level,
             shiny: !!inst.shiny, hp: inst.hp, maxHp: inst.maxHp,
             ataques: bons.length ? bons : null };
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
/* ⚠️ OS GOLPES DE CADA TIME ELEGÍVEL, EM LOCKSTEP COM O `battleCodes` (16/09/2026) -- e o lockstep
   é a coisa toda: a escolha do time é um ÍNDICE na lista de códigos, e o `battleCodes` DESCARTA
   código inválido. Filtrada por conta própria, a lista de golpes sairia deslocada e cada time
   lutaria com o moveset de outro -- um defeito que não aparece como erro, aparece como um Snorlax
   batendo de Raio Solar.
   Por isso ela roda o MESMO laço, com o MESMO critério de descarte, e o que ela guarda é a posição
   no array ORIGINAL. Os golpes em si só são validados depois, no `battleInstances`, onde a espécie
   e o nível de cada um já são conhecidos. */
function battleAtaques(data){
  const bruto = Array.isArray(data?.codes) ? data.codes : (data?.code ? [data.code] : []);
  const ataques = Array.isArray(data?.ataques) ? data.ataques : [];
  const out = [];
  for(let i = 0; i < bruto.slice(0, MAX_BATTLE_CODES).length; i++){
    const s = String(bruto[i] || '');
    if(!s) continue;
    const time = decodeTeamCode(s);
    if(!time || !time.length) continue;
    out.push((ataques[i] && typeof ataques[i] === 'object') ? ataques[i] : null);
  }
  return out;
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
  /* ⚠️ OS GOLPES VOLTAM AQUI (16/09/2026). O `createInstance` não copia campo nenhum, e este é o
     ponto por onde o pokémon do online renasce a CADA confronto -- sem esta linha ele lutaria no
     motor de tipo, que é o que a batalha online fazia até hoje.
     Eles já vêm validados do `battleInstances`: o que está guardado no estado é o que o servidor
     aceitou, não o que o cliente mandou. */
  if(Array.isArray(guardado.ataques) && guardado.ataques.length) inst.ataques = guardado.ataques.slice();
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
  /* ⚠️ A CHUVA DURA 3 CONFRONTOS NO ONLINE TAMBÉM, desde 14/09/2026 -- e até então ela durava UM.
     O comentário aqui dizia que "a batalha online não tem clima" e que ela não era sorteada. Isso
     era FALSO desde que a Dança da Chuva entrou: o sorteio mora no `tentarGolpeEspecial`, que é
     chamado pelo `doExchange`, que o online usa igual à jornada. Medido: ela saía em 10,3% dos
     confrontos. O que não existia era a DURAÇÃO -- o `limparClima()` daqui zerava o contador antes
     de cada confronto, então o efeito de 3 confrontos morria no primeiro.
     ⚠️ E ZERAR CONTINUA SENDO OBRIGATÓRIO, por outro motivo: o `chuvaRestante` é módulo-level e no
     servidor a INSTÂNCIA é reaproveitada entre invocações. Um `simulateGymBattle` (Torre, ginásio
     da cidade) que acabe com chuva sobrando deixaria o contador positivo, e o próximo confronto
     online sairia debaixo da chuva de OUTRA PESSOA. Por isso o clima vem do ESTADO da partida e
     não do que sobrou na memória: `definirClima` põe o desta batalha, e o que sobrar volta pro
     documento no fim. */
  definirClima(estado.chuva || 0);
  const a = battleHydrate(estado.aTeam[estado.aCurrent]);
  const b = battleHydrate(estado.bTeam[estado.bCurrent]);
  applySpecialtyBuff([a], estado.aSpecialties);
  applySpecialtyBuff([b], estado.bSpecialties);
  const aHpAntes = a.hp, bHpAntes = b.hp;
  const aVivosAntes = estado.aTeam.filter(p=>p.hp>0).length;
  const bVivosAntes = estado.bTeam.filter(p=>p.hp>0).length;
  const diario = [];
  while(a.hp>0 && b.hp>0){ doExchange(a, b, rng, diario); }
  /* Grava o HP de volta no estado, APARADO NO TETO GUARDADO.
     ⚠️ A FÚRIA sobe o `maxHp` da instância e a vida junto, mas quem volta pro estado é só o `hp`
     -- o `maxHp` guardado continua sendo o limpo, e o `battleHydrate` do confronto seguinte o
     usa de novo. Sem o aparo o pokémon reentrava com `hp` ACIMA do próprio teto: barra passando
     de 100% e até +10 de vida de graça por confronto em que ele entrou em fúria e sobreviveu.
     É a mesma família do defeito que o `encerrarBatalha` fechou na jornada, por outro caminho --
     aqui não dá pra chamar ele: o diário deste confronto já contou a subida da barra, e devolver
     o empréstimo antes de responder faria a soma do log não fechar com o `playerHpAfter`. */
  /* O QUE SOBROU DA CHUVA VOLTA PRO DOCUMENTO. O `doExchange` não decrementa -- quem conta
     confronto é o laço da batalha (no `simulateGymBattle` isso fica no fim de cada confronto), e
     aqui o laço é o próprio servidor, uma invocação por confronto. */
  estado.chuva = Math.max(0, climaRestante() - 1);
  const tetoA = estado.aTeam[estado.aCurrent].maxHp || a.maxHp;
  const tetoB = estado.bTeam[estado.bCurrent].maxHp || b.maxHp;
  estado.aTeam[estado.aCurrent].hp = Math.max(0, Math.min(tetoA, a.hp));
  estado.bTeam[estado.bCurrent].hp = Math.max(0, Math.min(tetoB, b.hp));
  const aCaiu = a.hp<=0, bCaiu = b.hp<=0;
  return {
    /* a FÚRIA viaja aqui pelo mesmo motivo da jornada: o selo da tela precisa saber quem está
       furioso, e a marca do diário diz só o confronto em que ela entrou */
    playerFuria: a._furia || 0, enemyFuria: b._furia || 0,
    playerQueimado: !!a._queimado, enemyQueimado: !!b._queimado,
    playerEnvenenado: !!a._envenenado, enemyEnvenenado: !!b._envenenado,
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
    playerMoveId: a.lastMove || null, enemyMoveId: b.lastMove || null,
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
    /* ⚠️ A LISTA DE GOLPES É PARALELA À DE CÓDIGOS, e indexada pelo MESMO índice: a escolha do time
       é um índice na lista de códigos, então os golpes precisam estar na mesma posição. Cliente que
       não mande a lista (versão antiga em cache) cai no motor de tipo, como antes. */
    const montar = (codes, idx, ataques) => {
      const lista = codes || [];
      const i = (Number.isInteger(idx) && idx >= 0 && idx < lista.length) ? idx : 0;
      return battleInstances(lista[i], (ataques || [])[i]) || [];
    };
    estado.aTeam = montar(estado.aCodes, estado.aTeamChoice, estado.aAtaques);
    estado.bTeam = montar(estado.bCodes, estado.bTeamChoice, estado.bAtaques);
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
    /* As especialidades dos DOIS lados vão junto. O buff já era aplicado aqui no servidor
       (applySpecialtyBuff no confronto), mas a tela desenhava o time a partir do estado e não
       tinha como saber quem estava com o bônus -- então o selo não aparecia na única batalha em
       que o adversário é outro jogador de verdade. */
    eu: { nome: souA ? estado.a.name : estado.b.name, time: meu, atual: souA ? estado.aCurrent : estado.bCurrent,
          especialidades: (souA ? estado.aSpecialties : estado.bSpecialties) || [] },
    oponente: { nome: souA ? estado.b.name : estado.a.name, time: dele, atual: souA ? estado.bCurrent : estado.aCurrent,
                especialidades: (souA ? estado.bSpecialties : estado.aSpecialties) || [] },
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
  const ataquesDosTimes = battleAtaques(request.data);

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  await touchLastSeen(uid, userData);
  const eu = { uid, name: userData.trainerName || 'Treinador', codes,
               ataques: ataquesDosTimes,
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
    /* os golpes escolhidos de cada time elegível, na MESMA ordem dos códigos -- ver montar() */
    aAtaques: aSide.ataques || [], bAtaques: bSide.ataques || [],
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
      /* os `ataques` vem junto dos `codes` porque os dois lados saem do MESMO documento da fila --
         e sem eles aqui o desafio do lobby seria a unica porta do online sem golpe escolhido, que e
         exatamente o tipo de exceao onde a proxima omissao se esconde (ja aconteceu com specialties) */
      a: { uid, name: eu.name, codes: eu.codes||[], ataques: eu.ataques||[], specialties: eu.specialties||[], stats: eu.stats||null },
      b: { uid: alvo, name: alvoDados.name, codes: alvoDados.codes||[], ataques: alvoDados.ataques||[], specialties: alvoDados.specialties||[], stats: alvoDados.stats||null },
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
/* ============================================================================
   PAINEL DE TREINADORES (12/09/2026, a pedido: *"uma pagina onde eu consiga ver todos os
   treinadores online, e tambem os offline, os saves e como ta o time de cada save"*).

   ⚠️ POR QUE ISTO E UMA CLOUD FUNCTION E NAO UMA PAGINA LENDO O FIRESTORE: a regra do
   `/users/{userId}` deixa ler SO o proprio documento (`request.auth.uid == userId`), e os saves
   herdam isso. Nao existe consulta de cliente que veja a conta de outro -- e afrouxar a regra pra
   isso seria abrir o save de todo mundo pra qualquer jogador logado, que e o oposto do que ela
   protege. O Admin SDK ignora as regras; entao quem le e o servidor, com a porta na mao.

   ⚠️ A PORTA E UM CAMPO QUE O CLIENTE NAO ESCREVE (`users/{uid}.admin === true`), e ela NAO podia
   ser um segredo no codigo: o `firebase.json` publica a RAIZ do repositorio, entao este arquivo
   esta baixavel em jornadakanto.com/functions/index.js. Qualquer lista de uid ou e-mail aqui seria
   publica -- e um `userTest` da vida nao serve porque ele E livre pro dono (a trava de campos das
   regras nao o cobre). O `admin` entrou nessa trava junto com esta funcao: so o console do Firebase
   escreve nele.

   ⚠️ CUSTO: e 1 leitura por treinador MAIS 1 por save dele. Com 20 por pagina e ~3 saves cada, sao
   ~80 leituras por pagina -- por isso ele e PAGINADO e nao devolve a conta inteira de uma vez. O
   cursor e o id do documento, que e o uid: a ordenacao por documentId e a unica que nao precisa de
   indice nem de campo que todo mundo tenha.
   ============================================================================ */
const ADMIN_PAGINA = 20;              // treinadores por pagina
const ADMIN_PAGINA_MAX = 60;
/* ONLINE = visto nos ultimos 10 minutos. O numero NAO e escolhido aqui: e o mesmo do
   `vistoPorUltimo` do jogo, que e o que o jogador ja le na lista de amigos ("agora ha pouco").
   O carimbo tem folga de 5 min (LAST_SEEN_THROTTLE_MS), entao qualquer janela menor que isso
   mostraria gente offline que esta jogando. */
const ADMIN_ONLINE_MS = 10 * 60 * 1000;
/* Teto do bloco de quem está online. Ele não é uma página: é o bloco INTEIRO que vem na frente, e
   cada treinador nele custa uma leitura mais uma por save dele. 50 é folgado pro tamanho do jogo
   (56 contas hoje) e evita uma primeira página gigante num dia de pico. Estourando, a resposta
   avisa (`onlineTruncado`) em vez de mentir uma contagem. */
const ADMIN_ONLINE_MAX = 50;
/* Quantas vezes a busca da página pode repetir pra encher a página depois de tirar os repetidos.
   Sem teto, uma coleção só de gente online rodaria o laço até o fim da coleção numa chamada só. */
const ADMIN_VOLTAS_MAX = 6;
/* O TIME SAI RESUMIDO, e de proposito: a tela quer NOME, nivel e tipo -- o save guarda a instancia
   inteira (seis atributos, golpes, item, HP), e mandar isso de 20 treinadores x N saves x 6 pokemon
   seria um payload enorme pra desenhar seis etiquetas. O nome e os tipos saem do SPECIES daqui, que
   e o mesmo do jogo: assim a pagina nao precisa carregar tabela nenhuma. */
/* Os GOLPES saem com o nome em portugues -- o GOLPES_PT ja vive aqui desde que o moveset dos NPCs
   entrou (o time do treinador da Torre e montado no servidor). Golpe sem nome na tabela sai com o
   id, que e o mesmo comportamento do log do jogo. */
function adminGolpes(ataques){
  if(!Array.isArray(ataques)) return [];
  return ataques.map(id => {
    const g = GOLPES[id];
    return { id, nome: GOLPES_PT[id] || id, tipo: g ? g[0] : null, poder: g ? g[1] : null };
  });
}
function adminResumoDoTime(team){
  if(!Array.isArray(team)) return [];
  return team.map(p => {
    const esp = SPECIES[p && p.speciesId] || null;
    return {
      especie: (p && p.speciesId) || '?',
      nome: esp ? esp.name : ((p && p.speciesId) || '?'),
      tipos: esp ? esp.types : [],
      nivel: (p && p.level) || 0,
      shiny: !!(p && p.shiny),
      hp: (p && p.hp != null) ? p.hp : null,
      maxHp: (p && p.maxHp != null) ? p.maxHp : null,
      item: (p && p.item) || null,
      golpes: adminGolpes(p && p.ataques)
    };
  });
}
/* O SAVE TAMBEM SAI RESUMIDO -- o documento tem dezenas de campos de estado de tela (wildOffer,
   routeCards, battleResult) que nao dizem nada sobre "como esta o time". */
/* ⚠️ ONDE A JORNADA ESTA e a parte que responde "o que esta acontecendo" -- e nao cabia so no
   numero de insignias. O `screen` diz em que tela o jogador parou, o `gymIndex` em que trecho ele
   esta, o `losses` quantas derrotas ele ja tem NAQUELE ginasio (o limite e 5 e zera a cada
   vitoria), e o `eliteStage` onde ele parou na Elite. */
function adminResumoDoSave(slot, s){
  return {
    slot,
    nome: (s && s.trainerName) || '',
    rival: (s && s.rivalName) || '',
    insignias: (s && s.badgeCount) || 0,
    insigniasNomes: (s && Array.isArray(s.badgesEarned)) ? s.badgesEarned : [],
    modo: (s && s.gameMode) || 'normal',
    campeao: !!(s && s.eliteStatus === 'champion'),
    tela: (s && s.screen) || '',
    trecho: (s && s.gymIndex != null) ? s.gymIndex : null,
    rota: (s && s.currentRoute) || null,
    caminho: (s && Array.isArray(s.gymPath)) ? s.gymPath : [],
    derrotas: (s && s.losses) || 0,
    eliteEtapa: (s && s.eliteStage != null) ? s.eliteStage : null,
    eliteTentativas: (s && s.eliteAttemptsUsed) || 0,
    rocket: (s && s.hideoutStage) || 0,
    capturados: (s && Array.isArray(s.caughtSpecies)) ? s.caughtSpecies.length : 0,
    atualizado: (s && s.updatedAt) || 0,
    time: adminResumoDoTime(s && s.team)
  };
}
exports.adminListTrainers = onCall(async (request) => {
  if(!request.auth){ throw new HttpsError('unauthenticated', 'Login necessário.'); }
  const uid = request.auth.uid;
  const eu = await db.collection('users').doc(uid).get();
  /* A RECUSA NAO DIZ O QUE FALTA. Quem nao e admin nao precisa saber que existe um campo `admin`
     -- e quem e, ja sabe. */
  if(!eu.exists || eu.data().admin !== true){
    throw new HttpsError('permission-denied', 'Esta página é só para administradores.');
  }
  const pedido = (request.data && request.data.limite) || ADMIN_PAGINA;
  const limite = Math.max(1, Math.min(ADMIN_PAGINA_MAX, pedido));
  const cursor = (request.data && request.data.cursor) || null;
  /* ⚠️ LÊ UM A MAIS SÓ PRA SABER SE HÁ PRÓXIMA. Sem isso, a última página cheia oferecia um
     cursor que levava a uma página VAZIA -- e a tela mostrava um "carregar mais" que não carrega
     nada. O documento extra é descartado; ele custa 1 leitura por página e é a única forma de a
     resposta ser honesta sobre o que vem depois. */
  const agora = Date.now();
  /* ⚠️ QUEM ESTÁ ONLINE VEM SEMPRE NA FRENTE, e não só "ordenado primeiro" -- essa era a diferença
     que fazia a página mentir. A paginação é por UID, e quem está jogando agora está espalhado por
     essa ordem: com 20 por vez, um treinador online com uid no fim do alfabeto só aparecia depois
     de o admin clicar "carregar mais" algumas vezes, e a tela dizia "1 online" com 4 jogando.
     Reportado em 13/09/2026: *"hoje tem gente online mas só carrega 20 ... dessas que carregou
     mais, tinha gente online porém eu só conseguia ver se eu clicasse no carregar mais"*.
     Agora quem está online sai de uma consulta PRÓPRIA, e ela é a primeira coisa da lista.
     O `where` + `orderBy` são no MESMO campo, então o índice de campo único que o Firestore cria
     sozinho já serve -- não há índice composto pra criar. Quem não tem `lastSeenAt` não casa com a
     desigualdade, que é o certo: nunca visto é offline.
     NAS PÁGINAS SEGUINTES ela roda em `select()` (só os ids): ali ela não serve pra mostrar
     ninguém, serve pra o mesmo treinador não aparecer duas vezes.
     Ela vai num try/catch pelo mesmo motivo dos ginásios liderados: uma consulta de enfeite não
     pode derrubar a lista inteira. Falhando, a página volta a ser o que era. */
  let onlineDocs = [], onlineTruncado = false, listouOnline = false;
  let uidsOnline = new Set();
  try{
    let qo = db.collection('users')
      .where('lastSeenAt', '>=', agora - ADMIN_ONLINE_MS)
      .orderBy('lastSeenAt', 'desc')
      .limit(ADMIN_ONLINE_MAX + 1);
    if(cursor){ qo = qo.select(); }
    const on = await qo.get();
    onlineTruncado = on.docs.length > ADMIN_ONLINE_MAX;
    onlineDocs = on.docs.slice(0, ADMIN_ONLINE_MAX);
    uidsOnline = new Set(onlineDocs.map(d => d.id));
    listouOnline = true;
  } catch(e){ logger.warn('adminListTrainers: nao deu pra listar quem esta online', e); }

  /* ⚠️ A PÁGINA SE ENCHE MESMO DEPOIS DE TIRAR OS REPETIDOS. Quem já veio no bloco de online não
     aparece de novo aqui -- e tirá-los da fatia deixava a página curta E, no pior caso, VAZIA: a
     última fatia podia ser só de gente online, e aí a tela oferecia um "Carregar mais" que não
     carregava nada. É o mesmo defeito que o `limite + 1` existe pra evitar, por outra porta.
     Então ela busca de novo enquanto sobrar espaço e houver banco. O teto de voltas está aí pra
     uma coleção só de gente online não virar uma varredura inteira numa chamada só.
     O CURSOR É O ÚLTIMO DOCUMENTO **MOSTRADO**: a próxima página relê os online que ficaram no meio
     e os filtra de novo (algumas leituras a mais), o que é o lado certo pra errar -- com o cursor
     adiantado, uma conta offline no meio sumiria da lista sem ninguém ver. */
  const daPagina = [];
  let ultimo = cursor, temMais = false;
  for(let volta = 0; volta < ADMIN_VOLTAS_MAX; volta++){
    let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(limite + 1);
    if(ultimo){ q = q.startAfter(ultimo); }
    const bruto = await q.get();
    const fatia = bruto.docs.slice(0, limite);
    temMais = bruto.docs.length > limite;
    if(!fatia.length){ temMais = false; break; }
    ultimo = fatia[fatia.length - 1].id;
    fatia.forEach(d => { if(!uidsOnline.has(d.id)) daPagina.push(d); });
    if(daPagina.length >= limite || !temMais) break;
  }
  if(daPagina.length > limite){
    ultimo = daPagina[limite - 1].id;   // o corte vira o cursor
    daPagina.length = limite;
    temMais = true;
  }
  const snap = { docs: (cursor ? [] : onlineDocs).concat(daPagina) };
  /* OS SAVES DE CADA UM EM PARALELO: sao N coleções independentes, e em série a página de 20
     esperaria 20 idas ao banco uma atrás da outra. */
  const treinadores = await Promise.all(snap.docs.map(async doc => {
    const d = doc.data() || {};
    const saves = await db.collection('users').doc(doc.id).collection('saves').get();
    const lista = saves.docs
      .map(sd => ({ slot: parseInt(sd.id, 10), dados: sd.data() }))
      .filter(x => Number.isInteger(x.slot))
      /* ORDEM NUMERICA DO SLOT. O Firestore devolve por id em ordem de TEXTO, então o "10" vem
         entre o "1" e o "2" -- a mesma armadilha que ja mordeu a Trainers League. */
      .sort((a, b) => a.slot - b.slot)
      .map(x => adminResumoDoSave(x.slot, x.dados));
    const visto = d.lastSeenAt || 0;
    /* ⚠️ A CONTA INTEIRA, e nao so o nome: *"quero saber tudo o que esta acontecendo na conta dos
       outros treinadores"* (13/09/2026). O que nao entra aqui e o que nao diz nada sobre o jogador
       -- o `startersSorteados` e o `geracaoDosSlots` sao tranca anti save-scumming, e a
       `leagueLeaderboard` e uma copia do ranking que a propria tela do jogo ja mostra. */
    const inv = d.inventario || {};
    return {
      uid: doc.id,
      nome: d.trainerName || '',
      visto,
      online: visto > 0 && (agora - visto) < ADMIN_ONLINE_MS,
      moedas: d.moedas || 0,
      doces: d.rareCandies || 0,
      /* O inventario vem como lista de pares pra a tela nao precisar iterar objeto -- e com o
         ZERO fora: o `increment` deixa a chave com 0 quando o item acaba, e um "0x Poção" na tela
         seria ruido. */
      itens: Object.keys(inv).filter(k => (inv[k] || 0) > 0).map(k => ({ item: k, qtd: inv[k] })),
      equipados: Object.keys(d.equipados || {}).map(k => ({ chave: k, item: d.equipados[k] })),
      hms: Array.isArray(d.hms) ? d.hms : [],
      pokedex: Array.isArray(d.permanentPokedex) ? d.permanentPokedex.length : 0,
      shinyDex: Array.isArray(d.permanentShinyDex) ? d.permanentShinyDex.length : 0,
      especialidades: Array.isArray(d.specialties) ? d.specialties : [],
      ligas: d.leagueWinsTotal || 0,
      sequencia: d.trainerBestStreak || 0,
      campeao: !!d.accountEliteChampion,
      bonusShinyAte: d.shinyBonusExpiresAt || 0,
      mewtwo: { emprestado: !!d.mewtwoLoanActive, liberado: !!d.mewtwoLoanUnlocked,
                esperaAte: d.mewtwoLoanCooldownUntil || 0, aResgatar: !!d.mewtwoLoanReadyToClaim },
      cidade: (d.neighborhoodGymLocation && d.neighborhoodGymLocation.city) || '',
      admin: d.admin === true,
      ginasios: [],   // preenchido abaixo, numa consulta so pra pagina inteira
      saves: lista
    };
  }));
  /* ONLINE PRIMEIRO, e depois pelo visto por ultimo -- que e a ordem em que a pergunta é feita
     ("quem está jogando agora?"). O cursor continua sendo o do BANCO (por uid): ordenar aqui é só
     apresentação, e ordenar no banco exigiria índice e um campo que todo documento tenha. */
  /* ⚠️ OS GINASIOS DA CIDADE EM UMA CONSULTA SO pra a pagina inteira, e nao uma por treinador: com
     20 por pagina seriam 20 idas ao banco pra uma informacao de uma linha. O `in` do Firestore
     aceita ate 30 valores, e a pagina tem no maximo ADMIN_PAGINA_MAX... por isso ele e fatiado em
     blocos de 30. Liderar e do jogo ("quem manda em que cidade") e nao daria pra deduzir do save:
     a defesa e um codigo CONGELADO, nao o time atual. */
  const porUid = Object.fromEntries(treinadores.map(t => [t.uid, t]));
  const uids = treinadores.map(t => t.uid);
  for(let i = 0; i < uids.length; i += 30){
    const bloco = uids.slice(i, i + 30);
    if(!bloco.length) continue;
    try{
      const gsnap = await db.collection('neighborhoodGyms').where('leaderUid', 'in', bloco).get();
      gsnap.forEach(g => {
        const dg = g.data() || {};
        const dono = porUid[dg.leaderUid];
        if(dono) dono.ginasios.push({ id: g.id, cidade: dg.city || g.id, terreno: dg.terrain || null });
      });
    }catch(e){
      /* ⚠️ O PAINEL NAO PODE CAIR POR CAUSA DISTO. A consulta precisa de indice em `leaderUid`, e
         se ele nao existir a lista inteira de treinadores viria vazia por causa de uma linha de
         enfeite -- a mesma regra do "nenhuma tela pode ficar Carregando pra sempre". */
      logger.warn('adminListTrainers: nao deu pra ler os ginasios', e);
    }
  }
  /* ONLINE PRIMEIRO E DEPOIS PELO VISTO POR ÚLTIMO. O `online` é explícito na comparação (e não
     deduzido do `visto`) porque a janela é o que define os dois grupos: sem ele, um treinador visto
     há 10min01s empataria visualmente com um visto há 9min59s, e são coisas diferentes na tela. */
  treinadores.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || (b.visto || 0) - (a.visto || 0));
  return {
    agora,
    /* A CONTAGEM É A DE VERDADE, não a da página: ela sai da consulta dos online, que varre a
       coleção inteira. Antes ela contava só o que tinha sido carregado -- e era isso que fazia a
       tela dizer "1 online" numa hora em que havia mais. Se a consulta falhou, cai no que dá pra
       afirmar (a página). */
    online: listouOnline ? uidsOnline.size : treinadores.filter(t => t.online).length,
    onlineTruncado,
    total: treinadores.length,
    janelaOnlineMs: ADMIN_ONLINE_MS,
    proximo: temMais ? ultimo : null,
    treinadores
  };
});

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
    from: { uid, name: meuNome, codes, ataques: battleAtaques(request.data),
            specialties: meuDados.specialties || [], stats: battleStatsFrom(meuDados) },
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
    codes, ataques: battleAtaques(request.data),
    specialties: meuDados.specialties || [], stats: battleStatsFrom(meuDados)
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
/* ⚠️ A VELOCIDADE DO CHEFE É UM DIAL, e ela passou a PRECISAR de um em 20/09/2026, quando a
   velocidade do jogo passou a escalar com o nível (a fórmula da Gen 3, ver `effectiveSpeed`).

   O NÍVEL 4999 NUNCA FOI UMA AFIRMAÇÃO SOBRE O BICHO: ele é o dial que dá os 25.125 de HP e que
   divide o dano por ataque. Enquanto a velocidade não escalava, isso não tinha efeito nenhum sobre
   ela -- o chefe ficava com os 100 crus da espécie, e os pokémon rápidos do time batiam antes dele.

   ⚠️ COM A ESCALA, O MESMO 4999 DAVA VELOCIDADE 10.003 -- mais que o jogo inteiro somado. Medido:
   o Mew matava os SEIS antes de qualquer um agir, e uma investida tirava **ZERO** de dano. A raide
   ficava matematicamente inganhável, e em silêncio: nada dá erro, o ataque só não machuca.

   ⚠️ E NÃO HÁ DIAL QUE REPRODUZA A CALIBRAGEM ANTIGA, porque a velocidade do TIME também mudou:
   um Jolteon Lv.70 era 130 e virou 187. O que este dial faz é pôr o chefe de volta numa faixa em
   que a luta acontece -- ele se comporta como um Mew de nível `BOSS_SPEED_COMO_NIVEL`.
   ⚠️ A RAIDE CONTINUA DESCALIBRADA, e isso é anterior a esta linha: desde 15/09/2026, quando o
   golpe moribundo acabou, ela já precisava de recalibragem (o CLAUDE.md registra 3,2× mais lenta).
   Ela está DESLIGADA (`BOSS_ATIVO`) e precisa ser recalibrada antes de voltar -- este dial impede
   que ela volte INGANHÁVEL, não a conserta.

   ⚠️ ELE FICA FORA DO `BOSS_BASE` de propósito: aquele objeto são os atributos OFICIAIS do Mew
   (100 em tudo, Gen 2), e sobrescrever a velocidade lá faria a tabela mentir sobre a espécie. */
const BOSS_SPEED_COMO_NIVEL = 50;
const BOSS_SPEED_DIAL = Math.max(1, Math.round(100 * BOSS_SPEED_COMO_NIVEL / BOSS_LEVEL));
function bossInstance(hpAtual){
  return Object.assign({ id:'boss-mew', speciesId:BOSS_ID, name:'Mew', types:['Psychic'],
                         level:BOSS_LEVEL, maxHp:BOSS_MAX_HP, hp:hpAtual, shiny:false },
                       BOSS_BASE, { speed: BOSS_SPEED_DIAL });
}
function bossDocRef(){ return db.collection('globalBoss').doc(BOSS_ID); }
function bossPlayerRef(uid){ return bossDocRef().collection('players').doc(uid); }
function bossEstadoInicial(){
  return { hp: BOSS_MAX_HP, maxHp: BOSS_MAX_HP, level: BOSS_LEVEL, golpes: 0, batalhas: 0,
           danoTotal: 0, derrotadoEm: null, criadoEm: Date.now() };
}
/* Devolve os dados da conta -- o nome vem junto porque o ranking precisa dele, e ler o documento
   duas vezes na mesma chamada seria desperdicio. */
/* ⚠️ O EVENTO ESTA DESATIVADO desde 13/09/2026, a pedido ("estou pensando numa nova mecanica para
   ele"). E AQUI que ele fecha de verdade: o estado da raide e GLOBAL -- um unico ataque que passe
   mexe na barra que o jogo inteiro ve --, e o cliente sozinho nao fecha nada, porque uma aba
   ABERTA continua com o jogo velho e o console esta sempre ali.
   E uma PAUSA, nao um fim: a raide inteira continua de pe (o Mew, o ranking, o premio do top 10).
   Religar e esta linha mais o BOSS_DE_DOMINGO_ATIVO do cliente. */
/* `let` e nao `const` por causa do TESTE: a raide continua inteira aqui, e a suite dela precisa
   exercitar os dois lados -- que ela RECUSA desligada, e que a mecanica continua certa ligada.
   Quem liga e so o `_boss` la embaixo; nada do jogo escreve neste flag. */
let BOSS_ATIVO = false;
function bossExigeAtivo(){
  if(!BOSS_ATIVO){ throw new HttpsError('failed-precondition', 'O Boss de Domingo está desativado no momento.'); }
}
async function bossRequireTester(uid){
  bossExigeAtivo();
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
function simulateBossFight(team, boss, opts){
  /* A FÚRIA zera aqui pelo mesmo motivo que zera no simulateGymBattle: o acúmulo é por BATALHA. Na
     raide o time é montado do save a cada ataque e não haveria o que vazar, mas a porta sem a linha
     é onde a próxima omissão se esconde. Vem ANTES do calcMaxHp, senão o teto nasceria inflado. */
  team.forEach(p => { p._furia = 0; p.maxHp = calcMaxHp(p); p.hp = p.maxHp; });
  /* Mesma lista do simulateGymBattle, zerada por batalha. */
  itensGastos = [];
  /* A RAIDE NÃO TEM CLIMA, e zerar aqui não é firula: o `chuvaRestante` é módulo-level e a
     batalha anterior pode ter acabado com confrontos de chuva SOBRANDO (a chuva dura 3 e a luta
     pode terminar no primeiro). Sem este zero, o ataque seguinte à raide sairia debaixo da chuva
     da batalha de outra pessoa -- e a raide é calibrada em ~399 ataques, com o Mew imune ao bloco
     inteiro de especiais justamente pra ninguém a derrubar de graça.
     Ou seja: aqui não se SORTEIA chuva, e a que sobrou de fora é apagada. */
  limparClima();
  const matchups = [];
  let playerStreak = 0, enemyStreak = 0;
  const hpInicialDoBoss = boss.hp;
  while(boss.hp > 0){
    const vivos = team.filter(p => p.hp > 0);
    if(!vivos.length) break;                     // time acabou: o Mew fica com a vida que sobrou
    const active = vivos[0];
    anotarItemDeAtributo(active, 'p');   // vale na raide também: entrou, gastou
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
      playerMoveId: active.lastMove || null, enemyMoveId: boss.lastMove || null,
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

  /* A ESPECIALIDADE VALE AQUI TAMBÉM. A raide era a única batalha do jogo que não aplicava o buff
     -- o shiny valia (a flag vem na instância), a especialidade não. Ninguém tinha como notar:
     ela valia 1% e não aparecia em lugar nenhum. Conferido em 02/09/2026, ao subir pra 5%. */
  applySpecialtyBuff(time, conta.specialties || []);
  /* O Despertar vale aqui também -- o Mew dorme como qualquer um. A poção NÃO: a raide é um
     ataque só, sem confronto seguinte pra o pokémon curado aproveitar, e gastar o item nisso seria
     jogá-lo fora sem o jogador entender por quê. */
  const equipadosDaRaide = equipadosDaConta(conta);
  const antes = estado.hp;
  const boss = bossInstance(antes);
  equiparItens(time, equipadosDaRaide, slot);
  const luta = simulateBossFight(time, boss);
  /* O que o Despertar segurou sai da conta. A raide nao usa pocao -- ela e um ataque so, sem
     confronto seguinte pra o curado aproveitar --, mas gastar pelo que o motor ANOTOU vale pros
     dois: se um dia a pocao entrar aqui, nao ha nada pra lembrar de mudar. */
  const gastosDaRaide = itensGastosDaBatalha().slice();

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

  await gastarItensEquipados(uid, gastosDaRaide);
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
/* As duas contas de data saem daqui pro teste porque ele precisa falar do MESMO "hoje" que o cron:
   o dia do jogo vira a meia-noite de Sao Paulo, nao a do relogio de quem roda o teste. */
exports._trainersLeagueTodayDateStr = trainersLeagueTodayDateStr;
exports._trainersLeagueDateStrPlusDays = trainersLeagueDateStrPlusDays;
