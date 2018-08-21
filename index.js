#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const async = require('async');
const chalk = require('chalk');
const error = chalk.bold.red;

const argv = require('yargs').argv;

const availableBackupScopes = [
    'styles-list',
    'style-documents',
    'tilesets-list',
    'datasets-list',
    'dataset-documents',
    'tokens-list'
];

if (argv.h || argv.help) {
    console.log("Usage: mapbox-backup [--access-token=\"sk.xxx\"] [--output path/to/output] [backup scopes...]");
    console.log("    Available backup scopes: (if none are provided all scopes are backed up)")
    availableBackupScopes.forEach((backupScope) => {
        console.log('        --' + backupScope);
    });
    process.exit();
}

// pretty print JSON outputs to make it easier to diff changes when committing backups into version control
const json_spacing = 2;

const jobs = 4;

const backupScopes = {};

for (const arg in argv) {
    if (availableBackupScopes.includes(arg)) {
        backupScopes[arg] = argv[arg];
    }
}

// if no backup scopes were provided on the command line, default to backing up all
if (Object.keys(backupScopes).length === 0) {
    availableBackupScopes.forEach(function (backupScope) {
        backupScopes[backupScope]  = true;
    });
}

// can't get objects without the list
if (backupScopes['style-documents']) backupScopes['styles-list'] = true;
if (backupScopes['dataset-documents']) backupScopes['datasets-list'] = true;

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
        if (backupScopes['styles-list']) {
            mapbox.listAllStyles((err, styles) => {
                process.stdout.write('Styles List ');
                if (err) {
                    process.stdout.write(chalk.red('✖') + '\n');
                    console.error(err);
                    if (backupScopes['style-documents']) {
                        process.stdout.write('Style Documents ' + chalk.yellow(' skipped') + '\n');
                    }
                    callback(err);
                }
                fs.writeFileSync(path.join(outputPath, 'styles.json'), JSON.stringify(styles, null, json_spacing));
                process.stdout.write(chalk.green('✔') + '\n');

                if (backupScopes['style-documents']) {
                    process.stdout.write('Style Documents ');
                    mkdirp.sync(path.join(outputPath, 'styles'));

                    async.eachLimit(styles, jobs, function (styleObject, eachCallback) {
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
        if (backupScopes['tilesets-list']) {
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
        if (backupScopes['datasets-list']) {
            mapbox.listAllDatasets((err, datasets) => {
                process.stdout.write('Datasets List ');
                if (err) {
                    process.stdout.write(chalk.red('✖') + '\n');
                    console.error(err);
                    if (backupScopes['dataset-documents']) {
                        process.stdout.write('Dataset Documents ' + chalk.yellow(' skipped') + '\n');
                    }
                    callback(err);
                }
                fs.writeFileSync(path.join(outputPath, 'datasets.json'), JSON.stringify(datasets, null, json_spacing));
                process.stdout.write(chalk.green('✔') + '\n');

                if (backupScopes['dataset-documents']) {
                    process.stdout.write('Dataset Documents ');
                    mkdirp.sync(path.join(outputPath, 'datasets'));

                    async.eachLimit(datasets, jobs, function (datasetObject, eachCallback) {
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
        if (backupScopes['tokens-list']) {
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
