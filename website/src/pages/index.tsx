import type {ReactNode} from 'react';
import {useEffect, useMemo, useState} from 'react';

import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './index.module.css';

type ReleaseState = {
  tagName: string;
  publishedAt: string;
  assetCount: number;
  url: string;
  live: boolean;
};

type LocaleContent = {
  metaTitle: string;
  metaDescription: string;
  pageEyebrow: string;
  heroTitle: string;
  heroSummary: string;
  heroButtons: {
    docs: string;
    releases: string;
    repo: string;
  };
  sidebarTitle: string;
  sidebarSummary: string;
  anchorLabels: Array<{href: string; label: string}>;
  repoTitle: string;
  repoSummary: string;
  repoButtons: {
    repo: string;
    release: string;
  };
  releaseCardTitle: string;
  releaseCardSummary: string;
  releaseLive: string;
  releaseFallback: string;
  releaseMetrics: {
    version: string;
    published: string;
    assets: string;
  };
  stats: Array<{value: string; label: string}>;
  sectionLabels: {
    quickstart: string;
    docs: string;
    downloads: string;
  };
  quickstartTitle: string;
  quickstartSummary: string;
  quickstartSteps: string[];
  routesTitle: string;
  routesSummary: string;
  routes: Array<{title: string; items: string[]}>;
  docsTitle: string;
  docsSummary: string;
  docCards: Array<{title: string; description: string; to: string; cta: string}>;
  librariesTitle: string;
  librariesSummary: string;
  libraryLinks: Array<{label: string; href: string}>;
  downloadsTitle: string;
  downloadsSummary: string;
  platformCards: Array<{title: string; description: string}>;
  versionLabel: (version: string) => string;
  releaseSummary: (version: string) => string;
  assetLabel: (count: number) => string;
};

const contentByLocale: Record<string, LocaleContent> = {
  en: {
    metaTitle: 'Suora docs portal',
    metaDescription: 'Docusaurus-powered GitHub Pages portal for Suora with English-only pages, language buttons, and a prominent GitHub repo entry.',
    pageEyebrow: 'GitHub Pages · Docusaurus · React + MDX',
    heroTitle: 'A polished front door for the Suora AI workbench.',
    heroSummary:
      'This GitHub Pages site is now built with Docusaurus, uses single-language pages, and keeps the GitHub repository visible from the first glance. The layout borrows the documentation-first rhythm of turbo-broccoli while staying tailored to Suora.',
    heroButtons: {
      docs: 'Open docs',
      releases: 'Latest release',
      repo: 'View repository',
    },
    sidebarTitle: 'On this page',
    sidebarSummary:
      'A documentation-portal layout with one language per page, sticky navigation, and fast paths to releases and repository sources.',
    anchorLabels: [
      {href: '#overview', label: 'Overview'},
      {href: '#quickstart', label: 'Quick start'},
      {href: '#docs', label: 'Docs'},
      {href: '#downloads', label: 'Downloads'},
    ],
    repoTitle: 'GitHub repository',
    repoSummary:
      'Use the repo as the source of truth for code, release notes, issues, and the long-form markdown document set.',
    repoButtons: {
      repo: 'Open repo',
      release: 'Open releases',
    },
    releaseCardTitle: 'Live release status',
    releaseCardSummary:
      'The homepage keeps a bundled fallback snapshot, then refreshes from GitHub Releases at runtime.',
    releaseLive: 'Live release data loaded from GitHub.',
    releaseFallback:
      'Live release data is temporarily unavailable, so the bundled release snapshot is shown instead.',
    releaseMetrics: {
      version: 'Current tag',
      published: 'Published',
      assets: 'Assets',
    },
    stats: [
      {value: '10', label: 'top-level workbench areas'},
      {value: '2', label: 'homepage locales'},
      {value: 'React + MDX', label: 'Pages implementation'},
      {value: 'GitHub Pages', label: 'Deployment target'},
    ],
    sectionLabels: {
      quickstart: 'Start here',
      docs: 'Documentation',
      downloads: 'Releases',
    },
    quickstartTitle: 'Get into the right path fast.',
    quickstartSummary:
      'Use the shortest route for installation, workbench orientation, or deeper implementation reading.',
    quickstartSteps: [
      'Download the newest Windows, macOS, or Linux build from GitHub Releases.',
      'Configure at least one provider or local model endpoint in the Models module.',
      'Pick Chat, Documents, Pipelines, or Timer based on the workflow you want to explore first.',
    ],
    routesTitle: 'Current workbench shape',
    routesSummary:
      'Suora is a multi-surface desktop workbench, not a single-chat shell. These modules are already first-class product areas.',
    routes: [
      {title: 'Interaction layer', items: ['Chat', 'Models', 'Agents', 'Settings']},
      {title: 'Knowledge + automation', items: ['Documents', 'Skills', 'Pipeline', 'Timer']},
      {title: 'External connectivity', items: ['Channels', 'MCP', 'Releases']},
    ],
    docsTitle: 'Curated documentation paths',
    docsSummary:
      'The Docusaurus layer gives GitHub Pages a cleaner reading flow while linking out to the longer repository-backed manuals when needed.',
    docCards: [
      {title: 'Getting started', description: 'Install flow, first launch sequence, and the fastest way to orient yourself.', to: '/docs/intro', cta: 'Read guide'},
      {title: 'Workbench map', description: 'A concise map of modules, routes, and the product surface shipping today.', to: '/docs/workbench-map', cta: 'Explore map'},
      {title: 'Docs library', description: 'Direct links to README, feature reference, technical docs, and user guides.', to: '/docs/docs-library', cta: 'Open library'},
      {title: 'Downloads', description: 'Release channels, package formats, and platform-specific installation notes.', to: '/docs/downloads', cta: 'See downloads'},
    ],
    librariesTitle: 'Repository-backed references',
    librariesSummary:
      'When you need the complete markdown set, jump straight to the source documents in GitHub.',
    libraryLinks: [
      {label: 'README', href: 'https://github.com/fandych/suora/blob/main/README.md'},
      {label: 'FEATURES.md', href: 'https://github.com/fandych/suora/blob/main/FEATURES.md'},
      {label: 'Technical docs (EN)', href: 'https://github.com/fandych/suora/blob/main/docs/technical/TECHNICAL_DOC_EN.md'},
      {label: 'User guide (EN)', href: 'https://github.com/fandych/suora/blob/main/docs/user/USER_GUIDE_EN.md'},
      {label: 'Technical docs (ZH)', href: 'https://github.com/fandych/suora/blob/main/docs/technical/TECHNICAL_DOC_ZH.md'},
      {label: 'User guide (ZH)', href: 'https://github.com/fandych/suora/blob/main/docs/user/USER_GUIDE_ZH.md'},
    ],
    downloadsTitle: 'Release-ready download flow',
    downloadsSummary:
      'GitHub Pages now acts like a release foyer: documentation first, package decisions second, repository entry always visible.',
    platformCards: [
      {title: 'Windows', description: 'Installer and portable release assets are published from GitHub Releases.'},
      {title: 'macOS', description: 'DMG and ZIP packages are listed in every tagged release build.'},
      {title: 'Linux', description: 'AppImage, DEB, and RPM packages are linked from the latest release page.'},
    ],
    versionLabel: (version) => `Open ${version}`,
    releaseSummary: (version) => `Download packages from ${version}.`,
    assetLabel: (count) => `${count} ${count === 1 ? 'file' : 'files'}`,
  },
  zh: {
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
  },
};

function GitHubIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-1.95c-3.2.7-3.88-1.36-3.88-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.69.08-.69 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.53-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.18 1.18A10.96 10.96 0 0 1 12 6.05c.97 0 1.95.13 2.86.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.77.11 3.06.74.81 1.18 1.83 1.18 3.09 0 4.43-2.69 5.41-5.25 5.69.41.35.77 1.03.77 2.08v3.08c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function HomePageReleaseCard({copy, version, latestReleaseUrl}: {copy: LocaleContent; version: string; latestReleaseUrl: string}): ReactNode {
  const [release, setRelease] = useState<ReleaseState>({
    tagName: `v${version}`,
    publishedAt: version,
    assetCount: 0,
    url: latestReleaseUrl,
    live: false,
  });

  const locale = copy === contentByLocale.zh ? 'zh-CN' : 'en-US';

  useEffect(() => {
    let cancelled = false;

    async function hydrateRelease() {
      try {
        const response = await fetch('https://api.github.com/repos/fandych/suora/releases/latest', {
          headers: {Accept: 'application/vnd.github+json'},
        });

        if (!response.ok) {
          throw new Error(
            `GitHub release request failed with ${response.status} ${response.statusText}`,
          );
        }

        const latestRelease = (await response.json()) as {
          tag_name?: string;
          html_url?: string;
          published_at?: string;
          created_at?: string;
          assets?: Array<unknown>;
        };

        if (cancelled) {
          return;
        }

        setRelease({
          tagName: latestRelease.tag_name || `v${version}`,
          publishedAt: latestRelease.published_at || latestRelease.created_at || version,
          assetCount: Array.isArray(latestRelease.assets) ? latestRelease.assets.length : 0,
          url: latestRelease.html_url || latestReleaseUrl,
          live: true,
        });
      } catch (error) {
        if (!cancelled) {
          setRelease((current) => ({...current, live: false}));
        }
        console.error(error);
      }
    }

    void hydrateRelease();

    return () => {
      cancelled = true;
    };
  }, [latestReleaseUrl, version]);

  const publishedLabel = useMemo(() => {
    const parsed = new Date(release.publishedAt);
    if (Number.isNaN(parsed.getTime())) {
      return release.publishedAt;
    }

    return new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(parsed);
  }, [locale, release.publishedAt]);

  return (
    <article className={styles.releasePanel}>
      <div className={styles.releasePanelHeader}>
        <span className={styles.panelTag}>{copy.sectionLabels.downloads}</span>
        <h2>{copy.releaseCardTitle}</h2>
      </div>
      <p className={styles.releaseCopy}>{copy.releaseCardSummary}</p>
      <div className={styles.releaseMetrics}>
        <div>
          <span>{copy.releaseMetrics.version}</span>
          <strong>{release.tagName}</strong>
        </div>
        <div>
          <span>{copy.releaseMetrics.published}</span>
          <strong>{publishedLabel}</strong>
        </div>
        <div>
          <span>{copy.releaseMetrics.assets}</span>
          <strong>{copy.assetLabel(release.assetCount)}</strong>
        </div>
      </div>
      <p className={styles.releaseStatus}>{release.live ? copy.releaseLive : copy.releaseFallback}</p>
      <div className={styles.releaseActions}>
        <a className={styles.primaryAction} href={release.url} target="_blank" rel="noopener noreferrer">
          {copy.versionLabel(release.tagName)}
        </a>
        <span className={styles.releaseSummary}>{copy.releaseSummary(release.tagName)}</span>
      </div>
    </article>
  );
}

export default function Home(): ReactNode {
  const {i18n, siteConfig} = useDocusaurusContext();
  const locale = i18n.currentLocale === 'zh' ? 'zh' : 'en';
  const copy = contentByLocale[locale];
  const customFields = siteConfig.customFields as {
    appVersion?: string;
    repoUrl?: string;
    latestReleaseUrl?: string;
  };
  const version = customFields.appVersion || '0.1.6';
  const repoUrl = customFields.repoUrl || 'https://github.com/fandych/suora';
  const latestReleaseUrl = customFields.latestReleaseUrl || `${repoUrl}/releases/latest`;

  return (
    <Layout title={copy.metaTitle} description={copy.metaDescription}>
      <main className={styles.page}>
        <div className={styles.shell}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <span className={styles.panelTag}>{copy.pageEyebrow}</span>
              <h2>{copy.sidebarTitle}</h2>
              <p>{copy.sidebarSummary}</p>
              <nav className={styles.anchorNav}>
                {copy.anchorLabels.map((item) => (
                  <a key={item.href} href={item.href}>
                    <span>{item.label}</span>
                    <span>↓</span>
                  </a>
                ))}
              </nav>
            </div>
            <div className={styles.sidebarCard}>
              <div className={styles.repoBlock}>
                <span className={styles.repoLabel}>
                  <GitHubIcon />
                  {copy.repoTitle}
                </span>
                <code>github.com/fandych/suora</code>
              </div>
              <p>{copy.repoSummary}</p>
              <div className={styles.sidebarActions}>
                <a href={repoUrl} target="_blank" rel="noopener noreferrer">
                  {copy.repoButtons.repo}
                </a>
                <a href={latestReleaseUrl} target="_blank" rel="noopener noreferrer">
                  {copy.repoButtons.release}
                </a>
              </div>
            </div>
          </aside>

          <div className={styles.content}>
            <section className={styles.heroCard} id="overview">
              <div className={styles.heroCopy}>
                <span className={styles.heroEyebrow}>{copy.pageEyebrow}</span>
                <h1>{copy.heroTitle}</h1>
                <p>{copy.heroSummary}</p>
                <div className={styles.heroActions}>
                  <Link className={styles.primaryAction} to="/docs/intro">
                    {copy.heroButtons.docs}
                  </Link>
                  <a className={styles.secondaryAction} href={latestReleaseUrl} target="_blank" rel="noopener noreferrer">
                    {copy.heroButtons.releases}
                  </a>
                  <a className={styles.ghostAction} href={repoUrl} target="_blank" rel="noopener noreferrer">
                    <GitHubIcon />
                    {copy.heroButtons.repo}
                  </a>
                </div>
                <div className={styles.statRow}>
                  {copy.stats.map((item) => (
                    <div key={item.label} className={styles.statCard}>
                      <strong>{item.value}</strong>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <HomePageReleaseCard copy={copy} version={version} latestReleaseUrl={latestReleaseUrl} />
            </section>

            <section className={styles.sectionBlock} id="quickstart">
              <div className={styles.sectionHeader}>
                <span className={styles.panelTag}>{copy.sectionLabels.quickstart}</span>
                <h2>{copy.quickstartTitle}</h2>
                <p>{copy.quickstartSummary}</p>
              </div>
              <div className={styles.gridTwo}>
                <article className={styles.contentCard}>
                  <h3>{copy.quickstartTitle}</h3>
                  <ol className={styles.stepList}>
                    {copy.quickstartSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </article>
                <article className={styles.contentCard}>
                  <h3>{copy.routesTitle}</h3>
                  <p>{copy.routesSummary}</p>
                  <div className={styles.routeGroups}>
                    {copy.routes.map((group) => (
                      <div key={group.title} className={styles.routeGroup}>
                        <strong>{group.title}</strong>
                        <div className={styles.routeChips}>
                          {group.items.map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </section>

            <section className={styles.sectionBlock} id="docs">
              <div className={styles.sectionHeader}>
                <span className={styles.panelTag}>{copy.sectionLabels.docs}</span>
                <h2>{copy.docsTitle}</h2>
                <p>{copy.docsSummary}</p>
              </div>
              <div className={styles.docCardGrid}>
                {copy.docCards.map((card) => (
                  <Link key={card.title} className={styles.docCard} to={card.to}>
                    <div>
                      <h3>{card.title}</h3>
                      <p>{card.description}</p>
                    </div>
                    <span>{card.cta}</span>
                  </Link>
                ))}
              </div>
              <article className={styles.contentCard}>
                <h3>{copy.librariesTitle}</h3>
                <p>{copy.librariesSummary}</p>
                <div className={styles.libraryGrid}>
                  {copy.libraryLinks.map((item) => (
                    <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer">
                      <span>{item.label}</span>
                      <span>↗</span>
                    </a>
                  ))}
                </div>
              </article>
            </section>

            <section className={styles.sectionBlock} id="downloads">
              <div className={styles.sectionHeader}>
                <span className={styles.panelTag}>{copy.sectionLabels.downloads}</span>
                <h2>{copy.downloadsTitle}</h2>
                <p>{copy.downloadsSummary}</p>
              </div>
              <div className={styles.downloadGrid}>
                {copy.platformCards.map((card) => (
                  <article key={card.title} className={styles.downloadCard}>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </Layout>
  );
}
