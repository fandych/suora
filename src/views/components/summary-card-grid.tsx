import { EmptyCard } from "@/views/components/resource-state"

type SummaryCardGridProps<T> = {
  emptyDescription: string
  emptyTitle: string
  items: T[]
  renderItem: (item: T) => React.ReactNode
}

export function SummaryCardGrid<T>({ emptyDescription, emptyTitle, items, renderItem }: SummaryCardGridProps<T>) {
  if (items.length === 0) {
    return <EmptyCard title={emptyTitle} description={emptyDescription} />
  }

  return <div className="grid w-full min-w-0 justify-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{items.map(renderItem)}</div>
}
