const needle = require("needle");
const { URLS } = require("./constants");

function ApiService(config, merchantId, isSandbox) {
    this.clientId = isSandbox ? config.sbxClientId : config.prodClientId; // Kibo's Partner Account clientId
    this.clientSecret = isSandbox ? config.sbxClientSecret : config.prodClientId; // Kibo's Partner Account secret
    this.bnCode = isSandbox ? config.sbxBnCode : config.prodBnCode; // Kibo's Partner Account BN Code
    this.merchantId = merchantId; // Client's Merchant Account Id
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

// See "Generate PayPal-Auth-Assertion header" section https://developer.paypal.com/docs/multiparty/checkout/immediate-capture/
ApiService.prototype.generateAuthAssertion = function () {
  const auth1 = Buffer.from('{"alg":"none"}').toString("base64");
  const auth2 = Buffer.from(`{"iss":${this.clientId},"payer_id":${this.merchantId}}`).toString("base64");
  const authAss = `${auth1}.${auth2}.`;
  return `${auth1}.${auth2}.`;
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
        throw constructErrorResponse(err);
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

ApiService.prototype.patch = async function (url, body, headers, needAuth = false) {
    try {
        headers = await this.constructHeaders(needAuth, headers);
        const options = { headers };
        const res = await send(url, body, options, 'patch');
        return res;
    }
    catch (err) {
        throw constructErrorResponse(err);
    }
};


ApiService.prototype.patchWithAuth = async function (url, body = {}, headers = {}) {
    try {
        const res = await this.patch(url, body, headers, true);
        return res;
    } catch (e) {
        throw e;
    }
};

const generateBasicAuth = (clientId, clientSecret) => {
    return Buffer.from(clientId + ":" + clientSecret).toString("base64");
};

// 'PayPal-Auth-Assertion' determines which of our client's Merchant Accounts the request is for and authorizes for it
//     eg) it determines which merchant account the order will be created for and which party is the order.purchase_units.payee on it
//     Clients can use their own Merchant Account Authorization to get orders we create, capture payments we authorize, etc when we authorize in this manner
const getAuthHeaders = function (token, authAssertion, contentType = 'application/json') {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
        'PayPal-Auth-Assertion': authAssertion
    };
};

// See BN Code section https://developer.paypal.com/docs/multiparty/create-account/
// This header allows our Partner account to collect attribution revenue for Merchant transactions
ApiService.prototype.getAttributionHeader = function () {
  return {
    'PayPal-Partner-Attribution-Id': this.bnCode
  };
};

ApiService.prototype.constructHeaders = async function (needAuth, headers) {
    if (needAuth) {
        const token = await this.generateToken();
        const authAssertion = this.generateAuthAssertion();
        const authHeaders = getAuthHeaders(token, authAssertion);
        const attributionHeader = this.getAttributionHeader();
        headers = { ...headers, ...authHeaders, ...attributionHeader };
    }
    return headers;
};

const constructErrorResponse = function (err) {
    const { debug_id, message, error_description, details = {}, statusCode } = err;
    const { description } = (details ? details[0] : details) || {};
    return {
        correlationId: debug_id,
        statusCode,
        errorMessage: description || error_description || message
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
                if (![201, 200, 204].includes(response.statusCode)) {
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
