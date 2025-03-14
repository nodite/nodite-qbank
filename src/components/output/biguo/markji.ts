import lodash from 'lodash'

import {AssetString, QBankParams} from '../../../@types/common.js'
import html from '../../../utils/html.js'
import {throwError} from '../../../utils/index.js'
import prompt from '../../../utils/prompt.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

export default class Markji extends MarkjiBase {
  protected async _processBlankFilling(question: any, qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      points: {} as Record<string, AssetString>,
    }

    // ====================
    // _content.
    while (question.questionAsk.includes('_ _')) {
      question.questionAsk = question.questionAsk.replaceAll('_ _', '__')
    }

    // ====================
    // fix the questionAsk.
    if (
      question.questionAsk ===
      '变量是指在___________或__________可变的事物的___________。在实验中实验者_________、__________的变量称为自变量；由操纵而引起的被试者的__________称为因变量。'
    ) {
      question.questionAsk =
        '变量是指在____或____可变的事物的____。在实验中实验者____、____的变量称为____；由操纵而引起的被试者的____称为因变量。'
    } else if (question.questionAsk === '相当于一个微缩的小社会。') {
      question.questionAsk = '____相当于一个微缩的小社会。'
    }

    _meta.content = await markji.parseHtml(question.questionAsk, {style: this.HTML_STYLE})

    // ====================
    // _blanks.
    let _blanks = [] as string[]

    const _inputs = lodash.filter(Object.keys(_meta.content.assets), (assertKey) => assertKey.includes('[input#'))
    const correctOption = question.correctOption as string

    // 1. 单个
    if (_inputs.length === 1) {
      _blanks = [correctOption]
    } else {
      const _chunk = await prompt.BLANK_FILLING.invoke({
        answer: correctOption,
        question: question.questionAsk,
      })

      const _chunkStr = _chunk.content.toString()

      _blanks = JSON.parse(_chunkStr)
    }

    // unknown to process.
    if (_inputs.length === 0 || _blanks.length === 0 || _inputs.length !== _blanks.length) {
      throwError('Unknown to process', {blanks: _blanks, inputs: _inputs, qbank, question})
    }

    for (const [idx, assertKey] of _inputs.entries()) {
      if (!assertKey.includes('[input#')) continue
      _meta.content.assets[assertKey] = `[F#${idx + 1}#${_blanks[idx]}]`
      _meta.content.text = _meta.content.text.replaceAll(assertKey, _meta.content.assets[assertKey])
    }

    // ====================
    // _explain.
    _meta.points['[P#L#[T#B#题目解析]]'] = await markji.parseHtml(question.explanation, {
      skipInput: true,
      style: this.HTML_STYLE,
    })

    // ====================
    // _points.
    _meta.points['[P#L#[T#B#题目来源]]'] = {
      assets: {},
      text: `${qbank.bank.name} - ${qbank.category.name} - ${question.sheet.name}`,
    }

    _meta.points['[P#L#[T#B#题目类型]]'] = {
      assets: {},
      text: question.topic_type_name,
    }

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.topic_type_name}]`,
          lodash.trim(_meta.content.text),
          '---',
          ...lodash
            .chain(_meta.points)
            .toPairs()
            .sortBy(0)
            .fromPairs()
            .map((point, key) => `${key}\n${point.text}`)
            .value(),
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge({}, _meta.content.assets, ...lodash.map(_meta.points, 'assets'))

    return _output
  }

  protected async _processChoice(question: any, qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: question.topic_type === 2 ? 'fixed,multi' : 'fixed',
      points: {} as Record<string, AssetString>,
    }

    // ====================
    // _content.
    _meta.content = await markji.parseHtml(question.questionAsk, {style: this.HTML_STYLE})

    // ====================
    // _options.
    const _options = lodash
      .chain(question)
      .pickBy((_value, key) => key.match(/^[A-Z]$/))
      .map((value, key) => (value ? `${key}. ${value}` : ''))
      .filter()
      .value()

    // 富文本选项
    if (_options.join('').length > 800) {
      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      const _optionsContent = await html.toImage(_options.join('<br>'), {style: `${this.HTML_STYLE}${_htmlStyle}`})

      _meta.content.text += `\n${_optionsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optionsContent.assets)
    }
    // 普通选项
    else {
      _meta.options = await Promise.all(
        lodash.map(_options, (option) => markji.parseHtml(option, {style: this.HTML_STYLE})),
      )
    }

    // ====================
    // _answers.
    _meta.answers = lodash.filter(_meta.options, (option) => {
      const correctOptions = lodash.split(question.correctOption, '')
      return correctOptions.includes(option.text[0])
    })

    _meta.options = lodash.map(_meta.options, (option) => ({
      assets: option.assets,
      text: `${_meta.answers.includes(option) ? '*' : '-'} ${option.text}`,
    }))

    // ====================
    // _explain.
    _meta.points['[P#L#[T#B#题目解析]]'] = await markji.parseHtml(question.explanation, {
      skipInput: true,
      style: this.HTML_STYLE,
    })

    // ====================
    // _points.
    _meta.points['[P#L#[T#B#题目来源]]'] = {
      assets: {},
      text: `${qbank.bank.name} - ${qbank.category.name} - ${question.sheet.name}`,
    }

    _meta.points['[P#L#[T#B#题目类型]]'] = {
      assets: {},
      text: question.topic_type_name,
    }

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.topic_type_name}]`,
          lodash.trim(_meta.content.text),
          `[Choice#${_meta.optionsAttr}#\n${lodash.trim(lodash.map(_meta.options, 'text').join('\n'))}\n]\n`,
          '---\n',
          ...lodash
            .chain(_meta.points)
            .toPairs()
            .sortBy(0)
            .fromPairs()
            .map((point, key) => `${key}\n${point.text}`)
            .value(),
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge(
      {},
      ...lodash.map(_meta.answers, 'assets'),
      _meta.content.assets,
      ...lodash.map(_meta.options, 'assets'),
      ...lodash.map(_meta.points, 'assets'),
    )

    return _output
  }

  protected async _processTranslate(question: any, qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      points: {} as Record<string, AssetString>,
      translation: {assets: [] as never, text: ''} as AssetString,
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.questionAsk || '', {style: this.HTML_STYLE})

    // ===========================
    // _translation.
    _meta.translation = await markji.parseHtml(question.correctOption || '', {style: this.HTML_STYLE})

    // ===========================
    // _explain.
    _meta.points['[P#L#[T#B#题目解析]]'] = await markji.parseHtml(question.explanation || '', {
      skipInput: true,
      style: this.HTML_STYLE,
    })

    // ===========================
    // _points.
    _meta.points['[P#L#[T#B#题目来源]]'] = {
      assets: {},
      text: `${qbank.bank.name} - ${qbank.category.name} - ${question.sheet.name}`,
    }

    _meta.points['[P#L#[T#B#题目类型]]'] = {
      assets: {},
      text: question.topic_type_name,
    }

    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.topic_type_name}]`,
          lodash.trim(_meta.content.text),
          '---',
          _meta.translation.text,
          '---',
          ...lodash
            .chain(_meta.points)
            .toPairs()
            .sortBy(0)
            .fromPairs()
            .map((point, key) => `${key}\n${point.text}`)
            .value(),
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge(
      {},
      _meta.content.assets,
      ...lodash.map(_meta.points, 'assets'),
      _meta.translation.assets,
    )

    return _output
  }

  protected async toMarkjiOutput(question: any, qbank: QBankParams): Promise<AssetString> {
    const _questionType = question.topic_type

    let output = {} as AssetString

    // ====================
    switch (_questionType) {
      // 1. 单选题
      // 2. 多选题
      // 3. 判断题
      case 1:
      case 2:
      case 3: {
        output = await this._processChoice(question, qbank)
        break
      }

      // 4. 问答题
      // 7. 阅读理解
      // 8. 名词解释
      // 9. 单词练习
      // 10. 简答题
      // 11. 计算题
      // 12. 论述题
      // 13. 案例分析题
      // 14. 综合应用题
      // 16. 材料题
      // 17. 证明题
      // 18. 词语解释题
      // 19. 应用题
      // 20. 综合题
      // 21. 英译汉
      // 22. 汉译英
      // 23. 作文题
      // 25. 分析题
      // 26. 材料分析题
      // 27. 分析说明题
      // 28. 简析题
      // 31. 古文背诵题
      // 32. 释词题
      // 33. 古文翻译题
      // 34. 古文标点题
      // 35. 古文阅读题
      // 63. 程序分析题
      // 64. 程序设计题
      // 70. 算法设计题
      // 76. 程序填空题
      case 4:
      case 7:
      case 8:
      case 9:
      case 10:
      case 11:
      case 12:
      case 13:
      case 14:
      case 16:
      case 17:
      case 18:
      case 19:
      case 20:
      case 21:
      case 22:
      case 23:
      case 25:
      case 26:
      case 27:
      case 28:
      case 31:
      case 32:
      case 33:
      case 34:
      case 35:
      case 63:
      case 64:
      case 70:
      case 76: {
        output = await this._processTranslate(question, qbank)
        break
      }

      // 5. 填空题
      case 5: {
        output = await this._processBlankFilling(question, qbank)
        break
      }

      default: {
        throwError('Unsupported question type', {qbank, question})
      }
    }

    return output
  }
}
