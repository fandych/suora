export type VersionLike = { major: number; minor: number; isRelease: boolean }

export const getVersionLabel = (version: VersionLike) =>
  `${version.major}.${version.minor}${version.isRelease ? " (Release)" : ""}`
