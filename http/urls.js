const URL_SERVER = "http://10.242.167.176:5000";

module.exports = {
    URL_SERVER: URL_SERVER,
    URL_INIT_SESSION: `${URL_SERVER}/init`,
    URL_ANTISPOOFING: `${URL_SERVER}/anti_spoof`,
    URL_COLLECT: `${URL_SERVER}/collect`,
    URL_MODEL: `${URL_SERVER}/model`,
    URL_REGISTER: `${URL_SERVER}/register`,
    URL_LOGIN: `${URL_SERVER}/login`,
    URL_LOGOUT: `${URL_SERVER}/logout`,
    URL_RECOGNI: `${URL_SERVER}/recogni`,

    /** Debug */
    URL_DEBUG: `${URL_SERVER}/debug/show_request`
}