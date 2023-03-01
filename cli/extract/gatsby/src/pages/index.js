import * as React from 'react'
import Layout from '../components/layout'

const IndexPage = () => {
  return (
    <Layout>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%'
        }}
      >
        [Logo]
      </div>
    </Layout>
  )
}

export default IndexPage

export const Head = () => <title>rakosh</title>
