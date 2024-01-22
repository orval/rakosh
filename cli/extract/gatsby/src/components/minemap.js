import { navigate } from 'gatsby'
import PropTypes from 'prop-types'
import React, { useState, useEffect, useRef } from 'react'
import { Tree } from 'react-arborist'
import { IoCaretDown, IoCaretForward } from 'react-icons/io5'

import minemapJson from '../../content/minemap.json'
import slugLookup from '../../content/slug_lookup.json'

import * as styles from './minemap.module.css'

let rem = 14

const MineMap = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [height, setHeight] = useState(600)
  const [width, setWidth] = useState(300)
  const mineMapRef = useRef(null)

  useEffect(() => {
    // get real rem once
    rem = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('font-size'))

    const handleResize = () => {
      // 9 rem accounts for topbar, sidebar padding, mapsearchbox height, and mapsearch margin-bottom
      setHeight(Math.max(200, Math.min(window.innerHeight) - (10 * rem)))

      // get the width to pass to Tree from bounding size
      setWidth(mineMapRef.current.getBoundingClientRect().width)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className={styles.minemap} ref={mineMapRef}>
      <div className={styles.mapsearch}>
        <label htmlFor="mapsearchinput" className={styles.label}>Search map:</label>
        <input
          className={styles.mapsearchbox}
          id="mapsearchinput"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)} />
      </div>
      <Tree
        renderRow={Row}
        className={styles.tree}
        initialData={minemapJson.initialData}
        rowHeight={30}
        selectionFollowsFocus={true}
        disableMultiSelection={true}
        disableEdit={true}
        disableDrag={true}
        disableDrop={true}
        height={height}
        width={width}
        indent={rem}
        initialOpenState={minemapJson.initialOpenState}
        searchTerm={searchTerm}
        searchMatch={
          (node, term) => node.data.name.toLowerCase().includes(term.toLowerCase())
        }
      >
        {Node}
      </Tree>
    </div>
  )
}

function Node ({ node, style, dragHandle }) {
  return (
    <div data-type={node.data.type} style={style} ref={dragHandle} className={styles.node}>
      <MapArrow node={node} />
      {node.data.name}
    </div>
  )
}

Node.propTypes = {
  node: PropTypes.object.isRequired,
  style: PropTypes.object,
  dragHandle: PropTypes.func
}

const Row = ({ node, attrs, innerRef, children }) => {
  const nav = (key) => {
    navigate((key === '/adit') ? '/' : slugLookup[key])
  }

  const handleClick = (event) => {
    // navigate to clicked content or toggle the node open/closed
    if (event.target.dataset.type) {
      nav('/' + node.data.id.split('|').pop())
    } else {
      node.toggle()
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      nav('/' + node.data.id.split('|').pop())
    }
  }

  // override these from styles.row
  delete attrs.style.width
  delete attrs.style.left

  return (
    // attrs already contains role="treeitem" and the appropriate ARIA attributes
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      {...attrs}
      ref={innerRef}
      data-type={node.data.type}
      className={styles.row}
      onFocus={(e) => e.stopPropagation()}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  )
}

Row.propTypes = {
  node: PropTypes.object.isRequired,
  attrs: PropTypes.object.isRequired,
  innerRef: PropTypes.func.isRequired,
  children: PropTypes.any.isRequired
}

function MapArrow ({ node }) {
  return (
    <span role='button'>
      {node.isInternal ? (node.isOpen ? (<IoCaretDown />) : (<IoCaretForward />)) : null}
    </span>
  )
}

MapArrow.propTypes = {
  node: PropTypes.object.isRequired
}

export default MineMap
