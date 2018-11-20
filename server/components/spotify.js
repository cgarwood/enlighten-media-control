/*
    Initial Spotify component
    Works on Mac only by using AppleScript

    ProPresenter Websocket API is documented here:
    https://github.com/jeffmikels/ProPresenter-API
*/

const EventEmitter = require('events');
const osa = require('node-osascript');

const CONFIG = require('../config.js');
const logger = require('../logger.js');

class SpotifyTrack {
    constructor(
        _artist,
        _album,
        _discno,
        _duration,
        _played,
        _trackno,
        _popularity,
        _id,
        _name,
        _artwork,
        _albartist,
        _url
    ) {
        this.artist = _artist;
        this.artist = _artist;
        this.album = _album;
        this.discno = _discno;
        this.duration = _duration;
        this.played = _played;
        this.trackno = _trackno;
        this.popularity = _popularity;
        this.id = _id;
        this.name = _name;
        this.artwork = _artwork;
        this.url = _url;
    }
}

class SpotifyController {
    constructor() {
        this.watcher = setInterval(
            () => this.check(),
            CONFIG.components.spotify.watch_interval
        );
        this.events = new EventEmitter();

        this.playlists = [];
        this.current_track = new SpotifyTrack();

        this.volume = 0;
        this.state = '';
        this.position = 0;
        this.repeating = false;
        this.shuffling = false;

        logger.info('Spotify Controller initialized.');
    }

    // checks to see the current status of the spotify player
    check() {
        logger.info('spotify check');
        this.getCurrentTrack();
    }

    getCurrentTrack(callback) {
        osa.execute(
            `
            tell application "Spotify"
                set _artist to artist of current track
                set _album to album of current track
                set _discno to disc number of current track
                set _duration to duration of current track
                set _played to played count of current track
                set _trackno to track number of current track
                set _popularity to popularity of current track
                set _id to id of current track
                set _name to name of current track
                set _artwork to artwork url of current track
                set _albartist to album artist of current track
                set _url to spotify url of current track
                return {_artist, _album, _discno, _duration, _played, _trackno, _popularity, _id, _name, _artwork, _albartist, _url}
            end tell
            `,
            (err, result) => {
                if (err) logger.error(err);
                logger.debug(result);
                this.current_track = new SpotifyTrack(...result);
                // logger.debug(this.current_track.url);
                if (callback) callback();
                this.events.emit('update', {});
            }
        );
    }

    getAppState(callback) {
        osa.execute(
            `
            tell application "Spotify"
                set _volume to sound volume
                set _state to player state
                set _position to player position
                set _repeating to repeating enabled
                set _shuffling to shuffling enabled
                return {_volume, _state, _position, _repeating, _shuffling}
            end tell
            `,
            (err, result) => {
                if (err) logger.error(err);
                logger.debug(result);
                [
                    this.volume,
                    this.state,
                    this.position,
                    this.repeating,
                    this.shuffling,
                ] = result;
                // this.volume = result[0];
                // this.state = result[1];
                // this.position = result[2];
                // this.repeating = result[3];
                // this.shuffling = result[4];
                if (callback) callback();
                this.events.emit('update', {});
            }
        );
    }

    setVolume(n) {
        // spotify actually sets the volume to n-1
        // successful_new_volume = ( n<100 ) ? n-1 : 100;
        this.volume = n;
        this.setVar('sound volume', n < 100 ? n + 1 : 100);
    }

    setPosition(n) {
        this.position = n;
        this.setVar('player position', n);
    }

    setShuffling(b) {
        this.shuffling = b;
        const bval = b ? 'on' : 'off';
        this.setVar('shuffling', bval);
    }

    setRepeating(b) {
        this.repeating = b;
        const bval = b ? 'on' : 'off';
        this.setVar('repeating', bval);
    }

    /* eslint-disable class-methods-use-this */
    setVar(varname, varval) {
        osa.execute(
            `
            tell application "Spotify"
                set ${varname} to ${varval}
            end tell
            `,
            (err, result) => {
                if (err) logger.error(err);
                if (result) logger.debug(result);
            }
        );
    }

    sendCmd(command) {
        osa.execute(
            `
            tell application "Spotify"
                ${command}
            end tell
            `,
            (err, result) => {
                if (err) logger.error(err);
                if (result) logger.debug(result);
            }
        );
    }

    playTrack(trackurl) {
        this.status = 'playing';
        osa.execute(
            `
            tell application "Spotify"
                play track "${trackurl}"
            end tell
            `,
            (err, result) => {
                if (err) logger.error(err);
                if (result) logger.debug(result);
            }
        );
    }

    nextTrack() {
        this.sendCmd('next track');
    }

    previousTrack() {
        this.sendCmd('previous track');
    }

    play() {
        this.status = 'playing';
        this.sendCmd('play');
    }

    pause() {
        this.status = 'paused';
        this.sendCmd('pause');
    }

    /* eslint-enable class-methods-use-this */
}

const component = new SpotifyController();
module.exports = { component };
