import lodash from 'lodash'
import sleep from 'sleep-promise'

import {AssertString, ConvertOptions, UploadOptions} from '../../../types/common.js'
import {emitter} from '../../../utils/event.js'
import html from '../../../utils/html.js'
import {throwError} from '../../../utils/index.js'
import markjiUtil from '../../../utils/markji.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_QUESTION_ITEM} from '../../cache-pattern.js'
import {Vendor} from '../../vendor/common.js'
import VendorManager from '../../vendor/index.js'
import {Output, Params} from '../common.js'

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
    const originQuestionItemKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)(cacheKeyParams)

    const originQuestionIds = lodash.map(
      await cacheClient.keys(originQuestionItemKey + ':*'),
      (key) => key.split(':').pop() as string,
    )

    // check questions.
    const questionItemCheckKey = lodash.template(CACHE_KEY_QUESTION_ITEM)(cacheKeyParams)

    if (options?.reconvert) {
      await cacheClient.delHash(questionItemCheckKey + ':*')
    }

    const questionIds = lodash.map(
      await cacheClient.keys(questionItemCheckKey + ':*'),
      (key) => key.split(':').pop() as string,
    )

    const diffQuestionIds = lodash.difference(originQuestionIds, questionIds).sort((a, b) => Number(a) - Number(b))

    // convert.
    emitter.emit('output.convert.count', questionIds.length)

    for (const _questionId of diffQuestionIds) {
      // emit.
      emitter.emit('output.convert.count', questionIds.length)

      const _originQuestion = await cacheClient.get(originQuestionItemKey + ':' + _questionId)
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
      await cacheClient.set(questionItemCheckKey + ':' + _questionId, output)
      if (!questionIds.includes(_questionId)) questionIds.push(_questionId)
      await sleep(1000)
    }

    emitter.emit('output.convert.count', questionIds.length)
    await sleep(1000)
    emitter.closeListener('output.convert.count')
  }

  /**
   * Upload.
   */
  public async upload(params: Params, options?: UploadOptions): Promise<void> {
    const markjiVendor = new (VendorManager.getClass('markji'))(this.getOutputUsername())

    const cacheClient = this.getCacheClient()
    const markjiInfo = await markjiUtil.getInfo(params, this.getOutputUsername())
    markjiInfo.requestConfig = await markjiVendor.login()

    // cache key
    const cacheKeyParams = {
      bankId: params.bank.id,
      categoryId: params.category.id,
      outputKey: (this.constructor as typeof Output).META.key,
      sheetId: '*', // all sheets.
      vendorKey: (params.vendor.constructor as typeof Vendor).META.key,
    }

    // check questions.
    const questionItemCheckKey = lodash.template(CACHE_KEY_QUESTION_ITEM)(cacheKeyParams)
    const questionIds = lodash
      .map(await cacheClient.keys(questionItemCheckKey + ':*'), (key) => key.split(':').pop() as string)
      // asc.
      .sort((a, b) => Number(a) - Number(b))

    const questionUploadedCount = options?.reupload ? 0 : markjiInfo.chapter.count || 0

    // upload.
    emitter.emit('output.upload.count', questionUploadedCount || 0)

    for (const [_questionIdx, _questionId] of questionIds.entries()) {
      if (_questionIdx < Number(questionUploadedCount)) continue

      const _question: AssertString = await cacheClient.get(questionItemCheckKey + ':' + _questionId)

      await markjiUtil.upload(markjiInfo, _questionIdx, _question)

      // emit.
      emitter.emit('output.upload.count', _questionIdx + 1)
      await sleep(500)
    }

    emitter.emit('output.upload.count', questionIds.length)

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
          `${question.type}\n`,
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
          `${question.type}\n`,
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
