/**
 * Implementation for embedded.commerce.payments.action.performPaymentInteraction
 * This function will receive the following context object:

{
  &#34;exec&#34;: {
    &#34;addPaymentInteraction&#34;: {
      &#34;parameters&#34;: [
        {
          &#34;name&#34;: &#34;paymentInteraction&#34;,
          &#34;type&#34;: &#34;string&#34;
        }
      ],
      &#34;return&#34;: {
        &#34;type&#34;: &#34;mozu.commerceRuntime.contracts.payments.paymentInteraction&#34;
      }
    }
  },
  &#34;get&#34;: {
    &#34;payment&#34;: {
      &#34;parameters&#34;: [],
      &#34;return&#34;: {
        &#34;type&#34;: &#34;mozu.commerceRuntime.contracts.payments.payment&#34;
      }
    },
    &#34;paymentAction&#34;: {
      &#34;parameters&#34;: [],
      &#34;return&#34;: {
        &#34;type&#34;: &#34;mozu.commerceRuntime.contracts.payments.paymentAction&#34;
      }
    }
  }
}

 */
var paypal = require('../../paypal/checkout');

module.exports = function(context, callback) {
    paypal.getCheckoutSettings(context).then(function(settings){
      paypal.processPayment(context, callback, settings.isMultishipEnabled );
    });
};