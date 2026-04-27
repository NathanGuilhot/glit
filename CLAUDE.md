# CLAUDE.md

Guidance for Claude Code working in this repo.

## Project

**Glit** — Git worktree manager. Electron + React desktop app, plus a CLI (`bin/glit.js`). Lists/creates/deletes worktrees, opens them in terminals/IDE/Finder, and runs per-repo setup via `.glit/setup.yaml`.

## Commands

```bash
npm run dev         # Vite renderer (:5173) + Electron main
npm run build       # Production build → .dmg on macOS
npm run lint        # ESLint
npm run typecheck   # main + preload + renderer tsconfigs
```

No test runner.

## Architecture

Standard Electron 3-process layout with strict context isolation:

```
src/
├── main/      Node.js: window lifecycle, IPC handlers, git/OS ops
├── preload/   contextBridge → exposes window.glit
├── renderer/  React UI (no Node access)
└── shared/
    └── types.ts   All shared interfaces
```

**IPC flow:** `renderer → window.glit (preload) → ipcMain.handle (main) → git/OS`

Adding a new IPC channel:
1. Add method to `GlitAPI` in `src/shared/types.ts`
2. Implement `ipcMain.handle('channel:name', ...)` in `src/main/ipc.ts`
3. Wrap in `src/preload/index.ts` via `ipcRenderer.invoke`
4. Use via `useAPI()` in renderer

**State:** React Context only. `WorktreeContext` (data: repo, worktrees, settings, filter, create progress, running processes); `AppActionsContext` (mutations).

**Three tsconfigs:** main (Node16), preload (CommonJS/Node10), renderer (ESNext + DOM). Each compiled independently.

**Setup scripts:** `.glit/setup.yaml` → `SetupConfig` (`packages`, `envFiles`, `commands`, `dev`).

**Settings:** `electron-store` persists `AppSettings` (`preferredTerminal`, `preferredIDE`, `autoRefresh`).

## Tech Stack

Electron · React + TypeScript · Chakra UI (dark default) · Vite · electron-builder · electron-store · electron-log · ESLint 9 flat config.
