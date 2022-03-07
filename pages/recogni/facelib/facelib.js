import * as tools from "./tools"
import { url_for } from "../../../utils/index"

class AntiSpoofing {
    static MAX_FRAME = 32;  //  连续检测帧数
    static ALL_EVENTS = {  // 检测事件
        "BlinkDetection": AntiSpoofing.BlinkDetection,
        "MouthOpeningDetection": AntiSpoofing.MouthOPeningDetection,
        "LRShakingDetection": AntiSpoofing.LRShakingDetection,
        "UDShakingDetection": AntiSpoofing.UDShakingDetection,
    };

    static threshold = {  // 各事件的阈值
        "BlinkDetection": 0.2,
        "MouthOpeningDetection": 0.3,
        "LRShakingDetection": 20.0,
        "UDShakingDetection": 20.0,
    };

    static status = {  //状态码
        INIT: 0x01,  // 初始化
        READY: 0x02,  // 缓冲阶段
        DETECTING: 0x03, // 正在检测
        NEXT_EVENT: 0x04, // 事件切换
        TRUE: 0x05,  // 正常
        FALSE: 0x06, // 错误 
        SUCCESS: 0x10,  // 验证通过
        FAIL: 0x11,  // 验证失败
        FINISH: 0x12, //检测结束
    };

    constructor(page_context) {  //构造函数
        this.page_context = page_context;
        this.detector = page_context.detector;

        this.record = null;  // Array 记录检测结果
        this.event = null;  // String 保存当前的检测事件
        this.step = 12;  // 辅助用的状态计数器
        this.flag = false;  // 检测是否完成，第二次检测
        this.isWarmUp = false;
        this.frame = null;  // Array 保存图片
        this.state = AntiSpoofing.status.INIT;  // 全局的检测状态
    }

    static _CalcAR(upper, lower) {
        /**
         * 计算纵横比  
         * ref: Real-Time Eye Blink Detection using Facial Landmarks
         * @param upper: 上侧的点
         * @param lower: 下侧的点
         */

        // 横点的距离，两侧水平点的中点
        var pt_left = [(lower[0][0] + upper[0][0]) / 2, (lower[0][1] + upper[0][1]) / 2];
        var pt_right = [
            (lower[lower.length - 1][0] + upper[upper.length - 1][0]) / 2,
            (lower[lower.length - 1][1] + upper[upper.length - 1][1]) / 2
        ];
        var hdist = tools.CalcEucliDistance(pt_left, pt_right);

        var vdist = 0.0;  // 纵点的距离之和
        vdist += tools.CalcEucliDistance(upper[4], lower[4]);
        vdist += tools.CalcEucliDistance(upper[6], lower[6]);

        //aspect ratio
        return vdist / (2.0 * hdist + 1e-6);
    }

    static BlinkDetection(landmark) {
        /**
         * @description 眨眼检测, 计算上下眼皮内侧的点的纵横比 
         * 上眼皮标注：(right/left)EyeUpper0  共7个点
         * 下眼皮标注：(right/left)EyeLower0  共9个点
         * EyeIris 瞳孔
         * 
         * @param landmark
         * @return {number} 双眼平均纵横比
         */
        var leftEyeLower = landmark.annotations["leftEyeLower0"];
        var leftEyeUpper = landmark.annotations["leftEyeUpper0"];
        var rightEyeLower = landmark.annotations["rightEyeLower0"];
        var rightEyeUpper = landmark.annotations["rightEyeUpper0"];
        var leftEAR = AntiSpoofing._CalcAR(leftEyeUpper, leftEyeLower);
        var rightEAR = AntiSpoofing._CalcAR(rightEyeUpper, rightEyeLower);
        var meanEAR = (leftEAR + rightEAR) / 2.0;
        return meanEAR;
    }

    static MouthOPeningDetection(landmark) {
        /**
         * @description 张嘴检测, 计算嘴唇内侧的点的纵横比
         * @return {number} 嘴部纵横比
         */
        var lipsUpperInner = landmark.annotations["lipsUpperInner"];
        var lipsLowerInner = landmark.annotations["lipsLowerInner"];
        var LAR = AntiSpoofing._CalcAR(lipsUpperInner, lipsLowerInner);
        return LAR;
    }

    static LRShakingDetection(landmark) {
        /**
         * @description 摇头检测, 通过追踪鼻尖在水平方向上的运动轨迹确定动作
         */
        var noseTip = landmark.annotations["noseTip"];
        return noseTip[0];
    }

    static UDShakingDetection(landmark) {
        /**
         * @description 点头检测, 通过追踪鼻尖在水平方向上的运动轨迹确定动作
         */
        var noseTip = landmark.annotations["noseTip"];
        return noseTip[0];
    }

    CheckAR() {
        /**
         * 通过寻找序列中的拐点对判断眨眼/张嘴/摇头
         */
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

        return count > 1 ? AntiSpoofing.status.TRUE : AntiSpoofing.status.FALSE;
    }

    CheckShaking() {
        /**
         * 验证摇头/点头事件
         */
        var dist = [];
        var origin = this.record[0];
        var direction = this.event.includes("LR") ? 0 : 1;
        var thresh = AntiSpoofing.threshold[this.event];

        // 计算每一帧鼻尖位置里第一帧鼻尖距离的位移
        for (var index in this.record) {
            var cur = this.record[index];
            var d = tools.CalcEucliDistance(origin, cur) > thresh ? 1 : 0;  //平滑处理
            if (cur[direction] < origin[direction]) { d = -d; }  // 区分方向
            dist.push(d);
        }
        // 寻找拐点
        var toLow = false;  //向下拐
        var toUp = false;  //向上拐
        var peak = 0; // 波峰
        var trough = 0; // 波谷

        for (var i = 1; i < dist.length; ++i) {
            var prev = dist[i - 1];
            var cur = dist[i];
            if (prev < cur) {
                toUp = true;
                if (toLow == true) {
                    trough += 1;
                    toUp = false;
                    toLow = false;
                }
            }
            else if (prev > cur) {
                toLow = true;
                if (toUp == true) {
                    peak += 1;
                    toUp = false;
                    toLow = false;
                }
            }
        }
        return peak > 0 && trough > 0 ? AntiSpoofing.status.TRUE : AntiSpoofing.status.FALSE;
    }

    Check() {
        return this.event.includes("Shaking") ? this.CheckShaking() : this.CheckAR();
    }

    Commit(image, predictions) {
        /**
         * @description 接收检测器的预测结果
         * @param image: {data:uint8array,width,height} 图片
         * @param predictions: 检测器的检测结果 字典数组 [{}]
         * @return {Array} [状态码, 说明]
         */
        switch (this.state) {
            case AntiSpoofing.status.INIT: {
                // 检测器预热, 首次启动比较慢, 而且结果不准确
                if (predictions.length <= 0) { break; }
                if (this.isWarmUp == false && this.step > 0) {
                    this.step -= 1;
                    break;
                }
                this.frame = [];
                this.step = 12;
                this.isWarmUp = true;
                this.state = AntiSpoofing.status.READY;
                break;
            }
            case AntiSpoofing.status.READY: {
                // 缓冲阶段，给用户反应时间
                this.step -= 1;
                if (this.step <= 0) {
                    this.step = 12;
                    this.state = AntiSpoofing.status.NEXT_EVENT;
                }
                return [AntiSpoofing.status.READY, "请面向屏幕"];
            }

            case AntiSpoofing.status.NEXT_EVENT: {
                // 抽取一个检测事件
                var keys = tools.Sample(Object.keys(AntiSpoofing.ALL_EVENTS), 1);
                this.event = keys[0];
                this.record = [];
                this.state = AntiSpoofing.status.DETECTING;
                this.frame.push(image); //保存一帧图片
                return [AntiSpoofing.status.NEXT_EVENT, this.event]; //[状态, 事件]
            }

            case AntiSpoofing.status.DETECTING: {
                // 人脸数量检查，防止中途换人或检测多幅人脸
                if (predictions.length != 1) {
                    this.state = AntiSpoofing.status.FAIL;
                    var info = predictions.length == 0 ? "未检测到人脸" : "检测到多幅人脸";
                    return [AntiSpoofing.status.FAIL, info];
                }
                if (this.record.length < AntiSpoofing.MAX_FRAME) {
                    // 检测中，当接收到的有效帧数达到MAX_FRAME后进行核验
                    var func = AntiSpoofing.ALL_EVENTS[this.event];
                    var result = func(predictions[0]);
                    this.record.push(result);
                    return [AntiSpoofing.status.DETECTING, this.event];
                } else {
                    result = this.Check();  // 检测事件是否发生
                    if (result == AntiSpoofing.status.TRUE) { // 成功
                        this.frame.push(image); //保存一帧图片
                        if (this.flag == false) {  //进行下一步检测
                            this.flag = true;
                            this.state = AntiSpoofing.status.READY;
                            return [AntiSpoofing.status.READY, "进行下一步检测"];
                        } else {  //检测完成
                            this.state = AntiSpoofing.status.SUCCESS;
                            return [AntiSpoofing.status.SUCCESS, "检测通过"];
                        }
                    } else {  // 失败, 未检测到事件发生
                        console.info("失败");
                        this.state = AntiSpoofing.status.FAIL;
                        return [AntiSpoofing.status.FAIL, "未检测到事件发生"];
                    }
                }
                break;
            }
            case AntiSpoofing.status.SUCCESS:{}
            case AntiSpoofing.status.FAIL:
                return [AntiSpoofing.status.FINISH, "检测已结束"];
            default:
                break;

        }
        return [this.state, ""];
    }

    Reset() {
        this.record = null;
        this.event = null;
        this.step = 15;
        this.flag = false;
        this.frame = null;
        this.state = AntiSpoofing.status.INIT;
    }

    Submit() {
        /**
         * 将结果提交到服务器
         */
        if (this.state != AntiSpoofing.status.SUCCESS) { return false; }

        // 封装上传数据
        var data = {};
        for(var index in this.frame){
            var image = this.frame[index];
            data[`w${index}`] = image.width;
            data[`h${index}`] = image.height;
            data[`im${index}`] = wx.arrayBufferToBase64(image.data);
        }

        wx.request({
          url: url_for("anti_spoof"),
          method: 'POST',
          data: data,
          success: (res) =>{
              console.log(res);
          },
          fail:(res) =>{
            console.log(res);
          }
        })
    }

};


exports.AntiSpoofing = AntiSpoofing;