export function formatCurrency(value: number): string {
  return `${Number(value || 0).toFixed(2)} USD`;
}

export function formatYen(value: number): string {
  return `${Math.round(Number(value || 0)).toLocaleString()}円`;
}
