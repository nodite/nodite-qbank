export type Category = {
  children: Category[]
  count: number
  fetch?: boolean
  id: string
  name: string
  order?: number
}
