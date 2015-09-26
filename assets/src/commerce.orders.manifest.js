module.exports = {
  
  'embedded.commerce.orders.action.after': {
      actionName:'embedded.commerce.orders.action.after',
      customFunction: require('./domains/commerce.orders/embedded.commerce.orders.action.after')
   },
  
  'http.commerce.orders.setFulFillmentInfo.before': {
      actionName:'http.commerce.orders.setFulFillmentInfo.before',
      customFunction: require('./domains/commerce.orders/http.commerce.orders.setFulFillmentInfo.before')
   }
  
};