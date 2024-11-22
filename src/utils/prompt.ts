import {ChatPromptTemplate} from '@langchain/core/prompts'
import {ChatOllama} from '@langchain/ollama'

const chat = new ChatOllama({
  maxRetries: 2,
  model: 'vicuna:7b',
  temperature: 0,
})

const PARAGRAPH_FORMAT = ChatPromptTemplate.fromMessages([
  [
    'human',
    `你是一名文字工作者，你的工作是将文本进行格式化，使其更易阅读。
---
要求：
1. 请不要改变文本的含义。
2. 请不要随意添加或删除文本。
3. 请不要改变文本的顺序。
4. 仅使用标点符号、空格、换行符等基本符号进行格式化。
5. 如果文本存在标号，如序号、编号等，需要保持原有的标号。
6. 如果文本本身的格式已经，无需做任何处理。
---
输出：
输出格式化后的文本，不要包含任何其他内容。
---
文本:
{input}`,
  ],
]).pipe(chat)

export default {PARAGRAPH_FORMAT}
