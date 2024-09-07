export type Sheet = {
  count: number
  id: string
  name: string
  order?: number
}

export type MarkjiChapter = {
  cardIds: string[]
  revision: number
  setRevision: number
} & Sheet
