import { Component, type ReactNode } from 'react';
import { ErrorState } from '@teamhub/ui';

/** A crashing tab never takes down the shell (spec P2). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('[TeamHub]', error);
  }
  render() {
    if (this.state.error) {
      return <ErrorState title="This page hit a problem" error={this.state.error} retry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
