import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Box,
  HStack,
  VStack,
  Text,
  IconButton,
  Tooltip,
  Spinner,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { FileDiff, DiffHunk, DiffLine } from '../../../shared/types'

interface DiffViewerProps {
  diff: FileDiff | null
  loading: boolean
  selectedLines: Set<string>
  scrollRef?: React.RefObject<HTMLDivElement>
  onToggleLine: (key: string, shiftKey: boolean) => void
  onRevertFile: () => void
  onRevertLines: () => void
  onRevertHunk: (hunkIdx: number) => void
  onApplyEdit: (lineNumber: number, newContent: string) => void
  onDeleteLine: (lineNumber: number) => void
}

const addBg = 'rgba(46, 160, 67, 0.15)'
const addBgHover = 'rgba(46, 160, 67, 0.25)'
const addBgSelected = 'rgba(46, 160, 67, 0.35)'
const removeBg = 'rgba(248, 81, 73, 0.15)'
const removeBgHover = 'rgba(248, 81, 73, 0.25)'
const removeBgSelected = 'rgba(248, 81, 73, 0.35)'

function EditableLineContent({
  content,
  lineNumber,
  onApplyEdit,
  onDeleteLine,
}: {
  content: string
  lineNumber: number
  onApplyEdit: (lineNumber: number, newContent: string) => void
  onDeleteLine: (lineNumber: number) => void
}) {
  const [value, setValue] = useState(content)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setValue(content)
  }, [content])

  const handleBlur = useCallback(() => {
    setFocused(false)
    if (value !== content) {
      onApplyEdit(lineNumber, value)
    }
  }, [value, content, lineNumber, onApplyEdit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd
      const newValue = value.slice(0, start) + '  ' + value.slice(end)
      setValue(newValue)
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2
      })
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
    if (e.key === 'Escape') {
      setValue(content)
      e.currentTarget.blur()
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && value === '') {
      e.preventDefault()
      onDeleteLine(lineNumber)
      e.currentTarget.blur()
    }
  }, [value, content, lineNumber, onDeleteLine])

  return (
    <Box
      as="textarea"
      ref={ref}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      fontFamily="mono"
      fontSize="12px"
      lineHeight="20px"
      bg="transparent"
      border="none"
      outline="none"
      color="whiteAlpha.900"
      w="full"
      h="20px"
      p={0}
      m={0}
      resize="none"
      overflow="hidden"
      whiteSpace="pre"
      borderLeft={focused ? '2px solid' : '2px solid transparent'}
      borderLeftColor={focused ? 'brand.400' : 'transparent'}
      pl={focused ? '2px' : '4px'}
      _focus={{ outline: 'none', boxShadow: 'none' }}
      spellCheck={false}
      rows={1}
    />
  )
}

function DiffLineRow({
  line,
  hunkIdx,
  lineIdx,
  isSelected,
  onToggleLine,
  onApplyEdit,
  onDeleteLine,
}: {
  line: DiffLine
  hunkIdx: number
  lineIdx: number
  isSelected: boolean
  onToggleLine: (key: string, shiftKey: boolean) => void
  onApplyEdit: (lineNumber: number, newContent: string) => void
  onDeleteLine: (lineNumber: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const key = `${hunkIdx}:${lineIdx}`

  let bg = 'transparent'
  let hoverBg = 'whiteAlpha.50'
  if (line.type === 'add') {
    bg = isSelected ? addBgSelected : addBg
    hoverBg = isSelected ? addBgSelected : addBgHover
  } else if (line.type === 'remove') {
    bg = isSelected ? removeBgSelected : removeBg
    hoverBg = isSelected ? removeBgSelected : removeBgHover
  } else if (isSelected) {
    bg = 'whiteAlpha.100'
    hoverBg = 'whiteAlpha.100'
  }

  const isEditable = line.type !== 'remove'

  return (
    <HStack
      spacing={0}
      bg={hovered ? hoverBg : bg}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      h="20px"
      minH="20px"
      transition="background 0.05s"
    >
      {/* Gutter: line select + old line number + new line number */}
      <HStack
        spacing={0}
        flexShrink={0}
        userSelect="none"
        cursor="pointer"
        onClick={e => {
          if (line.type !== 'context') onToggleLine(key, e.shiftKey)
        }}
      >
        <Text
          w="40px"
          textAlign="right"
          pr="8px"
          fontSize="11px"
          fontFamily="mono"
          color="whiteAlpha.300"
          lineHeight="20px"
        >
          {line.oldLineNumber ?? ''}
        </Text>
        <Text
          w="40px"
          textAlign="right"
          pr="8px"
          fontSize="11px"
          fontFamily="mono"
          color="whiteAlpha.300"
          lineHeight="20px"
        >
          {line.newLineNumber ?? ''}
        </Text>
      </HStack>

      {/* Prefix */}
      <Text
        w="16px"
        textAlign="center"
        fontSize="12px"
        fontFamily="mono"
        color={line.type === 'add' ? 'green.400' : line.type === 'remove' ? 'red.400' : 'whiteAlpha.300'}
        lineHeight="20px"
        flexShrink={0}
        userSelect="none"
      >
        {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
      </Text>

      {/* Content */}
      <Box flex={1} overflow="hidden" minW={0}>
        {isEditable && line.newLineNumber ? (
          <EditableLineContent
            content={line.content}
            lineNumber={line.newLineNumber}
            onApplyEdit={onApplyEdit}
            onDeleteLine={onDeleteLine}
          />
        ) : (
          <Text
            fontFamily="mono"
            fontSize="12px"
            lineHeight="20px"
            color="whiteAlpha.900"
            whiteSpace="pre"
            overflowX="auto"
            px="4px"
          >
            {line.content}
          </Text>
        )}
      </Box>
    </HStack>
  )
}

function HunkHeader({
  hunk,
  hunkIdx,
  onRevertHunk,
}: {
  hunk: DiffHunk
  hunkIdx: number
  onRevertHunk: (hunkIdx: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const { t } = useTranslation()
  // Extract the function context from the header
  const contextMatch = hunk.header.match(/@@ .+? @@(.*)/)
  const context = contextMatch?.[1]?.trim() ?? ''

  return (
    <HStack
      bg="whiteAlpha.50"
      px={2}
      py={0.5}
      spacing={2}
      borderTop="1px solid"
      borderColor="whiteAlpha.100"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Text
        fontSize="11px"
        fontFamily="mono"
        color="whiteAlpha.400"
        flex={1}
        noOfLines={1}
      >
        {`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`}{' '}
        {context && <Text as="span" color="whiteAlpha.500">{context}</Text>}
      </Text>
      <Tooltip label={t('codeReview.discardHunk')} openDelay={200} placement="left">
        <IconButton
          aria-label={t('codeReview.discardHunk')}
          size="xs"
          variant="ghost"
          colorScheme="red"
          h="18px"
          minW="18px"
          opacity={hovered ? 1 : 0}
          transition="opacity 0.1s"
          onClick={() => onRevertHunk(hunkIdx)}
        />
      </Tooltip>
    </HStack>
  )
}

export function DiffViewer({
  diff,
  loading,
  selectedLines,
  scrollRef,
  onToggleLine,
  onRevertFile,
  onRevertLines,
  onRevertHunk,
  onApplyEdit,
  onDeleteLine,
}: DiffViewerProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <VStack flex={1} justify="center" align="center" h="full">
        <Spinner size="md" color="brand.400" />
      </VStack>
    )
  }

  if (!diff) {
    return (
      <VStack flex={1} justify="center" align="center" h="full">
        <Text fontSize="sm" color="whiteAlpha.400">
          {t('codeReview.selectFilePrompt')}
        </Text>
      </VStack>
    )
  }

  if (diff.isBinary) {
    return (
      <VStack flex={1} justify="center" align="center" h="full">
        <Text fontSize="sm" color="whiteAlpha.400">
          {t('codeReview.binaryFile')}
        </Text>
      </VStack>
    )
  }

  if (diff.hunks.length === 0) {
    return (
      <VStack flex={1} justify="center" align="center" h="full">
        <Text fontSize="sm" color="whiteAlpha.400">
          {t('codeReview.noChanges')}
        </Text>
      </VStack>
    )
  }

  return (
    <VStack flex={1} h="full" minH={0} spacing={0} align="stretch" overflow="hidden">
      {/* Toolbar */}
      <HStack
        px={3}
        py={2}
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
        bg="gray.800"
        flexShrink={0}
      >
        <Text fontSize="xs" fontFamily="mono" color="whiteAlpha.700" flex={1} noOfLines={1}>
          {diff.oldPath ? `${diff.oldPath} → ${diff.path}` : diff.path}
        </Text>
        <HStack spacing={1}>
          {selectedLines.size > 0 && (
            <Tooltip label={t('codeReview.revertSelectedLines', { count: selectedLines.size })} openDelay={200}>
              <IconButton
                aria-label={t('codeReview.revertSelectedLines', { count: selectedLines.size })}
                icon={<Text fontSize="11px">{`↩ ${selectedLines.size}`}</Text>}
                size="xs"
                variant="ghost"
                colorScheme="red"
                onClick={onRevertLines}
              />
            </Tooltip>
          )}
          <Tooltip label={t('codeReview.revertFile')} openDelay={200}>
            <IconButton
              aria-label={t('codeReview.revertFile')}
              icon={<Text fontSize="11px">↩</Text>}
              size="xs"
              variant="ghost"
              colorScheme="red"
              onClick={onRevertFile}
            />
          </Tooltip>
        </HStack>
      </HStack>

      {/* Diff content */}
      <Box ref={scrollRef} flex={1} overflowY="auto" overflowX="hidden" minH={0}>
        {diff.hunks.map((hunk, hunkIdx) => (
          <Box key={hunkIdx}>
            <HunkHeader hunk={hunk} hunkIdx={hunkIdx} onRevertHunk={onRevertHunk} />
            {hunk.lines.map((line, lineIdx) => (
              <DiffLineRow
                key={`${hunkIdx}:${lineIdx}`}
                line={line}
                hunkIdx={hunkIdx}
                lineIdx={lineIdx}
                isSelected={selectedLines.has(`${hunkIdx}:${lineIdx}`)}
                onToggleLine={onToggleLine}
                onApplyEdit={onApplyEdit}
                onDeleteLine={onDeleteLine}
              />
            ))}
          </Box>
        ))}
      </Box>
    </VStack>
  )
}
