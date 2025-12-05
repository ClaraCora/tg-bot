import { TelegramAPI } from '../utils/telegram';
import { Env, Reminder, UserSession } from '../types';
import { formatDate } from '../utils/format';

// 内存会话存储
const userSessions = new Map<number, UserSession>();

// 生成唯一 ID
function generateId(): string {
  return `reminder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// 获取用户的所有提醒
async function getUserReminders(env: Env, userId: number): Promise<Reminder[]> {
  const listResult = await env.REMINDERS_KV.list({ prefix: `user_${userId}_` });
  const reminders: Reminder[] = [];

  for (const key of listResult.keys) {
    const reminderJson = await env.REMINDERS_KV.get(key.name);
    if (reminderJson) {
      reminders.push(JSON.parse(reminderJson));
    }
  }

  // 按触发时间排序
  return reminders.sort((a, b) => a.triggerTime - b.triggerTime);
}

// 保存提醒
async function saveReminder(env: Env, reminder: Reminder): Promise<void> {
  const key = `user_${reminder.userId}_${reminder.id}`;
  await env.REMINDERS_KV.put(key, JSON.stringify(reminder));
}

// 删除提醒
async function deleteReminder(env: Env, userId: number, reminderId: string): Promise<void> {
  const key = `user_${userId}_${reminderId}`;
  await env.REMINDERS_KV.delete(key);
}

// 解析相对时间（如：30分钟、2小时、1天）
function parseRelativeTime(text: string): number | null {
  text = text.trim().toLowerCase();

  // 匹配 "数字 + 单位"
  const patterns = [
    { regex: /^(\d+)\s*分钟?后?$/, multiplier: 60 },
    { regex: /^(\d+)\s*小时后?$/, multiplier: 3600 },
    { regex: /^(\d+)\s*天后?$/, multiplier: 86400 },
    { regex: /^(\d+)\s*周后?$/, multiplier: 604800 },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const value = parseInt(match[1]);
      return Math.floor(Date.now() / 1000) + value * pattern.multiplier;
    }
  }

  return null;
}

// 解析绝对时间（如：2025-12-10 14:30）- 用户输入为北京时间
function parseAbsoluteTime(text: string): number | null {
  text = text.trim();

  // 支持格式：YYYY-MM-DD HH:mm 或 YYYY-MM-DD HH:mm:ss
  const patterns = [
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/,
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // JS months are 0-indexed
      const day = parseInt(match[3]);
      const hour = parseInt(match[4]);
      const minute = parseInt(match[5]);
      const second = match[6] ? parseInt(match[6]) : 0;

      // 用户输入的是北京时间，需要转换为 UTC 时间戳
      // 使用 Date.UTC 创建 UTC 时间，然后减去 8 小时
      const utcTimestamp = Date.UTC(year, month, day, hour, minute, second);
      const beijingOffset = 8 * 3600 * 1000; // 8 小时的毫秒数
      return Math.floor((utcTimestamp - beijingOffset) / 1000);
    }
  }

  return null;
}

// 格式化时间戳为可读字符串（北京时间 UTC+8）
function formatTimestamp(timestamp: number): string {
  // 将 UTC 时间戳转换为北京时间
  const date = new Date((timestamp + 8 * 3600) * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

// 处理 /reminder 命令
export async function handleReminderCommand(
  api: TelegramAPI,
  chatId: number
): Promise<void> {
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ 添加提醒', callback_data: 'rem_add' }],
      [{ text: '📋 查看提醒', callback_data: 'rem_list' }],
      [{ text: '🗑️ 删除提醒', callback_data: 'rem_delete' }],
    ],
  };

  await api.sendMessage(
    chatId,
    '⏰ <b>提醒管理</b>\n\n请选择操作：',
    { reply_markup: keyboard }
  );
}

// 处理添加提醒
export async function handleAddReminder(
  api: TelegramAPI,
  chatId: number,
  messageId: number,
  userId: number
): Promise<void> {
  const keyboard = {
    inline_keyboard: [
      [{ text: '📅 绝对时间', callback_data: 'rem_time_absolute' }],
      [{ text: '⏱️ 相对时间', callback_data: 'rem_time_relative' }],
    ],
  };

  await api.editMessageText(
    chatId,
    messageId,
    '⏰ <b>添加提醒</b>\n\n请选择时间设置方式：',
    { reply_markup: keyboard }
  );
}

// 处理时间类型选择
export async function handleTimeTypeSelection(
  api: TelegramAPI,
  chatId: number,
  messageId: number,
  userId: number,
  timeType: 'absolute' | 'relative'
): Promise<void> {
  userSessions.set(userId, {
    state: 'awaiting_reminder_time',
    reminderTimeType: timeType,
  });

  let message = '⏰ <b>设置提醒时间</b>\n\n';
  if (timeType === 'absolute') {
    message += '请输入具体日期时间（北京时间），格式：\n';
    message += '<code>YYYY-MM-DD HH:mm</code>\n\n';
    message += '例如：<code>2025-12-25 18:00</code>';
  } else {
    message += '请输入相对时间，例如：\n';
    message += '• <code>30分钟</code>\n';
    message += '• <code>2小时</code>\n';
    message += '• <code>1天</code>\n';
    message += '• <code>1周</code>';
  }

  await api.editMessageText(chatId, messageId, message);
}

// 处理时间输入
export async function handleReminderTimeInput(
  api: TelegramAPI,
  chatId: number,
  userId: number,
  text: string
): Promise<boolean> {
  const session = userSessions.get(userId);
  if (!session || session.state !== 'awaiting_reminder_time' || !session.reminderTimeType) {
    return false;
  }

  let timestamp: number | null = null;

  if (session.reminderTimeType === 'absolute') {
    timestamp = parseAbsoluteTime(text);
    if (!timestamp) {
      await api.sendMessage(
        chatId,
        '❌ 时间格式错误，请使用格式：<code>YYYY-MM-DD HH:mm</code>\n例如：<code>2025-12-25 18:00</code>'
      );
      return true;
    }
  } else {
    timestamp = parseRelativeTime(text);
    if (!timestamp) {
      await api.sendMessage(
        chatId,
        '❌ 时间格式错误，请使用例如：<code>30分钟</code>、<code>2小时</code>、<code>1天</code>'
      );
      return true;
    }
  }

  // 检查时间是否在未来
  const now = Math.floor(Date.now() / 1000);
  if (timestamp <= now) {
    await api.sendMessage(chatId, '❌ 提醒时间必须在未来');
    return true;
  }

  // 保存时间，进入选择重复模式
  userSessions.set(userId, {
    ...session,
    state: 'awaiting_reminder_message',
    reminderTime: timestamp,
  });

  const keyboard = {
    inline_keyboard: [
      [{ text: '一次性', callback_data: 'rem_repeat_none' }],
      [{ text: '每天重复', callback_data: 'rem_repeat_daily' }],
      [{ text: '每周重复', callback_data: 'rem_repeat_weekly' }],
    ],
  };

  await api.sendMessage(
    chatId,
    `✅ 提醒时间：${formatTimestamp(timestamp)}\n\n请选择重复方式：`,
    { reply_markup: keyboard }
  );

  return true;
}

// 处理重复类型选择
export async function handleRepeatTypeSelection(
  api: TelegramAPI,
  chatId: number,
  messageId: number,
  userId: number,
  repeatType: 'none' | 'daily' | 'weekly'
): Promise<void> {
  const session = userSessions.get(userId);
  if (!session || session.state !== 'awaiting_reminder_message') {
    return;
  }

  userSessions.set(userId, {
    ...session,
    reminderRepeat: repeatType,
  });

  const repeatText = repeatType === 'none' ? '一次性' : repeatType === 'daily' ? '每天重复' : '每周重复';

  await api.editMessageText(
    chatId,
    messageId,
    `✅ 重复方式：${repeatText}\n\n请输入提醒内容（消息）：`
  );
}

// 处理提醒消息输入
export async function handleReminderMessageInput(
  api: TelegramAPI,
  chatId: number,
  userId: number,
  text: string,
  env: Env
): Promise<boolean> {
  const session = userSessions.get(userId);
  if (!session || session.state !== 'awaiting_reminder_message' || !session.reminderTime || !session.reminderRepeat) {
    return false;
  }

  // 创建提醒
  const reminder: Reminder = {
    id: generateId(),
    userId,
    chatId,
    message: text,
    triggerTime: session.reminderTime,
    repeat: session.reminderRepeat,
    createdAt: Math.floor(Date.now() / 1000),
  };

  await saveReminder(env, reminder);

  // 清除会话
  userSessions.delete(userId);

  const repeatText = reminder.repeat === 'none' ? '一次性' : reminder.repeat === 'daily' ? '每天重复' : '每周重复';

  await api.sendMessage(
    chatId,
    `✅ <b>提醒已创建</b>\n\n📝 内容：${text}\n⏰ 时间：${formatTimestamp(reminder.triggerTime)}\n🔄 重复：${repeatText}`
  );

  return true;
}

// 处理查看提醒列表
export async function handleListReminders(
  api: TelegramAPI,
  chatId: number,
  messageId: number,
  userId: number,
  env: Env
): Promise<void> {
  const reminders = await getUserReminders(env, userId);

  if (reminders.length === 0) {
    await api.editMessageText(
      chatId,
      messageId,
      '📋 <b>提醒列表</b>\n\n暂无提醒事项'
    );
    return;
  }

  let message = '📋 <b>提醒列表</b>\n\n';
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < reminders.length; i++) {
    const r = reminders[i];
    const repeatText = r.repeat === 'none' ? '' : r.repeat === 'daily' ? ' 🔄每天' : ' 🔄每周';
    const isPast = r.triggerTime <= now && r.repeat === 'none';
    const status = isPast ? '✅' : '⏰';

    message += `${i + 1}. ${status} ${formatTimestamp(r.triggerTime)}${repeatText}\n`;
    message += `   ${r.message}\n\n`;
  }

  await api.editMessageText(chatId, messageId, message);
}

// 处理删除提醒
export async function handleDeleteReminderPrompt(
  api: TelegramAPI,
  chatId: number,
  messageId: number,
  userId: number,
  env: Env
): Promise<void> {
  const reminders = await getUserReminders(env, userId);

  if (reminders.length === 0) {
    await api.editMessageText(
      chatId,
      messageId,
      '📋 <b>删除提醒</b>\n\n暂无提醒事项'
    );
    return;
  }

  const keyboard = {
    inline_keyboard: reminders.map((r, index) => [
      {
        text: `${index + 1}. ${r.message.substring(0, 30)}`,
        callback_data: `rem_del_${r.id}`,
      },
    ]),
  };

  await api.editMessageText(
    chatId,
    messageId,
    '🗑️ <b>删除提醒</b>\n\n请选择要删除的提醒：',
    { reply_markup: keyboard }
  );
}

// 处理确认删除
export async function handleDeleteReminderConfirm(
  api: TelegramAPI,
  chatId: number,
  messageId: number,
  userId: number,
  reminderId: string,
  env: Env
): Promise<void> {
  await deleteReminder(env, userId, reminderId);

  await api.editMessageText(
    chatId,
    messageId,
    '✅ 提醒已删除'
  );
}

// Cron 任务：检查并发送到期的提醒
export async function checkAndSendReminders(env: Env): Promise<void> {
  const api = new TelegramAPI(env.BOT_TOKEN);
  const now = Math.floor(Date.now() / 1000);

  // 获取所有提醒
  const listResult = await env.REMINDERS_KV.list();

  for (const key of listResult.keys) {
    const reminderJson = await env.REMINDERS_KV.get(key.name);
    if (!reminderJson) continue;

    const reminder: Reminder = JSON.parse(reminderJson);

    // 检查是否到期（允许1分钟误差）
    if (reminder.triggerTime <= now && reminder.triggerTime > now - 60) {
      // 发送提醒
      await api.sendMessage(
        reminder.chatId,
        `⏰ <b>提醒</b>\n\n${reminder.message}`
      );

      // 处理重复提醒
      if (reminder.repeat === 'daily') {
        // 每天重复：增加 24 小时
        reminder.triggerTime += 86400;
        await saveReminder(env, reminder);
      } else if (reminder.repeat === 'weekly') {
        // 每周重复：增加 7 天
        reminder.triggerTime += 604800;
        await saveReminder(env, reminder);
      } else {
        // 一次性提醒：删除
        await env.REMINDERS_KV.delete(key.name);
      }
    }
  }
}
