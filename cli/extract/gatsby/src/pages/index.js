import * as React from 'react'
import * as styles from './index.module.css'

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
