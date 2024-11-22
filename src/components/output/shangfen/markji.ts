import lodash from 'lodash'

import {AssetString, Params} from '../../../types/common.js'
import html from '../../../utils/html.js'
import {find, throwError} from '../../../utils/index.js'
import prompt from '../../../utils/prompt.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

const imgSrcHandler = (src: string): string => {
  return src
}

export default class Markji extends MarkjiBase {
  /**
   * _output.
   */
  protected async _output(question: any, params: Params): Promise<AssetString> {
    const _questionType = question.type

    let output = {} as AssetString

    // ===========================
    switch (_questionType) {
      // 1. 单选题
      case '1': {
        question.typeName = '单选题'
        output = await this._processChoice(question, params)
        break
      }

      // 2. 多选题
      case '2': {
        question.typeName = '多选题'
        question.isMultipleChoice = true
        output = await this._processChoice(question, params)
        break
      }

      // 5. 名词解释/问答题
      case '5': {
        question.typeName = '名词解释/问答题'
        output = await this._processTranslate(question, params)
        break
      }

      default: {
        throwError('Unsupported question type.', {params, question})
      }
    }

    return output
  }

  /**
   * _processChoice.
   */
  protected async _processChoice(question: any, _params: Params): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      context: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: question.isMultipleChoice ? 'fixed,multi' : 'fixed',
    }

    // ===========================
    // _context.
    if (question.stemMediaId > 0) {
      throwError('Not Implemented stemMediaId.', question)
    }
    // _meta.context = await markji.parseHtml(question.context || '', {imgSrcHandler, style: this.HTML_STYLE})
    // _meta.context.text += '\n'

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.stem || '', {imgSrcHandler, style: this.HTML_STYLE})

    // ===========================
    // _options.
    _meta.options = await Promise.all(
      lodash.map(question.options, (option) =>
        markji.parseHtml(lodash.trim(option), {imgSrcHandler, style: this.HTML_STYLE}),
      ),
    )

    // 富文本选项
    if (lodash.some(_meta.options, (op) => find(Object.values(op.assets), 'data:', {fuzzy: true}))) {
      _meta.options = []

      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      const _options: string[] = []

      for (const option of question.options) {
        const _point = String.fromCodePoint(65 + _options.length)
        _options.push(`${_point}. ${lodash.trim(option)}`)
        _meta.options.push({assets: [] as never, text: _point})
      }

      const _optionsContent = await html.toImage(_options.join('<br>'), {style: `${this.HTML_STYLE}${_htmlStyle}`})

      _meta.content.text += `\n${_optionsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optionsContent.assets)
    }

    // ===========================
    // _answer.
    for (const _answerIdx of question.answer) {
      _meta.answers.push(_meta.options[_answerIdx])
    }

    _meta.options = lodash.map(_meta.options, (option) => ({
      assets: option.assets,
      text: `${_meta.answers.includes(option) ? '*' : '-'} ${option.text}`,
    }))

    if (lodash.isEmpty(_meta.answers)) {
      throwError('Empty answers.', question)
    } else if (_meta.answers.length > 1) {
      _meta.optionsAttr = 'fixed,multi'
    }

    // ===========================
    // _explain.
    _meta.explain = await markji.parseHtml(question.analysis || '', {imgSrcHandler, style: this.HTML_STYLE})

    // format by ai.
    if (lodash.isEmpty(_meta.explain.assets) && _meta.explain.text) {
      const _chunk = await prompt.PARAGRAPH_FORMAT.invoke({input: _meta.explain.text})
      _meta.explain.text = _chunk.content.toString()
    }

    // ===========================
    // _points.
    const _points = [`[P#L#[T#B#解析]]`, lodash.trim(_meta.explain.text)]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.typeName}]`,
          lodash.trim(_meta.context.text),
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
      _meta.context.assets,
      _meta.explain.assets,
      ...lodash.map(_meta.options, 'assets'),
    )

    return _output
  }

  /**
   * _processTranslate.
   */
  protected async _processTranslate(question: any, _params: Params): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      context: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      translation: {assets: [] as never, text: ''} as AssetString,
    }

    // ===========================
    // _context.
    if (question.stemMediaId > 0) {
      throwError('Not Implemented stemMediaId.', question)
    }
    // _meta.context = await markji.parseHtml(question.context || '', {imgSrcHandler, style: this.HTML_STYLE})
    // _meta.context.text += '\n'

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.stem || '', {imgSrcHandler, style: this.HTML_STYLE})

    // ===========================
    // _translation.
    _meta.translation = await markji.parseHtml((question.answer || []).join('\n'), {
      imgSrcHandler,
      style: this.HTML_STYLE,
    })

    // format by ai.
    if (lodash.isEmpty(_meta.translation.assets) && _meta.translation.text) {
      const _chunk = await prompt.PARAGRAPH_FORMAT.invoke({input: _meta.translation.text})
      _meta.translation.text = _chunk.content.toString() + '\n（该答案由 AI 格式化，原答案请看解析）'
    }

    // ===========================
    // _explain.

    // ===========================
    // _points.
    const _points = [
      `[P#L#[T#B#解析]]`,
      lodash.trim(_meta.explain.text),
      `[P#L#[T#B#原答案]]`,
      (question.answer || []).join('\n'),
    ]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.typeName}]`,
          lodash.trim(_meta.context.text),
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

    _output.assets = lodash.merge(
      {},
      _meta.content.assets,
      _meta.context.assets,
      _meta.explain.assets,
      _meta.translation.assets,
    )

    return _output
  }
}
