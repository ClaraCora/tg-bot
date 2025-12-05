export function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb.toFixed(2);
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

export function getCurrencySymbol(code: string): string {
  const symbols: { [key: string]: string } = {
    USD: '$',
    EUR: '€',
    CAD: 'C$',
    CNY: '¥',
  };
  return symbols[code] || code;
}

export function getCurrencyName(code: string): string {
  const names: { [key: string]: string } = {
    USD: '美元',
    EUR: '欧元',
    CAD: '加元',
  };
  return names[code] || code;
}
