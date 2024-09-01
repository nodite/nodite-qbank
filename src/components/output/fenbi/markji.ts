import lodash from 'lodash'
import sleep from 'sleep-promise'

import {AssertString, ConvertOptions, Params, UploadOptions} from '../../../types/common.js'
import {emitter} from '../../../utils/event.js'
import html from '../../../utils/html.js'
import {find, reverseTemplate, throwError} from '../../../utils/index.js'
import parser from '../../../utils/parser.js'
import markji from '../../../utils/vendor/markji.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_QUESTION_ITEM} from '../../cache-pattern.js'
import {Vendor} from '../../vendor/common.js'
import VendorManager from '../../vendor/index.js'
import {Output} from '../common.js'

export default class Markji extends Output {
  public static META = {key: 'markji', name: 'Markji'}

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
      switch (_questionType) {
        // 1. SingleChoice, 单选题
        case 1: {
          _originQuestion.typeName = '单选题'
          output = await this._processChoice(_originQuestion, params)
          break
        }

        // 2. MultipleChoice, 多选题
        case 2: {
          _originQuestion.typeName = '多选题'
          output = await this._processChoice(_originQuestion, params)
          break
        }

        // 4. Cloze, 完型填空
        case 4: {
          _originQuestion.typeName = '完型填空'
          output = await this._processChoice(_originQuestion, params)
          break
        }

        // 5. TrueOrFlase, 判断题
        case 5: {
          _originQuestion.typeName = '判断题'

          if (!lodash.some(_originQuestion.accessories, {type: 101})) {
            _originQuestion.accessories.push({options: ['正确', '错误'], type: 101})
          }

          output = await this._processChoice(_originQuestion, params)

          break
        }

        // 6. ReadingComprehension5In7, 阅读理解7选5
        case 6: {
          _originQuestion.typeName = '阅读理解7选5'
          output = await this._processChoice(_originQuestion, params)
          break
        }

        // 61. BlankFilling, 填空题
        case 61: {
          _originQuestion.typeName = '填空题'
          output = await this._processBlankFilling(_originQuestion, params)
          break
        }

        // 101. 翻译
        case 101: {
          _originQuestion.typeName = '翻译'
          output = await this._processTranslate(_originQuestion, params)
          break
        }

        // 102. 大作文
        case 102: {
          _originQuestion.typeName = '大作文'
          output = await this._processTranslate(_originQuestion, params)
          break
        }

        // 103. 小作文
        case 103: {
          _originQuestion.typeName = '小作文'
          output = await this._processTranslate(_originQuestion, params)
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
  public async upload(params: Params, options?: UploadOptions | undefined): Promise<void> {
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
   * _processBlankFilling
   */
  protected async _processBlankFilling(question: any, params: Params): Promise<AssertString> {
    const _meta = {
      content: {} as AssertString,
      explain: {} as AssertString,
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.content)

    // ===========================
    // blanks.
    if (question.correctAnswer.type === 202) {
      for (const [index, assertKey] of Object.keys(_meta.content.asserts).entries()) {
        if (!assertKey.includes('input#')) continue
        _meta.content.asserts[assertKey] = `[F#${index + 1}#${question.correctAnswer.blanks[index]}]`
        _meta.content.text = _meta.content.text.replaceAll(assertKey, _meta.content.asserts[assertKey])
      }
    }
    // unknown.
    else {
      throwError('Unsupported correct answer type.', question)
    }

    // ===========================
    // explain.
    _meta.explain = await markji.parseHtml(question.solution.solution)

    // ===========================
    // points.
    const _points = []

    _points.push('[P#L#[T#B#类别]]', `${params.category.name} / ${params.sheet.name}`)

    if (question.solution.source) {
      _points.push(`[P#L#[T#B#来源]]`, question.solution.source.trim())
    }

    if (_meta.explain.text) {
      _points.push(`[P#L#[T#B#解析]]`, _meta.explain.text.trim())
    }

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([`[${question.typeName}]`, _meta.content.text.trim(), `---`, ..._points])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.asserts = lodash.merge({}, _meta.content.asserts, _meta.explain.asserts)

    return _output
  }

  /**
   * _processChoice
   */
  // eslint-disable-next-line complexity
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
      contentTrans: {} as AssertString,
      explain: {} as AssertString,
      materials: [] as AssertString[],
      options: [] as AssertString[],
      optionsAttr: question.type === 2 ? 'fixed,multi' : 'fixed',
      optionsTrans: {} as Record<string, string>,
    }

    // ===========================
    // _materials.
    for (const material of question.materials) {
      const _material = await parser.input(material.content)

      for (const [key, value] of Object.entries(_material.asserts)) {
        _material.text = _material.text.replaceAll(key, value)
      }

      _meta.materials.push(await html.toImage(`${htmlStyle}\n${_material.text}`))
    }

    // ===========================
    // _content.
    _meta.content = {asserts: {} as Record<string, string>, text: question.content} as AssertString

    // 完型填空题目中的题号
    if (/<p>(\d+)<\/p>/.test(_meta.content.text)) {
      _meta.content.text = _meta.content.text.replaceAll(/<p>(\d+)<\/p>/g, '第 $1 题')
    }

    _meta.content = await markji.parseHtml(_meta.content.text, htmlStyle)

    // ===========================
    // _options.
    for (const accessory of question.accessories) {
      // 选项过长，转换为富文本选项
      if (accessory.type === 101 && accessory.options.join('').length > 800) {
        accessory.type = 102
      }

      switch (accessory.type) {
        // 101: 选项
        case 101: {
          _meta.options.push(...lodash.map(accessory.options, (option) => ({asserts: [] as never, text: option})))

          break
        }

        // 102: 富文本选项
        case 102: {
          const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

          // add A/B/C/D/... prefix for options
          const _options: string[] = []

          for (const option of accessory.options) {
            const point = String.fromCodePoint(65 + _options.length)
            _options.push(`${point}. ${option}`)
            _meta.options.push({asserts: [] as never, text: point})
          }

          const _optionsContent = await html.toImage(`${htmlStyle}\n${_htmlStyle}\n${_options.join('<br>')}`)

          _meta.content.text += `\n${_optionsContent.text}`
          _meta.content.asserts = lodash.merge({}, _meta.content.asserts, _optionsContent.asserts)

          break
        }

        // 151: 题目翻译
        case 151: {
          _meta.contentTrans = await html.toText(accessory.translation)

          break
        }

        // 181: 题目描述
        case 181: {
          switch (accessory.label) {
            // 不知道
            case null: {
              break
            }

            // 问题描述
            case 'questionDesc': {
              const questionDesc = await markji.parseHtml(accessory.content)
              _meta.content.text = `${questionDesc.text}\n${_meta.content.text}`
              _meta.content.asserts = lodash.merge({}, questionDesc.asserts, _meta.content.asserts)

              break
            }

            // 题目来源
            case 'source': {
              question.solution.source = question.solution.source || (await html.toText(accessory.content)).text

              break
            }

            // 不知道是啥玩意儿
            case 'customTheme': {
              break
            }

            default: {
              throwError('Unsupported accessory label.', {accessory, question})
            }
          }

          break
        }

        // 182: 材料标题, e.g. 2023年 英语二 阅读理解 Text4
        case 182: {
          // accessory.title

          break
        }

        // 1001: 选项翻译
        case 1001: {
          if (lodash.isEmpty(accessory.choiceTranslations)) break

          const choiceTrans = lodash.map(accessory.choiceTranslations, (translation) => {
            const trans = lodash.map(translation, (t) => {
              if (t.translation === 'null') t.translation = ''
              return t.translation || t.label
            })
            return trans.join('；')
          })

          _meta.optionsTrans = lodash.zipObject(lodash.map(_meta.options, 'text'), choiceTrans)

          break
        }

        // 1006: module，不知道是啥玩意儿
        case 1006: {
          // accessory.module

          break
        }

        default: {
          throwError('Unsupported accessory type.', {accessory, question})
        }
      }
    }

    // ===========================
    // _answers.
    // 201: Choice
    if (question.correctAnswer.type === 201) {
      for (const choice of question.correctAnswer.choice.split(',')) {
        _meta.answers.push(_meta.options[Number(choice)])
      }

      _meta.options = lodash.map(_meta.options, (option) => ({
        asserts: option.asserts,
        text: `${_meta.answers.includes(option) ? '*' : '-'} ${option.text}`,
      }))
    } else {
      throwError('Unsupported correct answer type.', question)
    }

    // ===========================
    // _explain.
    _meta.explain = await markji.parseHtml(question.solution.solution)

    // ===========================
    // points.
    const _points = []

    _points.push('[P#L#[T#B#类别]]', `${params.category.name} / ${params.sheet.name}`)

    if (question.solution.source) {
      _points.push('[P#L#[T#B#来源]]', question.solution.source.trim())
    }

    if (_meta.contentTrans.text) {
      _points.push('[P#L#[T#B#题目翻译]]', _meta.content.text.trim(), _meta.contentTrans.text.trim())
    }

    if (!lodash.isEmpty(_meta.optionsTrans)) {
      _points.push(
        '[P#L#[T#B#选项翻译]]',
        ...lodash.map(_meta.optionsTrans, (value, key) => `${(key || '').trim()}: ${(value || '').trim()}`),
      )
    }

    if (_meta.explain.text) {
      _points.push('[P#L#[T#B#解析]]', _meta.explain.text.trim())
    }

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.typeName}]`,
          ...lodash.map(_meta.materials, 'text'),
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
      ...lodash.map(_meta.materials, 'asserts'),
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
    _meta.content = await markji.parseHtml(question.content || '')

    // ===========================
    // _translation.
    const translation = find<any>(question.solution.solutionAccessories, 'reference')

    _meta.translation = await markji.parseHtml(translation?.content || '')

    // ===========================
    // _explain.
    _meta.explain = await markji.parseHtml(question.solution.solution)

    // ===========================
    // points.
    const _points = []

    _points.push('[P#L#[T#B#类别]]', `${params.category.name} / ${params.sheet.name}`)

    if (question.solution.source) {
      _points.push(`[P#L#[T#B#来源]]`, question.solution.source.trim())
    }

    if (_meta.explain.text) {
      _points.push(`[P#L#[T#B#解析]]`, _meta.explain.text.trim())
    }

    // _output.
    const _output = await html.toText(
      lodash
        .filter([`[${question.typeName}]`, _meta.content.text.trim(), '---', _meta.translation.text, '---', ..._points])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.asserts = lodash.merge({}, _meta.content.asserts, _meta.translation.asserts, _meta.explain.asserts)

    return _output
  }
}
