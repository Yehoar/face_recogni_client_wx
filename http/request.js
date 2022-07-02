const urls = require("./urls");
const aesjs = require("aes-js");

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
 * 对data进行AES加密
 * @param {object} data 
 * @returns {object}
 */
export function doEncrypt(data) {
    data.timestamp = GetLocalTime();  // 加上时间戳
    let aesCbc = new aesjs.ModeOfOperation.cbc(globalData.key, globalData.iv);
    let textBytes = aesjs.utils.utf8.toBytes(JSON.stringify(data))
    textBytes = aesjs.padding.pkcs7.pad(textBytes);
    let encBytes = aesCbc.encrypt(textBytes);
    let encData = wx.arrayBufferToBase64(encBytes);
    return { encrypt: true, json: encData };
}

/**
 * 对data进行AES解密
 * @param {string} data base64 string
 * @returns {string}
 */
export function doDecrypt(data) {
    if (data == "") {
        return data;
    }
    let encBytes = new Uint8Array(wx.base64ToArrayBuffer(data));
    let aesCbc = new aesjs.ModeOfOperation.cbc(globalData.key, globalData.iv);
    let decBytes = aesCbc.decrypt(encBytes);
    decBytes = aesjs.padding.pkcs7.strip(decBytes);
    let decText = aesjs.utils.utf8.fromBytes(decBytes);
    return decText;
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
        // console.log(copy);
    }
    return requestServerPromise({
        url: url,
        method: "POST",
        data: copy,
    });
}


/**
 * 解析token
 * @param {string} token base64 string
 * @returns {object}
 */
function parseToken(token) {
    token = wx.base64ToArrayBuffer(token);
    token = new Uint8Array(token);
    token = String.fromCharCode(...token);
    let half = parseInt(token.length / 2);
    // 解析token
    let buffer = Array(token.length);
    for (let idx = 0; idx <= half; ++idx) {
        buffer[idx * 2] = token[idx];
    }
    for (let idx = half + 1, pos = 1; idx < token.length; ++idx, pos += 2) {
        buffer[pos] = token[idx];
    }
    token = buffer.join("").split("|");
    return {
        lifetime: token[0],
        key: aesjs.utils.utf8.toBytes(token[1]),
        iv: aesjs.utils.utf8.toBytes(token[2])
    };
}

function init_session(res) {
    let app = getApp();
    // 保持session标识
    let cookie = res.header["Set-Cookie"];
    let token = parseToken(res.data["token"]);
    wx.setStorageSync("cookie", cookie);
    updateGlobalData({ cookie: cookie, ready: true, ...token });
    let user = doDecrypt(res.data["user"]);
    if (user != "") {
        app.globalData.user = JSON.parse(user);
    }
}

/**
 * 初始化会话，每次启动小程序视为一次新的会话
 */
export function api_InitSession() {
    let promise = new Promise((resolve, reject) => {
        let cookie = wx.getStorageSync("cookie");
        // 向服务器新建会话
        wx.request({
            url: urls.URL_INIT_SESSION,
            method: 'POST',
            header: { "cookie": cookie, "content-type": "application/json" },
            success: (res) => {
                console.debug(res);
                if (res.data["status_code"] === "success") {
                    init_session(res);
                    resolve(globalData.lifetime);
                } else {
                    reject({ title: res.data["message"], icon: "error" });
                }
            },
            fail: () => { reject({ title: '网络错误', icon: "error" }); },
        });

    });
    return promise;
}

/**
 * 初始化前后端会话
 * @deprecated  暂不使用 wx.login
 */
// function _api_InitSession() {
//     wx.showLoading({ title: "正在初始化", mask: true });
//     let keypair = sm2.generateKeyPairHex()
//     let publicKey = keypair.publicKey // 公钥
//     let privateKey = keypair.privateKey // 私钥

//     // 更新app引用
//     wx.login({
//         success: (res) => {
//             // 发送 res.code 到后台换取 openId, sessionKey, unionId
//             if (res.code) {
//                 wx.request({
//                     url: urls.URL_INIT_SESSION,
//                     method: 'POST',
//                     data: { "code": res.code, "publicKey": publicKey },
//                     success: (res) => {
//                         console.log(res);
//                         if (res.data["status_code"] === "success") {
//                             let app = getApp();
//                             // 保持session标识
//                             app.globalData.cookie = res.header["Set-Cookie"];
//                             app.globalData.serverKey = res.data["publicKey"];
//                             app.globalData.clientKey = privateKey;
//                             wx.hideLoading();
//                         } else {
//                             wx.showToast({ title: '初始化错误', icon: "error" });
//                         }
//                     },
//                     fail: () => { wx.showToast({ title: '服务器错误', icon: "error" }); }
//                 });
//             } else {
//                 wx.showToast({ title: '初始化错误', icon: "error" });
//             }
//         },
//         fail: () => { wx.showToast({ title: '初始化错误', icon: "error" }); }
//     });
// }

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
export function api_Register(user, encrypt = true) {
    wx.showLoading({ title: '注册中，请稍候', mask: true });
    let showFail = (res) => {  // 请求失败
        wx.hideLoading();
        console.debug(res.message);
        let message = res.message;
        if (typeof (message) == "object") {
            for (let key in message) {
                message = message[key][0];
                break;
            }
        } else if (typeof (message) != "string") {
            message = "注册失败";
        }
        wx.showToast({ title: message, icon: "error" });
    };
    const app = getApp();
    let data = encrypt ? doEncrypt(user) : user;
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
export function api_Login(form, encrypt = true) {
    wx.showLoading({ title: '登录中，请稍候', mask: true });
    let showFail = (res) => {  // 请求失败
        wx.hideLoading();
        console.debug(res);
        let message = res.message;
        if (typeof (message) == "object") {
            for (let key in message) {
                message = message[key][0];
                break;
            }
        } else if (typeof (message) != "string") {
            message = "注册失败";
        }
        wx.showToast({ title: message, icon: "error" });
    };
    const app = getApp();
    let data = encrypt ? doEncrypt(form) : form;
    requestServerPromise({
        url: urls.URL_LOGIN,
        method: "POST",
        data: data
    }).then((res) => {
        console.debug(res);
        if (res.status_code == "success") {  // 注册成功，修改本地状态
            app.globalData.user = { userType: res.userType };
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
export function api_Recogni(data, encrypt = true) {
    return upload_buffer({ data: data, url: urls.URL_RECOGNI, encrypt: encrypt });
}

/**
 * 上传人脸编码，登记
 * @param {*} data 
 */
export function api_Collect(data, encrypt = true) {
    return upload_buffer({ data: data, url: urls.URL_COLLECT, encrypt: encrypt });
}



export function api_Debug(data) {
    requestServer({
        url: urls.URL_DEBUG,
        method: "POST",
        data: data
    });
}

export function api_CreateExam(form) {
    return new Promise((resolve, reject) => {
        const filepath = form.file;
        delete form["file"];
        wx.uploadFile({
            url: urls.URL_CREATEEXAM,
            filePath: filepath.path,
            name: 'file',
            header: { Cookie: globalData.cookie },
            formData: form,
            success(res) {
                res.data = JSON.parse(res.data);
                if (res.statusCode == 200 && res.data.status_code == "success") {
                    resolve(res.data);
                } else {
                    reject(res);
                }
            },
            fail(res) { reject(res); }
        })
    });
}

/**
 * 查询最近10条考试记录
 */
export function api_GetExamList(nums = 10) {
    return requestServerPromise({
        url: `${urls.URL_GETEXAMLIST}?nums=${nums}`,
        method: "GET"
    });
}

export function api_DelExam(examId) {
    return requestServerPromise({
        url: urls.URL_DELEXAM,
        method: "POST",
        data: { examId: examId },
    });
}


/**
 * 解析考试名单
 * @param {string} examId
 * @param {string|JSON} examList 
 */
function parseExamList(examId, examList) {
    try {
        const prefix = "examList-";
        if (typeof (examList) == "string") {
            examList = JSON.parse(examList);
        }
        if (examList["encrypt"] == true) {
            examList = doDecrypt(examList["json"]);
        }
        const res = wx.getStorageInfoSync();
        console.debug(res);
        for (let key of res.keys) {
            if (key.substr(0, 9) == prefix) {
                wx.removeStorageSync(key);
            }
        }
        wx.setStorageSync(prefix + examId, examList);
        // console.debug(examList);
        return true;
    } catch (e) {
        console.error(e);
    }
    return false;
}

/**
 * 从服务器加载考试名单(考试信息,人脸编码)
 * @param {string} examId 
 * @returns 
 */
export function api_LoadExamList(examId) {
    return requestServerPromise({
        url: `${urls.URL_LOADEXAMLIST}?examId=${examId}`,
        method: "GET"
    }).then((data) => {
        if (data.status_code == "success") {
            const ret = parseExamList(examId, data.examList);
            return Promise.resolve(ret);
        } else {
            return Promise.reject({ status_code: "fail" });
        }
    });
}