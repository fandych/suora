import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { SkillSummary } from "@/data/domain/models"

type SkillCardProps = {
  skill: SkillSummary
  onOpen: (skillId: string) => void
}

export function SkillCard({ skill, onOpen }: SkillCardProps) {
  return (
    <Card
      className="min-w-0 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/20 hover:shadow-sm"
      onClick={() => onOpen(skill.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(skill.id)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="truncate text-base">{skill.title}</CardTitle>
          <Badge variant="outline">{skill.source}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm leading-6 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
          {skill.summary || "No description yet."}
        </div>
      </CardContent>
    </Card>
  )
}
