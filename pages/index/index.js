// index.js
// 获取应用实例
const app = getApp();
const request = require("../../http/request");

Page({
  data: {
    can_collect: true,
    can_recogni: true,
    can_manage: true,
    can_logout: false,
  },

  onShow: function () {
    let waitSessInit = setInterval(() => {
      if (app.globalData.ready) {
        clearInterval(waitSessInit);
        this.isOk();
      }
    }, 400);

  },

  isOk: function () {
    const user = app.globalData.user;
    if (user === undefined || user === "") {
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
      this.getPermission(user.userType);
      return true;
    }
    return false;
  },

  /**
   * 按钮事件处理函数，人脸采集
   */
  bindBtnCollect: function () {
    // 权限检查
    if (this.isOk() && this.data["can_collect"]) {
      wx.navigateTo({ url: "../recogni/recogni?page_type=collect" });
    }
  },

  /**
   * 按钮事件处理函数，考生识别
   */
  bindBtnRecogni: function () {
    // 权限检查
    if (this.isOk() && this.data["can_recogni"]) {
      wx.navigateTo({ url: "../recogni/recogni?page_type=recogni" });
    }
  },

  /**
   * 按钮事件处理函数，考试管理
   */
  bindBtnExamManage: function () {
    if (this.isOk() && this.data["can_manage"]) {
      wx.navigateTo({ url: "../exam/exam" });
    }
  },

  /**
   * 按钮事件处理函数，退出登录，暂不使用
   */
  bindBtnLogout: function () {
    // 会话检查
    if (this.isOk() && this.data["can_logout"]) {
      // 权限检查
      request.api_Logout().then(
        (_) => {
          app.globalData.user = "";
          this.setData({ can_collect: true, can_recogni: true, can_manage: true, can_logout: false });
          wx.showToast({ title: '您已注销登录！', icon: "none" })
        },
      );
    }
  },

  getPermission: function (userType) {
    if (userType === "Student") {
      this.setData({ can_collect: true, can_recogni: false, can_manage: false, can_logout: true });
    } else if (userType === "Teacher" || userType === "Administrator") {
      this.setData({ can_collect: false, can_recogni: true, can_manage: true, can_logout: true });
    } else {
      this.setData({ can_collect: true, can_recogni: true, can_manage: true, can_logout: false });
    }
  },

})
