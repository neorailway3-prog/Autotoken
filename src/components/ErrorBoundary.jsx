import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d0d', color: '#fff', padding: 20 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Panel crash ho gaya</p>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 16, wordBreak: 'break-word', fontFamily: 'monospace' }}>
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#dc2626', color: '#fff', border: 0, padding: '10px 24px', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}