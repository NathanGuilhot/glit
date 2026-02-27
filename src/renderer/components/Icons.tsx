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
