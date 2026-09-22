import { Component, type ErrorInfo, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react"

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
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-2xl shadow-sm">
          <CardHeader>
            <CardTitle>View unavailable</CardTitle>
            <CardDescription>
              This item could not be rendered. You can retry without reloading the whole app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Empty className="border border-dashed border-border bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertTriangleIcon />
                </EmptyMedia>
                <EmptyTitle>Something went wrong</EmptyTitle>
                <EmptyDescription>
                  We showed a toast with the error details. Try opening the item again or refresh this view.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row justify-center gap-2">
                <Button variant="outline" onClick={() => window.history.back()}>
                  <RotateCcwIcon />
                  Back
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
