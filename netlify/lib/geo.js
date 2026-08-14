// GEO helpers for edge geolocation enrichment and H3 indexing on Netlify.
// Supports Netlify request geo context, Cloudflare headers, and fallback.

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
 * Extrahuje geolokační metadata z Netlify / Cloudflare hlaviček.
 * @param {Request} request
 * @returns {{city:string, postalCode:string|null, latitude:number|null, longitude:number|null, country:string}}
 */
export function extractEdgeGeo(request) {
  const headers = request && request.headers ? request.headers : null;
  
  let netlifyGeo = {};
  if (headers && headers.get('x-nf-geo')) {
    try {
      netlifyGeo = JSON.parse(headers.get('x-nf-geo'));
    } catch {
      // ignore
    }
  }

  const city = decodeMaybe(
    headers?.get('x-client-city') || 
    headers?.get('x-nf-client-city') || 
    netlifyGeo?.city || 
    ''
  );

  const postalCode = normalizePostalCode(
    headers?.get('x-client-postal') || 
    headers?.get('x-nf-postal-code') || 
    netlifyGeo?.postal_code || 
    null
  );

  const latitude = toFloat(
    headers?.get('x-client-latitude') || 
    netlifyGeo?.latitude || 
    null
  );

  const longitude = toFloat(
    headers?.get('x-client-longitude') || 
    netlifyGeo?.longitude || 
    null
  );

  const country = String(
    headers?.get('x-client-country') || 
    netlifyGeo?.country?.code || 
    'CZ'
  ).trim();

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
