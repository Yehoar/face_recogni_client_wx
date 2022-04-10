import { FaceLandmarkDetecor } from "./landmarkdetector";
import { fileStorageIO } from "./file_storage";

const tf = require("@tensorflow/tfjs-core");
const tfconv = require("@tensorflow/tfjs-converter");
const request = require("../../../http/request");
const Tools = require("./tools");



export class FaceRecogni {
    constructor() {
        const MODEL_NAME = "mobilefacenet";
        const EMBEDDING_LENGTH = 128;
        const THRESHOLD = 0.85;

        this.canDetect = false;
        this.canRecogni = false;
        this.model = null;
        this.detector = null;
        this.local_model_path = MODEL_NAME;
        this.server_model_path = request.api_GetModel(MODEL_NAME);
        this.CacheFlag = "RecogniModelCache";
        this.embedding_length = EMBEDDING_LENGTH;
        this.threshold = THRESHOLD;
        this.isReady = false;
        this.gallery = null;
    }

    async load({ save = true, load_recogni = true } = {}) {
        // 加载检测器
        if (this.detector == null) {
            this.detector = new FaceLandmarkDetecor();
            await this.detector.load();
            this.canDetect = this.detector.isReady;
        }

        if (load_recogni) {
            //尝试从本地缓存加载模型
            try {
                console.debug("Load From Storage");
                const flag = wx.getStorageSync(this.CacheFlag);
                if (this.model === null && flag === true) {
                    const fs = wx.getFileSystemManager();
                    const fs_recogni = fileStorageIO(this.local_model_path, fs);
                    this.model = await tfconv.loadGraphModel(fs_recogni);
                }
            } catch (e) {
                console.debug("Load Storage failed!");
            }
            //从服务器获取模型
            if (this.model == null) {
                console.debug("Load From Server");
                this.model = await tfconv.loadGraphModel(this.server_model_path);
                if (save) { this.saveToLocal(); }
            }
            this.canRecogni = this.model != null;
            this.isReady = this.canDetect && (load_recogni == this.canRecogni);
            if (this.isReady) {
                console.debug("FaceRecogni Ready!!!");
            }
        }
    }

    saveToLocal() {
        //保存模型到本地
        if (this.model != null) {
            console.debug("save");
            const fs = wx.getFileSystemManager();
            const fs_recogni = fileStorageIO(this.local_model_path, fs);
            this.model.save(fs_recogni);
            wx.setStorageSync(this.CacheFlag, true);
        }
    }

    /**
     * 清理tensor
     */
    dispose() {
        if (this.model != null) {
            this.model.dispose();
            this.model = null;
        }
        if (this.detector != null) {
            this.detector.dispose();
            this.detector = null;
        }
        if (this.gallery != null) {
            for (let item of this.gallery) {
                for (let key in item) {
                    if (key.includes("embd") && typeof (item[key]) != "string") {
                        item[key].dispose();
                    }
                }
            }
            this.gallery = null;
        }
    }

    checkFace(image, predictions) {
        if (predictions.length <= 0) {
            return [false, "未检测到人脸"];
        } else if (predictions.length > 1) {
            return [false, "人脸数量太多"];
        }
        const annotations = predictions[0]["annotations"];
        if (predictions[0]["faceInViewConfidence"] < 0.8) {
            return [false, "未检测到人脸"];
        }
        const [left, top, right, bottom] = Tools.convertBox(annotations)

        var width = right - left, height = bottom - top;
        // 过远过近判断
        var rw = width / image.width, rh = height / image.height;
        if (rw < 0.2 || rh < 0.2) {
            return [false, "人脸过远"];
        }
        if (rw > 0.85 || rh > 0.85) {
            return [false, "人脸过近"];
        }

        // 居中判断
        var cx = (left + right) / (2 * image.width), cy = (top + bottom) / (2 * image.height);
        if (cx < 0.18 || cy < 0.18 || cx > 0.82 || cy > 0.82) {
            return [false, "人脸未居中"];
        }
        return [true];
    }

    /**
     * 
     * @param {Object} image 
     * @returns [{}]
     */
    async estimateFaces(image) {
        return await this.detector.estimateFaces({ input: image });
    }

    /**
     * 检测人脸
     * @param {{data,width,height}} image
     * @returns 
     */
    async detect(image) {
        if (this.detector != null) {
            const preds = await this.detector.estimateFaces({ input: image }); // 获取人脸关键点
            const check = this.checkFace(image, preds);
            return check[0] ? [true, preds[0]] : check;
        }
        return [false, "模型未加载"];
    }

    /**
     * 
     * @param {{data,width,height}} image
     * @param {*} faceLandmark
     * @param {boolean} norm 
     * @param {boolean} returnTensor  是否返回Tensor
     * @param {boolean} returnFace 是否返回裁剪对齐后的人脸
     * @returns 
     */
    predict({ image, faceLandmark, norm = true, returnTensor = false, returnFace = false } = {}) {
        // 获取特征编码
        const imgT = Tools.faceAlignment(image, faceLandmark, [112, 112], true);  // [1,112,112,3]
        const embedding = tf.tidy(() => {
            const input = imgT.div(255.0).sub(0.5).div(0.5);// 预处理
            let embd = this.model.predict(input);  //[1,128];
            if (norm) {  // l2标准化
                embd = embd.div(embd.norm(2, 1, true));
            }
            return embd.reshape([-1]).toFloat();  // [128] float32
        });

        let ret = [];
        if (returnTensor) {
            ret.push(embedding);
            if (returnFace) { ret.push(imgT); }
        } else {
            const embedding_buffer = Float32Array.from(embedding.arraySync());
            ret.push(embedding_buffer);
            if (returnFace) {
                image = Tools.tensorToImage(imgT, 112, 112);
                ret.push(image);
            }
            embedding.dispose();
            imgT.dispose();
        }

        return ret;
    }

    /**
     * 根据考生数据初始化Gallery
     * @param {*} examList  // [{userId,name,department,major,clazz,embd$ }]
     * @returns 
     */
    setGallery(examList) {
        if (examList == null || examList == "") {
            return false;
        }
        let gallery = [];
        for (let student of examList) {
            let obj = {};
            for (let key in student) {
                let value = student[key];
                if (key.includes("embd") && value != "") {
                    value = wx.base64ToArrayBuffer(value);
                    value = new Float32Array(value); // [128]
                    // console.log(value)
                    value = tf.tensor1d(value);
                }
                obj[key] = value;
            }
            gallery.push(obj);
        }
        if (Object.keys(gallery).length > 0) {
            this.gallery = gallery;
        }
    }

    /**
     * 从本地数据中查询
     * @param {*} query Float32Array
     */
    findInLocalGallery(query) {
        if (this.gallery == null) {
            return null;
        }
        query = tf.tensor1d(query);
        for (let item of this.gallery) {
            for (let key in item) {
                if (!key.includes("embd")) {
                    continue;
                }
                let embedding = item[key];
                if (typeof (embedding) == "string") {
                    continue;
                }
                let dist = Tools.calculatePairDistance(query, embedding);
                if (dist < this.threshold) {
                    return item;
                }
            }
        }
        return null;
    }

    /**
     * 向服务器查询
     * @param {*} query  Float32Array
     * @param {*} face image
     */
    findInRemoteGallery(query, face) {
        return request.api_Recogni({
            embedding: query.buffer,
            im: face.data
        }).then((data) => {
            console.debug(data);
            if (data.status_code !== "success") {
                data = null;
            } else {
                let info = data.info;
                if (typeof (info) == "string") {
                    data = JSON.parse(info);
                } else {
                    data = info;
                }
            }
            return Promise.resolve(data);
        })
    }

}

