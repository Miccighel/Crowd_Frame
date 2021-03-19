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
        debounceTime(1000),
        map((event: MouseEvent) => ({timeStamp: event.timeStamp, x: event.x, y: event.y, buttonName: event.target['innerText'].toUpperCase().trim()}))
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
        buffer(mouseMoveEvent.pipe(debounceTime(500))),
        filter(array => array.length > 1)
      )
      .subscribe(positionBuffer => this.actionLogger.mouseMove(positionBuffer))

    /*
     * MOUSE CLICK
     * Debounce time was introduced to prevent click spamming
     */
    fromEvent(this.element.nativeElement, 'click')
      .pipe(
        tap((event: MouseEvent) => event.stopPropagation()),
        map((event: MouseEvent) => ({timeStamp: event.timeStamp, x: event.clientX, y: event.clientY, target: event.target})),
        debounceTime(300)
      )
      .subscribe(obj => this.actionLogger.windowClick(obj))

    /* ------- DOCUMENT EVENTS ------- */

    /*
     * FOCUS
     * Listener for window focus and blur
     */
    fromEvent(window, 'focus')
      .pipe(map((event: Event) => ({timeStamp: event.timeStamp})))
      .subscribe(obj => this.actionLogger.windowFocus(obj))
    fromEvent(window, 'blur')
      .pipe(map((event: Event) => ({timeStamp: event.timeStamp})))
      .subscribe(obj => this.actionLogger.windowBlur(obj))

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
      .pipe(
        debounceTime(500),
        map((event: Event) => ({timeStamp: event.timeStamp}))
      )
      .subscribe((obj) => this.actionLogger.windowResize(obj))

    /*
     * SELECTION
     * Listen to text selection
     */
    fromEvent(document, 'selectstart')
      .pipe(map((event: Event) => ({timeStamp: event.timeStamp, possibleTarget: event.target['data']})))
      .subscribe((obj) => this.actionLogger.onSelect(obj))

    /* ------- CLIPBOARD EVENTS ------- */
    /*
     * COPY
     * Listen to copy event, can't get clipboard content
     */
    fromEvent(this.element.nativeElement, 'copy')
      .pipe(map((event: Event) => ({timeStamp: event.timeStamp, target: event.target})))
      .subscribe(obj => this.actionLogger.onCopy(obj))

    /*
     * CUT
     * Listen to cut event, can't get clipboard content
     */
    fromEvent(this.element.nativeElement, 'cut')
      .pipe(map((event: Event) => ({timeStamp: event.timeStamp, target: event.target})))
      .subscribe(obj => this.actionLogger.onCopy(obj))
  }
}

@Directive({selector: 'input'})
export class InputDirective implements AfterViewInit {
  constructor(private actionLogger: ActionLogger, private element: ElementRef) {}

  ngAfterViewInit() {
    /*
     * Listen to a paste event on input area and get pasted text
     */
    fromEvent(this.element.nativeElement, 'paste')
      .pipe(map((event: ClipboardEvent) => ({timeStamp: event.timeStamp, text: event.clipboardData.getData('text')})))
      .subscribe(obj => this.actionLogger.onPaste(obj))

    /*
     * When user delete something on the text area or press Enter, the event handler log what has written
     */
    fromEvent(this.element.nativeElement, 'keydown')
      .pipe(
        filter((event: KeyboardEvent) => event.key === 'Backspace' || event.key === 'Enter'),
        throttleTime(5000),
        map((event: KeyboardEvent) => ({timeStamp: event.timeStamp, target: event.target['value']}))
      )
      .subscribe((obj) => this.actionLogger.textLog(obj))

    fromEvent(this.element.nativeElement, 'blur')
      .pipe(map((event: Event) => ({timeStamp: event.timeStamp, target: event.target['value']})))
      .subscribe((obj) => this.actionLogger.textLog(obj))


  }
}

@Directive({selector: "mat-radio-group"})
export class RadioDirective implements AfterViewInit {
  constructor(private actionLogger: ActionLogger, private element: ElementRef) {}

  ngAfterViewInit() {
    /*
     *  When user change radio value on a group, log the new value
     */
    fromEvent(this.element.nativeElement, 'input')
      .pipe(map((event: InputEvent) => ({timeStamp: event.timeStamp, group: event.target['name'], value: event.target['value']})))
      .subscribe(obj => this.actionLogger.radioChange(obj))
  }
}

//TODO window focus
//TODO document unload
//TODO distinzione tra click
//TODO monitor dei shortcut
//TODO keystroke number
//TODO contenuto del copy e cut
//TODO reverse lookup ip
//TODO verifica della safe mode
//TODO informazioni sulla connessione
