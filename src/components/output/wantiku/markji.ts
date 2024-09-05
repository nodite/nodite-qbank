import lodash from 'lodash'
import {parse} from 'node-html-parser'

import {AssetString, Params} from '../../../types/common.js'
import html from '../../../utils/html.js'
import {throwError} from '../../../utils/index.js'
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
        throwError('Unsupported question type.', question)
      }
    }

    return output
  }

  /**
   * _processChoice
   */
  protected async _processChoice(question: any, _params: Params): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      context: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: 'fixed',
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

    // ===========================
    // _options.
    _meta.options = lodash.map(question.QuestionContentKeyValue, (option) => {
      return {assets: [] as never, text: `${option.Key}. ${option.Value}`}
    })

    // ===========================
    // _answers.
    _meta.answers = lodash.map(question.QuestionsAnswerEntity.AnswerArray, (answer) => {
      return lodash.find(_meta.options, (option) => {
        return option.text.startsWith(answer + '.')
      }) as AssetString
    })

    if (lodash.isEmpty(_meta.answers)) {
      throwError('Empty answers.', question)
    } else if (_meta.answers.length > 1) {
      _meta.optionsAttr = 'fixed,multi'
    }

    _meta.options = lodash.map(_meta.options, (option) => ({
      assets: option.assets,
      text: `${_meta.answers.includes(option) ? '*' : '-'} ${option.text}`,
    }))

    // ===========================
    // _explain.
    _meta.explain = await markji.parseHtml(question.QuestionsAnswerEntity.FormatContent || '', {style: this.HTML_STYLE})

    // ===========================
    // points.
    const _points = [
      '[P#L#[T#B#考点]]',
      lodash.map(question.ExamSitesEntityList, (entity) => entity.ExamSiteName).join(', '),
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

    _output.assets = lodash.merge({}, _meta.context.assets, _meta.content.assets, _meta.explain.assets)

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
    const _firstPContent = parse(_translation).querySelectorAll('p').shift()?.textContent?.trim()
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
        throwError('Empty answers.', {_question, question})
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
      lodash.map(question.ExamSitesEntityList, (entity) => entity.ExamSiteName).join(', '),
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

    _output.assets = lodash.merge({}, _meta.content.assets, _meta.explain.assets, _meta.translation.assets)

    return _output
  }
}
