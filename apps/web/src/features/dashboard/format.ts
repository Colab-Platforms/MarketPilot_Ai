const number = new Intl.NumberFormat('en-IN');
const percent = new Intl.NumberFormat('en-IN', { style: 'percent', maximumFractionDigits: 1 });
const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export const formatNumber = (value: number) => number.format(value);
export const formatPercent = (value: number) => percent.format(value);

export function formatWhen(date: Date, now = new Date()): string {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayOffset = Math.floor((date.getTime() - startOfToday.getTime()) / 86_400_000);
  if (dayOffset === 0) return `Today, ${time.format(date)}`;
  if (dayOffset === 1) return `Tomorrow, ${time.format(date)}`;
  return `${weekday.format(date)}, ${time.format(date)}`;
}

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
