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

- `NOTION_TOKEN`
- `NOTION_TRAINING_DATA_SOURCE_ID`
- `NOTION_EXERCISE_DATA_SOURCE_ID`
- `AI_PROVIDER=deepseek | glm`
- 对应 provider 的 `*_BASE_URL`、`*_API_KEY`、`*_MODEL`

未配置 Notion 时，`GET /api/workout/today` 会返回本地 A/B/C 容灾计划；容灾模式不会伪造 Notion 写入成功。未配置 AI 时，聊天接口返回可恢复的 503，主 App 继续工作。

AI 教练只接收前端提供的今日训练与当前草稿上下文。`/api/ai/chat` 不导入 Notion 客户端、不持有任意数据库查询工具，也不允许修改未来计划或删除记录。

## 验证

```bash
npm test
npm run build
```

GitHub Pages workflow 暂时保留；只有 Vercel Preview 和 Production 均验证通过后才应停用。
