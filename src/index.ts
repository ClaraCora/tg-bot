import { TelegramAPI, isAuthorized } from './utils/telegram';
import { handleExchangeCommand, handleExchangeCallback, handleExchangeAmount } from './handlers/exchange';
import { handleBWHCommand } from './handlers/bwh';
// 已禁用 reminder 功能以节省 KV 配额
// import {
//   handleReminderCommand,
//   handleAddReminder,
//   handleTimeTypeSelection,
//   handleReminderTimeInput,
//   handleRepeatTypeSelection,
//   handleReminderMessageInput,
//   handleListReminders,
//   handleDeleteReminderPrompt,
//   handleDeleteReminderConfirm,
//   checkAndSendReminders,
// } from './handlers/reminder';
import { Env, TelegramUpdate } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 健康检查端点
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    // Webhook 设置端点
    if (url.pathname === '/registerWebhook') {
      const api = new TelegramAPI(env.BOT_TOKEN);
      const webhookUrl = `${url.origin}/webhook`;

      try {
        const response = await api.setWebhook(webhookUrl);
        const result = await response.json();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to set webhook' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Bot 命令菜单设置端点
    if (url.pathname === '/setCommands') {
      const api = new TelegramAPI(env.BOT_TOKEN);

      try {
        const commands = [
          { command: 'start', description: '开始使用，显示欢迎信息' },
          { command: 'help', description: '显示帮助信息' },
          { command: 'exchange', description: '汇率转换（美元、欧元、加元）' },
          { command: 'vps', description: '查询搬瓦工 VPS 状态' },
          // 已禁用提醒功能以节省 KV 配额
          // { command: 'reminder', description: '提醒事项管理' },
        ];

        // 设置命令列表
        const commandsResponse = await api.setMyCommands(commands);
        const commandsResult = await commandsResponse.json();

        // 设置菜单按钮（显示在输入框左侧）
        const menuResponse = await api.setChatMenuButton();
        const menuResult = await menuResponse.json();

        return new Response(JSON.stringify({
          commands: commandsResult,
          menuButton: menuResult
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to set commands' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Webhook 端点
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update: TelegramUpdate = await request.json();
        await handleUpdate(update, env);
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Error handling update:', error);
        return new Response('Error', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },

  // Cron Trigger - 已禁用定时提醒功能以节省 KV 配额
  // async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  //   try {
  //     await checkAndSendReminders(env);
  //   } catch (error) {
  //     console.error('Error in scheduled task:', error);
  //   }
  // },
};

async function handleUpdate(update: TelegramUpdate, env: Env): Promise<void> {
  const api = new TelegramAPI(env.BOT_TOKEN);

  // 处理回调查询
  if (update.callback_query) {
    const { callback_query } = update;
    const chatId = callback_query.message?.chat.id;
    const messageId = callback_query.message?.message_id;
    const userId = callback_query.from.id;

    if (!chatId || !messageId) return;

    // 权限检查
    if (!isAuthorized(userId, env)) {
      await api.answerCallbackQuery(
        callback_query.id,
        '❌ 你没有权限使用此 Bot'
      );
      return;
    }

    const data = callback_query.data || '';

    // 处理汇率选择回调
    if (data.startsWith('ex_')) {
      const currency = data.substring(3);
      await handleExchangeCallback(api, chatId, messageId, currency, userId);
      await api.answerCallbackQuery(callback_query.id);
      return;
    }

    // 已禁用提醒相关回调处理以节省 KV 配额
    // if (data === 'rem_add') {
    //   await handleAddReminder(api, chatId, messageId, userId);
    //   await api.answerCallbackQuery(callback_query.id);
    //   return;
    // }

    // if (data === 'rem_list') {
    //   await handleListReminders(api, chatId, messageId, userId, env);
    //   await api.answerCallbackQuery(callback_query.id);
    //   return;
    // }

    // if (data === 'rem_delete') {
    //   await handleDeleteReminderPrompt(api, chatId, messageId, userId, env);
    //   await api.answerCallbackQuery(callback_query.id);
    //   return;
    // }

    // if (data === 'rem_time_absolute' || data === 'rem_time_relative') {
    //   const timeType = data === 'rem_time_absolute' ? 'absolute' : 'relative';
    //   await handleTimeTypeSelection(api, chatId, messageId, userId, timeType);
    //   await api.answerCallbackQuery(callback_query.id);
    //   return;
    // }

    // if (data.startsWith('rem_repeat_')) {
    //   const repeatType = data.substring(11) as 'none' | 'daily' | 'weekly';
    //   await handleRepeatTypeSelection(api, chatId, messageId, userId, repeatType);
    //   await api.answerCallbackQuery(callback_query.id);
    //   return;
    // }

    // if (data.startsWith('rem_del_')) {
    //   const reminderId = data.substring(8);
    //   await handleDeleteReminderConfirm(api, chatId, messageId, userId, reminderId, env);
    //   await api.answerCallbackQuery(callback_query.id);
    //   return;
    // }

    return;
  }

  // 处理普通消息
  if (update.message) {
    const { message } = update;
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const text = message.text || '';

    if (!userId) return;

    // 权限检查
    if (!isAuthorized(userId, env)) {
      await api.sendMessage(
        chatId,
        '❌ 你没有权限使用此 Bot'
      );
      return;
    }

    // 处理命令
    if (text.startsWith('/')) {
      await handleCommand(api, chatId, text, env);
      return;
    }

    // 处理汇率金额输入
    const handled = await handleExchangeAmount(api, chatId, userId, text);
    if (handled) return;

    // 已禁用提醒功能以节省 KV 配额
    // handled = await handleReminderTimeInput(api, chatId, userId, text);
    // if (handled) return;

    // handled = await handleReminderMessageInput(api, chatId, userId, text, env);
    // if (handled) return;

    // 未识别的消息
    await api.sendMessage(
      chatId,
      '❓ 未知命令，请使用 /help 查看可用命令'
    );
  }
}

async function handleCommand(
  api: TelegramAPI,
  chatId: number,
  text: string,
  env: Env
): Promise<void> {
  const command = text.split(' ')[0].toLowerCase();

  switch (command) {
    case '/start':
      await api.sendMessage(
        chatId,
        `
👋 <b>欢迎使用多功能 Bot！</b>

📋 <b>可用命令：</b>

💱 /exchange 或 /汇率
   汇率转换（支持美元、欧元、加元）

🖥️ /vps 或 /bwh
   查询搬瓦工 VPS 状态

❓ /help
   显示帮助信息
        `.trim()
      );
      break;

    case '/help':
      await api.sendMessage(
        chatId,
        `
📖 <b>帮助信息</b>

<b>汇率转换：</b>
1. 发送 /exchange 或 /汇率
2. 选择货币类型
3. 输入金额

<b>VPS 监控：</b>
发送 /vps 或 /bwh 查询服务器状态

<b>支持的货币：</b>
🇺🇸 USD (美元)
🇪🇺 EUR (欧元)
🇨🇦 CAD (加元)
        `.trim()
      );
      break;

    case '/exchange':
    case '/汇率':
      await handleExchangeCommand(api, chatId);
      break;

    case '/vps':
    case '/bwh':
      await handleBWHCommand(api, chatId, env);
      break;

    // 已禁用提醒功能以节省 KV 配额
    // case '/reminder':
    // case '/提醒':
    //   await handleReminderCommand(api, chatId);
    //   break;

    default:
      await api.sendMessage(
        chatId,
        '❓ 未知命令，请使用 /help 查看可用命令'
      );
  }
}
