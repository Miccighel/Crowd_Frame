import { CategoricalInfo } from "src/app/models/conversational/common.model";

export default class ChatHelper {
    // Controllo che un messaggio abbia valori compresi tra min e max e che sia un numero
    static validMsg(msg, min, max = null): boolean {
        if (max == null) {
            if (isNaN(+msg) || +msg % 1 != 0 || +msg < min) return false;
        } else if (isNaN(+msg) || +msg % 1 != 0 || +msg < min || +msg > max) {
            return false;
        }
        return true;
    }

    //Validazione dell'URL inserito
    static urlValid(msg): boolean {
        let pattern = new RegExp(
            "^(https?:\\/\\/)?" + // protocol
                "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
                "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
                "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
                "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
                "(\\#[-a-z\\d_]*)?$",
            "i"
        ); // fragment locator
        return !!pattern.test(msg);
    }

    //Resistuiscono il valore minimo e massimo all'interno dell'array di oggetti passato
    static getCategoricalMinInfo(objects: CategoricalInfo[]): number {
        return +objects.reduce(function (prev, curr) {
            return +prev.value < +curr.value ? prev : curr;
        }).value;
    }
    static getCategoricalMaxInfo(objects: CategoricalInfo[]): number {
        return +objects.reduce(function (prev, curr) {
            return +prev.value > +curr.value ? prev : curr;
        }).value;
    }

    static rand(max: number) {
        return Math.floor(Math.random() * max);
    }
    static getRandomMessage(
        randomMessagesFirstPart: string[],
        randomMessagesSecondPart: string[]
    ) {
        return (
            randomMessagesFirstPart[this.rand(randomMessagesFirstPart.length)] +
            " " +
            randomMessagesSecondPart[this.rand(randomMessagesSecondPart.length)]
        );
    }
}
