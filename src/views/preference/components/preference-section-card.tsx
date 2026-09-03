import type { ReactNode } from "react"

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type PreferenceSectionCardProps = {
  id: string
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}

const PreferenceSectionCard = ({ id, title, description, actions, children }: PreferenceSectionCardProps) => {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader>
        {actions ? <CardAction>{actions}</CardAction> : null}
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
    </Card>
  )
}

export default PreferenceSectionCard