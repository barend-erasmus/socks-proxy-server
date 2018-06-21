import * as net from 'net';
import * as path from 'path';
import * as tls from 'tls';
import * as uuid from 'uuid';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { IProxyServer } from './interfaces/proxy-server';
import { OnPreConnectionDataResult } from './models/on-pre-connection-data-result';

export abstract class ProxyServer<T extends any> implements IProxyServer {

    protected server: T = null;

    constructor(
        protected hostname: string,
        protected log: string,
        protected port: number,
    ) {
        if (!this.hostname) {
            this.hostname = '0.0.0.0';
        }

        if (!this.port) {
            this.port = 1337;
        }

        this.initializeLogger();
    }

    public listen(): void {
        this.server = this.createServer((socket: net.Socket | tls.TLSSocket) => this.handleSocketConnection(socket));

        this.server.listen(this.port, this.hostname, () => {
            winston.info(`Listening on ${this.hostname}:${this.port}`);
        });
    }

    protected closeSocket(socket: net.Socket | tls.TLSSocket): void {
        if (socket) {
            socket.destroy();
            socket = null;
        }
    }

    protected connectToDestinationSocket(sourceSocket: net.Socket | tls.TLSSocket, destinationHostname: string, destinationPort: number): net.Socket | tls.TLSSocket {
        const destinationSocket: net.Socket | tls.TLSSocket = this.createDestinationSocket(destinationHostname, destinationPort, sourceSocket);

        winston.info(`Connected`, {
            destinationHostname: destinationSocket.remoteAddress,
            destinationPort: destinationSocket.remotePort,
            sourceAddress: sourceSocket.remoteAddress,
            sourcePort: sourceSocket.remotePort,
        });

        destinationSocket.on('data', (data: Buffer) => {
            winston.info(`Receiving data`, {
                bytes: data.length,
                destinationHostname: destinationSocket.remoteAddress,
                destinationPort: destinationSocket.remotePort,
                sourceAddress: sourceSocket.remoteAddress,
                sourcePort: sourceSocket.remotePort,
            });

            sourceSocket.write(data);
        });

        destinationSocket.on('close', () => {
            winston.info(`Disconnected`, {
                destinationHostname: destinationSocket.remoteAddress,
                destinationPort: destinationSocket.remotePort,
                sourceAddress: sourceSocket.remoteAddress,
                sourcePort: sourceSocket.remotePort,
            });

            this.closeSocket(destinationSocket);
        });

        destinationSocket.on('error', (error: Error) => this.handleSocketError(error, destinationSocket));

        return destinationSocket;
    }

    protected abstract createServer(onConnectionFn: (socket: net.Socket | tls.TLSSocket) => void): T;

    protected abstract createDestinationSocket(destinationHostname: string, destinationPort: number, sourceSocket: net.Socket | tls.TLSSocket): net.Socket | tls.TLSSocket;

    protected handleSocketConnection(sourceSocket: net.Socket | tls.TLSSocket): void {
        winston.info(`Connected`, {
            sourceAddress: sourceSocket.remoteAddress,
            sourcePort: sourceSocket.remotePort,
        });

        sourceSocket['id'] = uuid.v4();

        let destinationSocket: net.Socket | tls.TLSSocket = null;

        let connected: boolean = false;

        sourceSocket.on('data', (data: Buffer) => {
            winston.info(`Receiving data`, {
                bytes: data.length,
                sourceAddress: sourceSocket.remoteAddress,
                sourcePort: sourceSocket.remotePort,
            });

            if (!connected) {
                const onPreConnectionDataResult: OnPreConnectionDataResult = this.onPreConnectionData(data, destinationSocket, sourceSocket);
                if (onPreConnectionDataResult.connect) {
                    destinationSocket = this.connectToDestinationSocket(sourceSocket, onPreConnectionDataResult.destinationHostname, onPreConnectionDataResult.destinationPort);
                    connected = true;
                }
            } else {
                destinationSocket.write(data);
            }
        });

        sourceSocket.on('close', () => {
            winston.info(`Disconnected`, {
                sourceAddress: sourceSocket.remoteAddress,
                sourcePort: sourceSocket.remotePort,
            });

            this.closeSocket(sourceSocket);
        });

        sourceSocket.on('error', (error: Error) => this.handleSocketError(error, sourceSocket));
    }

    protected handleSocketError(error: Error, socket: net.Socket | tls.TLSSocket): void {
        if (!error) {
            return;
        }

        winston.info(`Socket failed`, {
            error,
            sourceAddress: socket.remoteAddress,
            sourcePort: socket.remotePort,
        });

        this.closeSocket(socket);
    }

    protected initializeLogger(): void {
        if (this.log) {
            winston.add(winston.transports.DailyRotateFile, {
                datePattern: 'YYYY-MM-DD-HH',
                filename: path.join(this.log, 'proxy-server-%DATE%.log'),
                json: true,
                maxFiles: '30d',
                maxSize: '20m',
            });
        }

        // winston.remove(winston.transports.Console);
    }

    protected abstract onPreConnectionData(data: Buffer, destinationSocket: net.Socket | tls.TLSSocket, sourceSocket: net.Socket | tls.TLSSocket): OnPreConnectionDataResult;
}
