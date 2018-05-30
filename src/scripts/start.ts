import * as net from 'net';
import * as path from 'path';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as yargs from 'yargs';
import { Connection } from './../connection';
import { Statistics } from './../statistics';

export function start(hostname: string, log: string, port: number) {
    if (log) {
        // winston.add(winston.transports.File, { filename: log });
        winston.add(winston.transports.DailyRotateFile, {
            datePattern: 'YYYY-MM-DD-HH',
            filename: path.join(log, 'socks-proxy-server-%DATE%.log'),
            json: true,
            maxFiles: '10d',
            maxSize: '50m',
            zippedArchive: true,
        });
    }

    const statistics: Statistics = new Statistics(log ? true : false);

    const server: net.Server = net.createServer((socket: net.Socket) => onConnection(socket, statistics));

    hostname = hostname ? hostname : '0.0.0.0';
    port = port ? port : 1337;

    server.listen(port, hostname, () => {
        winston.info(`Listening on ${hostname}:${port}`);
    });
}

function onConnection(socket: net.Socket, statistics: Statistics): void {
    const connection: Connection = new Connection(socket, statistics);
}
