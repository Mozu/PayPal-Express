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
  if ( helper.isCartPage(context) || helper.isCheckoutPage(context)) {
		

		//var queryString = helper.parseUrl(context);
		//console.log(queryString);
		//var isPaypalCheckout  = (queryString.paypalCheckout === "1" && queryString.PayerId !== ""  && queryString.token !== "" && queryString.id !== "");
		//console.log("is Paypal checkout ", isPaypalCheckout);

		try {
			if (!helper.isPayPalCheckout(context))  
			 callback();
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
	} else {
		callback();
	}
};