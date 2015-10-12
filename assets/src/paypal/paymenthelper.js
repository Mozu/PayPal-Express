var _ = require("underscore");
var helper = require("./helper");
var PaymentSettings = require("mozu-node-sdk/clients/commerce/settings/checkout/paymentSettings");
var generalSettingsClient = require('mozu-node-sdk/clients/commerce/settings/generalSettings');
var Paypal = require("./paypalsdk");
var paymentConstants = require("./constants");

module.exports = {
	getInteractionByStatus: function (interactions, status) {
	  return _.find(interactions, function(interaction){
	      return interaction.status == status;
	  } );
	},
	getPaymentConfig: function(context) {
		return helper.createClientFromContext(PaymentSettings, context,true)
			.getThirdPartyPaymentWorkflowWithValues({fullyQualifiedName: helper.getPaymentFQN(context)})
			.then(function(paypalSettings) {
				return {
					userName: helper.getValue(paypalSettings, paymentConstants.USERNAME),
					password: helper.getValue(paypalSettings, paymentConstants.PASSWORD),
					signature: helper.getValue(paypalSettings, paymentConstants.SIGNATURE),
					environment : helper.getValue(paypalSettings, paymentConstants.ENVIRONMENT) || "sandbox",
					processingOption : helper.getValue(paypalSettings, paymentConstants.ORDERPROCESSING) || paymentConstants.CAPTUREONSHIPMENT,
					enabled: paypalSettings.isEnabled
				};
		});
	},
	getPaypalClient: function (config) {
		return new Paypal.create(config.userName, config.password, config.signature, config.environment === "sandbox");
	},
	createNewPayment: function (context, paymentAction) {
		var newStatus = { status : paymentConstants.NEW, amount: paymentAction.amount};
		return newStatus;
	},
	getPaymentResult: function (result, status, amount) {
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
	},
	processPaymentResult: function (context,paymentResult, actionName, manualGatewayInteraction) {
	    var interactionType = "";
	    var isManual = false;

	    console.log("Payment Result", paymentResult);
	    console.log("Payment Action", actionName);
	    if (manualGatewayInteraction)
	      isManual = true;
		console.log("Is manual Payment", isManual);
	    switch(actionName) {
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
	      context.exec.setPaymentAmountRequested(paymentResult.amount);

	    console.log("Payment interaction Type", interactionType);

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


	    if (paymentResult.status == paymentConstants.CAPTURED)
	      context.exec.setPaymentAmountCollected(paymentResult.amount);
  	},
  	authorizePayment: function (context, config, paymentAction, payment) {
  		var self = this;
		var payerId = payment.billingInfo.data.paypal.payerId;
		return helper.getOrder(context, payment.orderId, false).then(function(order) {
			var details = helper.getOrderDetails(order,false, paymentAction);
			details.token= payment.externalTransactionId;
			details.payerId= payerId;


			return details;
		}).then(function(order){
			console.log(order);
			var client = self.getPaypalClient(config);
			if (context.configuration && context.configuration.paypal && context.configuration.paypal.authorization)
				order.amount = context.configuration.paypal.authorization.amount;

			return client.authorizePayment(order).
				then(function(result) {
					return self.getPaymentResult(result, paymentConstants.AUTHORIZED, paymentAction.amount);
				}, function(err) {
					return self.getPaymentResult(err, paymentConstants.DECLINED, paymentAction.amount);
				});	
		}).then(function(authResult) {
			if (config.processingOption === paymentConstants.CAPTUREONSHIPMENT)
				return authResult;
			//Capture payment
			self.processPaymentResult(context,authResult, paymentAction.actionName, paymentAction.manualGatewayInteraction);

			return self.captureAmount(context, config, paymentAction, payment)
					.then(function(captureResult) {
						captureResult.captureOnAuthorize = true;
						return captureResult;
					});
		}).catch(function(err) {
			console.log(err);
			return self.getPaymentResult({statusText: err}, paymentConstants.FAILED, paymentAction.amount);
		});
	},
	captureAmount: function (context, config, paymentAction, payment) {
  		var self = this;
		var response = {amount: paymentAction.amount, gatewayResponseCode:  "OK", status: paymentConstants.FAILED};

		return helper.getOrder(context, payment.orderId, false)
		.then(function(order){
			if (paymentAction.manualGatewayInteraction) {
		        console.log("Manual capture...dont send to amazon");
		        response.status = paymentConstants.CAPTURED;
		        response.transactionId = paymentAction.manualGatewayInteraction.gatewayInteractionId;
		        return response;
		      }

	        var interactions = payment.interactions;

		    var paymentAuthorizationInteraction = self.getInteractionByStatus(interactions, paymentConstants.AUTHORIZED);

		    console.log("Authorized interaction",paymentAuthorizationInteraction );
		    if (!paymentAuthorizationInteraction) {
		      console.log("interactions", interactions);
		      response.responseText = "Authorization Id not found in payment interactions";
		      response.responseCode = 500;
		      return response;
		    }
		    var client = self.getPaypalClient(config);

		    if (context.configuration && context.configuration.paypal && context.configuration.paypal.capture)
				paymentAction.amount = context.configuration.paypal.capture.amount;

		    return client.doCapture(payment.externalTransactionId,order.orderNumber,
		    								paymentAuthorizationInteraction.gatewayTransactionId, 
		    								paymentAction.amount, paymentAction.currencyCode)
		    	.then(function(captureResult){
		         	return self.getPaymentResult(captureResult,paymentConstants.CAPTURED, paymentAction.amount);
		    	}, function(err) {
		    		return self.getPaymentResult(err, paymentConstants.FAILED, paymentAction.amount);
		    	});	
		}).catch(function(err) {
			console.log(err);
			return self.getPaymentResult({statusText: err}, paymentConstants.DECLINED, paymentAction.amount);
		});

	},
	creditPayment: function(context, config, paymentAction, payment) {
		var self = this;
		var promise = new Promise(function(resolve, reject) {
	      var capturedInteraction = self.getInteractionByStatus(payment.interactions,paymentConstants.CAPTURED);
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
	      var client = self.getPaypalClient(config);

		  if (context.configuration && context.configuration.paypal && context.configuration.paypal.refund)
			paymentAction.amount = context.configuration.paypal.refund.amount;

	      return client.doRefund(capturedInteraction.gatewayTransactionId, fullRefund, paymentAction.amount, paymentAction.currencyCode).then(
	       function(refundResult) {
	       		resolve(self.getPaymentResult(refundResult,paymentConstants.CREDITED, paymentAction.amount));
	      }, function(err) {
	        console.log("Capture Error", err);
	        resolve(self.getPaymentResult(err, paymentConstants.FAILED, paymentAction.amount));
	      });
		});
		
		return promise;
	},
	voidPayment: function(context,config, paymentAction, payment) {
		var self = this;
		var promise = new Promise(function(resolve, reject) {
			if (paymentAction.manualGatewayInteraction) {
			      console.log("Manual void...dont send to amazon");
			      resolve({amount: paymentAction.amount,gatewayResponseCode:  "OK", status: paymentConstants.VOIDED,
			              awsTransactionId: paymentAction.manualGatewayInteraction.gatewayInteractionId});
			}

			var capturedInteraction = self.getInteractionByStatus(payment.interactions,paymentConstants.CAPTURED);
			console.log("Void Payment - Captured interaction", capturedInteraction);
			if (capturedInteraction) {
			  resolve({status : paymentConstants.FAILED, responseCode: "InvalidRequest", responseText: "Payment with captures cannot be voided. Please issue a refund"});
			} 

			var authorizedInteraction = self.getInteractionByStatus(payment.interactions,paymentConstants.AUTHORIZED);
			if (!authorizedInteraction) 
			  resolve( {status: paymentConstants.VOIDED, amount: paymentAction.amount});
			var client = self.getPaypalClient(config);

			if (context.configuration && context.configuration.paypal && context.configuration.paypal.void)
				pauthorizedInteraction.gatewayTransactionId = context.configuration.paypal.void.authorizationId;

			return client.doVoid(authorizedInteraction.gatewayTransactionId).then(
				function(result) {
					resolve(self.getPaymentResult(result,paymentConstants.VOIDED, paymentAction.amount ));
				},
				function(err) {
					resolve(self.getPaymentResult(result,paymentConstants.FAILED, paymentAction.amount ));	
				}
			);

		});
		return promise;
	}
};