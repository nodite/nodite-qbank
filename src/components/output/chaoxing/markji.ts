import lodash from 'lodash'

import {AssetString, Params} from '../../../types/common.js'
import html from '../../../utils/html.js'
import {find, throwError} from '../../../utils/index.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

export default class Markji extends MarkjiBase {
  /**
   * _output.
   */
  protected async _output(question: any, params: Params): Promise<AssetString> {
    const _questionType = question.KeyType

    let output = {} as AssetString

    // ====================
    switch (_questionType) {
      case '单选': {
        output = await this._processChoice(question, params)
        break
      }

      case '多选': {
        question.IsMultipleChoice = true
        output = await this._processChoice(question, params)
        break
      }

      case '简答题':
      case '论述题':
      case '写作题':
      case '词汇题':
      case '补全对话题':
      case '补全对话':
      case '音节题':
      case '句型转换题':
      case '解答题': {
        output = await this._processTranslate(question, params)
        break
      }

      case '填空题': {
        output = await this._processBlankFilling(question, params)
        break
      }

      default: {
        throwError('Unsupported question type', question)
      }
    }

    return output
  }

  /**
   * _processBlankFilling
   */
  protected async _processBlankFilling(question: any, _params: Params): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
    }

    // ====================
    // _content.
    _meta.content = await markji.parseHtml(question.Title || '', {style: this.HTML_STYLE})

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
      return this._processTranslate(question, _params)
    }

    for (const [idx, assertKey] of _inputs.entries()) {
      if (!assertKey.includes('[input#')) continue
      _meta.content.assets[assertKey] = `[F#${idx + 1}#${_blanks[idx]}]`
      _meta.content.text = _meta.content.text.replaceAll(assertKey, _meta.content.assets[assertKey])
    }

    // ====================
    // _explain.
    _meta.explain = await markji.parseHtml('', {style: this.HTML_STYLE})

    // ====================
    // _points.
    const _points = [
      '[P#L#[T#B#类别]]',
      lodash.filter([question['一级目录'], question['二级目录'], question['三级目录']]).join('\n'),
      '[P#L#[T#B#解析]]',
      lodash.trim(_meta.explain.text),
    ]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([`[${question.KeyType}]`, lodash.trim(_meta.content.text), '---', ..._points])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge({}, _meta.content.assets, _meta.explain.assets)

    return _output
  }

  protected async _processChoice(question: any, _params: Params): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: question.IsMultipleChoice ? 'fixed,multi' : 'fixed',
    }

    // ===========================
    // _context.
    _meta.content = await markji.parseHtml(question.Title || '', {style: this.HTML_STYLE})

    // ===========================
    // _options.
    const _options = lodash
      .chain(question)
      .pickBy((value, key) => key.match(/^[A-Z]$/) && value)
      .value()

    _meta.options = await Promise.all(
      lodash
        .chain(_options)
        .map((value, key) => markji.parseHtml(`${key}. ${value}`, {style: this.HTML_STYLE}))
        .value(),
    )

    // 富文本选项
    if (lodash.some(_meta.options, (op) => find(Object.values(op.assets), 'data:', {fuzzy: true}))) {
      _meta.options = []

      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      const _options: string[] = []

      for (const [key, value] of Object.entries(_options)) {
        _options.push(`${key}. ${value}`)
        _meta.options.push({assets: [] as never, text: key})
      }

      const _optionsContent = await html.toImage(_options.join('<br>'), {style: `${this.HTML_STYLE}${_htmlStyle}`})

      _meta.content.text += `\n${_optionsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optionsContent.assets)
    }

    // ===========================
    // _answers.
    _meta.answers = lodash.filter(_meta.options, (op) => {
      const correctOptions = lodash.split(question.RightKey, '')
      return correctOptions.includes(op.text[0])
    })

    _meta.options = lodash.map(_meta.options, (op) => ({
      assets: op.assets,
      text: `${_meta.answers.includes(op) ? '*' : '-'} ${op.text}`,
    }))

    // ====================
    // _explain.
    _meta.explain = await markji.parseHtml(question.Analyze || '', {style: this.HTML_STYLE})

    // ====================
    // _points.
    const _points = [
      '[P#L#[T#B#类别]]',
      lodash.filter([question['一级目录'], question['二级目录'], question['三级目录']]).join('\n'),
      '[P#L#[T#B#解析]]',
      lodash.trim(_meta.explain.text),
    ]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.KeyType}]`,
          lodash.trim(_meta.content.text),
          `[Choice#${_meta.optionsAttr}#\n${lodash.trim(lodash.map(_meta.options, 'text').join('\n'))}\n]\n`,
          '---\n',
          ..._points,
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge(
      {},
      ...lodash.map(_meta.answers, 'assets'),
      _meta.content.assets,
      _meta.explain.assets,
      ...lodash.map(_meta.options, 'assets'),
    )

    return _output
  }

  /**
   * _processTranslate
   */
  protected async _processTranslate(question: any, _params: Params): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      translation: {assets: [] as never, text: ''} as AssetString,
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.Title || '', {style: this.HTML_STYLE})

    // ===========================
    // _translation.
    _meta.translation = await markji.parseHtml(question.Analyze || '', {style: this.HTML_STYLE})

    // ===========================
    // _explain.
    _meta.explain = await markji.parseHtml('', {style: this.HTML_STYLE})

    // ===========================
    // _points.
    const _points = [
      '[P#L#[T#B#类别]]',
      lodash.filter([question['一级目录'], question['二级目录'], question['三级目录']]).join('\n'),
      '[P#L#[T#B#解析]]',
      lodash.trim(_meta.explain.text),
    ]

    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.KeyType}]`,
          lodash.trim(_meta.content.text),
          '---',
          _meta.translation.text,
          '---',
          ..._points,
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge({}, _meta.content.assets, _meta.explain.assets, _meta.translation.assets)

    return _output
  }
}
