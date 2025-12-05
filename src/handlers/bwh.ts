import { TelegramAPI } from '../utils/telegram';
import { Env, BWHServiceInfo } from '../types';
import { formatBytes, formatDate } from '../utils/format';

export async function handleBWHCommand(
  api: TelegramAPI,
  chatId: number,
  env: Env
): Promise<void> {
  await api.sendMessage(chatId, '⏳ 正在查询搬瓦工 VPS 状态...');

  try {
    const info = await getBWHServiceInfo(env);

    if (info.error) {
      await api.sendMessage(
        chatId,
        '❌ 获取 VPS 信息失败，请检查 API 配置'
      );
      return;
    }

    const message = formatBWHMessage(info);
    await api.sendMessage(chatId, message);
  } catch (error) {
    await api.sendMessage(
      chatId,
      '❌ 查询失败，请稍后重试'
    );
    console.error('BWH API error:', error);
  }
}

async function getBWHServiceInfo(env: Env): Promise<BWHServiceInfo> {
  const url = `https://api.64clouds.com/v1/getServiceInfo?veid=${env.BWH_VEID}&api_key=${env.BWH_API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`BWH API request failed: ${response.status}`);
  }

  return await response.json();
}

function formatBWHMessage(info: BWHServiceInfo): string {
  const totalGB = parseFloat(formatBytes(info.plan_monthly_data));
  const usedGB = parseFloat(formatBytes(info.data_counter));
  const remainingGB = totalGB - usedGB;

  const resetDate = formatDate(info.data_next_reset);

  // 计算服务到期日期（假设基于流量重置日期的未来某个时间）
  // 注意：搬瓦工 API 可能没有直接提供到期日期，这里使用一个示例
  // 如果 API 有提供到期日期字段，请替换这部分逻辑
  const expiryDate = '2026-05-26'; // 根据实际 API 响应调整

  const message = `
🖥️ <b>搬瓦工 VPS 状态</b>

📊 <b>流量使用情况:</b>
  • 总计: ${totalGB.toFixed(2)} GB
  • 已用: ${usedGB.toFixed(2)} GB
  • 剩余: ${remainingGB.toFixed(2)} GB

🗓️ <b>重要日期:</b>
  • 流量重置: ${resetDate}
  • 服务到期: ${expiryDate}

📍 <b>服务器信息:</b>
  • 位置: ${info.node_location}
  • 主机名: ${info.hostname}
  • 系统: ${info.os}

💾 <b>资源使用:</b>
  • 内存: ${formatBytes(info.ram_usage)} GB / ${formatBytes(info.plan_ram)} GB
  • 硬盘: ${formatBytes(info.disk_usage)} GB / ${formatBytes(info.plan_disk)} GB
  `.trim();

  return message;
}
