import * as dns from 'dns';
import * as net from 'net';
import { AddressType } from './enums/address-type';
import { AuthenticationMethod } from './enums/authentication-method';
import { CommandCode } from './enums/command-code';
import { ConnectionStatus } from './enums/connection-status';
import { Version } from './enums/version';
import { HexadecimalHelper } from './helpers/hexadecimal';

export class Connection {

    protected connected: boolean = false;

    protected connectionResponseSent: boolean = false;

    protected destinationSocket: net.Socket = null;

    protected geetingResponseSent: boolean = false;

    constructor(protected socket: net.Socket) {
        this.socket.on('close', () => {
            if (this.socket) {
                this.socket.destroy();
                this.socket = null;
            }

            if (this.destinationSocket) {
                this.destinationSocket.destroy();
                this.destinationSocket = null;
            }
        });

        this.socket.on('data', (data: Buffer) => {
            this.onData(data);
        });

        this.socket.on('error', (error: Error) => {

        });
    }

    public onData(data: Buffer): void {
        if (!this.geetingResponseSent) {
            this.handleGreetingRequest(data);
            return;
        }

        if (!this.connectionResponseSent) {
            this.handleConnectionRequest(data);
            return;
        }

        if (this.destinationSocket && this.connected) {
            this.destinationSocket.write(data);
        }
    }

    protected connectTCPIPStream(addressType: number, ipAddress: string, ipAddressBytes: number[], port: number, portBytes: number[], version: number): void {
        this.destinationSocket = new net.Socket();

        this.destinationSocket.connect(port, ipAddress, (error: Error) => {
            if (error) {
                console.log(error);
            }

            this.connected = true;

            this.sendConnectionResponse(addressType, ipAddressBytes, portBytes, version);
        });

        this.destinationSocket.on('close', () => {
            if (this.destinationSocket) {
                this.destinationSocket.destroy();
                this.destinationSocket = null;
            }

            if (this.socket) {
                this.socket.destroy();
                this.socket = null;
            }
        });

        this.destinationSocket.on('data', (data: Buffer) => {
            if (this.socket) {
                this.socket.write(data);
            }
        });

        this.destinationSocket.on('error', (error: Error) => {

        });
    }

    protected async handleConnectionRequest(data: Buffer): Promise<void> {
        const version: number = data[0];

        if (version !== Version.VERSION_5) {
            console.log(`Unsupported Version`);
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

            ipAddress = await this.resolveDomainName(domainName);

            portBytes = [data[5 + domainNameLength], data[5 + domainNameLength + 1]];
            port = HexadecimalHelper.toDecimal(portBytes);
        } else if (addressType === AddressType.IPv4) {
            ipAddressBytes = [data[4], data[5], data[6], data[7]];
            ipAddress = `${ipAddressBytes[0]}.${ipAddressBytes[1]}.${ipAddressBytes[2]}.${ipAddressBytes[3]}`;

            portBytes = [data[8], data[9]];
            port = HexadecimalHelper.toDecimal(portBytes);
        } else if (addressType === AddressType.IPv6) {
            console.log(`Unsupported Address Type of '${addressType}'`);
            return;
        }

        switch (commandCode) {
            case CommandCode.TCPIP_PORT_CONNECTION:
                console.log(`Connect with TCPIP Port Connection`);
                break;
            case CommandCode.TCPIP_STREAM_CONNECTION:
                this.connectTCPIPStream(addressType, ipAddress, ipAddressBytes, port, portBytes, version);
                break;
            case CommandCode.UDP_PORT:
                console.log(`Connect with UDP Port Connection`);
                break;
            default:
                console.log(`Unsupported Command Code`);
                return;
        }

        console.log(`Version: ${version}`);
        console.log(`Command Code: ${commandCode}`);
        console.log(`Address Type: ${addressType}`);
        console.log(`IP Address: ${ipAddress}`);
        console.log(`Port: ${port}`);
    }

    protected handleGreetingRequest(data: Buffer): void {
        const version: number = data[0];

        if (version !== Version.VERSION_5) {
            console.log(`Unsupported Version`);
            return;
        }

        const authenticationMethod: number = data[1];

        const authenticationMethodVariableLength: number = data[2];

        const responseBytes: number[] = [version, AuthenticationMethod.NONE];

        this.socket.write(Buffer.from(responseBytes));

        this.geetingResponseSent = true;
    }

    protected resolveDomainName(domainName: string): Promise<string> {
        return new Promise((resolve: (ipAddress: string) => void, reject: (error: Error) => void) => {
            dns.resolve(domainName, (error: Error, addresses: string[]) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(addresses[0]);
            });
        });
    }

    protected sendConnectionResponse(addressType: number, ipAddressBytes: number[], portBytes: number[], version: number): void {
        const responseBytes: number[] = [version, ConnectionStatus.GRANTED, 0x00, addressType].concat(ipAddressBytes).concat(portBytes);

        this.socket.write(Buffer.from(responseBytes));

        this.connectionResponseSent = true;
    }

}
