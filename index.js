#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const async = require('async');
const chalk = require('chalk');
const error = chalk.bold.red;

const argv = require('yargs').argv

// pretty print JSON outputs to make it easier to diff changes when committing backups into version control
const json_spacing = 2;

const backup = {};

if (argv.all) {
    [
        'styleList',
        'styleObjects',
        'tilesetList',
        'datasetList',
        'datasetObjects',
        'tokenList'
    ].forEach(function (backupOption) {
        backup[backupOption]  = true;
    });
} else {
    for (const arg in argv) {
        backup[arg] = argv[arg];
    }
}

// can't get objects without the list
if (backup.styleObjects) backup.styleList = true;
if (backup.datasetObjects) backup.datasetList = true;

const accessToken = argv['access-token'] || process.env.MapboxAccessToken;

if (accessToken === undefined) {
    console.log(error("Either --access-token or MapboxAccessToken environment variable must be provided"));
    process.exit();
}

const MapboxClient = require('mapbox');

// enable transparent pagination on the mapbox client
const MapboxTransparentPagination = require('./mapbox-transparent-pagination');

const mapbox = MapboxTransparentPagination(new MapboxClient(accessToken));

const username = MapboxClient.getUser(accessToken);

if (username === undefined) {
    console.log(error("Can't determine username from access_token"));
    process.exit();
}

console.log('Account Username:' + chalk.bold(username));

const outputPath = argv.output || username;

mkdirp.sync(outputPath);

async.series([
    function(callback) {
        if (backup.styleList) {
            mapbox.listAllStyles((err, styles) => {
                process.stdout.write('Styles List ');
                if (err) {
                    process.stdout.write(chalk.red('✖') + '\n');
                    console.error(err);
                    if (backup.styleObjects) {
                        process.stdout.write('Style Documents ' + chalk.yellow(' skipped') + '\n');
                    }
                    callback(err);
                }
                fs.writeFileSync(path.join(outputPath, 'styles.json'), JSON.stringify(styles, null, json_spacing));
                process.stdout.write(chalk.green('✔') + '\n');

                if (backup.styleObjects) {
                    process.stdout.write('Style Documents ');
                    mkdirp.sync(path.join(outputPath, 'styles'));

                    async.each(styles, function (styleObject, eachCallback) {
                        mapbox.readStyle(styleObject.id, (err, styleDoc) => {
                            if (err) {
                                process.stdout.write(chalk.red('✖'));
                                console.error(err);
                                eachCallback(err);
                            } else {
                                process.stdout.write(chalk.green('.'));
                                fs.writeFileSync(path.join(outputPath, 'styles', styleObject.id + '.json'), JSON.stringify(styleDoc, null, json_spacing));
                                eachCallback(null);
                            }
                        });
                    }, function (err) {
                        const errors = err ? err.map((e) => { return !!e; }) : [];
                        if (errors.length) {
                            // some errors
                            process.stdout.write(chalk.yellow('⚠') + ' ' + (styles.length - errors.length) + '/' + styles.length + '\n');
                        } else {
                            // no errors
                            process.stdout.write(chalk.green('✔') + '\n');
                        }
                        callback(err);
                    });
                } else {
                    callback();
                }
            });
        } else {
            callback();
        }
    },
    function(callback) {
        if (backup.tilesetList) {
            mapbox.listAllTilesets((err, tilesets) => {
                process.stdout.write('Tilesets List ');
                if (err) {
                    process.stdout.write(chalk.red('✖') + '\n');
                    console.error(err);
                    callback(err);
                }
                fs.writeFileSync(path.join(outputPath, 'tilesets.json'), JSON.stringify(tilesets, null, json_spacing));
                process.stdout.write(chalk.green('✔') + '\n');
                callback(err);
            });
        } else {
            callback();
        }
    },
    function(callback) {
        if (backup.datasetList) {
            mapbox.listAllDatasets((err, datasets) => {
                process.stdout.write('Datasets List ');
                if (err) {
                    process.stdout.write(chalk.red('✖') + '\n');
                    console.error(err);
                    if (backup.datasetObjects) {
                        process.stdout.write('Dataset Documents ' + chalk.yellow(' skipped') + '\n');
                    }
                    callback(err);
                }
                fs.writeFileSync(path.join(outputPath, 'datasets.json'), JSON.stringify(datasets, null, json_spacing));
                process.stdout.write(chalk.green('✔') + '\n');

                if (backup.datasetObjects) {
                    process.stdout.write('Dataset Documents ');
                    mkdirp.sync(path.join(outputPath, 'datasets'));

                    async.eachLimit(datasets, 1, function (datasetObject, eachCallback) {
                        mapbox.listAllFeatures(datasetObject.id, {}, (err, collection) => {
                            if (err) {
                                process.stdout.write(chalk.red('✖'));
                                console.error(err);
                                eachCallback(err);
                            } else {
                                process.stdout.write(chalk.green('.'));
                                fs.writeFileSync(path.join(outputPath, 'datasets', datasetObject.id + '.json'), JSON.stringify(collection, null, json_spacing));
                                eachCallback(null);
                            }
                        });
                    }, function (err) {
                        const errors = err ? err.map((e) => { return !!e; }) : [];
                        if (errors.length) {
                            // some errors
                            process.stdout.write(chalk.yellow('⚠') + ' ' + (datasets.length - errors.length) + '/' + datasets.length + '\n');
                        } else {
                            // no errors
                            process.stdout.write(chalk.green('✔') + '\n');
                        }
                        callback(err);
                    });
                } else {
                    callback();
                }
            });
        } else {
            callback();
        }
    },
    function(callback) {
        if (backup.tokenList) {
            mapbox.listAllTokens((err, tokens) => {
                process.stdout.write('Tokens ');
                if (err) {
                    process.stdout.write(chalk.red('✖') + '\n');
                    console.error(err);
                    callback(err);
                }
                fs.writeFileSync(path.join(outputPath, 'tokens.json'), JSON.stringify(tokens, null, json_spacing));
                process.stdout.write(chalk.green('✔') + '\n');
                callback(err);
            });
        } else {
            callback();
        }
    }
],
function(err, results) {
    if (err) {
        console.error(err);
        console.log(chalk.red('Backup failed'));
    } else {
        console.log(chalk.green('Backup succeded'));
    }
});
