import * as commander from 'commander';
import { install } from './scripts/install';
import { start } from './scripts/start';

commander
    .command('install')
    .action((command: any) => {
        install();
    });

commander
    .command('start')
    .option('-h --hostname <hostname>', 'Hostname')
    .option('-l --log <log>', 'Log')
    .option('-p --port <port>', 'Port')
    .action((command: any) => {
        start(command.hostname, command.log, command.port ? parseInt(command.port, 10) : null);
    });

commander.parse(process.argv);
