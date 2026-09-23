export const docsSiteMetadata = {
  productName: "SUORA",
  localizedProductName: "朔枢",
  brandName: "SUORA / 朔枢",
  repository: {
    owner: "fandych",
    name: "suora",
    url: "https://github.com/fandych/suora",
    homepageUrl: "https://fandych.github.io/suora/",
    defaultBranch: "main",
    description: "Local-first AI desktop workbench with chat, documents, agents, skills, pipelines, channels, and MCP servers.",
  },
  latestRelease: {
    name: "v0.1.31",
    tagName: "v0.1.31",
    url: "https://github.com/fandych/suora/releases/tag/v0.1.31",
    publishedAt: "2026-08-31T01:50:07Z",
  },
} as const

export function formatReleasePublishedAt(locale: "zh" | "en") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "long",
  }).format(new Date(docsSiteMetadata.latestRelease.publishedAt))
}
