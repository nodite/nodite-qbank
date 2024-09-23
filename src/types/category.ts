export type Category = {
  children: Category[]
  count: number
  id: string
  meta?: Record<string, any>
  name: string
  order?: number
}
