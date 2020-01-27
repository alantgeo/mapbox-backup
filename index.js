#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const async = require('async');
const chalk = require('chalk');

const warning = chalk.bold.orange;
const error = chalk.bold.red;

const getUser = require('./getUser');

const backupStyles = require('./lib/backupStyles');
const backupTilesets = require('./lib/backupTilesets');
const backupTokens = require('./lib/backupTokens');

const argv = require('yargs').argv;

// backup scopes allowed
const availableBackupScopes = [
    'styles-list',
    'style-documents',
    'style-sprites',
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
if (backupScopes['style-documents'] || backupScopes['style-sprites']) backupScopes['styles-list'] = true;
if (backupScopes['dataset-documents']) backupScopes['datasets-list'] = true;

const accessToken = argv['access-token'] || process.env.MapboxAccessToken;

if (accessToken === undefined) {
    console.log(error("Either --access-token or MapboxAccessToken environment variable must be provided"));
    process.exit(1);
}

// print the account username
const username = getUser(accessToken);
if (username) {
    console.log(`Account Username: ${chalk.bold(username)}`);
} else {
    console.log(warning('Unable to determine account username'));
}

const outputPath = argv.output || username || 'output';
mkdirp.sync(outputPath);

async.series([
    (cb) => {
        if (backupScopes['styles-list']) {
            backupStyles({ accessToken, outputPath, backupScopes }, cb);
        } else {
            cb();
        }
    },
    (cb) => {
        if (backupScopes['tilesets-list']) {
            backupTilesets({ accessToken, outputPath }, cb);
        } else {
            cb();
        }
    },
    (cb) => {
        if (backupScopes['tokens-list']) {
            backupTokens({ accessToken, outputPath }, cb);
        } else {
            cb();
        }
    }
], () => {
    console.log(chalk.green('Backup completed'));
});
