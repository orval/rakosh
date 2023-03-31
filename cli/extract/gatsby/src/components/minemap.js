import * as React from 'react'
import PropTypes from 'prop-types'
import { navigate } from 'gatsby'
import { Tree } from 'react-arborist'
import { IoCaretDown, IoCaretForward } from 'react-icons/io5'
import minemapJson from '../../content/minemap.json'
import * as styles from './minemap.module.css'

const MineMap = () => {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [height, setHeight] = React.useState(1000)
  const minemapRef = React.useRef(null)

  React.useEffect(() => {
    if (!minemapRef.current) return
    const handleResize = () => {
      setHeight(Math.min(minemapRef.current.offsetHeight, window.innerHeight))
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className={styles.minemap} ref={minemapRef}>
      <div className={styles.mapsearch}>
        <input
          className={styles.mapsearchbox}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)} />
      </div>
      <Tree
        className={styles.tree}
        initialData={minemapJson.initialData}
        rowHeight={30}
        selectionFollowsFocus={true}
        disableMultiSelection={true}
        disableEdit={true}
        disableDrag={true}
        disableDrop={true}
        height={height}
        indent={14}
        initialOpenState={minemapJson.initialOpenState}
        searchTerm={searchTerm}
      >
        {Node}
      </Tree>
    </div>
  )
}

function Node ({ node, style, dragHandle }) {
  const handleClick = (event) => {
    const id = node.data.id.split('|').pop()

    // navigate to clicked content or toggle the node open/closed
    if (event.target.dataset.type === 'nugget' || event.target.dataset.type === 'seam') {
      navigate('/' + id)
    } else if (event.target.dataset.type === 'passage') {
      if (id === 'passage/adit') {
        navigate('/')
      } else {
        navigate('/' + id.replace('passage/', 'nugget/'))
      }
    } else {
      node.toggle()
    }
  }

  return (
    <div data-type={node.data.type} style={style} ref={dragHandle} onClick={handleClick}>
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

function MapArrow ({ node }) {
  return (
    <span>
      {node.isInternal ? (node.isOpen ? (<IoCaretDown />) : (<IoCaretForward />)) : null}
    </span>
  )
}

MapArrow.propTypes = {
  node: PropTypes.object.isRequired
}

export default MineMap
