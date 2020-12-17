'use strict'

const path = require('path')
const fs = require('fs-extra')
const glob = require('glob')

const normalize = require('normalize-path')
const isLive = process.env.ROLLUP_WATCH === 'true'
const Eleventy = require('@11ty/eleventy/src/Eleventy')

module.exports = function (input, output) {
    let eleventy = false

    // Eleventy doesn't like win32 paths even on Windows.
    input = normalize(input).replace(/^([a-zA-Z]+:)/, '')
    output = normalize(output).replace(/^([a-zA-Z]+:)/, '')

    return {
        name: 'eleventy',

        options(options) {
            if (eleventy !== false) return options
            eleventy = new Eleventy(input, output)

            eleventy.setIsVerbose(false) // be quiet, no need to list all the files
            eleventy.setIncrementalBuild(true) // fewer builds in Live mode, please

            const configPath = require.resolve('./eleventy-config.js')
            eleventy.setConfigPathOverride(path.relative('.', configPath))

            return eleventyPromise(input, output, eleventy).then(() => options)
        },
    }
}

function eleventyPromise(input, output, eleventy) {
    return eleventy.init().then(() => {
        const templates = eleventy.eleventyFiles.getGlobWatcherFiles()
        const dataFiles = eleventy.eleventyFiles.getGlobWatcherTemplateDataFiles()

        const eleventing = isLive ? eleventy.watch() : eleventy.write()

        /* eslint-disable promise/no-nesting */
        const writing = eleventing.then(() => renameHTMLFiles(output))
        const copying = dataFiles.then((watchList) =>
            copyUn11tyFiles(input, output, watchList.concat(templates))
        )
        /* eslint-enable promise/no-nesting */

        return Promise.all([copying, writing])
    })
}

function copyUn11tyFiles(rootDir, destDir, watchList) {
    const files = glob.sync('*', {
        nodir: true,
        cwd: rootDir,
        absolute: true,
        matchBase: true,
        ignore: watchList,
    })

    const copy = (file) => {
        const dest = destDir + file.substring(rootDir.length)
        return fs.ensureDir(path.dirname(dest)).then(() => fs.copy(file, dest))
    }

    return Promise.all(files.map(copy)).then(() => {
        if (isLive) {
            const options = { ignoreInitial: true, ignored: watchList }
            const watcher = require('chokidar').watch(rootDir, options)

            return watcher.on('add', copy).on('change', copy)
        } else return undefined
    })
}

function renameHTMLFiles(rootDir) {
    const files = glob.sync('*.html', {
        cwd: rootDir,
        absolute: true,
        matchBase: true,
    })

    const move = (file) => {
        const base = file.substring(0, file.length - 4)
        return fs.rename(file, base + 'marko')
    }

    return Promise.all(files.map(move)).then(() => {
        if (isLive) {
            const watcher = require('chokidar').watch(rootDir + '/**/*.html', {
                ignoreInitial: true,
            })

            return watcher.on('add', move).on('change', move)
        } else return undefined
    })
}
