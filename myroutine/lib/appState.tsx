import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

import { sendChatMessage } from '@/lib/api';
import { getJson, setJson } from '@/lib/storage';
import { applyTimeToDate, makeId, nowIso } from '@/lib/dateUtils';
import { getFreshRoutine, ROUTINE_TEMPLATE, WELLNESS_TEMPLATE } from '@/lib/templates';
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

type State = {
  hydrated: boolean;
  conversation_id: string | null;
  chat: ChatMessage[];
  tasks: Task[];
  routine: RoutineItem[];
  profile: ProfileField[];
  logs: Log[];
  highlightedIds: string[];
};

type Action =
  | { type: 'hydrate'; state: Omit<State, 'hydrated'> }
  | { type: 'setConversationId'; conversation_id: string }
  | { type: 'pushChat'; message: ChatMessage }
  | { type: 'applyChatActions'; actions: ChatAction[] }
  | { type: 'addTask'; task: Task }
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
  | { type: 'acknowledgeHighlight'; ids: string[] };

function sortTodoTasks(tasks: Task[]): Task[] {
  const todo = tasks.filter((t) => t.status === 'todo');
  return todo.sort((a, b) => {
    const at = a.scheduled_time ? Date.parse(a.scheduled_time) : Number.POSITIVE_INFINITY;
    const bt = b.scheduled_time ? Date.parse(b.scheduled_time) : Number.POSITIVE_INFINITY;
    return at - bt;
  });
}

/**
 * Filter out auto-complete tasks that have already passed.
 */
function filterVisibleTasks(tasks: Task[]): Task[] {
  const now = Date.now();
  // Buffer: 5 minutes grace period? Or strict? Let's be strict for "passed".
  return tasks.filter((t) => {
    if (!t.auto_complete) return true;
    if (!t.scheduled_time) return true; // No time, show it
    const tTime = Date.parse(t.scheduled_time);
    // If time has passed -> hide it (implicitly done)
    return tTime > now;
  });
}

function sortRoutineItems(items: RoutineItem[]): RoutineItem[] {
  return [...items].sort((a, b) => {
    const ta = a.time || '99:99';
    const tb = b.time || '99:99';
    return ta.localeCompare(tb);
  });
}

// Helper to safely access properties with "type" or "action" discrimination
function applyChatActions(state: State, actions: ChatAction[]): State {
  let next = state;
  const newLogs: Log[] = [];
  const newHighlights: string[] = [];

  for (const rawAction of actions) {
    const action = rawAction as any;
    const type = action.type || action.action;

    if (type === 'create_task') {
      const task: Task = {
        id: makeId('task'),
        title: action.title,
        scheduled_time: action.scheduled_time,
        status: 'todo',
        source: 'chat',
      };
      next = { ...next, tasks: [task, ...next.tasks] };
      continue;
    }
    if (type === 'suggest_reschedule') {
      next = {
        ...next,
        tasks: next.tasks.map((t) =>
          t.id === action.task_id ? { ...t, scheduled_time: action.scheduled_time } : t
        ),
      };

      // Log rescheduling
      const task = next.tasks.find(t => t.id === action.task_id);
      if (task) {
        newLogs.push({
          id: makeId('log'),
          timestamp: nowIso(),
          related_action: 'task_reschedule',
          content: `Sisy rescheduled task "${task.title}"`,
          author: 'assistant',
          routine_item_id: task.routine_item_id
        });
      }
      continue;
    }
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

    if (type === 'create_routine_item' || type === 'update_routine_item') {
      const existingIdx = action.id ? next.routine.findIndex((r) => r.id === action.id) : -1;
      let newItem: RoutineItem;

      if (existingIdx >= 0 && action.id) {
        // Update
        const old = next.routine[existingIdx];
        newItem = {
          ...old,
          title: action.title ?? old.title,
          time: action.scheduled_time ? (new Date(action.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })) : old.time,
          description: action.description ?? old.description,
          // Update other fields if present
        };
        // If generic status update?
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
          time: action.scheduled_time ? (new Date(action.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })) : null,
          auto_complete: false,
          description: action.description,
          repeat_interval: 1
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
      return { hydrated: true, ...action.state };
    case 'setConversationId':
      return { ...state, conversation_id: action.conversation_id };
    case 'pushChat':
      return { ...state, chat: [...state.chat, action.message] };
    case 'applyChatActions':
      return applyChatActions(state, action.actions);
    case 'addTask':
      return { ...state, tasks: [action.task, ...state.tasks] };
    case 'updateTask':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.taskId ? { ...t, ...action.patch } : t)),
      };
    case 'setRoutine':
      return { ...state, routine: sortRoutineItems(action.items) };
    case 'updateRoutineItem': {
      // 1. Update routine item
      const nextRoutine = state.routine.map((item) =>
        item.id === action.id ? { ...item, ...action.patch } : item
      );

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
      const nextProfile =
        idx >= 0
          ? state.profile.map((f) => (f.key === action.field.key ? action.field : f))
          : [action.field, ...state.profile];
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
    default:
      return state;
  }
}

const initialState: State = {
  hydrated: false,
  conversation_id: null,
  chat: [],
  tasks: [],
  routine: [],
  profile: [],
  logs: [],
  highlightedIds: [],
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
  nowTask: Task | null;
  nextTask: Task | null;
  pastTask: Task | null;
  timeline: Task[];
  sendChat: (tab: TabId, text: string, imageUri?: string) => Promise<void>;
  completeTask: (taskId: string, comment?: string) => void;
  rescheduleTask: (taskId: string, scheduled_time: string | null, comment?: string) => void;
  addRoutineItem: () => void;
  updateRoutineItem: (id: string, patch: Partial<Omit<RoutineItem, 'id'>>) => void;
  deleteRoutineItem: (id: string) => void;
  loadRoutineTemplate: () => void;
  loadWellnessTemplate: () => void;
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
};

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

  const todoSorted = useMemo(() => sortTodoTasks(state.tasks), [state.tasks]);

  // Smart Visibility Logic
  const { nowTask, nextTask, pastTask, timeline } = useMemo(() => {
    // 0. Filter out future tasks (tomorrow or later)
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todayTasks = todoSorted.filter((t) => {
      if (!t.scheduled_time) return true;
      return new Date(t.scheduled_time).getTime() <= endOfToday.getTime();
    });

    // 1. Filter out passed auto-complete items
    const visible = filterVisibleTasks(todayTasks);

    // 2. Smart Queue Sort
    const now = Date.now();
    const overdue: Task[] = [];
    const upcoming: Task[] = [];

    visible.forEach(t => {
      if (!t.scheduled_time) {
        upcoming.push(t);
      } else {
        const tTime = Date.parse(t.scheduled_time);
        if (tTime < now) {
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
    // 1. History (Completed tasks from today/recent)
    // Sorted Oldest -> Newest (so last item is closest to 'Now')
    const history = state.tasks
      .filter(t => t.status === 'done')
      .sort((a, b) => {
        const at = a.scheduled_time ? Date.parse(a.scheduled_time) : 0;
        const bt = b.scheduled_time ? Date.parse(b.scheduled_time) : 0;
        return at - bt;
      });
    // .slice(-5) if needed

    // 2. Overdue (for Timeline): Needs to be Sorted Oldest -> Newest
    // We re-sort overdue for visual linear flow.
    const overdueAsc = [...overdue].sort((a, b) => {
      const at = a.scheduled_time ? Date.parse(a.scheduled_time) : 0;
      const bt = b.scheduled_time ? Date.parse(b.scheduled_time) : 0;
      return at - bt;
    });

    // 3. Upcoming (Already sorted Earliest -> Latest by todoSorted)

    // Merge into single linear list: [ ...History, ...OverdueAsc, ...Upcoming ]
    // We need to deduplicate logic slightly: NowTask is already in Overdue or Upcoming.
    // Ideally, "Now" is just the pointer. The timeline is the full list.

    const rawTimeline = [...history, ...overdueAsc, ...upcoming];

    // Ensure uniqueness based on ID (just in case)
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
  }, [todoSorted, tick, state.tasks]);


  async function sendChat(tab: TabId, text: string, imageUri?: string) {
    const userMsg: ChatMessage = { id: makeId('msg'), role: 'user', tab, text, imageUri, created_at: nowIso() };
    dispatch({ type: 'pushChat', message: userMsg });

    // Try backend if configured; otherwise fall back to a minimal local behavior.
    let reply: ChatSendResponse | null = null;
    try {
      const context = {
        profile: state.profile,
        routine: state.routine
      };

      reply = await sendChatMessage({
        conversation_id: state.conversation_id,
        tab,
        text,
        imageUri,
        user_context: JSON.stringify(context),
        message_history: state.chat.slice(-10)
      });
    } catch {
      reply = {
        conversation_id: state.conversation_id ?? makeId('conv'),
        assistant_text: 'Got it. (Offline/Error)',
        actions: [{ type: 'create_task', title: text.trim() || 'Untitled', scheduled_time: null }],
      };
    }

    dispatch({ type: 'setConversationId', conversation_id: reply.conversation_id });
    const assistantMsg: ChatMessage = {
      id: makeId('msg'),
      role: 'assistant',
      tab,
      text: reply.assistant_text,
      created_at: nowIso(),
    };
    dispatch({ type: 'pushChat', message: assistantMsg });

    // Apply actions locally so the frontend works before backend exists.
    dispatch({ type: 'applyChatActions', actions: reply.actions });
  }

  function addLog(content: string, related_action: Log['related_action'], routine_item_id?: string) {
    // Only log if we have content OR it's a routine item action
    if (!content && !routine_item_id) return;

    dispatch({
      type: 'addLog',
      log: {
        id: makeId('log'),
        timestamp: nowIso(),
        related_action,
        content: content || (related_action.replace('task_', '').replace('_', ' ')), // Default text if empty
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

    // 3. Check if it repeats
    if (task && task.repeat_interval && task.scheduled_time) {
      // Spawn next occurrence
      const nextTime = new Date(task.scheduled_time);
      nextTime.setDate(nextTime.getDate() + task.repeat_interval);

      const nextTask: Task = {
        ...task,
        id: makeId('task'),
        scheduled_time: nextTime.toISOString(),
        status: 'todo',
        // Ensure we don't accidentally copy over some state we don't want, but for now strict clone is mostly fine
      };

      dispatch({ type: 'addTask', task: nextTask });
    }
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

  function loadWellnessTemplate() {
    const template = getFreshRoutine(WELLNESS_TEMPLATE);
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

  const api: AppStateApi = {
    hydrated: state.hydrated,
    conversation_id: state.conversation_id,
    chat: state.chat,
    tasks: state.tasks,
    routine: state.routine,
    profile: state.profile,
    logs: state.logs,
    highlightedIds: state.highlightedIds,
    nowTask,
    nextTask,
    pastTask,
    timeline,
    sendChat,
    completeTask,
    rescheduleTask,
    addRoutineItem,
    updateRoutineItem,
    deleteRoutineItem,
    loadRoutineTemplate,
    loadWellnessTemplate,
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
        dispatch({ type: 'setRoutine', items: sane });
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
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAppState(): AppStateApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
