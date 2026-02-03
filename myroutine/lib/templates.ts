import { RoutineItem } from './types';
import { makeId } from './dateUtils';

export const ROUTINE_TEMPLATE: RoutineItem[] = [
    { id: 'rt_wake', title: 'Wake up', time: '07:00', auto_complete: true },
    { id: 'rt_morning', title: 'Morning Ritual', time: '07:30', auto_complete: false },
    { id: 'rt_deep', title: 'Deep Work', time: '09:00', auto_complete: false },
    { id: 'rt_lunch', title: 'Lunch', time: '12:00', auto_complete: true },
    { id: 'rt_focus', title: 'Afternoon Focus', time: '13:00', auto_complete: false },
    { id: 'rt_shutdown', title: 'Shutdown', time: '23:55', auto_complete: true },
];



export function getFreshRoutine(template: RoutineItem[]): RoutineItem[] {
    // Regenerate IDs to avoid conflicts if imported multiple times, 
    // though for template reset it might be fine to keep them stable or fresh.
    // Let's give them fresh IDs to be safe.
    return template.map(item => ({
        ...item,
        id: makeId('rt')
    }));
}
