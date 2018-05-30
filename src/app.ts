import * as net from 'net';
import * as winston from 'winston';
import * as yargs from 'yargs';
import { Connection } from './connection';
import { Statistics } from './statistics';

const argv = yargs.argv;

if (argv.log) {
    winston.add(winston.transports.File, { filename: argv.log });
}

const statistics: Statistics = new Statistics(argv.log ? true : false);

const server: net.Server = net.createServer(onConnection);

const hostname: string = argv.hostname ? argv.hostname : '0.0.0.0';
const port: number = argv.port ? argv.port : 1337;

server.listen(port, hostname, () => {
    winston.info(`Listening on ${hostname}:${port}`);
});

function onConnection(socket: net.Socket): void {
    const connection: Connection = new Connection(socket, statistics);
}
