const SERVER_URL = "http://127.0.0.1:5000";
const URL_ALL = {
    //model
    face_detector: `${SERVER_URL}/static/tfjs-model/blazeface/model.json`,
    landmark_detector: `${SERVER_URL}/static/tfjs-model/facemesh/model.json`,
    iris: `${SERVER_URL}/static/tfjs-model/iris/model.json`,

    //debug
    RenderPrediction: `${SERVER_URL}/debug/RenderPrediction`,
};

export function url_for(keyword) {
    var value = (typeof (keyword) == 'string') ? URL_ALL[keyword] : "";
    return (typeof (value) != "undefined") ? value : "";
}