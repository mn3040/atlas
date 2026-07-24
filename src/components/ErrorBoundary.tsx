import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureClientError } from '../utils/errorMonitoring'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  crashed: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { crashed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const boundaryError = new Error(`${error.message}\n${info.componentStack}`)
    boundaryError.name = error.name
    boundaryError.stack = error.stack
    captureClientError(boundaryError, { source: 'react.error-boundary' })
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-ink px-4 text-center">
          <p className="max-w-sm text-sm font-semibold text-text-dim">Something went wrong. Refresh Atlas and try again.</p>
        </div>
      )
    }

    return this.props.children
  }
}
