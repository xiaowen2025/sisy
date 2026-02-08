import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

import { sendChatMessage } from '@/lib/api';
import { getJson, setJson, clear } from '@/lib/storage';

import { applyTimeToDate, makeId, nowIso } from '@/lib/dateUtils';
import { getFreshRoutine, ROUTINE_TEMPLATE } from '@/lib/templates';
import type {
  ChatAction,
  ChatMessage,
  ChatSendResponse,
  ProfileField,
  RoutineItem,
  TabId,
  Task,
  Log,
} from '@/lib/types';

const STATE_KEY = 'sisy.app_state.v0';

export type State = {
  hydrated: boolean;
  conversation_id: string | null;
  chat: ChatMessage[];
  tasks: Task[];
  routine: RoutineItem[];
  profile: ProfileField[];
  logs: Log[];
  highlightedIds: string[];
  isTyping: boolean;
  pendingChatDraft: string | null;
};

type Action =
  | { type: 'hydrate'; state: Omit<State, 'hydrated'> }
  | { type: 'setConversationId'; conversation_id: string }
  | { type: 'pushChat'; message: ChatMessage }
  | { type: 'applyChatActions'; actions: ChatAction[] }
  | { type: 'addTask'; task: Task }
  | { type: 'addTasks'; tasks: Task[] }
  | { type: 'updateTask'; taskId: string; patch: Partial<Omit<Task, 'id'>> }
  | { type: 'setRoutine'; items: RoutineItem[] }
  | { type: 'updateRoutineItem'; id: string; patch: Partial<Omit<RoutineItem, 'id'>> }
  | { type: 'loadRoutineTemplate'; template: RoutineItem[]; tasks: Task[] }
  | { type: 'upsertProfileField'; field: ProfileField }
  | { type: 'deleteProfileField'; key: string }
  | { type: 'deleteProfileGroup'; group: string }
  | { type: 'setProfile'; profile: ProfileField[] }
  | { type: 'skipTask'; taskId: string }
  | { type: 'addLog'; log: Log }
  | { type: 'acknowledgeHighlight'; ids: string[] }
  | { type: 'setTyping'; isTyping: boolean }
  | { type: 'revertRoutineDescription'; id: string }
  | { type: 'revertProfileValue'; key: string }
  | { type: 'revertRoutineDescription'; id: string }
  | { type: 'revertProfileValue'; key: string }
  | { type: 'setPendingChatDraft'; text: string | null }
  | { type: 'clearChat' };

function sortRoutineItems(items: RoutineItem[]): RoutineItem[] {
  return [...items].sort((a, b) => {
    const ta = a.time || '99:99';
    const tb = b.time || '99:99';
    return ta.localeCompare(tb);
  });
}

// Helper to safely access properties with "type" or "action" discrimination
export function applyChatActions(state: State, actions: ChatAction[]): State {
  let next = state;
  const newLogs: Log[] = [];
  const newHighlights: string[] = [];

  for (const rawAction of actions) {
    const action = rawAction as any;
    const type = action.type || action.action;



    if (type === 'upsert_profile_field') {
      const field: ProfileField = {
        key: action.key,
        value: action.value,
        group: action.group,
        source: action.source ?? 'learned',
        updated_at: nowIso(),
      };
      const existingIdx = next.profile.findIndex((f) => f.key === action.key);
      const updated =
        existingIdx >= 0
          ? next.profile.map((f) => (f.key === action.key ? field : f))
          : [field, ...next.profile];
      next = { ...next, profile: updated };

      newLogs.push({
        id: makeId('log'),
        timestamp: nowIso(),
        related_action: 'state_update',
        content: `Sisy updated profile: ${action.key}`,
        author: 'assistant'
      });
      newHighlights.push(action.key);
    }

    if (type === 'upsert_routine_item') {
      const existingIdx = action.id ? next.routine.findIndex((r) => r.id === action.id) : -1;
      let newItem: RoutineItem;

      if (existingIdx >= 0 && action.id) {
        // Update
        const old = next.routine[existingIdx];
        newItem = {
          ...old,
          title: action.title ?? old.title,
          time: action.time ?? old.time,
          description: action.description ?? old.description,
          repeat_interval: action.repeat_interval ?? old.repeat_interval,
          auto_complete: action.auto_complete ?? old.auto_complete,
        };
        const nextRoutine = next.routine.map(r => r.id === action.id ? newItem : r);
        next = { ...next, routine: sortRoutineItems(nextRoutine) };

        newLogs.push({
          id: makeId('log'),
          timestamp: nowIso(),
          related_action: 'state_update',
          content: `Sisy updated routine: ${newItem.title}`,
          author: 'assistant',
          routine_item_id: newItem.id
        });
        newHighlights.push(newItem.id);

      } else {
        // Create
        const id = action.id || makeId('routine');
        newItem = {
          id,
          title: action.title || 'Untitled Routine',
          time: action.time ?? null,
          auto_complete: action.auto_complete ?? false,
          description: action.description,
          repeat_interval: action.repeat_interval ?? 1
        };
        next = { ...next, routine: sortRoutineItems([newItem, ...next.routine]) };

        newLogs.push({
          id: makeId('log'),
          timestamp: nowIso(),
          related_action: 'state_update',
          content: `Sisy created routine: ${newItem.title}`,
          author: 'assistant',
          routine_item_id: newItem.id
        });
        newHighlights.push(newItem.id);
      }
    }
  }

  // Apply logs and highlights
  if (newLogs.length > 0 || newHighlights.length > 0) {
    next = {
      ...next,
      logs: [...newLogs, ...next.logs],
      highlightedIds: [...newHighlights, ...(next.highlightedIds || [])] // New highlights on top
    };
  }

  return next;
}

function convertRoutineItemToTask(item: RoutineItem): Task {
  const now = new Date();
  let scheduled_time: string | null = null;

  if (item.time) {
    const withTime = applyTimeToDate(now, item.time);
    if (withTime) {
      scheduled_time = withTime.toISOString();
    }
  }

  return {
    id: makeId('task'),
    title: item.title,
    scheduled_time,
    status: 'todo',
    source: 'routine',
    auto_complete: item.auto_complete,
    repeat_interval: item.repeat_interval,
    routine_item_id: item.id,
    description: item.description,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return { hydrated: true, ...action.state, chat: (action.state.chat || []).slice(-100), isTyping: false };
    case 'setConversationId':
      return { ...state, conversation_id: action.conversation_id };
    case 'pushChat':
      const newChat = [...state.chat, action.message];
      return { ...state, chat: newChat.slice(-100) };
    case 'applyChatActions':
      return applyChatActions(state, action.actions);
    case 'addTask':
      return { ...state, tasks: [action.task, ...state.tasks] };
    case 'addTasks':
      return { ...state, tasks: [...action.tasks, ...state.tasks] };
    case 'updateTask':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.taskId ? { ...t, ...action.patch } : t)),
      };
    case 'setRoutine':
      return { ...state, routine: sortRoutineItems(action.items) };
    case 'updateRoutineItem': {
      // 1. Update routine item, saving previous description if it's changing
      const nextRoutine = state.routine.map((item) => {
        if (item.id !== action.id) return item;

        // Save previous description before update (only if description is actually changing)
        let previousDescription = item.previousDescription;
        if (action.patch.description !== undefined && action.patch.description !== item.description) {
          previousDescription = item.description;
        }

        return { ...item, ...action.patch, previousDescription };
      });

      // 2. Sync changes to today's tasks which are linked to this routine item
      //    Only update if they are 'todo'. If 'done', keep history.
      let nextTasks = state.tasks;
      const targetItem = nextRoutine.find((r) => r.id === action.id);

      if (targetItem) {
        nextTasks = state.tasks.map((t) => {
          // check linkage
          if (t.routine_item_id !== action.id) return t;
          if (t.status !== 'todo') return t; // don't mutate completed tasks

          let changes: Partial<Task> = {};

          // Sync Title
          if (action.patch.title !== undefined) {
            changes.title = action.patch.title;
          }

          // Sync Time
          if (action.patch.time !== undefined) {
            if (action.patch.time) {
              const withTime = applyTimeToDate(new Date(), action.patch.time);
              if (withTime) changes.scheduled_time = withTime.toISOString();
              else changes.scheduled_time = null;
            } else {
              changes.scheduled_time = null;
            }
          }

          // Sync Auto Complete
          if (action.patch.auto_complete !== undefined) {
            changes.auto_complete = action.patch.auto_complete;
          }

          // Sync Description
          if (action.patch.description !== undefined) {
            changes.description = action.patch.description;
          }

          if (Object.keys(changes).length > 0) {
            return { ...t, ...changes };
          }
          return t;
        });
      }

      return { ...state, routine: sortRoutineItems(nextRoutine), tasks: nextTasks };
    }
    case 'loadRoutineTemplate':
      return { ...state, routine: sortRoutineItems(action.template), tasks: action.tasks };
    case 'skipTask': {
      const task = state.tasks.find((t) => t.id === action.taskId);
      if (!task || !task.scheduled_time) {
        // Fallback: just ignore or +24h if no scheduled time?
        return state;
      }
      const existingTime = new Date(task.scheduled_time);
      const interval = task.repeat_interval || 1;
      existingTime.setDate(existingTime.getDate() + interval);

      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, scheduled_time: existingTime.toISOString() } : t
        ),
      };
    }
    case 'upsertProfileField': {
      const idx = state.profile.findIndex((f) => f.key === action.field.key);
      let nextProfile: ProfileField[];

      if (idx >= 0) {
        // Update existing field, save previous value if it's changing
        nextProfile = state.profile.map((f) => {
          if (f.key !== action.field.key) return f;

          // Save previous value before update (only if value is actually changing)
          let previousValue = f.previousValue;
          if (action.field.value !== f.value) {
            previousValue = f.value;
          }

          return { ...action.field, previousValue };
        });
      } else {
        // New field, no previous value
        nextProfile = [action.field, ...state.profile];
      }

      return { ...state, profile: nextProfile };
    }
    case 'deleteProfileField':
      return { ...state, profile: state.profile.filter((f) => f.key !== action.key) };
    case 'deleteProfileGroup':
      return {
        ...state,
        profile: state.profile.filter((f) => (f.group || 'Other') !== action.group),
      };
    case 'setProfile':
      return { ...state, profile: action.profile };
    case 'addLog':
      return { ...state, logs: [action.log, ...state.logs] };
    case 'acknowledgeHighlight':
      return {
        ...state,
        highlightedIds: state.highlightedIds.filter(id => !action.ids.includes(id))
      };
    case 'setTyping':
      return { ...state, isTyping: action.isTyping };
    case 'revertRoutineDescription': {
      const nextRoutine = state.routine.map((item) => {
        if (item.id !== action.id || !item.previousDescription) return item;
        // Swap: current becomes previous, previous becomes current
        return {
          ...item,
          description: item.previousDescription,
          previousDescription: item.description,
        };
      });
      return { ...state, routine: sortRoutineItems(nextRoutine) };
    }
    case 'revertProfileValue': {
      const nextProfile = state.profile.map((f) => {
        if (f.key !== action.key || !f.previousValue) return f;
        // Swap: current becomes previous, previous becomes current
        return {
          ...f,
          value: f.previousValue,
          previousValue: f.value,
          updated_at: nowIso(),
        };
      });
      return { ...state, profile: nextProfile };
    }
    case 'setPendingChatDraft':
      return { ...state, pendingChatDraft: action.text };
    case 'clearChat':
      return { ...state, chat: [], conversation_id: null };
    default:
      return state;
  }
}

export const initialState: State = {
  hydrated: false,
  conversation_id: null,
  chat: [],
  tasks: [],
  routine: [],
  profile: [],
  logs: [],
  highlightedIds: [],
  isTyping: false,
  pendingChatDraft: null,
};

type AppStateApi = {
  hydrated: boolean;
  conversation_id: string | null;
  chat: ChatMessage[];
  tasks: Task[];
  routine: RoutineItem[];
  profile: ProfileField[];
  logs: Log[];
  highlightedIds: string[];
  isTyping: boolean;
  nowTask: Task | null;
  nextTask: Task | null;
  pastTask: Task | null;
  timeline: Task[];
  sendChat: (tab: TabId, text: string, imageUri?: string) => Promise<void>;
  completeTask: (taskId: string, comment?: string) => void;
  uncompleteTask: (taskId: string) => void;
  rescheduleTask: (taskId: string, scheduled_time: string | null, comment?: string) => void;
  addRoutineItem: () => void;
  updateRoutineItem: (id: string, patch: Partial<Omit<RoutineItem, 'id'>>) => void;
  deleteRoutineItem: (id: string) => void;
  loadRoutineTemplate: () => void;

  upsertProfileField: (key: string, value: string, group?: string, source?: ProfileField['source']) => void;
  deleteProfileField: (key: string) => void;
  deleteProfileGroup: (group: string) => void;
  createQuickTask: (title: string) => void;
  skipTask: (taskId: string, comment?: string) => void;
  importRoutine: (json: string) => void;
  importProfile: (json: string) => void;
  setProfile: (profile: ProfileField[]) => void;
  addLog: (content: string, related_action: Log['related_action'], routine_item_id?: string) => void;
  acknowledgeHighlight: (ids: string[]) => void;
  revertRoutineDescription: (id: string) => void;
  revertProfileValue: (key: string) => void;
  requestChatDraft: (text: string | null) => void;
  pendingChatDraft: string | null;
  clearChat: () => void;
  clearAllData: () => Promise<void>;
};


import { computeTimeline, sortTodoTasks, filterVisibleTasks } from './timeline';

const Ctx = createContext<AppStateApi | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await getJson<Omit<State, 'hydrated'>>(STATE_KEY);
      if (cancelled) return;
      if (saved) {
        // Ensure default profile exists if empty
        if (!saved.profile || saved.profile.length === 0) {
          saved.profile = [
            { key: 'Age', value: '', group: 'Basics', source: 'user', updated_at: nowIso() },
            { key: 'Gender', value: '', group: 'Basics', source: 'user', updated_at: nowIso() },
          ];
        }
        // Ensure logs exists (backwards compatibility)
        if (!saved.logs) {
          saved.logs = [];
        }
        // Ensure highlightedIds exists
        if (!saved.highlightedIds) {
          saved.highlightedIds = [];
        }
        dispatch({ type: 'hydrate', state: saved });
      } else {
        dispatch({
          type: 'hydrate',
          state: {
            conversation_id: null,
            chat: [],
            tasks: [],
            routine: [],
            profile: [
              { key: 'Age', value: '', group: 'Basics', source: 'user', updated_at: nowIso() },
              { key: 'Gender', value: '', group: 'Basics', source: 'user', updated_at: nowIso() },
            ],
            logs: [],
            highlightedIds: [],
            isTyping: false,
            pendingChatDraft: null,
          },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const persist: Omit<State, 'hydrated'> = {
      conversation_id: state.conversation_id,
      chat: state.chat,
      tasks: state.tasks,
      routine: state.routine,
      profile: state.profile,
      logs: state.logs,
      highlightedIds: state.highlightedIds,
      isTyping: state.isTyping,
      pendingChatDraft: null, // ephemeral, do not persist value
    };
    void setJson(STATE_KEY, persist);
  }, [state.hydrated, state.conversation_id, state.chat, state.tasks, state.routine, state.profile, state.logs, state.highlightedIds]);

  // Re-calculate "now" periodically or relies on interaction?
  // For MVP, simplistic: calculated on render/memo. 
  // Ideally we have a 'tick' effect. 
  const [tick, setTick] = React.useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // --- Daily Task Generation Logic ---
  useEffect(() => {
    if (!state.hydrated) return;

    // Check coverage for today
    const now = new Date();
    const todayStr = now.toDateString();

    // Identify ID's of routine items covered today (by tasks with scheduled_time)
    const coveredRoutineHeaderIds = new Set();
    state.tasks.forEach(t => {
      // Only care about tasks that have a routine_item_id and a time
      if (t.routine_item_id && t.scheduled_time) {
        if (new Date(t.scheduled_time).toDateString() === todayStr) {
          coveredRoutineHeaderIds.add(t.routine_item_id);
        }
      }
    });

    const newTasks: Task[] = [];

    state.routine.forEach(item => {
      // 1. Check if covered today
      if (coveredRoutineHeaderIds.has(item.id)) return;

      // 2. Check recurrence compatibility
      const relatedTasks = state.tasks.filter(t => t.routine_item_id === item.id);

      // Sort newest first
      relatedTasks.sort((a, b) => {
        const at = a.scheduled_time ? new Date(a.scheduled_time).valueOf() : 0;
        const bt = b.scheduled_time ? new Date(b.scheduled_time).valueOf() : 0;
        return bt - at;
      });

      const lastTask = relatedTasks[0];
      let shouldGenerate = false;

      if (!lastTask) {
        // Never generated before -> generate now
        shouldGenerate = true;
      } else {
        const lastDate = lastTask.scheduled_time ? new Date(lastTask.scheduled_time) : new Date(0);

        // Reset times to midnight for accurate day diff logic
        const d1 = new Date(lastDate); d1.setHours(0, 0, 0, 0);
        const d2 = new Date(now); d2.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(d2.valueOf() - d1.valueOf());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const interval = item.repeat_interval || 1;
        if (diffDays >= interval) {
          shouldGenerate = true;
        }
      }

      if (shouldGenerate) {
        newTasks.push(convertRoutineItemToTask(item));
      }
    });

    if (newTasks.length > 0) {
      dispatch({ type: 'addTasks', tasks: newTasks });
    }
  }, [state.hydrated, tick]);

  const { nowTask, nextTask, pastTask, timeline } = useMemo(() => {
    return computeTimeline(state.tasks); // Using extracted logic

  }, [tick, state.tasks]);


  async function sendChat(tab: TabId, text: string, imageUri?: string) {
    const userMsg: ChatMessage = { id: makeId('msg'), role: 'user', tab, text, imageUri, created_at: nowIso() };

    // --- Special Commands ---
    if (text.trim() === '/reset') {
      try {
        await clearAllData();
      } catch (e) {
        alert('Failed to reset: ' + e);
      }
      return;
    }
    // ------------------------


    dispatch({ type: 'pushChat', message: userMsg });
    dispatch({ type: 'setTyping', isTyping: true });

    const context = {
      profile: state.profile,
      routine: state.routine
    };

    const reply = await sendChatMessage({
      conversation_id: state.conversation_id,
      tab,
      text,
      imageUri,
      user_context: JSON.stringify(context),
      message_history: state.chat.slice(-10)
    });

    dispatch({ type: 'setTyping', isTyping: false });
    dispatch({ type: 'setConversationId', conversation_id: reply.conversation_id });

    const assistantMsg: ChatMessage = {
      id: makeId('msg'),
      role: 'assistant',
      tab,
      text: reply.assistant_text,
      created_at: nowIso(),
    };
    dispatch({ type: 'pushChat', message: assistantMsg });

    if (reply.actions.length > 0) {
      dispatch({ type: 'applyChatActions', actions: reply.actions });
    }
  }

  function addLog(content: string, related_action: Log['related_action'], routine_item_id?: string) {
    // Only log if we have content OR it's a routine item action
    if (!content && !routine_item_id) return;

    // Build default content with routine item title if no comment provided
    let logContent = content;
    if (!content) {
      const routineItem = routine_item_id ? state.routine.find(r => r.id === routine_item_id) : null;
      const actionLabel = related_action.replace('task_', '').replace('_', ' ');

      if (routineItem) {
        logContent = `${routineItem.title} - ${actionLabel}`;
      } else {
        logContent = actionLabel;
      }
    }

    dispatch({
      type: 'addLog',
      log: {
        id: makeId('log'),
        timestamp: nowIso(),
        related_action,
        content: logContent,
        author: 'user',
        routine_item_id,
      },
    });
  }

  function completeTask(taskId: string, comment?: string) {
    // 1. Mark current as done
    dispatch({ type: 'updateTask', taskId, patch: { status: 'done' } });

    // 2. Log action
    const task = state.tasks.find((t) => t.id === taskId);
    if (task) {
      addLog(comment || '', 'task_complete', task.routine_item_id);
    }

  }

  function uncompleteTask(taskId: string) {
    // Mark task as todo again
    dispatch({ type: 'updateTask', taskId, patch: { status: 'todo' } });
  }

  function rescheduleTask(taskId: string, scheduled_time: string | null, comment?: string) {
    dispatch({ type: 'updateTask', taskId, patch: { scheduled_time } });

    const task = state.tasks.find((t) => t.id === taskId);
    if (task) {
      addLog(comment || '', 'task_reschedule', task.routine_item_id);
    }
  }

  function addRoutineItem() {
    const item: RoutineItem = {
      id: makeId('routine'),
      title: 'New item',
      time: null,
      auto_complete: false,
    };
    dispatch({ type: 'setRoutine', items: [item, ...state.routine] });
  }

  function updateRoutineItem(id: string, patch: Partial<Omit<RoutineItem, 'id'>>) {
    dispatch({
      type: 'updateRoutineItem',
      id,
      patch,
    });
  }

  function deleteRoutineItem(id: string) {
    dispatch({ type: 'setRoutine', items: state.routine.filter((it) => it.id !== id) });
  }

  function loadRoutineTemplate() {
    const template = getFreshRoutine(ROUTINE_TEMPLATE);
    const newTasks = template.map(convertRoutineItemToTask);
    const nonRoutineTasks = state.tasks.filter((t) => t.source !== 'routine');
    dispatch({ type: 'loadRoutineTemplate', template, tasks: [...nonRoutineTasks, ...newTasks] });
  }



  function upsertProfileField(key: string, value: string, group?: string, source?: ProfileField['source']) {
    dispatch({
      type: 'upsertProfileField',
      field: { key, value, group, source: source ?? 'user', updated_at: nowIso() },
    });
  }

  function deleteProfileField(key: string) {
    dispatch({ type: 'deleteProfileField', key });
  }

  function createQuickTask(title: string) {
    dispatch({
      type: 'addTask',
      task: { id: makeId('task'), title, scheduled_time: null, status: 'todo', source: 'chat' },
    });
  }

  function skipTask(taskId: string, comment?: string) {
    dispatch({ type: 'skipTask', taskId });
    const task = state.tasks.find((t) => t.id === taskId);
    if (task) {
      addLog(comment || '', 'task_skip', task.routine_item_id);
    }
  }

  function requestChatDraft(text: string | null) {
    dispatch({ type: 'setPendingChatDraft', text });
  }

  async function clearAllData() {
    await clear();
    dispatch({
      type: 'hydrate',
      state: { ...initialState, chat: [] }
    });
    alert('App data cleared. State reset.');
  }

  const api: AppStateApi = {

    hydrated: state.hydrated,
    conversation_id: state.conversation_id,
    chat: state.chat,
    tasks: state.tasks,
    routine: state.routine,
    profile: state.profile,
    logs: state.logs,
    highlightedIds: state.highlightedIds,
    isTyping: state.isTyping,
    nowTask,
    nextTask,
    pastTask,
    timeline,
    sendChat,
    completeTask,
    uncompleteTask,
    rescheduleTask,
    addRoutineItem,
    updateRoutineItem,
    deleteRoutineItem,
    loadRoutineTemplate,

    clearAllData,

    upsertProfileField,
    deleteProfileField,
    deleteProfileGroup: (group) => dispatch({ type: 'deleteProfileGroup', group }),
    createQuickTask,
    skipTask,
    importRoutine: (json) => {
      try {
        const items = JSON.parse(json);
        if (!Array.isArray(items)) throw new Error('Root must be array');
        // Basic schema check
        const valid = items.every((it: any) => typeof it.title === 'string');
        if (!valid) throw new Error('Invalid items');
        // Ensure IDs exist
        const sane = items.map((it: any) => ({
          ...it,
          id: it.id || makeId('routine'),
          auto_complete: !!it.auto_complete
        }));

        // Regenerate tasks for the current day based on the new routine
        const newTasks = sane.map(convertRoutineItemToTask);
        const nonRoutineTasks = state.tasks.filter((t) => t.source !== 'routine');

        // Use loadRoutineTemplate action which updates both routine and tasks
        dispatch({ type: 'loadRoutineTemplate', template: sane, tasks: [...nonRoutineTasks, ...newTasks] });
        alert('Routine imported successfully.');
      } catch (e) {
        alert('Failed to import: ' + e);
      }
    },
    importProfile: (json) => {
      try {
        const items = JSON.parse(json);
        if (!Array.isArray(items)) throw new Error('Root must be array');
        // Basic schema check
        const valid = items.every((it: any) => typeof it.key === 'string' && typeof it.value === 'string');
        if (!valid) throw new Error('Invalid profile items');

        dispatch({ type: 'setProfile', profile: items });
        alert('Profile imported successfully.');
      } catch (e) {
        alert('Failed to import profile: ' + e);
      }
    },
    setProfile: (profile) => dispatch({ type: 'setProfile', profile }),
    addLog,
    acknowledgeHighlight: (ids) => dispatch({ type: 'acknowledgeHighlight', ids }),
    revertRoutineDescription: (id) => dispatch({ type: 'revertRoutineDescription', id }),
    revertProfileValue: (key) => dispatch({ type: 'revertProfileValue', key }),
    requestChatDraft,
    pendingChatDraft: state.pendingChatDraft,
    clearChat: () => dispatch({ type: 'clearChat' }),
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAppState(): AppStateApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
