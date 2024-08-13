import {AssertString} from './common.js'

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
  Cloze: AssertString[]
  MultiChoice: AssertString[]
  SingleChoice: AssertString[]
}

export type Answers = {
  BlankFilling: AssertString[]
  Cloze: AssertString[]
  MultiChoice: AssertString[]
  SingleChoice: AssertString[]
}

export type Question = {
  answer: Answers[QuestionType]
  answerAccessory: AnswerAccessories[QuestionType]
  content: AssertString
  id: string
  solution: AssertString
  type: QuestionType
}
