# SUORA 文档站

独立的 GitHub Pages 文档站，使用 Vite、React、MDX、Tailwind CSS 与 shadcn/ui 构建。

## 本地开发

```bash
npm ci
npm run dev
```

## 检查与构建

```bash
npm run lint
npm run type-check
npm run build
```

## 内容与路由

- `src/pages/user/`：用户文档。
- `src/pages/technical/`：技术文档。
- `src/lib/docs-navigation.ts`：侧边栏文档导航。
- `src/App.tsx`：BrowserRouter 页面注册。

文档地址统一使用 `/doc/...`，例如 `/doc/chat/overview`。构建会生成 `dist/404.html`，让 GitHub Pages 在刷新深层 URL 时回退到应用入口。
