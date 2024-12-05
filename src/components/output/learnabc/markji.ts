import lodash from 'lodash'

import {AssetString, Params} from '../../../types/common.js'
import html from '../../../utils/html.js'
import {find, throwError} from '../../../utils/index.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

const imgSrcHandler = (src: string): string => {
  return src
}

export default class Markji extends MarkjiBase {
  /**
   * _output.
   */
  protected async _output(question: any, params: Params): Promise<AssetString> {
    let output = {} as AssetString

    if (params.bank.meta?.type === 'topic' || params.bank.meta?.type === 'stage') {
      output = await this._processChoice(question, params)
    } else if (params.bank.meta?.type) {
      throwError('Unsupported question type', {params, question})
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
      options: [] as AssetString[],
      optionsAttr: question.IsMultipleChoice ? 'fixed,multi' : 'fixed',
      points: {} as Record<string, AssetString>,
    }

    // ===========================
    // _context.
    _meta.content = await markji.parseHtml(question.shift_question, {imgSrcHandler, style: this.HTML_STYLE})

    let _offset = 0
    for (const _space of _meta.content.text.matchAll(/—+/g)) {
      const _idx = _space.index + _offset
      _meta.content.text = _meta.content.text.slice(0, _idx) + '\n' + _meta.content.text.slice(_idx)
      _offset++
    }

    _meta.content.text = lodash.trim(_meta.content.text)

    // ===========================
    // _options.
    const _options = JSON.parse(question.options)

    _meta.options = await Promise.all(
      lodash
        .chain(_options)
        .map((_op, _idx) => {
          const _point = String.fromCodePoint(65 + _idx)
          return markji.parseHtml(`${_point}. ${_op}`, {imgSrcHandler, style: this.HTML_STYLE})
        })
        .value(),
    )

    // 富文本选项
    if (lodash.some(_meta.options, (op) => find(Object.values(op.assets), 'data:', {fuzzy: true}))) {
      _meta.options = []

      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      const _opts: string[] = []

      for (const [_idx, _op] of Object.entries(_options)) {
        const _point = String.fromCodePoint(65 + Number(_idx))
        _opts.push(`${_point}. ${_op}`)
        _meta.options.push({assets: [] as never, text: _point})
      }

      const _optsContent = await html.toImage(_opts.join('<br>'), {
        imgSrcHandler,
        style: `${this.HTML_STYLE}${_htmlStyle}`,
      })

      _meta.content.text += `\n${_optsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optsContent.assets)
    }

    // ===========================
    // _answers.
    _meta.answers = lodash.filter(_meta.options, (op) => {
      const correctOptions = lodash.split(question.correct_option, '')
      return correctOptions.includes(op.text[0])
    })

    _meta.options = lodash.map(_meta.options, (op) => ({
      assets: op.assets,
      text: `${_meta.answers.includes(op) ? '*' : '-'} ${op.text}`,
    }))

    // ====================
    // _explain.
    _meta.points['[P#L#[T#B#题目解析]]'] = await markji.parseHtml(
      (question.shift_analyzing || '').replaceAll(/ {3,}/g, ' '),
    )

    // ====================
    // _points.
    _meta.points['[P#L#[T#B#题目类别]]'] = {
      assets: {},
      text: `${params.bank.meta?.name} / ${params.category.name} / ${params.sheet.name}`,
    }

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[#${question.id}]`,
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
      ...lodash.map(_meta.options, 'assets'),
      ...lodash.map(_meta.points, 'assets'),
    )

    return _output
  }
}
