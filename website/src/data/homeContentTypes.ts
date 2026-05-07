export type ReleaseState = {
  tagName: string;
  publishedAt: string;
  assetCount: number;
  url: string;
  live: boolean;
};

export type LocaleContent = {
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
