const Tools = require("./tools");

export function initCanvas(canvas, canvas_ctx) {
    const width = canvas._width;
    const height = canvas._height;
    const dpr = wx.getSystemInfoSync().pixelRatio;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas_ctx.scale(dpr, dpr);
    // console.log([width, height, dpr])
}

export function resetCanvas(canvas, canvas_ctx) {
    canvas_ctx.globalCompositeOperation = 'destination-out';
    canvas_ctx.beginPath();
    canvas_ctx.fillRect(0, 0, canvas.width, canvas.height);
    canvas_ctx.fill();
    canvas_ctx.globalCompositeOperation = 'source-over';
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

/**
 * 在画布上标注关键点
 * 画布和图片的大小不一致，需要重新计算
 * @param {*} canvas_ctx 画布句柄
 * @param {*} predictions 人脸预测结果数组
 * @param {*} ratio 缩放比例
 */
export function renderPrediction(canvas_ctx, predictions, ratio = null) {
    canvas_ctx.strokeStyle = 'blue';
    var fx = ratio === null ? 1.0 : ratio.width;
    var fy = ratio === null ? 1.0 : ratio.height;
    // console.info(predictions);
    for (let i = 0; i < predictions.length; i++) {
        //landmark
        const annotations = predictions[i].annotations;
        for (var group in annotations) {
            // if (!group.includes("EyeIris"))
            // continue;
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
    // const annotations = predictions[0].annotations
    // var left = annotations["leftEyeIris"];
    // var right = annotations["rightEyeIris"];
    // const point1 = Tools.getCenter(left);
    // const point2 = Tools.getCenter(right);
    // for (let point of [point1, point2]) {
    //     var [x, y] = point
    //     x = Math.floor(x * fx + 0.5);
    //     y = Math.floor(y * fy + 0.5);
    //     DrawCircle(canvas_ctx, x, y, 1);
    // }
}