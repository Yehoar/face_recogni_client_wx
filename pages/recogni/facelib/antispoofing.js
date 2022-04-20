import { FaceRecogni } from "./face_recogni";

const Tools = require("./tools");
const request = require("../../../http/request");


export class AntiSpoofing {
    static MAX_FRAME = 24;  //  连续检测帧数
    static ALL_EVENTS = {  // 检测事件
        "BlinkDetection": AntiSpoofing.BlinkDetection,
        "MouthOpeningDetection": AntiSpoofing.MouthOPeningDetection,
        "LRShakingDetection": AntiSpoofing.LRShakingDetection,
        "UDShakingDetection": AntiSpoofing.UDShakingDetection,
    };

    static threshold = {  // 各事件的阈值
        "BlinkDetection": 0.20,
        "MouthOpeningDetection": 0.22,
        "LRShakingDetection": 20.0,
        "UDShakingDetection": 20.0,
    };

    static status = {  //状态码
        INIT: 0x01,  // 初始化
        READY: 0x02,  // 缓冲阶段
        DETECTING: 0x03, // 正在检测
        NEXT_EVENT: 0x04, // 事件切换
        SUCCESS: 0x10,  // 验证通过
        FAIL: 0x11,  // 验证失败
        FINISH: 0x12, //检测结束
    };

    constructor() {  //构造函数
        this.record = null;  // Array 记录检测结果
        this.event = null;  // String 保存当前的检测事件
        this.step = 8;  // 辅助用的状态计数器
        this.flag = false;  // 检测是否完成，第二次检测
        this.frames = null;  // Array 保存图片
        this.detector = null;  // 人脸检测+识别
        this.state = AntiSpoofing.status.INIT;  // 全局的检测状态
        this.isReady = false;
    }

    /**
     * 计算纵横比  
     * ref: Real-Time Eye Blink Detection using Facial Landmarks
     * @param upper: 上侧的点
     * @param lower: 下侧的点
     */
    static _CalcAR(upper, lower) {
        // 横点的距离，两侧水平点的中点
        var pt_left = [(lower[0][0] + upper[0][0]) / 2, (lower[0][1] + upper[0][1]) / 2];
        var pt_right = [
            (lower[lower.length - 1][0] + upper[upper.length - 1][0]) / 2,
            (lower[lower.length - 1][1] + upper[upper.length - 1][1]) / 2
        ];
        var hdist = Tools.calcEucliDistance(pt_left, pt_right);

        var vdist = 0.0;  // 纵点的距离之和
        vdist += Tools.calcEucliDistance(upper[4], lower[4]);
        vdist += Tools.calcEucliDistance(upper[6], lower[6]);

        //aspect ratio
        return vdist / (2.0 * hdist + 1e-6);
    }

    /**
     * @description 眨眼检测, 计算上下眼皮内侧的点的纵横比 
     * 上眼皮标注：(right/left)EyeUpper0  共7个点
     * 下眼皮标注：(right/left)EyeLower0  共9个点
     * EyeIris 瞳孔
     * @param landmark
     * @return {number} 双眼平均纵横比
     */
    static BlinkDetection(landmark) {
        var leftEyeLower = landmark.annotations["leftEyeLower0"];
        var leftEyeUpper = landmark.annotations["leftEyeUpper0"];
        var rightEyeLower = landmark.annotations["rightEyeLower0"];
        var rightEyeUpper = landmark.annotations["rightEyeUpper0"];
        var leftEAR = AntiSpoofing._CalcAR(leftEyeUpper, leftEyeLower);
        var rightEAR = AntiSpoofing._CalcAR(rightEyeUpper, rightEyeLower);
        var meanEAR = (leftEAR + rightEAR) / 2.0;
        return meanEAR;
    }

    /**
     * 张嘴检测, 计算嘴唇内侧的点的纵横比
     * @param {*} landmark 
     * @returns {number} 嘴部纵横比
     */
    static MouthOPeningDetection(landmark) {
        var lipsUpperInner = landmark.annotations["lipsUpperInner"];
        var lipsLowerInner = landmark.annotations["lipsLowerInner"];
        var LAR = AntiSpoofing._CalcAR(lipsUpperInner, lipsLowerInner);
        return LAR;
    }

    /**
     * @description 摇头检测, 通过追踪鼻尖在水平方向上的运动轨迹确定动作
     */
    static LRShakingDetection(landmark) {

        var noseTip = landmark.annotations["noseTip"];
        return noseTip[0];
    }

    /**
     * @description 点头检测, 通过追踪鼻尖在水平方向上的运动轨迹确定动作
     */
    static UDShakingDetection(landmark) {
        var noseTip = landmark.annotations["noseTip"];
        return noseTip[0];
    }

    /**
     * 通过寻找序列中的拐点对判断眨眼/张嘴
     */
    checkAR() {
        var record = [];
        var thresh = AntiSpoofing.threshold[this.event];

        for (var index in this.record) {
            // 平滑处理，高于阈值设为1，低于或等于阈值设为0
            record.push(this.record[index] > thresh ? 1 : 0);
        }

        var toLow = false;  //向下拐
        var toUp = false;  //向上拐
        var count = 0;  // 计数
        for (var i = 1; i < record.length; ++i) {
            var j = i - 1;
            record[j] = record[i] - record[j]; // 作差寻找拐点
            if (record[j] < 0) { toLow = true; }
            else if (record[j] > 0) { toUp = true; }
            if (toLow && toUp) {
                count += 1;
                toLow = false;
                toUp = false;
            }
        }

        return count > 1;
    }

    /**
     * 验证摇头/点头事件
     */
    checkShaking() {

        var dist = [];
        var origin = this.record[0];
        var thresh = AntiSpoofing.threshold[this.event];
        var direction = this.event.includes("LR");

        // 计算每一帧鼻尖位置里第一帧鼻尖距离的位移
        for (var index in this.record) {
            var cur = this.record[index];
            var d = direction ? (cur[0] - origin[0]) : (cur[1] - origin[1]);
            d = d > thresh ? 1 : 0;  //平滑处理
            dist.push(d);
        }
        // 寻找拐点
        var toLow = false;  //向下拐
        var toUp = false;  //向上拐
        var count = 0;  // 计数
        for (var i = 1; i < dist.length; ++i) {
            var j = i - 1;
            dist[j] = dist[i] - dist[j]; // 作差寻找拐点
            if (dist[j] < 0) { toLow = true; }
            else if (dist[j] > 0) { toUp = true; }
            if (toLow && toUp) {
                count += 1;
                toLow = false;
                toUp = false;
            }
        }
        return (count > 1);
    }

    checkEvent() {
        return this.event.includes("Shaking") ? this.checkShaking() : this.checkAR();
    }

    async load(load_recogni = false) {
        if (this.detector == null) {
            this.detector = new FaceRecogni();
            await this.detector.load({ save: true, load_recogni: load_recogni });
            this.isReady = this.detector.isReady;
            if (this.isReady) {
                console.debug("AntiSpoofing Ready!!!");
            }

        }
    }

    /**
     * 给外部的活体检测接口
     * @param {*} frame
     */
    async detect(frame) {
        const image = {
            data: new Uint8Array(frame.data),
            width: frame.width,
            height: frame.height
        };
        const preds = await this.detectFace(image);
        const ret = this.processFrame(image, preds);
        ret.push(preds);
        return ret;
    }

    /**
     * @description 人脸检测
     * @param {{}} image {data,width,height}
     * @return 人脸关键点 [boolean, [{...},{...}]]
     */
    async detectFace(image) {
        if (this.detector != null) {
            return await this.detector.estimateFaces(image);
        }
        return [];
    }

    /**
     * 接收检测器的预测结果
     * @param {*} image {data:uint8array,width,height} 图片
     * @param {*} predictions 检测器的检测结果 字典数组 [{}]
     * @returns {Array} [状态码, 说明]
     */
    processFrame(image, predictions) {
        switch (this.state) {
            case AntiSpoofing.status.INIT: {
                // 检测器预热, 首次启动比较慢, 而且结果不准确
                if (predictions.length <= 0) {
                    return [AntiSpoofing.status.INIT, "初始化中"];
                }
                this.frames = [];
                this.state = AntiSpoofing.status.READY;
                break;
            }
            case AntiSpoofing.status.READY: {
                // 缓冲阶段，给用户反应时间
                this.step -= 1;
                if (this.step <= 0) {
                    this.step = 8;
                    this.state = AntiSpoofing.status.NEXT_EVENT;
                }
                return [AntiSpoofing.status.READY, "请面向屏幕"];
            }

            case AntiSpoofing.status.NEXT_EVENT: {
                // 抽取一个检测事件
                var keys = Tools.sample(Object.keys(AntiSpoofing.ALL_EVENTS), 1);
                this.event = keys[0];
                this.record = [];
                this.state = AntiSpoofing.status.DETECTING;
                return [AntiSpoofing.status.NEXT_EVENT, this.event]; //[状态, 事件]
            }

            case AntiSpoofing.status.DETECTING: {
                // 人脸检查
                const check = this.detector.checkFace(image, predictions);
                if (check[0] != true) {
                    this.state = AntiSpoofing.status.FAIL;
                    return [AntiSpoofing.status.FAIL, check[1]];
                }

                if (this.record.length < AntiSpoofing.MAX_FRAME) {
                    // 检测中，当接收到的有效帧数达到MAX_FRAME后进行核验
                    var func = AntiSpoofing.ALL_EVENTS[this.event];
                    var result = func(predictions[0]);
                    this.record.push(result);
                    return [AntiSpoofing.status.DETECTING, this.event];
                } else {
                    result = this.checkEvent();  // 检测事件是否发生
                    if (result == true) { // 成功
                        image["pred"] = predictions[0];  // 记录关键点信息
                        this.frames.push(image); //保存一帧图片
                        if (this.flag == false) {  //进行下一步检测
                            this.flag = true;
                            this.state = AntiSpoofing.status.READY;
                            return [AntiSpoofing.status.READY, "进行下一步检测"];
                        } else {  //检测完成
                            this.state = AntiSpoofing.status.SUCCESS;
                            return [AntiSpoofing.status.SUCCESS, "检测通过"];
                        }
                    } else {  // 失败, 未检测到事件发生
                        console.debug("动作验证失败");
                        this.state = AntiSpoofing.status.FAIL;
                        return [AntiSpoofing.status.FAIL, "未检测到事件发生"];
                    }
                }
                break;
            }
            case AntiSpoofing.status.SUCCESS:
            case AntiSpoofing.status.FAIL:
                return [AntiSpoofing.status.FINISH, "检测已结束"];
        }
        return [this.state, ""];
    }

    /**
    * 重置状态
    */
    reset() {
        this.record = null;
        this.event = null;
        this.step = 8;
        this.flag = false;
        this.frames = null;
        this.state = AntiSpoofing.status.INIT;
    }

    /**
    * 若人脸识别可用，则将人脸编码提交到服务器
    * 否则提交图片
    */
    submit() {
        if (this.state != AntiSpoofing.status.SUCCESS) { return false; }
        (this.detector.canRecogni == true) ? this.submitEmbeddings() : this.submitImages();
    }

    submitEmbeddings() {
        let toast = null;
        wx.showLoading({ title: '识别中，请稍等', mask: true });

        // 封装上传数据

        let embeddings = [];
        let faces = [];
        // image to embedding
        for (var index in this.frames) {
            let image = this.frames[index];
            let landmarks = image["pred"];
            let [embedding, faceT] = this.detector.predict({
                image: image,
                faceLandmark: landmarks,
                returnTensor: true,
                returnFace: true
            });
            embeddings.push(embedding);
            // 转换图片
            let face = Tools.tensorToImage(faceT, 112, 112);
            faces.push(face);
            faceT.dispose();
        }
        // 判断是否同一个人
        let dist = Tools.calculateAllDistance(embeddings);
        let issame = Tools.allLessEqual(dist, this.detector.threshold);
        // console.debug(dist, issame);
        console.debug(dist);
        if (issame) {
            // 封装数据
            let data = { nums: embeddings.length };
            for (let idx in embeddings) {
                data[`embedding${idx}`] = Float32Array.from(embeddings[idx].arraySync()).buffer;
                data[`image${idx}`] = Tools.frameToPng(faces[idx]);
                // console.log(data[`image${idx}`])
            }
            request.api_Collect(data).then((value) => {
                console.debug(value);
                if (value.status_code == "success") {
                    this.state = AntiSpoofing.status.SUCCESS;
                    toast = { title: "识别成功!", icon: "success", duration: 2200 };
                } else {
                    this.state = AntiSpoofing.status.FAIL;
                    toast = { title: "识别失败!", icon: "error", duration: 2200 };
                }
            }, (reason) => {
                console.debug(reason);
                toast = { title: '网络错误' };
            }).finally(() => {
                wx.hideLoading();
                if (toast != null) { wx.showToast(toast); }
            });
        } else {
            wx.hideLoading();
            wx.showToast({ title: "识别失败", icon: "error", duration: 2200 });
        }
        // cleanup
        for (let embd of embeddings) {
            embd.dispose();
        }
    }

    /**
     * 将图片提交到服务器
     * @deprecated  由于tfjs模型与python模型存在转换差异，统一使用tfjs生成人脸编码
     */
    submitImages() {
        if (this.state != AntiSpoofing.status.SUCCESS) { return false; }
        // 封装上传数据
        var data = {
            mode: "rgb",
            encoding: "base64",
            width: 112,
            height: 112,
            nums: this.frames.length,
        };

        for (var index in this.frames) {
            var image = this.frames[index];
            var landmarks = image["pred"];
            image = Tools.faceAlignment(image, landmarks, [112, 112]);
            data[`im${index}`] = wx.arrayBufferToBase64(image.data);
        }

        let toast = null;
        wx.showLoading({ title: '识别中，请稍等', mask: true });
        request.api_AntiSpoofing(data).then((value) => {
            console.debug(value);
            if (value.status_code == "success") {
                this.state = AntiSpoofing.status.SUCCESS;
                toast = { title: "识别成功!", icon: "success", duration: 2200 };
            } else {
                this.state = AntiSpoofing.status.FAIL;
                toast = { title: "识别失败!", icon: "error", duration: 2200 };
            }
        }, (reason) => {
            console.debug(reason);
            toast = { title: '网络错误' };
        }).finally(() => {
            wx.hideLoading();
            if (toast != null) { wx.showToast(toast); }
        });
    }

    dispose() {
        if (this.detector != null) {
            this.detector.dispose();
        }
    }
};

