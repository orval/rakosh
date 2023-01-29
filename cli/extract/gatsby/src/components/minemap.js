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
    >
      {Node}
    </Tree>
  )
}

function Node ({ node, style, dragHandle }) {
  return (
    <div style={style} ref={dragHandle} onClick={() => {
      navigate(node.data.name)
    }}>
      {node.data.name}
    </div>
  )
}

Node.propTypes = {
  node: PropTypes.element.isRequired
}

export default MineMap
