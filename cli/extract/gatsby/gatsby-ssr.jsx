const React = require('react')

const HeadComponents = [
  // eslint-disable-next-line
  <title key='title'>{{mine_label}}</title>
]

const HtmlAttributes = {
  lang: 'en'
}

exports.onRenderBody = ({ setHtmlAttributes, setHeadComponents }) => {
  setHtmlAttributes(HtmlAttributes)
  setHeadComponents(HeadComponents)
}
