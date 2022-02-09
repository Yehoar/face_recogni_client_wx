import { url_for } from "../../../utils/url"
const faceLandmarksDetection = require('@tensorflow-models/face-landmarks-detection')

export function DrawPoint(image, x, y, color) {
    /**
     * 在RGBA图片上绘点
     * @param image: 图片 包含width height data
     * @param x:
     * @param y: 点坐标
     * @param color: 颜色 uint8
     */
    x = parseInt(x + 0.5);
    y = parseInt(y + 0.5);

    var pos = y * image.width * 4 + x * 4;
    if (pos + 3 >= image.data.length) {
        pos = 0;
    }
    for (let i = 0; i < 4; i++) {
        image.data[pos + i] = color;
    }
}

export function Distance(a, b) {
    /**
     * 计算点a,b之间的欧几里得距离
     * @param a: Array  2D Point
     * @param b: Array  2D Point
     */

    return Math.sqrt(
        Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2)
    );
}

export async function LoadModel(page_context) {
    /**
     * 加载人脸及关键点检测器，并挂载到页面context中
     */
    console.debug("正在加载模型...");
    const model = await faceLandmarksDetection.load(
        faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
        {
            //detectorModelUrl: url_for("face_detector"),
            irisModelUrl: url_for("iris"),
            modelUrl: url_for("landmark_detector")
        }
    );
    page_context.detector = model;
    console.debug("模型加载完毕!");
}

export function RenderPrediction(frame, predictions) {
    /**
     * 将(annotations)关键点信息在Frame中标注出来
     * @param frame: 帧数据
     * @param predictions: 人脸预测结果数组
     */
    for (let i = 0; i < predictions.length; i++) {
        const annotations = predictions[i].annotations;
        for (var group in annotations) {
            if (!group.includes("EyeLower0"))
                continue;
            const points = annotations[group]
            for (let index = 0; index < points.length; index++) {
                const [x, y, z] = points[index];
                console.debug(`Keypoint ${group}_${index}: [${x}, ${y}, ${z}]`)
                DrawPoint(frame, x, y, 0xff);
            }
        }
    }
    const base64Img = wx.arrayBufferToBase64(frame.data);
    wx.request({
        url: url_for("RenderPrediction"),
        data: {
            "uint8arr": base64Img,
            "width": frame.width,
            "height": frame.height
        },
        method: "POST",
        success: (res) => {
            console.debug(res);
        },
        fail: (res) => {
            console.debug(res);
        }
    })
}