import { CategoricalInfo } from "src/app/models/conversational/common.model";
import { Questionnaire } from "src/app/models/skeleton/questionnaires/questionnaire";

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
        let pattern = new RegExp("/^(https?:\/\/)?" + /* Protocol */
            "(?:((\w(?:\w|-)*\.)+\w{2,})|" + /* Domain name */
            "((\d{1,3}\.){3}\d{1,3}))" + /* Or, IP (v4) address */
            "(?::\d+)?(\/[-\w\d%_.~+]*)*" + /* Port and path */
            "(\?[;&\w%_.~+=-]*)?" + /* Query string */
            "(#\w*)?$/i;"
        ); /* Fragment locator */
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

    static getTotalElements(parent: any[], child: string): number {
        let numberOfElements = 0;
        parent.forEach((el) => {
            numberOfElements += +el[child].length;
        });
        return numberOfElements;
    }

    static getTimeStampInSeconds() {
        return Date.now() / 1000;
    }

    static getUid() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    static capitalize(word: string) {
        if (!word) return word;
        let text = word.split("-")
        let str = ""
        for (word of text) str = str + " " + word[0].toUpperCase() + word.substr(1).toLowerCase();
        return str.trim()
    }
}
