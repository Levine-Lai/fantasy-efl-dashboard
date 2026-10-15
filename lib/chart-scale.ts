export function chartDomain(values: number[]): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1];
  const low = Math.min(...finite), high = Math.max(...finite);
  const span = high - low;
  const padding = Math.max(span * 0.12, Math.abs(high) * 0.04, Math.abs(low) * 0.04, 0.01);
  const rawStep = (span + padding * 2) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.ceil(rawStep / magnitude) * magnitude;
  const minimum = low >= 0 ? Math.max(0, Math.floor((low - padding) / step) * step) : Math.floor((low - padding) / step) * step;
  return [minimum, Math.ceil((high + padding) / step) * step];
}
export function formatChartTick(value: number, domain: [number, number]) {
  const spacing = (domain[1] - domain[0]) / 4;
  const decimals = spacing < 0.1 ? 3 : spacing < 1 ? 2 : 1;
  return (Math.abs(value) < 1e-10 ? 0 : value).toFixed(decimals);
}
