import { GetLocalTime } from "./util"

const SERVER_URL = "http://127.0.0.1:5000";
const URL_ALL = {
    //model
    face_detector: `${SERVER_URL}/model/blazeface/model.json?timestamp=${GetLocalTime()}`,
    landmark_detector: `${SERVER_URL}/model/facemesh/model.json?timestamp=${GetLocalTime()}`,
    iris: `${SERVER_URL}/model/iris/model.json?timestamp=${GetLocalTime()}`,

    // other
    init: `${SERVER_URL}/init`,
    anti_spoof: `${SERVER_URL}/anti_spoof`,
    //debug
    RenderPrediction: `${SERVER_URL}/debug/RenderPrediction`,
};

export function url_for(keyword) {
    if (typeof (keyword) != 'string' || keyword == "") {
        return "";
    }
    var url = URL_ALL[keyword];
    if (typeof (url) == "undefined") {
        url = `${SERVER_URL}/${keyword}`
    }
    return url

}