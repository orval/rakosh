import * as React from 'react'
import PropTypes from 'prop-types'
import * as styles from './layout.module.css'
import { Link } from 'gatsby'

const Layout = ({ children }) => {
  return (
    <>
      <div className={styles.container}>
        <header className={styles.topbar}>
          <h1>Top</h1>
        </header>
        <main className={styles.main}>
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
            {children}
          </div>
        </main>
      </div>
    </>
  )
}

Layout.propTypes = {
  children: PropTypes.element.isRequired
}

export default Layout
