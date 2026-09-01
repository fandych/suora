import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Card, CardContent } from "@/components/ui/card"
import { CircleAlertIcon, Loader2Icon } from "lucide-react"

export const LoadingCard = ({ title }: { title: string }) => {
  return (
    <Card>
      <CardContent className="flex min-h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          <span>{title}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export const ErrorCard = ({ error, onRetry }: { error: Error; onRetry?: () => void }) => {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon className="size-4" />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
      {onRetry ? (
        <div className="pt-3">
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </Alert>
  )
}

export const EmptyCard = ({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) => {
  return (
    <Card>
      <CardContent>
        <Empty className="border border-dashed border-border bg-muted/20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleAlertIcon />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
          {action}
        </Empty>
      </CardContent>
    </Card>
  )
}