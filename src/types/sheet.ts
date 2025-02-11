export type Sheet = {
  count: number
  id: string
  meta?: Record<string, any>
  name: string
  order?: number
  orgName?: string
}

export type MarkjiChapter = Sheet & {
  cardIds: string[]
  revision: number
  setRevision: number
}
