import * as winston from 'winston';

export class Statistics {

    protected lastLogTimestamp: Date = null;

    protected totalNumberOfBytesReceived: number = 0;

    protected totalNumberOfBytesSent: number = 0;

    constructor(protected enableLog: boolean) {

    }

    public incrementReceived(n: number): void {
        this.totalNumberOfBytesReceived += n;

        if (this.enableLog) {
            this.log();
        }
    }

    public incrementSent(n: number): void {
        this.totalNumberOfBytesSent += n;

        if (this.enableLog) {
            this.log();
        }
    }

    protected log(): void {
        if (!this.lastLogTimestamp || new Date().getTime() - this.lastLogTimestamp.getTime() > 25000) {
            winston.info(`Statistics`, {
                totalNumberOfBytesReceived: this.totalNumberOfBytesReceived,
                totalNumberOfBytesSent: this.totalNumberOfBytesSent,
            });

            this.lastLogTimestamp = new Date();
        }
    }

}
