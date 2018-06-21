import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import * as tls from 'tls';
import { OnPreConnectionDataResult } from './models/on-pre-connection-data-result';
import { ProxyServer } from './proxy-server';

export class ForwardProxyServer extends ProxyServer<net.Server | tls.Server> {

    protected buffers: {} = null;

    constructor(
        protected forwardToHostname: string,
        protected forwardToPort: number,
        hostname: string,
        log: string,
        protected mode: string,
        port: number,
    ) {
        super(hostname, log, port);

        if (!this.forwardToHostname) {
            this.forwardToHostname = '127.0.0.1';
        }

        if (!this.forwardToPort) {
            this.forwardToPort = 8080;
        }

        if (!this.mode) {
            this.mode = 'raw-raw';
        }

        this.buffers = {};
    }

    protected createServer(onConnectionFn: (socket: net.Socket | tls.TLSSocket) => void): net.Server | tls.Server {
        const serverMode: string = this.mode.split('-')[0];

        if (serverMode === 'raw') {
            const server: net.Server = net.createServer((socket: net.Socket) => onConnectionFn(socket));

            return server;
        }

        if (serverMode === 'tls') {
            const server: tls.Server = tls.createServer({
                cert: fs.readFileSync(path.join(__dirname, '..', '..', 'certificate.pem')),
                key: fs.readFileSync(path.join(__dirname, '..', '..', 'key.pem')),
                rejectUnauthorized: false,
            }, (socket: net.Socket) => onConnectionFn(socket));

            return server;
        }

        throw new Error('Unsupported Server Mode');
    }

    protected createDestinationSocket(destinationHostname: string, destinationPort: number, sourceSocket: net.Socket | tls.TLSSocket): net.Socket | tls.TLSSocket {
        let destinationSocket: net.Socket | tls.TLSSocket = null;

        const destinationMode: string = this.mode.split('-')[1];

        if (destinationMode === 'raw') {
            destinationSocket = net.connect(destinationPort, destinationHostname, (error: Error) => {
                this.handleSocketError(error, destinationSocket);

                if (error) {
                    return;
                }

                if (this.buffers[sourceSocket['id']]) {
                    for (const buffer of this.buffers[sourceSocket['id']]) {
                        destinationSocket.write(buffer);
                    }
                }

                this.buffers[sourceSocket['id']] = null;
            });

            return destinationSocket;
        }

        if (destinationMode === 'tls') {
            destinationSocket = tls.connect(destinationPort, {
                host: destinationHostname,
                rejectUnauthorized: false,
            }, () => {
                this.handleSocketError(null, destinationSocket);
            });

            return destinationSocket;
        }

        throw new Error('Unsupported Destination Mode');
    }

    protected onPreConnectionData(data: Buffer, destinationSocket: net.Socket | tls.TLSSocket, sourceSocket: net.Socket | tls.TLSSocket): OnPreConnectionDataResult {
        this.saveToBuffer(data, sourceSocket);

        return new OnPreConnectionDataResult(true, this.forwardToHostname, this.forwardToPort);
    }

    protected saveToBuffer(data: Buffer, socket: net.Socket | tls.TLSSocket): void {
        if (!socket['id']) {
            return;
        }

        if (!this.buffers[socket['id']]) {
            this.buffers[socket['id']] = [];
        }

        this.buffers[socket['id']].push(data);
    }

}
