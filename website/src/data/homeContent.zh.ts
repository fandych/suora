import type {LocaleContent} from './homeContentTypes';

export const homeContentZh: LocaleContent = {
  metaTitle: 'Suora 文档门户',
  metaDescription: '基于 Docusaurus 的 Suora GitHub Pages 门户，页面单语言显示，并通过按钮切换中英文。',
  pageEyebrow: 'GitHub Pages · Docusaurus · React + MDX',
  heroTitle: '给 Suora AI 工作台做一个更好看的文档首页。',
  heroSummary:
    '现在的 GitHub Pages 站点改成了 Docusaurus 构建，页面保持单语言显示，并把 GitHub 仓库入口放在第一视觉。整体节奏参考 turbo-broccoli 的文档门户结构，但版式和内容完全围绕 Suora 重新设计。',
  heroButtons: {
    docs: '打开文档',
    releases: '最新发布',
    repo: '查看仓库',
  },
  sidebarTitle: '页内导航',
  sidebarSummary:
    '每个页面只保留一种语言，保留文档门户的侧边导航感，同时把发布下载和仓库入口放在最近的位置。',
  anchorLabels: [
    {href: '#overview', label: '概览'},
    {href: '#quickstart', label: '快速开始'},
    {href: '#docs', label: '文档'},
    {href: '#downloads', label: '下载'},
  ],
  repoTitle: 'GitHub 仓库',
  repoSummary:
    '代码、发布说明、Issue 和完整 Markdown 文档都以仓库为准，这里保持醒目直达。',
  repoButtons: {
    repo: '打开仓库',
    release: '查看发布',
  },
  releaseCardTitle: '实时发布状态',
  releaseCardSummary: '首页先带一个内置发布快照，再在运行时从 GitHub Releases 刷新。',
  releaseLive: '已从 GitHub 加载最新发布数据。',
  releaseFallback: '暂时无法获取实时发布数据，当前显示的是页面内置的发布快照。',
  releaseMetrics: {
    version: '当前标签',
    published: '发布时间',
    assets: '资源数量',
  },
  stats: [
    {value: '10', label: '顶层工作台模块'},
    {value: '2', label: '首页语言版本'},
    {value: 'React + MDX', label: '页面实现方式'},
    {value: 'GitHub Pages', label: '部署目标'},
  ],
  sectionLabels: {
    quickstart: '先从这里开始',
    docs: '文档入口',
    downloads: '发布下载',
  },
  quickstartTitle: '先走最短路径。',
  quickstartSummary: '不管你是来下载安装、熟悉模块，还是继续读实现文档，都可以从这里快速进入。',
  quickstartSteps: [
    '先从 GitHub Releases 下载最新的 Windows、macOS 或 Linux 安装包。',
    '进入 Models 页面，配置至少一个模型提供商或本地模型端点。',
    '根据你的使用方式，从 Chat、Documents、Pipeline 或 Timer 先开始。',
  ],
  routesTitle: '当前工作台结构',
  routesSummary: 'Suora 不是单一聊天壳，而是一个多模块桌面工作台，下面这些模块都已经是实际产品界面。',
  routes: [
    {title: '交互层', items: ['Chat', 'Models', 'Agents', 'Settings']},
    {title: '知识与自动化', items: ['Documents', 'Skills', 'Pipeline', 'Timer']},
    {title: '外部连接', items: ['Channels', 'MCP', 'Releases']},
  ],
  docsTitle: '整理过的文档路径',
  docsSummary:
    'Docusaurus 这一层主要负责让 GitHub Pages 更像正式文档站，同时继续把读者引导到仓库里的长篇 Markdown 文档。',
  docCards: [
    {title: '快速开始', description: '安装路径、首次启动顺序，以及最快的上手方式。', to: '/docs/intro', cta: '阅读指南'},
    {title: '工作台地图', description: '用更短的方式浏览模块、路由和当前产品范围。', to: '/docs/workbench-map', cta: '查看地图'},
    {title: '文档库', description: '直达 README、功能清单、技术文档和用户指南。', to: '/docs/docs-library', cta: '打开文档库'},
    {title: '下载说明', description: '查看发布渠道、安装包格式和平台安装建议。', to: '/docs/downloads', cta: '查看下载'},
  ],
  librariesTitle: '仓库原始文档',
  librariesSummary: '如果你需要完整 Markdown 文档集，可以直接跳回 GitHub 仓库里的源文件。',
  libraryLinks: [
    {label: 'README', href: 'https://github.com/fandych/suora/blob/main/README.md'},
    {label: 'FEATURES.md', href: 'https://github.com/fandych/suora/blob/main/FEATURES.md'},
    {label: '中文技术文档', href: 'https://github.com/fandych/suora/blob/main/docs/technical/TECHNICAL_DOC_ZH.md'},
    {label: '中文用户指南', href: 'https://github.com/fandych/suora/blob/main/docs/user/USER_GUIDE_ZH.md'},
    {label: '英文技术文档', href: 'https://github.com/fandych/suora/blob/main/docs/technical/TECHNICAL_DOC_EN.md'},
    {label: '英文用户指南', href: 'https://github.com/fandych/suora/blob/main/docs/user/USER_GUIDE_EN.md'},
  ],
  downloadsTitle: '面向发布的下载入口',
  downloadsSummary: 'GitHub Pages 现在更像发布前厅：先看文档，再决定下载包，同时仓库入口始终可见。',
  platformCards: [
    {title: 'Windows', description: '每次 GitHub Releases 都会带安装版和便携版。'},
    {title: 'macOS', description: '每个版本都会提供 DMG 和 ZIP 打包产物。'},
    {title: 'Linux', description: '最新发布页中会列出 AppImage、DEB 和 RPM 包。'},
  ],
  versionLabel: (version) => `打开 ${version}`,
  releaseSummary: (version) => `从 ${version} 下载安装包。`,
  assetLabel: (count) => `${count} 个文件`,
};
