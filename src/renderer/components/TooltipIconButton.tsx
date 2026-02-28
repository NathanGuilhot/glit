import { IconButton, Tooltip } from '@chakra-ui/react'

interface TooltipIconButtonProps {
  label: string
  icon: React.ReactElement
  onClick: () => void
  ariaLabel?: string
  placement?: 'top' | 'bottom'
}

export function TooltipIconButton({ label, icon, onClick, ariaLabel, placement = 'top' }: TooltipIconButtonProps) {
  return (
    <Tooltip label={label} placement={placement} openDelay={200}>
      <IconButton
        aria-label={ariaLabel ?? label}
        icon={icon}
        size="xs"
        variant="ghost"
        colorScheme="whiteAlpha"
        onClick={onClick}
      />
    </Tooltip>
  )
}
