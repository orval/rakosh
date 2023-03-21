import * as React from 'react'
import PropTypes from 'prop-types'
import { navigate } from 'gatsby'
import { Tree } from 'react-arborist'
import { IoCaretDown, IoCaretForward } from 'react-icons/io5'
import minemapJson from '../../content/minemap.json'

const passageRe = /^passage\/[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/

const MineMap = () => {
  return (
    <Tree
      initialData={minemapJson.initialData}
      width={500}
      rowHeight={30}
      selectionFollowsFocus={true}
      disableMultiSelection={true}
      disableEdit={true}
      disableDrag={true}
      disableDrop={true}
      indent={14}
      initialOpenState={minemapJson.initialOpenState}
    >
      {Node}
    </Tree>
  )
}

function Node ({ node, style, dragHandle }) {
  const handleClick = (event) => {
    // just open/close the node if the arrow has been clicked
    if (event.target.tagName !== 'div') {
      node.toggle()
      return
    }

    const id = node.data.id.split('|').pop()
    if (id.startsWith('nugget/') || id.startsWith('seam/')) {
      navigate('/' + id)
    } else if (passageRe.test(id)) {
      navigate('/' + id.replace('passage/', 'nugget/'))
    } else if (id === 'passage/adit') {
      navigate('/')
    }
  }

  return (
    <div style={style} ref={dragHandle} onClick={handleClick}>
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
