import lodash from 'lodash'

import {AssetString, Params} from '../../../types/common.js'
import html from '../../../utils/html.js'
import {find, throwError} from '../../../utils/index.js'
import parser from '../../../utils/parser.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

export default class Markji extends MarkjiBase {
  /**
   * _output.
   */
  protected async _output(question: any, params: Params): Promise<AssetString> {
    const _questionType = question.type

    let output = {} as AssetString

    // ===========================
    switch (_questionType) {
      // 1. SingleChoice, 单选题
      case 1: {
        question.typeName = '单选题'
        output = await this._processChoice(question, params)
        break
      }

      // 2. MultipleChoice, 多选题
      case 2: {
        question.typeName = '多选题'
        output = await this._processChoice(question, params)
        break
      }

      // 4. Cloze, 完型填空
      case 4: {
        question.typeName = '完型填空'
        output = await this._processChoice(question, params)
        break
      }

      // 5. TrueOrFlase, 判断题
      case 5: {
        question.typeName = '判断题'

        if (!lodash.some(question.accessories, {type: 101})) {
          question.accessories.push({options: ['正确', '错误'], type: 101})
        }

        output = await this._processChoice(question, params)

        break
      }

      // 6. ReadingComprehension5In7, 阅读理解7选5
      case 6: {
        question.typeName = '阅读理解7选5'
        output = await this._processChoice(question, params)
        break
      }

      // 61. BlankFilling, 填空题
      case 61: {
        question.typeName = '填空题'
        output = await this._processBlankFilling(question, params)
        break
      }

      // 84. 连线题
      case 84: {
        // TODO
        break
      }

      // 101. 翻译
      case 101: {
        question.typeName = '翻译'
        output = await this._processTranslate(question, params)
        break
      }

      // 102. 大作文
      case 102: {
        question.typeName = '大作文'
        output = await this._processTranslate(question, params)
        break
      }

      // 103. 小作文
      case 103: {
        question.typeName = '小作文'
        output = await this._processTranslate(question, params)
        break
      }

      // 2053. 选词填空
      case 2053: {
        // TODO
        break
      }

      // 2055. BlankFilling, 选句填空
      case 2055: {
        question.typeName = '选句填空'
        output = await this._processBlankFilling(question, params)
        break
      }

      default: {
        throwError('Unsupported question type.', question)
      }
    }

    return output
  }

  /**
   * _processBlankFilling
   */
  protected async _processBlankFilling(question: any, params: Params): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.content, {style: this.HTML_STYLE})

    // ===========================
    // _options.
    const _optionAccessory = lodash.find(question.accessories, {type: 101})
    if (!lodash.isEmpty(_optionAccessory)) {
      _meta.content.text +=
        '\n\n' +
        lodash
          .map(_optionAccessory.options, (option, idx) => {
            return `${String.fromCodePoint(65 + Number(idx))}. ${option}`
          })
          .join('\n')
    }

    // ===========================
    // _blanks.
    if (question.correctAnswer.type === 202) {
      for (const [index, assertKey] of Object.keys(_meta.content.assets).entries()) {
        if (!assertKey.includes('input#')) continue
        _meta.content.assets[assertKey] = `[F#${index + 1}#${question.correctAnswer.blanks[index]}]`
        _meta.content.text = _meta.content.text.replaceAll(assertKey, _meta.content.assets[assertKey])
      }
    }
    // unknown.
    else {
      throwError('Unsupported correct answer type.', question)
    }

    // ===========================
    // explain.
    _meta.explain = await markji.parseHtml(question.solution.solution || '', {style: this.HTML_STYLE})

    // ===========================
    // points.
    const _points = [
      '[P#L#[T#B#类别]]',
      `${params.category.name} / ${params.sheet.name}`,
      `[P#L#[T#B#来源]]`,
      question.solution?.source || '',
      `[P#L#[T#B#解析]]`,
      lodash.trim(_meta.explain.text),
    ]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([`[${question.typeName}]`, lodash.trim(_meta.content.text), `---`, ..._points])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge({}, _meta.content.assets, _meta.explain.assets)

    return _output
  }

  /**
   * _processChoice
   */
  // eslint-disable-next-line complexity
  protected async _processChoice(question: any, params: Params): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      contentTrans: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      materials: [] as AssetString[],
      options: [] as AssetString[],
      optionsAttr: question.type === 2 ? 'fixed,multi' : 'fixed',
      optionsTrans: {assets: [] as never, text: ''} as Record<string, string>,
    }

    // ===========================
    // _materials.
    for (const material of question.materials) {
      const _material = await parser.input(material.content)

      for (const [key, value] of Object.entries(_material.assets)) {
        _material.text = _material.text.replaceAll(key, value)
      }

      _meta.materials.push(await html.toImage(_material.text, {style: this.HTML_STYLE}))
    }

    // ===========================
    // _content.
    _meta.content = {assets: {} as Record<string, string>, text: question.content} as AssetString

    // 完型填空题目中的题号
    if (/<p>(\d+)<\/p>/.test(_meta.content.text)) {
      _meta.content.text = _meta.content.text.replaceAll(/<p>(\d+)<\/p>/g, '第 $1 题')
    }

    _meta.content = await markji.parseHtml(_meta.content.text, {style: this.HTML_STYLE})

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
          _meta.options.push(...lodash.map(accessory.options, (option) => ({assets: [] as never, text: option})))

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
            _meta.options.push({assets: [] as never, text: point})
          }

          const _optionsContent = await html.toImage(_options.join('<br>'), {
            style: `${this.HTML_STYLE}${_htmlStyle}`,
          })

          _meta.content.text += `\n${_optionsContent.text}`
          _meta.content.assets = lodash.merge({}, _meta.content.assets, _optionsContent.assets)

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
              const questionDesc = await markji.parseHtml(accessory.content, {style: this.HTML_STYLE})
              _meta.content.text = `${questionDesc.text}\n${_meta.content.text}`
              _meta.content.assets = lodash.merge({}, questionDesc.assets, _meta.content.assets)

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
        assets: option.assets,
        text: `${_meta.answers.includes(option) ? '*' : '-'} ${option.text}`,
      }))
    } else {
      throwError('Unsupported correct answer type.', question)
    }

    // ===========================
    // _explain.
    _meta.explain = await markji.parseHtml(question.solution.solution || '', {style: this.HTML_STYLE})

    // ===========================
    // _points.
    const _points = [
      '[P#L#[T#B#类别]]',
      `${params.category.name} / ${params.sheet.name}`,
      '[P#L#[T#B#来源]]',
      question.solution?.source || '',
      '[P#L#[T#B#题目翻译]]',
      lodash.trim(_meta.content.text),
      lodash.trim(_meta.contentTrans.text),
      '[P#L#[T#B#选项翻译]]',
      ...lodash.map(_meta.optionsTrans || {}, (value, key) => `${lodash.trim(key)}: ${lodash.trim(value)}`),
      '[P#L#[T#B#解析]]',
      lodash.trim(_meta.explain.text),
    ]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.typeName}]`,
          ...lodash.map(_meta.materials, 'text'),
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
      ...lodash.map(_meta.materials, 'assets'),
      _meta.content.assets,
      ...lodash.map(_meta.options, 'assets'),
      _meta.explain.assets,
      ...lodash.map(_meta.answers, 'assets'),
    )

    return _output
  }

  /**
   * _processTranslate
   */
  protected async _processTranslate(question: any, params: Params): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      translation: {assets: [] as never, text: ''} as AssetString,
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.content || '', {style: this.HTML_STYLE})

    // ===========================
    // _translation.
    const translation = find<any>(question.solution.solutionAccessories, 'reference')

    _meta.translation = await markji.parseHtml(translation?.content || '', {style: this.HTML_STYLE})

    // ===========================
    // _explain.
    _meta.explain = await markji.parseHtml(question.solution.solution || '', {style: this.HTML_STYLE})

    // ===========================
    // points.
    const _points = [
      '[P#L#[T#B#类别]]',
      `${params.category.name} / ${params.sheet.name}`,
      `[P#L#[T#B#来源]]`,
      question.solution?.source || '',
      `[P#L#[T#B#解析]]`,
      lodash.trim(_meta.explain.text),
    ]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.typeName}]`,
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

    _output.assets = lodash.merge({}, _meta.content.assets, _meta.translation.assets, _meta.explain.assets)

    return _output
  }
}
