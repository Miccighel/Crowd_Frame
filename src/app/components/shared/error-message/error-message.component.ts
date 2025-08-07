import {Component, Input, OnInit} from '@angular/core';
import {AbstractControl} from "@angular/forms";
import {UtilsService} from "../../../services/utils.service";

@Component({
    selector: 'app-error-message',
    templateUrl: './error-message.component.html',
    styleUrls: ['./error-message.component.scss'],
    standalone: false
})
export class ErrorMessageComponent implements OnInit {

    public utilsService: UtilsService

    @Input() formField: AbstractControl

    constructor(
        utilsService: UtilsService
    ) {
        this.utilsService = utilsService
    }

    ngOnInit(): void {
    }

}
