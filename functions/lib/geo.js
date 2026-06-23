// GEO helpers for edge geolocation enrichment and H3 indexing.
// Keeps Cloudflare request.cf usage server-side and produces normalized lead metadata.

if (typeof globalThis.__dirname === 'undefined') {
  globalThis.__dirname = '.';
}

import { latLngToCell } from 'h3-js';

const DEFAULT_H3_RESOLUTION = 8;

function toFloat(value) {
  if (value == null || value === '') return null;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function decodeMaybe(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return String(value);
  }
}

export function normalizePostalCode(value) {
  if (value == null) return null;
  const digits = String(value).replace(/\D+/g, '').slice(0, 5);
  return digits || null;
}

/**
 * Extracts safe geo metadata from Cloudflare edge context + propagated headers.
 * @param {Request} request
 * @returns {{city:string, postalCode:string|null, latitude:number|null, longitude:number|null, country:string}}
 */
export function extractEdgeGeo(request) {
  const cf = request && request.cf ? request.cf : {};
  const headers = request && request.headers ? request.headers : null;

  const cityHeader = headers ? headers.get('X-Client-City') : null;
  const postalHeader = headers ? headers.get('X-Client-Postal') : null;
  const latHeader = headers ? headers.get('X-Client-Latitude') : null;
  const lngHeader = headers ? headers.get('X-Client-Longitude') : null;
  const countryHeader = headers ? headers.get('X-Client-Country') : null;

  const city = decodeMaybe(cityHeader || cf.city || '');
  const postalCode = normalizePostalCode(postalHeader || cf.postalCode || null);
  const latitude = toFloat(latHeader || cf.latitude || null);
  const longitude = toFloat(lngHeader || cf.longitude || null);
  const country = String(countryHeader || cf.country || '').trim();

  return { city, postalCode, latitude, longitude, country };
}

export function toH3Cell(latitude, longitude, resolution = DEFAULT_H3_RESOLUTION) {
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  try {
    return latLngToCell(latitude, longitude, resolution);
  } catch {
    return null;
  }
}

/**
 * Creates normalized payload for geo_leads write path.
 * @param {Request} request
 * @param {string|null} explicitPostalCode
 * @param {number|undefined} h3Resolution
 */
export function buildGeoLeadMeta(request, explicitPostalCode, h3Resolution) {
  const edge = extractEdgeGeo(request);
  const postalCode = normalizePostalCode(explicitPostalCode || edge.postalCode);
  const resolution = Number.isInteger(h3Resolution) ? h3Resolution : DEFAULT_H3_RESOLUTION;
  const h3HexagonId = toH3Cell(edge.latitude, edge.longitude, resolution);

  return {
    psc: postalCode,
    city: edge.city || null,
    latitude: edge.latitude,
    longitude: edge.longitude,
    countryCode: edge.country || null,
    h3HexagonId,
  };
}
