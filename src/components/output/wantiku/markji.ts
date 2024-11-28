import lodash from 'lodash'
import {parse} from 'node-html-parser'

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
    const _questionType = question.QuestionTypeId

    let output = {} as AssetString

    // ===========================
    switch (_questionType) {
      // 10. 单选题
      case 10: {
        question.QuestionTypeName = '单选题'
        output = await this._processChoice(question, params)
        break
      }

      // 20. 多选题
      case 20: {
        question.QuestionTypeName = '多选题'
        question.IsMultipleChoice = true
        output = await this._processChoice(question, params)
        break
      }

      // 50. 简答题
      case 50: {
        question.QuestionTypeName = '简答题'
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
   * _processChoice
   */
  protected async _processChoice(question: any, params: Params): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      context: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: question.IsMultipleChoice ? 'fixed,multi' : 'fixed',
    }

    // ===========================
    // _context.
    _meta.context = await markji.parseHtml(
      lodash.map(question.TKContextQuestionsEntityList, (context) => context.FormatContent).join('<br>'),
      {style: this.HTML_STYLE},
    )

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.FormatContent, {style: this.HTML_STYLE})

    if (question.RealOrderNumber) {
      const _char = find(Object.values(_meta.content.assets), 'data:', {fuzzy: true}) ? '\n' : ' '
      _meta.content.text = String(question.RealOrderNumber) + '.' + _char + _meta.content.text
    }

    // ===========================
    // _options.
    _meta.options = await Promise.all(
      lodash.map(question.QuestionContentKeyValue, (option) =>
        markji.parseHtml(lodash.trim(option.Key === option.Value ? option.Key : `${option.Key}. ${option.Value}`), {
          style: this.HTML_STYLE,
        }),
      ),
    )

    // 富文本选项
    if (lodash.some(_meta.options, (op) => find(Object.values(op.assets), 'data:', {fuzzy: true}))) {
      _meta.options = []

      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      const _options: string[] = []

      for (const option of question.QuestionContentKeyValue) {
        _options.push(`${option.Key}. ${option.Value}`)
        _meta.options.push({assets: [] as never, text: option.Key})
      }

      const _optionsContent = await html.toImage(_options.join('<br>'), {style: `${this.HTML_STYLE}${_htmlStyle}`})

      _meta.content.text += `\n${_optionsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optionsContent.assets)
    }

    // ===========================
    // _answers.
    _meta.answers = lodash.filter(
      lodash.map(question.QuestionsAnswerEntity.AnswerArray, (answer) => {
        return lodash.find(_meta.options, (option) => {
          return option.text.startsWith(answer)
        }) as AssetString
      }),
    )

    if (lodash.isEmpty(_meta.answers)) {
      throwError('Empty answers.', {params, question})
    } else if (_meta.answers.length > 1) {
      _meta.optionsAttr = 'fixed,multi'
    }

    _meta.options = lodash.map(_meta.options, (option) => ({
      assets: option.assets,
      text: `${_meta.answers.includes(option) ? '*' : '-'} ${option.text}`,
    }))

    // ===========================
    // _explain.
    let _explain = question.QuestionsAnswerEntity.FormatContent || ''

    for (const [_idx, _img] of (question.QuestionsAnswerEntity.FormatImages || []).entries()) {
      _explain += `<br>图${_idx + 1}: <img src="${_img}">`
    }

    _meta.explain = await markji.parseHtml(_explain, {style: this.HTML_STYLE})

    // ===========================
    // points.
    const _points = [
      '[P#L#[T#B#考点]]',
      lodash.map(question.ExamSitesEntityList, (entity) => entity.ExamSiteName).join('\n'),
      '[P#L#[T#B#来源]]',
      question.RealPaperName || '',
      '[P#L#[T#B#解析]]',
      lodash.trim(_meta.explain.text),
    ]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.QuestionTypeName}]`,
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
   * _processTranslate
   */
  protected async _processTranslate(question: any, params: Params): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      context: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      translation: {assets: [] as never, text: ''} as AssetString,
    }

    const _translation = question.QuestionsAnswerEntity.AnswerArray.join('<br>')

    // ===========================
    // 判断题.
    const _firstPContent = parse(_translation).querySelectorAll('p').shift()?.textContent?.trim().slice(0, 10)
    if (_firstPContent?.startsWith('正确') || _firstPContent?.startsWith('错误')) {
      const _question = lodash.cloneDeep(question)
      _question.QuestionTypeName = '判断题'

      _question.QuestionContentKeyValue = [
        {Key: 'A', Value: '正确'},
        {Key: 'B', Value: '错误'},
      ]

      _question.QuestionsAnswerEntity.FormatContent = _question.QuestionsAnswerEntity.AnswerArray.join('<br>')

      _question.QuestionsAnswerEntity.AnswerArray = []

      if (_firstPContent?.includes('正确')) {
        _question.QuestionsAnswerEntity.AnswerArray.push('A')
      }

      if (_firstPContent?.includes('错误')) {
        _question.QuestionsAnswerEntity.AnswerArray.push('B')
      }

      if (_question.QuestionsAnswerEntity.AnswerArray.length > 1) {
        throwError('Empty answers.', {_question, params, question})
      }

      return this._processChoice(_question, params)
    }

    // ===========================
    // _context.
    _meta.context = await markji.parseHtml(
      lodash.map(question.TKContextQuestionsEntityList, (context) => context.FormatContent).join('<br>'),
      {style: this.HTML_STYLE},
    )

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.FormatContent, {style: this.HTML_STYLE})

    if (question.RealOrderNumber) {
      const _char = find(Object.values(_meta.content.assets), 'data:', {fuzzy: true}) ? '\n' : ' '
      _meta.content.text = String(question.RealOrderNumber) + '.' + _char + _meta.content.text
    }

    // ===========================
    // _translation.
    _meta.translation = await markji.parseHtml(_translation, {style: this.HTML_STYLE})

    // ===========================
    // _explain.
    _meta.explain = {assets: [] as never, text: ''}

    // ===========================
    // _output.
    const _points = [
      '[P#L#[T#B#考点]]',
      lodash.map(question.ExamSitesEntityList, (entity) => entity.ExamSiteName).join('\n'),
      '[P#L#[T#B#来源]]',
      question.RealPaperName || '',
      '[P#L#[T#B#解析]]',
      lodash.trim(_meta.explain.text),
    ]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.QuestionTypeName}]`,
          lodash.trim(_meta.context.text),
          lodash.trim(_meta.content.text),
          '---\n',
          _meta.translation.text,
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
      _meta.context.assets,
      _meta.explain.assets,
      _meta.translation.assets,
    )

    return _output
  }
}
