const { addColors, createLogger, format, transports } = require('winston');

const { combine, colorize, printf, timestamp } = format;

/* Set up Logger */
const myFormat = printf(
    log => `${log.timestamp} [${log.level}] ${log.message}`
);
const logger = createLogger({
    transports: [
        new transports.Console({
            format: combine(
                colorize(),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                myFormat
            ),
        }),
        new transports.File({
            filename: './server.log',
            tailable: true,
            maxsize: 1024 * 1024 * 50,
            maxFiles: 5,
            format: combine(
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                myFormat
            ),
        }),
    ],
    level: 'debug',
    exitOnError: false,
});
addColors({
    error: 'red',
    warning: 'yellow',
    info: 'green',
    debug: 'cyan',
});

module.exports = logger;
