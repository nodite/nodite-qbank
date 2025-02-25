import lodash from 'lodash'
import {parse} from 'node-html-parser'

import {AssetString, QBankParams} from '../../../@types/common.js'
import ai from '../../../utils/ai.js'
import html from '../../../utils/html.js'
import {find, throwError} from '../../../utils/index.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

const srcHandler = (src: string): string => {
  if (src.startsWith('/')) {
    src = 'http://ppt.beegoedu.com' + src
  }

  return src
}

export default class Markji extends MarkjiBase {
  protected async _processBlankFilling(question: any, _qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      material: {assets: [] as never, text: ''} as AssetString,
      points: {} as Record<string, AssetString>,
    }

    // ====================
    // _material.
    if (question['材料']) {
      _meta.material = await markji.parseHtml(question['材料'], {srcHandler, style: this.HTML_STYLE})
    }

    // ====================
    // _content.
    _meta.content = await markji.parseHtml(question.Title || '', {srcHandler, style: this.HTML_STYLE})

    // ====================
    // _blanks.
    let _blanks = [] as string[]

    const _inputs = lodash.filter(Object.keys(_meta.content.assets), (assertKey) => assertKey.includes('[input#'))
    const correctOption = question.Analyze as string

    // 1. 单个
    if (_inputs.length === 1) {
      _blanks = [correctOption]
    }

    // unknown to process.
    if (_inputs.length === 0 || _blanks.length === 0 || _inputs.length !== _blanks.length) {
      return this._processTranslate(question, _qbank)
    }

    for (const [idx, assertKey] of _inputs.entries()) {
      if (!assertKey.includes('[input#')) continue
      _meta.content.assets[assertKey] = `[F#${idx + 1}#${_blanks[idx]}]`
      _meta.content.text = _meta.content.text.replaceAll(assertKey, _meta.content.assets[assertKey])
    }

    // ====================
    // points.
    _meta.points['[P#L#[T#B#题目类别]]'] = {
      assets: {},
      text: lodash.filter([question['一级目录'], question['二级目录'], question['三级目录']]).join('\n'),
    }

    _meta.points['[P#L#[T#B#题目解析]]'] = await markji.parseHtml('', {
      skipInput: true,
      srcHandler,
      style: this.HTML_STYLE,
    })

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.KeyType}]`,
          lodash.trim(_meta.material.text),
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

    _output.assets = lodash.merge(
      {},
      _meta.material.assets,
      _meta.content.assets,
      ...lodash.map(_meta.points, 'assets'),
    )

    return _output
  }

  protected async _processChoice(question: any, _qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      material: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: question.IsMultipleChoice ? 'fixed,multi' : 'fixed',
      points: {} as Record<string, AssetString>,
    }

    // ===========================
    // _material.
    if (question['材料']) {
      _meta.material = await markji.parseHtml(question['材料'], {srcHandler, style: this.HTML_STYLE})
    }

    // ===========================
    // _context.
    _meta.content = await markji.parseHtml(question.Title || '', {srcHandler, style: this.HTML_STYLE})

    // ===========================
    // _options.
    const _options = lodash
      .chain(question)
      .pickBy((value, key) => key.match(/^[A-Z]$/) && value)
      .value()

    _meta.options = await Promise.all(
      lodash
        .chain(_options)
        .map((value, key) => markji.parseHtml(`${key}. ${value}`, {srcHandler, style: this.HTML_STYLE}))
        .value(),
    )

    // 富文本选项
    if (lodash.some(_meta.options, (op) => find(Object.values(op.assets), 'data:', {fuzzy: true}))) {
      _meta.options = []

      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      const _opts: string[] = []

      for (const [key, value] of Object.entries(_options)) {
        _opts.push(`${key}. ${value}`)
        _meta.options.push({assets: [] as never, text: key})
      }

      const _optsContent = await html.toImage(_opts.join('<br>'), {
        srcHandler,
        style: `${this.HTML_STYLE}${_htmlStyle}`,
      })

      _meta.content.text += `\n${_optsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optsContent.assets)
    }

    // ===========================
    // _answers.
    _meta.answers = lodash.filter(_meta.options, (op) => {
      const correctOptions = lodash
        .chain(question.RightKey)
        .split(question.RightKey.includes(',') ? ',' : '')
        .map((key) => key.trim())
        .filter()
        .value()

      return correctOptions.includes(op.text[0])
    })

    _meta.options = lodash.map(_meta.options, (op) => ({
      assets: op.assets,
      text: `${_meta.answers.includes(op) ? '*' : '-'} ${op.text}`,
    }))

    // ====================
    // _points.
    _meta.points['[P#L#[T#B#题目类别]]'] = {
      assets: {},
      text: lodash.filter([question['一级目录'], question['二级目录'], question['三级目录']]).join('\n'),
    }

    _meta.points['[P#L#[T#B#题目解析]]'] = await markji.parseHtml(question.Analyze || '', {
      skipInput: true,
      srcHandler,
      style: this.HTML_STYLE,
    })

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.KeyType}]`,
          lodash.trim(_meta.material.text),
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
      _meta.material.assets,
      ...lodash.map(_meta.answers, 'assets'),
      _meta.content.assets,
      ...lodash.map(_meta.points, 'assets'),
      ...lodash.map(_meta.options, 'assets'),
    )

    return _output
  }

  protected async _processTranslate(question: any, _qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      material: {assets: [] as never, text: ''} as AssetString,
      points: {} as Record<string, AssetString>,
      translation: {assets: [] as never, text: ''} as AssetString,
    }

    // ===========================
    // _material.
    if (question['材料']) {
      _meta.material = await markji.parseHtml(question['材料'], {srcHandler, style: this.HTML_STYLE})
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.Title || '', {srcHandler, style: this.HTML_STYLE})

    // ===========================
    // _translation.
    _meta.translation = await markji.parseHtml(question.Analyze || '', {
      srcHandler,
      style: this.HTML_STYLE,
    })

    // ====================
    // points.
    _meta.points['[P#L#[T#B#题目类别]]'] = {
      assets: {},
      text: lodash.filter([question['一级目录'], question['二级目录'], question['三级目录']]).join('\n'),
    }

    _meta.points['[P#L#[T#B#题目解析]]'] = await markji.parseHtml('', {
      skipInput: true,
      srcHandler,
      style: this.HTML_STYLE,
    })

    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.KeyType}]`,
          lodash.trim(_meta.material.text),
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
      _meta.material.assets,
      _meta.content.assets,
      _meta.translation.assets,
      ...lodash.map(_meta.points, 'assets'),
    )

    return _output
  }

  protected async toMarkjiOutput(question: any, qbank: QBankParams): Promise<AssetString> {
    if (!question.RightKey || !question.Analyze) {
      const _chunk = await ai.ANSWER_PMPT.invoke({
        analyze: question.Analyze || '',
        answer: question.RightKey || '',
        question: lodash
          .filter([
            question.材料 ? `材料: ${question.材料}` : '',
            `问题: ${question.Title}`,
            question.A ? `A. ${question.A}` : '',
            question.B ? `B. ${question.B}` : '',
            question.C ? `C. ${question.C}` : '',
            question.D ? `D. ${question.D}` : '',
            question.E ? `E. ${question.E}` : '',
            question.F ? `F. ${question.F}` : '',
            question.G ? `G. ${question.G}` : '',
            question.H ? `H. ${question.H}` : '',
          ])
          .join('\n'),
      })

      const _chunkParts = parse(_chunk.content as string)

      question.Analyze = _chunkParts.querySelector('analyze')?.textContent.trim() || ''
      question.RightKey = _chunkParts.querySelector('answer')?.textContent.trim() || ''
    }

    const _questionType = question.KeyType

    let output = {} as AssetString

    // ====================
    switch (_questionType) {
      case '作文题':
      case '写作题':
      case '句型判断题':
      case '句型转换题':
      case '简答题':
      case '补全对话':
      case '补全对话题':
      case '解答题':
      case '论述题':
      case '词汇题':
      case '音节题': {
        output = await this._processTranslate(question, qbank)
        break
      }

      case '判断题':
      case '单选':
      case '单选题':
      case '完型填空':
      case '阅读理解': {
        output = await this._processChoice(question, qbank)
        break
      }

      case '填空题': {
        output = await this._processBlankFilling(question, qbank)
        break
      }

      case '多选':
      case '多选题': {
        question.IsMultipleChoice = true
        output = await this._processChoice(question, qbank)
        break
      }

      default: {
        throwError('Unsupported question type', {qbank, question})
      }
    }

    return output
  }
}
