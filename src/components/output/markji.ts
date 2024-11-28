import lodash from 'lodash'
import sleep from 'sleep-promise'

import {AssetString, ConvertOptions, Params, UploadOptions} from '../../types/common.js'
import {emitter} from '../../utils/event.js'
import {reverseTemplate, throwError} from '../../utils/index.js'
import markji from '../../utils/vendor/markji.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_QUESTION_ITEM, HashKeyScope} from '../cache-pattern.js'
import {Vendor} from '../vendor/common.js'
import VendorManager from '../vendor/index.js'
import {Output} from './common.js'

export default class Markji extends Output {
  public static META = {key: 'markji', name: 'Markji'}

  HTML_STYLE = [
    '<style type="text/css">',
    'html { font-size: 42px; }',
    `img { min-height: 42px; max-width: 90% }`,
    '</style>',
  ].join(' ')

  /**
   * Convert.
   */
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
      await params.vendor.invalidate(HashKeyScope.QUESTIONS, {...params, output: this, questionId: '*'})
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

      // _output.
      const output = await this._output(_originQuestion, params)

      if (output.text.length > 2500) {
        throwError('Output text is too long.', {output: output.text, params, question: _originQuestion})
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
   *
   */
  protected async _output(question: any, params: Params): Promise<AssetString> {
    throwError('Not implemented.', {params, question})
  }
}
