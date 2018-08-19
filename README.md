# mapbox-backup

A unofficial command line utility to backup your Mapbox account

## Usage

    npm install -g mapbox-backup
    mapbox-backup --access-token="sk.xxx" --output path/to/output

This will backup everything possible (see below) or to only backup a subset of your account use any combination of these:

* `--styles-list` Style metadata
* `--style-documents` Styles
* `--tilesets-list` Tileset metadata
* `--datasets-list` Datasets metadata
* `--dataset-documents` Datasets
* `--tokens-list` Tokens

## Scopes

To run the default backup you must provide a Mapbox Access Token with the following scopes (if some are missing the script will attempt to backup as much as it can with the scopes provided).

* styles:list
* styles:read
* tilesets:list
* tilesets:read
* datasets:list
* datasets:read
* fonts:read
* tokens:read
* user:read

## Whats Missing?

The following isn't backed up as there is no API support:

* Style icons (your uploaded SVGs) (although you can manually download these from Mapbox Studio via the export function)
* Style fonts (your uploaded fonts)
* Tilesets (your uploaded Shapefiles, GeoJSON, MBTiles, etc)
* Connections between Datasets and Tilesets is only via implicit use of the dataset ID in the tileset ID
* Secret Access Tokens (however this is probably a good thing, if you need to restore from a backup you'll need to refresh any tokens in live use yourself)
