import lodash from 'lodash'

import {AssetString, Params, ParseOptions} from '../../../types/common.js'
import html from '../../../utils/html.js'
import {throwError} from '../../../utils/index.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

const parseOptions: ParseOptions = {
  imgSrcHandler(src: string): string {
    if (src.startsWith('//') || src.startsWith('http')) {
      return src
    }

    if (src.startsWith('/imgcache/')) {
      return src.replace('/imgcache/', 'https://wximg.233.com/')
    }

    throwError('Unknown img src', {src})
  },
}

export default class Markji extends MarkjiBase {
  /**
   * _output.
   */
  protected async _output(question: any, _params: Params): Promise<AssetString> {
    let _output = {} as AssetString

    const _questionType = question.baseQuestionType

    switch (_questionType) {
      // 1. 单选题
      case 1: {
        question.baseQuestionTypeName = '单选题'
        _output = await this._processChoice(question, _params)
        break
      }

      // 7. 简答题
      case 7: {
        question.baseQuestionTypeName = '简答题'
        break
      }

      default: {
        throwError('Unsupported question type.', question)
      }
    }

    return _output
  }

  /**
   * _processChoice.
   */
  protected async _processChoice(question: any, _params: Params): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: 'fixed',
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.content || '', parseOptions)

    // ===========================
    // _options.
    _meta.options = await Promise.all(
      lodash.map(question.questionOptionRspList, (option) =>
        markji.parseHtml(lodash.trim(option.content), parseOptions),
      ),
    )

    // 富文本选项
    if (lodash.some(_meta.options, (option) => !lodash.isEmpty(option.assets))) {
      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      const _options: string[] = []

      for (const option of question.questionOptionRspList) {
        const _point = String.fromCodePoint(65 + _options.length)
        _options.push(`${_point}. ${lodash.trim(option.content)}`)
        _meta.options.push({assets: [] as never, text: _point})
      }

      const _optionsContent = await html.toImage(`${this.HTML_STYLE}\n${_htmlStyle}\n${_options.join('<br>')}`)

      _meta.content.text += `\n${_optionsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optionsContent.assets)
    }

    // ===========================
    // _answer.
    for (const [_optionIdx, _option] of question.questionOptionRspList.entries()) {
      if (!_option.isCorrectAnswer) continue
      _meta.answers.push(_meta.options[_optionIdx])
    }

    _meta.options = lodash.map(_meta.options, (option) => ({
      assets: option.assets,
      text: `${_meta.answers.includes(option) ? '*' : '-'} ${option.text}`,
    }))

    // ===========================
    // _explain.
    _meta.explain = await markji.parseHtml(question.analysis || '', parseOptions)

    // ===========================
    // _points.
    const _points = [
      `[P#L#[T#B#类别]]`,
      question.questionChapterRsp.childChapterName || '',
      `[P#L#[T#B#解析]]`,
      lodash.trim(_meta.explain.text),
    ]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.baseQuestionTypeName}]`,
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
      _meta.content.assets,
      ...lodash.map(_meta.options, 'assets'),
      _meta.explain.assets,
      ...lodash.map(_meta.answers, 'assets'),
    )

    return _output
  }

  /**
   * _processTranslate.
   */
  protected async _processTranslate(question: any, _params: Params): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      translation: {assets: [] as never, text: ''} as AssetString,
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.content || '', parseOptions)

    // ===========================
    // _translation.
    _meta.translation = await markji.parseHtml(question.analysis || '', parseOptions)

    // ===========================
    // _explain.

    // ===========================
    // _points.
    const _points = [
      `[P#L#[T#B#类别]]`,
      question.questionChapterRsp.childChapterName || '',
      `[P#L#[T#B#解析]]`,
      lodash.trim(_meta.explain.text),
    ]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.baseQuestionTypeName}]`,
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
