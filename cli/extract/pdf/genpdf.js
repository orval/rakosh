'use strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'url'

import log from 'loglevel'
import puppeteer from 'puppeteer'

import { NuggetCatalog } from '../lib/nugget_catalog.js'
import { generateHtml } from '../html/generateHtml.js'

export async function generatePdf (db, argv) {
  log.info('extracting data')
  const catalog = new NuggetCatalog(db, argv.include, argv.exclude, true)
  await catalog.init()

  log.info('generating html')
  const foo = await generateHtml(
    catalog,
    argv.output,
    String(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'pdf.css'))),
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
  )

  log.info('converting html to pdf')
  await htmlToPdf(foo, argv.output)
}

async function htmlToPdf (html, pdfPath) {
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setContent(html, {
    waitUntil: 'networkidle0'
  })
  const contentHeight = await page.evaluate(() => document.documentElement.offsetHeight) + 100
  await page.pdf({
    path: pdfPath,
    width: '210mm',
    height: `${contentHeight}px`,
    printBackground: true
  })
  await browser.close()
}
