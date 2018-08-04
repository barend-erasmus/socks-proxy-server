import { SOCKSProxyAuthenticationMethod } from './socks-proxy-authentication-method';

export class SOCKSProxyState {

    constructor(
        public authenticationMethod: SOCKSProxyAuthenticationMethod,
        public authenticationResponseSent: boolean,
        public connectionResponseSent: boolean,
        public destinationHostname: string,
        public destinationPort: number,
        public greetingResponseSent: boolean,
    ) {

    }

}
