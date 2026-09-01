import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type CreateSplitButtonProps = {
  className?: string
  createLabel: string
  disabled?: boolean
  importLabel?: string
  onCreate: () => void | Promise<void>
  onImport: () => void
}

export function CreateSplitButton({ className, createLabel, disabled = false, importLabel = "Import zip", onCreate, onImport }: CreateSplitButtonProps) {
  return (
    <ButtonGroup className={cn(className)}>
      <Button size="sm" onClick={() => void onCreate()} disabled={disabled}>{createLabel}</Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={disabled} aria-label={`${createLabel} options`} />}>
          <ChevronDownIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onImport}>{importLabel}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
