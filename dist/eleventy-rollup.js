'use strict'

const fs = require('fs')
const glob = require('glob')

const Eleventy = require('@11ty/eleventy/src/Eleventy')
const isLive = process.env.ROLLUP_WATCH === 'true'

module.exports = function (input, output) {
  return {
    name: 'eleventy',

    options (options) {
      const eleventy = new Eleventy(input, output)

      eleventy.setIsVerbose(false) // Be quiet, no need to list all the files
      eleventy.setPassthroughAll(true) // Rollup do need access to everything

      return eleventy.init().then(async () =>
        await (isLive ? eleventy.watch() : eleventy.write())
      ).then(() => renameHTMLFiles(output)).then(() => options)
    }
  }
}

function renameHTMLFiles (rootDir) {
  const files = glob.sync('**/*.html', {
    cwd: rootDir, absolute: true
  })

  files.forEach(file => {
    const base = file.substring(0, file.length - 4)
    fs.renameSync(file, base + 'marko')
  })
}
