import { PlayIcon, SaveIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type WorkflowRevisionActionsProps = {
  canSave: boolean
  onSave: () => void
  canTryRun: boolean
  onOpenTryRun: () => void
}

export function WorkflowRevisionActions({ canSave, onSave, canTryRun, onOpenTryRun }: WorkflowRevisionActionsProps) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-2xl border bg-background/95 px-1 shadow-sm backdrop-blur">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="h-8"
                size="icon-sm"
                variant="outline"
                onClick={onSave}
                disabled={!canSave}
                aria-label="Save workflow"
              />
            }
          >
            <SaveIcon />
          </TooltipTrigger>
          <TooltipContent>Save</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="h-8"
                size="icon-sm"
                variant="outline"
                onClick={onOpenTryRun}
                disabled={!canTryRun}
                aria-label="Try run workflow"
              />
            }
          >
            <PlayIcon />
          </TooltipTrigger>
          <TooltipContent>Try run</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
