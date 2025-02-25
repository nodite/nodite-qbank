import {ChatPromptTemplate} from '@langchain/core/prompts'
import {ChatOllama} from '@langchain/ollama'

const chat = new ChatOllama({
  maxRetries: 2,
  model: 'deepseek-r1:14b',
  temperature: 0,
})

const ANSWER_PMPT = ChatPromptTemplate.fromMessages([
  ['ai', '我是一个智能搜索引擎，我能帮你找到你想要的答案。请问你想要找什么答案？'],
  [
    'human',
    '请回答以下问题。' +
      '用 `<question>` 标签写下你的问题。' +
      '用 `<analyze>` 标签解释你的答案，包含你的思考过程。' +
      '用 `<answer>` 标签写下你的选择，多选题选项用逗号分割。',
  ],
  ['ai', '请问你的问题是什么？'],
  ['human', '我的问题是：\n\n{question}'],
]).pipe(chat)

export default {ANSWER_PMPT}
