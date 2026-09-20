import { useEffect, useState } from "react"
import { useParams } from "react-router"
import { useNavigate } from "react-router"
import { EllipsisIcon, SlashIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ProviderConfigRecord } from "@/types/agent"
import type { ProviderPreset } from "@/types/agent"
import { emitDataChanged } from "@/services/data-events"
import { ModelApi } from "@/services/model-service"
import { showToast } from "@/services/toast-service"
import PageHeader from "@/pages/components/page-header"
import { ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import { ConfirmDeleteDialog } from "@/pages/components/confirm-delete-dialog"
import { ModelFormDialog, createModelFormState, type ModelFormState } from "@/pages/models/components/model-form-dialog"
import { ProviderLogoBadge } from "@/pages/models/components/provider-logo-badge"
import { ProviderModelList } from "@/pages/models/components/provider-model-list"
import { ProviderSettingsForm } from "@/pages/models/components/provider-settings-form"
import { useModelDetailStore } from "@/stores/model-detail-store"

const ModelsDetailPage = () => {
  const { modelId } = useParams<{ modelId: string }>()
  const navigate = useNavigate()
  const { draft, error, isLoading, load, updateDraft, save, reload } = useModelDetailStore()
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false)
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null)
  const [isRefreshingModels, setIsRefreshingModels] = useState(false)
  const [modelForm, setModelForm] = useState<ModelFormState>(createModelFormState())
  const [presets, setPresets] = useState<ProviderPreset[]>([])
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(null)
  const [canConfigureModels, setCanConfigureModels] = useState(false)
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false)
  const [discoveryState, setDiscoveryState] = useState({
    capable: false,
    enabled: false,
    reason: null as string | null,
  })

  const persistedProvider = draft

  const persistProvider = async (nextProvider: ProviderConfigRecord) => {
    updateDraft(nextProvider)
    const saved = await save()
    if (!saved) return nextProvider
    emitDataChanged("/models")
    return saved
  }

  useEffect(() => {
    if (modelId) void load(modelId)
  }, [load, modelId])

  const hasApiKey = Boolean(draft?.apiKey.trim() || draft?.apiKeyConfigured)
  useEffect(() => {
    void ModelApi.listPresets().then((items) => setPresets(items as ProviderPreset[]))
  }, [])

  useEffect(() => {
    void ModelApi.getPreset(draft?.providerType ?? "openai").then((preset) =>
      setSelectedPreset(preset as ProviderPreset),
    )
    if (!draft) {
      setCanConfigureModels(false)
      return
    }
    void Promise.all([ModelApi.allowsNoKey(draft.providerType), ModelApi.getDiscoveryState(draft)]).then(
      ([allowsNoKey, state]) => {
        setCanConfigureModels(hasApiKey || allowsNoKey)
        setDiscoveryState(state as typeof discoveryState)
      },
    )
  }, [draft, hasApiKey])

  const handleSave = async () => {
    if (!draft) return
    await persistProvider(draft)
  }

  const handleDeleteProvider = async () => {
    if (!draft) {
      return
    }

    await persistProvider({
      ...draft,
      apiKey: "",
      apiKeyConfigured: false,
      enabled: false,
      models: draft.models.map((model) => ({ ...model, enabled: false })),
    })
    setIsDisconnectDialogOpen(false)
    navigate("/models")
  }

  const handleToggleProvider = () => {
    if (draft) void persistProvider({ ...draft, enabled: !draft.enabled })
  }

  const canToggleProvider = canConfigureModels && Boolean(draft?.models.some((model) => model.enabled))

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
    if (modelForm.contextWindow < 1 || modelForm.maxOutputTokens < 1) {
      showToast({
        title: "Invalid model limits",
        description: "Context window and max output tokens must both be at least 1.",
        type: "warning",
      })
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
      models:
        editingModelIndex === null
          ? [...draft.models, nextModel]
          : draft.models.map((model, index) => (index === editingModelIndex ? nextModel : model)),
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
      models: draft.models.map((model, cursor) => (cursor === index ? { ...model, enabled } : model)),
    })
  }

  const handleProviderTypeChange = (providerType: string) => {
    if (!draft) return
    void Promise.all([
      ModelApi.getPreset(draft.providerType),
      ModelApi.getPreset(providerType),
      ModelApi.getDefaultBaseUrl(draft.providerType),
      ModelApi.getDefaultBaseUrl(providerType),
    ]).then(([currentPreset, nextPreset, previousDefault, nextDefault]) => {
      const shouldReplaceBaseUrl = !draft.baseUrl || draft.baseUrl === previousDefault
      updateDraft({
        ...draft,
        title: !draft.title || draft.title === currentPreset.title ? nextPreset.title : draft.title,
        providerType,
        baseUrl: shouldReplaceBaseUrl ? nextDefault : draft.baseUrl,
        models: nextPreset.models,
      })
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
      const result = await ModelApi.discover(draft)
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
        description={draft?.description || selectedPreset?.description}
        leading={
          draft ? (
            <ProviderLogoBadge providerType={draft.providerType} className="size-9" iconClassName="size-4.5" />
          ) : null
        }
        actions={
          draft ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" aria-label="Provider actions" title="Provider actions" />}
              >
                <EllipsisIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 min-w-44">
                <DropdownMenuItem disabled={!canToggleProvider} onClick={handleToggleProvider}>
                  <SlashIcon />
                  {draft.enabled ? "Disable" : "Enable"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setIsDisconnectDialogOpen(true)}>
                  <Trash2Icon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
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
                  docsUrl={selectedPreset?.docsUrl}
                  canConfigureModels={canConfigureModels}
                  onChange={updateDraft}
                  onOpenDocs={(url) => {
                    void window.app?.tools.openExternal(url)
                  }}
                  onProviderTypeChange={handleProviderTypeChange}
                  onSave={handleSave}
                  presets={presets}
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
      <ConfirmDeleteDialog
        open={isDisconnectDialogOpen}
        onOpenChange={setIsDisconnectDialogOpen}
        onConfirm={() => void handleDeleteProvider()}
        title="Disconnect provider?"
        description="This disables the provider and clears its stored API key. It stays in the catalog and can be reconnected later."
      />
    </div>
  )
}

export default ModelsDetailPage
