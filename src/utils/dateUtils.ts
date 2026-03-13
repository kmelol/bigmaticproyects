
export const getWeekRange = (monthIndex: number, weekId: number) => {
  const year = 2026;
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  
  const weeks: {start: Date, end: Date}[] = [];
  let current = new Date(firstDay);
  
  // Skip initial weekend if month starts on one
  if (current.getDay() === 0) current.setDate(current.getDate() + 1); // Sun -> Mon
  else if (current.getDay() === 6) current.setDate(current.getDate() + 2); // Sat -> Mon
  
  while (current <= lastDay && weeks.length < 5) {
    const weekStart = new Date(current);
    
    // Find Friday of this week
    let weekEnd = new Date(current);
    const daysToFriday = 5 - current.getDay();
    if (daysToFriday > 0) {
      weekEnd.setDate(weekEnd.getDate() + daysToFriday);
    }
    
    // Cap at last day of month
    if (weekEnd > lastDay) {
      weekEnd = new Date(lastDay);
    }
    
    // If capped date is Sat/Sun, move back to Friday
    if (weekEnd.getDay() === 0) weekEnd.setDate(weekEnd.getDate() - 2);
    else if (weekEnd.getDay() === 6) weekEnd.setDate(weekEnd.getDate() - 1);
    
    // Ensure we don't add an invalid range (e.g. month ends on Sat/Sun before the next Monday)
    if (weekStart <= weekEnd && weekStart.getMonth() === monthIndex) {
      weeks.push({ start: weekStart, end: weekEnd });
    }
    
    // Move to next Monday
    const nextMonday = new Date(weekEnd);
    nextMonday.setDate(nextMonday.getDate() + (8 - nextMonday.getDay()));
    // Ensure it's actually a Monday (handles edge cases)
    while (nextMonday.getDay() !== 1) {
      nextMonday.setDate(nextMonday.getDate() + 1);
    }
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
  const monthIndex = date.getMonth();
  const year = date.getFullYear();
  
  // We only care about 2026 as per app logic
  if (year !== 2026) return null;

  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  
  const weeks: {start: Date, end: Date}[] = [];
  let current = new Date(firstDay);
  
  if (current.getDay() === 0) current.setDate(current.getDate() + 1);
  else if (current.getDay() === 6) current.setDate(current.getDate() + 2);
  
  while (current <= lastDay && weeks.length < 5) {
    const weekStart = new Date(current);
    let weekEnd = new Date(current);
    const daysToFriday = 5 - current.getDay();
    if (daysToFriday > 0) weekEnd.setDate(weekEnd.getDate() + daysToFriday);
    if (weekEnd > lastDay) weekEnd = new Date(lastDay);
    if (weekEnd.getDay() === 0) weekEnd.setDate(weekEnd.getDate() - 2);
    else if (weekEnd.getDay() === 6) weekEnd.setDate(weekEnd.getDate() - 1);
    
    if (weekStart <= weekEnd && weekStart.getMonth() === monthIndex) {
      weeks.push({ start: new Date(weekStart), end: new Date(weekEnd) });
    }
    
    const nextMonday = new Date(weekEnd);
    nextMonday.setDate(nextMonday.getDate() + (8 - nextMonday.getDay()));
    while (nextMonday.getDay() !== 1) nextMonday.setDate(nextMonday.getDate() + 1);
    current = nextMonday;
  }

  // Find which week the date falls into
  const weekIndex = weeks.findIndex(w => date >= w.start && date <= w.end);
  
  if (weekIndex === -1) {
    // If it's a weekend, it might not fall into any "work week"
    // We can return the closest week or null
    return { month: monthIndex + 1, week: 1 }; // Default to week 1 of that month
  }

  return { month: monthIndex + 1, week: weekIndex + 1 };
};
