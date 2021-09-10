import {AfterViewInit, Directive, ElementRef} from "@angular/core";
import {ActionLogger} from "../../services/userActionLogger.service";
import {fromEvent} from "rxjs";
import {buffer, concatMap, debounceTime, filter, map, tap, throttleTime, take} from "rxjs/operators";

@Directive({selector: "button"})
export class ButtonDirective {
  constructor(private actionLogger: ActionLogger, private element: ElementRef) {}

  ngAfterViewInit() {
    if(this.actionLogger.isActive) {
      if (this.actionLogger.opt['button']['click']) {
        /* ------- MOUSE CLICK ON BUTTON ------- */
        // Debounce time was introduced to prevent click spamming on the Start button in token section
        fromEvent(this.element.nativeElement, 'click')
          .pipe(
            tap((event: Event) => event.stopPropagation()),
            debounceTime(1000),
            map((event: MouseEvent) => ({
              timeStamp: event.timeStamp,
              x: event.x,
              y: event.y,
              buttonName: event.target['innerText'].toUpperCase().trim()
            }))
          )
          .subscribe(event => this.actionLogger.buttonClick(event))
      }
    }
  }
}


@Directive({selector: "app-skeleton"})
export class SkeletonDirective implements AfterViewInit{
  constructor(private actionLogger: ActionLogger, private element: ElementRef) {}

  ngAfterViewInit() {
    if(this.actionLogger.isActive) {
      /* ------- MOUSE EVENTS ------- */
      if (this.actionLogger.opt['mouse']['mousemove']) {
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
            map((event: MouseEvent) => ({
              timeStamp: event.timeStamp,
              x: event.clientX,
              y: event.clientY,
              target: {
                elementName: event['target']['localName'],
                className: event['target']['className']
              }
            })),
            buffer(mouseMoveEvent.pipe(debounceTime(500))),
            filter(array => array.length > 1)
          )
          .subscribe(positionBuffer => this.actionLogger.mouseMove(positionBuffer))
      }

      if (this.actionLogger.opt['mouse']['leftClicks']) {
        /*
         * LEFT MOUSE CLICK
         * Debounce time was introduced to prevent click spamming
         */
        let clicks = 0
        let firstClickTime = 0
        fromEvent(this.element.nativeElement, 'click')
          .pipe(
            tap((event: MouseEvent) => {
              event.stopPropagation();
              if (clicks === 0) {
                firstClickTime = event.timeStamp
              }
              clicks++
            }),
            debounceTime(500),
            map((event: MouseEvent) => ({
              startTime: firstClickTime,
              endTime: event.timeStamp,
              x: event.clientX,
              y: event.clientY,
              target: {
                elementName: event['target']['localName'],
                className: event['target']['className']
              },
              mouseButton: 'left',
              clicks: clicks
            }))
          )
          .subscribe(obj => {
            this.actionLogger.windowClick(obj)
            clicks = 0
          })
      }

      if (this.actionLogger.opt['mouse']['rightClicks']) {
        /*
         * RIGHT MOUSE CLICK
         */
        fromEvent(this.element.nativeElement, 'contextmenu')
          .pipe(map((event: MouseEvent) => ({
            startTime: event.timeStamp,
            endTime: event.timeStamp,
            x: event.clientX,
            y: event.clientY,
            target: {
              elementName: event['target']['localName'],
              className: event['target']['className']
            },
            mouseButton: 'right',
            clicks: 1
          })))
          .subscribe(obj => {
            this.actionLogger.windowClick(obj)
          })
      }

      /* ------- KEYBOARD EVENTS ------- */

      if (this.actionLogger.opt['keyboard']['shortcuts']) {
        /*
         * SHORTCUT LISTENER
         */
        fromEvent(document, 'keyup')
          .pipe(
            filter((event: Event) =>
              event['key'] != 'Control' &&
              event['key'] != 'Shift' &&
              (event['ctrlKey'] == true || (event['ctrlKey'] == true && event['altKey'] == true))
            ),
            map((event: Event) => ({
              timeStamp: event.timeStamp,
              ctrl: event['ctrlKey'],
              alt: event['altKey'],
              key: event['key']
            }))
          )
          .subscribe(obj => this.actionLogger.shortcut(obj))

        /*
         * APPLE FIX FOR SHORTCUT LISTENER
         */
        fromEvent(document, 'keydown')
          .pipe(
            filter((event: Event) => event['metaKey'] && event['key'] != 'Meta'),
            debounceTime(200),
            map((event: Event) => ({
              timeStamp: event.timeStamp,
              ctrl: event['metaKey'],
              alt: event['altKey'],
              key: event['key']
            }))
          )
          .subscribe(obj => this.actionLogger.shortcut(obj))
      }

      if (this.actionLogger.opt['keyboard']['keys']) {
        /*
         * KEY PRESS
         */
        let keyEvent = fromEvent(document, 'keyup')
        let sentence = ""
        keyEvent
          .pipe(
            filter((event: Event) =>
              event['key'] != 'Control' &&
              event['key'] != 'Shift' &&
              event['ctrlKey'] != true &&
              event['altKey'] != true
            ),
            map((event: Event) => ({timeStamp: event.timeStamp, key: event['key']})),
            tap(obj => sentence += obj.key),
            buffer(keyEvent.pipe(debounceTime(1000))),
            map(array => ({keySequence: array, sentence: sentence})),
            tap(() => sentence = "")
          )
          .subscribe(obj => {
            if (obj.keySequence.length > 0) {
              this.actionLogger.keypress(obj)
            }
          })
      }

      /* ------- GLOBAL EVENTS ------- */
      if (this.actionLogger.opt['various']['selection']) {
        /*
         * SELECTION
         * Listen to selection when selectstart and mouseup events are consecutive
         */
        let selectionStartTime = 0
        fromEvent(document, 'selectstart')
          .pipe(
            tap(event => {selectionStartTime = event.timeStamp}),
            concatMap(() => {
                return fromEvent(this.element.nativeElement, 'mouseup').pipe(take(1))
              }
            ),
            map((event: Event) => ({startTime: selectionStartTime, endTime: event.timeStamp}))
          )
          .subscribe(obj => this.actionLogger.onSelect(obj))
      }

      if (this.actionLogger.opt['various']['unload']) {
        /*
         * UNLOAD
         * Listener for document unload (this event is unreliable)
         */
        fromEvent(window, 'beforeunload')
          .pipe(map((event: Event) => ({timeStamp: event.timeStamp})))
          .subscribe(obj => this.actionLogger.beforeUnload(obj))
      }

      if (this.actionLogger.opt['various']['focus&blur']) {
        /*
         * FOCUS & BLUR
         * Listener for window focus and blur
         */
        fromEvent(window, 'focus')
          .pipe(map((event: Event) => ({timeStamp: event.timeStamp})))
          .subscribe(obj => this.actionLogger.windowFocus(obj))
        fromEvent(window, 'blur')
          .pipe(map((event: Event) => ({timeStamp: event.timeStamp})))
          .subscribe(obj => this.actionLogger.windowBlur(obj))
      }

      if (this.actionLogger.opt['various']['scroll']) {
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
              if (firstScroll) {
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
      }

      if (this.actionLogger.opt['various']['resize']) {
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
      }

      /* ------- CLIPBOARD EVENTS ------- */
      if (this.actionLogger.opt['clipboard']['copy']) {
        /*
         * COPY
         * Listen to copy event, can't get clipboard content
         */
        fromEvent(this.element.nativeElement, 'copy')
          .pipe(map((event: Event) => ({timeStamp: event.timeStamp})))
          .subscribe(obj => this.actionLogger.onCopy(obj))
      }

      if (this.actionLogger.opt['clipboard']['cut']) {
        /*
         * CUT
         * Listen to cut event, can't get clipboard content
         */
        fromEvent(this.element.nativeElement, 'cut')
          .pipe(map((event: Event) => ({timeStamp: event.timeStamp})))
          .subscribe(obj => this.actionLogger.onCut(obj))
      }
    }
  }
}

@Directive({selector: 'input[type="text"]'})
export class InputDirective implements AfterViewInit {
  constructor(private actionLogger: ActionLogger, private element: ElementRef) {}

  ngAfterViewInit() {
    if(this.actionLogger.isActive) {
      if (this.actionLogger.opt['textInput']['paste']) {
        /*
         * PASTE (on input element)
         * Listen to a paste event on input area and get pasted text
         */
        fromEvent(this.element.nativeElement, 'paste')
          .pipe(map((event: ClipboardEvent) => ({
            timeStamp: event.timeStamp,
            text: event.clipboardData.getData('text')
          })))
          .subscribe(obj => this.actionLogger.onPaste(obj))
      }

      if (this.actionLogger.opt['textInput']['delete']) {
        /*
         * BACKSPACE and BLUR (on input element)
         * When user delete something on the text area, the event handler log what has written
         */
        fromEvent(this.element.nativeElement, 'keydown')
          .pipe(
            filter((event: KeyboardEvent) => event.key === 'Backspace'),
            debounceTime(3000),
            map((event: KeyboardEvent) => ({timeStamp: event.timeStamp, target: event.target['value']}))
          )
          .subscribe((obj) => this.actionLogger.textLog(obj))

        fromEvent(this.element.nativeElement, 'blur')
          .pipe(map((event: Event) => ({timeStamp: event.timeStamp, target: event.target['value']})))
          .subscribe((obj) => this.actionLogger.textLog(obj))
      }
    }
  }
}

@Directive({selector: "mat-radio-group"})
export class RadioDirective implements AfterViewInit {
  constructor(private actionLogger: ActionLogger, private element: ElementRef) {}

  ngAfterViewInit() {
    if(this.actionLogger.isActive) {
      if (this.actionLogger.opt['radio']['change']) {
        /*
         *  When user change radio value on a group, log the new value
         */
        fromEvent(this.element.nativeElement, 'input')
          .pipe(map((event: InputEvent) => ({
            timeStamp: event.timeStamp,
            group: event.target['name'],
            value: event.target['value']
          })))
          .subscribe(obj => this.actionLogger.radioChange(obj))
      }
    }
  }
}

@Directive({selector: "app-crowd-xplorer"})
export class CrowdXplorerDirective implements AfterViewInit{
  constructor(private actionLogger: ActionLogger, private element: ElementRef) {}

  ngAfterViewInit() {
    if(this.actionLogger.isActive) {
      if (this.actionLogger.opt['crowd-xplorer']['query']) {
        fromEvent(this.element.nativeElement, 'queryEmitter')
          .pipe(map((event: Event) => event['detail']))
          .subscribe(detail => this.actionLogger.onQuery(detail))
      }

      if (this.actionLogger.opt['crowd-xplorer']['result']) {
        fromEvent(this.element.nativeElement, 'resultEmitter')
          .pipe(map((event: Event) => event['detail']))
          .subscribe(detail => this.actionLogger.onResult(detail))
      }
    }
  }
}
