#!/usr/bin/env node

var fs = require('fs');
var mkdirp = require('mkdirp');
var async = require('async');
var chalk = require('chalk');
var error = chalk.bold.red;

var argv = require('yargs').argv

// pretty print JSON outputs to make it easier to diff changes when committing backups into version control
var json_spacing = 2;

var backup = {};

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
    for (var arg in argv) {
        backup[arg] = argv[arg];;
    }
}

// can't get objects without the list
if (backup.styleObjects) backup.styleList = true;
if (backup.datasetObjects) backup.datasetList = true;

var accessToken = process.env.MapboxAccessToken;

if (accessToken === undefined) {
    console.log(error("MapboxAccessToken environment variable missing"));
    process.exit();
}

var MapboxClient = require('mapbox');
var mapbox = new MapboxClient(accessToken);

// enable transparent pagination on the mapbox client
var MapboxTransparentPagination = require('./mapbox-transparent-pagination');
mapbox = MapboxTransparentPagination(mapbox);

var username = MapboxClient.getUser(accessToken);

if (username === undefined) {
    console.log(error("Can't determine username from access_token"));
    process.exit();
}

console.log('Account Username:' + chalk.bold(username));

mkdirp.sync(username);

async.series([
    function(callback) {
        if (backup.styleList) {
            mapbox.listAllStyles((err, styles) => {
                console.log('Styles');
                if (err) {
                    console.error(err);
                    callback(err);
                }
                fs.writeFileSync(username + '/' + 'styles.json', JSON.stringify(styles, null, json_spacing));
                if (backup.styleObjects) {
                    mkdirp.sync(username + '/styles');

                    async.each(styles, function (styleObject, eachCallback) {
                        mapbox.readStyle(styleObject.id, (err, styleDoc) => {
                            if (err) {
                                process.stdout.write(chalk.red('x'));
                                console.error(err);
                                eachCallback(err);
                            } else {
                                process.stdout.write(chalk.green('.'));
                                fs.writeFileSync(username + '/styles/' + styleObject.id + '.json', JSON.stringify(styleDoc, null, json_spacing));
                                eachCallback(null);
                            }
                        });
                    }, function (err) {
                        console.log(styles.length);
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
                console.log('Tilesets');
                if (err) {
                    console.error(err);
                    callback(err);
                }
                fs.writeFileSync(username + '/' + 'tilesets.json', JSON.stringify(tilesets, null, json_spacing));
                console.log(tilesets.length);
                callback(err);
            });
        } else {
            callback();
        }
    },
    function(callback) {
        if (backup.datasetList) {
            mapbox.listAllDatasets((err, datasets) => {
                console.log('Datasets');
                if (err) {
                    console.error(err);
                    callback(err);
                }
                fs.writeFileSync(username + '/' + 'datasets.json', JSON.stringify(datasets, null, json_spacing));
                if (backup.datasetObjects) {
                    mkdirp.sync(username + '/datasets');

                    async.eachLimit(datasets, 1, function (datasetObject, eachCallback) {
                        mapbox.listAllFeatures(datasetObject.id, {}, (err, collection) => {
                            if (err) {
                                process.stdout.write(chalk.red('x'));
                                console.error(err);
                                eachCallback(err);
                            } else {
                                process.stdout.write(chalk.green('.'));
                                fs.writeFileSync(username + '/datasets/' + datasetObject.id + '.json', JSON.stringify(collection, null, json_spacing));
                                eachCallback(null);
                            }
                        });
                    }, function (err) {
                        console.log(datasets.length);
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
                console.log('Tokens');
                if (err) {
                    console.error(err);
                    callback(err);
                }
                fs.writeFileSync(username + '/' + 'tokens.json', JSON.stringify(tokens, null, json_spacing));
                console.log(tokens.length);
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
        console.error(chalk.red('Backup failed'));
    } else {
        console.error(chalk.green('Backup succeded'));
    }
});
