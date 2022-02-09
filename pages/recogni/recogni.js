const facelib = require("./facelib/index")

Page({
    detector: null,
    camera_ctx: null,
    debug: true,
    flag: true,

    /**
     * 页面的初始数据
     */
    data: {
        tips: "",
        imgData: null,
    },
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function () {
        facelib.LoadModel(this);
        this.camera_ctx = wx.createCameraContext();
    },
    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function () {
        var that = this;

        // 人脸检测
        var count = 0;
        const listener = this.camera_ctx.onCameraFrame((frame) => {
            if (count % 24 == 0) {
                that.detect(frame);
            }
            count += 1;
        })
        listener.start();
    },

    async detect(frame) {
        if (this.detector && this.detector.estimateFaces) {
            const image = {
                data: new Uint8Array(frame.data),
                width: frame.width,
                height: frame.height
            }
            const res = await this.detector.estimateFaces({ input: image });
            if (res.length == 0) {
                this.setData({ tips: "未检测到人脸" });
            } else if (res.length > 1) {
                this.setData({ tips: "检测到人脸数量大于1" });
            } else {
                this.setData({ tips: "" });
                if (this.debug && this.flag) {
                    this.flag = false;
                    console.log(frame.width);
                    console.log(frame.height);
                    console.log(res[0]);
                    facelib.RenderPrediction(image, res);
                }
            }
        } else {
            console.log("等待模型初始化...")
        }
    },

})