'use strict'

const path = require('path')
const fs = require('fs-extra')
const glob = require('glob')

const Eleventy = require('@11ty/eleventy/src/Eleventy')
const isLive = process.env.ROLLUP_WATCH === 'true'

module.exports = function (input, output) {
    let eleventy = false

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

        const writing = isLive ? eleventy.watch() : eleventy.write()
        const copying = dataFiles.then((watchList) =>
            copyUn11tyFiles(input, output, watchList.concat(templates))
        )

        return Promise.all([
            copying,
            writing.then(() => renameHTMLFiles(output)),
        ])
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

            watcher.on('add', copy).on('change', copy)
        }
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

            watcher.on('add', move).on('change', move)
        }
    })
}
