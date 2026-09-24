export const TAB_PATHS = Object.freeze({ text: 'text', image: 'picture', music: 'music' });

export function routeType(pathname, basePath) {
  const relative = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length).replace(/\/$/, '') : '';
  if (!relative) return 'text';
  return Object.keys(TAB_PATHS).find((type) => TAB_PATHS[type] === relative) || null;
}

export function encodeSeed(seed) {
  // Encode every non-alphanumeric UTF-8 byte, including URL-safe punctuation
  // such as ! * _ -, so a seed has one unambiguous shareable representation.
  return Array.from(new TextEncoder().encode(seed), (byte) =>
    (byte >= 48 && byte <= 57) || (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122)
      ? String.fromCharCode(byte) : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`,
  ).join('');
}

export function tabUrl(type, baseUrl, seed = null) {
  const url = new URL(TAB_PATHS[type], baseUrl);
  return url.pathname + (seed === null ? '' : `?seed=${encodeSeed(seed)}`);
}
