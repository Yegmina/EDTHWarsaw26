"use client";

import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Cloud,
  Flame,
  Info,
  Maximize2,
  Menu,
  Minimize2,
  Radiation,
  Ruler,
  Search,
  SlidersHorizontal,
  Target
} from "lucide-react";
import {
  Circle,
  CircleMarker,
  Marker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents
} from "react-leaflet";

export type MapLayer = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  confidence: string;
  category: string;
  detail: string;
};

export type RangeRing = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  system?: string;
  projectile?: string;
  category?: string;
  status?: string;
};

type MapPanelProps = {
  layers: MapLayer[];
  rangeRings: RangeRing[];
  onRangeAnchorChange: (anchor: { lat: number; lng: number }) => void;
};

type ToolKey = "menu" | "alerts" | "info" | "layers" | "measure" | "weather" | "radiation" | "fires";

type WeaponTemplate = {
  id: string;
  name: string;
  category: string;
  status: string;
  readMore: string;
  projectiles: Array<{
    id: string;
    name: string;
    minKm: number;
    maxKm: number;
    status: string;
  }>;
};

type TacticalLocationTemplate = {
  id: string;
  name: string;
  type: "Unit" | "Airfield" | "Headquarters" | "Logistics" | "Air Defense" | "Missile";
  status: string;
  sourceName: string;
  sourceUrl: string;
};

type TacticalLocation = TacticalLocationTemplate & {
  lat: number;
  lng: number;
};

const diamondIcon = L.divIcon({
  className: "deep-diamond-marker",
  html: "<span></span>",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -8]
});

const defaultLayers: MapLayer[] = [
  {
    id: "russia-context",
    label: "Russia context",
    lat: 61.5,
    lng: 92,
    radiusMeters: 3600000,
    confidence: "medium",
    category: "context",
    detail: "Country-scale context for preloaded reference layers. Submit text to create a focused review layer."
  }
];

const tools: Array<{
  key: ToolKey;
  label: string;
  Icon: typeof Menu;
}> = [
  { key: "menu", label: "Menu", Icon: Menu },
  { key: "alerts", label: "Alerts", Icon: Bell },
  { key: "info", label: "Info", Icon: Info },
  { key: "layers", label: "Layers", Icon: SlidersHorizontal },
  { key: "measure", label: "Measure", Icon: Ruler },
  { key: "weather", label: "Weather", Icon: Cloud },
  { key: "radiation", label: "Radiation", Icon: Radiation },
  { key: "fires", label: "Fires", Icon: Flame }
];

const weaponTemplates: WeaponTemplate[] = [
  {
    id: "s-300",
    name: "S-300",
    category: "Anti-aircraft",
    status: "in operation",
    readMore: "https://en.wikipedia.org/wiki/S-300_missile_system",
    projectiles: [
      { id: "5v55r", name: "5В55Р", minKm: 0, maxKm: 90, status: "in operation" },
      { id: "48n6", name: "48Н6", minKm: 0, maxKm: 200, status: "in operation" }
    ]
  },
  {
    id: "patriot",
    name: "Patriot",
    category: "Anti-aircraft",
    status: "in operation",
    readMore: "https://en.wikipedia.org/wiki/MIM-104_Patriot",
    projectiles: [
      { id: "pac-2", name: "PAC-2 / GEM-T", minKm: 0, maxKm: 160, status: "in operation" },
      { id: "pac-3", name: "PAC-3 MSE", minKm: 0, maxKm: 60, status: "in operation" }
    ]
  },
  {
    id: "nasams",
    name: "NASAMS",
    category: "Anti-aircraft",
    status: "in operation",
    readMore: "https://en.wikipedia.org/wiki/NASAMS",
    projectiles: [
      { id: "aim-120", name: "AIM-120 AMRAAM", minKm: 2.5, maxKm: 40, status: "in operation" },
      { id: "amraam-er", name: "AMRAAM-ER", minKm: 0, maxKm: 50, status: "in operation" }
    ]
  },
  {
    id: "iris-t",
    name: "IRIS-T",
    category: "Anti-aircraft",
    status: "in operation",
    readMore: "https://en.wikipedia.org/wiki/IRIS-T",
    projectiles: [
      { id: "iris-t-slm", name: "IRIS-T SLM", minKm: 0, maxKm: 40, status: "in operation" },
      { id: "iris-t-sls", name: "IRIS-T SLS", minKm: 0, maxKm: 12, status: "in operation" }
    ]
  }
];

const tacticalLocationTemplates: TacticalLocationTemplate[] = [
  {
    id: "42-mrd",
    name: "42nd Motorized Rifle Division",
    type: "Unit",
    status: "reference template",
    sourceName: "Wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/42nd_Guards_Motor_Rifle_Division"
  },
  {
    id: "buturlinovka-airfield",
    name: "Buturlinovka airfield (Sign. Pryrodny)",
    type: "Airfield",
    status: "reference template",
    sourceName: "Wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Buturlinovka_(air_base)"
  },
  {
    id: "hq-reference",
    name: "Headquarters marker",
    type: "Headquarters",
    status: "manual placement",
    sourceName: "Analyst source",
    sourceUrl: "https://deepstatemap.live/en"
  },
  {
    id: "logistics-reference",
    name: "Logistics node marker",
    type: "Logistics",
    status: "manual placement",
    sourceName: "Analyst source",
    sourceUrl: "https://deepstatemap.live/en"
  }
];

const preloadedTacticalLocations: TacticalLocation[] = [
  {
    id: "ref-unit-01",
    name: "Motorized rifle formation reference",
    type: "Unit",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 54.71,
    lng: 20.51
  },
  {
    id: "ref-unit-02",
    name: "Combined-arms unit reference",
    type: "Unit",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 59.93,
    lng: 30.34
  },
  {
    id: "ref-unit-03",
    name: "Reserve formation reference",
    type: "Unit",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 55.76,
    lng: 37.62
  },
  {
    id: "ref-hq-01",
    name: "District headquarters reference",
    type: "Headquarters",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 47.24,
    lng: 39.71
  },
  {
    id: "ref-hq-02",
    name: "Operational command reference",
    type: "Headquarters",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 48.71,
    lng: 44.51
  },
  {
    id: "ref-airfield-01",
    name: "Airfield reference Alpha",
    type: "Airfield",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 56.84,
    lng: 60.61
  },
  {
    id: "ref-airfield-02",
    name: "Airfield reference Bravo",
    type: "Airfield",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 55.03,
    lng: 82.92
  },
  {
    id: "ref-airfield-03",
    name: "Airfield reference Charlie",
    type: "Airfield",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 52.29,
    lng: 104.28
  },
  {
    id: "ref-log-01",
    name: "Rail logistics node reference",
    type: "Logistics",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 54.99,
    lng: 73.37
  },
  {
    id: "ref-log-02",
    name: "Depot logistics node reference",
    type: "Logistics",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 56.01,
    lng: 92.87
  },
  {
    id: "ref-log-03",
    name: "Road logistics node reference",
    type: "Logistics",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 62.03,
    lng: 129.73
  },
  {
    id: "ref-ad-01",
    name: "Air-defense reference sector",
    type: "Air Defense",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 68.97,
    lng: 33.08
  },
  {
    id: "ref-ad-02",
    name: "Short-range air-defense reference",
    type: "Air Defense",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 43.12,
    lng: 131.89
  },
  {
    id: "ref-missile-01",
    name: "Missile support reference",
    type: "Missile",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 50.55,
    lng: 137.0
  },
  {
    id: "ref-missile-02",
    name: "Missile storage reference",
    type: "Missile",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 53.04,
    lng: 158.65
  }
];

function MapController({ layers, isFullscreen }: { layers: MapLayer[]; isFullscreen: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timeout = window.setTimeout(() => map.invalidateSize(), 250);
    return () => window.clearTimeout(timeout);
  }, [map, isFullscreen]);

  useEffect(() => {
    const focused = layers[0];
    if (!focused) {
      return;
    }

    const zoom = focused.radiusMeters > 1500000 ? 3 : focused.radiusMeters > 100000 ? 4 : 9;

    map.setView([focused.lat, focused.lng], zoom, {
      animate: true
    });
  }, [layers, map]);

  return null;
}

function MapClickTarget({
  onMapClick
}: {
  onMapClick: (anchor: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click(event) {
      onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });

  return null;
}

export function MapPanel({ layers, rangeRings, onRangeAnchorChange }: MapPanelProps) {
  const visibleLayers = layers.length ? layers : defaultLayers;
  const [activeTool, setActiveTool] = useState<ToolKey>("layers");
  const [showMarkers, setShowMarkers] = useState(true);
  const [showAreas, setShowAreas] = useState(true);
  const [showRanges, setShowRanges] = useState(true);
  const [selectedWeaponId, setSelectedWeaponId] = useState("s-300");
  const [selectedProjectileId, setSelectedProjectileId] = useState("5v55r");
  const [weaponPlacementArmed, setWeaponPlacementArmed] = useState(false);
  const [weaponRings, setWeaponRings] = useState<RangeRing[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("42-mrd");
  const [locationPlacementArmed, setLocationPlacementArmed] = useState(false);
  const [lastMapClick, setLastMapClick] = useState({ lat: 55.7558, lng: 37.6173 });
  const [tacticalLocations, setTacticalLocations] = useState<TacticalLocation[]>([]);
  const [locationFilters, setLocationFilters] = useState({
    Unit: true,
    Airfield: true,
    Headquarters: true,
    Logistics: true,
    "Air Defense": true,
    Missile: true
  });

  const activeToolTitle = useMemo(() => tools.find((tool) => tool.key === activeTool)?.label ?? "Layers", [
    activeTool
  ]);
  const selectedWeapon = weaponTemplates.find((weapon) => weapon.id === selectedWeaponId) ?? weaponTemplates[0];
  const selectedProjectile =
    selectedWeapon.projectiles.find((projectile) => projectile.id === selectedProjectileId) ??
    selectedWeapon.projectiles[0];
  const allRangeRings = [...rangeRings, ...weaponRings];
  const selectedLocation =
    tacticalLocationTemplates.find((location) => location.id === selectedLocationId) ?? tacticalLocationTemplates[0];
  const allTacticalLocations = [...preloadedTacticalLocations, ...tacticalLocations];
  const visibleTacticalLocations = allTacticalLocations.filter((location) => locationFilters[location.type]);

  function toggleLocationFilter(type: TacticalLocation["type"]) {
    setLocationFilters((filters) => ({ ...filters, [type]: !filters[type] }));
  }

  function toggleTool(tool: ToolKey) {
    setActiveTool((current) => (current === tool ? "layers" : tool));
  }

  function handleWeaponChange(id: string) {
    const nextWeapon = weaponTemplates.find((weapon) => weapon.id === id) ?? weaponTemplates[0];
    setSelectedWeaponId(nextWeapon.id);
    setSelectedProjectileId(nextWeapon.projectiles[0].id);
    setActiveTool("measure");
  }

  function handleMapClick(anchor: { lat: number; lng: number }) {
    onRangeAnchorChange(anchor);
    setLastMapClick(anchor);

    if (!weaponPlacementArmed) {
      if (!locationPlacementArmed) {
        return;
      }
    }

    if (weaponPlacementArmed) {
      setWeaponRings((rings) => [
        ...rings,
        {
          id: `weapon-${Date.now()}`,
          label: `${selectedWeapon.name} / ${selectedProjectile.name}`,
          lat: anchor.lat,
          lng: anchor.lng,
          radiusMeters: selectedProjectile.maxKm * 1000,
          system: selectedWeapon.name,
          projectile: selectedProjectile.name,
          category: selectedWeapon.category,
          status: selectedProjectile.status
        }
      ]);
      setWeaponPlacementArmed(false);
    }

    if (locationPlacementArmed) {
      setTacticalLocations((locations) => [
        ...locations,
        {
          ...selectedLocation,
          id: `${selectedLocation.id}-${Date.now()}`,
          lat: anchor.lat,
          lng: anchor.lng
        }
      ]);
      setLocationPlacementArmed(false);
    }
  }

  return (
    <div className={`map-shell ${isFullscreen ? "map-fullscreen" : ""}`}>
      <MapContainer
        center={[50.5, 65.0]}
        zoom={3}
        minZoom={2}
        maxZoom={12}
        scrollWheelZoom
        className="leaflet-stage"
      >
        <MapController layers={visibleLayers} isFullscreen={isFullscreen} />
        <MapClickTarget onMapClick={handleMapClick} />
        <TileLayer
          attribution='Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {visibleLayers.map((layer) => (
          <div key={layer.id}>
            {showAreas ? (
              <Circle
                center={[layer.lat, layer.lng]}
                radius={layer.radiusMeters}
                pathOptions={{
                  color: layer.category === "review-area" ? "#f2b84b" : "#74f0c7",
                  weight: 1,
                  fillColor: layer.category === "review-area" ? "#f2b84b" : "#74f0c7",
                  fillOpacity: 0.09
                }}
              />
            ) : null}
            {showMarkers ? (
              <Marker position={[layer.lat, layer.lng]} icon={diamondIcon}>
                <Popup>
                  <strong>{layer.label}</strong>
                  <br />
                  {layer.detail}
                  <br />
                  Confidence: {layer.confidence}
                </Popup>
              </Marker>
            ) : null}
          </div>
        ))}
        {showRanges ? allRangeRings.map((ring) => (
          <div key={ring.id}>
            <Circle
              center={[ring.lat, ring.lng]}
              radius={ring.radiusMeters}
              pathOptions={{
                color: "#f07167",
                weight: 2,
                dashArray: "8 8",
                fillColor: "#f07167",
                fillOpacity: 0.04
              }}
            />
            <Marker position={[ring.lat, ring.lng]} icon={diamondIcon}>
              <Popup>
                <strong>{ring.label}</strong>
                <br />
                {ring.category ? `${ring.category} / ${ring.status}` : null}
                {ring.category ? <br /> : null}
                Radius: {Math.round(ring.radiusMeters / 1000)} km
              </Popup>
            </Marker>
          </div>
        )) : null}
        {showMarkers
          ? visibleTacticalLocations.map((location) => (
              <CircleMarker
                center={[location.lat, location.lng]}
                radius={location.type === "Airfield" ? 8 : 6}
                pathOptions={{
                  color: location.type === "Airfield" ? "#74f0c7" : "#f2b84b",
                  weight: 2,
                  fillColor: location.type === "Airfield" ? "#101713" : "#f2b84b",
                  fillOpacity: location.type === "Airfield" ? 0.88 : 0.7
                }}
                key={location.id}
              >
                <Popup>
                  <strong>{location.name}</strong>
                  <br />
                  {location.type} / {location.status}
                  <br />
                  Source: {location.sourceName}
                </Popup>
              </CircleMarker>
            ))
          : null}
      </MapContainer>
      <button
        type="button"
        className="map-fullscreen-toggle"
        aria-label={isFullscreen ? "Back from fullscreen map" : "Fullscreen map"}
        onClick={() => setIsFullscreen((value) => !value)}
      >
        {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        {isFullscreen ? "Back" : "Fullscreen"}
      </button>
      <div className="deep-side-tools">
        {tools.map(({ key, label, Icon }) => (
          <button
            type="button"
            aria-label={label}
            className={activeTool === key ? "tool-active" : undefined}
            key={key}
            onClick={() => toggleTool(key)}
          >
            <Icon size={17} />
          </button>
        ))}
      </div>
      <div className={weaponPlacementArmed || locationPlacementArmed ? "deep-tool-panel placement-armed" : "deep-tool-panel"}>
        <div className="tool-panel-title">
          <strong>{activeToolTitle}</strong>
          <span>{activeTool === "measure" ? "Click the map to move range anchor" : "Operational layer controls"}</span>
        </div>
        {activeTool === "layers" || activeTool === "menu" ? (
          <div className="layer-panel-stack">
            <div className="layer-toggles">
              <label>
                <input type="checkbox" checked={showMarkers} onChange={() => setShowMarkers((value) => !value)} />
                Review markers
              </label>
              <label>
                <input type="checkbox" checked={showAreas} onChange={() => setShowAreas((value) => !value)} />
                Area confidence
              </label>
              <label>
                <input type="checkbox" checked={showRanges} onChange={() => setShowRanges((value) => !value)} />
                Range overlays
              </label>
            </div>
            <div className="tactical-location-panel">
              <h3>Tactical locations</h3>
              <div className="location-filter-grid">
                {(["Unit", "Headquarters", "Airfield", "Logistics", "Air Defense", "Missile"] as Array<
                  TacticalLocation["type"]
                >).map((type) => (
                  <label key={type}>
                    <input checked={locationFilters[type]} onChange={() => toggleLocationFilter(type)} type="checkbox" />
                    {type}
                  </label>
                ))}
              </div>
              <div className="location-count">
                Showing {visibleTacticalLocations.length} of {allTacticalLocations.length}
              </div>
              <label>
                Location template
                <select value={selectedLocation.id} onChange={(event) => setSelectedLocationId(event.target.value)}>
                  {tacticalLocationTemplates.map((location) => (
                    <option value={location.id} key={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="location-card">
                <strong>{selectedLocation.name}</strong>
                <span>
                  {selectedLocation.type} / {selectedLocation.status}
                </span>
                <a href={selectedLocation.sourceUrl} target="_blank" rel="noreferrer">
                  {selectedLocation.sourceName}
                </a>
              </div>
              <button
                type="button"
                className={locationPlacementArmed ? "place-weapon armed" : "place-weapon"}
                onClick={() => setLocationPlacementArmed((value) => !value)}
              >
                {locationPlacementArmed ? "Click map to place location" : "Place selected location"}
              </button>
              <button type="button" className="ghost-button clear-weapons" onClick={() => setTacticalLocations([])}>
                Clear locations
              </button>
              <p>
                Last map click: {lastMapClick.lat.toFixed(3)}, {lastMapClick.lng.toFixed(3)}
              </p>
            </div>
          </div>
        ) : null}
        {activeTool === "alerts" ? (
          <p>Latest source updates are queued for analyst review. No confirmed alert feed is attached.</p>
        ) : null}
        {activeTool === "info" ? (
          <p>
            Active layer: {visibleLayers[0]?.label}. Confidence: {visibleLayers[0]?.confidence}. Rings:{" "}
            {allRangeRings.length}. Locations: {visibleTacticalLocations.length}/{allTacticalLocations.length}.
          </p>
        ) : null}
        {activeTool === "measure" ? (
          <div className="weapon-range-panel">
            <h3>Weapons range</h3>
            <div className="weapon-card-list">
              {weaponTemplates.map((weapon) => (
                <button
                  type="button"
                  className={weapon.id === selectedWeapon.id ? "weapon-card weapon-selected" : "weapon-card"}
                  key={weapon.id}
                  onClick={() => handleWeaponChange(weapon.id)}
                >
                  <strong>{weapon.name}</strong>
                  <span>{weapon.category}</span>
                  <em>{weapon.status}</em>
                </button>
              ))}
            </div>
            <a className="read-more-link" href={selectedWeapon.readMore} target="_blank" rel="noreferrer">
              Read more
            </a>
            <label className="projectile-select-label">
              Select projectile/missile
              <select value={selectedProjectile.id} onChange={(event) => setSelectedProjectileId(event.target.value)}>
                {selectedWeapon.projectiles.map((projectile) => (
                  <option value={projectile.id} key={projectile.id}>
                    {projectile.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="projectile-row">
              <strong>{selectedProjectile.name}</strong>
              <span>
                {selectedProjectile.minKm.toFixed(2)}-{selectedProjectile.maxKm.toFixed(2)} km
              </span>
              <em>{selectedProjectile.status}</em>
            </div>
            <button
              type="button"
              className={weaponPlacementArmed ? "place-weapon armed" : "place-weapon"}
              onClick={() => setWeaponPlacementArmed((value) => !value)}
            >
              {weaponPlacementArmed ? "Click map to place" : "Place on map"}
            </button>
            <button type="button" className="ghost-button clear-weapons" onClick={() => setWeaponRings([])}>
              Clear weapon ranges
            </button>
          </div>
        ) : null}
        {activeTool === "weather" ? <p>Weather layer placeholder active. Connect provider data when available.</p> : null}
        {activeTool === "radiation" ? (
          <p>Radiation layer placeholder active. No live radiation feed is configured.</p>
        ) : null}
        {activeTool === "fires" ? <p>Incident/fires layer placeholder active. No live incident feed is configured.</p> : null}
      </div>
      <div className="deep-search-card">
        <strong>AEROROZUM</strong>
        <span>
          <Search size={15} />
          Search layer / coordinate
        </span>
      </div>
      <div className="map-overlay top-left">
        <span>LIVE SATELLITE BASEMAP</span>
        <strong>{visibleLayers[0]?.label ?? "Russia Context Layer"}</strong>
      </div>
      <div className="map-overlay bottom-right">
        <span>RANGE TOOL</span>
        <strong>Click map to set anchor</strong>
      </div>
      <div className="deep-legend">
        <div>
          <Target size={14} />
          Review marker
        </div>
        <div>
          <span className="legend-swatch amber" />
          Area confidence
        </div>
        <div>
          <span className="legend-swatch red" />
          Range overlay
        </div>
      </div>
    </div>
  );
}
