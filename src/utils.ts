// utils.ts: Utilidades de fecha, zodíaco, calendario y mapas para RONDA

export function getZodiacSign(birthDateStr: string): { sign: string; symbol: string; emoji: string } {
  if (!birthDateStr) return { sign: '', symbol: '', emoji: '' };
  const date = new Date(birthDateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return { sign: '', symbol: '', emoji: '' };

  const day = date.getDate();
  const month = date.getMonth() + 1; // 1 - 12

  if ((month === 1 && day <= 19) || (month === 12 && day >= 22)) return { sign: 'Capricornio', symbol: '♑', emoji: '♑ Capricornio' };
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return { sign: 'Acuario', symbol: '♒', emoji: '♒ Acuario' };
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return { sign: 'Piscis', symbol: '♓', emoji: '♓ Piscis' };
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return { sign: 'Aries', symbol: '♈', emoji: '♈ Aries' };
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return { sign: 'Tauro', symbol: '♉', emoji: '♉ Tauro' };
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return { sign: 'Géminis', symbol: '♊', emoji: '♊ Géminis' };
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return { sign: 'Cáncer', symbol: '♋', emoji: '♋ Cáncer' };
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return { sign: 'Leo', symbol: '♌', emoji: '♌ Leo' };
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return { sign: 'Virgo', symbol: '♍', emoji: '♍ Virgo' };
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return { sign: 'Libra', symbol: '♎', emoji: '♎ Libra' };
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return { sign: 'Escorpio', symbol: '♏', emoji: '♏ Escorpio' };
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return { sign: 'Sagitario', symbol: '♐', emoji: '♐ Sagitario' };
  
  return { sign: 'Aries', symbol: '♈', emoji: '♈ Aries' };
}

export function calculateAge(birthDateStr: string): number {
  if (!birthDateStr) return 0;
  const today = new Date();
  const birth = new Date(birthDateStr + 'T00:00:00');
  if (isNaN(birth.getTime())) return 0;

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function generateCalendarEventUrl(title: string, description: string, location: string, startDateStr: string, endDateStr: string): string {
  const start = new Date(startDateStr).toISOString().replace(/-|:|\.\d\d\d/g, "");
  const end = new Date(endDateStr).toISOString().replace(/-|:|\.\d\d\d/g, "");
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;
}

export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c] as string));
}

export function downloadICSFile(title: string, description: string, location: string, startDate: Date, endDate: Date) {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RONDA//Citas Presenciales en Bares//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `DTSTART:${formatDate(startDate)}`,
    `DTEND:${formatDate(endDate)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', `ronda-reserva-${Date.now()}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
