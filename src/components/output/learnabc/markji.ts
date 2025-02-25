import lodash from 'lodash'

import {AssetString, QBankParams} from '../../../@types/common.js'
import html from '../../../utils/html.js'
import {find, throwError} from '../../../utils/index.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

const srcHandler = (src: string): string => {
  return src
}

export default class Markji extends MarkjiBase {
  protected async _processChoice(question: any, qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: question.IsMultipleChoice ? 'fixed,multi' : 'fixed',
      points: {} as Record<string, AssetString>,
    }

    // ===========================
    // _context.
    _meta.content = await markji.parseHtml(question.shift_question, {srcHandler, style: this.HTML_STYLE})

    // ===========================
    // _options.
    const _options = JSON.parse(question.options)

    _meta.options = await Promise.all(
      lodash
        .chain(_options)
        .map((_op, _idx) => {
          const _point = String.fromCodePoint(65 + _idx)
          return markji.parseHtml(`${_point}. ${_op}`, {srcHandler, style: this.HTML_STYLE})
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
        srcHandler,
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
      {skipInput: true},
    )

    // ====================
    // _points.
    _meta.points['[P#L#[T#B#题目类别]]'] = {
      assets: {},
      text: `${qbank.bank.meta?.name} / ${qbank.category.name} / ${qbank.sheet.name}`,
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

  protected async toMarkjiOutput(question: any, qbank: QBankParams): Promise<AssetString> {
    let output = {} as AssetString

    if (qbank.bank.meta?.type === 'topic' || qbank.bank.meta?.type === 'stage') {
      output = await this._processChoice(question, qbank)
    } else if (qbank.bank.meta?.type === 'grammar') {
      const _content = await html.toText(lodash.trim(lodash.map(question, (c) => c.html_content).join('\n')))

      for (const [key, value] of Object.entries(_content.assets)) {
        _content.text = _content.text.replaceAll(key, value)
      }

      output = await markji.parseHtml(_content.text.replaceAll(/\n+/g, '\n\n'), {
        srcHandler,
        style: this.HTML_STYLE,
      })

      output.text = `[P#H2,center#[T#!36b59d#${question[0].title}]]\n${output.text}`
    } else if (qbank.bank.meta?.type) {
      throwError('Unsupported question type', {qbank, question})
    }

    return output
  }
}
