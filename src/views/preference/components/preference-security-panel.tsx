import { Badge } from "@/components/ui/badge"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { PreferenceSettings } from "@/data/repositories/preference-repository"

import PreferenceSectionCard from "@/views/preference/components/preference-section-card"

type PreferenceSecurityPanelProps = {
  draft: PreferenceSettings
  onChange: (patch: Partial<PreferenceSettings>) => void
}

function joinLines(values: string[]) {
  return values.join("\n")
}

function splitLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
}

const PreferenceSecurityPanel = ({ draft, onChange }: PreferenceSecurityPanelProps) => {
  return (
    <PreferenceSectionCard id="security" title="Security" description="Execution, SSL certificates, and file access rules.">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">Enforced</Badge>
        <span>Workspace commands, file tools, and network connections respect these preferences inside the desktop runtime.</span>
      </div>
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <Field className="md:col-span-2 rounded-lg border p-4" orientation="horizontal">
          <FieldContent>
            <FieldTitle>Ignore SSL / CA certificate validation</FieldTitle>
            <FieldDescription>
              Bypass CA and SSL certificate verification for HTTPS requests, LLM model APIs, and WebHooks. Enable this if your environment uses custom CA certificates, self-signed certs, or enterprise proxy inspection.
            </FieldDescription>
          </FieldContent>
          <Switch
            id="preference-ignore-ssl-errors"
            checked={draft.ignoreSslErrors}
            onCheckedChange={(checked) => onChange({ ignoreSslErrors: checked })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-command-confirm">Command confirmation</FieldLabel>
          <NativeSelect id="preference-command-confirm" className="w-full" value={draft.commandConfirmationMode} onChange={(event) => onChange({ commandConfirmationMode: event.target.value as PreferenceSettings["commandConfirmationMode"] })}>
            <NativeSelectOption value="daily">Prompt once per day</NativeSelectOption>
            <NativeSelectOption value="never">Never prompt</NativeSelectOption>
            <NativeSelectOption value="always">Prompt every time</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-file-policy">File access policy</FieldLabel>
          <NativeSelect id="preference-file-policy" className="w-full" value={draft.fileAccessPolicy} onChange={(event) => onChange({ fileAccessPolicy: event.target.value as PreferenceSettings["fileAccessPolicy"] })}>
            <NativeSelectOption value="allowlist">Allowlist directories</NativeSelectOption>
            <NativeSelectOption value="denylist">Denylist directories</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field className="md:col-span-2">
          <FieldContent>
            <FieldTitle>{draft.fileAccessPolicy === "allowlist" ? "Allowed directories" : "Blocked directories"}</FieldTitle>
          </FieldContent>
          <Textarea rows={6} className="font-mono text-xs" value={joinLines(draft.fileAccessDirectories)} onChange={(event) => onChange({ fileAccessDirectories: splitLines(event.target.value) })} placeholder={draft.fileAccessPolicy === "allowlist" ? "src\ndocs" : "node_modules\nsecrets"} />
        </Field>
        <Field className="md:col-span-2">
          <FieldContent>
            <FieldTitle>Command allowlist</FieldTitle>
          </FieldContent>
          <Textarea rows={6} className="font-mono text-xs" value={joinLines(draft.commandAllowlist)} onChange={(event) => onChange({ commandAllowlist: splitLines(event.target.value) })} placeholder="git\nnode\nnpm\nrg" />
        </Field>
        <Field className="md:col-span-2">
          <FieldContent>
            <FieldTitle>Command blacklist</FieldTitle>
          </FieldContent>
          <Textarea rows={6} className="font-mono text-xs" value={joinLines(draft.commandBlacklist)} onChange={(event) => onChange({ commandBlacklist: splitLines(event.target.value) })} placeholder="rm -rf\nshutdown\nformat" />
        </Field>
      </FieldGroup>
    </PreferenceSectionCard>
  )
}

export default PreferenceSecurityPanel