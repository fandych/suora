import type {LocaleContent} from './homeContentTypes';

export const homeContentEn: LocaleContent = {
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
};
