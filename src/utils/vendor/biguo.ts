import puppeteer from '../puppeteer.js'

const PUBLIC_KEY = 'UQJMbB8Q+g/unV4rox2dMIfnJQPG0tAGrycas1npQAPhX4xCXg6ThXTYyv7FpTDuwunSFtRGRr+Qn2qqIg+AGA=='

const showQuestionAsk = async (data1: any | null, data2: any | null): Promise<null | string> => {
  const page = await puppeteer.page(
    'biguo',
    'https://www.biguotk.com/web/topic/question_bank_answer/2/15841/1?sub=666489',
  )

  // wait window.showQuestionAsk.
  await page.waitForFunction(
    () => {
      return (window as any).showQuestionAsk
    },
    {timeout: 0},
  )

  const decrypt = await page.evaluate(
    (data) => {
      return (window as any).showQuestionAsk(data.data1, data.data2)
    },
    {data1, data2},
  )

  return decrypt as string
}

export default {PUBLIC_KEY, showQuestionAsk}
