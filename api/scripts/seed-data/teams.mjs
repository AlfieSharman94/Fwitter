// Reference clubs grouped by competition. Names match football-data.org short names
// where possible so the fixtures sync links them automatically. Memberships are the
// 2025-26 season (2025 for calendar-year leagues); promotion and relegation only
// change the `league` label, never remove a club.
export const leagues = [
  // ---- England ------------------------------------------------------------
  { country: "England", league: "Premier League", teams: [
    "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton & Hove Albion", "Burnley", "Chelsea", "Crystal Palace",
    "Everton", "Fulham", "Leeds United", "Liverpool", "Manchester City", "Manchester United", "Newcastle United",
    "Nottingham Forest", "Sunderland", "Tottenham Hotspur", "West Ham United", "Wolverhampton Wanderers",
  ] },
  { country: "England", league: "Championship", teams: [
    "Birmingham City", "Blackburn Rovers", "Bristol City", "Charlton Athletic", "Coventry City", "Derby County", "Hull City",
    "Ipswich Town", "Leicester City", "Middlesbrough", "Millwall", "Norwich City", "Oxford United", "Portsmouth",
    "Preston North End", "Queens Park Rangers", "Sheffield United", "Sheffield Wednesday", "Southampton", "Stoke City",
    "Swansea City", "Watford", "West Bromwich Albion", "Wrexham",
  ] },
  { country: "England", league: "League One", teams: [
    "AFC Wimbledon", "Barnsley", "Blackpool", "Bolton Wanderers", "Bradford City", "Burton Albion", "Cardiff City",
    "Doncaster Rovers", "Exeter City", "Huddersfield Town", "Leyton Orient", "Lincoln City", "Luton Town", "Mansfield Town",
    "Northampton Town", "Peterborough United", "Plymouth Argyle", "Port Vale", "Reading", "Rotherham United", "Stevenage",
    "Stockport County", "Wigan Athletic", "Wycombe Wanderers",
  ] },
  { country: "England", league: "League Two", teams: [
    "Accrington Stanley", "Barnet", "Barrow", "Bristol Rovers", "Bromley", "Cambridge United", "Cheltenham Town",
    "Chesterfield", "Colchester United", "Crawley Town", "Crewe Alexandra", "Fleetwood Town", "Gillingham", "Grimsby Town",
    "Harrogate Town", "Milton Keynes Dons", "Newport County", "Notts County", "Oldham Athletic", "Salford City",
    "Shrewsbury Town", "Swindon Town", "Tranmere Rovers", "Walsall",
  ] },
  // ---- France -------------------------------------------------------------
  { country: "France", league: "Ligue 1", teams: [
    "Angers", "Auxerre", "Brest", "Le Havre", "Lens", "Lille", "Lorient", "Lyon", "Marseille", "Metz", "Monaco", "Nantes",
    "Nice", "Paris FC", "Paris Saint-Germain", "Rennes", "Strasbourg", "Toulouse",
  ] },
  { country: "France", league: "Ligue 2", teams: [
    "Amiens", "Annecy", "Bastia", "Boulogne", "Clermont", "Dunkerque", "Grenoble", "Guingamp", "Laval", "Le Mans",
    "Montpellier", "Nancy", "Pau", "Red Star", "Reims", "Rodez", "Saint-Étienne", "Troyes",
  ] },
  // ---- Italy --------------------------------------------------------------
  { country: "Italy", league: "Serie A", teams: [
    "Atalanta", "Bologna", "Cagliari", "Como", "Cremonese", "Fiorentina", "Genoa", "Hellas Verona", "Inter", "Juventus",
    "Lazio", "Lecce", "AC Milan", "Napoli", "Parma", "Pisa", "Roma", "Sassuolo", "Torino", "Udinese",
  ] },
  { country: "Italy", league: "Serie B", teams: [
    "Avellino", "Bari", "Carrarese", "Catanzaro", "Cesena", "Empoli", "Virtus Entella", "Frosinone", "Juve Stabia", "Mantova",
    "Modena", "Monza", "Padova", "Palermo", "Pescara", "Reggiana", "Sampdoria", "Spezia", "Südtirol", "Venezia",
  ] },
  // ---- Spain --------------------------------------------------------------
  { country: "Spain", league: "La Liga", teams: [
    "Alavés", "Athletic Club", "Atlético de Madrid", "FC Barcelona", "Real Betis", "Celta Vigo", "Elche", "Espanyol",
    "Getafe", "Girona", "Levante", "Mallorca", "Osasuna", "Rayo Vallecano", "Real Madrid", "Real Oviedo", "Real Sociedad",
    "Sevilla", "Valencia", "Villarreal",
  ] },
  { country: "Spain", league: "Segunda División", teams: [
    "Albacete", "Almería", "Andorra", "Burgos", "Cádiz", "Castellón", "Ceuta", "Córdoba", "Cultural Leonesa",
    "Deportivo La Coruña", "Eibar", "Granada", "Huesca", "Las Palmas", "Leganés", "Málaga", "Mirandés",
    "Racing Santander", "Real Sociedad B", "Real Zaragoza", "Sporting Gijón", "Real Valladolid",
  ] },
  // ---- Portugal -----------------------------------------------------------
  { country: "Portugal", league: "Primeira Liga", teams: [
    "Alverca", "Arouca", "AVS", "Benfica", "Braga", "Casa Pia", "Estoril", "Estrela da Amadora", "Famalicão", "Gil Vicente",
    "Moreirense", "Nacional", "Porto", "Rio Ave", "Santa Clara", "Sporting CP", "Tondela", "Vitória de Guimarães",
  ] },
  { country: "Portugal", league: "Liga Portugal 2", teams: [
    "Académico de Viseu", "Benfica B", "Chaves", "Farense", "Feirense", "Felgueiras", "Leixões", "Lusitânia Lourosa",
    "Marítimo", "Oliveirense", "Paços de Ferreira", "Penafiel", "Porto B", "Portimonense", "Sporting CP B", "Torreense",
    "União de Leiria", "Vizela",
  ] },
  // ---- Other top divisions -------------------------------------------------
  { country: "Germany", league: "Bundesliga", teams: [
    "Augsburg", "Bayer Leverkusen", "Bayern Munich", "Borussia Dortmund", "Borussia Mönchengladbach", "Eintracht Frankfurt",
    "FC Köln", "Hamburger SV", "Heidenheim", "Hoffenheim", "Mainz 05", "RB Leipzig", "SC Freiburg", "St. Pauli", "Stuttgart",
    "Union Berlin", "Werder Bremen", "Wolfsburg",
  ] },
  { country: "Netherlands", league: "Eredivisie", teams: [
    "Ajax", "AZ Alkmaar", "Excelsior", "Feyenoord", "Fortuna Sittard", "Go Ahead Eagles", "Groningen", "Heerenveen",
    "Heracles Almelo", "NAC Breda", "NEC Nijmegen", "PEC Zwolle", "PSV Eindhoven", "Sparta Rotterdam", "Telstar", "Twente",
    "Utrecht", "Volendam",
  ] },
  { country: "Scotland", league: "Scottish Premiership", teams: [
    "Aberdeen", "Celtic", "Dundee", "Dundee United", "Falkirk", "Hearts", "Hibernian", "Kilmarnock", "Livingston",
    "Motherwell", "Rangers", "St Mirren",
  ] },
  { country: "Belgium", league: "Pro League", teams: [
    "Anderlecht", "Antwerp", "Cercle Brugge", "Charleroi", "Club Brugge", "Dender", "Genk", "Gent", "La Louvière",
    "Mechelen", "OH Leuven", "Standard Liège", "Sint-Truiden", "Union Saint-Gilloise", "Westerlo", "Zulte Waregem",
  ] },
  { country: "Turkey", league: "Süper Lig", teams: [
    "Alanyaspor", "Antalyaspor", "Başakşehir", "Beşiktaş", "Eyüpspor", "Fatih Karagümrük", "Fenerbahçe", "Galatasaray",
    "Gaziantep FK", "Gençlerbirliği", "Göztepe", "Kasımpaşa", "Kayserispor", "Kocaelispor", "Konyaspor", "Rizespor",
    "Samsunspor", "Trabzonspor",
  ] },
  { country: "United States", league: "MLS", teams: [
    "Atlanta United", "Austin FC", "CF Montréal", "Charlotte FC", "Chicago Fire", "FC Cincinnati", "Colorado Rapids",
    "Columbus Crew", "FC Dallas", "D.C. United", "Houston Dynamo", "Inter Miami", "LA Galaxy", "Los Angeles FC",
    "Minnesota United", "Nashville SC", "New England Revolution", "New York City FC", "New York Red Bulls", "Orlando City",
    "Philadelphia Union", "Portland Timbers", "Real Salt Lake", "San Diego FC", "San Jose Earthquakes", "Seattle Sounders",
    "Sporting Kansas City", "St. Louis City", "Toronto FC", "Vancouver Whitecaps",
  ] },
  { country: "Brazil", league: "Série A", teams: [
    "Atlético Mineiro", "Bahia", "Botafogo", "Ceará", "Corinthians", "Cruzeiro", "Flamengo", "Fluminense", "Fortaleza",
    "Grêmio", "Internacional", "Juventude", "Mirassol", "Palmeiras", "Red Bull Bragantino", "Santos", "São Paulo",
    "Sport Recife", "Vasco da Gama", "Vitória",
  ] },
  { country: "Argentina", league: "Primera División", teams: [
    "Aldosivi", "Argentinos Juniors", "Atlético Tucumán", "Banfield", "Barracas Central", "Belgrano", "Boca Juniors",
    "Central Córdoba", "Defensa y Justicia", "Deportivo Riestra", "Estudiantes", "Gimnasia La Plata", "Godoy Cruz",
    "Huracán", "Independiente", "Independiente Rivadavia", "Instituto", "Lanús", "Newell's Old Boys", "Platense",
    "Racing Club", "River Plate", "Rosario Central", "San Lorenzo", "San Martín de San Juan", "Sarmiento", "Talleres",
    "Tigre", "Unión", "Vélez Sarsfield",
  ] },
  { country: "Mexico", league: "Liga MX", teams: [
    "América", "Atlas", "Atlético San Luis", "Cruz Azul", "Guadalajara", "Juárez", "León", "Mazatlán", "Monterrey", "Necaxa",
    "Pachuca", "Puebla", "Pumas UNAM", "Querétaro", "Santos Laguna", "Tigres UANL", "Tijuana", "Toluca",
  ] },
  { country: "Saudi Arabia", league: "Saudi Pro League", teams: [
    "Al-Ahli", "Al-Ettifaq", "Al-Fateh", "Al-Fayha", "Al-Hazem", "Al-Hilal", "Al-Ittihad", "Al-Khaleej", "Al-Kholood",
    "Al-Najma", "Al-Nassr", "Al-Okhdood", "Al-Qadsiah", "Al-Riyadh", "Al-Shabab", "Al-Taawoun", "Damac", "NEOM SC",
  ] },
  { country: "Japan", league: "J1 League", teams: [
    "Albirex Niigata", "Avispa Fukuoka", "Cerezo Osaka", "Fagiano Okayama", "FC Tokyo", "Gamba Osaka", "Kashima Antlers",
    "Kashiwa Reysol", "Kawasaki Frontale", "Kyoto Sanga", "Machida Zelvia", "Nagoya Grampus", "Sanfrecce Hiroshima",
    "Shimizu S-Pulse", "Shonan Bellmare", "Tokyo Verdy", "Urawa Red Diamonds", "Vissel Kobe", "Yokohama F. Marinos",
    "Yokohama FC",
  ] },
  { country: "Switzerland", league: "Super League", teams: [
    "Basel", "Grasshopper", "Lausanne-Sport", "Lugano", "Luzern", "Servette", "Sion", "St. Gallen", "Thun", "Winterthur",
    "Young Boys", "Zürich",
  ] },
  { country: "Austria", league: "Bundesliga", teams: [
    "Altach", "Austria Wien", "Blau-Weiß Linz", "Grazer AK", "Hartberg", "LASK", "Rapid Wien", "Red Bull Salzburg", "Ried",
    "Sturm Graz", "WSG Tirol", "Wolfsberger AC",
  ] },
  { country: "Greece", league: "Super League", teams: [
    "AEK Athens", "AEL Larissa", "Aris", "Asteras Tripolis", "Atromitos", "Kifisia", "Levadiakos", "OFI", "Olympiacos",
    "Panathinaikos", "Panetolikos", "Panserraikos", "PAOK", "Volos",
  ] },
  { country: "Denmark", league: "Superliga", teams: [
    "AGF", "Brøndby", "Copenhagen", "Fredericia", "Midtjylland", "Nordsjælland", "OB", "Randers", "Silkeborg",
    "SønderjyskE", "Vejle", "Viborg",
  ] },
  { country: "Sweden", league: "Allsvenskan", teams: [
    "AIK", "BK Häcken", "Brommapojkarna", "Degerfors", "Djurgården", "Elfsborg", "GAIS", "IFK Göteborg", "Halmstad",
    "Hammarby", "Malmö FF", "Mjällby", "IFK Norrköping", "Sirius", "Värnamo", "Öster",
  ] },
  { country: "Norway", league: "Eliteserien", teams: [
    "Bodø/Glimt", "Brann", "Bryne", "Fredrikstad", "HamKam", "Haugesund", "KFUM Oslo", "Kristiansund", "Molde", "Rosenborg",
    "Sandefjord", "Sarpsborg 08", "Strømsgodset", "Tromsø", "Viking", "Vålerenga",
  ] },
  { country: "Australia", league: "A-League", teams: [
    "Adelaide United", "Auckland FC", "Brisbane Roar", "Central Coast Mariners", "Macarthur FC", "Melbourne City",
    "Melbourne Victory", "Newcastle Jets", "Perth Glory", "Sydney FC", "Wellington Phoenix", "Western Sydney Wanderers",
    "Western United",
  ] },
  { country: "South Korea", league: "K League 1", teams: [
    "FC Anyang", "Daegu FC", "Daejeon Hana Citizen", "Gangwon FC", "Gimcheon Sangmu", "Gwangju FC", "Jeju SK",
    "Jeonbuk Hyundai Motors", "Pohang Steelers", "FC Seoul", "Suwon FC", "Ulsan HD",
  ] },
  // ---- UEFA 2025-26 league-phase clubs from leagues not listed above ----------
  // Only the European entrants, not the full divisions.
  { country: "Czech Republic", league: "First League", teams: ["Slavia Prague", "Sparta Prague", "Viktoria Plzeň", "Sigma Olomouc"] },
  { country: "Azerbaijan", league: "Premier League", teams: ["Qarabağ"] },
  { country: "Cyprus", league: "First Division", teams: ["Pafos", "Omonia", "AEK Larnaca"] },
  { country: "Kazakhstan", league: "Premier League", teams: ["Kairat"] },
  { country: "Croatia", league: "HNL", teams: ["Dinamo Zagreb", "Rijeka"] },
  { country: "Serbia", league: "SuperLiga", teams: ["Crvena Zvezda"] },
  { country: "Hungary", league: "NB I", teams: ["Ferencváros"] },
  { country: "Israel", league: "Premier League", teams: ["Maccabi Tel Aviv"] },
  { country: "Bulgaria", league: "First League", teams: ["Ludogorets"] },
  { country: "Romania", league: "Liga I", teams: ["FCSB", "Universitatea Craiova"] },
  { country: "Ukraine", league: "Premier League", teams: ["Shakhtar Donetsk", "Dynamo Kyiv"] },
  { country: "Slovakia", league: "Super Liga", teams: ["Slovan Bratislava"] },
  { country: "Poland", league: "Ekstraklasa", teams: ["Legia Warsaw", "Lech Poznań", "Jagiellonia Białystok", "Raków Częstochowa"] },
  { country: "North Macedonia", league: "First League", teams: ["Shkëndija"] },
  { country: "Slovenia", league: "PrvaLiga", teams: ["Celje"] },
  { country: "Bosnia and Herzegovina", league: "Premier League", teams: ["Zrinjski"] },
  { country: "Gibraltar", league: "Football League", teams: ["Lincoln Red Imps"] },
  { country: "Armenia", league: "Premier League", teams: ["Noah"] },
  { country: "Malta", league: "Premier League", teams: ["Hamrun Spartans"] },
  { country: "Kosovo", league: "Superleague", teams: ["Drita"] },
  { country: "Iceland", league: "Besta deild", teams: ["Breiðablik"] },
  { country: "Ireland", league: "Premier Division", teams: ["Shamrock Rovers", "Shelbourne"] },
  { country: "Finland", league: "Veikkausliiga", teams: ["KuPS"] },
];

export const extraTopics = [
  { name: "Women's Football", description: "WSL, Liga F, NWSL and the Lionesses" },
  { name: "International", description: "World Cup, Euros, Nations League and qualifiers" },
  { name: "Europa & Conference League", description: "Thursday nights in Europe" },
  { name: "Fantasy Football", description: "FPL picks, captains and wildcards" },
  { name: "Academy & Youth", description: "Next generation, loans and breakthroughs" },
  { name: "Grassroots", description: "Your own team, Sunday league and school football" },
];
