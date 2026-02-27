# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Glit** is a Git worktree manager with both a desktop UI (Electron + React) and a CLI (`bin/glit.js`). It lets users list, create, and delete git worktrees, open them in terminals/Finder, and run per-repo setup scripts via `.glit/setup.yaml`.

## Commands

```bash
npm run dev          # Start dev mode (Vite renderer on :5173 + Electron main concurrently)
npm run build        # Full production build → .dmg on macOS
npm run lint         # ESLint on src/
npm run lint:fix     # ESLint with auto-fix
npm run typecheck    # Type check all three tsconfig targets (main + renderer + preload)
```

Individual build targets:
```bash
npm run build:main      # tsc --project tsconfig.main.json
npm run build:preload   # tsc --project tsconfig.preload.json
npm run build:renderer  # vite build
```

There is no test runner configured.

## Architecture

The project uses the standard Electron 3-process architecture with strict context isolation:

```
src/
├── main/       → Electron main process (Node.js, git commands, IPC handlers)
│   ├── index.ts  Window creation, app lifecycle, auto-updater
│   └── ipc.ts    All ipcMain.handle() business logic (git ops, settings, terminal)
├── preload/    → Security bridge (exposes window.glit API via contextBridge)
│   └── index.ts  Wraps ipcRenderer.invoke() calls for every main-process handler
├── renderer/   → React frontend (no direct Node.js access)
│   ├── App.tsx              Root: providers, keyboard shortcuts (r/c/,/Esc), modal state
│   ├── api/index.tsx        APIContext + createAPI() wrapper for window.glit
│   ├── contexts/
│   │   ├── WorktreeContext.tsx     Global state: repo info, worktrees, settings, filter, create progress
│   │   └── AppActionsContext.tsx   Action handlers: delete, copy, terminal, Finder, settings save
│   └── components/          12 UI components (WorktreeCard, CreateWorktreeModal, etc.)
└── shared/
    └── types.ts  All shared TypeScript interfaces (GlitAPI, Worktree, AppSettings, etc.)
```

### Key patterns

**IPC flow:** `renderer → preload (window.glit) → main (ipcMain.handle) → git/OS`

All renderer→main communication goes through `window.glit` (defined in `src/shared/types.ts` as `GlitAPI`). When adding a new IPC channel:
1. Add the method signature to `GlitAPI` in `src/shared/types.ts`
2. Add the `ipcMain.handle('channel:name', ...)` in `src/main/ipc.ts`
3. Add the `ipcRenderer.invoke('channel:name', ...)` wrapper in `src/preload/index.ts`
4. Use it via `useAPI()` hook or the `api` object in renderer components

**Three separate TypeScript configs:** Main uses Node16 modules, preload uses CommonJS/Node10, renderer uses ESNext with DOM libs. Each is compiled independently.

**State management:** React Context only — `WorktreeContext` holds all data (worktrees, repo info, settings, filter), `AppActionsContext` holds all mutation handlers. No external state library.

**Create progress tracking:** Multi-step worktree creation (create → packages → env → commands → done) sends IPC events via `ipcRenderer.on('create:progress', ...)` subscribed in `WorktreeContext`.

**Setup scripts:** Per-repo `.glit/setup.yaml` defines packages, env files, and shell commands to run after creating a worktree. `SetupConfig` type in `shared/types.ts`.

**Settings persistence:** `electron-store` stores `AppSettings` (preferredTerminal, defaultBaseBranch, autoRefresh) in the OS user data directory.

## Tech Stack

- **Electron** (main window, IPC, system integration)
- **React** + **TypeScript** (renderer UI)
- **Chakra UI** (component library, dark theme by default, custom brand palette)
- **Vite** (renderer bundler with HMR in dev)
- **electron-builder** (packages to .dmg/AppImage/deb)
- **electron-store** (persistent settings)
- **electron-log** (logging in main process)
- **ESLint 9** flat config with TypeScript + React Hooks plugins
