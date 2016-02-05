/**
 * Implementation for http.storefront.routes


 * HTTP Actions all receive a similar context object that includes
 * `request` and `response` objects. These objects are similar to
 * http.IncomingMessage objects in NodeJS.

{
  configuration: {},
  request: http.ClientRequest,
  response: http.ClientResponse
}

 * Call `response.end()` to end the response early.
 * Call `response.set(headerName)` to set an HTTP header for the response.
 * `request.headers` is an object containing the HTTP headers for the request.
 * 
 * The `request` and `response` objects are both Streams and you can read
 * data out of them the way that you would in Node.

 */

var paypal = require('../../paypal/checkout');
var helper = require('../../paypal/helper');
var Guid = require("easy-guid");

function setError(err, context, errorRedirectUrl ) {
	console.error("Paypal Storefront before error",err);
	cache  = context.cache.getOrCreate({type:'distributed', scope:'tenant', level:'shared'});
	var guid = Guid.new(16);
	cache.set("PPE-"+guid, err);

	context.response.redirect(errorRedirectUrl+"?ppErrorId="+guid);
	context.response.end();

}

module.exports = function(context, callback) {
	try {
		var self = this;
		var isPaypalCheckout = helper.isPayPalCheckout(context);
		console.log("is Paypal Checkout", isPaypalCheckout);
		var queryString = helper.parseUrl(context);
		var isCart = queryString.isCart == "1";

		var errorRedirectUrl = (isCart ? "/cart" : "/checkout/"+queryString.id);

		if (!isPaypalCheckout) return callback();
		//self.checkUserSession(context);
		console.log("Processing paypal checkout");
		paypal.process(context, queryString, isCart).then(function(data){
			var queryStringParams = helper.parseUrl(context);
			var paramsToPreserve = helper.getParamsToPreserve(queryStringParams);
			var redirectUrl = '/checkout/'+data.id;
			if (paramsToPreserve)
				redirectUrl = redirectUrl + "?"+paramsToPreserve;
			context.response.redirect(redirectUrl);
    	  	context.response.end();

		}, function(err) {
			setError(err,context, errorRedirectUrl);
		});
	} catch(err) {
		setError(err,context, errorRedirectUrl);
	}
};