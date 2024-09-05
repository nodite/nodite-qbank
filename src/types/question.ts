import {AssetString} from './common.js'

export type QuestionType =
  // 填空题
  | 'BlankFilling'
  // 完型填空
  | 'Cloze'
  // 多选题
  | 'MultiChoice'
  // 单选题
  | 'SingleChoice'

export type AnswerAccessories = {
  BlankFilling: void
  Cloze: AssetString[]
  MultiChoice: AssetString[]
  SingleChoice: AssetString[]
}

export type Answers = {
  BlankFilling: AssetString[]
  Cloze: AssetString[]
  MultiChoice: AssetString[]
  SingleChoice: AssetString[]
}

export type Question = {
  answer: Answers[QuestionType]
  answerAccessory: AnswerAccessories[QuestionType]
  content: AssetString
  id: string
  solution: AssetString
  type: QuestionType
}
