import React, { useState } from 'react'
import PropTypes from 'prop-types'
import * as styles from './layout.module.css'
import MineMap from '../components/minemap'
import SearchBar from '../components/searchbar'
import ContentGrid from '../components/contentgrid'
import LayoutContext from '../components/layoutcontext'

const Layout = ({ children }) => {
  const [globalValue, setGlobalValue] = useState({
    showMetadata: false,
    showBreadcrumbs: false
  })

  const handleKeyDown = (event) => {
    if (event.key === 'b') {
      setGlobalValue({
        ...globalValue,
        showBreadcrumbs: !globalValue.showBreadcrumbs
      })
    } else if (event.key === 'm') {
      setGlobalValue({
        ...globalValue,
        showMetadata: !globalValue.showMetadata
      })
    }
  }

  return (
    <LayoutContext.Provider value={ { globalValue, setGlobalValue } }>
      <div
        role="button"
        tabIndex="-1"
        aria-label="press b for breadcrumbs and m for metadata"
        onKeyDown={handleKeyDown}
        className={styles.container}
      >
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
            <ContentGrid>
              {children}
            </ContentGrid>
          </div>
        </main>
      </div>
    </LayoutContext.Provider>
  )
}

Layout.propTypes = {
  children: PropTypes.element.isRequired
}

export default Layout
