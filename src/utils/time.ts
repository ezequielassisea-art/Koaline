const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

export function parseAppDate(value: string | number | Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  const legacy = value.match(/^Hoje às (\d{1,2}):(\d{2})$/i);
  if (legacy) {
    const date = new Date();
    date.setHours(Number(legacy[1]), Number(legacy[2]), 0, 0);
    return date;
  }
  const brazilianDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brazilianDate) return new Date(Number(brazilianDate[3]), Number(brazilianDate[2]) - 1, Number(brazilianDate[1]));
  const yesterday = value.match(/^Ontem às (\d{1,2}):(\d{2})$/i);
  if (yesterday) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(Number(yesterday[1]), Number(yesterday[2]), 0, 0);
    return date;
  }
  return new Date(value);
}

export function formatRelativeTime(value: string | number | Date, options: { message?: boolean } = {}) {
  const date = parseAppDate(value);
  if (!Number.isFinite(date.getTime())) return '';
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
  if (diffMinutes < 1) return 'agora';
  if (diffMinutes < 60) return `há ${diffMinutes}min`;

  const startOfDay = (item: Date) => new Date(item.getFullYear(), item.getMonth(), item.getDate()).getTime();
  const daysAgo = Math.floor((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (daysAgo === 0) return options.message ? time : `Hoje, ${time}`;
  if (daysAgo === 1) return `Ontem, ${time}`;
  if (daysAgo < 7 && daysAgo > 1) {
    const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${time}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    const day = new Intl.DateTimeFormat('pt-BR', { day: 'numeric' }).format(date);
    const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
    return `${day} de ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
  }
  return dateFormatter.format(date);
}

export function formatDateHeading(value: string | number | Date) {
  const date = parseAppDate(value);
  const now = new Date();
  const dayStart = (item: Date) => new Date(item.getFullYear(), item.getMonth(), item.getDate()).getTime();
  const daysAgo = Math.floor((dayStart(now) - dayStart(date)) / 86_400_000);
  if (daysAgo === 0) return 'Hoje';
  if (daysAgo === 1) return 'Ontem';
  if (daysAgo > 1 && daysAgo < 7) return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  if (date.getFullYear() === now.getFullYear()) {
    const day = new Intl.DateTimeFormat('pt-BR', { day: 'numeric' }).format(date);
    const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
    return `${day} de ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
  }
  return dateFormatter.format(date);
}

export function isSameLocalDay(first: string | number | Date, second: string | number | Date) {
  const a = parseAppDate(first);
  const b = parseAppDate(second);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
