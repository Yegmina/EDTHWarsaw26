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
  Radio,
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

type ToolKey =
  | "menu"
  | "alerts"
  | "info"
  | "layers"
  | "measure"
  | "cameras"
  | "audio"
  | "weather"
  | "radiation"
  | "fires";

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

type AudioSensor = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  sensitivity: "urban" | "industrial" | "wide-area";
  status: string;
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

const audioSensorIcon = L.divIcon({
  className: "audio-sensor-marker",
  html: "<span></span>",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10]
});

const selectedAudioSensorIcon = L.divIcon({
  className: "audio-sensor-marker audio-sensor-marker-selected",
  html: "<span></span>",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
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
  { key: "audio", label: "Audio sensors", Icon: Radio },
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

const audioSensors: AudioSensor[] = [
  { id: "aud-kaliningrad-01", name: "Acoustic node Kaliningrad West", city: "Kaliningrad", lat: 54.78, lng: 20.39, radiusMeters: 24000, sensitivity: "urban", status: "networked" },
  { id: "aud-spb-01", name: "Acoustic node Saint Petersburg North", city: "Saint Petersburg", lat: 60.08, lng: 30.23, radiusMeters: 28000, sensitivity: "urban", status: "networked" },
  { id: "aud-spb-02", name: "Acoustic node Saint Petersburg South", city: "Saint Petersburg", lat: 59.78, lng: 30.48, radiusMeters: 26000, sensitivity: "industrial", status: "networked" },
  { id: "aud-moscow-01", name: "Acoustic node Moscow Northwest", city: "Moscow", lat: 55.92, lng: 37.34, radiusMeters: 30000, sensitivity: "urban", status: "networked" },
  { id: "aud-moscow-02", name: "Acoustic node Moscow Southeast", city: "Moscow", lat: 55.55, lng: 37.9, radiusMeters: 32000, sensitivity: "industrial", status: "networked" },
  { id: "aud-tver-01", name: "Acoustic node Tver", city: "Tver", lat: 56.9, lng: 35.78, radiusMeters: 23000, sensitivity: "urban", status: "networked" },
  { id: "aud-smolensk-01", name: "Acoustic node Smolensk", city: "Smolensk", lat: 54.83, lng: 32.18, radiusMeters: 24000, sensitivity: "urban", status: "networked" },
  { id: "aud-bryansk-01", name: "Acoustic node Bryansk", city: "Bryansk", lat: 53.34, lng: 34.48, radiusMeters: 25000, sensitivity: "urban", status: "networked" },
  { id: "aud-kursk-01", name: "Acoustic node Kursk", city: "Kursk", lat: 51.8, lng: 36.05, radiusMeters: 26000, sensitivity: "urban", status: "networked" },
  { id: "aud-belgorod-01", name: "Acoustic node Belgorod", city: "Belgorod", lat: 50.67, lng: 36.49, radiusMeters: 26000, sensitivity: "urban", status: "networked" },
  { id: "aud-voronezh-01", name: "Acoustic node Voronezh", city: "Voronezh", lat: 51.76, lng: 39.04, radiusMeters: 30000, sensitivity: "urban", status: "networked" },
  { id: "aud-yaroslavl-01", name: "Acoustic node Yaroslavl", city: "Yaroslavl", lat: 57.7, lng: 39.73, radiusMeters: 25000, sensitivity: "urban", status: "networked" },
  { id: "aud-vologda-01", name: "Acoustic node Vologda", city: "Vologda", lat: 59.27, lng: 39.78, radiusMeters: 24000, sensitivity: "urban", status: "networked" },
  { id: "aud-arkhangelsk-01", name: "Acoustic node Arkhangelsk", city: "Arkhangelsk", lat: 64.62, lng: 40.36, radiusMeters: 28000, sensitivity: "wide-area", status: "networked" },
  { id: "aud-murmansk-01", name: "Acoustic node Murmansk", city: "Murmansk", lat: 68.89, lng: 33.21, radiusMeters: 30000, sensitivity: "wide-area", status: "networked" },
  { id: "aud-syktyvkar-01", name: "Acoustic node Syktyvkar", city: "Syktyvkar", lat: 61.59, lng: 50.74, radiusMeters: 26000, sensitivity: "urban", status: "networked" },
  { id: "aud-nnovgorod-01", name: "Acoustic node Nizhny Novgorod", city: "Nizhny Novgorod", lat: 56.39, lng: 43.83, radiusMeters: 28000, sensitivity: "industrial", status: "networked" },
  { id: "aud-kazan-01", name: "Acoustic node Kazan", city: "Kazan", lat: 55.91, lng: 49.05, radiusMeters: 30000, sensitivity: "urban", status: "networked" },
  { id: "aud-izhevsk-01", name: "Acoustic node Izhevsk", city: "Izhevsk", lat: 56.79, lng: 53.35, radiusMeters: 26000, sensitivity: "industrial", status: "networked" },
  { id: "aud-kirov-01", name: "Acoustic node Kirov", city: "Kirov", lat: 58.69, lng: 49.54, radiusMeters: 25000, sensitivity: "urban", status: "networked" },
  { id: "aud-samara-01", name: "Acoustic node Samara", city: "Samara", lat: 53.31, lng: 50.03, radiusMeters: 31000, sensitivity: "industrial", status: "networked" },
  { id: "aud-saratov-01", name: "Acoustic node Saratov", city: "Saratov", lat: 51.62, lng: 45.87, radiusMeters: 28000, sensitivity: "urban", status: "networked" },
  { id: "aud-volgograd-01", name: "Acoustic node Volgograd", city: "Volgograd", lat: 48.78, lng: 44.32, radiusMeters: 32000, sensitivity: "industrial", status: "networked" },
  { id: "aud-astrakhan-01", name: "Acoustic node Astrakhan", city: "Astrakhan", lat: 46.4, lng: 48.12, radiusMeters: 26000, sensitivity: "urban", status: "networked" },
  { id: "aud-rostov-01", name: "Acoustic node Rostov", city: "Rostov-on-Don", lat: 47.31, lng: 39.57, radiusMeters: 30000, sensitivity: "urban", status: "networked" },
  { id: "aud-krasnodar-01", name: "Acoustic node Krasnodar", city: "Krasnodar", lat: 45.16, lng: 38.86, radiusMeters: 29000, sensitivity: "urban", status: "networked" },
  { id: "aud-sochi-01", name: "Acoustic node Sochi", city: "Sochi", lat: 43.67, lng: 39.63, radiusMeters: 22000, sensitivity: "urban", status: "networked" },
  { id: "aud-stavropol-01", name: "Acoustic node Stavropol", city: "Stavropol", lat: 45.12, lng: 41.88, radiusMeters: 25000, sensitivity: "urban", status: "networked" },
  { id: "aud-makhachkala-01", name: "Acoustic node Makhachkala", city: "Makhachkala", lat: 42.99, lng: 47.47, radiusMeters: 26000, sensitivity: "urban", status: "networked" },
  { id: "aud-grozny-01", name: "Acoustic node Grozny", city: "Grozny", lat: 43.41, lng: 45.82, radiusMeters: 23000, sensitivity: "urban", status: "networked" },
  { id: "aud-orenburg-01", name: "Acoustic node Orenburg", city: "Orenburg", lat: 51.86, lng: 55.02, radiusMeters: 27000, sensitivity: "urban", status: "networked" },
  { id: "aud-ufa-01", name: "Acoustic node Ufa", city: "Ufa", lat: 54.83, lng: 55.84, radiusMeters: 30000, sensitivity: "urban", status: "networked" },
  { id: "aud-perm-01", name: "Acoustic node Perm", city: "Perm", lat: 58.08, lng: 56.09, radiusMeters: 30000, sensitivity: "industrial", status: "networked" },
  { id: "aud-yekaterinburg-01", name: "Acoustic node Yekaterinburg", city: "Yekaterinburg", lat: 56.92, lng: 60.46, radiusMeters: 32000, sensitivity: "industrial", status: "networked" },
  { id: "aud-chelyabinsk-01", name: "Acoustic node Chelyabinsk", city: "Chelyabinsk", lat: 55.23, lng: 61.29, radiusMeters: 31000, sensitivity: "industrial", status: "networked" },
  { id: "aud-tyumen-01", name: "Acoustic node Tyumen", city: "Tyumen", lat: 57.25, lng: 65.42, radiusMeters: 28000, sensitivity: "urban", status: "networked" },
  { id: "aud-surgut-01", name: "Acoustic node Surgut", city: "Surgut", lat: 61.31, lng: 73.28, radiusMeters: 29000, sensitivity: "wide-area", status: "networked" },
  { id: "aud-nizhnevartovsk-01", name: "Acoustic node Nizhnevartovsk", city: "Nizhnevartovsk", lat: 60.99, lng: 76.47, radiusMeters: 28000, sensitivity: "wide-area", status: "networked" },
  { id: "aud-novyurengoy-01", name: "Acoustic node Novy Urengoy", city: "Novy Urengoy", lat: 66.01, lng: 76.55, radiusMeters: 30000, sensitivity: "wide-area", status: "networked" },
  { id: "aud-omsk-01", name: "Acoustic node Omsk", city: "Omsk", lat: 54.95, lng: 73.22, radiusMeters: 31000, sensitivity: "urban", status: "networked" },
  { id: "aud-novosibirsk-01", name: "Acoustic node Novosibirsk", city: "Novosibirsk", lat: 55.12, lng: 82.78, radiusMeters: 33000, sensitivity: "urban", status: "networked" },
  { id: "aud-barnaul-01", name: "Acoustic node Barnaul", city: "Barnaul", lat: 53.45, lng: 83.64, radiusMeters: 27000, sensitivity: "urban", status: "networked" },
  { id: "aud-tomsk-01", name: "Acoustic node Tomsk", city: "Tomsk", lat: 56.56, lng: 84.81, radiusMeters: 27000, sensitivity: "urban", status: "networked" },
  { id: "aud-kemerovo-01", name: "Acoustic node Kemerovo", city: "Kemerovo", lat: 55.43, lng: 86.0, radiusMeters: 27000, sensitivity: "industrial", status: "networked" },
  { id: "aud-novokuznetsk-01", name: "Acoustic node Novokuznetsk", city: "Novokuznetsk", lat: 53.85, lng: 87.05, radiusMeters: 28000, sensitivity: "industrial", status: "networked" },
  { id: "aud-krasnoyarsk-01", name: "Acoustic node Krasnoyarsk", city: "Krasnoyarsk", lat: 56.12, lng: 92.72, radiusMeters: 32000, sensitivity: "industrial", status: "networked" },
  { id: "aud-abakan-01", name: "Acoustic node Abakan", city: "Abakan", lat: 53.77, lng: 91.31, radiusMeters: 25000, sensitivity: "urban", status: "networked" },
  { id: "aud-kyzyl-01", name: "Acoustic node Kyzyl", city: "Kyzyl", lat: 51.8, lng: 94.33, radiusMeters: 24000, sensitivity: "wide-area", status: "networked" },
  { id: "aud-irkutsk-01", name: "Acoustic node Irkutsk", city: "Irkutsk", lat: 52.36, lng: 104.15, radiusMeters: 30000, sensitivity: "urban", status: "networked" },
  { id: "aud-ulanude-01", name: "Acoustic node Ulan-Ude", city: "Ulan-Ude", lat: 51.91, lng: 107.43, radiusMeters: 26000, sensitivity: "urban", status: "networked" },
  { id: "aud-chita-01", name: "Acoustic node Chita", city: "Chita", lat: 52.1, lng: 113.38, radiusMeters: 26000, sensitivity: "urban", status: "networked" },
  { id: "aud-yakutsk-01", name: "Acoustic node Yakutsk", city: "Yakutsk", lat: 62.1, lng: 129.58, radiusMeters: 30000, sensitivity: "wide-area", status: "networked" },
  { id: "aud-blagoveshchensk-01", name: "Acoustic node Blagoveshchensk", city: "Blagoveshchensk", lat: 50.34, lng: 127.39, radiusMeters: 27000, sensitivity: "urban", status: "networked" },
  { id: "aud-khabarovsk-01", name: "Acoustic node Khabarovsk", city: "Khabarovsk", lat: 48.55, lng: 135.0, radiusMeters: 30000, sensitivity: "urban", status: "networked" },
  { id: "aud-komsomolsk-01", name: "Acoustic node Komsomolsk", city: "Komsomolsk-on-Amur", lat: 50.62, lng: 136.93, radiusMeters: 27000, sensitivity: "industrial", status: "networked" },
  { id: "aud-vladivostok-01", name: "Acoustic node Vladivostok", city: "Vladivostok", lat: 43.2, lng: 131.77, radiusMeters: 28000, sensitivity: "urban", status: "networked" },
  { id: "aud-yuzhno-01", name: "Acoustic node Yuzhno-Sakhalinsk", city: "Yuzhno-Sakhalinsk", lat: 46.99, lng: 142.61, radiusMeters: 26000, sensitivity: "urban", status: "networked" },
  { id: "aud-magadan-01", name: "Acoustic node Magadan", city: "Magadan", lat: 59.63, lng: 150.65, radiusMeters: 27000, sensitivity: "wide-area", status: "networked" },
  { id: "aud-petropavlovsk-01", name: "Acoustic node Petropavlovsk", city: "Petropavlovsk-Kamchatsky", lat: 53.07, lng: 158.45, radiusMeters: 28000, sensitivity: "wide-area", status: "networked" },
  { id: "aud-norilsk-01", name: "Acoustic node Norilsk", city: "Norilsk", lat: 69.43, lng: 88.06, radiusMeters: 32000, sensitivity: "wide-area", status: "networked" }
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

function AudioLayerController({
  sensors,
  activeTool,
  isFullscreen
}: {
  sensors: AudioSensor[];
  activeTool: ToolKey;
  isFullscreen: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (activeTool !== "audio" || !sensors.length) {
      return;
    }

    const bounds = L.latLngBounds(sensors.map((sensor) => [sensor.lat, sensor.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.16), {
      animate: true,
      maxZoom: 4,
      paddingBottomRight: [40, 80],
      paddingTopLeft: [350, 70]
    });
  }, [activeTool, sensors, map]);

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
  const [showAudioSensors, setShowAudioSensors] = useState(true);
  const [showAudioCoverage, setShowAudioCoverage] = useState(true);
  const [selectedAudioSensorId, setSelectedAudioSensorId] = useState<string | null>(null);

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
  const selectedAudioSensor = selectedAudioSensorId
    ? audioSensors.find((sensor) => sensor.id === selectedAudioSensorId) ?? null
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
        <AudioLayerController sensors={audioSensors} activeTool={activeTool} isFullscreen={isFullscreen} />
        <MapClickTarget onMapClick={handleMapClick} />
        <TileLayer
          attribution='Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {showAudioSensors && showAudioCoverage
          ? audioSensors.map((sensor) => (
              <Circle
                center={[sensor.lat, sensor.lng]}
                key={`audio-coverage-${sensor.id}`}
                radius={sensor.radiusMeters}
                pathOptions={{
                  color: selectedAudioSensorId === sensor.id ? "#f2b84b" : "#c77dff",
                  weight: selectedAudioSensorId === sensor.id ? 2 : 1,
                  fillColor: selectedAudioSensorId === sensor.id ? "#f2b84b" : "#c77dff",
                  fillOpacity: selectedAudioSensorId === sensor.id ? 0.18 : 0.08
                }}
              />
            ))
          : null}
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
        {showAudioSensors
          ? audioSensors.map((sensor) => (
              <Marker
                eventHandlers={{
                  click() {
                    setSelectedAudioSensorId(sensor.id);
                    setActiveTool("audio");
                  }
                }}
                icon={selectedAudioSensorId === sensor.id ? selectedAudioSensorIcon : audioSensorIcon}
                key={`audio-sensor-${sensor.id}`}
                position={[sensor.lat, sensor.lng]}
                zIndexOffset={selectedAudioSensorId === sensor.id ? 1100 : 820}
              >
                <Popup>
                  <strong>{sensor.name}</strong>
                  <br />
                  {sensor.city} / {sensor.sensitivity}
                  <br />
                  Radius: {Math.round(sensor.radiusMeters / 1000)} km
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
              <label>
                <input
                  type="checkbox"
                  checked={showAudioSensors}
                  onChange={() => setShowAudioSensors((value) => !value)}
                />
                Audio sensors
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showAudioCoverage}
                  onChange={() => setShowAudioCoverage((value) => !value)}
                />
                Audio coverage
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
            Cameras: {publicCameras.length}. Audio sensors: {audioSensors.length}.
          </p>
        ) : null}
        {activeTool === "audio" ? (
          <div className="audio-layer-panel">
            <h3>Acoustic sensor network</h3>
            <div className="audio-status-row">
              <span>{audioSensors.length} sensors distributed</span>
              <em>{showAudioCoverage ? "Coverage on" : "Coverage off"}</em>
            </div>
            <div className="audio-toggle-grid">
              <label>
                <input
                  type="checkbox"
                  checked={showAudioSensors}
                  onChange={() => setShowAudioSensors((value) => !value)}
                />
                Audio sensors
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showAudioCoverage}
                  onChange={() => setShowAudioCoverage((value) => !value)}
                />
                Coverage rings
              </label>
            </div>
            {selectedAudioSensor ? (
              <div className="selected-audio-card">
                <span>{selectedAudioSensor.city}</span>
                <strong>{selectedAudioSensor.name}</strong>
                <p>
                  {selectedAudioSensor.sensitivity} acoustic node / {selectedAudioSensor.status}
                </p>
                <em>Radius {Math.round(selectedAudioSensor.radiusMeters / 1000)} km</em>
              </div>
            ) : (
              <p>Click an acoustic node to inspect city, sensitivity, and coverage radius.</p>
            )}
          </div>
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
          {activeTool === "audio"
            ? "Acoustic sensor layer"
            : activeTool === "cameras"
              ? "Public camera layer"
              : visibleLayers[0]?.label ?? "Air-defense reference layer"}
        </strong>
      </div>
      <div className="map-overlay bottom-right">
        <span>{activeTool === "audio" ? "AUDIO LAYER" : activeTool === "cameras" ? "CAMERA LAYER" : "RANGE TOOL"}</span>
        <strong>
          {activeTool === "audio"
            ? "Click sensor to inspect"
            : activeTool === "cameras"
              ? "Click camera to preview"
              : "Click map to set anchor"}
        </strong>
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
        <div>
          <span className="legend-swatch purple" />
          Audio coverage
        </div>
      </div>
    </div>
  );
}
