module.exports = {
  PAYMENTSETTINGID: "paypal_complete_payments_application", // Must match your DevCenter App's AppKey
	PAYPALMULTIPARTYAPPKEY: "paypalMultipartyAppKey", // Required for Kibo to recognize thirdpartyworkflow as PayPal Multiparty implementation
  PAYPALMULTIPARTYAPPKEYVALUE: "mozuadmin.paypal_complete_payments_application.1.0.0.Release", // Determines which SecureAppData Kibo will pull partner credentials from. TODO pull from install context
  PAYPALMULTIPARTYPAYMENTTYPE: "PaypalCompletePayments", //This value will get set as Payment.PaymentType and display in Admin UI as Payment Method
	ENVIRONMENT: "environment",
	USERNAME: "username",
	PASSWORD: "password",
	SIGNATURE: "signature",
	MERCHANTACCOUNTID: "merchantAccountId",
	ONBOARDED: "onboarded",
	TRACKINGID: "trackingId",
	CAPTUREONSUBMIT: "AuthAndCaptureOnOrderPlacement",
	CAPTUREONSHIPMENT: "AuthOnOrderPlacementAndCaptureOnOrderShipment",
	ORDERPROCESSING: "orderProcessing",
	FAILED: "Failed",
	NEW: "New",
	DECLINED: "Declined",
	
	AUTHORIZED: "Authorized",
	CAPTURED: "Captured",
	CREDITED: "Credited",
	CREDITPENDING: "CreditPending",
	VOIDED: "Voided",
	palPaymentStatuses: {
		FAILED: "FAILED",
		DENIED: "DENIED",
	},
	LinkStatuses: {
		APPROVE: "approve"
	}
};

