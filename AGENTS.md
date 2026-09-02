
# AGENTS.md

Shared guidance for coding agents working in this repository.

## Project Goal

This workspace builds a brand-new UI for [suora](C:/Users/fandych/Documents/Codespace/suora), using a cleaner information architecture and a more modular React renderer.

Terminology rule:

- use `workflow` or `workflows` in new UI copy, routes, and components
- do not introduce new `pipeline` naming in this workspace unless referring to legacy behavior from the source project

Legacy-to-new naming guidance:

- `pipeline` -> `workflow`
- `timer` -> `scheduler`
- legacy MCP-only entry points can be represented inside `integrations` when working on the new shell UI

## Current Surface

The current top-level route shell is defined in [src/App.tsx](src/App.tsx) and [src/views/nav-config.ts](src/views/nav-config.ts).

Primary routes:

- `/dashboard`
- `/chats`
- `/agents`
- `/workflows`
- `/schedulers`
- `/integrations`
- `/documents`
- `/channels`
- `/skills`
- `/models`
- `/preference`

Secondary sidebar behavior:

- route metadata belongs in [src/views/nav-config.ts](src/views/nav-config.ts)
- dynamic or async sidebar item loading belongs in [src/views/secondary-sidebar-data.ts](src/views/secondary-sidebar-data.ts)
- sidebar rendering belongs in [src/views/components/app-sidebar.tsx](src/views/components/app-sidebar.tsx) and [src/views/components/secondary-sidebar/section-sidebar.tsx](src/views/components/secondary-sidebar/section-sidebar.tsx)

## Source-of-Truth Reference

When deciding what modules the new UI must cover, use the source project at [C:/Users/fandych/Documents/Codespace/suora](C:/Users/fandych/Documents/Codespace/suora) as the product reference, but do not copy its route names blindly.

The source project currently exposes modules for:

- chat
- documents
- pipeline
- models and providers
- agents
- skills
- timer
- channels
- MCP
- settings

In this workspace, prefer the renamed UI surface:

- chats
- documents
- workflows
- models
- agents
- skills
- schedulers
- channels
- integrations
- preference

## UI Direction

This repo is not a direct clone of the source app UI. Build a new UI that keeps the module coverage while improving clarity and structure.

Expectations:

- the left icon rail defines the primary product areas
- the secondary sidebar is module-specific and should be able to load dynamic data
- page shells should be reusable and avoid copy-paste layouts
- placeholders are acceptable only when the route contract is clear and the UI structure is reusable

## Dynamic Data Rule

Do not hardcode future runtime lists directly inside route config.

Use this split instead:

- `nav-config.ts`: route metadata, labels, sidebar group definitions, search placeholder
- `secondary-sidebar-data.ts`: async data loader or adapter layer for sidebar lists
- page or store layer: real API calls, persisted state, caching, and mutations when runtime data arrives

When replacing mock sidebar data with real data, preserve the rendering contract so UI components do not need to change.

## Code Rules

- `ts` and `tsx` files must stay under 400 lines; extract components into nearby `components` folders when needed
- treat the 400-line cap for `ts` and `tsx` files as a hard limit; if a change would exceed it, extract nearby components before finishing
- always use `@/` imports in repo code; do not introduce new `../` or `./` local imports
- do not use scripts or bulk automation to rewrite code; make targeted manual edits
- every code change must leave the app in a runnable state and must be validated with a real check such as `npm run build`
- preserve shadcn UI source files in [src/components/ui](src/components/ui) instead of restyling them in place
- when building UI, prefer composing existing shadcn components before writing custom markup, and consult the `shadcn` skill for component APIs and patterns
- `electron/` source must be grouped by concern: `ipc/`, `database/`, `others/`, and `types/`; do not flatten new helper modules at the `electron/` root
- when `npm run dev` is used for Electron validation during agent work, stop the spawned dev process before finishing the task

## Directory Notes

The current directory intent is:

```text
src/
    components/           global components
        ui/                 shadcn UI primitives, keep upstream style intact
    views/                route-level pages and route UI contracts
        components/         shared view components
        chats/              chats page area
            components/       chat-specific components
        preferences/        preference pages when expanded
            components/       preference-specific components
            general/          preference/general route
                components/     general-settings-only components

electron/
    ipc/                  IPC registration grouped by domain
    database/             database core and db helpers
    others/               Electron-only helpers that are not entrypoints
    types/                Electron process types and payload contracts
```

## Working Rules

When implementing changes:

1. Start from the owning route or view contract instead of broad exploration.
2. Keep sidebar structure reusable; do not fork separate implementations unless the interaction model is truly different.
3. Put mock data behind an adapter or loader if the user will later replace it with API data.
4. Keep naming aligned with `workflow`, never new `pipeline` UI labels.
5. Validate with `npm run build` after route or layout changes.
6. Update this file when route names, module coverage, or UI architecture rules change.