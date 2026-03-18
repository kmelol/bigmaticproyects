
export const getWeekRange = (monthIndex: number, weekId: number) => {
  const year = 2026;
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  
  const weeks: {start: Date, end: Date}[] = [];
  let current = new Date(firstDay);
  
  // Skip initial weekend
  if (current.getDay() === 0) current.setDate(current.getDate() + 1);
  else if (current.getDay() === 6) current.setDate(current.getDate() + 2);
  
  while (current <= lastDay && weeks.length < 5) {
    const weekStart = new Date(current);
    let weekEnd = new Date(current);
    const daysToFriday = 5 - current.getDay();
    if (daysToFriday > 0) {
      weekEnd.setDate(weekEnd.getDate() + daysToFriday);
    }
    if (weekEnd > lastDay) weekEnd = new Date(lastDay);
    
    // If capped date is Sat/Sun, move back to Friday
    if (weekEnd.getDay() === 0) weekEnd.setDate(weekEnd.getDate() - 2);
    else if (weekEnd.getDay() === 6) weekEnd.setDate(weekEnd.getDate() - 1);
    
    if (weekStart <= weekEnd) {
      weeks.push({ start: weekStart, end: weekEnd });
    }
    
    // Move to next Monday
    const nextMonday = new Date(weekStart);
    nextMonday.setDate(nextMonday.getDate() + (8 - (nextMonday.getDay() === 0 ? 7 : nextMonday.getDay())));
    current = nextMonday;
  }
  
  const week = weeks[weekId - 1];
  if (!week) return "N/A";
  
  const formatDate = (d: Date) => {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  };
  
  return `${formatDate(week.start)} al ${formatDate(week.end)}`;
};

export const getMonthAndWeekFromDate = (date: Date) => {
  const year = 2026;
  const monthIndex = date.getMonth();
  
  // Generar las mismas semanas que usa getWeekRange
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  
  const weeks: {start: Date, end: Date}[] = [];
  let current = new Date(firstDay);
  
  // Saltar fin de semana inicial
  if (current.getDay() === 0) current.setDate(current.getDate() + 1);
  else if (current.getDay() === 6) current.setDate(current.getDate() + 2);
  
  while (current <= lastDay && weeks.length < 5) {
    const weekStart = new Date(current);
    let weekEnd = new Date(current);
    const daysToFriday = 5 - current.getDay();
    if (daysToFriday > 0) {
      weekEnd.setDate(weekEnd.getDate() + daysToFriday);
    }
    if (weekEnd > lastDay) weekEnd = new Date(lastDay);
    
    // Si la fecha tope es fin de semana, volver al viernes
    if (weekEnd.getDay() === 0) weekEnd.setDate(weekEnd.getDate() - 2);
    else if (weekEnd.getDay() === 6) weekEnd.setDate(weekEnd.getDate() - 1);
    
    if (weekStart <= weekEnd) {
      weeks.push({ start: new Date(weekStart), end: new Date(weekEnd) });
    }
    
    // Mover al siguiente lunes
    const nextMonday = new Date(weekStart);
    nextMonday.setDate(nextMonday.getDate() + (8 - (nextMonday.getDay() === 0 ? 7 : nextMonday.getDay())));
    current = nextMonday;
  }

  // Buscar en qué semana cae la fecha (comparando solo día del mes para evitar desfases de año/hora)
  const targetDay = date.getDate();
  const targetMonth = date.getMonth();
  
  const weekIndex = weeks.findIndex(w => {
    // Si el mes no coincide, no es esta semana
    if (w.start.getMonth() !== targetMonth) return false;
    
    const startDay = w.start.getDate();
    const endDay = w.end.getDate();
    
    return targetDay >= startDay && targetDay <= endDay;
  });
  
  // Si no cae en una semana laboral (es fin de semana), lo movemos a la semana más cercana
  if (weekIndex === -1) {
    // Si es antes de la primera semana, va a la semana 1
    if (targetDay < weeks[0].start.getDate()) return { month: monthIndex + 1, week: 1 };
    
    // Buscar la semana cuyo final sea el más cercano anterior al día
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (targetDay > weeks[i].end.getDate()) return { month: monthIndex + 1, week: i + 1 };
    }
    
    return { month: monthIndex + 1, week: 1 };
  }

  return { month: monthIndex + 1, week: weekIndex + 1 };
};

export const parseDate = (dateVal: any): Date | null => {
  if (dateVal === null || dateVal === undefined) return null;
  
  // If it's already a Date object
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }

  let dateStr = "";
  if (typeof dateVal === 'number') {
    dateStr = dateVal.toString();
  } else if (typeof dateVal === 'string') {
    dateStr = dateVal.trim();
  } else {
    return null;
  }

  if (!dateStr) return null;

  // Intentar extraer solo la parte de la fecha si hay hora (ej: "17/03/2026 12:30" -> "17/03/2026")
  const dateOnlyPart = dateStr.split(/\s+/)[0];
  
  // Limpiar caracteres extraños pero mantener separadores
  const cleanStr = dateOnlyPart.replace(/[^\d\/\\\-\.]/g, '').trim();
  
  // Normalizar separadores a '/'
  const normalizedStr = cleanStr.replace(/[\.\\\-]/g, '/').replace(/\/+/g, '/');

  // 1. Prioridad: Formato Español DD/MM/YYYY o DD/MM/YY
  const dmyMatch = normalizedStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1]);
    const month = parseInt(dmyMatch[2]);
    let year = dmyMatch[3] ? parseInt(dmyMatch[3]) : 2026;
    
    if (year < 100) year += 2000;
    
    // Validar que sea una fecha lógica (Mes 1-12, Día 1-31)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // 2. Formato ISO o Americano YYYY/MM/DD
  const ymdMatch = normalizedStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1]);
    const month = parseInt(ymdMatch[2]);
    const day = parseInt(ymdMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // 3. Nombres de meses en español (ej: "17 de marzo")
  const spanishMonths: Record<string, number> = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
    'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
  };
  
  const lowerStr = dateStr.toLowerCase();
  for (const [monthName, monthNum] of Object.entries(spanishMonths)) {
    if (lowerStr.includes(monthName)) {
      const dayMatch = lowerStr.match(/(\d{1,2})/);
      if (dayMatch) {
        const day = parseInt(dayMatch[1]);
        const date = new Date(2026, monthNum - 1, day);
        if (!isNaN(date.getTime())) return date;
      }
    }
  }

  // 4. Fallback final (solo si los anteriores fallan y parece una fecha válida)
  // Evitamos usar el constructor Date directamente con strings DD/MM porque suele fallar o usar formato US
  try {
    const fallbackDate = new Date(dateStr);
    if (!isNaN(fallbackDate.getTime())) {
      // Si el fallback funciona, comprobamos si el año es razonable
      if (fallbackDate.getFullYear() >= 2025 && fallbackDate.getFullYear() <= 2030) {
        return fallbackDate;
      }
    }
  } catch (e) {
    // ignore
  }
  
  return null;
};

export const findDateAndRelocate = (data: any) => {
  if (!data) return null;
  const keys = Object.keys(data);
  
  // 1. Prioridad absoluta: Fecha SLA o similares
  const slaKey = keys.find(key => {
    const k = key.toLowerCase();
    return k === 'fecha sla' || k === 'sla' || k.includes('sla') || 
           k.includes('vencimiento') || k.includes('límite') || 
           k.includes('limite') || k.includes('vence') || k.includes('entrega');
  });
  
  if (slaKey && data[slaKey]) {
    const date = parseDate(data[slaKey]);
    if (date) {
      const result = getMonthAndWeekFromDate(date);
      console.log(`[DATE_DEBUG] SLA Found in key "${slaKey}": ${data[slaKey]} -> Month ${result.month}, Week ${result.week}`);
      return result;
    } else {
      console.log(`[DATE_DEBUG] SLA key found ("${slaKey}") but parseDate failed for value: ${data[slaKey]}`);
    }
  }

  // 2. Último intento: Cualquier campo que contenga 'fecha' o 'día'
  const anyDateKey = keys.find(key => {
    const k = key.toLowerCase();
    return k.includes('fecha') || k.includes('día') || k.includes('date');
  });
  
  if (anyDateKey && data[anyDateKey]) {
    const date = parseDate(data[anyDateKey]);
    if (date) {
      const result = getMonthAndWeekFromDate(date);
      console.log(`[DATE_DEBUG] Fallback Date Found in key "${anyDateKey}": ${data[anyDateKey]} -> Month ${result.month}, Week ${result.week}`);
      return result;
    }
  }
  
  return null;
};
