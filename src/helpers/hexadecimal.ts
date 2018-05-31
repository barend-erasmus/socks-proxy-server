export class HexadecimalHelper {

    public static toDecimal(arr: number[]): number {
        let result: number = null;

        for (let index = 0; index < arr.length; index ++) {
            if (!result) {
                result = arr[index] * Math.pow(256, arr.length - index - 1);
                continue;
            }

            result += arr[index] * Math.pow(256, arr.length - index - 1);
        }

        return result;
    }

}
