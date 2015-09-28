
var getAppInfo = require('mozu-action-helpers/get-app-info');
var url = require("url");
var qs = require("querystring");
var paymentConstants = require("../utils/constants");
var _ = require("underscore");

var paypalCheckout = module.exports = {
	isTokenRequest: function(context) {
		 return context.request.url.indexOf("/paypal/token") > -1;
	},
	isCartPage: function(context) {
		return context.request.url.indexOf("/cart") > -1;
	},
	isCheckoutPage: function(context) {
		return context.request.url.indexOf("/checkout") > -1;
	},
	parseUrl: function(context) {
		var urlParseResult = url.parse(context.request.url);
		console.log("parsedUrl", urlParseResult);
		queryStringParams = qs.parse(urlParseResult.query);
		return queryStringParams;
	},
	isPayPalCheckout: function(context) {
		var queryString = this.parseUrl(context);
		return (queryString.paypalCheckout === "1" && queryString.PayerId !== ""  && queryString.token !== "" && queryString.id !== "");
	},
	getPaymentFQN: function(context) {
		console.log(context.apiContext);
		var appInfo = getAppInfo(context);
		return appInfo.namespace+"~"+paymentConstants.PAYMENTSETTINGID;
	},
	getValue: function(paymentSetting,  key) {
		var value = _.findWhere(paymentSetting.credentials, {"apiName" : key});

	    if (!value) {
	      console.log(key+" not found");
	      return;
	    }
	    //console.log("Key: "+key, value.value );
	    return value.value;
	}

};
