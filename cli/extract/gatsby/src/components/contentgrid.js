import React, { useState } from 'react'
import PropTypes from 'prop-types'
import * as styles from './contentgrid.module.css'
import ContentGridContext from '../contentgridcontext'

const ContentGrid = ({ children }) => {
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
    <ContentGridContext.Provider value={ { globalValue, setGlobalValue } }>
      <div className={styles.flexbox} tabIndex={0} onKeyDown={handleKeyDown}>
        {children}
      </div>
    </ContentGridContext.Provider>
  )
}

ContentGrid.propTypes = {
  children: PropTypes.element.isRequired
}

export default ContentGrid
