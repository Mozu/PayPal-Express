const needle = require("needle");
const { URLS } = require("./constants");

function ApiService(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
}

ApiService.prototype.generateToken = async function () {
    const basic = generateBasicAuth(this.clientId, this.clientSecret);
    const url = URLS.token;
    const body = { 'grant_type': 'client_credentials' };
    const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `basic ${basic}`
    };

    try {
        const result = await this.post(url, body, headers);
        const { access_token: token } = result || {};
        return token;
    } catch (err) {
        throw err;
    }
};

ApiService.prototype.get = async function (url, headers, needAuth = false) {
    headers = await this.constructHeaders(needAuth, headers);
    const options = { headers };
    try {
        const res = await send(url, null, options);
        return res;
    }
    catch (err) {
        throw constructErrorResponse(err);
    }
};

ApiService.prototype.getWithAuth = async function (url, headers) {
    try {
        const res = await this.get(url, headers, true);
        return res;
    } catch (e) {
        throw e;
    }
};

ApiService.prototype.post = async function (url, body, headers, needAuth = false) {
    try {
        headers = await this.constructHeaders(needAuth, headers);
        const options = { headers };
        const res = await send(url, body, options, 'post');
        return res;
    }
    catch (err) {
        throw constructErrorResponse(err, body);
    }
};

ApiService.prototype.postWithAuth = async function (url, body = {}, headers = {}) {
    try {
        const res = await this.post(url, body, headers, true);
        return res;
    } catch (e) {
        throw e;
    }
};

const generateBasicAuth = (clientId, clientSecret) => {
    return Buffer.from(clientId + ":" + clientSecret).toString("base64");
};

const getAuthHeaders = function (token, contentType = 'application/json') {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType
    };
};

ApiService.prototype.constructHeaders = async function (needAuth, headers) {
    if (needAuth) {
        const token = await this.generateToken();
        const authHeaders = getAuthHeaders(token);
        headers = { ...headers, ...authHeaders };
    }
    return headers;
};

const constructErrorResponse = function (err, body) {
    const { debug_id, message, error_description, details = {}, statusCode } = err;
    const { description } = (details ? details[0] : details) || {};
    return {
        correlationId: debug_id,
        statusCode,
        errorMessage: description || error_description || message,
        err: err,
        body
    };
};

const isJson = (options) => options.headers['Content-Type'] === 'application/json';
// Needle wrapper to send request
const send = (url, body, options, method = 'get') => {
    var promise = new Promise(function (resolve, reject) {
        body = method === 'get' ? null : body;
        if (isJson(options)) {
            options = { ...options, json: true };
        }
        needle.request(
            method,
            url,
            body,
            options,
            function (err, response, data) {
                if (![201, 200].includes(response.statusCode)) {
                    const err = {
                        ...response.body,
                        statusCode: response.statusCode
                    };
                    reject(err);

                }
                else {
                    resolve(data);
                }
            }
        );
    });
    return promise;
};

exports.ApiService = ApiService;