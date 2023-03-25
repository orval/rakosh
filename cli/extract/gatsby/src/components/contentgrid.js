import * as React from 'react'
import PropTypes from 'prop-types'
import * as styles from './contentgrid.module.css'

const ContentGrid = ({ children }) => {
  console.log(children)
  return (
    <div className={styles.grid}>
      <div className={styles.main}>
        {children}
      </div>
    </div>
  )
}

ContentGrid.propTypes = {
  children: PropTypes.element.isRequired
}

export default ContentGrid
