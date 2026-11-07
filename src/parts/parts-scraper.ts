import { chromium, type Browser, type Page } from 'playwright';
import { getDatabase } from '../config/database.js';
import { settingsRepo } from '../database/repositories/settings.repo.js';
import { clickAddToCartForPart } from './rockauto-cart-click.js';

export interface ScrapedPart {
  vendor: string;
  vendor_part_id: string;
  part_name: string;
  part_number: string;
  price_cents: number;
  item_type: 'part' | 'misc';
  source_url: string;
  image_url?: string;
  brand?: string;
  fitment_position?: string;
  availability?: string;
  shipping_estimate?: string;
  cart_action?: string;       // RockAuto Add to Cart form action URL
  cart_nck?: string;           // RockAuto CSRF token for cart form
  cart_hidden_fields?: Record<string, string>; // Additional hidden form fields
  option_value?: string;
  option_label?: string;
}

export interface SearchOptions {
  vehicleContext?: string;
  vehicle?: {
    year?: number | null;
    make?: string | null;
    model?: string | null;
    engine?: string | null;
  };
  zipCode?: string;
  vendors?: string[];
}

// ── Keyword to RockAuto category mapping ──
export interface PartCategory {
  category: string;
  subcategory: string;
  parttype: number;
}

const CATEGORY_MAP: Record<string, PartCategory[]> = {
  'brake pad': [{ category: 'brake+&+wheel+hub', subcategory: 'brake+pad', parttype: 1684 }],
  'brake pads': [{ category: 'brake+&+wheel+hub', subcategory: 'brake+pad', parttype: 1684 }],
  'brake rotor': [{ category: 'brake+&+wheel+hub', subcategory: 'rotor', parttype: 1896 }],
  'brake rotors': [{ category: 'brake+&+wheel+hub', subcategory: 'rotor', parttype: 1896 }],
  'rotor': [{ category: 'brake+&+wheel+hub', subcategory: 'rotor', parttype: 1896 }],
  'rotors': [{ category: 'brake+&+wheel+hub', subcategory: 'rotor', parttype: 1896 }],
  'brake disc': [{ category: 'brake+&+wheel+hub', subcategory: 'rotor', parttype: 1896 }],
  'brake caliper': [{ category: 'brake+&+wheel+hub', subcategory: 'caliper', parttype: 1704 }],
  'caliper': [{ category: 'brake+&+wheel+hub', subcategory: 'caliper', parttype: 1704 }],
  'brake shoe': [{ category: 'brake+&+wheel+hub', subcategory: 'brake+shoe', parttype: 1680 }],
  'brake shoes': [{ category: 'brake+&+wheel+hub', subcategory: 'brake+shoe', parttype: 1680 }],
  'oil filter': [{ category: 'engine', subcategory: 'oil+filter', parttype: 5340 }],
  'air filter': [{ category: 'fuel+&+air', subcategory: 'air+filter', parttype: 6192 }],
  'engine air filter': [{ category: 'fuel+&+air', subcategory: 'air+filter', parttype: 6192 }],
  'cabin air filter': [{ category: 'heat+&+air+conditioning', subcategory: 'cabin+air+filter', parttype: 6832 }],
  'fuel filter': [{ category: 'fuel+&+air', subcategory: 'fuel+filter', parttype: 6200 }],
  'spark plug': [{ category: 'ignition', subcategory: 'spark+plug', parttype: 7212 }],
  'spark plugs': [{ category: 'ignition', subcategory: 'spark+plug', parttype: 7212 }],
  'ignition coil': [{ category: 'ignition', subcategory: 'ignition+coil', parttype: 7060 }],
  'alternator': [{ category: 'electrical', subcategory: 'alternator+/+generator', parttype: 2412 }],
  'starter': [{ category: 'electrical', subcategory: 'starter+motor', parttype: 4152 }],
  'starter motor': [{ category: 'electrical', subcategory: 'starter+motor', parttype: 4152 }],
  'water pump': [{ category: 'cooling+system', subcategory: 'water+pump', parttype: 2208 }],
  'thermostat': [{ category: 'cooling+system', subcategory: 'thermostat', parttype: 2200 }],
  'radiator': [{ category: 'cooling+system', subcategory: 'radiator', parttype: 2172 }],
  'ac compressor': [{ category: 'heat+&+air+conditioning', subcategory: 'a/c+compressor', parttype: 6628 }],
  'a/c compressor': [{ category: 'heat+&+air+conditioning', subcategory: 'a/c+compressor', parttype: 6628 }],
  'shock': [{ category: 'suspension', subcategory: 'shock+absorber', parttype: 7556 }],
  'shock absorber': [{ category: 'suspension', subcategory: 'shock+absorber', parttype: 7556 }],
  'strut': [{ category: 'suspension', subcategory: 'strut', parttype: 7584 }],
  'struts': [{ category: 'suspension', subcategory: 'strut', parttype: 7584 }],
  'control arm': [{ category: 'suspension', subcategory: 'control+arm', parttype: 10401 }],
  'tie rod': [{ category: 'steering', subcategory: 'tie+rod+end', parttype: 7428 }],
  'tie rod end': [{ category: 'steering', subcategory: 'tie+rod+end', parttype: 7428 }],
  'ball joint': [{ category: 'suspension', subcategory: 'ball+joint', parttype: 10070 }],
  'wheel bearing': [{ category: 'brake+&+wheel+hub', subcategory: 'wheel+bearing+&+hub', parttype: 1636 }],
  'wheel bearings': [{ category: 'brake+&+wheel+hub', subcategory: 'wheel+bearing+&+hub', parttype: 1636 }],
  'wheel hub': [{ category: 'brake+&+wheel+hub', subcategory: 'wheel+bearing+&+hub', parttype: 1636 }],
  'connecting rod bearing': [{ category: 'engine', subcategory: 'connecting+rod+bearing', parttype: 5212 }],
  'connecting rod bearings': [{ category: 'engine', subcategory: 'connecting+rod+bearing', parttype: 5212 }],
  'rod bearing': [{ category: 'engine', subcategory: 'connecting+rod+bearing', parttype: 5212 }],
  'rod bearings': [{ category: 'engine', subcategory: 'connecting+rod+bearing', parttype: 5212 }],
  'crankshaft main bearing': [{ category: 'engine', subcategory: 'crankshaft+main+bearing', parttype: 5220 }],
  'main bearing': [{ category: 'engine', subcategory: 'crankshaft+main+bearing', parttype: 5220 }],
  'main bearings': [{ category: 'engine', subcategory: 'crankshaft+main+bearing', parttype: 5220 }],
  'camshaft bearing': [{ category: 'engine', subcategory: 'camshaft+bearing', parttype: 5208 }],
  'camshaft bearings': [{ category: 'engine', subcategory: 'camshaft+bearing', parttype: 5208 }],
  'cam bearing': [{ category: 'engine', subcategory: 'camshaft+bearing', parttype: 5208 }],
  'cam bearings': [{ category: 'engine', subcategory: 'camshaft+bearing', parttype: 5208 }],
  'cylinder head gasket': [{ category: 'engine', subcategory: 'cylinder+head+gasket', parttype: 5412 }],
  'head gasket': [{ category: 'engine', subcategory: 'cylinder+head+gasket', parttype: 5412 }],
  'valve cover gasket': [{ category: 'engine', subcategory: 'valve+cover+gasket', parttype: 10710 }],
  'intake manifold gasket': [{ category: 'engine', subcategory: 'intake+manifold+gasket', parttype: 5424 }],
  'oil pan gasket': [{ category: 'engine', subcategory: 'oil+pan+gasket', parttype: 5436 }],
  'exhaust manifold gasket': [{ category: 'exhaust+&+emission', subcategory: 'exhaust+manifold+gasket', parttype: 5400 }],
  'fuel pump': [{ category: 'fuel+&+air', subcategory: 'fuel+pump', parttype: 6256 }],
  'oxygen sensor': [{ category: 'exhaust+&+emission', subcategory: 'oxygen+(o2)+sensor', parttype: 5132 }],
  'o2 sensor': [{ category: 'exhaust+&+emission', subcategory: 'oxygen+(o2)+sensor', parttype: 5132 }],
  'serpentine belt': [{ category: 'belt+drive', subcategory: 'serpentine+belt', parttype: 8900 }],
  'drive belt': [{ category: 'belt+drive', subcategory: 'serpentine+belt', parttype: 8900 }],
  'timing belt': [{ category: 'engine', subcategory: 'timing+belt', parttype: 5756 }],
  'timing chain': [{ category: 'engine', subcategory: 'timing+chain', parttype: 5758 }],
  'wiper blade': [{ category: 'wiper+&+washer', subcategory: 'wiper+blade', parttype: 8852 }],
  'wiper blades': [{ category: 'wiper+&+washer', subcategory: 'wiper+blade', parttype: 8852 }],
  'headlight': [{ category: 'body+&+lamp+assembly', subcategory: 'headlamp+assembly', parttype: 10762 }],
  'battery': [{ category: 'electrical', subcategory: 'battery', parttype: 2044 }],
  'engine mount': [{ category: 'engine', subcategory: 'motor+mount', parttype: 5552 }],
  'motor mount': [{ category: 'engine', subcategory: 'motor+mount', parttype: 5552 }],
  'transmission mount': [{ category: 'transmission-automatic', subcategory: 'transmission+mount', parttype: 8616 }],
  'trans mount': [{ category: 'transmission-automatic', subcategory: 'transmission+mount', parttype: 8616 }],
  'rotor & brake pad kit': [{ category: 'brake+&+wheel+hub', subcategory: 'rotor+&+brake+pad+kit', parttype: 13824 }],
  'disc brake hardware kit': [{ category: 'brake+&+wheel+hub', subcategory: 'disc+brake+hardware+kit', parttype: 1736 }],
  'brake hose': [{ category: 'brake+&+wheel+hub', subcategory: 'brake+hose', parttype: 1792 }],
  'master cylinder': [{ category: 'brake+&+wheel+hub', subcategory: 'master+cylinder', parttype: 1836 }],
};

const SEARCH_VOCABULARY = new Set([
  ...Object.keys(CATEGORY_MAP).flatMap(key => key.split(' ')),
  'bearings', 'belts', 'brakes', 'filters', 'pumps',
]);

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;

  if (left.length === right.length) {
    const differences: number[] = [];
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) differences.push(i);
      if (differences.length > 2) return false;
    }
    if (differences.length === 1) return true;
    return differences.length === 2
      && differences[1] === differences[0] + 1
      && left[differences[0]] === right[differences[1]]
      && left[differences[1]] === right[differences[0]];
  }

  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left];
  let shortIndex = 0;
  let longIndex = 0;
  let skipped = false;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
    } else if (skipped) {
      return false;
    } else {
      skipped = true;
      longIndex += 1;
    }
  }
  return true;
}

function correctSearchToken(token: string): string {
  if (token.length < 5 || SEARCH_VOCABULARY.has(token)) return token;
  const matches = [...SEARCH_VOCABULARY].filter(candidate =>
    candidate[0] === token[0] && editDistanceAtMostOne(token, candidate),
  );
  return matches.length === 1 ? matches[0] : token;
}

function normalizeSearchQuery(query: string): string {
  return query.toLowerCase()
    .replace(/\ba\s*[/_-]\s*c\b/g, 'ac')
    .replace(/[-_/]+/g, ' ')
    .replace(/[^\w\s&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(correctSearchToken)
    .join(' ');
}

function findSpecificCategory(q: string): PartCategory | null {
  if (CATEGORY_MAP[q]) return CATEGORY_MAP[q][0];
  const aliases: Array<[RegExp, string]> = [
    [/\b(front|rear)?\s*(disc\s*)?brake\s*(pad|pads|pad set|pads set)\b/, 'brake pads'],
    [/\bbrakes\b/, 'brake pads'],
    [/\b(front|rear)?\s*brake\s*(disc|discs)\b/, 'brake rotor'],
    [/\b(oil|engine oil)\s*filter(s)?\b/, 'oil filter'],
    [/\b(cabin|pollen)\s*(air\s*)?filter(s)?\b/, 'cabin air filter'],
    [/\bengine\s*air\s*filter(s)?\b/, 'engine air filter'],
    [/\bplug(s)?\b/, 'spark plugs'],
    [/\b(wiper|windshield wiper)(\s*blade)?s?\b/, 'wiper blades'],
  ];
  for (const [pattern, category] of aliases) {
    if (pattern.test(q)) return CATEGORY_MAP[category][0];
  }
  // Prefer the longest category phrase so "cabin air filter" cannot be
  // swallowed by the broader "air filter" mapping.
  for (const key of Object.keys(CATEGORY_MAP).sort((a, b) => b.length - a.length)) {
    const entries = CATEGORY_MAP[key];
    if (q.includes(key)) return entries[0];
  }
  return null;
}

const CATEGORY_FAMILIES: Array<{
  pattern: RegExp;
  qualifier: RegExp;
  categories: string[];
}> = [
  {
    pattern: /\bbearings?\b/,
    qualifier: /\b(wheel|hub|connecting|rod|crankshaft|main|camshaft|cam)\b/,
    categories: ['wheel bearing', 'connecting rod bearing', 'crankshaft main bearing', 'camshaft bearing'],
  },
  {
    pattern: /\bfilters?\b/,
    qualifier: /\b(oil|air|engine|cabin|pollen|fuel)\b/,
    categories: ['oil filter', 'engine air filter', 'cabin air filter', 'fuel filter'],
  },
  {
    pattern: /\bbrakes?\b/,
    qualifier: /\b(pad|rotor|disc|caliper|shoe|hose|hardware|master|cylinder)\b/,
    categories: ['brake pads', 'brake rotor', 'brake caliper', 'brake shoe'],
  },
  {
    pattern: /\bbelts?\b/,
    qualifier: /\b(serpentine|drive|timing)\b/,
    categories: ['serpentine belt', 'timing belt'],
  },
  {
    pattern: /\bpumps?\b/,
    qualifier: /\b(water|fuel)\b/,
    categories: ['water pump', 'fuel pump'],
  },
  {
    pattern: /\bgaskets?\b/,
    qualifier: /\b(cylinder|head|valve|cover|intake|exhaust|manifold|oil|pan)\b/,
    categories: [
      'cylinder head gasket',
      'valve cover gasket',
      'intake manifold gasket',
      'oil pan gasket',
      'exhaust manifold gasket',
    ],
  },
  {
    pattern: /\bmounts?\b/,
    qualifier: /\b(engine|motor|trans|transmission)\b/,
    categories: ['engine mount', 'transmission mount'],
  },
];

export function findCategory(query: string): PartCategory | null {
  return findSpecificCategory(normalizeSearchQuery(query));
}

export function findCategories(query: string): PartCategory[] {
  const q = normalizeSearchQuery(query);
  const family = CATEGORY_FAMILIES.find(entry => entry.pattern.test(q) && !entry.qualifier.test(q));
  const categories = family
    ? family.categories.map(key => CATEGORY_MAP[key][0])
    : [findSpecificCategory(q)].filter((category): category is PartCategory => category !== null);

  return categories.filter(
    (category, index) => categories.findIndex(candidate => candidate.parttype === category.parttype) === index,
  );
}

export function extractFitmentPosition(text: string): string | undefined {
  const searchable = text
    .replace(/\b(?:front|rear|all)[-\s]+wheel[-\s]+drive\b/gi, ' ')
    .replace(/\s+/g, ' ');
  const terms: Array<{ index: number; label: string }> = [];
  const patterns: Array<[RegExp, string]> = [
    [/\bdriver(?:'s)?\s+side\b/i, 'Driver Side'],
    [/\bpassenger(?:'s)?\s+side\b/i, 'Passenger Side'],
    [/\bfront\b/i, 'Front'],
    [/\brear\b/i, 'Rear'],
    [/\bleft\b/i, 'Left'],
    [/\bright\b/i, 'Right'],
    [/\bcenter\b/i, 'Center'],
    [/\bupper\b/i, 'Upper'],
    [/\blower\b/i, 'Lower'],
  ];

  for (const [pattern, label] of patterns) {
    const match = pattern.exec(searchable);
    if (match) terms.push({ index: match.index, label });
  }

  terms.sort((a, b) => a.index - b.index);
  const labels = terms.map(term => term.label);
  return labels.length > 0 ? labels.join(' ') : undefined;
}

export type DirectSearch =
  | { type: 'partNumber'; value: string }
  | { type: 'brand'; value: string };

export function classifyDirectSearch(query: string): DirectSearch {
  const value = query.trim()
    .replace(/^(?:part\s*(?:number|no|#)|pn)\s*[:#-]?\s*/i, '')
    .trim();
  const compactPartNumber = value.replace(/\s+/g, '');
  const isPartNumber = /^(?=.*\d)[a-z0-9][a-z0-9._/-]{2,29}$/i.test(compactPartNumber)
    && !/^\d[a-z]$/i.test(compactPartNumber);

  return isPartNumber
    ? { type: 'partNumber', value: compactPartNumber }
    : { type: 'brand', value };
}

// ── Cache ──

const PARTS_CACHE_VERSION = 7;

function getPartsCache(query: string): ScrapedPart[] | null {
  const db = getDatabase();
  const rows = db.prepare('SELECT data, cached_at FROM parts_cache WHERE vendor = ? AND search_keyword = ?')
    .all('RockAuto', query.toLowerCase().trim()) as any[];
  if (!rows || rows.length === 0) return null;

  const oldest = new Date(Math.min(...rows.map(r => new Date(r.cached_at).getTime())));
  if (Date.now() - oldest.getTime() > 24 * 60 * 60 * 1000) {
    db.prepare('DELETE FROM parts_cache WHERE vendor = ? AND search_keyword = ?').run('RockAuto', query.toLowerCase().trim());
    return null;
  }
  try {
    const parts = rows.map(r => JSON.parse(r.data) as ScrapedPart);
    // Deduplicate by vendor_part_id (cache stores one row per part)
    const seen = new Set<string>();
    return parts.filter(p => {
      const key = p.vendor_part_id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch { return null; }
}

function setPartsCache(query: string, parts: ScrapedPart[]): void {
  const db = getDatabase();
  const insertPart = db.prepare(
    `INSERT INTO parts_cache (vendor, vendor_part_id, search_keyword, data, cached_at) VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(vendor, vendor_part_id)
     DO UPDATE SET search_keyword = excluded.search_keyword, data = excluded.data, cached_at = datetime('now')`
  );
  db.transaction(() => {
    for (const part of parts) {
      insertPart.run('RockAuto', part.vendor_part_id, query.toLowerCase().trim(), JSON.stringify(part));
    }
  })();
}

// ── Engine options cache ──
// Cached per vehicle (doesn't change), avoids one full page load on repeat searches
const engineCache = new Map<string, { engine: string; carcode: string }[]>();

// ── Browser pool ──

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browser;
}

async function createPage(b: Browser): Promise<{ page: Page; context: any }> {
  const context = await b.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
  });
  const page = await context.newPage();
  // Block unnecessary resources for speed
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (type === 'image' || type === 'font' || type === 'media') {
      route.abort();
    } else {
      route.continue();
    }
  });
  return { page, context };
}

// ── Engine options via API interception ──

async function getEngineOptions(page: Page, make: string, year: number, model: string): Promise<{ engine: string; carcode: string }[]> {
  const cacheKey = `${make.toLowerCase()}|${year}|${model.toLowerCase()}`;
  if (engineCache.has(cacheKey)) {
    console.log(`[PartsScraper] Using cached engines for ${make} ${year} ${model}`);
    return engineCache.get(cacheKey)!;
  }

  const engines: { engine: string; carcode: string }[] = [];
  
  const responsePromise = new Promise<{ engine: string; carcode: string }[]>((resolve) => {
    const timeout = setTimeout(() => {
      page.removeListener('response', handler);
      resolve(engines);
    }, 15000);

    const handler = async (response: any) => {
      if (!response.url().includes('catalogapi') || response.status() !== 200) return;
      try {
        const json = JSON.parse(await response.text());
        const sections = json.html_fill_sections || {};
        for (const key of Object.keys(sections)) {
          if (!key.includes('navchildren')) continue;
          const html: string = sections[key];
          const depthMatch = html.match(/(?:"|&quot;)idepth(?:"|&quot;):(\d+)/);
          if (!depthMatch || depthMatch[1] !== '3') continue;
          const re = /(?:"|&quot;)carcode(?:"|&quot;):(?:"|&quot;)(\d+)(?:"|&quot;).*?(?:"|&quot;)engine(?:"|&quot;):(?:"|&quot;)([^&]+?)(?:"|&quot;)/g;
          let match: RegExpExecArray | null;
          while ((match = re.exec(html)) !== null) {
            const carcode = match[1];
            const engineName = match[2].replace(/\\/g, '');
            if (!engines.some(e => e.carcode === carcode)) {
              engines.push({ engine: engineName, carcode });
            }
          }
          if (engines.length > 0) {
            clearTimeout(timeout);
            page.removeListener('response', handler);
            engineCache.set(cacheKey, engines);
            resolve(engines);
            return;
          }
        }
      } catch {}
    };
    page.on('response', handler);
  });

  const makeSlug = make.toLowerCase();
  const modelSlug = model.toLowerCase().replace(/\s+/g, '+');
  const url = `https://www.rockauto.com/en/catalog/${makeSlug},${year},${modelSlug}`;
  console.log(`[PartsScraper] Getting engines for ${make} ${year} ${model}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

  const result = await responsePromise;
  console.log(`[PartsScraper] Found ${result.length} engines (cached=${engineCache.has(cacheKey)})`);
  return result;
}

export function findBestEngine(catalogEngines: { engine: string; carcode: string }[], userEngine: string): { engine: string; carcode: string } | null {
  if (catalogEngines.length === 0) return null;

  const ue = userEngine.toLowerCase().trim();
  if (!ue) return catalogEngines.length === 1 ? catalogEngines[0] : null;

  const exact = catalogEngines.find(e => e.engine.toLowerCase() === ue);
  if (exact) return exact;

  const dispMatch = ue.match(/(\d+\.?\d*)\s*l/);
  if (dispMatch) {
    const disp = dispMatch[1];
    const matches = catalogEngines.filter(e => {
      const m = e.engine.match(/(\d+\.?\d*)\s*l/i);
      return m && parseFloat(m[1]) === parseFloat(disp);
    });
    if (matches.length === 1) return matches[0];
  }

  return null;
}

// ── Parts extraction ──

interface RawPartInfo {
  brand: string;
  partNumber: string;
  partName: string;
  priceCents: number;
  isFront: boolean;
  isRear: boolean;
  isCeramic: boolean;
}

async function extractPartsFromListing(page: Page, sourceUrl: string): Promise<ScrapedPart[]> {
  const parts: ScrapedPart[] = [];
  const seen = new Set<string>();

  try {
    // Extract cart form data first — map part_number to form submission data
    const formMap: Record<string, { action: string; nck: string; fields: Record<string, string> }> = 
      await page.evaluate(`(function() {
        var map = {};
        var forms = document.querySelectorAll('form');
        forms.forEach(function(f) {
          var submitInputs = f.querySelectorAll('input[type="submit"]');
          var addToCartName = '';
          for (var j = 0; j < submitInputs.length; j++) {
            if ((submitInputs[j].value || '').indexOf('Add to Cart') >= 0) {
              addToCartName = submitInputs[j].name;
              break;
            }
          }
          if (!addToCartName) return;
          
          var hiddenFields = {};
          var nck = '';
          var hiddens = f.querySelectorAll('input[type="hidden"]');
          for (var k = 0; k < hiddens.length; k++) {
            hiddenFields[hiddens[k].name] = hiddens[k].value;
            if (hiddens[k].name === '_nck') nck = hiddens[k].value;
          }
          // CRITICAL: include the submit button name/value — form.submit() doesn't send it
          hiddenFields[addToCartName] = 'Add to Cart';
          
          // The submit form lives inside the part's listing row. Walk up past
          // the button cell (div.vew_btnaddtocart) to the row that contains
          // the part number. RockAuto currently uses tbody.listing-inner.
          var row = f.closest('tbody.listing-inner, tr.listing-inner, tr.rowselected');
          var rowText = (row ? row.innerText : '') || '';
          var pnMatches = rowText.match(/\\b([A-Z][A-Z0-9]{3,19}(?:-[A-Z0-9]+)?)\\b/g);
          if (pnMatches) {
            for (var m = 0; m < pnMatches.length; m++) {
              var pn = pnMatches[m];
              if (pn.length > 3 && !/^(ADD|CART|QTY|REMOVE)$/i.test(pn)) {
                map[pn] = {
                  action: f.action || window.location.href,
                  nck: nck,
                  fields: JSON.parse(JSON.stringify(hiddenFields))
                };
              }
            }
          }
        });
        return map;
      })()`) as Record<string, any>;

    // Extract images first — map part number to image URL
    const imageMap: Record<string, string> = await page.evaluate(`
      (() => {
        const map = {};
        const imgs = document.querySelectorAll('img[alt="Part image"]');
        imgs.forEach(img => {
          const src = img.src || '';
          const pnMatch = src.match(/_([0-9]{3,}[A-Za-z0-9]*|[A-Z]+[0-9]+[A-Za-z]*)_[^_]*\\.jpg$/);
          if (pnMatch) {
            map[pnMatch[1]] = src;
          }
          const pathMatch = src.match(/\\/info\\/\\d+\\/([^_]+)_/);
          if (pathMatch && pathMatch[1].length > 3) {
            const cleanPn = pathMatch[1].replace(/^\\d{3,4}[-_]/, '');
            if (cleanPn.length > 3) map[cleanPn] = src;
          }
        });
        return map;
      })()
    `) as Record<string, string>;

    const configurableVariants = await page.evaluate(`(function() {
      var variants = [];
      var rows = document.querySelectorAll('tbody.listing-inner, tr.listing-inner, tr.rowselected, div.listing-inner');
      rows.forEach(function(row) {
        var select = row.querySelector('select.listing-optionchoice-multiple');
        var partNumberEl = row.querySelector('.listing-final-partnumber');
        var brandEl = row.querySelector('.listing-final-manufacturer');
        if (!select || !partNumberEl || !brandEl) return;

        var descriptionEl = row.querySelector('.span-link-underline-remover');
        Array.from(select.options).forEach(function(option) {
          var text = (option.textContent || '').replace(/\\s+/g, ' ').trim();
          var priceMatch = text.match(/\\$(\\d+\\.\\d{2})/);
          if (!option.value || !priceMatch || /out of stock/i.test(text)) return;
          var label = text
            .replace(/\\s*\\(\\$\\d+\\.\\d{2}\\)\\s*\\^?\\s*$/, '')
            .trim();
          variants.push({
            brand: (brandEl.textContent || '').trim(),
            partNumber: (partNumberEl.textContent || '').trim(),
            description: descriptionEl ? (descriptionEl.textContent || '').trim() : 'Part',
            fitmentText: (row.textContent || '').replace(/\\s+/g, ' ').trim(),
            optionValue: option.value,
            optionLabel: label,
            priceCents: Math.round(parseFloat(priceMatch[1]) * 100)
          });
        });
      });
      return variants;
    })()`) as Array<{
      brand: string;
      partNumber: string;
      description: string;
      fitmentText: string;
      optionValue: string;
      optionLabel: string;
      priceCents: number;
    }>;

    const configurablePartNumbers = new Set<string>();
    for (const variant of configurableVariants) {
      configurablePartNumbers.add(variant.partNumber);
      const key = `${variant.brand}|${variant.partNumber}|${variant.optionValue}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parts.push({
        vendor: 'RockAuto',
        vendor_part_id: `${variant.partNumber}:${variant.optionValue}`,
        part_name: `${variant.description} — ${variant.optionLabel}`,
        part_number: variant.partNumber,
        price_cents: variant.priceCents,
        item_type: 'part',
        source_url: sourceUrl,
        image_url: imageMap[variant.partNumber],
        brand: variant.brand,
        fitment_position: extractFitmentPosition(variant.fitmentText),
        availability: `Size: ${variant.optionLabel}`,
        option_value: variant.optionValue,
        option_label: variant.optionLabel,
      });
    }

    const rawText: string = (await page.evaluate(`document.body.innerText`)) || '';
    const partBlocks = rawText.split(/\n\n+/).filter((block: string) =>
      (/\$\d+\.\d+/.test(block) || /Choose Size at Left/i.test(block)) && block.length > 30,
    );

    for (const block of partBlocks) {
      if (/^(ALL THE PARTS|Help|Order Status|Filters|Cart|Account|Part Catalog|2006|ABARTH|SHIPPING|Available Carts)/i.test(block.trim())) continue;

      const lines = block.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 2);
      if (lines.length < 2) continue;

      const priceMatch = block.match(/\$(\d+\.\d+)/);
      const requiresConfiguration = !priceMatch && /Choose Size at Left/i.test(block);
      const priceCents = priceMatch ? Math.round(parseFloat(priceMatch[1]) * 100) : 0;
      if (!requiresConfiguration && (priceCents <= 0 || priceCents > 500000)) continue;

      let brand = '';
      let partNumber = '';
      let partName = '';

      for (const line of lines) {
        if (line.startsWith('$') || line === 'Add to Cart') continue;

        if (!brand && !partNumber) {
          const bpMatch = line.match(
            /^([A-Z0-9][A-Z0-9\s&.!#/'-]+?)\s+((?=[A-Za-z0-9._-]*\d)[A-Z0-9][A-Za-z0-9._-]{2,29})(?:\s|$)/,
          );
          if (bpMatch && bpMatch[1].length > 2 && bpMatch[1].length < 35 && !/^(Rear|Front|Left|Right|Info|Includes|Closeout|Position)/i.test(bpMatch[1])) {
            brand = bpMatch[1].trim();
            partNumber = bpMatch[2];
            continue;
          }
        }

        if (!partName && line.length > 5) {
          const descMatch = line.match(/^(.{3,100}?)\s+(?:Rear|Front)\b/);
          if (descMatch) {
            partName = descMatch[1].trim();
          } else if (!/Info|Includes|Material|Closeout|Position|[A-Z]{2,3}\b.*\b[A-Z]{2,3}\b/i.test(line)) {
            partName = line.slice(0, 100);
          }
        }
      }

      if (!partName && lines[0].length > 5 && !/\$/.test(lines[0])) {
        partName = lines[0].slice(0, 100);
      }
      if (requiresConfiguration && configurablePartNumbers.has(partNumber)) continue;

      const isCeramic = /Ceramic/i.test(block);
      const material = isCeramic ? ' Ceramic' : '';
      const fullName = `${partName || 'Part'}${material}`.trim().slice(0, 120);

      const key = `${brand}|${partNumber}|${priceCents}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Find matching image
      let imageUrl: string | undefined;
      if (partNumber && imageMap[partNumber]) {
        imageUrl = imageMap[partNumber];
      } else if (partNumber) {
        // Try fuzzy match — part number appears in image URL
        for (const [pn, url] of Object.entries(imageMap)) {
          if (url.includes(partNumber) || partNumber.includes(pn)) {
            imageUrl = url;
            break;
          }
        }
      }

      if (fullName.length > 3) {
        // Get cart form data for this part number
        const cartForm = partNumber ? formMap[partNumber] : null;

        parts.push({
          vendor: 'RockAuto',
          vendor_part_id: partNumber || `ra-${Date.now()}-${parts.length}`,
          part_name: fullName,
          part_number: partNumber,
          price_cents: priceCents,
          item_type: 'part',
          source_url: sourceUrl,
          image_url: imageUrl,
          brand: brand || undefined,
          fitment_position: extractFitmentPosition(block),
          availability: requiresConfiguration ? 'Choose a bearing size on RockAuto for price' : undefined,
          cart_action: cartForm?.action,
          cart_nck: cartForm?.nck,
          cart_hidden_fields: cartForm?.fields,
        });
      }
      if (parts.length >= 15) break;
    }

    console.log(`[PartsScraper] Extracted ${parts.length} parts, ${Object.keys(imageMap).length} images available`);
  } catch (err) {
    console.error('[PartsScraper] Extraction error:', (err as Error).message);
  }
  return parts;
}

// ── Main search ──

export async function searchParts(query: string, options: SearchOptions = {}): Promise<ScrapedPart[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  // Check cache first
  const cacheKey = `v${PARTS_CACHE_VERSION}|${JSON.stringify(options)}|${q}`.toLowerCase();
  const cached = getPartsCache(cacheKey);
  if (cached && cached.length > 0) return cached;

  // Parse vehicle context
  let vehicleYear: number | null = null;
  let vehicleMake = '';
  let vehicleModel = '';
  let vehicleEngine = '';

  if (options.vehicle?.year && options.vehicle.make && options.vehicle.model) {
    vehicleYear = options.vehicle.year;
    vehicleMake = options.vehicle.make.trim();
    vehicleModel = options.vehicle.model.trim();
    vehicleEngine = options.vehicle.engine?.trim() || '';
  } else if (options.vehicleContext) {
    const parts = options.vehicleContext.trim().split(/\s+/);
    if (parts.length >= 3) {
      const yearVal = parseInt(parts[0], 10);
      if (yearVal >= 1988 && yearVal <= new Date().getFullYear() + 1) {
        vehicleYear = yearVal;
        vehicleMake = parts[1];
        let modelEndIdx = 2;
        for (let i = 2; i < parts.length; i++) {
          if (parts[i].match(/^\d+\.\d+L?$/)) break;
          if (/^(FWD|RWD|AWD|4WD)$/i.test(parts[i])) break;
          modelEndIdx = i + 1;
        }
        vehicleModel = parts.slice(2, modelEndIdx).join(' ');
        if (modelEndIdx < parts.length) {
          vehicleEngine = parts.slice(modelEndIdx).join(' ');
        }
      }
    }
  }

  console.log(`[PartsScraper] "${q}" for ${vehicleYear || '?'} ${vehicleMake} ${vehicleModel}`);

  const categories = findCategories(q);
  const directSearch = categories.length === 0 ? classifyDirectSearch(query) : null;

  if (!directSearch && (!vehicleYear || !vehicleMake || !vehicleModel)) {
    console.log('[PartsScraper] No vehicle context');
    return [];
  }

  const b = await getBrowser();
  let ctx: any = null;

  try {
    const { page, context } = await createPage(b);
    ctx = context;

    if (directSearch) {
      const searchUrl = directSearch.type === 'partNumber'
        ? `https://www.rockauto.com/en/partsearch/?partnum=${encodeURIComponent(directSearch.value)}`
        : `https://www.rockauto.com/en/partsearch/?mfr=${encodeURIComponent(directSearch.value.toUpperCase())}&partnum=%2A`;
      console.log(`[PartsScraper] Searching by ${directSearch.type}: ${directSearch.value}`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);
      const parts = await extractPartsFromListing(page, searchUrl);
      if (parts.length > 0) {
        setPartsCache(cacheKey, parts);
      }
      return parts;
    }

    // Get engine options (cached after first lookup per vehicle)
    const engineOptions = await getEngineOptions(page, vehicleMake, vehicleYear!, vehicleModel);
    const engineChoice = findBestEngine(engineOptions, vehicleEngine);

    if (!engineChoice) {
      console.log('[PartsScraper] No matching engine');
      return [];
    }

    console.log(`[PartsScraper] Engine: ${engineChoice.engine} (carcode ${engineChoice.carcode})`);

    // Build vehicle-specific listing URLs for every matching part family.
    const engineSlug = engineChoice.engine.toLowerCase()
      .replace(/[,]/g, '').replace(/[()]/g, '').replace(/\s+/g, '+');
    const modelSlug = vehicleModel.toLowerCase().replace(/\s+/g, '+');
    const parts: ScrapedPart[] = [];
    const seenParts = new Set<string>();

    for (const category of categories) {
      const listingUrl = `https://www.rockauto.com/en/catalog/${vehicleMake.toLowerCase()},${vehicleYear},${modelSlug},${engineSlug},${engineChoice.carcode},${category.category},${category.subcategory},${category.parttype}`;
      console.log(`[PartsScraper] Loading ${category.subcategory.replace(/\+/g, ' ')}`);
      try {
        await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);
        const categoryParts = await extractPartsFromListing(page, listingUrl);
        for (const part of categoryParts) {
          const key = `${part.vendor}|${part.vendor_part_id}`;
          if (!seenParts.has(key)) {
            seenParts.add(key);
            parts.push(part);
          }
        }
      } catch (err) {
        console.error(
          `[PartsScraper] Failed ${category.subcategory.replace(/\+/g, ' ')} listing:`,
          (err as Error).message,
        );
      }
    }

    if (parts.length > 0) {
      setPartsCache(cacheKey, parts);
      console.log(`[PartsScraper] ✓ ${parts.length} parts, ${parts.filter(p => p.image_url).length} with images`);
    }

    return parts;
  } catch (err) {
    console.error('[PartsScraper] Error:', (err as Error).message);
    return [];
  } finally {
    if (ctx) await ctx.close().catch(() => {});
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) { await browser.close(); browser = null; }
  engineCache.clear();
  await closeCheckoutBrowser();
}

// ── RockAuto Cart Checkout for Actual Shipping ──

export interface ShippingResult {
  total_shipping_cents: number;
  shipping_method: string;
  estimated_delivery: string;
  parts_in_cart: number;
  zip_code: string;
  source: string;
}

export interface PartToShip {
  part_number: string;
  listing_url: string;
  part_name: string;
  option_value?: string;
  quantity?: number;
}

/** Calculate actual RockAuto shipping by adding parts to cart and checking out */
export async function calculateRockAutoShipping(
  parts: PartToShip[],
  zipCode?: string,
): Promise<ShippingResult | null> {
  const zip = zipCode || settingsRepo.getTyped<string>('shop_zip_code', '') || 
              settingsRepo.getTyped<string>('address_zip', '') || '';
  
  if (parts.length === 0 || !zip) {
    console.log('[RockAuto Shipping] No parts or no ZIP code');
    return null;
  }
  if (parts.some(p => !Number.isInteger(p.quantity ?? 1) || (p.quantity ?? 1) < 1 || (p.quantity ?? 1) > 100)) {
    console.warn('[RockAuto Shipping] Quantities must be whole numbers between 1 and 100');
    return null;
  }

  console.log(`[RockAuto Shipping] Calculating shipping for ${parts.length} parts to ${zip}`);

  const b = await getBrowser();
  let ctx: any = null;

  try {
    const { page, context } = await createPage(b);
    ctx = context;

    // Step 1: Add each part to cart
    let added = 0;
    for (const part of parts) {
      try {
        console.log(`[RockAuto Shipping] Adding to cart: ${part.part_name}`);
        await page.goto(part.listing_url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);

        for (let i = 0; i < (part.quantity ?? 1); i++) {
          const addedPart = await clickAddToCartForPart(page, part.part_number, part.option_value);
          if (!addedPart) {
            console.warn(`[RockAuto Shipping] Could not add ${part.part_number}`);
            return null;
          }
          added++;
          await page.waitForTimeout(1500);
        }
      } catch (err) {
        console.error(`[RockAuto Shipping] Failed to add ${part.part_name}:`, (err as Error).message);
        return null;
      }
    }

    if (added === 0) {
      console.log('[RockAuto Shipping] No parts could be added to cart');
      return null;
    }

    // Step 2: Go to cart
    console.log(`[RockAuto Shipping] Navigating to cart (${added} items)`);
    await page.goto('https://www.rockauto.com/en/cart/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Step 3: Enter ZIP code for shipping estimate
    const shippingInfo = await page.evaluate((zipCode: string) => {
      const doc = (globalThis as any).document;
      const zipInputs: any = doc.querySelectorAll('input[name*="zip"], input[name*="postcode"], input[placeholder*="zip"], input[placeholder*="ZIP"]');
      zipInputs.forEach(function(el: any) {
        el.value = zipCode;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });

      const allEls: any = doc.querySelectorAll('input, button');
      let clicked = 0;
      allEls.forEach(function(el: any) {
        const txt = (el.innerText || '') + (el.value || '');
        if (/calculate|estimate|get.*shipping/i.test(txt)) {
          el.click();
          clicked++;
        }
      });

      return { zipEntered: zipInputs.length > 0, buttonsClicked: clicked };
    }, zip) as { zipEntered: boolean; buttonsClicked: number };

    await page.waitForTimeout(3000);

    // Step 4: Extract shipping info
    const cartText: string = (await page.evaluate('document.body.innerText')) || '';
    
    // Parse shipping cost, method, and delivery date from cart page
    let shippingCost: number | null = null;
    let shippingMethod = 'Standard';
    let deliveryDate = '';

    // Look for shipping cost patterns: "$X.XX" near "Shipping", "Ground", "FedEx", "UPS", etc.
    const shipLines = cartText.split('\n').filter((l: string) => 
      /shipping|ship|ground|fedex|ups|usps|freight|delivery|arrives|estimated/i.test(l)
    );
    
    if (shipLines.length === 0) {
      console.log('[RockAuto Shipping] No shipping lines found on cart page');
      console.log('[RockAuto Shipping] Cart page excerpt:', cartText.substring(0, 500));
    }

    for (const line of shipLines) {
      console.log('[RockAuto Shipping] Cart line:', line.trim());
      const costMatch = /shipping|freight/i.test(line) ? line.match(/\$(\d+\.\d{2})/) : null;
      if (/free\s+shipping|shipping\s*:?\s*free/i.test(line) && shippingCost === null) shippingCost = 0;
      if (costMatch && shippingCost === null) {
        shippingCost = Math.round(parseFloat(costMatch[1]) * 100);
      }
      if (/fedex/i.test(line)) shippingMethod = 'FedEx Ground';
      else if (/ups/i.test(line)) shippingMethod = 'UPS Ground';
      else if (/usps/i.test(line)) shippingMethod = 'USPS';
      else if (/ground/i.test(line)) shippingMethod = 'Ground';

      const dateMatch = line.match(/(\w+ \d{1,2}(?:st|nd|rd|th)?(?:,? \d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:\d+[- ])?(?:business )?day)/i);
      if (dateMatch && !deliveryDate) {
        deliveryDate = dateMatch[0];
      }
    }

    // Fallback: look for any dollar amount near the word "shipping"
    if (shippingCost === null) {
      const shippingMatch = cartText.match(/shipping[^\n$]*\$(\d+\.\d{2})/i);
      if (shippingMatch) {
        shippingCost = Math.round(parseFloat(shippingMatch[1]) * 100);
      }
    }

    if (shippingCost === null) {
      console.warn('[RockAuto Shipping] No shipping price could be read from the cart');
      return null;
    }

    console.log(`[RockAuto Shipping] Result: $${(shippingCost/100).toFixed(2)} via ${shippingMethod}`);

    return {
      total_shipping_cents: shippingCost,
      shipping_method: shippingMethod,
      estimated_delivery: deliveryDate || 'Unavailable',
      parts_in_cart: added,
      zip_code: zip,
      source: 'RockAuto Cart Checkout',
    };
  } catch (err) {
    console.error('[RockAuto Shipping] Error:', (err as Error).message);
    return null;
  } finally {
    if (ctx) await ctx.close().catch(() => {});
  }
}

// ── Headed checkout: auto-add parts and leave the window open for purchase ──

export interface CheckoutResult {
  parts_requested: number;
  parts_added: number;
  parts_failed: string[];
  cart_url: string;
  address_entered: boolean;
}

// Keep a module-level reference so the browser isn't garbage-collected while
// the user completes checkout in the open window.
let checkoutBrowser: Browser | null = null;

interface CheckoutAddress {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
}

function getShopCheckoutAddress(): CheckoutAddress | null {
  const profile = getDatabase().prepare(`
    SELECT shop_name, address_street, address_city, address_state, address_zip, phone, email
    FROM shop_profile
    WHERE id = 1
  `).get() as Record<string, string | null> | undefined;

  if (!profile) return null;

  const address: CheckoutAddress = {
    name: profile.shop_name?.trim() || '',
    street: profile.address_street?.trim() || '',
    city: profile.address_city?.trim() || '',
    state: profile.address_state?.trim() || '',
    zip: profile.address_zip?.trim() || '',
    phone: profile.phone?.trim() || '',
    email: profile.email?.trim() || '',
  };

  return address.name && address.street && address.city && address.state && address.zip
    ? address
    : null;
}

async function fillRockAutoShippingAddress(page: Page, address: CheckoutAddress): Promise<boolean> {
  const fields: Array<[string, string]> = [
    ['ship[name]', address.name],
    ['ship[address1]', address.street],
    ['ship[city]', address.city],
    ['ship[postcode]', address.zip],
    ['ship[tel]', address.phone],
    ['ship[email]', address.email],
  ];

  for (const [name, value] of fields) {
    if (!value) continue;
    const field = page.locator(`[name="${name}"]`).first();
    if (await field.count() === 0) return false;
    await field.fill(value);
  }

  const state = page.locator('[name="ship[state]"]').first();
  if (await state.count() === 0) return false;
  await state.selectOption(address.state);

  const country = page.locator('[name="ship[country]"]').first();
  if (await country.count() > 0) {
    await country.selectOption({ label: 'United States' });
  }

  const sameAddress = page.locator('[name="sameaddress"]').first();
  if (await sameAddress.count() > 0 && !(await sameAddress.isChecked())) {
    await sameAddress.check();
  }

  return true;
}

/**
 * Open a visible (headed) browser, add every part to the RockAuto cart
 * automatically, then navigate to the cart page. The window is left open so
 * the user can review and complete the purchase.
 */
export async function launchRockAutoCheckout(parts: PartToShip[]): Promise<CheckoutResult> {
  if (parts.length === 0) {
    throw new Error('No parts provided for checkout');
  }

  // Close any previous checkout window first so we always start with an empty cart.
  if (checkoutBrowser && checkoutBrowser.isConnected()) {
    await checkoutBrowser.close().catch(() => {});
    checkoutBrowser = null;
  }

  console.log(`[RockAuto Checkout] Opening headed browser for ${parts.length} parts`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  checkoutBrowser = browser;

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1400, height: 1000 },
    locale: 'en-US',
  });
  const page = await context.newPage();
  const checkoutAddress = getShopCheckoutAddress();

  const failed: string[] = [];
  let added = 0;

  for (const part of parts) {
    try {
      console.log(`[RockAuto Checkout] Adding ${part.part_number} (${part.part_name})`);
      await page.goto(part.listing_url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);

      const ok = await clickAddToCartForPart(page, part.part_number, part.option_value);
      if (ok) {
        added++;
        await page.waitForTimeout(1800);
        console.log(`[RockAuto Checkout] ✓ ${part.part_number} added`);
      } else {
        failed.push(part.part_number);
        console.warn(`[RockAuto Checkout] ✗ No Add to Cart button for ${part.part_number}`);
      }
    } catch (err) {
      failed.push(part.part_number);
      console.error(`[RockAuto Checkout] Failed on ${part.part_number}:`, (err as Error).message);
    }
  }

  // Land on the cart page and populate its shipping form from Settings.
  let addressEntered = false;
  try {
    await page.goto('https://www.rockauto.com/en/cart/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1000);
    if (checkoutAddress) {
      addressEntered = await fillRockAutoShippingAddress(page, checkoutAddress);
      console.log(`[RockAuto Checkout] ${addressEntered ? '✓ Shipping address entered' : 'Shipping address form not found'}`);
    } else {
      console.warn('[RockAuto Checkout] Shop address is incomplete in Settings; shipping address was not entered');
    }
  } catch (err) {
    console.error('[RockAuto Checkout] Could not open or fill the cart page:', (err as Error).message);
  }

  return {
    parts_requested: parts.length,
    parts_added: added,
    parts_failed: failed,
    cart_url: 'https://www.rockauto.com/en/cart/',
    address_entered: addressEntered,
  };
}

/** Close the open checkout window (e.g. during app shutdown). */
export async function closeCheckoutBrowser(): Promise<void> {
  if (checkoutBrowser) {
    await checkoutBrowser.close().catch(() => {});
    checkoutBrowser = null;
  }
}
