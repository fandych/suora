import type { VersionOption } from "@/data/domain/models"

type VersionLike = {
  id: string
  major: number
  minor: number
  isRelease: boolean
  createdAt: Date | number
}

export function toTimestamp(value: Date | number) {
  return value instanceof Date ? value.getTime() : value
}

export function compareVersionsDesc<T extends VersionLike>(a: T, b: T) {
  if (a.major !== b.major) {
    return b.major - a.major
  }

  if (a.minor !== b.minor) {
    return b.minor - a.minor
  }

  return toTimestamp(b.createdAt) - toTimestamp(a.createdAt)
}

export function getVersionLabel(version: Pick<VersionLike, "major" | "minor" | "isRelease">) {
  return `${version.major}.${version.minor}${version.isRelease ? " (Release)" : ""}`
}

export function toVersionOption<T extends VersionLike>(version: T): VersionOption {
  return {
    id: version.id,
    major: version.major,
    minor: version.minor,
    isRelease: version.isRelease,
    createdAt: toTimestamp(version.createdAt),
    label: getVersionLabel(version),
  }
}

export function getVisibleVersions<T extends VersionLike>(versions: T[]) {
  if (!versions.length) {
    return []
  }

  const sorted = [...versions].sort(compareVersionsDesc)
  const latestMajor = sorted[0].major

  return sorted
    .filter((version) => version.major === latestMajor || version.isRelease)
    .map(toVersionOption)
}

export function createNextDraftVersion(
  latest?: Pick<VersionLike, "major" | "minor" | "isRelease">
) {
  if (!latest) {
    return {
      major: 1,
      minor: 0,
    }
  }

  if (latest.isRelease) {
    return {
      major: latest.major + 1,
      minor: 0,
    }
  }

  return {
    major: latest.major,
    minor: latest.minor + 1,
  }
}