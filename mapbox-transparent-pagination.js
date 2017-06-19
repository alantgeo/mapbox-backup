'use strict';

function minimizeErrors(errors) {
    if (errors.length === 0) {
        return null;
    } else if (errors.length === 1) {
        return errors[0];
    } else {
        return errors;
    }
}

var MapboxTransparentPagination = function (client) {
    client.listAllStyles = function (callback) {
        var errors = [];
        var results = [];

        var handleResponse = function (err, result, res) {
            if (err) {
                errors.push(err);
            }
            results.push(...result);
            if (res.nextPage) {
                res.nextPage(handleResponse);
            } else {
                // this is the last page
                callback(minimizeErrors(errors), results);
            }
        };
        client.listStyles(handleResponse);
    };

    client.listAllTilesets = function (options, callback) {
        var errors = [];
        var results = [];

        var handleResponse = function (err, result, res) {
            if (err) {
                errors.push(err);
            }
            results.push(...result);
            if (res.nextPage) {
                res.nextPage(handleResponse);
            } else {
                // this is the last page
                callback(minimizeErrors(errors), results);
            }
        };
        client.listTilesets(options, handleResponse);
    };

    client.listAllDatasets = function (options, callback) {
        var errors = [];
        var results = [];

        var handleResponse = function (err, result, res) {
            if (err) {
                errors.push(err);
            }
            results.push(...result);
            if (res.nextPage) {
                res.nextPage(handleResponse);
            } else {
                // this is the last page
                callback(minimizeErrors(errors), results);
            }
        };
        client.listDatasets(options, handleResponse);
    };

    client.listAllFeatures = function (dataset, options, callback) {
        var errors = [];
        var results;

        var handleResponse = function (err, result, res) {
            if (err) {
                errors.push(err);
            }

            if (!results) {
                results = result;
            } else {
                results.features.push(...result.features);
            }

            if (res.nextPage) {
                res.nextPage(handleResponse);
            } else {
                // this is the last page
                callback(minimizeErrors(errors), results);
            }
        };
        client.listFeatures(dataset, options, handleResponse);
    };

    client.listAllTokens = function (callback) {
        var errors = [];
        var results = [];

        var handleResponse = function (err, result, res) {
            if (err) {
                errors.push(err);
            }
            results.push(...result);
            if (res.nextPage) {
                res.nextPage(handleResponse);
            } else {
                // this is the last page
                callback(minimizeErrors(errors), results);
            }
        };
        client.listTokens(handleResponse);
    };

    return client;
}

module.exports = MapboxTransparentPagination;
