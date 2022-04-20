// pages/logon/logon.js
const request = require("../../http/request");

Page({
    /**
     * 页面的初始数据
     */
    data: {
        visable: false,
        userId: "",
        clazz: "",
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) { },

    setVisable(e) {
        this.setData({ visable: e.detail.value });
    },
    
    setUserId(e) {
        let value = e.detail.value;
        this.setData({ userId: value.replace(/\D/g, '') })
    },

    setClazz(e) {
        let value = e.detail.value;
        this.setData({ clazz: value.replace(/\D/g, '') })
    },

    submit: function (e) {
        let user = {};
        user.userId = e.detail.value.userId.toString();
        user.name = e.detail.value.name.toString();
        user.department = e.detail.value.department.toString();
        user.major = e.detail.value.major.toString();
        user.clazz = e.detail.value.clazz;
        user.passwd = e.detail.value.passwd.toString();

        if (user.userId == "" || user.userId.length != 11) {
            wx.showToast({ title: "学号格式错误", icon: "none" });
        } else if (user.name == "") {
            wx.showToast({ title: "请输入姓名", icon: "none" });
        } else if (user.department == "") {
            wx.showToast({ title: "请输入学院", icon: "none" });
        } else if (user.major == "") {
            wx.showToast({ title: "请输入专业", icon: "none" });
        } else if (user.clazz == "") {
            wx.showToast({ title: "请输入班级", icon: "none" });
        } else if (user.passwd.length < 8 || user.passwd.length > 16) {
            wx.showToast({ title: "密码长度必须在8~16位之间", icon: "none" });
        } else {
            // 其他合法性检查
            if (!user.department.includes("学院")) {
                user.department = user.department + "学院";
            }

            let major = user.major;
            if (major.slice(major.length - 2) == "专业") {
                user.major = major.slice(0, major.length - 2);
            }
            request.api_Register(user);
        }
    },

})