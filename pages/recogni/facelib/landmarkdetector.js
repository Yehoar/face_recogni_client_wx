import { fileStorageIO } from "./file_storage";

const request = require("../../../http/request");
const faceLandmarksDetection = require('./face-landmarks-detection/face-landmarks-detection');

class FaceLandmarkDetecor {

    constructor() {
        const FaceDetector = "blazeface";
        const LandmarkDetector = "facemesh";
        const IrisDetector = "iris";

        this.model = null;
        this.ready = false;

        this.server_model_path = {
            FaceDetector: request.api_GetModel(FaceDetector),
            LandmarkDetector: request.api_GetModel(LandmarkDetector),
            IrisDetector: request.api_GetModel(IrisDetector)
        };

        this.local_model_path = {
            FaceDetector: FaceDetector,
            LandmarkDetector: LandmarkDetector,
            IrisDetector: IrisDetector
        };

        this.CacheFlag = "FaceModelCache";
    }

    /**
     * 从服务器获取模型
     */
    async loadFromServer() {
        this.model = await faceLandmarksDetection.load(
            faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
            {
                detectorModelUrl: this.server_model_path.FaceDetector,
                modelUrl: this.server_model_path.LandmarkDetector,
                irisModelUrl: this.server_model_path.IrisDetector,
            }
        );
    }

    /**
     * 从本地缓存加载模型
     */
    async loadFromStorage() {

        const flag = wx.getStorageSync(this.CacheFlag);
        if (flag === true) {
            const fs = wx.getFileSystemManager();
            const fs_face = fileStorageIO(this.local_model_path.FaceDetector, fs);
            const fs_iris = fileStorageIO(this.local_model_path.IrisDetector, fs);
            const fs_landmark = fileStorageIO(this.local_model_path.LandmarkDetector, fs);
            this.model = await faceLandmarksDetection.load(
                faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
                {
                    detectorModelUrl: fs_face,
                    modelUrl: fs_landmark,
                    irisModelUrl: fs_iris,
                }
            );
        }
    }

    /**
     * 加载模型
     * @param {Boolean} save 是否缓存模型到本地
     */
    async load(save = true) {
        //尝试从本地获取模型
        try {
            if (this.model == null) {
                console.debug("LoadFromStorage")
                await this.loadFromStorage();
            }
        } catch (e) {
            //console.error(e);
            console.debug("LoadStoragefailed!");
        }

        //从服务器获取模型
        if (this.model == null) {
            console.debug("LoadFromServer")
            await this.loadFromServer();
            //保存模型
            if (save && this.model != null) {
                console.debug("save");
                this.saveToLocal();
            } else {
                wx.setStorageSync(this.CacheFlag, false);
            }
        }

        this.isReady = this.model != null;
    }

    /**
     * 保存模型到本地
     */
    saveToLocal() {
        const fs = wx.getFileSystemManager();
        const fs_face = fileStorageIO(this.local_model_path.FaceDetector, fs);
        const fs_iris = fileStorageIO(this.local_model_path.IrisDetector, fs);
        const fs_landmark = fileStorageIO(this.local_model_path.LandmarkDetector, fs);
        this.model.pipeline.irisModel.save(fs_iris)
        this.model.pipeline.meshDetector.save(fs_landmark);
        this.model.pipeline.boundingBoxDetector.blazeFaceModel.save(fs_face);
        wx.setStorageSync(this.CacheFlag, true);
    }

    async estimateFaces(params) {
        return await this.model.estimateFaces(params);
    }

    /**
     * 卸载模型
     */
    dispose() {
        if (this.model !== null) {
            this.model.pipeline.irisModel.dispose();
            this.model.pipeline.meshDetector.dispose();
            this.model.pipeline.boundingBoxDetector.blazeFaceModel.dispose();
        }
    }
}

exports.FaceLandmarkDetecor = FaceLandmarkDetecor;