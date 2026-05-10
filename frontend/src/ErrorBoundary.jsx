import React from 'react'

export default class ErrorBoundary extends React.Component {
  state = { error: null, info: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('React error:', error, info)
    this.setState({ info })
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', color: '#991b1b' }}>
          <h2 style={{ color: '#0b2d6b', marginBottom: 8 }}>SILAKHADIR - Error</h2>
          <p style={{ marginBottom: 8 }}>Something went wrong while rendering this page.</p>
          <pre style={{ background: '#fee2e2', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
          {this.state.info?.componentStack && (
            <details style={{ marginTop: 12 }}>
              <summary>Component stack</summary>
              <pre style={{ background: '#f3f4f6', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
                {this.state.info.componentStack}
              </pre>
            </details>
          )}
          <button onClick={() => window.location.reload()}
                  style={{ marginTop: 12, padding: '8px 16px', background: '#0b2d6b', color: 'white', border: 0, borderRadius: 8, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
