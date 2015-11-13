/**
 * Implementation for http.storefront.pages.global.request.after
 * This function will receive the following context object:

{
  &#34;type&#34;: &#34;mozu.actions.context.http&#34;
}

 */
var paypal = require('../../paypal/checkout');
var helper = require('../../paypal/helper');


module.exports = function(context, callback) {
	var paypalError = context.cache.request.get("paypalError");
	if (paypalError) {
		console.log("Adding paypal error to viewData", paypalError);
		var message = paypalError;
		if (paypalError.statusText)
			message = paypalError.statusText;
		else if (paypalError.message){
			message = paypalError.message;
			if (message.errorMessage)
				message = message.errorMessage;
		}
		else if (paypalError.errorMessage)
			message = paypalError.errorMessage;
		context.response.model.messages = 	[	
			{"message": message}
		];
		//context.response.viewData.paypalError = paypalError;
	}
	callback();
};