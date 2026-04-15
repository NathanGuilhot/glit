import { VERSION } from './constants.js'
import { logText } from './logger.js'

const HELP_TEXT: Record<string, string> = {
  '': `glit ·.° v${VERSION} - Git worktree manager

Usage: glit <command> [options] [args]

Global options:
  --repo <path>, -r <path>        Git repository path (default: cwd)
  --output <format>, -o <format>  Output format: text or json (default: text)
  --color <when>                  Color: always, never, or auto (default: auto)
  --quiet, -q                     Suppress informational output
  --verbose, -v                   Enable verbose output (can repeat)
  --json, -j                      Output as JSON
  --help, -h                      Show this help
  --version, -V                   Show version

Commands:
  worktree                   Manage worktrees (list, create, delete)
  branch                     List branches (list)
  git                        Run git commands (status, commit, push, pull)
  settings                   Get/set settings (get, set)
  repo                       Detect repo (detect)
  open                       Open worktree in terminal or IDE (terminal, ide)
  process                    List saved dev commands (list)

Run 'glit <command> --help' for command-specific help.`,

  'worktree': `Usage: glit worktree <subcommand> [options]

Subcommands:
  list [options]             List all worktrees
  create <branch> [options]  Create a new worktree
  delete <path> [options]    Delete a worktree

Run 'glit worktree <subcommand> --help' for subcommand-specific help.`,

  'worktree list': `Usage: glit worktree list [options]

Options:
  --format <style>           Table style: simple or detail (default: simple)
  --branch <pattern>         Filter by branch name (case-insensitive substring)`,

  'worktree create': `Usage: glit worktree create <branch-name> [options]

Options:
  --base <branch>            Base branch (default: auto-detected main/master)
  --path <dir>               Worktree directory path
  --dry-run                  Show what would be created without creating`,

  'worktree delete': `Usage: glit worktree delete <worktree-path> [options]

Options:
  --force                    Required. Delete without confirmation (also passes --force to git)
  --delete-files             Also remove working directory files after git remove
  --no-gc                    Skip git worktree prune after deletion`,

  'branch': `Usage: glit branch <subcommand> [options]

Subcommands:
  list [options]             List branches`,

  'branch list': `Usage: glit branch list [options]

Options:
  --local                    Show only local branches (default)
  --remote                   Show only remote branches
  --merged [<branch>]        Show branches merged into <branch> (default: detected main/master)
  --no-merged [<branch>]     Show branches NOT merged into <branch>`,

  'git': `Usage: glit git <subcommand> [options]

Subcommands:
  status                     Show git status
  commit -m <msg> [files]    Commit files (or all if none given)
  push [--force]             Push branch (--force uses --force-with-lease)
  pull                       Pull with --ff-only`,

  'open': `Usage: glit open <subcommand> [path]

Subcommands:
  terminal [path] [--terminal <name>]  Open terminal at worktree
  ide [path] [--ide <name>]            Open IDE at worktree`,

  'settings': `Usage: glit settings <subcommand> [args]

Subcommands:
  get [<key>]                Show a setting (or all if key omitted)
  set <key> <value>          Update a setting

Keys: preferredTerminal, preferredIDE, autoRefresh`,

  'process': `Usage: glit process list

Shows dev commands that have been saved for worktrees.
(Does not show live processes — those run inside the Electron app.)`,

  'repo': `Usage: glit repo detect

Prints whether the current directory is a git repository.`,
}

export function showHelp(command?: string, subcommand?: string): void {
  const key = subcommand ? `${command ?? ''} ${subcommand}` : (command ?? '')
  const fallback = HELP_TEXT[command ?? ''] || HELP_TEXT[''] || ''
  const text = HELP_TEXT[key] || fallback
  logText(text)
}
