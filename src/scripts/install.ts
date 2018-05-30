import * as fs from 'fs';

export function install(): void {
    fs.writeFileSync('/lib/systemd/system/socks-proxy-server.service', `
[Unit]
Description=SOCKS Proxy Server written in node.js
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/socks-proxy-server start --log /var/log/socks-proxy-server
Restart=on-failure

[Install]
WantedBy=multi-user.target
`);
}
