var _ = require("underscore");
var Paypal = require("./paypalsdk");
var constants = require("mozu-node-sdk/constants");
var paymentConstants = require("../utils/constants");
var Order = require("mozu-node-sdk/clients/commerce/order");
var Cart = require("mozu-node-sdk/clients/commerce/cart")();
var FulfillmentInfo = require('mozu-node-sdk/clients/commerce/orders/fulfillmentInfo');
var PaymentSettings = require("mozu-node-sdk/clients/commerce/settings/checkout/paymentSettings");
var OrderPayment = require('mozu-node-sdk/clients/commerce/orders/payment');
var OrderShipment =  require('mozu-node-sdk/clients/commerce/orders/shipment');
var generalSettingsClient = require('mozu-node-sdk/clients/commerce/settings/generalSettings');
var helper = require("./helper");

function createClientFromContext(client, context, removeClaims) {
  var c = client(context);
  if (removeClaims)
	  c.context[constants.headers.USERCLAIMS] = null;
  return c;
}

function getInteractionByStatus(interactions, status) {
  return _.find(interactions, function(interaction){
      return interaction.status == status;
  } );
}


function createNewPayment(context, paymentAction) {
	var newStatus = { status : paymentConstants.NEW, amount: paymentAction.amount};
	return newStatus;
}

function authorizePayment(context, paypalClient, paymentAction, payment) {
	//var response =  { amount: paymentAction.amount };
	var payerId = payment.billingInfo.data.paypal.payerId;
	//return createClientFromContext(Order, context).
	return getOrder(context, payment.orderId, false).then(function(order) {
		//console.log(order);
		return {
			orderNumber: order.orderNumber,
			amount: paymentAction.amount,
			currencyCode: paymentAction.currencyCode,
			taxAmount: order.taxTotal,
			handlingAmount: order.handlingTotal,
			shippingAmount: order.shippingTotal,
			items: getItems(order),
			token: payment.externalTransactionId,
			payerId: payerId
		};
	}).then(function(order){
		console.log(order);
		return paypalClient.authorizePayment(order).
			then(function(result) {
				return getPaymentResult(result, paymentConstants.AUTHORIZED, paymentAction.amount);
			}, function(err) {
				return getPaymentResult(err, paymentConstants.DECLINED, paymentAction.amount);
			});	
	}).catch(function(err) {
		console.log(err);
		return getPaymentResult({statusText: err}, paymentConstants.FAILED, paymentAction.amount);
	});
}

function captureAmount(context, paypalClient,paymentAction, payment) {
  
	var response = {amount: paymentAction.amount, gatewayResponseCode:  "OK", status: paymentConstants.FAILED};

	//return createClientFromContext(Order, context).getOrder({orderId: payment.orderId})
	return getOrder(context, payment.orderId, false)
	//.then(function(order) {
	//	return order;
	//})
	.then(function(order){
		if (paymentAction.manualGatewayInteraction) {
	        console.log("Manual capture...dont send to amazon");
	        response.status = paymentConstants.CAPTURED;
	        response.transactionId = paymentAction.manualGatewayInteraction.gatewayInteractionId;
	        return response;
	      }

        var interactions = payment.interactions;

	    var paymentAuthorizationInteraction = getInteractionByStatus(interactions, paymentConstants.AUTHORIZED);

	    console.log("Authorized interaction",paymentAuthorizationInteraction );
	    if (!paymentAuthorizationInteraction) {
	      console.log("interactions", interactions);
	      response.responseText = "Authorization Id not found in payment interactions";
	      response.responseCode = 500;
	      return response;
	    }

	    return paypalClient.doCapture(payment.externalTransactionId,order.orderNumber,
	    								paymentAuthorizationInteraction.gatewayTransactionId, 
	    								paymentAction.amount, paymentAction.currencyCode).then(function(captureResult){
         	return getPaymentResult(captureResult,paymentConstants.CAPTURED, paymentAction.amount);
    	}, function(err) {
    		return getPaymentResult(err, paymentConstants.FAILED, paymentAction.amount);
    	});	
	}).catch(function(err) {
		console.log(err);
		return getPaymentResult({statusText: err}, paymentConstants.FAILED, paymentAction.amount);
	});

}


function creditPayment(context, paypalClient, paymentAction, payment) {
	var promise = new Promise(function(resolve, reject) {
      var capturedInteraction = getInteractionByStatus(payment.interactions,paymentConstants.CAPTURED);
      console.log("AWS Refund, previous capturedInteraction", capturedInteraction);
      if (!capturedInteraction) {
        resolve({status : paymentConstants.FAILED, responseCode: "InvalidRequest", responseText: "Payment has not been captured to issue refund"});
      } 

      if (paymentAction.manualGatewayInteraction) {
        console.log("Manual credit...dont send to Paypal");
        resolve({amount: paymentAction.amount,gatewayResponseCode:  "OK", status: paymentConstants.CREDITED,
                transactionId: paymentAction.manualGatewayInteraction.gatewayInteractionId});
      }
      
      var fullRefund = paymentAction.amount === capturedInteraction.amount;

      return paypalClient.doRefund(capturedInteraction.gatewayTransactionId, fullRefund, paymentAction.amount, paymentAction.currencyCode).then(
       function(refundResult) {
       		resolve(getPaymentResult(refundResult,paymentConstants.CREDITED, paymentAction.amount));
      }, function(err) {
        console.log("Capture Error", err);
        resolve(getPaymentResult(err, paymentConstants.FAILED, paymentAction.amount));
      });
	});
	
	return promise;
}

function voidPayment(context,paypalClient, paymentAction, payment) {
  var promise = new Promise(function(resolve, reject) {
    if (paymentAction.manualGatewayInteraction) {
          console.log("Manual void...dont send to amazon");
          resolve({amount: paymentAction.amount,gatewayResponseCode:  "OK", status: paymentConstants.VOIDED,
                  awsTransactionId: paymentAction.manualGatewayInteraction.gatewayInteractionId});
    }

    var capturedInteraction = getInteractionByStatus(payment.interactions,paymentConstants.CAPTURED);
    console.log("Void Payment - Captured interaction", capturedInteraction);
    if (capturedInteraction) {
      resolve({status : paymentConstants.FAILED, responseCode: "InvalidRequest", responseText: "Payment with captures cannot be voided. Please issue a refund"});
    } 

    var authorizedInteraction = getInteractionByStatus(payment.interactions,paymentConstants.AUTHORIZED);
    if (!authorizedInteraction) 
      resolve( {status: paymentConstants.VOIDED, amount: paymentAction.amount});

  	return paypalClient.doVoid(authorizedInteraction.gatewayTransactionId).then(
  		function(result) {
  			resolve(getPaymentResult(result,paymentConstants.VOIDED, paymentAction.amount ));
  		},
  		function(err) {
  			resolve(getPaymentResult(result,paymentConstants.FAILED, paymentAction.amount ));	
  		}
  	);

  });
  return promise;
}


function getPaymentResult(result, status, amount) {
	var response = {status : status,amount: amount};
	if (status === paymentConstants.FAILED || status === paymentConstants.DECLINED) {
		response.responseText = result.statusText+" - "+result.correlationId;
		response.responseCode = result.errorCode;
	}
	else {
		response.transactionId = result.transactionId;
		response.responseCode = 200;
		response.responseText = result.ack;
	}

	return response;
}

function processPaymentResult(context,paymentResult, paymentAction) {
    var interactionType = "";
    var isManual = false;

    console.log("Payment Result", paymentResult);
    if (paymentAction.manualGatewayInteraction)
      isManual = true;

    switch(paymentAction.actionName) {
            case "VoidPayment":
               interactionType = "Void";
               break;
            case "CreatePayment":
            case "AuthorizePayment":
              interactionType = "Authorization";
              break;
            case "CapturePayment":
              interactionType = "Capture";
              break;
            case "CreditPayment":
              interactionType = "Credit";
              break;
            case "DeclinePayment":
              interactionType = "Decline";
              break;
            case "RollbackPayment":
              interactionType = "Rollback";
              break;
            default:
              interactionType = "";
              break;
          }

    if (paymentResult.status == paymentConstants.NEW)
      context.exec.setPaymentAmountRequested(paymentAction.amount);

    var interaction  =  {status: paymentResult.status, interactionType: interactionType};
    if (paymentResult.amount) 
      interaction.amount = paymentResult.amount;

    if (paymentResult.transactionId)
      interaction.gatewayTransactionId = paymentResult.transactionId;

    if (paymentResult.responseText)
      interaction.gatewayResponseText= paymentResult.responseText;

    if (paymentResult.responseCode)
      interaction.gatewayResponseCode= paymentResult.responseCode;

    interaction.isManual = isManual;
    console.log("Payment Action result", interaction);

    context.exec.addPaymentInteraction(interaction);



   /* if (paymentResult.captureOnAuthorize) {
      interaction.gatewayTransactionId = paymentResult.captureId;
      interaction.status = paymentConstants.CAPTURED;
      context.exec.addPaymentInteraction(interaction);
    }*/

    /*if (paymentResult.status == paymentConstants.CREDITPENDING)
      context.exec.setPaymentAmountCredited(paymentResult.amount);*/

    if (paymentResult.status == paymentConstants.CAPTURED)
      context.exec.setPaymentAmountCollected(paymentResult.amount);
 
  }

function getPaypalClient(context) {
	return createClientFromContext(PaymentSettings, context,true)
		.getThirdPartyPaymentWorkflowWithValues({fullyQualifiedName: helper.getPaymentFQN(context)})
		.then(function(paypalSettings) {
			var userName = helper.getValue(paypalSettings, paymentConstants.USERNAME);
			var password = helper.getValue(paypalSettings, paymentConstants.PASSWORD);
			var signature = helper.getValue(paypalSettings, paymentConstants.SIGNATURE);
			var environment = helper.getValue(paypalSettings, paymentConstants.ENVIRONMENT) || "sandbox";
			return new Paypal.create(userName, password, signature, environment === "sandbox");
	});
}

function getItems(order) {
	return 	_.map(order.items, function(item) {
		return 	{
			name: item.product.name, 
			quantity: item.quantity, 
			amount: item.discountedTotal/item.quantity,
			lineId: item.lineId,
			taxAmount: item.itemTaxTotal
		};
	});
}

function getOrder(context, id, isCart) {
	if (isCart)
			return Cart.getCart({cartId: id});
		else
			return createClientFromContext(Order, context, true).getOrder({orderId: id});	
}

var paypalCheckout = module.exports = {
	convertCartToOrder: function(context, id, isCart) {

		if (isCart) {
			console.log("Converting cart to order");
			return createClientFromContext(Order, context).createOrderFromCart({ cartId: id  });
		}
		else {
			console.log("Getting existing order");
			return getOrder(context, id, isCart);
		}
	},
	setPaymentOptions: function(client) {
		return client.setPayOptions(1,0,0);
	},
	getToken: function(context) {
		var self = this;
		var queryString = helper.parseUrl(context);
		var id = queryString.id;
		var isCart = queryString.isCart;
		var paramsToPreserve = helper.getParamsToPreserve(queryString);
		var referrer = helper.parseHref(context);
		var domain = "https://"+referrer.host;
		var redirectUrl = domain+(isCart ? "/cart" : "/checkout/"+id)+ "?paypalCheckout=1"+(isCart ? "&id="+id : "");
		var cancelUrl = domain + (isCart ? "/cart" : "/checkout/"+id);


		if (paramsToPreserve) {
			redirectUrl = redirectUrl + "&" + paramsToPreserve;
			cancelUrl = redirectUrl + (isCart ? "?" : "&") + paramsToPreserve;
		}

		return getPaypalClient(context).then(function(client) {
			client.setPayOptions(1,0,0);
			return client;
		}).then(function(client) {
			return getOrder(context, id, isCart).then(function(order) {
				var details = {
					client: client,
					order: {
						email: order.email,
						amount: order.discountedTotal,
						currencyCode: order.currencyCode,
						items: getItems(order)
					}
				};
				//console.log(order.fulfillmentInfo);
				//console.log(order.fulfillmentInfo !== null && order.fulfillmentInfo.fulfillmentContact !==null);
				if (order.fulfillmentInfo  && order.fulfillmentInfo.fulfillmentContact) {
					details.order.shippingAddress = {
						firstName: order.fulfillmentInfo.fulfillmentContact.firstName,
						lastName: order.fulfillmentInfo.fulfillmentContact.lastNameOrSurname,
						address1: order.fulfillmentInfo.fulfillmentContact.address.address1,
						address2: order.fulfillmentInfo.fulfillmentContact.address.address2,
						cityOrTown: order.fulfillmentInfo.fulfillmentContact.address.cityOrTown,
						stateOrProvince: order.fulfillmentInfo.fulfillmentContact.address.stateOrProvince,
						postalOrZipCode: order.fulfillmentInfo.fulfillmentContact.address.postalOrZipCode,
						countryCode: order.fulfillmentInfo.fulfillmentContact.address.countryCode,
						phone: order.fulfillmentInfo.fulfillmentContact.phoneNumbers.home
					};
				}

				return details;
			});	
		}).then(function(response) {
			console.log(response.order);
			return response.client.setExpressCheckoutPayment(
					response.order,
					redirectUrl,
					cancelUrl
				);
		});

	},
	process: function(context) {
		var self = this;

		var queryString = helper.parseUrl(context);
		
		var id = queryString.id;
		var token = queryString.token;
		var payerId = queryString.PayerID;

		var isCart = helper.isCartPage(context);
		if (!isCart) {
			var url = helper.parseHref(context);
			console.log(url.pathname.split("/"));
			id = url.pathname.split("/")[2];
		}
		console.log("PayerId", payerId);
		console.log("Token", token);
		console.log("Id", id);

		if (!id || !payerId || !token)
			throw new Error("id or payerId or token is missing");

		return getPaypalClient(context).then(function(client){
			return client;
		}).then(function(client) {
			return self.convertCartToOrder(context, id, isCart).then(
				function(order){
					var existingShippingMethodCode = order.fulfillmentInfo.shippingMethodCode;
					return {client: client, order: order, existingShippingMethodCode : order.fulfillmentInfo.shippingMethodCode};
				}
			);
		}).then(function(response) {
			return response.client.getExpressCheckoutDetails(token).
			then(function(paypalOrder) {
				console.log("Paypal order", paypalOrder);
				response.paypalOrder = paypalOrder;
				return response;
			});
		}).then(function(response){
			return self.setFulfillmentInfo(context, response.order.id, response.paypalOrder).
			then(function(fulfillmentInfo) {
				response.order.fulfillmentInfo = fulfillmentInfo;
				return response;
			});
		}).then(function(response){
			return self.setShippingMethod(context, response.order, response.existingShippingMethodCode).
			then(function(order){
				response.order = order;
				return response;
			});
		}).then(function(response) {
			return self.setPayment(context, response.order, token, payerId, response.paypalOrder.EMAIL);
		});
	},
	setFulfillmentInfo: function(context, id, paypalOrder) {
		var shipToName = paypalOrder.SHIPTONAME.split(" ");
		var fulfillmentInfo = { 
			"fulfillmentContact" : { 
            "firstName" : shipToName[0], 
            "lastNameOrSurname" : shipToName[1], 
            "email" : paypalOrder.EMAIL,
            "phoneNumbers" : {
              "home" : "N/A"
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
        return createClientFromContext(FulfillmentInfo, context).setFulFillmentInfo({orderId: id, version:''},{body: fulfillmentInfo});
	},
	setShippingMethod: function(context, order, existingShippingMethodCode) {
		return createClientFromContext(OrderShipment,context).getAvailableShipmentMethods({orderId: order.id})
		.then(function(methods){
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
            return createClientFromContext(Order, context).updateOrder({orderId: order.id, version:''}, {body: order});
		});
	},
	setPayment: function(context, order, token, payerId, email) {

		if (order.amountRemainingForPayment < 0) return order;
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
		            "email": email
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
	    return createClientFromContext(OrderPayment, context).
	    createPaymentAction({orderId: order.id},{body: billingInfo});
	},
	processPayment: function(context, callback) {
		var self = this;
		var paymentAction = context.get.paymentAction();
	    var payment = context.get.payment();    

	    console.log("Payment Action", paymentAction);
	    console.log("Payment", payment);
	    console.log("apiContext", context.apiContext);
	    if (payment.paymentType !== paymentConstants.PAYMENTSETTINGID) callback();

		return getPaypalClient(context)
		.then(function(client) {
			switch(paymentAction.actionName) {
            case "CreatePayment":
                console.log("adding new payment interaction for ", paymentAction.externalTransactionId);
                return createNewPayment(context, paymentAction);
            case "VoidPayment":
                console.log("Voiding payment interaction for ", payment.externalTransactionId);
                console.log("Void Payment", payment.id);
                return voidPayment(context, client, paymentAction,payment);
            case "AuthorizePayment":
                console.log("Authorizing payment for ", payment.externalTransactionId);
                return authorizePayment(context,client, paymentAction, payment);
            case "CapturePayment":
                console.log("Capturing payment for ", payment.externalTransactionId);
                return captureAmount(context, client, paymentAction, payment);
            case "CreditPayment":
                console.log("Crediting payment for ", payment.externalTransactionId);
                return creditPayment(context, client, paymentAction, payment);
            /*case "DeclinePayment":
                console.log("Decline payment for ",payment.externalTransactionId);
                return declinePayment(paymentAction, payment);*/
            default:
              return {status: paymentConstants.FAILED,responseText: "Not implemented", responseCode: "NOTIMPLEMENTED"};
          }
		}).then(function(result) {
			processPaymentResult(context, result, paymentAction);
			callback();
		}, callback);
	}
};