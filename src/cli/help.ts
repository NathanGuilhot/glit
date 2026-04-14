import { VERSION } from './constants.js'
import { logText } from './logger.js'

const HELP_TEXT: Record<string, string> = {
  '': `glit v${VERSION} - Git worktree manager

Usage: glit <command> [options] [args]

Global options:
  --repo <path>, -r <path>   Git repository path (default: cwd)
  --output <format>, -o <format>  Output format: text or json (default: text)
  --color <when>             Color: always, never, or auto (default: auto)
  --quiet, -q                Suppress informational output
  --verbose, -v               Enable verbose output (can repeat)
  --json, -j                  Output as JSON
  --help, -h                 Show this help
  --version, -V              Show version

Commands:
  worktree                   Manage worktrees (list, create, delete, sync, setup)
  branch                     Manage branches (list, checkout, rebase, delete)
  process                    Manage dev processes (start, stop, list, logs)
  settings                   Get/set settings (get, set)
  setup                      Manage setup.yaml (preview, edit, validate)
  repo                       Manage repositories (detect, switch, list-recent)
  open                       Open in terminal or IDE
  git                        Run git commands (status, commit, push, pull)
  pr                         GitHub PR operations (status, open)

Run 'glit <command> --help' for command-specific help.`,

  'worktree': `Usage: glit worktree <subcommand> [options]

Subcommands:
  list [options]            List all worktrees
  create <branch> [options]  Create a new worktree
  delete <path> [options]   Delete a worktree
  sync <path>                Sync worktree to HEAD
  setup <path>               Re-run setup for a worktree

Run 'glit worktree <subcommand> --help' for subcommand-specific help.`,

  'worktree list': `Usage: glit worktree list [options]

Options:
  --format <style>           Table style: simple, compact, detail (default: simple)
  --branch <pattern>        Filter by branch name (case-insensitive substring)`,

  'worktree create': `Usage: glit worktree create <branch-name> [options]

Options:
  --base <branch>           Base branch (default: auto-detected main/master)
  --path <dir>              Worktree directory path
  --no-setup                Skip running setup after creation
  --dry-run                 Show what would be created without creating
  --force                   Force creation even if worktree exists`,

  'worktree delete': `Usage: glit worktree delete <worktree-path> [options]

Options:
  --force                   Delete even with uncommitted changes
  --delete-files            Also remove working directory files
  --no-gc                   Skip git worktree prune after deletion`,

  'branch': `Usage: glit branch <subcommand> [options]

Subcommands:
  list [options]            List branches
  checkout <name>           Checkout a branch
  rebase <branch> [opts]    Rebase current branch
  delete <name> [options]   Delete a branch`,

  'branch list': `Usage: glit branch list [options]

Options:
  --local                   Show only local branches (default)
  --remote                  Show only remote branches
  --merged [<branch>]       Show branches merged into branch
  --no-merged [<branch>]    Show branches NOT merged into branch`,

  'git': `Usage: glit git <subcommand> [options]

Subcommands:
  status                     Show git status
  commit [-m <msg>] [files]  Commit files
  push [--force]             Push branch
  pull                      Pull with --ff-only`,
}

export function showHelp(command?: string, subcommand?: string): void {
  const key = subcommand ? `${command ?? ''} ${subcommand}` : (command ?? '')
  const fallback = HELP_TEXT[command ?? ''] || HELP_TEXT[''] || ''
  const text = HELP_TEXT[key] || fallback
  logText(text)
}
