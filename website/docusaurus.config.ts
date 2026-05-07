import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const rootPackageJson = JSON.parse(
  readFileSync(path.resolve(configDir, '../package.json'), 'utf8'),
) as {version?: string};

const repoUrl = 'https://github.com/fandych/suora';
const latestReleaseUrl = `${repoUrl}/releases/latest`;
const appVersion = rootPackageJson.version ?? '0.1.6';

const config: Config = {
  title: 'Suora',
  tagline: 'AI workbench docs and release hub',
  favicon: 'img/favicon.ico',
  url: 'https://fandych.github.io',
  baseUrl: '/suora/',
  trailingSlash: false,
  organizationName: 'fandych',
  projectName: 'suora',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  future: {
    v4: true,
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    localeConfigs: {
      en: {
        htmlLang: 'en',
      },
      zh: {
        htmlLang: 'zh-CN',
      },
    },
  },
  customFields: {
    appVersion,
    repoUrl,
    latestReleaseUrl,
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Suora',
      logo: {
        alt: 'Suora logo',
        src: 'img/suora-logo.svg',
      },
      items: [
        {
          type: 'html',
          position: 'right',
          value:
            '<a class="navbar__item navbar__link repo-pill" href="https://github.com/fandych/suora" target="_blank" rel="noopener noreferrer" aria-label="Open the Suora GitHub repository"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-1.95c-3.2.7-3.88-1.36-3.88-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.69.08-.69 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.53-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.18 1.18A10.96 10.96 0 0 1 12 6.05c.97 0 1.95.13 2.86.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.77.11 3.06.74.81 1.18 1.83 1.18 3.09 0 4.43-2.69 5.41-5.25 5.69.41.35.77 1.03.77 2.08v3.08c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg><span>github.com/fandych/suora</span></a>',
        },
        {
          type: 'html',
          position: 'right',
          value:
            '<div class="navbar__item locale-switch" aria-label="Language switch"><a class="navbar__link locale-switch__button" href="/suora/">EN</a><a class="navbar__link locale-switch__button" href="/suora/zh/">中文</a></div>',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Suora',
          items: [
            {label: 'Docs', to: '/docs/intro'},
            {label: 'Releases', href: latestReleaseUrl},
            {label: 'GitHub', href: repoUrl},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Suora`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
