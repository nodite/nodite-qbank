import lodash from 'lodash'

import {AssetString, QBankParams} from '../../../types/common.js'
import html from '../../../utils/html.js'
import {find, throwError} from '../../../utils/index.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

const srcHandler = (src: string): string => {
  // trim http://wx.233.com or https://wx.233.com
  src = src.replace(/^(https?:)?\/\/wx\.233\.com/, '')

  if (src.endsWith('jpg') && !src.endsWith('.jpg')) {
    src = src.replace(/jpg$/, '.jpg')
  }

  if (src.startsWith('//') || src.startsWith('http')) {
    return src
  }

  if (src.startsWith('/imgcache/')) {
    return src.replace('/imgcache/', 'https://wximg.233.com/')
  }

  if (src.startsWith('file://')) {
    return ''
  }

  throwError('Unknown img src', {src})
}

export default class Markji extends MarkjiBase {
  /**
   * _output.
   */
  protected async _output(question: any, qbank: QBankParams): Promise<AssetString> {
    let _output = {} as AssetString

    const _questionType = question.baseQuestionType

    switch (_questionType) {
      // 1. 单选题
      case 1: {
        question.baseQuestionTypeName = '单选题'
        _output = await this._processChoice(question, qbank)
        break
      }

      // 2. 多选题
      case 2: {
        question.baseQuestionTypeName = '多选题'
        question.isMultipleChoice = true
        _output = await this._processChoice(question, qbank)
        break
      }

      case 3: {
        question.baseQuestionTypeName = '阅读理解(不定项)'
        question.isMultipleChoice = true
        _output = await this._processChoice(question, qbank)
        break
      }

      // 6. 填空题
      case 6: {
        question.baseQuestionTypeName = '填空题'
        _output = await this._processTranslate(question, qbank)
        break
      }

      // 7. 简答题
      case 7: {
        question.baseQuestionTypeName = '简答题/论述题/综合题'
        _output = await this._processTranslate(question, qbank)
        break
      }

      default: {
        throwError('Unsupported question type.', {qbank, question})
      }
    }

    return _output
  }

  /**
   * _processChoice.
   */
  protected async _processChoice(question: any, qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      material: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: question.isMultipleChoice ? 'fixed,multi' : 'fixed',
    }

    // ===========================
    // _material.
    _meta.material = await markji.parseHtml(question.material || '', {
      srcHandler,
      style: this.HTML_STYLE,
    })
    _meta.material.text += '\n'

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.content || '', {srcHandler, style: this.HTML_STYLE})

    if (question.sort && question.RealOrderNumber) {
      const _char = find(Object.values(_meta.content.assets), 'data:', {fuzzy: true}) ? '\n' : ' '
      _meta.content.text = String(question.sort) + '.' + _char + _meta.content.text
    }

    // ===========================
    // _options.
    _meta.options = await Promise.all(
      lodash.map(question.questionOptionRspList, (option) =>
        markji.parseHtml(lodash.trim(option.content), {srcHandler, style: this.HTML_STYLE}),
      ),
    )

    // 富文本选项
    if (lodash.some(_meta.options, (op) => find(Object.values(op.assets), 'data:', {fuzzy: true}))) {
      _meta.options = []

      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      const _options: string[] = []

      for (const option of question.questionOptionRspList) {
        const _point = String.fromCodePoint(65 + _options.length)
        _options.push(`${_point}. ${lodash.trim(option.content)}`)
        _meta.options.push({assets: [] as never, text: _point})
      }

      const _optionsContent = await html.toImage(_options.join('<br>'), {style: `${this.HTML_STYLE}${_htmlStyle}`})

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

    if (lodash.isEmpty(_meta.answers)) {
      throwError('Empty answers.', {qbank, question})
    } else if (_meta.answers.length > 1) {
      _meta.optionsAttr = 'fixed,multi'
    }

    // ===========================
    // _explain.
    _meta.explain = await markji.parseHtml(question.analysis || '', {srcHandler, style: this.HTML_STYLE})

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
          lodash.trim(_meta.material.text),
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
      _meta.material.assets,
      ...lodash.map(_meta.options, 'assets'),
    )

    return _output
  }

  /**
   * _processTranslate.
   */
  protected async _processTranslate(question: any, _qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      material: {assets: [] as never, text: ''} as AssetString,
      translation: {assets: [] as never, text: ''} as AssetString,
    }

    // ===========================
    // _material.
    _meta.material = await markji.parseHtml(question.material || '', {
      srcHandler,
      style: this.HTML_STYLE,
    })
    _meta.material.text += '\n'

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.content || '', {srcHandler, style: this.HTML_STYLE})

    if (question.sort && question.RealOrderNumber) {
      const _char = find(Object.values(_meta.content.assets), 'data:', {fuzzy: true}) ? '\n' : ' '
      _meta.content.text = String(question.sort) + '.' + _char + _meta.content.text
    }

    // ===========================
    // _translation.
    _meta.translation = await markji.parseHtml(question.analysis || '', {
      srcHandler,
      style: this.HTML_STYLE,
    })

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
          lodash.trim(_meta.material.text),
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
      _meta.explain.assets,
      _meta.material.assets,
      _meta.translation.assets,
    )

    return _output
  }
}
