import * as React from 'react'
import { navigate } from 'gatsby'
import { Tree } from 'react-arborist'

const data = [
  { id: '1', name: '/nugget/86cc1537-3399-4a06-914d-328803aa542b' },
  { id: '2', name: '/nugget/bcff68dd-23e2-48c2-8ab5-c56eae2ee7c7' },
  { id: '2', name: '/nugget/49b70b98-48be-42f3-b314-ccfa469f7987' },
  { id: '2', name: '/nugget/00d26410-0e18-4912-b26b-dbc173ec0bb8' },
  { id: '2', name: '/seam/ed742eb0-26e4-400d-af4d-4dfd715dfe85' }
]

const Nav = () => {
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
  );
}

export default Nav
