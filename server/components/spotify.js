/*
    Initial Spotify component
    Works on Mac only by using AppleScript

    ProPresenter Websocket API is documented here:
    https://github.com/jeffmikels/ProPresenter-API
*/

const EventEmitter = require('events');
const WebSocket = require('ws');
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
        // The controller can interact with spotify directly
        // but only if enlighten is running on a mac that is
        // running spotify because spotify is scriptable
        // only by applescript. There is no known alternative
        // for Windows / Linux.

        // Additionally, the controller can operate by
        // sending commands to a "spotify server" which
        // must run on a mac that is running spotify.
        // The server will then handle the applescript.
        // The server must support all the functions
        // of this module and may optionally support
        // additional commands. See the functions
        // handleExtra and serverCmd below.

        this.wsurl = CONFIG.components.spotify.wsurl;
        this.authkey = CONFIG.components.spotify.authkey;
        this.use_server = this.wsurl !== '';
        this.connected = false;

        if (!this.use_server) {
            this.watcher = setInterval(
                () => this.check(),
                CONFIG.components.spotify.watch_interval
            );
        }
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

    connect() {
        logger.debug(`Connecting to Spotify Server at ${this.wsurl}`);
        this.ws = new WebSocket(this.wsurl);
        this.ws.on('open', () => {
            this.connected = true;
            this.events.emit('connect', {});
            logger.debug('Spotify Server connected');
        });
        this.ws.on('error', data => {
            this.events.emit('error', data);
            logger.error(`Spotify Server connection error: ${data}`);
        });
        this.ws.on('message', data => {
            this.events.emit('message', data);
            this.handleMessage(data);
            this.events.emit('update', {});
        });
        this.ws.on('close', () => {
            this.connected = false;
            logger.error('Spotify Server disconnected');
            this.emit('disconnect', {});
        });
    }

    handleMessage(message) {
        // websocket data is a full json representation
        // of the state of the spotify application
        // or a simple boolean that the command was successful
        const data = JSON.parse(message);
        switch (data.action) {
            case 'getCurrentTrack':
                this.handleCurrentTrack(data.data);
                break;
            case 'getAppState':
                this.handleAppState(data.data);
                break;
            default:
                this.handleExtra(data.data);
                break;
        }
    }

    // checks to see the current status of the spotify player
    check() {
        logger.info('spotify check');
        this.getCurrentTrack();
    }

    handleCurrentTrack(result) {
        this.current_track = new SpotifyTrack(...result);
        this.events.emit('update', {});
    }

    handleAppState(result) {
        [
            this.volume,
            this.state,
            this.position,
            this.repeating,
            this.shuffling,
        ] = result;
        this.events.emit('update', {});
    }

    // The server may support commands not supported
    // by this spotify module. This function should
    // be overridden by users of this module to handle
    // that extra data. Also see the serverCmd function
    /* eslint-disable */
    handleExtra() {}
    /* eslint-enable */

    // The server may support commands
    // not supported by this core module
    // so we expose a function to allow
    // implementers of this module to
    // send their own commands to the server
    serverCmd(command, args) {
        if (!this.use_server) {
            logger.error('Spotify serverCmd called but no server specified');
            return;
        }
        this.ws.send(
            JSON.stringify({
                authkey: this.authkey,
                action: command,
                args,
            })
        );
    }

    getCurrentTrack(callback) {
        if (this.use_server) {
            this.ws.send(
                JSON.stringify({
                    authkey: this.authkey,
                    action: 'getCurrentTrack',
                })
            );
            return;
        }
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
                else {
                    logger.debug(result);
                    this.handleCurrentTrack(result);
                    if (callback) callback();
                }
            }
        );
    }

    getAppState(callback) {
        if (this.use_server) {
            this.ws.send(JSON.stringify({ action: 'getAppState' }));
            return;
        }
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
                else {
                    logger.debug(result);
                    this.handleAppState(result);
                    if (callback) callback();
                }
            }
        );
    }

    setVolume(n) {
        // spotify actually sets the volume to n-1
        // successful_new_volume = ( n<100 ) ? n-1 : 100;
        this.volume = n;
        return this.setVar('sound volume', n < 100 ? n + 1 : 100);
    }

    setPosition(n) {
        this.position = n;
        return this.setVar('player position', n);
    }

    setShuffling(b) {
        this.shuffling = b;
        const bval = b ? 'true' : 'false';
        return this.setVar('shuffling', bval);
    }

    setRepeating(b) {
        this.repeating = b;
        const bval = b ? 'true' : 'false';
        return this.setVar('repeating', bval);
    }

    /* eslint-disable class-methods-use-this */
    setVar(varname, varval) {
        if (this.use_server) {
            this.ws.send(
                JSON.stringify({
                    authkey: this.authkey,
                    action: 'setVar',
                    args: [varname, varval],
                })
            );
            return;
        }
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
        if (this.use_server) {
            this.ws.send(
                JSON.stringify({
                    authkey: this.authkey,
                    action: 'sendCmd',
                    args: [command],
                })
            );
            return;
        }
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
        return this.sendCmd(`play track "${trackurl}`);
    }

    nextTrack() {
        return this.sendCmd('next track');
    }

    previousTrack() {
        return this.sendCmd('previous track');
    }

    play() {
        this.status = 'playing';
        return this.sendCmd('play');
    }

    pause() {
        this.status = 'paused';
        return this.sendCmd('pause');
    }

    fadeTo(targetVolume, duration) {
        if (this.use_server) {
            this.ws.send(
                JSON.stringify({
                    authkey: this.authkey,
                    action: 'fadeTo',
                    args: [targetVolume, duration],
                })
            );
        }
    }
    /* eslint-enable class-methods-use-this */
}

const component = new SpotifyController();
if (component.use_server) component.connect();
module.exports = { component };
