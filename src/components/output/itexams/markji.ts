import lodash from 'lodash'
import {HTMLElement, parse} from 'node-html-parser'

import {AssetString, QBankParams} from '../../../@types/common.js'
import html from '../../../utils/html.js'
import {find, throwError} from '../../../utils/index.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

const srcHandler = (src: string): string => {
  return src
}

export default class Markji extends MarkjiBase {
  protected async toMarkjiOutput(question: any, qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: 'fixed',
      points: {} as Record<string, AssetString>,
    }

    const root = parse(question)

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(root.querySelector('.question_text')?.textContent.trim() || '', {
      srcHandler,
      style: this.HTML_STYLE,
    })

    // ===========================
    // _options.
    _meta.options = await Promise.all(
      lodash.map(root.querySelectorAll('.choices-list > li'), async (li: HTMLElement) =>
        markji.parseHtml(li.textContent.trim(), {srcHandler, style: this.HTML_STYLE}),
      ),
    )

    // 富文本选项
    if (
      lodash.map(_meta.options, 'text').join('\n').length > 800 ||
      lodash.some(_meta.options, (op) => find(Object.values(op.assets), 'data:', {fuzzy: true}))
    ) {
      _meta.options = []

      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      const _options: string[] = []

      for (const _li of root.querySelectorAll('.choices-list > li')) {
        _options.push(_li.textContent.trim())
        _meta.options.push({assets: [] as never, text: _li.getAttribute('data-choice') || ''})
      }

      const _optionsContent = await html.toImage(_options.join('<br>'), {
        srcHandler,
        style: `${this.HTML_STYLE}${_htmlStyle}`,
      })

      _meta.content.text += `\n${_optionsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optionsContent.assets)
    }

    // ===========================
    // _answers.
    const answerBlock = root.querySelector('.answer_block')

    _meta.answers = lodash
      .chain(answerBlock?.getAttribute('data-answer') || '')
      .split()
      .map((answer) => lodash.find(_meta.options, (op) => op.text.startsWith(answer.trim())) as AssetString)
      .value()

    if (lodash.isEmpty(_meta.answers)) {
      throwError('No answers found.', {qbank, question})
    } else if (_meta.answers.length > 1) {
      _meta.optionsAttr = 'fixed,multi'
    }

    _meta.options = lodash.map(_meta.options, (option) => ({
      assets: option.assets,
      text: `${_meta.answers.includes(option) ? '*' : '-'} ${option.text}`,
    }))

    // ===========================
    // _points.
    const _ps = answerBlock?.querySelectorAll('p')

    for (const _p of _ps || []) {
      const _parts = _p.textContent.trim().split(':', 2)

      if (_parts.length <= 1) {
        throwError('Unknown point found.', {p: _p.toString(), qbank, question})
      }

      _meta.points[`[P#L#[T#B#${_parts[0].trim()}]]`] = await markji.parseHtml(_parts[1].trim(), {
        srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
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
