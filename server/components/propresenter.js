/*
    Initial ProPresenter component
    Connect to ProPresenter Remote and Stage Display websockets
    Fire events based on data received from ProPresenter
    Register functions/methods for ProPresenter control

    ProPresenter Websocket API is documented here:
    https://github.com/jeffmikels/ProPresenter-API
*/

const WebSocket = require('ws');

const CONFIG = require('../config.js');
const logger = require('../logger.js');

function postEvent(event, data, callback) {
    // add a timestamp to every event
    const newData = data;
    if (!newData.ts) newData.ts = Date.now();
    if (this.onEvent != null) callback(event, newData);
}

class StageDisplayApi {
    constructor() {
        this.host = CONFIG.components.propresenter.host;
        this.port = CONFIG.components.propresenter.port;
        this.stage_display_password =
            CONFIG.components.propresenter.stage_display_password;
        this.connected = false;
        this.data = null;

        // callback function
        this.onEvent = null;

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
        this.ws.on('message', data => {
            postEvent('message', data, this.onEvent);
            this.handleMessage(data);
            postEvent('update', {}, this.onEvent);
        });
        this.ws.on('close', () => {
            this.connected = false;
            logger.error('ProPresenter Stage Display API disconnected');
            postEvent('disconnected', {}, this.onEvent);
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
                    postEvent('connected', {}, this.onEvent);
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

class RemoteApi {
    constructor() {
        this.host = CONFIG.components.propresenter.host;
        this.port = CONFIG.components.propresenter.port;
        this.remote_password = CONFIG.components.propresenter.remote_password;
        this.slide_quality = CONFIG.components.propresenter.slide_quality;

        // event callback
        this.onEvent = null;

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

    connect() {
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
        this.ws.on('message', data => {
            postEvent('message', { data: this.data });
            this.handleMessage(data);
            postEvent('update', {});
        });
        this.ws.on('close', () => {
            this.connected = false;
            logger.error('ProPresenter Remote Control API disconnected');
            postEvent('disconnected', {});
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
                    postEvent('connected', {});
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
                    this.requestPresentation(this.data.presentationPath);
                } else {
                    this.presentation.slideIndex = this.data.slideIndex;
                }
                break;
            default:
                break;
        }
        postEvent('update', {}, this.onEvent);
    }

    getLibrary() {
        this.ws.send(
            JSON.stringify({
                action: 'libraryRequest',
            })
        );
    }

    getPlaylists() {
        this.ws.send(
            JSON.stringify({
                action: 'playlistRequestAll',
            })
        );
    }

    getCurrentPresentation() {
        this.ws.send(
            JSON.stringify({
                action: 'presentationCurrent',
                presentationSlideQuality: this.slide_quality,
            })
        );
    }

    getCurrentSlideIndex() {
        this.ws.send(
            JSON.stringify({
                action: 'presentationSlideIndex',
            })
        );
    }

    getPresentation(presentationPath) {
        this.ws.send(
            JSON.stringify({
                action: 'presentationRequest',
                presentationPath,
                presentationSlideQuality: this.slide_quality,
            })
        );
    }

    triggerSlide(slideIndex, presentationPath) {
        const realPresentationPath =
            presentationPath || this.presentation.presentationPath;
        this.ws.send(
            JSON.stringify({
                action: 'presentationTriggerIndex',
                slideIndex,
                realPresentationPath,
            })
        );
    }
}

async function setupComponent() {
    this.stageDisplayApi = new StageDisplayApi();
    this.remoteApi = new RemoteApi();
    logger.info('ProPresenter component initialized');
}
module.exports = { setupComponent };
