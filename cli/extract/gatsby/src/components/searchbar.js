import { Formik, Form, Field } from 'formik'
import { useStaticQuery, graphql, Link } from 'gatsby'
import PropTypes from 'prop-types'
import React, { useState, useEffect } from 'react'
import Modal from 'react-modal'
import { useFlexSearch } from 'react-use-flexsearch'

import * as styles from './searchbar.module.css'

Modal.setAppElement('#___gatsby')

const SearchResults = ({ query, store, index, closeModal }) => {
  const results = useFlexSearch(query, index, store)
  if (results && results.length === 0) {
    return (<p>Not found</p>)
  }
  return (
    <ul>
      {results && results.map(result => (
        <li key={result.id}><Link to={result.slug} onClick={closeModal}>{result.label}</Link></li>
      ))}
    </ul>
  )
}

SearchResults.propTypes = {
  query: PropTypes.string.isRequired,
  store: PropTypes.object.isRequired,
  index: PropTypes.string.isRequired,
  closeModal: PropTypes.func.isRequired
}

const SearchBar = () => {
  const [query, setQuery] = useState('')
  const [searchIndex, setSearchIndex] = useState(null)
  const [searchStore, setSearchStore] = useState(null)
  const [modalIsOpen, setIsOpen] = useState(false)

  const data = useStaticQuery(graphql`
    query SearchBarQuery {
      localSearchProspect {
        publicIndexURL
        publicStoreURL
      }
    }
  `)

  useEffect(() => {
    if (query.length > 0 && (searchIndex == null || searchStore == null)) {
      async function fetchData () {
        const queries = await Promise.all([
          fetch(data.localSearchProspect.publicIndexURL),
          fetch(data.localSearchProspect.publicStoreURL)
        ])
        setSearchIndex(await queries[0].text())
        setSearchStore(await queries[1].json())
      }

      fetchData()
    }
  })

  function openModal () {
    setIsOpen(true)
  }

  function closeModal () {
    setIsOpen(false)
  }

  return (
    <div className={styles.searchform}>
      <Formik
        initialValues={ { query: '' } }
        onSubmit={(values, { setSubmitting }) => {
          setQuery(values.query)
          setSubmitting(false)
          openModal()
        }}
      >
        <Form>
          <label htmlFor='queryinput' className={styles.label}>Search:</label>
          <Field id='queryinput' name='query' type='text' className={styles.field} />
        </Form>
      </Formik>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Search Results"
      >

        {searchIndex != null && searchStore != null && query.length > 0 && (
          <SearchResults
            query={query}
            store={searchStore}
            index={searchIndex}
            closeModal={closeModal}
          />
        )}
        <button onClick={closeModal}>close</button>
      </Modal>
    </div>
  )
}

export default SearchBar
