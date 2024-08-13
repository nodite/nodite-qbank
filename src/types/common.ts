export type AssertString = {
  asserts: Record<string, string>
  text: string
}

export type FetchOptions = {
  refetch?: boolean
}

export type ConvertOptions = {
  reconvert?: boolean
}

export type ImageOptions = {
  width?: number
}

export type UploadOptions = {
  reupload?: boolean
}
