module.exports = {
	PAYPALMULTIPARTYAPPKEY: "paypalMultipartyAppKey", // Required for Kibo to recognize thirdpartyworkflow as PayPal Multiparty implementation
  PAYPALMULTIPARTYAPPKEYVALUE: "mzint.paypal_complete_payments_application.1.0.1.Release", // Determines which SecureAppData Kibo will pull partner credentials from. TODO pull from install context
  PAYPALMULTIPARTYPAYMENTTYPE: "PayPalCompletePayments", //This value will get set as Payment.PaymentType and display in Admin UI as Payment Method
  PAYPALMULTIPARTYPAYMENTWORKFLOW: "PayPalCompletePayments", //This value will get set as Payment.PaymentWorkflow and used for the CheckoutSettings third-party-workflow name
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

