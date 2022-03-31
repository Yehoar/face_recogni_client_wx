const urls = require("./urls");
const sm2 = require('miniprogram-sm-crypto').sm2;

const emptyFunc = (res) => { };
const globalData = {};

/**
 * 复制全局变量
 * @param {Object} src 
 */
function updateGlobalData(src) {
    for (let key in src) {
        globalData[key] = src[key];
    }
}

/**
 * @returns 时间戳
 */
export function GetLocalTime() {
    return new Date().getTime();
}


/**
 * 对data进行加密
 * @param {object} data 
 * @returns {object}
 */
export function doEncrypt(data) {
    let publicKey = globalData.serverKey;
    data.timestamp = GetLocalTime();  // 加上时间戳
    let json = sm2.doEncrypt(JSON.stringify(data), publicKey, 1);
    data = { encrypt: true, json: json };
    return data;
}

/**
 * 封装一个服务器用的request
 * @param {*} param0 
 */
export function requestServer({ url, data = "", dataType = "json", method = "GET", responseType = "text", header = {}, success = emptyFunc, fail = emptyFunc, complete = emptyFunc } = {}) {

    if (Object.keys(header).length <= 0) {
        header["Cookie"] = globalData.cookie;
        header["content-type"] = "application/json";
    }

    wx.request({
        url: url,
        header: header,
        data: data,
        dataType: dataType,
        method: method,
        responseType: responseType,
        success: success,
        fail: fail,
        complete: complete
    })
}

/**
 * 封装一个服务器用的request
 * @param {*} param0 
 * @returns Promise
 */
export function requestServerPromise({ url, data = "", dataType = "json", method = "GET", responseType = "text", header = {} } = {}) {
    if (Object.keys(header).length <= 0) {
        header["Cookie"] = globalData.cookie;
        header["content-type"] = "application/json";
    }
    return new Promise((resolve, reject) => {
        wx.request({
            url: url,
            header: header,
            data: data,
            dataType: dataType,
            method: method,
            responseType: responseType,
            success: (res) => { (res.statusCode === 200) ? resolve(res.data) : reject(res); },
            fail: (res) => { reject(res); },
        })
    });
}

/**
 * 上传含有ArrayBuffer|Uint8Array的数据
 * @param {Object} data 表单数据 
 * @param {string} url 
 * @param {boolean} encrypt 是否加密 
 * @returns 
 */
function upload_buffer({ data, url, encrypt } = {}) {
    let copy = {};
    for (let key in data) {
        let value = data[key];
        if (value instanceof ArrayBuffer || value instanceof Uint8Array) {
            copy[key] = wx.arrayBufferToBase64(value)
        } else {
            copy[key] = value;
        }
    }
    if (encrypt) {
        copy = doEncrypt(copy);
    }
    return requestServerPromise({
        url: url,
        method: "POST",
        data: copy,
    });
}



/**
 * 初始化会话，每次启动小程序视为一次新的会话
 */
export function api_InitSession() {
    return new Promise((resolve, reject) => {
        let keypair = sm2.generateKeyPairHex()
        let publicKey = keypair.publicKey // 公钥
        let privateKey = keypair.privateKey // 私钥
        wx.request({
            url: urls.URL_INIT_SESSION,
            method: 'POST',
            data: { "publicKey": publicKey },
            success: (res) => {
                console.debug(res);
                if (res.data["status_code"] === "success") {
                    let app = getApp();
                    // 保持session标识
                    app.globalData.cookie = res.header["Set-Cookie"];
                    app.globalData.serverKey = res.data["publicKey"];
                    app.globalData.clientKey = privateKey;
                    app.globalData.ready = true;
                    updateGlobalData(app.globalData);
                    resolve(res);
                } else {
                    reject({ title: res.data["message"], icon: "error" });
                }
            },
            fail: (res) => {
                console.debug(res);
                reject({ title: '网络错误', icon: "error" });
            }
        });
    });
}

/**
 * 初始化前后端会话
 * @deprecated  暂不使用 wx.login
 */
function _api_InitSession() {
    wx.showLoading({ title: "正在初始化", mask: true });
    let keypair = sm2.generateKeyPairHex()
    let publicKey = keypair.publicKey // 公钥
    let privateKey = keypair.privateKey // 私钥

    // 更新app引用
    wx.login({
        success: (res) => {
            // 发送 res.code 到后台换取 openId, sessionKey, unionId
            if (res.code) {
                wx.request({
                    url: urls.URL_INIT_SESSION,
                    method: 'POST',
                    data: { "code": res.code, "publicKey": publicKey },
                    success: (res) => {
                        console.log(res);
                        if (res.data["status_code"] === "success") {
                            let app = getApp();
                            // 保持session标识
                            app.globalData.cookie = res.header["Set-Cookie"];
                            app.globalData.serverKey = res.data["publicKey"];
                            app.globalData.clientKey = privateKey;
                            wx.hideLoading();
                        } else {
                            wx.showToast({ title: '初始化错误', icon: "error" });
                        }
                    },
                    fail: () => { wx.showToast({ title: '服务器错误', icon: "error" }); }
                });
            } else {
                wx.showToast({ title: '初始化错误', icon: "error" });
            }
        },
        fail: () => { wx.showToast({ title: '初始化错误', icon: "error" }); }
    });
}

/**
 * 活体检测接口
 * @param {object} data 
 */
export function api_AntiSpoofing(data) {
    return requestServerPromise({
        url: urls.URL_ANTISPOOFING,
        data: data,
        method: "POST",
    })
}

/**
 * 获取model的url
 * @param {string} name 模型名称
 */
export function api_GetModel(name) {
    return `${urls.URL_MODEL}/${name}/model.json?timestamp=${GetLocalTime()}`;
}

/**
 * 用户注册接口
 * @param {object} user 
 */
export function api_Register(user) {
    wx.showLoading({ title: '注册中，请稍候', mask: true });
    let showFail = (res) => {  // 请求失败
        wx.hideLoading();
        let message = res.message == "" ? "注册失败" : res.message;
        wx.showToast({ title: message, icon: "error" });
    };
    const app = getApp();
    let data = doEncrypt(user);
    requestServerPromise({
        url: urls.URL_REGISTER,
        method: "POST",
        data: data
    }).then((res) => {
        console.debug(res);
        if (res.status_code == "success") {  // 注册成功，修改本地状态
            user.userType = res.userType;
            user.passwd = undefined;
            app.globalData.user = user;
            updateGlobalData(app.globalData);
            wx.hideLoading();
            wx.navigateBack({
                delta: 2,
                complete: () => { wx.showToast({ title: "注册成功", icon: "success" }); },
            });  // 注册成功，回到首页
        } else {
            showFail(res);
        }
    }, showFail);
}

/**
 * 用户登录接口
 * @param form 表单信息 包含学号、密码
 */
export function api_Login(form) {
    wx.showLoading({ title: '登录中，请稍候', mask: true });
    let showFail = (res) => {  // 请求失败
        wx.hideLoading();
        let message = res.message == "" ? "登录失败" : res.message;
        wx.showToast({ title: message, icon: "error" });
    };
    const app = getApp();
    let data = doEncrypt(form);
    requestServerPromise({
        url: urls.URL_LOGIN,
        method: "POST",
        data: data
    }).then((res) => {
        console.debug(res);
        if (res.status_code == "success") {  // 注册成功，修改本地状态
            app.globalData.user = { userId: form.account, userType: res.userType };
            updateGlobalData(app.globalData);
            wx.hideLoading();
            wx.navigateBack({
                delta: 1,
                complete: () => { wx.showToast({ title: "登录成功", icon: "success" }); }
            });  // 登录成功，回到首页
        } else {
            showFail(res);
        }
    }, showFail);
}

/**
 * 用户登出
 * @returns {Promise}
 */
export function api_Logout() {
    return requestServerPromise({
        url: urls.URL_LOGOUT,
        method: "POST",
    });
}

/**
 * 上传人脸编码，查询用户
 * @param {*} data 
 * @param {*} encrypt 
 * @returns 
 */
export function api_Recogni(data, encrypt = false) {
    return upload_buffer({ data: data, url: urls.URL_RECOGNI, encrypt: encrypt });
}

/**
 * 上传人脸编码，登记
 * @param {*} data 
 */
export function api_Collect(data, encrypt = false) {
    return upload_buffer({ data: data, url: urls.URL_COLLECT, encrypt: encrypt });
}

export function api_Debug(data) {
    requestServer({
        url: urls.URL_DEBUG,
        method: "POST",
        data: data
    });
}