export type Bank = {
  count?: number
  id: string
  meta?: Record<string, any>
  name: string
  order?: number
}

export type MarkjiFolder = {
  items?: {object_class: string; object_id: string}[]
  updated_time?: string
} & Bank
