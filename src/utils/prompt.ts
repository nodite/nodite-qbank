import {ChatPromptTemplate} from '@langchain/core/prompts'
import {ChatOllama} from '@langchain/ollama'

const chat = new ChatOllama({
  maxRetries: 2,
  model: 'wizardlm2:7b',
  temperature: 0,
})

const PARAGRAPH_FORMAT = ChatPromptTemplate.fromMessages([
  [
    'human',
    `你是一名文字工作者，你的工作是结合上下文对"文本"进行格式化，分点分块，使其更易阅读更有条理。
---
# Requirements
1. 禁止改变"文本"的含义。
2. 禁止对"文本"进行扩展、补充或修改。
3. 禁止使用样式、颜色、字体、Markdown 语法等方式对"文本"进行加工。
4. 禁止随意添加、删除或概括"文本"。
5. 禁止更换"文本"中的特定词汇。
6. 仅允许使用标点符号、空格、换行符、编号等基本符号对"文本"进行格式化。
7. 如果"文本"存在序号、编号等，需要保持原有的序号、编号，不允许更改。
8. 返回结果需以"格式化后的文本如下："开头。
---
# Context
{context}
---
# 文本
{input}
---
# Output
格式化后的文本如下：\n[output]
`,
  ],
]).pipe(chat)

export default {PARAGRAPH_FORMAT}
