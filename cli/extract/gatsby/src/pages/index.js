import * as React from 'react'
import * as styles from './index.module.css'
import { Link } from 'gatsby'

const IndexPage = () => {
  return (
    <>
      <div className={styles.container}>
        <div className={styles.topbar}>
          <h1>Top</h1>
        </div>
        <div className={styles.main}>
          <div className={styles.sidebar}>
            <h1>Side</h1>
            <ul>
              <li>
                <Link to="/nugget/49b70b98-48be-42f3-b314-ccfa469f7987/">A Useful Nugget</Link>
              </li>
              <li>
                <Link to="/seam/ed742eb0-26e4-400d-af4d-4dfd715dfe85/">Seam</Link>
              </li>
            </ul>
          </div>
          <div className={styles.content}>
            <h1>Content</h1>
          </div>
        </div>
      </div>
    </>
  )
}

export default IndexPage

export const Head = () => <title>Home Page</title>
