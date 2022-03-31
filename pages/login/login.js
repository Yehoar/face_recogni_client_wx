// pages/login/login.js
const request = require("../../http/request");

Page({
    /**
     * 页面的初始数据
     */
    data: {
        account: "",
        passwd: "",
        btnDisabled: true,
        btnType: "default",
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) {},

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {

    },

    setAccount(e) {
        var content = e.detail.value;
        if (content != "") {
            this.setData({ btnDisabled: false, btnType: "primary", account: content });
        } else {
            this.setData({ btnDisabled: true, btnType: "default", account: "" });
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
        const account = this.data["account"];
        const passwd = this.data["passwd"];
        if (account < 11 || passwd.length < 8) {
            wx.showToast({ title: '请正确填写账号密码', });
            return;
        }
        request.api_Login({ account: account, passwd: passwd });
    },

    bindTapRegister() {
        wx.redirectTo({ url: '../register/register?delta=2' });
    }

})