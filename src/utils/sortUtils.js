// New records always appear first. Sheet reads come back oldest-first, so every list is sorted the same way
// to stop a freshly submitted row jumping from the top to the bottom when the sync finishes.
export function sortNewestFirst(list, dateKey, idKey) {
  const time = item => { const t = Date.parse(item?.[dateKey]); return Number.isFinite(t) ? t : 0; };
  const number = item => parseInt(String(item?.[idKey] ?? '').replace(/\D/g, ''), 10) || 0;
  return [...list].sort((a, b) => time(b) - time(a) || number(b) - number(a));
}
