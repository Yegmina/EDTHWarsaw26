import { NextResponse } from "next/server";

type InetcomMarker = {
  id?: string;
  name?: string;
  r_name?: string;
  streat?: string;
  description?: string;
  lat?: string;
  lng?: string;
  movable?: string;
  camera_url?: string;
  r_label_lat?: string;
  r_label_lng?: string;
};

type InetcomRegionResponse = {
  markers?: InetcomMarker[];
};

const PROVIDER_BASE_URL = "https://cameras.inetcom.ru";
const EARTH_RADIUS_METERS = 6371000;

function numberOrNull(value: unknown) {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function hashNumber(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function bearingBetween(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const phi1 = (fromLat * Math.PI) / 180;
  const phi2 = (toLat * Math.PI) / 180;
  const deltaLambda = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function destinationPoint(lat: number, lng: number, bearingDeg: number, distanceMeters: number): [number, number] {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [(lat2 * 180) / Math.PI, (((lng2 * 180) / Math.PI + 540) % 360) - 180];
}

function cameraSector(marker: InetcomMarker, lat: number, lng: number) {
  const seed = hashNumber(`${marker.id ?? "camera"}:${lat}:${lng}`);
  const regionLat = numberOrNull(marker.r_label_lat);
  const regionLng = numberOrNull(marker.r_label_lng);
  const fallbackBearing = seed % 360;
  const baseBearing =
    regionLat !== null && regionLng !== null ? bearingBetween(lat, lng, regionLat, regionLng) : fallbackBearing;
  const jitter = ((seed >> 8) % 41) - 20;
  const movable = marker.movable === "1";
  const widthDeg = movable ? 110 + ((seed >> 16) % 31) : 65 + ((seed >> 16) % 26);
  const radiusMeters = movable ? 1400 + ((seed >> 20) % 700) : 850 + ((seed >> 20) % 550);
  const bearingDeg = (baseBearing + jitter + 360) % 360;
  const left = destinationPoint(lat, lng, bearingDeg - widthDeg / 2, radiusMeters);
  const center = destinationPoint(lat, lng, bearingDeg, radiusMeters * 1.15);
  const right = destinationPoint(lat, lng, bearingDeg + widthDeg / 2, radiusMeters);

  return {
    bearingDeg,
    widthDeg,
    radiusMeters,
    polygon: [[lat, lng], left, center, right] as Array<[number, number]>
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cameraId = searchParams.get("cameraId") || "7";

  try {
    const response = await fetch(`${PROVIDER_BASE_URL}/ajax/region`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: new URLSearchParams({ region_id: "false", camera_id: cameraId }),
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Camera provider unavailable." }, { status: 502 });
    }

    const payload = (await response.json()) as InetcomRegionResponse;
    const cameras = (payload.markers ?? [])
      .map((marker) => {
        const lat = numberOrNull(marker.lat);
        const lng = numberOrNull(marker.lng);

        if (!marker.id || lat === null || lng === null) {
          return null;
        }

        const street = marker.streat?.trim() || "Public camera";
        const description = marker.description?.trim() || "Street view";
        const name = marker.name?.trim() || `${street}, ${description}`;
        const hlsUrl = marker.camera_url ? `${PROVIDER_BASE_URL}/hls/camera${marker.camera_url}.m3u8` : "";

        return {
          id: marker.id,
          name,
          regionName: marker.r_name?.trim() || "Public camera region",
          street,
          description,
          lat,
          lng,
          movable: marker.movable === "1",
          publicUrl: `${PROVIDER_BASE_URL}/#!/${marker.id}`,
          embedUrl: `${PROVIDER_BASE_URL}/embed/${marker.id}`,
          hlsUrl,
          sector: cameraSector(marker, lat, lng)
        };
      })
      .filter(Boolean);

    return NextResponse.json({ cameras });
  } catch {
    return NextResponse.json({ error: "Camera provider request failed." }, { status: 502 });
  }
}
