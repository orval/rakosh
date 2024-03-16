export const headerRegression = {
  names: ['heading-level-regression'],
  description: 'Headings must not regress levels -- split into separate nuggets',
  tags: ['headings', 'custom'],
  function: function rule (params, onError) {
    let lastLevel = 0
    params.tokens.forEach(function (token) {
      if (token.type === 'heading_open') {
        const level = parseInt(token.tag.slice(1), 10)
        if (level < lastLevel) {
          onError({
            lineNumber: token.lineNumber,
            detail: `Heading level decreases from ${lastLevel} to ${level}.`,
            context: token.line
          })
        }
        lastLevel = level
      }
    })
  }
}

export const noBracketsInHeaders = {
  names: ['no-brackets-in-headers'],
  description: 'Do not use brackets in headers',
  tags: ['headings', 'custom'],
  function: function rule (params, onError) {
    const disallowedCharsPattern = /[[\]{}<>]/

    params.tokens.forEach(function (token) {
      if (token.type === 'heading_open') {
        const nextToken = params.tokens[params.tokens.indexOf(token) + 1]
        if (nextToken && nextToken.type === 'inline') {
          const content = nextToken.content

          if (disallowedCharsPattern.test(content)) {
            onError({
              lineNumber: token.lineNumber,
              detail: 'Headers must not contain brackets',
              context: content
            })
          }
        }
      }
    })
  }
}
