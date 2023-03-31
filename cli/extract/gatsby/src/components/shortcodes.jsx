import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { navigate } from 'gatsby'
import * as styles from './shortcodes.module.css'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import yaml from 'js-yaml'

function getNuggetStyle (props) {
  if (props.type === 'passage') return styles.passage
  if (props.type === 'seam') return styles.seam
  return styles.nugget
}

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
  const className = `${bordered} ${mainStyle} ${getNuggetStyle(props)}`
  const [showMetadata, setShowMetadata] = useState(false)

  const handleClick = () => {
    navigate('/' + props._id)
  }

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'm') {
        setShowMetadata(!showMetadata)
      }
    }
    document.addEventListener('keypress', handleKeyPress)
    return () => {
      document.removeEventListener('keypress', handleKeyPress)
    }
  }, [showMetadata])

  return (
    <div className={className} onClick={handleClick}>
      {props.children}
      {showMetadata && !props.direction ? (<SyntaxHighlighter language="yaml">{getYaml(props)}</SyntaxHighlighter>) : null }
    </div>
  )
})

const Seam = withNuggetPropTypes((props) => {
  const mainStyle = (props.direction) ? '' : styles.main
  const className = `${styles.bordered} ${mainStyle} ${styles.seam}`
  const [showMetadata, setShowMetadata] = useState(false)

  const handleClick = () => {
    navigate('/' + props._id)
  }

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'm') {
        setShowMetadata(!showMetadata)
      }
    }
    document.addEventListener('keypress', handleKeyPress)
    return () => {
      document.removeEventListener('keypress', handleKeyPress)
    }
  }, [showMetadata])

  return (
    <div className={className} onClick={handleClick}>
      {props.children}
      {showMetadata && !props.direction ? (<SyntaxHighlighter language="yaml">{getYaml(props)}</SyntaxHighlighter>) : null }
    </div>
  )
})

const Passage = withNuggetPropTypes((props) => {
  const mainStyle = (props.direction) ? '' : styles.main
  const className = `${styles.bordered} ${mainStyle} ${styles.passage}`
  const [showMetadata, setShowMetadata] = useState(false)

  const handleClick = () => {
    if (props._key === 'adit') navigate('/')
    else navigate('/' + props._id.replace('passage/', 'nugget/'))
  }

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'm') {
        setShowMetadata(!showMetadata)
      }
    }
    document.addEventListener('keypress', handleKeyPress)
    return () => {
      document.removeEventListener('keypress', handleKeyPress)
    }
  }, [showMetadata])

  return (
    <div className={className} onClick={handleClick}>
      {props.children}
      {showMetadata && !props.direction ? (<SyntaxHighlighter language="yaml">{getYaml(props)}</SyntaxHighlighter>) : null }
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

export const components = {
  Nugget,
  Seam,
  Passage,
  PassagesInbound,
  PassagesOutbound,
  NuggetsInbound,
  NuggetsOutbound,
  NuggetArea
}
