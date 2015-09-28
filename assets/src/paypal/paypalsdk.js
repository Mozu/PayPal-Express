var urlParser = require('url');
var https = require('https');
var querystring = require('querystring');
var _ = require('underscore');
var needle = require('needle');
/**
 * Constructor for PayPal object.
 */
function Paypal(apiUsername, apiPassword, signature, debug) {
	this.username = apiUsername;
	this.password = apiPassword;
	this.signature = signature;
	this.debug = debug || false;
	this.payOptions = {};
	this.products = [];

	this.url = 'https://' + (debug ? 'api-3t.sandbox.paypal.com' : 'api-3t.paypal.com') + '/nvp';
	this.redirect = 'https://' + (debug ? 'www.sandbox.paypal.com/cgi-bin/webscr' : 'www.paypal.com/cgi-bin/webscr');
}

/**
 * Paypal params.
 * @return {object} [description]
 */
Paypal.prototype.params = function() {
	var result = {
		USER: this.username,
		PWD: this.password,
		SIGNATURE: this.signature,
		VERSION: '117.0',
	};

	return result; 
};

/**
 * Format number to be in proper format for payment.
 * @param  {[type]} num        [description]
 * @param  {[type]} doubleZero [description]
 * @return {string}            Returns null if cannot format.
 */
function prepareNumber(num, doubleZero) {
	var str = num.toString().replace(',', '.');

	var index = str.indexOf('.');
	if (index > -1) {
		var len = str.substring(index + 1).length;
		if (len === 1) {
			str += '0';
		}

		if (len > 2) {
			str = str.substring(0, index + 3);
		}
	} else {
		if (doubleZero || true) {
			str += '.00';
		}
	}

	return str;
}


/**
 * GetExpressCheckoutDetails, this will also call DoExpressCheckoutPayment optionally; in most cases you want to have this. 
 * @param  {string}   token    [description]
 * @return {Paypal}            [description]
 */
Paypal.prototype.getExpressCheckoutDetails = function(token) {
	var self = this;
	var params = self.params();

	params.TOKEN = token;
	params.METHOD = 'GetExpressCheckoutDetails';
	console.log(params);

	return self.request(params);
};


Paypal.prototype.authorizePayment = function(token,payerId,orderNumber, amount, currencyCode) {
	var self = this;
	var params = self.params();

	
	params.PAYERID = payerId;
	params.TOKEN = token;
	params.PAYMENTREQUEST_0_AMT = amount;
	params.PAYMENTREQUEST_0_CURRENCYCODE = currencyCode;
	params.PAYMENTREQUEST_0_INVNUM = orderNumber;
	params.PAYMENTREQUEST_0_PAYMENTACTION = "Authorization";
	params.METHOD = 'DoExpressCheckoutPayment';

	return self.request(params).then(function(data) {
		return { correlationId: data.CORRELATIONID, transactionId: data.PAYMENTINFO_0_TRANSACTIONID, status: data.PAYMENTINFO_0_PAYMENTSTATUS};
	});
};


Paypal.prototype.doCapture = function(token,orderNumber, authorizationId, amount, currencyCode ) {
	var self = this;
	var params = self.params();

	
	params.AUTHORIZATIONID = authorizationId;
	params.TOKEN = token;
	params.AMT = amount;
	params.CURRENCYCODE = currencyCode;		
	params.COMPLETETYPE = "Complete";
	params.INVNUM = orderNumber;
	params.METHOD = 'DoCapture';

	return self.request(params).then(function(data) {
		console.log(data);
		return { correlationId: data.CORRELATIONID, transactionId: data.TRANSACTIONID};
	});
};


Paypal.prototype.doRefund = function(transactionId, fullRefund, amount,currencyCode) {
	var self = this;
	var params = self.params();

	
	params.TRANSACTIONID = transactionId;
	if (!fullRefund) {
		params.AMT = amount;
		params.CURRENCYCODE = currencyCode;	
		params.REFUNDTYPE = "Partial";	
	} else
		params.REFUNDTYPE = "Full";	
	params.METHOD = 'RefundTransaction';
	console.log("Refund details", params);
	
	return self.request(params).then(function(data) {
		console.log(data);
		return { correlationId: data.CORRELATIONID, transactionId: data.REFUNDTRANSACTIONID};
	});
};

/**
 * Add product for pricing.	
 * @param {array} products       item in arary = { name, description, quantity, amount }
 */
Paypal.prototype.setProducts = function(products) {
	this.products = products;
	return this;
};

/**
 * Get Items params.
 * @return {[type]} [description]
 */
Paypal.prototype.getItemsParams = function() {
	var params = {};
	// Add product information.
	for(var i = 0; i < this.products.length; i++) {
		if (this.products[i].name) {
			params['L_PAYMENTREQUEST_0_NAME' + i] = this.products[i].name;	
		}

		if (this.products[i].description) {
			params['L_PAYMENTREQUEST_0_DESC' + i] = this.products[i].description;	
		}

		if (this.products[i].amount) {
			params['L_PAYMENTREQUEST_0_AMT' + i] = prepareNumber(this.products[i].amount);	
		}

		if(this.products[i].quantity) {
			params['L_PAYMENTREQUEST_0_QTY' + i] = this.products[i].quantity;	
		}
	}

	return params;
};

/**
 * Pay.
 * @param {string} email [description]
 * @param  {String}   invoiceNumber [description]
 * @param  {Number}   amount         [description]
 * @param  {String}   description   [description]
 * @param  {String}   currency      EUR, USD
 * @param  {Function} callback      [description]
 * @return {PayPal}                 [description]
 */
Paypal.prototype.setExpressCheckoutPayment = function(email, amount, description, currency, returnUrl, cancelUrl) {
	var self = this;
	var params = self.params();
	if (email) {
		params.EMAIL = email;
	}

	//params.SOLUTIONTYPE = onlyPayPalUsers === true ? 'Mark' : 'Sole';
	params.PAYMENTREQUEST_0_AMT = prepareNumber(amount);
	params.PAYMENTREQUEST_0_DESC = description;
	params.PAYMENTREQUEST_0_CURRENCYCODE = currency;
	//params.PAYMENTREQUEST_0_INVNUM = invoiceNumber;
	//params.PAYMENTREQUEST_0_CUSTOM = invoiceNumber + '|' + params.PAYMENTREQUEST_0_AMT + '|' + currency;
	//params.PAYMENTREQUEST_0_CUSTOM = params.PAYMENTREQUEST_0_AMT + '|' + currency;
	params.PAYMENTREQUEST_0_PAYMENTACTION = 'Authorization';
	params.PAYMENTREQUEST_0_ITEMAMT = prepareNumber(amount);

	params = _.extend(params, this.getItemsParams());

	params.RETURNURL = returnUrl;
	params.CANCELURL = cancelUrl;

	params.NOSHIPPING = 1;
	params.ALLOWNOTE = 1;
	params.REQCONFIRMSHIPPING = 0;
	params.METHOD = 'SetExpressCheckout';

	params = _.extend(params, this.payOptions);
	console.log("set express checkout request", params);
	return self.request(params).then(function(data) {
		console.log("Set express checkout",data);
		//if (data.ACK === 'Success') {
			return { 
				redirectUrl: self.redirect + '?cmd=_express-checkout&useraction=commit&token=' + data.TOKEN, 
				token: data.TOKEN,
				correlationId: data.CORRELATIONID
			};
		//}

		//return new Error('ACK ' + data.ACK + ': ' + data.L_LONGMESSAGE0+' : CorrelationId: '+data.CORRELATIONID);
	});
};

/**
 * Do express checkout payment.
 * @param {object} params returned by getExpressCheckoutDetails callback.
 * @return {[type]} [description]
 */
Paypal.prototype.doExpressCheckoutPayment = function(params) {
	var self = this;
	params.METHOD = 'DoExpressCheckoutPayment';	

	return self.request(self.url, params);

};
	
/**
 * Set some options used for payments.
 * @param {string} hdrImageUrl        [description]
 * @param {string} logoUrl         [description]
 * @param {string} backgroundColor [description]
 * @param {string} cartBorderColor [description]
 * @param {string} brandName       [description]
 * @param {number} requireShipping [description]
 * @param {number} noShipping      [description]
 */
Paypal.prototype.setPayOptions = function(requireShipping, noShipping, allowNote) {
	this.payOptions = {};

	/*if (brandName) {
		this.payOptions.BRANDNAME = brandName;
	}

	if (hdrImageUrl) {
		this.payOptions.HDRIMG = hdrImageUrl;
	}

	if (logoUrl) {
		this.payOptions.LOGOIMG = logoUrl;
	}

	if (backgroundColor) {
		this.payOptions.PAYFLOWCOLOR = backgroundColor;
	}

	if (cartBorderColor) {
		this.payOptions.CARTBORDERCOLOR = cartBorderColor;
	}*/

	if (requireShipping !== undefined) {
		this.payOptions.REQCONFIRMSHIPPING = requireShipping ? 1 : 0;
	}

	if (noShipping !== undefined) {
		this.payOptions.NOSHIPPING = noShipping ? 1 : 0;
	}

	if (allowNote !== undefined) {
		this.payOptions.ALLOWNOTE = allowNote ? 1 : 0;
	}

	this.payOptions.TOTALTYPE = "EstimatedTotal";
	return this;
};

/**
 * Special Request function that uses NVP refered from Classic PayPal API.
 * @param  {string}   url      [description]
 * @param  {string}   method   [description]
 * @param  {object}   data     [description]
 * @param  {Function} callback [description]
 * @return {Paypal}            [description]
 */
Paypal.prototype.request = function( params) {

	var self = this;
	var promise = new Promise(function(resolve, reject) {
		var encodedParams = querystring.stringify(params);

		needle.post(self.url, 
			encodedParams,
			{json: false, parse: true}, 
			function(err, response, body) {
				if (response.statusCode != 200){
					console.log("Paypal express Error", response);
					reject({statusCode : response.StatusCode, data: err});
				}
				else {
					var data = querystring.parse(body);
					if (data.ACK !== 'Success') {
						console.log("Paypal express error", data);
						reject({"ACK" : data.ACK,  "statusText" : data.L_LONGMESSAGE0, 
							"correlationId" : data.CORRELATIONID, "method" : params.METHOD,
							"statusMessage": data.L_SHORTMESSAGE0, "errorCode" : data.L_ERRORCODE0});
					}
					else
						resolve(data);
				}
			}
		);
	});
	

	return promise;
};

/**
 * Default timeout is 10s.
 * @type {Number}
 */
exports.timeout = 10000;

/**
 * Export paypal object.
 * @type {[type]}
 */
exports.Paypal = Paypal;

/**
 * Create Paypal object. Wrapper around constructor.
 */
exports.create = function(username, password, signature, debug) {
	return new Paypal(username, password, signature, debug);
};