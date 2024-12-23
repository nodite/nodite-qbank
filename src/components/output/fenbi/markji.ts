/* eslint-disable complexity */
import lodash from 'lodash'

import {AssetString, Params} from '../../../types/common.js'
import html from '../../../utils/html.js'
import {throwError} from '../../../utils/index.js'
import parser from '../../../utils/parser.js'
import fenbi from '../../../utils/vendor/fenbi.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

const imgSrcHandler = (src: string): string => {
  if (src.startsWith('/api/planet/accessories')) {
    src = 'https://fb.fenbike.cn' + src
  } else if (src.startsWith('//')) {
    src = 'https:' + src
  }

  return src
}

// export enum QuestionType {
//   TypeInvalid = 0,
//   TypeSingleChoice = 1,
//   TypeMultiChoice = 2,
//   TypeUncertainChoice = 3,
//   TypeCloze = 4,
//   TypeTrueOrFlase = 5,
//   TypeReadingComprehension5In7 = 6,
//   TypeProof = 11,
//   TypeEssay = 12,
//   TypeCaculation = 13,
//   TypeReadingComprehension = 14,
//   TypeAnalysis = 15,
//   TypeCorrection = 16,
//   TypeOther = 50,
//   TypeBlankFilling = 61,
//   TypeAccountingEntry = 62,
//   TypeYufa = 64,
//   TypeOfficeWord = 106,
//   TypeOfficeExcel = 107,
//   TypeOfficePPT = 108,
//   TypeOfficeSUB = 5,
//   TypeOnlineCorrect = 21,
//   ESSAY_ANALYSIS = 22,
//   ESSAY_STRATEGY = 23,
//   ESSAY_OFFICIAL = 24,
//   ESSAY_WRITING = 25,
//   ESSAY_VIEW = 26,
//   PIAN_DUAN = 104,
// }

// switch (t) {
//   case r.e.TypeSingleChoice: {
//     return '\u5355\u9009\u9898'
//   }

//   case r.e.TypeMultiChoice: {
//     return '\u591A\u9009\u9898'
//   }

//   case r.e.TypeTrueOrFlase: {
//     return '\u5224\u65AD\u9898'
//   }

//   case r.e.TypeUncertainChoice: {
//     return '\u4E0D\u5B9A\u9879'
//   }

//   case r.e.TypeBlankFilling: {
//     return '\u586B\u7A7A\u9898'
//   }

//   case r.e.TypeEssay: {
//     return '\u8BBA\u8FF0\u9898'
//   }

//   case r.e.TypeAnalysis: {
//     return '\u5206\u6790\u9898'
//   }

//   case r.e.TypeOther: {
//     return '\u5176\u4ED6\uFF08\u9AD8\u8003\u586B\u7A7A\uFF09'
//   }

//   case r.e.TypeProof: {
//     return '\u8BC1\u660E\u9898'
//   }

//   case r.e.TypeYufa: {
//     return '\u8BED\u6CD5\u586B\u7A7A'
//   }

//   case r.e.TypeCaculation: {
//     return '\u8BA1\u7B97\u9898'
//   }

//   case r.e.TypeCorrection: {
//     return '\u6539\u9519'
//   }

//   case r.e.TypeCloze: {
//     return '\u5B8C\u5F62\u586B\u7A7A'
//   }

//   case r.e.TypeReadingComprehension5In7: {
//     return '\u9605\u8BFB\u7406\u89E37\u90095'
//   }

//   case r.e.TypeReadingComprehension: {
//     return '\u9605\u8BFB\u7406\u89E3'
//   }

//   default: {
//     return '\u5176\u4ED6'
//   }
// }

export default class Markji extends MarkjiBase {
  /**
   * _output.
   */
  protected async _output(question: any, params: Params): Promise<AssetString> {
    const _questionType = question.type

    let output = {} as AssetString

    // ===========================
    switch (_questionType) {
      // 1. TypeSingleChoice, 单选题
      case 1: {
        question.typeName = '单选题'
        question.optionsAttr = 'fixed'
        output = await this._processChoice(question, params)
        break
      }

      // 2. TypeMultiChoice, 多选题
      case 2:
      case 3: {
        question.typeName = '多选题'
        question.optionsAttr = 'fixed,multi'
        output = await this._processChoice(question, params)
        break
      }

      // 4. TypeCloze, 完型填空
      case 4: {
        question.typeName = '完型填空'
        output = await this._processChoice(question, params)
        break
      }

      // 5. TypeTrueOrFlase, 判断题
      case 5: {
        question.typeName = '判断题'

        if (!lodash.some(question.accessories, {type: 101})) {
          question.accessories.push({options: ['正确', '错误'], type: 101})
        }

        output = await this._processChoice(question, params)

        break
      }

      // 6. TypeReadingComprehension5In7, 阅读理解7选5
      case 6: {
        question.typeName = '阅读理解7选5'
        output = await this._processChoice(question, params)
        break
      }

      // 12. TypeEssay, 论述题
      case 12: {
        question.typeName = '论述题'
        output = await this._processTranslate(question, params)
        break
      }

      // 21: TypeOnlineCorrect, 在线批改
      case 21: {
        question.typeName = '在线批改'
        output = await this._processTranslate(question, params)
        break
      }

      // 22: TypeEssayAnalysis, 作文分析
      case 22: {
        question.typeName = '作文分析'
        output = await this._processTranslate(question, params)
        break
      }

      // 23: TypeEssayStrategy, 作文策略
      case 23: {
        question.typeName = '作文策略'
        output = await this._processTranslate(question, params)
        break
      }

      // 24: TypeEssayOfficial, 作文范文
      case 24: {
        question.typeName = '作文范文'
        output = await this._processTranslate(question, params)
        break
      }

      // 25: TypeEssayWriting, 作文写作
      case 25: {
        question.typeName = '作文写作'
        output = await this._processTranslate(question, params)
        break
      }

      // 26: TypeEssayView, 作文观点
      case 26: {
        question.typeName = '作文观点'
        output = await this._processTranslate(question, params)
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

      // 104.
      case 104: {
        question.typeName = '归纳概括'
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
        throwError('Unsupported question type.', {params, question})
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
      options: [] as AssetString[],
      points: {} as Record<string, AssetString>,
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.content, {imgSrcHandler, style: this.HTML_STYLE})

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
      throwError('Unsupported correct answer type.', {params, question})
    }

    // ===========================
    // explain.
    _meta.points['[P#L#[T#B#题目解析]]'] = await html.toImage(question.solution.solution || '', {
      imgSrcHandler,
      style: this.HTML_STYLE,
    })

    // ===========================
    // points.
    _meta.points['[P#L#[T#B#题目来源]]'] = {assets: {}, text: question.solution.source || ''}
    _meta.points['[P#L#[T#B#题目类别]]'] = {assets: {}, text: `${params.category.name} / ${params.sheet.name}`}

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.typeName}]`,
          lodash.trim(_meta.content.text),
          `---`,
          ...lodash
            .chain(_meta.points)
            .toPairs()
            .sortBy(0)
            .fromPairs()
            .map((point, key) => `${key}\n${point.text}`)
            .value(),
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge(
      {},
      _meta.content.assets,
      ...lodash.map(_meta.options, 'assets'),
      ...lodash.map(_meta.points, 'assets'),
    )

    return _output
  }

  /**
   * _processChoice
   */

  protected async _processChoice(question: any, params: Params): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      materials: [] as AssetString[],
      options: [] as AssetString[],
      optionsAttr: question.optionsAttr || ([2, 3].includes(question.type) ? 'fixed,multi' : 'fixed'),
      points: {} as Record<string, AssetString>,
    }

    // ===========================
    // _materials.
    for (const material of question.materials) {
      const _material = await parser.input(material.content, {showIndex: true})

      for (const [key, value] of Object.entries(_material.assets)) {
        _material.text = _material.text.replaceAll(key, value)
      }

      // 材料配件
      if (!lodash.isEmpty(material.accessories)) {
        // 音频文本
        const _transcript = lodash.find(material.accessories, {label: 'transcript', type: 181})
        const _translation = lodash.find(material.accessories, {type: 151})

        lodash.remove(material.accessories, _transcript)
        lodash.remove(material.accessories, _translation)

        if (_transcript?.content || _translation?.translation) {
          _meta.points['[P#L#[T#B#材料翻译]]'] = await html.toImage(
            await fenbi.parseDoc(`${_transcript?.content}\n${_translation?.translation}`),
            {imgSrcHandler, style: this.HTML_STYLE},
          )
        }

        // 材料解析
        const _materialExplain = lodash.find(material.accessories, {label: 'materialExplain', type: 181})

        lodash.remove(material.accessories, _materialExplain)

        if (_materialExplain?.content) {
          _meta.points['[P#L#[T#B#材料解析]]'] = await html.toImage(await fenbi.parseDoc(_materialExplain?.content), {
            imgSrcHandler,
            style: this.HTML_STYLE,
          })
        }

        // 重点词汇
        const _zdch = lodash.find(material.accessories, {label: 'zdch', type: 181})

        lodash.remove(material.accessories, _zdch)

        if (_zdch?.content) {
          _meta.points['[P#L#[T#B#重点词汇]]'] = await html.toImage(await fenbi.parseDoc(_zdch?.content), {
            imgSrcHandler,
            style: this.HTML_STYLE,
          })
        }

        // 音频
        const _audio = lodash.find(material.accessories, {type: 185})

        lodash.remove(material.accessories, _audio)

        if (_audio?.url) {
          _meta.materials.push(await parser.audio(_audio?.url))
        }

        if (!lodash.isEmpty(material.accessories)) {
          throwError('Unsupported material accessories.', {material, params})
        }
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

    _meta.content = await markji.parseHtml(_meta.content.text, {imgSrcHandler, style: this.HTML_STYLE})

    // ===========================
    // accessories.
    for (const _accessory of question.accessories) {
      // 选项过长，转换为富文本选项
      if (_accessory.type === 101 && _accessory.options.join('').length > 800) {
        _accessory.type = 102
      }
    }

    // 101: 选项
    const _options = lodash.find(question.accessories, {type: 101})

    lodash.remove(question.accessories, _options)

    if (!lodash.isEmpty(_options?.options)) {
      _meta.options.push(...lodash.map(_options?.options, (option) => ({assets: [] as never, text: option})))
    }

    // 102: 富文本选项
    const _optionsHtml = lodash.find(question.accessories, {type: 102})

    lodash.remove(question.accessories, _optionsHtml)

    if (!lodash.isEmpty(_optionsHtml?.options)) {
      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      // add A/B/C/D/... prefix for options
      const _options: string[] = []

      for (const _op of _optionsHtml.options) {
        const point = String.fromCodePoint(65 + _options.length)
        _options.push(`${point}. ${await fenbi.parseDoc(_op)}`)
        _meta.options.push({assets: [] as never, text: point})
      }

      const _optionsContent = await html.toImage(_options.join('<br>'), {
        style: `${this.HTML_STYLE}${_htmlStyle}`,
      })

      _meta.content.text += `\n${_optionsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optionsContent.assets)
    }

    // 151: 题目翻译
    const _contentTrans = lodash.find(question.accessories, {type: 151})

    lodash.remove(question.accessories, _contentTrans)

    if (_contentTrans?.translation) {
      _meta.points['[P#L#[T#B#题目翻译]]'] = await markji.parseHtml(await fenbi.parseDoc(_contentTrans?.translation))
    }

    // 181+null: 不知道
    // TODO
    lodash.remove(question.accessories, {label: 'null', type: 181})

    // 181+questionDesc: 题目描述
    const _questionDesc = lodash.find(question.accessories, {label: 'questionDesc', type: 181})

    lodash.remove(question.accessories, _questionDesc)

    if (_questionDesc?.content) {
      const questionDesc = await markji.parseHtml(_questionDesc?.content, {imgSrcHandler, style: this.HTML_STYLE})
      _meta.content.text = `${questionDesc.text}\n${_meta.content.text}`
      _meta.content.assets = lodash.merge({}, questionDesc.assets, _meta.content.assets)
    }

    // 181+source: 题目来源
    const _source = lodash.find(question.accessories, {label: 'source', type: 181})

    lodash.remove(question.accessories, _source)

    _meta.points['[P#L#[T#B#题目来源]]'] = await html.toText(
      await fenbi.parseDoc(question.solution.source || _source?.content || ''),
    )

    // 181+customTheme: 自定义主题
    // TODO
    lodash.remove(question.accessories, {label: 'customTheme', type: 181})

    // 181+listenQuestionStem: 听力题干
    const _listenQuestionStem = lodash.find(question.accessories, {label: 'listenQuestionStem', type: 181})

    lodash.remove(question.accessories, _listenQuestionStem)

    if (_listenQuestionStem?.content) {
      _meta.points['[P#L#[T#B#听力题干]]'] = await html.toText(await fenbi.parseDoc(_listenQuestionStem?.content))
    }

    // 182: 材料标题
    // TODO
    lodash.remove(question.accessories, {type: 182})

    // 1001: 选项翻译
    const _optionsTrans = lodash.find(question.accessories, {type: 1001})

    lodash.remove(question.accessories, _optionsTrans)

    if (!lodash.isEmpty(_optionsTrans?.choiceTranslations)) {
      const choiceTrans = lodash.map(_optionsTrans?.choiceTranslations, (translation) => {
        const trans = lodash.map(translation, (t) => {
          if (t.translation === 'null') t.translation = ''
          return t.translation || t.label
        })
        return trans.join('；')
      })

      _meta.points['[P#L#[T#B#选项翻译]]'] = {
        assets: {},
        text: lodash
          .chain(_meta.options)
          .map('text')
          .zipObject(choiceTrans)
          .map((value, key) => `${key}: ${value}`)
          .value()
          .join('\n'),
      }
    }

    // 1006: module，不知道是啥玩意儿
    // TODO
    lodash.remove(question.accessories, {type: 1006})

    // others.
    if (!lodash.isEmpty(question.accessories)) {
      throwError('Unsupported accessories.', {params, question})
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
      throwError('Unsupported correct answer type.', {params, question})
    }

    // ===========================
    // _explain.
    // 题意指导
    const _tyzd = lodash.find(question.solution.solutionAccessories, {label: 'tyzd', type: 181})

    lodash.remove(question.solution.solutionAccessories, _tyzd)

    // 干扰项分析
    const _interferenceAnalysis = lodash.find(question.solution.solutionAccessories, {
      label: 'interferenceAnalysis',
      type: 181,
    })

    lodash.remove(question.solution.solutionAccessories, _interferenceAnalysis)

    if (!lodash.isEmpty(question.solution.solutionAccessories)) {
      throwError('Unsupported solution accessories.', {params, question})
    }

    _meta.points['[P#L#[T#B#题目解析]]'] = await markji.parseHtml(
      lodash.filter([_tyzd?.content, _interferenceAnalysis?.content, question.solution.solution]).join('\n'),
      {imgSrcHandler, style: this.HTML_STYLE},
    )

    // ===========================
    // _points.
    _meta.points['[P#L#[T#B#题目类别]]'] = {assets: {}, text: `${params.category.name} / ${params.sheet.name}`}

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
          ...lodash
            .chain(_meta.points)
            .toPairs()
            .sortBy(0)
            .fromPairs()
            .map((point, key) => `${key}\n${point.text}`)
            .value(),
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge(
      {},
      ...lodash.map(_meta.answers, 'assets'),
      _meta.content.assets,
      ...lodash.map(_meta.materials, 'assets'),
      ...lodash.map(_meta.options, 'assets'),
      ...lodash.map(_meta.points, 'assets'),
    )

    return _output
  }

  /**
   * _processTranslate
   */
  protected async _processTranslate(question: any, params: Params): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      materials: [] as AssetString[],
      points: {} as Record<string, AssetString>,
      translation: {assets: [] as never, text: ''} as AssetString,
    }

    // ===========================
    // _materials.
    for (const material of question.materials) {
      _meta.materials.push(await html.toImage(material.content, {imgSrcHandler, style: this.HTML_STYLE}))
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.content || '', {imgSrcHandler, style: this.HTML_STYLE})

    // ===========================
    // _translation.
    const _reference = lodash.find(question.solution.solutionAccessories, {label: 'reference', type: 181})

    lodash.remove(question.solution.solutionAccessories, _reference)

    _meta.translation = await markji.parseHtml(await fenbi.parseDoc(_reference?.content || ''), {
      imgSrcHandler,
      style: this.HTML_STYLE,
    })

    // ===========================
    // question.accessories
    // 182: 材料标题
    // TODO
    lodash.remove(question.accessories, {type: 182})

    // 试题分析
    const _stfx = lodash.find(question.accessories, {label: 'stfx', type: 181})

    lodash.remove(question.accessories, _stfx)

    if (_stfx?.content) {
      _meta.points['[P#L#[T#B#试题分析]]'] = await html.toImage(await fenbi.parseDoc(_stfx.content), {
        imgSrcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 写作题干
    const _xztg = lodash.find(question.accessories, {label: 'xztg', type: 181})

    lodash.remove(question.accessories, _xztg)

    if (_xztg?.content) {
      _meta.points['[P#L#[T#B#写作题干]]'] = await html.toImage(await fenbi.parseDoc(_xztg.content), {
        imgSrcHandler,
        style: this.HTML_STYLE,
      })
    }

    if (!lodash.isEmpty(question.accessories)) {
      throwError('Unsupported accessories.', {params, question})
    }

    // ===========================
    // question.solution.solutionAccessories
    // 解题技巧
    const _jcjs = lodash.find(question.solution.solutionAccessories, {label: 'jcjs', type: 181})

    lodash.remove(question.solution.solutionAccessories, _jcjs)

    if (_jcjs?.content) {
      _meta.points['[P#L#[T#B#解题技巧]]'] = await html.toImage(await fenbi.parseDoc(_jcjs.content), {
        imgSrcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 仿写翻译
    const _fwfy = lodash.find(question.solution.solutionAccessories, {label: 'fwfy', type: 181})

    lodash.remove(question.solution.solutionAccessories, _fwfy)

    if (_fwfy?.content) {
      _meta.points['[P#L#[T#B#仿写翻译]]'] = await html.toImage(await fenbi.parseDoc(_fwfy.content), {
        imgSrcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 重点词汇
    const _ldch = lodash.find(question.solution.solutionAccessories, {label: 'ldch', type: 181})

    lodash.remove(question.solution.solutionAccessories, _ldch)

    if (_ldch?.content) {
      _meta.points['[P#L#[T#B#重点词汇]]'] = await html.toImage(await fenbi.parseDoc(_ldch.content), {
        imgSrcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 维度分析
    const _demonstrate = lodash.find(question.solution.solutionAccessories, {label: 'demonstrate', type: 181})

    lodash.remove(question.solution.solutionAccessories, _demonstrate)

    if (_demonstrate?.content) {
      _meta.points['[P#L#[T#B#维度分析]]'] = await html.toImage(await fenbi.parseDoc(_demonstrate.content), {
        imgSrcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 题目解析
    if (question.solution.solution) {
      _meta.points['[P#L#[T#B#题目解析]]'] = await markji.parseHtml(question.solution.solution, {
        imgSrcHandler,
        style: this.HTML_STYLE,
      })
    }

    if (!lodash.isEmpty(question.solution.solutionAccessories)) {
      throwError('Unsupported solution accessories.', {params, question})
    }

    // ===========================
    // points.
    _meta.points['[P#L#[T#B#题目来源]]'] = {assets: {}, text: question.solution.source || ''}
    _meta.points['[P#L#[T#B#题目类别]]'] = {assets: {}, text: `${params.category.name} / ${params.sheet.name}`}

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.typeName}]`,
          ...lodash.map(_meta.materials, 'text'),
          lodash.trim(_meta.content.text),
          '---',
          _meta.translation.text,
          '---',
          ...lodash
            .chain(_meta.points)
            .toPairs()
            .sortBy(0)
            .fromPairs()
            .map((point, key) => `${key}\n${point.text}`)
            .value(),
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge(
      {},
      _meta.content.assets,
      ...lodash.map(_meta.materials, 'assets'),
      ...lodash.map(_meta.points, 'assets'),
      _meta.translation.assets,
    )

    return _output
  }
}
