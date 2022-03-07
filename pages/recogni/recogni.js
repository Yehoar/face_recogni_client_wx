const facelib = require("./facelib/index");
const AntiSpoofing = facelib.AntiSpoofing;

Page({
    detector: null,
    camera_ctx: null,
    canvas: null,
    canvas_ctx: null,
    antiSpoofing: null,
    listener: null,
    debug: false,

    /**
     * 页面的初始数据
     */
    data: {
        tips: "",
        btn_start_text: "开始检测"
    },
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (args) {
        facelib.LoadModel(this);
        this.antiSpoofing = new AntiSpoofing(this);

        //相机
        var that = this;
        var count = 0;
        this.camera_ctx = wx.createCameraContext();
        this.listener = this.camera_ctx.onCameraFrame((frame) => {
            if (count % 6 == 0) {
                that.detect(frame);
            }
            count += 1;
        });

        // 画布
        wx.createSelectorQuery().select('#myCanvas')
            .fields({ node: true })
            .exec((res) => {
                const canvas = res[0].node;
                this.canvas = canvas;
                this.canvas_ctx = canvas.getContext('2d');
                this.initCanvas();
            });
    },

    onReady: function () { },

    initCanvas: function () {
        const width = this.canvas._width;
        const height = this.canvas._height;
        const dpr = wx.getSystemInfoSync().pixelRatio;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas_ctx.scale(dpr, dpr);
        // console.log([width, height, dpr])
    },
    resetCanvas: function () {
        this.canvas_ctx.globalCompositeOperation = 'destination-out';
        this.canvas_ctx.beginPath();
        this.canvas_ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas_ctx.fill();
        this.canvas_ctx.globalCompositeOperation = 'source-over';
    },

    detect: async function (frame) {
        if (this.detector && this.detector.estimateFaces) {
            const image = {
                data: new Uint8Array(frame.data),
                width: frame.width,
                height: frame.height
            }
            const predictions = await this.detector.estimateFaces({ input: image });
            if (this.debug) {
                // console.log(predictions);
                // console.log([image.width, image.height]);
                var ratio = {
                    width: this.canvas._width / image.width,
                    height: this.canvas._height / image.height,
                    canvas_width: this.canvas._width,
                    canvas_height: this.canvas._height,
                    image_width: image.width,
                    image_height: image.height,
                };
                this.resetCanvas();
                facelib.RenderPrediction(this.canvas_ctx, predictions, ratio);
                var result = this.antiSpoofing.Commit(image, predictions);
                this.showResult(result);
            }
        }
    },
    showResult: function (result) {
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
                this.antiSpoofing.Submit();
                break;
            }
            case AntiSpoofing.status.FAIL: {
                this.setData({ tips: `检测失败: ${result[1]}` });
                break;
            }
        }
    },

    btn_start: function () {
        this.debug = !this.debug;
        if (this.debug) {  // 按下开始
            this.setData({ tips: " " });
            this.antiSpoofing.Reset();
            this.listener.start();
            this.setData({ btn_start_text: "停止检测" });
        } else {  // 按下结束
            this.listener.stop();
            this.resetCanvas();
            this.setData({ btn_start_text: "开始检测" });
        }
    }
})