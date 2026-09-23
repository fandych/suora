import { docsSiteMetadata, formatReleasePublishedAt } from "@/lib/docs-site"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import type { DocLocale } from "@/lib/docs-navigation"

const localizedContent: Record<
  DocLocale,
  {
    title: string
    description: string
    repository: string
    docsSite: string
    defaultBranch: string
    latestRelease: string
    releaseDate: string
    repoLink: string
    releaseLink: string
  }
> = {
  zh: {
    title: "项目信息",
    description: "以下信息来自当前仓库与 GitHub Release，可用于核对文档是否覆盖最新公开版本。",
    repository: "仓库",
    docsSite: "文档站",
    defaultBranch: "默认分支",
    latestRelease: "最新版本",
    releaseDate: "发布时间",
    repoLink: "查看 GitHub 仓库",
    releaseLink: "查看 GitHub Release",
  },
  en: {
    title: "Project info",
    description: "These values come from the current repository and GitHub Release so you can verify the docs against the latest public version.",
    repository: "Repository",
    docsSite: "Docs site",
    defaultBranch: "Default branch",
    latestRelease: "Latest release",
    releaseDate: "Published at",
    repoLink: "Open GitHub repository",
    releaseLink: "Open GitHub Release",
  },
}

export function ProjectSummary({ locale }: { locale: DocLocale }) {
  const content = localizedContent[locale]

  return (
    <section className="mt-12 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mt-0 text-2xl font-semibold tracking-tight text-foreground">{content.title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{content.description}</p>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-background/60 p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{content.repository}</dt>
          <dd className="mt-2 text-sm text-foreground">
            {docsSiteMetadata.repository.owner}/{docsSiteMetadata.repository.name}
          </dd>
        </div>
        <div className="rounded-lg border bg-background/60 p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{content.docsSite}</dt>
          <dd className="mt-2 text-sm text-foreground">{docsSiteMetadata.repository.homepageUrl}</dd>
        </div>
        <div className="rounded-lg border bg-background/60 p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{content.defaultBranch}</dt>
          <dd className="mt-2 text-sm text-foreground">{docsSiteMetadata.repository.defaultBranch}</dd>
        </div>
        <div className="rounded-lg border bg-background/60 p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{content.latestRelease}</dt>
          <dd className="mt-2 text-sm text-foreground">{docsSiteMetadata.latestRelease.tagName}</dd>
          <p className="mt-1 text-xs text-muted-foreground">
            {content.releaseDate}: {formatReleasePublishedAt(locale)}
          </p>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-3">
        <a
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          href={docsSiteMetadata.repository.url}
          target="_blank"
          rel="noreferrer"
        >
          {content.repoLink}
        </a>
        <a
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          href={docsSiteMetadata.latestRelease.url}
          target="_blank"
          rel="noreferrer"
        >
          {content.releaseLink}
        </a>
      </div>
    </section>
  )
}
