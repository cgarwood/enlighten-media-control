/*
    Initial ProPresenter component
    Connect to ProPresenter Remote and Stage Display websockets
    Fire events based on data received from ProPresenter
    Register functions/methods for ProPresenter control

    ProPresenter Websocket API is documented here:
    https://github.com/jeffmikels/ProPresenter-API
*/

const WebSocket = require('ws');
const EventEmitter = require('events');
const CONFIG = require('../config.js');
const logger = require('../logger.js');

const events = new EventEmitter();

class StageDisplayApi extends EventEmitter {
    constructor() {
        super();
        this.host = CONFIG.components.propresenter.host;
        this.port = CONFIG.components.propresenter.port;
        this.stage_display_password =
            CONFIG.components.propresenter.stage_display_password;
        this.connected = false;
        this.data = null;

        // possible StageDisplay values
        this.clock_string = '';
        this.current_slide = {
            uid: '',
            content: '',
            notes: '',
        };
        this.next_slide = {
            uid: '',
            content: '',
            notes: '',
        };
        logger.debug(`StageDisplayApi object created`);
    }

    // override the event emitter to bubble events up
    // to the component level emitter also
    emit(event, ...data) {
        events.emit(event, ...data);
        super.emit(event, ...data);
    }

    connect() {
        logger.debug(
            `Connecting to Stage Display API at ${this.host}:${this.port}`
        );

        this.ws = new WebSocket(`ws://${this.host}:${this.port}/stagedisplay`);
        this.ws.on('open', () => {
            // Authenticate on connection
            const msg = {
                pwd: this.stage_display_password,
                ptl: 610,
                acn: 'ath',
            };
            this.ws.send(JSON.stringify(msg));
            logger.debug('Stage Display API connected');
        });
        this.ws.on('error', data => {
            this.emit('error', data);
            logger.error(`Stage Display API connection error: ${data}`);
        });
        this.ws.on('message', data => {
            this.emit('message', data);
            this.handleMessage(data);
            this.emit('update', {});
        });
        this.ws.on('close', () => {
            this.connected = false;
            logger.error('ProPresenter Stage Display API disconnected');
            this.emit('disconnect', {});
        });
    }

    handleMessage(data) {
        this.data = JSON.parse(data);
        switch (this.data.acn) {
            case 'ath':
                if (this.data.ath === false) {
                    this.connected = false;
                    logger.error(
                        `ProPresenter Stage Display Authentication Failed: ${
                            this.data.err
                        }`
                    );
                } else {
                    this.connected = true;
                    this.emit('connect', {});
                    logger.debug(
                        'Stage Display API Connected and Authenticated'
                    );
                }
                break;
            case 'sys':
                this.clock_string = this.data.txt;
                break;
            case 'fv':
                this.data.ary.forEach(element => {
                    switch (element.acn) {
                        case 'cs':
                            this.current_slide.uid = element.uid;
                            this.current_slide.txt = element.txt;
                            break;
                        case 'ns':
                            this.next_slide.uid = element.uid;
                            this.next_slide.txt = element.txt;
                            break;
                        case 'csn':
                            this.current_slide.notes = element.txt;
                            break;
                        case 'nsn':
                            this.next_slide.notes = element.txt;
                            break;
                        default:
                            break;
                    }
                });
                break;
            default:
                break;
        }
        logger.debug(`stage display websocket data: ${data}`);
    }
}

class RemoteApi extends EventEmitter {
    constructor() {
        super();

        this.host = CONFIG.components.propresenter.host;
        this.port = CONFIG.components.propresenter.port;
        this.remote_password = CONFIG.components.propresenter.remote_password;
        this.slide_quality = CONFIG.components.propresenter.slide_quality;

        // state variables
        this.connected = false;
        this.controller_id = null;
        this.deferredSlideIndex = null;

        // each library item is just the path string for that presentation
        this.library = [];

        // each playlist is an object with the following properties
        // location, type, name, presentations (name, location, type)
        this.playlists = [];

        // presentation objects are fully populated by the api
        // and contain the following properties:
        // path, name, has_timeline, groups (name, color, slides),
        // also, each slide contains the following properties:
        // enabled, notes, mask, text, image, index, transition, label, color
        this.presentation = {};

        logger.debug(`RemoteControlApi object created`);
    }

    // override the event emitter to bubble events up
    // to the component level emitter also
    emit(event, ...data) {
        events.emit(event, ...data);
        super.emit(event, ...data);
    }

    connect() {
        if (this.connected) return;

        logger.debug(
            `Connecting to Remote Control API at ${this.host}:${this.port}`
        );

        this.ws = new WebSocket(`ws://${this.host}:${this.port}/remote`);
        this.ws.on('open', () => {
            // Authenticate on connection
            const msg = {
                action: 'authenticate',
                protocol: 600,
                password: this.remote_password,
            };
            this.ws.send(JSON.stringify(msg));
            logger.debug('Remote Control API connected');
        });
        this.ws.on('error', data => {
            this.emit('error', data);
            logger.error(`Remote Control API connection error: ${data}`);
        });
        this.ws.on('message', data => {
            this.emit('message', { data: this.data });
            this.handleMessage(data);
            this.emit('update', {});
        });
        this.ws.on('close', () => {
            this.connected = false;
            logger.error('ProPresenter Remote Control API disconnected');
            this.emit('disconnect', {});
        });
    }

    handleMessage(data) {
        logger.debug(`Remote API websocket data: ${data}`);
        this.data = JSON.parse(data);

        switch (this.data.action) {
            case 'authenticate':
                if (this.data.authenticated === 0) {
                    logger.error(
                        `ProPresenter Remote API Authentication Failed: ${
                            this.data.error
                        }`
                    );
                }
                if (this.data.authenticated === 1) {
                    this.connected = true;
                    this.controller_id = this.data.controller;
                    logger.info(
                        'ProPresenter Remote Control API Connected and Authenticated.'
                    );
                    this.emit('connect', {});
                }
                break;
            case 'libraryRequest':
                this.library = this.data.library;
                break;
            case 'playlistRequestAll':
                this.playlists = this.data.playlistAll;
                break;
            case 'presentationCurrent':
                this.presentation = this.data.presentation;
                if (this.deferredSlideIndex != null) {
                    this.presentation.slideIndex = this.deferredSlideIndex;
                    this.deferredSlideIndex = null;
                }
                break;
            case 'presentationSlideIndex':
                this.presentation.slideIndex = this.data.slideIndex;
                break;
            case 'presentationTriggerIndex':
                // this message can happen when a new presentation is selected
                if (
                    this.presentation.presentationPath !==
                    this.data.presentationPath
                ) {
                    // defer this slideIndex
                    this.deferredSlideIndex = this.data.slideIndex;
                    // request the proper presentation data
                    this.getPresentation(this.data.presentationPath);
                } else {
                    this.presentation.slideIndex = this.data.slideIndex;
                }
                break;
            default:
                break;
        }
        this.emit('update', {});
    }

    getLibrary() {
        if (!this.connected) return false;
        this.ws.send(
            JSON.stringify({
                action: 'libraryRequest',
            })
        );
        return true;
    }

    getPlaylists() {
        if (!this.connected) return false;
        this.ws.send(
            JSON.stringify({
                action: 'playlistRequestAll',
            })
        );
        return true;
    }

    getCurrentPresentation() {
        if (!this.connected) return false;
        this.ws.send(
            JSON.stringify({
                action: 'presentationCurrent',
                presentationSlideQuality: this.slide_quality,
            })
        );
        return true;
    }

    getCurrentSlideIndex() {
        if (!this.connected) return false;
        this.ws.send(
            JSON.stringify({
                action: 'presentationSlideIndex',
            })
        );
        return true;
    }

    getPresentation(presentationPath) {
        if (!this.connected) return false;
        this.ws.send(
            JSON.stringify({
                action: 'presentationRequest',
                presentationPath,
                presentationSlideQuality: this.slide_quality,
            })
        );
        return true;
    }

    triggerSlide(slideIndex, presentationPath) {
        if (!this.connected) return false;
        const realPresentationPath =
            presentationPath || this.presentation.presentationPath;
        this.ws.send(
            JSON.stringify({
                action: 'presentationTriggerIndex',
                slideIndex,
                realPresentationPath,
            })
        );
        return true;
    }
}

// stageDisplay events and remoteApi events are proxied together
// by the 'events' property of this class.
class ProPresenter {
    constructor() {
        this.stageDisplayApi = new StageDisplayApi();
        this.remoteApi = new RemoteApi();
        logger.info('ProPresenter component initialized');
        this.events = events;
    }

    async connect() {
        this.stageDisplayApi.connect();
        this.remoteApi.connect();
    }
}
const component = new ProPresenter();
component.connect();
module.exports = { component };
