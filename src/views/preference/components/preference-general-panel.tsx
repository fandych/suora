import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { PreferenceSettings } from "@/data/repositories/preference-repository"

import PreferenceSectionCard from "@/views/preference/components/preference-section-card"

type PreferenceGeneralPanelProps = {
  draft: PreferenceSettings
  onChange: (patch: Partial<PreferenceSettings>) => void
}

const PreferenceGeneralPanel = ({ draft, onChange }: PreferenceGeneralPanelProps) => {
  return (
    <PreferenceSectionCard id="general" title="General" description="Appearance and workspace defaults.">
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="preference-theme-mode">Theme mode</FieldLabel>
          <NativeSelect id="preference-theme-mode" className="w-full" value={draft.themeMode} onChange={(event) => onChange({ themeMode: event.target.value as PreferenceSettings["themeMode"] })}>
            <NativeSelectOption value="system">System</NativeSelectOption>
            <NativeSelectOption value="light">Light</NativeSelectOption>
            <NativeSelectOption value="dark">Dark</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-theme-accent">Theme accent</FieldLabel>
          <NativeSelect id="preference-theme-accent" className="w-full" value={draft.themeAccent} onChange={(event) => onChange({ themeAccent: event.target.value as PreferenceSettings["themeAccent"] })}>
            <NativeSelectOption value="ocean">Ocean</NativeSelectOption>
            <NativeSelectOption value="forest">Forest</NativeSelectOption>
            <NativeSelectOption value="amber">Amber</NativeSelectOption>
            <NativeSelectOption value="rose">Rose</NativeSelectOption>
            <NativeSelectOption value="slate">Slate</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-font-scale">Font size</FieldLabel>
          <NativeSelect id="preference-font-scale" className="w-full" value={draft.fontScale} onChange={(event) => onChange({ fontScale: event.target.value as PreferenceSettings["fontScale"] })}>
            <NativeSelectOption value="sm">Compact</NativeSelectOption>
            <NativeSelectOption value="md">Default</NativeSelectOption>
            <NativeSelectOption value="lg">Large</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-language">Language</FieldLabel>
          <NativeSelect id="preference-language" className="w-full" value={draft.language} onChange={(event) => onChange({ language: event.target.value as PreferenceSettings["language"] })}>
            <NativeSelectOption value="zh">中文</NativeSelectOption>
            <NativeSelectOption value="en">English</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-workspace-name">Workspace name</FieldLabel>
          <Input id="preference-workspace-name" value={draft.workspaceName} onChange={(event) => onChange({ workspaceName: event.target.value })} placeholder="SUORA Workspace" />
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-workspace-path">Workspace path</FieldLabel>
          <Input id="preference-workspace-path" value={draft.workspacePath} onChange={(event) => onChange({ workspacePath: event.target.value })} placeholder="C:/Users/.../workspace" />
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-default-provider">Default model provider</FieldLabel>
          <Input id="preference-default-provider" value={draft.defaultModelProviderId} onChange={(event) => onChange({ defaultModelProviderId: event.target.value })} placeholder="provider-openai" />
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-chat-timeout">Chat request timeout</FieldLabel>
          <Input id="preference-chat-timeout" type="number" min="0" step="1000" value={String(draft.chatRequestTimeoutMs)} onChange={(event) => onChange({ chatRequestTimeoutMs: Math.max(0, Number(event.target.value) || 0) })} placeholder="0" />
        </Field>
        <Field className="md:col-span-2" orientation="horizontal">
          <FieldContent>
            <FieldTitle>Auto-save conversations</FieldTitle>
          </FieldContent>
          <Switch checked={draft.autoSaveConversations} onCheckedChange={(checked) => onChange({ autoSaveConversations: checked })} />
        </Field>
        <Field className="md:col-span-2" orientation="horizontal">
          <FieldContent>
            <FieldTitle>Launch on startup</FieldTitle>
          </FieldContent>
          <Switch checked={draft.autoStartEnabled} onCheckedChange={(checked) => onChange({ autoStartEnabled: checked })} />
        </Field>
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="preference-notes">Operator notes</FieldLabel>
          <Textarea id="preference-notes" rows={6} value={draft.notes} onChange={(event) => onChange({ notes: event.target.value })} placeholder="Add internal notes for this desktop workspace." />
        </Field>
      </FieldGroup>
    </PreferenceSectionCard>
  )
}

export default PreferenceGeneralPanel