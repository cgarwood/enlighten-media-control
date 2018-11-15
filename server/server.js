/*
    Enlighten Media Control Server
*/

const WebSocket = require('ws');

const logger = require('./logger.js');

logger.info('Starting Enlighten Media Control Server.');

/* Set up Websocket Server */
logger.info('Setting up WebSocket server.');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
    ws.on('message', message => {
        logger.debug(`Received message: ${message}`);
    });
    logger.info(`Incoming Connection from ${req.connection.remoteAddress}`);
    ws.send('Connection Established.');
});
