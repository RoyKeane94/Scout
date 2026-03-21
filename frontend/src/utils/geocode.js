/** Extract town/locality from Nominatim address (for saving on sighting). */
export function getTownFromAddress(data) {
  const addr = data?.address;
  if (!addr) return null;
  const town = addr.suburb || addr.village || addr.town || addr.city || addr.municipality || addr.locality || addr.hamlet;
  return town && typeof town === 'string' ? town.trim() : null;
}

/** Format Nominatim reverse geocode result: shop name + town + postcode, or just town + postcode. */
export function formatShortAddress(data) {
  const addr = data?.address;
  if (!addr) return data?.display_name || null;

  const locality = addr.suburb || addr.village || addr.town || addr.city || addr.municipality || addr.locality || addr.hamlet;
  const postcode = addr.postcode;
  const localityPostcode = locality && postcode ? `${locality}, ${postcode}` : locality || postcode;

  const name = data.name;
  if (name && typeof name === 'string' && name.trim() && localityPostcode) {
    return `${name.trim()}, ${localityPostcode}`;
  }
  if (name && typeof name === 'string' && name.trim()) return name.trim();
  return localityPostcode || data?.display_name || null;
}

/** Fetch short address string for lat/lng via Nominatim. */
export function fetchShortAddress(lat, lng) {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    { headers: { 'User-Agent': 'Scout/1.0 (field-logging-app)' } }
  )
    .then((res) => res.json())
    .then((data) => formatShortAddress(data) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
}

/** True if string looks like a UK postcode (compact or with space). */
function looksLikeUkPostcode(s) {
  if (!s || typeof s !== 'string') return false;
  const c = s.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{1,2}\d[A-Z0-9]?\d[A-Z]{2}$/.test(c);
}

/** True if US ZIP or ZIP+4 */
function looksLikeUsZip(s) {
  if (!s || typeof s !== 'string') return false;
  return /^\d{5}(-\d{4})?$/.test(s.trim());
}

/**
 * Parse a stored gap/sighting location label from formatShortAddress:
 * "POI, Town, Postcode" | "POI, Town" | "Town, Postcode" | single segment.
 * @returns {{ town: string | null, postcode: string | null }}
 */
export function parseStoredLocationString(raw) {
  if (!raw || typeof raw !== 'string') return { town: null, postcode: null };
  const parts = raw.split(/,\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { town: null, postcode: null };

  const last = parts[parts.length - 1];
  const lastIsPost = looksLikeUkPostcode(last) || looksLikeUsZip(last);

  if (parts.length >= 3 && lastIsPost) {
    return {
      town: parts[parts.length - 2] || null,
      postcode: last,
    };
  }
  if (parts.length === 2 && lastIsPost) {
    return { town: parts[0] || null, postcode: last };
  }
  if (parts.length === 2) {
    // "POI, Town" with no postcode
    return { town: parts[1] || null, postcode: null };
  }
  return { town: parts[0] || null, postcode: null };
}

/** Table/list: show locality only (no parentheses). */
export function formatGapListLocationSuffix(townField) {
  const { town } = parseStoredLocationString(townField);
  return town || (typeof townField === 'string' && townField.trim() ? townField.trim() : '');
}

/** Slide-out: "Town, Postcode" when both known; else best effort. */
export function formatGapPanelLocationLine(townField) {
  const { town, postcode } = parseStoredLocationString(townField);
  if (town && postcode) return `${town}, ${postcode}`;
  if (postcode && !town) return postcode;
  if (town) return town;
  if (typeof townField === 'string' && townField.trim()) return townField.trim();
  return '—';
}
