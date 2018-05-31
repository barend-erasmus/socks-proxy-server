import * as dns from 'dns';
import * as net from 'net';
import * as winston from 'winston';
import { AddressType } from './enums/address-type';
import { AuthenticationMethod } from './enums/authentication-method';
import { AuthenticationStatus } from './enums/authentication-status';
import { CommandCode } from './enums/command-code';
import { ConnectionStatus } from './enums/connection-status';
import { Version } from './enums/version';
import { HexadecimalHelper } from './helpers/hexadecimal';
import { Statistics } from './statistics';

export class Connection {

    protected authenticationMethod: AuthenticationMethod = null;

    protected authenticationResponseSent: boolean = false;

    protected clientAddress: string = null;

    protected clientPort: number = null;

    protected connected: boolean = false;

    protected connectionResponseSent: boolean = false;

    protected destinationSocket: net.Socket = null;

    protected greetingResponseSent: boolean = false;

    constructor(
        protected authenticateFn: (password: string, userName: string) => boolean,
        protected allowedIPAddresses: string[],
        protected clientSocket: net.Socket,
        protected deniedIPAddresses: string[],
        protected requiresUsernamePasswordAuthentication: boolean,
        protected statistics: Statistics,
    ) {
        this.clientAddress = this.clientSocket.remoteAddress;
        this.clientPort = this.clientSocket.remotePort;

        winston.info(`Client connected`, {
            clientAddress: this.clientAddress,
            clientPort: this.clientPort,
        });

        this.clientSocket.on('close', () => {
            winston.info(`Client disconnected`, {
                clientAddress: this.clientAddress,
                clientPort: this.clientPort,
            });

            this.close();
        });

        this.clientSocket.on('data', (data: Buffer) => {
            this.onData(data);

            winston.info(`Client sending data`, {
                bytes: data.length,
                clientAddress: this.clientAddress,
                clientPort: this.clientPort,
            });

            this.statistics.incrementSent(data.length);
        });

        this.clientSocket.on('error', (error: Error) => {
            winston.info(`Client failed`, {
                clientAddress: this.clientAddress,
                clientPort: this.clientPort,
                error,
            });

            this.close();
        });
    }

    public onData(data: Buffer): void {
        if (!this.greetingResponseSent) {
            this.handleGreetingRequest(data);
            return;
        }

        if (this.authenticationMethod === AuthenticationMethod.USERNAME_PASSWORD) {
            if (!this.authenticationResponseSent) {
                this.handleAuthenticationRequest(data);
                return;
            }
        }

        if (!this.connectionResponseSent) {
            this.handleConnectionRequest(data);
            return;
        }

        if (this.destinationSocket && this.connected) {
            this.destinationSocket.write(data);
        }
    }

    protected close(): void {
        if (this.clientSocket) {
            this.clientSocket.destroy();
            this.clientSocket = null;
        }

        if (this.destinationSocket) {
            this.destinationSocket.destroy();
            this.destinationSocket = null;
        }
    }

    protected connectTCPIPStream(addressType: number, ipAddress: string, ipAddressBytes: number[], port: number, portBytes: number[], version: number): void {
        if (this.allowedIPAddresses) {
            if (this.allowedIPAddresses.indexOf(ipAddress) === 0) {
                this.sendConnectionResponse(addressType, ConnectionStatus.NOT_ALLOWED, ipAddressBytes, portBytes, version);
                return;
            }
        }

        if (this.deniedIPAddresses) {
            if (this.deniedIPAddresses.indexOf(ipAddress) > -1) {
                this.sendConnectionResponse(addressType, ConnectionStatus.NOT_ALLOWED, ipAddressBytes, portBytes, version);
                return;
            }
        }

        this.destinationSocket = new net.Socket();

        this.destinationSocket.connect(port, ipAddress, (error: Error) => {
            if (error) {
                winston.error(`Destination failed to connect`, {
                    clientAddress: this.clientAddress,
                    clientPort: this.clientPort,
                    destinationAddress: ipAddress,
                    destinationPort: port,
                    error,
                });

                this.sendConnectionResponse(addressType, ConnectionStatus.HOST_UNREACHABLE, ipAddressBytes, portBytes, version);

                this.close();

                return;
            }

            this.connected = true;

            this.sendConnectionResponse(addressType, ConnectionStatus.GRANTED, ipAddressBytes, portBytes, version);

            winston.info(`Destination connected`, {
                clientAddress: this.clientAddress,
                clientPort: this.clientPort,
                destinationAddress: ipAddress,
                destinationPort: port,
            });
        });

        this.destinationSocket.on('close', () => {
            winston.info(`Destination disconnected`, {
                clientAddress: this.clientAddress,
                clientPort: this.clientPort,
                destinationAddress: ipAddress,
                destinationPort: port,
            });

            this.close();
        });

        this.destinationSocket.on('data', (data: Buffer) => {
            if (this.clientSocket) {
                this.clientSocket.write(data);
            }

            winston.info(`Client receiving data`, {
                bytes: data.length,
                clientAddress: this.clientAddress,
                clientPort: this.clientPort,
                destinationAddress: ipAddress,
                destinationPort: port,
            });

            this.statistics.incrementReceived(data.length);
        });

        this.destinationSocket.on('error', (error: Error) => {
            winston.info(`Destination failed`, {
                clientAddress: this.clientAddress,
                clientPort: this.clientPort,
                destinationAddress: ipAddress,
                destinationPort: port,
                error,
            });

            this.close();
        });
    }

    protected handleAuthenticationRequest(data: Buffer): void {
        const version: number = data[0];

        const userNameLength: number = data[1];

        const userName: string = data.slice(2, 2 + userNameLength).toString();

        const passwordLength: number = data[2 + userNameLength];

        const password: string = data.slice(2 + userNameLength + 1, 2 + userNameLength + 1 + passwordLength).toString();

        const authenticationStatus: AuthenticationStatus =
            this.authenticateFn(password, userName) ? AuthenticationStatus.SUCCESS : AuthenticationStatus.FAILED;

        const responseBytes: number[] = [version, authenticationStatus];

        this.clientSocket.write(Buffer.from(responseBytes));

        this.authenticationResponseSent = true;
    }

    protected async handleConnectionRequest(data: Buffer): Promise<void> {
        const version: number = data[0];

        if (version !== Version.VERSION_5) {
            this.close();
            return;
        }

        const commandCode: number = data[1];

        const addressType: number = data[3];

        let ipAddressBytes: number[] = null;
        let ipAddress: string = null;

        let portBytes: number[] = null;
        let port: number = null;

        if (addressType === AddressType.DOMAIN_NAME) {
            const domainNameLength: number = data[4];
            const domainName: string = data.slice(5, 5 + domainNameLength).toString();

            try {
                ipAddress = await this.resolveDomainName(domainName);
            } catch {
                this.sendConnectionResponse(addressType, ConnectionStatus.HOST_UNREACHABLE, ipAddressBytes, portBytes, version);
                this.close();
                return;
            }

            portBytes = [data[5 + domainNameLength], data[5 + domainNameLength + 1]];
            port = HexadecimalHelper.toDecimal(portBytes);
        } else if (addressType === AddressType.IPv4) {
            ipAddressBytes = [data[4], data[5], data[6], data[7]];
            ipAddress = `${ipAddressBytes[0]}.${ipAddressBytes[1]}.${ipAddressBytes[2]}.${ipAddressBytes[3]}`;

            portBytes = [data[8], data[9]];
            port = HexadecimalHelper.toDecimal(portBytes);
        } else if (addressType === AddressType.IPv6) {
            this.sendConnectionResponse(addressType, ConnectionStatus.ADDRESS_TYPE_NOT_SUPPORTED, ipAddressBytes, portBytes, version);
            this.close();
            return;
        }

        switch (commandCode) {
            case CommandCode.TCPIP_PORT_CONNECTION:
                this.sendConnectionResponse(addressType, ConnectionStatus.COMMAND_NOT_SUPPORTED, ipAddressBytes, portBytes, version);
                this.close();
                break;
            case CommandCode.TCPIP_STREAM_CONNECTION:
                this.connectTCPIPStream(addressType, ipAddress, ipAddressBytes, port, portBytes, version);
                break;
            case CommandCode.UDP_PORT:
                this.sendConnectionResponse(addressType, ConnectionStatus.COMMAND_NOT_SUPPORTED, ipAddressBytes, portBytes, version);
                this.close();
                break;
            default:
                this.sendConnectionResponse(addressType, ConnectionStatus.COMMAND_NOT_SUPPORTED, ipAddressBytes, portBytes, version);
                this.close();
                return;
        }
    }

    protected handleGreetingRequest(data: Buffer): void {
        const version: number = data[0];

        if (version !== Version.VERSION_5) {
            this.close();
            return;
        }

        this.authenticationMethod = this.requiresUsernamePasswordAuthentication ? AuthenticationMethod.USERNAME_PASSWORD : data[2];

        const responseBytes: number[] = [version, this.authenticationMethod];

        this.clientSocket.write(Buffer.from(responseBytes));

        this.greetingResponseSent = true;
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

    protected sendConnectionResponse(addressType: number, connectionStatus: ConnectionStatus, ipAddressBytes: number[], portBytes: number[], version: number): void {
        const responseBytes: number[] = [version, connectionStatus, 0x00, addressType].concat(ipAddressBytes).concat(portBytes);

        if (this.clientSocket) {
            this.clientSocket.write(Buffer.from(responseBytes));
            this.connectionResponseSent = true;
        }
    }

}
