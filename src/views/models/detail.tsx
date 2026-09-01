import { useEffect, useState } from "react"
import { useParams } from "react-router"
import { useNavigate } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { ProviderConfigRecord } from "@/data/domain/models"
import { emitDataChanged } from "@/data/repositories/data-events"
import { deleteModelProvider, getDefaultProviderBaseUrl, getModelProvider, getProviderPreset, saveModelProvider } from "@/data/repositories/model-config-repository"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { ModelFormDialog, createModelFormState, type ModelFormState } from "@/views/models/components/model-form-dialog"
import { ProviderLogoBadge } from "@/views/models/components/provider-logo-badge"
import { ProviderModelList } from "@/views/models/components/provider-model-list"
import { ProviderSettingsForm } from "@/views/models/components/provider-settings-form"

const ModelsDetailPage = () => {
  const { modelId } = useParams<{ modelId: string }>()
  const navigate = useNavigate()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getModelProvider(modelId ?? ""), [modelId])
  const [draft, setDraft] = useState<ProviderConfigRecord | null>(null)
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false)
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null)
  const [modelForm, setModelForm] = useState<ModelFormState>(createModelFormState())

  const persistProvider = async (nextProvider: ProviderConfigRecord) => {
    const saved = await saveModelProvider(nextProvider)
    setData(saved)
    setDraft(saved)
    emitDataChanged("/models")
    return saved
  }

  useEffect(() => {
    if (data) {
      setDraft(data)
    }
  }, [data])

  const selectedPreset = getProviderPreset(draft?.providerType ?? "openai")
  const enabledCount = draft?.models.filter((model) => model.enabled).length ?? 0
  const hasApiKey = Boolean(draft?.apiKey.trim())

  const handleSave = async () => {
    if (!draft) return
    await persistProvider(draft)
  }

  const handleDeleteProvider = async () => {
    if (!draft || draft.providerType !== "custom") {
      return
    }

    await deleteModelProvider(draft.id)
    emitDataChanged("/models")
    navigate("/models")
  }

  const handleOpenCreateModel = () => {
    setEditingModelIndex(null)
    setModelForm(createModelFormState())
    setIsModelDialogOpen(true)
  }

  const handleOpenEditModel = (index: number) => {
    if (!draft) {
      return
    }

    setEditingModelIndex(index)
    setModelForm(createModelFormState(draft.models[index]))
    setIsModelDialogOpen(true)
  }

  const handleSubmitModel = () => {
    if (!draft || !modelForm.id.trim()) {
      return
    }

    const nextModel = {
      id: modelForm.id.trim(),
      name: modelForm.name.trim() || modelForm.id.trim(),
      enabled: modelForm.enabled,
      capabilities: modelForm.capabilities,
      apiModes: modelForm.apiModes,
      contextWindow: modelForm.contextWindow,
      maxOutputTokens: modelForm.maxOutputTokens,
      supportsParallelToolCalls: modelForm.supportsParallelToolCalls,
      supportsReasoning: modelForm.supportsReasoning,
    }

    const nextProvider = {
      ...draft,
      models: editingModelIndex === null
        ? [...draft.models, nextModel]
        : draft.models.map((model, index) => index === editingModelIndex ? nextModel : model),
    }

    void persistProvider(nextProvider).then(() => {
      setIsModelDialogOpen(false)
      setEditingModelIndex(null)
      setModelForm(createModelFormState())
    })
  }

  const handleDeleteModel = (index: number) => {
    if (!draft) {
      return
    }

    void persistProvider({
      ...draft,
      models: draft.models.filter((_model, cursor) => cursor !== index),
    })
  }

  const handleToggleModel = (index: number, enabled: boolean) => {
    if (!draft) {
      return
    }

    void persistProvider({
      ...draft,
      models: draft.models.map((model, cursor) => cursor === index ? { ...model, enabled } : model),
    })
  }

  const handleProviderTypeChange = (providerType: string) => {
    if (!draft) return
    const currentPreset = getProviderPreset(draft.providerType)
    const nextPreset = getProviderPreset(providerType)
    const previousDefault = getDefaultProviderBaseUrl(draft.providerType)
    const nextDefault = getDefaultProviderBaseUrl(providerType)
    const shouldReplaceBaseUrl = !draft.baseUrl || draft.baseUrl === previousDefault
    setDraft({
      ...draft,
      title: !draft.title || draft.title === currentPreset.title ? nextPreset.title : draft.title,
      providerType,
      baseUrl: shouldReplaceBaseUrl ? nextDefault : draft.baseUrl,
      models: nextPreset.models,
    })
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.title ?? "Provider"}
        description="Manage endpoint configuration, provider defaults, and the model inventory exposed to chats, agents, and workflows."
      />

      <div className="flex-1 overflow-x-hidden p-6">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading provider..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <div className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex min-w-0 items-start gap-3">
                      <ProviderLogoBadge providerType={draft.providerType} className="size-12" iconClassName="size-6" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <CardTitle className="truncate">{draft.title}</CardTitle>
                          <Badge variant="outline">{draft.providerType}</Badge>
                          <Badge variant={draft.enabled ? "secondary" : "outline"}>{draft.enabled ? "Enabled" : "Disabled"}</Badge>
                        </div>
                        <CardDescription>{selectedPreset.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-xl border bg-muted/20 px-3 py-3">
                      <div className="text-sm text-muted-foreground">Enabled models</div>
                      <div className="mt-1 text-2xl font-semibold text-foreground">{enabledCount}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {draft.models.length}</span></div>
                    </div>
                    <div className="rounded-xl border bg-muted/20 px-3 py-3 md:col-span-2 xl:col-span-1">
                      <div className="text-sm text-muted-foreground">Resolved endpoint</div>
                      <div className="mt-1 break-all text-sm text-foreground">{draft.baseUrl || selectedPreset.baseUrl || "No base URL configured."}</div>
                    </div>
                  </CardContent>
                </Card>

                <ProviderSettingsForm
                  draft={draft}
                  description="Change provider identity, endpoint, and credentials without leaving the model module."
                  hasApiKey={hasApiKey}
                  canDelete={draft.providerType === "custom"}
                  onChange={setDraft}
                  onDelete={handleDeleteProvider}
                  onProviderTypeChange={handleProviderTypeChange}
                  onSave={handleSave}
                />
              </div>

              <ProviderModelList
                hasApiKey={hasApiKey}
                models={draft.models}
                onAddModel={handleOpenCreateModel}
                onDeleteModel={handleDeleteModel}
                onEditModel={handleOpenEditModel}
                onToggleModel={handleToggleModel}
              />
            </div>
          ) : null}
        </div>
      </div>

      <ModelFormDialog
        form={modelForm}
        mode={editingModelIndex === null ? "create" : "edit"}
        open={isModelDialogOpen}
        onFormChange={setModelForm}
        onOpenChange={(nextOpen) => {
          setIsModelDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditingModelIndex(null)
            setModelForm(createModelFormState())
          }
        }}
        onSubmit={handleSubmitModel}
      />
    </div>
  )
}

export default ModelsDetailPage
