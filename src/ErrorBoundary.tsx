import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
  componentStack: string
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    componentStack: '',
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({
      error,
      componentStack: info.componentStack ?? '',
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#111',
            color: '#ff6b6b',
            padding: '20px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          <h2>ERROR DE REACT</h2>

          <strong>Mensaje:</strong>
          <div>{this.state.error?.message}</div>

          <br />

          <strong>Detalle:</strong>
          <div>{this.state.error?.stack}</div>

          <br />

          <strong>Componente:</strong>
          <div>{this.state.componentStack}</div>
        </div>
      )
    }

    return this.props.children
  }
}