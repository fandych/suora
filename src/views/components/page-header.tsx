import { SidebarTrigger } from "@/components/ui/sidebar"

type PageHeaderProps = {
  title: string
  description?: string
  actions?: React.ReactNode
}

const PageHeader = ({ title, description, actions }: PageHeaderProps) => {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <SidebarTrigger />
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
          {description ? <p className="text-xs text-muted-foreground sm:text-sm">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-1.5">{actions}</div> : null}
    </header>
  )
}

export default PageHeader