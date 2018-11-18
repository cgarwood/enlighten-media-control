/*
    Initial ProPresenter component
    Connect to ProPresenter Remote and Stage Display websockets
    Fire events based on data received from ProPresenter
    Register functions/methods for ProPresenter control
*/

const WebSocket = require('ws');

const CONFIG = require('../config.js');
const logger = require('../logger.js');

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

        logger.debug(
            `Connecting to Stage Display API at ${this.host}:${this.port}`
        );
    }

    connect() {
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
            this.postEvent('connected', {});
        });
        this.ws.on('message', data => {
            this.postEvent('message', data);
            this.handleMessage(data);
            this.postEvent('update', {});
        });
        this.ws.on('close', () => {
            this.connected = false;
            logger.error('ProPresenter Stage Display API disconnected');
            this.postEvent('disconnected', {});
        });
    }

    postEvent(event, data) {
        if (this.onEvent != null) this.onEvent(event, data);
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
        this.connected = false;

        this.onEvent = null;

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
            this.postEvent('connected', {});
        });
        this.ws.on('message', data => {
            this.postEvent('message', { data: this.data });
            this.handleMessage(data);
            this.postEvent('update', {});
        });
        this.ws.on('close', () => {
            logger.error('ProPresenter Remote Control API disconnected');
            this.postEvent('disconnected', {});
        });
    }

    postEvent(event, data) {
        if (this.onEvent != null) this.onEvent(event, data);
    }

    handleMessage(data) {
        logger.debug(`Remote API websocket data: ${data}`);
        this.data = JSON.parse(data);

        if (this.data.authenticated === 0) {
            logger.error(
                `ProPresenter Remote API Authentication Failed: ${
                    this.data.error
                }`
            );
        }
        if (this.data.authenticated === 1) {
            this.connected = true;
            logger.info(
                'ProPresenter Remote Control API Connected and Authenticated.'
            );
        }
    }
}

async function setupComponent() {
    this.stageDisplayApi = new StageDisplayApi();
    this.remoteApi = new RemoteApi();
    logger.info('ProPresenter component initialized');
}
module.exports = { setupComponent };
