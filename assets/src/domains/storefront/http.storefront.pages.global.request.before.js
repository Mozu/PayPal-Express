/**
 * Implementation for http.storefront.pages.global.request.before
 * This function will receive the following context object:

{
  &#34;type&#34;: &#34;mozu.actions.context.http&#34;
}

 */

var paypal = require('../../paypal/checkout');
var helper = require('../../paypal/helper');

function setError(err, context, callback) {
	console.log(err);
	//context.response.viewData.paypalError = err;
	callback(err);
}

module.exports = function(context, callback) {

	if ( helper.isTokenRequest(context)) {
		paypal.checkUserSession(context);
		paypal.getToken(context)
		.then(function(data){
			context.response.body = data;
			context.response.end();	
		}, function(err) {
			console.log(err);
			context.response.body = err;
			context.response.end();	
		});
	} else if ( helper.isCartPage(context) || helper.isCheckoutPage(context)) {
		try {
			if (!helper.isPayPalCheckout(context)) callback();
			paypal.checkUserSession(context);
			console.log("Processing paypal checkout");
			paypal.process(context).then(function(data){
				var queryStringParams = helper.parseUrl(context);
				var paramsToPreserve = helper.getParamsToPreserve(queryStringParams);
				var redirectUrl = '/checkout/'+data.id;
				if (paramsToPreserve)
					redirectUrl = redirectUrl + "?"+paramsToPreserve;
				context.response.redirect(redirectUrl);
        	  	context.response.end();

			}, function(err) {
				setError(err,context, callback);
			});
		} catch(e) {
			setError(e,context,callback);
		}
	} else
  		callback();
};