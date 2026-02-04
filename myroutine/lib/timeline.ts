import { Task } from './types';
import { useMemo } from 'react';

// Core logic: extracted for testability
export function computeTimeline(tasks: Task[], dateOverride?: Date) {
    // 0. Filter to show ONLY Today's tasks (Past days hidden from view, future hidden)
    const now = dateOverride || new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // Helper function copies from appState.tsx
    const sortTodoTasks = (tasks: Task[]): Task[] => {
        return tasks
            .filter((t) => t.status === 'todo')
            .sort((a, b) => {
                if (!a.scheduled_time && !b.scheduled_time) return 0;
                if (!a.scheduled_time) return 1;
                if (!b.scheduled_time) return -1;
                return Date.parse(a.scheduled_time) - Date.parse(b.scheduled_time);
            });
    };

    const filterVisibleTasks = (tasks: Task[]) => {
        // Stub for now, or copy logic if needed. 
        // In appState, it filters out auto_complete items that passed.
        // Logic: if task.auto_complete and time < now, filter out.

        return tasks.filter(t => {
            if (!t.auto_complete) return true;
            if (!t.scheduled_time) return true;
            return Date.parse(t.scheduled_time) > now.getTime();
        });
    };

    const todoSorted = sortTodoTasks(tasks);

    const todayTasks = todoSorted.filter((t) => {
        if (!t.scheduled_time) return true;
        const tTime = new Date(t.scheduled_time).getTime();
        return tTime >= startOfToday.getTime() && tTime <= endOfToday.getTime();
    });

    // 1. Filter out passed auto-complete items
    const visible = filterVisibleTasks(todayTasks);

    // 2. Smart Queue Sort
    const visibilityNow = now.getTime();
    const overdue: Task[] = [];
    const upcoming: Task[] = [];

    visible.forEach(t => {
        if (!t.scheduled_time) {
            upcoming.push(t);
        } else {
            const taskTime = Date.parse(t.scheduled_time);
            if (taskTime < visibilityNow) {
                overdue.push(t);
            } else {
                upcoming.push(t);
            }
        }
    });

    // Overdue: Sort DESC (Newest first) for Priority
    overdue.sort((a, b) => {
        const at = a.scheduled_time ? Date.parse(a.scheduled_time) : 0;
        const bt = b.scheduled_time ? Date.parse(b.scheduled_time) : 0;
        return bt - at;
    });

    // Primary Logic
    let nowTaskVal: Task | null = null;
    let pastTaskVal: Task | null = null;
    let nextTaskVal: Task | null = null;

    if (overdue.length > 0) {
        nowTaskVal = overdue[0];
        const potentialPast = overdue.slice(1).find(t => !t.auto_complete);
        pastTaskVal = potentialPast || null;
        nextTaskVal = upcoming.length > 0 ? upcoming[0] : null;
    } else {
        nowTaskVal = upcoming.length > 0 ? upcoming[0] : null;
        pastTaskVal = null;
        nextTaskVal = upcoming.length > 1 ? upcoming[1] : null;
    }

    // --- Timeline Construction ---
    // 1. History (Completed tasks from today only)
    // Sorted Oldest -> Newest (so last item is closest to 'Now')
    const history = tasks
        .filter(t => {
            if (t.status !== 'done') return false;
            // Only include completed tasks from today
            if (!t.scheduled_time) return true; // Keep unscheduled completed tasks
            const tTime = new Date(t.scheduled_time).getTime();
            return tTime >= startOfToday.getTime() && tTime <= endOfToday.getTime();
        })
        .sort((a, b) => {
            const at = a.scheduled_time ? Date.parse(a.scheduled_time) : 0;
            const bt = b.scheduled_time ? Date.parse(b.scheduled_time) : 0;
            return at - bt;
        });

    // 2. Overdue (for Timeline): Needs to be Sorted Oldest -> Newest
    // We re-sort overdue for visual linear flow.
    const overdueAsc = [...overdue].sort((a, b) => {
        const at = a.scheduled_time ? Date.parse(a.scheduled_time) : 0;
        const bt = b.scheduled_time ? Date.parse(b.scheduled_time) : 0;
        return at - bt;
    });

    // 3. Upcoming (Already sorted Earliest -> Latest by todoSorted)

    // Merge into single linear list
    const rawTimeline = [...history, ...overdueAsc, ...upcoming];

    // Ensure uniqueness based on ID
    const seen = new Set();
    const timelineVal = [];
    for (const t of rawTimeline) {
        if (!seen.has(t.id)) {
            seen.add(t.id);
            timelineVal.push(t);
        }
    }

    return {
        nowTask: nowTaskVal,
        nextTask: nextTaskVal,
        pastTask: pastTaskVal,
        timeline: timelineVal
    };
}
