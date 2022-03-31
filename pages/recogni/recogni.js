const facelib = require("./facelib/index");

// const Debug = facelib.Debug;

const AntiSpoofing = facelib.AntiSpoofing;
const FaceRecogni = facelib.FaceRecogni;
const Tools = facelib.Tools;
const request = require("../../http/request");
const app = getApp();

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

    /**
     * 页面的初始数据
     */
    data: {
        page_type: 0,

        tips: "",
        btn_start_text: "开始检测",
        devicePosition: "front",
        stuInfo: { name: "-", stuId: "-", college: "-", "major": "-" },
        preview: "../../resources/renlianBI.png",
        btnConfirmDisable: true,
        btnChangeDisable: true,
    },
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) {
        console.debug(options);
        if (options["page_type"] == undefined) {
            options["page_type"] = "recogni";
        }

        wx.showLoading({ title: '正在加载组件' });
        if (options["page_type"] === "recogni") {
            wx.setNavigationBarTitle({ title: "考生识别" });
            this.setData({ page_type: 1, tips: "准备中", devicePosition: "front" });
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
        if (this.page_type == 0) {
            this.initAntiSpoofing();
        } else {
            this.initFaceRecogni();
        }
        wx.hideLoading();
    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {
        if (this.antiSpoofing !== undefined && this.antiSpoofing !== null) {
            this.antiSpoofing.dispose();
            console.debug("dispose antiSpoofing");
        }
        if (this.recogni !== undefined && this.recogni !== null) {
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
            if (count <= skip) { return; }
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
                this.setData({ tips: "初始化中，请稍候..." });
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
            this.setData({ tips: "开始识别" });
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
            this.setData({ tips: "检测中", btnConfirmDisable: true, btnChangeDisable: true });
            this.resetInfo();
            setTimeout(() => {
                this.busy = false;
            }, 1500);
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

    initFaceRecogni: function () {
        //模型
        this.recogni.load();
        //相机
        const camera_ctx = wx.createCameraContext();
        this.setData({ tips: "准备中..." });

        let count = 0, skip = 48;
        this.listener = camera_ctx.onCameraFrame((frame) => {
            // console.log(frame.width, frame.height);
            count += 1;
            if (count <= skip) { return; } //间隔采样
            // console.time();
            count = 0;
            if (!this.busy) {
                this.busy = true;
                const image = {
                    data: new Uint8Array(frame.data),
                    width: frame.width,
                    height: frame.height,
                };

                this.recogni.detect(image).then((ret) => {
                    if (ret[0] == true) {  // 检测到人脸
                        // console.debug(ret);
                        wx.showLoading({ title: "正在识别" })
                        let [_, faceLandmark] = ret;
                        let [embedding, face] = this.recogni.predict({
                            image: image,
                            faceLandmark: faceLandmark,
                            returnTensor: false,
                            returnFace: true
                        });
                        let png = Tools.frameToPng(face)
                        // console.debug(embedding)
                        request.api_Recogni({
                            embedding: embedding.buffer,
                            im: face.data
                        }).then((value) => {
                            console.debug(value);
                            if (value.status_code !== "success") {
                                value = null;
                            } else {
                                let info = value.info;
                                if (info instanceof String) {
                                    value = JSON.stringify(info);
                                } else {
                                    value = info;
                                }
                            }
                            this.setInfo(value);
                        }, (res) => {
                            console.debug(res);
                            this.setInfo();
                        });
                        this.setData({ preview: png, tips: "请确认", btnConfirmDisable: false, btnChangeDisable: false });
                        wx.hideLoading();
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
                college: "未查询到相关信息",
                "major": "未查询到相关信息"
            };
        } else {
            stuInfo = {
                name: info.userName,
                stuId: info.userId,
                college: info.college,
                "major": "未查询到相关信息"
            };

            if (info.college == "None") {
                stuInfo.college = "未查询到相关信息";
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
            college: "-",
            "major": "-"
        };
        this.setData({ preview: this.imgSrc, stuInfo: stuInfo });
    }
})