export interface Worktree {
    path: string;
    branch: string;
    isBare: boolean;
    isLocked: boolean;
    head?: string;
}
export interface DiffStats {
    fileCount: number;
    insertionCount: number;
    deletionCount: number;
}
export interface WorktreeWithDiff extends Worktree, DiffStats {
}
export interface BranchInfo {
    name: string;
    isRemote: boolean;
    isCurrent: boolean;
}
export interface SetupConfig {
    packages?: string[];
    envFiles?: string[];
    commands?: string[];
}
export interface CreateProgress {
    step: 'creating' | 'packages' | 'env' | 'commands' | 'done' | 'error';
    message: string;
    detail?: string;
}
export interface AppSettings {
    preferredTerminal: string;
    autoRefresh: boolean;
}
export interface RepoInfo {
    isRepo: boolean;
    path: string;
    name?: string;
}
export interface CreateWorktreeOptions {
    repoPath: string;
    branchName: string;
    createNewBranch: boolean;
    baseBranch?: string;
    worktreePath?: string;
}
export interface DeleteWorktreeOptions {
    repoPath: string;
    worktreePath: string;
    force?: boolean;
    deleteFiles?: boolean;
}
export interface GlitAPI {
    worktree: {
        list: (repoPath: string) => Promise<WorktreeWithDiff[]>;
        delete: (options: DeleteWorktreeOptions) => Promise<{
            success: boolean;
            error?: string;
        }>;
        create: (options: CreateWorktreeOptions) => Promise<{
            success: boolean;
            error?: string;
            worktree?: Worktree;
        }>;
    };
    branch: {
        list: (repoPath: string) => Promise<BranchInfo[]>;
    };
    settings: {
        get: () => Promise<AppSettings>;
        set: (settings: Partial<AppSettings>) => Promise<void>;
    };
    setup: {
        preview: (repoPath: string) => Promise<SetupConfig | null>;
    };
    clipboard: {
        copy: (text: string) => Promise<void>;
    };
    terminal: {
        open: (path: string, terminal?: string) => Promise<{
            success: boolean;
            error?: string;
        }>;
    };
    repo: {
        detect: () => Promise<RepoInfo>;
    };
    shell: {
        openPath: (path: string) => Promise<string>;
    };
    on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}
declare global {
    interface Window {
        glit: GlitAPI;
    }
}
//# sourceMappingURL=types.d.ts.map