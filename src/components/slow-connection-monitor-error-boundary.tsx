"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { logSlowConnectionMonitorError } from "@/components/slow-connection-monitor-logger";

interface SlowConnectionMonitorErrorBoundaryProps {
  children: ReactNode;
}

interface SlowConnectionMonitorErrorBoundaryState {
  hasError: boolean;
}

export class SlowConnectionMonitorErrorBoundary extends Component<
  SlowConnectionMonitorErrorBoundaryProps,
  SlowConnectionMonitorErrorBoundaryState
> {
  state: SlowConnectionMonitorErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SlowConnectionMonitorErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logSlowConnectionMonitorError("render failed; monitor disabled for this app session", error, {
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
