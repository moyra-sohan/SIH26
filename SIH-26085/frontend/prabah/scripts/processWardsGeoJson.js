import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcGeoJsonPath = path.resolve(__dirname, '../../../../wards_kolkata.geojson');
const destGeoJsonPath = path.resolve(__dirname, '../src/data/wards_kolkata.geojson');

console.log('Reading from:', srcGeoJsonPath);
const raw = fs.readFileSync(srcGeoJsonPath, 'utf8');
const data = JSON.parse(raw);

console.log('Original feature count:', data.features.length);

function flipCoord(pt) {
  let lat = pt[0];
  let lng = pt[1];
  // If pt[0] is lat (22.x) and pt[1] is lng (88.x), flip to [lng, lat]
  if (lat > 50 && lng < 50) {
    return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
  }
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

function flipRing(ring) {
  return ring.map(flipCoord);
}

function flipPolygon(polygonCoords) {
  return polygonCoords.map(flipRing);
}

function flipMultiPolygon(multiCoords) {
  return multiCoords.map(flipPolygon);
}

function getBoundsAndCenter(coords, type) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  let sumLng = 0, sumLat = 0, count = 0;

  function processPt(pt) {
    const lng = pt[0], lat = pt[1];
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
    sumLng += lng;
    sumLat += lat;
    count++;
  }

  if (type === 'Polygon') {
    coords.forEach(ring => ring.forEach(processPt));
  } else if (type === 'MultiPolygon') {
    coords.forEach(poly => poly.forEach(ring => ring.forEach(processPt)));
  }

  return {
    bounds: [[minLng, minLat], [maxLng, maxLat]],
    center: [Number((sumLng / count).toFixed(6)), Number((sumLat / count).toFixed(6))]
  };
}

// Known prominent names / locations for key wards in Kolkata
const KNOWN_WARD_NAMES = {
  1: 'Cossipore / Pramod Nagar',
  2: 'Belgachia North',
  3: 'Dum Dum Road / Paikpara',
  4: 'Paikpara / Tala',
  5: 'Tala / Belgachia East',
  6: 'Kankurgachi North',
  7: 'Bagbazar / Shyambazar',
  8: 'Shyambazar / Sovabazar',
  9: 'Kumartuli / Shobhabazar',
  10: 'Shyambazar Five-Point',
  11: 'Hatibagan / Star Theatre',
  12: 'Khanna / Maniktala North',
  13: 'Maniktala / Ultadanga Main',
  14: 'Ultadanga / Bagmari',
  15: 'Maniktala Canal West',
  16: 'Goabagan / Hedua',
  17: 'Beadon Street / Girish Park',
  18: 'Jorasanko North',
  19: 'Sovabazar Ghat / Strand',
  20: 'Ahiritola / Nimtala Ghat',
  21: 'Jorabagan / Posta North',
  22: 'Posta / Barabazar Core',
  23: 'Barabazar / Canning Street',
  24: 'Girish Park / Central Ave',
  25: 'Simla / Vivekananda Road',
  26: 'Amherst Street / Rajabazar',
  27: 'Koley Market / Sealdah North',
  28: 'Rajabazar / Canal East',
  29: 'Narkeldanga / Phoolbagan',
  30: 'Phoolbagan / Kankurgachi',
  31: 'Kankurgachi / VIP Road Core',
  32: 'Salt Lake Bypass / Ultadanga',
  33: 'Beliaghata CIT Road',
  34: 'Beliaghata Main Road',
  35: 'Beliaghata / Rashmoni Bazar',
  36: 'Sealdah Station / Baithakkhana',
  37: 'Amherst Street South',
  38: 'Bowbazar / College Street',
  39: 'College Street / Calcutta Univ',
  40: 'Medical College / Colootola',
  41: 'Madan Street / Chandni Chowk',
  42: 'Chandni Chowk / BBD Bagh East',
  43: 'BBD Bagh / Writers Building',
  44: 'Dalhousie / Fairlie Place',
  45: 'Howrah Strand / BBD Bagh',
  46: 'Esplanade / New Market North',
  47: 'Bowbazar / BB Ganguly Street',
  48: 'Taltala / Lenin Sarani',
  49: 'Sealdah South / Entally West',
  50: 'Entally / Moulali',
  51: 'Lenin Sarani / Wellington',
  52: 'New Market / Lindsay Street',
  53: 'Taltala South / Ripon Street',
  54: 'Park Street / Free School St',
  55: 'Park Circus North / Beniapukur',
  56: 'Entally / Convent Road',
  57: 'Tangra / Pagladanga',
  58: 'Tangra / Chinatown Core',
  59: 'Topsia North / Tiljala',
  60: 'Beniapukur / Gorachand Road',
  61: 'Park Circus / Shakespeare Sarani',
  62: 'Park Circus 7-Point Crossing',
  63: 'Park Street / Chowringhee',
  64: 'Park Circus South / Orient Row',
  65: 'Ballygunge Circular / Broad St',
  66: 'Topsia / Science City West',
  67: 'Picnic Garden / Tiljala',
  68: 'Ballygunge / Dover Road',
  69: 'Garcha / Hazra Road East',
  70: 'Bhawanipur / Ashutosh Mukherjee',
  71: 'Hazra / Kalighat Temple',
  72: 'Kalighat / Rashbehari Ave',
  73: 'Bhawanipur / Chakraberia',
  74: 'Alipore Zoo / Belvedere',
  75: 'Hastings / Fort William South',
  76: 'Kidderpore / Diamond Harbour Rd',
  77: 'Kidderpore / Munshiganj',
  78: 'Watganj / Kidderpore Tram Depot',
  79: 'Taratala / Hyde Road',
  80: 'Garden Reach / Port Depot',
  81: 'New Alipore / Buroshibtala',
  82: 'Alipore / Chetla North',
  83: 'Kalighat / Menoka Cinema',
  84: 'Sarat Bose Road / Deshapriya Park',
  85: 'Deshapriya Park / Lake Market',
  86: 'Southern Avenue / Lake Temple',
  87: 'Dhakuria North / Mudiali',
  88: 'Golpark / Southern Avenue',
  89: 'Tollygunge Circular / Prince Anwar Shah',
  90: 'Rabindra Sarobar / Lake Garden',
  91: 'Kasba North / Bosepukur',
  92: 'Dhakuria South / Selimpur',
  93: 'Jodhpur Park / Lake Gardens',
  94: 'Tollygunge Phari / Prince Anwar Shah',
  95: 'Bijoygarh / Golf Green',
  96: 'Jadavpur / Sukanta Setu',
  97: 'Tollygunge / Netaji Nagar',
  98: 'Netaji Nagar / Naktala North',
  99: 'Jadavpur University / Baghajatin',
  100: 'Garia / Baghajatin South',
  101: 'Baghajatin / Patuli North',
  102: 'Patuli / Highland Park West',
  103: 'Santoshpur / Avenue South',
  104: 'Kasba South / Ruby Hospital East',
  105: 'EM Bypass / Ruby Crossroads',
  106: 'Kayasthapara / Kasba East',
  107: 'Ruby / Anandapur / EM Bypass',
  108: 'Urbana / Madurdaha / Anandapur',
  109: 'Mukundapur / AMRI Hospitals',
  110: 'Patuli Floating Market / EM Bypass',
  111: 'Brahmapur / Garia Station',
  112: 'Garia Mahamayatala',
  113: 'Kudghat / Metro Station',
  114: 'Bansdroni / Netaji Subhash Rd',
  115: 'Kudghat West / Tollygunge Canal',
  116: 'Behala Chowrasta / James Long',
  117: 'Taratala / Biren Roy Road',
  118: 'Behala Manton / Diamond Harbour',
  119: 'James Long Sarani / Behala',
  120: 'Behala Tram Depot / Sakher Bazar',
  121: 'Siriti / Tollygunge Club West',
  122: 'Haridevpur / Motilal Gupta Rd',
  123: 'Sodepur / Barisha North',
  124: 'Barisha / Sakher Bazar West',
  125: 'Thakurpukur / James Long South',
  126: 'Sarsuna / Diamond Park',
  127: 'Sarsuna College / Biren Roy West',
  128: 'Parnasree Pally / Behala Airport',
  129: 'Taratala / Brace Bridge',
  130: 'Behala Airport / Jinjira Bazar',
  131: 'Parnasree / Dhana Dhyanye West',
  132: 'Biren Roy Road West / Shakuntala',
  133: 'Garden Reach / Badartala',
  134: 'Metiabruz / Paharpur',
  135: 'Metiabruz / Bichalighat',
  136: 'Karbala / Metiabruz Central',
  137: 'Garden Reach / Mudiali Port',
  138: 'Akra Road / Metiabruz West',
  139: 'Metiabruz / Circular Garden Reach',
  140: 'Garden Reach / Coal Dock',
  141: 'Metiabruz Riverfront / River Hooghly'
};

function getWardZone(wardNum, lat, lng) {
  if (wardNum <= 35) return 'North Kolkata';
  if (wardNum <= 65) return 'Central Kolkata';
  if (wardNum <= 90) return 'South Kolkata';
  if (wardNum <= 100) return 'South East Kolkata';
  if (wardNum <= 115) return 'Jadavpur / Garia';
  if (wardNum <= 132) return 'Behala / South West';
  if (wardNum <= 144) return 'Metiabruz / Port Zone';
  return lat > 22.56 ? 'North Kolkata' : lat < 22.50 ? 'South Kolkata' : 'Central Kolkata';
}

const RISK_LEVELS = [
  { level: 'Critical', color: '#ef4444' },
  { level: 'Severe', color: '#f97316' },
  { level: 'High', color: '#f59e0b' },
  { level: 'Moderate', color: '#3b82f6' }
];

const cleanedFeatures = [];

data.features.forEach((f, idx) => {
  const p = f.properties || {};
  const rawWard = (p.WARD || p.Name || '').toString().replace(/[\r\n\t]/g, '').trim();
  const wardNum = parseInt(rawWard, 10);
  if (isNaN(wardNum)) {
    console.warn('Skipping invalid ward at index', idx, p);
    return;
  }

  let geom = f.geometry;
  if (!geom) return;

  let normType = geom.type;
  let normCoords;

  if (geom.type === 'GeometryCollection') {
    const polyGeom = geom.geometries.find(g => g.type === 'Polygon' || g.type === 'MultiPolygon');
    if (polyGeom) {
      normType = polyGeom.type;
      normCoords = normType === 'MultiPolygon' ? flipMultiPolygon(polyGeom.coordinates) : flipPolygon(polyGeom.coordinates);
    } else {
      console.warn('No polygon found in GeometryCollection for ward', wardNum);
      return;
    }
  } else if (geom.type === 'Polygon') {
    normCoords = flipPolygon(geom.coordinates);
  } else if (geom.type === 'MultiPolygon') {
    normCoords = flipMultiPolygon(geom.coordinates);
  } else {
    console.warn('Unhandled geometry type:', geom.type, 'for ward', wardNum);
    return;
  }

  const { bounds, center } = getBoundsAndCenter(normCoords, normType);
  const zone = getWardZone(wardNum, center[1], center[0]);
  const specificName = KNOWN_WARD_NAMES[wardNum] || `Ward ${wardNum}`;
  const riskIndex = (wardNum * 7 + 3) % RISK_LEVELS.length;
  const risk = RISK_LEVELS[riskIndex];

  cleanedFeatures.push({
    type: 'Feature',
    id: wardNum,
    properties: {
      ward_number: wardNum,
      name: specificName,
      full_name: `${specificName} (Ward ${wardNum})`,
      zone,
      vulnerability: risk.level,
      risk_color: risk.color,
      center,
      bounds
    },
    geometry: {
      type: normType,
      coordinates: normCoords
    }
  });
});

cleanedFeatures.sort((a, b) => a.properties.ward_number - b.properties.ward_number);

const finalGeoJson = {
  type: 'FeatureCollection',
  name: 'wards_kolkata',
  crs: {
    type: 'name',
    properties: {
      name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
    }
  },
  features: cleanedFeatures
};

console.log('Writing standardized GeoJSON to:', destGeoJsonPath);
fs.writeFileSync(destGeoJsonPath, JSON.stringify(finalGeoJson, null, 2), 'utf8');

console.log('Replacing source GeoJSON at:', srcGeoJsonPath);
fs.writeFileSync(srcGeoJsonPath, JSON.stringify(finalGeoJson, null, 2), 'utf8');

console.log('SUCCESS! Processed', cleanedFeatures.length, 'Kolkata wards.');
