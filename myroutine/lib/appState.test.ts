

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    mergeItem: jest.fn(),
    clear: jest.fn(),
    getAllKeys: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
    multiMerge: jest.fn(),
}));

import { applyChatActions, initialState, State } from './appState';
import { ChatAction, RoutineItem, ProfileField } from './types';

describe('applyChatActions', () => {
    it('should ignore removed actions like create_task', () => {
        // legacy action disguised as any to bypass TS check for this test
        const action = { type: 'create_task', title: 'Legacy', scheduled_time: null } as any;
        const newState = applyChatActions(initialState, [action]);
        expect(newState.tasks.length).toBe(0);
        expect(newState.logs.length).toBe(0);
    });

    it('should ignore removed actions like suggest_reschedule', () => {
        const action = { type: 'suggest_reschedule', task_id: '123', scheduled_time: null } as any;
        const newState = applyChatActions(initialState, [action]);
        expect(newState.tasks.length).toBe(0);
    });

    it('should create a new routine item with upsert_routine_item', () => {
        const action: ChatAction = {
            type: 'upsert_routine_item',
            title: 'Morning Yoga',
            time: '07:00'
        };
        const newState = applyChatActions(initialState, [action]);
        expect(newState.routine.length).toBe(1);
        expect(newState.routine[0].title).toBe('Morning Yoga');
        expect(newState.routine[0].time).toBe('07:00');
        expect(newState.logs.length).toBe(1); // Should log creation
    });

    it('should update an existing routine item with upsert_routine_item', () => {
        // Setup initial state with one item
        const existingItem: RoutineItem = {
            id: 'r1',
            title: 'Yoga',
            time: '07:00',
            auto_complete: false
        };
        const stateWithItem: State = { ...initialState, routine: [existingItem] };

        const action: ChatAction = {
            type: 'upsert_routine_item',
            id: 'r1',
            title: 'Intense Yoga', // Changed title
            time: '07:30'          // Changed time
        };

        const newState = applyChatActions(stateWithItem, [action]);
        expect(newState.routine.length).toBe(1);
        expect(newState.routine[0].id).toBe('r1');
        expect(newState.routine[0].title).toBe('Intense Yoga');
        expect(newState.routine[0].time).toBe('07:30');
        expect(newState.logs.length).toBe(1); // Should log update
    });

    it('should upsert profile field', () => {
        const action: ChatAction = {
            type: 'upsert_profile_field',
            key: 'Goal',
            value: 'Get fit',
            source: 'user'
        };
        const newState = applyChatActions(initialState, [action]);
        expect(newState.profile.length).toBe(1);
        expect(newState.profile[0].key).toBe('Goal');
        expect(newState.profile[0].value).toBe('Get fit');
        expect(newState.logs.length).toBe(1);
    });
});
