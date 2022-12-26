import * as React from 'react'
import { Link } from 'gatsby'

const IndexPage = () => {
  return (
    <main>
      <p>
        <Link to="nugget/49b70b98-48be-42f3-b314-ccfa469f7987">nug</Link>
      </p>
    </main>
  )
}

export default IndexPage

export const Head = () => <title>Home Page</title>
