import lodash from 'lodash'

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

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.question)

    delete question.question

    // ===========================
    // _options.
    _meta.options = await Promise.all(
      lodash.map(question.options, async (option, point) =>
        markji.parseHtml(`${point}. ${option}`, {style: this.HTML_STYLE}),
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

      for (const [_point, _option] of question.options.entries()) {
        _options.push(`${_point}. ${_option}`)
        _meta.options.push({assets: [] as never, text: _point})
      }

      const _optionsContent = await html.toImage(_options.join('<br>'), {style: `${this.HTML_STYLE}${_htmlStyle}`})

      _meta.content.text += `\n${_optionsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optionsContent.assets)
    }

    delete question.options

    // ===========================
    // _answers.
    _meta.answers = lodash
      .chain(question.answer)
      .split(',')
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

    delete question.answer

    // ===========================
    // _points.
    if (lodash.has(question, 'competency')) {
      _meta.points['[P#L#[T#B#Competency]]'] = await markji.parseHtml(question.competency, {style: this.HTML_STYLE})
      delete question.competency
    }

    if (!lodash.isEmpty(question)) {
      throwError('Unknown attributes.', {qbank, question})
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
