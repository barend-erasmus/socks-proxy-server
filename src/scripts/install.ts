import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as readline from 'readline';

const readlineInterface: readline.ReadLine = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

export async function install(): Promise<void> {
    const allow: string = await prompt('Allowed IP Addresses: (NONE): ');

    const deny: string = await prompt('Denied IP Addresses: (NONE): ');

    const hostname: string = await prompt('Hostname: (0.0.0.0): ');

    const log: string = await prompt('Log: (/var/log/socks-proxy-server) ');

    const port: string = await prompt('Port: (1337): ');

    const requiresUsernamePasswordAuthentication: string = await prompt('Requires User Name/Password Autentication: (NO) ');

    const userNamePasswordPairs: string = await prompt('User Name/Password Pairs: (NONE)');

    readlineInterface.close();

    const configuration: any = {
        allow: allow ? allow.split(',') : null,
        deny: deny ? deny.split(',') : null,
        hostname: hostname || '0.0.0.0',
        log: log || '/var/log/socks-proxy-server',
        port: port ? parseInt(port, 10) : 1337,
        requiresUsernamePasswordAuthentication: requiresUsernamePasswordAuthentication ? (requiresUsernamePasswordAuthentication === 'YES' ? true : requiresUsernamePasswordAuthentication === 'NO' ? false : false) : false,
        userNamePasswordPairs: userNamePasswordPairs ? userNamePasswordPairs.split(',').map((x: string) => x.split('|')) : null,
    };

    const yamlConfig: string = yaml.safeDump(configuration);

    if (!fs.existsSync('/etc/socks-proxy-server')) {
        fs.mkdirSync('/etc/socks-proxy-server');
    }

    if (fs.existsSync('/etc/socks-proxy-server/config.yaml')) {
        fs.unlinkSync('/etc/socks-proxy-server/config.yaml');
    }

    fs.writeFileSync('/etc/socks-proxy-server/config.yaml', yamlConfig);

    writeServiceFile();
}

async function prompt(question: string): Promise<string> {
    return new Promise<string>((resolve: (answer: string) => void, reject: (error: Error) => void) => {
        readlineInterface.question(question, (answer: string) => {
            resolve(answer);
        });
    });
}

function writeServiceFile(): void {
    if (fs.existsSync('/lib/systemd/system/socks-proxy-server.service')) {
        fs.unlinkSync('/lib/systemd/system/socks-proxy-server.service');
    }

    fs.writeFileSync('/lib/systemd/system/socks-proxy-server.service', `
[Unit]
Description=SOCKS Proxy Server written in node.js
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/socks-proxy-server start --config /etc/socks-proxy-server/config.yaml
Restart=on-failure

[Install]
WantedBy=multi-user.target
`);
}
