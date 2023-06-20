import React, { useContext, Children } from 'react'
import LayoutContext from './layoutcontext'
import PropTypes from 'prop-types'
import { navigate, Link } from 'gatsby'
import { IoChevronForward } from 'react-icons/io5'
import * as styles from './shortcodes.module.css'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import yaml from 'js-yaml'

// there is ample opportunity for refactoring here

function withNuggetPropTypes (Component) {
  Component.propTypes = {
    children: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.arrayOf(PropTypes.object)
    ]),
    source: PropTypes.string
  }
  return Component
}

function getYaml (props) {
  const entries = { ...props }
  delete entries.children
  return yaml.dump(entries)
}

function nav (key, tagName = '') {
  if (tagName === 'A') return
  if (key === 'adit') navigate('/')
  else navigate(key)
}

const Nugget = withNuggetPropTypes((props) => {
  const bordered = (props.inseam) ? '' : styles.bordered
  const tabIndex = (props.inseam) ? -1 : 0
  const mainStyle = (props.direction || props.inseam) ? '' : styles.main
  const className = `${bordered} ${mainStyle} ${styles.nugget}`
  const { globalValue } = useContext(LayoutContext)

  const handleClick = (event) => {
    nav(props.slug, event.target.tagName)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      nav(props._key)
    }
  }

  return (
    <div
      role="button"
      className={className}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={tabIndex}
    >
      <div className={styles.container}>
        {props.children}
        {globalValue.showMetadata && !props.direction && !props.inseam
          ? (<SyntaxHighlighter language="yaml">{getYaml(props)}</SyntaxHighlighter>)
          : null }
      </div>
    </div>
  )
})

const Seam = withNuggetPropTypes((props) => {
  const mainStyle = (props.direction) ? '' : styles.main
  const className = `${styles.bordered} ${mainStyle} ${styles.seam}`
  const { globalValue } = useContext(LayoutContext)

  const handleClick = (event) => {
    nav(props.slug, event.target.tagName)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      nav(props._key)
    }
  }

  return (
    <div
      role="button"
      className={className}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className={styles.container}>
        {props.children}
        <div className={styles.metadata}>
          {globalValue.showMetadata && !props.direction
            ? (<SyntaxHighlighter language="yaml">{getYaml(props)}</SyntaxHighlighter>)
            : null }
        </div>
      </div>
    </div>
  )
})

const Passage = withNuggetPropTypes((props) => {
  const mainStyle = (props.direction) ? '' : styles.main
  const small = (props.numPassages > 10) ? styles.small : ''
  const className = `${styles.bordered} ${mainStyle} ${styles.passage} ${small}`
  const { globalValue } = useContext(LayoutContext)

  const handleClick = (event) => {
    nav(props.slug, event.target.tagName)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      nav(props._key)
    }
  }

  return (
    <div
      role="button"
      className={className}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className={styles.container}>
        {props.children}
        {globalValue.showMetadata && !props.direction
          ? (<SyntaxHighlighter language="yaml">{getYaml(props)}</SyntaxHighlighter>)
          : null }
      </div>
    </div>
  )
})

const NuggetArea = (props) => {
  return <div className={styles.nuggetarea}>{props.children}</div>
}
NuggetArea.propTypes = Nugget.propTypes

const PassagesInbound = (props) => {
  return (
    <div className={styles.inboundpassage}>
      {props.children}
    </div>
  )
}
PassagesInbound.propTypes = Nugget.propTypes

const PassagesOutbound = (props) => {
  const numPassages = Children.toArray(props.children).length
  return (
    <div className={styles.outboundpassage}>
      {numPassages > 10
        ? React.Children.map(props.children, (child) =>
          React.cloneElement(child, { numPassages })
        )
        : props.children}
    </div>
  )
}
PassagesOutbound.propTypes = Nugget.propTypes

const NuggetsInbound = (props) => {
  return (
    <div className={styles.inboundnugget}>
      {props.children}
    </div>
  )
}
NuggetsInbound.propTypes = Nugget.propTypes

const NuggetsOutbound = (props) => {
  return (
    <div className={styles.outboundnugget}>
      {props.children}
    </div>
  )
}
NuggetsOutbound.propTypes = Nugget.propTypes

const Breadcrumbs = (props) => {
  const { globalValue } = useContext(LayoutContext)
  return (
    <div className={styles.breadcrumbs}>
      {globalValue.showBreadcrumbs && props.children}
    </div>
  )
}
Breadcrumbs.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.arrayOf(PropTypes.object)
  ]).isRequired
}

const Crumbs = (props) => {
  return (<div className={styles.crumbs}>{props.children}</div>)
}
Crumbs.propTypes = {
  children: PropTypes.any
}

const Crumb = (props) => {
  const link = '/' + props._key
  return (<div className={styles.crumb}><IoChevronForward /><Link to={link}>{props.label}</Link></div>)
}
Crumb.propTypes = {
  _key: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired
}

const NuggetBody = (props) => {
  return (<div tabIndex={-1}>{props.children}</div>)
}
NuggetBody.propTypes = {
  children: PropTypes.any.isRequired
}

const Table = (props) => {
  return (<table className={styles.table}>{props.children}</table>)
}
Table.propTypes = {
  children: PropTypes.any.isRequired
}

const Code = (props) => {
  if (!('className' in props)) {
    return <code>{props.children}</code>
  }

  const language = props.className.replace(/language-/, '')

  return (
    <SyntaxHighlighter
      language={language}
      style={github}
      customStyle={ { backgroundColor: '{{{color_bg}}}' } }
    >
      {props.children}
    </SyntaxHighlighter>
  )
}

Code.propTypes = {
  children: PropTypes.any.isRequired,
  className: PropTypes.string
}

export const components = {
  NuggetBody,
  Nugget,
  Seam,
  Passage,
  PassagesInbound,
  PassagesOutbound,
  NuggetsInbound,
  NuggetsOutbound,
  NuggetArea,
  Breadcrumbs,
  Crumbs,
  Crumb,
  table: Table,
  code: Code
}
