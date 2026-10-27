// Reference clubs grouped by competition. Names match football-data.org short names
// where possible so the fixtures sync links them automatically. Memberships are the
// 2026-27 season (2026 for calendar-year leagues); promotion and relegation only
// change the `league` label, never remove a club, so a club that drops below the
// lowest division listed for its country keeps an entry under that lower division
// (those groups hold only the clubs that fell into them, not the whole division).
export const leagues = [
  // ---- England -------------------------------------------------------------------
  { country: "England", league: "Premier League", teams: [
    "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton & Hove Albion", "Chelsea", "Coventry City",
    "Crystal Palace", "Everton", "Fulham", "Hull City", "Ipswich Town", "Leeds United", "Liverpool", "Manchester City",
    "Manchester United", "Newcastle United", "Nottingham Forest", "Sunderland", "Tottenham Hotspur",
  ] },
  { country: "England", league: "Championship", teams: [
    "Birmingham City", "Blackburn Rovers", "Bolton Wanderers", "Bristol City", "Burnley", "Cardiff City",
    "Charlton Athletic", "Derby County", "Lincoln City", "Middlesbrough", "Millwall", "Norwich City", "Portsmouth",
    "Preston North End", "Queens Park Rangers", "Sheffield United", "Southampton", "Stoke City", "Swansea City",
    "Watford", "West Bromwich Albion", "West Ham United", "Wolverhampton Wanderers", "Wrexham",
  ] },
  { country: "England", league: "League One", teams: [
    "AFC Wimbledon", "Barnsley", "Blackpool", "Bradford City", "Bromley", "Burton Albion", "Cambridge United",
    "Doncaster Rovers", "Huddersfield Town", "Leicester City", "Leyton Orient", "Luton Town", "Mansfield Town",
    "Milton Keynes Dons", "Notts County", "Oxford United", "Peterborough United", "Plymouth Argyle", "Reading",
    "Sheffield Wednesday", "Stevenage", "Stockport County", "Wigan Athletic", "Wycombe Wanderers",
  ] },
  { country: "England", league: "League Two", teams: [
    "Accrington Stanley", "Barnet", "Bristol Rovers", "Cheltenham Town", "Chesterfield", "Colchester United",
    "Crawley Town", "Crewe Alexandra", "Exeter City", "Fleetwood Town", "Gillingham", "Grimsby Town", "Newport County",
    "Northampton Town", "Oldham Athletic", "Port Vale", "Rochdale", "Rotherham United", "Salford City",
    "Shrewsbury Town", "Swindon Town", "Tranmere Rovers", "Walsall", "York City",
  ] },
  // ---- England: National League System, steps 1 to 6 -----------------------------
  { country: "England", league: "National League", teams: [
    "AFC Fylde", "Aldershot Town", "Altrincham", "Barrow", "Boreham Wood", "Boston United", "Carlisle United",
    "Eastleigh", "FC Halifax Town", "Forest Green Rovers", "Gateshead", "Harrogate Town", "Hartlepool United",
    "Hornchurch", "Kidderminster Harriers", "Scunthorpe United", "Solihull Moors", "Southend United", "Sutton United",
    "Tamworth", "Wealdstone", "Woking", "Worthing", "Yeovil Town",
  ] },
  { country: "England", league: "National League North", teams: [
    "AFC Telford United", "Bedford Town", "Brackley Town", "Buxton", "Chester", "Chorley", "Darlington",
    "Harborough Town", "Hebburn Town", "Hednesford Town", "Hereford", "King's Lynn Town", "Macclesfield", "Marine",
    "Merthyr Town", "Morecambe", "Oxford City", "Radcliffe", "Scarborough Athletic", "South Shields", "Southport",
    "Spalding United", "Spennymoor Town", "Worksop Town",
  ] },
  { country: "England", league: "National League South", teams: [
    "AFC Totton", "Billericay Town", "Braintree Town", "Chelmsford City", "Chesham United", "Dorking Wanderers",
    "Dover Athletic", "Ebbsfleet United", "Farnborough", "Farnham Town", "Folkestone Invicta",
    "Hampton & Richmond Borough", "Hemel Hempstead Town", "Horsham", "Maidenhead United", "Maidstone United",
    "Salisbury", "Slough Town", "Tonbridge Angels", "Torquay United", "Truro City", "Weston-super-Mare",
  ] },
  { country: "England", league: "Northern Premier League Premier Division", teams: [
    "Alfreton Town", "Ashton United", "Avro", "Bamber Bridge", "Bury", "Cleethorpes Town", "Curzon Ashton", "Emley",
    "FC United of Manchester", "Gainsborough Trinity", "Guiseley", "Hyde United", "Ilkeston Town", "Lancaster City",
    "Leek Town", "Quorn", "Redcar Athletic", "Stockton Town", "Warrington Rylands 1906", "Warrington Town",
    "Whitby Town", "Workington",
  ] },
  { country: "England", league: "Southern League Premier Division Central", teams: [
    "Alvechurch", "Anstey Nomads", "Banbury United", "Bishop's Stortford", "Bromsgrove Sporting", "Bury Town",
    "Halesowen Town", "Hitchin Town", "Kettering Town", "Leamington", "Leighton Town", "Leiston", "Needham Market",
    "Peterborough Sports", "Racing Club Warwick", "Real Bedford", "Redditch United", "Rushall Olympic", "Stamford",
    "Stourbridge", "Stratford Town", "Worcester City",
  ] },
  { country: "England", league: "Southern League Premier Division South", teams: [
    "Basingstoke Town", "Bath City", "Berkhamsted", "Bracknell Town", "Chertsey Town", "Chichester City",
    "Chippenham Town", "Evesham United", "Frome Town", "Gloucester City", "Gosport Borough", "Hanwell Town",
    "Hanworth Villa", "Malvern Town", "Plymouth Parkway", "Poole Town", "Sholing", "Taunton Town", "Uxbridge",
    "Wimborne Town", "Yate Town",
  ] },
  { country: "England", league: "Isthmian League Premier Division", teams: [
    "AFC Whyteleafe", "Aveley", "Brentwood Town", "Burgess Hill Town", "Carshalton Athletic", "Chatham Town",
    "Cheshunt", "Cray Wanderers", "Dartford", "Dulwich Hamlet", "Eastbourne Borough", "Enfield Town", "Leatherhead",
    "Lewes", "Ramsgate", "St Albans City", "Stanway Rovers", "Three Bridges", "Welling United", "Whitehawk",
  ] },
  { country: "England", league: "Northern Premier League Division One East", teams: [
    "Ashington", "Beverley Town", "Blyth Spartans", "Bradford (Park Avenue)", "Bridlington Town", "Consett", "Dunston",
    "Garforth Town", "Grimsby Borough", "Guisborough Town", "Hallam", "Heaton Stannington", "Lincoln United",
    "Liversedge", "Matlock Town", "Morpeth Town", "North Ferriby", "Ossett United", "Pontefract Collieries", "Silsden",
    "Stocksbridge Park Steels", "West Auckland Town",
  ] },
  { country: "England", league: "Northern Premier League Division One Midlands", teams: [
    "Barwell", "Basford United", "Bedworth United", "Belper Town", "Boldmere St Michaels", "Boston Town", "Bourne Town",
    "Carlton Town", "Coleshill Town", "Corby Town", "Coventry United", "Grantham Town", "Long Eaton United",
    "Loughborough Students", "Mickleover", "Nuneaton Town", "Rugby Borough", "Shepshed Dynamo", "St Ives Town",
    "Sutton Coldfield Town", "Wellingborough Town",
  ] },
  { country: "England", league: "Northern Premier League Division One West", teams: [
    "1874 Northwich", "Atherton Collieries", "Bootle", "Chasetown", "Clitheroe", "Congleton Town", "Hanley Town",
    "Kidsgrove Athletic", "Lichfield City", "Lower Breck", "Mossley", "Nantwich Town", "Newcastle Town", "Padiham",
    "Prescot Cables", "Runcorn Linnets", "Shifnal Town", "Stafford Rangers", "Stalybridge Celtic", "Vauxhall Motors",
    "Witton Albion", "Wythenshawe",
  ] },
  { country: "England", league: "Southern League Division One Central", teams: [
    "Aylesbury United", "Barton Rovers", "Beaconsfield Town", "Biggleswade", "Biggleswade Town", "Didcot Town",
    "Flackwell Heath", "Hadley", "Haringey Borough", "Hertford Town", "Leverstock Green", "London Lions", "Marlow",
    "Milton Keynes Irish", "Potters Bar Town", "Royston Town", "Stotfold", "Thame United", "Waltham Abbey", "Ware",
    "Welwyn Garden City", "Winslow United",
  ] },
  { country: "England", league: "Southern League Division One South", teams: [
    "Barnstaple Town", "Bideford", "Bishop's Cleeve", "Bristol Manor Farm", "Dorchester Town", "Exmouth Town",
    "Falmouth Town", "Hartpury", "Hungerford Town", "Larkhall Athletic", "Melksham Town", "Paulton Rovers",
    "Portland United", "Shaftesbury", "Slimbridge", "Sporting Club Inkberrow", "Swindon Supermarine", "Tiverton Town",
    "Westbury United", "Weymouth", "Willand Rovers", "Worcester Raiders",
  ] },
  { country: "England", league: "Isthmian League North Division", teams: [
    "AFC Sudbury", "Brightlingsea Regent", "Buckhurst Hill", "Cambridge City", "Canvey Island", "Concord Rangers",
    "Fakenham Town", "Gorleston", "Grays Athletic", "Hashtag United", "Little Oakley", "Lowestoft Town",
    "Mulbarton Wanderers", "Newmarket Town", "Redbridge", "Takeley", "Tilbury", "Walthamstow", "Witham Town", "Wroxham",
  ] },
  { country: "England", league: "Isthmian League South Central Division", teams: [
    "AFC Portchester", "AFC Stoneham", "Ascot United", "Ashford Town (Middlesex)", "Bedfont Sports", "Binfield",
    "Bognor Regis Town", "Cobham", "Egham Town", "Harrow Borough", "Hartley Wintney", "Hendon", "Jersey Bulls",
    "Kingstonian", "Littlehampton Town", "Moneyfields", "Raynes Park Vale", "Southall", "Westfield (Surrey)",
    "Winchester City",
  ] },
  { country: "England", league: "Isthmian League South East Division", teams: [
    "AFC Croydon Athletic", "Ashford United", "Broadbridge Heath", "Cray Valley Paper Mills", "Crowborough Athletic",
    "Deal Town", "Eastbourne Town", "Erith Town", "Faversham Town", "Hastings United", "Herne Bay", "Horley Town",
    "Margate", "Merstham", "Punjab United", "Sevenoaks Town", "Sheppey United", "Sittingbourne", "South Park",
    "Steyning Town", "Whitstable Town",
  ] },
  { country: "England", league: "Combined Counties League Premier Division North", teams: [
    "Abingdon United", "Amersham Town", "Ardley United", "Bedfont", "Broadfields United", "Burnham", "Easington Sports",
    "Harefield United", "Hilltop", "Holyport", "Kidlington", "North Greenford United", "North Leigh", "Northwood",
    "Penn & Tylers Green", "Rayners Lane", "Reading City", "Thatcham Town", "Wallingford & Crowmarsh", "Wokingham Town",
  ] },
  { country: "England", league: "Combined Counties League Premier Division South", teams: [
    "Abbey Rangers", "Alton", "Badshot Lea", "Balham", "Camberley Town", "Chipstead", "Corinthian-Casuals",
    "Fleet Town", "Godalming Town", "Knaphill", "Metropolitan Police", "Redhill", "Sheerwater", "Sutton Common Rovers",
    "Tadley Calleva", "Tooting & Mitcham United", "Virginia Water", "Yateley United",
  ] },
  { country: "England", league: "Eastern Counties League Premier Division", teams: [
    "Brantham Athletic", "Cornard United", "Dereham Town", "Downham Town", "Ely City", "Great Yarmouth Town",
    "Harleston Town", "Haverhill Rovers", "Heacham", "Ipswich Wanderers", "Kirkley & Pakefield", "Lakenheath",
    "March Town United", "Mildenhall Town", "Soham Town Rangers", "Stowmarket Town", "Thetford Town",
    "Walsham-le-Willows", "Wisbech Town", "Woodbridge Town",
  ] },
  { country: "England", league: "Essex Senior League", teams: [
    "Barking", "Basildon United", "Benfleet", "Clapton Community", "Frenford", "Great Wakering Rovers", "Hackney Wick",
    "Halstead Town", "Harwich & Parkeston", "Heybridge Swifts", "Hullbridge Sports", "Hutton", "Ilford", "Romford",
    "Saffron Walden Town", "Soul Tower Hamlets", "Sporting Bengal United", "West Essex", "White Ensign",
    "Woodford Town",
  ] },
  { country: "England", league: "Hellenic League Premier Division", teams: [
    "Bradford Town", "Cinderford Town", "Cirencester Town", "Corsham Town", "Cribbs", "Devizes Town", "Droitwich Spa",
    "Fairford Town", "Hallen", "Hereford Pegasus", "Highworth Town", "Longlevens", "Malmesbury Victoria",
    "Mangotsfield United", "Pershore Town", "Roman Glass St George", "Royal Wootton Bassett Town", "Stourport Swifts",
    "Thornbury Town", "Tuffley Rovers", "Westfields",
  ] },
  { country: "England", league: "Midland League Premier Division", teams: [
    "Abbey Hulton United", "AFC Wolverhampton City", "Brocton", "Cheadle Town", "Darlaston Town 1874", "Dudley Town",
    "Lye Town", "Northwich Victoria", "Romulus", "Runcorn Town", "Sporting Khalsa", "Stockport Georgians",
    "Stone Old Alleynians", "Sutton United (Birmingham)", "Tividale", "Uttoxeter Town", "West Didsbury & Chorlton",
    "Whitchurch Alport", "Winsford United", "Wythenshawe Town",
  ] },
  { country: "England", league: "North West Counties League Premier Division", teams: [
    "Abbey Hey", "AFC Liverpool", "Atherton Laburnum Rovers", "Barnoldswick Town", "Burscough", "Chadderton",
    "Charnock Richard", "Droylsden", "Euxton Villa", "FC Isle of Man", "FC St Helens", "Glossop North End", "Irlam",
    "Litherland REMYCA", "Longridge Town", "Nelson", "Prestwich Heys", "Ramsbottom United", "South Liverpool",
    "Trafford",
  ] },
  { country: "England", league: "Northern Counties East League Premier Division", teams: [
    "Albion Sports", "Barton Town", "Bottesford Town", "Campion", "Dearne & District", "Frickley Athletic",
    "Golcar United", "Handsworth", "Horbury Town", "Keighley Town", "Knaresborough Town", "Parkgate",
    "Penistone Church", "Pickering Town", "Retford", "Retford United", "Rossington Main", "Tadcaster Albion",
    "Thackley", "Worsbrough Bridge Athletic",
  ] },
  { country: "England", league: "Northern League Division One", teams: [
    "Birtley Town", "Bishop Auckland", "Blyth Town", "Boro Rangers", "Carlisle City", "Crook Town",
    "Easington Colliery", "Horden Community Welfare", "Kendal Town", "Marske United", "Newcastle Benfield",
    "Newcastle Blue Star", "Newton Aycliffe", "North Shields", "Northallerton Town", "Penrith", "Redcar Town",
    "Shildon", "Thornaby", "Whickham", "Whitley Bay", "Yarm & Eaglescliffe",
  ] },
  { country: "England", league: "Southern Combination League Premier Division", teams: [
    "AFC Varndeanians", "Bexhill United", "Billingshurst", "Crawley Down Gatwick", "East Grinstead Town",
    "Eastbourne United", "Forest Row", "Guernsey", "Hassocks", "Haywards Heath Town", "Horsham YM", "Lancing",
    "Lingfield", "Little Common", "Midhurst & Easebourne", "Newhaven", "Pagham", "Roffey", "Seaford Town", "Wick",
  ] },
  { country: "England", league: "Southern Counties East League Premier Division", teams: [
    "AFC Greenwich Borough", "Bearsted", "Beckenham Town", "Chislehurst Glebe", "Corinthian", "Faversham Strike Force",
    "Fisher", "Kennington", "Larkfield & New Hythe Wanderers", "Petts Wood & Holmesdale", "Phoenix Sports", "Rusthall",
    "SE Dons", "Snodland Town", "Sutton Athletic", "Tunbridge Wells",
  ] },
  { country: "England", league: "Spartan South Midlands League Premier Division", teams: [
    "AFC Welwyn", "Arlesey Town", "Aylesbury Vale Dynamos", "Baldock Town", "Biggleswade United", "Cockfosters",
    "Colney Heath", "Dunstable", "Enfield", "Everett Rovers", "Harlow Town", "Harpenden Town", "Kempston Rovers",
    "Kings Langley", "Newport Pagnell Town", "Potton United", "Risborough Rangers", "Sawbridgeworth Town",
    "Tring Athletic", "Wormley Rovers",
  ] },
  { country: "England", league: "United Counties League Premier Division North", teams: [
    "AFC Mansfield", "Ashby Ivanhoe", "Aylestone Park", "Belper United", "Blackstones", "Clay Cross Town",
    "Deeping Rangers", "Eastwood", "Gresley Rovers", "Heanor Town", "Hinckley", "Hucknall Town",
    "Kimberley Miners Welfare", "Leicester Nirvana", "Newark Town", "Sheffield", "Sherwood Colliery", "Skegness Town",
  ] },
  { country: "England", league: "United Counties League Premier Division South", teams: [
    "Atherstone Town", "Coton Green", "Coventry Sphinx", "Daventry Town", "Desborough Town", "Eynesbury Rovers",
    "FC Peterborough", "FC Stratford", "Godmanchester Rovers", "Highgate United", "Histon", "Knowle",
    "Lutterworth Town", "Moulton", "Northampton ON Chenecks", "Northampton Sileby Rangers", "Rugby Town",
    "St Neots Town", "Yaxley",
  ] },
  { country: "England", league: "Wessex League Premier Division", teams: [
    "Andover New Street", "Baffins Milton Rovers", "Bashley", "Bemerton Heath Harlequins", "Bournemouth Poppies",
    "Brockenhurst", "Christchurch", "Cowes Sports", "Downton", "East Cowes Victoria Athletic", "Fareham Town",
    "Fleetlands", "Hamble Club", "Hamworthy Recreation", "Horndean", "Hythe & Dibden", "Millbrook (Hampshire)",
    "Petersfield Town", "Sherborne Town", "Sturminster Newton United",
  ] },
  { country: "England", league: "Western League Premier Division", teams: [
    "Bovey Tracey", "Bridgwater United", "Brislington", "Brixham", "Buckland Athletic", "Clevedon Town",
    "Ivybridge Town", "Liskeard Athletic", "Newquay", "Portishead Town", "Saltash United", "Shepton Mallet",
    "Sidmouth Town", "St Blazey", "Street", "Tavistock", "Torpoint Athletic", "Wellington", "Wells City",
  ] },
  { country: "England", league: "Combined Counties League Division One", teams: [
    "Belstone", "Berks County", "Bovingdon", "Brook House", "Colliers Wood United", "Eagles Land Benfica",
    "Edgware & Kingsbury", "FC Deportivo Galicia", "Holmer Green", "Langley", "London Samurai Rovers",
    "Maidenhead Town", "Molesey", "Oxhey Jets", "PFC Victoria London", "Shepherd's Bush", "Spartans Youth",
    "Spelthorne Sports", "Wembley", "Westside", "Woodley United",
  ] },
  { country: "England", league: "Eastern Counties League Division One North", teams: [
    "AFC Pegasus", "Clacton Town", "Diss Town", "Dussindale & Hellesdon Rovers", "FC Parson Drove", "Framlingham Town",
    "Hadleigh United", "Halesworth Town", "Holbeach United", "Holland", "Long Melford", "Netherton United",
    "Norwich United", "Whittlesey Athletic", "Wivenhoe Town",
  ] },
  { country: "England", league: "Eastern Counties League Division One South", teams: [
    "AS London", "Athletic Newham", "Basildon Town", "Brimsdown", "Burnham Ramblers", "Cannons Wood", "Coggeshall Town",
    "Dunmow Town", "East Thurrock Community", "Enfield Borough", "FC Baresi", "Hertford Heath", "Hoddesdon Town",
    "London Fennecs", "London Harts United", "Lymore Gardens", "Marcelona", "NW London", "Rayleigh Town",
    "Southend Manor", "Stansted",
  ] },
  { country: "England", league: "Hellenic League Division One", teams: [
    "Alcester Town", "Bewdley Town", "Brimscombe & Thrupp", "Bromyard Town", "Carterton", "Cheltenham Saracens",
    "Chipping Sodbury Town", "Clanfield 85", "Ludlow", "Lydney Town", "Newent Town", "Redditch Borough", "Sharpness",
    "Shortwood United", "Stonehouse Town", "Studley", "Wantage Town",
  ] },
  { country: "England", league: "Midland League Division One", teams: [
    "AFC North Kilworth", "Anstey Town", "Birstall United", "Boldmere Rangers", "Bustleholme", "Chelmsley Town",
    "Coalville Town", "Coventry Copsewood", "Cradley Town", "FCV Grace Dieu", "GNG Oadby Town", "Gornal Athletic",
    "Heather St John's", "Holwell Sports", "Ingles", "Kirby Muxloe", "Leicester St Andrews", "Lutterworth Athletic",
    "Northfield Town", "OJM CFC", "Saffron Dynamo", "Stapenhill",
  ] },
  { country: "England", league: "North West Counties League First Division North", teams: [
    "AFC Blackpool", "AFC Knowsley", "Ashton Athletic", "Ashton Town", "Ashville", "Bacup Borough",
    "Cammell Laird 1907", "Colne", "Daisy Hill", "Darwen", "Flixton", "Fulwood Amateurs", "Garstang", "Halewood Apollo",
    "Holker Old Boys", "Maghull", "Maine Road", "Squires Gate", "Steeton", "Thornton Cleveleys", "Uppermill", "Woolton",
  ] },
  { country: "England", league: "North West Counties League First Division South", teams: [
    "AFC Bridgnorth", "Allscott Heath", "Alsager Town", "Barnton", "Bilston Town", "Brereton Social",
    "Cheadle Heath Nomads", "Crewe", "Dawley Town", "Eccleshall", "Foley Meir", "Market Drayton Town", "New Mills",
    "Sandbach United", "Shawbury United", "Stafford Town", "Telford Town", "Wednesfield Community", "Widnes Town",
    "Wolverhampton Casuals",
  ] },
  { country: "England", league: "Northern Counties East League Division One", teams: [
    "Appleby Frodingham", "Armthorpe Welfare", "Athersley Recreation", "Brigg Town", "Club Thorne Colliery",
    "Crowle Colts", "Doncaster City", "Field Olympic", "Goole", "Harrogate Railway Athletic",
    "Hemsworth Miners Welfare", "Ilkley Town", "Immingham Town", "Kinsley Boys", "Leeds UFCA", "LIV",
    "Route One Rovers", "Selby Town", "South Leeds", "Wakefield", "Winterton Rangers", "Wombwell Town",
  ] },
  { country: "England", league: "Northern League Division Two", teams: [
    "AFC Newbiggin", "Alnwick Town", "Billingham Synthonia", "Billingham Town", "Boldon Community Association",
    "Chester-le-Street Town", "Darlington Town", "Durham United", "FC Hartlepool", "Grangetown Boys Club", "Jarrow",
    "Newcastle University", "Park View", "Prudhoe Youth Club", "Ryton & Crawcrook Albion", "Seaham Red Star",
    "Seaton Carew", "Stokesley Sports Club", "Sunderland RCA", "Tow Law Town",
  ] },
  { country: "England", league: "South West Peninsula League Premier Division East", teams: [
    "Axminster Town", "Bishops Lydeard", "Bridport", "Crediton United", "Cullompton Rangers", "Elburton Villa",
    "Honiton Town", "Ilfracombe Town", "Ilminster Town", "Middlezoy Rovers", "Newton Abbot Spurs", "Okehampton Argyle",
    "Stoke Gabriel & Torbay Police", "Teignmouth", "Torridgeside", "Torrington", "University of Exeter",
  ] },
  { country: "England", league: "South West Peninsula League Premier Division West", teams: [
    "AFC St Austell", "Bude Town", "Callington Town", "Camelford", "Dobwalls", "Hayle", "Helston Athletic",
    "Holsworthy", "Launceston", "Millbrook (Cornwall)", "Mousehole", "Penzance", "St Mawgan", "Sticker",
    "Wadebridge Town", "Wendron United",
  ] },
  { country: "England", league: "Southern Combination League Division One", teams: [
    "AFC Walcountians", "Arundel", "Clanfield", "Dial Square", "East Preston", "Guildford City", "Hailsham Town",
    "Infinity", "Jarvis Brook", "Loxwood", "Mile Oak", "Oakwood", "Reigate Priory", "Ringmer", "Saltdean United",
    "Selsey", "Shoreham", "Westfield (Sussex)", "Worthing United",
  ] },
  { country: "England", league: "Southern Counties East League First Division", teams: [
    "Banstead Athletic", "Bridon Ropes", "Croydon", "FC Elmstead", "Greenways", "Halls Athletic", "Hythe Town",
    "Lewisham Borough", "Lordswood", "Lydd Town", "Minster", "Rochester United", "Sheppey Sports",
    "Sporting Club Thamesmead", "Stansfeld", "Staplehurst Monarchs", "Tooting Bec", "Welling Town",
  ] },
  { country: "England", league: "Spartan South Midlands League Division One", teams: [
    "Ampthill Town", "Buckingham", "Bugbrooke St Michaels", "Burton Park Wanderers", "Cranfield United",
    "Crawley Green", "Eaton Socon", "Huntingdon Town", "Irchester United", "Langford", "Letchworth Garden City Eagles",
    "New Bradwell St Peter", "Rothwell Corinthians", "Wellingborough Whitworth", "Woodford United",
  ] },
  { country: "England", league: "United Counties League Division One", teams: [
    "Clifton All Whites", "Clipstone", "Cotgrave", "Dronfield Town", "Dunkirk", "Gedling Miners Welfare",
    "Harrowby United", "Louth Town", "Maltby Main", "Pinchbeck United", "Pinxton", "Radford", "Sandiacre Town",
    "Selston", "Shirebrook Town", "Sleaford Town", "South Normanton Athletic", "Southwell City", "Stapleford Town",
    "Staveley Miners Welfare", "Swallownest", "West Bridgford",
  ] },
  { country: "England", league: "Wessex League Division One", teams: [
    "AFC Aldermaston", "Alresford Town", "Amesbury Town", "Ash United", "Blandford United", "Colden Common", "Cove",
    "Fawley", "Folland Sports", "Frimley Green", "Hamworthy United", "Hedge End Rangers", "Kintbury Rangers",
    "Lymington Town", "New Milton Town", "Newport (IOW)", "Ringwood Town", "Romsey Town", "Sandhurst Town",
    "Totton & Eling", "Whitchurch United",
  ] },
  { country: "England", league: "Western League First Division", teams: [
    "AEK Boco", "Almondsbury", "Avonmouth", "Bitton", "Bristol Telephones", "Cadbury Heath", "Calne Town",
    "Keynsham Town", "Longwell Green Sports", "Mendip Broadwalk", "Nailsea United", "Odd Down", "Oldland Abbotonians",
    "Radstock Town", "Shirehampton", "Warminster Town", "Welton Rovers", "Wincanton Town",
  ] },
  // ---- France --------------------------------------------------------------------
  { country: "France", league: "Ligue 1", teams: [
    "Angers", "Auxerre", "Brest", "Le Havre", "Le Mans", "Lens", "Lille", "Lorient", "Lyon", "Marseille", "Monaco",
    "Nice", "Paris FC", "Paris Saint-Germain", "Rennes", "Strasbourg", "Toulouse", "Troyes",
  ] },
  { country: "France", league: "Ligue 2", teams: [
    "Annecy", "Boulogne", "Clermont", "Dijon", "Dunkerque", "Grenoble", "Guingamp", "Laval", "Metz", "Montpellier",
    "Nancy", "Nantes", "Pau", "Red Star", "Reims", "Rodez", "Saint-Étienne", "Sochaux",
  ] },
  { country: "France", league: "Ligue 3", teams: ["Amiens", "Bastia"] },
  // ---- Italy ---------------------------------------------------------------------
  { country: "Italy", league: "Serie A", teams: [
    "AC Milan", "Atalanta", "Bologna", "Cagliari", "Como", "Fiorentina", "Frosinone", "Genoa", "Inter", "Juventus",
    "Lazio", "Lecce", "Monza", "Napoli", "Parma", "Roma", "Sassuolo", "Torino", "Udinese", "Venezia",
  ] },
  { country: "Italy", league: "Serie B", teams: [
    "Arezzo", "Ascoli", "Avellino", "Benevento", "Carrarese", "Catanzaro", "Cesena", "Cremonese", "Empoli",
    "Hellas Verona", "Juve Stabia", "Mantova", "Modena", "Padova", "Palermo", "Pisa", "Sampdoria", "Südtirol",
    "Vicenza", "Virtus Entella",
  ] },
  { country: "Italy", league: "Serie C", teams: ["Bari", "Pescara", "Reggiana", "Spezia"] },
  // ---- Spain ---------------------------------------------------------------------
  { country: "Spain", league: "La Liga", teams: [
    "Alavés", "Athletic Club", "Atlético de Madrid", "Celta Vigo", "Deportivo La Coruña", "Elche", "Espanyol",
    "FC Barcelona", "Getafe", "Levante", "Málaga", "Osasuna", "Racing Santander", "Rayo Vallecano", "Real Betis",
    "Real Madrid", "Real Sociedad", "Sevilla", "Valencia", "Villarreal",
  ] },
  { country: "Spain", league: "Segunda División", teams: [
    "Albacete", "Almería", "Andorra", "Burgos", "Cádiz", "Castellón", "Celta Fortuna", "Ceuta", "Córdoba", "Eibar",
    "Eldense", "Girona", "Granada", "Las Palmas", "Leganés", "Mallorca", "Real Oviedo", "Real Sociedad B",
    "Real Valladolid", "Sabadell", "Sporting Gijón", "Tenerife",
  ] },
  { country: "Spain", league: "Primera Federación", teams: ["Cultural Leonesa", "Huesca", "Mirandés", "Real Zaragoza"] },
  // ---- Portugal ------------------------------------------------------------------
  { country: "Portugal", league: "Primeira Liga", teams: [
    "Académico de Viseu", "Alverca", "Arouca", "Benfica", "Braga", "Casa Pia", "Estoril", "Estrela da Amadora",
    "Famalicão", "Gil Vicente", "Marítimo", "Moreirense", "Nacional", "Porto", "Rio Ave", "Santa Clara", "Sporting CP",
    "Vitória de Guimarães",
  ] },
  { country: "Portugal", league: "Liga Portugal 2", teams: [
    "Académica", "Amarante", "AVS", "Benfica B", "Chaves", "Farense", "Feirense", "Felgueiras", "Leixões",
    "Lusitânia Lourosa", "Penafiel", "Portimonense", "Porto B", "Sporting CP B", "Tondela", "Torreense",
    "União de Leiria", "Vizela",
  ] },
  { country: "Portugal", league: "Liga 3", teams: ["Oliveirense", "Paços de Ferreira"] },
  // ---- Other top divisions -------------------------------------------------------
  { country: "Germany", league: "Bundesliga", teams: [
    "Augsburg", "Bayer Leverkusen", "Bayern Munich", "Borussia Dortmund", "Borussia Mönchengladbach",
    "Eintracht Frankfurt", "Elversberg", "FC Köln", "Hamburger SV", "Hoffenheim", "Mainz 05", "Paderborn", "RB Leipzig",
    "SC Freiburg", "Schalke 04", "Stuttgart", "Union Berlin", "Werder Bremen",
  ] },
  { country: "Germany", league: "2. Bundesliga", teams: ["Heidenheim", "St. Pauli", "Wolfsburg"] },
  { country: "Netherlands", league: "Eredivisie", teams: [
    "ADO Den Haag", "Ajax", "AZ Alkmaar", "Cambuur", "Excelsior", "Feyenoord", "Fortuna Sittard", "Go Ahead Eagles",
    "Groningen", "Heerenveen", "NEC Nijmegen", "PEC Zwolle", "PSV Eindhoven", "Sparta Rotterdam", "Telstar", "Twente",
    "Utrecht", "Willem II",
  ] },
  { country: "Netherlands", league: "Eerste Divisie", teams: ["Heracles Almelo", "NAC Breda", "Volendam"] },
  { country: "Scotland", league: "Scottish Premiership", teams: [
    "Aberdeen", "Celtic", "Dundee", "Dundee United", "Falkirk", "Hearts", "Hibernian", "Kilmarnock", "Motherwell",
    "Rangers", "St Johnstone", "St Mirren",
  ] },
  { country: "Scotland", league: "Scottish Championship", teams: ["Livingston"] },
  { country: "Belgium", league: "Pro League", teams: [
    "Anderlecht", "Antwerp", "Beveren", "Cercle Brugge", "Charleroi", "Club Brugge", "Genk", "Gent", "Kortrijk",
    "La Louvière", "Lommel", "Mechelen", "OH Leuven", "Sint-Truiden", "Standard Liège", "Union Saint-Gilloise",
    "Westerlo", "Zulte Waregem",
  ] },
  { country: "Belgium", league: "Challenger Pro League", teams: ["Dender"] },
  { country: "Turkey", league: "Süper Lig", teams: [
    "Alanyaspor", "Amedspor", "Başakşehir", "Beşiktaş", "Çorum FK", "Erzurumspor", "Eyüpspor", "Fenerbahçe",
    "Galatasaray", "Gaziantep FK", "Gençlerbirliği", "Göztepe", "Kasımpaşa", "Kocaelispor", "Konyaspor", "Rizespor",
    "Samsunspor", "Trabzonspor",
  ] },
  { country: "Turkey", league: "1. Lig", teams: ["Antalyaspor", "Fatih Karagümrük", "Kayserispor"] },
  { country: "United States", league: "MLS", teams: [
    "Atlanta United", "Austin FC", "CF Montréal", "Charlotte FC", "Chicago Fire", "Colorado Rapids", "Columbus Crew",
    "D.C. United", "FC Cincinnati", "FC Dallas", "Houston Dynamo", "Inter Miami", "LA Galaxy", "Los Angeles FC",
    "Minnesota United", "Nashville SC", "New England Revolution", "New York City FC", "New York Red Bulls",
    "Orlando City", "Philadelphia Union", "Portland Timbers", "Real Salt Lake", "San Diego FC", "San Jose Earthquakes",
    "Seattle Sounders", "Sporting Kansas City", "St. Louis City", "Toronto FC", "Vancouver Whitecaps",
  ] },
  { country: "Brazil", league: "Série A", teams: [
    "Athletico Paranaense", "Atlético Mineiro", "Bahia", "Botafogo", "Chapecoense", "Corinthians", "Coritiba",
    "Cruzeiro", "Flamengo", "Fluminense", "Grêmio", "Internacional", "Mirassol", "Palmeiras", "Red Bull Bragantino",
    "Remo", "Santos", "São Paulo", "Vasco da Gama", "Vitória",
  ] },
  { country: "Brazil", league: "Série B", teams: ["Ceará", "Fortaleza", "Juventude", "Sport Recife"] },
  { country: "Argentina", league: "Primera División", teams: [
    "Aldosivi", "Argentinos Juniors", "Atlético Tucumán", "Banfield", "Barracas Central", "Belgrano", "Boca Juniors",
    "Central Córdoba", "Defensa y Justicia", "Deportivo Riestra", "Estudiantes", "Estudiantes de Río Cuarto",
    "Gimnasia La Plata", "Gimnasia y Esgrima de Mendoza", "Huracán", "Independiente", "Independiente Rivadavia",
    "Instituto", "Lanús", "Newell's Old Boys", "Platense", "Racing Club", "River Plate", "Rosario Central",
    "San Lorenzo", "Sarmiento", "Talleres", "Tigre", "Unión", "Vélez Sarsfield",
  ] },
  { country: "Argentina", league: "Primera Nacional", teams: ["Godoy Cruz", "San Martín de San Juan"] },
  { country: "Mexico", league: "Liga MX", teams: [
    "América", "Atlante", "Atlas", "Atlético San Luis", "Cruz Azul", "Guadalajara", "Juárez", "León",
    "Mazatlán", // registration taken over by Atlante in 2026; no longer in Liga MX
    "Monterrey", "Necaxa", "Pachuca", "Puebla", "Pumas UNAM", "Querétaro", "Santos Laguna", "Tigres UANL", "Tijuana",
    "Toluca",
  ] },
  { country: "Saudi Arabia", league: "Saudi Pro League", teams: [
    "Abha", "Al-Ahli", "Al-Diriyah", "Al-Ettifaq", "Al-Faisaly", "Al-Fateh", "Al-Fayha", "Al-Hazem", "Al-Hilal",
    "Al-Ittihad", "Al-Khaleej", "Al-Kholood", "Al-Nassr", "Al-Qadsiah", "Al-Riyadh", "Al-Shabab", "Al-Taawoun",
    "NEOM SC",
  ] },
  { country: "Saudi Arabia", league: "First Division League", teams: ["Al-Najma", "Al-Okhdood", "Damac"] },
  { country: "Japan", league: "J1 League", teams: [
    "Avispa Fukuoka", "Cerezo Osaka", "Fagiano Okayama", "FC Tokyo", "Gamba Osaka", "JEF United Chiba",
    "Kashima Antlers", "Kashiwa Reysol", "Kawasaki Frontale", "Kyoto Sanga", "Machida Zelvia", "Mito HollyHock",
    "Nagoya Grampus", "Sanfrecce Hiroshima", "Shimizu S-Pulse", "Tokyo Verdy", "Urawa Red Diamonds", "V-Varen Nagasaki",
    "Vissel Kobe", "Yokohama F. Marinos",
  ] },
  { country: "Japan", league: "J2 League", teams: ["Albirex Niigata", "Shonan Bellmare", "Yokohama FC"] },
  { country: "Switzerland", league: "Super League", teams: [
    "Basel", "Grasshopper", "Lausanne-Sport", "Lugano", "Luzern", "Servette", "Sion", "St. Gallen", "Thun", "Vaduz",
    "Young Boys", "Zürich",
  ] },
  { country: "Switzerland", league: "Challenge League", teams: ["Winterthur"] },
  { country: "Austria", league: "Bundesliga", teams: [
    "Altach", "Austria Lustenau", "Austria Wien", "Grazer AK", "Hartberg", "LASK", "Rapid Wien", "Red Bull Salzburg",
    "Ried", "Sturm Graz", "Wolfsberger AC", "WSG Tirol",
  ] },
  { country: "Austria", league: "2. Liga", teams: ["Blau-Weiß Linz"] },
  { country: "Greece", league: "Super League", teams: [
    "AEK Athens", "Aris", "Asteras Tripolis", "Atromitos", "Iraklis", "Kalamata", "Kifisia", "Levadiakos", "OFI",
    "Olympiacos", "Panathinaikos", "Panetolikos", "PAOK", "Volos",
  ] },
  { country: "Greece", league: "Super League 2", teams: ["AEL Larissa", "Panserraikos"] },
  { country: "Denmark", league: "Superliga", teams: [
    "AGF", "Brøndby", "Copenhagen", "Horsens", "Lyngby", "Midtjylland", "Nordsjælland", "OB", "Randers", "Silkeborg",
    "SønderjyskE", "Viborg",
  ] },
  { country: "Denmark", league: "1st Division", teams: ["Fredericia", "Vejle"] },
  { country: "Sweden", league: "Allsvenskan", teams: [
    "AIK", "BK Häcken", "Brommapojkarna", "Degerfors", "Djurgården", "Elfsborg", "GAIS", "Halmstad", "Hammarby",
    "IFK Göteborg", "Kalmar FF", "Malmö FF", "Mjällby", "Örgryte", "Sirius", "Västerås SK",
  ] },
  { country: "Sweden", league: "Superettan", teams: ["IFK Norrköping", "Öster", "Värnamo"] },
  { country: "Norway", league: "Eliteserien", teams: [
    "Aalesund", "Bodø/Glimt", "Brann", "Fredrikstad", "HamKam", "KFUM Oslo", "Kristiansund", "Lillestrøm", "Molde",
    "Rosenborg", "Sandefjord", "Sarpsborg 08", "Start", "Tromsø", "Vålerenga", "Viking",
  ] },
  { country: "Norway", league: "1. divisjon", teams: ["Bryne", "Haugesund", "Strømsgodset"] },
  { country: "Australia", league: "A-League", teams: [
    "Adelaide United", "Auckland FC", "Brisbane Roar", "Central Coast Mariners", "Macarthur FC", "Melbourne City",
    "Melbourne Victory", "Newcastle Jets", "Perth Glory", "Sydney FC", "Wellington Phoenix", "Western Sydney Wanderers",
    "Western United", // A-League licence revoked in 2025; not in the 2026-27 competition
  ] },
  { country: "South Korea", league: "K League 1", teams: [
    "Bucheon FC 1995", "Daejeon Hana Citizen", "FC Anyang", "FC Seoul", "Gangwon FC", "Gimcheon Sangmu", "Gwangju FC",
    "Incheon United", "Jeju SK", "Jeonbuk Hyundai Motors", "Pohang Steelers", "Ulsan HD",
  ] },
  { country: "South Korea", league: "K League 2", teams: ["Daegu FC", "Suwon FC"] },
  // ---- UEFA league-phase clubs (2025-26 and 2026-27) from leagues not listed above ----
  // Only the European entrants, not the full divisions.
  { country: "Czech Republic", league: "First League", teams: [
    "Jablonec", "Sigma Olomouc", "Slavia Prague", "Sparta Prague", "Viktoria Plzeň",
  ] },
  { country: "Azerbaijan", league: "Premier League", teams: ["Qarabağ", "Sabah"] },
  { country: "Cyprus", league: "First Division", teams: ["AEK Larnaca", "Omonia", "Pafos"] },
  { country: "Kazakhstan", league: "Premier League", teams: ["Kairat"] },
  { country: "Croatia", league: "HNL", teams: ["Dinamo Zagreb", "Hajduk Split", "Rijeka"] },
  { country: "Serbia", league: "SuperLiga", teams: ["Crvena Zvezda"] },
  { country: "Hungary", league: "NB I", teams: ["Ferencváros"] },
  { country: "Israel", league: "Premier League", teams: ["Hapoel Be'er Sheva", "Maccabi Tel Aviv"] },
  { country: "Bulgaria", league: "First League", teams: ["CSKA Sofia", "Levski Sofia", "Ludogorets"] },
  { country: "Romania", league: "Liga I", teams: ["FCSB", "Universitatea Craiova"] },
  { country: "Ukraine", league: "Premier League", teams: ["Dynamo Kyiv", "Shakhtar Donetsk"] },
  { country: "Slovakia", league: "Super Liga", teams: ["Slovan Bratislava"] },
  { country: "Poland", league: "Ekstraklasa", teams: [
    "Jagiellonia Białystok", "Lech Poznań", "Legia Warsaw", "Raków Częstochowa",
  ] },
  { country: "North Macedonia", league: "First League", teams: ["Shkëndija"] },
  { country: "Slovenia", league: "PrvaLiga", teams: ["Celje"] },
  { country: "Bosnia and Herzegovina", league: "Premier League", teams: ["Borac Banja Luka", "Zrinjski"] },
  { country: "Gibraltar", league: "Football League", teams: ["Lincoln Red Imps"] },
  { country: "Armenia", league: "Premier League", teams: ["Ararat-Armenia", "Noah"] },
  { country: "Malta", league: "Premier League", teams: ["Hamrun Spartans"] },
  { country: "Kosovo", league: "Superleague", teams: ["Drita"] },
  { country: "Iceland", league: "Besta deild", teams: ["Breiðablik"] },
  { country: "Ireland", league: "Premier Division", teams: ["Shamrock Rovers", "Shelbourne"] },
  { country: "Finland", league: "Veikkausliiga", teams: ["KuPS"] },
  { country: "Albania", league: "Kategoria Superiore", teams: ["Egnatia"] },
  { country: "Georgia", league: "Erovnuli Liga", teams: ["Iberia 1999"] },
  { country: "Andorra", league: "Primera Divisió", teams: ["Inter Club d'Escaldes"] },
  { country: "Lithuania", league: "A Lyga", teams: ["Kauno Žalgiris"] },
  { country: "Latvia", league: "Virslīga", teams: ["Riga FC"] },
];

export const extraTopics = [
  { name: "Women's Football", description: "WSL, Liga F, NWSL and the Lionesses" },
  { name: "International", description: "World Cup, Euros, Nations League and qualifiers" },
  { name: "Europa & Conference League", description: "Thursday nights in Europe" },
  { name: "Fantasy Football", description: "FPL picks, captains and wildcards" },
  { name: "Academy & Youth", description: "Next generation, loans and breakthroughs" },
  { name: "Grassroots", description: "Your own team, Sunday league and school football" },
];
