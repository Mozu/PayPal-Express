module.exports = {
    URLS: {
        sandboxUrl: 'https://api-m.sandbox.paypal.com/',
        prodUrl: '',
        orderUrlPrefix: 'v2/checkout/orders',
        paymentUrlPrefix: 'v2/payments',
        paymentAuthPrefix: '/authorizations',
        paymentCapturePrefix: '/captures',
        token: 'https://api-m.sandbox.paypal.com/v1/oauth2/token'
    },
    BREAKDOWNLOOKUP: {
        shipping: 'shippingAmount',
        tax_total: 'taxAmount',
        shipping_discount: 'shippingDiscount',
        handling: 'handlingAmount',
        item_total: 'items'
    },
    PAYMENTINTENT: {
        capture: 'CAPTURE',
        authorize: 'AUTHORIZE'
    }
};