// Downloads the flags used by the 1936 campaign. Wikimedia thumbnails are used so the repository
// does not carry multi-megabyte SVG coats of arms. Historical variants are preferred where the
// country's flag in 1936 differed from its modern flag; the fallback is the modern national flag.
import { access, mkdir, writeFile } from 'node:fs/promises';

const FLAGS = {
  Argentina: 'Flag_of_Argentina.svg',
  Uruguay: 'Flag_of_Uruguay.svg',
  'Dutch East Indies': 'Flag_of_the_Netherlands.svg',
  'United Kingdom': 'Flag_of_the_United_Kingdom.svg',
  Chile: 'Flag_of_Chile.svg',
  Bolivia: 'Flag_of_Bolivia.svg',
  Peru: 'Flag_of_Peru.svg',
  'British Raj': 'British_Raj_Red_Ensign.svg',
  Xinjiang: 'Flag_of_Xinjiang_(1933–1944).svg',
  Tibet: 'Flag_of_Tibet.svg',
  France: 'Flag_of_France.svg',
  Ethiopia: 'Flag_of_Ethiopia_(1897–1974).svg',
  Italy: 'Flag_of_Italy_(1861-1946)_crowned.svg',
  Netherlands: 'Flag_of_the_Netherlands.svg',
  Japan: 'Flag_of_Japan.svg',
  Spain: 'Flag_of_Spain_(1931–1939).svg',
  'Costa Rica': 'Flag_of_Costa_Rica.svg',
  Nicaragua: 'Flag_of_Nicaragua.svg',
  Belgium: 'Flag_of_Belgium.svg',
  Bhutan: 'Flag_of_Bhutan.svg',
  'Soviet Union': 'Flag_of_the_Soviet_Union_(1936–1955).svg',
  Poland: 'Flag_of_Poland.svg',
  'South Africa': 'Flag_of_South_Africa_(1928–1994).svg',
  Oman: 'Flag_of_Oman_(1891–1970).svg',
  Lithuania: 'Flag_of_Lithuania_(1918–1940).svg',
  Brazil: 'Flag_of_Brazil.svg',
  Mongolia: 'Flag_of_Mongolia_(1930–1940).svg',
  Mengjiang: 'Flag_of_Mengjiang.svg',
  'Xibei San Ma': 'Flag_of_the_Republic_of_China.svg',
  Czechoslovakia: 'Flag_of_Czechoslovakia.svg',
  Germany: 'Flag_of_Germany_(1935–1945).svg',
  Estonia: 'Flag_of_Estonia.svg',
  Latvia: 'Flag_of_Latvia.svg',
  Norway: 'Flag_of_Norway.svg',
  Sweden: 'Flag_of_Sweden.svg',
  Finland: 'Flag_of_Finland.svg',
  'French Indochina': 'Flag_of_France.svg',
  Luxembourg: 'Flag_of_Luxembourg.svg',
  Yugoslavia: 'Flag_of_Yugoslavia_(1918–1941).svg',
  Albania: 'Flag_of_Albania_(1934–1939).svg',
  Turkey: 'Flag_of_Turkey.svg',
  Yunnan: 'Flag_of_the_Republic_of_China.svg',
  Denmark: 'Flag_of_Denmark.svg',
  Romania: 'Flag_of_Romania.svg',
  Hungary: 'Flag_of_Hungary_(1915-1918,_1919-1946).svg',
  Ireland: 'Flag_of_Ireland.svg',
  Greece: 'Flag_of_Greece_(1822–1978).svg',
  Liberia: 'Flag_of_Liberia.svg',
  Austria: 'Flag_of_Austria_(1934–1938).svg',
  Iraq: 'Flag_of_Iraq_(1932–1958).svg',
  Switzerland: 'Flag_of_Switzerland.svg',
  Iran: 'Flag_of_Iran_(1933–1964).svg',
  Portugal: 'Flag_of_Portugal.svg',
  'Saudi Arabia': 'Flag_of_Saudi_Arabia_(1934–1938).svg',
  Bulgaria: 'Flag_of_Bulgaria.svg',
  Siam: 'Flag_of_Thailand.svg',
  Haiti: 'Flag_of_Haiti_(1859–1964).svg',
  'Dominican Republic': 'Flag_of_the_Dominican_Republic.svg',
  'El Salvador': 'Flag_of_El_Salvador.svg',
  Guatemala: 'Flag_of_Guatemala.svg',
  Afghanistan: 'Flag_of_Afghanistan_(1930–1973).svg',
  'United States': 'Flag_of_the_United_States_(1912-1959).svg',
  Cuba: 'Flag_of_Cuba.svg',
  Honduras: 'Flag_of_Honduras.svg',
  Ecuador: 'Flag_of_Ecuador.svg',
  Colombia: 'Flag_of_Colombia.svg',
  Paraguay: 'Flag_of_Paraguay_(1935–1968).svg',
  Manchukuo: 'Flag_of_Manchukuo.svg',
  Nepal: 'Flag_of_Nepal_(19th_century-1962).svg',
  Guangxi: 'Flag_of_the_Republic_of_China.svg',
  Canada: 'Flag_of_Canada_(1921–1957).svg',
  Mexico: 'Flag_of_Mexico_(1934–1968).svg',
  Panama: 'Flag_of_Panama.svg',
  Venezuela: 'Flag_of_Venezuela_(1930–1954).svg',
  Australia: 'Flag_of_Australia_(1908–1953).svg',
  Egypt: 'Flag_of_Egypt_(1922–1953).svg',
  Yemen: 'Flag_of_Yemen_(1927–1962).svg',
  China: 'Flag_of_the_Republic_of_China.svg',
  'New Zealand': 'Flag_of_New_Zealand.svg',
  Philippines: 'Flag_of_the_Philippines.svg',
  Iceland: 'Flag_of_Iceland_(1918–1944).svg',
  Shanxi: 'Flag_of_the_Republic_of_China.svg',
  'Communist China': 'National_Flag_of_Chinese_Soviet_Republic.svg',
};

const FALLBACK = {
  Xinjiang: 'Flag_of_the_Republic_of_China.svg',
  Oman: 'Flag_of_Oman.svg',
  Hungary: 'Flag_of_Hungary.svg',
  Austria: 'Flag_of_Austria.svg',
  Nepal: 'Flag_of_Nepal.svg',
  Yemen: 'Flag_of_Yemen.svg',
  'Saudi Arabia': 'Flag_of_Saudi_Arabia.svg',
  Paraguay: 'Flag_of_Paraguay.svg',
  Mongolia: 'Flag_of_Mongolia.svg',
  Greece: 'Flag_of_Greece.svg',
  Iraq: 'Flag_of_Iraq.svg',
  Austria: 'Flag_of_Austria.svg',
  Greece2: 'Flag_of_Greece.svg',
  'Dominican Republic': 'Flag_of_the_Dominican_Republic.svg',
  'El Salvador': 'Flag_of_El_Salvador.svg',
  Guatemala: 'Flag_of_Guatemala.svg',
  Afghanistan: 'Flag_of_Afghanistan.svg',
  'United States': 'Flag_of_the_United_States.svg',
  Cuba: 'Flag_of_Cuba.svg',
  Honduras: 'Flag_of_Honduras.svg',
  Ecuador: 'Flag_of_Ecuador.svg',
  Colombia: 'Flag_of_Colombia.svg',
  Manchukuo: 'Flag_of_Manchukuo.svg',
  Guangxi: 'Flag_of_the_Republic_of_China.svg',
  Canada: 'Flag_of_Canada.svg',
  Mexico: 'Flag_of_Mexico.svg',
  Panama: 'Flag_of_Panama.svg',
  Venezuela: 'Flag_of_Venezuela.svg',
  Australia: 'Flag_of_Australia.svg',
  Egypt: 'Flag_of_Egypt.svg',
  China: 'Flag_of_the_Republic_of_China.svg',
  'New Zealand': 'Flag_of_New_Zealand.svg',
  Philippines: 'Flag_of_the_Philippines.svg',
  Iceland: 'Flag_of_Iceland.svg',
  Shanxi: 'Flag_of_the_Republic_of_China.svg',
  'Communist China': 'National_Flag_of_Chinese_Soviet_Republic.svg',
};

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const out = new URL('../public/flags/', import.meta.url);
await mkdir(out, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFlag(file) {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file).replace(/%20/g, '_')}?width=330`;
  let lastError = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'user-agent': 'IronFrontiers/1.0 (local game asset build)' } });
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 200) throw new Error(`empty ${file}`);
      return bytes;
    }
    lastError = `${response.status} ${file}`;
    if (response.status !== 429 && response.status !== 503) break;
    const retryAfter = Number(response.headers.get('retry-after') ?? 0);
    await sleep(Math.max(1200, retryAfter * 1000) + attempt * 700);
  }
  throw new Error(lastError);
}

const failures = [];
for (const [name, file] of Object.entries(FLAGS)) {
  const target = new URL(`${slug(name)}.png`, out);
  try {
    await access(target);
    console.log(`skip ${name}`);
    continue;
  } catch { /* download it */ }
  let saved = false;
  for (const candidate of [file, FALLBACK[name]].filter(Boolean)) {
    try {
      const bytes = await fetchFlag(candidate);
      await writeFile(target, bytes);
      console.log(`ok ${name} <- ${candidate}`);
      saved = true;
      await sleep(900);
      break;
    } catch (error) {
      console.warn(`retry ${name}: ${error.message}`);
      await sleep(1500);
    }
  }
  if (!saved) failures.push(name);
}

if (failures.length) {
  console.error(`FAILED: ${failures.join(', ')}`);
  process.exitCode = 1;
}
