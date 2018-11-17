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

        logger.debug(
            `Connecting to Stage Display API at ${this.host}:${this.port}`
        );

        this.ws = new WebSocket(`ws://${this.host}:${this.port}/stagedisplay`);
        this.ws.on('open', () => {
            this.ws.send(
                `{"pwd":"${this.stage_display_password}","ptl":610,"acn":"ath"}`
            );
            logger.debug('Stage Display API connected');
        });
        this.ws.on('message', data => {
            this.handleMessage(data);
        });
        this.ws.on('close', () => {
            logger.error('ProPresenter Stage Display API disconnected');
        });
    }

    handleMessage(data) {
        this.data = JSON.parse(data);
        switch (this.data.acn) {
            case 'ath':
                if (this.data.ath === false) {
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
            default:
                break;
        }
        logger.debug(`stage display websocket data: ${data}`);
    }
}

async function setupComponent() {
    this.stageDisplayApi = new StageDisplayApi();

    logger.info('ProPresenter component initialized');
}
module.exports = { setupComponent };
