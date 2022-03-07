// app.js
const fetchWechat = require('fetch-wechat');
const tf = require('@tensorflow/tfjs-core');
const webgl = require('@tensorflow/tfjs-backend-webgl');
const plugin = requirePlugin('tfjsPlugin');

import { url_for } from "./utils/index"

App({
  onLaunch() {
    // 初始化tfjs
    plugin.configPlugin({
      // polyfill fetch function
      fetchFunc: fetchWechat.fetchFunc(),
      // inject tfjs runtime
      tf,
      // inject webgl backend
      webgl,
      // provide webgl canvas
      canvas: wx.createOffscreenCanvas()
    });

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        if (res.code) {
          wx.request({
            url: url_for('init'),
            method: 'POST',
            data: { "code": res.code },
            success: res => {
              console.log(res)
              if (res.data["status_code"] === "success") {
                // wx.showToast({ title: '初始化成功', icon: "success" })
              } else {
                wx.showToast({ title: '初始化失败', icon: "error" })
              }
            }
          })
        }
      }
    })

  },
  globalData: {
    userInfo: null
  }
})
