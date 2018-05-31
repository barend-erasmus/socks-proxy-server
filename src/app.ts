import * as commander from 'commander';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { install } from './scripts/install';
import { start } from './scripts/start';

commander
    .command('install')
    .action((command: any) => {
        install();
    });

commander
    .command('start')
    .option('-c --config <config>', 'Config')
    .option('-h --hostname <hostname>', 'Hostname')
    .option('-l --log <log>', 'Log')
    .option('-p --port <port>', 'Port')
    .action((command: any) => {
        if (command.config) {
            const yamlContents: string = fs.readFileSync(command.config, 'utf8');

            const yamlConfig: any = yaml.safeLoad(yamlContents);

            start(
                yamlConfig.allow,
                yamlConfig.deny,
                yamlConfig.hostname,
                yamlConfig.log,
                yamlConfig.port ? yamlConfig.port : null,
                yamlConfig.requiresUsernamePasswordAuthentication,
                yamlConfig.userNamePasswordPairs,
            );
        } else {
            start(
                null,
                null,
                command.hostname,
                command.log,
                command.port ? parseInt(command.port, 10) : null,
                false,
                null);
        }
    });

commander.parse(process.argv);
