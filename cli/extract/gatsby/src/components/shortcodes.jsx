import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { navigate, Link } from 'gatsby'
import { IoChevronForward } from 'react-icons/io5'
import * as styles from './shortcodes.module.css'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import yaml from 'js-yaml'

// this is a mess

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
  const [showMetadata, setShowMetadata] = useState(false)
  const [showBreadbrumbs, setShowBreadcrumbs] = useState(false)

  const handleClick = (event) => {
    if (event.target.tagName === 'A') return
    navigate('/' + props._id)
  }

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'm') {
        setShowMetadata(!showMetadata)
      } else if (event.key === 'b') {
        setShowBreadcrumbs(!showBreadbrumbs)
      }
    }
    document.addEventListener('keypress', handleKeyPress)
    return () => {
      document.removeEventListener('keypress', handleKeyPress)
    }
  }, [showMetadata])

  return (
    <div className={className} onClick={handleClick}>
      <div className={styles.container}>
        {props.children}
        {showMetadata && !props.direction ? (<SyntaxHighlighter language="yaml">{getYaml(props)}</SyntaxHighlighter>) : null }
      </div>
    </div>
  )
})

const Seam = withNuggetPropTypes((props) => {
  const mainStyle = (props.direction) ? '' : styles.main
  const className = `${styles.bordered} ${mainStyle} ${styles.seam}`
  const [showMetadata, setShowMetadata] = useState(false)
  const [showBreadbrumbs, setShowBreadcrumbs] = useState(false)

  const handleClick = (event) => {
    if (event.target.tagName === 'A') return
    navigate('/' + props._id)
  }

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'm') {
        setShowMetadata(!showMetadata)
      } else if (event.key === 'b') {
        setShowBreadcrumbs(!showBreadbrumbs)
      }
    }
    document.addEventListener('keypress', handleKeyPress)
    return () => {
      document.removeEventListener('keypress', handleKeyPress)
    }
  }, [showMetadata, showBreadbrumbs])

  return (
    <div className={className} onClick={handleClick}>
      <div className={styles.container}>
        {props.children}
        {showMetadata && !props.direction ? (<SyntaxHighlighter language="yaml">{getYaml(props)}</SyntaxHighlighter>) : null }
      </div>
    </div>
  )
})

const Passage = withNuggetPropTypes((props) => {
  const mainStyle = (props.direction) ? '' : styles.main
  const className = `${styles.bordered} ${mainStyle} ${styles.passage}`
  const [showMetadata, setShowMetadata] = useState(false)
  const [showBreadbrumbs, setShowBreadcrumbs] = useState(false)

  const handleClick = (event) => {
    if (event.target.tagName === 'A') return
    if (props._key === 'adit') navigate('/')
    else navigate('/' + props._id.replace('passage/', 'nugget/'))
  }

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'm') {
        setShowMetadata(!showMetadata)
      } else if (event.key === 'b') {
        setShowBreadcrumbs(!showBreadbrumbs)
      }
    }
    document.addEventListener('keypress', handleKeyPress)
    return () => {
      document.removeEventListener('keypress', handleKeyPress)
    }
  }, [showMetadata])

  return (
    <div className={className} onClick={handleClick}>
      <div className={styles.container}>
        {props.children}
        {showMetadata && !props.direction ? (<SyntaxHighlighter language="yaml">{getYaml(props)}</SyntaxHighlighter>) : null }
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
  return (<div className={styles.breadcrumbs}>{props.children}</div>)
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
  children: PropTypes.any.isRequired
}

const Crumb = (props) => {
  const link = '/' + props.id.replace('passage/', 'nugget/')
  return (<div className={styles.crumb}><IoChevronForward /><Link to={link}>{props.label}</Link></div>)
}
Crumb.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired
}

const NuggetBody = (props) => {
  return (<div className={styles.content}>{props.children}</div>)
}
NuggetBody.propTypes = {
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
  Crumb
}
