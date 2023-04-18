import React, { useContext } from 'react'
import LayoutContext from './layoutcontext'
import PropTypes from 'prop-types'
import { navigate, Link } from 'gatsby'
import { IoChevronForward } from 'react-icons/io5'
import * as styles from './shortcodes.module.css'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
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

const Nugget = withNuggetPropTypes((props) => {
  const bordered = (props.inseam) ? '' : styles.bordered
  const mainStyle = (props.direction) ? '' : styles.main
  const className = `${bordered} ${mainStyle} ${styles.nugget}`
  const { globalValue } = useContext(LayoutContext)

  const handleClick = (event) => {
    if (event.target.tagName === 'A') return
    navigate('/' + props._key)
  }

  return (
    <div className={className} onClick={handleClick}>
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
    if (event.target.tagName === 'A') return
    navigate('/' + props._key)
  }

  return (
    <div className={className} onClick={handleClick}>
      <div className={styles.container}>
        {props.children}
        {globalValue.showMetadata && !props.direction
          ? (<SyntaxHighlighter language="yaml">{getYaml(props)}</SyntaxHighlighter>)
          : null }
      </div>
    </div>
  )
})

const Passage = withNuggetPropTypes((props) => {
  const mainStyle = (props.direction) ? '' : styles.main
  const className = `${styles.bordered} ${mainStyle} ${styles.passage}`
  const { globalValue } = useContext(LayoutContext)

  const handleClick = (event) => {
    if (event.target.tagName === 'A') return
    if (props._key === 'adit') navigate('/')
    else navigate('/' + props._key)
  }

  return (
    <div className={className} onClick={handleClick}>
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
  return (
    <div className={styles.outboundpassage}>
      {props.children}
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
  return (<div className={styles.content}>{props.children}</div>)
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
  table: Table
}
