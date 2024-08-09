export type Category = {
  children: Category[]
  convert?: boolean
  count: number
  fetch?: boolean
  id: string
  name: string
}
