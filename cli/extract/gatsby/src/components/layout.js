import * as React from 'react'
import PropTypes from 'prop-types'
import * as styles from './layout.module.css'
import Nav from '../components/nav'

const Layout = ({ children }) => {
  return (
    <>
      <div className={styles.container}>
        <header className={styles.topbar}>
          <h1>Rakosh</h1>
        </header>
        <main className={styles.main}>
          <div className={styles.sidebar}>
            <Nav />
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
