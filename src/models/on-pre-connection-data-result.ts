export class OnPreConnectionDataResult {

    constructor(
        public connect: boolean,
        public destinationHostname: string,
        public destinationPort: number,
    ) {

    }

}
