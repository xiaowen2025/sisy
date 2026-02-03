export type Iso8601 = string;

export type TabId = 'home' | 'routine' | 'me';

export type TaskStatus = 'todo' | 'done';
export type TaskSource = 'routine' | 'chat' | 'system';

export type Task = {
  id: string;
  title: string;
  scheduled_time: Iso8601 | null;
  status: TaskStatus;
  source: TaskSource;
  auto_complete?: boolean;
  repeat_interval?: number;
  routine_item_id?: string;
  description?: string;
};

export type RoutineItem = {
  id: string;
  title: string;
  time: string | null;
  auto_complete: boolean;
  description?: string;
  previousDescription?: string; // Stores last version for revert
  repeat_interval?: number; // 1 = daily, 3 = every 3 days, etc.
};

export type ProfileFieldSource = 'user' | 'learned';
export type ProfileField = {
  key: string;
  value: string;
  previousValue?: string; // Stores last version for revert
  group?: string;
  source: ProfileFieldSource;
  updated_at: Iso8601;
};

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  tab: TabId;
  text: string;
  imageUri?: string;
  created_at: Iso8601;
};

export type Log = {
  id: string;
  timestamp: Iso8601;
  related_action: 'task_complete' | 'state_update' | 'task_skip' | 'task_reschedule';
  content: string;
  author: 'user' | 'assistant';
  routine_item_id?: string;
};

export type ChatAction =
  | {
    type: 'create_task';
    title: string;
    scheduled_time: Iso8601 | null;
  }
  | {
    type: 'suggest_reschedule';
    task_id: string;
    scheduled_time: Iso8601 | null;
  }
  | {
    type: 'upsert_profile_field';
    key: string;
    value: string;
    group?: string;
    source?: ProfileFieldSource;
  }
  | {
    type: 'create_routine_item';
    title: string;
    scheduled_time?: string | null;
    status?: string | null;
    description?: string | null;
  }
  | {
    type: 'update_routine_item';
    id: string;
    title?: string;
    scheduled_time?: string | null;
    status?: string | null;
    description?: string | null;
  }
  | {
    type: 'upsert_profile_field';
    key: string;
    value: string;
    group?: string;
    source?: ProfileFieldSource;
  };

export type ChatSendRequest = {
  conversation_id: string | null;
  tab: TabId;
  text: string;
  imageUri?: string;
  user_context?: string; // JSON string
  message_history?: ChatMessage[];
};

export type ChatSendResponse = {
  conversation_id: string;
  assistant_text: string;
  actions: ChatAction[];
};
