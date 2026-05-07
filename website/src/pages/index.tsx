import type {ReactNode} from 'react';
import {useEffect, useMemo, useState} from 'react';

import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import {homeContentEn} from '../data/homeContent.en';
import {homeContentZh} from '../data/homeContent.zh';
import type {LocaleContent, ReleaseState} from '../data/homeContentTypes';
import styles from './index.module.css';
const contentByLocale: Record<string, LocaleContent> = {
  en: homeContentEn,
  zh: homeContentZh,
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
