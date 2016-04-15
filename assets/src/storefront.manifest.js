module.exports = {
  
  'paypalCartAfter': {
      actionName: 'http.storefront.pages.cart.request.after',
      customFunction: require('./domains/storefront/paypalCartAfter')
  },
  
  'paypalCheckoutAfter': {
      actionName: 'http.storefront.pages.checkout.request.after',
      customFunction: require('./domains/storefront/paypalCheckoutAfter')
  },
  
  'paypalProcessor': {
      actionName: 'http.storefront.routes',
      customFunction: require('./domains/storefront/paypalProcessor')
  },
  'paypalToken': {
      actionName: 'http.storefront.routes',
      customFunction: require('./domains/storefront/paypalToken')
  }
};
