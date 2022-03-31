const tf = require("@tensorflow/tfjs-core");
const upng = require("./UPNG").UPNG;
/**
 * 对数组进行随机不重样采样
 * @param {Array} arr 
 * @param {number} num 
 * @returns 
 */
export function sample(arr, num) {
    var select = [];
    while (select.length < num) {
        var index = Math.floor(Math.random() * arr.length);
        if (!select.includes(arr[index])) {
            select.push(arr[index]);
        }
    }
    return select;
}

/**
 * 
 * @param {[number,number]} a Point2D
 * @param {[number,number]} b Point2D
 * @returns {number}
 */
export function calcEucliDistance(a, b) {
    return Math.sqrt(
        Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2)
    );
}

export function dot(v1, v2) {
    var product = 0;
    for (var i = 0; i < v1.length; i++) {
        product += v1[i] * v2[i];
    }
    return product;
}

/**
 * 通过人脸关键点确定最小人脸框
 * @param {*} landmarks 单幅人脸的关键点信息 {annotations}
 * @returns {[number,number,number,number]} [x_min,y_min,x_max,y_max]
 */
export function convertBox(landmarks) {
    var x_min = 1e5, y_min = 1e5, x_max = -1e5, y_max = -1e5;
    if (landmarks instanceof Array) {
        for (let point of landmarks) {
            let [x, y, _] = point;
            if (x < x_min) x_min = x;
            if (y < y_min) y_min = y;
            if (x > x_max) x_max = x;
            if (y > y_max) y_max = y;
        }
    }
    else {
        for (let group in landmarks) {
            let points = landmarks[group];
            for (let point of points) {
                let [x, y, _] = point;
                if (x < x_min) x_min = x;
                if (y < y_min) y_min = y;
                if (x > x_max) x_max = x;
                if (y > y_max) y_max = y;
            }
        }
    }
    return [x_min, y_min, x_max, y_max];
}

export function getCenter(points) {
    // 计算points的均值中心
    if (points.length <= 0) { return [0.0, 0.0] };
    var cx = 0.0, cy = 0.0;
    points.map((item) => { cx += item[0]; cy += item[1]; });
    cx = cx / points.length;
    cy = cy / points.length;
    return [cx, cy];
}

/**
 * 计算两点连线与水平线间的弧度
 * @param {[number,number]} point1 
 * @param {[number,number]} point2
 * @returns {number} -Pi/2<rad<Pi/2
 */
function computeRotation(point1, point2) {

    var dx = point2[0] - point1[0], dy = point2[1] - point1[1];
    if (Math.abs(dx) < 1e-2)
        return dy > 0.0 ? Math.PI / 2.0 : -Math.PI / 2.0;

    return Math.atan(dy / dx);
}
function getRotationMatrix(center, radians) {
    /**
     * 计算二维旋转矩阵(正方向为逆时针)
     * @param center 旋转中心
     * @param radians 弧度 
     * @returns 2x3 Matrix
     */
    var cosA = Math.cos(radians);
    var sinA = Math.sin(radians);
    var tx = -1.0 * center[0] * cosA + center[1] * sinA + center[0];
    var ty = -1.0 * center[0] * sinA - center[1] * cosA + center[1];
    return [[cosA, -sinA, tx], [sinA, cosA, ty]];
}

/**
 * 人脸对齐,并裁剪到112x112
 * @param {*} image {data,width,height}
 * @param {*} landmarks 人脸关键点
 * @param {[number,number]} cropSize 裁剪对齐后的人脸
 * @param {Boolean} returnTensor 
 * @returns {Uint8Array} 对齐并裁剪后的人脸
 */
export function faceAlignment(image, landmarks, cropSize, returnTensor = false) {
    const annotations = landmarks.annotations;

    // 计算将双眼连线与水平线的弧度，
    var left = annotations["leftEyeIris"];
    var right = annotations["rightEyeIris"];
    const point1 = getCenter(left);
    const point2 = getCenter(right);
    var rad = computeRotation(point1, point2);

    // 计算鼻子中心位置
    var noseTip = annotations["noseTip"][0];
    var center = [noseTip[0] / image.width, noseTip[1] / image.height];

    // 对齐后的关键点
    var ltrb = null;
    if (Math.abs(rad) > (Math.PI / 32.0)) {
        var landmarkT = [];
        var martix = getRotationMatrix(noseTip, rad);
        for (var group in annotations) {
            let points = annotations[group];
            for (let point of points) {  // point [x,y,z]
                point = [point[0], point[1], 1];
                let x = dot(martix[0], point);
                let y = dot(martix[1], point);
                landmarkT.push([x, y, 1]);
            }
        }
        ltrb = convertBox(landmarkT);
    } else {
        ltrb = convertBox(annotations);
    }

    // 重新计算人脸框, 并归一化
    var [left, top, right, bottom] = ltrb;
    // 略微扩大
    var tlbr = [
        (top - 5) / image.height,
        (left - 5) / image.width,
        (bottom + 5) / image.height,
        (right + 5) / image.width
    ].map((x) => { return (x < 0.0) ? 0.0 : ((x > 1.0) ? 1.0 : x); });  //防止越界
    // tlbr = [0.0, 0.0, 1.0, 1.0]
    // 利用tfjs处理图片
    var imgT = tf.tidy(() => {
        var img = tf.browser.fromPixels(image).expandDims(0).toFloat(); // [1,height,width,3]
        if (Math.abs(rad) > (Math.PI / 32.0)) {
            // 偏转较大，对齐
            img = tf.image.rotateWithOffset(img, rad, 128, center);  //逆时针旋转
        }
        if ((cropSize instanceof Array) && cropSize.length == 2) {
            //裁剪
            const box = tf.tensor2d(tlbr, [1, 4]);
            const boxInd = tf.tensor1d([0], "int32");
            img = tf.image.cropAndResize(img, box, boxInd, cropSize, "bilinear");
        }
        return img;
    });

    if (returnTensor) {
        return imgT;
    } else {
        const buffer = cvtTensorImage(imgT);
        imgT.dispose()
        return buffer;
    }

}

/**
 * 预览Frame图片 
 * @returns 
 */
export function frameToPng(image, toBase64 = true, prefix = true) {
    // let png = upng.encode([image.data.buffer], image.width, image.height, 0);
    let png = upng.encodeLL([image.data.buffer], image.width, image.height, 3, 0, 8);
    if (toBase64) {
        png = wx.arrayBufferToBase64(png);
        if (prefix) {
            png = "data:image/png;base64," + png;
        }
    }
    return png;
}

export function tensorToImage(tensor, width, height) {
    const imgT = tf.tidy(() => {
        return tensor.reshape([-1]).toInt();
    });
    let buffer = new Uint8Array(imgT.dataSync().buffer);
    buffer = buffer.filter((x, i) => { return i % 4 == 0 });
    const image = {
        data: buffer,
        width: width,
        height: height
    };
    imgT.dispose();
    return image;
}

/**
 * 计算两个Embedding间的l2距离
 * @param {tf.Tensor2d} embedding1
 * @param {tf.Tensor2d} embedding2
 * @returns {tf.Tensor}
 */
export function calculatePairDistance(embedding1, embedding2) {
    const dist = tf.tidy(() => {
        let norm = embedding1.sub(embedding2).norm(2, 0, false); //[distance]
        return norm.squeeze();
    });
    return dist;
}

/**
 * 计算Embedding两两之间的距离
 * @param {*} embeddings 
 * @returns Array
 */
export function calculateAllDistance(embeddings) {
    let len = embeddings.length;
    let dist = [];

    tf.tidy(() => {
        for (let i = 0; i < len - 1; ++i) {
            for (let j = i + 1; j < len; ++j) {
                let embedding1 = embeddings[i].squeeze();
                let embedding2 = embeddings[j].squeeze();
                let norm = embedding1.sub(embedding2).norm(2, 0, false).squeeze().toFloat(); //[distance]
                let tmp = Float32Array.from(norm.dataSync());
                dist.push(tmp[0]);
            }
        }
    });
    return dist;
}

export function allLessEqual(array, thresh) {
    for (let val of array) {
        if (val > thresh) { return false };
    }
    return true;
}

/**
 * 从人脸编码库中查询
 * @param {*} query 
 * @param {*} gallery 
 */
export function findInGallery(query, gallery) {

}