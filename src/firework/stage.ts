import Ticker from './ticker'
function StageFactory() {
  'use strict';

  let lastTouchTimestamp = 0;

  class Stage {
    static stages: Stage[] = [];
    static disableHighDPI = false;

    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    speed: number;
    dpr: number;
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
    private _listeners: {
      [key: string]: any
    };

    constructor(canvas: string | HTMLCanvasElement) {
      if (typeof canvas === 'string') {
        canvas = document.getElementById(canvas) as HTMLCanvasElement;
      }

      if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('Invalid canvas element');
      }

      this.canvas = canvas;
      this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
      this.canvas.style.touchAction = 'none';

      this.speed = 1;
      this.dpr = Stage.disableHighDPI ? 1 : window.devicePixelRatio || 1;

      this.width = this.canvas.width;
      this.height = this.canvas.height;
      this.naturalWidth = this.width * this.dpr;
      this.naturalHeight = this.height * this.dpr;

      if (this.width !== this.naturalWidth) {
        this.canvas.width = this.naturalWidth;
        this.canvas.height = this.naturalHeight;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
      }

      Stage.stages.push(this);

      this._listeners = {
        resize: [],
        pointerstart: [],
        pointermove: [],
        pointerend: [],
        lastPointerPos: { x: 0, y: 0 },
      };
    }

    addEventListener(event: string, handler: any) {
      if (event === 'ticker') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        Ticker.addListener(handler);
      } else if (this._listeners[event]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        this._listeners[event].push(handler);
      } else {
        throw new Error('Invalid Event');
      }
    }

    removeEventListener(event: string, handler: any) {
      if (event === 'ticker') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        Ticker.removeListener(handler);
    } else if (this._listeners[event]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const index = this._listeners[event].indexOf(handler);
        if (index !== -1) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          this._listeners[event].splice(index, 1);
        }
      } else {
        throw new Error('Invalid Event');
      }
    }

    dispatchEvent(event: string, val?: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const listeners = this._listeners[event];
      if (listeners) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        listeners.forEach((listener) => listener.call(this, val));
      } else {
        throw new Error('Invalid Event');
      }
    }

    resize(w: number, h: number) {
      this.width = w;
      this.height = h;
      this.naturalWidth = w * this.dpr;
      this.naturalHeight = h * this.dpr;

      this.canvas.width = this.naturalWidth;
      this.canvas.height = this.naturalHeight;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;

      this.dispatchEvent('resize');
    }

    pointerEvent(type: string, x: number, y: number, e:MouseEvent | TouchEvent) {
      const evt = {
        type,
        x,
        y,
        onCanvas: x >= 0 && x <= this.width && y >= 0 && y <= this.height,
        e
      };
      this.dispatchEvent(`pointer${type}`, evt);
    }

    static windowToCanvas(canvas: HTMLCanvasElement, x: number, y: number) {
      const bbox = canvas.getBoundingClientRect();
      return {
        x: (x - bbox.left) * (canvas.width / bbox.width),
        y: (y - bbox.top) * (canvas.height / bbox.height),
      };
    }

    static mouseHandler(evt: MouseEvent) {
      if (Date.now() - lastTouchTimestamp < 500) return;

      const type = evt.type === 'mousemove' ? 'move' : evt.type === 'mouseup' ? 'end' : 'start';
      Stage.stages.forEach((stage) => {
        const pos = Stage.windowToCanvas(stage.canvas, evt.clientX, evt.clientY);
        stage.pointerEvent(type, pos.x / stage.dpr, pos.y / stage.dpr, evt);
      });
    }

    static touchHandler(evt: TouchEvent) {
      lastTouchTimestamp = Date.now();
      const type = evt.type === 'touchmove' ? 'move' : evt.type === 'touchend' ? 'end' : 'start';

      Stage.stages.forEach((stage) => {
        Array.from(evt.changedTouches).forEach((touch) => {
          let pos;
          if (type !== 'end') {
            pos = Stage.windowToCanvas(stage.canvas, touch.clientX, touch.clientY);
            stage._listeners.lastPointerPos = pos;
            if (type === 'start') {
              stage.pointerEvent('move', pos.x / stage.dpr, pos.y / stage.dpr, evt);
            }
          } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            pos = stage._listeners.lastPointerPos;
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          stage.pointerEvent(type, pos.x / stage.dpr, pos.y / stage.dpr, evt);
        });
      });
    }
  }

  document.addEventListener('mousedown', (event: MouseEvent) => Stage.mouseHandler(event));
  document.addEventListener('mousemove', Stage.mouseHandler.bind(Stage));
  document.addEventListener('mouseup', Stage.mouseHandler.bind(Stage));
  document.addEventListener('touchstart', Stage.touchHandler.bind(Stage));
  document.addEventListener('touchmove', Stage.touchHandler.bind(Stage));
  document.addEventListener('touchend', Stage.touchHandler.bind(Stage));
  return Stage;
}

const Stage = StageFactory()
export default Stage
