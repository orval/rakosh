import * as React from 'react'
import PropTypes from 'prop-types'
import * as styles from './layout.module.css'
import MineMap from '../components/minemap'

const Layout = ({ children }) => {
  return (
    <>
      <div className={styles.container}>
        <header className={styles.topbar}>
          <h1>{{mine_name}}</h1>
        </header>
        <main className={styles.main}>
          <div className={styles.sidebar}>
            <MineMap />
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
