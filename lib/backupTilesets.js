const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const async = require('async');
const chalk = require('chalk');
const error = chalk.bold.red;

const MapboxTilesets = require('@mapbox/mapbox-sdk/services/tilesets');

const parallelLimit = 32;

/**
 * @param options
 */
function backupTilesets(options, cb) {
    const tilesetsService = MapboxTilesets({ accessToken: options.accessToken });

    // list all the tilesets in this account
    listTilesets(tilesetsService, (err, tilesets) => {
        // save tilesets to tilesets.json
        fs.writeFileSync(path.join(options.outputPath, 'tilesets.json'), JSON.stringify(tilesets, null, 2), (err) => {
            if (err) throw err;
        });

        cb();
    });
}

/**
 * Retrieve the tilesets and return them as an Array
 */
function listTilesets(tilesetsService, cb) {
    process.stdout.write('Tilesets List');
    const tilesets = [];
    tilesetsService.listTilesets().eachPage((err, res, next) => {
        process.stdout.write('.');

        if (err) {
            process.stdout.write(chalk.red('✖') + '\n');
            console.error(err);
            cb(err, null);
            return;
        }

        const pageTilesets = res.body;
        tilesets.push(...pageTilesets);

        if (!res.hasNextPage()) {
            // no more pages
            process.stdout.write(`${tilesets.length}`);
            process.stdout.write(chalk.green('✔') + '\n');
            cb(null, tilesets);
        } else {
            // call the next page
            next();
        }
    });
}

module.exports = backupTilesets;
