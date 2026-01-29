const fs = require('fs');

const path = 'lib/appState.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix AppStateApi type definition
// It currently has duplicate keys or messiness. Let's find the type definiton and replace it cleanly.
const typeDefRegex = /type AppStateApi = \{[\s\S]*?\};/;
const cleanTypeDef = `type AppStateApi = {
  hydrated: boolean;
  conversation_id: string | null;
  chat: ChatMessage[];
  tasks: Task[];
  routine: RoutineItem[];
  profile: ProfileField[];
  logs: Log[];
  nowTask: Task | null;
  nextTask: Task | null;
  pastTask: Task | null;
  timeline: Task[];
  sendChat: (tab: TabId, text: string) => Promise<void>;
  completeTask: (taskId: string) => void;
  rescheduleTask: (taskId: string, scheduled_time: string | null) => void;
  addRoutineItem: () => void;
  updateRoutineItem: (id: string, patch: Partial<Omit<RoutineItem, 'id'>>) => void;
  deleteRoutineItem: (id: string) => void;
  loadRoutineTemplate: () => void;
  loadWellnessTemplate: () => void;
  upsertProfileField: (key: string, value: string, group?: string, source?: ProfileField['source']) => void;
  deleteProfileField: (key: string) => void;
  deleteProfileGroup: (group: string) => void;
  createQuickTask: (title: string) => void;
  skipTask: (taskId: string) => void;
  importRoutine: (json: string) => void;
  importProfile: (json: string) => void;
  addLog: (content: string, related_action: Log['related_action']) => void;
};`;

content = content.replace(typeDefRegex, cleanTypeDef);

// 2. Fix the duplicated/broken useMemo block.
// We look for "const { nowTask, nextTask, pastTask } = useMemo" ... down to "return { ... }"
// We want to replace the entire smart logic block including the mess at the end.

const startMarker = 'const { nowTask, nextTask, pastTask } = useMemo(() => {';
const endMarker = '}, [todoSorted, tick]);';
// Note: duplicate blocks might exist.

// Let's replace the whole region from startMarker to the return statement of AppStateProvider
// Or simpler: Find the start of the block and replace until the `sendChat` function start.
// "async function sendChat"

const blockStart = content.indexOf(startMarker);
const blockEnd = content.indexOf('async function sendChat');

if (blockStart === -1 || blockEnd === -1) {
    console.error("Could not find block boundaries");
    process.exit(1);
}

const newBlock = `const { nowTask, nextTask, pastTask, timeline } = useMemo(() => {
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

  `;

// Replace the messy block
// We need to be careful about what we're replacing.
// The file has a mess of duplicates.
// Let's replace everything from the FIRST "const { nowTask" to "async function sendChat"
// with the new clean block + empty lines.

const preBlock = content.substring(0, blockStart);
const postBlock = content.substring(blockEnd);

const newContent = preBlock + newBlock + '\n  ' + postBlock;

fs.writeFileSync(path, newContent);
console.log("Fixed appState.tsx");
