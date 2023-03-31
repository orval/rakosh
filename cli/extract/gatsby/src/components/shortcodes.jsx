import * as React from 'react'
import PropTypes from 'prop-types'
import { navigate } from 'gatsby'
import * as styles from './shortcodes.module.css'

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
    ]).isRequired,
    source: PropTypes.string // .isRequired
  }
  return Component
}

const Nugget = withNuggetPropTypes((props) => {
  const bordered = (props.inseam) ? '' : styles.bordered
  const mainStyle = (props.direction) ? '' : styles.main
  const className = `${bordered} ${mainStyle} ${getNuggetStyle(props)}`
  const handleClick = () => {
    navigate('/' + props._id)
  }
  return (
    <div className={className} onClick={handleClick}>
      {props.children}
    </div>
  )
})

const Seam = withNuggetPropTypes((props) => {
  const mainStyle = (props.direction) ? '' : styles.main
  const className = `${styles.bordered} ${mainStyle} ${styles.seam}`
  const handleClick = () => {
    navigate('/' + props._id)
  }
  return (
    <div className={className} onClick={handleClick}>
      {props.children}
    </div>
  )
})

const Passage = withNuggetPropTypes((props) => {
  const mainStyle = (props.direction) ? '' : styles.main
  const className = `${styles.bordered} ${mainStyle} ${styles.passage}`
  const handleClick = () => {
    if (props._key === 'adit') navigate('/')
    else navigate('/' + props._id.replace('passage/', 'nugget/'))
  }
  return (
    <div className={className} onClick={handleClick}>
      {props.children}
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
