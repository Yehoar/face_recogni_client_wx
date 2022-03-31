// index.js
// 获取应用实例
const app = getApp();
const request = require("../../http/request");

Page({
  user: null,
  ready: false,

  data: {
    isLogin: false,
  },
  onLoad: function () { },
  onReady: function () { },
  onShow: function () { },

  isOk: function () {
    const user = app.globalData.user;
    const ready = app.globalData.ready;
    if (!ready) {
      wx.showToast({ title: "请重启小程序!", icon: "error", duration: 2200 });
    } else if (user === undefined || user === "") {
      wx.showModal({
        title: "提示",
        content: "您尚未登录",
        showCancel: true,
        cancelText: "注册",
        confirmText: "登录",
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: "../login/login" });
          } else if (res.cancel) {
            wx.navigateTo({ url: "../register/register" });
          }
        },
      });
    } else {
      this.ready = ready;
      this.user = user;
      this.setData({ isLogin: false });
      return true;
    }
    return false;
  },

  /**
   * 按钮事件处理函数，人脸采集
   */
  bindBtnCollect: function () {
    // 权限检查
    if (this.isOk()) {
      wx.navigateTo({ url: "../recogni/recogni?page_type=collect" });
    }
  },

  /**
   * 按钮事件处理函数，考生识别
   */
  bindBtnRecogni: function () {
    // 会话检查
    if (this.isOk()) {
      wx.navigateTo({ url: "../recogni/recogni?page_type=recogni" });
    }
  },

  /**
   * 按钮事件处理函数，考试管理
   */
  bindBtnExamManage: function () {
    if (this.isOk()) {

    }
  },

  /**
   * 按钮事件处理函数，系统管理
   */
  bindBtnSysManage: function () {
    if (this.isOk()) {

    }
  },

  /**
   * 按钮事件处理函数，退出登录，暂不使用
   */
  bindBtnLogout: function () {
    // 会话检查
    if (this.isOk()) {
      // 权限检查
      request.api_Logout().then(
        (_) => { wx.showToast({ title: '您已注销登录！', icon: "none" }) },
      );
    }
  },

})
