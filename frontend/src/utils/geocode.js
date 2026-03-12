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
