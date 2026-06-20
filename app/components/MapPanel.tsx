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
  Target,
  Video
} from "lucide-react";
import {
  Circle,
  CircleMarker,
  Marker,
  MapContainer,
  Polygon,
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

type ToolKey = "menu" | "alerts" | "info" | "layers" | "measure" | "cameras" | "weather" | "radiation" | "fires";

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

type PublicCamera = {
  id: string;
  name: string;
  regionName: string;
  street: string;
  description: string;
  lat: number;
  lng: number;
  movable: boolean;
  publicUrl: string;
  embedUrl: string;
  hlsUrl: string;
  sector: {
    bearingDeg: number;
    widthDeg: number;
    radiusMeters: number;
    polygon: Array<[number, number]>;
  };
};

const diamondIcon = L.divIcon({
  className: "deep-diamond-marker",
  html: "<span></span>",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -8]
});

const cameraIcon = L.divIcon({
  className: "public-camera-marker",
  html: "<span></span>",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -10]
});

const selectedCameraIcon = L.divIcon({
  className: "public-camera-marker public-camera-marker-selected",
  html: "<span></span>",
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -12]
});

const defaultLayers: MapLayer[] = [];

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
  { key: "cameras", label: "Cameras", Icon: Video },
  { key: "weather", label: "Weather", Icon: Cloud },
  { key: "radiation", label: "Radiation", Icon: Radiation },
  { key: "fires", label: "Fires", Icon: Flame }
];

const weaponTemplates: WeaponTemplate[] = [
  {
    id: "s-300pm2",
    name: "S-300PM2 Favorit",
    category: "Anti-aircraft",
    status: "in operation",
    readMore: "https://en.wikipedia.org/wiki/S-300_missile_system",
    projectiles: [
      { id: "5v55r", name: "5V55R", minKm: 0, maxKm: 90, status: "in operation" },
      { id: "48n6", name: "48N6", minKm: 0, maxKm: 200, status: "in operation" }
    ]
  },
  {
    id: "s-400",
    name: "S-400 Triumf",
    category: "Anti-aircraft",
    status: "in operation",
    readMore: "https://en.wikipedia.org/wiki/S-400_missile_system",
    projectiles: [
      { id: "48n6dm", name: "48N6DM", minKm: 0, maxKm: 250, status: "in operation" },
      { id: "40n6", name: "40N6", minKm: 0, maxKm: 400, status: "in operation" }
    ]
  },
  {
    id: "s-500",
    name: "S-500 Prometey",
    category: "Anti-aircraft",
    status: "in operation",
    readMore: "https://en.wikipedia.org/wiki/S-500_missile_system",
    projectiles: [
      { id: "77n6-n", name: "77N6-N", minKm: 0, maxKm: 500, status: "in operation" },
      { id: "77n6-n1", name: "77N6-N1", minKm: 0, maxKm: 600, status: "in operation" }
    ]
  },
  {
    id: "s-350",
    name: "S-350 Vityaz",
    category: "Anti-aircraft",
    status: "in operation",
    readMore: "https://en.wikipedia.org/wiki/S-350E_Vityaz",
    projectiles: [
      { id: "9m96", name: "9M96", minKm: 0, maxKm: 60, status: "in operation" },
      { id: "9m96d", name: "9M96D", minKm: 0, maxKm: 120, status: "in operation" }
    ]
  },
  {
    id: "buk-m3",
    name: "Buk-M3",
    category: "Anti-aircraft",
    status: "in operation",
    readMore: "https://en.wikipedia.org/wiki/Buk_missile_system",
    projectiles: [
      { id: "9m317m", name: "9M317M", minKm: 0, maxKm: 70, status: "in operation" },
      { id: "9r31m", name: "9R31M", minKm: 0, maxKm: 45, status: "in operation" }
    ]
  },
  {
    id: "pantsir-s1",
    name: "Pantsir-S1",
    category: "Anti-aircraft",
    status: "in operation",
    readMore: "https://en.wikipedia.org/wiki/Pantsir_missile_system",
    projectiles: [
      { id: "57e6", name: "57E6", minKm: 0, maxKm: 20, status: "in operation" },
      { id: "57e6m", name: "57E6M", minKm: 0, maxKm: 30, status: "in operation" }
    ]
  }
];

const tacticalLocationTemplates: TacticalLocationTemplate[] = [
  {
    id: "air-defense-reference",
    name: "Air-defense system reference",
    type: "Air Defense",
    status: "reference template",
    sourceName: "Reference source",
    sourceUrl: "https://deepstatemap.live/en"
  },
  {
    id: "unit-reference",
    name: "Ground formation reference",
    type: "Unit",
    status: "reference template",
    sourceName: "Reference source",
    sourceUrl: "https://deepstatemap.live/en"
  },
  {
    id: "airfield-reference",
    name: "Airfield reference",
    type: "Airfield",
    status: "reference template",
    sourceName: "Reference source",
    sourceUrl: "https://deepstatemap.live/en"
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
    name: "Air-defense sector reference",
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
  },
  {
    id: "ref-ad-03",
    name: "Layered air-defense reference",
    type: "Air Defense",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 51.67,
    lng: 39.21
  },
  {
    id: "ref-ad-04",
    name: "Point-defense reference",
    type: "Air Defense",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 58.01,
    lng: 56.25
  },
  {
    id: "ref-ad-05",
    name: "Strategic air-defense reference",
    type: "Air Defense",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 52.03,
    lng: 113.5
  },
  {
    id: "ref-missile-03",
    name: "Missile unit reference",
    type: "Missile",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 57.15,
    lng: 65.53
  },
  {
    id: "ref-missile-04",
    name: "Missile operations reference",
    type: "Missile",
    status: "preloaded reference",
    sourceName: "Public reference layer",
    sourceUrl: "https://deepstatemap.live/en",
    lat: 64.54,
    lng: 40.54
  },
  {
    id: "ref-s300-01",
    name: "S-300PM2 Favorit reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/S-300_missile_system",
    lat: 56.87,
    lng: 35.91
  },
  {
    id: "ref-s400-01",
    name: "S-400 Triumf reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/S-400_missile_system",
    lat: 61.25,
    lng: 73.42
  },
  {
    id: "ref-pantsir-01",
    name: "Pantsir-S1 reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/Pantsir_missile_system",
    lat: 45.04,
    lng: 39.01
  },
  {
    id: "ref-buk-01",
    name: "Buk-M3 reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/Buk_missile_system",
    lat: 54.99,
    lng: 82.9
  },
  {
    id: "ref-tor-01",
    name: "Tor-M2 reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/Tor_missile_system",
    lat: 48.48,
    lng: 135.08
  },
  {
    id: "ref-radar-01",
    name: "Radar coverage reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/Air_defense",
    lat: 67.61,
    lng: 33.67
  },
  {
    id: "ref-s400-02",
    name: "S-400 Triumf long-range reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/S-400_missile_system",
    lat: 53.21,
    lng: 50.14
  },
  {
    id: "ref-s400-03",
    name: "S-400 Triumf long-range reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/S-400_missile_system",
    lat: 62.14,
    lng: 129.75
  },
  {
    id: "ref-s500-01",
    name: "S-500 Prometey long-range reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/S-500_missile_system",
    lat: 55.68,
    lng: 84.95
  },
  {
    id: "ref-s500-02",
    name: "S-500 Prometey long-range reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/S-500_missile_system",
    lat: 59.41,
    lng: 39.92
  },
  {
    id: "ref-s350-01",
    name: "S-350 Vityaz reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/S-350E_Vityaz",
    lat: 56.11,
    lng: 101.63
  },
  {
    id: "ref-s350-02",
    name: "S-350 Vityaz reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/S-350E_Vityaz",
    lat: 50.28,
    lng: 127.53
  },
  {
    id: "ref-s300-02",
    name: "S-300PM2 Favorit long-range reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/S-300_missile_system",
    lat: 65.03,
    lng: 57.42
  },
  {
    id: "ref-s300-03",
    name: "S-300PM2 Favorit long-range reference",
    type: "Air Defense",
    status: "reference system",
    sourceName: "System reference",
    sourceUrl: "https://en.wikipedia.org/wiki/S-300_missile_system",
    lat: 46.91,
    lng: 142.74
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

function CameraLayerController({
  cameras,
  activeTool,
  isFullscreen
}: {
  cameras: PublicCamera[];
  activeTool: ToolKey;
  isFullscreen: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (activeTool !== "cameras" || !cameras.length) {
      return;
    }

    const bounds = L.latLngBounds(cameras.map((camera) => [camera.lat, camera.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.32), {
      animate: true,
      maxZoom: 12,
      paddingBottomRight: [40, 120],
      paddingTopLeft: [360, 70]
    });
  }, [activeTool, cameras, map]);

  useEffect(() => {
    const timeout = window.setTimeout(() => map.invalidateSize(), 250);
    return () => window.clearTimeout(timeout);
  }, [map, isFullscreen]);

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
  const [activeTool, setActiveTool] = useState<ToolKey>("cameras");
  const [showMarkers, setShowMarkers] = useState(true);
  const [showAreas, setShowAreas] = useState(true);
  const [showRanges, setShowRanges] = useState(true);
  const [selectedWeaponId, setSelectedWeaponId] = useState("s-300pm2");
  const [selectedProjectileId, setSelectedProjectileId] = useState("5v55r");
  const [weaponPlacementArmed, setWeaponPlacementArmed] = useState(false);
  const [weaponRings, setWeaponRings] = useState<RangeRing[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("air-defense-reference");
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
  const [publicCameras, setPublicCameras] = useState<PublicCamera[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [showPublicCameras, setShowPublicCameras] = useState(true);
  const [showCameraSectors, setShowCameraSectors] = useState(true);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState("");

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
  const selectedCamera = selectedCameraId
    ? publicCameras.find((camera) => camera.id === selectedCameraId) ?? null
    : null;

  useEffect(() => {
    const controller = new AbortController();

    async function loadCameras() {
      setCameraLoading(true);
      setCameraError("");

      try {
        const response = await fetch("/api/cameras?cameraId=7", { signal: controller.signal });
        const body = (await response.json()) as { cameras?: PublicCamera[]; error?: string };

        if (!response.ok) {
          throw new Error(body.error || "Camera layer failed to load.");
        }

        setPublicCameras(Array.isArray(body.cameras) ? body.cameras : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setCameraError(error instanceof Error ? error.message : "Camera layer failed to load.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setCameraLoading(false);
        }
      }
    }

    loadCameras();

    return () => controller.abort();
  }, []);

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
        <CameraLayerController cameras={publicCameras} activeTool={activeTool} isFullscreen={isFullscreen} />
        <MapClickTarget onMapClick={handleMapClick} />
        <TileLayer
          attribution='Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {showPublicCameras && showCameraSectors
          ? publicCameras.map((camera) => (
              <Polygon
                key={`camera-sector-${camera.id}`}
                positions={camera.sector.polygon}
                pathOptions={{
                  color: selectedCameraId === camera.id ? "#75f0c8" : "#49b8ff",
                  weight: selectedCameraId === camera.id ? 3 : 2,
                  fillColor: selectedCameraId === camera.id ? "#75f0c8" : "#49b8ff",
                  fillOpacity: selectedCameraId === camera.id ? 0.28 : 0.18
                }}
              />
            ))
          : null}
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
        {showPublicCameras
          ? publicCameras.map((camera) => (
              <Marker
                eventHandlers={{
                  click() {
                    setSelectedCameraId(camera.id);
                    setActiveTool("cameras");
                  }
                }}
                icon={selectedCameraId === camera.id ? selectedCameraIcon : cameraIcon}
                key={`public-camera-${camera.id}`}
                position={[camera.lat, camera.lng]}
                zIndexOffset={selectedCameraId === camera.id ? 1200 : 1000}
              >
                <Popup>
                  <strong>{camera.regionName}</strong>
                  <br />
                  {camera.street}
                  <br />
                  {camera.description}
                  <br />
                  Sector: {Math.round(camera.sector.bearingDeg)} deg / {Math.round(camera.sector.radiusMeters)} m
                </Popup>
              </Marker>
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
              <label>
                <input
                  type="checkbox"
                  checked={showPublicCameras}
                  onChange={() => setShowPublicCameras((value) => !value)}
                />
                Public cameras
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showCameraSectors}
                  onChange={() => setShowCameraSectors((value) => !value)}
                />
                Camera sectors
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
            {visibleLayers[0]
              ? `Active layer: ${visibleLayers[0].label}. Confidence: ${visibleLayers[0].confidence}. `
              : "Reference systems visible. "}
            Rings: {allRangeRings.length}. Locations: {visibleTacticalLocations.length}/{allTacticalLocations.length}.
            Cameras: {publicCameras.length}.
          </p>
        ) : null}
        {activeTool === "cameras" ? (
          <div className="camera-layer-panel">
            <h3>Stage 1 public cameras</h3>
            <div className="camera-status-row">
              <span>{cameraLoading ? "Loading camera layer" : `${publicCameras.length} cameras loaded`}</span>
              <em>{showCameraSectors ? "Sectors on" : "Sectors off"}</em>
            </div>
            {cameraError ? <p className="camera-error">{cameraError}</p> : null}
            <div className="camera-toggle-grid">
              <label>
                <input
                  type="checkbox"
                  checked={showPublicCameras}
                  onChange={() => setShowPublicCameras((value) => !value)}
                />
                Public cameras
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showCameraSectors}
                  onChange={() => setShowCameraSectors((value) => !value)}
                />
                Estimated sectors
              </label>
            </div>
            {selectedCamera ? (
              <div className="selected-camera-card">
                <span>{selectedCamera.regionName}</span>
                <strong>{selectedCamera.street}</strong>
                <p>{selectedCamera.description}</p>
                <em>
                  {Math.round(selectedCamera.sector.bearingDeg)} deg /{" "}
                  {Math.round(selectedCamera.sector.widthDeg)} deg /{" "}
                  {Math.round(selectedCamera.sector.radiusMeters)} m
                </em>
                <a href={selectedCamera.publicUrl} target="_blank" rel="noreferrer">
                  Open source
                </a>
              </div>
            ) : (
              <p>Click a camera marker to open an embedded public stream preview.</p>
            )}
          </div>
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
      {selectedCamera && showPublicCameras ? (
        <div className="camera-preview-panel">
          <div className="camera-preview-header">
            <div>
              <span>STAGE 1 CAMERA</span>
              <strong>{selectedCamera.regionName}</strong>
            </div>
            <button type="button" aria-label="Close camera preview" onClick={() => setSelectedCameraId(null)}>
              Back
            </button>
          </div>
          <iframe
            src={selectedCamera.embedUrl}
            title={`Public camera ${selectedCamera.id}`}
            allow="autoplay; fullscreen"
          />
          <div className="camera-preview-meta">
            <span>{selectedCamera.street}</span>
            <em>{selectedCamera.description}</em>
            <a href={selectedCamera.publicUrl} target="_blank" rel="noreferrer">
              Open source stream
            </a>
          </div>
        </div>
      ) : null}
      <div className="deep-search-card">
        <strong>AEROROZUM</strong>
        <span>
          <Search size={15} />
          Search layer / coordinate
        </span>
      </div>
      <div className="map-overlay top-left">
        <span>LIVE SATELLITE BASEMAP</span>
        <strong>
          {activeTool === "cameras" ? "Public camera layer" : visibleLayers[0]?.label ?? "Air-defense reference layer"}
        </strong>
      </div>
      <div className="map-overlay bottom-right">
        <span>{activeTool === "cameras" ? "CAMERA LAYER" : "RANGE TOOL"}</span>
        <strong>{activeTool === "cameras" ? "Click camera to preview" : "Click map to set anchor"}</strong>
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
        <div>
          <span className="legend-swatch cyan" />
          Camera sector
        </div>
      </div>
    </div>
  );
}
