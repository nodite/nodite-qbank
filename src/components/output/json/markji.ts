import lodash from 'lodash'
import sleep from 'sleep-promise'

import {AssertString, ConvertOptions, UploadOptions} from '../../../types/common.js'
import {emitter} from '../../../utils/event.js'
import html from '../../../utils/html.js'
import {reverseTemplate, throwError} from '../../../utils/index.js'
import markji from '../../../utils/vendor/markji.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_QUESTION_ITEM} from '../../cache-pattern.js'
import {Params} from '../../common.js'
import {Vendor} from '../../vendor/common.js'
import VendorManager from '../../vendor/index.js'
import {Output} from '../common.js'

export default class Markji extends Output {
  public static META = {key: 'markji', name: 'Markji'}

  /**
   * Convert.
   */
  public async convert(params: Params, options?: ConvertOptions | undefined): Promise<void> {
    // prepare
    const cacheClient = this.getCacheClient()

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

      const _questionType = _originQuestion.type

      let output = {} as AssertString

      // ===========================
      if (_questionType.includes('判断选择')) {
        _originQuestion.content += '\nA.正确\nB.错误'
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
        output = await this._processChoice(_originQuestion)
      }
      // 名词解释、简答题、论述题、案例分析题
      else if (
        _questionType.includes('名词解释') ||
        _questionType.includes('简答') ||
        _questionType.includes('论述') ||
        _questionType.includes('案例分析')
      ) {
        output = await this._processTranslate(_originQuestion)
      }
      // unknown.
      else {
        throwError('Unsupported question type.', _originQuestion)
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
  public async upload(params: Params, options?: UploadOptions | undefined): Promise<void> {
    if (params.sheet.id !== '*') throw new Error('不支持分 sheet 上传，请选择"全部"')

    // prepare.
    const markjiVendor = new (VendorManager.getClass('markji'))(this.getOutputUsername())
    const cacheClient = this.getCacheClient()

    const markjiInfo = await markji.getInfo(params, this.getOutputUsername())
    markjiInfo.requestConfig = await markjiVendor.login()

    // check questions.
    const allQuestionKeys = lodash
      .chain(
        await cacheClient.keys(
          lodash.template(CACHE_KEY_QUESTION_ITEM)({
            bankId: params.bank.id,
            categoryId: params.category.id,
            outputKey: (this.constructor as typeof Output).META.key,
            questionId: '*',
            sheetId: params.sheet.id,
            vendorKey: (params.vendor.constructor as typeof Vendor).META.key,
          }),
        ),
      )
      .sort((a, b) => Number(a) - Number(b)) // asc.
      .value()

    const doneQuestionCount = options?.reupload ? 0 : markjiInfo.chapter.count || 0

    // upload.
    if (options?.totalEmit) options.totalEmit(allQuestionKeys.length)

    emitter.emit('output.upload.count', doneQuestionCount || 0)

    for (const [_questionIdx, _questionKey] of allQuestionKeys.entries()) {
      if (_questionIdx < Number(doneQuestionCount)) continue

      const _question: AssertString = await cacheClient.get(_questionKey)

      await markji.upload(markjiInfo, _questionIdx, _question)

      // emit.
      emitter.emit('output.upload.count', _questionIdx + 1)
      await sleep(500)
    }

    emitter.emit('output.upload.count', allQuestionKeys.length)

    await sleep(500)

    emitter.closeListener('output.upload.count')
  }

  /**
   * _processChoice.
   */
  protected async _processChoice(question: any): Promise<AssertString> {
    const _meta = {
      answer: {} as AssertString,
      content: {} as AssertString,
      explain: {} as AssertString,
      options: [] as AssertString[],
      optionsAttr: question.type.includes('多项选择') ? 'fixed,multi' : 'fixed',
    }

    const contents: string[] = question.content.split(/(?=\n[A-Z]\.)/)

    _meta.content = await html.toText(contents.shift()?.trim() || '')
    _meta.options = await Promise.all(lodash.map(contents, (content) => html.toText(content.trim())))
    _meta.answer = await html.toText(question.answer || '')
    _meta.explain = await html.toText(question.explain || '')

    _meta.options = lodash.map(_meta.options, (option) => {
      const point = option.text.split('.')[0]
      return {
        asserts: option.asserts,
        text: _meta.answer.text.includes(point) ? `* ${option.text}` : `- ${option.text}`,
      }
    })

    // _point.
    const _points = []

    _points.push(`[P#L#[T#B#解析]]`, _meta.explain.text.trim())

    // ===========================
    // _output.
    const output = await html.toText(
      lodash
        .filter([
          `[${question.type}]\n`,
          `${_meta.content.text.trim()}\n`,
          `[Choice#${_meta.optionsAttr}#\n${lodash.map(_meta.options, 'text').join('\n').trim()}\n]\n`,
          '---\n',
          ..._points,
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    output.asserts = lodash.merge(
      {},
      _meta.content.asserts,
      ...lodash.map(_meta.options, 'asserts'),
      _meta.answer.asserts,
      _meta.explain.asserts,
    )

    return output
  }

  /**
   * _processTranslate
   */
  protected async _processTranslate(question: any): Promise<AssertString> {
    const _meta = {
      content: {} as AssertString,
      explain: {} as AssertString,
      translation: {} as AssertString,
    }

    _meta.content = await html.toText(question.content || '')
    _meta.explain = await html.toText(question.explain || '')
    _meta.translation = await html.toText(question.answer || '')

    // _points.
    const _points = []

    _points.push(`[P#L#[T#B#解析]]`, _meta.explain.text.trim())

    // ===========================
    // _output.
    const output = await html.toText(
      lodash
        .filter([
          `[${question.type}]\n`,
          `${_meta.content.text.trim()}`,
          '---',
          _meta.translation.text.trim(),
          '---',
          ..._points,
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    output.asserts = lodash.merge({}, _meta.content.asserts, _meta.explain.asserts, _meta.translation.asserts)

    return output
  }
}
