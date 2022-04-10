// pages/login/login.js
const request = require("../../http/request");

Page({
    /**
     * 页面的初始数据
     */
    data: {
        userId: "",
        passwd: "",
        btnDisabled: true,
        btnType: "default",
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) { },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {

    },

    setUserId(e) {
        var content = e.detail.value;
        if (content != "") {
            this.setData({ btnDisabled: false, btnType: "primary", userId: content });
        } else {
            this.setData({ btnDisabled: true, btnType: "default", userId: "" });
        }
    },

    setPasswd(e) {
        var content = e.detail.value;
        if (content != "") {
            this.setData({ btnDisabled: false, btnType: "primary", passwd: content });
        } else {
            this.setData({ btnDisabled: true, btnType: "default", passwd: "" });
        }
    },

    bindBtnLogin() {
        const userId = this.data["userId"];
        const passwd = this.data["passwd"];
        if (userId.length < 6 || passwd.length < 8) {
            wx.showToast({ title: '账号密码格式错误', icon: "error" });
            return;
        }
        request.api_Login({ userId: userId.toString(), passwd: passwd.toString() });
    },

    bindTapRegister() {
        wx.redirectTo({ url: '../register/register?delta=2' });
    }

})