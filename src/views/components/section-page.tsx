import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Layers3Icon } from "lucide-react"

type SectionPageProps = {
  title: string
  description: string
}

const SectionPage = ({ title, description }: SectionPageProps) => {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <SidebarTrigger />
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{title} workspace</CardTitle>
              <CardDescription>
                This route is wired and ready for section-specific content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Empty className="border border-dashed border-border bg-muted/20">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Layers3Icon />
                  </EmptyMedia>
                  <EmptyTitle>Content scaffolded</EmptyTitle>
                  <EmptyDescription>
                    Use this page shell to add tables, forms, or dashboards for the {title.toLowerCase()} module.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default SectionPage