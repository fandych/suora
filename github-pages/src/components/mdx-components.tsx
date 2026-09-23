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

export function DocScreenshot({
  src,
  alt,
  caption,
}: {
  src: string
  alt: string
  caption?: ReactNode
}) {
  return (
    <figure className="mt-6 overflow-hidden rounded-xl border bg-card/60 p-3 shadow-sm">
      <img src={src} alt={alt} className="w-full rounded-lg border bg-background object-contain" loading="lazy" />
      {caption ? <figcaption className="mt-3 text-sm leading-6 text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  )
}

export const mdxComponents = {
  Callout,
  DocLink,
  DocScreenshot,
  h1: (props: ComponentProps<"h1">) => <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl" {...props} />,
  h2: (props: ComponentProps<"h2">) => <h2 className="mt-12 scroll-mt-20 text-2xl font-semibold tracking-tight text-foreground" {...props} />,
  h3: (props: ComponentProps<"h3">) => <h3 className="mt-8 text-lg font-semibold text-foreground" {...props} />,
  h4: (props: ComponentProps<"h4">) => <h4 className="mt-6 text-base font-semibold text-foreground" {...props} />,
  h5: (props: ComponentProps<"h5">) => <h5 className="mt-5 text-sm font-semibold uppercase tracking-wide text-foreground" {...props} />,
  h6: (props: ComponentProps<"h6">) => <h6 className="mt-5 text-sm font-medium text-foreground" {...props} />,
  p: (props: ComponentProps<"p">) => <p className="mt-5 leading-8 text-muted-foreground" {...props} />,
  ul: (props: ComponentProps<"ul">) => <ul className="mt-5 list-disc space-y-2 pl-6 text-muted-foreground" {...props} />,
  ol: (props: ComponentProps<"ol">) => <ol className="mt-5 list-decimal space-y-2 pl-6 text-muted-foreground" {...props} />,
  li: (props: ComponentProps<"li">) => <li className="leading-7" {...props} />,
  a: (props: ComponentProps<"a">) => <a className="font-medium text-primary underline-offset-4 hover:underline" {...props} />,
  strong: (props: ComponentProps<"strong">) => <strong className="font-semibold text-foreground" {...props} />,
  em: (props: ComponentProps<"em">) => <em className="italic" {...props} />,
  blockquote: (props: ComponentProps<"blockquote">) => <blockquote className="mt-6 border-l-4 border-border pl-4 text-muted-foreground italic" {...props} />,
  code: (props: ComponentProps<"code">) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground" {...props} />,
  pre: (props: ComponentProps<"pre">) => <pre className="mt-5 overflow-x-auto rounded-lg border bg-card p-4 text-sm leading-6" {...props} />,
  hr: (props: ComponentProps<"hr">) => <hr className="mt-10 border-border" {...props} />,
  img: (props: ComponentProps<"img">) => <img className="mt-6 rounded-lg border" loading="lazy" {...props} />,
  details: (props: ComponentProps<"details">) => <details className="mt-6 rounded-xl border bg-card p-4" {...props} />,
  summary: (props: ComponentProps<"summary">) => <summary className="cursor-pointer font-medium text-foreground" {...props} />,
  table: (props: ComponentProps<"table">) => (
    <div className="mt-6 overflow-x-auto rounded-xl border">
      <table className="min-w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props: ComponentProps<"thead">) => <thead className="bg-muted/50" {...props} />,
  tbody: (props: ComponentProps<"tbody">) => <tbody className="divide-y divide-border" {...props} />,
  tr: (props: ComponentProps<"tr">) => <tr className="border-b border-border last:border-0" {...props} />,
  th: (props: ComponentProps<"th">) => <th className="px-4 py-3 text-left font-semibold text-foreground" {...props} />,
  td: (props: ComponentProps<"td">) => <td className="px-4 py-3 align-top leading-7 text-muted-foreground" {...props} />,
}