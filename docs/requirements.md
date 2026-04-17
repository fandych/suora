# Suora — 产品需求文档 (PRD)

> 版本: v0.1  
> 最后更新: 2026-03-24  
> 状态: 草稿

---

## 1. 项目概览

Suora 是一款基于 Electron + React 的 AI 桌面客户端，支持多模型、多 Agent、技能系统、定时任务与插件扩展。设计目标是成为开发者与知识工作者的"本地 AI 工作台"。

---

## 2. 整体布局 — 三列模式

```
┌─────────┬──────────────────┬──────────────────────────────────────┐
│  Nav    │  Side Panel      │  Main Content                        │
│  (60px) │  (240px)         │  (flex-1)                            │
│         │                  │                                      │
│  Logo   │  根据当前模块动态  │  根据当前模块动态渲染主体内容            │
│  ─────  │  渲染侧边内容      │                                      │
│  Chat   │                  │                                      │
│  Timer  │                  │                                      │
│  Agents │                  │                                      │
│  Skills │                  │                                      │
│  Models │                  │                                      │
│  ─────  │                  │                                      │
│ Settings│                  │                                      │
└─────────┴──────────────────┴──────────────────────────────────────┘
```

### 2.1 第一列 — 导航栏 (Nav Bar)

| 位置 | 元素 | 说明 |
|------|------|------|
| 顶部 | **Logo** | 应用图标 + 名称缩写，点击返回主页 |
| 中部 | **Chat** | 对话模块入口，图标：消息气泡 |
| 中部 | **Timer** | 定时任务/调度模块，图标：时钟 |
| 中部 | **Agents** | Agent 管理模块，图标：机器人/用户组 |
| 中部 | **Skills** | 技能库模块，图标：扳手/闪电 |
| 中部 | **Models** | 模型管理模块，图标：芯片/大脑 |
| 底部 | **Settings** | 全局设置，图标：齿轮 |

- 默认宽度 **60px**（图标模式），hover 可展开显示文字标签（可选）
- 当前激活模块高亮显示
- 使用 `activeModule` 全局状态控制当前视图

---

## 3. 模块详情

### 3.1 Chat 模块

**布局：第二列 = 会话列表，第三列 = 聊天主区**

```
┌─────────┬──────────────────┬──────────────────────────────────────┐
│  Nav    │  Sessions        │  Chat Main                           │
│         │  ──────────────  │  ┌──────────────────────────────┐    │
│  [Chat] │  + 新建对话       │  │  Agent: Claude / GPT-4o     │    │
│         │  ──────────────  │  │  Model: claude-3-opus        │    │
│         │  ● 今天           │  └──────────────────────────────┘    │
│         │    会话 1         │                                      │
│         │    会话 2         │  ┌──────────────────────────────┐    │
│         │  ○ 昨天           │  │  消息区域（滚动）              │    │
│         │    会话 3         │  │  user: ...                   │    │
│         │                  │  │  assistant: ...              │    │
│         │                  │  └──────────────────────────────┘    │
│         │                  │                                      │
│         │                  │  ┌──────────────────────────────┐    │
│         │                  │  │  输入框 + 发送按钮             │    │
│         │                  │  └──────────────────────────────┘    │
└─────────┴──────────────────┴──────────────────────────────────────┘
```

#### 3.1.1 第二列 — Sessions 会话列表

| 元素 | 交互 | 说明 |
|------|------|------|
| **新建对话** 按钮 | 点击 | 创建新 Session，自动生成标题 |
| 会话列表项 | 点击选中 | 按日期分组（今天 / 昨天 / 更早） |
| 会话标题 | 双击编辑 | 默认取第一条消息前 20 字 |
| 右键菜单 | 右键 | 重命名 / 删除 / 导出 |
| 搜索框 | 顶部 | 按关键词搜索历史会话 |

数据结构：
```typescript
interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  agentId?: string        // 绑定的 Agent
  modelId?: string        // 使用的模型
  messages: Message[]
}
```

#### 3.1.2 第三列 — Chat Main 聊天主区

| 区域 | 说明 |
|------|------|
| **顶部工具栏** | 显示当前 Agent 名称 + 模型名称；支持切换 |
| **消息气泡区** | 用户消息靠右，AI 消息靠左；支持 Markdown 渲染 |
| **流式输出** | AI 回复实时流式显示，显示 "thinking..." 状态 |
| **底部输入区** | 多行文本框，Enter 发送，Shift+Enter 换行 |
| **附件/工具按钮** | 上传文件（未来扩展）、清空对话 |

消息渲染要求：
- Markdown 支持（代码高亮、表格、列表）
- 代码块显示复制按钮
- AI 消息显示模型标签和 token 用量（可折叠）
- 支持消息操作：复制、重新生成、删除

---

### 3.2 Timer 定时任务模块

**布局：第二列 = 任务列表，第三列 = 任务详情/编辑**

```
┌─────────┬──────────────────┬──────────────────────────────────────┐
│  Nav    │  Task List       │  Task Editor                         │
│         │  + 新建任务       │                                      │
│ [Timer] │  ──────────────  │  任务名称: ___________________        │
│         │  ✅ 每日报告      │  执行计划: [Cron 表达式 或 可视化]     │
│         │  ⏸ 周报生成      │  触发动作: [选择 Agent / Skill]        │
│         │  ✅ 数据同步      │  提示词模板: ___________________       │
│         │                  │  状态: 启用 / 禁用                    │
│         │                  │  上次运行: 2026-03-23 09:00          │
│         │                  │  下次运行: 2026-03-24 09:00          │
└─────────┴──────────────────┴──────────────────────────────────────┘
```

数据结构（已有 `ScheduledTask` in types/index.ts）：
```typescript
interface ScheduledTask {
  id: string
  name: string
  schedule: string    // cron 表达式，如 "0 9 * * *"
  action: string      // agentId 或 skillId
  prompt?: string     // 执行时注入的提示词
  enabled: boolean
  lastRun?: number
  nextRun?: number
}
```

---

### 3.3 Agents 模块

**布局：第二列 = Agent 列表，第三列 = Agent 配置**

```
┌─────────┬──────────────────┬──────────────────────────────────────┐
│  Nav    │  Agents          │  Agent Config                        │
│         │  + 新建 Agent    │                                      │
│[Agents] │  ──────────────  │  名称: ___________________________    │
│         │  🤖 助理 A       │  头像: [选择图标/颜色]                 │
│         │  🤖 代码专家     │  绑定模型: [模型选择器]                │
│         │  🤖 写作助手     │  系统提示词:                          │
│         │                  │  ┌─────────────────────────────┐    │
│         │                  │  │  You are a helpful ...      │    │
│         │                  │  └─────────────────────────────┘    │
│         │                  │  技能 (Skills): [多选]                │
│         │                  │  温度 (Temperature): [0.0 ~ 2.0]    │
│         │                  │  最大 Token: [输入框]                 │
└─────────┴──────────────────┴──────────────────────────────────────┘
```

数据结构（已有 `Agent` in appStore.ts，扩展如下）：
```typescript
interface Agent {
  id: string
  name: string
  avatar?: string           // emoji 或颜色标识
  systemPrompt: string
  modelId: string           // 绑定的模型
  skills: string[]          // skill IDs
  temperature?: number      // 0.0 ~ 2.0，默认 0.7
  maxTokens?: number        // 默认 4096
  enabled: boolean
}
```

---

### 3.4 Skills 模块

**布局：第二列 = 技能列表，第三列 = 技能详情/配置**

```
┌─────────┬──────────────────┬──────────────────────────────────────┐
│  Nav    │  Skills          │  Skill Detail                        │
│         │  + 添加技能      │                                      │
│[Skills] │  ──────────────  │  名称: ___________________________    │
│         │  🔧 Web Search   │  描述: ___________________________    │
│         │  🔧 代码执行     │  类型: [内置 / 自定义 / 插件]          │
│         │  🔧 文件读写     │  配置参数:                            │
│         │  🔧 图像识别     │    API Key: ___________________       │
│         │                  │    端点: ___________________          │
│         │                  │  状态: [启用 / 禁用]                  │
│         │                  │  测试: [运行测试]                     │
└─────────┴──────────────────┴──────────────────────────────────────┘
```

内置技能规划：

| 技能 ID | 名称 | 说明 |
|---------|------|------|
| `web-search` | Web 搜索 | 调用搜索引擎获取实时信息 |
| `code-exec` | 代码执行 | 执行 Python/JS 代码片段 |
| `file-read` | 文件读取 | 读取本地文件内容 |
| `image-ocr` | 图像识别 | 对图片进行 OCR 或描述 |
| `clipboard` | 剪贴板 | 读写系统剪贴板 |

---

### 3.5 Models 模块

**布局：第二列 = 模型列表，第三列 = 模型配置**

```
┌─────────┬──────────────────┬──────────────────────────────────────┐
│  Nav    │  Models          │  Model Config                        │
│         │  + 添加模型      │                                      │
│[Models] │  ──────────────  │  提供商: [Anthropic / OpenAI / ...]  │
│         │  ◉ claude-3-opus │  模型 ID: claude-3-5-sonnet-latest   │
│         │  ○ gpt-4o        │  显示名称: Claude 3.5 Sonnet         │
│         │  ○ gemini-pro    │  API Key: **********************      │
│         │                  │  Base URL (可选): _________________   │
│         │                  │  [测试连接]  [设为默认]               │
└─────────┴──────────────────┴──────────────────────────────────────┘
```

支持的供应商：

| 供应商 | 包 | 示例模型 |
|--------|-----|---------|
| Anthropic | `@ai-sdk/anthropic` | claude-3-5-sonnet, claude-3-opus |
| OpenAI | `@ai-sdk/openai` | gpt-4o, gpt-4-turbo, o1 |
| Google | `@ai-sdk/google` | gemini-2.0-flash, gemini-pro |
| Ollama | `ollama-ai-provider` | llama3, mistral（本地） |
| 自定义 | `@ai-sdk/openai-compatible` | 任意 OpenAI 兼容接口 |

---

### 3.6 Settings 模块

**布局：第二列 = 设置分类，第三列 = 设置内容**

```
┌─────────┬──────────────────┬──────────────────────────────────────┐
│  Nav    │  Settings        │  General Settings                    │
│         │  ──────────────  │                                      │
│[Settings│  通用            │  主题: [深色 / 浅色 / 跟随系统]        │
│         │  外观            │  语言: [中文 / English]               │
│         │  快捷键          │  启动时: [显示上次窗口 / 新建对话]      │
│         │  数据管理        │  自动保存: [开 / 关]                   │
│         │  插件            │  历史保留天数: [30 天]                 │
│         │  关于            │                                      │
└─────────┴──────────────────┴──────────────────────────────────────┘
```

设置分类详情：

#### 通用 (General)
- 应用主题（深色/浅色/跟随系统）
- 界面语言
- 启动行为
- 自动保存对话

#### 外观 (Appearance)
- 字体大小（小/中/大）
- 代码字体
- 气泡样式

#### 快捷键 (Shortcuts)
- 新建对话：`Ctrl/Cmd + N`
- 搜索：`Ctrl/Cmd + K`
- 发送消息：`Enter`
- 换行：`Shift + Enter`
- 切换模块：`Ctrl/Cmd + 1~6`

#### 数据管理 (Data)
- 导出全部对话（JSON）
- 清空历史记录
- 导入数据

#### 插件 (Plugins)
- WeChat 集成
- Feishu 集成
- 自定义 Webhook

---

## 4. 全局状态设计

在现有 `appStore.ts` 基础上扩展：

```typescript
interface AppStore {
  // 当前激活的模块
  activeModule: 'chat' | 'timer' | 'agents' | 'skills' | 'models' | 'settings'
  setActiveModule: (module: ActiveModule) => void

  // Sessions（Chat 模块）
  sessions: Session[]
  activeSessionId: string | null
  addSession: (session: Session) => void
  updateSession: (id: string, data: Partial<Session>) => void
  removeSession: (id: string) => void
  setActiveSession: (id: string) => void

  // 扩展现有 Models（增加 apiKey 绑定）
  // 扩展现有 Agents（增加 modelId, avatar, temperature）
  // 扩展现有 Skills（增加类型字段）
  // 扩展 ScheduledTask（增加 prompt 字段）
}
```

---

## 5. 路由 & 导航

不使用 React Router，改用全局 `activeModule` state 控制视图切换（SPA 单视图切换）。

```
activeModule = 'chat'    → 渲染 ChatLayout
activeModule = 'timer'   → 渲染 TimerLayout
activeModule = 'agents'  → 渲染 AgentsLayout
activeModule = 'skills'  → 渲染 SkillsLayout
activeModule = 'models'  → 渲染 ModelsLayout
activeModule = 'settings'→ 渲染 SettingsLayout
```

每个 Layout 组件结构：
```
<ModuleLayout>
  <SidePanel />       {/* 第二列 */}
  <MainContent />     {/* 第三列 */}
</ModuleLayout>
```

---

## 6. 组件目录结构规划

```
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx          # 三列主框架
│   │   ├── NavBar.tsx            # 第一列导航
│   │   ├── SidePanel.tsx         # 第二列（通用容器）
│   │   └── MainContent.tsx       # 第三列（通用容器）
│   │
│   ├── chat/
│   │   ├── ChatLayout.tsx        # Chat 模块布局
│   │   ├── SessionList.tsx       # 会话列表
│   │   ├── SessionItem.tsx       # 单个会话条目
│   │   ├── ChatMain.tsx          # 聊天主区
│   │   ├── MessageBubble.tsx     # 消息气泡
│   │   └── ChatInput.tsx         # 输入区
│   │
│   ├── timer/
│   │   ├── TimerLayout.tsx
│   │   ├── TaskList.tsx
│   │   └── TaskEditor.tsx
│   │
│   ├── agents/
│   │   ├── AgentsLayout.tsx
│   │   ├── AgentList.tsx
│   │   └── AgentEditor.tsx
│   │
│   ├── skills/
│   │   ├── SkillsLayout.tsx
│   │   ├── SkillList.tsx
│   │   └── SkillDetail.tsx
│   │
│   ├── models/
│   │   ├── ModelsLayout.tsx
│   │   ├── ModelList.tsx
│   │   └── ModelEditor.tsx
│   │
│   └── settings/
│       ├── SettingsLayout.tsx
│       ├── SettingsNav.tsx
│       └── sections/
│           ├── GeneralSettings.tsx
│           ├── AppearanceSettings.tsx
│           ├── ShortcutSettings.tsx
│           ├── DataSettings.tsx
│           └── PluginSettings.tsx
│
├── store/
│   └── appStore.ts               # 扩展现有 store
│
├── services/
│   ├── aiService.ts              # 现有 AI 服务
│   └── timerService.ts           # 定时任务调度
│
├── hooks/
│   ├── useAIChat.ts              # 现有 hook
│   ├── useSession.ts             # 会话管理
│   └── useKeyboard.ts            # 全局快捷键
│
└── types/
    └── index.ts                  # 扩展现有类型
```

---

## 7. 设计规范

### 颜色系统

| Token | 值 | 用途 |
|-------|-----|------|
| `bg-primary` | `slate-900` | 主背景（nav bar）|
| `bg-secondary` | `slate-800` | 次背景（side panel）|
| `bg-surface` | `slate-750` | 内容区背景 |
| `bg-card` | `slate-700` | 卡片/消息气泡 |
| `accent` | `blue-500` | 主色调/高亮/CTA |
| `text-primary` | `slate-100` | 主文字 |
| `text-muted` | `slate-400` | 次要文字 |
| `border` | `slate-700` | 分隔线 |

### 尺寸规范

| 元素 | 尺寸 |
|------|------|
| 第一列（Nav）宽度 | 60px |
| 第二列（Side Panel）宽度 | 240px |
| 第三列（Main）| flex-1 |
| Nav 图标大小 | 24px |
| 消息气泡最大宽度 | 75% |
| 输入框高度（初始）| 44px，最大 160px |

### 动效规范
- 模块切换：淡入淡出 150ms
- 侧边栏展开/收起：200ms ease-in-out
- hover 状态：100ms transition
- 消息出现：从下向上 slide-in 200ms

---

## 8. 开发优先级

| 优先级 | 模块 | 说明 |
|--------|------|------|
| P0 | AppShell + NavBar | 三列框架，导航切换 |
| P0 | Chat 模块 | 核心功能，Sessions + ChatMain |
| P1 | Models 模块 | 模型配置，支撑 Chat |
| P1 | Agents 模块 | Agent 创建与管理 |
| P2 | Skills 模块 | 技能库 |
| P2 | Timer 模块 | 定时任务 |
| P3 | Settings 模块 | 全局配置 |

---

## 9. 技术约束

- **Electron 安全性**: 保持 `contextIsolation: true`，所有 Node API 通过 preload IPC 桥接
- **状态持久化**: 使用 `zustand/middleware` 的 `persist` 持久化到 `localStorage` 或 Electron `userData`
- **流式 AI 响应**: 使用 `streamText()` + React `useState` 逐字更新消息
- **定时任务**: 在 Electron 主进程中使用 `node-cron` 触发，通过 IPC 通知渲染进程
- **样式**: 纯 Tailwind CSS v4，不引入 UI 组件库，保持轻量

---

*该文档随开发进展持续更新。*
