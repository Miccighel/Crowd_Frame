import {Component, Input, OnInit} from '@angular/core';
import {FormControl} from "@angular/forms";
import {UtilsService} from "../../../services/utils.service";

@Component({
    selector: 'app-error-message',
    templateUrl: './error-message.component.html',
    styleUrls: ['./error-message.component.scss']
})
export class ErrorMessageComponent implements OnInit {

    public utilsService: UtilsService

    @Input() formField: FormControl

    constructor(
        utilsService: UtilsService
    ) {
        this.utilsService = utilsService
    }

    ngOnInit(): void {
    }

}
