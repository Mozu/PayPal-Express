const { constructOrderDetails, getAmount } = require("../../utils");
const { ApiService } = require("../../utils/apiService");
const { URLS, LINKREL } = require("../../utils/constants");

function Paypal(clientId, clientSecret, sandbox = false) {
    this.apiWrapper = new ApiService(clientId, clientSecret);

    const {
        sandboxUrl,
        prodUrl,
        orderUrlPrefix,
        paymentAuthPrefix,
        paymentCapturePrefix,
        paymentUrlPrefix
    } = URLS;

    const baseUrl = sandbox ? sandboxUrl : prodUrl;
    const paymentUrl = baseUrl + paymentUrlPrefix;

    this.orderUrl = baseUrl + orderUrlPrefix;
    this.paymentAuthUrl = paymentUrl + paymentAuthPrefix;
    this.paymentCaptureUr = paymentUrl + paymentCapturePrefix;
}

Paypal.prototype.getOrderDetails = async function (id) {
    try {
        const url = `${this.orderUrl}/${id}`;
        const res = await this.apiWrapper.getWithAuth(url);
        return res;
    }
    catch (e) {
        throw e;
    }
};

Paypal.prototype.CreateOrder = async function (order, returnUrl, cancelUrl) {
    try {
        const payload = constructOrderDetails(order, returnUrl, cancelUrl);

        const res = await this.apiWrapper.postWithAuth(this.orderUrl, payload);
        const { id, links } = res || {};
        const redirectData = links && links.find(link => link.rel === LINKREL.payerAction);
        const redirectLink = redirectData ? redirectData.href : null;
        return {
            redirectLink,
            order,
            token: id,
            correlationId: null // TODO:  Need to check how we can get this.
        };
    } catch (e) {
        throw e;
    }
};

Paypal.prototype.authorizePayment = async function (id) {
    const url = `${this.orderUrl}/${id}/authorize`;
    try {
        const res = await this.apiWrapper.postWithAuth(url);
        const { purchase_units: units = [] } = res || [];
        const { payments } = units.length > 0 ? units[0] : {};
        const { authorizations } = payments || {};
        const { id: transactionId, status } = authorizations.length > 0 ? authorizations[0] : null;
        return {
            transactionId,
            status
        };
    } catch (e) {
        throw e;
    }
};

Paypal.prototype.captureAuthorizedPayment = async function (authId, amount, currencyCode, isPartial) {
    const url = `${this.paymentAuthUrl}/${authId}/capture`;
    const payload = {
        final_capture: isPartial,
        amount: getAmount(amount, currencyCode)
    };
    try {
        const res = await this.apiWrapper.postWithAuth(url, payload);
        const { id: transactionId, status } = res;
        return {
            transactionId,
            status
        };
    } catch (e) {
        throw e;
    }
};

Paypal.prototype.voidAuthorizedPayment = async function (authId) {
    const url = `${this.paymentAuthUrl}/${authId}/void`;
    try {
        const res = await this.apiWrapper.postWithAuth(url);
        return res;
    } catch (e) {
        throw e;
    }
};

Paypal.prototype.refundCapturePayment = async function (captureId) {
    const url = `${this.paymentCaptureUrl}/${captureId}/refund`;
    try {
        const res = await this.apiWrapper.postWithAuth(url);
        return res;
    } catch (e) {
        throw e;
    }
};

exports.PaypalRestSdk = Paypal;