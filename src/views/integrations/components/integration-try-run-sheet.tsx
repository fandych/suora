import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { IntegrationExecutionRecord } from "@/data/domain/models"

type IntegrationTryRunSheetProps = {
  executions: IntegrationExecutionRecord[]
  input: string
  isOpen: boolean
  isRunning: boolean
  onChangeInput: (value: string) => void
  onOpenChange: (open: boolean) => void
  onRun: () => void
}

export function IntegrationTryRunSheet({ executions, input, isOpen, isRunning, onChangeInput, onOpenChange, onRun }: IntegrationTryRunSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Try run</SheetTitle>
          <SheetDescription>Execute the current draft with custom JSON input and inspect recent outputs.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 sm:px-5">
          <div className="space-y-4">
            <Textarea value={input} onChange={(event) => onChangeInput(event.target.value)} rows={12} className="font-mono" />
            <div className="space-y-2">
              <div className="text-sm font-medium">Recent executions</div>
              {executions.length ? executions.slice(0, 8).map((execution) => (
                <div key={execution.id} className="rounded-xl border p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium uppercase text-foreground">{execution.status}</span>
                    <span className="text-muted-foreground">{new Date(execution.createdAt).toLocaleString()}</span>
                  </div>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap text-muted-foreground">{execution.output}</pre>
                </div>
              )) : <div className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">No executions yet.</div>}
            </div>
          </div>
        </div>
        <SheetFooter className="border-t">
          <Button onClick={onRun} disabled={isRunning}>{isRunning ? "Running..." : "Run draft"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}