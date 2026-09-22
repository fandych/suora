import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"
import { useAppIntl } from "@/lib/i18n"
import { ChannelApi } from "@/services/channel-service"
import { subscribeToDataChanges } from "@/services/data-events"
import type { PrimaryNavItem } from "@/pages/nav-config"
import { getChannelPlatformSidebarLogo } from "@/pages/channels/components/channel-utils"
import type { ChannelSummary } from "@/types/channel"
export default function ChannelSidebar({
  item,
  headerAction,
}: {
  item: PrimaryNavItem
  headerAction?: React.ReactNode
}) {
  const { t } = useAppIntl()
  const [items, setItems] = useState<
    Array<{
      id: string
      title: string
      platform: ChannelSummary["platform"]
      customPlatformName?: string
      bindingState?: string
      catalogId?: string
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const loadItems = () =>
      ChannelApi.listAll()
        .then((next) =>
          setItems(
            next.map((x) => ({
              id: x.id,
              title: x.title,
              platform: x.platform,
              customPlatformName: x.customPlatformName,
              bindingState: x.bindingState,
              catalogId: x.catalogId,
            })),
          ),
        )
        .finally(() => setLoading(false))

    void loadItems()
    return subscribeToDataChanges((route) => {
      if (route === "/channels") void loadItems()
    })
  }, [])
  const filteredItems = items.filter((x) =>
    `${x.title} ${x.platform}`.toLowerCase().includes(query.toLowerCase()),
  )
  const groupTitles = new Map(item.secondarySidebar.groups.map((group) => [group.id, group.title ?? group.id]))
  const groups = [
    { id: "connected", title: groupTitles.get("connected") ?? "Connected", items: filteredItems.filter((x) => x.bindingState === "connected") },
    { id: "catalog", title: groupTitles.get("catalog") ?? "Catalog", items: filteredItems.filter((x) => x.bindingState !== "connected") },
  ]

  const getLocalizedChannelTitle = (channel: (typeof items)[number]) => {
    switch (channel.catalogId) {
      case "catalog-custom-webhook":
        return t("channels.catalog.customWebhook", "Custom Webhook")
      case "catalog-custom-websocket":
        return t("channels.catalog.customWebsocket", "Custom WebSocket")
      case "catalog-email-inbox":
        return t("channels.catalog.emailInbox", "Email Inbox")
      case "catalog-telegram":
        return t("channels.catalog.telegram", "Telegram")
      case "catalog-teams":
        return t("channels.catalog.teams", "Microsoft Teams")
      case "catalog-qq":
        return t("channels.catalog.qq", "QQ")
      case "catalog-dingtalk":
        return t("channels.catalog.dingtalk", "DingTalk")
      case "catalog-feishu":
        return t("channels.catalog.feishu", "Feishu")
      case "catalog-wechat-miniprogram":
        return t("channels.catalog.wechatMiniProgram", "WeChat Mini Program")
      case "catalog-wechat-official":
        return t("channels.catalog.wechatOfficial", "WeChat Official Account")
      case "catalog-wechat":
        return t("channels.catalog.wechatEnterprise", "WeChat Enterprise")
      case "catalog-wechat-personal":
        return t("channels.catalog.wechatPersonal", "WeChat Personal")
      default:
        return channel.title
    }
  }
  return (
    <Sidebar collapsible="none" className="hidden min-h-0 flex-1 border-l md:flex">
      <SidebarHeader className="gap-2.5 border-b p-3">
        <div className="flex justify-between">
          <b>{item.title}</b>
          {headerAction}
        </div>
        <SidebarInput
          placeholder={item.secondarySidebar.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            {loading ? (
              <SidebarMenuSkeleton />
            ) : (
              <SidebarMenu>
                {group.items.map((x) => {
                  const Logo = getChannelPlatformSidebarLogo(x)
                  return (
                    <SidebarMenuItem key={x.id}>
                      <SidebarMenuButton
                        isActive={location.pathname === `/channels/${x.id}`}
                        onClick={() => navigate(`/channels/${x.id}`)}
                      >
                        <Logo className="size-4 shrink-0" />
                        {getLocalizedChannelTitle(x)}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
