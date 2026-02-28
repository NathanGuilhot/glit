import React, { Component, type ReactNode } from 'react'
import { Flex, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

function ErrorDisplay({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const { t } = useTranslation()
  return (
    <Flex h="100vh" align="center" justify="center" direction="column" gap={4} p={8}>
      <Text fontSize="2xl">{t('errorBoundary.title')}</Text>
      <Text color="red.400" fontFamily="mono" fontSize="sm">
        {error?.message}
      </Text>
      <button onClick={onReset}>{t('errorBoundary.tryAgain')}</button>
    </Flex>
  )
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay
          error={this.state.error}
          onReset={() => this.setState({ hasError: false, error: null })}
        />
      )
    }
    return this.props.children
  }
}
