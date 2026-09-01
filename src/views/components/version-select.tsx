import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import type { VersionOption } from "@/data/domain/models"

type VersionSelectProps = {
  versions: VersionOption[]
  value: string
  onChange: (value: string) => void
}

const VersionSelect = ({ versions, value, onChange }: VersionSelectProps) => {
  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value)}>
      {versions.map((version) => (
        <NativeSelectOption key={version.id} value={version.id}>
          {version.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

export default VersionSelect