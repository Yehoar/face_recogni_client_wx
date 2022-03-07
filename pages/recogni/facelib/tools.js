import { url_for } from "../../../utils/url"
const faceLandmarksDetection = require('@tensorflow-models/face-landmarks-detection')

export function Sample(arr, num) {
    /**
     * 对数组进行随机不重样采样
     * @param arr: 采样数组
     * @param num: 采样数量
     */

    var select = [];
    while (select.length < num) {
        var index = Math.floor(Math.random() * arr.length);
        if (!select.includes(arr[index])) {
            select.push(arr[index]);
        }
    }
    return select;
}

export function CalcEucliDistance(a, b) {
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
            // detectorModelUrl: url_for("face_detector"),
            irisModelUrl: url_for("iris"),
            modelUrl: url_for("landmark_detector")
        }
    );
    //model.save();
    page_context.detector = model;
    console.debug("模型加载完毕!");
}

export function _DrawPoint(image, x, y, color) {
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

export function _RenderPrediction(frame, predictions) {
    /**
     * 将(annotations)关键点信息在Frame中标注出来
     * @param frame: 帧数据
     * @param predictions: 人脸预测结果数组
     */
    for (let i = 0; i < predictions.length; i++) {
        const annotations = predictions[i].annotations;
        for (var group in annotations) {
            const points = annotations[group]
            for (let index = 0; index < points.length; index++) {
                const [x, y, z] = points[index];
                //console.debug(`Keypoint ${group}_${index}: [${x}, ${y}, ${z}]`)
                _DrawPoint(frame, x, y, 0xff);
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

function DrawCircle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
}

function DrawRect(ctx, left, top, width, height) {
    ctx.beginPath();
    ctx.rect(left, top, width, height)
    ctx.stroke();
}
export function RenderPrediction(canvas_ctx, predictions, ratio = null) {
    /**
    * 在画布上标注关键点
    * 画布和图片的大小不一致，需要重新计算
    * @param canvas_ctx: 画布句柄
    * @param predictions: 人脸预测结果数组
    * @param ratio: 缩放比例
    */
    canvas_ctx.strokeStyle = 'blue';
    var fx = ratio === null ? 1.0 : ratio.width;
    var fy = ratio === null ? 1.0 : ratio.height;
    // console.info(predictions);
    for (let i = 0; i < predictions.length; i++) {
        // bbox
        // const boundingBox = predictions[i].boundingBox;
        // var [left, top] = boundingBox["topLeft"];
        // var [right, bottom] = boundingBox["bottomRight"];
        // var width = Math.floor((right - left) + 0.5);
        // var height = Math.floor((bottom - top) + 0.5);
        // top = Math.floor(top*fy + 0.5);
        // left = Math.floor(left*fx + 0.5);
        // DrawRect(canvas_ctx, left, top, width, height)

        //landmark
        const annotations = predictions[i].annotations;
        for (var group in annotations) {
            const points = annotations[group]
            for (let index = 0; index < points.length; index++) {
                var [x, y, z] = points[index];
                //console.debug(`Keypoint ${group}_${index}: [${x}, ${y}, ${z}]`);
                x = Math.floor(x * fx + 0.5);
                y = Math.floor(y * fy + 0.5);
                DrawCircle(canvas_ctx, x, y, 1);
            }
        }
    }
}