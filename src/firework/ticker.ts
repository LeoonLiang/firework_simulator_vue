function TickerFactory() {
  let started = false;
  let lastTimestamp = 0;
  const listeners: Array<(frameTime: number, deltaTime: number) => void> = [];

  // 内部函数：调度下一帧
  const queueFrame = () => requestAnimationFrame(frameHandler);

  // 帧处理函数
  const frameHandler = (timestamp: number) => {
    if (listeners.length === 0 ) {
      return
    }
    const frameTime = Math.max(0, Math.min(timestamp - lastTimestamp, 68)); // 限制帧时间在 [0, 68]
    lastTimestamp = timestamp;

    const deltaTime = frameTime / 16.6667; // 将帧时间转化为增量时间 (相对60fps)

    listeners.forEach((listener) => listener(frameTime, deltaTime));

    queueFrame(); // 调度下一帧
  };

  const Ticker = {
    /**
     * 添加一个监听器
     * @param callback - 帧回调函数，接收帧时间和增量时间
     */
    addListener(callback: (frameTime: number, deltaTime: number) => void) {
      if (typeof callback !== 'function') {
        throw new TypeError('Ticker.addListener() requires a function reference passed as a callback.');
      }

      listeners.push(callback);

      if (!started) {
        started = true;
        queueFrame();
      }
    },

    /**
    * 移除一个监听器
    * @param callback - 要移除的回调函数
    */
    removeListener(callback: (frameTime: number, deltaTime: number) => void) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    },
  };

  return Ticker;
}
const Ticker = TickerFactory();
export default Ticker
