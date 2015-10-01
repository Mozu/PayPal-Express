/**
 * Implementation for http.storefront.pages.global.request.before
 * This function will receive the following context object:

{
  &#34;type&#34;: &#34;mozu.actions.context.http&#34;
}

 */

var paypal = require('../../paypal/checkout');
var helper = require('../../paypal/helper');

module.exports = function(context, callback) {

	if ( helper.isTokenRequest(context)) {
		paypal.getToken(context)
		.then(function(data){
			context.response.body = data;
			context.response.end();	
		}, function(err) {
			console.log(err);
			context.response.body = err;
			context.response.end();	
		});
	} /*else if (context.request.url.indexOf("/cart") > -1 || context.request.url.indexOf("/checkout") > -1) {
		console.log("Processing paypal checkout");

		var queryString = paypal.parseUrl(context.request);
		console.log(queryString);
		var isPaypalCheckout  = (queryString.paypalCheckout === "1" && queryString.PayerId !== ""  && queryString.token !== "" && queryString.id !== "");
		console.log("is Paypal checkout ", isPaypalCheckout);
		if (!isPaypalCheckout)  
			 callback();

		try {
			paypal.process(context).then(function(data){
				context.response.redirect('/checkout/'+data.id);
        	  	context.response.end();

			}, function(err) {
				callback(err);
			});
		} catch(e) {
			callback(err);
		}
	}*/ else
  		callback();
};