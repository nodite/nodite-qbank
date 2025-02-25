import {ChatPromptTemplate} from '@langchain/core/prompts'
import {ChatOllama} from '@langchain/ollama'

const ANSWER_PMPT = ChatPromptTemplate.fromMessages([
  ['system', '我是一个智能搜索引擎，我能帮你找到你想要的答案。请问你想要找什么答案？'],
  [
    'user',
    [
      '要求：',
      '1. 用 `<question>` 标签写下问题。',
      '2. 用 `<analyze>` 标签解释你的答案，包含你的思考过程。如果是选择题，分析每个选项。',
      '3. 用 `<answer>` 标签写下你的选择，多选题选项不用逗号分割。',
      '请回答以下问题。',
    ].join('\n'),
  ],
  ['system', '请问你的问题是什么？'],
  ['user', '<question>{question}</question>\n<analyze>{analyze}</analyze>\n<answer>{answer}</answer>'],
]).pipe(
  new ChatOllama({
    maxRetries: 2,
    model: 'qwen2.5:7b',
    temperature: 0,
  }),
)

export default {ANSWER_PMPT}
