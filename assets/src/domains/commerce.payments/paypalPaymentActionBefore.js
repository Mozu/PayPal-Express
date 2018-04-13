/**
 * Implementation for embedded.commerce.payments.action.before

 * This custom function will receive the following context object:
{
  "exec": {
    "setActionAmount": {
      "parameters": [
        {
          "name": "amount",
          "type": "number"
        }
      ],
      "return": {
        "type": "mozu.commerceRuntime.contracts.payments.paymentAction"
      }
    },
    "setPaymentData": {
      "parameters": [
        {
          "name": "key",
          "type": "string"
        },
        {
          "name": "value",
          "type": "object"
        }
      ]
    },
    "removePaymentData": {
      "parameters": [
        {
          "name": "key",
          "type": "string"
        }
      ]
    },
    "setActionPreAuthFlag": {
      "parameters": [
        {
          "name": "isPreAuth",
          "type": "bool"
        }
      ]
    }
  },
  "get": {
    "payment": {
      "parameters": [],
      "return": {
        "type": "mozu.commerceRuntime.contracts.payments.payment"
      }
    },
    "paymentAction": {
      "parameters": [],
      "return": {
        "type": "mozu.commerceRuntime.contracts.payments.paymentAction"
      }
    }
  }
}


 */

var paymentConstants = require("../../paypal/constants");
var _ = require("underscore");
var paypal = require('../../paypal/checkout');

module.exports = function(context, callback) {
  var payment = context.get.payment();
  if (payment.paymentType !== paymentConstants.PAYMENTSETTINGID  && payment.paymentWorkflow !== paymentConstants.PAYMENTSETTINGID) callback();

  paypal.getCheckoutSettings(context).then(function(settings) {
    var order = null;
    if (settings.isMultishipEnabled)
      return callback();

    order = context.get.order();

    var existingPayment = _.find(order.payments,
      function(payment) {
        return payment.paymentType === paymentConstants.PAYMENTSETTINGID  &&
              payment.paymentWorkflow === paymentConstants.PAYMENTSETTINGID &&
              payment.status === "Collected";
      });

    if (existingPayment) {
      var billingInfo = context.get.payment().billingInfo;
      billingInfo.externalTransactionId = existingPayment.externalTransactionId;
      billingInfo.data = existingPayment.data;
      context.exec.setExternalTransactionId(billingInfo.externalTransactionId);
      context.exec.setPaymentData("paypal",existingPayment.billingInfo.data.paypal);
      context.exec.setBillingInfo(billingInfo);
    }

    callback();
  });
};
