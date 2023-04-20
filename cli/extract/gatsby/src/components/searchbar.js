import React, { useState } from 'react'
import { useFlexSearch } from 'react-use-flexsearch'
import { Formik, Form, Field } from 'formik'
import { useStaticQuery, graphql, Link } from 'gatsby'
import Modal from 'react-modal'
import * as styles from './searchbar.module.css'

Modal.setAppElement(null)

const SearchBar = () => {
  const [query, setQuery] = useState('')
  const [modalIsOpen, setIsOpen] = useState(false)

  const data = useStaticQuery(graphql`
    query SearchBarQuery {
      localSearchProspect {
        index
        store
      }
    }
  `)

  const index = data.localSearchProspect.index
  const store = data.localSearchProspect.store
  const results = useFlexSearch(query, index, store)

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
        <ul>
          {results && results.map(result => (
            <li key={result.id}><Link to={'/' + result.slug} onClick={closeModal}>{result.label}</Link></li>
          ))}
        </ul>
        <button onClick={closeModal}>close</button>
      </Modal>
    </div>
  )
}

export default SearchBar
