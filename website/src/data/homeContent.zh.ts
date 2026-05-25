import type {LocaleContent} from './homeContentTypes';

export const homeContentZh: LocaleContent = {
  metaTitle: 'Suora 文档',
  metaDescription: '面向聊天、文档、Agent、技能、流水线、定时任务、渠道、MCP 和设置的本地优先 AI 工作台文档。',
  pageEyebrow: '本地优先的桌面 AI 工作台',
  heroTitle: 'Suora：把聊天、知识和自动化放进一个桌面工作台。',
  heroSummary:
    '你可以在 Suora 里完成对话、整理本地文档、管理模型和 Agent、编排技能、搭建自动化流程，并连接外部系统，全部都在同一个桌面工作区中完成。',
  heroButtons: {
    docs: '打开文档',
    releases: '最新发布',
    repo: '查看仓库',
  },
  sidebarTitle: '页内导航',
  sidebarSummary:
    '快速跳到产品概览、上手路径、核心文档和下载入口。',
  anchorLabels: [
    {href: '#overview', label: '概览'},
    {href: '#quickstart', label: '快速开始'},
    {href: '#docs', label: '文档'},
    {href: '#downloads', label: '下载'},
  ],
  repoTitle: 'GitHub 仓库',
  repoSummary:
    '代码、Issue、发布说明和完整 Markdown 文档都在 GitHub 仓库中维护。',
  repoButtons: {
    repo: '打开仓库',
    release: '查看发布',
  },
  releaseCardTitle: '最新发布版本',
  releaseCardSummary: '查看最新标签，并下载 Windows、macOS 和 Linux 的打包版本。',
  releaseLive: '已从 GitHub 加载最新发布数据。',
  releaseFallback: '暂时无法获取实时发布数据，当前显示的是页面内置的发布快照。',
  releaseMetrics: {
    version: '当前标签',
    published: '发布时间',
    assets: '资源数量',
  },
  stats: [
    {value: '10', label: '顶层工作台模块'},
    {value: '7', label: '设置分区'},
    {value: '3', label: '桌面平台'},
    {value: 'BYOK + 本地模型', label: '模型策略'},
  ],
  sectionLabels: {
    quickstart: '先从这里开始',
    docs: '文档入口',
    downloads: '发布下载',
  },
  quickstartTitle: '先按最短路径上手。',
  quickstartSummary: '先配好模型，再从最适合你的模块进入，后续再深入看完整文档。',
  quickstartSteps: [
    '先从 GitHub Releases 下载最新的 Windows、macOS 或 Linux 安装包。',
    '打开 Models，配置至少一个模型提供商或本地模型端点。',
    '想先对话就进入 Chat，想整理资料就先进入 Documents。',
    '需要重复执行的流程时，再使用 Pipeline 或 Timer。',
  ],
  routesTitle: '当前工作台结构',
  routesSummary: 'Suora 不是单一聊天壳，而是一个已经包含多个正式模块的桌面工作台。',
  routes: [
    {title: '与 AI 协作', items: ['Chat', 'Models', 'Agents', 'Settings']},
    {title: '知识与自动化', items: ['Documents', 'Skills', 'Pipeline', 'Timer']},
    {title: '连接外部系统', items: ['Channels', 'MCP']},
  ],
  docsTitle: '选择合适的文档入口',
  docsSummary:
    '先看这里的短文档，再按需要跳到仓库里的长篇手册。',
  docCards: [
    {title: '快速开始', description: '首次配置、推荐入口，以及最快的上手顺序。', to: '/docs/intro', cta: '阅读指南'},
    {title: '工作台地图', description: '查看当前模块分组、主要路由和产品范围。', to: '/docs/workbench-map', cta: '查看地图'},
    {title: '文档库', description: '按用途选择用户指南、技术文档、测试说明或渠道说明。', to: '/docs/docs-library', cta: '打开文档库'},
    {title: '下载说明', description: '查看平台安装包、源码运行方式和发布入口。', to: '/docs/downloads', cta: '查看下载'},
  ],
  librariesTitle: 'GitHub 长篇手册',
  librariesSummary: '需要完整参考资料时，可以直接打开仓库里的原始手册。',
  libraryLinks: [
    {label: 'README', href: 'https://github.com/fandych/suora/blob/main/README.md'},
    {label: 'FEATURES.md', href: 'https://github.com/fandych/suora/blob/main/FEATURES.md'},
    {label: 'LLM Wiki 能力参考', href: 'https://github.com/fandych/suora/blob/main/docs/LLM_WIKI_CAPABILITIES.md'},
    {label: '中文技术文档', href: 'https://github.com/fandych/suora/blob/main/docs/technical/TECHNICAL_DOC_ZH.md'},
    {label: '中文用户指南', href: 'https://github.com/fandych/suora/blob/main/docs/user/USER_GUIDE_ZH.md'},
    {label: '英文技术文档', href: 'https://github.com/fandych/suora/blob/main/docs/technical/TECHNICAL_DOC_EN.md'},
    {label: '英文用户指南', href: 'https://github.com/fandych/suora/blob/main/docs/user/USER_GUIDE_EN.md'},
  ],
  downloadsTitle: '下载应用或从源码运行',
  downloadsSummary: '发布页提供各平台安装包，仓库则提供源码运行和开发入口。',
  platformCards: [
    {title: 'Windows', description: '每个版本都会提供安装版和便携版可执行文件。'},
    {title: 'macOS', description: '最新发布中提供 DMG 和 ZIP 两种安装包。'},
    {title: 'Linux', description: '发布页会附带 AppImage、DEB 和 RPM 包。'},
  ],
  versionLabel: (version) => `打开 ${version}`,
  releaseSummary: (version) => `从 ${version} 下载安装包。`,
  assetLabel: (count) => `${count} 个文件`,
};
