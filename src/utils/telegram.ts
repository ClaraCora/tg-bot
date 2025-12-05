import { Env } from '../types';

export class TelegramAPI {
  private baseUrl: string;

  constructor(private token: string) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(
    chatId: number,
    text: string,
    options?: {
      reply_markup?: any;
      parse_mode?: string;
    }
  ): Promise<Response> {
    return fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parse_mode || 'HTML',
        ...options,
      }),
    });
  }

  async editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    options?: {
      reply_markup?: any;
      parse_mode?: string;
    }
  ): Promise<Response> {
    return fetch(`${this.baseUrl}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: options?.parse_mode || 'HTML',
        ...options,
      }),
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<Response> {
    return fetch(`${this.baseUrl}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    });
  }

  async setWebhook(url: string): Promise<Response> {
    return fetch(`${this.baseUrl}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  }

  async deleteWebhook(): Promise<Response> {
    return fetch(`${this.baseUrl}/deleteWebhook`, {
      method: 'POST',
    });
  }

  async setMyCommands(commands: Array<{ command: string; description: string }>): Promise<Response> {
    return fetch(`${this.baseUrl}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });
  }

  async setChatMenuButton(menuButton?: { type: string; text?: string }): Promise<Response> {
    return fetch(`${this.baseUrl}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: menuButton || { type: 'commands' }
      }),
    });
  }
}

export function isAuthorized(userId: number, env: Env): boolean {
  const allowedUserId = parseInt(env.ALLOWED_USER_ID);
  return userId === allowedUserId;
}
