import { render, screen, waitFor } from "@testing-library/react"
import type { InputHTMLAttributes, ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"

import ModelSidebar from "@/pages/components/secondary-sidebar/model-sidebar"

const { listAll } = vi.hoisted(() => ({
  listAll: vi.fn(),
}))

vi.mock("@/services/model-service", () => ({
  ModelApi: {
    listAll,
  },
}))

vi.mock("@/services/data-events", () => ({
  subscribeToDataChanges: () => () => undefined,
}))

vi.mock("@/pages/components/provider-logo", () => ({
  getProviderLogo: () => () => <div data-testid="provider-logo" />,
  getProviderBrandClassName: () => "",
}))

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  SidebarGroupLabel: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  SidebarHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SidebarInput: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  SidebarMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children, onClick }: { children?: ReactNode; onClick?: () => void; isActive?: boolean }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  SidebarMenuItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SidebarMenuSkeleton: () => <div>loading</div>,
}))

describe("model sidebar", () => {
  it("derives connected providers directly from the provider model state", async () => {
    listAll.mockResolvedValueOnce([
      {
        id: "provider-openai",
        title: "OpenAI",
        providerType: "openai",
        enabled: true,
        models: [{ id: "gpt-5", name: "GPT-5", enabled: true }],
      },
      {
        id: "provider-anthropic",
        title: "Anthropic",
        providerType: "anthropic",
        enabled: false,
        models: [{ id: "claude", name: "Claude", enabled: false }],
      },
    ])

    render(
      <MemoryRouter>
        <ModelSidebar
          item={{
            title: "Models",
            url: "/models",
            icon: () => null,
            iconClassName: "",
            description: "Models",
            secondarySidebar: {
              searchPlaceholder: "Search models",
              groups: [
                { id: "connected", title: "Connected" },
                { id: "catalog", title: "Catalog" },
              ],
            },
          }}
        />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText("OpenAI")).toBeTruthy()
    })

    expect(screen.getByText("Connected")).toBeTruthy()
    expect(screen.getByText("Catalog")).toBeTruthy()
  })
})
