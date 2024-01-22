import PropTypes from 'prop-types'
import React from 'react'

import * as styles from './contentgrid.module.css'

const ContentGrid = ({ children }) => {
  return (
      <div className={styles.flexbox}>
        {children}
      </div>
  )
}

ContentGrid.propTypes = {
  children: PropTypes.element.isRequired
}

export default ContentGrid
