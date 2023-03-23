import * as React from 'react'
import PropTypes from 'prop-types'
import * as styles from './layout.module.css'
import MineMap from '../components/minemap'
import SearchBar from '../components/searchbar'

const Layout = ({ children }) => {
  return (
    <>
      <div className={styles.container}>
        <header className={styles.topbar}>
          {/* eslint-disable-next-line */}
          <h1 className={styles.minename}>{{mine_name}}</h1>
          <div className={styles.searchbar}>
            <SearchBar />
          </div>
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
