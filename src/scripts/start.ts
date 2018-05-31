import * as net from 'net';
import * as path from 'path';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import 'winston-loggly';
import * as logzioWinstonTransport from 'winston-logzio';
import * as yargs from 'yargs';
import { AuthenticationMethod } from '../enums/authentication-method';
import { Connection } from './../connection';
import { Statistics } from './../statistics';

export function start(
    allowedIPAddresses: string[],
    deniedIPAddresses: string[],
    hostname: string,
    log: string,
    port: number,
    requiresUserNamePasswordAuthentication: boolean,
    userNamePasswordPairs: string[][],
) {
    if (log) {
        // winston.add(winston.transports.File, { filename: log });
        winston.add(winston.transports.DailyRotateFile, {
            datePattern: 'YYYY-MM-DD-HH',
            filename: path.join(log, 'socks-proxy-server-%DATE%.log'),
            json: true,
            maxFiles: '30d',
            maxSize: '20m',
        });

        // winston.add(winston.transports.Loggly, {
        //     json: true,
        //     subdomain: 'majuro',
        //     tags: ['Winston-NodeJS'],
        //     token: '898781b0-befb-48a2-a5f3-9ee51e393ab2',
        // });

        // winston.add(logzioWinstonTransport, {
        //     host: 'listener.logz.io',
        //     token: 'sxvtIOCQGQPwRcETZMyRjfCrXSMyIgda',
        //     type: 'socks-proxy-server',
        // });

        // winston.remove(winston.transports.Console);
    }

    const statistics: Statistics = new Statistics(log ? true : false);

    const server: net.Server = net.createServer((socket: net.Socket) =>
        onConnection(
            allowedIPAddresses,
            deniedIPAddresses,
            requiresUserNamePasswordAuthentication,
            socket,
            statistics,
            userNamePasswordPairs,
        ));

    hostname = hostname ? hostname : '0.0.0.0';
    port = port ? port : 1337;

    server.listen(port, hostname, () => {
        winston.info(`Listening on ${hostname}:${port}`);
    });
}

function onConnection(
    allowedIPAddresses: string[],
    deniedIPAddresses: string[],
    requiresUserNamePasswordAuthentication: boolean,
    socket: net.Socket,
    statistics: Statistics,
    userNamePasswordPairs: string[][],
): void {
    const connection: Connection = new Connection((password: string, userName: string) => {
        if (!requiresUserNamePasswordAuthentication) {
            return true;
        }

        if (!userNamePasswordPairs) {
            return false;
        }

        for (const userNamePasswordPair of userNamePasswordPairs) {
            if (userNamePasswordPair[0] === userName && userNamePasswordPair[1] === password) {
                return true;
            }
        }

        return false;
    }, allowedIPAddresses, socket, deniedIPAddresses, requiresUserNamePasswordAuthentication, statistics);
}
