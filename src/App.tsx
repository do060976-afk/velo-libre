import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Bike as BikeIcon, MapPinned, Route as RouteIcon, BatteryCharging, BookOpen, Settings, LocateFixed, Download, Upload, Play, Pause, Square, Plus, Trash2, Save, Navigation, Compass, Footprints, Camera, X, Menu, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import { all, put, remove, clearAndRestore, type Bike, type Ride, type SavedRoute } from './db'
import { generateRoutes, type RoutingSettings } from './routing'

const DEFAULT_CENTER: [number, number] = [43.6907, 4.6097] // Fourques (Gard)
const uid = () => crypto.randomUUID()
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)
const defaultBikes: Bike[] = [
  { id:'bike-1', name:'Vélo 1', brand:'', model:'', capacityWh:500, usualRangeKm:75, consumptionWhKm:8, chargePercent:100 },
  { id:'bike-2', name:'Vélo 2', brand:'', model:'', capacityWh:500, usualRangeKm:75, consumptionWhKm:8, chargePercent:100 },
]
type Tab = 'home'|'routes'|'ride'|'journal'|'bikes'|'settings'


function FitRoute({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) {
      const bounds = L.latLngBounds(
        points.map(([lat, lng]) => L.latLng(lat, lng))
      )
      map.fitBounds(bounds, { padding: [28, 28] })
    }
  }, [map, points])
  return null
}

function MapView({ center, routes, active, gps }: { center:[number,number]; routes:SavedRoute[]; active:string; gps:[number,number]|null }) {
  const selected = routes.find(r=>r.id===active)
  const points = selected?.coordinates || []
  return <MapContainer center={center} zoom={13} scrollWheelZoom className="map">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {points.length>0 && <><Polyline positions={points} pathOptions={{color:'#247653',weight:5,opacity:.9}}/><FitRoute points={points}/></>}
    <Marker position={center}><Popup>Départ de la balade</Popup></Marker>
    {gps && <Marker position={gps}><Popup>Votre position GPS</Popup></Marker>}
  </MapContainer>
}
function App() {
  const [tab,setTab] = useState<Tab>('home')
  const [bikes,setBikes] = useState<Bike[]>(defaultBikes)
  const [routes,setRoutes] = useState<SavedRoute[]>([])
  const [rides,setRides] = useState<Ride[]>([])
  const [center,setCenter] = useState<[number,number]>(DEFAULT_CENTER)
  const [place,setPlace] = useState('Fourques (Gard)')
  const [distance,setDistance] = useState(30)
  const [mode,setMode] = useState<'automatic'|'custom'>('automatic')
  const [difficulty,setDifficulty] = useState('easy')
  const [terrain,setTerrain] = useState('mixed')
  const [endpoint,setEndpoint] = useState('')
  const [apiKey,setApiKey] = useState('')
  const [activeRoute,setActiveRoute] = useState('')
  const [loading,setLoading] = useState(false)
  const [notice,setNotice] = useState('Bienvenue dans VÉLO LIBRE.')
  const [gps,setGps] = useState<[number,number]|null>(null)
  const [tracking,setTracking] = useState(false)
  const [paused,setPaused] = useState(false)
  const [track,setTrack] = useState<[number,number][]>([])
  const [startedAt,setStartedAt] = useState<number|null>(null)
  const [rideName,setRideName] = useState('Ma balade')
  const [rideNotes,setRideNotes] = useState('')
  const [menuOpen,setMenuOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const [photo,setPhoto] = useState<string|undefined>()
  const [editBike,setEditBike] = useState<Bike|null>(null)

  const refresh = async () => {
    try {
      const [b,r,h] = await Promise.all([all<Bike>('bikes'),all<SavedRoute>('routes'),all<Ride>('rides')])
      if (b.length) setBikes(b)
      if (r.length) setRoutes(r)
      if (h.length) setRides(h)
    } catch { setNotice('Le stockage local n’est pas disponible dans ce navigateur.') }
  }
  useEffect(()=>{ refresh() },[])
  const active = routes.find(r=>r.id===activeRoute)
  const minRange = useMemo(()=>Math.min(...bikes.map(b=>b.capacityWh*b.chargePercent/100/Math.max(1,b.consumptionWhKm))),[bikes])
  const estimate = (bike:Bike) => bike.capacityWh*bike.chargePercent/100/Math.max(1,bike.consumptionWhKm)
  const nav = (next:Tab) => { setTab(next); setMenuOpen(false) }

  async function saveBike(bike:Bike) {
    const next = bikes.some(b=>b.id===bike.id) ? bikes.map(b=>b.id===bike.id?bike:b) : [...bikes,bike]
    setBikes(next); await put('bikes',bike); setEditBike(null); setNotice('Fiche vélo enregistrée.')
  }
  async function createRoutes(forceDemo=false) {
    setLoading(true); setNotice(forceDemo?'Création de circuits de démonstration…':'Recherche de circuits…')
    try {
      const result = await generateRoutes({lat:center[0],lon:center[1]},distance,{endpoint,apiKey},forceDemo)
      setRoutes(result); await Promise.all(result.map(r=>put('routes',r)))
      setActiveRoute(result[0]?.id || '')
      setNotice(result.some(r=>r.source==='demo') ? 'Circuits de démonstration créés. Ils ne suivent pas les routes réelles.' : 'Circuits calculés par Valhalla.')
    } catch(e) { setNotice(e instanceof Error ? e.message : 'Erreur lors du calcul des parcours.') }
    finally { setLoading(false) }
  }
  function locate() {
    if (!navigator.geolocation) { setNotice('La géolocalisation n’est pas disponible.'); return }
    navigator.geolocation.getCurrentPosition(pos=>{
      const p:[number,number]=[pos.coords.latitude,pos.coords.longitude]; setCenter(p); setGps(p); setPlace('Ma position GPS'); setNotice('Position GPS actualisée.')
    },()=>setNotice('Position inaccessible. Vérifiez l’autorisation GPS.'),{enableHighAccuracy:true,timeout:12000})
  }
  function startTracking() {
    if (!navigator.geolocation) { setNotice('GPS indisponible.'); return }
    setTracking(true); setPaused(false); setTrack([]); setStartedAt(Date.now()); setNotice('Balade démarrée.')
  }
  useEffect(()=>{
    if (!tracking || paused) return
    const id=navigator.geolocation?.watchPosition(pos=>{
      const p:[number,number]=[pos.coords.latitude,pos.coords.longitude]
      setGps(p); setTrack(old=>old.length && Math.abs(old[old.length-1][0]-p[0])+Math.abs(old[old.length-1][1]-p[1])<0.00004?old:[...old,p])
    },()=>setNotice('Signal GPS momentanément indisponible.'),{enableHighAccuracy:true,maximumAge:5000})
    return ()=>{ if (id!==undefined) navigator.geolocation.clearWatch(id) }
  },[tracking,paused])
  const trackDistance = useMemo(()=>{
    let d=0; for(let i=1;i<track.length;i++) d+=L.latLng(track[i-1]).distanceTo(L.latLng(track[i])); return d/1000
  },[track])
  async function finishRide() {
    const ride:Ride={id:uid(),name:rideName,date:new Date().toISOString(),distanceKm:trackDistance,durationMin:startedAt?Math.round((Date.now()-startedAt)/60000):0,ascentM:0,coordinates:track,notes:rideNotes,photo,bikeCharges:bikes.map(b=>b.chargePercent)}
    await put('rides',ride); setRides(old=>[ride,...old]); setTracking(false); setPaused(false); setNotice('Sortie enregistrée dans le carnet.')
    setTrack([]); setStartedAt(null); setPhoto(undefined); setRideNotes('')
  }
  function exportGpx(route:SavedRoute) {
    const pts=route.coordinates.map(([lat,lon])=>`<trkpt lat="${lat}" lon="${lon}"></trkpt>`).join('')
    const xml=`<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="VÉLO LIBRE" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${route.name}</name><trkseg>${pts}</trkseg></trk></gpx>`
    download(new Blob([xml],{type:'application/gpx+xml'}),`${slug(route.name)}.gpx`)
  }
  function download(blob:Blob,name:string) { const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url) }
  const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  function exportBackup() {
    Promise.all([all<Bike>('bikes'),all<SavedRoute>('routes'),all<Ride>('rides')]).then(([bikes,routes,rides])=>download(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),bikes,routes,rides},null,2)],{type:'application/json'}),'velo-libre-sauvegarde.json'))
  }
  async function importBackup(file:File) {
    try { const data=JSON.parse(await file.text()); if(!Array.isArray(data.bikes)||!Array.isArray(data.routes)||!Array.isArray(data.rides)) throw new Error('Format de sauvegarde non reconnu.')
      await clearAndRestore(data); await refresh(); setNotice('Sauvegarde restaurée avec succès.')
    } catch(e) { setNotice(e instanceof Error?e.message:'Impossible de lire cette sauvegarde.') }
  }
  async function importGpx(file:File) {
    try {
      const xml=new DOMParser().parseFromString(await file.text(),'application/xml')
      const pts=Array.from(xml.querySelectorAll('trkpt,rtept')).map(el=>[Number(el.getAttribute('lat')),Number(el.getAttribute('lon'))] as [number,number]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]))
      if(pts.length<2) throw new Error('Aucun point GPX exploitable.')
      const route:SavedRoute={id:uid(),name:xml.querySelector('name')?.textContent||file.name.replace(/\.gpx$/i,''),distanceKm:0,ascentM:0,durationMin:0,coordinates:pts,source:'demo',createdAt:new Date().toISOString(),notes:'Parcours importé : distance à recalculer.'}
      await put('routes',route); setRoutes(old=>[route,...old]); setActiveRoute(route.id); setTab('routes'); setNotice('Parcours GPX importé.')
    } catch(e) { setNotice(e instanceof Error?e.message:'Erreur d’import GPX.') }
  }
  async function deleteRide(id:string) { await remove('rides',id); setRides(old=>old.filter(r=>r.id!==id)) }
  async function deleteRoute(id:string) { await remove('routes',id); setRoutes(old=>old.filter(r=>r.id!==id)); if(activeRoute===id)setActiveRoute('') }
  const menuItems:[Tab,string,any][]=[['home','Accueil',Compass],['routes','Balades',MapPinned],['ride','Navigation',Navigation],['journal','Carnet',BookOpen],['bikes','Mes vélos',BikeIcon],['settings','Réglages',Settings]]
  const selectedCoords = active?.coordinates || (tracking?track:[])
  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={()=>nav('home')}><span className="brand-mark"><BikeIcon size={24}/></span><span><b>VÉLO LIBRE</b><small>Le compagnon de vos balades</small></span></button>
      <button className="icon-btn mobile-menu" onClick={()=>setMenuOpen(!menuOpen)} aria-label="Menu"><Menu/></button>
      <nav className={menuOpen?'nav open':'nav'}>{menuItems.map(([id,label,Icon])=><button key={id} className={tab===id?'nav-item active':'nav-item'} onClick={()=>nav(id)}><Icon size={17}/>{label}</button>)}</nav>
    </header>
    <main className="main">
      <div className="welcome-row"><div><div className="eyebrow">PRENEZ LE TEMPS DE DÉCOUVRIR</div><h1>{tab==='home'?'Bonjour, prêts à partir ?':menuItems.find(x=>x[0]===tab)?.[1]}</h1><p className="muted">Deux vélos, une envie d’ailleurs.</p></div><button className="btn secondary" onClick={locate}><LocateFixed size={17}/> Ma position</button></div>
      <div className="notice"><CheckCircle2 size={16}/>{notice}</div>

      {tab==='home' && <div className="home-grid">
        <section className="hero card"><div className="hero-copy"><span className="pill">VOTRE PROCHAINE ÉCHAPPÉE</span><h2>La liberté<br/>à portée de pédale.</h2><p>Imaginez une balade, choisissez votre rythme et profitez du paysage. VÉLO LIBRE s’occupe de vous accompagner.</p><button className="btn light" onClick={()=>nav('routes')}>Préparer une balade <RouteIcon size={17}/></button></div><div className="hero-art"><div className="sun"></div><div className="hill hill-one"></div><div className="hill hill-two"></div><div className="road"></div><BikeIcon className="hero-bike" size={100}/></div></section>
        <section className="card battery-card"><div className="section-heading"><div><span className="eyebrow">NOTRE DUO</span><h3>Énergie disponible</h3></div><BatteryCharging/></div>
          {bikes.slice(0,2).map((b,i)=><div className="battery-row" key={b.id}><div className="battery-label"><span>{b.name}</span><b>{b.chargePercent}%</b></div><div className="progress"><span style={{width:`${b.chargePercent}%`}}/></div><small>Autonomie estimée : {fmt(estimate(b))} km</small></div>)}
          <div className="range-summary"><span>Autonomie prudente du duo</span><b>{fmt(minRange)} km</b></div><button className="text-btn" onClick={()=>nav('bikes')}>Gérer les vélos →</button>
        </section>
        <section className="card quick-card"><span className="eyebrow">EN UN INSTANT</span><h3>Que souhaitez-vous faire ?</h3><div className="quick-actions"><button onClick={()=>nav('routes')}><MapPinned/><b>Trouver une balade</b><small>Créer une boucle</small></button><button onClick={()=>nav('ride')}><Navigation/><b>Partir rouler</b><small>Suivre le GPS</small></button><button onClick={()=>nav('journal')}><BookOpen/><b>Mes souvenirs</b><small>Voir le carnet</small></button></div></section>
        <section className="card recent-card"><div className="section-heading"><div><span className="eyebrow">VOTRE HISTOIRE</span><h3>Dernières balades</h3></div><button className="text-btn" onClick={()=>nav('journal')}>Tout voir →</button></div>
          {rides.length===0?<p className="muted empty">Vos sorties apparaîtront ici après votre première balade.</p>:rides.slice(0,3).map(r=><div className="recent-item" key={r.id}><span className="round-icon"><BikeIcon/></span><div><b>{r.name}</b><small>{new Date(r.date).toLocaleDateString('fr-FR')} · {fmt(r.distanceKm)} km</small></div></div>)}
        </section>
      </div>}

      {tab==='routes' && <div className="content-grid">
        <section className="card panel">
          <div className="section-heading"><div><span className="eyebrow">GÉNÉRATEUR DE BALADES</span><h3>Votre prochaine boucle</h3></div><Compass/></div>
          <div className="segmented"><button className={mode==='automatic'?'chosen':''} onClick={()=>setMode('automatic')}>Automatique</button><button className={mode==='custom'?'chosen':''} onClick={()=>setMode('custom')}>Personnalisé</button></div>
          <label>Point de départ</label><input value={place} onChange={e=>setPlace(e.target.value)} placeholder="Commune ou lieu"/>
          <div className="field-row"><div><label>Distance souhaitée</label><div className="range-input"><input type="range" min="10" max="80" step="5" value={distance} onChange={e=>setDistance(Number(e.target.value))}/><b>{distance} km</b></div></div><div><label>Difficulté</label><select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="easy">Facile</option><option value="medium">Modérée</option><option value="hard">Soutenue</option></select></div></div>
          {mode==='custom' && <><label>Ambiance souhaitée</label><select value={terrain} onChange={e=>setTerrain(e.target.value)}><option value="mixed">Un peu de tout</option><option value="nature">Nature et paysages</option><option value="heritage">Villages et patrimoine</option><option value="greenways">Voies vertes et pistes cyclables</option></select><p className="hint">Les préférences seront prises en compte lorsque le moteur de routage configuré les prend en charge.</p></>}
          <button className="btn primary full" disabled={loading} onClick={()=>createRoutes(false)}>{loading?<RefreshCw className="spin"/>:<RouteIcon/>}{loading?'Calcul en cours…':'Générer mes balades'}</button>
          <button className="btn secondary full" onClick={()=>createRoutes(true)}>Essayer avec des circuits de démonstration</button>
          <p className="hint">Sans moteur Valhalla configuré, le mode démonstration dessine des boucles indicatives qui ne suivent pas les routes réelles. Ne les utilisez pas pour naviguer.</p>
          <div className="divider"></div><button className="btn secondary full" onClick={()=>fileRef.current?.click()}><Upload size={16}/> Importer un fichier GPX</button>
          <input ref={fileRef} type="file" accept=".gpx,application/gpx+xml,application/xml" hidden onChange={e=>e.target.files?.[0]&&importGpx(e.target.files[0])}/>
        </section>
        <section className="card map-panel"><div className="map-head"><div><span className="eyebrow">CARTE INTERACTIVE</span><h3>{active?.name||'Votre secteur'}</h3></div><span className="map-tag">OpenStreetMap</span></div>
          <MapView center={center} routes={routes} active={activeRoute} gps={gps}/>
          <div className="map-caption"><span><i className="legend-dot"></i> Départ / position</span><span><i className="legend-line"></i> Itinéraire sélectionné</span></div>
          {routes.map(r=><div className={r.id===activeRoute?'route-result selected':'route-result'} key={r.id} onClick={()=>setActiveRoute(r.id)}><div className="route-result-main"><b>{r.name}</b><small>{r.source==='valhalla'?'Calculé par Valhalla':'Démonstration / import'}</small></div><strong>{fmt(r.distanceKm)} km</strong><button className="icon-btn" title="Exporter GPX" onClick={e=>{e.stopPropagation();exportGpx(r)}}><Download size={16}/></button><button className="icon-btn" title="Supprimer" onClick={e=>{e.stopPropagation();deleteRoute(r.id)}}><Trash2 size={16}/></button></div>)}
          {active && <div className="route-metrics"><div><b>{fmt(active.distanceKm)} km</b><small>Distance</small></div><div><b>{active.ascentM} m</b><small>Dénivelé connu</small></div><div><b>{active.durationMin} min</b><small>Durée indicative</small></div></div>}
        </section>
      </div>}

      {tab==='ride' && <div className="content-grid">
        <section className="card panel"><span className="eyebrow">SUIVI GPS</span><h3>Sur la route</h3><p className="muted">Autorisez la géolocalisation pour enregistrer votre trace. Gardez le téléphone fixé et utilisez les commandes à l’arrêt.</p>
          <div className="tracking-stats"><div><b>{fmt(trackDistance)}</b><small>km parcourus</small></div><div><b>{track.length}</b><small>points GPS</small></div><div><b>{startedAt?Math.round((Date.now()-startedAt)/60000):0}</b><small>minutes</small></div></div>
          {!tracking?<button className="btn primary full" onClick={startTracking}><Play/> Démarrer la sortie</button>:<><div className="field-row"><button className="btn secondary full" onClick={()=>setPaused(!paused)}>{paused?<Play/>:<Pause/>}{paused?'Reprendre':'Pause'}</button><button className="btn danger full" onClick={finishRide}><Square/> Terminer</button></div><label>Nom de la sortie</label><input value={rideName} onChange={e=>setRideName(e.target.value)}/><label>Notes</label><textarea value={rideNotes} onChange={e=>setRideNotes(e.target.value)} placeholder="Un joli point de vue, une pause agréable…"/><button className="btn secondary full" onClick={()=>photoRef.current?.click()}><Camera/> Ajouter une photo</button><input ref={photoRef} hidden type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f){const reader=new FileReader();reader.onload=()=>setPhoto(String(reader.result));reader.readAsDataURL(f)}}}/>{photo&&<img className="preview-photo" src={photo}/>}</>}
        </section>
        <section className="card map-panel"><div className="map-head"><div><span className="eyebrow">VOTRE POSITION</span><h3>Carte de navigation</h3></div><button className="btn secondary small" onClick={locate}><LocateFixed size={15}/> GPS</button></div><MapView center={gps||center} routes={[]} active="" gps={gps}/><p className="hint">Le suivi GPS en arrière-plan peut être interrompu par le système d’économie d’énergie du téléphone. Cette version enregistre la trace tant que la page reste active.</p></section>
      </div>}

      {tab==='bikes' && <div className="card panel"><div className="section-heading"><div><span className="eyebrow">NOTRE DUO</span><h3>Les deux vélos</h3></div><button className="btn primary" onClick={()=>setEditBike({id:uid(),name:'Nouveau vélo',brand:'',model:'',capacityWh:500,usualRangeKm:70,consumptionWhKm:8,chargePercent:100})}><Plus/> Ajouter</button></div>
        <div className="bike-grid">{bikes.map(b=><div className="bike-card" key={b.id}><div className="bike-card-top"><span className="round-icon"><BikeIcon/></span><button className="text-btn" onClick={()=>setEditBike(b)}>Modifier</button></div><h3>{b.name}</h3><p className="muted">{[b.brand,b.model].filter(Boolean).join(' ')||'VTC électrique'}</p><div className="battery-label"><span>Batterie</span><b>{b.chargePercent}%</b></div><div className="progress"><span style={{width:`${b.chargePercent}%`}}/></div><div className="bike-numbers"><div><b>{b.capacityWh} Wh</b><small>Capacité</small></div><div><b>{fmt(estimate(b))} km</b><small>Autonomie estimée</small></div></div><label>Charge actuelle : {b.chargePercent}%</label><input type="range" min="0" max="100" value={b.chargePercent} onChange={e=>saveBike({...b,chargePercent:Number(e.target.value)})}/></div>)}</div>
        {editBike&&<div className="modal-backdrop"><div className="modal"><div className="section-heading"><h3>Fiche vélo</h3><button className="icon-btn" onClick={()=>setEditBike(null)}><X/></button></div>{(['name','brand','model'] as const).map(k=><div key={k}><label>{k==='name'?'Nom':k==='brand'?'Marque':'Modèle'}</label><input value={editBike[k]} onChange={e=>setEditBike({...editBike,[k]:e.target.value})}/></div>)}<div className="field-row"><div><label>Capacité (Wh)</label><input type="number" value={editBike.capacityWh} onChange={e=>setEditBike({...editBike,capacityWh:Number(e.target.value)})}/></div><div><label>Consommation (Wh/km)</label><input type="number" value={editBike.consumptionWhKm} onChange={e=>setEditBike({...editBike,consumptionWhKm:Number(e.target.value)})}/></div></div><div className="field-row"><div><label>Autonomie habituelle (km)</label><input type="number" value={editBike.usualRangeKm} onChange={e=>setEditBike({...editBike,usualRangeKm:Number(e.target.value)})}/></div><div><label>Charge (%)</label><input type="number" min="0" max="100" value={editBike.chargePercent} onChange={e=>setEditBike({...editBike,chargePercent:Number(e.target.value)})}/></div></div><button className="btn primary full" onClick={()=>saveBike(editBike)}><Save/> Enregistrer</button></div></div>}
      </div>}

      {tab==='journal' && <section className="card panel"><div className="section-heading"><div><span className="eyebrow">VOS SOUVENIRS</span><h3>Le carnet de balades</h3></div><BookOpen/></div>
        {rides.length===0?<div className="empty-state"><BookOpen size={36}/><h3>Votre carnet est encore vierge</h3><p>Enregistrez votre première sortie pour la retrouver ici.</p></div>:<div className="journal-grid">{rides.map(r=><article className="journal-card" key={r.id}>{r.photo?<img src={r.photo}/>:<div className="journal-placeholder"><BikeIcon size={36}/></div>}<div className="journal-body"><small>{new Date(r.date).toLocaleDateString('fr-FR')}</small><h3>{r.name}</h3><div className="journal-stats"><b>{fmt(r.distanceKm)} km</b><span>{r.durationMin} min</span></div>{r.notes&&<p>{r.notes}</p>}<button className="text-btn danger-text" onClick={()=>deleteRide(r.id)}>Supprimer cette sortie</button></div></article>)}</div>}
      </section>}

      {tab==='settings' && <div className="settings-grid"><section className="card panel"><span className="eyebrow">MOTEUR D’ITINÉRAIRES</span><h3>Connexion Valhalla</h3><p className="muted">Indiquez l’adresse d’un serveur Valhalla compatible. Aucun serveur n’est fourni avec cette application.</p><label>URL du serveur (ex. https://mon-serveur/route)</label><input value={endpoint} onChange={e=>setEndpoint(e.target.value)} placeholder="https://…"/><label>Clé API (facultative)</label><input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="Clé API si nécessaire"/><button className="btn primary full" onClick={()=>setNotice('Paramètres de routage actifs pour cette session. Pensez à les conserver dans votre gestionnaire de mots de passe.')}>Appliquer pour cette session</button><div className="callout"><AlertTriangle/> Sans serveur configuré, seuls les circuits de démonstration sont disponibles. Ils ne sont pas navigables.</div></section>
        <section className="card panel"><span className="eyebrow">VOS DONNÉES</span><h3>Sauvegarde et restauration</h3><p className="muted">Les vélos, parcours et sorties sont enregistrés sur cet appareil dans IndexedDB.</p><button className="btn primary full" onClick={exportBackup}><Download/> Exporter toutes mes données (JSON)</button><button className="btn secondary full" onClick={()=>fileRef.current?.click()}><Upload/> Importer un fichier GPX</button><label className="btn secondary full file-label"><Upload/> Restaurer une sauvegarde JSON<input type="file" accept="application/json,.json" onChange={e=>e.target.files?.[0]&&importBackup(e.target.files[0])}/></label><div className="callout"><CheckCircle2/> Pensez à effectuer régulièrement une sauvegarde, notamment avant de changer de téléphone ou de navigateur.</div></section>
        <section className="card panel"><span className="eyebrow">À PROPOS</span><h3>VÉLO LIBRE 1.0</h3><p>Deux vélos. Une envie d’ailleurs. Des balades sans souci.</p><p className="muted">Application indépendante. Les cartes en ligne sont fournies par OpenStreetMap et nécessitent une connexion. Le téléchargement de zones cartographiques hors ligne n’est pas inclus dans cette version.</p></section>
      </div>}
    </main>
    <footer>VÉLO LIBRE <span>·</span> Prenez le temps de découvrir.</footer>
  </div>
}
export default App
