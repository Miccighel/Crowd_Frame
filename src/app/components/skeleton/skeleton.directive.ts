import {AfterViewInit, Directive, ElementRef, HostListener,} from "@angular/core";
import {ActionLogger} from "../../services/userActionLogger.service";
import {fromEvent} from "rxjs";
import {buffer, debounceTime, filter, map, tap, throttleTime} from "rxjs/operators";

@Directive({selector: "button"})
export class ButtonDirective {
  constructor(private actionLogger: ActionLogger, private element: ElementRef) {}

  ngAfterViewInit() {
    /* ------- MOUSE CLICK ON BUTTON ------- */
    // Debounce time was introduced to prevent click spamming on the Start button in token section
    fromEvent(this.element.nativeElement, 'click')
      .pipe(
        tap((event: Event) => event.stopPropagation()),
        debounceTime(1000)
      )
      .subscribe(event => this.actionLogger.buttonClick(event))
  }
}


@Directive({selector: "app-skeleton"})
export class SkeletonDirective implements AfterViewInit{
  constructor(private actionLogger: ActionLogger, private element: ElementRef) {}

  ngAfterViewInit() {
    /* ------- MOUSE EVENTS ------- */
    /*
     * MOUSE MOVE
     * Mouse movements are limited to one each 100ms
     * From each event only cursor position is kept
     * All events are buffered until mouse stops for at least 500ms
     */
    const mouseMoveEvent = fromEvent(this.element.nativeElement, 'mousemove')
    mouseMoveEvent
      .pipe(
        throttleTime(100),
        map((event: MouseEvent) => ({timeStamp: event.timeStamp, x: event.clientX, y: event.clientY})),
        buffer(mouseMoveEvent.pipe(debounceTime(500)))
      )
      .subscribe(positionBuffer => this.actionLogger.mouseMove(positionBuffer))

    /*
     * MOUSE CLICK
     * Debounce time was introduced to prevent click spamming
     */
    fromEvent(this.element.nativeElement, 'click')
      .pipe(
        tap((event: MouseEvent) => event.stopPropagation()),
        map((event: MouseEvent) => ({timeStamp: event.timeStamp, x: event.clientX, y: event.clientY})),
        debounceTime(300)
      )
      .subscribe(obj => this.actionLogger.windowClick(obj))

    /* ------- DOCUMENT EVENTS ------- */
    /*
     * SCROLL
     * This listener throttles and debounce the scroll event passing to the logger the first scroll event time and last one
     */
    let scrollEvent = fromEvent(document, 'scroll')
    let firstScroll = true;
    let init = 0;
    scrollEvent
      .pipe(
        tap((event: Event) => {
          if (firstScroll){
            init = event.timeStamp;
            firstScroll = false;
          }
        }),
        throttleTime(100),
        map((event: Event) => ({endTimeStamp: event.timeStamp})),
        debounceTime(300))
      .subscribe((obj) => {
        obj['startTimeStamp'] = init;
        this.actionLogger.onScroll(obj);
        firstScroll = true;
      })

    /*
     * RESIZE
     * Listening on window resize, introduced a debounce time to trigger just one call to the log each resize
     */
    fromEvent(window, 'resize')
      .pipe(debounceTime(500))
      .subscribe(() => this.actionLogger.onResize())

    /* ------- CLIPBOARD EVENTS ------- */
    fromEvent(this.element.nativeElement, 'copy')
      .subscribe(event => this.actionLogger.onCopy(event))
  }
}

@Directive({selector: 'input'})
export class InputDirective implements AfterViewInit {
  constructor(private actionLogger: ActionLogger, private element: ElementRef) {}

  ngAfterViewInit() {
    fromEvent(this.element.nativeElement, 'paste')
      .subscribe(event => this.actionLogger.onPaste(event))

    fromEvent(this.element.nativeElement, 'keydown')
      .pipe(
        filter((event: KeyboardEvent) => event.key === 'Backspace'),
        throttleTime(5000)
      )
      .subscribe((event: Event) => this.actionLogger.onInput(event))
  }
}

@Directive({selector: "mat-radio-group"})
export class RadioDirective implements AfterViewInit {
  constructor(private actionLogger: ActionLogger, private element: ElementRef) {}

  @HostListener('change', ['$event'])
  onChange(event){
    console.log(event)
  }

  ngAfterViewInit() {
    fromEvent(this.element.nativeElement, 'change')
      .subscribe(event => console.log(event))
  }
}
