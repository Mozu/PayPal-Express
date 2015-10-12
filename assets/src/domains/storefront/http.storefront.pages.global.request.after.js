/**
 * Implementation for http.storefront.pages.global.request.after
 * This function will receive the following context object:

{
  &#34;type&#34;: &#34;mozu.actions.context.http&#34;
}

 */
var paypal = require('../../paypal/checkout');
var helper = require('../../paypal/helper');

function setError(err, context, callback) {
	console.log(err);
	context.response.viewData.paypalError = err;
	callback();
}

module.exports = function(context, callback) {
	var paypalError = context.cache.request.get("paypalError");
	if (paypalError) {
		console.log("Adding paypal error to viewData", paypalError);
		context.response.viewData.paypalError = paypalError;
	}
	callback();
};