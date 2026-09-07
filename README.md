# Keep Fit

React + TypeScript + Vite 健身训练 PWA。正式部署目标为 Vercel，训练计划与已完成记录以 Notion 为正式数据源；localStorage 仅保存当天草稿、UI 缓存和离线容灾数据。

## 本地运行

```bash
npm install
npm run dev
```

Vite 自身只提供前端开发服务器。需要同时调试 `/api/*` 时，请先登录并关联正式的 `mkshi77/keep-fit` Vercel 项目，再运行：

```bash
vercel link
vercel env pull .env.local
vercel dev
```

## 环境变量

将 `.env.example` 中的变量配置到 Vercel。`NOTION_TOKEN`、`DEEPSEEK_API_KEY` 和 `GLM_API_KEY` 都是 server-only secret，禁止使用 `VITE_` 前缀或提交到 Git。

- `APP_ACCESS_PASSWORD`
- `NOTION_TOKEN`
- `NOTION_TRAINING_DATA_SOURCE_ID`
- `NOTION_EXERCISE_DATA_SOURCE_ID`
- `AI_PROVIDER=deepseek | glm`
- 对应 provider 的 `*_BASE_URL`、`*_API_KEY`、`*_MODEL`

未配置 Notion 时，`GET /api/workout/today` 会返回本地 A/B/C 容灾计划；容灾模式不会伪造 Notion 写入成功。未配置 AI 时，聊天接口返回可恢复的 503，主 App 继续工作。

## 访问与安全

`APP_ACCESS_PASSWORD` 是应用级访问密码。未配置时受保护接口会返回 503（fail closed），不会公开暴露训练数据。登录成功后，服务端设置 HttpOnly、SameSite=Strict 的 30 天会话 Cookie；`GET /api/workout/today`、`POST /api/workout/complete` 和 `/api/ai/*` 都要求有效会话，浏览器同源检查继续作为 CSRF 保护。

AI 聊天接口使用进程内固定窗口限流，默认每个 IP 5 分钟 20 次请求；这是基础滥用保护，多实例部署时可在平台层再加更严格的限额。

`POST /api/workout/complete` 支持可选的 `submissionId`。服务端会把提交 ID 写入 Notion 的 rich-text 属性（推荐命名 `提交ID`，也兼容 `Submission ID` 或 `submission_id`）；重复提交时，如果计划行已带有同一 ID，就跳过该动作写回。动作完成状态由服务端按计划组数重新计算为 `completed`、`partial` 或 `skipped`，只有 `completed` 会置为 Notion 的 `完成=true`。


AI 教练只接收前端提供的今日训练与当前草稿上下文。`/api/ai/chat` 不导入 Notion 客户端、不持有任意数据库查询工具，也不允许修改未来计划或删除记录。

## 验证

```bash
npm test
npm run build
```

GitHub Pages workflow 已移除；Vercel 是唯一正式部署目标。
