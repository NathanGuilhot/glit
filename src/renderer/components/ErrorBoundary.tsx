import React, { Component, type ReactNode } from 'react'
import { Flex, Text } from '@chakra-ui/react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
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
        <Flex h="100vh" align="center" justify="center" direction="column" gap={4} p={8}>
          <Text fontSize="2xl">Something went wrong</Text>
          <Text color="red.400" fontFamily="mono" fontSize="sm">
            {this.state.error?.message}
          </Text>
          <button onClick={() => this.setState({ hasError: false, error: null })}>Try Again</button>
        </Flex>
      )
    }
    return this.props.children
  }
}
