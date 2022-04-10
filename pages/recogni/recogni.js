const facelib = require("./facelib/index");

// const Debug = facelib.Debug;

const AntiSpoofing = facelib.AntiSpoofing;
const FaceRecogni = facelib.FaceRecogni;
const Tools = facelib.Tools;


Page({
    page_type: 0,
    canvas: null,
    canvas_ctx: null,
    recogni: null,
    antiSpoofing: null,
    listener: null,
    running: false,
    imgSrc: "../../resources/renlianBI.png",
    busy: false,
    curId: null,

    /**
     * 页面的初始数据
     */
    data: {
        page_type: 0,
        tips: "",
        btn_start_text: "开始检测",
        devicePosition: "front",
        stuInfo: { name: "-", stuId: "-", department: "-", "major": "-" },
        preview: "../../resources/renlianBI.png",
        btnConfirmDisable: true,
        btnChangeDisable: true,
        examList: [],
    },
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) {
        console.debug(options);
        if (options["page_type"] == undefined) {
            options["page_type"] = "recogni";
        }

        if (options["page_type"] === "recogni") {
            wx.setNavigationBarTitle({ title: "考生识别" });
            this.setData({ page_type: 1, tips: "准备中", devicePosition: "back" });
            this.page_type = 1;
            this.recogni = new FaceRecogni();
        } else {
            wx.setNavigationBarTitle({ title: "人脸采集" });
            this.setData({ page_type: 0, tips: "按下按钮开始检测", devicePosition: "front" });
            this.page_type = 0;
            this.antiSpoofing = new AntiSpoofing();  // 活体检测
        }
    },

    onReady: async function () {
        wx.showLoading({ title: '正在加载组件', mask: true });
        let model = null;
        if (this.page_type == 0) {
            this.initAntiSpoofing();
            model = this.antiSpoofing;
        } else {
            this.initFaceRecogni();
            model = this.recogni;
        }
        let waitLoading = setInterval(  // 等待加载
            () => {
                if (model != null && model.isReady) {
                    clearInterval(waitLoading);
                    wx.hideLoading();
                }
            }, 800
        );
    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {
        if (this.listener != null) {
            this.listener.stop();
        }
        if (this.antiSpoofing != undefined && this.antiSpoofing != null) {
            this.antiSpoofing.dispose();
            console.debug("dispose antiSpoofing");
        }
        if (this.recogni != undefined && this.recogni != null) {
            this.recogni.dispose();
            console.debug("dispose recogni");
        }
    },

    /**
     * 初始化检测器
     */
    initAntiSpoofing: function () {
        //模型
        this.antiSpoofing.load(true);
        // 画布
        // wx.createSelectorQuery().select('#myCanvas')
        //     .fields({ node: true })
        //     .exec((res) => {
        //         const canvas = res[0].node;
        //         this.canvas = canvas;
        //         this.canvas_ctx = canvas.getContext('2d');
        //         Debug.initCanvas(this.canvas, this.canvas_ctx);
        //     });

        //相机
        let that = this;
        let count = 0, skip = 5;
        const camera_ctx = wx.createCameraContext();

        this.listener = camera_ctx.onCameraFrame((frame) => {
            count += 1;
            if (count <= skip || !that.antiSpoofing.isReady) { return; }
            count = 0;
            //console.time();
            that.antiSpoofing.detect(frame).then((ret) => {
                that.showResultFromAntiSpoof(ret);
                // Debug.resetCanvas(this.canvas, this.canvas_ctx);
                // var ratio = {
                //     width: this.canvas._width / frame.width,
                //     height: this.canvas._height / frame.height,
                // }
                // Debug.renderPrediction(this.canvas_ctx, ret[2], ratio)
            });
            //console.timeEnd();
        });
    },

    /**
     * 显示活体检测的状态
     * @param {*} result 
     */
    showResultFromAntiSpoof: function (result) {
        /**
         * 处理Antispoofing.Commit 返回的结果
         */
        const event_tips = {
            BlinkDetection: "请眨眨眼",
            MouthOpeningDetection: "请张张嘴",
            LRShakingDetection: "请左右摇头",
            UDShakingDetection: "请上下点头",
        };
        switch (result[0]) {
            case AntiSpoofing.status.INIT: {
                this.setData({ tips: "初始化中，请稍候" });
                break;
            }
            case AntiSpoofing.status.READY: {
                this.setData({ tips: "请面向屏幕" });
                break;
            }
            case AntiSpoofing.status.NEXT_EVENT: {
                var tips = event_tips[result[1]];
                this.setData({ tips: tips });
                break;
            }
            case AntiSpoofing.status.SUCCESS: {
                this.setData({ tips: "检测通过" });
                this.antiSpoofing.submit();
                this.bindBtnStart();
                break;
            }
            case AntiSpoofing.status.FAIL: {
                this.setData({ tips: `检测失败: ${result[1]}` });
                this.bindBtnStart();
                break;
            }
        }
    },

    /**
     * 按钮事件：开始检测
     */
    bindBtnStart: function () {
        this.running = !this.running;
        if (this.running) {  // 按下开始
            this.setData({ tips: "准备中" });
            this.antiSpoofing.reset();
            this.listener.start();
            this.setData({ btn_start_text: "停止检测" });
        } else {  // 按下结束
            this.listener.stop();
            // Debug.resetCanvas(this.canvas, this.canvas_ctx);
            this.setData({ btn_start_text: "开始检测" });
        }
    },

    /**
     * 按钮事件：确认识别结果
     */
    bindBtnConfirm: function () {
        if (this.listener != null && this.busy) {
            this.setStatus(this.curId, "已识别");
            this.setData({ tips: "检测中", btnConfirmDisable: true, btnChangeDisable: true });
            this.resetInfo();
            setTimeout(() => {
                this.busy = false;
            }, 1200);
        }
    },

    /**
     * 按钮事件：修改识别结果
     */
    bindBtnChange: function () {
        if (this.listener != null && this.busy) {
            this.setData({ tips: "检测中", btnConfirmDisable: true, btnChangeDisable: true });
            this.resetInfo();
            setTimeout(() => {
                this.busy = false;
            }, 1500);
        }
    },

    /**
     * 点击事件：导出
     */
    bindTapExport: function (e) {
        const examList = this.data.examList;
        if (examList == null || examList == undefined || examList.length <= 0) {
            return;
        }
        wx.showLoading({ title: "处理中", mask: true });
        let rows = [];
        let columns = ["学号", "姓名", "学院", "专业", "班级", "状态"].join(",");
        rows.push(columns);
        for (let item of examList) {
            let row = [
                item["userId"],
                item["name"],
                item["department"],
                item["major"],
                item["clazz"],
                item["isRecogni"] + item["updateTime"]
            ].join(",");
            rows.push(row);
        }
        rows = rows.join("\n");
        try {
            const fs = wx.getFileSystemManager()
            const filepath = `${wx.env.USER_DATA_PATH}/tmp_${new Date().getTime()}`;
            const res = fs.writeFileSync(filepath, rows, 'utf8');
            console.debug(res);
            wx.hideLoading();
            wx.showModal({
                content: "确认导出",
                success: (res) => {
                    if (res.confirm) {
                        wx.shareFileMessage({
                            filePath: filepath,
                            fileName: `ExamList-${Tools.formatTime()}.csv`,
                            fail: console.error,
                        })
                    } 
                }
            });
        } catch (e) {
            console.error(e);
            wx.showToast({ title: "导出失败" });
        }
    },

    initFaceRecogni: function () {
        //模型
        this.recogni.load();
        // 尝试加载数据
        this.loadExamList();
        //相机
        const camera_ctx = wx.createCameraContext();
        this.setData({ tips: "准备中..." });

        let count = 0, skip = 48;
        this.listener = camera_ctx.onCameraFrame((frame) => {
            // console.log(frame.width, frame.height);
            count += 1;
            if (count <= skip || this.recogni == null || !this.recogni.isReady) { return; } //间隔采样
            // console.time();
            count = 0;
            if (!this.busy) {
                this.busy = true;
                const image = { data: new Uint8Array(frame.data), width: frame.width, height: frame.height, };

                this.recogni.detect(image).then((ret) => {
                    if (ret[0] == true) {  // 检测到人脸
                        // console.debug(ret);
                        wx.showLoading({ title: "正在识别", mask: true });
                        let [_, faceLandmark] = ret;
                        let [embedding, face] = this.recogni.predict({
                            image: image,
                            faceLandmark: faceLandmark,
                            returnTensor: false,
                            returnFace: true
                        });
                        let png = Tools.frameToPng(face)
                        // console.debug(embedding)
                        // 本地查询
                        let person = null;
                        person = this.recogni.findInLocalGallery(embedding);
                        if (person != null) {
                            console.debug("findInLocalGallery")
                            this.setInfo(person);
                            this.curId = person.userId;
                            this.setData({ preview: png, tips: "请确认", btnConfirmDisable: false, btnChangeDisable: false });
                            wx.hideLoading();
                        } else {
                            // 远程查询
                            this.recogni.findInRemoteGallery(embedding, face).then((data) => {
                                console.debug("findInRemoteGallery")
                                this.setInfo(data);
                                this.curId = data == null ? "" : data.userId;
                                this.setData({ preview: png, tips: "请确认", btnConfirmDisable: false, btnChangeDisable: false });
                            }).catch((res) => {
                                console.debug(res);
                                this.curId = "";
                                this.setInfo();
                                this.setData({ preview: this.imgSrc, tips: "请确认", btnConfirmDisable: false, btnChangeDisable: false });
                            }).finally(() => { wx.hideLoading(); });
                        }
                    } else {
                        this.setData({ tips: ret[1] });
                        this.busy = false;
                    }
                });
            }
            //console.timeEnd();

        });
        this.listener.start();
    },

    setInfo: function (info = null) {
        let stuInfo = {};
        if (info == null) {
            stuInfo = {
                name: "未查询到相关信息",
                stuId: "未查询到相关信息",
                department: "未查询到相关信息",
                "major": "未查询到相关信息"
            };
        } else {
            stuInfo = {
                name: info.name,
                stuId: info.userId,
                department: info.department,
                major: "未查询到相关信息"
            };

            if (info.department == "None") {
                stuInfo.department = "未查询到相关信息";
            }

            if (info.major == "None" || info.clazz == "None") {
                stuInfo.major = "未查询到相关信息";
            } else {
                stuInfo.major = `${info.major} ${info.clazz}`;
            }
        }
        this.setData({ stuInfo: stuInfo });
    },

    resetInfo: function () {
        let stuInfo = {
            name: "-",
            stuId: "-",
            department: "-",
            major: "-"
        };
        this.setData({ preview: this.imgSrc, stuInfo: stuInfo });
    },

    /**
     * 从缓存中加载考生名单
     */
    loadExamList: function () {
        try {
            const prefix = "examList-";
            const res = wx.getStorageInfoSync();
            let examList = null;
            for (let key of res.keys) {
                if (key.substr(0, 9) == prefix) {
                    examList = wx.getStorageSync(key);
                    break;
                }
            }
            if (examList == null || examList == "") {
                return;
            }
            examList = JSON.parse(examList);  // [{userId,name,department,major,clazz,embd$ }]
            // 初始化本地编码库
            this.recogni.setGallery(examList);

            // 拷贝数据并初始化页面
            let tmp = [];
            for (let item of examList) {
                let obj = {};
                for (let key in item) {
                    if (!key.includes("embd")) {
                        obj[key] = item[key];
                    }
                }
                obj["slideButtons"] = this.createSlideButton(item["userId"]);
                obj["isRecogni"] = "未识别";
                obj["updateTime"] = "";
                tmp.push(obj);
            }
            examList = tmp;
            this.setData({ examList: examList });
        } catch (e) {
            console.error(e);
        }
    },

    /**
     * 创建滑动视图的按钮
     */
    createSlideButton(userId) {
        return [
            { text: '确认', data: userId },
            { text: '清除', data: userId, type: 'warn' }
        ];
    },
    /**
    * 绑定按钮事件
    * @param {Object} e 
    */
    slideButtonTap: function (e) {
        // console.debug('slide button tap', e.detail)
        let index = e.detail["index"];
        let userId = e.detail["data"];

        if (index == 0) {  //确认
            this.setStatus(userId, "已识别");
        } else if (index == 1) {  //清除
            // 按钮2
            this.setStatus(userId, "未识别");
        }
    },

    /**
     * 确认记录
     * @param {*} userId 
     */
    setStatus: function (userId, status) {
        if (userId == undefined || userId == "") {
            return;
        }
        let examList = this.data.examList;
        for (let item of examList) {
            if (item.userId == userId) {
                item.isRecogni = status;
                if (status == "未识别") {
                    item.updateTime = "";
                } else {
                    item.updateTime = Tools.formatTime();
                }
                break;
            }
        }
        this.setData({ examList: examList });
    },

})