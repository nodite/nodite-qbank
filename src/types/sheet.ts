export type Sheet = {
  count: number
  id: string
  name: string
}

export type MarkjiSheet = {
  cardIds: string[]
} & Sheet
