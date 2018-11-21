/*
    Initial Elation Onyx component
    Connect to Onyx Telnet Interface
    Fire events based on data received from Onyx
    Register functions/methods for triggering light cues

    WIP.
    Will maintain a single "listener" telnet connection that polls
    the status.
    Due to the nature of the Onyx telnet interface, a new connection
    will be created for each command that is sent, otherwise the responses
    from the server can get messed up.
*/

const EventEmitter = require('events');
const Telnet = require('telnet-client');
const CONFIG = require('../config.js');
const logger = require('../logger.js');

const events = new EventEmitter();

class OnyxController extends EventEmitter {
    constructor() {
        super();
        this.host = CONFIG.components.onyx.host;
        this.port = CONFIG.components.onyx.port;

        this.connected = false;
    }

    emit(event, ...data) {
        events.emit(event, ...data);
        super.emit(event, ...data);
    }

    async connect() {
        logger.debug(
            `Connecting to Onyx Telnet Interface at ${this.host}:${this.port}`
        );
        const telnetListener = new Telnet();
        await telnetListener.connect({
            host: this.host,
            port: this.port,
            shellPrompt: '',
            timeout: 1500,
            negotiationMandatory: false,
        });
    }
}

const component = new OnyxController();
// if (component.use_server) component.connect();
module.exports = { component };
