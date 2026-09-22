import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldGroup, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAppIntl } from "@/lib/i18n"
import type { PreferenceEnvironmentVariable, PreferenceSettings } from "@/services/preference-service"

import PreferenceSectionCard from "@/pages/preference/components/preference-section-card"

type PreferenceGlobalEnvironmentPanelProps = {
  draft: PreferenceSettings
  onChange: (patch: Partial<PreferenceSettings>) => void
}

function createVariable(): PreferenceEnvironmentVariable {
  return {
    key: "",
    value: "",
  }
}

const PreferenceGlobalEnvironmentPanel = ({ draft, onChange }: PreferenceGlobalEnvironmentPanelProps) => {
  const { t } = useAppIntl()

  const updateVariable = (index: number, patch: Partial<PreferenceEnvironmentVariable>) => {
    onChange({
      globalEnvironmentVariables: draft.globalEnvironmentVariables.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    })
  }

  const addVariable = () => {
    onChange({
      globalEnvironmentVariables: [...draft.globalEnvironmentVariables, createVariable()],
    })
  }

  const removeVariable = (index: number) => {
    onChange({
      globalEnvironmentVariables: draft.globalEnvironmentVariables.filter((_, itemIndex) => itemIndex !== index),
    })
  }

  return (
    <PreferenceSectionCard
      id="global-environment"
      title={t("preference.globalEnvironment.title", "Global Environment Variables")}
      description={t("preference.globalEnvironment.description", "Command environment variables.")}
      actions={
        <Button size="sm" variant="outline" onClick={addVariable}>
          {t("preference.globalEnvironment.add", "Add variable")}
        </Button>
      }
    >
      <Field className="rounded-lg border p-4" orientation="horizontal">
        <FieldContent>
          <FieldTitle>{t("preference.globalEnvironment.runtimeInjection", "Command runtime injection")}</FieldTitle>
        </FieldContent>
      </Field>
      <FieldGroup>
        {draft.globalEnvironmentVariables.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            {t("preference.globalEnvironment.empty", "No global environment variables configured yet.")}
          </div>
        ) : null}
        {draft.globalEnvironmentVariables.map((item, index) => (
          <div
            key={`env-${index}`}
            className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]"
          >
            <Input
              value={item.key}
              onChange={(event) => updateVariable(index, { key: event.target.value })}
              placeholder="KEY"
              className="font-mono text-sm"
            />
            <Input
              value={item.value}
              onChange={(event) => updateVariable(index, { value: event.target.value })}
              placeholder="value"
              className="font-mono text-sm"
            />
            <Button
              size="icon-sm"
              variant="destructive"
              aria-label={t("preference.globalEnvironment.delete", "Delete variable {name}", {
                name: item.key || index + 1,
              })}
              title={t("preference.globalEnvironment.deleteAction", "Delete variable")}
              onClick={() => removeVariable(index)}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        ))}
      </FieldGroup>
    </PreferenceSectionCard>
  )
}

export default PreferenceGlobalEnvironmentPanel
