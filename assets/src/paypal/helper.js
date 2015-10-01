
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
	parseHref: function(context) {
		console.log(context.request);
		var urlParseResult = url.parse(context.request.href);
		console.log("parsedUrl", urlParseResult);
		return urlParseResult;
	},
	parseUrl: function(context) {
		var self = this;
		var urlParseResult = url.parse(context.request.url);
		queryStringParams = qs.parse(urlParseResult.query);
		return queryStringParams;
	},
	isPayPalCheckout: function(context) {
		var queryString = this.parseUrl(context);
		return (queryString.paypalCheckout === "1" && 
			queryString.PayerID !== "" && 
			queryString.token !== "" && (queryString.id !== "" || this.isCheckoutPage(context)) );
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
	},
	getParamsToPreserve: function(params) {
		delete params.id;
		delete params.token;
		delete params.isCart;
		delete params.PayerID;
		delete params.paypalCheckout;
		var queryString = "";
		Object.keys(params).forEach(function(key){
			if (queryString !== "")
			queryString += "&";
			queryString += key +"=" + params[key];
		});
        return queryString;
    }
};
