import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import PageHeader from "@/views/components/page-header"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { createSkill, listSkills } from "@/data/repositories/skill-repository"

const SkillsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listSkills(), [])

  const handleCreate = async () => {
    const detail = await createSkill()
    navigate(`/skills/${detail.skill.id}`)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title="Skills"
        description="Skill packages with a compact file tree and Monaco source editing."
        actions={<Button onClick={handleCreate}>New skill</Button>}
      />

      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading skills..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length === 0 ? (
            <EmptyCard title="No skills yet" description="Create the first skill package to store prompt files and release versions." />
          ) : null}
          {!isLoading && !error && data?.length
            ? data.map((skill) => (
                <Card key={skill.id}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle>{skill.title}</CardTitle>
                      <Badge variant="outline">{skill.source}</Badge>
                    </div>
                    <CardDescription>{skill.summary || "No summary yet."}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" onClick={() => navigate(`/skills/${skill.id}`)}>
                      Open skill
                    </Button>
                  </CardContent>
                </Card>
              ))
            : null}
        </div>
      </div>
    </div>
  )
}

export default SkillsPage