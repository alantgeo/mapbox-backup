# mapbox-backup

A unofficial command line utility to backup your Mapbox account

## Usage

Install the script with

    npm install mapbox-backup

Run the script with

    export MapboxAccessToken=sk...
    mapbox-backup --all

This will backup everything possible (see below) or to only backup a subset of your account omit the `--all` flag and instead use any combination of these:

* `--style-list` Style metadata
* `--style-objects` Styles
* `--tilesets-list` Tileset metadata
* `--dataset-list` Datasets metadata
* `--dataset-objects` Datasets
* `--token-list` Tokens

## Scopes

To run `--all` you must provide an Access Token with access token with the following scopes (if some are missing the script will attempt to backup as much as it can with the scopes provided).

* styles:list
* styles:read
* tilesets:list
* tilesets:read
* datasets:list
* datasets:read
* fonts:read
* tokens:read
* user:read

__To be safe only grant `read` and `list` scopes.__

## Whats Missing?

The following isn't backed up as there is no API support:

* Style icons (your uploaded SVGs) (although you can manually download these from Mapbox Studio via the export function)
* Style fonts (your uploaded fonts)
* Tilesets (your uploaded Shapefiles, GeoJSON, MBTiles, etc)
* Connections between Datasets and Tilesets is only via implicit use of the dataset ID in the tileset ID
* Secret Access Tokens (however this is probably a good thing, if you need to restore from a backup you'll need to refresh any tokens in live use yourself)

## Open Questions

Further testing is required to determine what's currently backed up and if possible to backup all of:

* Style draft/published versions

In the future it would be nice to support:

* Restoring backups
