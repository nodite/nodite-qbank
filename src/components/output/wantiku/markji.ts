import lodash from 'lodash'
import sleep from 'sleep-promise'

import {AssertString, ConvertOptions, Params, UploadOptions} from '../../../types/common.js'
import {emitter} from '../../../utils/event.js'
import html from '../../../utils/html.js'
import {reverseTemplate, throwError} from '../../../utils/index.js'
import markji from '../../../utils/vendor/markji.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_QUESTION_ITEM} from '../../cache-pattern.js'
import {Vendor} from '../../vendor/common.js'
import VendorManager from '../../vendor/index.js'
import {Output} from '../common.js'

export default class Markji extends Output {
  public static META = {key: 'markji', name: 'Markji'}

  public async convert(params: Params, options?: ConvertOptions): Promise<void> {
    // prepare.
    const cacheClient = this.getCacheClient()
    params.output = this

    // cache key.
    const cacheKeyParams = {
      bankId: params.bank.id,
      categoryId: params.category.id,
      outputKey: (this.constructor as typeof Output).META.key,
      sheetId: params.sheet.id,
      vendorKey: (params.vendor.constructor as typeof Vendor).META.key,
    }

    // check origin questions.
    const allQuestionParams = lodash.map(
      await cacheClient.keys(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'})),
      (key) => reverseTemplate(CACHE_KEY_ORIGIN_QUESTION_ITEM, key),
    )

    // check questions.
    if (options?.reconvert) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
    }

    const doneQuestionParams = lodash.map(
      await cacheClient.keys(lodash.template(CACHE_KEY_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'})),
      (key) => reverseTemplate(CACHE_KEY_QUESTION_ITEM, key),
    )

    const undoQuestionParams = lodash
      .differenceWith(
        allQuestionParams,
        doneQuestionParams,
        (a, b) =>
          a.bankId === b.bankId &&
          a.categoryId === b.categoryId &&
          a.sheetId === b.sheetId &&
          a.questionId === b.questionId,
      )
      .sort((a, b) => Number(a.questionId) - Number(b.questionId))

    // convert.
    emitter.emit('output.convert.count', doneQuestionParams.length)

    for (const _questionParam of undoQuestionParams) {
      // emit.
      emitter.emit('output.convert.count', doneQuestionParams.length)

      // _questionParam.
      _questionParam.outputKey = (this.constructor as typeof Output).META.key

      // _originQuestion.
      const _originQuestion = await cacheClient.get(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)(_questionParam))

      const _questionType = _originQuestion.QuestionTypeId

      let output = {} as AssertString

      // ===========================
      switch (_questionType) {
        // 10. 单选题
        case 10: {
          _originQuestion.QuestionTypeName = '单选题'

          output = await this._processChoice(_originQuestion, params)

          break
        }

        default: {
          throwError('Unsupported question type.', _originQuestion)
        }
      }

      // ===========================
      await cacheClient.set(lodash.template(CACHE_KEY_QUESTION_ITEM)(_questionParam), output)

      doneQuestionParams.push(_questionParam)

      await sleep(1000)
    }

    emitter.emit('output.convert.count', doneQuestionParams.length)

    await sleep(1000)

    emitter.closeListener('output.convert.count')
  }

  /**
   * Upload.
   */
  public async upload(params: Params, options?: UploadOptions): Promise<void> {
    params.output = this

    const markjiInfo = await markji.getInfo(params, this.getOutputUsername())
    markjiInfo.requestConfig = await new (VendorManager.getClass('markji'))(this.getOutputUsername()).login()

    await markji.bulkUpload({
      cacheClient: this.getCacheClient(),
      markjiInfo,
      params,
      uploadOptions: options,
    })
  }

  /**
   * _processChoice
   */
  protected async _processChoice(question: any, _params: Params): Promise<AssertString> {
    const htmlStyle = [
      '<style type="text/css">',
      'html { font-size: 42px; }',
      `img { min-height: 42px; }`,
      '</style>',
    ].join(' ')

    const _meta = {
      answers: [] as AssertString[],
      content: {} as AssertString,
      explain: {} as AssertString,
      options: [] as AssertString[],
      optionsAttr: question.type === 2 ? 'fixed,multi' : 'fixed',
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.FormatContent, htmlStyle)

    // ===========================
    // _options.
    _meta.options = lodash.map(question.QuestionContentKeyValue, (option) => {
      return {asserts: [] as never, text: `${option.Key}. ${option.Value}`}
    })

    // ===========================
    // _answers.
    _meta.answers = lodash.map(question.QuestionsAnswerEntity.AnswerArray, (answer) => {
      return lodash.find(_meta.options, (option) => {
        return option.text.startsWith(answer + '.')
      }) as AssertString
    })

    _meta.options = lodash.map(_meta.options, (option) => ({
      asserts: option.asserts,
      text: `${_meta.answers.includes(option) ? '*' : '-'} ${option.text}`,
    }))

    // ===========================
    // _explain.
    _meta.explain = await markji.parseHtml(question.QuestionsAnswerEntity.FormatContent)

    // ===========================
    // points.
    const _points = []

    _points.push(
      '[P#L#[T#B#类别]]',
      lodash.map(question.ExamSitesEntityList, (entity) => entity.ExamSiteName).join(', '),
    )

    if (question.RealPaperName) {
      _points.push('[P#L#[T#B#来源]]', question.RealPaperName || '')
    }

    if (_meta.explain.text) {
      _points.push('[P#L#[T#B#解析]]', _meta.explain.text.trim())
    }

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.QuestionTypeName}]`,
          `${_meta.content.text.trim()}\n`,
          `[Choice#${_meta.optionsAttr}#\n${lodash.map(_meta.options, 'text').join('\n').trim()}\n]\n`,
          '---\n',
          ..._points,
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.asserts = lodash.merge({}, _meta.content.asserts, _meta.explain.asserts)

    return _output
  }
}
