const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const async = require('async');
const chalk = require('chalk');
const error = chalk.bold.red;

const MapboxTokens = require('@mapbox/mapbox-sdk/services/tokens');

const parallelLimit = 32;

/**
 * @param options
 */
function backupTokens(options, cb) {
    const tokensService = MapboxTokens({ accessToken: options.accessToken });

    // list all the tokens in this account
    listTokens(tokensService, (err, tokens) => {
        // save tokens to tokens.json
        fs.writeFileSync(path.join(options.outputPath, 'tokens.json'), JSON.stringify(tokens, null, 2), (err) => {
            if (err) throw err;
        });

        cb();
    });
}

/**
 * Retrieve the tokens and return them as an Array
 */
function listTokens(tokensService, cb) {
    process.stdout.write('Tokens List');
    const tokens = [];
    tokensService.listTokens().eachPage((err, res, next) => {
        process.stdout.write('.');

        if (err) {
            process.stdout.write(chalk.red('✖') + '\n');
            console.error(err);
            cb(err, null);
            return;
        }

        const pageTokens = res.body;
        tokens.push(...pageTokens);

        if (!res.hasNextPage()) {
            // no more pages
            process.stdout.write(`${tokens.length}`);
            process.stdout.write(chalk.green('✔') + '\n');
            cb(null, tokens);
        } else {
            // call the next page
            next();
        }
    });
}

module.exports = backupTokens;
