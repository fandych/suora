export function WorkflowTraceJsonPreview({ value, className = "" }: { value: string; className?: string }) {
  let formattedValue = value
  try {
    formattedValue = JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    // Keep plain-text preview unchanged.
  }

  const tokens: Array<{ value: string; className: string }> = []
  const pattern = /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false)|(null)|([{}[\],:])/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(formattedValue)) !== null) {
    if (match.index > cursor) {
      tokens.push({ value: formattedValue.slice(cursor, match.index), className: "text-muted-foreground" })
    }

    tokens.push({
      value: match[0],
      className: match[1]
        ? "text-sky-700 dark:text-sky-300"
        : match[2]
          ? "text-emerald-700 dark:text-emerald-300"
          : match[3]
            ? "text-amber-700 dark:text-amber-300"
            : match[4]
              ? "text-violet-700 dark:text-violet-300"
              : match[5]
                ? "text-rose-700 dark:text-rose-300"
                : "text-muted-foreground",
    })
    cursor = pattern.lastIndex
  }

  if (cursor < formattedValue.length) {
    tokens.push({ value: formattedValue.slice(cursor), className: "text-muted-foreground" })
  }

  return (
    <pre className={`max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[10px] ${className}`}>
      {tokens.map((token, index) => <span key={`${token.value}-${index}`} className={token.className}>{token.value}</span>)}
    </pre>
  )
}