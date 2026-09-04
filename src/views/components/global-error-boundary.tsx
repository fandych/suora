import { Component, type ErrorInfo, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { AlertTriangleIcon, HomeIcon, RotateCcwIcon } from "lucide-react"

type GlobalErrorBoundaryProps = {
  children: ReactNode
}

type GlobalErrorBoundaryState = {
  error: Error | null
}

export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  state: GlobalErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Global render error", error, errorInfo)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_35%),linear-gradient(180deg,transparent,rgba(15,23,42,0.03))] p-6">
        <Card className="w-full max-w-xl shadow-sm">
          <CardHeader>
            <CardTitle>Application error</CardTitle>
            <CardDescription>
              An unexpected error interrupted the current view.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Empty className="border border-dashed border-border bg-muted/30">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertTriangleIcon />
                </EmptyMedia>
                <EmptyTitle>Something went wrong</EmptyTitle>
                <EmptyDescription>
                  Reload the app, or return to the dashboard and reopen the current item.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row justify-center gap-2">
                <Button variant="outline" onClick={() => window.history.back()}>
                  <RotateCcwIcon />
                  Back
                </Button>
                <Button onClick={() => { window.location.hash = "#/dashboard" }}>
                  <HomeIcon />
                  Dashboard
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  <RotateCcwIcon />
                  Reload
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      </div>
    )
  }
}