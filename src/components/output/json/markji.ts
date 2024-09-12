import lodash from 'lodash'

import {AssetString, Params} from '../../../types/common.js'
import html from '../../../utils/html.js'
import {throwError} from '../../../utils/index.js'
import MarkjiBase from '../markji.js'

export default class Markji extends MarkjiBase {
  /**
   * _output.
   */
  protected async _output(question: any, _params: Params): Promise<AssetString> {
    const _questionType = question.type

    let output = {} as AssetString

    // ===========================
    if (_questionType.includes('判断选择')) {
      question.content += '\nA.正确\nB.错误'
    }

    if (_questionType === '') {
      // nothing.
    }
    // 单项选择、多项选择、判断选择
    else if (
      _questionType.includes('单项选择') ||
      _questionType.includes('多项选择') ||
      _questionType.includes('判断选择')
    ) {
      output = await this._processChoice(question)
    }
    // 名词解释、简答题、论述题、案例分析题
    else if (
      _questionType.includes('名词解释') ||
      _questionType.includes('简答') ||
      _questionType.includes('论述') ||
      _questionType.includes('案例分析')
    ) {
      output = await this._processTranslate(question)
    }
    // unknown.
    else {
      throwError('Unsupported question type.', question)
    }

    return output
  }

  /**
   * _processChoice.
   */
  protected async _processChoice(question: any): Promise<AssetString> {
    const _meta = {
      answer: {assets: [] as never, text: ''} as AssetString,
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: question.type.includes('多项选择') ? 'fixed,multi' : 'fixed',
    }

    const contents: string[] = question.content.split(/(?=\n[A-Z]\.)/)

    _meta.content = await html.toText(lodash.trim(contents.shift()) || '')
    _meta.options = await Promise.all(lodash.map(contents, (content) => html.toText(lodash.trim(content))))
    _meta.answer = await html.toText(question.answer || '')
    _meta.explain = await html.toText(question.explain || '')

    _meta.options = lodash.map(_meta.options, (option) => {
      const point = option.text.split('.')[0]
      return {
        assets: option.assets,
        text: _meta.answer.text.includes(point) ? `* ${option.text}` : `- ${option.text}`,
      }
    })

    // _point.
    const _points = [`[P#L#[T#B#解析]]`, lodash.trim(_meta.explain.text)]

    // ===========================
    // _output.
    const output = await html.toText(
      lodash
        .filter([
          `[${question.type}]\n`,
          lodash.trim(_meta.content.text),
          `[Choice#${_meta.optionsAttr}#\n${lodash.trim(lodash.map(_meta.options, 'text').join('\n'))}\n]\n`,
          '---\n',
          ..._points,
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    output.assets = lodash.merge(
      {},
      _meta.answer.assets,
      _meta.content.assets,
      _meta.explain.assets,
      ...lodash.map(_meta.options, 'assets'),
    )

    return output
  }

  /**
   * _processTranslate
   */
  protected async _processTranslate(question: any): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      translation: {assets: [] as never, text: ''} as AssetString,
    }

    _meta.content = await html.toText(question.content || '')
    _meta.explain = await html.toText(question.explain || '')
    _meta.translation = await html.toText(question.answer || '')

    // _points.
    const _points = [`[P#L#[T#B#解析]]`, lodash.trim(_meta.explain.text)]

    // ===========================
    // _output.
    const output = await html.toText(
      lodash
        .filter([
          `[${question.type}]\n`,
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

    output.assets = lodash.merge({}, _meta.content.assets, _meta.explain.assets, _meta.translation.assets)

    return output
  }
}
