module.exports = {
  
  'http.storefront.pages.global.request.before': {
      actionName:'http.storefront.pages.global.request.before',
      customFunction: require('./domains/storefront/http.storefront.pages.global.request.before')
   },
  
  'http.storefront.pages.global.request.after': {
      actionName:'http.storefront.pages.global.request.after',
      customFunction: require('./domains/storefront/http.storefront.pages.global.request.after')
   }
  
};