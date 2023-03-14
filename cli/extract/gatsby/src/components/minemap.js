import * as React from 'react'
import PropTypes from 'prop-types'
import { navigate } from 'gatsby'
import { Tree } from 'react-arborist'
import data from '../../content/minemap.json'

const MineMap = () => {
  return (
    <Tree
      initialData={data}
      width={600}
      rowHeight={30}
      selectionFollowsFocus={true}
      disableMultiSelection={true}
      disableEdit={true}
      disableDrag={true}
      disableDrop={true}
    >
      {Node}
    </Tree>
  )
}

function Node ({ node, style, dragHandle }) {
  return (
    <div style={style} ref={dragHandle} onClick={() => {
      const id = node.data.id.split('|').pop()
      if (id.startsWith('nugget/') || id.startsWith('seam/')) {
        navigate('/' + id)
      }
    }}>
      {node.data.name}
    </div>
  )
}

Node.propTypes = {
  node: PropTypes.object.isRequired,
  style: PropTypes.object,
  dragHandle: PropTypes.func
}

export default MineMap
