import type { SavedRoute } from './db'

export type RoutingSettings = { endpoint: string; apiKey: string }
type LatLng = { lat: number; lon: number }
type ValhallaLeg = { shape: string; summary: { length: number; time: number }; maneuvers?: unknown[] }
type ValhallaResponse = { trip?: { legs: ValhallaLeg[]; summary: { length: number; time: number } }; error?: string }

function encodePolyline(str: string, precision = 6): [number, number][] {
  let index = 0, lat = 0, lon = 0;
  const coordinates: [number, number][] = [];
  while (index < str.length) {
    let result = 0, shift = 0, b: number;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0; shift = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lon += (result & 1) ? ~(result >> 1) : (result >> 1);
    coordinates.push([lat / 10 ** precision, lon / 10 ** precision]);
  }
  return coordinates;
}
const destination = (p: LatLng, km: number, bearing: number): LatLng => {
  const R = 6371, d = km / R, br = bearing * Math.PI / 180;
  const lat1 = p.lat * Math.PI / 180, lon1 = p.lon * Math.PI / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lon2 = lon1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: lat2 * 180 / Math.PI, lon: lon2 * 180 / Math.PI };
}
function demoRoute(center: LatLng, km: number, bearing: number, index: number): SavedRoute {
  const radius = km / (2 * Math.PI) * 1.25;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = radius * (1 + 0.08 * Math.sin(a * 3 + index));
    const east = r * Math.cos(a), north = r * Math.sin(a);
    const angle = bearing * Math.PI / 180;
    const rotatedE = east * Math.cos(angle) - north * Math.sin(angle);
    const rotatedN = east * Math.sin(angle) + north * Math.cos(angle);
    const lat = center.lat + rotatedN / 111.32;
    const lon = center.lon + rotatedE / (111.32 * Math.cos(center.lat * Math.PI / 180));
    pts.push([lat, lon]);
  }
  return {
    id: crypto.randomUUID(), name: ['La tranquille', 'La découverte', 'La panoramique'][index],
    distanceKm: km * [0.88, 1.02, 1.13][index], ascentM: [35, 65, 105][index],
    durationMin: Math.round(km * [3.5, 3.8, 4.1][index]), coordinates: pts,
    source: 'demo', createdAt: new Date().toISOString(),
    notes: 'Tracé de démonstration : ce circuit géométrique ne suit pas le réseau réel des routes et chemins. Configurez un moteur Valhalla pour obtenir un véritable itinéraire cyclable.'
  };
}
async function valhallaLeg(points: LatLng[], settings: RoutingSettings, bikeType: string): Promise<{coords:[number,number][]; km:number; minutes:number}> {
  const body = {
    locations: points.map(p => ({ lat: p.lat, lon: p.lon })),
    costing: 'bicycle',
    costing_options: { bicycle: { bicycle_type: bikeType, cycling_speed: 17, use_roads: 0.25, use_hills: 0.15, avoid_bad_surfaces: 0.7 } },
    units: 'kilometers',
    shape_format: 'polyline6',
    directions_options: { units: 'kilometers', language: 'fr-FR' }
  };
  const url = `${settings.endpoint.replace(/\/$/, '')}/route${settings.apiKey ? `?api_key=${encodeURIComponent(settings.apiKey)}` : ''}`;
  const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Valhalla : réponse HTTP ${res.status}`);
  const data = await res.json() as ValhallaResponse;
  if (!data.trip?.legs?.length) throw new Error(data.error || 'Aucun itinéraire retourné par Valhalla.');
  const coords = data.trip.legs.flatMap((leg, i) => {
    const decoded = encodePolyline(leg.shape);
    return i ? decoded.slice(1) : decoded;
  });
  return { coords, km: data.trip.summary.length, minutes: Math.round(data.trip.summary.time / 60) };
}
export async function generateRoutes(center: LatLng, km: number, settings: RoutingSettings, forceDemo = false): Promise<SavedRoute[]> {
  if (!forceDemo && settings.endpoint.trim()) {
    const bearings = [25, 145, 265];
    const results = await Promise.all(bearings.map(async (bearing, i) => {
      const waypoint = destination(center, km * 0.42, bearing);
      const second = destination(center, km * 0.36, bearing + 145);
      const route = await valhallaLeg([center, waypoint, second, center], settings, 'hybrid');
      return {
        id: crypto.randomUUID(), name: ['La tranquille', 'La découverte', 'La panoramique'][i],
        distanceKm: route.km, ascentM: 0, durationMin: route.minutes, coordinates: route.coords,
        source: 'valhalla' as const, createdAt: new Date().toISOString(),
        notes: 'Itinéraire calculé par Valhalla. Le dénivelé sera ajouté dans une évolution utilisant un profil altimétrique.'
      };
    }));
    return results.sort((a,b) => Math.abs(a.distanceKm-km)-Math.abs(b.distanceKm-km));
  }
  return [0,1,2].map(i => demoRoute(center, km, [15, 135, 255][i], i));
}
