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
//generalSettingsClient.context[constants.headers.USERCLAIMS] = null;


/*function getPaymentFQN(context) {
	console.log(context);
	console.log(context.apiContext);
	var appInfo = getAppInfo(context);
	return appInfo.namespace+"~"+paymentConstants.PAYMENTSETTINGID;
}*/

function createClientFromContext(client, context, removeClaims) {
  var c = client(context);
  if (removeClaims)
	  c.context[constants.headers.USERCLAIMS] = null;
  return c;
}

/*function getValue(paymentSetting, key) {
  var value = _.findWhere(paymentSetting.credentials, {"apiName" : key});

    if (!value) {
      console.log(key+" not found");
      return;
    }
    //console.log("Key: "+key, value.value );
    return value.value;
}*/

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
	var response =  { amount: paymentAction.amount };
	var payerId = payment.billingInfo.data.paypal.payerId;
	return createClientFromContext(Order, context).getOrder(payment.orderId)
	.then(function(order) {
		return paypalClient.authorizePayment(payment.externalTransactionId,payerId,order.orderNumber,
			paymentAction.amount, paymentAction.currencyCode)
		.then(function(result) {
			console.log("Paypal auth result", result);
			response.transactionId = result.transactionId;
		    response.responseCode = 200;
		    response.responseText =  result.correlationId; 
		    response.status =  paymentConstants.AUTHORIZED;
		   
		    return response;
		}, function(err) {
			response.status = paymentConstants.FAILED;
			 response.responseText =  err;
			 return response;
		});
	});
}

function captureAmount(context, paypalClient,paymentAction, payment) {
  
	var response = {amount: paymentAction.amount, gatewayResponseCode:  "OK", status: paymentConstants.FAILED};

	return createClientFromContext(Order, context).getOrder(payment.orderId)
	.then(function(order) {
       if (paymentAction.manualGatewayInteraction) {
	        console.log("Manual capture...dont send to amazon");
	        response.status = paymentConstants.CAPTURED;
	        response.transactionId = paymentAction.manualGatewayInteraction.gatewayInteractionId;
	        return(response);
	      }

	    var interactions = payment.interactions;

	    var paymentAuthorizationInteraction = getInteractionByStatus(interactions, paymentConstants.AUTHORIZED);

	    console.log("Authorized interaction",paymentAuthorizationInteraction );
	    if (!paymentAuthorizationInteraction) {
	      console.log("interactions", interactions);
	      response.responseText = "Authorization Id not found in payment interactions";
	      response.responseCode = 500;
	      return(response);
	    }

	    return paypalClient.doCapture(payment.externalTransactionId,order.orderNumber,paymentAuthorizationInteraction.gatewayTransactionId, paymentAction.amount, paymentAction.currencyCode)
	      .then(function(captureResult){
	          console.log("Capture Result", captureResult);
	          var response = {
	            status :  paymentConstants.CAPTURED,
	            transactionId: captureResult.transactionId,
	            responseCode: 200,
	            amount: paymentAction.amount
	          };

	          return response;
	    }, function(err) {
	      console.log("Capture Error", err);
	      return {status : paymentConstants.FAILED,
	              responseText: err};
	    });
  });
}


function creditPayment(context, paypalClient, paymentAction, payment) {
	var promise = new Promise(function(resolve, reject) {
      var capturedInteraction = getInteractionByStatus(payment.interactions,paymentConstants.CAPTURED);
      //var authorizedInteraction = getInteractionByStatus(payment.interactions,paymentConstants.AUTHORIZED);
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
         console.log(refundResult);

          var response = {
            status : paymentConstants.CREDITED ,
            transactionId: refundResult.transactionId,
            responseCode: 200,
            amount: paymentAction.amount
          };
          console.log("Refund response", response);
          resolve(response);
      }, function(err) {
        console.log("Capture Error", err);
        resolve({status : paymentConstants.FAILED,responseText: err.statusText,responseCode: err.errorCode});
      });
	});
	
	return promise;
}

function voidPayment(context, paymentAction) {
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

    /*return amazonPay.cancelOrder(payment.externalTransactionId).then(function(result) {
      console.log("Amazon cancel result", result);
      resolve( {status: paymentConstants.VOIDED, amount: paymentAction.amount});
    }, function(err){
       console.log("Amazon cancel failed", err);
        resolve({status: paymentConstants.FAILED,responseText: err.message,
            responseCode: err.code});
    });*/

  });
  return promise;
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

var paypalCheckout = module.exports = {
	getPaypalClient: function(context) {
		return createClientFromContext(PaymentSettings, context,true)
		.getThirdPartyPaymentWorkflowWithValues({fullyQualifiedName: helper.getPaymentFQN(context)})
		.then(function(paypalSettings) {
			var userName = helper.getValue(paypalSettings, paymentConstants.USERNAME);
			var password = helper.getValue(paypalSettings, paymentConstants.PASSWORD);
			var signature = helper.getValue(paypalSettings, paymentConstants.SIGNATURE);
			var environment = helper.getValue(paypalSettings, paymentConstants.ENVIRONMENT) || "sandbox";
			return new Paypal.create(userName, password, signature, environment == "sandbox");
		});
	},
	getOrder: function(context, id, isCart) {
		if (isCart)
			return Cart.getCart({cartId: id});
		else
			return createClientFromContext(Order, context, true).getOrder({orderId: id});	
	},
	getItems: function(order) {
		return 	_.map(order.items, function(item) {
			return 	{
				name: item.product.name, 
				quantity: item.quantity, 
				amount: item.discountedTotal/item.quantity,
				lineId: item.lineId

			};
		});
	},
	convertCartToOrder: function(context, id, isCart) {

		if (isCart) {
			console.log("Converting cart to order");
			return createClientFromContext(Order, context).createOrderFromCart({ cartId: id  });
		}
		else {
			console.log("Getting existing order");
			return this.getOrder(context, id, isCart);
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
		var domain = queryString.domain;
		var redirectUrl = domain+(isCart ? "/cart" : "/checkout")+ "?paypalCheckout=1&id="+id;
		var cancelUrl = domain + (isCart ? "/cart" : "/checkout/"+id);

		return self.getPaypalClient(context).then(function(client) {
			return self.getOrder(context, id, isCart).then(function(order) {
				var items = self.getItems(order);
				client = self.setPaymentOptions(client);
				client.setProducts(items);
				//email, amount, description, currency, returnUrl, cancelUrl
				return client.setExpressCheckoutPayment(
					order.email,
					order.discountedTotal,
					null,
					order.currencyCode,
					redirectUrl,
					cancelUrl
				);
			});
		});
	},
	process: function(context) {
		var self = this;
		var queryString = helper.parseUrl(context);
		
		var id = queryString.id;
		var isCart = helper.isCartPage(context);
		var token = queryString.token;
		var payerId = queryString.PayerID;
		console.log("Processing paypal checkout");

		return self.getPaypalClient(context)
		.then(function(client) {
			return self.convertCartToOrder(context, id, isCart).then(function(order){
				var existingShippingMethodCode = order.fulfillmentInfo.shippingMethodCode;

				return client.getExpressCheckoutDetails(token)
				.then( function(paypalOrder) {
					console.log("Paypal Order details",paypalOrder);
					console.log("mozu order", order);
					//if (order.requiresFulfillmentInfo) {
						console.log("setting fulfillmentInfo");
						return self.setFulfillmentInfo(context,order.id, paypalOrder)
						.then(function(fulfillmentInfo){

							order.fulfillmentInfo = fulfillmentInfo;
							return self.setShippingMethod(context, order, existingShippingMethodCode).
							then(function(updatedOrder){
								console.log("Setting payment to "+paymentConstants.PAYMENTSETTINGID);
								return self.setPayment(context, updatedOrder, token, payerId, paypalOrder.EMAIL);
							});
						});
					//} else {
					//	console.log("Fulfillment Info not required..setting payment to "+paymentConstants.PAYMENTSETTINGID);
					//	return self.setPayment(context, order, token, payerId, paypalOrder.EMAIL);
					//}
				});
			});
		});
	},
	setFulfillmentInfo: function(context, id, paypalOrder) {
		var fulfillmentInfo = { 
			"fulfillmentContact" : { 
            "firstName" : paypalOrder.FIRSTNAME, 
            "lastNameOrSurname" : paypalOrder.LASTNAME, 
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

		return self.getPaypalClient(context)
		.then(function(client) {
			switch(paymentAction.actionName) {
            case "CreatePayment":
                console.log("adding new payment interaction for ", paymentAction.externalTransactionId);
                //Add Details
                return createNewPayment(context, paymentAction);
            case "VoidPayment":
                console.log("Voiding payment interaction for ", payment.externalTransactionId);
                console.log("Void Payment", payment.id);
                return voidPayment(context, paymentAction);
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