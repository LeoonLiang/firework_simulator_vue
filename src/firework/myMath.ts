function MyMathFactory(): MyMath {
  const MyMath: MyMath = {
    toDeg: 180 / Math.PI,
    toRad: Math.PI / 180,
    halfPI: Math.PI / 2,
    twoPI: Math.PI * 2,

    dist: (width, height) => Math.sqrt(width * width + height * height),

    pointDist: (x1, y1, x2, y2) => {
      const distX = x2 - x1;
      const distY = y2 - y1;
      return Math.sqrt(distX * distX + distY * distY);
    },

    angle: (width, height) => MyMath.halfPI + Math.atan2(height, width),

    pointAngle: (x1, y1, x2, y2) =>
      MyMath.halfPI + Math.atan2(y2 - y1, x2 - x1),

    splitVector: (speed, angle) => ({
      x: Math.sin(angle) * speed,
      y: -Math.cos(angle) * speed,
    }),

    random: (min, max) => Math.random() * (max - min) + min,

    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

    randomChoice: <T>(choices: T[] | T, ...args: T[]): T => {
      if (Array.isArray(choices) && args.length === 0) {
        return choices[Math.floor(Math.random() * choices.length)];
      }

      const allChoices: T[] = Array.isArray(choices) ? choices : [choices, ...args];
      return allChoices[Math.floor(Math.random() * allChoices.length)];
    },

    clamp: (num, min, max) => Math.min(Math.max(num, min), max),

    literalLattice: (text, density = 3, fontWeight = 'bold', fontFamily = 'Georgia', fontSize = '60px') => {
      const dots: Array<{ x: number; y: number }> = [];
      const canvas: HTMLCanvasElement = document.createElement('canvas');
      const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');

      if (!ctx) throw new Error('CanvasRenderingContext2D not supported');

      const font = `${fontWeight} ${fontSize} ${fontFamily}`;
      ctx.font = font;

      const width = ctx.measureText(text).width;
      const fontSizeNum = parseInt(fontSize, 10);
      canvas.width = Math.ceil(width + 20);
      canvas.height = Math.ceil(fontSizeNum + 20);

      ctx.font = font;
      ctx.fillText(text, 10, fontSizeNum + 10);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < imageData.height; y += density) {
        for (let x = 0; x < imageData.width; x += density) {
          const i = (y * imageData.width + x) * 4;
          if (imageData.data[i + 3] > 0) {
            dots.push({ x, y });
          }
        }
      }

      return {
        width: canvas.width,
        height: canvas.height,
        points: dots,
      };
    },
  };

  return MyMath;
}
const MyMath = MyMathFactory()
export default MyMath

// 类型定义
export interface MyMath {
  toDeg: number;
  toRad: number;
  halfPI: number;
  twoPI: number;

  dist: (width: number, height: number) => number;
  pointDist: (x1: number, y1: number, x2: number, y2: number) => number;
  angle: (width: number, height: number) => number;
  pointAngle: (x1: number, y1: number, x2: number, y2: number) => number;
  splitVector: (speed: number, angle: number) => { x: number; y: number };
  random: (min: number, max: number) => number;
  randomInt: (min: number, max: number) => number;
  randomChoice: (...args: any[]) => any;
  clamp: (num: number, min: number, max: number) => number;

  literalLattice: (
    text: string,
    density?: number,
    fontWeight?: string,
    fontFamily?: string,
    fontSize?: string
  ) => {
    width: number;
    height: number;
    points: Array<{ x: number; y: number }>;
  };
}
