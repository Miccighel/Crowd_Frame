import {ChangeDetectorRef, Component, Input, OnInit, SimpleChanges} from '@angular/core';
import {DeviceDetectorService} from "ngx-device-detector";
import {SectionService} from "../../../../services/section.service";
import {UtilsService} from "../../../../services/utils.service";
import {Task} from "../../../../models/task";
import {Object} from "aws-sdk/clients/customerprofiles";

@Component({
    selector: 'app-element-pointwise',
    templateUrl: './element-pointwise.component.html',
    styleUrls: ['./element-pointwise.component.scss', '../../skeleton.shared.component.scss']
})
export class ElementPointwiseComponent {

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to detect user's device */
    deviceDetectorService: DeviceDetectorService;
    sectionService: SectionService;
    utilsService: UtilsService

    @Input() task: Task
    @Input() documentIndex: number

    checkedValue = [];

    constructor(
        changeDetector: ChangeDetectorRef,
        deviceDetectorService: DeviceDetectorService,
        sectionService: SectionService,
        utilsService: UtilsService
    ) {
        this.changeDetector = changeDetector
        this.deviceDetectorService = deviceDetectorService
        this.sectionService = sectionService
        this.utilsService = utilsService
    }

    /*
    //@AggiunteAbbondo
      Funziona che cambia il colore del div dello statemente

      this.checkedValue[documentnumber][0][0]=true mette al true la prima dimension cosi da venire visuallizata
    */
    public changeColor(valueData: Object, documentnumber: number) {
        //this.selected_statement=valueData["value"]
        //this.selected_stetements[documentnumber]=valueData["value"];
        let a = document.getElementById("StatementA." + documentnumber) as HTMLInputElement
        let b = document.getElementById("StatementB." + documentnumber) as HTMLInputElement
        if (valueData["value"] == "A") {
            a.style.backgroundColor = "#B6BDE2"
            b.style.backgroundColor = "#FCFCFC"
        } else if (valueData["value"] == "B") {
            b.style.backgroundColor = "#B6BDE2"
            a.style.backgroundColor = "#FCFCFC"
        } else {
            b.style.backgroundColor = "#B6BDE2"
            a.style.backgroundColor = "#B6BDE2"
        }


        if (valueData['source']['_checked'] == true) {

            // mette al true la prima dimension del primo documento cosi da venire visualizzata
            this.checkedValue[documentnumber][0][0] = true
            this.checkedValue[documentnumber][0][1] = true
        }
    }

}
