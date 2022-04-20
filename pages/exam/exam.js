// pages/exam/exam.js
const request = require("../../http/request")
const examObj = { id: "-", subject: "-", examRoom: "-", time: "-", nums: "-" };

Page({

    /**
     * 页面的初始数据
     */
    data: {
        showHSD: false,
        examList: [],
        error: "",
        date: "-",
        beginTime: "-",
        endTime: "-",
        formData: {},
        file: "",
        rules: [{
            name: 'subject',
            rules: { required: true, message: '请填写考试科目' },
        }, {
            name: 'examRoom',
            rules: { required: true, message: '请填写考场信息' },
        }, {
            name: 'date',
            rules: { required: true, message: '请填写考试日期' },
        }, {
            name: 'beginTime',
            rules: { required: true, message: '请填写开始时间' },
        }, {
            name: 'endTime',
            rules: [{ required: true, message: '请填写结束时间' }],
        }, {
            name: 'file',
            rules: [{ required: true, message: '请选择考生名单' }],
        }]
    },

    onLoad: function () {
        this.getExamList();
    },

    initPage: function () {
        const examList = this.data.examList;
        let examId = null;
        try {
            let keys = wx.getStorageInfoSync().keys;
            for (let key of keys) {
                if (key.includes("examList-")) {
                    examId = parseInt(key.substr(9));
                    break;
                }
            }
        } catch (e) {
            console.error(e);
        }
        for (let item of examList) {
            let op = item.uuid == examId ? "delete" : "load";
            item.slideButtons = this.createSlideButton(op, item.uuid);
        }
        this.setData({ examList: examList })
    },

    newButtonTap: function (e) {
        this.setData({ showHSD: true });
    },

    formInputChange: function (e) {
        const { field } = e.currentTarget.dataset
        this.setData({
            [`formData.${field}`]: e.detail.value
        })
    },
    bindDateChange: function (e) {
        const { field } = e.currentTarget.dataset
        const obj = {};
        obj[field] = e.detail.value;
        obj[`formData.${field}`] = e.detail.value;
        this.setData(obj);
    },
    chooseFile: function (e) {
        var that = this;
        wx.chooseMessageFile({
            count: 1,
            type: 'file',
            success(res) {
                // tempFilePath可以作为img标签的src属性显示图片
                const tempFile = res.tempFiles[0];
                let filename = tempFile.name;
                if (filename < 4) { return; }
                let endString = filename.substr(filename.length - 4);
                if (endString != ".csv" && endString != "xlsx") {
                    wx.showToast({ title: '不支持的类型', icon: "error" });
                    return;
                }
                that.setData({ file: tempFile.name, [`formData.file`]: tempFile });
                console.debug(tempFile)
            }
        });
    },

    submitForm: function () {
        this.selectComponent('#form').validate((valid, errors) => {
            // console.log('valid', valid, errors)
            if (!valid) {  // 表单校验
                const firstError = Object.keys(errors)
                if (firstError.length) {
                    this.setData({ error: errors[firstError[0]].message })
                }
            } else {
                wx.showLoading({ title: "处理中", mask: true });
                const data = this.data;
                const obj = {
                    subject: data.formData.subject,
                    examRoom: data.formData.examRoom,
                    beginTime: `${data.formData.date} ${data.formData.beginTime}`,
                    endTime: `${data.formData.date} ${data.formData.endTime}`,
                    file: data.formData.file,
                    filetype: data.file.substr(data.file.length - 4)
                };
                request.api_CreateExam(obj).then((value) => {
                    //  success
                    obj["uuid"] = value["examId"];
                    obj["nums"] = value["nums"];
                    obj["time"] = `${data.formData.date} ${data.formData.beginTime}-${data.formData.endTime}`;
                    obj["slideButtons"] = this.createSlideButton("load", value["examId"]);
                    console.debug(value)
                    const examList = data.examList;
                    examList.push(obj);
                    this.setData({ examList: examList, showHSD: false });
                    wx.hideLoading();
                    wx.showToast({ title: "添加成功", icon: "success" });
                }, (res) => {
                    // fail
                    wx.hideLoading();
                    wx.showToast({ title: "添加失败", icon: "error" });
                    console.debug(res);
                });


            }
        })
    },
    /**
     * 获取当前用户最近10条考试信息
     */
    getExamList: function () {
        wx.showLoading({ title: "查询中", mask: true });
        const showFail = (res = "") => {
            wx.hideLoading();
            wx.showToast({ title: res, icon: "error" });
        }

        request.api_GetExamList(10).then(
            (data) => {
                if (data.status_code != "success") {
                    showFail(data.message);
                    return;
                }
                //success
                this.setData({ examList: data["info"] });
                this.initPage();
                console.debug(data);
                wx.hideLoading();
            },
            (res) => {
                // fail
                console.debug(res);
                showFail();
            }
        )
    },

    /**
     * 绑定按钮事件
     * @param {Object} e 
     */
    slideButtonTap: function (e) {
        // console.debug('slide button tap', e.detail)
        let index = e.detail["index"];
        let param = e.detail["data"];  //{op, uuid}
        let op = param["op"];
        let examId = param["uuid"];
        if (op == "remove") {  // 卸载
            this.removeExamList(examId);
        }
        if (index == 0 && op != "remove") {  // 加载
            //按钮1
            this.loadExamList(examId);
        } else if (index == 1) {  // 删除
            // 按钮2
            this.delExam(examId)
        }
    },
    /**
     * 创建滑动视图的按钮
     * @param {*} mode 
     */
    createSlideButton: function (op, examId) {
        if (op == "load") {
            return [
                { text: '加载', data: { op: "load", uuid: examId } },
                { text: '删除', data: { op: "delete", uuid: examId }, type: 'warn' }
            ];
        } else {
            return [
                { text: '卸载', data: { op: "remove", uuid: examId } },
                { text: '删除', data: { op: "remove", uuid: examId }, type: 'warn' }
            ];
        }
    },

    /**
     * 
     * @param {*} examId 
     */
    delExam: function (examId) {
        // 删除
        let examList = this.data.examList;
        const that = this;
        wx.showModal({
            title: '请确认',
            content: `是否删除考试:${examId}`,
            success(res) {
                if (res.confirm) {
                    wx.showLoading({ title: "请稍候", mask: true });
                    request.api_DelExam(examId).then(
                        (data) => {
                            if (data.status_code != "success") {
                                wx.hideLoading();
                                wx.showToast({ title: data.message, icon: "error" });
                            } else {
                                examList = examList.filter(function (item) { return item.uuid != examId; });
                                that.setData({ examList: examList });
                                wx.hideLoading();
                                wx.showToast({ title: "删除成功", icon: "success" });
                            }
                        }, (res) => {
                            //fail
                            console.debug(res);
                            wx.hideLoading();
                            wx.showToast({ title: "网络错误", icon: "error" });
                        }
                    )
                }
            }
        })
    },

    /**
     * 从服务器加载考生信息
     * @param {string} examId
     */
    loadExamList: function (examId) {
        wx.showLoading({ title: "正在加载数据", mask: true });
        request.api_LoadExamList(examId).then((value) => {
            if (value) {
                const examList = this.data.examList;
                for (let item of examList) {
                    if (item["uuid"] == examId) {
                        item["slideButtons"] = this.createSlideButton("remove", examId);
                    } else {
                        item["slideButtons"] = this.createSlideButton("load", examId);
                    }
                }
                this.setData({ examList: examList });
                wx.hideLoading();
                wx.showToast({ title: "加载成功", icon: "success" });
            } else {
                return Promise.reject();
            }
        }).catch((res) => {
            console.debug(res);
            wx.hideLoading();
            wx.showToast({ title: "网络错误", icon: "error" });
        })
    },

    /**
     * 删除已加载的考生信息
     * @param {string} examId 
     */
    removeExamList: function (examId) {
        try {
            const examList = this.data.examList;
            for (let item of examList) {
                item["slideButtons"] = this.createSlideButton("load", examId);
            }
            this.setData({ examList: examList });
            wx.removeStorageSync('examList-' + examId);
        } catch (e) {
            console.debug(e);
        }
    }

})