declare module 'puppeteer-extra' {
  export * from 'puppeteer'

  export function use(plugin: any): void
}
