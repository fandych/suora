import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { ResourceSelectorOption } from "@/types/resource-selector"

export function getEnabledResourceOptions(options: ResourceSelectorOption[]) {
  return options.filter((option) => option.enabled)
}

export function isResourceAvailable(resource: { enabled?: boolean; isDisabled?: boolean }) {
  return resource.enabled !== false && resource.isDisabled !== true
}

type ResourceSelectorProps = Omit<React.ComponentProps<typeof NativeSelect>, "children"> & {
  emptyLabel: string
  options: ResourceSelectorOption[]
}

export function ResourceSelector({ emptyLabel, options, ...props }: ResourceSelectorProps) {
  const enabledOptions = getEnabledResourceOptions(options)

  return (
    <NativeSelect {...props}>
      <NativeSelectOption value="">{emptyLabel}</NativeSelectOption>
      {enabledOptions.map((option) => (
        <NativeSelectOption key={option.id} value={option.id}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
