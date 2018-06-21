import 'winston-daily-rotate-file';
import { IProxyServer } from '../interfaces/proxy-server';
import { SOCKSProxyServer } from '../socks-proxy-server';

export function start(
    allowedIPAddresses: string[],
    deniedIPAddresses: string[],
    hostname: string,
    log: string,
    port: number,
    requiresUserNamePasswordAuthentication: boolean,
    userNamePasswordPairs: string[][],
) {

    const proxyServer: IProxyServer = new SOCKSProxyServer((password: string, userName: string) => {
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
    },
        allowedIPAddresses,
        deniedIPAddresses,
        hostname,
        log,
        port,
        requiresUserNamePasswordAuthentication,
    );

    proxyServer.listen();
}
