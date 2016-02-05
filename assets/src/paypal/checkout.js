var _ = require("underscore");
var constants = require("mozu-node-sdk/constants");
var paymentConstants = require("./constants");
var Order = require("mozu-node-sdk/clients/commerce/order");
var FulfillmentInfo = require('mozu-node-sdk/clients/commerce/orders/fulfillmentInfo');
var OrderPayment = require('mozu-node-sdk/clients/commerce/orders/payment');
var OrderShipment =  require('mozu-node-sdk/clients/commerce/orders/shipment');

var helper = require("./helper");
var paymentHelper = require('./paymenthelper');


function voidExistingOrderPayments(data, context) {
	var promise = new Promise(function(resolve, reject) {
		var activePayments = _.filter(data.order.payments,function(payment) {return payment.status === 'New' && (payment.paymentType !== "StoreCredit" && payment.paymentType !== "GiftCard"); });
		if (activePayments.length > 0) {
			var tasks = activePayments.map(function(payment) {
							console.log("Voiding payment", payment.id);
							return helper.createClientFromContext(OrderPayment,context).
									performPaymentAction({orderId: payment.orderId, paymentId: payment.id},{body: {actionName : "VoidPayment"}});
						});

			Promise.all(tasks).then(function(result) {
				return helper.getOrder(context, data.order.id).then(function(order){
					data.order = order;
					resolve(data);
				});
			},reject);
		} else
			 resolve(data);
	});

	return promise;
}

function convertCartToOrder(context, id, isCart) {
	if (isCart) {
		console.log("Converting cart to order");
		return helper.createClientFromContext(Order, context).createOrderFromCart({ cartId: id  });
	}
	else {
		console.log("Getting existing order");
		return helper.getOrder(context, id, isCart);
	}	
}

function setFulfillmentInfo(context, id, paypalOrder) {
	console.log("ship to name",paypalOrder.SHIPTONAME);
	var shipToName = paypalOrder.SHIPTONAME.split(/\s+/g);
	console.log("shiptoname",shipToName);
	var fulfillmentInfo = { 
		"fulfillmentContact" : { 
        "firstName" : shipToName[0], 
        "lastNameOrSurname" : shipToName[1], 
        "email" : paypalOrder.EMAIL,
        "phoneNumbers" : {
          "home" : paypalOrder.SHIPTOPHONENUM || "N/A"
        },
        "address" : {
          "address1" : paypalOrder.SHIPTOSTREET,
          "cityOrTown" : paypalOrder.SHIPTOCITY,
          "stateOrProvince": paypalOrder.SHIPTOSTATE,
          "postalOrZipCode": paypalOrder.SHIPTOZIP,
          "countryCode": paypalOrder.SHIPTOCOUNTRYCODE,
          "addressType": "Residential",
          "isValidated": "true"
        }
      }
  	};
  	console.log("setting order fulfillmentInfo", fulfillmentInfo);
    return helper.createClientFromContext(FulfillmentInfo, context).setFulFillmentInfo({orderId: id, version:''},{body: fulfillmentInfo});
}


function setPayment(context, order, token, payerId, email) {

	if (order.amountRemainingForPayment < 0) return order;
	var registeredShopper = getUserEmail(context);	
	console.log("Setting payment..amount amountRemainingForPayment", order.amountRemainingForPayment);
	var billingInfo =  {
		"amount" : order.amountRemainingForPayment,
		"currencyCode": order.currencyCode,
		"newBillingInfo":  
	    {   
	        "paymentType": paymentConstants.PAYMENTSETTINGID,
	        "paymentWorkflow": paymentConstants.PAYMENTSETTINGID,
	        "card" : null,
	        "billingContact" : {
	            "email": registeredShopper || email
	        },
	        "isSameBillingShippingAddress" : false,
	         "data" : {
	        	"paypal": {
	        		payerId: payerId
	        	}
        	}
	    },
	    "externalTransactionId" : token
       
	};
    
    console.log("Billing Info", billingInfo);
    return helper.createClientFromContext(OrderPayment, context).
    createPaymentAction({orderId: order.id},{body: billingInfo});
}

function setShippingMethod(context, order, existingShippingMethodCode) {
	return helper.createClientFromContext(OrderShipment,context).getAvailableShipmentMethods({orderId: order.id})
	.then(function(methods){

		if (!methods || methods.length === 0)
			throw new Error("No Shipping methods found for the selected address");

		console.log("shipment methods", methods);
		var shippingMethod = "";
        if (existingShippingMethodCode)
            shippingMethod = _.findWhere(methods, {shippingMethodCode: existingShippingMethodCode});
        
        if (!shippingMethod || !shippingMethod.shippingMethodCode)
            shippingMethod =_.min(methods, function(method){return method.price;});

        return shippingMethod;
	}).then(function(shippingMethod) {
		order.fulfillmentInfo.shippingMethodCode = shippingMethod.shippingMethodCode;
        order.fulfillmentInfo.shippingMethodName = shippingMethod.shippingMethodName;
		console.log("Fulfillment with shippingMethod", order.fulfillmentInfo);
        return helper.createClientFromContext(Order, context).updateOrder({orderId: order.id, version:''}, {body: order});
	});
}

function getUserEmail(context) {
	var user = context.items.pageContext.user;
	console.log("user", user);
	if ( !user.isAnonymous && user.IsAuthenticated ) {
		console.log(user);
		return user.email;
	}
	return null;
}



var paypalCheckout = module.exports = {
	checkUserSession: function(context) {
		var user = context.items.pageContext.user;
		if ( !user.isAnonymous && !user.IsAuthenticated )
		{
		  context.response.redirect('/user/login?returnUrl=' + encodeURIComponent(context.request.url));
		  return context.response.end();
		}
	},
	getToken: function(context, callback) {
		var self = this;
		var queryString = helper.parseUrl(context);
		var id = queryString.id;
		var isCart = queryString.isCart;
		var paramsToPreserve = helper.getParamsToPreserve(queryString);
		var referrer = helper.parseHref(context);
		var domain = "https://"+referrer.host;
		//var redirectUrl = domain+(isCart ? "/cart" : "/checkout/"+id)+ "?paypalCheckout=1"+(isCart ? "&id="+id : "");
		var redirectUrl = domain+"/paypal/checkout?id="+id+"&isCart="+(isCart ? 1 : 0);
		var cancelUrl = domain + (isCart ? "/cart" : "/checkout/"+id);


		if (paramsToPreserve) {
			redirectUrl = redirectUrl + "&" + paramsToPreserve;
			cancelUrl = redirectUrl + (isCart ? "?" : "&") + paramsToPreserve;
		}
		
		return paymentHelper.getPaymentConfig(context).then(function(config) {
			if (!config.enabled) return callback();

			return helper.getOrder(context, id, isCart).then(function(order) {
				order.email = getUserEmail(context);
				console.log(order.email);
				return {
					config: config,
					order: helper.getOrderDetails(order,true )
				};
				
			});	
		}).then(function(response) {
			var client = paymentHelper.getPaypalClient(response.config);
			client.setPayOptions(1,0,0);
			console.log("configuration", context.configuration);
			if (context.configuration && context.configuration.paypal && context.configuration.paypal.setExpressCheckout)
				response.order.maxAmount = context.configuration.paypal.setExpressCheckout.maxAmount;

			console.log(response.order);
			return client.setExpressCheckoutPayment(
					response.order,
					redirectUrl,
					cancelUrl
				);
		});

	},
	process: function(context, queryString, isCart) {
		var self = this;

		//var queryString = helper.parseUrl(context);
		
		var id = queryString.id;
		var token = queryString.token;
		var payerId = queryString.PayerID;
		//var isCart = queryString.isCart == "1";
		
		console.log("PayerId", payerId);
		console.log("Token", token);
		console.log("Id", id);

		if (!id || !payerId || !token)
			throw new Error("id or payerId or token is missing");

		return paymentHelper.getPaymentConfig(context).then(function(config){
			return config;
		}).then(function(config) {
			//convert card to order or get existing order
			return convertCartToOrder(context, id, isCart).then(
				function(order){
					var existingShippingMethodCode = order.fulfillmentInfo.shippingMethodCode;
					var shipItems = _.filter(order.items,function(item) {return item.fulfillmentMethod === "Ship";});
					var requiresFulfillmentInfo = false;
					console.log("ship Items", shipItems);
					if (shipItems && shipItems.length > 0)
						requiresFulfillmentInfo = true;
					console.log("requiresFulfillmentInfo", requiresFulfillmentInfo);

					return {
						config: config, 
						order: order, 
						requiresFulfillmentInfo: requiresFulfillmentInfo,
						existingShippingMethodCode : order.fulfillmentInfo.shippingMethodCode
					};
				}
			);
		}).then(function(response) {
			//get Paypal order details
			var client = paymentHelper.getPaypalClient(response.config);
			if (context.configuration && context.configuration.paypal && context.configuration.paypal.getExpressCheckoutDetails)
				token = context.configuration.paypal.getExpressCheckoutDetails.token;
			
			return client.getExpressCheckoutDetails(token).
			then(function(paypalOrder) {
				response.paypalOrder = paypalOrder;
				return response;
			});
		}).then(function(response){
			//set Shipping address
			if (!response.requiresFulfillmentInfo) return response;
			console.log(response.order);
			return setFulfillmentInfo(context, response.order.id, response.paypalOrder).
			then(function(fulfillmentInfo) {
				response.order.fulfillmentInfo = fulfillmentInfo;
				return response;
			});
		}).then(function(response){
			//set shipping method
			if (!response.requiresFulfillmentInfo) return response;
			return setShippingMethod(context, response.order, response.existingShippingMethodCode).
			then(function(order){
				response.order = order;
				return response;
			});
		}).then(function(response) {
			//void existing payments
			return voidExistingOrderPayments(response, context);
		}).then(function(response) {
			//Set new payment to PayPal express
			return setPayment(context, response.order, token, payerId, response.paypalOrder.EMAIL);
		});
	},
	processPayment: function(context, callback) {
		var self = this;
		var paymentAction = context.get.paymentAction();
	    var payment = context.get.payment();    

	    console.log("Payment Action", paymentAction);
	    console.log("Payment", payment);
	    console.log("apiContext", context.apiContext);
	    if (payment.paymentType !== paymentConstants.PAYMENTSETTINGID) callback();

		return paymentHelper.getPaymentConfig(context)
		.then(function(config) {
			switch(paymentAction.actionName) {
            case "CreatePayment":
                console.log("adding new payment interaction for ", paymentAction.externalTransactionId);
                return paymentHelper.createNewPayment(context, paymentAction);
            case "VoidPayment":
                console.log("Voiding payment interaction for ", payment.externalTransactionId);
                console.log("Void Payment", payment.id);
                return paymentHelper.voidPayment(context, config, paymentAction,payment);
            case "AuthorizePayment":
                console.log("Authorizing payment for ", payment.externalTransactionId);
                return paymentHelper.authorizePayment(context,config, paymentAction, payment);
            case "CapturePayment":
                console.log("Capturing payment for ", payment.externalTransactionId);
                return paymentHelper.captureAmount(context, config, paymentAction, payment);
            case "CreditPayment":
                console.log("Crediting payment for ", payment.externalTransactionId);
                return paymentHelper.creditPayment(context, config, paymentAction, payment);
            case "DeclinePayment":
                console.log("Decline payment for ",payment.externalTransactionId);
                return {status: paymentConstants.DECLINED, responseText: "Declined", responseCode: "Declined"};
            default:
              return {status: paymentConstants.FAILED,responseText: "Not implemented", responseCode: "NOTIMPLEMENTED"};
          }
		}).then(function(result) {
			var actionName = paymentAction.actionName;
			if (result.captureOnAuthorize) {
				//result = captureResult;
				actionName = "CapturePayment";
			}
			paymentHelper.processPaymentResult(context, result, actionName, paymentAction.manualGatewayInteraction);
			callback();
		}, callback);
	},
	addErrorToViewData : function(context, callback) {
		cache  = context.cache.getOrCreate({type:'distributed', scope:'tenant', level:'shared'});
		var queryString = helper.parseUrl(context);

		if (queryString.ppErrorId){
			var paypalError = cache.get("PPE-"+queryString.ppErrorId);
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
				
				context.response.viewData.paypalError = paypalError;
			}
		}
		callback();
	}
};