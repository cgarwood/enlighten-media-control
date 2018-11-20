/*
    Initial Spotify component
    Works on Mac only by using AppleScript

    ProPresenter Websocket API is documented here:
    https://github.com/jeffmikels/ProPresenter-API
*/

const EventEmitter = require('events');
const CONFIG = require('../config.js');
const logger = require('../logger.js');

class SpotifyController {
    constructor() {
        this.watcher = setInterval(this.check, CONFIG.spotify.watch_interval);
        this.events = new EventEmitter();
        logger.info('Spotify Controller initialized.');
    }

    // checks to see the current status of the spotify player
    check() {}
}

const component = new SpotifyController();
module.exports = { component };
