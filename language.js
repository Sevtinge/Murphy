export function resolveLanguage({ saved = null, primary = '', preferred = [] } = {}) {
  if (saved === 'zh' || saved === 'en') return saved;
  const locale = preferred.find(Boolean) || primary || '';
  return /^zh(?:-|$)/i.test(locale) ? 'zh' : 'en';
}
