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
    description:
      "Local-first AI desktop workbench with chats, agents, workflows, integrations, documents, channels, and skills.",
  },
  latestRelease: {
    name: "v0.2.1",
    tagName: "v0.2.1",
    url: "https://github.com/fandych/suora/releases/tag/v0.2.1",
    publishedAt: "2026-09-23T12:49:28.060Z",
  },
} as const

export function formatReleasePublishedAt(locale: "zh" | "en") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "long",
  }).format(new Date(docsSiteMetadata.latestRelease.publishedAt))
}
