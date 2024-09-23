export type Sheet = {
  count: number
  id: string
  meta?: Record<string, any>
  name: string
  order?: number
}

export type MarkjiChapter = {
  cardIds: string[]
  revision: number
  setRevision: number
} & Sheet
