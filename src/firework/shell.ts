/**
* @license
* 二次修改于下面的项目
* Copyright © 2022 NianBroken. All rights reserved.
* Github：https://github.com/NianBroken/Firework_Simulator
* Gitee：https://gitee.com/nianbroken/Firework_Simulator
*/
import { soundManager, COLOR_CODES_W_INVIS, COLOR, INVISIBLE, randomColor, randomWord } from './utils';
import MyMath from './myMath'

export type TWordShell =  {
  fontSize: number,
  word: string
}

/**
 * 烟花发射类
 */
export type IShell = {
  spreadSize: number; // 扩展范围
  starLife: number; // 星体寿命
  shellSize?: number; // 烟花大小
  starDensity?: number; // 星体密度
  starLifeVariation?: number; // 星体寿命的变化范围
  color?: string | string[] | 'random'; // 颜色或颜色数组
  secondColor?: string; // 第二种颜色
  glitter?: string; // 闪光类型
  glitterColor?: string; // 闪光颜色
  pistil?: boolean; // 是否有花蕊效果
  pistilColor?: string; // 花蕊颜色
  streamers?: boolean; // 是否带有流星效果
  ring?: boolean; // 是否为环形
  crossette?: boolean; // 是否为十字形效果
  floral?: boolean; // 是否为花朵效果
  fallingLeaves?: boolean; // 是否为落叶效果
  crackle?: boolean; // 是否有哔哔作响效果
  horsetail?: boolean; // 是否为马尾效果
  strobe?: boolean; // 是否有闪烁效果
  strobeColor?: string; // 闪烁颜色
  disableWord?: boolean; // 是否禁用文字效果
  comet?: any; // 流星效果的配置（根据实际类型定义）
  starCount?: number
  wordShell?: TWordShell // 是否打字
};


// Star
interface StarInstance {
  visible: boolean;
  heavy: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  color: string | string[] | 'random';
  speedX: number;
  speedY: number;
  life: number;
  fullLife: number;
  size: number;
  spinAngle: number;
  spinSpeed: number;
  spinRadius: number;
  sparkFreq: number;
  sparkSpeed: number;
  sparkTimer: number;
  sparkColor: string | string[];
  sparkLife: number;
  sparkLifeVariation: number;
  strobe: boolean;
  strobeFreq?: number;
  onDeath?: (instance: StarInstance) => void;
  secondColor?: string;
  transitionTime?: number;
  colorChanged?: boolean;
  updateFrame?: number
}
const PI_2 = Math.PI * 2
const PI_HALF = Math.PI * 0.5
const quality = 3

// 下面是shell需要用的各种函数
// 用于将粒子以半随机的方式分布在弧线上的辅助函数
// 该函数的参数灵活，`start` 和 `arcLength` 可以为负数，`randomness` 只是用于随机添加的乘数
function createParticleArc(
  start: number,
  arcLength: number,
  count: number,
  randomness: number,
  particleFactory: (angle: number, size?: number) => void
) {
  // 计算每个粒子之间的角度差
  const angleDelta = arcLength / count;
  // 有时在结尾会有一个额外的粒子，它离起点太近。减去半个 angleDelta 可以避免这种情况。
  // 希望有更好的解决方法。
  const end = start + arcLength - angleDelta * 0.5;

  if (end > start) {
    // 优化：使用 `angle = angle + angleDelta` 而不是 `angle += angleDelta`
    // V8 引擎在使用 let 复合赋值时会进行优化
    for (let angle = start; angle < end; angle = angle + angleDelta) {
      // 调用 particleFactory 函数，并传入根据随机角度偏移后的角度
      particleFactory(angle + Math.random() * angleDelta * randomness);
    }
  } else {
    for (let angle = start; angle > end; angle = angle + angleDelta) {
      // 调用 particleFactory 函数，并传入根据随机角度偏移后的角度
      particleFactory(angle + Math.random() * angleDelta * randomness);
    }
  }
}

//获取字体点阵信息
function getWordDots(word: string, wordShell?: TWordShell) {
  if (!word) return null
  //随机字体大小 70~80
  const fontSize = !wordShell ? Math.floor(Math.random() * 30 + 50) :  wordShell.fontSize

  const res = MyMath.literalLattice(
    word,
    3,
    'bold',
    'SourceHanSerifCN-Bold',
    String(fontSize) + 'px'
  )

  return res
}

/**
 * 用于创建球形粒子爆发的辅助对象。
 *
 * @param  {Number} count               所需的恒星/粒子数量。该值是一个建议，而创建的爆发可能有更多的粒子。目前的算法无法完美地
 *										在球体表面均匀分布特定数量的点。
 * @param  {Function} particleFactory   每生成一颗星/粒子调用一次。传递了两个参数:
 * 										`angle `:恒星/粒子的方向。
 * 										`speed `:粒子速度的倍数，从0.0到1.0。
 * @param  {Number} startAngle=0        对于分段爆发，只能生成部分粒子弧。这
 *										允许设置起始圆弧角度(弧度)。
 * @param  {Number} arcLength=TAU       弧的长度(弧度)。默认为整圆。
 *
 * @return {void}              不返回任何内容；由“particleFactory”使用给定的数据。
 */
function createBurst(count: number, particleFactory: (particleAngle: number, particleSpeed: number) => void, startAngle = 0, arcLength = PI_2) {
  // Assuming sphere with surface area of `count`, calculate various
  // properties of said sphere (unit is stars).
  // Radius
  const R = 0.5 * Math.sqrt(count / Math.PI)
  // Circumference
  const C = 2 * R * Math.PI
  // Half Circumference
  const C_HALF = C / 2
  // Make a series of rings, sizing them as if they were spaced evenly
  // along the curved surface of a sphere.
  for (let i = 0; i <= C_HALF; i++) {
    const ringAngle = (i / C_HALF) * PI_HALF
    const ringSize = Math.cos(ringAngle)
    const partsPerFullRing = C * ringSize
    const partsPerArc = partsPerFullRing * (arcLength / PI_2)

    const angleInc = PI_2 / partsPerFullRing
    const angleOffset = Math.random() * angleInc + startAngle
    // Each particle needs a bit of randomness to improve appearance.
    const maxRandomAngleOffset = angleInc * 0.33
    for (let i = 0; i < partsPerArc; i++) {
      const randomAngleOffset = Math.random() * maxRandomAngleOffset
      const angle = angleInc * i + angleOffset + randomAngleOffset
      particleFactory(angle, ringSize)
    }
  }
}
// Crossette将星形分割成四块相同颜色的星形，这些星形分支成十字形。
function crossetteEffect(star: StarInstance) {
  const startAngle = Math.random() * PI_HALF
  createParticleArc(startAngle, PI_2, 4, 0.5, (angle) => {
    Star.add(star.x, star.y, star.color, angle, Math.random() * 0.6 + 0.75, 600)
  })
}

/**
 *
 * @param {string} wordText  文字内容
 * @param {Function} particleFactory 每生成一颗星/粒子调用一次。传递参数:
 * 		                             `point `:恒星/粒子的起始位置_相对于canvas。
 *              					 `color `:粒子颜色。
 * @param {number} center_x 	爆炸中心点x
 * @param {number} center_y  	爆炸中心点y
 */
function createWordBurst(wordText: string, particleFactory: any, center_x: number, center_y: number, color: string, wordShell?: TWordShell) {
  //将点阵坐标转换为canvas坐标
  const map = getWordDots(wordText, wordShell)
  if (!map) return
  if (color === 'random') {
    color = randomColor()
  }
  const dcenterX = map.width / 2
  const dcenterY = map.height / 2
  const strobed = true
  const strobeColor = color

  for (let i = 0; i < map.points.length; i++) {
    const point = map.points[i]
    const x = center_x + (point.x - dcenterX)
    const y = center_y + (point.y - dcenterY)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    particleFactory({ x, y }, color, strobed, strobeColor)
  }
}

//花就像一个迷你的烟花
function floralEffect(star: StarInstance) {
  const count = 12 + 6 * quality
  createBurst(count, (angle, speedMult) => {
    Star.add(
      star.x,
      star.y,
      star.color,
      angle,
      speedMult * 2.4,
      1000 + Math.random() * 300,
      star.speedX,
      star.speedY
    )
  })
  // Queue burst flash render
  BurstFlash.add(star.x, star.y, 46)
  soundManager.playSound('burstSmall')
}

//柳星绽放
function fallingLeavesEffect(star: StarInstance) {
  createBurst(7, (angle, speedMult) => {
    const newStar = Star.add(
      star.x,
      star.y,
      INVISIBLE,
      angle,
      speedMult * 2.4,
      2400 + Math.random() * 600,
      star.speedX,
      star.speedY
    )

    newStar.sparkColor = COLOR.Gold
    newStar.sparkFreq = 144 / quality
    newStar.sparkSpeed = 0.28
    newStar.sparkLife = 750
    newStar.sparkLifeVariation = 3.2
  })
  BurstFlash.add(star.x, star.y, 46)
  soundManager.playSound('burstSmall')
}

//噼里啪啦的一声，迸出一小团金色的火花。
function crackleEffect(star: StarInstance) {
  const count = 32
  createParticleArc(0, PI_2, count, 1.8, (angle) => {
    Spark.add(
      star.x,
      star.y,
      COLOR.Gold,
      angle,
      // apply near cubic falloff to speed (places more particles towards outside)
      Math.pow(Math.random(), 0.45) * 2.4,
      300 + Math.random() * 200
    )
  })
}

export class Shell {
  starLifeVariation: number;
  color: string | string[] | 'random';
  glitterColor: string | string[] | 'random';
  disableWord: boolean;
  starCount: number;
  spreadSize: number;
  comet: StarInstance | null;
  glitter?: string;
  horsetail?: boolean;
  secondColor?: string;
  strobe?: boolean;
  strobeColor?: string;
  starLife?: number;
  fallingLeaves?: boolean;
  crossette?: boolean
  crackle?: boolean
  floral?: boolean
  ring?: boolean
  pistil?: boolean
  pistilColor?: string
  streamers?: boolean
  shellSize?: number
  wordShell?: TWordShell
  constructor(options: IShell) {
    Object.assign(this, options);
    this.starLifeVariation = options.starLifeVariation || 0.125;
    this.color = options.color || randomColor();
    this.glitterColor = options.glitterColor || this.color;
    this.disableWord = options.disableWord || false;
    this.spreadSize = options.spreadSize;
    const density = options.starDensity || 1;
    const scaledSize = this.spreadSize / 54;
    this.starCount = Math.max(6, scaledSize * scaledSize * density);
    this.comet = null;
  }

  /**
   * 发射烟花
   * @param position X位置
   * @param launchHeight 爆炸所在高度
   */
  launch(position: number, launchHeight: number, stageW: number, stageH: number): void {
    const width = stageW;
    const height = stageH;
    const hpad = 60;
    const vpad = 50;
    const minHeightPercent = 0.45;
    const minHeight = height - height * minHeightPercent;

    const launchX = position * (width - hpad * 2) + hpad;
    const launchY = height;
    const burstY = minHeight - launchHeight * (minHeight - vpad);

    const launchDistance = launchY - burstY;
    const launchVelocity = Math.pow(launchDistance * 0.04, 0.64);
    this.comet = Star.add(
      launchX,
      launchY,
      typeof this.color === 'string' && this.color !== 'random'
        ? this.color
        : COLOR.White,
      Math.PI,
      launchVelocity * (this.horsetail ? 1.2 : 1),
      launchVelocity * (this.horsetail ? 100 : 400)
    );

    if (this.comet) {
      this.comet.heavy = true;
      this.comet.spinRadius = MyMath.random(0.32, 0.85);
      this.comet.sparkFreq = 32 / quality;
      if (quality === 3) this.comet.sparkFreq = 8;
      this.comet.sparkLife = 320;
      this.comet.sparkLifeVariation = 3;
      if (this.glitter === 'willow' || this.fallingLeaves) {
        this.comet.sparkFreq = 20 / quality;
        this.comet.sparkSpeed = 0.5;
        this.comet.sparkLife = 500;
      }
      if (this.color === INVISIBLE) {
        this.comet.sparkColor = COLOR.Gold;
      }

      this.comet.onDeath = () => this.comet && this.burst(this.comet.x, this.comet.y, this.shellSize as number);
    }

    soundManager.playSound('lift');
  }

  /**
   * 在指定位置爆炸
   * @param x 爆炸X位置
   * @param y 爆炸Y位置
   */
  burst(x: number, y: number, shellSize: number): void {
    // Set burst speed so overall burst grows to set size. This specific formula was derived from testing, and is affected by simulated air drag.
    const speed = this.spreadSize / 96

    let color: string | null, onDeath: any, sparkFreq: number, sparkSpeed: number, sparkLife: number
    let sparkLifeVariation = 0.25
    //有些死亡效果，像爆裂声，播放声音，但应该只播放一次。
    let playedDeathSound = false
    sparkFreq = 0
    if (this.crossette)
      onDeath = (star: StarInstance) => {
        if (!playedDeathSound) {
          soundManager.playSound('crackleSmall')
          playedDeathSound = true
        }
        crossetteEffect(star)
      }
    if (this.crackle)
      onDeath = (star: StarInstance) => {
        if (!playedDeathSound) {
          soundManager.playSound('crackle')
          playedDeathSound = true
        }
        crackleEffect(star)
      }
    if (this.floral) onDeath = floralEffect
    if (this.fallingLeaves) onDeath = fallingLeavesEffect

    if (this.glitter === 'light') {
      sparkFreq = 400
      sparkSpeed = 0.3
      sparkLife = 300
      sparkLifeVariation = 2
    } else if (this.glitter === 'medium') {
      sparkFreq = 200
      sparkSpeed = 0.44
      sparkLife = 700
      sparkLifeVariation = 2
    } else if (this.glitter === 'heavy') {
      sparkFreq = 80
      sparkSpeed = 0.8
      sparkLife = 1400
      sparkLifeVariation = 2
    } else if (this.glitter === 'thick') {
      sparkFreq = 16
      sparkSpeed = quality === 3 ? 1.65 : 1.5;
      sparkLife = 1400
      sparkLifeVariation = 3
    } else if (this.glitter === 'streamer') {
      sparkFreq = 32
      sparkSpeed = 1.05
      sparkLife = 620
      sparkLifeVariation = 2
    } else if (this.glitter === 'willow') {
      sparkFreq = 120
      sparkSpeed = 0.34
      sparkLife = 1400
      sparkLifeVariation = 3.8
    }

    sparkFreq = sparkFreq / quality

    const starFactory = (angle: number, speedMult: number) => {
      const standardInitialSpeed = this.spreadSize / 1800
      // 双拼颜色
      if (color && ( color === COLOR.Blue || color === COLOR.Blue2)) {
        color = Math.random() < 0.5 ? COLOR.Blue : COLOR.Blue2
      } else if (color && ( color === COLOR.Red || color === COLOR.Pink)) {
        color = Math.random() < 0.5 ? COLOR.Red : COLOR.Pink
      } else if (color && ( color === COLOR.Purple || color === COLOR.Purple2)) {
        color = Math.random() < 0.5 ? COLOR.Purple : COLOR.Purple2
      }
      const star = Star.add(
        x,
        y,
        color || randomColor(),
        angle,
        speedMult * speed,
        // add minor variation to star life
        Number(this.starLife) + Math.random() * Number(this.starLife) * this.starLifeVariation,
        this.horsetail ? this.comet && this.comet.speedX || 0 : 0,
        this.horsetail ? this.comet && this.comet.speedY || 0 : -standardInitialSpeed
      )

      if (this.secondColor) {
        star.transitionTime = Number(this.starLife) * (Math.random() * 0.05 + 0.32)
        star.secondColor = this.secondColor
      }

      if (this.strobe) {
        star.transitionTime = Number(this.starLife) * (Math.random() * 0.08 + 0.46)
        star.strobe = true
        // How many milliseconds between switch of strobe state "tick". Note that the strobe pattern
        // is on:off:off, so this is the "on" duration, while the "off" duration is twice as long.
        //频闪状态切换之间多少毫秒“滴答”。注意，选通模式
        //是开:关:关，所以这是“开”的时长，而“关”的时长是两倍。
        star.strobeFreq = Math.random() * 20 + 40
        if (this.strobeColor) {
          star.secondColor = this.strobeColor
        }
      }

      star.onDeath = onDeath as (star: StarInstance) => void

      if (this.glitter) {
        star.sparkFreq = sparkFreq
        star.sparkSpeed = sparkSpeed
        star.sparkLife = sparkLife
        star.sparkLifeVariation = sparkLifeVariation
        star.sparkColor = this.glitterColor
        star.sparkTimer = Math.random() * star.sparkFreq
      }
    }

    //点阵星星工厂
    const dotStarFactory = (point: StarInstance, color: string, strobe: boolean, strobeColor: string) => {
      const standardInitialSpeed = this.spreadSize / 1800
      if (strobe) {
        // 控制字體消失的速度，再慢的话 需要控制其他。
        const speed = 0.02
        const star = Star.add(
          point.x,
          point.y,
          color,
          Math.random() * 2 * Math.PI,
          speed,
          // add minor variation to star life
          Number(this.starLife) +
          Math.random() * Number(this.starLife) * this.starLifeVariation +
          speed * 1000,
          this.horsetail ? this.comet && this.comet.speedX || 0 : 0,
          this.horsetail
            ? this.comet && this.comet.speedY || 0
            : -standardInitialSpeed,
          2
        )

        star.transitionTime = Number(this.starLife) * (Math.random() * 0.08 + 0.46)
        star.strobe = true
        star.strobeFreq = Math.random() * 20 + 40
        star.secondColor = strobeColor
      } else {
        Spark.add(
          point.x,
          point.y,
          color,
          Math.random() * 2 * Math.PI,
          // apply near cubic falloff to speed (places more particles towards outside)
          Math.pow(Math.random(), 0.15) * 1.4,
          Number(this.starLife) +
          Math.random() * Number(this.starLife) * this.starLifeVariation +
          1000
        )
      }

      //文字尾影
      Spark.add(
        point.x + 5,
        point.y + 10,
        color,
        Math.random() * 2 * Math.PI,
        Math.pow(Math.random(), 0.05) * 0.4,
        Number(this.starLife) +
        Math.random() * Number(this.starLife) * this.starLifeVariation +
        2000
      )
    }
    if (typeof this.color === 'string') {
      if (this.color === 'random') {
        color = null // falsey value creates random color in starFactory
      } else {
        color = this.color
      }

      //环的位置是随机的，旋转是随机的
      if (this.ring) {
        const ringStartAngle = Math.random() * Math.PI
        const ringSquash = Math.pow(Math.random(), 2) * 0.85 + 0.15

        createParticleArc(0, PI_2, this.starCount, 0, (angle) => {
          // Create a ring, squashed horizontally
          const initSpeedX = Math.sin(angle) * speed * ringSquash
          const initSpeedY = Math.cos(angle) * speed
          // Rotate ring
          const newSpeed = MyMath.pointDist(0, 0, initSpeedX, initSpeedY)
          const newAngle =
            MyMath.pointAngle(0, 0, initSpeedX, initSpeedY) + ringStartAngle
          const star = Star.add(
            x,
            y,
            color as string,
            newAngle,
            // apply near cubic falloff to speed (places more particles towards outside)
            newSpeed, //speed,
            // add minor variation to star life
            Number(this.starLife) +
            Math.random() * Number(this.starLife) * this.starLifeVariation
          )

          if (this.glitter) {
            star.sparkFreq = sparkFreq
            star.sparkSpeed = sparkSpeed
            star.sparkLife = sparkLife
            star.sparkLifeVariation = sparkLifeVariation
            star.sparkColor = this.glitterColor
            star.sparkTimer = Math.random() * star.sparkFreq
          }
        })
      }
      // Normal burst
      else {
        createBurst(this.starCount, starFactory)
      }
    } else if (Array.isArray(this.color)) {
      if (Math.random() < 0.5) {
        const start = Math.random() * Math.PI
        const start2 = start + Math.PI
        const arc = Math.PI
        color = this.color[0]
        // Not creating a full arc automatically reduces star count.
        createBurst(this.starCount, starFactory, start, arc)
        color = this.color[1]
        createBurst(this.starCount, starFactory, start2, arc)
      } else {
        color = this.color[0]
        createBurst(this.starCount / 2, starFactory)
        color = this.color[1]
        createBurst(this.starCount / 2, starFactory)
      }
    } else {
      throw new Error(
        '无效的烟花颜色。应为字符串或字符串数组，但得到:' + String(this.color)
      )
    }

    // 打字——50%出字
    if (Math.random() < 0.05 || this.wordShell) {
      createWordBurst(this.wordShell? this.wordShell.word : randomWord(), dotStarFactory, x, y, typeof this.glitterColor === 'string' ? this.glitterColor : this.glitterColor[0], this.wordShell);
    }

    if (this.pistil) {
      const innerShell = new Shell({
        spreadSize: this.spreadSize * 0.5,
        starLife: Number(this.starLife) * 0.6,
        starLifeVariation: this.starLifeVariation,
        starDensity: 1.4,
        color: this.pistilColor,
        glitter: 'light',
        disableWord: true,
        glitterColor: this.pistilColor === COLOR.Gold ? COLOR.Gold : COLOR.White
      })
      innerShell.burst(x, y, shellSize)
      // let color2 = this.color
      // if (color2 && ( color2 === COLOR.Blue || color2 === COLOR.Blue2)) {
      //   color2 = color2 === COLOR.Blue2 ? COLOR.Blue : COLOR.Blue2
      // } else if (color && ( color === COLOR.Red || color === COLOR.Pink)) {
      //   color2 = color2 === COLOR.Pink ? COLOR.Red : COLOR.Pink
      // } else if (color && ( color === COLOR.Purple || color === COLOR.Purple2)) {
      //   color2 = color2 === COLOR.Purple2 ? COLOR.Purple : COLOR.Purple2
      // }
      // const innerShell2 = new Shell({
      //   spreadSize: this.spreadSize * 0.5,
      //   starLife: Number(this.starLife) * 0.6,
      //   starLifeVariation: this.starLifeVariation,
      //   starDensity: 1.4,
      //   color: color2,
      //   glitter: 'light',
      //   disableWord: true,
      //   glitterColor: color2 === COLOR.Gold ? COLOR.Gold : COLOR.White
      // })
      // innerShell2.burst(x, y, shellSize)
    }

    if (this.streamers) {
      const innerShell = new Shell({
        spreadSize: this.spreadSize * 0.9,
        starLife: Number(this.starLife) * 0.8,
        starLifeVariation: this.starLifeVariation,
        starCount: Math.floor(Math.max(6, this.spreadSize / 45)),
        color: COLOR.White,
        disableWord: true,
        glitter: 'streamer'
      })
      innerShell.burst(x, y, shellSize)
    }

    //队列突发flash渲染
    BurstFlash.add(x, y, this.spreadSize / 4)


    //播放声音，但只针对“原装”shell，即被推出的那个。
    //我们不希望多个声音来自雌蕊或流光“子壳”。
    //这可以通过彗星的出现来检测。

    if (this.comet) {
      //根据当前烟花大小和选定的(最大)烟花大小缩放爆炸声音。
      //拍摄选择的外壳尺寸无论选择的尺寸如何，听起来总是一样的，
      //但是小一点的炮弹自动发射的时候，声音会小一点。听起来不太好
      //但是当给定的值太小时，我们不是根据比例，而是
      //看大小差异，映射到一个已知好听的范围。
      //这个项目的语言由Nianbroken翻译成中文
      const maxDiff = 2
      const sizeDifferenceFromMaxSize = Math.min(
        maxDiff,
        shellSize - (this.shellSize as number)
      )
      const soundScale = (1 - sizeDifferenceFromMaxSize / maxDiff) * 0.3 + 0.7
      soundManager.playSound('burst', soundScale)
    }
  }
}

// BurstFlash
interface BurstFlashInstance {
  x: number;
  y: number;
  radius: number;
}

export const BurstFlash = {
  active: [] as BurstFlashInstance[],
  _pool: [] as BurstFlashInstance[],

  _new(): BurstFlashInstance {
    return { x: 0, y: 0, radius: 0 };
  },

  add(x: number, y: number, radius: number): BurstFlashInstance {
    const instance = this._pool.pop() || this._new();

    instance.x = x;
    instance.y = y;
    instance.radius = radius;

    this.active.push(instance);
    return instance;
  },

  returnInstance(instance: BurstFlashInstance): void {
    this._pool.push(instance);
  },
};

// Helper function
function createParticleCollection<T>(): Record<string, T[]> {
  const collection: Record<string, T[]> = {};
  COLOR_CODES_W_INVIS.forEach((color) => {
    collection[color] = [];
  });
  return collection;
}



export const Star = {
  airDrag: 0.98,
  airDragHeavy: 0.992,

  active: createParticleCollection<StarInstance>(),
  _pool: [] as StarInstance[],

  _new(): StarInstance {
    return {
      visible: false,
      heavy: false,
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      color: '',
      speedX: 0,
      speedY: 0,
      life: 0,
      fullLife: 0,
      size: 3,
      spinAngle: 0,
      spinSpeed: 0,
      spinRadius: 0,
      sparkFreq: 0,
      sparkSpeed: 0,
      sparkTimer: 0,
      sparkColor: '',
      sparkLife: 0,
      sparkLifeVariation: 0,
      strobe: false,
    };
  },

  add(
    x: number,
    y: number,
    color: string | string[],
    angle: number,
    speed: number,
    life: number,
    speedOffX = 0,
    speedOffY = 0,
    size = 3
  ): StarInstance {
    const instance = this._pool.pop() || this._new();
    instance.visible = true;
    instance.heavy = false;
    instance.x = x;
    instance.y = y;
    instance.prevX = x;
    instance.prevY = y;
    instance.color = color;
    instance.speedX = Math.sin(angle) * speed + speedOffX;
    instance.speedY = Math.cos(angle) * speed + speedOffY;
    instance.life = life;
    instance.fullLife = life;
    instance.size = size;
    instance.spinAngle = Math.random() * Math.PI * 2;
    instance.spinSpeed = 0.8;
    instance.spinRadius = 0;
    instance.sparkFreq = 0;
    instance.sparkSpeed = 1;
    instance.sparkTimer = 0;
    instance.sparkColor = color;
    instance.sparkLife = 750;
    instance.sparkLifeVariation = 0.25;
    instance.strobe = false;
    this.active[color as string].push(instance);
    return instance;
  },

  returnInstance(instance: StarInstance): void {
    if (instance.onDeath) instance.onDeath(instance);
    instance.onDeath = undefined;
    instance.secondColor = undefined;
    instance.transitionTime = 0;
    instance.colorChanged = false;
    this._pool.push(instance);
  },
};

// Spark
interface SparkInstance {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  color: string;
  speedX: number;
  speedY: number;
  life: number;
}

export const Spark = {
  drawWidth: 0.75,
  airDrag: 0.9,

  active: createParticleCollection<SparkInstance>(),
  _pool: [] as SparkInstance[],

  _new(): SparkInstance {
    return { x: 0, y: 0, prevX: 0, prevY: 0, color: '', speedX: 0, speedY: 0, life: 0 };
  },

  add(x: number, y: number, color: string | string[], angle: number, speed: number, life: number): SparkInstance {
    const instance = this._pool.pop() || this._new();

    instance.x = x;
    instance.y = y;
    instance.prevX = x;
    instance.prevY = y;
    instance.color = color as string;
    instance.speedX = Math.sin(angle) * speed;
    instance.speedY = Math.cos(angle) * speed;
    instance.life = life;

    this.active[color as string].push(instance);
    return instance;
  },

  returnInstance(instance: SparkInstance): void {
    this._pool.push(instance);
  },
};
