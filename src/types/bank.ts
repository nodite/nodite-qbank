export type Bank = {
  id: string
  key: string
  name: string
  order?: number
}

export type MarkjiFolder = {
  items?: {object_class: string; object_id: string}[]
  updated_time?: string
} & Bank
