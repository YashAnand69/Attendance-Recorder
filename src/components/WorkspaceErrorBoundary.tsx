import React from "react";

export class WorkspaceErrorBoundary extends React.Component<{children: React.ReactNode}, {failed: boolean}> {
  declare props: {children: React.ReactNode};
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main style={{maxWidth:640,margin:"12vh auto",padding:32}}>
      <h1>Your workspace was interrupted</h1>
      <p>A page or network resource could not load. Reload to reopen your workspace. Saved offline changes remain in this browser.</p>
      <button className="primary-button" onClick={() => window.location.reload()}>Reload workspace</button>
    </main>;
  }
}
