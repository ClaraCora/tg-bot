import { TelegramAPI } from '../utils/telegram';
import { ExchangeRates, UserSession } from '../types';
import { formatCurrency, getCurrencySymbol, getCurrencyName } from '../utils/format';

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'CAD'];

// 简单的内存会话存储（对于单个用户足够）
const userSessions = new Map<number, UserSession>();

export async function handleExchangeCommand(
  api: TelegramAPI,
  chatId: number
): Promise<void> {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🇺🇸 美元 (USD)', callback_data: 'ex_USD' },
        { text: '🇪🇺 欧元 (EUR)', callback_data: 'ex_EUR' },
      ],
      [
        { text: '🇨🇦 加元 (CAD)', callback_data: 'ex_CAD' },
      ],
    ],
  };

  await api.sendMessage(
    chatId,
    '💱 <b>汇率转换</b>\n\n请选择要转换为人民币的货币：',
    { reply_markup: keyboard }
  );
}

export async function handleExchangeCallback(
  api: TelegramAPI,
  chatId: number,
  messageId: number,
  currency: string,
  userId: number
): Promise<void> {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    await api.answerCallbackQuery('', '不支持的货币');
    return;
  }

  // 保存用户会话
  userSessions.set(userId, {
    state: 'awaiting_amount',
    selectedCurrency: currency,
  });

  const currencyName = getCurrencyName(currency);
  const symbol = getCurrencySymbol(currency);

  await api.editMessageText(
    chatId,
    messageId,
    `💱 <b>汇率转换</b>\n\n已选择：${currencyName} (${currency})\n\n请输入 ${currencyName} 金额（例如：100）：`
  );
}

export async function handleExchangeAmount(
  api: TelegramAPI,
  chatId: number,
  userId: number,
  amountText: string
): Promise<boolean> {
  const session = userSessions.get(userId);

  if (!session || session.state !== 'awaiting_amount' || !session.selectedCurrency) {
    return false;
  }

  const amount = parseFloat(amountText);

  if (isNaN(amount) || amount <= 0) {
    await api.sendMessage(
      chatId,
      '❌ 请输入有效的数字金额（例如：100）'
    );
    return true;
  }

  // 清除会话
  userSessions.delete(userId);

  // 获取汇率
  await api.sendMessage(chatId, '⏳ 正在查询汇率...');

  try {
    const rate = await getExchangeRate(session.selectedCurrency);
    const cnyAmount = amount * rate;

    const currencyName = getCurrencyName(session.selectedCurrency);
    const fromSymbol = getCurrencySymbol(session.selectedCurrency);
    const toSymbol = getCurrencySymbol('CNY');

    const message = `
💱 <b>汇率转换结果</b>

<b>原始金额：</b>${fromSymbol}${amount.toFixed(2)}
<b>目标金额：</b>${toSymbol}${cnyAmount.toFixed(2)}

<b>汇率：</b>1 ${session.selectedCurrency} = ${rate.toFixed(4)} CNY
<b>货币：</b>${currencyName} → 人民币

<i>数据来源：Frankfurter API</i>
    `.trim();

    await api.sendMessage(chatId, message);
  } catch (error) {
    await api.sendMessage(
      chatId,
      '❌ 获取汇率失败，请稍后重试'
    );
    console.error('Exchange rate error:', error);
  }

  return true;
}

async function getExchangeRate(fromCurrency: string): Promise<number> {
  const url = `https://api.frankfurter.app/latest?from=${fromCurrency}&to=CNY`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch exchange rate: ${response.status}`);
  }

  const data: ExchangeRates = await response.json();

  if (!data.rates || !data.rates.CNY) {
    throw new Error('CNY rate not found in response');
  }

  return data.rates.CNY;
}
