<template>
  <div ref="stageContainer" class="stage-container">
    <div ref="canvasContainer" class="canvas-container">
      <canvas ref="trailsCanvas" id="trails-canvas"> </canvas>
      <canvas ref="mainCanvas" id="main-canvas"> </canvas>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted, reactive, ref } from 'vue'
import {
  soundManager,
  shellFromConfig,
  getRandomShellPositionH,
  getRandomShellPositionV,
  getRandomShellSize,
  shellTypes,
  randomFastShell,
  COLOR_CODES_W_INVIS,
  INVISIBLE,
  COLOR_CODES,
  COLOR_TUPLES,
  COLOR,
} from './utils'
import type { ShellType } from './utils'
import { Shell, Star, Spark, BurstFlash } from './shell'
import type { TWordShell } from './shell'
import Stage from './stage'
type EventWithCanvas<T extends MouseEvent> = T & { e: MouseEvent | TouchEvent }
interface SeqSmallBarrageFunction {
  (): Promise<number> // 函数签名
  lastCalled?: number // 扩展的属性
  cooldown?: number
}
export default defineComponent({
  name: 'FireworkIndex',
  setup() {
    const IS_DESKTOP = window.innerWidth > 800
    const trailsCanvas = ref<HTMLCanvasElement | null>(null)
    const mainCanvas = ref<HTMLCanvasElement | null>(null)
    const canvasContainer = ref<HTMLDivElement | null>(null)
    const stageContainer = ref<HTMLDivElement | null>(null)
    let trailsStage: InstanceType<typeof Stage> | null = null
    let mainStage: InstanceType<typeof Stage> | null = null
    let stages: (InstanceType<typeof Stage> | null)[] = [trailsStage, mainStage]
    const running = ref(false)
    const simSpeed = 1
    let currentFrame = 0
    const isUpdatingSpeed = false
    let speedBarOpacity = 0
    const QUALITY_NORMAL = 2
    const QUALITY_HIGH = 3
    const GRAVITY = 0.9 //以像素/秒为单位的加速度
    //考虑比例的宽度/高度值。
    //使用这些来绘制位置
    let stageW: number, stageH: number
    //防止画布在荒谬的屏幕尺寸上变得过大。
    const MAX_WIDTH = 700 // 我们只要mobile，所以直接最大700
    const MAX_HEIGHT = 4320
    const fireworkConfig = reactive({
      quality: 3,
      // 烟花类型，默认为 'Random'
      shell: 'Strobe' as ShellType,
      // 根据不同的设备设置烟花的大小
      size: IS_DESKTOP ? 3 : 2,
      // 天空光照强度，默认为正常强度，存储为字符串
      skyLighting: 2,
      // 是否启用长曝光，初始化为 false
      longExposure: false,
      // 缩放因子，通过调用 getDefaultScaleFactor 函数获取
      scaleFactor: 0.9,
      // 是否可以点击发射
      clickShell: false
    })
    // 高配置检查，默认全部normal
    const IS_HIGH_END_DEVICE = () => {
      const hwConcurrency = navigator.hardwareConcurrency
      if (!hwConcurrency) {
        return false
      }
      //大屏幕显示的是全尺寸的计算机，现在的计算机通常都有超线程技术。
      //所以一台四核台式机有8个核心。我们将在那里设置一个更高的最小阈值。
      const minCount = window.innerWidth <= 1024 ? 4 : 8
      return hwConcurrency >= minCount
    }
    function handleResize() {
      const w = window.innerWidth
      const h = window.innerHeight
      // +1避免有缝隙
      const containerW = Math.min(w, MAX_WIDTH) + 1
      const containerH = (w <= 420 ? h : Math.min(h, MAX_HEIGHT)) + 1
      if (stageContainer.value) {
        stageContainer.value.style.width = `${containerW}px`
        stageContainer.value.style.height = `${containerH}px`
      }
      stages.forEach((stage) => stage && stage.resize(containerW, containerH))
      const scaleFactor = fireworkConfig.scaleFactor
      stageW = containerW / scaleFactor
      stageH = containerH / scaleFactor
    }
    // 控制播放暂停
    const togglePause = (val: boolean) => {
      running.value = val
    }
    // 加载静态资源
    const loadStatic = () => {
      const promises = [soundManager.preload()]
      return Promise.all(promises)
    }

    function handlePointerStart(event: EventWithCanvas<MouseEvent>) {
      if (!running.value) return
      if (event.e.target instanceof HTMLCanvasElement) {
        launchShellFromConfig(event)
      }
    }

    // 根据鼠标位置发射一个烟花
    const launchShellFromConfig = (event: MouseEvent) => {
      const shell = new Shell(
        shellFromConfig(fireworkConfig.shell, fireworkConfig.size)
      )
      if (!mainStage) return
      const w = mainStage.width
      const h = mainStage.height

      shell.launch(
        event ? event.x / w : getRandomShellPositionH(),
        event ? 1 - event.y / h : getRandomShellPositionV(),
        stageW,
        stageH
      )
    }
    /**
     * 往正中央打一发烟花，带大字
     */
     function seqCenterShell(wordShell: TWordShell): Promise<number> {
      // 根据配置创建一个新的烟花壳
      const shell = new Shell({
        ...shellFromConfig(fireworkConfig.shell, fireworkConfig.size),
        wordShell
      })

      // 发射烟花
      shell.launch(0.5, 0.7, stageW, stageH)

      // 计算额外延迟时间
      let extraDelay = shell.starLife || 0
      // 如果有落叶效果，则延长延迟时间
      if (shell.fallingLeaves) {
        extraDelay = 4600
      }
      const duration = 900 + Math.random() * 600 + extraDelay
      // 返回总延迟时间
      return new Promise((resolve) =>
        setTimeout(() => resolve(duration), duration)
      )
     }
    /**
     * 随机发射烟花（一个或者多个）
     */
    function seqRandomShell(): Promise<number> {
      // 获取一个随机的烟花壳大小
      const size = getRandomShellSize(fireworkConfig.size)
      // 根据配置创建一个新的烟花壳
      const shell = new Shell({
        ...shellFromConfig(fireworkConfig.shell, size.size)
      })

      // 发射烟花
      shell.launch(size.x, size.height, stageW, stageH)

      // 计算额外延迟时间
      let extraDelay = shell.starLife || 0
      // 如果有落叶效果，则延长延迟时间
      if (shell.fallingLeaves) {
        extraDelay = 4600
      }
      const duration = 900 + Math.random() * 600 + extraDelay
      // 返回总延迟时间
      return new Promise((resolve) =>
        setTimeout(() => resolve(duration), duration)
      )
    }

    /**
     * 发射两个随机烟花
     * @returns {number} 返回下一个序列的延迟时间
     */
    function seqTwoRandom(): Promise<number> {
      // 获取两个随机的烟花壳大小
      const size1 = getRandomShellSize(fireworkConfig.size)
      const size2 = getRandomShellSize(fireworkConfig.size)
      // 根据配置创建两个新的烟花壳
      const shell1 = new Shell(
        shellFromConfig(fireworkConfig.shell, size1.size)
      )
      const shell2 = new Shell(
        shellFromConfig(fireworkConfig.shell, size2.size)
      )
      // 计算左右偏移量
      const leftOffset = Math.random() * 0.2 - 0.1
      const rightOffset = Math.random() * 0.2 - 0.1
      // 发射第一个烟花
      shell1.launch(0.3 + leftOffset, size1.height, stageW, stageH)
      // 延迟 100 毫秒后发射第二个烟花
      setTimeout(() => {
        shell2.launch(0.7 + rightOffset, size2.height, stageW, stageH)
      }, 100)

      // 计算额外延迟时间
      let extraDelay = Math.max(shell1.starLife || 0, shell2.starLife || 0)
      // 如果有落叶效果，则延长延迟时间
      if (shell1.fallingLeaves || shell2.fallingLeaves) {
        extraDelay = 4600
      }
      const duration = 900 + Math.random() * 600 + extraDelay
      // 返回总延迟时间
      return new Promise((resolve) =>
        setTimeout(() => resolve(duration), duration)
      )
    }

    /**
     * 发射三个烟花
     * @returns {number} 返回下一个序列的延迟时间
     */
    function seqTriple(): Promise<number> {
      // 获取一个随机的烟花壳类型
      const shellType = randomFastShell(fireworkConfig.shell)
      // 获取一个基准烟花壳大小
      const baseSize = fireworkConfig.size
      // 计算小烟花壳的大小
      const smallSize = Math.max(0, baseSize - 1.25)

      // 计算偏移量
      const offset = Math.random() * 0.08 - 0.04
      // 创建并发射第一个烟花
      const shell1 = new Shell(shellType(baseSize))
      shell1.launch(0.5 + offset, 0.7, stageW, stageH)

      // 计算左右延迟时间
      const leftDelay = 1000 + Math.random() * 400
      const rightDelay = 1000 + Math.random() * 400

      // 延迟后发射第二个和第三个烟花
      setTimeout(() => {
        const offset = Math.random() * 0.08 - 0.04
        const shell2 = new Shell(shellType(smallSize))
        shell2.launch(0.2 + offset, 0.1, stageW, stageH)
      }, leftDelay)

      setTimeout(() => {
        const offset = Math.random() * 0.08 - 0.04
        const shell3 = new Shell(shellType(smallSize))
        shell3.launch(0.8 + offset, 0.1, stageW, stageH)
      }, rightDelay)

      // 返回总延迟时间
      return new Promise((resolve) => setTimeout(() => resolve(4000), 4000))
    }

    /**
     * 发射一个金字塔形状的烟花弹幕
     * @returns {number} 返回下一个序列的延迟时间
     */
    function seqPyramid(): Promise<number> {
      // 根据设备类型确定弹幕数量的一半
      const barrageCountHalf = IS_DESKTOP ? 7 : 4
      // 获取一个大的烟花壳大小
      const largeSize = fireworkConfig.size
      // 计算小烟花壳的大小
      const smallSize = Math.max(0, largeSize - 3)
      // 随机选择主要烟花壳类型
      const randomMainShell =
        Math.random() < 0.78 ? shellTypes.Crysanthemum : shellTypes.Ring
      // 随机选择特殊烟花壳类型
      const randomSpecialShell = shellTypes.Random

      // 定义一个发射烟花的函数
      function launchShell(x: number, useSpecial: boolean) {
        // 判断是否随机选择烟花类型
        const isRandom = fireworkConfig.shell === 'Random'
        // 根据是否随机和是否特殊选择烟花类型
        const shellType = isRandom
          ? useSpecial
            ? randomSpecialShell
            : randomMainShell
          : shellTypes[fireworkConfig.shell]
        // 创建并发射烟花
        const shell = new Shell(shellType(useSpecial ? largeSize : smallSize))
        // 计算发射高度
        const height = x <= 0.5 ? x / 0.5 : (1 - x) / 0.5
        shell.launch(x, useSpecial ? 0.75 : height * 0.42, stageW, stageH)
      }

      // 初始化计数器和延迟时间
      let count = 0
      let delay = 0
      // 循环发射烟花
      while (count <= barrageCountHalf) {
        // 如果是最后一个烟花
        if (count === barrageCountHalf) {
          // 延迟后发射特殊烟花
          setTimeout(() => {
            launchShell(0.5, true)
          }, delay)
        } else {
          // 计算偏移量
          const offset = (count / barrageCountHalf) * 0.5
          // 随机延迟偏移量
          const delayOffset = Math.random() * 30 + 30
          // 发射两个烟花
          setTimeout(() => {
            launchShell(offset, false)
          }, delay)
          setTimeout(() => {
            launchShell(1 - offset, false)
          }, delay + delayOffset)
        }

        // 更新计数器和延迟时间
        count++
        delay += 200
      }
      const duration = 3400 + barrageCountHalf * 250

      // 返回总延迟时间
      return new Promise((resolve) =>
        setTimeout(() => resolve(duration), duration)
      )
    }

    /**
     * 发射一个小弹幕烟花
     * @returns {number} 返回下一个序列的延迟时间
     */
    const seqSmallBarrage: SeqSmallBarrageFunction = () => {
      // 更新上次发射时间
      seqSmallBarrage.lastCalled = Date.now()
      // 根据设备类型确定弹幕数量
      const barrageCount = 7
      // 获取烟花壳大小
      const shellSize = Math.max(0, fireworkConfig.size - 2)
      // 随机选择主要烟花壳类型
      // const randomMainShell =
      //   Math.random() < 0.78 ? shellTypes.Crysanthemum : shellTypes.Ring
      // 随机选择特殊烟花壳类型
      // const randomSpecialShell = randomFastShell(fireworkConfig.shell)

      // 定义一个发射烟花的函数
      function launchShell(x: number) {
        // 判断是否随机选择烟花类型
        // const isRandom = fireworkConfig.shell === 'Random'
        // 根据是否随机和是否特殊选择烟花类型
        const shellType = randomFastShell(fireworkConfig.shell)
        // 创建并发射烟花
        const shell = new Shell(shellType(shellSize))
        // 计算发射高度
        const height = (Math.cos(x * 5 * Math.PI + Math.PI * 0.5) + 1) / 2
        shell.launch(x, height * 0.75, stageW, stageH)
      }

      // 初始化计数器和延迟时间
      let count = 0
      let delay = 0
      // 循环发射烟花
      while (count < barrageCount) {
        // 如果是第一个烟花
        if (count === 0) {
          // 发射第一个烟花
          launchShell(0.5)
          count += 1
        } else {
          // 计算偏移量
          const offset = (count + 1) / barrageCount / 2
          // 随机延迟偏移量
          const delayOffset = Math.random() * 30 + 30
          // 发射两个烟花
          setTimeout(() => {
            launchShell(0.5 + offset)
          }, delay)
          setTimeout(() => {
            launchShell(0.5 - offset)
          }, delay + delayOffset)
          count += 2
        }
        // 更新延迟时间
        delay += 200
      }
      const duration = 3400 + barrageCount * 120
      // 返回总延迟时间
      return new Promise((resolve) =>
        setTimeout(() => resolve(duration), duration)
      )
    }

    seqSmallBarrage.cooldown = 15000
    seqSmallBarrage.lastCalled = Date.now()

    //帧绘制回调
    function update(frameTime: number, lag: number) {
      if (!running.value) return
      // 计算时间步长，根据帧时间和模拟速度得出
      const timeStep = frameTime * simSpeed
      // 计算速度，根据模拟速度和延迟得出
      const speed = simSpeed * lag
      updateGlobals(timeStep, lag)
      // 计算不同元素的空气阻力系数，考虑速度的影响
      const starDrag = 1 - (1 - Star.airDrag) * speed
      const starDragHeavy = 1 - (1 - Star.airDragHeavy) * speed
      const sparkDrag = 1 - (1 - Spark.airDrag) * speed
      // 计算重力加速度，根据时间步长和预定义的重力常数得出
      const gAcc = (timeStep / 1000) * GRAVITY

      // 遍历颜色代码（包含不可见颜色）
      COLOR_CODES_W_INVIS.forEach((color) => {
        // 绘制星花
        const stars = Star.active[color]
        for (let i = stars.length - 1; i >= 0; i = i - 1) {
          const star = stars[i]
          // 确保每个星花在一帧内只更新一次，避免颜色改变时可能出现的跳跃现象
          if (star.updateFrame === currentFrame) {
            continue
          }
          star.updateFrame = currentFrame

          // 减少星花的生命周期
          star.life -= timeStep
          // 星花生命周期结束，回收实例
          if (star.life <= 0) {
            stars.splice(i, 1)
            Star.returnInstance(star)
          } else {
            // 计算燃烧率，根据星花的剩余生命周期和完整生命周期得出
            const burnRate = Math.pow(star.life / star.fullLife, 0.5)
            const burnRateInverse = 1 - burnRate

            // 记录星花之前的位置
            star.prevX = star.x
            star.prevY = star.y
            // 根据速度更新星花的位置
            star.x += star.speedX * speed
            star.y += star.speedY * speed
            // 如果星花不是“heavy”类型，应用普通的空气阻力，否则应用更重的空气阻力
            if (!star.heavy) {
              star.speedX *= starDrag
              star.speedY *= starDrag
            } else {
              star.speedX *= starDragHeavy
              star.speedY *= starDragHeavy
            }
            // 应用重力加速度到星花的垂直速度
            star.speedY += gAcc

            // 如果星花有旋转半径，根据旋转速度更新位置
            if (star.spinRadius) {
              star.spinAngle += star.spinSpeed * speed
              star.x += Math.sin(star.spinAngle) * star.spinRadius * speed
              star.y += Math.cos(star.spinAngle) * star.spinRadius * speed
            }

            // 如果星花有火花频率，处理火花的生成
            if (star.sparkFreq) {
              star.sparkTimer -= timeStep
              while (star.sparkTimer < 0) {
                star.sparkTimer +=
                  star.sparkFreq * 0.75 + star.sparkFreq * burnRateInverse * 4
                Spark.add(
                  star.x,
                  star.y,
                  star.sparkColor,
                  Math.random() * Math.PI * 2,
                  Math.random() * star.sparkSpeed * burnRate,
                  star.sparkLife * 0.8 +
                    Math.random() * star.sparkLifeVariation * star.sparkLife
                )
              }
            }

            // 处理星花的过渡效果
            if (star.life < (star.transitionTime as number)) {
              if (star.secondColor && !star.colorChanged) {
                star.colorChanged = true
                star.color = star.secondColor
                stars.splice(i, 1)
                Star.active[star.secondColor].push(star)
                if (star.secondColor === INVISIBLE) {
                  star.sparkFreq = 0
                }
              }

              if (star.strobe) {
                // 按照频闪频率，以 on:off:off:on:off:off 的模式闪烁
                star.visible =
                  Math.floor(star.life / (star.strobeFreq as number)) % 3 === 0
              }
            }
          }
        }

        // 绘制火花
        const sparks = Spark.active[color]
        for (let i = sparks.length - 1; i >= 0; i = i - 1) {
          const spark = sparks[i]
          // 减少火花的生命周期
          spark.life -= timeStep
          if (spark.life <= 0) {
            sparks.splice(i, 1)
            Spark.returnInstance(spark)
          } else {
            // 记录火花之前的位置
            spark.prevX = spark.x
            spark.prevY = spark.y
            // 根据速度更新火花的位置
            spark.x += spark.speedX * speed
            spark.y += spark.speedY * speed
            // 应用空气阻力
            spark.speedX *= sparkDrag
            spark.speedY *= sparkDrag
            // 应用重力加速度到火花的垂直速度
            spark.speedY += gAcc
          }
        }
      })

      // 进行渲染操作，传入速度作为参数
      render(speed)
    }

    function updateGlobals(frameTime: number, lag: number) {
      // 更新当前帧计数器
      currentFrame++

      // 如果没有正在更新速度，则尝试淡出速度条
      if (!isUpdatingSpeed) {
        // 逐渐减少速度条的不透明度
        speedBarOpacity -= lag / 30 // 半秒内淡出
        // 如果不透明度小于0，则将其设置为0
        if (speedBarOpacity < 0) {
          speedBarOpacity = 0
        }
      }
    }

    function render(speed: number) {
      if (!mainStage || !trailsStage) return
      // 获取主舞台的设备像素比（dpr）
      const { dpr } = mainStage
      // 获取舞台的宽度和高度
      const width = stageW
      const height = stageH
      // 获取轨迹阶段的 2D 上下文
      const trailsCtx = trailsStage.ctx
      // 获取主舞台的 2D 上下文
      const mainCtx = mainStage.ctx

      // 如果天空光照选择器的结果不是不照亮天空（SKY_LIGHT_NONE），则调用 colorSky 函数进行天空颜色的处理
      if (fireworkConfig.skyLighting !== 0) {
        colorSky(speed, fireworkConfig.skyLighting)
        // 照亮天空
      }

      // 考虑高 DPI 屏幕和自定义缩放因子
      const scaleFactor = fireworkConfig.scaleFactor
      // 对轨迹阶段的上下文进行缩放操作，考虑设备像素比和缩放因子
      trailsCtx.scale(dpr * scaleFactor, dpr * scaleFactor)
      // 对主舞台的上下文进行缩放操作，考虑设备像素比和缩放因子
      mainCtx.scale(dpr * scaleFactor, dpr * scaleFactor)

      // 设置轨迹阶段的合成操作模式为 source-over
      trailsCtx.globalCompositeOperation = 'source-over'
      // 设置轨迹阶段的填充样式，根据是否启用长曝光和速度计算不透明度
      trailsCtx.fillStyle = `rgba(0, 0, 0, ${
        fireworkConfig.longExposure ? 0.0025 : 0.175 * speed
      })`
      // 填充整个舞台为黑色背景，根据上述填充样式
      trailsCtx.fillRect(0, 0, width, height)

      // 清除主舞台的矩形区域
      mainCtx.clearRect(0, 0, width, height)

      // 绘制二次爆炸的爆发闪光
      // 由于 Safari 的原因，这些也必须使用 source-over 绘制。使用 lighten 渲染渐变会出现大的黑色框。
      // 幸运的是，这些爆发闪光无论如何看起来都差不多。
      while (BurstFlash.active.length) {
        const bf = BurstFlash.active.pop()
        if (!bf) return
        // 创建径向渐变对象，用于绘制爆发闪光效果
        const burstGradient = trailsCtx.createRadialGradient(
          bf.x,
          bf.y,
          0,
          bf.x,
          bf.y,
          bf.radius
        )
        burstGradient.addColorStop(0.024, 'rgba(255, 255, 255, 1)')
        burstGradient.addColorStop(0.125, 'rgba(255, 160, 20, 0.2)')
        burstGradient.addColorStop(0.32, 'rgba(255, 140, 20, 0.11)')
        burstGradient.addColorStop(1, 'rgba(255, 120, 20, 0)')
        // 设置填充样式为创建的渐变对象
        trailsCtx.fillStyle = burstGradient
        // 绘制矩形区域以显示爆发闪光效果
        trailsCtx.fillRect(
          bf.x - bf.radius,
          bf.y - bf.radius,
          bf.radius * 2,
          bf.radius * 2
        )
        // 将爆发闪光实例回收到对象池
        BurstFlash.returnInstance(bf)
      }

      // 轨迹画布上的剩余绘制将使用 'lighten' 混合模式
      trailsCtx.globalCompositeOperation = 'lighten'

      // 绘制烟花头和爆炸
      trailsCtx.lineWidth = 3
      // 根据画质质量设置线条端点样式
      trailsCtx.lineCap = 'round'
      mainCtx.strokeStyle = '#fff'
      mainCtx.lineWidth = 1
      mainCtx.beginPath()
      COLOR_CODES.forEach((color) => {
        const stars = Star.active[color]
        // 设置轨迹阶段的线条颜色
        trailsCtx.strokeStyle = color
        trailsCtx.beginPath()
        stars.forEach((star) => {
          if (star.visible) {
            // 设置轨迹阶段的线条宽度
            trailsCtx.lineWidth = star.size
            // 移动到星星的当前位置
            trailsCtx.moveTo(star.x, star.y)
            // 绘制到星星的前一个位置
            trailsCtx.lineTo(star.prevX, star.prevY)
            mainCtx.moveTo(star.x, star.y)
            // 绘制一个小线段表示星星的速度方向
            mainCtx.lineTo(
              star.x - star.speedX * 1.6,
              star.y - star.speedY * 1.6
            )
          }
        })
        // 绘制轨迹阶段的线条
        trailsCtx.stroke()
      })
      // 绘制主舞台的线条
      mainCtx.stroke()

      // 绘制跟在烟花头后面的火花
      trailsCtx.lineWidth = Spark.drawWidth
      trailsCtx.lineCap = 'butt'
      COLOR_CODES.forEach((color) => {
        const sparks = Spark.active[color]
        // 设置轨迹阶段的线条颜色
        trailsCtx.strokeStyle = color
        trailsCtx.beginPath()
        sparks.forEach((spark) => {
          // 移动到火花的当前位置
          trailsCtx.moveTo(spark.x, spark.y)
          // 绘制到火花的前一个位置
          trailsCtx.lineTo(spark.prevX, spark.prevY)
        })
        // 绘制轨迹阶段的线条
        trailsCtx.stroke()
      })

      // 如果速度条的不透明度不为零，则渲染速度条
      if (speedBarOpacity) {
        const speedBarHeight = 6
        mainCtx.globalAlpha = speedBarOpacity
        mainCtx.fillStyle = COLOR.Blue
        // 填充矩形表示速度条
        mainCtx.fillRect(
          0,
          height - speedBarHeight,
          width * simSpeed,
          speedBarHeight
        )
        mainCtx.globalAlpha = 1
      }

      // 重置轨迹阶段的变换矩阵
      trailsCtx.setTransform(1, 0, 0, 1, 0, 0)
      // 重置主舞台的变换矩阵
      mainCtx.setTransform(1, 0, 0, 1, 0, 0)
    }

    /**
     * 天空颜色
     */
    const currentSkyColor = { r: 0, g: 0, b: 0 }
    const targetSkyColor = { r: 0, g: 0, b: 0 }
    function colorSky(speed: number, skyLighting: number) {
      // 天空饱和度的最大值（255 表示无最大值），根据天空光照选择器的结果计算
      const maxSkySaturation = skyLighting * 15
      // 达到最大天空亮度所需的星星总数
      const maxStarCount = 500
      // 统计星星的总数
      let totalStarCount = 0
      // 初始化目标天空颜色为黑色
      targetSkyColor.r = 0
      targetSkyColor.g = 0
      targetSkyColor.b = 0
      // 将每个已知颜色乘以该颜色的粒子数添加到天空颜色中。这会使 RGB 值超出范围，但稍后会将其缩放回来。同时统计星星的总数。
      COLOR_CODES.forEach((color) => {
        const tuple = COLOR_TUPLES[color]
        const count = Star.active[color].length
        totalStarCount += count
        targetSkyColor.r += tuple.r * count
        targetSkyColor.g += tuple.g * count
        targetSkyColor.b += tuple.b * count
      })

      // 将强度限制在 1.0 以内，并映射到自定义的非线性曲线。这样可以使少量星星就能明显照亮天空，而更多星星会继续增加亮度，但速度较慢。这更符合人类对亮度的非线性感知。
      const intensity = Math.pow(
        Math.min(1, totalStarCount / maxStarCount),
        0.3
      )
      // 找出哪个颜色分量的值最高，以便在不影响比例的情况下对它们进行缩放。防止除数为 0。
      const maxColorComponent = Math.max(
        1,
        targetSkyColor.r,
        targetSkyColor.g,
        targetSkyColor.b
      )
      // 将所有颜色分量缩放到最大为 maxSkySaturation，并应用强度。
      targetSkyColor.r =
        (targetSkyColor.r / maxColorComponent) * maxSkySaturation * intensity
      targetSkyColor.g =
        (targetSkyColor.g / maxColorComponent) * maxSkySaturation * intensity
      targetSkyColor.b =
        (targetSkyColor.b / maxColorComponent) * maxSkySaturation * intensity

      // 为颜色变化添加动画效果，以平滑过渡。
      const colorChange = 10
      currentSkyColor.r +=
        ((targetSkyColor.r - currentSkyColor.r) / colorChange) * speed
      currentSkyColor.g +=
        ((targetSkyColor.g - currentSkyColor.g) / colorChange) * speed
      currentSkyColor.b +=
        ((targetSkyColor.b - currentSkyColor.b) / colorChange) * speed

      // 将计算得到的当前天空颜色设置为画布容器的背景颜色
      if (canvasContainer.value) {
        canvasContainer.value.style.backgroundColor = `rgb(${
          currentSkyColor.r | 0
        }, ${currentSkyColor.g | 0}, ${currentSkyColor.b | 0})`
      }
    }

    // 烟花发射大全
    const sequences = [
      seqRandomShell,
      seqTwoRandom,
      seqTriple,
      seqPyramid,
      seqSmallBarrage,
    ]
    const fireworkCase: ShellType[][] = [
      ['Falling Leaves', 'Willow'],
      ['Crackle', 'Crossette'],
      ['Ring', 'Ring'],
      ['Strobe', 'Strobe'],
      ['Crackle', 'Strobe'],
      ['Strobe', 'Crossette'],
    ]

    function getRandom() {
      return Math.floor(Math.random() * 5)
    }
    function getRandom05() {
      return Math.floor(Math.random() * 6)
    }

    // 依次播放烟花
    async function runSequences() {
      let duration = 0
      // 播放數量
      const shellNum = 12
      const caseConfig = fireworkCase[getRandom05()]
      fireworkConfig.shell = getRandom() >= 2 ? caseConfig[0] : caseConfig[1]
      await seqCenterShell({
        fontSize: 80,
        word: '新年快樂'
      })
      for (let i = 0; i < shellNum; i++) {
        fireworkConfig.shell = getRandom05() > 2 ? caseConfig[0] : caseConfig[1]
        const shellTypeIndex = i === 11 ? 4 : getRandom()
        duration = await sequences[shellTypeIndex]() // 等待函数执行完毕
      }
      return duration
    }

    const start = async () => {
      if (!mainStage) return 0
      // 点击事件
      if (fireworkConfig.clickShell) {
        mainStage.addEventListener('pointerstart', handlePointerStart);
      }

      mainStage?.addEventListener('ticker', update)
      window.addEventListener('resize', handleResize)
      await loadStatic()
      togglePause(true)
      return await runSequences()
    }

    const destroy = () => {
      togglePause(false)
      if (fireworkConfig.clickShell) {
        mainStage?.removeEventListener('pointerstart', handlePointerStart)
      }
      mainStage?.removeEventListener('ticker', update)
      window.removeEventListener('resize', handleResize)
      muted()
    }
    const muted =(flag = true) => {
      if (flag) {
        soundManager.pauseAll()
      } else {
        soundManager.resumeAll()
      }
    }
    onMounted(() => {
      fireworkConfig.quality = IS_HIGH_END_DEVICE()
        ? QUALITY_HIGH
        : QUALITY_NORMAL
      trailsStage = new Stage('trails-canvas')
      mainStage = new Stage('main-canvas')
      stages = [trailsStage, mainStage]
      handleResize()
      void loadStatic()
      void start()
    })
    onUnmounted(() => {
      destroy()
    })
    return {
      fireworkConfig,
      trailsCanvas,
      mainCanvas,
      canvasContainer,
      stageContainer,
      sequences,
      start,
      destroy,
      muted
    }
  },
})
</script>

<style lang="scss">
.canvas-container {
  width: 100%;
  height: 100%;
  transition: filter 0.3s;
}
.canvas-container canvas {
  position: absolute;
  mix-blend-mode: lighten;
  transform: translateZ(0);
}
.stage-container {
  overflow: hidden;
  box-sizing: initial;
  margin: -1px;
}
#main-canvas {
  background-color: #0d1a2b;
}

@media (max-width: 840px) {
  .stage-container {
    border: none;
    margin: 0;
  }
}
</style>
