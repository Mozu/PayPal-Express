var _ = require("underscore");
var helper = require("./helper");
var PaymentSettings = require("mozu-node-sdk/clients/commerce/settings/checkout/paymentSettings");
var paymentConstants = require("./constants");
const { PaypalRestSdk } = require("./rest/paypalsdk");


module.exports = {
	getInteractionByStatus: function (interactions, status) {
		return _.find(interactions, function (interaction) {
			return interaction.status == status;
		});
	},
	getPaymentConfig: function (context) {
		var self = this;
		return helper.createClientFromContext(PaymentSettings, context, true)
			.getThirdPartyPaymentWorkflowWithValues({ fullyQualifiedName: helper.getPaymentFQN(context) })
			.then(function (paypalSettings) {
				return self.getConfig(paypalSettings);
			});
	},
	getConfig: function (paypalSettings) {
		return {
			userName: helper.getValue(paypalSettings, paymentConstants.USERNAME),
			password: helper.getValue(paypalSettings, paymentConstants.PASSWORD),
			signature: helper.getValue(paypalSettings, paymentConstants.SIGNATURE),
			environment: helper.getValue(paypalSettings, paymentConstants.ENVIRONMENT) || "sandbox",
			merchantId: helper.getValue(paypalSettings, paymentConstants.MERCHANTACCOUNTID),
			processingOption: helper.getValue(paypalSettings, paymentConstants.ORDERPROCESSING) || paymentConstants.CAPTUREONSHIPMENT,
			enabled: paypalSettings.isEnabled
		};
	},

	getPaypalClient: function (config) {
		const { userName, password, environment } = config;
		const paypalClient = new PaypalRestSdk(userName, password, environment === "sandbox");
		return paypalClient;
	},

	validatePaymentSettings: function (context, callback) {
		var self = this;
		var paymentSettings = context.request.body;
		var paypalSettings = _.findWhere(paymentSettings.externalPaymentWorkflowDefinitions, { fullyQualifiedName: helper.getPaymentFQN(context) });
		if (!paypalSettings || !paypalSettings.IsEnabled) callback();

		var config = self.getConfig(paypalSettings);

		//TODO; need to change this validation.
		if (!config.userName || !config.password || !config.environment) {
			callback("Paypal Express - Environment/User Name/Password/Signatue/MerchantId fields are required.");
			return;
		}
	},
	createNewPayment: function (context, paymentAction) {
		var newStatus = { status: paymentConstants.NEW, amount: paymentAction.amount };
		return newStatus;
	},
	generateResponseText({status, correlationId}) {
		return `${status} ${correlationId ? ' - ' + correlationId : ''}`;
	},
	getPaymentResult: function (result, status, amount) {
		const self = this;
		console.log(result);
		var response = { status: status, amount: amount };
		if (status === paymentConstants.FAILED || status === paymentConstants.DECLINED ||
			status === paymentConstants.palPaymentStatuses.DENIED || status === paymentConstants.palPaymentStatuses.FAILED) {
			response.responseText = self.generateResponseText(result);
			response.responseCode = result.statusCode;
		}
		else {
			response.transactionId = result.transactionId;
			response.responseCode = 200;
			response.responseText = self.generateResponseText(result);
		}

		return response;
	},
	processPaymentResult: function (context, paymentResult, actionName, manualGatewayInteraction, payment) {
		var interactionType = "";
		var isManual = false;

		console.log("Payment Result", paymentResult);
		console.log("Payment Action", actionName);
		if (manualGatewayInteraction)
			isManual = true;
		console.log("Is manual Payment", isManual);
		switch (actionName) {
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

		if (paymentResult.status == paymentConstants.CREDITED)
			context.exec.setPaymentAmountCredited(paymentResult.amount);

		if (paymentResult.status == paymentConstants.CAPTURED)
			context.exec.setPaymentAmountCollected(paymentResult.amount);

		console.log("Payment interaction Type", interactionType);

		var interaction = { status: paymentResult.status, interactionType: interactionType };
		if (paymentResult.amount)
			interaction.amount = paymentResult.amount;

		if (paymentResult.transactionId)
			interaction.gatewayTransactionId = paymentResult.transactionId;

		if (paymentResult.responseText)
			interaction.gatewayResponseText = paymentResult.responseText;

		if (paymentResult.responseCode)
			interaction.gatewayResponseCode = paymentResult.responseCode;

		interaction.isManual = isManual;

		console.log("Payment Action result", interaction);
		payment.interactions.push(interaction);
		context.exec.addPaymentInteraction(interaction);

	},
	authorizePayment: function (context, config, paymentAction, payment) {
		var self = this;
		var isMultishipEnabled = context.get.isForCheckout();
		console.log('is for checkout', isMultishipEnabled);
		var order = isMultishipEnabled ? context.get.checkout() : context.get.order();

		var details = helper.getOrderDetails(order, false, paymentAction, isMultishipEnabled);

		var existingPayment = _.find(order.payments, function (payment) { return payment.paymentType === paymentConstants.PAYMENTSETTINGID && payment.paymentWorkflow === paymentConstants.PAYMENTSETTINGID && payment.status === "Collected"; });
		var existingAuthorized = _.find(order.payments, function (payment) { return payment.paymentType === paymentConstants.PAYMENTSETTINGID && payment.paymentWorkflow === paymentConstants.PAYMENTSETTINGID && payment.status === "Authorized"; });

		if (existingAuthorized) {
			details.token = existingAuthorized.externalTransactionId;
			details.payerId = existingAuthorized.billingInfo.data.paypal.payerId;
			details.existingAuth = existingAuthorized;
			details.processingFailed = true;
			return details;
		}

		if (existingPayment) {
			details.token = existingPayment.externalTransactionId;
			details.payerId = existingPayment.billingInfo.data.paypal.payerId;

			var existingAuth = _.find(existingPayment.interactions, function (interaction) { return interaction.interactionType === "Authorization" && interaction.status === paymentConstants.AUTHORIZED && interaction.gatewayResponseCode === "200"; });
			details.existingAuth = existingAuth;
		} else {
			details.token = payment.externalTransactionId;
			details.payerId = payment.billingInfo.data.paypal.payerId;
		}

		var client = self.getPaypalClient(config);
		if (context.configuration && context.configuration.paypal && context.configuration.paypal.authorization)
			details.testAmount = context.configuration.paypal.authorization.amount;

		if (details.existingAuth) {
			console.log("Using existing authorization", details.existingAuth);
			var response = self.getPaymentResult({ status: "Success", transactionId: details.existingAuth.gatewayTransactionId, ack: "success", }, paymentConstants.AUTHORIZED, paymentAction.amount);
			response.responseText = details.existingAuth.gatewayResponseText;
			response.processingFailed = details.processingFailed;
			return response;
		}
		return client.authorizePayment(details.token).
			then(function (result) {
				return self.getPaymentResult(result, paymentConstants.AUTHORIZED, paymentAction.amount);
			}, function (err) {
				return self.getPaymentResult(err, paymentConstants.palPaymentStatuses.DENIED, paymentAction.amount);
			}).then(function (authResult) {
				if (config.processingOption === paymentConstants.CAPTUREONSHIPMENT || authResult.status == paymentConstants.DECLINED || authResult.status == paymentConstants.FAILED)
					return authResult;

				if (!authResult.processingFailed) {
					//Capture payment
					self.processPaymentResult(context, authResult, paymentAction.actionName, paymentAction.manualGatewayInteraction, payment);
				}

				return self.captureAmount(context, config, paymentAction, payment)
					.then(function (captureResult) {
						captureResult.captureOnAuthorize = true;
						return captureResult;
					});
			}).catch(function (err) {
				console.error("Authorize error", err);
				return self.getPaymentResult({ statusText: err }, paymentConstants.FAILED, paymentAction.amount);
			});
	},
	captureAmount: function (context, config, paymentAction, payment) {
		var self = this;
		var response = { amount: paymentAction.amount, gatewayResponseCode: "OK", status: paymentConstants.FAILED };

		var isMultishipEnabled = context.get.isForCheckout();
		console.log('isMultiship enabled', isMultishipEnabled);
		var order = isMultishipEnabled ? context.get.checkout() : context.get.order();

		if (paymentAction.manualGatewayInteraction) {
			console.log("Manual capture...dont send to amazon");
			response.status = paymentConstants.CAPTURED;
			response.transactionId = paymentAction.manualGatewayInteraction.gatewayInteractionId;
			return Promise.resolve(response);
		}

		var interactions = payment.interactions;

		var paymentAuthorizationInteraction = self.getInteractionByStatus(interactions, paymentConstants.AUTHORIZED);

		console.log("Authorized interaction", paymentAuthorizationInteraction);
		if (!paymentAuthorizationInteraction) {
			console.log("interactions", interactions);
			response.responseText = "Authorization Id not found in payment interactions";
			response.responseCode = 500;
			return Promise.resolve(response);
		}
		var client = self.getPaypalClient(config);
		var isPartial = true;
		if (context.configuration && context.configuration.paypal && context.configuration.paypal.capture)
			paymentAction.amount = context.configuration.paypal.capture.amount;

		return client.captureAuthorizedPayment(paymentAuthorizationInteraction.gatewayTransactionId,
			paymentAction.amount, paymentAction.currencyCode, isPartial)
			.then(function (captureResult) {
				return self.getPaymentResult(captureResult, paymentConstants.CAPTURED, paymentAction.amount);
			}, function (err) {
				return self.getPaymentResult(err, paymentConstants.palPaymentStatuses.FAILED, paymentAction.amount);
			}).catch(function (err) {
				console.error("Capture Error ", err);
				return self.getPaymentResult({ statusText: err }, paymentConstants.FAILED, paymentAction.amount);
			});

	},
	creditPayment: function (context, config, paymentAction, payment) {
		var self = this;
		var capturedInteraction = self.getInteractionByStatus(payment.interactions, paymentConstants.CAPTURED);
		console.log("AWS Refund, previous capturedInteraction", capturedInteraction);
		if (!capturedInteraction) {
			return { status: paymentConstants.FAILED, responseCode: "InvalidRequest", responseText: "Payment has not been captured to issue refund" };
		}

		if (paymentAction.manualGatewayInteraction) {
			console.log("Manual credit...dont send to Paypal");
			return {
				amount: paymentAction.amount, gatewayResponseCode: "OK", status: paymentConstants.CREDITED,
				transactionId: paymentAction.manualGatewayInteraction.gatewayInteractionId
			};
		}

		if (capturedInteraction.isManual && !capturedInteraction.gatewayInteractionId)
			return { status: paymentConstants.FAILED, responseCode: "InvalidRequest", responseText: "Cannot credit or refund on manual capture." };

		var fullRefund = paymentAction.amount === capturedInteraction.amount;
		var client = self.getPaypalClient(config);

		if (context.configuration && context.configuration.paypal && context.configuration.paypal.refund)
			paymentAction.amount = context.configuration.paypal.refund.amount;

		return client.refundCapturePayment(capturedInteraction.gatewayTransactionId, paymentAction.amount, paymentAction.currencyCode).then(
			function (refundResult) {
				return self.getPaymentResult(refundResult, paymentConstants.CREDITED, paymentAction.amount);
			}, function (err) {
				console.error("Credit Error", err);
				return self.getPaymentResult(err, paymentConstants.FAILED, paymentAction.amount);
			});
	},
	voidPayment: function (context, config, paymentAction, payment) {
		var self = this;
		if (paymentAction.manualGatewayInteraction) {
			console.log("Manual void...dont send to amazon");
			return {
				amount: paymentAction.amount, gatewayResponseCode: "OK", status: paymentConstants.VOIDED,
				awsTransactionId: paymentAction.manualGatewayInteraction.gatewayInteractionId
			};
		}

		var capturedInteraction = self.getInteractionByStatus(payment.interactions, paymentConstants.CAPTURED);
		console.log("Void Payment - Captured interaction", capturedInteraction);
		if (capturedInteraction) {
			return { status: paymentConstants.FAILED, responseCode: "InvalidRequest", responseText: "Payment with captures cannot be voided. Please issue a refund" };
		}

		var authorizedInteraction = self.getInteractionByStatus(payment.interactions, paymentConstants.AUTHORIZED);

		if (!authorizedInteraction || context.get.isVoidActionNoOp())
			return { status: paymentConstants.VOIDED, amount: paymentAction.amount };
		var client = self.getPaypalClient(config);

		if (context.configuration && context.configuration.paypal && context.configuration.paypal.void)
			authorizedInteraction.gatewayTransactionId = context.configuration.paypal.void.authorizationId;

		return client.voidAuthorizedPayment(authorizedInteraction.gatewayTransactionId).then(
			function (result) {
				return self.getPaymentResult(result, paymentConstants.VOIDED, paymentAction.amount);
			},
			function (err) {
				console.error("Void Payment", err);
				return self.getPaymentResult(err, paymentConstants.FAILED, paymentAction.amount);
			}
		);
	}
};
