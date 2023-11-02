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
    
    public isImage(attributeName: string, value: string): boolean {
        // Check if the attribute name suggests it is an image
        if (attributeName.toLowerCase().includes('image')) {
          // Check if the value is a URL ending with an image extension
          return /\.(png|jpe?g|gif|svg)$/i.test(value);
        }
        return false;
    }

    public isCurrentTaskType(typedoc, typeslist) {
        let same_type
        
        if(typeslist){
            if(typeslist==true || typeslist.includes(typedoc))
                same_type = true
            else
                same_type = false
        }
        else{
            if(typeslist==false)
                same_type = false
            else
                same_type = true
        }
        
        return same_type
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
                currentConfiguration["notes"] = notes
                    ? notes[goldDocument.index]
                    : [];
                goldConfiguration.push(currentConfiguration);
            }
        }

        return goldConfiguration;
    }

}
