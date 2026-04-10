import { createIcon } from '@chakra-ui/react'

const strokeDefaults = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export const CopyIcon = createIcon({
  displayName: 'CopyIcon',
  viewBox: '0 0 24 24',
  path: [
    <rect key="rect" x="9" y="9" width="13" height="13" rx="2" ry="2" />,
    <path key="path" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const TerminalIcon = createIcon({
  displayName: 'TerminalIcon',
  viewBox: '0 0 24 24',
  path: [
    <polyline key="poly" points="4 17 10 11 4 5" />,
    <line key="line" x1="12" y1="19" x2="20" y2="19" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const TrashIcon = createIcon({
  displayName: 'TrashIcon',
  viewBox: '0 0 24 24',
  path: [
    <polyline key="poly" points="3 6 5 6 21 6" />,
    <path key="path" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const FolderIcon = createIcon({
  displayName: 'FolderIcon',
  viewBox: '0 0 24 24',
  path: [
    <path key="path" d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const DotsIcon = createIcon({
  displayName: 'DotsIcon',
  viewBox: '0 0 24 24',
  path: [
    <circle key="top" cx="12" cy="5" r="1" />,
    <circle key="mid" cx="12" cy="12" r="1" />,
    <circle key="bot" cx="12" cy="19" r="1" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const RefreshIcon = createIcon({
  displayName: 'RefreshIcon',
  viewBox: '0 0 24 24',
  path: [
    <polyline key="poly1" points="23 4 23 10 17 10" />,
    <polyline key="poly2" points="1 20 1 14 7 14" />,
    <path key="path" d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const SearchIcon = createIcon({
  displayName: 'SearchIcon',
  viewBox: '0 0 24 24',
  path: [
    <circle key="circle" cx="11" cy="11" r="8" />,
    <line key="line" x1="21" y1="21" x2="16.65" y2="16.65" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const SettingsIcon = createIcon({
  displayName: 'SettingsIcon',
  viewBox: '0 0 24 24',
  path: [
    <circle key="circle" cx="12" cy="12" r="3" />,
    <path key="path" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const PlusIcon = createIcon({
  displayName: 'PlusIcon',
  viewBox: '0 0 24 24',
  path: [
    <line key="v" x1="12" y1="5" x2="12" y2="19" />,
    <line key="h" x1="5" y1="12" x2="19" y2="12" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const IDEIcon = createIcon({
  displayName: 'IDEIcon',
  viewBox: '0 0 24 24',
  path: [
    <polyline key="open" points="16 18 22 12 16 6" />,
    <polyline key="close" points="8 6 2 12 8 18" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const ChevronDownIcon = createIcon({
  displayName: 'ChevronDownIcon',
  viewBox: '0 0 24 24',
  path: [
    <polyline key="poly" points="6 9 12 15 18 9" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const RebaseIcon = createIcon({
  displayName: 'RebaseIcon',
  viewBox: '0 0 24 24',
  path: [
    <line key="bar" x1="4" y1="4" x2="20" y2="4" />,
    <line key="stem" x1="12" y1="20" x2="12" y2="8" />,
    <polyline key="arrow" points="7 9 12 4 17 9" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const SyncIcon = createIcon({
  displayName: 'SyncIcon',
  viewBox: '0 0 24 24',
  path: [
    <line key="bar" x1="4" y1="20" x2="20" y2="20" />,
    <line key="stem" x1="12" y1="4" x2="12" y2="16" />,
    <polyline key="arrow" points="7 11 12 16 17 11" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const CloseIcon = createIcon({
  displayName: 'CloseIcon',
  viewBox: '0 0 24 24',
  path: [
    <line key="line1" x1="18" y1="6" x2="6" y2="18" />,
    <line key="line2" x1="6" y1="6" x2="18" y2="18" />,
  ],
  defaultProps: { ...strokeDefaults, strokeWidth: 2.5 },
})

export const PlayIcon = createIcon({
  displayName: 'PlayIcon',
  viewBox: '0 0 24 24',
  path: [
    <polygon key="triangle" points="5 3 19 12 5 21 5 3" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const StopIcon = createIcon({
  displayName: 'StopIcon',
  viewBox: '0 0 24 24',
  path: [
    <rect key="rect" x="3" y="3" width="18" height="18" rx="2" ry="2" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const CommitIcon = createIcon({
  displayName: 'CommitIcon',
  viewBox: '0 0 24 24',
  path: [
    <circle key="c" cx="12" cy="12" r="4" />,
    <line key="l1" x1="1.05" y1="12" x2="7" y2="12" />,
    <line key="l2" x1="17.01" y1="12" x2="22.96" y2="12" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const PushIcon = createIcon({
  displayName: 'PushIcon',
  viewBox: '0 0 24 24',
  path: [
    <line key="line" x1="12" y1="19" x2="12" y2="5" />,
    <polyline key="arrow" points="5 12 12 5 19 12" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const PullIcon = createIcon({
  displayName: 'PullIcon',
  viewBox: '0 0 24 24',
  path: [
    <line key="line" x1="12" y1="5" x2="12" y2="19" />,
    <polyline key="arrow" points="5 12 12 19 19 12" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const HistoryIcon = createIcon({
  displayName: 'HistoryIcon',
  viewBox: '0 0 24 24',
  path: [
    <circle key="c" cx="12" cy="12" r="9" />,
    <polyline key="hand" points="12 7 12 12 15 14" />,
  ],
  defaultProps: { ...strokeDefaults },
})

export const LogsIcon = createIcon({
  displayName: 'LogsIcon',
  viewBox: '0 0 24 24',
  path: [
    <line key="l1" x1="4" y1="6" x2="20" y2="6" />,
    <line key="l2" x1="4" y1="10" x2="14" y2="10" />,
    <line key="l3" x1="4" y1="14" x2="18" y2="14" />,
    <line key="l4" x1="4" y1="18" x2="12" y2="18" />,
  ],
  defaultProps: { ...strokeDefaults },
})
