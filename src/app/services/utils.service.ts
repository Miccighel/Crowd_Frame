import {Injectable} from "@angular/core";
import {AbstractControl, UntypedFormControl, UntypedFormGroup, ValidationErrors, ValidatorFn} from "@angular/forms";

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
        return word.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
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

    public numberGreaterThanWithCommasAsDecimals(minValue: number): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            let pattern = /^[+-]?(\d{1,3}([.,]\d{3})*([.,]\d+)?|\d*[.,]\d+|\d+)$/;
            const isValidFormat = pattern.test(control.value);
            if (!isValidFormat)
                return {numberFormat: true};
            const numericValue = +control.value.replace(/[^\d.-]/g, ''); // Extract numeric value
            if (numericValue > minValue)
                return null
            else
                return {numberGreaterThan: true}
        };
    }

    public positiveNumber(control: UntypedFormControl) {
        const value = Number(control.value);

        if (isNaN(value) || value < 1)
            return { invalid: true };
        return null;
    }

    public randomIdentifier(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        let result = '';
        for (let i = 0; i < length; i++)
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        return result;
    }

    public generateGoldConfiguration(goldDocuments, goldDimensions, documentsForm, notes) {
        let goldConfiguration = [];

        /* For each gold document its attribute, answers and notes are retrieved to build a gold configuration */
        for (let goldDocument of goldDocuments) {
            if(goldDocument.index<documentsForm.length){
                let currentConfiguration = {};
                currentConfiguration["document"] = goldDocument;
                let answers = {};
                for (let goldDimension of goldDimensions) {
                    for (let [attribute, value] of Object.entries(
                        documentsForm[goldDocument.index].value
                    )) {
                        let dimensionName = attribute.split("_")[0];
                        if (dimensionName == goldDimension.name) {
                            answers[attribute] = value;
                        }
                    }
                }
                currentConfiguration["answers"] = answers;
                currentConfiguration["notes"] = notes ? notes[goldDocument.index] : [];
                goldConfiguration.push(currentConfiguration);
            }
        }

        return goldConfiguration;
    }

    /* This function is used to wait for a full initialization of the body, before deserializing the previous highlights */
    public waitForElementInitialization(selector: string) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }
            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    public getValueByKeyIgnoreCase(obj: Object, key) {
        const foundKey = Object.keys(obj).find((k) => k.toLowerCase() == key.toLowerCase())
        return foundKey ? obj[foundKey] : undefined;
    }
}
