import { useEffect, useState } from "react"
import { useParams } from "react-router"
import { useNavigate } from "react-router"

import { Badge } from "@/components/ui/badge"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { ProviderConfigRecord } from "@/data/domain/models"
import { emitDataChanged } from "@/data/repositories/data-events"
import { deleteModelProvider, discoverProviderModelCatalog, getDefaultProviderBaseUrl, getModelProvider, getProviderModelDiscoveryState, getProviderPreset, providerAllowsNoKey, saveModelProvider } from "@/data/repositories/model-config-repository"
import { showToast } from "@/lib/app-toast"
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
  const [isRefreshingModels, setIsRefreshingModels] = useState(false)
  const [modelForm, setModelForm] = useState<ModelFormState>(createModelFormState())

  const persistedProvider = data ?? draft

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
  const hasApiKey = Boolean(draft?.apiKey.trim())
  const canConfigureModels = hasApiKey || providerAllowsNoKey(draft?.providerType ?? "")
  const discoveryState = draft ? getProviderModelDiscoveryState(draft) : { capable: false, enabled: false, reason: null }

  const handleSave = async () => {
    if (!draft) return
    await persistProvider(draft)
  }

  const handleDeleteProvider = async () => {
    if (!draft) {
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
    if (!draft || !persistedProvider || !modelForm.id.trim()) {
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
      ...persistedProvider,
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
    if (!draft || !persistedProvider) {
      return
    }

    void persistProvider({
      ...persistedProvider,
      models: draft.models.filter((_model, cursor) => cursor !== index),
    })
  }

  const handleToggleModel = (index: number, enabled: boolean) => {
    if (!draft || !persistedProvider) {
      return
    }

    void persistProvider({
      ...persistedProvider,
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

  const handleRefreshModels = async () => {
    if (!draft) {
      return
    }

    if (!discoveryState.enabled) {
      showToast({
        title: "Model catalog refresh unavailable",
        description: discoveryState.reason ?? "Remote model discovery is not available for this provider.",
        type: "warning",
      })
      return
    }

    setIsRefreshingModels(true)
    try {
      const result = await discoverProviderModelCatalog(draft)
      await persistProvider(result.provider)
      showToast({
        title: "Model catalog refreshed",
        description: `Loaded ${result.discoveredCount} models from ${result.source}.`,
        type: "success",
      })
    } catch (error) {
      showToast({
        title: "Model catalog refresh failed",
        description: error instanceof Error ? error.message : String(error),
        type: "error",
      })
    } finally {
      setIsRefreshingModels(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.title ?? "Provider"}
        description="Manage endpoint configuration, provider defaults, and the model inventory exposed to chats, agents, and workflows."
        leading={draft ? <ProviderLogoBadge providerType={draft.providerType} className="size-9" iconClassName="size-4.5" /> : null}
        actions={draft ? (
          <>
            <Badge variant="outline">{draft.providerType}</Badge>
            <Badge variant={draft.enabled ? "secondary" : "outline"}>{draft.enabled ? "Enabled" : "Disabled"}</Badge>
          </>
        ) : null}
      />

      <div className="flex-1 overflow-x-hidden p-4">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading provider..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
              <div className="min-w-0 space-y-3">
                <ProviderSettingsForm
                  draft={draft}
                  description={selectedPreset.description}
                  docsUrl={selectedPreset.docsUrl}
                  canConfigureModels={canConfigureModels}
                  canDelete={true}
                  onChange={setDraft}
                  onDelete={handleDeleteProvider}
                  onOpenDocs={(url) => {
                    void window.suora?.tools.openExternal(url)
                  }}
                  onProviderTypeChange={handleProviderTypeChange}
                  onSave={handleSave}
                />
              </div>

              <ProviderModelList
                canConfigureModels={canConfigureModels}
                showRefreshAction={discoveryState.capable}
                refreshDisabledReason={discoveryState.enabled ? null : discoveryState.reason}
                isRefreshingModels={isRefreshingModels}
                models={draft.models}
                onAddModel={handleOpenCreateModel}
                onDeleteModel={handleDeleteModel}
                onEditModel={handleOpenEditModel}
                onRefreshModels={() => void handleRefreshModels()}
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
