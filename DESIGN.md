# Glit CLI Design Specification

## Overview

Glit is a Git worktree manager with an Electron-based desktop UI and a first-class CLI. The CLI exposes the same operations available through the GUI — listing, creating, deleting worktrees, managing branches, running dev processes, opening terminals/IDEs — in a scriptable, pipe-friendly form.

**Design philosophy:**
- CLI is the primary interface for automation, scripting, and headless environments.
- UX follows conventional Unix CLI patterns (POSIX-style flags, stdout/stderr separation, exit codes).
- The CLI never spawns a window; it operates purely in terminal mode.
- Output defaults to human-readable text but always supports `--json` for programmatic use.

---

## 1. Architecture

### 1.1 Two Modes of Execution

The CLI supports two runtime architectures:

#### Mode A — Subprocess (default, production)
```
glit <command> [opts] [args]
        ↓
   bin/glit.js
        ↓
   Electron main process (dist/main/index.js)
        ↓
   IPC handlers (src/main/ipc.ts)
        ↓
   Git / OS commands via Node.js services
```
**Use case:** Packaged app, installed globally, no build step required.

#### Mode B — Direct TypeScript Import (development/build-time)
```
src/cli/index.ts  →  imports  →  src/main/services/*.ts
                                            ↓
                                    Git / OS commands directly
```
**Use case:** Faster iteration during development, tree-shaking, bundling into a single binary.

The design document does not prescribe which mode to implement first — both are valid. The architecture section exists to document the tradeoffs.

### 1.2 Why Subprocess is the Default

- **Isolation:** Electron main process runs in a separate V8 context; crashes do not corrupt the CLI process.
- **Compatibility:** Works with the existing packaged `dist/main/index.js` without any architectural changes.
- **Settings sharing:** `electron-store` in the main process already handles settings, recent repos, dev commands. The CLI can reuse these without re-implementing storage.
- **Window management:** When `--open` or `--gui` is passed, the same Electron window can be reused rather than launching a new one.

### 1.3 Direct Import Architecture (Mode B)

For Mode B, a dedicated CLI entry point (`src/cli/index.ts`) would directly import the service modules, bypassing IPC entirely:

```
src/cli/index.ts
  ├── services/git.ts        (same file, no IPC)
  ├── services/git-operations.ts
  ├── services/settings.ts   (electron-store still works)
  ├── services/process.ts
  ├── services/launchers.ts
  └── services/setup.ts
```

This requires **no changes** to the service files — they already export all their functions. Only a new entry point is needed.

### 1.4 IPC Channel Mapping

Each CLI command maps to one or more existing IPC handlers in `src/main/ipc.ts`:

| CLI command | IPC channel | Notes |
|---|---|---|
| `worktree list` | `worktree:list` | |
| `worktree create` | `worktree:create` | |
| `worktree delete` | `worktree:delete` | |
| `worktree sync` | `worktree:sync` | |
| `worktree setup` | `worktree:runSetup` | |
| `branch list` | `branch:list` | |
| `branch checkout` | `branch:checkout` | |
| `branch rebase` | `branch:rebaseOnto` | |
| `branch delete` | `branch:delete` | |
| `process start` | `process:start` | |
| `process stop` | `process:stop` | |
| `process logs` | `process:getLogs` | |
| `settings get` | `settings:get` | |
| `settings set` | `settings:set` | |
| `setup preview` | `setup:preview` | |
| `setup save` | `setup:save` | |
| `repo detect` | `repo:detect` | |
| `repo switch` | `repo:switch` | |
| `open terminal` | `terminal:open` | |
| `open ide` | `ide:open` | |
| `git status` | `git:status` | |
| `git commit` | `git:commit` | |
| `git push` | `git:push` | |
| `git pull` | `git:pull` | |

---

## 2. Command Hierarchy

```
glit [global options] <command> [command options] [arguments]
```

### Top-level command groups

| Command | Description |
|---|---|
| `worktree` | List, create, delete, sync, re-run setup |
| `branch` | List, checkout, rebase, delete |
| `process` | Start, stop dev server; view logs |
| `settings` | Get/set CLI and app preferences |
| `setup` | Preview and edit `.glit/setup.yaml` |
| `repo` | Detect git repo, switch active repo, list recent repos |
| `open` | Open worktree in terminal or IDE |
| `git` | Git operations (status, commit, push, pull) |
| `pr` | Show PR status and open PR creation URL |

### Global help

```
glit --help           Show top-level help
glit <command> --help Show command-specific help
glit --version        Show version (from package.json)
```

---

## 3. Global Flags

These apply to **every** command and must be parsed before subcommand dispatch.

| Flag | Alias | Type | Default | Description |
|---|---|---|---|---|
| `--repo <path>` | `-r` | string | `cwd` | Git repository root. Can also be set via `GLIT_REPO_PATH` env var. |
| `--output <format>` | `-o` | `text`\\|`json` | `text` | Output format for stdout. `text` is human-readable, `json` is machine-parseable. |
| `--color <when>` | | `always`\\|`never`\\|`auto` | `auto` | Enable/disable color output. `auto` detects TTY. |
| `--quiet` | `-q` | boolean | `false` | Suppress informational output (progress, confirmations). Errors still go to stderr. |
| `--verbose` | `-v` | boolean | `false` | Emit debug output to stderr. Can be repeated for more verbosity (`-vv`). |
| `--json` | | boolean | `false` | Shorthand for `--output json`. Takes precedence over `--output text`. |

**Output format rules:**
- Human format (`--output text`) writes to stdout.
- JSON format writes a single JSON value (object or array) to stdout, with no extra whitespace at the top level.
- Errors and warnings always go to stderr, never stdout.
- Progress messages (e.g., during worktree creation) go to stderr and are suppressed by `--quiet`.

---

## 4. Worktree Commands

### `glit worktree list [options]`

List all worktrees in the repository.

**Options:**

| Flag | Description |
|---|---|
| `--format <style>` | Table style: `simple` (default), `compact`, `detail`. `detail` shows file counts, ahead/behind, last activity. |
| `--branch <pattern>` | Filter to worktrees matching branch name (substring match, case-insensitive). |

**UX examples (text format):**

```
$ glit worktree list
WORKTREE          BRANCH       STATUS
/path/to/repo     main         current
/path/to/repo-wt1 feature/foo  +3 -1  2 ahead, 1 behind
/path/to/repo-wt2 fix/bug      stale
```

With `--format detail`:
```
$ glit worktree list --format detail
PATH                      BRANCH       DIFF        UPSTREAM    LAST ACTIVITY
/path/to/repo             main         clean       up to date  2 hours ago
/path/to/repo-wt1         feature/foo  +3/-1       2 ahead, 1 behind  3 days ago
/path/to/repo-wt2         fix/bug      stale       —           2 weeks ago
```

JSON format (`--json`):
```json
[
  {
    path: '/path/to/repo',
    displayPath: '~/path/to/repo',
    branch: 'main',
    isCurrent: true,
    isStale: false,
    aheadCount: 0,
    behindCount: 0,
    fileCount: 0,
    insertionCount: 0,
    deletionCount: 0,
    lastActivity: '2 hours ago'
  }
]
```

### `glit worktree create <branch-name> [options]`

Create a new worktree.

**Options:**

| Flag | Description |
|---|---|
| `--base <branch>` | Base branch for the new branch. Default: auto-detected default branch (`main` or `master`). |
| `--path <dir>` | Explicit worktree directory path. Default: `../glit-worktrees/<branch-name>` relative to repo root. |
| `--no-setup` | Skip running `.glit/setup.yaml` after creation. |
| `--force` | Force creation even if branch already exists as a worktree. |

**UX examples:**

```
$ glit worktree create feature/new-ui
Creating worktree... done
Worktree created at: /path/to/repo-wt-new-ui

$ glit worktree create feature/new-ui --base develop --path /tmp/my-wt
Creating worktree... done
Worktree created at: /tmp/my-wt
```

Error cases:
```
$ glit worktree create feature/existing
Error: worktree already exists at /path/to/repo-wt-existing
  Use --force to override, or 'glit worktree delete /path/to/repo-wt-existing' first.

$ glit worktree create invalid/branch::name
Error: invalid branch name (contains forbidden characters)
```

Cancel create (if running setup takes too long):
```
$ glit worktree create feature/slow-setup --setup-timeout 10s
# Or cancel via signal (Ctrl+C)
```

### `glit worktree delete <worktree-path> [options]`

Delete a worktree.

**Options:**

| Flag | Description |
|---|---|
| `--force` | Delete even if worktree has uncommitted changes. |
| `--delete-files` | Also remove the working directory files (not just the git worktree metadata). |
| `--no-gc` | Skip running `git worktree prune` after deletion. |

**UX examples:**

```
$ glit worktree delete /path/to/repo-wt-old
Confirm delete of worktree at /path/to/repo-wt-old? [y/N] y
Deleted worktree.

$ glit worktree delete /path/to/repo-wt-old --force
Deleted worktree (forced).
```

### `glit worktree sync <worktree-path>`

Reset the worktree's working tree to match HEAD (discard uncommitted changes).

**UX examples:**

```
$ glit worktree sync /path/to/repo-wt-feature
Syncing... done
```

### `glit worktree setup <worktree-path>`

Re-run the `.glit/setup.yaml` setup script for an existing worktree.

**UX examples:**

```
$ glit worktree setup /path/to/repo-wt-feature
Running setup... done
```

---

## 5. Branch Commands

### `glit branch list [options]`

**Options:**

| Flag | Description |
|---|---|
| `--local` | Show only local branches (default). |
| `--remote` | Show only remote branches. |
| `--merged` | Show only branches merged into the specified branch (default: current branch). |
| `--no-merged` | Show only branches NOT merged into the specified branch. |

**UX examples:**

```
$ glit branch list
CURRENT   NAME
*         main
          feature/new-ui
          fix/bug
          origin/main
          origin/feature/new-ui
```

### `glit branch checkout <branch-name>`

Checkout a branch within the current worktree's repo.

### `glit branch rebase <branch-name> [options]`

Rebase the current branch onto the specified target.

**Options:**

| Flag | Description |
|---|---|
| `--onto <branch>` | Rebase current branch onto this branch. |
| `--fetch` | Run `git fetch origin` before rebasing. Default: try fetch, continue on failure. |

### `glit branch delete <branch-name> [options]`

Delete a local branch.

**Options:**

| Flag | Description |
|---|---|
| `--force` | Delete even if branch is not fully merged. |

---

## 6. Process Commands

### `glit process start [options]`

Start a dev process (detected from `.glit/setup.yaml` or `package.json`).

**Options:**

| Flag | Description |
|---|---|
| `--command <cmd>` | Override the detected dev command. |
| `--save` | Save this command as the default for this worktree. |

**UX examples:**

```
$ glit process start --repo /path/to/repo-wt-feature
Starting: npm run dev
[PID 12345]  VITE v5.3.1  ready in 234ms
  ➜  Local:   http://localhost:5173/

$ glit process start --repo /path/to/repo-wt-feature --command pnpm run dev:server --save
Starting: pnpm run dev:server
Saved as default command for this worktree.
```

### `glit process stop [options]`

**Options:**

| Flag | Description |
|---|---|
| `--repo <path>` | Worktree path. Required unless `GLIT_REPO_PATH` is set. |

### `glit process list`

List all running dev processes managed by glit.

**UX examples:**

```
$ glit process list
WORKTREE                  COMMAND              PID     PORT
/path/to/repo-wt-feat     npm run dev          12345   5173
/path/to/repo-wt-feat2    bun run start        67890   3000
```

### `glit process logs <worktree-path>`

Stream the logs of a running dev process. By default shows last 50 lines, then streams new output.

**Options:**

| Flag | Description |
|---|---|
| `--tail <n>` | Show last N lines before streaming (default: 50). |
| `--no-stream` | Show current logs only, then exit. |

---

## 7. Settings Commands

### `glit settings get [key]`

Show all settings, or a specific one.

**UX examples:**

```
$ glit settings get
preferredTerminal   iTerm2
preferredIDE        VSCode
autoRefresh         true
defaultBaseBranch   main

$ glit settings get preferredTerminal
iTerm2
```

### `glit settings set <key> <value>`

Set a setting value.

```
$ glit settings set preferredTerminal Warp
$ glit settings set autoRefresh false
```

---

## 8. Setup Commands

### `glit setup preview`

Show the current `.glit/setup.yaml` content.

### `glit setup edit`

Open the setup YAML in `$EDITOR`.

### `glit setup validate`

Validate the setup YAML syntax and check that referenced env files and commands are valid.

---

## 9. Repo Commands

### `glit repo detect`

Print the current repository info (name, path, whether it's a git repo).

### `glit repo switch <path>`

Switch the active repository (updates recent repos list).

### `glit repo list-recent`

List recently used repositories.

---

## 10. Open Commands

### `glit open terminal [worktree-path]`

Open a new terminal window/tab at the worktree path.

**Options:**

| Flag | Description |
|---|---|
| `--terminal <name>` | Terminal app: `Terminal`, `iTerm2`, `Hyper`, `Kitty`, `Alacritty`, `Warp`. Default: from settings. |

### `glit open ide [worktree-path]`

Open the worktree in an IDE.

**Options:**

| Flag | Description |
|---|---|
| `--ide <name>` | IDE: `VSCode`, `VSCodeInsiders`, `Cursor`, `Zed`, `WebStorm`, `Sublime`. Default: from settings. |

---

## 11. Git Commands

These wrap existing IPC handlers for basic git operations.

### `glit git status`

Show modified/staged/untracked files in the worktree.

```
$ glit git status
 M src/main/ipc.ts
A  src/cli/index.ts
?? src/cli/utils.ts
```

### `glit git commit [-m <message>] [files...]`

Stage and commit files.

### `glit git push [--force]`

Push the current branch. `--force` uses `--force-with-lease`.

### `glit git pull`

Pull with `--ff-only`. Reports if non-fast-forward.

---

## 12. PR Commands

### `glit pr status`

Show the current PR status for the worktree's branch using `gh`.

### `glit pr open`

Open the PR creation URL in the browser.

---

## 13. Output Format Specification

### 13.1 Human-Readable (Text)

- Use ASCII-safe output (no box-drawing characters that break in non-UTF8 terminals).
- Align columns with spaces, not tabs.
- Color output via `--color always` or when stdout is a TTY and `--color auto`.
- Color categories: green for additions, red for deletions, yellow for stale, cyan for branch names.

### 13.2 JSON Format

- Output is a single JSON value (object or array) per invocation.
- No trailing newlines in the JSON body (but output is terminated by a newline).
- Timestamps are ISO 8601 strings.
- Error responses in JSON mode:
  ```json
  {
    success: false,
    error: {
      code: 1,
      message: 'worktree not found',
      details: 'No worktree found at /path/to/nonexistent'
    }
  }
  ```
- Success responses in JSON mode:
  ```json
  {
    success: true,
    data: { ... }
  }
  ```

### 13.3 Streaming Output

`glit process logs` and long-running operations stream newline-delimited text to stdout. JSON mode is not supported for streaming output.

---

## 14. Error Handling

### 14.1 Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | General error (git command failed, file not found, etc.) |
| `2` | Invalid usage (bad flag, missing argument, bad type) |
| `3` | Not a git repository |
| `4` | Worktree not found |
| `5` | Worktree already exists |
| `6` | Branch not found |
| `7` | Rebase conflict |
| `8` | Upstream not configured |
| `130` | Interrupted (SIGINT / Ctrl+C) |

### 14.2 Error Output

All errors go to **stderr** with a consistent format:

```
glit: <command>: <human-readable message>
  Hint: <optional recovery suggestion>
```

Example:
```
glit: worktree delete: worktree not found
  Hint: Run 'glit worktree list' to see available worktrees
```

### 14.3 Signal Handling

- SIGINT (Ctrl+C) during long operations (worktree create, process start) gracefully cancels.
- In JSON mode, Ctrl+C is reported as `{ success: false, error: { code: 130, message: 'interrupted' } }`.

### 14.4 Validation

- All path arguments are validated before use.
- Branch names are validated against git rules.
- JSON/YAML configuration files are validated before save.

---

## 15. Configuration Approach

### 15.1 Configuration Files

Glit CLI uses two layers of configuration:

**Layer 1 — User-level settings (global):**
Stored in `electron-store` (same as GUI):
- `preferredTerminal`
- `preferredIDE`
- `autoRefresh`
- `defaultBaseBranch`

These are shared between CLI and GUI. The CLI reads them via the same `electron-store` instance.

**Layer 2 — Repository-level settings (per-repo):**
`.glit/setup.yaml` at the repo root:
```yaml
packages:
  - npm install
envFiles:
  - .env.example
commands:
  - git lfs install
dev: npm run dev
```

**Layer 3 — CLI-specific settings (optional, `~/.glitrc` or `~/.config/glit/config.json`):**
```json
{
  defaultOutput:  false,
  color:  false,
  pager:  true,
  editor:  null,
  aliases: {
    wl:  'worktree list',
    wt:  'worktree'
  }
}
```

### 15.2 Environment Variables

| Variable | Equivalent flag | Description |
|---|---|---|
| `GLIT_REPO_PATH` | `--repo` | Repository root path |
| `GLIT_OUTPUT` | `--output` | Default output format (`text`\\|`json`) |
| `GLIT_COLOR` | `--color` | Color mode |
| `GLIT_NO_GUI` | (always true for CLI) | Never spawn GUI |
| `GLIT_CONFIG` | | Path to global config file |
| `GLIT_DEBUG` | `--verbose` | Enable debug output |

### 15.3 Priority Order

For any given setting, the order of precedence is:
1. Command-line flag (highest)
2. Environment variable
3. Config file
4. Defaults (lowest)

---

## 16. Shell Completion

### 16.1 Supported Shells

- **bash** — via `glit completion bash`
- **zsh** — via `glit completion zsh`
- **fish** — via `glit completion fish`
- **PowerShell** — via `glit completion powershell`

### 16.2 Completion Behavior

- **Commands and subcommands** — `glit <TAB>` shows top-level commands; `glit worktree <TAB>` shows subcommands.
- **Flags** — `glit worktree create --<TAB>` shows available flags.
- **Branch names** — `glit worktree create <TAB>` shows existing local branches.
- **Worktree paths** — `glit worktree delete <TAB>` shows worktree paths in the current repo.
- **IDE names** — `--ide <TAB>` shows available IDEs.
- **Terminal names** — `--terminal <TAB>` shows available terminals.
- **Git files** — `glit git commit <TAB>` shows modified files.

### 16.3 Installation

```bash
# bash
glit completion bash >> ~/.bashrc

# zsh
glit completion zsh >> ~/.zshrc

# fish
glit completion fish > ~/.config/fish/completions/glit.fish
```

---

## 17. UX Conventions

### 17.1 Progressive Disclosure

- `--help` shows concise usage summary with the most common flags.
- `glit <command> --help --verbose` shows all flags including advanced ones.
- Errors include a `Hint:` line suggesting the correct usage or an alternative.

### 17.2 Dry Run

Commands that modify state (create, delete, commit) support `--dry-run`:
```
$ glit worktree create feature/test --dry-run
[DRY RUN] Would create worktree at ../glit-worktrees/feature-test from branch main
[DRY RUN] Would run setup commands from .glit/setup.yaml
```

### 17.3 Quiet Mode

`--quiet` suppresses:
- Progress indicators
- Confirmations (auto-yes)
- Informational messages

It does NOT suppress errors or JSON output.

### 17.4 Pager

Long output (`worktree list` with many worktrees, `process logs`) is piped through a pager if stdout is a TTY and `--json` is not set. The pager is `$PAGER` or `less`. Can be disabled with `--no-pager`.

### 17.5 Interactive Mode

The CLI never prompts for input in non-TTY mode. In TTY mode:
- Delete confirmation: `Confirm delete of <path>? [y/N]` — answer `y` to proceed, `n` or Enter to cancel.
- Editor for commit messages: opens `$EDITOR` with existing diff context.
- Setup edit: opens `$EDITOR` with the YAML content.

---

## 18. Examples by Common Workflows

### 18.1 First-Time Setup

```bash
# Detect current repo
$ glit repo detect
/path/to/my-project  ✓ git repo  (current)

# See existing worktrees
$ glit worktree list

# Create a feature worktree
$ glit worktree create feature/new-ui
Creating worktree... done

# Open it in VSCode
$ glit open ide /path/to/my-project-wt-feature-new-ui

# Start dev server
$ glit process start --repo /path/to/my-project-wt-feature-new-ui
```

### 18.2 Daily Workflow

```bash
# List running processes
$ glit process list

# View logs
$ glit process logs /path/to/my-project-wt-feature-new-ui --tail 20

# Stop process
$ glit process stop --repo /path/to/my-project-wt-feature-new-ui

# Check git status
$ glit git status

# Commit changes
$ glit git commit -m 'Add new feature' src/

# Push
$ glit git push

# Check PR status
$ glit pr status

# Rebase on main
$ glit branch rebase main

# Check if worktree is stale (HEAD moved)
$ glit worktree list --format detail | grep stale
/path/to/repo-wt-old   fix/bug   stale

# Sync stale worktree
$ glit worktree sync /path/to/repo-wt-old
```

### 18.3 Cleanup Workflow

```bash
# Find merged branches
$ glit branch list --merged main
feature/completed
fix/old-bug

# Delete merged worktrees
$ glit worktree delete /path/to/repo-wt-feature-completed
$ glit worktree delete /path/to/repo-wt-fix-old-bug

# Delete merged branches
$ glit branch delete feature/completed
$ glit branch delete fix/old-bug
```

### 18.4 Scripting / CI

```bash
#!/bin/bash
set -e

REPO=$(glit repo detect --json | jq -r '.path')

for wt in $(glit worktree list --json | jq -r '.[].path'); do
  glit process stop --repo $wt 2>/dev/null || true
done

glit worktree list --json | jq -r '.[] | select(.isStale) | .path' | while read wt; do
  echo “Syncing stale worktree: $wt”
  glit worktree sync $wt
done
```

---

## 19. Implementation Notes

### 19.1 Argument Parsing Library

Recommendation: use a lightweight parser with subcommand support. Options (in preference order):
1. **TypeScript-native, zero deps:** `clipanion` — used by Yarn, Gatsby CLI. Excellent subcommand support, static types, no runtime deps.
2. **Minimally featured:** `mri` — simple positional/flag parser, 1KB.
3. **Battle-tested:** `yargs` — full-featured, widely used, large bundle size.

Do **not** use `commander` — its callback-based API doesn't align well with async IPC calls.

### 19.2 JSON Output Library

Use `json-stable-stringify` or the native `JSON.stringify` with a custom replacer for consistent key ordering (helps with diff/patch in CI).

### 19.3 IPC Communication (Subprocess Mode)

For subprocess mode, communication between the CLI wrapper (`bin/glit.js` / TypeScript CLI entry) and the Electron main process uses **stdio-based JSON-RPC**:

- CLI spawns Electron as a child process with `--cli` flag.
- Electron starts in headless mode (no window).
- CLI sends JSON-RPC messages over stdin, receives responses over stdout.
- Errors go over stderr.

Example protocol:
```
CLI → ELECTRON:  { jsonrpc: '2.0', id: 1, method: 'worktree.list', params: { repoPath: '/path/to/repo' } }
ELECTRON → CLI:  { jsonrpc: '2.0', id: 1, result: [...] }
CLI → ELECTRON:  { jsonrpc: '2.0', id: 2, method: 'process.start', params: { worktreePath: '...', command: 'npm run dev' } }
ELECTRON → CLI:  { jsonrpc: '2.0', id: 2, result: { success: true, pid: 12345 } }
```

This is already partially how the Electron main process works — it's a matter of exposing a headless JSON-RPC layer in addition to the window-based IPC.

### 19.4 Entry Point

For the subprocess-based CLI, the Node.js entry point would be `bin/glit.js` (already exists, just needs rewriting to handle subcommands instead of blindly spawning Electron).

For direct TypeScript import mode, the entry point would be `src/cli/index.ts`, compiled to `dist/cli/index.js`.

Both would share the same argument parsing and output formatting logic, separated into `src/cli/parser.ts` and `src/cli/formatter.ts`.

### 19.5 Reusing Existing Services

All service files already export their functions — no refactoring needed:
- `git.ts` — `runGitCommand`, `getWorktrees`, etc.
- `git-operations.ts` — `getGitStatus`, `commitFiles`, etc.
- `settings.ts` — `store`, `getSettings`, `setSettings`
- `process.ts` — `startProcess`, `stopProcess`, `listProcesses`
- `launchers.ts` — `openTerminal`, `openIDE`
- `setup.ts` — `runSetupSteps`, `previewSetupConfig`

The CLI only needs to import these and call them, handling errors and formatting output.

---

## 20. Future Considerations

### 20.1 TUI Mode

A full terminal user interface (like `htop` or `lazygit`) could be added as `glit tui`. This would use a library like `ink` (React for CLI) or `blessed`.

### 20.2 Daemon Mode

A long-running `glit daemon` process could monitor worktrees and emit notifications when branches become stale or processes crash.

### 20.3 Remote Worktrees

Support for worktrees on remote machines via SSH, with local caching of status.

### 20.4 Plugin System

A `glit plugins` command to install community extensions (e.g., Jira integration, Slack notifications).