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
        this.pollingInterval = CONFIG.components.onyx.polling_interval;

        this.connected = false;
        this.onyxRunning = false;

        this.activeCuelists = [];

        this.telnetListener = new Telnet();
        this.telnetSettings = {
            host: this.host,
            port: this.port,
            shellPrompt: '',
            timeout: 1500,
            negotiationMandatory: false,
        };
    }

    emit(event, ...data) {
        events.emit(event, ...data);
        super.emit(event, ...data);
    }

    async connect() {
        logger.debug(
            `Connecting to Onyx Telnet Interface at ${this.host}:${this.port}`
        );

        this.telnetListener.on('close', () => {
            logger.debug(`Onyx Telnet Connection Closed`);
        });

        await this.telnetListener.connect(this.telnetSettings);
        this.heartbeat();
    }

    async heartbeat() {
        // Check if Onyx is running
        const res = await this.telnetListner.send('IsMXRun', {
            waitfor: '.\r\n',
        });
        const lines = res.split('\r\n');
        lines.forEach(line => {
            switch (line) {
                case 'Yes':
                    this.onyxRunning = true;
                    break;
                case 'No':
                    this.onyxRunning = false;
                    break;
                default:
                    break;
            }
        });

        // Check for active cuelists
        await this.getActiveCuelists();

        // Loop
        setTimeout(() => {
            this.heartbeat();
        }, this.pollingInterval);
    }

    async runTelnet(command) {
        // Initiate a new Telnet connection
        const telnetProcessor = new Telnet();
        await telnetProcessor.connect(this.telnetSettings);

        // Send the command and wait for the result
        const telnetResult = await telnetProcessor.send(command, {
            waitfor: '.\r\n',
        });

        // After receiving result, disconnect
        telnetProcessor.end();

        // Parse and return the result
        const lines = telnetResult.split('\r\n');

        // Remove first 2 welcome lines
        delete lines[0];
        delete lines[1];

        return lines;
    }

    async getActiveCuelists() {
        const res = await this.runTelnet('QLActive');
        this.activeCuelists = [];
        res.forEach(line => {
            switch (line) {
                case '200 Ok':
                case '200 ':
                case '.':
                case '':
                case 'No Active Qlist in List':
                    break;
                default: {
                    const id = parseInt(line.substring(0, 5), 10);
                    const title = line.substring(8);
                    this.activeCuelists.push({ id, title });
                    break;
                }
            }
        });
    }
}

const component = new OnyxController();
// if (component.use_server) component.connect();
module.exports = { component };
