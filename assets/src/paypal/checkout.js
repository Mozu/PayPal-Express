var _ = require("underscore");
var constants = require("mozu-node-sdk/constants");
var paymentConstants = require("./constants");
var Order = require("mozu-node-sdk/clients/commerce/order");
var Checkout = require("mozu-node-sdk/clients/commerce/checkout");
var Cart = require("mozu-node-sdk/clients/commerce/cart");
var FulfillmentInfo = require('mozu-node-sdk/clients/commerce/orders/fulfillmentInfo');
var CheckoutDestination = require('mozu-node-sdk/clients/commerce/checkouts/destination');
var CheckoutItem = require('mozu-node-sdk/clients/commerce/checkouts/orderItem');
var OrderPayment = require('mozu-node-sdk/clients/commerce/orders/payment');
var CheckoutPayment = require('mozu-node-sdk/clients/commerce/checkouts/payment');
var OrderShipment =  require('mozu-node-sdk/clients/commerce/orders/shipment');
var generalSettings = require('mozu-node-sdk/clients/commerce/settings/generalSettings');

var helper = require("./helper");
var paymentHelper = require('./paymenthelper');


function voidExistingOrderPayments(data, context, isMultiShipToEnabled) {
	var promise = new Promise(function(resolve, reject) {

		var activePayments = _.filter(data.order.payments,function(payment) {return payment.status === 'New' && (payment.paymentType !== "StoreCredit" && payment.paymentType !== "GiftCard"); });
		if (activePayments.length > 0) {
			var tasks = activePayments.map(function(payment) {
							console.log("Voiding payment", payment.id);
							var client = OrderPayment;
							var params = {orderId: payment.orderId, paymentId: payment.id};
							if (isMultiShipToEnabled) {
								client = CheckoutPayment;
								params = {checkoutId: payment.orderId, paymentId: payment.id};
							}
							return helper.createClientFromContext(client,context).
									performPaymentAction(params,{body: {actionName : "VoidPayment"}});
						});

			Promise.all(tasks).then(function(result) {
				return helper.getOrder(context, data.order.id,false, isMultiShipToEnabled).then(function(order){
					data.order = order;
					resolve(data);
				});
			},reject);
		} else
			resolve(data);
	});

	return promise;
}

function convertCartToOrder(context, id, isCart, isMultiShip) {
	if (isCart) {
		console.log("Converting cart to order");
		console.log(context);
		var cartClient = helper.createClientFromContext(Cart, context);
		var orderClient = helper.createClientFromContext(Order, context);
		var checkoutClient = helper.createClientFromContext(Checkout, context);

		return cartClient.getOrCreateCart().then(
      	function(cart){
			if (isMultiShip)
				return checkoutClient.createCheckoutFromCart({cartId: cart.id});
			else
				return orderClient.createOrderFromCart({ cartId: cart.id  });
   		});
	}
	else {
		console.log("Getting existing order");
		return helper.getOrder(context, id, isCart, isMultiShip);
	}
}

function setFulfillmentInfo(context, order, paypalOrder, isMultiShipToEnabled) {
	console.log("ship to name",paypalOrder.SHIPTONAME);
	var parts = paypalOrder.SHIPTONAME.split(/\s+/);
	console.log("shiptoname",parts);
	var registeredShopper = getUserEmail(context);

	var firstName = parts[0];
	var lastName = context.configuration.missingLastNameValue;
	if (parts[1])
	lastName = paypalOrder.SHIPTONAME.replace(parts[0]+" ","").replace(parts[0],"");
	var contact = {
		"firstName" : firstName,
		"lastNameOrSurname" : lastName,
		"email" : registeredShopper || paypalOrder.EMAIL,
		"phoneNumbers" : {
			"home" : paypalOrder.SHIPTOPHONENUM || (paypalOrder.PHONENUM || "N/A")
		},
		"address" : {
			"address1" : paypalOrder.SHIPTOSTREET,
			"address2" : paypalOrder.SHIPTOSTREET2,
			"cityOrTown" : paypalOrder.SHIPTOCITY,
			"stateOrProvince": paypalOrder.SHIPTOSTATE,
			"postalOrZipCode": paypalOrder.SHIPTOZIP,
			"countryCode": paypalOrder.SHIPTOCOUNTRYCODE,
			"addressType": "Residential",
			"isValidated": "true"
		}
	};
	console.log("setting contact", contact);
	if (isMultiShipToEnabled) {
		var destinationContact = { "destinationContact": contact};

		return helper.createClientFromContext(CheckoutDestination, context).addDestination({checkoutId: order.id}, {body: destinationContact})
		.then(function(destination){
			var itemsWithoutDestination = _.filter(order.items, function(item){
				return !item.destinationId;
			});
			console.log('itemsWithoutDestination',itemsWithoutDestination);
			if (itemsWithoutDestination.length > 0) {
				var checkoutItemClient = helper.createClientFromContext(CheckoutItem, context);
				var items =  _.map(itemsWithoutDestination, function(item){
					return item.id;
				  });
				var body = [{destinationId: destination.id, itemIds: items}];
				console.log('Set item destination',body);
				return checkoutItemClient.bulkUpdateItemDestinations({checkoutId: order.id}, {body: body});
			} else
				return order;
		});
	} else {
		var fulfillmentInfo = {
			"fulfillmentContact" : contact
		};

		return helper.createClientFromContext(FulfillmentInfo, context).setFulFillmentInfo({orderId: order.id},{body: fulfillmentInfo});
	}
}


function setPayment(context, order, token, payerId,paypalOrder, addBillingInfo,isMultiShipToEnabled) {
	console.log("order", order);
	if (order.amountRemainingForPayment < 0) return order;
	var registeredShopper = getUserEmail(context);
	
	var billingContact = {"email" : registeredShopper || paypalOrder.EMAIL};

	if (addBillingInfo && paypalOrder.BILLINGNAME) {
		var parts = paypalOrder.BILLINGNAME.split(/\s+/g);

		billingContact.firstName  = parts[0];
		billingContact.lastNameOrSurname = paypalOrder.BILLINGNAME.replace(parts[0]+" ","").replace(parts[0],"");
		billingContact.phoneNumbers = {"home" : paypalOrder.PHONENUM || "N/A"};
		billingContact.address= {
			"address1": paypalOrder.STREET,
			"cityOrTown": paypalOrder.CITY,
			"stateOrProvince": paypalOrder.STATE,
			"postalOrZipCode": paypalOrder.ZIP,
			"countryCode": paypalOrder.COUNTRY,
			"addressType": 'Residential',
			"isValidated": paypalOrder.ADDRESSSTATUS === "Confirmed" ? true : false
		};
	}

	console.log("Setting payment..amount amountRemainingForPayment", order.amountRemainingForPayment);
	var billingInfo =  {
		"amount" : order.amountRemainingForPayment,
		"currencyCode": order.currencyCode,
		"newBillingInfo":
	    {
	        "paymentType": paymentConstants.PAYMENTSETTINGID,
	        "paymentWorkflow": paymentConstants.PAYMENTSETTINGID,
	        "card" : null,
	        "billingContact" : billingContact,
          "externalTransactionId" : token,
	        "isSameBillingShippingAddress" : false,
	         "data" : {
	        	"paypal": {
	        		payerId: payerId
	        	}
        	}
	    },
	    "externalTransactionId" : token

	};

	var client = OrderPayment;
	var params = {orderId: order.id};
	if (isMultiShipToEnabled) {
		client = CheckoutPayment;
		params = {checkoutId: order.id};
	}
	console.log(params);
    console.log("Billing Info", billingInfo);
    return helper.createClientFromContext(client, context).
    createPaymentAction(params,{body: billingInfo});
}

function setShippingMethod(context, order, existingShippingMethodCode, isMultiShipToEnabled) {
	if (isMultiShipToEnabled) {
		return helper.createClientFromContext(Checkout,context).getAvailableShippingMethods({checkoutId: order.id})
		.then(function(methods){
			if (!methods || methods.length === 0)
				throw new Error("No Shipping methods found for the selected address");
			console.log(methods);

			var shippingRates = [];
			var rateChanged = false;
			_.each(methods, function(grouping){
				var existingGroup = _.findWhere(order.groupings,  { id: grouping.groupingId });
				console.log(existingGroup);
				var shippingRate = null;

				if (existingGroup) {
					shippingRate = _.findWhere(grouping.shippingRates, { shippingMethodCode : existingGroup.shippingMethodCode });
					console.log(shippingRate);
				}
				if (shippingRate) {
					console.log('setting to existing rate');
					shippingRates.push({groupingId: grouping.groupingId, shippingRate: shippingRate});
				}
				else {
					console.log('setting new rate');
					shippingRate =_.min(grouping.shippingRates, function(rate){return rate.price;});
					shippingRates.push({groupingId: grouping.groupingId, shippingRate: shippingRate});
					rateChanged = true;
				}
			});
			console.log("shipping Rates",shippingRates);
			console.log("shipping Rates changed",rateChanged);
			if (rateChanged) {
				return helper.createClientFromContext(Checkout,context).setShippingMethods({checkoutId: order.id}, {body: shippingRates})
				.then(function(checkout){
					return checkout;
				});
			} else
				return order;

		});
	} else {
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
			order.items = null;
			order.payments = null;
			return helper.createClientFromContext(Order, context).updateOrder({orderId: order.id, version:''}, {body: order});
		});
	}
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
	getCheckoutSettings: function(context) {
		var client = helper.createClientFromContext(generalSettings,context, true);
		return client.getGeneralSettings().then(function(setting){
			return setting;
		});
	},
	checkUserSession: function(context) {

		var user = context.items.pageContext.user;
		if ( !user.isAnonymous && !user.IsAuthenticated )
		{
      var allowWarmCheckout = (context.configuration && context.configuration.allowWarmCheckout);
      var redirectUrl = '/user/login?returnUrl=' + encodeURIComponent(context.request.url);
      if (!allowWarmCheckout)
        redirectUrl = '/logout?returnUrl=' + encodeURIComponent(context.request.url)+"&saveUserId=true";
		  context.response.redirect(redirectUrl);
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
		var domain = context.items.siteContext.secureHost;
		//var redirectUrl = domain+(isCart ? "/cart" : "/checkout/"+id)+ "?paypalCheckout=1"+(isCart ? "&id="+id : "");
		var createRedirectUrl = function(isMultiShip) {
			var url = domain + "/paypal/checkout?id=" + id + "&isCart=" + (isCart ? 1 : 0);
			if (paramsToPreserve) { url = url + "&" + paramsToPreserve; }
			return url;
		};
		var createCancelUrl = function (isMultiShip) {
			var url = domain + (isCart ? "/cart" : (isMultiShip) ? '/checkoutV2' : '/checkout' + "/"+id);
			if (paramsToPreserve) { url = url + (isCart ? "?" : "&") + paramsToPreserve; }
			return url;
		};

		var redirectUrl = createRedirectUrl();
		var cancelUrl = createCancelUrl();

		return paymentHelper.getPaymentConfig(context).then(function(config) {
			if (!config.enabled) return callback();
			return self.getCheckoutSettings(context).then(function(settings){

				redirectUrl = createRedirectUrl(settings.isMultishipEnabled);
				cancelUrl = createCancelUrl(settings.isMultishipEnabled);

				return helper.getOrder(context, id, isCart, settings.isMultishipEnabled).then(function(order) {
					
					order.email = getUserEmail(context);
					console.log(order.email);
					return {
						config: config,
						order: helper.getOrderDetails(order,true )
					};
	
				});
			});
		}).then(function(response) {
			var client = paymentHelper.getPaypalClient(response.config);
			client.setPayOptions(1,0,0);
			console.log("configuration", context.configuration);
			if (context.configuration && context.configuration.paypal && context.configuration.paypal.setExpressCheckout)
				response.order.maxAmount = context.configuration.paypal.setExpressCheckout.maxAmount;


			return client.setExpressCheckoutPayment(
					response.order,
					redirectUrl,
					cancelUrl
				);
		});

	},
	process: function(context, queryString, isCart, isMultiShipToEnabled) {
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

    	var addBillingInfo = (context.configuration && context.configuration.addBillingInfo ? context.configuration.addBillingInfo : false);
		return paymentHelper.getPaymentConfig(context).then(function(config){
			return config;
		}).then(function(config) {
			//convert card to order or get existing order
			return convertCartToOrder(context, id, isCart,isMultiShipToEnabled).then(
				function(order){
					var existingShippingMethodCode = order.groupings;//order.fulfillmentInfo.shippingMethodCode;
					var shipItems = _.filter(order.items,function(item) {return item.fulfillmentMethod === "Ship";});
					var requiresFulfillmentInfo = false;
					if (shipItems && shipItems.length > 0)
						requiresFulfillmentInfo = true;
					console.log("requiresFulfillmentInfo", requiresFulfillmentInfo);

					return {
						config: config,
						order: order,
						requiresFulfillmentInfo: requiresFulfillmentInfo,
						existingShippingMethodCode : existingShippingMethodCode
					};
				}
			);
		}).then(function(response) {
			//get Paypal order details
			var client = paymentHelper.getPaypalClient(response.config);
			if (context.configuration && context.configuration.paypal && context.configuration.paypal.getExpressCheckoutDetails)
				token = context.configuration.paypal.getExpressCheckoutDetails.token;

			return client.getExpressCheckoutDetails(token, addBillingInfo).
			then(function(paypalOrder) {
				console.log("paypal order", paypalOrder);
				response.paypalOrder = paypalOrder;
				return response;
			});
		}).then(function(response){
			//set Shipping address
			if (!response.requiresFulfillmentInfo) return response;
			return setFulfillmentInfo(context, response.order, response.paypalOrder, isMultiShipToEnabled).
			then(function(fulfillmentInfo) {
				if (!isMultiShipToEnabled)
					response.order.fulfillmentInfo = fulfillmentInfo;
				return response;
			});
		}).then(function(response){
			//set shipping method
			if (!response.requiresFulfillmentInfo) return response;
			return setShippingMethod(context, response.order, response.existingShippingMethodCode, isMultiShipToEnabled).
			then(function(order){
				response.order = order;
				return response;
			});
		}).then(function(response) {
			//void existing payments
			return voidExistingOrderPayments(response, context, isMultiShipToEnabled);
		}).then(function(response) {
			//Set new payment to PayPal express
			return setPayment(context, response.order, token, payerId, response.paypalOrder,addBillingInfo, isMultiShipToEnabled).then(function(res){
				response.order = res;
				return response;
			});
		});
	},
	processPayment: function(context, callback, isMultishipEnabled) {
		var self = this;
		var paymentAction = context.get.paymentAction();
	    var payment = context.get.payment();

	    console.log("Payment Action", paymentAction);
		console.log("Payment", payment);
		console.log("isMultishipEnabled",isMultishipEnabled);
		
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
                return paymentHelper.authorizePayment(context,config, paymentAction, payment,isMultishipEnabled);
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
        else if (paypalError.originalError) {
          console.log("originalError", paypalError.originalError);
          if (paypalError.originalError.items  && paypalError.originalError.items.length > 0)
            message = paypalError.originalError.items[0].message;
          else
           message = paypalError.originalError.message;
         }
				else if (paypalError.message){
					message = paypalError.message;
					if (message.errorMessage)
						message = message.errorMessage;

				}
				else if (paypalError.errorMessage)
					message = paypalError.errorMessage;

				context.response.viewData.model.messages = [{'message' : message}];
			}
		}
		callback();
	}
};
