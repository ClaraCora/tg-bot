// Telegram API Types
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  date: number;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

// Bot Environment
export interface Env {
  BOT_TOKEN: string;
  BWH_API_KEY: string;
  BWH_VEID: string;
  ALLOWED_USER_ID: string;
  REMINDERS_KV: KVNamespace;
}

// Exchange Rate API Types
export interface ExchangeRates {
  base: string;
  rates: {
    [key: string]: number;
  };
}

// BandwagonHost API Types
export interface BWHServiceInfo {
  vm_type: string;
  hostname: string;
  node_ip: string;
  node_location: string;
  plan_monthly_data: number;
  data_counter: number;
  data_next_reset: number;
  plan_disk: number;
  disk_usage: number;
  plan_ram: number;
  ram_usage: number;
  swap_usage: number;
  ip_addresses: string[];
  os: string;
  error?: number;
  suspended?: boolean;
}

// User Session Types
export interface UserSession {
  state?: 'awaiting_amount' | 'awaiting_reminder_time' | 'awaiting_reminder_message';
  selectedCurrency?: string;
  reminderTimeType?: 'absolute' | 'relative';
  reminderTime?: number;
  reminderRepeat?: 'none' | 'daily' | 'weekly';
}

// Reminder Types
export interface Reminder {
  id: string;
  userId: number;
  chatId: number;
  message: string;
  triggerTime: number; // Unix timestamp in seconds
  repeat: 'none' | 'daily' | 'weekly';
  createdAt: number;
}
