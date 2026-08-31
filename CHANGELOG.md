# Changelog

## 0.1.31 - 2026-08-31

### Fixed

- Fixed the GitHub Actions `test` workflow failing at `npm audit --audit-level=moderate`.
- Upgraded `mermaid` to `11.17.2` to clear the published security advisories affecting the test job.
- Upgraded `postcss` to `8.5.26` and refreshed its `nanoid` resolution to a safe patched version.
- Forced safe patched transitive versions for `dompurify` and `docx`'s nested `nanoid` so CI no longer fails on dependency audit.

### Release notes

- No application behavior or feature flows were changed in this release.
- This is a maintenance release focused on CI reliability and releasable build hygiene.