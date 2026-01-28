export function parseTime(timeStr: string): { hour: number; minute: number } | null {
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return {
        hour: parseInt(match[1], 10),
        minute: parseInt(match[2], 10),
    };
}

export function applyTimeToDate(date: Date, timeStr: string): Date | null {
    const parsed = parseTime(timeStr);
    if (!parsed) return null;
    const newDate = new Date(date);
    newDate.setHours(parsed.hour, parsed.minute, 0, 0);
    return newDate;
}

export function nowIso(): string {
    return new Date().toISOString();
}

/**
 * Make a more readable ID than random string
 */
export function makeId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
