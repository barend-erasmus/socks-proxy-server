import * as commander from 'commander';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { start } from './start';

commander
    .command('start')
    .option('-c --config <config>', 'Config')
    .option('-h --hostname <hostname>', 'Hostname')
    .option('-p --port <port>', 'Port')
    .action((command: any) => {
        if (command.config) {
            const yamlContents: string = fs.readFileSync(command.config, 'utf8');

            const yamlConfig: any = yaml.safeLoad(yamlContents);

            start(
                yamlConfig.allow,
                yamlConfig.deny,
                yamlConfig.hostname,
                yamlConfig.port ? yamlConfig.port : null,
                yamlConfig.requiresUsernamePasswordAuthentication,
                yamlConfig.userNamePasswordPairs,
            );
        } else {
            start(
                null,
                null,
                command.hostname,
                command.port ? parseInt(command.port, 10) : null,
                false,
                null);
        }
    });

commander.parse(process.argv);
