# Telegram Bot - 汇率转换 & 搬瓦工监控 & 提醒事项

一个部署在 Cloudflare Workers 上的 Telegram Bot，支持汇率转换、搬瓦工 VPS 状态监控和提醒事项管理。

## 功能特性

### 💱 汇率转换
- 支持货币：美元(USD)、欧元(EUR)、加元(CAD)
- 实时汇率数据（来源：Frankfurter API）
- 交互式货币选择界面

### 🖥️ 搬瓦工 VPS 监控
- 流量使用情况（总计/已用/剩余）
- 流量重置日期
- 服务到期日期
- 服务器位置和系统信息
- 资源使用情况（内存、硬盘）

### ⏰ 提醒事项
- 添加提醒：支持绝对时间和相对时间
  - 绝对时间：2025-12-25 18:00（北京时间）
  - 相对时间：30分钟、2小时、1天、1周
- 重复提醒：支持一次性、每天重复、每周重复
- 查看提醒列表
- 删除提醒
- 自动推送：到达设定时间自动发送提醒消息
- 数据存储：使用 Cloudflare Workers KV
- 定时检查：每分钟检查一次，确保准时提醒
- 时区支持：所有时间显示和输入均使用北京时间（UTC+8）

### 🔒 安全特性
- 用户权限控制（仅允许指定用户使用）

## 前置要求

- Node.js 16.x 或更高版本
- Cloudflare 账户（免费）
- Telegram Bot Token（通过 @BotFather 创建）
- 搬瓦工账户和 API Key（可选，如需 VPS 监控功能）

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/tg-bot.git
cd tg-bot
```

### 2. 安装依赖

```bash
npm install
```

### 3. 创建 Telegram Bot

1. 在 Telegram 中找到 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 创建新 Bot
3. 按提示设置 Bot 名称和用户名
4. 保存获得的 **Bot Token**

### 4. 获取你的 Telegram 用户 ID

1. 在 Telegram 中找到 [@userinfobot](https://t.me/userinfobot)
2. 发送 `/start`
3. 保存你的 **User ID**

### 5. 配置环境变量

#### 本地开发

复制 `.dev.vars.example` 为 `.dev.vars`：

```bash
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars`，填入你的配置：

```bash
BOT_TOKEN=your_telegram_bot_token
BWH_API_KEY=your_bandwagonhost_api_key  # 可选
BWH_VEID=your_vps_id                     # 可选
ALLOWED_USER_ID=your_telegram_user_id
```

#### 生产环境（Cloudflare Workers）

部署前需要设置环境变量：

```bash
# 必需
npx wrangler secret put BOT_TOKEN
# 输入你的 Telegram Bot Token

npx wrangler secret put ALLOWED_USER_ID
# 输入你的 Telegram 用户 ID

# 可选（如需 VPS 监控功能）
npx wrangler secret put BWH_API_KEY
# 输入你的搬瓦工 API Key

npx wrangler secret put BWH_VEID
# 输入你的搬瓦工 VPS ID
```

### 6. 创建 KV Namespace

提醒功能需要 KV 存储：

```bash
npx wrangler kv:namespace create REMINDERS_KV
```

复制输出的 `id`，更新 `wrangler.toml` 中的 `kv_namespaces` 配置。

### 7. 登录 Cloudflare

```bash
npx wrangler login
```

### 8. 部署到 Cloudflare Workers

```bash
npm run deploy
```

部署成功后，你会看到 Worker URL，例如：
```
https://tg-bot.your-subdomain.workers.dev
```

### 9. 设置 Telegram Webhook

访问以下 URL 来注册 Webhook（替换为你的实际 URL）：

```
https://tg-bot.your-subdomain.workers.dev/registerWebhook
```

你应该会看到成功的 JSON 响应：
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### 10. 设置 Bot 命令菜单（推荐）

访问以下 URL 来设置 Bot 的快捷命令菜单：

```
https://tg-bot.your-subdomain.workers.dev/setCommands
```

设置成功后，在 Telegram 中输入 `/` 时会在输入框左侧显示菜单按钮。

### 11. 测试 Bot

1. 在 Telegram 中搜索你的 Bot
2. 发送 `/start` 开始使用
3. 输入 `/` 查看所有可用命令

## 本地开发

```bash
# 启动本地开发服务器
npm run dev
```

## 可用命令

Bot 已配置快捷命令菜单，在 Telegram 中输入 `/` 即可看到所有命令：

- `/start` - 开始使用，显示欢迎信息
- `/help` - 显示帮助信息
- `/exchange` 或 `/汇率` - 汇率转换
- `/vps` 或 `/bwh` - 查询搬瓦工 VPS 状态
- `/reminder` 或 `/提醒` - 提醒事项管理（添加、查看、删除）

## 项目结构

```
bot/
├── src/
│   ├── index.ts              # Workers 入口（含 Cron Trigger）
│   ├── types.ts              # TypeScript 类型定义
│   ├── handlers/
│   │   ├── exchange.ts       # 汇率转换处理器
│   │   ├── bwh.ts           # 搬瓦工监控处理器
│   │   └── reminder.ts      # 提醒事项处理器
│   └── utils/
│       ├── telegram.ts       # Telegram API 工具
│       └── format.ts         # 格式化工具
├── wrangler.toml             # Cloudflare 配置（含 KV 和 Cron）
├── package.json
└── tsconfig.json
```

## 技术栈

- **TypeScript** - 类型安全的 JavaScript
- **Cloudflare Workers** - 无服务器边缘计算平台
- **Cloudflare Workers KV** - 键值存储（用于提醒数据）
- **Cloudflare Cron Triggers** - 定时任务（每分钟检查提醒）
- **Telegram Bot API** - Bot 通信
- **Frankfurter API** - 免费汇率数据
- **BandwagonHost API** - VPS 监控数据

## 注意事项

1. **Cloudflare Workers 免费额度**：
   - 每天 100,000 请求
   - Workers KV: 100,000 次读取/天，1,000 次写入/天
   - 对于个人使用完全足够
2. **安全性**：所有敏感信息都通过环境变量存储，不会提交到代码仓库
3. **权限控制**：只有配置的用户 ID 可以使用此 Bot
4. **提醒精度**：Cron Triggers 每分钟执行一次，提醒误差在 1 分钟以内
5. **数据持久化**：提醒数据存储在 Cloudflare Workers KV 中，永久保存

## 故障排除

### Webhook 设置失败
- 确保 Worker 已成功部署
- 检查 BOT_TOKEN 是否正确

### Bot 无响应
- 检查 Cloudflare Workers 日志：`wrangler tail`
- 确认环境变量是否正确设置

### 汇率查询失败
- Frankfurter API 可能暂时不可用，稍后重试

### 搬瓦工数据查询失败
- 检查 API Key 和 VEID 是否正确
- 确认搬瓦工账户状态正常

## 常见问题

### 如何获取搬瓦工 API Key？
1. 登录 [搬瓦工 Client Area](https://bwh88.net/clientarea.php)
2. 在左侧菜单选择 "Services" -> "My Services"
3. 点击你的 VPS
4. 在 "KiwiVM Control Panel" 页面找到 "API" 部分
5. 复制 API Key 和 VEID

### 提醒功能不工作？
- 确认 KV Namespace 已创建并正确配置
- 检查 Cron Trigger 是否正常运行
- 查看 Worker 日志：`npx wrangler tail`

### 如何添加更多功能？
1. Fork 本项目
2. 在 `src/handlers/` 添加新的处理器
3. 在 `src/index.ts` 中注册命令
4. 更新 `setCommands` 端点中的命令列表

## 贡献

欢迎提交 Pull Request 或 Issue！

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 致谢

- [Cloudflare Workers](https://workers.cloudflare.com/) - 提供免费的无服务器计算平台
- [Telegram Bot API](https://core.telegram.org/bots/api) - 强大的 Bot 开发平台
- [Frankfurter API](https://www.frankfurter.app/) - 免费的汇率数据 API
