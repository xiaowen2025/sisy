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

export const WELLNESS_TEMPLATE: RoutineItem[] = [
    {
        id: "routine_mkwn5oqu_fgms5z8",
        title: "Wake up",
        time: "08:00",
        auto_complete: true
    },
    {
        id: "rt_mkvsz1j5_qcr1ukn",
        title: "Warm-up & Stretching: Neck, torso, arm circles, squats",
        time: "09:00",
        auto_complete: false,
        description: "Neck, torso, arm circles, squats"
    },
    {
        id: "rt_mkvsz1j5_dh9hgmm",
        title: "Skincare (Morning): SkinCeuticals CE, CeraVe",
        time: "09:10",
        auto_complete: true
    },
    {
        id: "rt_mkvsz1j5_0rwuryi",
        title: "Pet Care: Change cat water",
        time: "09:15",
        auto_complete: false
    },
    {
        id: "routine_mkwmw9xa_f3z77ga",
        title: "Brunch",
        time: "11:00",
        auto_complete: false
    },
    {
        id: "rt_mkvsz1j5_cdvtyol",
        title: "Supplements",
        time: "11:00",
        auto_complete: false,
        description: "Vit D, Fish Oil, Iron, CoQ10"
    },
    {
        id: "rt_mkvsz1j5_pq2xnw3",
        title: "Coffee: with Creatine",
        time: "14:00",
        auto_complete: true
    },
    {
        id: "rt_mkvsz1j5_w6u6bbp",
        title: "Cardio: Bicycle 30m",
        time: "14:15",
        auto_complete: false
    },
    {
        id: "rt_mkvsz1j5_dt0148s",
        title: "Strength Training (Every 3 days)",
        time: "19:00",
        auto_complete: false
    },
    {
        id: "rt_mkvsz1j5_hw3e33k",
        title: "Expression & Review: Films/News",
        time: "20:00",
        auto_complete: false
    },
    {
        id: "rt_mkvsz1j5_l2yga59",
        title: "Skincare ",
        time: "22:00",
        auto_complete: true
    },
    {
        id: "rt_mkvsz1j5_lxsorp4",
        title: "Reading",
        time: "23:00",
        auto_complete: false
    }
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
