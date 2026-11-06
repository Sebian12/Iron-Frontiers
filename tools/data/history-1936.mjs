// Hand-curated 1936 political situation. This is the file to edit when a border is wrong.
//
// How ownership is decided for every Natural Earth admin-1 region (in this order):
//   1. ADMIN1_OVERRIDES["<country>|<region>"]  - a whole modern region belonged to someone else in 1936
//   2. ADMIN0_TO_OWNER["<modern country>"]     - default owner of a modern country's territory
//   3. POLYGON_OVERRIDES                       - hand-drawn [lon, lat] polygons that repaint land pixels
//                                                (for borders that cut through modern regions)

// ---------- owners that are not plain sovereign states ----------
// Colors are the hand-tuned palette of the published map, so a rebuild keeps the same look.
// overlord: the country this one is subject to (colony, protectorate, puppet).
// African colonies are NOT listed as subjects: their territory simply belongs to the colonial power.
export const OWNER_INFO = {
  'Afghanistan': { color: [64, 160, 167] },
  'Albania': { color: [149, 45, 102] },
  'Argentina': { color: [145, 157, 236] },
  'Australia': { color: [57, 143, 97] },
  'Austria': { color: [194, 198, 215] },
  'Belgium': { color: [193, 171, 8] },
  'Bhutan': { color: [172, 122, 88] },
  'Bolivia': { color: [204, 166, 108] },
  'Brazil': { color: [76, 145, 63] },
  'British Raj': { overlord: 'United Kingdom', color: [226, 135, 40] },
  'Bulgaria': { color: [51, 155, 0] },
  'Canada': { color: [233, 59, 59] },
  'Chile': { color: [155, 101, 107] },
  'China': { color: [40, 40, 140] },
  'Colombia': { color: [222, 187, 91] },
  'Communist China': { color: [245, 12, 55] },
  'Costa Rica': { color: [152, 128, 43] },
  'Cuba': { color: [140, 65, 166] },
  'Czechoslovakia': { color: [54, 167, 156] },
  'Denmark': { color: [153, 116, 93] },
  'Dominican Republic': { color: [152, 130, 191] },
  'Dutch East Indies': { overlord: 'Netherlands', color: [252, 57, 50] },
  'Ecuador': { color: [249, 146, 98] },
  'Egypt': { color: [230, 230, 70] },
  'El Salvador': { color: [152, 130, 191] },
  'Estonia': { color: [50, 135, 175] },
  'Ethiopia': { color: [152, 130, 191] },
  'Finland': { color: [205, 212, 228] },
  'France': { color: [57, 113, 228] },
  'French Indochina': { overlord: 'France', color: [135, 167, 213] },
  'Germany': { color: [102, 96, 87] },
  'Greece': { color: [93, 181, 227] },
  'Guangxi': { color: [71, 113, 97] },
  'Guatemala': { color: [72, 49, 112] },
  'Haiti': { color: [174, 113, 113] },
  'Honduras': { color: [128, 145, 65] },
  'Hungary': { color: [249, 126, 98] },
  'Iceland': { color: [100, 125, 175] },
  'Iran': { color: [71, 113, 97] },
  'Iraq': { color: [178, 114, 99] },
  'Ireland': { color: [80, 159, 90] },
  'Italy': { color: [67, 127, 63] },
  'Japan': { color: [255, 201, 179] },
  'Latvia': { color: [75, 77, 186] },
  'Liberia': { color: [152, 130, 191] },
  'Lithuania': { color: [219, 219, 119] },
  'Luxembourg': { color: [65, 175, 179] },
  'Manchukuo': { color: [255, 120, 71] },
  'Mengjiang': { color: [185, 255, 152] },
  'Mexico': { color: [104, 152, 83] },
  'Mongolia': { color: [102, 96, 87] },
  'Nepal': { color: [152, 130, 191] },
  'Netherlands': { color: [203, 138, 74] },
  'New Zealand': { color: [152, 130, 191] },
  'Nicaragua': { color: [146, 179, 191] },
  'Norway': { color: [111, 71, 71] },
  'Oman': { color: [155, 101, 107] },
  'Panama': { color: [152, 130, 191] },
  'Paraguay': { color: [57, 113, 228] },
  'Peru': { color: [196, 189, 204] },
  'Philippines': { color: [0, 40, 195] },
  'Poland': { color: [214, 102, 139] },
  'Portugal': { color: [39, 116, 70] },
  'Romania': { color: [215, 196, 72] },
  'Saudi Arabia': { color: [171, 190, 152] },
  'Shanxi': { color: [82, 2, 15] },
  'Siam': { color: [171, 190, 152] },
  'South Africa': { color: [195, 107, 160] },
  'Soviet Union': { color: [125, 13, 24] },
  'Spain': { color: [242, 205, 94] },
  'Sweden': { color: [36, 132, 247] },
  'Switzerland': { color: [224, 5, 5] },
  'Tibet': { color: [80, 100, 45] },
  'Turkey': { color: [171, 190, 152] },
  'Unclaimed': { color: [120, 120, 120] },
  'United Kingdom': { color: [201, 56, 93] },
  'United States': { color: [20, 133, 237] },
  'Uruguay': { color: [171, 190, 152] },
  'Venezuela': { color: [171, 190, 152] },
  'Xibei San Ma': { color: [105, 90, 132] },
  'Xinjiang': { color: [71, 190, 152] },
  'Yemen': { color: [155, 101, 107] },
  'Yugoslavia': { color: [72, 73, 126] },
  'Yunnan': { color: [114, 148, 80] },
};

// ---------- modern country -> 1936 owner ----------
const GROUPS = {
  'United Kingdom': [
    'United Kingdom', 'Akrotiri Sovereign Base Area', 'Dhekelia Sovereign Base Area', 'Anguilla', 'Antigua and Barbuda',
    'Bahrain', 'Barbados', 'Belize', 'Bermuda', 'Botswana', 'British Indian Ocean Territory', 'British Virgin Islands',
    'Brunei', 'Cayman Islands', 'Cyprus', 'Northern Cyprus', 'Dominica', 'Falkland Islands', 'Fiji', 'Gaza Strip', 'West Bank',
    'Israel', 'Jordan', 'Gambia', 'Ghana', 'Gibraltar', 'Grenada', 'Guernsey', 'Jersey', 'Isle of Man', 'Guyana', 'Hong Kong S.A.R.',
    'Jamaica', 'Kenya', 'Kiribati', 'Kuwait', 'Lesotho', 'Malawi', 'Malaysia', 'Maldives', 'Malta', 'Mauritius', 'Montserrat',
    'Nigeria', 'Pitcairn Islands', 'Qatar', 'S. Sudan', 'Saint Helena', 'Saint Kitts and Nevis', 'Saint Lucia',
    'Saint Vincent and the Grenadines', 'Seychelles', 'Sierra Leone', 'Singapore', 'Solomon Islands', 'Somaliland',
    'South Georgia and the Islands', 'Sri Lanka', 'Sudan', 'Swaziland', 'The Bahamas', 'Tonga', 'Trinidad and Tobago',
    'Turks and Caicos Islands', 'Tuvalu', 'Uganda', 'United Arab Emirates', 'United Republic of Tanzania', 'Vanuatu',
    'Zambia', 'Zimbabwe',
  ],
  'British Raj': ['India', 'Pakistan', 'Bangladesh', 'Myanmar', 'Siachen Glacier'],
  France: [
    'France', 'Algeria', 'Benin', 'Burkina Faso', 'Cameroon', 'Central African Republic', 'Chad', 'Clipperton Island', 'Comoros',
    'Republic of the Congo', 'Djibouti', 'French Polynesia', 'French Southern and Antarctic Lands', 'Gabon', 'Guinea',
    'Ivory Coast', 'Lebanon', 'Madagascar', 'Mali', 'Mauritania', 'Monaco', 'Morocco', 'New Caledonia', 'Niger',
    'Saint Barthelemy', 'Saint Martin', 'Saint Pierre and Miquelon', 'Senegal', 'Syria', 'Togo', 'Tunisia', 'Wallis and Futuna',
  ],
  'French Indochina': ['Vietnam', 'Laos', 'Cambodia'],
  Italy: ['Italy', 'Eritrea', 'Libya', 'San Marino', 'Somalia', 'Vatican'],
  Japan: ['Japan', 'North Korea', 'South Korea', 'Taiwan', 'Palau', 'Federated States of Micronesia', 'Marshall Islands', 'Northern Mariana Islands'],
  'Soviet Union': ['Russia', 'Ukraine', 'Belarus', 'Armenia', 'Azerbaijan', 'Georgia', 'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan', 'Baykonur Cosmodrome'],
  Romania: ['Romania', 'Moldova'],
  Czechoslovakia: ['Czech Republic', 'Slovakia'],
  Yugoslavia: ['Republic of Serbia', 'Croatia', 'Slovenia', 'Bosnia and Herzegovina', 'Montenegro', 'Macedonia', 'Kosovo'],
  Siam: ['Thailand'],
  Spain: ['Spain', 'Andorra', 'Equatorial Guinea', 'Western Sahara'],
  Portugal: ['Portugal', 'Angola', 'Cape Verde', 'East Timor', 'Guinea Bissau', 'Macau S.A.R', 'Mozambique', 'Sao Tome and Principe'],
  Belgium: ['Belgium', 'Burundi', 'Democratic Republic of the Congo', 'Rwanda'],
  Netherlands: ['Netherlands', 'Aruba', 'Caribbean Netherlands', 'Curaçao', 'Sint Maarten', 'Suriname'],
  'Dutch East Indies': ['Indonesia'],
  Denmark: ['Denmark', 'Faroe Islands', 'Greenland'],
  Finland: ['Finland', 'Aland'],
  Switzerland: ['Switzerland', 'Liechtenstein'],
  'United States': [
    'United States of America', 'American Samoa', 'Guam', 'Puerto Rico', 'United States Minor Outlying Islands',
    'United States Virgin Islands', 'US Naval Base Guantanamo Bay',
  ],
  Australia: ['Australia', 'Ashmore and Cartier Islands', 'Coral Sea Islands', 'Heard Island and McDonald Islands', 'Indian Ocean Territories', 'Nauru', 'Norfolk Island', 'Papua New Guinea'],
  'New Zealand': ['New Zealand', 'Cook Islands', 'Niue', 'Samoa'],
  'South Africa': ['South Africa', 'Namibia'],
  China: ['China'],
  Philippines: ['Philippines'],
  Egypt: ['Egypt'],
};
// Countries that were simply themselves in 1936.
const INDEPENDENT = [
  'Afghanistan', 'Albania', 'Argentina', 'Austria', 'Bhutan', 'Bolivia', 'Brazil', 'Bulgaria', 'Canada', 'Chile', 'Colombia',
  'Costa Rica', 'Cuba', 'Dominican Republic', 'Ecuador', 'El Salvador', 'Estonia', 'Ethiopia', 'Germany', 'Greece', 'Guatemala',
  'Haiti', 'Honduras', 'Hungary', 'Iceland', 'Iran', 'Iraq', 'Ireland', 'Latvia', 'Liberia', 'Lithuania', 'Luxembourg', 'Mexico',
  'Mongolia', 'Nepal', 'Nicaragua', 'Norway', 'Oman', 'Panama', 'Paraguay', 'Peru', 'Poland', 'Saudi Arabia', 'Sweden', 'Turkey',
  'Uruguay', 'Venezuela', 'Yemen',
];

export const ADMIN0_TO_OWNER = {};
for (const [owner, countries] of Object.entries(GROUPS)) for (const c of countries) ADMIN0_TO_OWNER[c] = owner;
for (const c of INDEPENDENT) ADMIN0_TO_OWNER[c] = c;
ADMIN0_TO_OWNER['Spratly Is.'] = 'Unclaimed';
ADMIN0_TO_OWNER.Antarctica = 'Unclaimed';

// ---------- whole modern regions that belonged to someone else ----------
const to = (owner, ...keys) => Object.fromEntries(keys.map((k) => [k, owner]));
export const ADMIN1_OVERRIDES = {
  // China, split roughly like the 1936 warlord map
  ...to('Tibet', 'China|Xizang'),
  ...to('Xinjiang', 'China|Xinjiang'),
  ...to('Mengjiang', 'China|Inner Mongol'),
  ...to('Xibei San Ma', 'China|Gansu', 'China|Qinghai', 'China|Ningxia'),
  ...to('Yunnan', 'China|Yunnan'),
  ...to('Guangxi', 'China|Guangxi'),
  ...to('Shanxi', 'China|Shanxi'),
  ...to('Manchukuo', 'China|Heilongjiang', 'China|Jilin', 'China|Liaoning'),
  // Germany: East Prussia and the old eastern provinces
  ...to('Germany', 'Poland|Warmian-Masurian', 'Poland|Lubusz', 'Poland|West Pomeranian', 'Poland|Lower Silesian', 'Poland|Opole', 'Russia|Kaliningrad'),
  // Poland: the eastern territories
  ...to('Poland', "Ukraine|L'viv", "Ukraine|Ternopil'", "Ukraine|Ivano-Frankivs'k", 'Ukraine|Volyn', 'Ukraine|Rivne', 'Belarus|Brest', 'Belarus|Grodno'),
  ...to('Czechoslovakia', 'Ukraine|Transcarpathia'),
  ...to('Romania', 'Ukraine|Chernivtsi', 'Bulgaria|Silistra', 'Bulgaria|Dobrich'),
  ...to('Soviet Union', 'Moldova|Transnistria', 'Moldova|Stîngă Nistrului', 'Moldova|Grigoriopol', 'Moldova|Camenca'),
  // Japan: South Sakhalin and the Kurils (north Sakhalin is repainted below)
  ...to('Japan', 'Russia|Sakhalin'),
  // Middle East / Africa / small colonies
  ...to('France', 'Turkey|Hatay', 'India|Puducherry'),
  ...to('Portugal', 'India|Goa'),
  ...to('United Kingdom', 'Canada|Newfoundland and Labrador'),
  ...to('United Kingdom', 'Yemen|Hadramawt', 'Yemen|Al Mahrah', 'Yemen|Shabwah', 'Yemen|Abyan', 'Yemen|Lahij', 'Yemen|`Adan', "Yemen|Al Dali'"),
  ...to('Spain', 'Morocco|Tanger - Tétouan', 'Morocco|Laâyoune - Boujdour - Sakia El Hamra', 'Morocco|Oued el Dahab'),
};

// ---------- hand-drawn polygons ([lon, lat] rings), applied in this order ----------
// only: the polygon repaints only land that currently belongs to one of these owners.
export const POLYGON_OVERRIDES = [
  // Finland 1936: Karelian Isthmus + Ladoga Karelia (the west side runs inside Finland on purpose)
  { name: 'Karelia', owner: 'Finland', only: ['Soviet Union'], ring: [[26.8, 60.08], [29.95, 60.08], [30.35, 60.38], [31.2, 60.75], [32.6, 61.0], [33.0, 61.45], [32.9, 61.95], [32.6, 62.35], [32.0, 62.75], [31.5, 63.0], [30.9, 63.15], [28.0, 63.15], [26.8, 63.15]] },
  // Finland 1936: Petsamo corridor to the Arctic Ocean. The western edge reaches past the Pasvik
  // river, so Finland (not the USSR) owns the east bank and the USSR never touches Norway; the
  // `only` filter keeps Norway's own land untouched.
  { name: 'Petsamo', owner: 'Finland', only: ['Soviet Union'], ring: [[28.4, 69.0], [31.6, 69.0], [32.4, 69.4], [33.2, 69.55], [33.2, 69.95], [28.4, 70.0]] },
  // (Petseri, Narva east bank and Abrene were Estonian/Latvian in 1936; disabled until they get real shapes)
  // Poland 1936: Minsk/Vitebsk borderlands and the Vilnius region
  { name: 'Western Belarus', owner: 'Poland', only: ['Soviet Union'], ring: [[25.9, 52.0], [27.5, 52.0], [27.4, 52.9], [27.2, 53.5], [27.3, 54.0], [27.2, 54.6], [27.8, 54.9], [28.3, 55.3], [28.45, 55.75], [28.0, 56.1], [26.4, 56.1], [25.5, 55.4]] },
  { name: 'Vilnius region', owner: 'Poland', only: ['Lithuania'], ring: [[23.5, 53.9], [24.0, 54.35], [24.85, 54.45], [24.9, 54.85], [25.2, 55.1], [25.9, 55.45], [26.6, 55.75], [27.5, 55.8], [27.5, 53.9]] },
  // Poland 1936 vs Germany: everything west of the 1936 border line (north to south) was German.
  { name: 'German side of the 1936 border', owner: 'Germany', only: ['Poland'], ring: [[17.95, 54.9], [17.95, 54.78], [17.75, 54.58], [17.55, 54.3], [17.45, 54.05], [17.36, 53.7], [17.3, 53.45], [17.1, 53.22], [16.8, 53.0], [16.35, 53.0], [15.9, 52.75], [15.82, 52.4], [15.9, 52.1], [16.05, 51.85], [16.45, 51.7], [16.9, 51.55], [17.45, 51.5], [17.75, 51.35], [18.05, 51.15], [18.25, 51.0], [18.1, 50.7], [18.55, 50.55], [18.9, 50.45], [18.97, 50.3], [18.6, 50.17], [18.35, 50.05], [18.1, 49.95], [8.0, 49.95], [8.0, 54.95]] },
  // Romania 1936: Southern Bessarabia (Budjak)
  { name: 'Budjak', owner: 'Romania', only: ['Soviet Union'], ring: [[28.1, 45.2], [30.3, 45.2], [30.5, 46.3], [29.7, 46.55], [28.9, 46.45], [28.1, 46.1]] },
  // Italy 1936: Julian March, Istria, Kvarner islands, Zara, Lastovo, Dodecanese
  { name: 'Julian March and Istria', owner: 'Italy', only: ['Yugoslavia'], ring: [[13.3, 44.7], [13.3, 46.6], [13.95, 46.6], [14.3, 46.1], [14.5, 45.65], [14.45, 45.45], [14.45, 45.3], [14.25, 44.9], [14.05, 44.7]] },
  { name: 'Cres and Losinj', owner: 'Italy', only: ['Yugoslavia'], ring: [[14.2, 44.4], [14.7, 44.4], [14.7, 44.95], [14.2, 44.95]] },
  { name: 'Zara', owner: 'Italy', only: ['Yugoslavia'], ring: [[15.15, 44.05], [15.3, 44.05], [15.3, 44.2], [15.15, 44.2]] },
  { name: 'Lastovo', owner: 'Italy', only: ['Yugoslavia'], ring: [[16.7, 42.7], [17.0, 42.7], [17.0, 42.85], [16.7, 42.85]] },
  { name: 'Dodecanese', owner: 'Italy', only: ['Greece'], ring: [[26.25, 35.3], [29.9, 35.3], [29.9, 37.55], [26.25, 37.55]] },
  // Spanish Sahara (Cape Juby / Tarfaya) and Spanish Morocco
  { name: 'Cape Juby and Tarfaya', owner: 'Spain', only: ['France'], ring: [[-17.0, 25.0], [-8.6, 25.0], [-8.6, 28.4], [-17.0, 28.4]] },
  { name: 'Spanish Morocco east', owner: 'Spain', only: ['France'], ring: [[-5.5, 34.85], [-2.3, 34.85], [-2.3, 35.5], [-5.5, 35.5]] },
  // China details
  { name: 'Rehe (Hebei north)', owner: 'Manchukuo', only: ['China'], ring: [[115.8, 40.75], [116.1, 40.55], [116.6, 40.42], [117.2, 40.28], [117.9, 40.18], [118.5, 40.33], [119.2, 40.2], [119.9, 40.5], [120.1, 43.0], [115.8, 43.0]] },
  { name: 'Eastern Inner Mongolia', owner: 'Manchukuo', only: ['Mengjiang'], ring: [[116.5, 41.0], [126.5, 41.0], [126.5, 53.6], [115.0, 53.6], [115.0, 47.0], [116.5, 44.5]] },
  { name: 'Alxa', owner: 'Xibei San Ma', only: ['Mengjiang'], ring: [[96.0, 37.0], [106.5, 37.0], [106.5, 43.5], [96.0, 43.5]] },
  { name: 'Communist north Shaanxi', owner: 'Communist China', only: ['China'], ring: [[106.8, 35.7], [111.2, 35.7], [111.2, 39.9], [106.8, 39.9]] },
  { name: 'Kwantung', owner: 'Japan', only: ['Manchukuo'], ring: [[120.9, 38.7], [122.3, 38.7], [122.3, 39.6], [120.9, 39.6]] },
  // North Sakhalin stayed Soviet
  { name: 'North Sakhalin', owner: 'Soviet Union', only: ['Japan'], ring: [[141.0, 50.0], [145.0, 50.0], [145.0, 55.0], [141.0, 55.0]] },
];

// ---------- regions that always stay their own province (capitals and big cities) ----------
// Format "<modern country>|<region name>", exactly as in Natural Earth.
export const PROTECTED_REGIONS = [
  'Germany|Berlin', 'Germany|Hamburg', 'Germany|Bremen', 'Austria|Wien', 'Czech Republic|Prague', 'Hungary|Budapest',
  'Belgium|Brussels', 'France|Paris', 'Italy|Roma', 'Russia|Moskva', 'Ukraine|Kiev', 'Belarus|Minsk', 'China|Beijing',
  'China|Tianjin', 'China|Shanghai', 'Japan|Tokyo', 'Turkey|Istanbul', 'Spain|Madrid', 'Sweden|Stockholm',
  'United States of America|District of Columbia', 'Macau S.A.R|Macau', 'New Zealand|Wellington',
];