const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const async = require('async');
const chalk = require('chalk');
const error = chalk.bold.red;
const Bottleneck = require('bottleneck');

const MapboxStyles = require('@mapbox/mapbox-sdk/services/styles');

const parallelLimit = 64;

const limiter = new Bottleneck({
    // styles api limited to 2000 requests per 60 seconds
    reservoir: 2000,
    reservoirRefreshAmount: 2000,
    reservoirRefreshInterval: 60 * 1000,

    maxConcurrent: 1,
    minTime: 60 * 1000 / 2000
});

limiter.on('failed', async (error, jobInfo) => {
    console.log(`Download failed: ${JSON.stringify(error)}`);
    if (jobInfo.retryCount < 5) { // only retry 5 times
        console.log(`retry ${jobInfo.retryCount}`);
        return 1000; // retry in 1000ms
    }
});
limiter.on('retry', (error, jobInfo) => console.log(`Now retrying ${jobInfo.options.id}`));

/**
 * @param options
 */
function backupStyles(options, cb) {
    const stylesService = MapboxStyles({ accessToken: options.accessToken });

    // list all the styles in this account
    listStyles(stylesService, (err, styles) => {
        // save styles to styles.json
        fs.writeFileSync(path.join(options.outputPath, 'styles.json'), JSON.stringify(styles, null, 2), (err) => {
            if (err) throw err;
        });

        async.series([
            callback => {
                // if asked to include style documents
                if (options.backupScopes['style-documents']) {
                    mkdirp.sync(path.join(options.outputPath, 'styles'));

                    backupStyleDocuments(stylesService, styles, options, err => {
                        callback();
                    });
                } else {
                    callback();
                }
            },
            callback => {
                // if asked to include style sprites
                if (options.backupScopes['style-sprites']) {
                    mkdirp.sync(path.join(options.outputPath, 'sprites'));

                    backupStyleSprites(stylesService, styles, options, err => {
                        callback();
                    });
                } else {
                    callback();
                }
            }
        ], () => {
            cb();
        });
    });
}

function backupStyleDocuments(stylesService, styles, options, cb) {
    process.stdout.write('Style Documents ');

    async.eachLimit(styles, parallelLimit, function (styleObject, eachCallback) {
        async.series([
            callback => {
                // retrieve draft styles
                const styleModified = new Date(styleObject.modified);
                const filePath = path.join(options.outputPath, 'styles', `${styleObject.id}.draft.json`);
                let skipDownload = false;

                if (fs.existsSync(filePath)) {
                    const fileModified = new Date(JSON.parse(fs.readFileSync(filePath)).modified)
                    const timeDifference = styleModified.getTime() - fileModified.getTime();

                    if (timeDifference < 0) {
                        // skipping since the local copy is more recent than the style
                        skipDownload = true;
                    }
                }

                if (!skipDownload) {
                    limiter.schedule({ id: `${styleObject.id}.draft` }, async () => {
                    stylesService.getStyle({
                        styleId: styleObject.id,
                        draft: true,
                        fresh: true
                    })
                        .send()
                        .then(res => {
                            const styleDoc = res.body;
                            process.stdout.write(chalk.green('.'));
                            fs.writeFile(path.join(options.outputPath, 'styles', `${styleObject.id}.draft.json`), JSON.stringify(styleDoc, null, 2), err => {
                                if (err) {
                                    console.error('Failed to write file', err)
                                }
                                process.stdout.write(chalk.green('.'));
                                callback(err);
                            });
                        }, err => {
                            if (err && err.statusCode === 429) {
                                // we've been rate limited
                                console.log('ratelimit hit');
                                console.log(err)
                                callback(err)
                            }
                            if (err) throw new Error(err);
                        })
                        .catch((reason) => {
                            console.log(reason);
                            throw new Error(err);
                        })
                    });
                } else {
                    process.stdout.write(chalk.yellow('-'));
                    callback();
                }
            },
            callback => {
                // retrieve published styles
                const styleModified = new Date(styleObject.modified);
                const filePath = path.join(options.outputPath, 'styles', `${styleObject.id}.json`);
                let skipDownload = false;

                if (fs.existsSync(filePath)) {
                    const fileModified = new Date(JSON.parse(fs.readFileSync(filePath)).modified)
                    const timeDifference = styleModified.getTime() - fileModified.getTime();

                    if (timeDifference < 0) {
                        // skipping since the local copy is more recent than the style
                        skipDownload = true;
                    }
                }
                if (!skipDownload) {
                    limiter.schedule({ id: `${styleObject.id}` }, async () => {
                    stylesService.getStyle({
                        styleId: styleObject.id,
                        fresh: true
                    })
                        .send()
                        .then(res => {
                            const styleDoc = res.body;
                            process.stdout.write(chalk.green('.'));
                            fs.writeFile(path.join(options.outputPath, 'styles', `${styleObject.id}.json`), JSON.stringify(styleDoc, null, 2), err => {
                                if (err) {
                                    console.error('Failed to write file', err)
                                }
                                callback(err);
                            });
                        }, err => {
                            if (err && err.statusCode === 429) {
                                // we've been rate limited
                                console.log('ratelimit hit');
                                console.log(err);
                                callback(err)
                            }
                            if (err) throw new Error(err);
                        })
                        .catch((reason) => {
                            console.log(reason);
                            throw new Error(err);
                        })
                    });
                } else {
                    process.stdout.write(chalk.green('-'));
                    callback();
                }
            }
        ], (err) => {
            eachCallback(err);
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
        cb(err);
    });
}

function backupStyleSprites(stylesService, styles, options, cb) {
    process.stdout.write('Style Sprites ');

    async.eachLimit(styles, parallelLimit, function (styleObject, eachCallback) {
        async.series([
            callback => {
                const styleModified = new Date(styleObject.modified);
                const styleFilePath = path.join(options.outputPath, 'styles', `${styleObject.id}.json`);
                const filePath = path.join(options.outputPath, 'sprites', `${styleObject.id}.json`);
                let skipDownload = false;

                if (fs.existsSync(styleFilePath) && fs.existsSync(filePath)) {
                    const fileModified = new Date(JSON.parse(fs.readFileSync(styleFilePath)).modified)
                    const timeDifference = styleModified.getTime() - fileModified.getTime();

                    if (timeDifference < 0) {
                        // skipping since the local copy is more recent than the style
                        skipDownload = true;
                    }
                }
                if (!skipDownload) {
                    limiter.schedule({ id: `${styleObject.id}/sprite.json` }, async () => {
                        stylesService.getStyleSprite({
                            styleId: styleObject.id,
                            format: 'json',
                            fresh: true
                        })
                            .send()
                            .then(res => {
                                const spriteDoc = res.body;
                                process.stdout.write(chalk.green('.'));
                                fs.writeFile(filePath, JSON.stringify(spriteDoc, null, 2), err => {
                                    if (err) throw err;
                                    callback(err);
                                });
                            }, err => {
                                if (err && err.statusCode === 429) {
                                    // we've been rate limited
                                    console.log('ratelimit hit');
                                    console.log(err);
                                    callback(err)
                                }
                                if (err) throw new Error(err);
                            })
                            .catch((reason) => {
                                console.log(reason);
                                throw new Error(err);
                            })
                    });
                } else {
                    process.stdout.write(chalk.green('-'));
                    callback();
                }
            },
            callback => {
                const styleModified = new Date(styleObject.modified);
                const styleFilePath = path.join(options.outputPath, 'styles', `${styleObject.id}.json`);
                const filePath = path.join(options.outputPath, 'sprites', `${styleObject.id}.draft.json`);
                let skipDownload = false;

                if (fs.existsSync(styleFilePath) && fs.existsSync(filePath)) {
                    const fileModified = new Date(JSON.parse(fs.readFileSync(styleFilePath)).modified)
                    const timeDifference = styleModified.getTime() - fileModified.getTime();

                    if (timeDifference < 0) {
                        // skipping since the local copy is more recent than the style
                        skipDownload = true;
                    }
                }
                if (!skipDownload) {
                    limiter.schedule({ id: `${styleObject.id}/sprite.draft.json` }, async () => {
                        stylesService.getStyleSprite({
                            styleId: styleObject.id,
                            format: 'json',
                            draft: true,
                            fresh: true
                        })
                            .send()
                            .then(res => {
                                const spriteDoc = res.body;
                                process.stdout.write(chalk.green('.'));
                                fs.writeFile(filePath, JSON.stringify(spriteDoc, null, 2), err => {
                                    if (err) throw err;
                                    callback(err);
                                });
                            }, err => {
                                if (err && err.statusCode === 429) {
                                    // we've been rate limited
                                    console.log('ratelimit hit');
                                    console.log(err);
                                    callback(err)
                                }
                                if (err) throw new Error(err);
                            })
                            .catch((reason) => {
                                console.log(reason);
                                throw new Error(err);
                            })
                    });
                } else {
                    process.stdout.write(chalk.green('-'));
                    callback();
                }
            },
            callback => {
                const styleModified = new Date(styleObject.modified);
                const styleFilePath = path.join(options.outputPath, 'styles', `${styleObject.id}.json`);
                const filePath = path.join(options.outputPath, 'sprites', `${styleObject.id}.png`);
                let skipDownload = false;

                if (fs.existsSync(styleFilePath) && fs.existsSync(filePath)) {
                    const fileModified = new Date(JSON.parse(fs.readFileSync(styleFilePath)).modified)
                    const timeDifference = styleModified.getTime() - fileModified.getTime();

                    if (timeDifference < 0) {
                        // skipping since the local copy is more recent than the style
                        skipDownload = true;
                    }
                }
                if (!skipDownload) {
                    limiter.schedule({ id: `${styleObject.id}/sprite.png` }, async () => {
                        stylesService.getStyleSprite({
                            styleId: styleObject.id,
                            format: 'png',
                            fresh: true
                        })
                            .send()
                            .then(res => {
                                const spriteImage = res.body;
                                process.stdout.write(chalk.green('.'));
                                fs.writeFile(filePath, spriteImage, { encoding: 'binary' }, err => {
                                    if (err) throw err;
                                    callback(err);
                                });
                            }, err => {
                                if (err && err.statusCode === 429) {
                                    // we've been rate limited
                                    console.log('ratelimit hit');
                                    console.log(err);
                                    callback(err)
                                }
                                if (err) throw new Error(err);
                            })
                            .catch((reason) => {
                                console.log(reason);
                                throw new Error(err);
                            })
                    });
                } else {
                    process.stdout.write(chalk.green('-'));
                    callback();
                }
            },
            callback => {
                const styleModified = new Date(styleObject.modified);
                const styleFilePath = path.join(options.outputPath, 'styles', `${styleObject.id}.json`);
                const filePath = path.join(options.outputPath, 'sprites', `${styleObject.id}@2x.png`);
                let skipDownload = false;

                if (fs.existsSync(styleFilePath) && fs.existsSync(filePath)) {
                    const fileModified = new Date(JSON.parse(fs.readFileSync(styleFilePath)).modified)
                    const timeDifference = styleModified.getTime() - fileModified.getTime();

                    if (timeDifference < 0) {
                        // skipping since the local copy is more recent than the style
                        skipDownload = true;
                    }
                }
                if (!skipDownload) {
                    limiter.schedule({ id: `${styleObject.id}/sprite.draft.png` }, async () => {
                        stylesService.getStyleSprite({
                            styleId: styleObject.id,
                            format: 'png',
                            highRes: true,
                            fresh: true
                        })
                            .send()
                            .then(res => {
                                const spriteImage = res.body;
                                process.stdout.write(chalk.green('.'));
                                fs.writeFile(filePath, spriteImage, { encoding: 'binary' }, err => {
                                    if (err) throw err;
                                    callback(err);
                                });
                            }, err => {
                                if (err && err.statusCode === 429) {
                                    // we've been rate limited
                                    console.log('ratelimit hit');
                                    console.log(err);
                                    callback(err)
                                }
                                if (err) throw new Error(err);
                            })
                            .catch((reason) => {
                                console.log(reason);
                                throw new Error(reason);
                            })
                    });
                } else {
                    process.stdout.write(chalk.green('-'));
                    callback();
                }
            }
        ], () => {
            eachCallback();
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
        cb(err);
    });
}

/**
 * Retrieve the styles and return them as an Array
 */
function listStyles(stylesService, cb) {
    process.stdout.write('Styles List');
    const styles = [];
    stylesService.listStyles({
      fresh: true
    }).eachPage((err, res, next) => {
        process.stdout.write('.');

        if (err) {
            process.stdout.write(chalk.red('✖') + '\n');
            console.error(err);
            cb(err, null);
            return;
        }

        const pageStyles = res.body;
        styles.push(...pageStyles);

        if (!res.hasNextPage()) {
            // no more pages
            process.stdout.write(`${styles.length}`);
            process.stdout.write(chalk.green('✔') + '\n');
            cb(null, styles);
        } else {
            // call the next page
            next();
        }
    });
}

module.exports = backupStyles;
