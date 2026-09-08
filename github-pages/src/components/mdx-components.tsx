import type { ComponentProps, ReactNode } from "react"
import { AlertCircleIcon, InfoIcon } from "lucide-react"
import { Link } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function Callout({ type = "info", children }: { type?: "info" | "warning"; children: ReactNode }) {
  const isWarning = type === "warning"
  const Icon = isWarning ? AlertCircleIcon : InfoIcon

  return (
    <Alert className={isWarning ? "border-amber-400/50 bg-amber-50" : "border-primary/20 bg-primary/5"}>
      <Icon />
      <AlertTitle>{isWarning ? "注意" : "提示"}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

export function DocLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return <Link to={to} className={className}>{children}</Link>
}

export const mdxComponents = {
  Callout,
  DocLink,
  h1: (props: ComponentProps<"h1">) => <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl" {...props} />,
  h2: (props: ComponentProps<"h2">) => <h2 className="mt-12 scroll-mt-20 text-2xl font-semibold tracking-tight text-foreground" {...props} />,
  h3: (props: ComponentProps<"h3">) => <h3 className="mt-8 text-lg font-semibold text-foreground" {...props} />,
  p: (props: ComponentProps<"p">) => <p className="mt-5 leading-8 text-muted-foreground" {...props} />,
  ul: (props: ComponentProps<"ul">) => <ul className="mt-5 list-disc space-y-2 pl-6 text-muted-foreground" {...props} />,
  ol: (props: ComponentProps<"ol">) => <ol className="mt-5 list-decimal space-y-2 pl-6 text-muted-foreground" {...props} />,
  code: (props: ComponentProps<"code">) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground" {...props} />,
  pre: (props: ComponentProps<"pre">) => <pre className="mt-5 overflow-x-auto rounded-lg border bg-card p-4 text-sm leading-6" {...props} />,
}