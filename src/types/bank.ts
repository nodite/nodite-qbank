export type Bank = {
  count?: number
  id: string
  meta?: Record<string, any>
  name: string
  order?: number
  orgName?: string
}

export type MarkjiFolder = Bank & {
  items?: {object_class: string; object_id: string}[]
  updated_time?: string
}
