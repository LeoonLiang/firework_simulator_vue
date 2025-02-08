import type { IShell } from './shell';
// 音效管理器
interface SoundSource {
  volume: number;
  playbackRateMin: number;
  playbackRateMax: number;
  fileNames: string[];
  buffers?: AudioBuffer[];
}
const PI_2 = Math.PI * 2
/**
 * 音量相关
 * */
export const soundManager = {
  // 音频文件的基础 URL 路径
  baseURL: '/audio/',
  // 创建音频上下文，兼容不同浏览器
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  ctx: new (window.AudioContext || window.webkitAudioContext),
  // 存储不同类型的音效源信息
  sources: {
    lift: {
      volume: 1,
      playbackRateMin: 0.85,
      playbackRateMax: 0.95,
      fileNames: ['lift1.mp3', 'lift2.mp3', 'lift3.mp3'],
    },
    burst: {
      volume: 1,
      playbackRateMin: 0.8,
      playbackRateMax: 0.9,
      fileNames: ['burst1.mp3', 'burst2.mp3'],
    },
    burstSmall: {
      volume: 0.25,
      playbackRateMin: 0.8,
      playbackRateMax: 1,
      fileNames: ['burst-sm-1.mp3', 'burst-sm-2.mp3'],
    },
    crackle: {
      volume: 0.2,
      playbackRateMin: 1,
      playbackRateMax: 1,
      fileNames: ['crackle1.mp3'],
    },
    crackleSmall: {
      volume: 0.3,
      playbackRateMin: 1,
      playbackRateMax: 1,
      fileNames: ['crackle-sm-1.mp3'],
    },
  } as Record<string, SoundSource>,

  // 预加载音频文件
  preload(): Promise<void[]> {
    const allFilePromises: Promise<void>[] = [];

    function checkStatus(response: Response): Response {
      if (response.status >= 200 && response.status < 300) {
        return response;
      }
      const customError = new Error(response.statusText);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (customError as any).response = response;
      throw customError;
    }

    const types = Object.keys(this.sources);
    types.forEach((type) => {
      const source = this.sources[type];
      const { fileNames } = source;
      const filePromises: Promise<void>[] = [];

      fileNames.forEach((fileName) => {
        const fileURL = this.baseURL + fileName;
        const promise = fetch(fileURL)
          .then(checkStatus)
          .then((response) => response.arrayBuffer())
          .then(
            (data) =>
              new Promise<void>((resolve) => {
                void this.ctx.decodeAudioData(data, (buffer) => {
                  if (!source.buffers) source.buffers = [];
                  source.buffers.push(buffer);
                  resolve();
                });
              })
          );

        filePromises.push(promise);
        allFilePromises.push(promise);
      });

      Promise.all(filePromises).catch((err) => console.error(err));
    });

    return Promise.all(allFilePromises);
  },

  // 暂停所有音效
  pauseAll(): void {
    void this.ctx.suspend();
  },

  // 恢复所有音效
  resumeAll(): void {
    this.playSound('lift', 0);
    setTimeout(() => {
      void this.ctx.resume();
    }, 250);
  },

  _lastSmallBurstTime: 0,

  playSound(type: string, scale = 1): void {
    if (!this.sources[type]) {
      throw new Error(`Sound of type "${type}" 不存在。`);
    }

    const now = Date.now();
    if (type === 'burstSmall' && now - this._lastSmallBurstTime < 20) {
      return;
    }

    if (type === 'burstSmall') {
      this._lastSmallBurstTime = now;
    }

    const source = this.sources[type];
    const initialVolume = source.volume;
    const initialPlaybackRate = this.random(source.playbackRateMin, source.playbackRateMax);
    const scaledVolume = initialVolume * scale;
    const scaledPlaybackRate = initialPlaybackRate * (2 - scale);

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = scaledVolume;

    if (!source.buffers || source.buffers.length === 0) {
      console.error(`No buffers loaded for sound type: ${type}`);
      return;
    }

    const buffer = this.randomChoice(source.buffers);
    const bufferSource = this.ctx.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.playbackRate.value = scaledPlaybackRate;
    bufferSource.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    bufferSource.start(0);
  },

  random(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  },

  randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  },
};

/**
 * 烟花颜色相关
 * */
export const INVISIBLE = '_INVISIBLE_' // 无色
export const COLOR = {
  Red: '#993122',
  Pink: '#DE7571',
  Blue: '#87d2ff',
  Blue2: '#a4ffed',
  Purple: '#6e54b5',
  Purple2: '#e4bof2',
  Gold: '#ffbf36',
  White: '#ffffff',
  YELLOW: '#EECA57'
}
const COLOR_NAMES = Object.keys(COLOR) as Array<keyof typeof COLOR>;
export const COLOR_CODES = COLOR_NAMES.map((colorName) => COLOR[colorName]);
export const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE]
// Tuples是用{ r，g，b }元组(仍然只是对象)的值通过颜色代码(十六进制)映射的键。
export const COLOR_TUPLES: Record<string, { r: number; g: number; b: number }> = {}
COLOR_CODES.forEach((hex) => {
  COLOR_TUPLES[hex] = {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  }
})
// 获取随机颜色
export function randomColorSimple() {
  return COLOR_CODES[(Math.random() * COLOR_CODES.length) | 0]
}

// 随机颜色
export function randomColor(options?: {
  notSame?: boolean
  notColor?: string
  limitWhite?: boolean
}, lastColor?: string) {
  const notSame = options && options.notSame
  const notColor = options && options.notColor
  const limitWhite = options && options.limitWhite
  let color = randomColorSimple()

  // 限制白色随机抽取的
  if (limitWhite && color === COLOR.White && Math.random() < 0.6) {
    color = randomColorSimple()
  }

  if (notSame) {
    while (color === lastColor) {
      color = randomColorSimple()
    }
  } else if (notColor) {
    while (color === notColor) {
      color = randomColorSimple()
    }
  }
  return color
}

function whiteOrGold() {
  return Math.random() < 0.5 ? COLOR.Gold : COLOR.White
}

function makePistilColor(shellColor: string) {
  // 爆炸后的第二种粒子颜色，暂时统一搭配黄色
  return '#EECA57'
  return shellColor === COLOR.White || shellColor === COLOR.Gold
    ? randomColor({ notColor: shellColor })
    : whiteOrGold()
}



/**
 * 文字相关
 */
const randomWords = [
  '蛇年大吉',
  '福蛇迎春',
  '靈蛇報春',
  '新年快樂',
  '2025來啦',
  '(*^o^*)'
]
// 随机获取一段文字
export function randomWord() {
  if (randomWords.length === 0) return ''
  if (randomWords.length === 1) return randomWords[0]
  return randomWords[(Math.random() * randomWords.length) | 0]
}

/**
 * 生成各种烟花类型的具体参数
 */
// --- 类型开始（下面的一般不动）

// 定义 `shellTypes` 的类型
export type ShellType = 'Random' | 'Crackle' | 'Crossette' | 'Crysanthemum' |
  'Falling Leaves' | 'Floral' | 'Ghost' | 'Horse Tail' | 'Palm' |
  'Ring' | 'Strobe' | 'Willow';

// 定义 `shellTypes` 对象的类型
type ShellTypesMap = Record<ShellType, (size?: number) => IShell>;

const crysanthemumShell: (size?: number) => IShell = (size = 1) => {
  const glitter = Math.random() < 0.25
  const singleColor = Math.random() < 0.72
  const color = singleColor
    ? randomColor({ limitWhite: true })
    : [randomColor(), randomColor({ notSame: true })]
  const pistil = singleColor && Math.random() < 0.42
  const pistilColor = pistil && makePistilColor(color as string) || ''
  const secondColor =
    singleColor && (Math.random() < 0.2 || color === COLOR.White)
      ? pistilColor || randomColor({ notColor: color as string, limitWhite: true })
      : ''
  const streamers = !pistil && color !== COLOR.White && Math.random() < 0.42
  const starDensity = glitter ? 1.1 : 1.25
  // if (isLowQuality) starDensity *= 0.8
  // if (isHighQuality) starDensity = 1.2
  return {
    shellSize: size,
    spreadSize: 300 + size * 100,
    starLife: 900 + size * 200,
    starDensity,
    color,
    secondColor,
    glitter: glitter ? 'light' : '',
    glitterColor: whiteOrGold(),
    pistil,
    pistilColor,
    streamers
  }
}
const ghostShell = (size = 1) => {
  const shell = crysanthemumShell(size)
  shell.starLife *= 1.5
  const ghostColor = randomColor({ notColor: COLOR.White })
  shell.streamers = true
  shell.color = INVISIBLE
  shell.secondColor = ghostColor
  shell.glitter = ''
  return shell
}

const strobeShell = (size = 1) => {
  const color = randomColor({ limitWhite: true })
  return {
    shellSize: size,
    spreadSize: 280 + size * 92,
    starLife: 1100 + size * 200,
    starLifeVariation: 0.4,
    starDensity: 1.1,
    color,
    glitter: 'light',
    glitterColor: COLOR.White,
    strobe: true,
    strobeColor: Math.random() < 0.5 ? COLOR.White : undefined,
    pistil: true,
    pistilColor: makePistilColor(color) // 炸了后的第二个色
  }
}

const palmShell = (size = 1) => {
  const color = randomColor()
  const thick = Math.random() < 0.5
  return {
    shellSize: size,
    color,
    spreadSize: 250 + size * 75,
    starDensity: thick ? 0.15 : 0.4,
    starLife: 1800 + size * 200,
    glitter: thick ? 'thick' : 'heavy'
  }
}

const ringShell = (size = 1) => {
  const color = randomColor()
  const pistil = Math.random() < 0.75
  return {
    shellSize: size,
    ring: true,
    color,
    spreadSize: 300 + size * 100,
    starLife: 900 + size * 200,
    starCount: 2.2 * PI_2 * (size + 1),
    pistil,
    pistilColor: makePistilColor(color),
    glitter: !pistil ? 'light' : '',
    glitterColor: color === COLOR.Gold ? COLOR.Gold : COLOR.White,
    streamers: Math.random() < 0.3
  }
}

const crossetteShell = (size = 1) => {
  const color = randomColor({ limitWhite: true })
  return {
    shellSize: size,
    spreadSize: 300 + size * 100,
    starLife: 750 + size * 160,
    starLifeVariation: 0.4,
    starDensity: 0.85,
    color,
    crossette: true,
    pistil: Math.random() < 0.5,
    pistilColor: makePistilColor(color) // 炸了的第二个色
  }
}

const floralShell = (size = 1) => ({
  shellSize: size,
  spreadSize: 300 + size * 120,
  starDensity: 0.12,
  starLife: 500 + size * 50,
  starLifeVariation: 0.5,
  color:
    Math.random() < 0.65
      ? 'random'
      : Math.random() < 0.15
        ? randomColor()
        : [randomColor(), randomColor({ notSame: true })],
  floral: true
})

const fallingLeavesShell = (size = 1) => ({
  shellSize: size,
  color: INVISIBLE,
  spreadSize: 300 + size * 120,
  starDensity: 0.12,
  starLife: 500 + size * 50,
  starLifeVariation: 0.5,
  glitter: 'medium',
  glitterColor: COLOR.Gold,
  fallingLeaves: true
})

const willowShell = (size = 1) => ({
  shellSize: size,
  spreadSize: 300 + size * 100,
  starDensity: 0.6,
  starLife: 3000 + size * 300,
  glitter: 'willow',
  glitterColor: COLOR.Gold,
  color: INVISIBLE
})

const crackleShell = (size = 1) => {
  // favor gold
  const color = Math.random() < 0.75 ? COLOR.Gold : randomColor()
  return {
    shellSize: size,
    spreadSize: 380 + size * 75,
    starDensity: 1,
    starLife: 600 + size * 100,
    starLifeVariation: 0.32,
    glitter: 'light',
    glitterColor: COLOR.Gold,
    color,
    crackle: true,
    pistil: Math.random() < 0.65,
    pistilColor: makePistilColor(color)
  }
}

const horsetailShell = (size = 1) => {
  const color = randomColor()
  return {
    shellSize: size,
    horsetail: true,
    color,
    spreadSize: 250 + size * 38,
    starDensity: 0.9,
    starLife: 2500 + size * 300,
    glitter: 'medium',
    glitterColor: Math.random() < 0.5 ? whiteOrGold() : color,
    strobe: color === COLOR.White
  }
}

const fastShellBlacklist = ['Falling Leaves', 'Floral', 'Willow']
export function randomFastShell(baseShellName: ShellType) {
  const isRandom =  baseShellName === 'Random'
  let shellName = isRandom ? randomShellName() : baseShellName
  if (isRandom) {
    while (fastShellBlacklist.includes(shellName)) {
      shellName = randomShellName()
    }
  }
  return shellTypes[shellName]
}
export const shellTypes: ShellTypesMap = {
  Random: randomShell,
  Crackle: crackleShell,
  Crossette: crossetteShell,
  Crysanthemum: crysanthemumShell,
  'Falling Leaves': fallingLeavesShell,
  Floral: floralShell,
  Ghost: ghostShell,
  'Horse Tail': horsetailShell,
  Palm: palmShell,
  Ring: ringShell,
  Strobe: strobeShell,
  Willow: willowShell
}
const shellNames = Object.keys(shellTypes) as ShellType[]
// --- 类型结束

// 随机烟花类型名字
function randomShellName(): ShellType {
  return shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0]
}
// 随机烟花类型
function randomShell(size?: number) {
  // Normal operation
  const shellName = randomShellName()
  const shellFun = shellTypes[shellName]
  return shellFun(size)
}

export function shellFromConfig(shellName: keyof typeof shellTypes, size?: number) {
  return shellTypes[shellName](size)
}


/**
 * 烟花尺寸相关
 */
function fitShellPositionInBoundsH(position: number) {
  const edge = 0.18
  return (1 - edge * 2) * position + edge
}

function fitShellPositionInBoundsV(position: number) {
  return position * 0.75
}

export function getRandomShellPositionH() {
  return fitShellPositionInBoundsH(Math.random())
}

export function getRandomShellPositionV() {
  return fitShellPositionInBoundsV(Math.random())
}

// 获取随机的烟花尺寸
export function getRandomShellSize(baseSize: number) {
  const maxVariance = Math.min(2.5, baseSize)
  const variance = Math.random() * maxVariance
  const size = baseSize - variance
  const height = maxVariance === 0 ? Math.random() : 1 - variance / maxVariance
  const centerOffset = Math.random() * (1 - height * 0.65) * 0.5
  const x = Math.random() < 0.5 ? 0.5 - centerOffset : 0.5 + centerOffset
  return {
    size,
    x: fitShellPositionInBoundsH(x),
    height: fitShellPositionInBoundsV(height)
  }
}




