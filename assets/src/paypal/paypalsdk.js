var urlParser = require('url');
var https = require('https');
var querystring = require('querystring');
var _ = require('underscore');
var needle = require('needle');

function Paypal(apiUsername, apiPassword, signature, sandbox) {
	this.username = apiUsername;
	this.password = apiPassword;
	this.signature = signature;
	this.sandbox = sandbox || false;
	this.payOptions = {};
	this.products = [];

	this.url = 'https://' + (sandbox ? 'api-3t.sandbox.paypal.com' : 'api-3t.paypal.com') + '/nvp';
	this.redirect = 'https://' + (sandbox ? 'www.sandbox.paypal.com/cgi-bin/webscr' : 'www.paypal.com/cgi-bin/webscr');
}

Paypal.prototype.params = function() {
	var result = {
		USER: this.username,
		PWD: this.password,
		SIGNATURE: this.signature,
		VERSION: '117.0',
	};

	return result; 
};

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


Paypal.prototype.getExpressCheckoutDetails = function(token) {
	var self = this;
	var params = self.params();

	params.TOKEN = token;
	params.METHOD = 'GetExpressCheckoutDetails';
	console.log(params);

	return self.request(params);
};


Paypal.prototype.authorizePayment = function(orderDetails) {
	var self = this;
	var params = self.params();

	
	params.PAYERID = orderDetails.payerId;
	params.TOKEN = orderDetails.token;
	params.PAYMENTREQUEST_0_AMT = prepareNumber(orderDetails.amount);
	params.PAYMENTREQUEST_0_CURRENCYCODE = orderDetails.currencyCode;
	params.PAYMENTREQUEST_0_INVNUM = orderDetails.orderNumber;
	params.PAYMENTREQUEST_0_TAXAMT = prepareNumber(orderDetails.taxAmount);
	params.PAYMENTREQUEST_0_HANDLINGAMT = prepareNumber(orderDetails.handlingAmount);
	params.PAYMENTREQUEST_0_SHIPPINGAMT = prepareNumber(orderDetails.shippingAmount);
	

	params.PAYMENTREQUEST_0_PAYMENTACTION = "Authorization";
	params.METHOD = 'DoExpressCheckoutPayment';

	if (orderDetails.items) {
		params.PAYMENTREQUEST_0_ITEMAMT = prepareNumber(_.reduce(orderDetails.items, function(sum, item) {return sum+item.amount;},0));
		self.setProducts(orderDetails.items);
		params = _.extend(params, self.getItemsParams());
	}
	console.log("authorize payment",params);

	return self.request(params).then(function(data) {
		return { ack: data.ACK,correlationId: data.CORRELATIONID, transactionId: data.PAYMENTINFO_0_TRANSACTIONID, status: data.PAYMENTINFO_0_PAYMENTSTATUS};
	});
};


Paypal.prototype.doCapture = function(token,orderNumber, authorizationId, amount, currencyCode ) {
	var self = this;
	var params = self.params();

	
	params.AUTHORIZATIONID = authorizationId;
	params.TOKEN = token;
	params.AMT = prepareNumber(amount);
	params.CURRENCYCODE = currencyCode;		
	params.COMPLETETYPE = "Complete";
	params.INVNUM = orderNumber;
	params.METHOD = 'DoCapture';

	return self.request(params).then(function(data) {
		console.log(data);
		return { ack: data.ACK, correlationId: data.CORRELATIONID, transactionId: data.TRANSACTIONID};
	});
};


Paypal.prototype.doRefund = function(transactionId, fullRefund, amount,currencyCode) {
	var self = this;
	var params = self.params();

	
	params.TRANSACTIONID = transactionId;
	if (!fullRefund) {
		params.AMT = prepareNumber(amount);
		params.CURRENCYCODE = currencyCode;	
		params.REFUNDTYPE = "Partial";	
	} else
		params.REFUNDTYPE = "Full";	
	params.METHOD = 'RefundTransaction';
	console.log("Refund details", params);

	return self.request(params).then(function(data) {
		console.log(data);
		return { ack: data.ACK, correlationId: data.CORRELATIONID, transactionId: data.REFUNDTRANSACTIONID};
	});
};

Paypal.prototype.doVoid = function(authorizationId) {
	var self = this;
	var params = self.params();

	
	params.AUTHORIZATIONID = authorizationId;
	params.METHOD = 'DoVoid';

	return self.request(params).then(function(data) {
		console.log(data);
		return { ack: data.ACK, correlationId: data.CORRELATIONID, transactionId: data.TRANSACTIONID};
	});
};

Paypal.prototype.setProducts = function(products) {
	this.products = products;
	return this;
};

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

		/*if(this.products[i].taxAmount) {
			params['L_PAYMENTREQUEST_0_TAXAMT' + i] = this.products[i].taxAmount;	
		}*/

	}

	return params;
};

Paypal.prototype.setExpressCheckoutPayment = function(order, returnUrl, cancelUrl) {
	var self = this;
	var params = self.params();
	if (order.email) {
		params.EMAIL = order.email;
	}

	params.PAYMENTREQUEST_0_AMT = prepareNumber(order.amount);
	//params.PAYMENTREQUEST_0_DESC = description;
	params.PAYMENTREQUEST_0_CURRENCYCODE = order.currencyCode;
	params.PAYMENTREQUEST_0_PAYMENTACTION = 'Authorization';
	//params.PAYMENTREQUEST_0_ITEMAMT = prepareNumber(odder.amount);

	if (order.items) {
		self.setProducts(order.items);
		params = _.extend(params, this.getItemsParams());	
	}
	
	if (order.shippingAddress) {
		//params.ADDROVERRIDE = 1;
		params.PAYMENTREQUEST_0_SHIPTONAME = order.shippingAddress.firstName + " " + order.shippingAddress.lastName;
		params.PAYMENTREQUEST_0_SHIPTOSTREET = order.shippingAddress.address1;
		if (order.shippingAddress.address2) 
			params.PAYMENTREQUEST_0_SHIPTOSTREET2 = order.shippingAddress.address2;
		params.PAYMENTREQUEST_0_SHIPTOCITY = order.shippingAddress.cityOrTown;
		params.PAYMENTREQUEST_0_SHIPTOSTATE = order.shippingAddress.stateOrProvince;
		params.PAYMENTREQUEST_0_SHIPTOZIP = order.shippingAddress.postalOrZipCode;
		params.PAYMENTREQUEST_0_SHIPTOCOUNTRYCODE = order.shippingAddress.countryCode;
		params.PAYMENTREQUEST_0_SHIPTOPHONENUM = order.shippingAddress.phone;
	}

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
			return { 
				redirectUrl: self.redirect + '?cmd=_express-checkout&useraction=commit&token=' + data.TOKEN, 
				token: data.TOKEN,
				correlationId: data.CORRELATIONID
			};
	});
};

Paypal.prototype.doExpressCheckoutPayment = function(params) {
	var self = this;
	params.METHOD = 'DoExpressCheckoutPayment';	

	return self.request(self.url, params);

};
	
Paypal.prototype.setPayOptions = function(requireShipping, noShipping, allowNote) {
	this.payOptions = {};

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

exports.Paypal = Paypal;

exports.create = function(username, password, signature, sandbox) {
	return new Paypal(username, password, signature, sandbox);
};