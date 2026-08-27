import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderEditor } from './ProviderEditor'
import { useAppStore } from '@/store/appStore'

describe('ProviderEditor', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({
      locale: 'en',
      workspacePath: '',
      providerConfigs: [
        {
          id: 'provider-1',
          name: '',
          providerType: 'openai',
          apiKey: '',
          baseUrl: '',
          models: [],
        },
      ],
      models: [],
      selectedModel: null,
    })
  })

  it('keeps save disabled until the provider has a name and an enabled model', () => {
    render(<ProviderEditor providerId="provider-1" onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Save Configuration' })).toBeDisabled()
  })

  it('keeps save disabled for non-ollama providers without an API key', () => {
    useAppStore.setState({
      providerConfigs: [
        {
          id: 'provider-1',
          name: 'OpenAI Work',
          providerType: 'openai',
          apiKey: '',
          baseUrl: '',
          models: [{ modelId: 'gpt-5.4', name: 'GPT-5.4', enabled: true }],
        },
      ],
    })

    render(<ProviderEditor providerId="provider-1" onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Save Configuration' })).toBeDisabled()
  })

  it('allows ollama providers to save without an API key when a model is enabled', () => {
    useAppStore.setState({
      providerConfigs: [
        {
          id: 'provider-1',
          name: 'Local Ollama',
          providerType: 'ollama',
          apiKey: '',
          baseUrl: 'http://localhost:11434/v1',
          models: [{ modelId: 'llama3.1', name: 'Llama 3.1', enabled: true }],
        },
      ],
    })

    render(<ProviderEditor providerId="provider-1" onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Save Configuration' })).toBeEnabled()
  })

  it('disables save after clearing the API key from a non-ollama provider', async () => {
    const user = userEvent.setup()

    useAppStore.setState({
      providerConfigs: [
        {
          id: 'provider-1',
          name: 'OpenAI Work',
          providerType: 'openai',
          apiKey: 'sk-test',
          baseUrl: '',
          models: [{ modelId: 'gpt-5.4', name: 'GPT-5.4', enabled: true }],
        },
      ],
    })

    render(<ProviderEditor providerId="provider-1" onSaved={vi.fn()} />)

    await user.clear(screen.getByPlaceholderText('sk-...'))

    expect(screen.getByRole('button', { name: 'Save Configuration' })).toBeDisabled()
  })

  it('uses a distinct action label when offering to set a model as default', () => {
    useAppStore.setState({
      providerConfigs: [
        {
          id: 'provider-1',
          name: 'OpenAI Work',
          providerType: 'openai',
          apiKey: 'sk-test',
          baseUrl: '',
          models: [{ modelId: 'gpt-5.4', name: 'GPT-5.4', enabled: true }],
        },
      ],
      models: [{
        id: 'provider-1:gpt-5.4',
        name: 'GPT-5.4',
        provider: 'provider-1',
        providerType: 'openai',
        modelId: 'gpt-5.4',
        enabled: true,
      }],
      selectedModel: null,
    })

    render(<ProviderEditor providerId="provider-1" onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Set default/i })).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Default$/i })).not.toBeInTheDocument()
  })

  it('prefills the Ollama base URL when switching the provider type to ollama', async () => {
    const user = userEvent.setup()

    useAppStore.setState({
      providerConfigs: [
        {
          id: 'provider-1',
          name: 'Custom Provider',
          providerType: 'openai-compatible',
          apiKey: '',
          baseUrl: '',
          models: [{ modelId: 'custom-model', name: 'Custom Model', enabled: true }],
        },
      ],
    })

    render(<ProviderEditor providerId="provider-1" onSaved={vi.fn()} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Provider Type' }), 'ollama')

    expect(screen.getByDisplayValue('http://localhost:11434/v1')).toBeVisible()
  })

  it('disables Add Presets when all preset models are already present', () => {
    useAppStore.setState({
      providerConfigs: [
        {
          id: 'provider-1',
          name: 'OpenAI Work',
          providerType: 'openai',
          apiKey: 'sk-test',
          baseUrl: '',
          models: [
            { modelId: 'gpt-5.4', name: 'GPT-5.4', enabled: true },
            { modelId: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', enabled: true },
            { modelId: 'gpt-5', name: 'GPT-5', enabled: true },
            { modelId: 'gpt-4.1', name: 'GPT-4.1', enabled: true },
            { modelId: 'o4-mini', name: 'o4-mini', enabled: true },
          ],
        },
      ],
    })

    render(<ProviderEditor providerId="provider-1" onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Add Presets/i })).toBeDisabled()
  })

  it('lists the runtime-supported provider types in the selector', async () => {
    const user = userEvent.setup()

    useAppStore.setState({
      providerConfigs: [
        {
          id: 'provider-1',
          name: 'Provider matrix',
          providerType: 'openai-compatible',
          apiKey: 'sk-test',
          baseUrl: '',
          models: [{ modelId: 'custom-model', name: 'Custom Model', enabled: true }],
        },
      ],
    })

    render(<ProviderEditor providerId="provider-1" onSaved={vi.fn()} />)

    const select = screen.getByRole('combobox', { name: 'Provider Type' })
    await user.click(select)

    expect(screen.getByRole('option', { name: 'DeepSeek' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Groq' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cohere' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'OpenAI Compatible' })).toBeInTheDocument()
  })
})