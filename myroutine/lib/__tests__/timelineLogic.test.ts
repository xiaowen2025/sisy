import { computeTimeline } from '../timeline';
import { Task } from '../types';

describe('computeTimeline', () => {
    const makeTask = (overrides: Partial<Task>): Task => ({
        id: 'test-id-' + Math.random(),
        title: 'Test Task',
        status: 'todo',
        scheduled_time: new Date().toISOString(),
        source: 'routine',
        auto_complete: false,
        ...overrides,
    });

    const now = new Date('2026-02-04T12:00:00Z');
    const todayStart = new Date('2026-02-04T00:00:00Z');
    const todayEnd = new Date('2026-02-04T23:59:59Z');

    // Helper to format ISO
    const iso = (d: Date) => d.toISOString();

    it('includes completed tasks from today', () => {
        const todayCompleted = makeTask({
            status: 'done',
            scheduled_time: iso(new Date('2026-02-04T10:00:00Z')),
        });

        const result = computeTimeline([todayCompleted], now);

        // Should be in timeline
        expect(result.timeline.find(t => t.id === todayCompleted.id)).toBeDefined();
    });

    it('excludes completed tasks from yesterday', () => {
        const yesterdayCompleted = makeTask({
            status: 'done',
            scheduled_time: iso(new Date('2026-02-03T12:00:00Z')),
        });

        const result = computeTimeline([yesterdayCompleted], now);

        // Should NOT be in timeline
        expect(result.timeline.find(t => t.id === yesterdayCompleted.id)).toBeUndefined();
    });

    it('includes todo tasks from today', () => {
        const todayTodo = makeTask({
            status: 'todo',
            scheduled_time: iso(new Date('2026-02-04T14:00:00Z')),
        });

        const result = computeTimeline([todayTodo], now);

        // Should be in timeline
        expect(result.timeline.find(t => t.id === todayTodo.id)).toBeDefined();
        // And should be the "nowTask" (focused) as it is the first upcoming
        expect(result.nowTask?.id).toBe(todayTodo.id);
    });

    it('handles "all caught up" implicitly (empty timeline if all done from previous days)', () => {
        const yesterdayCompleted = makeTask({
            status: 'done',
            scheduled_time: iso(new Date('2026-02-03T10:00:00Z')),
        });

        const result = computeTimeline([yesterdayCompleted], now);

        expect(result.timeline.length).toBe(0);
        // index.tsx handles the "All caught up" message based on this emptiness
    });

    it('shows both completed (today) and todo (today) in timeline', () => {
        const doneToday = makeTask({
            id: 'done-1',
            status: 'done',
            scheduled_time: iso(new Date('2026-02-04T09:00:00Z')),
        });
        const todoToday = makeTask({
            id: 'todo-1',
            status: 'todo',
            scheduled_time: iso(new Date('2026-02-04T13:00:00Z')),
        });

        const result = computeTimeline([doneToday, todoToday], now);

        expect(result.timeline).toHaveLength(2);
        expect(result.timeline.map(t => t.id)).toContain('done-1');
        expect(result.timeline.map(t => t.id)).toContain('todo-1');
    });
});
