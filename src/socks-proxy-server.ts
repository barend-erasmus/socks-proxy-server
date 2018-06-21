import * as dns from 'dns';
import * as net from 'net';
import * as winston from 'winston';
import { HexadecimalHelper } from './helpers/hexadecimal';
import { OnPreConnectionDataResult } from './models/on-pre-connection-data-result';
import { SOCKSProxyAddressType } from './models/socks-proxy-address-type';
import { SOCKSProxyAuthenticationMethod } from './models/socks-proxy-authentication-method';
import { SOCKSProxyAuthenticationStatus } from './models/socks-proxy-authentication-status';
import { SOCKSProxyCommandCode } from './models/socks-proxy-command-code';
import { SOCKSProxyConnectionStatus } from './models/socks-proxy-connection-status';
import { SOCKSProxyState } from './models/socks-proxy-state';
import { SOCKSProxyVersion } from './models/socks-proxy-version';
import { ProxyServer } from './proxy-server';

export class SOCKSProxyServer extends ProxyServer<net.Server> {

    protected buffers: {} = null;

    protected socksProxyStates: {} = null;

    constructor(
        protected authenticateFn: (password: string, userName: string) => boolean,
        protected allowedIPAddresses: string[],
        protected deniedIPAddresses: string[],
        hostname: string,
        log: string,
        port: number,
        protected requiresUsernamePasswordAuthentication: boolean,
    ) {
        super(hostname, log, port);

        this.buffers = {};

        this.socksProxyStates = {};
    }

    protected createServer(onConnectionFn: (socket: net.Socket) => void): net.Server {
        const server: net.Server = net.createServer((socket: net.Socket) => onConnectionFn(socket));

        return server;
    }

    protected createDestinationSocket(destinationHostname: string, destinationPort: number, sourceSocket: net.Socket): net.Socket {
        const destinationSocket: net.Socket = net.connect(destinationPort, destinationHostname, (error: Error) => {
            this.handleSocketError(error, destinationSocket);

            if (error) {
                return;
            }

            if (this.buffers[sourceSocket['id']]) {
                for (const buffer of this.buffers[sourceSocket['id']]) {
                    destinationSocket.write(buffer);
                }

                this.buffers[sourceSocket['id']] = null;
            }
        });

        return destinationSocket;
    }

    protected handleAuthenticationRequest(data: Buffer, sourceSocket: net.Socket): void {
        const socksProxyState: SOCKSProxyState = this.socksProxyStates[sourceSocket['id']];

        const version: number = data[0];

        const userNameLength: number = data[1];

        const userName: string = data.slice(2, 2 + userNameLength).toString();

        const passwordLength: number = data[2 + userNameLength];

        const password: string = data.slice(2 + userNameLength + 1, 2 + userNameLength + 1 + passwordLength).toString();

        const authenticationStatus: SOCKSProxyAuthenticationStatus =
            this.authenticateFn(password, userName) ? SOCKSProxyAuthenticationStatus.SUCCESS : SOCKSProxyAuthenticationStatus.FAILED;

        const responseBytes: number[] = [version, authenticationStatus];

        sourceSocket.write(Buffer.from(responseBytes));

        socksProxyState.authenticationResponseSent = true;
    }

    protected async handleConnectionRequest(data: Buffer, sourceSocket: net.Socket): Promise<void> {
        const socksProxyState: SOCKSProxyState = this.socksProxyStates[sourceSocket['id']];

        const version: number = data[0];

        if (version !== SOCKSProxyVersion.VERSION_5) {
            this.closeSocket(sourceSocket);
            return;
        }

        const commandCode: number = data[1];

        const addressType: number = data[3];

        let ipAddressBytes: number[] = null;

        let portBytes: number[] = null;

        if (addressType === SOCKSProxyAddressType.DOMAIN_NAME) {
            const domainNameLength: number = data[4];
            const domainName: string = data.slice(5, 5 + domainNameLength).toString();

            try {
                socksProxyState.destinationHostname = await this.resolveDomainName(domainName);
            } catch {
                this.sendConnectionResponse(addressType, SOCKSProxyConnectionStatus.HOST_UNREACHABLE, ipAddressBytes, portBytes, sourceSocket, version);
                this.closeSocket(sourceSocket);
                return;
            }

            portBytes = [data[5 + domainNameLength], data[5 + domainNameLength + 1]];
            socksProxyState.destinationPort = HexadecimalHelper.toDecimal(portBytes);
        } else if (addressType === SOCKSProxyAddressType.IPv4) {
            ipAddressBytes = [data[4], data[5], data[6], data[7]];
            socksProxyState.destinationHostname = `${ipAddressBytes[0]}.${ipAddressBytes[1]}.${ipAddressBytes[2]}.${ipAddressBytes[3]}`;

            portBytes = [data[8], data[9]];
            socksProxyState.destinationPort = HexadecimalHelper.toDecimal(portBytes);
        } else if (addressType === SOCKSProxyAddressType.IPv6) {
            this.sendConnectionResponse(addressType, SOCKSProxyConnectionStatus.ADDRESS_TYPE_NOT_SUPPORTED, ipAddressBytes, portBytes, sourceSocket, version);
            this.closeSocket(sourceSocket);
            return;
        }

        switch (commandCode) {
            case SOCKSProxyCommandCode.TCPIP_PORT_CONNECTION:
                this.sendConnectionResponse(addressType, SOCKSProxyConnectionStatus.COMMAND_NOT_SUPPORTED, ipAddressBytes, portBytes, sourceSocket, version);
                this.closeSocket(sourceSocket);
                break;
            case SOCKSProxyCommandCode.TCPIP_STREAM_CONNECTION:
                // TODO: other stuff
                this.sendConnectionResponse(addressType, SOCKSProxyConnectionStatus.GRANTED, ipAddressBytes, portBytes, sourceSocket, version);
                break;
            case SOCKSProxyCommandCode.UDP_PORT:
                this.sendConnectionResponse(addressType, SOCKSProxyConnectionStatus.COMMAND_NOT_SUPPORTED, ipAddressBytes, portBytes, sourceSocket, version);
                this.closeSocket(sourceSocket);
                break;
            default:
                this.sendConnectionResponse(addressType, SOCKSProxyConnectionStatus.COMMAND_NOT_SUPPORTED, ipAddressBytes, portBytes, sourceSocket, version);
                this.closeSocket(sourceSocket);
                return;
        }
    }

    protected handleGreetingRequest(data: Buffer, sourceSocket: net.Socket): void {
        const socksProxyState: SOCKSProxyState = this.socksProxyStates[sourceSocket['id']];

        const version: number = data[0];

        if (version !== SOCKSProxyVersion.VERSION_5) {
            this.closeSocket(sourceSocket);
            return;
        }

        socksProxyState.authenticationMethod = this.requiresUsernamePasswordAuthentication ? SOCKSProxyAuthenticationMethod.USERNAME_PASSWORD : data[2];

        const responseBytes: number[] = [version, socksProxyState.authenticationMethod];

        sourceSocket.write(Buffer.from(responseBytes));

        socksProxyState.greetingResponseSent = true;
    }

    protected resolveDomainName(domainName: string): Promise<string> {
        return new Promise((resolve: (ipAddress: string) => void, reject: (error: Error) => void) => {
            dns.resolve(domainName, (error: Error, addresses: string[]) => {
                if (error) {
                    reject(error);

                    winston.info(`Failed to resolve domain name`, {
                        domainName,
                        error,
                    });

                    return;
                }

                winston.info(`Resolved domain name`, {
                    domainName,
                    result: addresses[0],
                });

                resolve(addresses[0]);
            });
        });
    }

    protected onPreConnectionData(data: Buffer, destinationSocket: net.Socket, sourceSocket: net.Socket): OnPreConnectionDataResult {
        if (!this.socksProxyStates[sourceSocket['id']]) {
            this.socksProxyStates[sourceSocket['id']] = new SOCKSProxyState(null, false, false, null, null, false);
        }

        const socksProxyState: SOCKSProxyState = this.socksProxyStates[sourceSocket['id']];

        if (!socksProxyState.greetingResponseSent) {
            this.handleGreetingRequest(data, sourceSocket);
            return new OnPreConnectionDataResult(false, null, null);
        }

        if (socksProxyState.authenticationMethod === SOCKSProxyAuthenticationMethod.USERNAME_PASSWORD) {
            if (!socksProxyState.authenticationResponseSent) {
                this.handleAuthenticationRequest(data, sourceSocket);
                return new OnPreConnectionDataResult(false, null, null);
            }
        }

        if (!socksProxyState.connectionResponseSent) {
            this.handleConnectionRequest(data, sourceSocket);
            return new OnPreConnectionDataResult(false, null, null);
        }

        this.saveToBuffer(data, sourceSocket);

        return new OnPreConnectionDataResult(true, socksProxyState.destinationHostname, socksProxyState.destinationPort);
    }

    protected saveToBuffer(data: Buffer, socket: net.Socket): void {
        if (!socket['id']) {
            return;
        }

        if (!this.buffers[socket['id']]) {
            this.buffers[socket['id']] = [];
        }

        this.buffers[socket['id']].push(data);
    }

    protected sendConnectionResponse(addressType: number, connectionStatus: SOCKSProxyConnectionStatus, ipAddressBytes: number[], portBytes: number[], sourceSocket: net.Socket, version: number): void {
        const responseBytes: number[] = [version, connectionStatus, 0x00, addressType].concat(ipAddressBytes).concat(portBytes);

        if (sourceSocket) {
            sourceSocket.write(Buffer.from(responseBytes));

            const socksProxyState: SOCKSProxyState = this.socksProxyStates[sourceSocket['id']];

            socksProxyState.connectionResponseSent = true;
        }
    }

}
