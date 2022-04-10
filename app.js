// app.js
const fetchWechat = require('fetch-wechat');
const tf = require('@tensorflow/tfjs-core');
const webgl = require('@tensorflow/tfjs-backend-webgl');
const cpu = require('@tensorflow/tfjs-backend-cpu');
const plugin = requirePlugin('tfjsPlugin');
const request = require("./http/request");


App({
  onLaunch() {
    wx.showLoading({ title: '正在初始化', mask: true });
    // 初始化
    this.init();
    //测试
    this.test();
    // 创建会话
    request.api_InitSession().then(
      () => {
        wx.hideLoading();
      }, (res) => {
        wx.hideLoading();
        wx.showToast(res);
      }).finally(() => { this.globalData.ready = true; });
  },

  init() {
    // 初始化tfjs
    plugin.configPlugin({
      // polyfill fetch function
      fetchFunc: fetchWechat.fetchFunc(),
      // inject tfjs runtime
      tf,
      // inject webgl backend
      webgl,
      // inject cpu backend
      cpu,
      // provide webgl canvas
      canvas: wx.createOffscreenCanvas()
    });

  },

  test() {
    //fsm
    let fs = wx.getFileSystemManager();
    fs.readdir({
      dirPath: `${wx.env.USER_DATA_PATH}/tensorflowjs_models`,
      success: (res) => { console.debug(res); },
      fail: (_) => { console.debug("No Cache File Was Found"); },
    })


  },

  globalData: {
    user: "",
    ready: false,
  }
})
