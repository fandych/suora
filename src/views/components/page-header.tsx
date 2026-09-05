import { SidebarTrigger } from "@/components/ui/sidebar"

type PageHeaderProps = {
  title: React.ReactNode
  description?: string
  leading?: React.ReactNode
  actions?: React.ReactNode
}

const PageHeader = ({ title, description, leading, actions }: PageHeaderProps) => {
  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <SidebarTrigger />
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-1.5">{actions}</div> : null}
    </header>
  )
}

export default PageHeader