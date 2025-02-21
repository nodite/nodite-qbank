import lodash from 'lodash'
import {parse} from 'node-html-parser'

import {AssetString, QBankParams} from '../../../@types/common.js'
import html from '../../../utils/html.js'
import {find, throwError} from '../../../utils/index.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

export default class Markji extends MarkjiBase {
  protected async toMarkjiOutput(question: any, qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: 'fixed',
      points: {} as Record<string, AssetString>,
    }

    const _html = parse(question)

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(
      lodash
        .chain(_html.querySelector('div:first-of-type > div:first-of-type > p:first-of-type')?.innerHTML || '')
        .trim()
        .replace(/^【所有题目】/, '')
        .value(),
      {style: this.HTML_STYLE},
    )

    // ===========================
    // _options.
    _meta.options = await Promise.all(
      lodash.map(_html.querySelectorAll('div[id^=choiceDiv]'), async (element) => {
        const choice = lodash.trim(element.querySelector('label')?.innerHTML || '')
        const content = markji.parseHtml(choice, {style: this.HTML_STYLE})

        return content
      }),
    )

    // 富文本选项
    if (
      lodash.map(_meta.options, 'text').join('\n').length > 800 ||
      lodash.some(_meta.options, (op) => find(Object.values(op.assets), 'data:', {fuzzy: true}))
    ) {
      _meta.options = []

      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      const _options: string[] = []

      for (const option of _html.querySelectorAll('div[id^=choiceDiv]')) {
        _options.push(lodash.trim(option.querySelector('label')?.outerHTML || ''))
        _meta.options.push({
          assets: [] as never,
          text: lodash.trim(option.querySelector('label')?.querySelector('strong')?.textContent || ''),
        })
      }

      const _optionsContent = await html.toImage(_options.join('<br>'), {style: `${this.HTML_STYLE}${_htmlStyle}`})

      _meta.content.text += `\n${_optionsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optionsContent.assets)
    }

    // ===========================
    // _answers.
    _meta.answers = lodash
      .chain(lodash.trim(_html.querySelector('p[id=answerConcatenateStr]')?.innerHTML || ''))
      .split(',')
      .map((answer) => lodash.find(_meta.options, (option) => option.text.startsWith(answer.trim())) as AssetString)
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
    // _explain.
    _meta.points['[P#L#[T#B#解析]]'] = await markji.parseHtml(
      lodash
        .chain(_html.querySelectorAll('div#answerExplanation > p') || [])
        .map((p) => lodash.trim(p.innerHTML))
        .join('\n')
        .trim()
        .value(),
      {style: this.HTML_STYLE},
    )

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
