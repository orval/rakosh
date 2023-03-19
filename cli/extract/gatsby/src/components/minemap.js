import * as React from 'react'
import PropTypes from 'prop-types'
import { navigate } from 'gatsby'
import { Tree } from 'react-arborist'
import data from '../../content/minemap.json'

const passageRe = /^passage\/[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/

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
      indent={50}
    >
      {Node}
    </Tree>
  )
}

function Node ({ node, style, dragHandle }) {
  const handleClick = () => {
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
