import type {LocaleContent} from './homeContentTypes';

export const homeContentEn: LocaleContent = {
  metaTitle: 'Suora documentation',
  metaDescription: 'Local-first AI workbench docs for chat, documents, agents, skills, pipelines, timers, channels, MCP, and settings.',
  pageEyebrow: 'Local-first desktop AI workbench',
  heroTitle: 'Suora for chat, knowledge, and automation.',
  heroSummary:
    'Use Suora to run conversations, organize local documents, manage models and agents, build reusable skills, automate workflows, and connect external systems from one desktop workspace.',
  heroButtons: {
    docs: 'Open docs',
    releases: 'Latest release',
    repo: 'View repository',
  },
  sidebarTitle: 'On this page',
  sidebarSummary:
    'Jump between the product overview, setup path, key guides, and release downloads.',
  anchorLabels: [
    {href: '#overview', label: 'Overview'},
    {href: '#quickstart', label: 'Quick start'},
    {href: '#docs', label: 'Docs'},
    {href: '#downloads', label: 'Downloads'},
  ],
  repoTitle: 'GitHub repository',
  repoSummary:
    'Browse source code, issues, release notes, and the full markdown manuals in GitHub.',
  repoButtons: {
    repo: 'Open repo',
    release: 'Open releases',
  },
  releaseCardTitle: 'Latest packaged release',
  releaseCardSummary:
    'Check the newest tag and download packaged builds for Windows, macOS, and Linux.',
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
    {value: '7', label: 'settings sections'},
    {value: '3', label: 'desktop platforms'},
    {value: 'BYOK + local', label: 'model strategy'},
  ],
  sectionLabels: {
    quickstart: 'Start here',
    docs: 'Documentation',
    downloads: 'Releases',
  },
  quickstartTitle: 'Start with the shortest setup path.',
  quickstartSummary:
    'Set up a provider, open the right module first, and then continue into the guide that matches your workflow.',
  quickstartSteps: [
    'Download the latest Windows, macOS, or Linux build from GitHub Releases.',
    'Open Models and configure at least one provider or local model endpoint.',
    'Start in Chat for conversations or Documents for local notes and context.',
    'Add Pipeline or Timer once you want repeatable automation.',
  ],
  routesTitle: 'Current workbench shape',
  routesSummary:
    'Suora already ships as a multi-module desktop workbench, not a single-chat shell.',
  routes: [
    {title: 'Work with AI', items: ['Chat', 'Models', 'Agents', 'Settings']},
    {title: 'Build knowledge and automation', items: ['Documents', 'Skills', 'Pipeline', 'Timer']},
    {title: 'Connect external systems', items: ['Channels', 'MCP']},
  ],
  docsTitle: 'Choose the right guide',
  docsSummary:
    'Start with the short pages here, then open the longer repository-backed manuals for full workflows and implementation details.',
  docCards: [
    {title: 'Getting started', description: 'First-run setup, module entry points, and the fastest onboarding path.', to: '/docs/intro', cta: 'Read guide'},
    {title: 'Workbench map', description: 'Current routes, module groups, and the product surface shipping today.', to: '/docs/workbench-map', cta: 'Explore map'},
    {title: 'Docs library', description: 'Pick the manual you need for usage, testing, channels, or architecture.', to: '/docs/docs-library', cta: 'Open library'},
    {title: 'Downloads', description: 'Platform packages, source run commands, and release entry points.', to: '/docs/downloads', cta: 'See downloads'},
  ],
  librariesTitle: 'Long-form manuals in GitHub',
  librariesSummary:
    'Open the repository manuals when you need the full reference set.',
  libraryLinks: [
    {label: 'README', href: 'https://github.com/fandych/suora/blob/main/README.md'},
    {label: 'FEATURES.md', href: 'https://github.com/fandych/suora/blob/main/FEATURES.md'},
    {label: 'Technical docs (EN)', href: 'https://github.com/fandych/suora/blob/main/docs/technical/TECHNICAL_DOC_EN.md'},
    {label: 'User guide (EN)', href: 'https://github.com/fandych/suora/blob/main/docs/user/USER_GUIDE_EN.md'},
    {label: 'Technical docs (ZH)', href: 'https://github.com/fandych/suora/blob/main/docs/technical/TECHNICAL_DOC_ZH.md'},
    {label: 'User guide (ZH)', href: 'https://github.com/fandych/suora/blob/main/docs/user/USER_GUIDE_ZH.md'},
  ],
  downloadsTitle: 'Download or run from source',
  downloadsSummary:
    'Releases provide packaged desktop apps, while the repository provides the source workflow for contributors.',
  platformCards: [
    {title: 'Windows', description: 'Use the installer or portable executable attached to each release.'},
    {title: 'macOS', description: 'Download the DMG or ZIP package from the latest tagged release.'},
    {title: 'Linux', description: 'Use the AppImage, DEB, or RPM package published on the release page.'},
  ],
  versionLabel: (version) => `Open ${version}`,
  releaseSummary: (version) => `Download packages from ${version}.`,
  assetLabel: (count) => `${count} ${count === 1 ? 'file' : 'files'}`,
};
