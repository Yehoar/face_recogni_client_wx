import * as tools from "../facelib/tools"

class AntiSpoofing {
    constructor(page_context) {
        this.page_context = page_context;
        this.detector = page_context.detector;
        this.frame_counter = 0;
        this.state = 0;
    }

    Sample(num) {

    }

    BlinkDetection(lankmarks) {
        /**
         * 眨眼检测  Real-Time Eye Blink Detection using Facial Landmarks
         * 上眼皮标注：(right/left)EyeUpper0  共6个点
         * 下眼皮标注：(right/left)EyeLower0  共6个点
         */

    }

    MouthOPeningDetection(lankmarks) {
        /**
         * 张嘴检测
         */

    }

    LRShakingDetection(lankmarks) {
        /**
         * 左右摇头检测
         */
    }

    UDShakingDetection(lankmars) {
        /**
         * 上下点头检测
         */
    }

    Commit(frame) {
        /**
         * 传入图片，直到满足检测条件
         */

    }

};


exports.AntiSpoofing = AntiSpoofing