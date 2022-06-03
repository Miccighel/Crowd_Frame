import {Injectable} from "@angular/core";
import {AbstractControl, FormArray, UntypedFormControl, UntypedFormGroup} from "@angular/forms";
import CryptoES from "crypto-es";
import kdf = CryptoES.kdf;

@Injectable({
    providedIn: 'root',
})

export class UtilsService {

    public hasError(form: UntypedFormGroup, field: string, key: string): boolean {
        let control = form.get(field)
        if (control) {
            return control.hasError(key)
        } else {
            return false
        }
    }

    public getErrorMessage(field: AbstractControl) {
        let messages = []
        if(field.errors) {
            for (let errorKey of Object.keys(field.errors)) {
                let message = ''
                switch (errorKey) {
                    case 'min':
                        message = `Min value required: ${field.errors[errorKey][errorKey]}`
                        break;
                    case 'max':
                        message = `Max value required: ${field.errors[errorKey][errorKey]}`
                        break;
                    case 'required':
                        message = "This field is required"
                        break;
                    case 'pattern':
                        message = `This field must not contain special characters`
                        break;
                    case 'invalid':
                        message = `This field is invalid`
                        break;
                    case 'email':
                        message = `This field must contain a valid email address`
                        break;
                    default:
                        message = field.errors[errorKey]
                        break;
                }
                messages.push(message)
            }
        }
        return messages
    }


    public capitalize(word: string) {
        if (!word) return word;
        let text = word.split("-")
        let str = ""
        for (word of text) str = str + " " + word[0].toUpperCase() + word.substr(1).toLowerCase();
        return str.trim()
    }

    public getSelectionCharacterOffsetWithin(element) {
        let start = 0;
        let end = 0;
        let doc = element.ownerDocument || element.document;
        let win = doc.defaultView || doc.parentWindow;
        let sel;
        if (typeof win.getSelection != "undefined") {
            sel = win.getSelection();
            if (sel.rangeCount > 0) {
                let range = win.getSelection().getRangeAt(0);
                let preCaretRange = range.cloneRange();
                preCaretRange.selectNodeContents(element);
                preCaretRange.setEnd(range.startContainer, range.startOffset);
                start = preCaretRange.toString().length;
                preCaretRange.setEnd(range.endContainer, range.endOffset);
                end = preCaretRange.toString().length;
            }
        } else if ((sel = doc.selection) && sel.type != "Control") {
            let textRange = sel.createRange();
            let preCaretTextRange = doc.body.createTextRange();
            preCaretTextRange.moveToElementText(element);
            preCaretTextRange.setEndPoint("EndToStart", textRange);
            start = preCaretTextRange.text.length;
            preCaretTextRange.setEndPoint("EndToEnd", textRange);
            end = preCaretTextRange.text.length;
        }
        return {start: start, end: end};
    }

    public positiveOrZeroNumber(control: UntypedFormControl) {
        if (Number(control.value) < 0) {
            return {invalid: true};
        } else {
            return null;
        }
    }

    public positiveNumber(control: UntypedFormControl) {
        if (Number(control.value) < 1) {
            return {invalid: true};
        } else {
            return null;
        }
    }

    public randomIdentifier(length) {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }


}
