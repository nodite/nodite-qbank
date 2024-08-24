import lodash from 'lodash'
import sleep from 'sleep-promise'

import {AssertString, ConvertOptions, UploadOptions} from '../../../types/common.js'
import {emitter} from '../../../utils/event.js'
import html from '../../../utils/html.js'
import {reverseTemplate, throwError} from '../../../utils/index.js'
import parser from '../../../utils/parser.js'
import markji from '../../../utils/vendor/markji.js'
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
    // prepare.
    const cacheClient = this.getCacheClient()

    // cache key
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

      const _questionType = _originQuestion.topic_type

      let output = {} as AssertString

      // ====================
      switch (_questionType) {
        // 1. 单选题
        // 2. 多选题
        // 3. 判断题
        case 1:
        case 2:
        case 3: {
          output = await this._processChoice(_originQuestion, params)
          break
        }

        // 4. 问答题
        // 8. 名词解释
        // 10. 简答题
        // 12. 论述题
        // 13. 案例分析题
        case 4:
        case 8:
        case 10:
        case 12:
        case 13: {
          output = await this._processTranslate(_originQuestion, params)
          break
        }

        // 5. 填空题
        case 5: {
          output = await this._processBlankFilling(_originQuestion, params)
          break
        }

        default: {
          throwError('Unsupported question type', _originQuestion)
        }
      }

      output = {
        asserts: output.asserts,
        text: `[${_originQuestion.topic_type_name}]\n${output.text}`,
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
   * _processBlankFilling
   */
  protected async _processBlankFilling(question: any, params: Params): Promise<AssertString> {
    const _meta = {
      content: {} as AssertString,
      explain: {} as AssertString,
    }

    // ====================
    // _content.
    _meta.content = await parser.underline(question.questionAsk)

    // ====================
    // _blanks.
    const _blanks = question.correctOption.split('；')
    for (const [idx, assertKey] of Object.keys(_meta.content.asserts).entries()) {
      if (!assertKey.includes('[input#')) continue
      _meta.content.asserts[assertKey] = `[F#${idx + 1}#${_blanks[idx]}]`
      _meta.content.text = _meta.content.text.replaceAll(assertKey, _meta.content.asserts[assertKey])
    }

    // ====================
    // _explain.
    _meta.explain = await markji.parseHtml(question.explanation)

    // ====================
    // _points.
    const _points = []

    _points.push(
      '[P#L#[T#B#来源]]',
      params.bank.name,
      params.category.name,
      params.sheet.name,
      '[P#L#[T#B#题型]]',
      question.topic_type_name,
    )

    if (_meta.explain.text) {
      _points.push('[P#L#[T#B#解析]]', _meta.explain.text.trim())
    }

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([_meta.content.text.trim(), '---', ..._points])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.asserts = lodash.merge({}, _meta.content.asserts, _meta.explain.asserts)

    return _output
  }

  /**
   * _processChoice.
   */
  protected async _processChoice(question: any, params: Params): Promise<AssertString> {
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
      optionsAttr: question.topic_type === 2 ? 'fixed,multi' : 'fixed',
    }

    // ====================
    // _content.
    _meta.content = await markji.parseHtml(question.questionAsk)

    // ====================
    // _options.
    const _options = lodash
      .chain(question)
      .pickBy((_value, key) => key.match(/^[A-Z]$/))
      .map((value, key) => (value ? `${key}. ${value}` : ''))
      .filter()
      .value()

    // 富文本选项
    if (_options.join('').length > 800) {
      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      const _optionsContent = await html.toImage(`${htmlStyle}\n${_htmlStyle}\n${_options.join('<br>')}`)

      _meta.content.text += `\n${_optionsContent.text}`
      _meta.content.asserts = lodash.merge({}, _meta.content.asserts, _optionsContent.asserts)
    }
    // 普通选项
    else {
      _meta.options = await Promise.all(lodash.map(_options, (option) => markji.parseHtml(option)))
    }

    // ====================
    // _answers.
    _meta.answers = lodash.filter(_meta.options, (option) => {
      const correctOptions = lodash.split(question.correctOption, '')
      return correctOptions.includes(option.text[0])
    })

    _meta.options = lodash.map(_meta.options, (option) => ({
      asserts: option.asserts,
      text: `${_meta.answers.includes(option) ? '*' : '-'} ${option.text}`,
    }))

    // ====================
    // _explain.
    _meta.explain = await markji.parseHtml(question.explanation)

    // ====================
    // _points.
    const _points = []

    _points.push(
      '[P#L#[T#B#来源]]',
      params.bank.name,
      params.category.name,
      params.sheet.name,
      '[P#L#[T#B#题型]]',
      question.topic_type_name,
    )

    if (_meta.explain.text) {
      _points.push('[P#L#[T#B#解析]]', _meta.explain.text.trim())
    }

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `${_meta.content.text.trim()}\n`,
          `[Choice#${_meta.optionsAttr}#\n${lodash.map(_meta.options, 'text').join('\n').trim()}\n]\n`,
          '---\n',
          ..._points,
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.asserts = lodash.merge(
      {},
      _meta.content.asserts,
      ...lodash.map(_meta.options, 'asserts'),
      _meta.explain.asserts,
      ...lodash.map(_meta.answers, 'asserts'),
    )

    return _output
  }

  /**
   * _processTranslate
   */
  protected async _processTranslate(question: any, params: Params): Promise<AssertString> {
    const _meta = {
      content: {} as AssertString,
      explain: {} as AssertString,
      translation: {} as AssertString,
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.questionAsk || '')

    // ===========================
    // _translation.
    _meta.translation = await markji.parseHtml(question.correctOption || '')

    // ===========================
    // _explain.
    _meta.explain = await markji.parseHtml(question.explanation || '')

    // ===========================
    // points.
    const _points = []

    _points.push(
      '[P#L#[T#B#来源]]',
      params.bank.name,
      params.category.name,
      params.sheet.name,
      '[P#L#[T#B#题型]]',
      question.topic_type_name,
    )

    if (_meta.explain.text) {
      _points.push(`[P#L#[T#B#解析]]`, _meta.explain.text.trim())
    }

    // _output.
    const _output = await html.toText(
      lodash
        .filter([_meta.content.text.trim(), '---', _meta.translation.text, '---', ..._points])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.asserts = lodash.merge({}, _meta.content.asserts, _meta.translation.asserts, _meta.explain.asserts)

    return _output
  }
}
