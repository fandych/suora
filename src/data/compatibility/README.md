# Compatibility boundary

Place temporary legacy field normalization, migration aliases, and compatibility-only adapters here.

Rules:

- New UI and application code must not depend on legacy names.
- Each compatibility branch should document the source version and removal condition.
- Keep normal repositories focused on persistence and current domain models.
